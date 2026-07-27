---
"@0xkahi/pi-vim-keys": patch
---

Support oh-my-pi (omp) hosts: when the editor keeps its buffer/cursor in ECMAScript-private fields (`#state`, `#moveCursor`), route `getEditorInternals` through a public-API adapter so all motions and text edits work again instead of silently no-opting
