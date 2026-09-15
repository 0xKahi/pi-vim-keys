import { describe, expect, it } from 'bun:test';
import type { Theme } from '@earendil-works/pi-coding-agent';
import { type EditorTheme, KeybindingsManager, setKeybindings, TUI_KEYBINDINGS, TuiMainScreen } from '@earendil-works/pi-tui';
import { ConfigLoader } from '../src/config-loader';
import { getEditorInternals } from '../src/editor/types';
import { VimModalEditor } from '../src/vim-modal-editor';

const editorTheme: EditorTheme = {
  borderColor: (text: string) => text,
  selectList: {
    selectedPrefix: text => text,
    selectedText: text => text,
    description: text => text,
    scrollInfo: text => text,
    noMatch: text => text,
  },
};
const theme = { bg: (_name: string, text: string) => text } as unknown as Theme;

function makeEditor(text = 'one\ntwo\nthree') {
  const terminal = { rows: 8, columns: 120, write() {}, on() {}, off() {}, hideCursor() {}, showCursor() {} };
  const tui = new TuiMainScreen(terminal as unknown as ConstructorParameters<typeof TuiMainScreen>[0], false);
  const keybindings = new KeybindingsManager(TUI_KEYBINDINGS);
  setKeybindings(keybindings);
  const editor = new VimModalEditor(tui, editorTheme, keybindings as unknown as ConstructorParameters<typeof VimModalEditor>[2], {
    config: new ConfigLoader(),
    getTheme: () => theme,
    emitEvent: () => {},
  });
  editor.setText(text);
  editor.focused = true;
  return { editor, tui };
}

function setCursor(editor: VimModalEditor, line: number, col: number): void {
  const state = getEditorInternals(editor).state;
  if (!state) throw new Error('missing editor state');
  state.cursorLine = line;
  state.cursorCol = col;
}

describe('single-character replace operator (r)', () => {
  it('replaces a character mid-line and keeps the cursor on the replaced position', () => {
    const { editor } = makeEditor('abcde');
    setCursor(editor, 0, 2);

    editor.handleInput('r');
    editor.handleInput('X');

    expect(editor.getText()).toBe('abXde');
    expect(editor.getCursor()).toEqual({ line: 0, col: 2 });
    expect(editor.modeLabel).toContain('NORMAL');
  });

  it('does not fall through to the single-key dispatch for the replacement char', () => {
    const { editor } = makeEditor('abcde');
    setCursor(editor, 0, 2);

    // 'x' is also the normal-mode delete command; the operator must consume it.
    editor.handleInput('r');
    editor.handleInput('x');

    expect(editor.getText()).toBe('abxde');
    expect(editor.modeLabel).toContain('NORMAL');
  });

  it('replaces with a literal space when the space key is pressed', () => {
    const { editor } = makeEditor('abcde');
    setCursor(editor, 0, 1);

    editor.handleInput('r');
    editor.handleInput(' ');

    expect(editor.getText()).toBe('a cde');
    expect(editor.getCursor()).toEqual({ line: 0, col: 1 });
  });

  it('is a no-op on an empty line without pasting the register through', () => {
    const { editor } = makeEditor('a');
    setCursor(editor, 0, 0);
    editor.handleInput('x'); // deletes 'a', populates the register, leaves an empty line
    expect(editor.getText()).toBe('');
    setCursor(editor, 0, 0);

    editor.handleInput('r');
    editor.handleInput('p'); // 'p' would paste if the operator fell through

    expect(editor.getText()).toBe('');
    expect(editor.modeLabel).toContain('NORMAL');
  });

  it('undoes a replacement as a single edit, restoring the buffer and cursor', () => {
    const { editor } = makeEditor('abcde');
    setCursor(editor, 0, 2);

    editor.handleInput('r');
    editor.handleInput('X');
    expect(editor.getText()).toBe('abXde');

    editor.handleInput('u');
    expect(editor.getText()).toBe('abcde');
    expect(editor.getCursor()).toEqual({ line: 0, col: 2 });
  });

  it('cancels on escape, leaving the buffer unchanged and creating no undo entry', () => {
    const { editor } = makeEditor('abcde');
    setCursor(editor, 0, 0);
    editor.handleInput('x'); // 'bcde' with a real undo entry
    expect(editor.getText()).toBe('bcde');

    setCursor(editor, 0, 1);
    editor.handleInput('r');
    editor.handleInput('\x1b');
    expect(editor.getText()).toBe('bcde');
    expect(editor.modeLabel).toContain('NORMAL');

    // One undo reverts the earlier delete, proving the cancel added no entry.
    editor.handleInput('u');
    expect(editor.getText()).toBe('abcde');
  });

  it('cancels on a cursor key, leaving the buffer unchanged and creating no undo entry', () => {
    const { editor } = makeEditor('abcde');
    setCursor(editor, 0, 0);
    editor.handleInput('x'); // 'bcde'
    expect(editor.getText()).toBe('bcde');

    setCursor(editor, 0, 1);
    editor.handleInput('r');
    editor.handleInput('\x1b[C'); // right arrow
    expect(editor.getText()).toBe('bcde');

    editor.handleInput('u');
    expect(editor.getText()).toBe('abcde');
  });
});

