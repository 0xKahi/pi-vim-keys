import { describe, expect, it } from 'bun:test';
import type { Editor } from '@earendil-works/pi-tui';
import { MovementController } from '../src/editor/movement-controller';
import { hasNativeInternals, OmpEditorInternalsAdapter } from '../src/editor/omp-internals-adapter';
import { TextEditController } from '../src/editor/text-edit-controller';
import { getEditorInternals } from '../src/editor/types';

/**
 * Test double for oh-my-pi's Editor: ONLY the public API, with omp's exact
 * observable semantics — no runtime-accessible `state`/`moveCursor`, so
 * getEditorInternals must route through the omp adapter.
 *
 * Semantics mirrored from @oh-my-pi/pi-tui packages/tui/src/components/editor.ts:
 * - setText anchors the cursor to the end and fires onChange.
 * - Left/right arrows are grapheme-aware and wrap across logical lines.
 * - Up/down move a logical line (no wrapping in the double) preserving column.
 */
class OmpEditorDouble {
  focused = true;
  onChange?: (text: string) => void;
  readonly injectedKeys: string[] = [];

  private lines: string[];
  private cursorLine = 0;
  private cursorCol = 0;

  constructor(text: string) {
    this.lines = text.split('\n');
  }

  getCursor(): { line: number; col: number } {
    return { line: this.cursorLine, col: this.cursorCol };
  }

  getLines(): string[] {
    return [...this.lines];
  }

  getText(): string {
    return this.lines.join('\n');
  }

  setText(text: string): void {
    this.lines = text.split('\n');
    this.cursorLine = this.lines.length - 1;
    this.cursorCol = this.lines[this.cursorLine]?.length ?? 0;
    this.onChange?.(this.getText());
  }

  moveToMessageStart(): void {
    this.cursorLine = 0;
    this.cursorCol = 0;
  }

  moveToMessageEnd(): void {
    this.cursorLine = this.lines.length - 1;
    this.cursorCol = this.lines[this.cursorLine]?.length ?? 0;
  }

  moveToLineStart(): void {
    this.cursorCol = 0;
  }

  moveToLineEnd(): void {
    this.cursorCol = this.lines[this.cursorLine]?.length ?? 0;
  }

  handleInput(data: string): void {
    this.injectedKeys.push(data);
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

    if (data === '\x1b[C') {
      const line = this.lines[this.cursorLine] ?? '';
      if (this.cursorCol < line.length) {
        const first = [...segmenter.segment(line.slice(this.cursorCol))][0];
        this.cursorCol += first ? first.segment.length : 1;
      } else if (this.cursorLine < this.lines.length - 1) {
        this.cursorLine++;
        this.cursorCol = 0;
      }
      return;
    }

    if (data === '\x1b[D') {
      if (this.cursorCol > 0) {
        const line = this.lines[this.cursorLine] ?? '';
        const graphemes = [...segmenter.segment(line.slice(0, this.cursorCol))];
        const last = graphemes[graphemes.length - 1];
        this.cursorCol -= last ? last.segment.length : 1;
      } else if (this.cursorLine > 0) {
        this.cursorLine--;
        this.cursorCol = this.lines[this.cursorLine]?.length ?? 0;
      }
      return;
    }

    if (data === '\x1b[A' && this.cursorLine > 0) {
      this.cursorLine--;
      this.cursorCol = Math.min(this.cursorCol, (this.lines[this.cursorLine] ?? '').length);
      return;
    }

    if (data === '\x1b[B' && this.cursorLine < this.lines.length - 1) {
      this.cursorLine++;
      this.cursorCol = Math.min(this.cursorCol, (this.lines[this.cursorLine] ?? '').length);
    }
  }
}

function makeEditor(text: string): Editor {
  return new OmpEditorDouble(text) as unknown as Editor;
}

function asDouble(editor: Editor): OmpEditorDouble {
  return editor as unknown as OmpEditorDouble;
}

function requireState(editor: Editor) {
  const state = getEditorInternals(editor).state;
  if (!state) throw new Error('missing editor state');
  return state;
}

describe('getEditorInternals host detection', () => {
  it('routes omp-style editors to the adapter and caches one per editor', () => {
    const editor = makeEditor('hello');

    expect(hasNativeInternals(editor)).toBe(false);
    const internals = getEditorInternals(editor);

    expect(internals).toBeInstanceOf(OmpEditorInternalsAdapter);
    expect(getEditorInternals(editor)).toBe(internals);
  });
});

