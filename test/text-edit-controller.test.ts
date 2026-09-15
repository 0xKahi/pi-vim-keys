import { describe, expect, it } from 'bun:test';
import { Editor, type EditorTheme, TuiMainScreen } from '@earendil-works/pi-tui';
import type { EditorAnchoredRange } from '../src/editor/editor-compass-controller';
import { TextEditController } from '../src/editor/text-edit-controller';
import { getEditorInternals } from '../src/editor/types';

const EDITOR_THEME: EditorTheme = {
  borderColor: (str: string) => str,
  selectList: {} as EditorTheme['selectList'],
};

function makeEditor(text: string): Editor {
  const terminal = { rows: 30, columns: 200, write() {}, on() {}, off() {}, hideCursor() {}, showCursor() {} };
  const tui = new TuiMainScreen(terminal as unknown as ConstructorParameters<typeof TuiMainScreen>[0], false);
  const editor = new Editor(tui, EDITOR_THEME);
  editor.setText(text);
  return editor;
}

function host(editor: Editor) {
  return {
    isFocused: () => editor.focused,
    notifyChange: () => {},
    requestRender: () => {},
    isHardwareCursorEnabled: () => false,
  };
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

    expect(new TextEditController(editor, host(editor)).paste('forward')).toBe(false);
    expect(editor.getText()).toBe('abc');
  });

  it('pastes characterwise from the internal register', () => {
    const editor = makeEditor('abc');
    const textEdit = new TextEditController(editor, host(editor));
    setCursor(editor, 0, 1);

    expect(textEdit.delete('forward', { saveToRegister: true })).toBe(true);
    expect(editor.getText()).toBe('ac');
    expect(textEdit.paste('backward')).toBe(true);

    expect(editor.getText()).toBe('abc');
    expect(editor.getCursor()).toEqual({ line: 0, col: 1 });
  });

  it('pastes linewise from the internal register', () => {
    const editor = makeEditor('one\ntwo\nthree');
    const textEdit = new TextEditController(editor, host(editor));
    setCursor(editor, 1, 0);

    expect(textEdit.deleteLine()).toBe(true);
    expect(editor.getText()).toBe('one\nthree');
    expect(textEdit.paste('forward')).toBe(true);

    expect(editor.getText()).toBe('one\nthree\ntwo');
    expect(editor.getCursor()).toEqual({ line: 2, col: 0 });
  });
});

describe('TextEditController.surround', () => {
  function selection(startCol: number, endCol: number): EditorAnchoredRange {
    return {
      type: 'cursor',
      anchor: { line: 0, col: startCol },
      cursor: { line: 0, col: endCol },
      start: { line: 0, col: startCol },
      end: { line: 0, col: endCol },
      ranges: [{ line: 0, startCol, endCol }],
    };
  }

  it('returns false when the range is undefined', () => {
    const editor = makeEditor('a brown fox jumps over a lazy dog');

    expect(new TextEditController(editor, host(editor)).surround(undefined, { type: 'around', open: '<', close: '>' })).toBe(false);
  });

  it('wraps the whole selection when type is around', () => {
    const editor = makeEditor('a brown fox jumps over a lazy dog');
    const range = selection(12, 22);

    expect(new TextEditController(editor, host(editor)).surround(range, { type: 'around', open: '<', close: '>' })).toBe(true);
    expect(editor.getText()).toBe('a brown fox <jumps over> a lazy dog');
    expect(editor.getCursor()).toEqual({ line: 0, col: 12 });
  });

  it('wraps the interior when type is inside', () => {
    const editor = makeEditor('a brown fox jumps over a lazy dog');
    const range = selection(12, 22);

    expect(new TextEditController(editor, host(editor)).surround(range, { type: 'inside', open: '<', close: '>' })).toBe(true);
    expect(editor.getText()).toBe('a brown fox j<umps ove>r a lazy dog');
    expect(editor.getCursor()).toEqual({ line: 0, col: 13 });
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

    expect(new TextEditController(editor, host(editor)).deleteRange(range)).toBe(true);
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

    expect(new TextEditController(editor, host(editor)).deleteRange(range)).toBe(true);
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

    expect(new TextEditController(editor, host(editor)).deleteRange(range)).toBe(true);
    expect(editor.getText()).toBe('alrlie');
    expect(editor.getCursor()).toEqual({ line: 0, col: 2 });
  });
});

describe('TextEditController.replaceAtCursor', () => {
  it('replaces the grapheme under the cursor and keeps the cursor in place', () => {
    const editor = makeEditor('abcde');
    const controller = new TextEditController(editor, host(editor));
    setCursor(editor, 0, 2);

    expect(controller.replaceAtCursor('X')).toBe(true);
    expect(editor.getText()).toBe('abXde');
    expect(editor.getCursor()).toEqual({ line: 0, col: 2 });
  });

  it('returns false and mutates nothing at or past the end of the line', () => {
    const editor = makeEditor('abc');
    const controller = new TextEditController(editor, host(editor));

    setCursor(editor, 0, 3);
    expect(controller.replaceAtCursor('X')).toBe(false);
    expect(editor.getText()).toBe('abc');

    setCursor(editor, 0, 8);
    expect(controller.replaceAtCursor('X')).toBe(false);
    expect(editor.getText()).toBe('abc');
  });

  it('returns false on an empty line', () => {
    const editor = makeEditor('');
    const controller = new TextEditController(editor, host(editor));

    expect(controller.replaceAtCursor('X')).toBe(false);
    expect(editor.getText()).toBe('');
  });
});

