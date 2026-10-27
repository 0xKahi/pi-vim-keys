# alt-screen-mode Specification

## Purpose

Gives vim users a quick, mode-safe keyboard layer for navigating Pi's fullscreen transcript (scrolling, jumping, searching) without binding global keys that would interfere with typing.

## Requirements

### Requirement: Enter alt-screen mode from normal mode
The editor SHALL enter alt-screen mode when a key bound to the `pi.vimKeys.altScreenMode` action in `keybinds` is pressed while in normal mode and Pi is running in fullscreen mode. Bound keys SHALL NOT enter alt-screen mode from insert, visual, visual-line, or replace mode.

#### Scenario: Modifier key binding
- **WHEN** the config sets `"keybinds": { "ctrl+w": "pi.vimKeys.altScreenMode" }`, Pi runs in fullscreen, the editor is in normal mode, and the user presses `ctrl+w`
- **THEN** the editor enters alt-screen mode

#### Scenario: Leader binding
- **WHEN** the config sets `"keybinds": { "<leader>s": "pi.vimKeys.altScreenMode" }` and the user presses the leader key then `s` in normal mode in fullscreen
- **THEN** the editor enters alt-screen mode

#### Scenario: Bound key in insert mode
- **WHEN** the editor is in insert mode and the user presses a key bound to `pi.vimKeys.altScreenMode`
- **THEN** the editor stays in insert mode and the key keeps its insert-mode behavior

#### Scenario: Bound key in visual mode
- **WHEN** the editor is in visual or visual-line mode and the user presses a key bound to `pi.vimKeys.altScreenMode`
- **THEN** the editor does not enter alt-screen mode

### Requirement: No default alt-screen mode binding
No key SHALL be bound to `pi.vimKeys.altScreenMode` by default. Alt-screen mode SHALL be reachable only after the user binds a key to it.

#### Scenario: Unbound
- **WHEN** no `keybinds` entry maps to `pi.vimKeys.altScreenMode` and the user presses `ctrl+w` in normal mode in fullscreen
- **THEN** the editor does not enter alt-screen mode

### Requirement: Entry is a no-op outside fullscreen
When Pi is not running in fullscreen mode, pressing a key bound to `pi.vimKeys.altScreenMode` in normal mode SHALL NOT change the mode, SHALL NOT modify the editor buffer, and SHALL NOT emit an extension event.

#### Scenario: Regular screen mode
- **WHEN** Pi runs in regular (non-fullscreen) mode, `ctrl+w` is bound to `pi.vimKeys.altScreenMode`, and the user presses `ctrl+w` in normal mode
- **THEN** the editor remains in normal mode, the buffer is unchanged, and no event is emitted

### Requirement: Vim-keys editor keybinding actions
`keybinds` values SHALL accept a fixed set of vim-keys editor actions, currently only `pi.vimKeys.altScreenMode`, in addition to Pi app actions and `pi.vimKeys.event:<id>` external events. Other `pi.vimKeys.*` values without the `event:` prefix SHALL be rejected by config validation. Editor actions SHALL NOT be emitted as extension events.

#### Scenario: Editor action accepted
- **WHEN** the config sets `"keybinds": { "ctrl+w": "pi.vimKeys.altScreenMode" }`
- **THEN** config validation succeeds

#### Scenario: External event unchanged
- **WHEN** the config sets `"keybinds": { "<leader>x": "pi.vimKeys.event:my-ext" }` and the user triggers it in normal mode
- **THEN** the `pi.vimKeys.event:my-ext` event is emitted as before

#### Scenario: Unknown editor action
- **WHEN** the config sets `"keybinds": { "ctrl+w": "pi.vimKeys.unknown" }`
- **THEN** config validation fails for that config layer with a schema error

### Requirement: Scroll the transcript by line and half page
While in alt-screen mode, `j` SHALL scroll the transcript down one line, `k` SHALL scroll it up one line, `ctrl-d` SHALL scroll it down half a viewport, and `ctrl-u` SHALL scroll it up half a viewport.

#### Scenario: Line scroll
- **WHEN** the editor is in alt-screen mode and the user presses `k`
- **THEN** the transcript viewport moves up by one line and the editor stays in alt-screen mode

