import { describe, expect, it } from 'bun:test';
import { Editor, type EditorTheme, TuiMainScreen } from '@earendil-works/pi-tui';
import { getEditorInternals } from '../src/editor/types';

/**
 * The one drift tripwire for Pi's Editor internals.
 *
 * This tripwire guards ONLY the intentionally retained private surface:
 * cursor writes, edit bookkeeping, segmentation, undo primitives, wrap width,
 * and paste metadata. Focus/change/render-request/hardware-cursor behavior moved
 * to public members and injected host services. If a pi-tui upgrade renames or
 * removes any retained field or method, exactly one test fails and the fix lives
 * in exactly one type.
 */

const EDITOR_THEME: EditorTheme = {
  borderColor: (str: string) => str,
  selectList: {} as EditorTheme['selectList'],
};

function makeEditor(): Editor {
  const terminal = { rows: 30, columns: 120, write() {}, on() {}, off() {}, hideCursor() {}, showCursor() {} };
  const tui = new TuiMainScreen(terminal as unknown as ConstructorParameters<typeof TuiMainScreen>[0], false);
  const editor = new Editor(tui, EDITOR_THEME, { paddingX: 1 });
  // Initialize the lazily-set lastWidth field the way production does.
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

    expect(typeof internals.lastWidth).toBe('number');
    expect(internals.pastes).toBeInstanceOf(Map);
    expect(typeof internals.pasteCounter).toBe('number');

    const initialPasteCounter = internals.pasteCounter;
    if (initialPasteCounter === undefined) throw new Error('missing paste counter');
    const bigText = Array.from({ length: 12 }, (_, index) => `paste line ${index}`).join('\n');
    editor.handleInput(`\x1b[200~${bigText}\x1b[201~`);
    expect(internals.pastes?.size).toBeGreaterThan(0);
    expect(internals.pasteCounter).toBe(initialPasteCounter + 1);
  });

  it('exposes cursor bookkeeping fields (present, may be null)', () => {
    const editor = makeEditor();

    // null-initialised in Pi, so assert presence rather than a concrete type.
    for (const field of ['preferredVisualCol', 'snappedFromCursorCol', 'lastAction'] as const) {
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
  });
});
