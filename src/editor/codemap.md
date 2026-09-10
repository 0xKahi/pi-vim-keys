# src/editor/

## Responsibility

The `src/editor/` folder implements the low-level editing primitives for the `pi-vim-keys` modal extension. It wraps Pi's `@earendil-works/pi-tui` `Editor`/`CustomEditor` and exposes a set of small, single-purpose controllers that the modal layer uses to execute Vim-style movement, text mutation, selection anchoring, visual highlight rendering, and hardware-cursor management. None of these components are user-facing commands; they are the building blocks behind the normal/insert/visual/visual-line modes.

## Design

The folder is split into one helper type file and five controllers, each with a narrow, non-overlapping responsibility:

- `types.ts` — Centralizes the single unsafe view into Pi's editor internals through `EditorInternals` and `getEditorInternals(editor)`. The retained surface is exactly buffer/cursor `state`, edit bookkeeping (`preferredVisualCol`, `snappedFromCursorCol`, `lastAction`, `historyIndex`), undo primitives (`undoStack`, `pushUndoSnapshot`, `cancelAutocomplete`), cursor movement (`moveCursor`), segmentation (`segment`), Pi's recorded `lastWidth`, and optional paste metadata (`pastes`, `pasteCounter`). Each field remains only for behavior unavailable through the public API; host focus, change callbacks, render requests, and hardware-cursor visibility arrive through `EditorHostServices` instead.
- `editor-compass-controller.ts` — Selection-intent calculator. It stores an `AnchorState` (`'cursor'` or `'line'`) and resolves it into an `EditorAnchoredRange` made of normalized `EditorRange[]` entries. The `end` coordinate is exclusive for character spans, and the controller advances it by one grapheme so that visual selections include the last character under the cursor.
- `movement-controller.ts` — Vim-style cursor navigation. Uses Pi's `internal.moveCursor` when available; otherwise falls back to mutating `EditorState` directly. Supports basic arrow moves, word jumps (`start`/`end`, forward/backward), line/page leaps, and single-character `f`/`F`-style searches.
- `text-edit-controller.ts` — Text mutation and register/undo state. Performs deletes, yanks, pastes, new-line insertion, surround wrapping, and undo/redo. Each edit follows the same transaction pattern: `startEdit()` (push undo snapshot, cancel autocomplete, clear redo stack), mutate buffer/cursor, `finishEdit()` (reset cursor bookkeeping, fire `onChange`, request render).
- `hardware-cursor-controller.ts` — Adapts the terminal hardware cursor shape to the current `VimMode`. In normal/visual/visual-line modes it emits a steady block (`\x1b[2 q`); in insert mode it emits a steady bar (`\x1b[6 q`). It also strips the fake cursor highlight injected by Pi when hardware cursor mode is active.
- `visual-highlight-renderer.ts` — Post-processing overlay that applies selection styling to Pi's already-rendered editor lines. It reconstructs wrapped layout rows with `wordWrapLine`, uses the explicit per-render `scrollOffset` captured by the modal border hook, and reuses Pi's recorded `lastWidth` for wrapping parity.

Utilities used by the editor layer:

- `src/utils/editor/word-wrap.util.ts` — A local parity copy of Pi's `wordWrapLine`, producing `WrappedChunk[]` with logical `startIndex`/`endIndex` so layout rows can be mapped back to buffer columns.
- `src/utils/crayon.util.ts` — Provides `reverseVideo`, `colorize`, and `stripAnsi` for terminal styling.
- `src/types.ts` — Defines `VimMode` and `SurroundPairs` (bracket/quote maps) consumed by the modal layer and indirectly by `TextEditController.surround`.

## Flow

### Cursor and movement flow