describe('TextEditController.overwriteAtCursor', () => {
  it('overwrites mid-line without changing the line length and advances the cursor', () => {
    const editor = makeEditor('abcde');
    const controller = new TextEditController(editor, host(editor));
    setCursor(editor, 0, 1);

    expect(controller.overwriteAtCursor('X')).toBe(true);
    expect(editor.getText()).toBe('aXcde');
    expect(editor.getCursor()).toEqual({ line: 0, col: 2 });
  });

  it('appends and grows the line when the cursor is at the end of the line', () => {
    const editor = makeEditor('abc');
    const controller = new TextEditController(editor, host(editor));
    setCursor(editor, 0, 3);

    expect(controller.overwriteAtCursor('X')).toBe(true);
    expect(editor.getText()).toBe('abcX');
    expect(editor.getCursor()).toEqual({ line: 0, col: 4 });
  });
});

describe('TextEditController.restoreFromOriginal', () => {
  it('restores a partially overtyped run from the original line', () => {
    const editor = makeEditor('abcde');
    const controller = new TextEditController(editor, host(editor));
    setCursor(editor, 0, 0);

    controller.beginEditSession();
    expect(controller.overwriteAtCursor('X')).toBe(true);
    expect(controller.overwriteAtCursor('Y')).toBe(true);
    expect(editor.getText()).toBe('XYcde');

    expect(controller.restoreFromOriginal(0, 'abcde')).toBe(true);
    expect(editor.getText()).toBe('Xbcde');
    expect(editor.getCursor()).toEqual({ line: 0, col: 1 });
  });

  it('restores a fully overtyped run back to the exact original content', () => {
    const editor = makeEditor('abcde');
    const controller = new TextEditController(editor, host(editor));
    setCursor(editor, 0, 0);

    controller.beginEditSession();
    expect(controller.overwriteAtCursor('X')).toBe(true);
    expect(controller.overwriteAtCursor('Y')).toBe(true);

    expect(controller.restoreFromOriginal(0, 'abcde')).toBe(true);
    expect(controller.restoreFromOriginal(0, 'abcde')).toBe(true);
    expect(editor.getText()).toBe('abcde');
    expect(editor.getCursor()).toEqual({ line: 0, col: 0 });
  });

  it('moves the cursor left without mutating when at or before the entry column', () => {
    const editor = makeEditor('abcdef');
    const controller = new TextEditController(editor, host(editor));
    setCursor(editor, 0, 2);

    expect(controller.restoreFromOriginal(2, 'abcdef')).toBe(true);
    expect(editor.getText()).toBe('abcdef');
    expect(editor.getCursor()).toEqual({ line: 0, col: 1 });

    expect(controller.restoreFromOriginal(2, 'abcdef')).toBe(true);
    expect(editor.getText()).toBe('abcdef');
    expect(editor.getCursor()).toEqual({ line: 0, col: 0 });

    expect(controller.restoreFromOriginal(2, 'abcdef')).toBe(false);
    expect(editor.getText()).toBe('abcdef');
    expect(editor.getCursor()).toEqual({ line: 0, col: 0 });
  });

  it('removes characters appended past the original end of line', () => {
    const editor = makeEditor('ab');
    const controller = new TextEditController(editor, host(editor));
    setCursor(editor, 0, 2);

    controller.beginEditSession();
    expect(controller.overwriteAtCursor('x')).toBe(true);
    expect(controller.overwriteAtCursor('y')).toBe(true);
    expect(editor.getText()).toBe('abxy');

    expect(controller.restoreFromOriginal(2, 'ab')).toBe(true);
    expect(editor.getText()).toBe('abx');
    expect(editor.getCursor()).toEqual({ line: 0, col: 3 });
  });
});

describe('TextEditController edit sessions', () => {
  it('coalesces several mutations into exactly one undo entry', () => {
    const editor = makeEditor('abc');
    const controller = new TextEditController(editor, host(editor));
    setCursor(editor, 0, 0);

    controller.beginEditSession();
    expect(controller.overwriteAtCursor('x')).toBe(true);
    expect(controller.overwriteAtCursor('y')).toBe(true);
    expect(controller.overwriteAtCursor('z')).toBe(true);
    controller.endEditSession();

    expect(editor.getText()).toBe('xyz');
    expect(controller.hasSessionEdits()).toBe(true);

    expect(controller.undo()).toBe(true);
    expect(editor.getText()).toBe('abc');
    expect(editor.getCursor()).toEqual({ line: 0, col: 0 });
  });

  it('creates no undo entry and preserves redo history for a session with no mutations', () => {
    const editor = makeEditor('abc');
    const controller = new TextEditController(editor, host(editor));
    setCursor(editor, 0, 0);

    expect(controller.delete('forward')).toBe(true);
    expect(editor.getText()).toBe('bc');
    expect(controller.undo()).toBe(true);
    expect(editor.getText()).toBe('abc');

    controller.beginEditSession();
    controller.endEditSession();
    expect(controller.hasSessionEdits()).toBe(false);

    expect(controller.redo()).toBe(true);
    expect(editor.getText()).toBe('bc');
  });
});
