# src/utils/

## Responsibility

`src/utils/` holds small, stateless, single-purpose helpers used by the vim modal editor and configuration loader. The root utilities cover four concerns: terminal ANSI styling, low-level key-input debugging, extension config file discovery, and vim mode/pending-key formatting. The `editor/` child directory contains a local copy of Pi TUI's word-wrap algorithm and a test-only deep import facade for parity checks; that subtree has its own codemap and is not detailed here.

## Design

- **ANSI styling (`crayon.util.ts`)**: The `crayon` object exposes `colorize`, `reverseVideo`, and `stripAnsi`. Internally `hexToRgb` converts `#RRGGBB` hex strings to RGB components, and `fgAnsi`/`bgAnsi` emit 24-bit true-color ANSI escape sequences (`ESC[38;2;R;G;Bm` and `ESC[48;2;R;G;Bm`). `colorize` validates hex against `COLOR_HEX_REGEX` before applying, and emits matching reset codes (`ESC[39m` / `ESC[49m`) to avoid leaking styles. `stripAnsi` removes all ANSI SGR sequences using a CSI regex anchored at `0x1b`.

- **Input debugging (`debug-input.util.ts`)**: Two append-only log helpers. `logKeyInput` writes `pi-vim-keys-input.log` with the ISO timestamp, raw `data`, the parsed key from `@earendil-works/pi-tui`'s `parseKey`, and a char-code array. `logData` writes arbitrary JSON to `pi-vim-log-input.log`. Both are toggled at call sites via a `DEBUG_INPUT` flag, not by the utility itself.

- **Path resolution (`path.util.ts`)**: `PathUtil` is a static-method class that resolves extension config files. `findFile` returns a `{ exists, path }` record from `existsSync`. `findExtensionConfig` is overloaded for `global` and `project` lookups: global resolves `<getAgentDir()>/extensions/<EXTENSION_ID>/config.json`; project resolves `<cwd>/.pi/extensions/<EXTENSION_ID>/config.json`. The private `getEtensionConfig` joins the path segments using `node:path`.

- **Vim mode helpers (`vim-mode.util.ts`)**: Two pure functions. `isVisualMode` checks membership in `VISUAL_MODES` (`'visual'`, `'visualLine'`). `formatModeLabel` maps a `VimMode` to a display label (`NORMAL`, `INSERT`, `VISUAL`, `V-LINE`) and, when a `PendingKey` is present, appends the leader key (`formatLeader` maps `'space'` to `<leader>`) plus the sequence key and a trailing `_` cursor.

- **Editor utilities (`editor/`)**: Kept isolated because they deal with Pi TUI internals. `wordWrapLine` in `word-wrap.util.ts` re-implements Pi's grapheme-aware wrapping and is guarded by a parity test against `pi-tui-internals.ts`.

## Flow

1. **Mode label rendering**: `VimModalEditor.modeLabel` calls `formatModeLabel(this.mode, pendingKey)` on every render. The result is passed through `crayon.colorize` and `crayon.reverseVideo` before being overlaid on the editor's bottom border line.
2. **Config loading**: `ConfigLoader.initializeConfig` calls `PathUtil.findExtensionConfig({ type: 'global' })` then `PathUtil.findExtensionConfig({ type: 'project', cwd })`. Existing paths are read and merged into the validated `PiVimKeysConfig`.
3. **Visual selection overlay**: `VisualHighlightRenderer.render` uses `crayon.stripAnsi` to detect the border line (`startsWith('─')`) so it knows how many visible text rows Pi produced before applying highlight styles.
4. **Debug tracing**: When `DEBUG_INPUT` is true, `VimModalEditor.handleInput` calls `logKeyInput(data, extra)` before dispatching to the mode handler.

## Integration

- `crayon.util.ts` is consumed by `src/vim-modal-editor.ts` (mode label styling and width-aware string cleaning) and `src/editor/visual-highlight-renderer.ts` (ANSI-aware border detection).
- `debug-input.util.ts` is consumed only by `src/vim-modal-editor.ts` for runtime input tracing.
- `path.util.ts` is consumed only by `src/config-loader.ts` to locate global and per-project extension config files.
- `vim-mode.util.ts` is consumed only by `src/vim-modal-editor.ts`, which uses `isVisualMode` for anchor management and selection rendering and `formatModeLabel` for the status indicator.
- `editor/` utilities are consumed by `src/editor/visual-highlight-renderer.ts` (`wordWrapLine`) and the word-wrap parity test (`pi-tui-internals.ts`).
