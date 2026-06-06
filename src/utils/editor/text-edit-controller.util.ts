import type { Editor } from '@earendil-works/pi-tui';

export type NewLineDirection = 'up' | 'down';
export type DeleteDirection = 'forward' | 'backward';

type EditorState = {
  lines: string[];
  cursorLine: number;
  cursorCol: number;
};

type UndoStackLike = {
  push: (state: EditorState) => void;
  pop: () => EditorState | undefined;
  clear?: () => void;
  length?: number;
};

type RedoEntry = {
  before: EditorState;
  after: EditorState;
};

type EditorWithInternals = {
  state?: EditorState;
  tui?: { requestRender?: () => void };
  onChange?: (text: string) => void;
  lastAction?: unknown;
  historyIndex?: number;
  preferredVisualCol?: number | null;
  snappedFromCursorCol?: number | null;
  undoStack?: UndoStackLike;
  pushUndoSnapshot?: () => void;
  cancelAutocomplete?: () => void;
  segment?: (text: string, mode: 'grapheme' | 'word') => Iterable<Intl.SegmentData>;
};

/**
 * Text editing helper for Pi's Editor/CustomEditor.
 *
 * Pi keeps cursor writes and atomic editing primitives internal today. Like the
 * movement controller, this keeps those implementation details contained in one
 * small utility so modal-editor commands can stay declarative.
 */
export class TextEditController {
  private readonly fallbackUndoStack: EditorState[] = [];
  private redoStack: RedoEntry[] = [];

  constructor(private readonly editor: Editor) {}

  delete(direction: DeleteDirection): boolean {
    return direction === 'forward' ? this.deleteForward() : this.deleteBackward();
  }

  deleteLine(): boolean {
    const state = this.getState();
    if (!state) return false;

    this.normalizeState(state);

    if (state.lines.length === 1) {
      if ((state.lines[0] ?? '') === '' && state.cursorCol === 0) return false;

      this.startEdit();
      state.lines = [''];
      state.cursorLine = 0;
      this.setCursorCol(0);
      this.finishEdit();
      return true;
    }

    const oldCol = state.cursorCol;
    this.startEdit();
    state.lines.splice(state.cursorLine, 1);
    state.cursorLine = this.clamp(state.cursorLine, 0, state.lines.length - 1);
    this.setCursorCol(Math.min(oldCol, (state.lines[state.cursorLine] ?? '').length));
    this.finishEdit();
    return true;
  }

  newLine(direction: NewLineDirection, wrap = false): boolean {
    const state = this.getState();
    if (!state) return false;

    this.normalizeState(state);
    this.startEdit();

    const currentLine = state.lines[state.cursorLine] ?? '';

    if (!wrap) {
      const insertAt = direction === 'up' ? state.cursorLine : state.cursorLine + 1;
      state.lines.splice(insertAt, 0, '');
      state.cursorLine = insertAt;
      this.setCursorCol(0);
      this.finishEdit();
      return true;
    }

    const before = currentLine.slice(0, state.cursorCol);
    const after = currentLine.slice(state.cursorCol);

    state.lines[state.cursorLine] = before;

    const insertAt = direction === 'up' ? state.cursorLine : state.cursorLine + 1;
    state.lines.splice(insertAt, 0, after);
    state.cursorLine = insertAt;
    this.setCursorCol(0);
    this.finishEdit();
    return true;
  }

  undo(): boolean {
    const state = this.getState();
    if (!state) return false;

    const snapshot = this.popUndoSnapshot();
    if (!snapshot) return false;

    const current = this.cloneState(state);
    this.redoStack.push({ before: this.cloneState(snapshot), after: current });
    this.applySnapshot(snapshot);
    return true;
  }

  redo(): boolean {
    const state = this.getState();
    if (!state) return false;

    const entry = this.redoStack.pop();
    if (!entry) return false;

    if (!this.linesEqual(state, entry.before)) return false;

    this.pushUndoSnapshot();
    this.applySnapshot(entry.after);
    return true;
  }

  private deleteBackward(): boolean {
    const state = this.getState();
    if (!state) return false;

    this.normalizeState(state);
    const line = state.lines[state.cursorLine] ?? '';

    if (state.cursorCol > 0) {
      const beforeCursor = line.slice(0, state.cursorCol);
      const graphemes = this.segment(beforeCursor);
      const lastGrapheme = graphemes[graphemes.length - 1];
      const deleteFrom = lastGrapheme?.index ?? state.cursorCol - 1;

      this.startEdit();
      state.lines[state.cursorLine] = line.slice(0, deleteFrom) + line.slice(state.cursorCol);
      this.setCursorCol(deleteFrom);
      this.finishEdit();
      return true;
    }

    if (state.cursorLine === 0) return false;

    this.startEdit();
    const currentLine = state.lines[state.cursorLine] ?? '';
    const previousLine = state.lines[state.cursorLine - 1] ?? '';
    state.lines[state.cursorLine - 1] = previousLine + currentLine;
    state.lines.splice(state.cursorLine, 1);
    state.cursorLine--;
    this.setCursorCol(previousLine.length);
    this.finishEdit();
    return true;
  }

