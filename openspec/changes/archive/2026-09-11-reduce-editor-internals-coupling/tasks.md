## 1. Public Host-Service Cleanup

- [x] 1.1 Define the narrow host-services contract for controller needs (public focus state/change notification, render requests, and hardware-cursor visibility where required), and pass it from `VimModalEditor` into movement, text-edit, and visual-highlight controllers; verify `bun run type-check` accepts the constructor and interface wiring.
- [x] 1.2 Replace controller reads of `focused`/`onChange`/TUI host behavior with the public editor properties or injected callbacks, while retaining the centralized adapter only for unavoidable state and helper internals; verify focused cursor-marker behavior and change notifications with the relevant editor/controller tests.
- [x] 1.3 Keep movement on direct cursor writes through the contained adapter and ensure no synthetic keypress movement is introduced; verify movement tests preserve cursor results and a source check finds no controller path that routes movement through `handleInput`.

## 2. Border Hooks and Captured Scroll Integration

- [x] 2.1 Add the `VimModalEditor` protected top/bottom border overrides for Pi 0.85.1, calling `super` and capturing the current top `hiddenLineCount` per render while composing the existing mode/pending-key label in the bottom border; verify the returned borders retain Pi scroll indicators and labels at narrow widths.
- [x] 2.2 Pass the captured top hidden-line count explicitly into `VisualHighlightRenderer`, remove its private `scrollOffset` dependency, and retain Pi's `lastWidth` plus the local wrapping parity implementation; verify wrapped overlay alignment after scrolling and width changes.
- [x] 2.3 Add modal/render integration coverage for normal, insert, visual, and visual-line labels, pending keys, scrolling, padding, autocomplete rows, selection, fake cursor, and hardware cursor output; verify rendered rows preserve expected terminal width and Pi border/autocomplete placement.

## 3. Regression-First Paste-Aware Undo/Redo

- [x] 3.1 Add failing real-editor regressions using actual bracketed large pastes and `getExpandedText()` for multiline paste undo, redo, repeated undo/redo cycles, two distinct pastes, and a new paste after undo and after redo; verify each scenario asserts exact buffer, cursor, and expanded-paste content.
- [x] 3.2 Implement a complete cloned snapshot shape containing editor state, paste `Map` contents, and paste counter, with independent array/map copies for every capture and restore; verify the new paste regressions pass without paste identities borrowing or rewriting another snapshot.
- [x] 3.3 Apply complete snapshots consistently to Pi undo entries and extension-local redo entries, compare relevant metadata for redo validity, and preserve the raw-state/fallback path without inventing unavailable metadata; verify plain-text undo/redo, intervening-edit redo invalidation, and fallback fixtures pass.
- [x] 3.4 Verify paste metadata remains correct through repeated undo/redo and subsequent new pastes, including expanded content after redo and absence of undone content; verify the capability scenarios in `specs/paste-aware-undo-redo/spec.md` are covered by passing tests.

## 4. Internals Boundary, Tripwire, and Documentation

- [x] 4.1 Narrow `EditorInternals` and its runtime tripwire to the intentionally retained private surface (cursor writes, edit bookkeeping, segmentation, undo primitives, and wrap width/metadata), documenting why the expanded paste metadata is required for correctness; verify `test/editor-internals.test.ts` passes against the installed Pi 0.85.1 editor.
- [x] 4.2 Update affected editor codemaps and adapter/controller comments to describe public host services, protected border hooks, explicit scroll capture, retained `lastWidth` parity, and raw-state fallback; verify documentation references match the implemented file boundaries and no runtime deep import is added.

## 5. Validation and Runtime Smoke Test

- [x] 5.1 Run the complete package checks `bun run type-check`, `bun test`, and `bun run lint` without using `lint:fix` or whole-tree automatic fixes; verify all commands pass and report any failure without modifying unrelated files.
- [x] 5.2 Perform a manual smoke test in actual Pi covering mode transitions, movement/editing, narrow and wrapped rendering, scrolling, autocomplete rows, visual selection, fake cursor, and hardware cursor behavior; verify observed output matches the regression expectations and note that this supplements rather than replaces automated tests.
