import { describe, expect, it } from 'bun:test';
import { Editor, type EditorTheme, TUI } from '@earendil-works/pi-tui';
import type { EditorAnchoredRange } from '../src/editor/editor-compass-controller';
import { TextEditController } from '../src/editor/text-edit-controller';
import { getEditorInternals } from '../src/editor/types';

const EDITOR_THEME: EditorTheme = {
  borderColor: (str: string) => str,
  selectList: {} as EditorTheme['selectList'],
};

function makeEditor(text: string): Editor {
  const terminal = { rows: 30, columns: 200, write() {}, on() {}, off() {}, hideCursor() {}, showCursor() {} };
  const tui = new TUI(terminal as unknown as ConstructorParameters<typeof TUI>[0], false);
  const editor = new Editor(tui, EDITOR_THEME);
  editor.setText(text);
  return editor;
}

function setCursor(editor: Editor, line: number, col: number): void {
  const state = getEditorInternals(editor).state;
  if (!state) throw new Error('missing editor state');
  state.cursorLine = line;
  state.cursorCol = col;
}

describe('TextEditController.paste', () => {
  it('returns false when the register is empty', () => {
    const editor = makeEditor('abc');

    expect(new TextEditController(editor).paste()).toBe(false);
    expect(editor.getText()).toBe('abc');
  });

  it('pastes characterwise from the internal register', () => {
    const editor = makeEditor('abc');
    const textEdit = new TextEditController(editor);
    setCursor(editor, 0, 1);

    expect(textEdit.delete('forward', { saveToRegister: true })).toBe(true);
    expect(editor.getText()).toBe('ac');
    expect(textEdit.paste('before')).toBe(true);

    expect(editor.getText()).toBe('abc');
    expect(editor.getCursor()).toEqual({ line: 0, col: 1 });
  });

  it('pastes linewise from the internal register', () => {
    const editor = makeEditor('one\ntwo\nthree');
    const textEdit = new TextEditController(editor);
    setCursor(editor, 1, 0);

    expect(textEdit.deleteLine()).toBe(true);
    expect(editor.getText()).toBe('one\nthree');
    expect(textEdit.paste('after')).toBe(true);

    expect(editor.getText()).toBe('one\nthree\ntwo');
    expect(editor.getCursor()).toEqual({ line: 2, col: 0 });
  });
});

describe('TextEditController.deleteRange', () => {
  it('deletes visual-line ranges as whole logical lines', () => {
    const editor = makeEditor('one\ntwo\nthree\nfour');
    const range: EditorAnchoredRange = {
      type: 'line',
      anchor: { line: 1, col: 0 },
      cursor: { line: 2, col: 0 },
      start: { line: 1, col: 0 },
      end: { line: 2, col: 5 },
      ranges: [
        { line: 1, startCol: 0, endCol: 3 },
        { line: 2, startCol: 0, endCol: 5 },
      ],
    };

    expect(new TextEditController(editor).deleteRange(range)).toBe(true);
    expect(editor.getText()).toBe('one\nfour');
    expect(editor.getCursor()).toEqual({ line: 1, col: 0 });
  });

  it('keeps one empty line when a visual-line range deletes the whole buffer', () => {
    const editor = makeEditor('one\ntwo');
    const range: EditorAnchoredRange = {
      type: 'line',
      anchor: { line: 0, col: 0 },
      cursor: { line: 1, col: 0 },
      start: { line: 0, col: 0 },
      end: { line: 1, col: 3 },
      ranges: [
        { line: 0, startCol: 0, endCol: 3 },
        { line: 1, startCol: 0, endCol: 3 },
      ],
    };

    expect(new TextEditController(editor).deleteRange(range)).toBe(true);
    expect(editor.getText()).toBe('');
    expect(editor.getCursor()).toEqual({ line: 0, col: 0 });
  });

  it('deletes cursor visual ranges and joins remaining text', () => {
    const editor = makeEditor('alpha\nbravo\ncharlie');
    const range: EditorAnchoredRange = {
      type: 'cursor',
      anchor: { line: 0, col: 2 },
      cursor: { line: 2, col: 2 },
      start: { line: 0, col: 2 },
      end: { line: 2, col: 3 },
      ranges: [
        { line: 0, startCol: 2, endCol: 5 },
        { line: 1, startCol: 0, endCol: 5 },
        { line: 2, startCol: 0, endCol: 3 },
      ],
    };

    expect(new TextEditController(editor).deleteRange(range)).toBe(true);
    expect(editor.getText()).toBe('alrlie');
    expect(editor.getCursor()).toEqual({ line: 0, col: 2 });
  });
});
