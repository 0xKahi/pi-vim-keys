import { describe, expect, it } from 'bun:test';
import { Editor, type EditorTheme, TUI } from '@earendil-works/pi-tui';
import { getEditorInternals } from '../src/editor/types';

/**
 * The one drift tripwire for Pi's Editor internals.
 *
 * Every editor component reaches into Pi's private state through EditorInternals
 * (src/editor/types.ts). Those fields are `private` in pi-tui, so TypeScript
 * can't verify them structurally — this test does it at runtime against a REAL
 * Editor. If a pi-tui upgrade renames or removes any field/method we depend on,
 * exactly one test fails and the fix lives in exactly one type.
 */

const EDITOR_THEME: EditorTheme = {
  borderColor: (str: string) => str,
  selectList: {} as EditorTheme['selectList'],
};

function makeEditor(): Editor {
  const terminal = { rows: 30, columns: 120, write() {}, on() {}, off() {}, hideCursor() {}, showCursor() {} };
  const tui = new TUI(terminal as unknown as ConstructorParameters<typeof TUI>[0], false);
  const editor = new Editor(tui, EDITOR_THEME, { paddingX: 1 });
  // Initialize lazily-set fields (scrollOffset/lastWidth) the way production does.
  editor.setText('hello world\nsecond line');
  editor.render(40);
  return editor;
}

describe('EditorInternals matches pi-tui Editor', () => {
  it('exposes the text buffer + cursor state', () => {
    const internals = getEditorInternals(makeEditor());

    expect(internals.state).toBeDefined();
    expect(Array.isArray(internals.state?.lines)).toBe(true);
    expect(typeof internals.state?.cursorLine).toBe('number');
    expect(typeof internals.state?.cursorCol).toBe('number');
  });

  it('exposes render/layout state', () => {
    const editor = makeEditor();
    const internals = getEditorInternals(editor);

    expect(typeof internals.focused).toBe('boolean');
    expect(typeof internals.scrollOffset).toBe('number');
    expect(typeof internals.lastWidth).toBe('number');
  });

  it('exposes cursor bookkeeping fields (present, may be null)', () => {
    const editor = makeEditor();

    // null-initialised in Pi, so assert presence rather than a concrete type.
    for (const field of ['preferredVisualCol', 'snappedFromCursorCol', 'lastAction', 'onChange'] as const) {
      expect(field in editor).toBe(true);
    }
  });

  it('exposes history / undo internals', () => {
    const internals = getEditorInternals(makeEditor());

    expect(typeof internals.historyIndex).toBe('number');
    expect(typeof internals.undoStack?.push).toBe('function');
    expect(typeof internals.undoStack?.pop).toBe('function');
    expect(typeof internals.pushUndoSnapshot).toBe('function');
    expect(typeof internals.cancelAutocomplete).toBe('function');
  });

  it('exposes helper methods + host', () => {
    const internals = getEditorInternals(makeEditor());

    expect(typeof internals.moveCursor).toBe('function');
    expect(typeof internals.segment).toBe('function');
    expect(typeof internals.tui?.requestRender).toBe('function');
    expect(typeof internals.tui?.getShowHardwareCursor).toBe('function');
  });
});
