# Editor internals maintenance

This plugin intentionally reaches into a few private `pi-tui` `Editor` fields because the public API does not yet expose enough state for Vim-style movement, text editing, hardware cursor handling, and visual-mode highlighting.

The goal is to keep that unsafe coupling contained, tested, and easy to fix when `pi-tui` changes.

## Main files

### Runtime code

- `src/editor/types.ts`
  - Single source of truth for private `Editor` internals.
  - Contains `EditorInternals`, `EditorState`, `UndoStackLike`, and `getEditorInternals(editor)`.
  - This should be the only place that performs the unsafe `editor as unknown as EditorInternals` cast.

- `src/editor/movement-controller.ts`
  - Uses internals for direct cursor writes and native `moveCursor` fallback.
  - Depends on fields like `state`, `moveCursor`, `lastAction`, `preferredVisualCol`, `snappedFromCursorCol`, and `tui.requestRender`.

- `src/editor/text-edit-controller.ts`
  - Uses internals for direct buffer mutation, undo snapshots, history state, cursor reset state, and change notifications.
  - Depends on fields like `state`, `undoStack`, `pushUndoSnapshot`, `cancelAutocomplete`, `historyIndex`, `onChange`, `segment`, and `tui.requestRender`.

- `src/editor/visual-highlight-renderer.ts`
  - Uses internals to match Pi's rendered layout.
  - Depends on fields like `focused`, `scrollOffset`, `lastWidth`, `segment`, and `tui.getShowHardwareCursor`.

- `src/utils/editor/word-wrap.util.ts`
  - Local runtime copy of Pi's `wordWrapLine`.
  - This exists because Pi's extension loader cannot safely load deep imports like `@earendil-works/pi-tui/dist/components/editor.js` at runtime.

- `src/utils/editor/pi-tui-internals.ts`
  - Test-only deep import of Pi internals.
  - Do not import this from runtime code reachable from `src/index.ts`.

### Tests

- `test/editor-internals.test.ts`
  - Runtime tripwire for `EditorInternals`.
  - Constructs a real `pi-tui` `Editor` and verifies the private fields/methods we depend on still exist.

- `test/visual-highlight-renderer.test.ts`
  - Tripwire for visual highlight layout assumptions.
  - Verifies wrap width, visible row counts, row widths, and visual-line padding behavior.

- `test/word-wrap.util.test.ts`
  - Parity test between our local `wordWrapLine` copy and Pi's real `wordWrapLine`.
  - If Pi changes wrapping behavior, this test should fail.

## Known fragile assumptions

### 1. Private Editor field names

`EditorInternals` depends on private fields/methods in `pi-tui`'s `Editor`. If Pi renames or removes any of these, things can break:

- `state`
- `focused`
- `scrollOffset`
- `lastWidth`
- `preferredVisualCol`
- `snappedFromCursorCol`
- `lastAction`
- `historyIndex`
- `undoStack`
- `pushUndoSnapshot`
- `cancelAutocomplete`
- `onChange`
- `tui`
- `moveCursor`
- `segment`

First place to check: `src/editor/types.ts` and `test/editor-internals.test.ts`.

### 2. Editor render layout

Visual highlighting depends on matching Pi's render layout. Important Pi behavior we rely on:

- `Editor.render(width)` runs before `VisualHighlightRenderer.render(...)`.
- `render(width)` sets `lastWidth`, which we reuse as the wrapping width.
- `scrollOffset` is updated/clamped by Pi before the visual highlight renderer reads it.
- Text rows live between the top border and bottom border.
- Border rows start with `─` after ANSI stripping.

If highlights appear shifted, wrap at the wrong place, or target the wrong visible rows, check:

- `src/editor/visual-highlight-renderer.ts`
- `test/visual-highlight-renderer.test.ts`
- Pi's `Editor.render()` implementation in `node_modules/@earendil-works/pi-tui/dist/components/editor.js`

### 3. Word wrapping

Runtime code uses our local `src/utils/editor/word-wrap.util.ts` copy.

The parity oracle is Pi's real `wordWrapLine`, imported only in tests via `src/utils/editor/pi-tui-internals.ts`.

If `test/word-wrap.util.test.ts` fails after a Pi update, compare our local copy with Pi's implementation in:

```txt
node_modules/@earendil-works/pi-tui/dist/components/editor.js
```

Look for changes around:

- `wordWrapLine`
- paste marker handling
- whitespace wrapping
- grapheme segmentation
- wide-character handling

Do not fix this by importing the deep Pi path in runtime code. Pi's extension loader has previously resolved that path incorrectly.

### 4. Paste markers

Pi stores large pastes as compact markers like:

```txt
[paste #1 +123 lines]
[paste #2 1234 chars]
```

`getText()` and `getLines()` use the marker representation. `getExpandedText()` expands markers to the real content.

Most editor internals and compass ranges operate in marker-space, not expanded-space. Avoid mixing expanded-text offsets with `EditorState` / `getLines()` coordinates.

### 5. Cursor rendering

Visual highlighting interacts with Pi's cursor rendering and the plugin's hardware cursor support.

Relevant files:

- `src/editor/hardware-cursor-controller.ts`
- `src/editor/visual-highlight-renderer.ts`

Potential symptoms after Pi updates:

- duplicate cursor
- missing cursor
- highlight covering cursor incorrectly
- hardware cursor marker appearing visibly

Check whether Pi changed:

- `CURSOR_MARKER`
- fake cursor ANSI rendering
- hardware cursor behavior
- when cursor marker is emitted

### 6. Visual-line padding behavior

Visual-line mode intentionally highlights only actual line text, not the trailing editor padding.

This was a deliberate fix: highlighting padding made visual-line selection look like it filled the entire terminal width.

Regression test:

```txt
test/visual-highlight-renderer.test.ts
```

Search for:

```txt
does not highlight trailing padding for visual-line ranges
```

## Pi update checklist

When upgrading `@earendil-works/pi-tui` or `@earendil-works/pi-coding-agent`:

1. Run:

   ```sh
   bun run type-check
   bun test
   bun run lint
   ```

2. If `test/editor-internals.test.ts` fails:
   - Check `src/editor/types.ts`.
   - Compare against Pi's current `Editor` implementation.
   - Update `EditorInternals` and affected controller code.

3. If `test/word-wrap.util.test.ts` fails:
   - Compare `src/utils/editor/word-wrap.util.ts` with Pi's `wordWrapLine`.
   - Copy over the relevant algorithm changes.
   - Keep the runtime code local; do not deep-import Pi's editor module.

4. If `test/visual-highlight-renderer.test.ts` fails:
   - Check whether Pi changed `render(width)`, `layoutText`, borders, scroll indicators, cursor rendering, or viewport sizing.
   - Update `src/editor/visual-highlight-renderer.ts` accordingly.

5. Manually smoke test:
   - normal movement: `h/j/k/l`, `w/W/b/B/e/E`, `gg`, `G`
   - insert/normal switching
   - delete commands: `x`, `X`, `dd`
   - visual mode: `v`
   - visual-line mode: `V`
   - wrapped long lines
   - CJK/emoji text
   - hardware cursor enabled and disabled
   - large pasted content / paste markers

## Design rule

Do not add new scattered casts like:

```ts
editor as unknown as SomeLocalEditorInternals
```

Instead:

1. Add the field/method to `EditorInternals` in `src/editor/types.ts`.
2. Use `getEditorInternals(editor)`.
3. Add or update coverage in `test/editor-internals.test.ts`.

That keeps private Pi coupling visible, testable, and fixable in one place.
