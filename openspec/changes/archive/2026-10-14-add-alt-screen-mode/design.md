# Design

## Context

- Pi's fullscreen renderer is `TuiAltScreen` (`@earendil-works/pi-tui`). It registers an input listener (`handleViewportInput`) that runs **before** the focused component and consumes any key bound to `tui.altScreen.*`. Keys it doesn't match fall through to the editor. Default bindings only cover `pageUp`, `pageDown`, `home`, `end`, `ctrl+shift+up/down`, and `ctrl+shift+f`, so `j k u d g G /` and `ctrl+w` reach `VimModalEditor`.
- `TuiAltScreen` public API: `scrollBy(n)`, `scrollToTop()`, `scrollToBottom()`, `viewportTop`, `isFollowingOutput`. **Not public:** `toggleSearch()` and `getPrimaryScrollView()` (which holds `viewportHeight`).
- The editor's `tui` is a Proxy (`createInteractiveTuiReference`) over the current renderer. It implements `getPrototypeOf`, so `instanceof TuiAltScreen` works. The renderer can be swapped at runtime (fullscreen <-> regular).
- In normal mode, `ctrl+w` currently does nothing: unhandled keys go to `handleActionCommands` and are never passed to `super`.
- Modes are a `VimModeSchema` enum with one `KeySequencer` per mode (`vim-modal-editor.ts:42`). The leader key is fixed at `space` (`DEFAULT_LEADER_KEY`).

## Goals / Non-Goals

**Goals:**
- Use public `TuiAltScreen` API wherever it exists, and keep all non-public access in one feature-detected adapter.
- Make no change to the behavior of existing modes, apart from the entry key in normal mode.

**Non-Goals:**
- Configurable keys inside the mode, and a default entry binding.
- Overriding Pi's own `tui.altScreen.*` bindings. Keys Pi consumes first are out of reach.
- Prompt jumping (`previousPrompt` / `nextPrompt`), search-match navigation from inside the mode, and any extra on-screen indicator outside the editor's bottom border.

## Decisions

### D1. `altScreen` is a real `VimMode`
Add `'altScreen'` to `VimModeSchema` and give it its own `KeySequencer`. `handleInput` routes to a new `handleAltScreenMode`.
- *Why:* this reuses the existing mode switch, sequencer, pending-key, and render plumbing. Everything keyed on `VimMode` (`MODE_TO_LABEL`, colors, cursor shape) is forced by the types to handle the new value.
- *Alternative:* a boolean flag layered over normal mode. That's less code at first, but every handler would need to check the flag, and pending-sequence state would leak between the two.

### D2. Alt-screen mode follows the standard mode display
The bottom-border label shows `ALT-S`, colored by a new `colors.altScreen` entry (default `#ED7892`). The hardware cursor uses the normal (block) shape, because the editor buffer is still conceptually in normal mode.
- *Why:* it uses the same label and color mechanism as every other mode, with no extra rendering.
- *Alternatives:* a separate indicator row above the editor, or reusing the `NORMAL` label. The indicator row was built first and then dropped as too complicated; `NORMAL` would hide which mode you're in.

### D3. Entry through a vim-keys editor keybinding action
- `keybind.schema.ts` gets `VIM_KEYS_EDITOR_KEYBINDINGS = { 'pi.vimKeys.altScreenMode': true }` and `VimKeysEditorKeybindSchema`, mirroring `APP_KEYBINDINGS` / `AppKeybindingSchema`. The external event schema is renamed `ExternalExtensionKeybindSchema`; its user-facing `pi.vimKeys.event:` prefix doesn't change. `CombinedKeybindSchema` is the union of the three.
- Users bind the action in `keybinds`. There is no default. Existing `keybinds` parsing already handles both `<leader>…` and `modifier+key` forms, including leader-sequence registration.
- `handleActionCommands` checks editor actions **first**, before app actions and before the fallback that emits events; otherwise the action would be emitted as an event.
- Keybinds are dispatched only from normal mode, which gives "normal mode only" for free. One key maps to one action, so there are no precedence rules or conflict checks.
- *Alternative:* a dedicated `altScreenModeKey` field with default `ctrl+w`. This was implemented first and dropped: it duplicated key parsing, needed a precedence rule over `keybinds`, and added a second mapping surface.

### D4. Fullscreen guard
On every entry attempt, `tui instanceof TuiAltScreen` is checked, never cached. When it's false, the entry key is consumed as a no-op. If the renderer leaves fullscreen while the editor is in alt-screen mode, the next keypress in `handleAltScreenMode` switches to normal mode first and then handles the key as a normal-mode key.

### D5. `AltScreenController` adapter (`src/editor/alt-screen-controller.ts`)
A small class that wraps `tui` and exposes `isAvailable()`, `scrollLines(n)`, `scrollHalfPage(dir)`, `scrollToTop()`, `scrollToBottom()`, and `openSearch()`.
- Public calls go straight through.
- `scrollHalfPage` reads the viewport height via `getPrimaryScrollView?.()?.viewportHeight` when that exists. Otherwise it falls back to `floor(terminal.rows / 2)`, with a minimum of 1. This matches Pi's own `halfPageUp/Down` math.
- `openSearch` calls `toggleSearch` only if `typeof === 'function'`; otherwise it does nothing. It must not toggle search closed when search is already open. When search is open its overlay has focus, so the editor doesn't receive `<leader>/` anyway.
- *Why:* if Pi renames something, the action quietly does nothing instead of crashing, and it's the one place to update if upstream makes these members public.
- *Alternative:* look up the user's Pi key for `tui.altScreen.search` and re-inject it as input. Rejected because it depends on the action being bound, needs raw-sequence encoding (Kitty), and re-enters the input pipeline.

### D6. Alt-screen key handling
The sequencer registers `MultiCharKeySequence({ leader: 'g', sequences: ['g'] })` and `TimeBasedKeySequence({ leader: DEFAULT_LEADER_KEY, sequences: ['/'] })`. Single keys are dispatched as follows:

| Key | Action |
|---|---|
| `j` / `k` | `scrollLines(+1 / -1)` |
| `d` / `u` | `scrollHalfPage(+1 / -1)` |
| `G` | `scrollToBottom()` |
| `gg` | `scrollToTop()` |
| `<leader>/` | `openSearch()` |
| `escape` | `setMode('normal')` |
| `i` | `setMode('insert')` |
| anything else | swallowed |

`escape` is matched literally rather than through `normalModeRemap`, because that setting describes the insert-to-normal transition. Each action calls `tui.requestRender()`.

## Risks / Trade-offs

- [Pi renames or removes private `toggleSearch` / `getPrimaryScrollView`] -> both are feature-detected in D5. Search becomes a no-op and half-page falls back to terminal rows. A unit test with a stub TUI covers both paths.
- [A user binds `pi.vimKeys.altScreenMode` to a key Pi binds under `tui.altScreen.*`] -> Pi consumes it first, so the mode is unreachable. This is documented in `docs/alt-screen-mode.md`, and nothing is detected.
- [The mode is hard to discover without a default binding] -> docs show a recommended `ctrl+w` binding.

## Migration Plan

Additive only. Existing configs stay valid because `colors.altScreen` is optional with a default, the editor action is opt-in, and the schema rename is internal. Regenerate `assets/config.schema.json` with `bun run buildSchema`. To roll back, revert the change. No persisted state is involved.
