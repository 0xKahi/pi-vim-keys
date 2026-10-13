## Why

The editor implements normal, insert, visual, and visual-line modes but has no way to overwrite text in place. Users coming from Vim reach for `r` to fix a single mistyped character and `R` to overtype a run of text, and today both keys do nothing useful — `R` is unbound, and `r` is registered as a chord whose completion is never dispatched, so `rx` silently falls through and deletes a character instead. Replace is the last commonly used core editing mode missing from the extension.

## What Changes

- Add a single-character replace operator `r<char>` in normal mode: replaces the grapheme under the cursor and stays in normal mode.
- Add a persistent REPLACE mode entered with `R` from normal mode, which overtypes characters until `<Esc>` returns to normal mode.
- Add `replace` as a fifth member of the `VimMode` enum, with its own status label (`REPLACE`), status color, and terminal cursor shape (underline).
- Add overwrite and restore primitives to the text edit controller, plus an explicit multi-keystroke edit session so an entire REPLACE run collapses into one undo entry.
- Add backspace-restore behavior inside REPLACE mode: backspacing over already-overwritten text restores the original characters; backspacing past the entry column is plain leftward movement and does not delete.
- Add a key-sequencer strategy that accepts a leader plus any key resolving to a printable character, so `r<space>` works; and a shared key-to-printable-character helper used by both `r` and REPLACE mode.
- Surface the existing but currently unreachable `colors.replace` configuration value, and regenerate the published JSON schema so it appears for users.

Non-goals for this change:

- Counts (`3rx`, `5R`) — the extension has no count support anywhere, and adding it is a separate concern.
- Non-ASCII replacement characters — host key parsing discards them before any extension code runs; accepting them would require widening shared sequencer behavior.
- Multi-line REPLACE sessions — `<Enter>` is ignored inside REPLACE mode, keeping a session bound to one line.
- Migrating the existing `f`/`F` find-character commands onto the new sequencer strategy.
- Visual-mode replace (`r` over a selection).

## Capabilities

### New Capabilities

- `replace-mode`: Single-character replace (`r<char>`) and persistent overtype REPLACE mode (`R`), covering mode entry and exit, overwrite behavior at and past end of line, backspace restore semantics, undo granularity for a replace session, and the mode's status label and cursor presentation.

### Modified Capabilities

None. The existing `paste-aware-undo-redo` capability requires that a new edit invalidates redo history; a replace session is a single edit and satisfies that requirement unchanged, and a REPLACE session that overwrites nothing performs no edit and therefore correctly leaves history untouched.

## Impact

Affected source:

- `src/types.ts` — `VimModeSchema` gains `replace`, which forces exhaustive updates wherever `Record<VimMode, …>` appears.
- `src/utils/vim-mode.util.ts` — `MODE_TO_LABEL` gains the `REPLACE` label.
- `src/editor/hardware-cursor-controller.ts` — `HARDWARE_CURSOR_SHAPES` gains an underline shape for `replace`.
- `src/vim-modal-editor.ts` — new `replace` key sequencer slot, `R` entry branch in normal mode, `r` completion dispatch, and a new REPLACE mode input handler.
- `src/editor/text-edit-controller.ts` — new overwrite/restore primitives and an explicit edit session that pushes a single undo snapshot lazily on first mutation.
- `src/key-sequencer/strategies/` — new printable-character sequence strategy.
- `src/utils/` — new shared key-to-printable-character helper.
- `src/schemas/config.schema.ts` and `assets/config.schema.json` — the `replace` color becomes reachable and must be regenerated into the published schema.

Affected docs and packaging: `docs/normal-mode.md` editing table, `docs/configuration.md` colors section, `README.md` feature and cursor descriptions, plus a new changeset entry.

No public API breaks. Configuration remains backward compatible: `colors.replace` already exists in the schema with a default and is simply unreachable today.
