# Proposal

## Why

Alt-screen mode scrolls the transcript by half a viewport with plain `d` / `u`, but vim users expect `ctrl-d` / `ctrl-u` for half-page scrolling. Matching vim muscle memory is the whole point of this mode, and the feature shipped recently, so fixing the binding now keeps the breakage small.

## What Changes

- In alt-screen mode, `ctrl-d` scrolls the transcript down half a viewport and `ctrl-u` scrolls it up half a viewport.
- **BREAKING**: Plain `d` and `u` no longer scroll in alt-screen mode; they fall under the existing "ignore unmapped keys" behavior. No transition period keeps both bindings.
- Update the alt-screen mode user docs to the new keys.
- Out of scope: `n` / `N` search-result navigation, remappable alt-screen keys, and full-page scrolling.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `alt-screen-mode`: The "Scroll the transcript by line and half page" requirement changes its half-page keys from `d` / `u` to `ctrl-d` / `ctrl-u`.

## Impact

- `src/vim-modal-editor.ts`: alt-screen key dispatch (`handleAltScreenMode`).
- `test/alt-screen-mode.test.ts`: navigation dispatch test plus new coverage for ignored `d` / `u`.
- `docs/alt-screen-mode.md`: key table.
- Release: patch changeset under `.changeset/`.
- No config schema, dependency, or `AltScreenController` API changes.
