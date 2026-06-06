import type { Editor } from '@earendil-works/pi-tui';

export type BasicDirection = 'left' | 'right' | 'up' | 'down';
export type JumpPos = 'start' | 'end';
export type JumpDirection = 'forward' | 'backward';
export type LeapType = 'line' | 'page';

export type JumpWordOptions = {
  pos: JumpPos;
  includePunctuation: boolean;
};

type EditorWithInternals = {
  state?: {
    lines: string[];
    cursorLine: number;
    cursorCol: number;
  };
  tui?: { requestRender?: () => void };
  lastAction?: unknown;
  preferredVisualCol?: number | null;
  snappedFromCursorCol?: number | null;
  moveCursor?: (deltaLine: number, deltaCol: number) => void;
};

type Position = {
  line: number;
  col: number;
};

type WordRange = {
  line: number;
  start: number;
  end: number; // exclusive
};

/**
 * Vim-style cursor movement helper for Pi's Editor/CustomEditor.
 *
 * Pi exposes cursor reads publicly, but cursor writes are currently internal to
 * the editor implementation. Keeping that implementation detail contained here
 * keeps the modal editor small and gives us one place to update if Pi exposes a
 * public cursor setter later.
 */
export class MovementController {
  constructor(private readonly editor: Editor) {}

  move(direction: BasicDirection): boolean {
    const before = this.getCursor();

    switch (direction) {
      case 'left':
        this.callNativeMove(0, -1);
        break;
      case 'right':
        this.callNativeMove(0, 1);
        break;
      case 'up':
        this.callNativeMove(-1, 0);
        break;
      case 'down':
        this.callNativeMove(1, 0);
        break;
    }

    return this.finishIfMoved(before);
  }

  jumpWord(direction: JumpDirection, opts: JumpWordOptions): boolean {
    const before = this.getCursor();
    const words = this.getWordRanges(opts.includePunctuation);
    if (words.length === 0) return false;

    const target = opts.pos === 'start' ? this.findWordStart(words, before, direction) : this.findWordEnd(words, before, direction);

    if (!target) return false;
    this.setCursor(target);
    return this.finishIfMoved(before);
  }

  leap(to: JumpPos, type: LeapType): boolean {
    const before = this.getCursor();
    const lines = this.getLines();

    if (type === 'line') {
      const currentLine = lines[before.line] ?? '';
      this.setCursor({ line: before.line, col: to === 'start' ? 0 : currentLine.length });
      return this.finishIfMoved(before);
    }

    const targetLine = to === 'start' ? 0 : lines.length - 1;
    this.setCursor({ line: targetLine, col: before.col });
    return this.finishIfMoved(before);
  }

  findChar(direction: JumpDirection, char: string): boolean {
    if (char.length === 0) return false;

    const needle = [...char][0];
    if (needle === undefined) return false;

    const before = this.getCursor();
    const lines = this.getLines();
    const isForward = direction === 'forward';
    const step = isForward ? 1 : -1;
    const end = isForward ? lines.length : -1;

    for (let line = before.line; line !== end; line += step) {
      const text = lines[line] ?? '';
      const searchFrom = line === before.line ? (isForward ? before.col + 1 : before.col - 1) : undefined;
      const col = isForward ? text.indexOf(needle, searchFrom) : text.lastIndexOf(needle, searchFrom);

      if (col !== -1) {
        this.setCursor({ line, col });
        return this.finishIfMoved(before);
      }
    }

    return false;
  }

  private callNativeMove(deltaLine: number, deltaCol: number): void {
    const internal = this.editor as unknown as EditorWithInternals;

    if (typeof internal.moveCursor === 'function') {
      internal.moveCursor(deltaLine, deltaCol);
      return;
    }

    const cursor = this.getCursor();
    this.setCursor({ line: cursor.line + deltaLine, col: cursor.col + deltaCol });
  }

  private findWordStart(words: WordRange[], cursor: Position, direction: JumpDirection): Position | undefined {
    if (direction === 'forward') {
      const word = words.find(range => this.compare({ line: range.line, col: range.start }, cursor) > 0);
      return word ? { line: word.line, col: word.start } : undefined;
    }

    for (let i = words.length - 1; i >= 0; i--) {
      const word = words[i];
      if (!word) continue;
      if (this.compare({ line: word.line, col: word.start }, cursor) < 0 && this.compare(cursor, { line: word.line, col: word.end }) <= 0) {
        return { line: word.line, col: word.start };
      }
      if (this.compare({ line: word.line, col: word.end }, cursor) < 0) {
        return { line: word.line, col: word.start };
      }
    }

    return undefined;
  }

  private findWordEnd(words: WordRange[], cursor: Position, direction: JumpDirection): Position | undefined {
    if (direction === 'forward') {
      for (const word of words) {
        const endPos = { line: word.line, col: Math.max(word.start, word.end - 1) };
        if (this.compare(endPos, cursor) > 0) return endPos;
      }
      return undefined;
    }

    for (let i = words.length - 1; i >= 0; i--) {
      const word = words[i];
      if (!word) continue;
      const endPos = { line: word.line, col: Math.max(word.start, word.end - 1) };
      if (this.compare(endPos, cursor) < 0) return endPos;
    }

    return undefined;
  }

  private getWordRanges(includePunctuation: boolean): WordRange[] {
    const ranges: WordRange[] = [];
    const matcher = includePunctuation ? /\S+/g : /[\p{L}\p{N}_]+/gu;

    this.getLines().forEach((lineText, line) => {
      matcher.lastIndex = 0;
      for (const match of lineText.matchAll(matcher)) {
        const start = match.index ?? 0;
        ranges.push({ line, start, end: start + match[0].length });
      }
    });

    return ranges;
  }

  private getCursor(): Position {
    return this.editor.getCursor();
  }

  private getLines(): string[] {
    return this.editor.getLines();
  }

  private setCursor(position: Position): void {
    const internal = this.editor as unknown as EditorWithInternals;
    const state = internal.state;
    if (!state) return;

    const maxLine = Math.max(0, state.lines.length - 1);
    const line = this.clamp(Math.floor(position.line), 0, maxLine);
    const lineText = state.lines[line] ?? '';
    const col = this.clamp(Math.floor(position.col), 0, lineText.length);

    internal.lastAction = null;
    internal.preferredVisualCol = null;
    internal.snappedFromCursorCol = null;
    state.cursorLine = line;
    state.cursorCol = col;
  }

  private finishIfMoved(before: Position): boolean {
    const after = this.getCursor();
    const moved = before.line !== after.line || before.col !== after.col;
    if (moved) this.requestRender();
    return moved;
  }

  private requestRender(): void {
    (this.editor as unknown as EditorWithInternals).tui?.requestRender?.();
  }

  private compare(a: Position, b: Position): number {
    if (a.line !== b.line) return a.line - b.line;
    return a.col - b.col;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
