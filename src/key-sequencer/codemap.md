# src/key-sequencer/

## Responsibility

This folder owns multi-key sequence detection for `VimModalEditor`. It turns raw input events into one of three outcomes (`completed`, `pending`, or `none`) for Vim-style chorded commands, such as `gg`, `dd`, `<leader>w`, `f<char>`, or the configured "exit insert mode" sequence. The folder exposes the public API from `index.ts` and keeps per-mode `KeySequencer` instances in `vim-modal-editor.ts` (one for `normal`, `insert`, `visual`, and `visualLine`).

## Design

The design is strategy-based and stateful:

- `KeySequenceStrategy` interface: every strategy declares a `leader: VimKeyId`, a `pendingSequence` boolean, and a `match(key: string): KeySeqMatchRes` method.
- `KeySeqMatchRes`: the union result `{ result: 'completed' | 'pending' | 'none'; matched?: PendingKey }`.
- `PendingKey`: the normalized description of an in-flight sequence `{ leader: VimKeyId; seqKey?: string }`.
- `KeySequencer`: a per-mode registry that owns a `Map<string, KeySequenceStrategy>` keyed by `leader`, plus cross-strategy pending state (`lastPendingLeader`, `lastPendingSeqKey`). It routes each parsed key to the correct strategy and exposes `pendingKey` so the editor can render pending state.
- `parseKey(data)` from `@earendil-works/pi-tui` is used to normalize raw input before matching.

Strategy implementations in `strategies/`:

- `TimeBasedKeySequence`: accumulates a `savedSeq` and uses `Date.now() - timestamp <= timeout` to decide whether a prior leader press is still pending. Supports exact sequence completion and prefix matching; also supports a single-leader/no-sequence shortcut used by the insert-mode "to normal" remap.
- `SchemaBasedKeySequence`: two-state (leader then schema-validated key) using a Zod schema (`CharOnlyKeySchema`). The second key is validated by `schema.safeParse(key)`.
- `MultiCharKeySequence`: stateful exact/prefix matching against a fixed set of sequences (`Set<string>`); once the leader is pressed it accumulates keys until a sequence completes or no prefix matches.

## Flow

1. `VimModalEditor.handleInput` delegates to a mode-specific handler (`handleNormalMode`, `handleInsertMode`, etc.).
2. The handler calls `this.keySeq[mode].match(data)`.
3. `KeySequencer.match` parses the raw input with `parseKey(data)`. If there is a pending leader (`pendingKey.leader`), it reuses that strategy; otherwise it looks up the strategy by the parsed key.
4. The selected strategy evaluates the key:
   - If it is the leader and no sequence is pending, the strategy enters pending state and returns `{ result: 'pending' }`.
   - If a sequence is pending and the new key completes a registered sequence, it returns `{ result: 'completed', matched: { leader, seqKey } }` and clears its internal state.
   - If the key is still a valid prefix, it stays pending.
   - Otherwise it returns `none` and invalidates.
5. `KeySequencer` updates its own `lastPendingLeader` / `lastPendingSeqKey` on `pending`, or clears them on completion/`none`.
6. The mode handler reacts:
   - `pending`: calls `this.tui.requestRender()` so the mode label can show the pending leader/seqKey.
   - `completed`: dispatches based on `matched.leader`, e.g. `movement.findChar`, `textEdit.deleteLine`, `handleActionCommands`, or `handlePendingG`.
   - `none`: falls through to normal movement/edit/action handling.

## Integration

- `VimModalEditor` constructs four `KeySequencer` instances in `this.keySeq` and registers strategies per mode in `registerInsertModeSequences`, `registerNormalModeSequences`, `registerVisualModeSequences`, and `registerVisualLineModeSequences`.
- `ConfigLoader` supplies configured sequence data:
  - `toNormalModeSequence` (`TimeBasedSequenceOpts`) feeds `this.keySeq.insert` for the "return to normal mode" remap.
  - `leaderKeyAppKeySequences` (`TimeBasedSequenceOpts`) feeds `this.keySeq.normal` for `<leader>`-prefixed app keybindings.
  - `getActionKeybindingForKey({ key, leaderKey })` resolves a completed `<leader>` sequence or direct key to a `CombinedKeybindId`.
- `DEFAULT_LEADER_KEY` (from `src/constants.ts`, value `'space'`) is the leader for app keybindings. `handleActionCommands` checks `matched.leader === DEFAULT_LEADER_KEY` and calls `config.getActionKeybindingForKey({ key: matched.seqKey, leaderKey: true })`, then validates the binding against `AppKeybindingSchema` before invoking the action.
- `modeLabel` uses `this.keySeq[this.mode].pendingKey` so the status bar can display the in-progress sequence (e.g. `-- NORMAL (g) --`).
