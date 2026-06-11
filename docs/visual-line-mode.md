# Visual Line Mode

Visual line mode selects whole lines while you move the cursor. Editing commands operate on the selected line range, then return to normal mode.

## Entering Visual Line Mode


| Key | Description |
| --- | --- |
| `V` | Enter visual line mode from normal mode |
| `V` | Switch from visual mode to visual line mode |


## Leaving or Switching Modes


| Key | Description |
| --- | --- |
| `escape` | Return to normal mode |
| `V` | Return to normal mode |
| `v` | Switch to visual character mode |


## Movement Keys

Movement changes the active line selection.

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


Even when character movement changes the cursor column, visual line mode still selects whole lines.

## Editing Selected Lines

| Key | Description |
| --- | --- |
| `x` | Delete the selected lines and return to normal mode |
| `d` | Delete the selected lines and return to normal mode |
| `y` | Yank/copy the selected lines and return to normal mode |
| `p` | Replace the selected lines with the current register and return to normal mode |

## Surround Selection

`s` starts a surround sequence that wraps the selected line range with a bracket or quote pair, then returns to normal mode. The sequence is `s`, then `a` (around) or `i` (inside), then the pair character.

In visual line mode the pair is inserted at column 0 of the first selected line and at the end of the last selected line.

| Key | Description |
| --- | --- |
| `sa(` / `sab` | Wrap the line range with `( )` |
| `sa{` | Wrap the line range with `{ }` |
| `sa[` | Wrap the line range with `[ ]` |
| `sa<` | Wrap the line range with `< >` |
| `sa"` / `saq` | Wrap the line range with `" "` |
| `sa'` | Wrap the line range with `' '` |
| `` sa` `` | Wrap the line range with `` ` ` `` |
| `si(`, `si{`, `si[`, ... | Same pairs, but wrap the interior of the range |

`b` is an alias for `(`/`)`, and `q` is an alias for `"`. The opening and closing pair characters select the same pair, so `sa(` and `sa)` behave identically.

