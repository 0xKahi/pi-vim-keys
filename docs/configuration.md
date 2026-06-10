# Configuration

`pi-vim-keys` reads JSON configuration from two locations:

| Scope | Path |
| --- | --- |
| Global | `~/.pi/agent/extensions/pi-vim-keys/config.json` (respects `PI_CODING_AGENT_DIR`) |
| Project | `<cwd>/.pi/extensions/pi-vim-keys/config.json` |

Both files are optional. The extension starts with the defaults below, then merges the global config, then merges the project config. Project settings win over global settings.

Nested `colors` and `keybinds` objects are merged key-by-key. If `normalModeRemap` is set, it replaces the previous value.

## Example configuration

```json
{
  "$schema": "https://raw.githubusercontent.com/0xKahi/pi-vim-keys/main/assets/config.schema.json",
  "colors": {
    "normal": "#55BBF9",
    "insert": "#72F6B2",
    "visual": "#D498F8",
    "visualLine": "#D498F8"
  },
  "normalModeRemap": {
    "type": "single",
    "key": "escape"
  },
  "keybinds": {
    "<leader>oe": "app.editor.external",
    "<leader>p": "app.clipboard.pasteImage",
    "<leader>l": "app.session.resume",
    "<leader>g": "app.session.tree",
    "ctrl+t": "app.thinking.cycle"
  }
}
```

## Colors

Controls the color of the mode label shown in the editor border.

Each value must be a hex color in `#RRGGBB` format.

```json
{
  "colors": {
    "normal": "#55BBF9",
    "insert": "#72F6B2",
    "visual": "#D498F8",
    "visualLine": "#D498F8"
  }
}
```

## `normalModeRemap`

Controls how insert mode exits back to normal mode.

Single key example:

```json
{
  "normalModeRemap": {
    "type": "single",
    "key": "escape"
  }
}
```

Two-key sequence example:

```json
{
  "normalModeRemap": {
    "type": "sequence",
    "firstKey": "k",
    "secondKey": "j"
  }
}
```

Sequences use a 1000ms timeout. For example, with `k` then `j`, pressing `k` inserts `k` normally unless `j` is pressed within the timeout.

## Keybinds 

> [!INFO]
> LEADER_KEY = `space`

The leader key is always `space`, so `<leader>n` means press `space`, then `n` in normal mode.

Allowed keybind keys:

- `<leader><key>` such as `<leader>n`, `<leader>N`, `<leader>enter`, `<leader>/`
- Modifier keys in the form `ctrl+<key>`, `shift+<key>`, `alt+<key>`, or `super+<key>`

Allowed base keys include lowercase letters, uppercase letters for leader bindings, digits, common symbols, and special keys such as `escape`, `enter`, `tab`, `space`, `backspace`, `delete`, arrow keys, and `f1` through `f12`.

### App Keybinds

Maps normal-mode keys to Pi app keybindings. This supports all Pi app keybindings.

```json
{
  "keybinds": {
    "<leader>n": "app.session.new",
    "<leader>t": "app.session.tree",
    "ctrl+c": "app.interrupt"
  }
}
```

### Extension Keybindings

Extension keybindings let `pi-vim-keys` trigger other extensions through Pi's event bus.

Any keybind value that starts with the event prefix `pi.vimKeys.event:` is treated as an extension event instead of a built-in Pi app keybinding. When the keybind is pressed in normal mode, `pi-vim-keys` emits that event channel:

```ts
pi.events.emit('pi.vimKeys.event:your-extension-id', '');
```

Use your own extension id after the prefix so the event channel is unique:

```ts
const EXTENSION_ID = 'my-extension';
const PI_VIM_KEYS_EVENT_PREFIX = 'pi.vimKeys.event:';
const PI_VIM_KEYS_EVENT_ID = `${PI_VIM_KEYS_EVENT_PREFIX}${EXTENSION_ID}`;
```

Users can then bind a normal-mode key to that event in their `pi-vim-keys` config:

```json
{
  "keybinds": {
    "<leader>m": "pi.vimKeys.event:my-extension"
  }
}
```

In your extension, register an event listener for the same event id. Keep a session context if your handler needs UI/session APIs:

```ts
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';

const EXTENSION_ID = 'my-extension';
const PI_VIM_KEYS_EVENT_PREFIX = 'pi.vimKeys.event:';
const PI_VIM_KEYS_EVENT_ID = `${PI_VIM_KEYS_EVENT_PREFIX}${EXTENSION_ID}`;

export default function (pi: ExtensionAPI) {
  let latestCtx: ExtensionContext | undefined;

  pi.on('session_start', (_event, ctx) => {
    latestCtx = ctx;
  });

  pi.events.on(PI_VIM_KEYS_EVENT_ID, () => {
    if (!latestCtx) return;

    // Run the same behavior your extension would normally expose through a command,
    // modal, UI action, etc.
    latestCtx.ui.notify('Triggered by pi-vim-keys', 'info');
  });
}
```

The important pieces are:

- Use the exact prefix `pi.vimKeys.event:`.
- Append your extension id, for example `pi.vimKeys.event:my-extension`.
- Document that event id so users can place it in `keybinds`.
- Listen with `pi.events.on(...)` inside your extension.

