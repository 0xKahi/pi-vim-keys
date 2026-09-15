---
"@0xkahi/pi-vim-keys": minor
---

Add a Vim-style single-character replace operator (`r<char>`) and a persistent REPLACE mode (`R`) that overtypes text in place until `escape`. A replace session is recorded as a single undo step, restores overwritten characters on backspace, and ignores `enter` so it never spans more than one line.
