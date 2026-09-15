## Context

See `proposal.md` — Why, for motivation. The constraints that shape this design come from the existing code:

- `VimMode` is a Zod enum consumed by several exhaustive `Record<VimMode, …>` tables (`src/types.ts`, `src/utils/vim-mode.util.ts`, `src/editor/hardware-cursor-controller.ts`, and the per-mode sequencer map in `src/vim-modal-editor.ts`). Adding a member is a compile-time-guided fan-out rather than a search problem.
- `TextEditController` mutates the host editor's state directly inside a `startEdit()` / `finishEdit()` pair. `startEdit()` is the only thing that creates an undo entry, and it also clears the extension's redo stack. `finishEdit()` is purely "commit and repaint". The two are already decoupled, which is what makes a multi-keystroke single-undo session cheap.
- There is no overwrite primitive today. The controller has delete, yank, paste, newline, surround, undo, and redo. Grapheme boundaries are already handled internally by segmentation helpers.
- `KeySequencer.match()` calls the host's `parseKey()` and returns early when it yields nothing. Every strategy sits downstream of that call, so a strategy cannot observe input the host parser rejects.
- The extension has no count support anywhere, so no command in this change takes a count.

Two partial edits already exist in the working tree: a `replace` entry in the mode color schema that no code can reach, and a sequencer registration for the replace operator whose completion is never dispatched. Both are absorbed by this change.

## Goals / Non-Goals

**Goals:**

- Keep replace mode's session state small enough to reason about — ideally a single captured string plus two integers.
- Reuse the existing transaction pair rather than introducing an undo subsystem.
- Give the operator and the mode one shared definition of "what counts as a replacement character", so they cannot drift apart.
- Leave the shared key sequencer's behavior for existing commands bit-for-bit unchanged.

**Non-Goals:**

- See `proposal.md` — What Changes, for feature-level exclusions.
- Design-level: no general-purpose "grouped edit" or transaction-nesting API. The session support added here is the minimum that replace mode needs, not a framework.
- No repair of the pre-existing pending-state leak described under Risks.

## Decisions

### Replace mode is a mode; the replace operator is a chord

The operator takes an operand and therefore needs the key sequencer, both to hold pending state and because the sequencer's pending key is what renders the trailing hint in the status label. Replace mode takes no operand — the key is a plain mode transition handled alongside the existing visual-mode entry keys, and every subsequent keystroke is routed by the new mode's input handler.

Alternative considered: modelling replace mode as a long-lived sequence in the sequencer. Rejected — the sequencer models bounded chords, and an unbounded session would require it to grow session and escape semantics it has no other use for.

### A replace mode session is single-line, and enter is ignored

Vim inserts a line break when enter is pressed during replace mode and continues the session on the next line. Supporting that would require a per-line journal of overwritten text and would make undo and backspace span line-structure changes.

Ignoring enter keeps the session record to `{ line, entryCol, originalLine, started }`, where `originalLine` is the line's content captured once at entry. Backspace-restore then becomes a substring read from `originalLine` rather than per-keystroke bookkeeping, and there is no case where the session's anchor line can disappear or split beneath it.

This is a deliberate divergence from Vim, justified by the host being a prompt editor where enter carries a submit meaning in normal mode and multi-line overtyping is rare.

### Non-printable keys are ignored rather than passed through

Cursor keys, function keys, and modified combinations are dropped while replace mode is active. Allowing them to move the cursor would let it leave the session's anchor line or jump behind the entry column, invalidating both the restore window and the meaning of the single undo step.

Alternative considered: ending the session on any movement key, the way some editors treat overtype. Rejected as less predictable — a stray arrow key would silently commit an edit. Ignoring is recoverable; escape remains the single, explicit exit.

### One undo entry per session, with the snapshot pushed lazily

The session opens by marking itself unstarted. The first overwrite calls the existing `startEdit()`; every subsequent overwrite and restore mutates state and calls only `finishEdit()`. Escape ends the session without any further history interaction.