describe('OmpEditorInternalsAdapter state proxy', () => {
  it('reads lines and cursor from the live buffer', () => {
    const editor = makeEditor('one\ntwo');
    asDouble(editor).moveToMessageStart();

    const state = requireState(editor);
    // state.lines is a write-through proxy; spread to compare as a plain array.
    expect([...state.lines]).toEqual(['one', 'two']);
    expect(state?.cursorLine).toBe(0);
    expect(state?.cursorCol).toBe(0);
  });

  it('commits index writes and preserves the cursor', () => {
    const editor = makeEditor('one\ntwo');
    const state = requireState(editor);
    state.cursorLine = 1;
    state.cursorCol = 2;

    state.lines[1] = 'TWO';

    expect(asDouble(editor).getText()).toBe('one\nTWO');
    expect(asDouble(editor).getCursor()).toEqual({ line: 1, col: 2 });
  });

  it('commits splice mutations', () => {
    const editor = makeEditor('one\ntwo\nthree');

    requireState(editor).lines.splice(1, 1);

    expect(asDouble(editor).getText()).toBe('one\nthree');
  });

  it('commits whole-array assignment', () => {
    const editor = makeEditor('one\ntwo');

    requireState(editor).lines = ['only'];

    expect(asDouble(editor).getText()).toBe('only');
  });

  it('moves the cursor across lines on cursorLine writes', () => {
    const editor = makeEditor('abc\ndef');
    asDouble(editor).moveToMessageStart();

    requireState(editor).cursorLine = 1;

    expect(asDouble(editor).getCursor()).toEqual({ line: 1, col: 0 });
  });

  it('clamps cursor writes into the buffer', () => {
    const editor = makeEditor('ab');

    requireState(editor).cursorCol = 99;

    expect(asDouble(editor).getCursor()).toEqual({ line: 0, col: 2 });
  });

  it('exposes the host focused flag', () => {
    const editor = makeEditor('x');
    expect(getEditorInternals(editor).focused).toBe(true);
    asDouble(editor).focused = false;
    expect(getEditorInternals(editor).focused).toBe(false);
  });
});

describe('OmpEditorInternalsAdapter.moveCursor', () => {
  it('never injects vertical arrows past the buffer edge (history-nav guard)', () => {
    const editor = makeEditor('one\ntwo');
    asDouble(editor).moveToMessageStart();

    getEditorInternals(editor).moveCursor?.(-1, 0);

    expect(asDouble(editor).injectedKeys).toEqual([]);
    expect(asDouble(editor).getCursor()).toEqual({ line: 0, col: 0 });
  });

  it('moves vertically within the buffer', () => {
    const editor = makeEditor('one\ntwo');
    asDouble(editor).moveToMessageStart();

    getEditorInternals(editor).moveCursor?.(1, 0);

    expect(asDouble(editor).injectedKeys).toEqual(['\x1b[B']);
    expect(asDouble(editor).getCursor()).toEqual({ line: 1, col: 0 });
  });
});

describe('controllers over the omp adapter', () => {
  it('MovementController walks chars, words, and line/page leaps', () => {
    const editor = makeEditor('foo bar\nbaz qux');
    asDouble(editor).moveToMessageStart();
    const movement = new MovementController(editor);

    expect(movement.move('right')).toBe(true);
    expect(asDouble(editor).getCursor()).toEqual({ line: 0, col: 1 });

    expect(movement.jumpWord('forward', { pos: 'start', includePunctuation: false })).toBe(true);
    expect(asDouble(editor).getCursor()).toEqual({ line: 0, col: 4 });

    expect(movement.leap('end', 'line')).toBe(true);
    expect(asDouble(editor).getCursor()).toEqual({ line: 0, col: 7 });

    expect(movement.leap('end', 'page')).toBe(true);
    expect(asDouble(editor).getCursor()).toEqual({ line: 1, col: 7 });

    expect(movement.leap('start', 'line')).toBe(true);
    expect(asDouble(editor).getCursor()).toEqual({ line: 1, col: 0 });
  });

  it('TextEditController deletes, pastes, and undoes through the fallback stack', () => {
    const editor = makeEditor('one\ntwo\nthree');
    asDouble(editor).moveToMessageStart();
    const textEdit = new TextEditController(editor);

    expect(textEdit.deleteLine()).toBe(true);
    expect(asDouble(editor).getText()).toBe('two\nthree');

    expect(textEdit.paste('forward')).toBe(true);
    expect(asDouble(editor).getText()).toBe('two\none\nthree');

    expect(textEdit.undo()).toBe(true);
    expect(asDouble(editor).getText()).toBe('two\nthree');

    expect(textEdit.delete('forward')).toBe(true);
    expect(asDouble(editor).getText()).toBe('wo\nthree');
  });

  it('opens new lines below and above', () => {
    const editor = makeEditor('one\ntwo');
    asDouble(editor).moveToMessageStart();
    const textEdit = new TextEditController(editor);

    expect(textEdit.newLine('down')).toBe(true);
    expect(asDouble(editor).getText()).toBe('one\n\ntwo');
    expect(asDouble(editor).getCursor()).toEqual({ line: 1, col: 0 });
  });

  it('fires onChange exactly once per buffer edit (no double-fire)', () => {
    const editor = makeEditor('abc');
    asDouble(editor).moveToMessageStart();

    let calls = 0;
    asDouble(editor).onChange = () => {
      calls++;
    };

    expect(new TextEditController(editor).delete('forward')).toBe(true);

    expect(asDouble(editor).getText()).toBe('bc');
    expect(calls).toBe(1);
  });
});
