## Why

Pi 0.85.1 exposes border-render hooks that can replace fragile output scanning, while several fields accessed through our unsafe editor adapter already have public alternatives. The upgrade review also found that our undo adapter discards Pi's paste metadata, creating a potential mismatch between restored text and expanded paste content.

## What Changes

- Replace unsafe `focused`, `onChange`, and `tui` access with public properties and explicitly injected host services.
- Render the mode/pending-key label through `renderBottomBorder`, preserving Pi's border content and the existing label behavior.
- Capture the top-border hook's hidden-line count for post-render selection positioning rather than reading private `scrollOffset`.
- Add regression coverage for paste-bearing undo/redo and preserve complete Pi snapshots, including paste metadata, through the extension's undo/redo path.
- Retain the centralized adapter for cursor writes, edit bookkeeping, paste-aware segmentation, undo primitives, and wrap width; retain the local wrapping implementation and test-only upstream parity bridge.

## Capabilities

### New Capabilities

- `paste-aware-undo-redo`: Undo and redo restore buffer, cursor, and expanded paste content together without corrupting subsequent paste identities.

### Modified Capabilities

None. No existing main specs are present. Public-API and rendering changes are behavior-preserving refactors rather than new capabilities.

## Impact

- Runtime: `src/vim-modal-editor.ts`, `src/editor/types.ts`, movement/text-edit controllers, and visual-highlight renderer.
- Tests: editor-internals tripwire, text editing/undo regression tests, visual rendering tests, and new modal-border integration coverage as needed.
- Documentation: affected codemaps and adapter comments describing the reduced private surface and retained upstream dependencies.
- Targets the already-selected Pi 0.85.1 dependency. No additional dependency upgrade or configuration changes are planned; completed TypeScript/TUI-constructor compatibility fixes remain separate.
- Non-goals: eliminate all internals, replace the editor, simulate movement through input events, change keybindings or register semantics, enable embedded working status, or introduce runtime deep imports.
