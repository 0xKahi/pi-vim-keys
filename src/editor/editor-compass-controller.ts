import type { Editor } from '@earendil-works/pi-tui';

export type AnchorType = 'cursor' | 'line';

export type EditorCoordinate = {
  line: number;
  col: number;
};

export type EditorRange = {
  line: number;
  startCol: number;
  endCol: number; // exclusive
};

export type EditorAnchoredRange = {
  type: AnchorType;
  anchor: EditorCoordinate;
  cursor: EditorCoordinate;
  start: EditorCoordinate;
  end: EditorCoordinate; // exclusive
  ranges: EditorRange[];
};

export type AnchorOptions = {
  type: AnchorType;
  at?: EditorCoordinate;
};

type AnchorState = {
  type: AnchorType;
  at: EditorCoordinate;
};

/**
 * Coordinate helper for Pi's Editor/CustomEditor.
 *
 * This controller intentionally does not render, style, or edit text. It stores
 * selection intent, then resolves that intent into normalized editor-buffer
 * coordinates that renderers, text edits, yank/delete commands, and future text
 * object helpers can reuse.
 */
export class EditorCompassController {
  private anchorState?: AnchorState;

  constructor(private readonly editor: Editor) {}

  anchor(type: AnchorType, at?: EditorCoordinate): void {
    const lines = this.getLines();
    this.anchorState = {
      type: type,
      at: this.normalizeCoordinate(at ?? this.editor.getCursor(), lines),
    };
  }

  getAnchoredRange(at?: EditorCoordinate): EditorAnchoredRange | undefined {
    if (!this.anchorState) return undefined;

    const lines = this.getLines();
    const anchor = this.normalizeCoordinate(this.anchorState.at, lines);
    const cursor = this.normalizeCoordinate(at ?? this.editor.getCursor(), lines);

    if (this.anchorState.type === 'line') {
      return this.getLineAnchoredRange(anchor, cursor, lines);
    }

    return this.getCursorAnchoredRange(anchor, cursor, lines);
  }

  clearAnchor(): void {
    this.anchorState = undefined;
  }

  private getCursorAnchoredRange(anchor: EditorCoordinate, cursor: EditorCoordinate, lines: string[]): EditorAnchoredRange {
    const { start, end } = this.orderCoordinates(anchor, cursor);
    const inclusiveEnd = this.advanceOneGrapheme(end, lines);

    return {
      type: 'cursor',
      anchor,
      cursor,
      start,
      end: inclusiveEnd,
      ranges: this.createRanges(start, inclusiveEnd, lines),
    };
  }

  private getLineAnchoredRange(anchor: EditorCoordinate, cursor: EditorCoordinate, lines: string[]): EditorAnchoredRange {
    const startLine = Math.min(anchor.line, cursor.line);
    const endLine = Math.max(anchor.line, cursor.line);
    const ranges: EditorRange[] = [];

    for (let line = startLine; line <= endLine; line++) {
      ranges.push({
        line,
        startCol: 0,
        endCol: this.getLineText(lines, line).length,
      });
    }

    return {
      type: 'line',
      anchor,
      cursor,
      start: { line: startLine, col: 0 },
      end: { line: endLine, col: this.getLineText(lines, endLine).length },
      ranges,
    };
  }

  private createRanges(start: EditorCoordinate, end: EditorCoordinate, lines: string[]): EditorRange[] {
    if (start.line === end.line) {
      return [{ line: start.line, startCol: start.col, endCol: end.col }];
    }

    const ranges: EditorRange[] = [
      {
        line: start.line,
        startCol: start.col,
        endCol: this.getLineText(lines, start.line).length,
      },
    ];

    for (let line = start.line + 1; line < end.line; line++) {
      ranges.push({ line, startCol: 0, endCol: this.getLineText(lines, line).length });
    }

    ranges.push({ line: end.line, startCol: 0, endCol: end.col });

    return ranges;
  }

  private orderCoordinates(a: EditorCoordinate, b: EditorCoordinate): { start: EditorCoordinate; end: EditorCoordinate } {
    if (this.compareCoordinates(a, b) <= 0) return { start: a, end: b };
    return { start: b, end: a };
  }

  private compareCoordinates(a: EditorCoordinate, b: EditorCoordinate): number {
    if (a.line !== b.line) return a.line - b.line;
    return a.col - b.col;
  }

  private advanceOneGrapheme(position: EditorCoordinate, lines: string[]): EditorCoordinate {
    const lineText = this.getLineText(lines, position.line);
    if (position.col >= lineText.length) return position;

    const afterCursor = lineText.slice(position.col);
    const firstGrapheme = this.segment(afterCursor)[0];

    return {
      line: position.line,
      col: position.col + (firstGrapheme?.segment.length ?? 1),
    };
  }

  private normalizeCoordinate(position: EditorCoordinate, lines: string[]): EditorCoordinate {
    const maxLine = Math.max(0, lines.length - 1);
    const line = this.clamp(Math.floor(position.line), 0, maxLine);
    const col = this.clamp(Math.floor(position.col), 0, this.getLineText(lines, line).length);

    return { line, col };
  }

  private getLines(): string[] {
    const lines = this.editor.getLines();
    return lines.length > 0 ? lines : [''];
  }

  private getLineText(lines: string[], line: number): string {
    return lines[line] ?? '';
  }

  private segment(text: string): Intl.SegmentData[] {
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

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
