# Proposal

## Why

Pi v1.0.0 introduced a fullscreen (alt-screen) renderer whose transcript is navigated through `tui.altScreen.*` keybindings. Those bindings are global and handled before the editor, so binding vim-style keys (`ctrl+d`, `j`, `G`, ...) to them would hijack typing in every mode, and most of them ship unbound. Vim users have no quick, mode-safe way to scroll or search the transcript from the keyboard.

## What Changes

- Add a new **alt-screen mode**: a lightweight, non-traditional modal layer entered only from normal mode that remaps a small fixed key set to transcript navigation:
  - `u` / `d` — scroll half a page up / down
  - `k` / `j` — scroll one line up / down
  - `gg` / `G` — scroll to top / bottom
  - `<leader>/` — open transcript search
- Leave alt-screen mode with `esc` (back to normal mode) or `i` (to insert mode). Unmapped keys are ignored while in the mode.
- Enter the mode through a new vim-keys editor keybinding action, `pi.vimKeys.altScreenMode`, bound in the existing `keybinds` config (e.g. `"ctrl+w": "pi.vimKeys.altScreenMode"`). It has no default binding. A new list of editor actions sits next to Pi app actions; existing `pi.vimKeys.event:` external events are unchanged (their internal schema is renamed `ExternalExtensionKeybindSchema`).
- While in the mode, the editor's bottom-border mode label shows `ALT-S`, like the other modes. Add a `colors.altScreen` setting (default `#ED7892`) for its color.
- A bound entry key is a no-op when Pi is not running in fullscreen mode.
- Update the generated JSON Schema, README, and configuration docs.

## Capabilities

### New Capabilities
- `alt-screen-mode`: Normal-mode-entered modal layer that maps fixed vim-style keys to Pi fullscreen transcript navigation (scroll, jump, search), including its keybinding action, exit behavior, mode label, and label color.

### Modified Capabilities
<!-- None: `paste-aware-undo-redo` is unaffected. -->

## Impact

- `src/types.ts` — new mode value.
- `src/schemas/keybind.schema.ts`, `src/schemas/config.schema.ts`, `assets/config.schema.json` — new `VimKeysEditorKeybindSchema` (`pi.vimKeys.altScreenMode`), `ExternalExtensionKeybindSchema` rename, `colors.altScreen`.
- `src/vim-modal-editor.ts` — mode entry/exit, input dispatch.
- New adapter under `src/editor/` wrapping Pi's `TuiAltScreen` API (some actions rely on non-public members, feature-detected).
- `src/utils/vim-mode.util.ts` — `ALT-S` mode label.
- `README.md`, `docs/configuration.md`, new `docs/alt-screen-mode.md`.
- Tests under `test/`.
- Depends on `@earendil-works/pi-tui` `TuiAltScreen` (v1.0.0+).
