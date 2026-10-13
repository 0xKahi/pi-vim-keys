---
"@0xkahi/pi-vim-keys": minor
---

Add an ALT-S (alt-screen) mode for navigating Pi's fullscreen transcript from normal mode. Bind the new `pi.vimKeys.altScreenMode` editor action in `keybinds` (e.g. `"ctrl+w": "pi.vimKeys.altScreenMode"`); there is no default binding. In the mode, `j`/`k` scroll by line, `u`/`d` by half page, `gg`/`G` jump to top/bottom, and `<leader>/` opens transcript search; `esc` returns to normal mode and `i` to insert mode. The label color is configurable via `colors.altScreen` (default `#ED7892`). The entry key does nothing outside Pi fullscreen mode.