1. The modal layer asks `MovementController` for a move (`move`, `jumpWord`, `leap`, `findChar`).
2. The controller reads the current cursor via `editor.getCursor()` and the buffer via `editor.getLines()`.
3. It computes a target `Position`:
   - For `move`, it first attempts `internal.moveCursor(deltaLine, deltaCol)` and falls back to adding deltas directly.
   - For `jumpWord`, it builds `WordRange[]` from the whole buffer using `getWordRanges` (regex `/\S+/g` with punctuation or `/[\p{L}\p{N}_]+/gu` without) and searches for the next/previous word start/end relative to the cursor.
   - For `leap`, it jumps to column 0 or line length for line bounds, or to line 0 / last line for page bounds.
   - For `findChar`, it scans the buffer forward or backward starting just past the cursor and stops at the first matching grapheme.
4. `setCursor(position)` clamps `cursorLine`/`cursorCol` to valid buffer bounds, writes them into `internal.state`, and clears Pi's cursor bookkeeping (`lastAction`, `preferredVisualCol`, `snappedFromCursorCol`).
5. If the cursor changed, `finishIfMoved` calls `requestRender` via the injected `EditorHostServices`.

### Text-edit flow

1. A modal command invokes `TextEditController.delete`, `deleteRange`, `deleteLine`, `yankRange`, `yankLine`, `paste`, `newLine`, `surround`, `undo`, or `redo`.
2. The controller fetches `EditorState` through `getEditorInternals` and calls `normalizeState` to guarantee at least one line and valid cursor coordinates.
3. `startEdit()` prepares the transaction:
   - Calls `internal.cancelAutocomplete()` if present.
   - Resets `historyIndex` and `lastAction`.
   - Clears the local `redoStack`.
   - Pushes an undo snapshot, preferring `internal.pushUndoSnapshot()`, then `internal.undoStack`, then a local `fallbackUndoStack`.
4. The command mutates `state.lines` and `state.cursorLine`/`state.cursorCol` (via `setCursorCol`) and, for deletes/yanks, stores text in the register (`RegisterEntry` of type `'character'` or `'line'`).
5. `finishEdit()` resets cursor bookkeeping and calls `notifyChange`, which fires the editor's `onChange(text)` callback and requests a render.
6. `undo()` pops the most recent complete snapshot, pushes a redo entry (`before` = snapshot, `after` = current state), and applies it. Snapshots include cloned state plus optional paste map/counter metadata. `redo()` verifies buffer and cursor state, and compares paste metadata when both sides carry it, before applying `after`. Native Pi snapshots are preferred; wrapped undo entries, raw `EditorState` entries, and a local fallback stack are supported. Raw-state entries restore buffer and cursor only, with no invented paste metadata.

### Compass wrapping flow

1. The modal layer calls `editorCompass.anchor(type, at?)` to set an anchor. The type can be `'cursor'` or `'line'`.
2. `getAnchoredRange(at?)` normalizes both the stored anchor and the current cursor against the buffer.
3. For a cursor anchor, it orders the two coordinates, advances the end by one grapheme using `advanceOneGrapheme` (segmentation via `Intl.Segmenter`), and returns inclusive bounds plus per-line `ranges`.
4. For a line anchor, it spans every full line from the smaller line to the larger line, with columns 0 to line length.
5. The resulting `EditorAnchoredRange` is consumed by `TextEditController.deleteRange`/`yankRange`/`surround` and by `VisualHighlightRenderer.render`.

### Visual-highlight flow

