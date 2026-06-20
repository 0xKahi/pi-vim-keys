# src/key-sequencer/strategies/

## Responsibility

This directory holds the concrete `KeySequenceStrategy` implementations consumed by `KeySequencer` in `src/key-sequencer/index.ts`. Each strategy owns the state machine for a single leader-key family: it decides whether an incoming `VimKeyId` completes a sequence, keeps it pending, or yields no match. Strategies encapsulate their own accumulation, validation, timeout, and invalidation logic, while `KeySequencer` routes parsed keys to the correct strategy and tracks the most recent pending leader.

## Design

All strategies implement the `KeySequenceStrategy` interface exported from `src/key-sequencer/index.ts`:

- `readonly leader: VimKeyId` — the key that begins this strategy's sequence family.
- `pendingSequence: boolean` — runtime predicate indicating whether the strategy is waiting for a continuation key.
- `match(key: string): KeySeqMatchRes` — the decision function.

`KeySeqMatchRes` uses the discriminated union result:

- `result: 'completed'` — the sequence is finished; `matched` contains the `leader` and, when applicable, `seqKey`.
- `result: 'pending'` — the leader (and possibly partial sequence) was accepted; more keys are expected.
- `result: 'none'` — the key does not belong to this sequence family or broke an in-progress sequence.

The optional `matched` payload is typed as `PendingKey = { leader: VimKeyId; seqKey?: string }`.

### `MultiCharKeySequence` (`multi-char-sequence.ts`)

Matches exact multi-character strings after a leader.

- Configuration: `MultiCharSequenceOpts` with `leader` and `sequences: string[]`.
- State: `pending` flag and `savedSeq` accumulator. `sequences` is stored as a `Set<string>` for O(1) exact lookups.
- Behavior:
  - If not pending and the key equals `leader`, it enters pending state and returns `{ result: 'pending', matched: { leader } }`.
  - If pending, the key is appended to `savedSeq`.
    - When `savedSeq` exists in `sequences`, it returns `{ result: 'completed', matched: { leader, seqKey: savedSeq } }` and clears state via `invalidate()`.
    - When `savedSeq` is a prefix of at least one registered sequence, it returns `{ result: 'pending', matched: { leader, seqKey: savedSeq } }`.
    - Otherwise it invalidates and returns `{ result: 'none' }`.
- `hasPrefixMatch` scans the `sequences` set with `String.prototype.startsWith` to determine whether the accumulated buffer can still lead to a valid sequence.

### `TimeBasedKeySequence` (`time-based-sequence.ts`)

Matches exact multi-character strings after a leader, but only while the continuation arrives within a configured timeout.

- Configuration: `TimeBasedSequenceOpts` with `leader`, `sequences: string[]`, and `timeout` in milliseconds.
- State: `timestamp` (set on every save), `savedSeq` accumulator, and `sequences` as a `Set<string>`. `pendingSequence` is computed dynamically as `Date.now() - timestamp <= timeout` rather than stored in a boolean.
- Behavior:
  - If `sequences` is empty, `noSequenceMatch` treats a standalone leader press as a completed single-key sequence (`{ result: 'completed', matched: { leader } }`).
  - On leader press when sequences exist, it first calls `invalidate()` to clear any stale `savedSeq`, then `save()` to set `timestamp = Date.now()`, and returns pending.
  - On a continuation key while pending, it appends to `savedSeq`.
    - Exact match in `sequences` completes the sequence.
    - Prefix match keeps the sequence pending and refreshes the timestamp via `save()`.
    - Mismatch invalidates and returns none.

### `SchemaBasedKeySequence` (`schema-based-sequence.ts`)

Validates exactly one continuation key against a Zod schema rather than a fixed string set.

- Configuration: `SchemaBasedSequenceOpts` with `leader` and `schema: ZodType<VimKeyId>`.
- State: a single `pending` boolean flag; no key accumulator is kept because the schema validates the very next key in isolation.
- Behavior:
  - If not pending and the key equals `leader`, it enters pending state and returns `{ result: 'pending', matched: { leader } }`.
  - If pending, it immediately clears pending via `invalidate()`, runs `schema.safeParse(key)`, and:
    - On success returns `{ result: 'completed', matched: { leader, seqKey: res.data } }`.
    - On failure returns `{ result: 'none' }`.

## Flow

1. A raw key event reaches `KeySequencer.match(data)`.
2. `parseKey` from `@earendil-works/pi-tui` converts the raw input into a `VimKeyId` string.
3. `KeySequencer` chooses the target strategy:
   - If `pendingKey` is non-null, the strategy registered under the pending leader is reused.
   - Otherwise the strategy registered under the freshly parsed key is selected.
4. `strategy.match(parsed)` evaluates the key according to the rules above and returns a `KeySeqMatchRes`.
5. `KeySequencer` updates bookkeeping:
   - On `pending`: stores `lastPendingLeader` and, if present, `lastPendingSeqKey`.
   - On `completed` or `none`: clears pending bookkeeping via `clearPendingMatch()`.
6. Consumers query `KeySequencer.pendingKey`, which re-checks `strategy.pendingSequence` before exposing the current `PendingKey`.

## Integration

Strategies are registered with `KeySequencer.register(strategy)`, which maps each strategy to its `leader` in the internal `_registry` map. Duplicate leaders throw at registration time. The three strategy implementations correspond to different Vim-style input families:

- `MultiCharKeySequence` is used for fixed, order-sensitive multi-key commands (e.g., `gg`, `gU`, `dd`-style families) where continuation is purely prefix-driven.
- `TimeBasedKeySequence` is used for sequences that must be typed within a window and supports both multi-key sequences and a degenerate single-leader mode when no sequences are registered.
- `SchemaBasedKeySequence` is used when the continuation key must satisfy a validation schema (for example, arbitrary motion arguments or replacement keys that are accepted only when they parse as a known `VimKeyId`).

All strategies are opaque to callers outside `KeySequencer`; callers only see the normalized `KeySeqMatchRes` and `PendingKey` abstractions.
