import { describe, expect, it, mock } from 'bun:test';
import type { Theme } from '@earendil-works/pi-coding-agent';
import { type EditorTheme, KeybindingsManager, setKeybindings, type TUI, TUI_KEYBINDINGS, TuiAltScreen } from '@earendil-works/pi-tui';
import { ConfigLoader } from '../src/config-loader';
import { type PiVimKeysConfig, PiVimKeysConfigSchema } from '../src/schemas/config.schema';
import { VimModalEditor } from '../src/vim-modal-editor';

const editorTheme: EditorTheme = {
  borderColor: text => text,
  selectList: {
    selectedPrefix: text => text,
    selectedText: text => text,
    description: text => text,
    scrollInfo: text => text,
    noMatch: text => text,
  },
};
const theme = { bg: (_name: string, text: string) => text, fg: (_name: string, text: string) => text } as unknown as Theme;

function makeEditor(options: Partial<PiVimKeysConfig> = { keybinds: { 'ctrl+w': 'pi.vimKeys.altScreenMode' } }, fullscreen = true) {
  const config = new ConfigLoader();
  const internals = config as unknown as { config: PiVimKeysConfig; initializeAppKeybindingMaps(): void };
  internals.config = PiVimKeysConfigSchema.parse(options);
  internals.initializeAppKeybindingMaps();
  const methods = {
    terminal: { rows: 25, columns: 80, write: mock((_text: string) => {}) },
    getShowHardwareCursor: () => true,
    requestRender: mock(() => {}),
    scrollBy: mock((_n: number) => {}),
    scrollToTop: mock(() => {}),
    scrollToBottom: mock(() => {}),
    toggleSearch: mock(() => {}),
    getPrimaryScrollView: mock(() => ({ viewportHeight: 15 })),
  };
  const tui = Object.assign(Object.create(fullscreen ? TuiAltScreen.prototype : Object.prototype), methods) as typeof methods;
  const keybindings = new KeybindingsManager(TUI_KEYBINDINGS);
  setKeybindings(keybindings);
  const emitEvent = mock(() => {});
  const editor = new VimModalEditor(tui as unknown as TUI, editorTheme, keybindings as unknown as ConstructorParameters<typeof VimModalEditor>[2], {
    config,
    getTheme: () => theme,
    emitEvent,
  });
  editor.setText('unchanged buffer');
  editor.focused = true;
  return { editor, tui, emitEvent };
}

function inAltScreen(editor: VimModalEditor): boolean {
  return editor.modeLabel.includes('ALT-S');
}