describe('replace mode entry and exit (R)', () => {
  it('enters replace mode from normal mode without changing the buffer', () => {
    const { editor } = makeEditor('abcde');
    expect(editor.modeLabel).toContain('NORMAL');

    editor.handleInput('R');

    expect(editor.modeLabel).toContain('REPLACE');
    expect(editor.getText()).toBe('abcde');
  });

  it('is not reachable from insert mode and types a literal R instead', () => {
    const { editor } = makeEditor('abc');
    setCursor(editor, 0, 0);
    editor.handleInput('i');

    editor.handleInput('R');

    expect(editor.modeLabel).toContain('INSERT');
    expect(editor.getText()).toBe('Rabc');
  });

  it('is inert in visual mode', () => {
    const { editor } = makeEditor('abc');
    editor.handleInput('v');

    editor.handleInput('R');

    expect(editor.modeLabel).toContain('VISUAL');
    expect(editor.modeLabel).not.toContain('REPLACE');
    expect(editor.getText()).toBe('abc');
  });

  it('is inert in visual-line mode', () => {
    const { editor } = makeEditor('abc');
    editor.handleInput('V');

    editor.handleInput('R');

    expect(editor.modeLabel).toContain('V-LINE');
    expect(editor.modeLabel).not.toContain('REPLACE');
    expect(editor.getText()).toBe('abc');
  });

  it('leaves replace mode on escape, moving the cursor one position left', () => {
    const { editor } = makeEditor('abcde');
    setCursor(editor, 0, 2);
    editor.handleInput('R');
    editor.handleInput('X');
    editor.handleInput('X');
    expect(editor.getCursor()).toEqual({ line: 0, col: 4 });

    editor.handleInput('\x1b');

    expect(editor.modeLabel).toContain('NORMAL');
    expect(editor.getCursor()).toEqual({ line: 0, col: 3 });
  });

  it('does not move the cursor left on escape at the start of the line', () => {
    const { editor } = makeEditor('abcde');
    setCursor(editor, 0, 0);
    editor.handleInput('R');

    editor.handleInput('\x1b');

    expect(editor.getCursor()).toEqual({ line: 0, col: 0 });
  });
});

describe('overtyping in replace mode', () => {
  it('overwrites an existing run without shifting the rest of the line', () => {
    const { editor } = makeEditor('abcde');
    setCursor(editor, 0, 1);
    editor.handleInput('R');

    editor.handleInput('X');
    editor.handleInput('Y');

    expect(editor.getText()).toBe('aXYde');
    expect(editor.getCursor()).toEqual({ line: 0, col: 3 });
    expect(editor.modeLabel).toContain('REPLACE');
  });

  it('appends past the end of the line and grows it', () => {
    const { editor } = makeEditor('ab');
    setCursor(editor, 0, 2);
    editor.handleInput('R');

    editor.handleInput('x');
    editor.handleInput('y');

    expect(editor.getText()).toBe('abxy');
    expect(editor.getCursor()).toEqual({ line: 0, col: 4 });
  });

  it('overwrites with a space and advances the cursor', () => {
    const { editor } = makeEditor('abc');
    setCursor(editor, 0, 1);
    editor.handleInput('R');

    editor.handleInput(' ');

    expect(editor.getText()).toBe('a c');
    expect(editor.getCursor()).toEqual({ line: 0, col: 2 });
  });

  it('ignores enter without inserting a line break', () => {
    const { editor } = makeEditor('abc');
    setCursor(editor, 0, 1);
    editor.handleInput('R');

    editor.handleInput('\r');

    expect(editor.getText()).toBe('abc');
    expect(editor.getCursor()).toEqual({ line: 0, col: 1 });
    expect(editor.modeLabel).toContain('REPLACE');
  });

  it('ignores cursor keys, function keys, and modified combinations', () => {
    const { editor } = makeEditor('abc');
    setCursor(editor, 0, 1);
    editor.handleInput('R');
    editor.handleInput('X');
    const text = editor.getText();
    const cursor = editor.getCursor();

    editor.handleInput('\x1b[C'); // right
    editor.handleInput('\x1bOP'); // f1
    editor.handleInput('\x01'); // ctrl+a
    editor.handleInput('\t'); // tab

    expect(editor.getText()).toBe(text);
    expect(editor.getCursor()).toEqual(cursor);
    expect(editor.modeLabel).toContain('REPLACE');
  });
});

