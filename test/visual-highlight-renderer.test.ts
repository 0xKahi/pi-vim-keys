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
