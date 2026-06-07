import { CURSOR_MARKER, type Editor, visibleWidth } from '@earendil-works/pi-tui';
import { crayon } from '../utils/crayon.util';
import { wordWrapLine } from '../utils/editor/word-wrap.util';
import type { EditorAnchoredRange, EditorRange } from './editor-compass-controller';
import { type EditorInternals, getEditorInternals } from './types';

type HighlightStyle = (text: string) => string;

type RenderVisualHighlightOptions = {
  lines: string[];
  width: number;
  range: EditorAnchoredRange | undefined;
  style: HighlightStyle;
};

type LayoutLine = {
  logicalLine: number;
  startCol: number;
  endCol: number;
  text: string;
  hasCursor: boolean;
  cursorPos?: number;
};

type EditorLayout = {
  contentWidth: number;
  layoutWidth: number;
  paddingX: number;
};

type RenderEditorTextLineOptions = {
  layout: EditorLayout;
  layoutLine: LayoutLine;
  range: EditorAnchoredRange;
  style: HighlightStyle;
};

type RenderHighlightedTextOptions = {
  layoutLine: LayoutLine;
  range: EditorAnchoredRange;
  style: HighlightStyle;
  cursorPos: number | undefined;
  marker: string;
  useHardwareCursor: boolean;
};

/**
 * Applies visual-mode selection styling to Pi editor render output.
 *
 * The compass controller owns buffer coordinates. This renderer only translates
 * those coordinates to the currently visible wrapped editor rows and applies the
 * provided style function. It intentionally mutates the already-rendered editor
 * lines so borders/autocomplete placement remain owned by Pi's editor.
 *
 * Wrapping uses a local copy of Pi's `wordWrapLine` (see
 * ../utils/editor/word-wrap.util, kept in parity by a test), the wrap width is
 * read from the editor's
 * `lastWidth`, and the visible row count is derived from Pi's rendered output —
 * so this overlay tracks the editor's real layout instead of re-deriving it.
 */
export class VisualHighlightRenderer {
  /**
   * Pi's Editor does not currently expose all render state we need. Keep the
   * unsafe view contained here instead of spreading casts through modal-editor.
   */
  private readonly editorInternals: EditorInternals;

  constructor(private readonly editor: Editor) {
    this.editorInternals = getEditorInternals(editor);
  }

  render({ lines, width, range, style }: RenderVisualHighlightOptions): void {
    if (!range) return;

    const layout = this.getEditorLayout(width);
    const layoutLines = this.buildLayoutLines(layout.layoutWidth);
    const scrollOffset = this.getScrollOffset(layoutLines.length);
    const visibleRowCount = this.getVisibleTextRowCount(lines);
    const visibleLayoutLines = layoutLines.slice(scrollOffset, scrollOffset + visibleRowCount);

    for (const [index, layoutLine] of visibleLayoutLines.entries()) {
      const renderedLineIndex = index + 1; // index 0 is the editor's top border
      if (renderedLineIndex >= lines.length) break;

      lines[renderedLineIndex] = this.renderEditorTextLine({
        layout,
        layoutLine,
        range,
        style,
      });
    }
  }

  private getEditorLayout(width: number): EditorLayout {
    const maxPadding = Math.max(0, Math.floor((width - 1) / 2));
    const paddingX = Math.min(this.editor.getPaddingX(), maxPadding);
    const contentWidth = Math.max(1, width - paddingX * 2);
    const layoutWidth = this.getLayoutWidth(contentWidth, paddingX);

    return { contentWidth, layoutWidth, paddingX };
  }

  /**
   * Pi's Editor records the wrap width it last rendered with (`lastWidth`).
   * Because `super.render()` runs before this overlay, that value is current,
   * so we reuse it instead of re-deriving Pi's "reserve one column for the
   * cursor when unpadded" rule. We only fall back to the computation when the
   * editor has not rendered at this width yet.
   */
  private getLayoutWidth(contentWidth: number, paddingX: number): number {
    const editorLayoutWidth = this.editorInternals.lastWidth;
    if (typeof editorLayoutWidth === 'number' && editorLayoutWidth > 0) {
      return editorLayoutWidth;
    }

    return Math.max(1, contentWidth - (paddingX ? 0 : 1));
  }

