## Context

Pi 0.85.1 provides public `Editor.focused` and `Editor.onChange`, protected `renderTopBorder`/`renderBottomBorder` hooks, and public text/cursor getters and padding accessors (but no public cursor setter or viewport getter). The current extension still reaches through its centralized unsafe adapter for those values, for TUI render requests, movement, cursor bookkeeping, rendering state, segmentation, and undo/paste state. The relevant runtime boundary is `VimModalEditor` plus the movement, text-edit, and visual-highlight controllers; the existing tests include an editor-internals drift tripwire and real-editor rendering/layout checks.

See `proposal.md` for the motivation and fixed scope. No main OpenSpec specs exist, so this design is grounded in the proposal and the installed Pi 0.85.1 declarations/runtime inspected in `node_modules`.

## Goals / Non-Goals

**Goals:**

- Reduce private-editor access at the modal/controller boundary without weakening cursor, edit, undo, paste, or rendering correctness.
- Make host capabilities used by controllers explicit, preferring a narrow host-services object or callbacks injected by `VimModalEditor`.
- Preserve Pi's rendering and border behavior, including scroll indicators, mode-label composition, wrapping, padding, autocomplete, selection, and hardware-cursor positioning.
- Preserve complete undo/redo snapshots for both the extension's local redo path and Pi's undo stack, including paste metadata where available.
- Keep the runtime-safe local wrapping implementation aligned with Pi's recorded `lastWidth`, while retaining the test-only upstream parity bridge.

**Non-Goals:**

- Eliminating all editor internals: cursor writes, edit bookkeeping, paste-aware segmentation, undo primitives, and wrap width remain in the contained adapter where no suitable public API exists.
- Simulating movement with keypresses, changing Vim keybindings/register semantics, replacing the editor, or enabling embedded working status.
- Adding runtime deep imports or changing dependencies/configuration.
- Taking on already-completed Pi dependency or TypeScript/TUI-constructor compatibility fixes; those are compatibility context, not tasks in this design.

## Decisions

### Explicit host services replace incidental modal-editor casts

`VimModalEditor` will pass movement, text-edit, and visual-highlight controllers a narrow host-services object (or equivalent narrow callbacks) for capabilities it already owns: public `focused`/`onChange`, TUI render requests, hardware-cursor visibility as appropriate, and any other host operation that is genuinely available at the public boundary. Controllers will no longer independently cast the modal editor to retrieve these services. The object stays capability-oriented rather than becoming a second unrestricted editor interface.

The unsafe adapter remains the single location for state writes and unavoidable Pi internals. No alternate unsafe casts will be introduced. This makes dependencies explicit and prevents each controller from acquiring a broader view of `Editor` merely to avoid one injection.

The public `editor.focused` property will drive cursor-marker decisions, and public `editor.onChange` will be invoked for completed text changes. Internal callback/TUI fields are not retained as parallel access paths when the public members or injected host service suffice.

### Movement keeps direct internal cursor writes, not simulated input

Movement will continue to compute Vim targets from public `getCursor()`/`getLines()` and use the contained internal cursor-write/native movement adapter for applying them. The design explicitly rejects sending synthetic keys through `handleInput`: that would alter key-sequencer state, autocomplete behavior, and user-visible command semantics. Render requests will come from the injected narrow host service rather than an internal `tui` lookup where possible.

### Text edits use explicit notifications but retain the adapter for atomic state

Text edits continue to normalize and mutate the Pi buffer through the centralized state adapter, preserving cursor bookkeeping, segmentation, registers, and transaction ordering. Completion calls the injected/public change callback with the editor's current text and requests a render through the injected host service. The controller must not assume that a broader `Editor` cast grants a stable public contract.

Undo/redo snapshots are full cloned snapshots, not just `{ lines, cursorLine, cursorCol }` when Pi exposes more state. The snapshot model includes the buffer/cursor plus paste contents (`Map` cloned independently) and the paste counter. The same complete snapshot shape is used for extension-local redo entries and Pi undo entries, so restoring text containing paste markers also restores the identities and expansion data that give those markers meaning. Maps are cloned rather than shared, and state arrays are cloned so later edits cannot mutate history.

Snapshot capture/restore is regression-first: capture the complete available Pi snapshot before each edit, restore it as a unit, and verify paste-bearing undo followed by redo and subsequent paste operations. The existing defensive raw-state/fallback path remains: raw `EditorState` entries and local fallback stacks are accepted when that is all the runtime provides. The implementation will not invent unavailable metadata or fabricate paste IDs. Where wrapped metadata is present, redo validity compares the relevant metadata as well as buffer/cursor state; a mismatch invalidates stale redo rather than applying it, preserving the existing policy for intervening edits.

