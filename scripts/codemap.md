# scripts/

## Responsibility

The `scripts/` directory contains Bun-based TypeScript build scripts used during development and release to generate static artifacts from the source-of-truth Zod schemas. These scripts are not part of the runtime Pi extension; they are invoked manually or from CI to produce `assets/config.schema.json`, the canonical JSON Schema document that describes the `PiVimKeysConfig` configuration shape for users, IDEs, and documentation.

## Design

- **Source-driven generation**: The JSON Schema is derived from `PiVimKeysConfigSchema` in `src/schemas/config.schema.ts` rather than hand-written, ensuring the published schema never diverges from runtime validation.
- **Separation of concerns**: `scripts/build-schema-document.ts` is a pure module that exports `createConfigJsonSchema()` and knows nothing about the filesystem; `scripts/build-schema.ts` is the imperative CLI entry point that writes the generated schema to `assets/config.schema.json`.
- **Zod-to-JSON-Schema conversion**: `createConfigJsonSchema()` uses `z.toJSONSchema()` (Zod v4 API) targeting JSON Schema Draft 7, with `unrepresentable: 'any'` for constructs that cannot be expressed in JSON Schema.
- **Metadata overlay**: The generated schema is wrapped with `$schema`, `$id`, `title`, and `description` fields so the artifact is self-describing and reachable at the raw GitHub URL declared in `$id`.

## Flow

1. A developer or CI job runs `bun run buildSchema` (defined in `package.json`), which executes `scripts/build-schema.ts`.
2. `scripts/build-schema.ts` imports `createConfigJsonSchema()` from `scripts/build-schema-document.ts`.
3. `createConfigJsonSchema()` loads the runtime Zod schema `PiVimKeysConfigSchema` from `src/schemas/config.schema.ts`.
4. Zod flattens the schema object—including nested defaults for `colors`, `normalModeRemap`, and `keybinds`—into a Draft 7 JSON Schema object.
5. The wrapper function injects schema metadata:
   - `$schema`: `http://json-schema.org/draft-07/schema#`
   - `$id`: `https://raw.githubusercontent.com/0xKahi/pi-vim-keys/main/assets/config.schema.json`
   - `title`: `Pi Vim Key Extension Configuration`
   - `description`: `Configuration schema for pi-vim-keys extension`
6. `scripts/build-schema.ts` serializes the result with two-space indentation and writes it to `assets/config.schema.json` via `Bun.write`.
7. The resulting file is checked into version control and listed in `package.json` `files` so it is included in the published package.

## Integration

- **Zod runtime schemas**: Depends on `src/schemas/config.schema.ts` and, transitively, on `src/schemas/key.schema.ts`, `src/schemas/keybind.schema.ts`, and `src/constants.ts` for the full configuration shape.
- **Package scripts**: `package.json` exposes the entry point as the `buildSchema` npm script (`bun run scripts/build-schema.ts`).
- **Published artifacts**: `assets/config.schema.json` is declared in `package.json` `files`, so consumers and documentation can reference a stable schema URL.
- **README/docs**: The generated schema document is the schema documentation artifact consumed by README/docs; its `$id` points to the raw GitHub asset, enabling IDE auto-completion and validation for end-user configuration files.
