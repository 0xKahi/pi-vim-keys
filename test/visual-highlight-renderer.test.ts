import { describe, expect, it } from 'bun:test';
import { Editor, type EditorTheme, TUI, visibleWidth } from '@earendil-works/pi-tui';
import type { EditorAnchoredRange } from '../src/editor/editor-compass-controller';
import { VisualHighlightRenderer } from '../src/editor/visual-highlight-renderer';
import { crayon } from '../src/utils/crayon.util';

/**
 * These are drift tripwires, not behaviour tests. They construct a REAL pi-tui
 * Editor and assert that VisualHighlightRenderer's layout math still matches
 * what the editor actually renders. If a pi-tui upgrade changes the wrap width
 * rule, padding, or viewport sizing, these go red instead of the highlight
 * silently sliding off the text at runtime.
 */

const WRAPPING_TEXT = ['short line', 'a fairly long line that should wrap across several visual rows because it keeps going and going', 'tail'].join(
  '\n',
);

const EDITOR_THEME: EditorTheme = {
  borderColor: (str: string) => str,
  selectList: {} as EditorTheme['selectList'],
};

function makeEditor(text: string, paddingX: number, rows = 30): Editor {
  const terminal = { rows, columns: 200, write() {}, on() {}, off() {}, hideCursor() {}, showCursor() {} };
  const tui = new TUI(terminal as unknown as ConstructorParameters<typeof TUI>[0], false);
  const editor = new Editor(tui, EDITOR_THEME, { paddingX });
  editor.setText(text);
  return editor;
}

// White-box access: these are drift tripwires, so reaching into private layout
// helpers is intentional.
type RendererInternals = {
  getEditorLayout(width: number): { contentWidth: number; layoutWidth: number; paddingX: number };
  getVisibleTextRowCount(lines: string[]): number;
};

function internals(renderer: VisualHighlightRenderer): RendererInternals {
  return renderer as unknown as RendererInternals;
}

function editorLastWidth(editor: Editor): number {
  return (editor as unknown as { lastWidth: number }).lastWidth;
}

const WIDTHS = [10, 20, 40, 80, 120];
const PADDINGS = [0, 1, 2];

describe('VisualHighlightRenderer layout drift', () => {
  for (const paddingX of PADDINGS) {
    for (const width of WIDTHS) {
      it(`wrap width matches editor.lastWidth (width=${width}, paddingX=${paddingX})`, () => {
        const editor = makeEditor(WRAPPING_TEXT, paddingX);
        editor.render(width); // sets editor.lastWidth, exactly as super.render() does in production

        const layout = internals(new VisualHighlightRenderer(editor)).getEditorLayout(width);

        expect(layout.layoutWidth).toBe(editorLastWidth(editor));
        expect(layout.paddingX * 2 + layout.contentWidth).toBe(width);
      });

      it(`visible row count matches editor's drawn text rows (width=${width}, paddingX=${paddingX})`, () => {
        const editor = makeEditor(WRAPPING_TEXT, paddingX);
        const rendered = editor.render(width);

        // No autocomplete is ever triggered here, so the editor emits exactly
        // [top border, ...text rows, bottom border]; text rows = length - 2.
        const expectedTextRows = rendered.length - 2;

        expect(internals(new VisualHighlightRenderer(editor)).getVisibleTextRowCount(rendered)).toBe(expectedTextRows);
      });

      it(`every rendered row is exactly width wide (width=${width}, paddingX=${paddingX})`, () => {
        const rendered = makeEditor(WRAPPING_TEXT, paddingX).render(width);

        for (const line of rendered) {
          expect(visibleWidth(crayon.stripAnsi(line))).toBe(width);
        }
      });
    }
  }
});

