# Normal Mode

Normal mode is the default Vim-style command mode. Keys are interpreted as editor commands instead of text input.

## Entering Insert Mode

| Key | Description |
| --- | --- |
| `i` | Enter insert mode at the cursor |
| `I` | Move to the start of the current line, then enter insert mode |
| `a` | Move right, then enter insert mode |
| `A` | Move to the end of the current line, then enter insert mode |
| `o` | Open a new line below, then enter insert mode |
| `O` | Open a new line above, then enter insert mode |

## Entering Visual Mode


| Key | Description |
| --- | --- |
| `v` | Enter visual character mode |
| `V` | Enter visual line mode |


## Movement Keys

| Key | Description |
| --- | --- |
| `h` | Move cursor left |
| `j` | Move cursor down |
| `k` | Move cursor up |
| `l` | Move cursor right |
| `0` | Move to the start of the current line |
| `$` | Move to the end of the current line |
| `G` | Move to the end of the input |
| `gg` | Move to the start of the input |


## Word Movement

| Key | Description |
| --- | --- |
| `w` | Move forward to the start of the next word |
| `W` | Move forward to the start of the next WORD, including punctuation |
| `b` | Move backward to the start of the previous word |
| `B` | Move backward to the start of the previous WORD, including punctuation |
| `e` | Move forward to the end of the current/next word |
| `E` | Move forward to the end of the current/next WORD, including punctuation |
| `ge` | Move backward to the end of the previous word |
| `gE` | Move backward to the end of the previous WORD, including punctuation |


`word` matches letters, numbers, and `_`. `WORD` matches any non-whitespace run.

## Find Character

| Key | Description |
| --- | --- |
| `f<char>` | Move forward to the next matching character |
| `F<char>` | Move backward to the previous matching character |

Examples: `fa` jumps forward to the next `a`; `F,` jumps backward to the previous comma.

## Editing Keys


| Key | Description |
| --- | --- |
| `x` | Delete the character under the cursor |
| `X` | Delete the character before the cursor |
| `dd` | Delete the current line |
| `yy` | Yank/copy the current line |
| `p` | Paste after the cursor/current line |
| `P` | Paste before the cursor/current line |
| `u` | Undo |
| `U` | Redo |


## Configured Keybindings

Normal mode also checks the configured `keybinds` from [`docs/configuration.md`](./configuration.md).

- supports leader-key key sequences
- supports both multi key and single key sequences e.g. `<leader>oe`, `<leader>e`
- Modifier bindings such as `ctrl+c` are triggered directly in normal mode.

Configured keybindings can run Pi app keybindings or emit extension events.
