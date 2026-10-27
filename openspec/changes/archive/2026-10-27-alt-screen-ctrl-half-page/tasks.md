# Tasks

## 1. Remap alt-screen half-page scrolling

- [x] 1.1 In `src/vim-modal-editor.ts` `handleAltScreenMode`, replace the plain `'d'` / `'u'` cases with `matchesKey(data, 'ctrl+d')` / `matchesKey(data, 'ctrl+u')` checks that call `scrollHalfPage(1)` / `scrollHalfPage(-1)` (use `matchesKey`, not raw `\x04` / `\x15`, so Kitty keyboard protocol input works); verify by reading the handler that plain `d` / `u` now fall through to the ignored-key path and that the handler still never reaches `super.handleInput`
- [x] 1.2 In `test/alt-screen-mode.test.ts`, update the navigation dispatch test to send `ctrl+d` / `ctrl+u` (raw `\x04` / `\x15`) instead of `d` / `u`, keeping the expected `scrollBy` calls `[[1], [-1], [7], [-7]]`; verify with `bun test test/alt-screen-mode.test.ts`
- [x] 1.3 Add tests in `test/alt-screen-mode.test.ts` that (a) plain `d` and `u` do not call `scrollBy`, leave the buffer and cursor unchanged, and stay in alt-screen mode, and (b) `ctrl+d` with an empty buffer does not exit or edit and stays in alt-screen mode; verify with `bun test test/alt-screen-mode.test.ts`
- [x] 1.4 Update the key table in `docs/alt-screen-mode.md` so `ctrl-d` / `ctrl-u` replace `d` / `u`; verify the table matches the spec delta's keys
- [x] 1.5 Add a patch changeset under `.changeset/` for `@0xkahi/pi-vim-keys` that notes the breaking key change (`d` / `u` to `ctrl-d` / `ctrl-u` in alt-screen mode); verify the file exists and names the package with a `patch` bump

## 2. Integration checks

- [x] 2.1 Run `bun run lint`, `bun run type-check`, and `bun test`; verify all pass
- [x] 2.2 Run `openspec validate alt-screen-ctrl-half-page --strict`; verify it passes
