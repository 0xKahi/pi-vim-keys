# Visual Mode

Visual mode selects text while you move the cursor. Editing commands operate on the current selection, then return to normal mode.

There are two visual modes:

| Mode | Enter From Normal Mode | Description |
| --- | --- | --- |
| Visual | `v` | Selects a character range |
| Visual Line | `V` | Selects whole lines |


## Leaving or Switching Visual Modes


| Key | In Visual Mode | In Visual Line Mode |
| --- | --- | --- |
| `escape` | Return to normal mode | Return to normal mode |
| `v` | Return to normal mode | Switch to visual mode |
| `V` | Switch to visual line mode | Return to normal mode |


## Movement Keys

Movement extends or shrinks the active selection.

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


Examples: `fa` extends the selection forward to the next `a`; `F,` extends it backward to the previous comma.

## Editing Selection


| Key | Description |
| --- | --- |
| `x` | Delete the selected text/lines and return to normal mode |
| `d` | Delete the selected text/lines and return to normal mode |
| `y` | Yank/copy the selected text/lines and return to normal mode |
| `p` | Replace the selected text/lines with the current register and return to normal mode |


In visual line mode, edits operate on whole selected lines. In visual mode, edits operate on the selected character range.