  private deleteForward(): boolean {
    const state = this.getState();
    if (!state) return false;

    this.normalizeState(state);
    const line = state.lines[state.cursorLine] ?? '';

    if (state.cursorCol < line.length) {
      const afterCursor = line.slice(state.cursorCol);
      const graphemes = this.segment(afterCursor);
      const firstGrapheme = graphemes[0];
      const deleteTo = state.cursorCol + (firstGrapheme?.segment.length ?? 1);

      this.startEdit();
      state.lines[state.cursorLine] = line.slice(0, state.cursorCol) + line.slice(deleteTo);
      this.finishEdit();
      return true;
    }

    if (state.cursorLine >= state.lines.length - 1) return false;

    this.startEdit();
    const nextLine = state.lines[state.cursorLine + 1] ?? '';
    state.lines[state.cursorLine] = line + nextLine;
    state.lines.splice(state.cursorLine + 1, 1);
    this.finishEdit();
    return true;
  }

  private startEdit(): void {
    const internal = this.getInternal();
    internal.cancelAutocomplete?.();
    internal.historyIndex = -1;
    internal.lastAction = null;
    this.clearRedoStack();
    this.pushUndoSnapshot();
  }

  private finishEdit(): void {
    this.resetCursorState();
    this.notifyChange();
  }

  private applySnapshot(snapshot: EditorState): void {
    const state = this.getState();
    if (!state) return;

    const next = this.cloneState(snapshot);
    state.lines = next.lines;
    state.cursorLine = next.cursorLine;
    state.cursorCol = next.cursorCol;
    this.normalizeState(state);
    this.resetCursorState();
    this.notifyChange();
  }

  private pushUndoSnapshot(): void {
    const state = this.getState();
    if (!state) return;

    const internal = this.getInternal();
    if (typeof internal.pushUndoSnapshot === 'function') {
      internal.pushUndoSnapshot();
      return;
    }

    if (internal.undoStack) {
      internal.undoStack.push(state);
      return;
    }

    this.fallbackUndoStack.push(this.cloneState(state));
  }

  private popUndoSnapshot(): EditorState | undefined {
    const undoStack = this.getInternal().undoStack;
    if (undoStack) return undoStack.pop();

    return this.fallbackUndoStack.pop();
  }

  private clearRedoStack(): void {
    this.redoStack = [];
  }

  private notifyChange(): void {
    const internal = this.getInternal();
    internal.onChange?.(this.editor.getText());
    internal.tui?.requestRender?.();
  }

  private resetCursorState(): void {
    const internal = this.getInternal();
    internal.lastAction = null;
    internal.preferredVisualCol = null;
    internal.snappedFromCursorCol = null;
  }

  private setCursorCol(col: number): void {
    const state = this.getState();
    if (!state) return;

    const line = state.lines[state.cursorLine] ?? '';
    state.cursorCol = this.clamp(Math.floor(col), 0, line.length);
    this.resetCursorState();
  }

  private normalizeState(state: EditorState): void {
    if (state.lines.length === 0) state.lines = [''];

    state.cursorLine = this.clamp(Math.floor(state.cursorLine), 0, state.lines.length - 1);
    const line = state.lines[state.cursorLine] ?? '';
    state.cursorCol = this.clamp(Math.floor(state.cursorCol), 0, line.length);
  }

  private segment(text: string): Intl.SegmentData[] {
    const internal = this.getInternal();
    if (typeof internal.segment === 'function') {
      return [...internal.segment(text, 'grapheme')];
    }

    if (typeof Intl.Segmenter === 'function') {
      return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)];
    }

    const segments: Intl.SegmentData[] = [];
    let index = 0;
    for (const segment of text) {
      segments.push({ segment, index, input: text });
      index += segment.length;
    }
    return segments;
  }

  private getState(): EditorState | undefined {
    return this.getInternal().state;
  }

  private getInternal(): EditorWithInternals {
    return this.editor as unknown as EditorWithInternals;
  }

  private cloneState(state: EditorState): EditorState {
    return {
      lines: [...state.lines],
      cursorLine: state.cursorLine,
      cursorCol: state.cursorCol,
    };
  }

  private linesEqual(a: EditorState, b: EditorState): boolean {
    if (a.lines.length !== b.lines.length) return false;

    return a.lines.every((line, index) => line === b.lines[index]);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
