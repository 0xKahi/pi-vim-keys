# src/utils/editor/

## Responsibility

This folder contains low-level editor utilities used by the vim modal layer to mirror Pi TUI's internal rendering behavior without violating Pi's extension-loader constraints.

- `word-wrap.util.ts` — Runtime-safe, standalone copy of Pi's `wordWrapLine`. It splits a single logical line of text into visual-line `WrappedChunk`s that match the wrap geometry used by Pi's own editor renderer.
- `pi-tui-internals.ts` — Test-only deep import of Pi TUI's real `wordWrapLine` and its `TextChunk` type. It exists purely as a parity oracle so the local copy can be verified against the upstream implementation.

These utilities enable `VisualHighlightRenderer` to compute the same visual-row layout Pi produced during `super.render()`, which is required to overlay visual-mode selection highlighting on wrapped text.

## Design

The folder intentionally separates runtime usage from test-time verification because Pi's extension loader resolves bare `@earendil-works/pi-tui` to the package main file and then appends subpaths. A deep import of `@earendil-works/pi-tui/dist/components/editor.js` therefore resolves to a bogus path at runtime, but resolves correctly under Bun/Node during tests.

### `wordWrapLine` algorithm

`wordWrapLine(line: string, maxWidth: number, preSegmented?: Intl.SegmentData[]): WrappedChunk[]`

- Segments the line into Unicode grapheme clusters using `Intl.Segmenter` with `granularity: 'grapheme'`, unless `preSegmented` is supplied.
- Uses `visibleWidth` from `@earendil-works/pi-tui` to measure each grapheme's display width (handles CJK, emoji, ANSI, etc.).
- Performs greedy line wrapping while remembering the most recent whitespace wrap opportunity.
- Returns an array of `WrappedChunk` objects, each carrying:
  - `text` — the substring for that visual row
  - `startIndex`/`endIndex` — zero-based byte indices into the original logical line

Wrap-opportunity logic:

1. Track `currentWidth`, `chunkStart`, `wrapOppIndex`, and `wrapOppWidth` while iterating graphemes.
2. When adding the next grapheme would exceed `maxWidth`:
   - If a whitespace opportunity exists and moving the break there keeps the new row within `maxWidth`, break at `wrapOppIndex`.
   - Otherwise break at the current grapheme boundary.
3. Reset the opportunity tracker after each break.
4. If a single grapheme is wider than `maxWidth`, recursively wrap the grapheme itself and emit sub-chunks with byte offsets adjusted back into the original line.

Special cases:

- Paste markers such as `[paste #1 +123 lines]` are recognized by `isPasteMarker` so they are not treated as whitespace wrap opportunities.
- Empty input or non-positive `maxWidth` returns a single empty chunk `{ text: '', startIndex: 0, endIndex: 0 }`.
- Lines that already fit return a single chunk spanning the full line.

### Test bridge

`pi-tui-internals.ts` re-exports `{ type TextChunk, wordWrapLine }` from Pi's internal editor module. The test `test/word-wrap.util.test.ts` compares `localWordWrapLine(...)` against `piWordWrapLine(...)` across a battery of lines, widths, and pre-segmented inputs. This parity test acts as a drift tripwire: if Pi changes its wrap algorithm, the test fails and signals that `word-wrap.util.ts` must be updated.

## Flow

1. `VimModalEditor.render(width)` calls `super.render(width)` first, letting Pi draw the editor with its own wrap geometry.
2. If the mode is visual or visual-line, `VimModalEditor` invokes `VisualHighlightRenderer.render(...)`.
3. `VisualHighlightRenderer` reads `editorInternals.lastWidth` (the wrap width Pi's editor recorded from its own render) and computes `contentWidth` from the provided render `width` and editor padding.
4. In `buildLayoutLines(contentWidth)`, each logical line is passed to `wordWrapLine(lineText, contentWidth, [...segment(lineText, 'grapheme')])`.
5. `wordWrapLine` returns `WrappedChunk[]`, which `VisualHighlightRenderer` maps to `LayoutLine[]` objects carrying logical line index, column span, wrapped text, and whether the cursor falls on that visual row.
6. The renderer then maps the `EditorAnchoredRange` from `EditorCompassController` onto the visible visual rows and applies the selection style only to the overlapping column intervals.

At test time:

1. `test/word-wrap.util.test.ts` imports `piWordWrapLine` through `src/utils/editor/pi-tui-internals.ts`.
2. For every test line and width, it asserts structural equality between `localWordWrapLine(line, width)` and `piWordWrapLine(line, width)`.
3. A second test exercises the `preSegmented` path to ensure the optimization matches Pi's behavior.

## Integration

### Upstream dependency

- `@earendil-works/pi-tui` public API:
  - `visibleWidth` — used by `wordWrapLine` to measure grapheme display width.
- `@earendil-works/pi-tui/dist/components/editor.js` — imported only by `pi-tui-internals.ts`, and only inside tests, to access the real `wordWrapLine` and `TextChunk` type.

### Consumers

- `src/editor/visual-highlight-renderer.ts` — the sole runtime consumer of `wordWrapLine`. It reconstructs the visual-row layout for the current editor content so visual-mode selection can be highlighted on the exact rows Pi rendered.
- `src/editor/editor-compass-controller.ts` — provides the `EditorAnchoredRange` that the visual renderer maps onto the wrapped layout. Although it does not import from `src/utils/editor/`, its ranges are the input to the wrapping/overlay flow.
- `src/vim-modal-editor.ts` — orchestrates the renderer and the compass controller. It owns the `render(width)` override that calls `VisualHighlightRenderer.render(...)` after `super.render(width)`.

### Coordinates

- `WrappedChunk.startIndex`/`endIndex` are byte offsets into the logical line string, not display columns.
- `VisualHighlightRenderer` translates `EditorRange.startCol`/`endCol` (also byte offsets) into local visual-row coordinates by subtracting `layoutLine.startCol`.
- This byte-offset alignment lets the renderer correlate Pi's public `getLines()`/`getCursor()` coordinates with the wrapped output without reimplementing Pi's full layout engine.