1. When the mode is visual/visual-line, the modal layer calls `VisualHighlightRenderer.render({ lines, width, range, style, scrollOffset })` after Pi's editor has rendered; `scrollOffset` is the count captured by `renderTopBorder`.
2. The renderer derives `EditorLayout` from the provided `width` and Pi's `paddingX`. The wrap width is reused from `internal.lastWidth` when available; otherwise it falls back to `contentWidth - (paddingX ? 0 : 1)`.
3. `buildLayoutLines` produces `LayoutLine[]` rows by applying `wordWrapLine` to each logical line. Each row records its logical line, buffer column range, wrapped text, and whether the cursor sits inside it.
4. The renderer clamps the explicit `scrollOffset` captured from Pi's `renderTopBorder` hook to the layout range. `getVisibleTextRowCount` counts rows between the top border (row 0) and bottom border (a line starting with `─`) so the overlay matches Pi's real viewport without reading Pi's private scroll offset.
5. For each visible row, `renderEditorTextLine` reassembles left padding, highlighted text, right padding, and the cursor cell. If the cursor is at the end of a row, it appends a marker cell using either the hardware cursor marker (`CURSOR_MARKER`) or a fake inverse-video cell (`\x1b[7m`).
6. `renderHighlightedText` splits each row at the cursor and calls `renderHighlightedSlice` on each part. `renderHighlightedSlice` computes local intervals that overlap the `range.ranges` and applies the supplied `style` function (typically `crayon.reverseVideo`) to selected segments.
7. The output array replaces Pi's text rows in place, leaving the top/bottom border lines untouched.

### Hardware-cursor flow

1. The modal layer calls `hardwareCursor.apply(mode)` on every mode change.
2. If `tui.getShowHardwareCursor()` is true, the controller writes the ANSI shape sequence for the current `VimMode` to `tui.terminal.write` and caches `lastAppliedShape` to avoid duplicate sequences.
3. If hardware cursor mode is disabled, it writes `\x1b[0 q` to restore the default shape.
4. During rendering, when hardware cursor mode is active, `stripFakeCursor(lines)` finds the line containing `CURSOR_MARKER`, strips the trailing `\x1b[7m ... \x1b[0m` or `\x1b[27m` fake cursor styling, and leaves only the marker so the terminal's hardware cursor draws the cell.

## Integration

The editor controllers are owned and orchestrated by the modal layer (outside `src/editor/`). The modal layer:

- Builds `EditorHostServices` from public `focused`/`onChange` plus protected TUI render and hardware-cursor services, then injects it into `MovementController`, `TextEditController`, and `VisualHighlightRenderer`; `EditorCompassController` and `HardwareCursorController` retain their focused adapters.
- Tracks `VimMode` and dispatches key events to controller methods (e.g., `movementController.move('right')`, `textEditController.delete('forward')`).
- Toggles anchors via `editorCompass.anchor`/`clearAnchor` and passes the resulting `EditorAnchoredRange` into delete/yank/surround and into `VisualHighlightRenderer`.
- Calls `hardwareCursor.apply(mode)` on mode transitions and renders visual selections by invoking `visualHighlightRenderer.render` with the current range and a style function.

Downstream, every controller ultimately reads from and writes to Pi's editor internals through `getEditorInternals`:

- `MovementController` and `TextEditController` read `editor.getCursor()`/`getLines()` and write `state.cursorLine`, `state.cursorCol`, and `state.lines`; movement requests rendering through its injected host service while cursor writes remain direct adapter operations.
- `TextEditController` pushes complete snapshots to `internal.undoStack` / `internal.pushUndoSnapshot()` when available, otherwise its local fallback, and uses injected host services for change notification and rendering.
- `VisualHighlightRenderer` receives focus, hardware-cursor visibility, and per-render scroll offset through `EditorHostServices`/render options, and reads only retained `internal.lastWidth` and `internal.segment`.
- `HardwareCursorController` reads `tui.getShowHardwareCursor()` and writes ANSI escape sequences to `tui.terminal`.

The protected `VimModalEditor.renderTopBorder`/`renderBottomBorder` hooks preserve Pi's border output while exposing scroll placement and composing the modal label. `test/vim-modal-editor-render.test.ts` covers this integration, and `test/paste-undo-redo.test.ts` covers paste metadata through undo/redo and raw-state fallback behavior.

This keeps `src/editor/` a thin, contained adapter layer: it does not own key parsing, command grammar, or mode state, but it provides all the buffer-aware operations the modal layer needs to implement Vim-style editing on top of Pi's existing editor widget.
