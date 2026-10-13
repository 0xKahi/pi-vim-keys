## Purpose

Lets a user overwrite existing text in place, either one character at a time with a single-shot replace operator or continuously through a dedicated replace mode, without the surrounding text shifting as it would during insertion.

## ADDED Requirements

### Requirement: Single-character replace operator

The editor SHALL provide a normal-mode operator that replaces the character under the cursor with the next character the user types, then remains in normal mode with the cursor on the replaced character.

The operator SHALL be a two-key sequence: the operator key followed by the replacement key. While waiting for the replacement key, the editor SHALL display a pending-sequence indicator in the status area.

A replacement key SHALL be accepted only when it resolves to a printable character, including the space character. Keys that do not resolve to a printable character SHALL cancel the operator without modifying the buffer.

#### Scenario: Replacing a character in the middle of a line

- **WHEN** the cursor is on a character within a line and the user invokes the replace operator followed by a printable character
- **THEN** that single character is replaced by the typed character, the length of the line is unchanged, the cursor remains on the replaced position, and the editor is in normal mode

#### Scenario: Replacing with a space

- **WHEN** the user invokes the replace operator and then presses the space key
- **THEN** the character under the cursor is replaced by a space character rather than by any literal key name, and the editor remains in normal mode

#### Scenario: Pending indicator while awaiting the replacement key

- **WHEN** the user presses the replace operator key and has not yet pressed a second key
- **THEN** the status area shows that a replace sequence is pending

#### Scenario: Cancelling the operator

- **WHEN** the user invokes the replace operator and then presses a key that does not resolve to a printable character, such as escape or a cursor key
- **THEN** the buffer is unchanged, no undo entry is created, and the editor is in normal mode with no pending sequence

#### Scenario: Replace operator on an empty line

- **WHEN** the cursor is on a line with no characters and the user invokes the replace operator followed by a printable character
- **THEN** the buffer is unchanged, no undo entry is created, and the editor is in normal mode

#### Scenario: Replaced character is undone as one edit

- **WHEN** the user replaces a character with the replace operator and then invokes undo
- **THEN** the original character is restored and the cursor returns to the position it held before the replacement

### Requirement: Replace mode entry and exit

The editor SHALL provide a persistent replace mode that is entered from normal mode only, and that returns to normal mode when the user presses escape.

Replace mode SHALL NOT be reachable from insert mode, visual mode, or visual-line mode.

On exit, the cursor SHALL move one position to the left when a character precedes it on the line, matching how the editor leaves insert mode.

#### Scenario: Entering replace mode from normal mode

- **WHEN** the user presses the replace mode key while in normal mode
- **THEN** the editor enters replace mode and the buffer is unchanged

#### Scenario: Replace mode is not reachable from other modes

- **WHEN** the user presses the replace mode key while in insert mode, visual mode, or visual-line mode
- **THEN** the editor does not enter replace mode and the key is handled by that mode's existing behavior

#### Scenario: Leaving replace mode

- **WHEN** the user presses escape while in replace mode
- **THEN** the editor returns to normal mode and the cursor moves one position to the left if a character precedes it on the line

### Requirement: Overtyping in replace mode

While in replace mode, each key that resolves to a printable character SHALL overwrite the character at the cursor and advance the cursor by one character, leaving the rest of the line unshifted.

When the cursor is at or beyond the end of the line, a printable character SHALL be appended to the line instead of overwriting, and the cursor SHALL advance.

Keys that do not resolve to a printable character, other than escape and backspace, SHALL be ignored and SHALL leave the buffer and cursor unchanged. This includes the enter key, which SHALL NOT insert a line break or end the session.

#### Scenario: Overtyping existing characters

- **WHEN** the user is in replace mode within a line and types a sequence of printable characters shorter than the remaining text on that line
- **THEN** each typed character overwrites one existing character, the line length is unchanged, and the text after the overtyped run is unmodified

#### Scenario: Overtyping past the end of the line

- **WHEN** the user is in replace mode with the cursor at the end of a line and types printable characters
- **THEN** the typed characters are appended to the line, the line grows by the number of characters typed, and no following line is modified