  /**
   * Pi owns wrapping and scrolling, so the number of text rows it actually drew
   * is the source of truth for how many overlay rows to emit. Those rows live
   * between the top border (row 0) and the bottom border, which lets us avoid
   * copying Pi's `maxVisibleLines` viewport formula. The border format is
   * already a load-bearing assumption elsewhere (mode label rendering).
   */
  private getVisibleTextRowCount(lines: string[]): number {
    for (let index = lines.length - 1; index >= 1; index--) {
      const line = lines[index];
      if (line === undefined) continue;
      if (crayon.stripAnsi(line).startsWith('─')) return index - 1;
    }

    return Math.max(0, lines.length - 1);
  }

  private buildLayoutLines(contentWidth: number): LayoutLine[] {
    const editorLines = this.editor.getLines();
    const lines = editorLines.length > 0 ? editorLines : [''];
    const cursor = this.editor.getCursor();

    if (lines.length === 1 && lines[0] === '') {
      return [
        {
          logicalLine: 0,
          startCol: 0,
          endCol: 0,
          text: '',
          hasCursor: true,
          cursorPos: 0,
        },
      ];
    }

    const layoutLines: LayoutLine[] = [];

    for (let logicalLine = 0; logicalLine < lines.length; logicalLine++) {
      const lineText = lines[logicalLine] ?? '';
      const isCurrentLine = logicalLine === cursor.line;

      if (visibleWidth(lineText) <= contentWidth) {
        layoutLines.push({
          logicalLine,
          startCol: 0,
          endCol: lineText.length,
          text: lineText,
          hasCursor: isCurrentLine,
          cursorPos: isCurrentLine ? cursor.col : undefined,
        });
        continue;
      }

      const chunks = wordWrapLine(lineText, contentWidth, [...this.segment(lineText, 'grapheme')]);

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        if (!chunk) continue;

        const isLastChunk = chunkIndex === chunks.length - 1;
        const cursorPos = cursor.col;
        let hasCursor = false;
        let adjustedCursorPos = 0;

        if (isCurrentLine) {
          if (isLastChunk) {
            hasCursor = cursorPos >= chunk.startIndex;
            adjustedCursorPos = cursorPos - chunk.startIndex;
          } else {
            hasCursor = cursorPos >= chunk.startIndex && cursorPos < chunk.endIndex;
            if (hasCursor) {
              adjustedCursorPos = Math.min(cursorPos - chunk.startIndex, chunk.text.length);
            }
          }
        }

        layoutLines.push({
          logicalLine,
          startCol: chunk.startIndex,
          endCol: chunk.endIndex,
          text: chunk.text,
          hasCursor,
          cursorPos: hasCursor ? adjustedCursorPos : undefined,
        });
      }
    }