describe('backspace restore in replace mode', () => {
  it('restores a partially overtyped run from the original line', () => {
    const { editor } = makeEditor('abcde');
    setCursor(editor, 0, 0);
    editor.handleInput('R');
    editor.handleInput('X');
    editor.handleInput('Y');
    expect(editor.getText()).toBe('XYcde');

    editor.handleInput('\x7f');

    expect(editor.getText()).toBe('Xbcde');
    expect(editor.getCursor()).toEqual({ line: 0, col: 1 });
  });

  it('restores a full overtyped run back to the entry state', () => {
    const { editor } = makeEditor('abcde');
    setCursor(editor, 0, 0);
    editor.handleInput('R');
    editor.handleInput('X');
    editor.handleInput('Y');

    editor.handleInput('\x7f');
    editor.handleInput('\x7f');

    expect(editor.getText()).toBe('abcde');
    expect(editor.getCursor()).toEqual({ line: 0, col: 0 });
  });

  it('moves the cursor left without deleting when at or before the entry column', () => {
    const { editor } = makeEditor('abcdef');
    setCursor(editor, 0, 2);
    editor.handleInput('R');

    editor.handleInput('\x7f');
    expect(editor.getText()).toBe('abcdef');
    expect(editor.getCursor()).toEqual({ line: 0, col: 1 });

    editor.handleInput('\x7f');
    expect(editor.getText()).toBe('abcdef');
    expect(editor.getCursor()).toEqual({ line: 0, col: 0 });
  });

  it('removes characters appended past the original end of line', () => {
    const { editor } = makeEditor('ab');
    setCursor(editor, 0, 2);
    editor.handleInput('R');
    editor.handleInput('x');
    editor.handleInput('y');
    expect(editor.getText()).toBe('abxy');

    editor.handleInput('\x7f');

    expect(editor.getText()).toBe('abx');
    expect(editor.getCursor()).toEqual({ line: 0, col: 3 });
  });
});

describe('replace mode session undo integration', () => {
  it('reverts an entire overtyped run with a single undo, restoring buffer and cursor', () => {
    const { editor } = makeEditor('abcde');
    setCursor(editor, 0, 1);
    editor.handleInput('R');
    editor.handleInput('X');
    editor.handleInput('Y');
    editor.handleInput('Z');
    editor.handleInput('\x1b');
    expect(editor.getText()).toBe('aXYZe');

    editor.handleInput('u');

    expect(editor.getText()).toBe('abcde');
    expect(editor.getCursor()).toEqual({ line: 0, col: 1 });
  });

  it('treats an empty session as a no-op and preserves redo history', () => {
    const { editor } = makeEditor('abcde');
    setCursor(editor, 0, 0);
    editor.handleInput('x'); // 'bcde'
    editor.handleInput('u'); // 'abcde'
    expect(editor.getText()).toBe('abcde');

    editor.handleInput('R');
    editor.handleInput('\x1b');
    expect(editor.getText()).toBe('abcde');

    editor.handleInput('U'); // redo the earlier delete
    expect(editor.getText()).toBe('bcde');
  });

  it('invalidates redo history once a replace session mutates the buffer', () => {
    const { editor } = makeEditor('abcde');
    setCursor(editor, 0, 0);
    editor.handleInput('x'); // 'bcde'
    editor.handleInput('u'); // 'abcde'

    editor.handleInput('R');
    editor.handleInput('Z'); // overwrites 'a'
    editor.handleInput('\x1b');
    expect(editor.getText()).toBe('Zbcde');

    editor.handleInput('U'); // redo must not reapply the undone delete
    expect(editor.getText()).toBe('Zbcde');

    editor.handleInput('u'); // one undo restores the pre-session state
    expect(editor.getText()).toBe('abcde');
  });
});
