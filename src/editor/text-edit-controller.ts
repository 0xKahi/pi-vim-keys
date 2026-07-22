import type { Editor } from '@earendil-works/pi-tui';
import type { EditorAnchoredRange, EditorCoordinate } from './editor-compass-controller';
import { type EditorInternals, type EditorState, getEditorInternals } from './types';

export type NewLineDirection = 'up' | 'down';
export type DeleteDirection = 'forward' | 'backward';
export type PasteDirection = 'forward' | 'backward';
export type RegisterType = 'character' | 'line';

type DeleteOptions = {
  saveToRegister?: boolean;
};

type RegisterEntry = {
  type: RegisterType;
  lines: string[];
};

type RedoEntry = {
  before: EditorState;
  after: EditorState;
};

export type SurroundOpts = {
  type: 'around' | 'inside';
  open: string;
  close: string;
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
  private register?: RegisterEntry;

  constructor(private readonly editor: Editor) {}

  delete(direction: DeleteDirection, opts: DeleteOptions = { saveToRegister: true }): boolean {
    return direction === 'forward' ? this.deleteForward(opts) : this.deleteBackward(opts);
  }

  deleteRange(range: EditorAnchoredRange | undefined, opts: DeleteOptions = { saveToRegister: true }): boolean {
    if (!range) return false;

    const state = this.getState();
    if (!state) return false;

    this.normalizeState(state);
    if (opts.saveToRegister) {
      this.yankRangeToRegister(range, state);
    }

    if (range.type === 'line') {
      return this.deleteLineSpan(range.start.line, range.end.line, state);
    }

    return this.deleteCharacterSpan(range.start, range.end, state);
  }

  yankRange(range: EditorAnchoredRange | undefined): boolean {
    if (!range) return false;

    const state = this.getState();
    if (!state) return false;

    this.normalizeState(state);
    return this.yankRangeToRegister(range, state);
  }

  yankLine(): boolean {
    const state = this.getState();
    if (!state) return false;

    this.normalizeState(state);
    const line = state.lines[state.cursorLine] ?? '';
    this.setRegister({ type: 'line', lines: [line] });
    return true;
  }

  deleteLine(): boolean {
    const state = this.getState();
    if (!state) return false;

    this.normalizeState(state);

    if (state.lines.length === 1) {
      if ((state.lines[0] ?? '') === '' && state.cursorCol === 0) return false;

      this.setRegister({ type: 'line', lines: [state.lines[0] ?? ''] });
      this.startEdit();
      state.lines = [''];
      state.cursorLine = 0;
      this.setCursorCol(0);
      this.finishEdit();
      return true;
    }

    const oldCol = state.cursorCol;
    this.setRegister({ type: 'line', lines: [state.lines[state.cursorLine] ?? ''] });
    this.startEdit();
    state.lines.splice(state.cursorLine, 1);
    state.cursorLine = this.clamp(state.cursorLine, 0, state.lines.length - 1);
    this.setCursorCol(Math.min(oldCol, (state.lines[state.cursorLine] ?? '').length));
    this.finishEdit();
    return true;
  }

  surround(range: EditorAnchoredRange | undefined, { type, open, close }: SurroundOpts): boolean {
    if (!range) return false;

    const state = this.getState();
    if (!state) return false;

    this.normalizeState(state);

    // Resolve the span to character coordinates. Line ranges wrap the full
    // span (col 0 of the first line to the end of the last line).
    let openAt: EditorCoordinate;
    let closeAt: EditorCoordinate;

    if (range.type === 'line') {
      const startLine = this.clamp(Math.floor(range.start.line), 0, state.lines.length - 1);
      const endLine = this.clamp(Math.floor(range.end.line), 0, state.lines.length - 1);
      const from = Math.min(startLine, endLine);
      const to = Math.max(startLine, endLine);
      openAt = { line: from, col: 0 };
      closeAt = { line: to, col: (state.lines[to] ?? '').length };
    } else {
      // `end` is exclusive, so it already points just past the selection.
      const ordered = this.orderCoordinates(range.start, range.end);
      openAt = { line: ordered.start.line, col: ordered.start.col };
      closeAt = { line: ordered.end.line, col: ordered.end.col };
    }

    // `inside` keeps the first and last graphemes outside the wrapping pair.
    if (type === 'inside') {
      openAt = this.nextGraphemeCoordinate(openAt, state);
      closeAt = this.previousGraphemeCoordinate(closeAt, state);
    }

    // Nothing left to wrap (e.g. `inside` on a one/two grapheme selection).
    if (this.compareCoordinates(openAt, closeAt) > 0) return false;

    this.startEdit();
    // Insert the closing string first so the opening insertion offsets stay valid.
    this.insertStringAt(closeAt, close, state);
    this.insertStringAt(openAt, open, state);
    state.cursorLine = openAt.line;
    this.setCursorCol(openAt.col);
    this.finishEdit();
    return true;
  }

  paste(direction: PasteDirection): boolean {
    if (!this.register) return false;

    if (this.register.type === 'line') return this.pasteLinewiseRegister(direction);
    return this.pasteText(this.register.lines.join('\n'), direction);
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

  private pasteText(text: string, direction: PasteDirection): boolean {
    const state = this.getState();
    if (!state || !text) return false;

    this.normalizeState(state);

    const insertion = this.getPasteInsertionCoordinate(state, direction);

    this.startEdit();
    state.cursorLine = insertion.line;
    this.setCursorCol(insertion.col);

    const end = this.insertTextAtCursor(text, state);
    this.setCursorToLastInsertedGrapheme(end, state);
    this.finishEdit();
    return true;
  }

  private yankRangeToRegister(range: EditorAnchoredRange, state: EditorState): boolean {
    if (range.type === 'line') {
      const lines = this.getLineSpanLines(range.start.line, range.end.line, state);
      this.setRegister({ type: 'line', lines });
      return true;
    }

    const lines = this.getCharacterSpanLines(range.start, range.end, state);
    if (!lines) return false;

    this.setRegister({ type: 'character', lines });
    return true;
  }

  private pasteLinewiseRegister(direction: PasteDirection): boolean {
    const state = this.getState();
    if (!state || !this.register || this.register.type !== 'line') return false;

    this.normalizeState(state);
    const lines = [...this.register.lines];
    if (lines.length === 0) return false;

    const insertAt = direction === 'backward' ? state.cursorLine : state.cursorLine + 1;

    this.startEdit();
    state.lines.splice(insertAt, 0, ...lines);
    state.cursorLine = insertAt;
    this.setCursorCol(0);
    this.finishEdit();
    return true;
  }

  private insertStringAt(coord: EditorCoordinate, text: string, state: EditorState): void {
    const line = state.lines[coord.line] ?? '';
    state.lines[coord.line] = line.slice(0, coord.col) + text + line.slice(coord.col);
  }

  private nextGraphemeCoordinate(coord: EditorCoordinate, state: EditorState): EditorCoordinate {
    const line = state.lines[coord.line] ?? '';
    const afterCursor = line.slice(coord.col);
    const firstGrapheme = this.segment(afterCursor)[0];
    return { line: coord.line, col: coord.col + (firstGrapheme?.segment.length ?? 0) };
  }

  private previousGraphemeCoordinate(coord: EditorCoordinate, state: EditorState): EditorCoordinate {
    const line = state.lines[coord.line] ?? '';
    const beforeCursor = line.slice(0, coord.col);
    const graphemes = this.segment(beforeCursor);
    const lastGrapheme = graphemes[graphemes.length - 1];
    return { line: coord.line, col: lastGrapheme?.index ?? coord.col };
  }

  private orderCoordinates(a: EditorCoordinate, b: EditorCoordinate): { start: EditorCoordinate; end: EditorCoordinate } {
    return this.compareCoordinates(a, b) <= 0 ? { start: a, end: b } : { start: b, end: a };
  }

  private compareCoordinates(a: EditorCoordinate, b: EditorCoordinate): number {
    if (a.line !== b.line) return a.line - b.line;
    return a.col - b.col;
  }

  private setRegister(entry: RegisterEntry): void {
    this.register = { type: entry.type, lines: [...entry.lines] };
  }

  private getLineSpanLines(startLine: number, endLine: number, state: EditorState): string[] {
    const normalizedStartLine = this.clamp(Math.floor(startLine), 0, state.lines.length - 1);
    const normalizedEndLine = this.clamp(Math.floor(endLine), 0, state.lines.length - 1);
    const from = Math.min(normalizedStartLine, normalizedEndLine);
    const to = Math.max(normalizedStartLine, normalizedEndLine);
    return state.lines.slice(from, to + 1);
  }

  private getCharacterSpanLines(start: EditorCoordinate, end: EditorCoordinate, state: EditorState): string[] | undefined {
    if (start.line > end.line || (start.line === end.line && start.col >= end.col)) return undefined;

    if (start.line === end.line) {
      return [(state.lines[start.line] ?? '').slice(start.col, end.col)];
    }

    const parts: string[] = [(state.lines[start.line] ?? '').slice(start.col)];

    for (let line = start.line + 1; line < end.line; line++) {
      parts.push(state.lines[line] ?? '');
    }

    parts.push((state.lines[end.line] ?? '').slice(0, end.col));
    return parts;
  }

  private getPasteInsertionCoordinate(state: EditorState, direction: PasteDirection): EditorCoordinate {
    if (direction === 'backward') return { line: state.cursorLine, col: state.cursorCol };

    const line = state.lines[state.cursorLine] ?? '';
    if (line.length === 0 || state.cursorCol >= line.length) return { line: state.cursorLine, col: line.length };

    const afterCursor = line.slice(state.cursorCol);
    const firstGrapheme = this.segment(afterCursor)[0];
    return {
      line: state.cursorLine,
      col: state.cursorCol + (firstGrapheme?.segment.length ?? 1),
    };
  }

  private insertTextAtCursor(text: string, state: EditorState): EditorCoordinate {
    const insertedLines = text.split('\n');
    const startLine = state.cursorLine;
    const currentLine = state.lines[startLine] ?? '';
    const beforeCursor = currentLine.slice(0, state.cursorCol);
    const afterCursor = currentLine.slice(state.cursorCol);

    if (insertedLines.length === 1) {
      state.lines[startLine] = beforeCursor + text + afterCursor;
      this.setCursorCol(state.cursorCol + text.length);
      return { line: state.cursorLine, col: state.cursorCol };
    }

    const lastInsertedLine = insertedLines[insertedLines.length - 1] ?? '';
    state.lines = [
      ...state.lines.slice(0, startLine),
      beforeCursor + (insertedLines[0] ?? ''),
      ...insertedLines.slice(1, -1),
      lastInsertedLine + afterCursor,
      ...state.lines.slice(startLine + 1),
    ];
    state.cursorLine = startLine + insertedLines.length - 1;
    this.setCursorCol(lastInsertedLine.length);
    return { line: state.cursorLine, col: state.cursorCol };
  }

  private setCursorToLastInsertedGrapheme(end: EditorCoordinate, state: EditorState): void {
    state.cursorLine = end.line;
    this.setCursorCol(end.col);

    if (end.col === 0) return;

    const line = state.lines[end.line] ?? '';
    const beforeCursor = line.slice(0, end.col);
    const graphemes = this.segment(beforeCursor);
    const lastGrapheme = graphemes[graphemes.length - 1];
    if (lastGrapheme) this.setCursorCol(lastGrapheme.index);
  }

  private deleteLineSpan(startLine: number, endLine: number, state: EditorState): boolean {
    const normalizedStartLine = this.clamp(Math.floor(startLine), 0, state.lines.length - 1);
    const normalizedEndLine = this.clamp(Math.floor(endLine), 0, state.lines.length - 1);
    const deleteFrom = Math.min(normalizedStartLine, normalizedEndLine);
    const deleteTo = Math.max(normalizedStartLine, normalizedEndLine);
    const deleteCount = deleteTo - deleteFrom + 1;

    if (state.lines.length === 1 && (state.lines[0] ?? '') === '' && state.cursorCol === 0) return false;

    this.startEdit();

    if (deleteCount >= state.lines.length) {
      state.lines = [''];
      state.cursorLine = 0;
      this.setCursorCol(0);
      this.finishEdit();
      return true;
    }

    state.lines.splice(deleteFrom, deleteCount);
    state.cursorLine = this.clamp(deleteFrom, 0, state.lines.length - 1);
    this.setCursorCol(0);
    this.finishEdit();
    return true;
  }

  private deleteCharacterSpan(start: EditorCoordinate, end: EditorCoordinate, state: EditorState): boolean {
    if (start.line > end.line || (start.line === end.line && start.col >= end.col)) return false;

    this.startEdit();

    if (start.line === end.line) {
      const line = state.lines[start.line] ?? '';
      state.lines[start.line] = line.slice(0, start.col) + line.slice(end.col);
      state.cursorLine = start.line;
      this.setCursorCol(start.col);
      this.finishEdit();
      return true;
    }

    const startLine = state.lines[start.line] ?? '';
    const endLine = state.lines[end.line] ?? '';
    state.lines[start.line] = startLine.slice(0, start.col) + endLine.slice(end.col);
    state.lines.splice(start.line + 1, end.line - start.line);
    state.cursorLine = start.line;
    this.setCursorCol(start.col);
    this.finishEdit();
    return true;
  }

  private deleteBackward(opts: DeleteOptions): boolean {
    const state = this.getState();
    if (!state) return false;

    this.normalizeState(state);
    const line = state.lines[state.cursorLine] ?? '';

    if (state.cursorCol > 0) {
      const beforeCursor = line.slice(0, state.cursorCol);
      const graphemes = this.segment(beforeCursor);
      const lastGrapheme = graphemes[graphemes.length - 1];
      const deleteFrom = lastGrapheme?.index ?? state.cursorCol - 1;

      if (opts.saveToRegister) this.setRegister({ type: 'character', lines: [line.slice(deleteFrom, state.cursorCol)] });
      this.startEdit();
      state.lines[state.cursorLine] = line.slice(0, deleteFrom) + line.slice(state.cursorCol);
      this.setCursorCol(deleteFrom);
      this.finishEdit();
      return true;
    }

    if (state.cursorLine === 0) return false;

    if (opts.saveToRegister) this.setRegister({ type: 'character', lines: ['', ''] });
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

  private deleteForward(opts: DeleteOptions): boolean {
    const state = this.getState();
    if (!state) return false;

    this.normalizeState(state);
    const line = state.lines[state.cursorLine] ?? '';

    if (state.cursorCol < line.length) {
      const afterCursor = line.slice(state.cursorCol);
      const graphemes = this.segment(afterCursor);
      const firstGrapheme = graphemes[0];
      const deleteTo = state.cursorCol + (firstGrapheme?.segment.length ?? 1);

      if (opts.saveToRegister) this.setRegister({ type: 'character', lines: [line.slice(state.cursorCol, deleteTo)] });
      this.startEdit();
      state.lines[state.cursorLine] = line.slice(0, state.cursorCol) + line.slice(deleteTo);
      this.finishEdit();
      return true;
    }

    if (state.cursorLine >= state.lines.length - 1) return false;

    if (opts.saveToRegister) this.setRegister({ type: 'character', lines: ['', ''] });
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
    if (undoStack) return this.unwrapUndoEntry(undoStack.pop());

    return this.fallbackUndoStack.pop();
  }

  /**
   * Pi's undo stack historically stored raw EditorState entries, but newer
   * pi-tui versions wrap them as { state, pastes, pasteCounter }. Accept both.
   */
  private unwrapUndoEntry(entry: unknown): EditorState | undefined {
    if (!entry || typeof entry !== 'object') return undefined;

    if (Array.isArray((entry as EditorState).lines)) return entry as EditorState;

    const wrapped = (entry as { state?: EditorState }).state;
    if (wrapped && Array.isArray(wrapped.lines)) return wrapped;

    return undefined;
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

  private getInternal(): EditorInternals {
    return getEditorInternals(this.editor);
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
