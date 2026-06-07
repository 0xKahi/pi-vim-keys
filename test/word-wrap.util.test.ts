import { describe, expect, it } from 'bun:test';
// Deep import resolves fine under Bun/Node; it is the parity oracle for our copy.
import { wordWrapLine as piWordWrapLine } from '../src/utils/editor/pi-tui-internals';
import { wordWrapLine as localWordWrapLine } from '../src/utils/editor/word-wrap.util';

/**
 * Drift tripwire: our local wordWrapLine must produce output identical to
 * pi-tui's. The renderer can't deep-import pi-tui's function at runtime (the
 * extension loader mis-resolves the subpath), so we keep a copy and prove parity
 * here. If pi-tui changes its wrap algorithm on upgrade, this goes red.
 */

const LINES = [
  '',
  'short',
  'hello world foo bar baz qux',
  'a fairly long line that should wrap across several visual rows because it keeps going',
  'supercalifragilisticexpialidocious-and-then-some-very-long-unbreakable-token',
  'word verylongunbreakabletokenthatexceedswidth more',
  'trailing spaces      and   irregular    gaps   between words',
  '   leading whitespace then text',
  'CJK 日本語 のテキスト が 折り返さ れる はず です ね',
  'mixed 日本語 and english with emoji 😀 🎉 and more text to wrap around',
  'emoji-run 😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀',
  '[paste #1 +123 lines] inline with surrounding words that keep going for a while',
];

// Widths start at 3: pi-tui's own wordWrapLine stack-overflows when a width-2
// grapheme is wrapped at width 1-2 (a shared bug — our copy crashes identically),
// and such widths never occur in a real editor. Literal tabs are likewise
// excluded because the editor normalizes them to spaces before wrapping runs.
const WIDTHS = [3, 5, 8, 10, 18, 38, 78, 118];

describe('wordWrapLine parity with pi-tui', () => {
  for (const line of LINES) {
    for (const width of WIDTHS) {
      it(`matches pi-tui (width=${width}, line=${JSON.stringify(line.slice(0, 24))})`, () => {
        expect(localWordWrapLine(line, width)).toEqual(piWordWrapLine(line, width));
      });
    }
  }

  it('matches pi-tui when given pre-segmented graphemes', () => {
    const line = 'pre segmented graphemes including 日本 and emoji 😀 should match exactly';
    const preSegmented = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(line)];

    for (const width of WIDTHS) {
      expect(localWordWrapLine(line, width, preSegmented)).toEqual(piWordWrapLine(line, width, preSegmented));
    }
  });
});