describe('alt-screen mode', () => {
  it('does not enter with ctrl+w when no binding is configured', () => {
    const { editor, emitEvent } = makeEditor({});
    editor.handleInput('\x17');
    expect(inAltScreen(editor)).toBe(false);
    expect(editor.modeLabel).toBe(' NORMAL ');
    expect(editor.getText()).toBe('unchanged buffer');
    expect(emitEvent).not.toHaveBeenCalled();
  });

  it('enters with the ctrl+w editor binding and never emits an event', () => {
    const { editor, tui, emitEvent } = makeEditor();
    editor.handleInput('\x17');
    expect(inAltScreen(editor)).toBe(true);
    expect(editor.modeLabel).toBe(' ALT-S ');
    expect(editor.config.getModeColors('altScreen')).toBe('#ED7892');
    expect(tui.terminal.write.mock.calls).toEqual([['\x1b[2 q']]);
    expect(emitEvent).not.toHaveBeenCalled();
  });

  it('enters with a configured modifier binding instead of ctrl+w', () => {
    const { editor, emitEvent } = makeEditor({ keybinds: { 'alt+s': 'pi.vimKeys.altScreenMode' } });
    editor.handleInput('\x17');
    expect(inAltScreen(editor)).toBe(false);
    editor.handleInput('\x1bs');
    expect(inAltScreen(editor)).toBe(true);
    expect(emitEvent).not.toHaveBeenCalled();
  });

  it('enters with a configured leader binding and never emits an event', () => {
    const { editor, emitEvent } = makeEditor({ keybinds: { '<leader>s': 'pi.vimKeys.altScreenMode' } });
    editor.handleInput(' ');
    editor.handleInput('s');
    expect(inAltScreen(editor)).toBe(true);
    expect(emitEvent).not.toHaveBeenCalled();
    expect(editor.modeLabel).toBe(' ALT-S ');
  });

  it('keeps existing app and external-event bindings working', () => {
    const { editor, emitEvent } = makeEditor({ keybinds: { 'ctrl+w': 'app.model.select', 'alt+s': 'pi.vimKeys.event:x' } });
    const action = mock(() => {});
    editor.actionHandlers.set('app.model.select', action);
    editor.handleInput('\x17');
    expect(action).toHaveBeenCalledTimes(1);
    expect(inAltScreen(editor)).toBe(false);
    editor.handleInput('\x1bs');
    expect(emitEvent).toHaveBeenCalledWith('pi.vimKeys.event:x', '');
    expect(inAltScreen(editor)).toBe(false);
  });

  it('consumes the editor binding outside fullscreen without editing or emitting an event', () => {
    const { editor, emitEvent } = makeEditor({ keybinds: { 'ctrl+w': 'pi.vimKeys.altScreenMode' } }, false);
    editor.handleInput('\x17');
    expect(inAltScreen(editor)).toBe(false);
    expect(editor.modeLabel).toBe(' NORMAL ');
    expect(editor.getText()).toBe('unchanged buffer');
    expect(emitEvent).not.toHaveBeenCalled();
  });

  for (const [key, label] of [
    ['i', 'INSERT'],
    ['v', 'VISUAL'],
    ['V', 'V-LINE'],
    ['R', 'REPLACE'],
  ] as const) {
    it(`does not enter from ${label}`, () => {
      const { editor } = makeEditor();
      editor.handleInput(key);
      editor.handleInput('\x17');
      expect(inAltScreen(editor)).toBe(false);
      expect(editor.modeLabel).toContain(label);
    });
  }

  it('dispatches transcript navigation and search without editing or moving the cursor', () => {
    const { editor, tui } = makeEditor();
    const cursor = editor.getCursor();
    editor.handleInput('\x17');
    for (const key of ['j', 'k', 'd', 'u', 'G', 'g', 'g', ' ', '/']) editor.handleInput(key);
    expect(tui.scrollBy.mock.calls).toEqual([[1], [-1], [7], [-7]]);
    expect(tui.scrollToTop).toHaveBeenCalledTimes(1);
    expect(tui.scrollToBottom).toHaveBeenCalledTimes(1);
    expect(tui.toggleSearch).toHaveBeenCalledTimes(1);
    expect(editor.getText()).toBe('unchanged buffer');
    expect(editor.getCursor()).toEqual(cursor);
    expect(inAltScreen(editor)).toBe(true);
    expect(editor.modeLabel).toBe(' ALT-S ');
  });

  it('renders pending keys and clears them on exit and re-entry', () => {
    const { editor, tui } = makeEditor();
    editor.handleInput('\x17');
    editor.handleInput('g');
    expect(editor.modeLabel).toBe(' ALT-S g_ ');
    editor.handleInput('\x1b');
    expect(editor.modeLabel).toBe(' NORMAL ');
    editor.handleInput('\x17');
    editor.handleInput('g');
    expect(tui.scrollToTop).not.toHaveBeenCalled();
    editor.handleInput('i');
    expect(editor.modeLabel).toBe(' INSERT ');
    expect(editor.getText()).toBe('unchanged buffer');
  });

  for (const [key, label] of [
    ['\x1b', 'NORMAL'],
    ['i', 'INSERT'],
  ] as const) {
    it(`exits to ${label} without scrolling or changing the buffer`, () => {
      const { editor, tui } = makeEditor();
      editor.handleInput('\x17');
      editor.handleInput(key);
      expect(editor.modeLabel).toContain(label);
      expect(inAltScreen(editor)).toBe(false);
      expect(editor.getText()).toBe('unchanged buffer');
      expect(tui.scrollBy).not.toHaveBeenCalled();
    });
  }

  it('swallows edits, modifiers, and configured app actions', () => {
    const { editor, emitEvent } = makeEditor({ keybinds: { 'ctrl+w': 'pi.vimKeys.altScreenMode', 'ctrl+x': 'pi.vimKeys.event:x' } });
    const cursor = editor.getCursor();
    editor.handleInput('\x17');
    for (const key of ['x', '\x18', '\r', 'v', 'R']) editor.handleInput(key);
    expect(inAltScreen(editor)).toBe(true);
    expect(editor.getText()).toBe('unchanged buffer');
    expect(editor.getCursor()).toEqual(cursor);
    expect(emitEvent).not.toHaveBeenCalled();
  });

  it('drops to normal and handles the next key when the renderer leaves fullscreen', () => {
    const { editor, tui } = makeEditor();
    editor.handleInput('\x17');
    editor.handleInput('g');
    Object.setPrototypeOf(tui, Object.prototype);
    editor.handleInput('i');
    expect(editor.modeLabel).toBe(' INSERT ');
    expect(editor.getText()).toBe('unchanged buffer');
    expect(tui.scrollToTop).not.toHaveBeenCalled();
  });
});
