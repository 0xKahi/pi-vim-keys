# Repository Atlas: pi-vim-keys

## Project Responsibility

`@0xkahi/pi-vim-keys` is a Pi extension that replaces the host editor component with a Vim-style modal editor. It provides normal, insert, visual, and visual-line modes; Vim movement/edit commands; configurable insert-to-normal sequences; leader-key application commands; visual selection rendering; and mode-aware terminal cursor behavior.

The repository's core responsibility is to bridge Pi's extension lifecycle and TUI editor APIs with a typed modal-editing layer. Runtime code lives under `src/`, generated/user-facing configuration artifacts live under `assets/`, and development-time schema generation lives under `scripts/`.

## System Entry Points

| Path | Role |
|------|------|
| `src/index.ts` | Extension entry point. Registers `session_start` / `session_shutdown`, initializes `ConfigLoader`, installs the `VimModalEditor` factory with `ctx.ui.setEditorComponent`, and restores editor resources on shutdown. |
| `src/vim-modal-editor.ts` | Main modal editor integration. Extends Pi's `CustomEditor`, owns mode state, dispatches parsed key input to sequencers/controllers, renders mode labels and visual highlights, and emits configured app/extension events. |
| `src/config-loader.ts` | Runtime configuration pipeline. Loads global/project extension config files, validates and merges them with Zod schemas, then exposes normalized getters for colors, remaps, and app keybindings. |
| `package.json` | Package manifest, Pi extension declaration (`pi.extensions: ["./src/index.ts"]`), npm publish whitelist, dependency list, and development scripts (`lint`, `type-check`, `test`, `buildSchema`). |
| `scripts/build-schema.ts` | Build-time CLI that writes the generated Draft 7 JSON Schema to `assets/config.schema.json`. |
| `assets/config.schema.json` | Published JSON Schema mirror of the runtime Zod config schema for IDE/user validation. |

## Repository Directory Map

| Directory | Responsibility Summary | Detailed Map |
|-----------|------------------------|--------------|
| `src/` | Runtime extension layer: Pi lifecycle integration, modal editor orchestration, config loading, shared constants, and domain types. | [src/codemap.md](src/codemap.md) |
| `src/editor/` | Low-level editor adapter layer for movement, text mutation, visual selection anchoring, visual highlight rendering, and terminal hardware cursor control. | [src/editor/codemap.md](src/editor/codemap.md) |
| `src/key-sequencer/` | Stateful multi-key sequence detection for mode-specific Vim chords and configured leader/app keybindings. | [src/key-sequencer/codemap.md](src/key-sequencer/codemap.md) |
| `src/key-sequencer/strategies/` | Concrete `KeySequenceStrategy` implementations for fixed multi-character, timeout-based, and schema-validated sequence families. | [src/key-sequencer/strategies/codemap.md](src/key-sequencer/strategies/codemap.md) |
| `src/schemas/` | Zod source-of-truth schemas for valid keys, keybinding targets, and the full pi-vim-keys configuration object. | [src/schemas/codemap.md](src/schemas/codemap.md) |
| `src/utils/` | Stateless utilities for ANSI styling, input debugging, config path discovery, Vim mode labels, and child editor utilities. | [src/utils/codemap.md](src/utils/codemap.md) |
| `src/utils/editor/` | Runtime-safe local copy of Pi TUI word wrapping plus a test-only Pi internals bridge for parity verification. | [src/utils/editor/codemap.md](src/utils/editor/codemap.md) |
| `scripts/` | Bun-based schema generation scripts that convert the runtime Zod config schema into the published JSON Schema artifact. | [scripts/codemap.md](scripts/codemap.md) |
| `assets/` | Static package artifacts: generated config schema and README/demo media. | [assets/codemap.md](assets/codemap.md) |

## Runtime Control Flow

1. Pi loads `src/index.ts` through `package.json#pi.extensions`.
2. On `session_start`, the extension constructs `ConfigLoader` and calls `initializeConfig(ctx)`.
3. `ConfigLoader` resolves global and project config paths, parses JSON files when present, validates partial layers with `PartialPiVimKeysConfigSchema`, merges them over `PiVimKeysConfigSchema.parse({})`, and indexes direct/leader app keybindings.
4. The extension installs a custom editor factory. Each host editor instantiation creates `VimModalEditor` with the active TUI, theme, keybindings manager, resolved config, theme getter, and event emitter.
5. `VimModalEditor.handleInput` routes raw input to the current mode handler. Each handler first asks its mode-specific `KeySequencer` to resolve pending/completed chord state, then dispatches movement, editing, visual selection, app-command, or fallback insert behavior.
6. Editor operations are delegated to controllers in `src/editor/`: movement updates cursor internals, text edits transact buffer/undo/register state, visual compass produces anchored ranges, and visual highlighting overlays selection styling onto Pi's rendered rows.
7. `render(width)` lets Pi render the base editor first, then strips fake cursor styling when hardware cursor mode is active, overlays visual selections, and draws the mode/pending-key label on the bottom border.
8. On `session_shutdown`, the stored cleanup closure calls `VimModalEditor.cleanup()` to restore terminal cursor state.

## Build and Configuration Flow

1. Source configuration contracts are defined in `src/schemas/` with Zod and consumed at runtime by `ConfigLoader`.
2. `bun run buildSchema` executes `scripts/build-schema.ts`, which calls `createConfigJsonSchema()` from `scripts/build-schema-document.ts`.
3. The generator converts `PiVimKeysConfigSchema` into Draft 7 JSON Schema and writes `assets/config.schema.json`.
4. `package.json#files` publishes `src/`, docs, `assets/config.schema.json`, `assets/example.gif`, `README.md`, and `LICENSE`.

## Integration Points

- **Pi host API**: `@earendil-works/pi-coding-agent` supplies `ExtensionAPI`, `ExtensionContext`, and `CustomEditor` for lifecycle and editor replacement.
- **Terminal UI**: `@earendil-works/pi-tui` supplies key parsing/matching, TUI rendering primitives, terminal cursor behavior, text measurement, and theme/keybinding services.
- **Schema/runtime validation**: `zod` validates JSON configuration at runtime and generates the public JSON Schema artifact at build time.
- **Filesystem configuration**: global config is resolved below the Pi agent directory; project config is resolved below `.pi/extensions/<EXTENSION_ID>/config.json` in the current working directory.
- **App/extension events**: configured keybindings map Vim keys to Pi app commands or namespaced extension events (`pi.vimKeys.event:*`), which `VimModalEditor` emits through the host event bus.

## Excluded From Codemap Scope

Tests, documentation prose, translations, dependency folders, build outputs, `.pi/` private/runtime folders, and generated logs are intentionally excluded from hash tracking. Consult `test/` for behavior verification and `docs/` / `README.md` for user-facing command documentation.
