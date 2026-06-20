# src/

## Responsibility

The `src/` directory is the root of the `pi-vim-keys` extension. It wires the Pi Coding Agent `ExtensionAPI` into a Vim-style editor component, manages per-session lifecycle, loads and merges user configuration, and delegates concrete editing behavior to focused child modules. The top-level files define the extension entry point, the modal editor implementation, configuration loading, shared constants, and domain types.

## Design

- **Extension entry point**: `index.ts` exports a default function that receives the `ExtensionAPI`, registers `session_start` and `session_shutdown` handlers, and installs a session-scoped editor factory via `ctx.ui.setEditorComponent`.
- **Modal editor**: `VimModalEditor` in `vim-modal-editor.ts` extends `CustomEditor` from `@earendil-works/pi-coding-agent` and composes the actual editing logic through controllers:
  - `MovementController` for cursor movement, word jumps, leaps, and find-char.
  - `TextEditController` for insert/delete/undo/redo/yank/paste/new-line operations and surround.
  - `EditorCompassController` for anchor/range bookkeeping in visual modes.
  - `VisualHighlightRenderer` for rendering the selected range.
  - `HardwareCursorController` for applying mode-specific terminal cursor shapes.
- **Mode-based input dispatch**: The editor keeps a `Record<VimMode, KeySequencer>` (`normal`, `insert`, `visual`, `visualLine`) and uses sequence strategies (`TimeBasedKeySequence`, `SchemaBasedKeySequence`, `MultiCharKeySequence`) to resolve pending/completed multi-key chords before falling back to single-key movement and edit handlers.
- **Configuration**: `ConfigLoader` validates and merges global and project-level JSON configs using Zod schemas (`PiVimKeysConfigSchema`, `PartialPiVimKeysConfigSchema`, `KeybindWithLeaderKeySchema`, `VimBaseKeySequenceSchema`), then exposes normalized getters for mode colors, app action keybindings, and sequence options.
- **Shared primitives**: `constants.ts` centralizes identifiers, defaults, and regexes; `types.ts` defines the `VimMode` enum, `VimKeyId`, and `SurroundPairs` lookup tables.
- **Child module ownership**:
  - [`editor/`](editor/codemap.md) implements the low-level editing primitives and rendering helpers used by `VimModalEditor`.
  - [`key-sequencer/`](key-sequencer/codemap.md) implements chord/sequence matching strategies consumed by the modal editor.
  - [`schemas/`](schemas/codemap.md) holds Zod schemas for config, keys, and app keybindings.
  - [`utils/`](utils/codemap.md) holds terminal coloring, mode helpers, debug logging, and path resolution utilities.

## Flow

1. On `session_start`, `index.ts` constructs a `ConfigLoader` and calls `initializeConfig(ctx)`.
2. `initializeConfig` looks up the global extension config, then the project config via `PathUtil.findExtensionConfig`, and merges them with the default config. Errors are surfaced through `ctx.ui.notify`.
3. `ctx.ui.setEditorComponent` receives a factory closure; each time the host needs an editor it constructs a `VimModalEditor` with `tui`, `theme`, `keybindings`, the loaded `config`, a `getTheme` accessor, and an `emitEvent` callback.
4. `VimModalEditor` initializes per-mode `KeySequencer` instances and registers insert/normal/visual/visual-line sequences in its constructor.
5. Incoming keys reach `handleInput`, which dispatches to the mode-specific handler:
   - `handleInsertMode` checks the insert-mode sequence matcher (e.g., `toNormalModeSequence`) and falls back to the default input handling.
   - `handleNormalMode` resolves leader sequences (`<leader>`, `f`/`F`, `g`, `d`, `y`), movement keys (`h`/`j`/`k`/`l`, `w`/`b`/`e`, `0`/`$`/`G`, etc.), edit commands (`x`, `u`, `p`, etc.), insert-entry keys (`i`/`a`/`o`/...), `Enter`, and finally app action keybindings via `handleActionCommands`.
   - `handleVisualMode` and `handleVisualLineMode` resolve visual sequences, manage anchor state through `EditorCompassController`, and execute range-based edits through `TextEditController`.
6. `setMode` transitions mode, updates anchors and cursor shape via `HardwareCursorController`, and triggers a re-render.
7. `render` calls the parent render, strips the fake cursor, overlays the visual selection highlight when applicable, and paints the current mode label on the bottom border line.
8. On `session_shutdown`, `index.ts` calls the stored `cleanupEditor` closure, which delegates to `VimModalEditor.cleanup` to restore the hardware cursor.

## Integration

- The extension consumes the host platform through `@earendil-works/pi-coding-agent` (`ExtensionAPI`, `ExtensionContext`, `CustomEditor`) and the terminal UI through `@earendil-works/pi-tui` (`TUI`, `Theme`, `KeybindingsManager`, `matchesKey`, `parseKey`, `truncateToWidth`, `visibleWidth`).
- `index.ts` emits arbitrary extension events via `pi.events.emit` and passes the same emitter into `VimModalEditor` so action keybindings can broadcast app-level commands.
- `ConfigLoader` integrates with the host filesystem via `PathUtil.findExtensionConfig` and `readFileSync`, with the host UI through `ctx.ui.notify`, and with the editor through its getter APIs.
- `VimModalEditor` relies on child modules for everything except high-level dispatch and rendering orchestration; it is the integration point between host editor callbacks and the child controllers/sequencers/renderers.
