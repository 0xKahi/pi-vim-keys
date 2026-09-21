# @0xkahi/pi-vim-keys

## 1.1.1

### Patch Changes

- 750d8ca: upgrade pi deps to v0.87.0

## 1.1.0

### Minor Changes

- 9086b66: Add a Vim-style single-character replace operator (`r<char>`) and a persistent REPLACE mode (`R`) that overtypes text in place until `escape`. A replace session is recorded as a single undo step, restores overwritten characters on backspace, and ignores `enter` so it never spans more than one line.

## 1.0.7

### Patch Changes

- 032b9fe: increase pi deps -> v0.85.1

## 1.0.6

### Patch Changes

- 872a045: fix undo statelines, update pi dependencied to 0.81.1

## 1.0.5

### Patch Changes

- 8d991d5: fix missing symbol `"` in find char commands

## 1.0.4

### Patch Changes

- 1838bb0: fix app keybindings disallow pis not allowed keybindings add special handling for `app.exit`, `app.interrupt`, `app.clipboard.pasteImage`

## 1.0.3

### Patch Changes

- d5cc855: added better pending key + sequence display
- d5cc855: added surround functionality in viusal modes `sab` `saq` `sib` `saq`

## 1.0.2

### Patch Changes

- 5ac6ab9: allow normal mode keybindings to have multichar sequences `<leader>e`or `<leader>oe`

## 1.0.1

### Patch Changes

- de8a76c: - added `enter` key in normal mode input to submit prompt
  - fixed backToNormalMode movement when at start of line

## 1.0.0

### Major Changes

- 7023471: Initial release of the Pi Vim modal input editor extension.
