## Purpose

Preserve complete, user-visible editor history when edits include large pastes, so undo and redo restore both text and the meaning of paste content without affecting later pastes.

## ADDED Requirements

### Requirement: Undo and redo restore complete paste edits
The editor SHALL restore the full buffer and cursor position associated with an edit when the edit is undone or redone, including the content represented by an expanded paste.

#### Scenario: Undo restores a large paste
- **WHEN** a user inserts a large paste into a buffer and then invokes undo
- **THEN** the buffer and cursor are restored to their exact values from before the paste, and no content from that paste remains represented in the buffer

#### Scenario: Redo restores a large paste
- **WHEN** a user undoes a large paste and then invokes redo
- **THEN** the buffer and cursor are restored to their exact values immediately after the paste, and submitting or otherwise expanding the paste produces the same pasted content as before undo

#### Scenario: Undo restores a paste edit across lines
- **WHEN** a large paste changes multiple logical lines and the user invokes undo
- **THEN** the complete pre-paste buffer and cursor position are restored rather than only the visible text on the active line

### Requirement: History snapshots isolate paste metadata
The editor SHALL keep the paste content and identity associated with each undo or redo state isolated, so restoring one history state cannot alter the paste meaning of another state.

#### Scenario: Restoring history does not borrow another snapshot's paste
- **WHEN** a user creates two history states involving different large pastes and moves backward and forward through those states
- **THEN** each restored state expands only its own paste content and does not use, remove, or rewrite paste content belonging to another state

#### Scenario: Repeated undo and redo remain stable
- **WHEN** a user repeatedly undoes and redoes a large-paste edit without making a new edit
- **THEN** each undo and redo returns the same buffer, cursor position, and expanded paste content for that edit every time

### Requirement: Subsequent pastes retain safe identities
The editor SHALL preserve correct paste identity and expansion for a paste performed after undo or redo, without causing an earlier or later paste to resolve to the wrong content.

#### Scenario: A new paste after undo is independent
- **WHEN** a user inserts a large paste, undoes it, and then inserts a different large paste
- **THEN** the new paste expands to its own content, the earlier paste remains absent from the buffer, and undoing the new edit restores the state before the new paste

#### Scenario: A new paste after redo is independent
- **WHEN** a user inserts a large paste, undoes it, redoes it, and then inserts a different large paste
- **THEN** both paste occurrences retain their correct content when expanded, with neither paste resolving to the other's content

### Requirement: Plain-text undo and redo remain compatible
The editor SHALL preserve existing undo and redo behavior for ordinary plain-text edits, including invalidating redo history when a new edit is made after undo.

#### Scenario: Plain-text edit can be undone and redone
- **WHEN** a user makes an ordinary plain-text edit and invokes undo followed by redo
- **THEN** undo restores the complete prior buffer and cursor position, and redo restores the complete post-edit buffer and cursor position

#### Scenario: New plain-text edit invalidates redo
- **WHEN** a user makes a plain-text edit, invokes undo, and then makes a different plain-text edit before invoking redo
- **THEN** redo does not reapply the first edit, and undo restores the state immediately before the different edit
