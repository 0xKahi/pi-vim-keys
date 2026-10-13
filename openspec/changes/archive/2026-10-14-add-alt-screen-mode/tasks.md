# Tasks

## 1. Config: `pi.vimKeys.altScreenMode` keybinding action

- [x] 1.1 In `src/schemas/keybind.schema.ts`, rename `ExtensionKeybindSchema` to `ExternalExtensionKeybindSchema`, add `VIM_KEYS_EDITOR_KEYBINDINGS` / `VimKeysEditorKeybindSchema` (`pi.vimKeys.altScreenMode`), include it in `CombinedKeybindSchema`, and remove any `altScreenModeKey` field; verify in `test/config-schema.test.ts` that `pi.vimKeys.altScreenMode` and `pi.vimKeys.event:x` are accepted and `pi.vimKeys.unknown` is rejected.
- [x] 1.2 Remove the `altScreenModeKey` getter, `isAltScreenModeKey`, and leader-sequence injection from `src/config-loader.ts`; verify `bun run type-check` passes and a `<leader>` binding to `pi.vimKeys.altScreenMode` is registered through existing keybind parsing (config-loader test).
- [x] 1.3 Regenerate `assets/config.schema.json` via `bun run buildSchema`; verify it contains `pi.vimKeys.altScreenMode` and no `altScreenModeKey`.
- [x] 1.4 Document the `pi.vimKeys.altScreenMode` editor action (no default, example bindings) in `docs/configuration.md` next to app actions and external events; verify the JSON examples validate and no `altScreenModeKey` references remain.

## 2. Mode plumbing

- [x] 2.1 Add `'altScreen'` to `VimModeSchema` (`src/types.ts`), give it the `ALT-S` label in `src/utils/vim-mode.util.ts`, a `colors.altScreen` config color (default `#ED7892`) used by `getModeColors`, and the normal (block) cursor shape in the hardware cursor controller (design D2); verify `bun run type-check` passes and `test/vim-mode.util.test.ts` covers the `ALT-S` label and `test/config-schema.test.ts` covers the `colors.altScreen` default and override.
- [x] 2.2 Add an `altScreen` `KeySequencer` in `VimModalEditor` registering `g`→`['g']` and leader→`['/']` sequences, and route `handleInput` to a new `handleAltScreenMode` (design D1, D6); verify with type-check and existing tests still green (`bun test`).

## 3. `AltScreenController` adapter

- [x] 3.1 Create `src/editor/alt-screen-controller.ts` with `isAvailable`, `scrollLines`, `scrollHalfPage`, `scrollToTop`, `scrollToBottom`, `openSearch` per design D5 (public API direct; `getPrimaryScrollView` / `toggleSearch` feature-detected, rows/2 fallback, no-op when absent); verify with `test/alt-screen-controller.test.ts` using stub TUIs covering: non-alt-screen → unavailable, half-page uses viewportHeight, half-page fallback, search present vs missing.
- [x] 3.2 Update `src/editor/codemap.md` with the new controller; verify the entry describes its responsibility and private-API caveat.

## 4. Entry, dispatch, and exit behavior

- [x] 4.1 In `handleActionCommands`, check `VimKeysEditorKeybindSchema` first and enter `altScreen` for `pi.vimKeys.altScreenMode` only if `AltScreenController.isAvailable()`, otherwise consume as a no-op; remove the old early entry checks (design D3, D4); verify with `test/alt-screen-mode.test.ts`: unbound `ctrl+w` doesn't enter, `ctrl+w` and `<leader>s` bindings enter, no event emitted, regular-screen no-op, insert/visual modes don't enter.
- [x] 4.2 Implement `handleAltScreenMode` dispatch table (`j k d u G gg <leader>/ escape i`, swallow everything else, drop to normal if renderer left fullscreen) per design D6; verify in `test/alt-screen-mode.test.ts` that each key calls the right controller method, `esc` → normal, `i` → insert with buffer unchanged, `x` leaves buffer and mode unchanged.

## 5. Mode label rendering

- [x] 5.1 Render alt-screen mode through the standard bottom-border label (no extra rows) per design D2; verify in `test/vim-modal-editor-render.test.ts` that the bottom border shows `ALT-S` in `altScreen` mode and the editor height is unchanged.

## 6. Docs and integration

- [x] 6.1 Add `docs/alt-screen-mode.md` (entry key, key table, exit keys, fullscreen-only, Pi-bound-key limitation) and a feature bullet in `README.md`; verify links resolve and key table matches the spec.
- [x] 6.2 Update `src/codemap.md` / root `codemap.md` mode lists to include alt-screen mode; verify entries are present.
- [x] 6.3 Run `bun run lint`, `bun run type-check`, and `bun test`; verify all pass.
- [x] 6.4 Manually verify in Pi fullscreen mode with `"ctrl+w": "pi.vimKeys.altScreenMode"` bound: `ctrl+w` shows the `ALT-S` label in `#ED7892`, `j/k/u/d/gg/G` scroll, `<leader>/` opens search and `esc` closes it while staying in the mode, second `esc` returns to normal; verify in regular mode the bound `ctrl+w` does nothing, and without the binding `ctrl+w` never enters the mode.

## Workflow follow-up

- Add a changeset entry for the release.
- Archive the change after review.
