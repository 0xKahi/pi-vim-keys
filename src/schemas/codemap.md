# src/schemas/

## Responsibility

The `src/schemas/` directory owns the Zod-based data contract for the entire pi-vim-keys extension configuration. It defines the shape of valid keys, key combinations, application-level keybindings, and the top-level configuration object. These schemas are the single source of truth for runtime validation of user-provided JSON config files and for generating the published JSON Schema document that drives editor autocomplete and validation.

## Design

The schemas are organized in three layers of increasing specificity, all built on `zod` and relying on `z.infer<>` for derived TypeScript types.

### `key.schema.ts` — Physical key vocabulary

This file enumerates the allowed key space and composes higher-order key patterns from literal enums and template-literal schemas:

- `DigitKeySchema`, `LetterKeySchema`, `CapitalLetterKeySchema`, `SymbolKeySchema`, and `MissingSymbolKeySchema` are `z.enum()` schemas over fixed string literal arrays.
- `CharOnlyKeySchema` unions character-capable keys (digits, letters, symbols, and the missing `"` quote).
- `SpecialKeySchema` covers functional keys such as `escape`, `enter`, `tab`, `space`, `f1`–`f12`, and arrow keys.
- `ModifierKeySchema` enumerates `ctrl`, `shift`, `alt`, and `super`.
- `BaseKeyBindSchema` unions digits, lowercase letters, symbols, and special keys; it represents a single press without modifiers.
- `VimBaseKeySchema` extends `BaseKeyBindSchema` with capital letters, reflecting the Vim command key space.
- `VimBaseKeySequenceSchema` allows either a single `VimBaseKeySchema` value or a two-character template-literal sequence.
- `KeybindWithLeaderKeySchema` is a template-literal schema requiring the literal prefix `<leader>` followed by a `VimBaseKeySequenceSchema`.
- `KeybindWithModifierSchema` is a template-literal schema of the form `<modifier>+<baseKey>` (e.g., `ctrl+w`).
- `VimKeybindSchema` is the union of leader-prefixed keys and modifier chords; it is used as the record key type for user remappings.

### `keybind.schema.ts` — Action targets

This file maps Vim-style triggers to the actions they invoke:

- `APP_KEYBINDINGS` is a const object that lists every supported application action (`app.interrupt`, `app.clear`, `app.exit`, `app.suspend`, `app.thinking.cycle`, `app.model.cycleForward`, `app.model.cycleBackward`, `app.model.select`, `app.tools.expand`, `app.thinking.toggle`, `app.editor.external`, `app.message.followUp`, `app.message.dequeue`, `app.clipboard.pasteImage`, `app.session.new`, `app.session.tree`, `app.session.fork`, `app.session.resume`). It is typed as a partial `Record<AppKeybinding, boolean>`.
- `AppKeybindingSchema` is a `z.enum()` over the keys of `APP_KEYBINDINGS`.
- `ExtensionKeybindSchema` is a template-literal schema for extension-internal events (`pi.vimKeys.event:<string>`).
- `CombinedKeybindSchema` unions `AppKeybindingSchema` and `ExtensionKeybindSchema`; this is the value type stored under each configured Vim keybind.

### `config.schema.ts` — Top-level configuration

This file composes the previous layers into the user-facing config object:

- `HtmlColorInputSchema` validates 7-character hex color strings (`#RRGGBB`) via `COLOR_HEX_REGEX` from `src/constants`.
- `ModeColorConfigSchema` defines optional hex colors for `normal`, `insert`, `visual`, and `visualLine` modes, each with a default.
- `NormalModeSingleKeySchema` and `NormalModeSequenceSchema` describe the two ways to return to normal mode: a single key (default `escape`) or a two-key sequence.
- `NormalModeConfigSchema` is the union of those two shapes.
- `KeybindConfigSchema` is a `z.partialRecord(VimKeybindSchema, CombinedKeybindSchema)`, meaning each key is a valid Vim keybind and each value is an application action or extension event.
- `PiVimKeysConfigSchema` is the full, default-populated configuration schema with `$schema`, `colors`, `normalModeRemap`, and `keybinds` fields.
- `PartialPiVimKeysConfigSchema` is an optional variant of the same shape used when loading raw config files before merging with defaults.

Exported types (`PiVimKeysConfig`, `PartialPiVimKeysConfig`, `CombinedKeybindId`, `VimBaseKey`, etc.) are inferred directly from their schema objects so the TypeScript contract stays synchronized with runtime validation.

## Flow

1. **Schema composition**: `key.schema.ts` and `keybind.schema.ts` export primitive and composed schemas. `config.schema.ts` imports them and adds presentation-level rules such as hex-color validation and default values.
2. **Config loading**: `ConfigLoader` (in `src/config-loader.ts`) reads global and project JSON config files, parses them with `JSON.parse`, and validates the raw object through `PartialPiVimKeysConfigSchema.safeParse`.
3. **Layered merge**: When both global and project configs exist, `ConfigLoader` starts from the default config (`PiVimKeysConfigSchema.parse({})`), overlays the global layer, then overlays the project layer, using shallow object spreads for `colors` and `keybinds` so later layers override earlier ones.
4. **Final validation**: Each merged result is passed through `PiVimKeysConfigSchema.parse`, which applies defaults and guarantees that every field conforms to its schema.
5. **Runtime keybind indexing**: `ConfigLoader.initializeAppKeybindingMaps` iterates over `config.keybinds`. Entries matching `KeybindWithLeaderKeySchema` are stripped of the `<leader>` prefix, re-validated against `VimBaseKeySequenceSchema`, and stored in `leaderKeyToAppKeybindingMap`; all other entries are stored in `keyToAppKeybindingMap` as direct Vim keybinds.
6. **JSON Schema publication**: `scripts/build-schema.ts` calls `createConfigJsonSchema` from `scripts/build-schema-document.ts`, which invokes `z.toJSONSchema(PiVimKeysConfigSchema, { target: 'draft-7', unrepresentable: 'any' })` and wraps the result with `$schema`, `$id`, `title`, and `description` metadata. The output is written to `assets/config.schema.json`.

## Integration

- **`src/config-loader.ts`** is the primary consumer. It imports `PiVimKeysConfigSchema`, `PartialPiVimKeysConfigSchema`, and the inferred types from `src/schemas/config.schema.ts`, plus `KeybindWithLeaderKeySchema` and `VimBaseKeySequenceSchema` from `src/schemas/key.schema.ts`, and `CombinedKeybindId` from `src/schemas/keybind.schema.ts`. It uses `z.prettifyError` to format validation failures for the user.
- **`scripts/build-schema-document.ts`** imports `PiVimKeysConfigSchema` and uses `z.toJSONSchema` to produce a Draft 7 JSON Schema, making the Zod definitions available to external editors and IDEs.
- **`scripts/build-schema.ts`** executes the generator and writes the resulting JSON Schema to `assets/config.schema.json` via `Bun.write`.
- **`src/constants.ts`** supplies `COLOR_HEX_REGEX` to `HtmlColorInputSchema` and `DEFAULT_KEY_TIMEOUT` / `DEFAULT_LEADER_KEY` to `ConfigLoader`.
- The schemas bridge user-facing JSON configuration (`$schema`, hex colors, normal-mode remaps, and a `keybinds` record) with the extension's internal type system (`VimKeyId`, `VimMode`, `TimeBasedSequenceOpts`).