describe('VisualHighlightRenderer overlay', () => {
  it('does not highlight trailing padding for visual-line ranges', () => {
    const editor = makeEditor('hello\nworld', 1);
    const lines = editor.render(40);

    const range = {
      type: 'line',
      ranges: [{ line: 0, startCol: 0, endCol: 5 }],
    } as unknown as EditorAnchoredRange;

    new VisualHighlightRenderer(editor).render({
      lines,
      width: 40,
      range,
      style: (text: string) => `⟦${text}⟧`,
    });

    const selectedRow = lines[1] ?? '';
    expect(selectedRow).toContain('⟦hello⟧');
    expect(selectedRow.match(/⟦/g)?.length).toBe(1);
  });

  for (const paddingX of PADDINGS) {
    for (const width of WIDTHS) {
      it(`preserves row width after highlighting (width=${width}, paddingX=${paddingX})`, () => {
        const editor = makeEditor(WRAPPING_TEXT, paddingX);
        const lines = editor.render(width);

        // Select the entire first logical line; renderer only reads type + ranges.
        const firstLineLength = editor.getLines()[0]?.length ?? 0;
        const range = {
          type: 'cursor',
          ranges: [{ line: 0, startCol: 0, endCol: firstLineLength }],
        } as unknown as EditorAnchoredRange;

        new VisualHighlightRenderer(editor).render({
          lines,
          width,
          range,
          style: (text: string) => text, // identity style keeps widths exact
        });

        for (const line of lines) {
          expect(visibleWidth(crayon.stripAnsi(line))).toBe(width);
        }
      });
    }
  }
});

/**
 * omp host format: no getPaddingX, rows carry box side chrome, and the bottom
 * border is fused into the last text row. The renderer must preserve that
 * chrome (any glyph/styling) while swapping only the content region.
 */
function ompRow(leftChrome: string, content: string, rightChrome: string, width = 20): string {
  const pad = width - visibleWidth(leftChrome) - visibleWidth(content) - visibleWidth(rightChrome);
  return leftChrome + content + ' '.repeat(Math.max(0, pad)) + rightChrome;
}

class OmpEditorDouble {
  focused = true;
  private readonly lines: string[];

  constructor(
    text: string,
    private readonly cursor: { line: number; col: number },
  ) {
    this.lines = text.split('\n');
  }

  getCursor(): { line: number; col: number } {
    return this.cursor;
  }

  getLines(): string[] {
    return [...this.lines];
  }

  getText(): string {
    return this.lines.join('\n');
  }

  isShowingAutocomplete(): boolean {
    return false;
  }
}

function makeRange(line: number, startCol: number, endCol: number): EditorAnchoredRange {
  return {
    type: 'cursor',
    anchor: { line, col: startCol },
    cursor: { line, col: endCol },
    start: { line, col: startCol },
    end: { line, col: endCol },
    ranges: [{ line, startCol, endCol }],
  } as EditorAnchoredRange;
}

describe('VisualHighlightRenderer on omp row format', () => {
  it('does not throw and preserves the fused bottom-border chrome', () => {
    const editor = new OmpEditorDouble('hello world', { line: 0, col: 11 }) as unknown as Editor;
    const lines = ['╭──────────────────╮', ompRow('╰─ ', 'hello world', ' ─╯')];

    new VisualHighlightRenderer(editor).render({
      lines,
      width: 20,
      range: makeRange(0, 0, 5),
      style: text => `[${text}]`,
    });

    const row = lines[1] ?? '';
    expect(row.startsWith('╰─ ')).toBe(true);
    expect(row.endsWith(' ─╯')).toBe(true);
    expect(row).toContain('[hello]');
  });

  it('preserves side chrome on middle rows and highlights the selection', () => {
    const editor = new OmpEditorDouble('one\ntwo', { line: 0, col: 0 }) as unknown as Editor;
    const lines = ['╭──────────────────╮', ompRow('│  ', 'one', '  │'), ompRow('╰─ ', 'two', ' ─╯')];

    new VisualHighlightRenderer(editor).render({
      lines,
      width: 20,
      range: makeRange(1, 0, 2),
      style: text => `[${text}]`,
    });

    const middle = lines[1] ?? '';
    expect(middle.startsWith('│  ')).toBe(true);
    expect(middle.endsWith('  │')).toBe(true);

    const fused = lines[2] ?? '';
    expect(fused.startsWith('╰─ ')).toBe(true);
    expect(fused.endsWith(' ─╯')).toBe(true);
    expect(fused).toContain('[tw]o');
  });

  it('preserves total row width under a width-neutral style', () => {
    const editor = new OmpEditorDouble('one\ntwo', { line: 0, col: 0 }) as unknown as Editor;
    const lines = ['╭──────────────────╮', ompRow('│  ', 'one', '  │'), ompRow('╰─ ', 'two', ' ─╯')];

    new VisualHighlightRenderer(editor).render({
      lines,
      width: 20,
      range: makeRange(1, 0, 2),
      style: text => `\x1b[7m${text}\x1b[0m`, // ANSI-only: adds no visible cells
    });

    for (const line of lines) {
      expect(visibleWidth(crayon.stripAnsi(line))).toBe(20);
    }
  });
});
