# assets/

## Responsibility

The `assets/` directory holds static artifacts that are shipped with the `@0xkahi/pi-vim-keys` package. It contains the generated JSON Schema that validates user-facing extension configuration, plus packaged demo media used in documentation. These files are included in the npm publish bundle via the `files` array in `package.json`.

## Design

`config.schema.json` is a Draft 7 JSON Schema produced mechanically from the runtime Zod schema (`src/schemas/config.schema.ts`) rather than hand-written. The producer script (`scripts/build-schema.ts` → `scripts/build-schema-document.ts`) calls `z.toJSONSchema(PiVimKeysConfigSchema, { target: 'draft-7', unrepresentable: 'any' })` and then injects schema metadata (`$schema`, `$id`, `title`, `description`). This guarantees that the published schema and the runtime `ConfigLoader` agree on shape, defaults, and constraints.

The schema defines three required top-level properties:

- `colors`: hex-color map for normal, insert, visual, and visual-line modes.
- `normalModeRemap`: a discriminated union for mapping a single key or a two-key sequence back to normal mode.
- `keybinds`: an object whose property names are Vim-style key specifiers (`<leader>…`, `ctrl+…`, bare keys) and whose values are either a namespaced command string (`pi.vimKeys.event:…`) or a Pi application command.

Demo media (`example.gif`, `example-keybind.gif`) are binary recordings committed as-is for README and marketplace rendering; they are not processed by the build pipeline.

## Flow

1. A developer changes the Zod config schema in `src/schemas/config.schema.ts`.
2. `bun run buildSchema` executes `scripts/build-schema.ts`, which invokes `createConfigJsonSchema()`.
3. The function serializes the resulting Draft 7 schema with two-space indentation and writes it to `assets/config.schema.json`.
4. At publish time, `npm pack` includes `assets/config.schema.json` and `assets/example.gif` because both are listed in `package.json#files`.

## Integration

- **Runtime validation**: `src/config-loader.ts` uses the same Zod schema to validate and default the extension configuration supplied through the Pi context, so the generated JSON Schema is a public mirror of the internal parser.
- **Package manifest**: `package.json#files` explicitly whitelists `assets/config.schema.json` and `assets/example.gif`, making the schema available to consumers and tooling while keeping the source tree out of the tarball.
- **Editor / IDE support**: The `$id` URL in `config.schema.json` lets external JSON Schema resolvers associate a user's `pi-vim-keys` config file with the published schema for autocompletion and validation.
- **Documentation**: `example.gif` is referenced from `README.md` to demonstrate the Vim modal editor in action.
