import { describe, expect, it } from 'bun:test';
import type { Theme } from '@earendil-works/pi-coding-agent';
import {
  CURSOR_MARKER,
  type EditorTheme,
  KeybindingsManager,
  setKeybindings,
  TUI_KEYBINDINGS,
  TuiMainScreen,
  visibleWidth,
} from '@earendil-works/pi-tui';
import { ConfigLoader } from '../src/config-loader';
import { crayon } from '../src/utils/crayon.util';
import { VimModalEditor } from '../src/vim-modal-editor';

const editorTheme: EditorTheme = {
  borderColor: (text: string) => text,
  selectList: {
    selectedPrefix: text => text,
    selectedText: text => text,
    description: text => text,
    scrollInfo: text => text,
    noMatch: text => text,
  },
};
const theme = { bg: (_name: string, text: string) => `\x1b[48;2;80;80;80m${text}\x1b[49m` } as unknown as Theme;

function makeEditor(text = 'one\ntwo\nthree', hardwareCursor = false) {
  const terminal = { rows: 8, columns: 120, write() {}, on() {}, off() {}, hideCursor() {}, showCursor() {} };
  const tui = new TuiMainScreen(terminal as unknown as ConstructorParameters<typeof TuiMainScreen>[0], hardwareCursor);
  const keybindings = new KeybindingsManager(TUI_KEYBINDINGS);
  setKeybindings(keybindings);
  const editor = new VimModalEditor(tui, editorTheme, keybindings as unknown as ConstructorParameters<typeof VimModalEditor>[2], {
    config: new ConfigLoader(),
    getTheme: () => theme,
    emitEvent: () => {},
  });
  editor.setText(text);
  editor.focused = true;
  return { editor, tui };
}

function plain(line: string): string {
  return crayon.stripAnsi(line);
}

function assertWidth(lines: string[], width: number): void {
  for (const line of lines) expect(visibleWidth(plain(line))).toBe(width);
}

function bottom(editor: VimModalEditor, width: number): string {
  const lines = editor.render(width);
  return plain(lines[lines.length - 1] ?? '');
}

describe('VimModalEditor render integration', () => {
  it('puts every mode label on the Pi bottom border', () => {
    const { editor } = makeEditor();
    expect(bottom(editor, 40)).toContain(plain(editor.modeLabel));
    editor.handleInput('i');
    expect(bottom(editor, 40)).toContain(plain(editor.modeLabel));
    editor.handleInput('\x1b');
    editor.handleInput('v');
    expect(bottom(editor, 40)).toContain(plain(editor.modeLabel));
    editor.handleInput('V');
    expect(bottom(editor, 40)).toContain(plain(editor.modeLabel));
  });

  it('shows pending normal-mode chords beside the mode label', () => {
    const { editor } = makeEditor();
    editor.handleInput('d');
    const border = bottom(editor, 40);
    expect(border).toContain(plain(editor.modeLabel));
    expect(border).toContain('d');
  });

  it('retains Pi scroll indicators alongside the mode label', () => {
    const { editor } = makeEditor(Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n'));
    for (let i = 0; i < 15; i++) editor.handleInput('k');
    const lines = editor.render(20).map(plain);
    expect(lines[0]).toContain('↑');
    expect(lines.at(-1)).toContain('↓');
    expect(lines.at(-1)).toContain(plain(editor.modeLabel));
  });

  for (const padding of [0, 1, 2]) {
    for (const width of [10, 20, 40, 80, 120]) {
      it(`preserves exact row widths (${width}, padding ${padding})`, () => {
        const { editor } = makeEditor('short\na longer line that wraps across rows\ntail');
        editor.setPaddingX(padding);
        assertWidth(editor.render(width), width);
      });
    }
  }

  it('keeps visual highlights aligned after scrolling and width changes', () => {
    const { editor } = makeEditor(Array.from({ length: 40 }, (_, i) => `row ${i}`).join('\n'));
    for (let i = 0; i < 15; i++) editor.handleInput('k');
    editor.handleInput('v');
    editor.handleInput('j');
    const narrow = editor.render(20);
    const selected = narrow.filter(line => line.includes('\x1b[48;2;80;80;80m'));
    expect(selected.length).toBeGreaterThan(0);
    const wide = editor.render(100);
    expect(wide.filter(line => line.includes('\x1b[48;2;80;80;80m')).length).toBeGreaterThan(0);
    assertWidth(wide, 100);
  });

  it('keeps autocomplete rows and bottom mode border correctly sized', async () => {
    const { editor } = makeEditor('h');
    editor.setAutocompleteProvider({
      triggerCharacters: ['h'],
      async getSuggestions() {
        return {
          items: [
            { value: 'hello', label: 'hello' },
            { value: 'hi', label: 'hi' },
          ],
          prefix: 'h',
        };
      },
      shouldTriggerFileCompletion: () => true,
      applyCompletion(lines) {
        return { lines, cursorLine: 0, cursorCol: 1 };
      },
    });
    editor.handleInput('i');
    editor.handleInput('\t');
    await new Promise(resolve => setTimeout(resolve, 25));
    const lines = editor.render(40);
    expect(editor.isShowingAutocomplete()).toBe(true);
    expect(lines.some(line => plain(line).includes(plain(editor.modeLabel)))).toBe(true);
    assertWidth(lines, 40);
  });

  it('highlights visual and visual-line selections without line padding artifacts', () => {
    const { editor } = makeEditor('alpha\nbeta\ngamma');
    editor.handleInput('k');
    editor.handleInput('v');
    editor.handleInput('j');
    const visual = editor.render(40);
    expect(visual.map(plain).join('\n')).toContain('alpha');
    expect(visual.some(line => line.includes('\x1b[48;2;80;80;80m'))).toBe(true);

    editor.handleInput('\x1b');
    editor.handleInput('V');
    const line = editor.render(40).find(row => plain(row).includes('gamma')) ?? '';
    expect(line.split('\x1b[48;2;80;80;80m').length - 1).toBe(1);
  });

  it('strips the fake cursor only when hardware cursor is enabled', () => {
    const hardware = makeEditor('cursor', true).editor;
    const fake = makeEditor('cursor', false).editor;
    hardware.focused = true;
    fake.focused = true;
    const hardwareLines = hardware.render(30);
    const fakeLines = fake.render(30);
    const hardwareCursorLine = hardwareLines.find(line => line.includes(CURSOR_MARKER)) ?? '';
    const fakeCursorLine = fakeLines.find(line => line.includes(CURSOR_MARKER)) ?? '';
    expect(hardwareCursorLine).toContain(CURSOR_MARKER);
    expect(hardwareCursorLine).not.toContain('\x1b[7m');
    expect(fakeCursorLine).toContain(CURSOR_MARKER);
    expect(fakeCursorLine).toContain('\x1b[7m');
  });
});