#### Scenario: Space overtypes in replace mode

- **WHEN** the user presses the space key while in replace mode
- **THEN** the character at the cursor is overwritten with a space character and the cursor advances

#### Scenario: Enter is ignored in replace mode

- **WHEN** the user presses enter while in replace mode
- **THEN** the buffer is unchanged, no line break is created, the cursor does not move, and the editor remains in replace mode

#### Scenario: Non-printable keys are ignored in replace mode

- **WHEN** the user presses a cursor key, a function key, or a modified key combination while in replace mode
- **THEN** the buffer and cursor are unchanged and the editor remains in replace mode

### Requirement: Backspace restores overwritten text in replace mode

While in replace mode, backspace SHALL move the cursor one position to the left and restore the character that occupied that position when replace mode was entered, for every position the session has already overwritten.

Once the cursor has returned to the position where replace mode was entered, further backspace presses SHALL move the cursor left without deleting or altering any text.

Backspace SHALL NOT join lines or otherwise change the line structure while in replace mode.

#### Scenario: Backspace restores an overwritten character

- **WHEN** the user has overtyped one or more characters in replace mode and presses backspace
- **THEN** the cursor moves one position left and the character originally at that position is restored

#### Scenario: Backspace restores a full overtyped run

- **WHEN** the user overtypes several characters in replace mode and then presses backspace the same number of times
- **THEN** the line is identical to its content at the moment replace mode was entered and the cursor is back at the entry position

#### Scenario: Backspace past the entry position does not delete

- **WHEN** the cursor is at the position where replace mode was entered and the user presses backspace
- **THEN** the cursor moves one position left if a character precedes it, and no text is removed or altered

#### Scenario: Backspace does not restore characters appended past the end of line

- **WHEN** the user overtypes past the end of a line in replace mode and then presses backspace
- **THEN** the appended characters are removed as the cursor moves left, and the line does not regain characters it never contained

### Requirement: A replace mode session is a single undo step

An entire replace mode session SHALL be recorded as one undo step, so that a single undo restores the buffer and cursor to their state at the moment replace mode was entered, regardless of how many characters were overtyped.

A replace mode session that overwrites no characters SHALL NOT create an undo step and SHALL NOT discard redo history.

#### Scenario: One undo reverts an entire overtyped run

- **WHEN** the user enters replace mode, overtypes several characters, returns to normal mode, and invokes undo once
- **THEN** the buffer and cursor are restored to their values from before replace mode was entered

#### Scenario: Entering and leaving replace mode without typing is not an edit

- **WHEN** the user enters replace mode and immediately presses escape without typing any printable character
- **THEN** no undo step is created, a subsequent undo reverts the edit that preceded replace mode, and any available redo history is preserved

#### Scenario: A replace session invalidates redo history

- **WHEN** the user undoes an edit and then overtypes at least one character in replace mode
- **THEN** redo does not reapply the undone edit, and a single undo restores the state from before replace mode was entered

### Requirement: Replace mode presentation

The editor SHALL present replace mode distinctly from the other modes.

The status area SHALL display a replace mode label while replace mode is active. The label SHALL be rendered using the configurable replace mode color, which SHALL be settable through the same configuration mechanism as the other mode colors and SHALL appear in the published configuration schema.

When hardware cursor rendering is active, the terminal cursor SHALL take a shape distinct from the shapes used for normal mode and insert mode while replace mode is active, and SHALL return to the appropriate shape when the mode changes.

#### Scenario: Replace mode label is shown

- **WHEN** the editor is in replace mode
- **THEN** the status area displays the replace mode label

#### Scenario: Replace mode label color is configurable

- **WHEN** a user sets the replace mode color in configuration
- **THEN** the replace mode label is rendered in that color, and the replace mode color is documented in the published configuration schema

#### Scenario: Cursor shape changes with replace mode

- **WHEN** hardware cursor rendering is active and the editor enters replace mode and later returns to normal mode
- **THEN** the terminal cursor takes a shape distinct from the normal and insert mode shapes while in replace mode, and returns to the normal mode shape on exit
