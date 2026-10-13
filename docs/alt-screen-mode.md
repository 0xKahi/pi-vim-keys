# Alt-Screen Mode

Alt-screen mode is a keyboard layer for navigating Pi's fullscreen transcript without editing the input buffer. It requires Pi's fullscreen mode.

## Entering Alt-Screen Mode

Alt-screen mode has no default key. Enable entry by binding the built-in editor action `pi.vimKeys.altScreenMode` in `keybinds`, for example:

```json
{
  "keybinds": {
    "ctrl+w": "pi.vimKeys.altScreenMode"
  }
}
```

Or use a leader binding:

```json
{
  "keybinds": {
    "<leader>s": "pi.vimKeys.altScreenMode"
  }
}
```

Press your configured binding from normal mode in Pi fullscreen to enter. Keybindings are only dispatched from normal mode; the binding does not enter alt-screen mode from insert, visual, visual-line, or replace mode. See [Configuration](./configuration.md#built-in-editor-keybindings).

The leader key is `space`.

## Navigation and Exit Keys

| Key | Description |
| --- | --- |
| `j` | Scroll the transcript down one line |
| `k` | Scroll the transcript up one line |
| `d` | Scroll the transcript down half a viewport |
| `u` | Scroll the transcript up half a viewport |
| `gg` | Jump to the top of the transcript |
| `G` | Jump to the bottom of the transcript and resume following new output |
| `<leader>/` | Open Pi's transcript search |
| `esc` | Return to normal mode |
| `i` | Enter insert mode without changing the buffer |

Other keys are ignored: they do not edit the buffer, move the editor cursor, or trigger configured `keybinds` actions. Leaving alt-screen mode does not change the transcript scroll position.

## Mode Label

Alt-screen mode shows `ALT-S` on the editor bottom border, following the other modes' label format. Pending keys appear alongside it, for example ` ALT-S <leader>_ `.

The label uses `colors.altScreen`, defaulting to `#ED7892`. Override it like other mode colors in [Configuration](./configuration.md#colors). The hardware cursor keeps the normal-mode block shape.

## Transcript Search

Press `space` then `/` to open Pi's transcript search. While search is open, `esc` closes search first and leaves the editor in alt-screen mode. A second `esc` returns to normal mode.

## Limitations

- Pi consumes keys bound under `tui.altScreen.*` in its `keybindings.json` before they reach the editor. Do not bind `pi.vimKeys.altScreenMode` to one of these keys; those bindings also take precedence over the mode's navigation keys.
- In regular (non-fullscreen) screen mode, the entry key does nothing in normal mode.
- If Pi leaves fullscreen while alt-screen mode is active, the next keypress returns to normal mode and is handled as a normal-mode key.
- Navigation keys inside alt-screen mode are fixed, not configurable. Search relies on a feature-detected Pi API and does nothing if that API is unavailable.