#### Scenario: Half-page scroll
- **WHEN** the editor is in alt-screen mode and the user presses `ctrl-d`
- **THEN** the transcript viewport moves down by about half its visible height

#### Scenario: Half-page scroll up
- **WHEN** the editor is in alt-screen mode and the user presses `ctrl-u`
- **THEN** the transcript viewport moves up by about half its visible height

#### Scenario: Half-page keys do not exit Pi or edit the buffer
- **WHEN** the editor is in alt-screen mode with an empty buffer and the user presses `ctrl-d`
- **THEN** Pi does not exit, the buffer is unchanged, and the editor stays in alt-screen mode

### Requirement: Jump to transcript top and bottom
While in alt-screen mode, `gg` SHALL scroll the transcript to its top and `G` SHALL scroll it to its bottom.

#### Scenario: Jump to top
- **WHEN** the editor is in alt-screen mode and the user presses `g` then `g`
- **THEN** the transcript viewport shows the beginning of the transcript

#### Scenario: Jump to bottom
- **WHEN** the editor is in alt-screen mode and the user presses `G`
- **THEN** the transcript viewport shows the end of the transcript and resumes following new output

### Requirement: Open transcript search
While in alt-screen mode, the leader key followed by `/` SHALL open Pi's fullscreen transcript search. After the search is closed, the editor SHALL still be in alt-screen mode.

#### Scenario: Open search
- **WHEN** the editor is in alt-screen mode and the user presses the leader key then `/`
- **THEN** Pi's transcript search opens

#### Scenario: Close search returns to alt-screen mode
- **WHEN** transcript search is open from alt-screen mode and the user presses `esc`
- **THEN** the search closes and the editor remains in alt-screen mode

### Requirement: Leave alt-screen mode
While in alt-screen mode, `esc` SHALL return the editor to normal mode and `i` SHALL put the editor in insert mode. Leaving the mode SHALL NOT change the transcript scroll position.

#### Scenario: Escape to normal
- **WHEN** the editor is in alt-screen mode and the user presses `esc`
- **THEN** the editor is in normal mode and the transcript viewport position is unchanged

#### Scenario: Insert
- **WHEN** the editor is in alt-screen mode and the user presses `i`
- **THEN** the editor is in insert mode and the buffer is unchanged

### Requirement: Ignore unmapped keys
While in alt-screen mode, keys other than the mapped navigation, search, and exit keys SHALL NOT modify the editor buffer, move the editor cursor, change the mode, or trigger `keybinds` actions.

#### Scenario: Normal-mode edit key
- **WHEN** the editor is in alt-screen mode and the user presses `x`
- **THEN** the buffer is unchanged and the editor stays in alt-screen mode

#### Scenario: Former half-page keys are ignored
- **WHEN** the editor is in alt-screen mode and the user presses plain `d` or `u`
- **THEN** the transcript does not scroll, the buffer is unchanged, and the editor stays in alt-screen mode

### Requirement: Alt-screen mode label
While in alt-screen mode, the editor SHALL show the mode label `ALT-S` on its bottom border, in the same position and format as other mode labels (including pending-key suffixes). The editor SHALL NOT render any extra rows for this mode.

#### Scenario: Label shown
- **WHEN** the editor enters alt-screen mode
- **THEN** the bottom border shows `ALT-S` and the editor height is unchanged

#### Scenario: Pending key shown
- **WHEN** the editor is in alt-screen mode and the user presses `g`
- **THEN** the bottom border label shows `ALT-S` followed by the pending `g`

### Requirement: Configurable alt-screen mode color
The configuration SHALL accept `colors.altScreen` as a hex color for the alt-screen mode label, defaulting to `#ED7892`, merged like the other mode colors.

#### Scenario: Default color
- **WHEN** no `colors.altScreen` is configured and the editor is in alt-screen mode
- **THEN** the mode label is styled with `#ED7892`

#### Scenario: Custom color
- **WHEN** the config sets `"colors": { "altScreen": "#112233" }`
- **THEN** the alt-screen mode label is styled with `#112233` and other mode colors keep their values
