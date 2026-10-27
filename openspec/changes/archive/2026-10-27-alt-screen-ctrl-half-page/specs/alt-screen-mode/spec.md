# Spec Delta

## MODIFIED Requirements

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

### Requirement: Ignore unmapped keys
While in alt-screen mode, keys other than the mapped navigation, search, and exit keys SHALL NOT modify the editor buffer, move the editor cursor, change the mode, or trigger `keybinds` actions.

#### Scenario: Normal-mode edit key
- **WHEN** the editor is in alt-screen mode and the user presses `x`
- **THEN** the buffer is unchanged and the editor stays in alt-screen mode

#### Scenario: Former half-page keys are ignored
- **WHEN** the editor is in alt-screen mode and the user presses plain `d` or `u`
- **THEN** the transcript does not scroll, the buffer is unchanged, and the editor stays in alt-screen mode
