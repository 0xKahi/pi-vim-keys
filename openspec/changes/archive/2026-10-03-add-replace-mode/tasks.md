## 1. Shared character resolution

- [x] 1.1 Add a helper in `src/utils/` that maps a parsed key to the printable character it represents or `null`, translating the space key to a literal space and rejecting escape, enter, backspace, tab, cursor keys, function keys, and modified combinations; verify with unit tests covering one case per category
- [x] 1.2 Add a printable-character key sequence strategy under `src/key-sequencer/strategies/` that pairs a leader with one key accepted by the helper from 1.1 and reports the resolved character as the completed sequence payload; verify with unit tests asserting pending on the leader, completion with the resolved character for a letter and for space, and no match for escape
- [x] 1.3 Verify the existing find-character commands are untouched by running `bun test` and confirming no behavior change in the sequencer tests

## 2. Replace mode plumbing

- [x] 2.1 Add `replace` to `VimModeSchema` in `src/types.ts` and run `bun run type-check` to enumerate every exhaustive `Record<VimMode, …>` site that must be updated
- [x] 2.2 Add the `REPLACE` label to `MODE_TO_LABEL` in `src/utils/vim-mode.util.ts` and verify the label renders via a modal editor render test
- [x] 2.3 Add an underline cursor shape for `replace` in `src/editor/hardware-cursor-controller.ts` and verify with a test asserting the emitted escape sequence differs from the normal and insert shapes and reverts on exit
- [x] 2.4 Add the `replace` key sequencer slot in `src/vim-modal-editor.ts` so the per-mode map stays exhaustive, and verify `bun run type-check` passes

## 3. Text mutation primitives

- [x] 3.1 Add an overwrite-grapheme-at-cursor primitive to `src/editor/text-edit-controller.ts` that replaces one grapheme without shifting the remainder of the line and appends when the cursor is at or past end of line; verify with unit tests for mid-line overwrite, end-of-line append, and empty-line behavior
- [x] 3.2 Add a restore-grapheme primitive that rewrites the grapheme at a given column from a captured original line, and removes the grapheme instead when the column lies past the original line's length; verify with unit tests for both branches
- [x] 3.3 Add explicit edit-session support that pushes exactly one undo snapshot lazily on the first mutation and commits subsequent mutations without creating history entries; verify with unit tests asserting one undo entry after several mutations and no undo entry and intact redo history after a session with zero mutations

## 4. Replace operator

- [x] 4.1 Replace the existing schema-based registration for the replace operator in `src/vim-modal-editor.ts` with the strategy from 1.2; verify the pending hint still renders in the status label via a render test
- [x] 4.2 Dispatch the completed replace operator sequence to the overwrite primitive, remaining in normal mode with the cursor on the replaced character; verify with tests covering mid-line replacement, replacement with space, no-op on an empty line, and single-step undo
- [x] 4.3 Verify a cancelled operator leaves the buffer unchanged and creates no undo entry when the second key is escape or a cursor key

## 5. Replace mode behavior

- [x] 5.1 Add the replace mode entry key to the normal-mode handler in `src/vim-modal-editor.ts`, capturing the session record of anchor line, entry column, original line content, and started flag; verify with a test asserting the mode label appears and the buffer is unchanged on entry
- [x] 5.2 Add the replace mode input handler that overtypes printable characters, advances the cursor, and appends past end of line; verify with tests for an overtyped run, an append past end of line, and space overtyping
- [x] 5.3 Ignore every other key in replace mode including enter, cursor keys, function keys, and modified combinations; verify with tests asserting buffer, cursor, and mode are unchanged for each category
- [x] 5.4 Implement backspace restore from the captured original line, removing appended characters past the original length and degrading to plain leftward movement at or before the entry column; verify with tests for partial restore, full restore back to entry state, backspace past the entry column, and backspace over appended characters
- [x] 5.5 Implement escape exit returning to normal mode with the cursor moved one position left when a character precedes it, reusing the insert-mode exit behavior; verify with a test asserting mode and cursor position
- [x] 5.6 Verify replace mode is unreachable from insert, visual, and visual-line modes with a test pressing the entry key in each mode

## 6. Undo integration

- [x] 6.1 Wire the replace mode session to the edit-session support from 3.3; verify with a test that one undo after an overtyped run restores the buffer and cursor to their pre-entry values
- [x] 6.2 Verify an empty replace mode session creates no undo entry and preserves redo history with a test that undoes an edit, enters and exits replace mode without typing, then redoes successfully
- [x] 6.3 Verify a replace session invalidates redo history with a test that undoes an edit, overtypes one character in replace mode, and confirms redo does not reapply the undone edit
- [x] 6.4 Run `bun test` and confirm the existing paste-aware undo and redo tests still pass

## 7. Configuration and packaging

- [x] 7.1 Confirm the replace mode label renders using the configured replace color and that the color resolves through the config loader; verify with a render test using a custom configured color
- [x] 7.2 Run `bun run buildSchema` and verify `assets/config.schema.json` now contains the replace color property

## 8. Documentation and release

- [x] 8.1 Add the replace operator and replace mode rows to the editing table in `docs/normal-mode.md`, stating that enter is ignored and that non-ASCII replacement characters are unsupported; verify the rendered table lists both commands
- [x] 8.2 Document the replace mode color in the colors section of `docs/configuration.md`; verify the entry matches the generated schema
- [x] 8.3 Update the features and cursor descriptions in `README.md` to mention replace mode and the underline cursor; verify the cursor description covers all modes
- [x] 8.4 Add a minor-bump changeset under `.changeset/` describing the new replace operator and replace mode; verify the file has the package name and `minor` in its frontmatter

## 9. Final verification

- [x] 9.1 Run `bun run check` and `bun test` and verify lint, type-check, and the full suite pass
- [x] 9.2 Run `openspec validate --strict` for this change and verify it reports no issues