The expanded internal metadata surface is justified by correctness: although it adds fields to the contained adapter, it reduces coupling elsewhere and prevents a net behavior regression in Pi's paste-aware editor.

### Border rendering uses protected hooks and preserves Pi composition

`VimModalEditor` will override `renderBottomBorder(width, hiddenLineCount)`, call `super.renderBottomBorder(width, hiddenLineCount)` first, and apply the existing mode/pending-key label composition to the returned border. This preserves Pi's own border color, down-scroll indicator/count, and narrow-width behavior. The old rendered-output scan for a bottom border is removed; border ownership stays with Pi.

The override will not opt into `embedWorkingStatus`; the inherited `CustomEditor` top-border behavior remains unchanged. Alternatives rejected are replacing the full render output (which duplicates Pi border/autocomplete behavior) and appending a label after rendering (which loses the hook's explicit hidden-line count and can misidentify rows).

### Top hidden-line count is captured per render and passed to overlays

The `render(width)` override will call `super.render(width)` and use a protected top-border hook override to capture that render pass's `hiddenLineCount`. The captured value is passed explicitly as the visual overlay's scroll offset. This avoids reading private `scrollOffset` while ensuring the overlay starts at exactly the logical row Pi displayed, including narrow and scrolled views. Capture is per render, not persistent editor state, so stale values cannot leak across width changes or cursor-driven scrolling.

The overlay continues to mutate only Pi's already-rendered text rows. It retains the `lastWidth` recorded by Pi during `super.render(width)` and the local `wordWrapLine` parity copy, rather than recomputing a potentially different width. Its existing padding, visible-row, autocomplete-row, selection, and hardware-cursor handling remain intact.

### Regression coverage follows the rendering and metadata boundaries

Tests will exercise real Pi editors and focused modal/render paths rather than only asserting the new interfaces. Coverage will include:

- Full snapshot capture/restore for paste-bearing edits: undo restores expanded paste content and cursor, redo restores it, and later paste markers/counters remain valid for both local redo and Pi undo paths.
- Metadata-aware redo invalidation and the existing raw-state/fallback behavior without requiring metadata unavailable in a fixture.
- Bottom-border composition retaining Pi's `super` output, down-scroll counts, mode/pending-key labels, and narrow widths.
- Top hidden-line capture with scrolling, including overlay alignment after cursor movement and width changes.
- Visual selection rendering at narrow widths and with wrapping, scrolling, left/right padding, autocomplete rows, selection on wrapped boundaries, and both fake and hardware cursor modes; rendered rows must retain their expected terminal width.
- Public focus/change wiring and the editor-internals tripwire narrowed to only the intentionally retained private surface.

The existing test-only deep import of Pi's wrapping implementation remains a parity oracle; it is not introduced into runtime code.

## Risks / Trade-offs

- **[Risk]** Pi changes protected border-hook signatures or border formatting. **Mitigation:** call `super`, keep the override limited to the installed 0.85.1 contract, and cover border output and narrow widths with real-editor tests.
- **[Risk]** Overlay scroll capture is stale or records the wrong render phase. **Mitigation:** reset/capture the top hidden-line count for every `super.render` call and pass it explicitly; test scrolling and width changes.
- **[Risk]** Paste metadata is aliased or partially restored, corrupting marker expansion. **Mitigation:** clone `Map` and counters in every full snapshot, compare metadata for redo validity, and retain raw-state fallback only when metadata is genuinely absent.
- **[Risk]** Moving notifications to public/injected services changes callback ordering. **Mitigation:** preserve the existing start-edit/mutate/finish-edit transaction order and regression-test change/render calls around undo, redo, and paste.
- **[Risk]** The local wrapping copy drifts from Pi. **Mitigation:** continue the installed-upstream parity test and reuse Pi's recorded `lastWidth`.
- **[Trade-off]** The adapter's metadata type becomes broader even as overall coupling decreases. This is intentional and limited to correctness-critical state; it avoids spreading private access across controllers.

## Migration Plan

1. Introduce the narrow host-services boundary and route controller construction through it.
2. Move focus/change and render/layout reads to public or injected services; retain only the documented unavoidable adapter fields.
3. Switch border label composition to the protected bottom hook and top-border hidden-line capture.
4. Upgrade snapshot cloning/restoration and add the paste/redo regressions before removing obsolete private reads and output scanning.
5. Run the existing assigned validation and review the editor-internals tripwire failures as the compatibility boundary.

Rollback is source-level and localized: revert the design's implementation changes to restore the prior centralized adapter behavior. No persisted data format or user configuration migration is required, and the local undo/redo state is recreated per editor instance.

## Open Questions

None. The remaining private Pi fields and fallback behavior are intentionally fixed by the proposal and this design.
