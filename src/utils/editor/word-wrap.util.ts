import { visibleWidth } from '@earendil-works/pi-tui';

/**
 * Local copy of pi-tui's `wordWrapLine`.
 *
 * We cannot deep-import pi-tui's own implementation at runtime: pi's extension
 * loader resolves the bare `@earendil-works/pi-tui` specifier to its main file
 * and then appends subpaths, so `@earendil-works/pi-tui/dist/components/editor.js`
 * fails to load. To avoid drift, `word-wrap.util.test.ts` asserts this copy
 * produces output identical to pi-tui's `wordWrapLine` across a battery of
 * inputs (that test deep-imports the real function, which resolves fine under
 * Bun/Node). If pi-tui changes its wrap algorithm, that parity test goes red.
 */
export type WrappedChunk = {
  text: string;
  startIndex: number;
  endIndex: number;
};

const PASTE_MARKER_SINGLE = /^\[paste #(\d+)( (\+\d+ lines|\d+ chars))?\]$/;

export function wordWrapLine(line: string, maxWidth: number, preSegmented?: Intl.SegmentData[]): WrappedChunk[] {
  if (!line || maxWidth <= 0) {
    return [{ text: '', startIndex: 0, endIndex: 0 }];
  }

  if (visibleWidth(line) <= maxWidth) {
    return [{ text: line, startIndex: 0, endIndex: line.length }];
  }

  const chunks: WrappedChunk[] = [];
  const segments = preSegmented ?? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(line)];
  let currentWidth = 0;
  let chunkStart = 0;
  let wrapOppIndex = -1;
  let wrapOppWidth = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) continue;

    const grapheme = seg.segment;
    const graphemeWidth = visibleWidth(grapheme);
    const charIndex = seg.index;
    const isWhitespace = !isPasteMarker(grapheme) && isWhitespaceChar(grapheme);

    if (currentWidth + graphemeWidth > maxWidth) {
      if (wrapOppIndex >= 0 && currentWidth - wrapOppWidth + graphemeWidth <= maxWidth) {
        chunks.push({ text: line.slice(chunkStart, wrapOppIndex), startIndex: chunkStart, endIndex: wrapOppIndex });
        chunkStart = wrapOppIndex;
        currentWidth -= wrapOppWidth;
      } else if (chunkStart < charIndex) {
        chunks.push({ text: line.slice(chunkStart, charIndex), startIndex: chunkStart, endIndex: charIndex });
        chunkStart = charIndex;
        currentWidth = 0;
      }

      wrapOppIndex = -1;
    }

    if (graphemeWidth > maxWidth) {
      const subChunks = wordWrapLine(grapheme, maxWidth);

      for (let j = 0; j < subChunks.length - 1; j++) {
        const subChunk = subChunks[j];
        if (!subChunk) continue;
        chunks.push({
          text: subChunk.text,
          startIndex: charIndex + subChunk.startIndex,
          endIndex: charIndex + subChunk.endIndex,
        });
      }

      const lastSubChunk = subChunks[subChunks.length - 1];
      if (!lastSubChunk) continue;
      chunkStart = charIndex + lastSubChunk.startIndex;
      currentWidth = visibleWidth(lastSubChunk.text);
      wrapOppIndex = -1;
      continue;
    }

    currentWidth += graphemeWidth;

    const next = segments[i + 1];
    if (isWhitespace && next && (isPasteMarker(next.segment) || !isWhitespaceChar(next.segment))) {
      wrapOppIndex = next.index;
      wrapOppWidth = currentWidth;
    }
  }

  chunks.push({ text: line.slice(chunkStart), startIndex: chunkStart, endIndex: line.length });
  return chunks;
}

function isPasteMarker(segment: string): boolean {
  return segment.length >= 10 && PASTE_MARKER_SINGLE.test(segment);
}

function isWhitespaceChar(char: string): boolean {
  return /^\s$/u.test(char);
}