    return layoutLines;
  }

  private renderEditorTextLine({ layout, layoutLine, range, style }: RenderEditorTextLineOptions): string {
    const leftPadding = ' '.repeat(layout.paddingX);
    const rightPadding = leftPadding;
    const emitCursorMarker = this.isFocused() && !this.editor.isShowingAutocomplete();
    const marker = emitCursorMarker ? CURSOR_MARKER : '';
    const useHardwareCursor = this.usesHardwareCursor();
    const cursorPos = layoutLine.hasCursor ? layoutLine.cursorPos : undefined;
    const cursorAtEnd = cursorPos !== undefined && cursorPos >= layoutLine.text.length;
    let lineVisibleWidth = visibleWidth(layoutLine.text);
    let cursorInPadding = false;

    let displayText = this.renderHighlightedText({
      layoutLine,
      range,
      style,
      cursorPos: cursorAtEnd ? undefined : cursorPos,
      marker,
      useHardwareCursor,
    });

    if (cursorAtEnd) {
      const cursorSpace = useHardwareCursor ? `${marker} ` : `${marker}\x1b[7m \x1b[0m`;

      displayText += cursorSpace;
      lineVisibleWidth++;

      if (lineVisibleWidth > layout.contentWidth && layout.paddingX > 0) {
        cursorInPadding = true;
      }
    }

    const padding = ' '.repeat(Math.max(0, layout.contentWidth - lineVisibleWidth));
    const lineRightPadding = cursorInPadding ? rightPadding.slice(1) : rightPadding;

    return `${leftPadding}${displayText}${padding}${lineRightPadding}`;
  }

  private renderHighlightedText({ layoutLine, range, style, cursorPos, marker, useHardwareCursor }: RenderHighlightedTextOptions): string {
    if (cursorPos === undefined) {
      return this.renderHighlightedSlice(layoutLine, 0, layoutLine.text.length, range, style);
    }

    const before = this.renderHighlightedSlice(layoutLine, 0, cursorPos, range, style);
    const afterCursor = layoutLine.text.slice(cursorPos);
    const cursorGrapheme = [...this.segment(afterCursor, 'grapheme')][0]?.segment ?? '';
    const cursorEnd = cursorPos + cursorGrapheme.length;
    const cursor = useHardwareCursor
      ? `${marker}${this.renderHighlightedSlice(layoutLine, cursorPos, cursorEnd, range, style)}`
      : `${marker}\x1b[7m${cursorGrapheme}\x1b[0m`;
    const after = this.renderHighlightedSlice(layoutLine, cursorEnd, layoutLine.text.length, range, style);

    return `${before}${cursor}${after}`;
  }

  private renderHighlightedSlice(
    layoutLine: LayoutLine,
    localStart: number,
    localEnd: number,
    range: EditorAnchoredRange,
    style: HighlightStyle,
  ): string {
    if (localStart >= localEnd) return '';

    const intervals = this.getSelectedLocalIntervals(layoutLine, localStart, localEnd, range.ranges);
    if (intervals.length === 0) return layoutLine.text.slice(localStart, localEnd);

    let result = '';
    let cursor = localStart;

    for (const interval of intervals) {
      if (interval.start > cursor) {
        result += layoutLine.text.slice(cursor, interval.start);
      }

      result += style(layoutLine.text.slice(interval.start, interval.end));
      cursor = interval.end;
    }

    if (cursor < localEnd) {
      result += layoutLine.text.slice(cursor, localEnd);
    }

    return result;
  }

  private getSelectedLocalIntervals(
    layoutLine: LayoutLine,
    localStart: number,
    localEnd: number,
    ranges: EditorRange[],
  ): Array<{ start: number; end: number }> {
    const intervals: Array<{ start: number; end: number }> = [];

    for (const range of ranges) {
      if (range.line !== layoutLine.logicalLine) continue;

      const start = Math.max(localStart, range.startCol - layoutLine.startCol);
      const end = Math.min(localEnd, range.endCol - layoutLine.startCol);

      if (start < end) intervals.push({ start, end });
    }

    return intervals.sort((a, b) => a.start - b.start);
  }

  private getScrollOffset(layoutLineCount: number): number {
    const maxScrollOffset = Math.max(0, layoutLineCount - 1);
    const scrollOffset = typeof this.editorInternals.scrollOffset === 'number' ? this.editorInternals.scrollOffset : 0;

    return Math.max(0, Math.min(Math.floor(scrollOffset), maxScrollOffset));
  }

  private isFocused(): boolean {
    return this.editorInternals.focused === true;
  }

  private usesHardwareCursor(): boolean {
    return this.editorInternals.tui?.getShowHardwareCursor?.() === true;
  }

  private segment(text: string, mode: 'grapheme' | 'word'): Iterable<Intl.SegmentData> {
    if (typeof this.editorInternals.segment === 'function') return this.editorInternals.segment(text, mode);

    return new Intl.Segmenter(undefined, { granularity: mode }).segment(text);
  }
}