Laziness matters because `startEdit()` also clears the redo stack. Pushing eagerly on mode entry would mean that entering and leaving replace mode without typing destroys redo history and inserts a no-op undo step, so the next undo would revert the user's *previous* edit. Deferring to the first mutation makes an empty session a true no-op and keeps the existing paste-aware undo requirement — that a new edit invalidates redo — satisfied without weakening it.

Alternative considered: snapshot per keystroke. Rejected outright — an overtyped run of N characters would cost N undo steps and clear redo N times.

### Backspace derives restoration from the entry snapshot, not a journal

Because the session captured `originalLine` at entry and the cursor cannot leave the line, restoring position `c` is a read of the grapheme at `c` in `originalLine`. Positions at or beyond the original line's length were appended rather than overwritten, so backspace removes them instead of restoring. Once the cursor reaches `entryCol`, backspace degrades to plain leftward movement with no mutation — matching Vim, and also the only behavior consistent with the session having nothing recorded before that column.

### Printable-character resolution is one shared function

The host key parser reports some printable keys by name rather than by character — space being the case that matters. Splicing a key name into the buffer instead of a character would be a visible corruption bug, so a translation step is mandatory regardless of scope.

A single helper maps a parsed key to either the literal character it represents or nothing. It is used in exactly two places: the new sequencer strategy's predicate, and replace mode's input filter. That is what makes the operator and the mode accept an identical character set by construction rather than by parallel maintenance.

### A new sequence strategy rather than the existing schema-based one

The operator's registration currently uses the schema-based strategy with the closed character enum, which covers every printable ASCII key except space. Rather than widen that enum — which is shared with other commands and is a key *vocabulary*, not a *character* vocabulary — this change adds a strategy whose predicate is the shared printable-character helper. The strategy reports the resolved character as the completed sequence's payload, so the dispatch site receives a character rather than a key name.

The existing find-character commands keep the schema-based strategy. Migrating them would change their behavior, which belongs in its own change.

### Non-ASCII replacement characters are out of scope, deliberately

The host key parser returns nothing for accented letters, CJK characters, and emoji, and `KeySequencer.match()` discards unparsed input before any strategy runs. Accepting them would require a raw-input fallback inside the shared sequencer.

That fallback is feasible and can be scoped so it only applies while a chord is pending — leaving non-pending behavior identical and letting each existing strategy reject the wider input on its own terms. It was nonetheless deferred, because it also requires a grapheme-count guard so that a bracketed paste arriving mid-chord is not spliced in as a replacement. Both the operator and replace mode are gated by the same parser, so the two stay consistent with each other while the limitation stands: non-ASCII input is ignored in both.

## Risks / Trade-offs

- **Divergence from Vim on enter** → Documented explicitly in the normal-mode docs so the behavior is discoverable rather than surprising; the alternative costs a per-line journal for a rare workflow.
- **Non-ASCII replacement silently does nothing** → Consistent across the operator and the mode, so users encounter one rule rather than two. The design records the scoped fallback so a later change does not have to re-derive it.
- **Adding a mode member touches several exhaustive tables** → Type checking enumerates every site; the risk is mechanical breakage caught at build time, not silent misbehavior.
- **Session state can be invalidated by edits from outside the mode's input handler** → Mitigated by ignoring every key that is not a printable character, escape, or backspace, which leaves no path for the buffer to change beneath an open session.
- **Pre-existing pending-state leak** → `KeySequencer.match()` returns early without clearing pending state when the host parser yields nothing, so an unparsed key pressed mid-chord leaves the sequencer believing the chord is still open and leaves a stale hint in the status label. This already affects the find-character commands and will equally affect the replace operator. It is knowingly left unfixed here to keep this change scoped; it should be addressed on its own, since fixing it alters existing command behavior.
- **`colors.replace` becomes reachable** → Users who already set it see it take effect for the first time. The value is a mode label color with a sensible default, so the blast radius is cosmetic.

## Migration Plan

No data or configuration migration. Existing configuration files remain valid; `colors.replace` already validates and merely starts having an effect. The generated JSON schema artifact must be regenerated so the field is advertised to users.

Rollback is removal of the change — no persisted state is created.
