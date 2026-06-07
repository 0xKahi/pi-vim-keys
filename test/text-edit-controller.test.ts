import { describe, expect, it } from 'bun:test';
import { Editor, type EditorTheme, TUI } from '@earendil-works/pi-tui';
import type { EditorAnchoredRange } from '../src/editor/editor-compass-controller';
import { TextEditController } from '../src/editor/text-edit-controller';

const EDITOR_THEME: EditorTheme = {
  borderColor: (str: string) => str,
  selectList: {} as EditorTheme['selectList'],
};

function makeEditor(text: string): Editor {
  const terminal = { rows: 30, columns: 200, write() {}, on() {}, off() {} };
  const tui = new TUI(terminal as unknown as ConstructorParameters<typeof TUI>[0], false);
  const editor = new Editor(tui, EDITOR_THEME);
  editor.setText(text);
  return editor;
}

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
