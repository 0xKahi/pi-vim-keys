import { describe, expect, it } from 'bun:test';
import { Editor, type EditorTheme, TuiMainScreen } from '@earendil-works/pi-tui';
import { TextEditController } from '../src/editor/text-edit-controller';
import { getEditorInternals } from '../src/editor/types';

const EDITOR_THEME: EditorTheme = {
  borderColor: (str: string) => str,
  selectList: {} as EditorTheme['selectList'],
};

function makeEditor(text = ''): Editor {
  const terminal = { rows: 30, columns: 200, write() {}, on() {}, off() {}, hideCursor() {}, showCursor() {} };
  const tui = new TuiMainScreen(terminal as unknown as ConstructorParameters<typeof TuiMainScreen>[0], false);
  const editor = new Editor(tui, EDITOR_THEME);
  editor.setText(text);
  return editor;
}

function makeController(editor: Editor): TextEditController {
  return new TextEditController(editor, {
    isFocused: () => editor.focused,
    notifyChange: () => {},
    requestRender: () => {},
    isHardwareCursorEnabled: () => false,
  });
}

function paste(editor: Editor, text: string): void {
  editor.handleInput(`\x1b[200~${text}\x1b[201~`);
}

const firstPaste = Array.from({ length: 12 }, (_, index) => `first paste line ${index}`).join('\n');
const secondPaste = Array.from({ length: 12 }, (_, index) => `second paste line ${index}`).join('\n');

describe('paste-aware undo and redo', () => {
  it('undoes a large multiline paste completely', () => {
    const editor = makeEditor('before');
    const controller = makeController(editor);
    const beforeCursor = editor.getCursor();
    paste(editor, firstPaste);
    const pastedText = editor.getText();
    const pastedCursor = editor.getCursor();

    expect(pastedText).toContain('[paste #');
    expect(editor.getExpandedText()).toContain(firstPaste);
    expect(controller.undo()).toBe(true);
    expect(editor.getText()).toBe('before');
    expect(editor.getCursor()).toEqual(beforeCursor);
    expect(editor.getExpandedText()).not.toContain(firstPaste);
    expect(controller.redo()).toBe(true);
    expect(editor.getText()).toBe(pastedText);
    expect(editor.getCursor()).toEqual(pastedCursor);
    expect(editor.getExpandedText()).toContain(firstPaste);
  });

  it('keeps two paste states isolated while traversing history', () => {
    const editor = makeEditor('start');
    const controller = makeController(editor);
    paste(editor, firstPaste);
    const firstBuffer = editor.getText();
    paste(editor, secondPaste);
    const bothExpanded = editor.getExpandedText();

    expect(bothExpanded).toContain(firstPaste);
    expect(bothExpanded).toContain(secondPaste);
    expect(controller.undo()).toBe(true);
    expect(editor.getExpandedText()).toContain(firstPaste);
    expect(editor.getExpandedText()).not.toContain(secondPaste);
    expect(controller.undo()).toBe(true);
    expect(editor.getExpandedText()).not.toContain(firstPaste);
    expect(editor.getText()).toBe('start');
    expect(controller.redo()).toBe(true);
    expect(editor.getText()).toBe(firstBuffer);
    expect(editor.getExpandedText()).toContain(firstPaste);
    expect(controller.redo()).toBe(true);
    expect(editor.getExpandedText()).toBe(bothExpanded);
  });

  it('survives repeated paste undo and redo cycles', () => {
    const editor = makeEditor('start');
    const controller = makeController(editor);
    paste(editor, firstPaste);
    const expected = { text: editor.getText(), expanded: editor.getExpandedText(), cursor: editor.getCursor() };

    for (let cycle = 0; cycle < 3; cycle++) {
      expect(controller.undo()).toBe(true);
      expect(editor.getText()).toBe('start');
      expect(controller.redo()).toBe(true);
      expect({ text: editor.getText(), expanded: editor.getExpandedText(), cursor: editor.getCursor() }).toEqual(expected);
    }
  });

  it('makes a paste after undo independent', () => {
    const editor = makeEditor('start');
    const controller = makeController(editor);
    paste(editor, firstPaste);
    expect(controller.undo()).toBe(true);
    paste(editor, secondPaste);
    expect(editor.getExpandedText()).toContain(secondPaste);
    expect(editor.getExpandedText()).not.toContain(firstPaste);
    expect(controller.undo()).toBe(true);
    expect(editor.getText()).toBe('start');
  });

  it('makes a paste after redo independent and preserves both contents', () => {
    const editor = makeEditor('start');
    const controller = makeController(editor);
    paste(editor, firstPaste);
    expect(controller.undo()).toBe(true);
    expect(controller.redo()).toBe(true);
    paste(editor, secondPaste);
    expect(editor.getExpandedText()).toContain(firstPaste);
    expect(editor.getExpandedText()).toContain(secondPaste);
  });

  it('retains plain-text undo redo and invalidates redo after a new edit', () => {
    const editor = makeEditor('abc');
    const controller = makeController(editor);
    const state = getEditorInternals(editor).state;
    if (!state) throw new Error('missing editor state');
    state.cursorCol = 0;
    expect(controller.delete('forward')).toBe(true);
    expect(editor.getText()).toBe('bc');
    expect(controller.undo()).toBe(true);
    expect(editor.getText()).toBe('abc');
    expect(controller.redo()).toBe(true);
    expect(editor.getText()).toBe('bc');
    expect(controller.undo()).toBe(true);
    expect(controller.delete('forward')).toBe(true);
    expect(controller.redo()).toBe(false);
  });
});
