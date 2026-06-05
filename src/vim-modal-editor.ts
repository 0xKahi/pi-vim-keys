import { CustomEditor, type KeybindingsManager } from '@earendil-works/pi-coding-agent';
import { type EditorTheme, type TUI, truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';
import type { ConfigLoader } from './config-loader';
import type { VimMode } from './types';
import { crayon } from './utils/crayon.util';
import { KeySequencer } from './utils/key-sequencer.util';

type VimModalEditorOpts = {
  config: ConfigLoader;
};

export class VimModalEditor extends CustomEditor {
  private mode: VimMode = 'normal';
  private keySeq: { toNormalMode: KeySequencer; appKeyBinds: KeySequencer };

  readonly config: ConfigLoader;

  kb: KeybindingsManager;

  constructor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager, opts: VimModalEditorOpts) {
    super(tui, theme, keybindings);
    this.kb = keybindings;
    this.config = opts.config;
    this.keySeq = {
      toNormalMode: new KeySequencer(this.config.toNormalModeSequence),
      appKeyBinds: new KeySequencer(this.config.leaderKeyAppKeySequences),
    };
  }

  get modeLabel(): string {
    if (this.mode === 'insert') return ' INSERT ';
    return ' NORMAL ';
  }

  private setMode(mode: VimMode) {
    if (this.mode === mode) return;

    this.mode = mode;
    this.tui.requestRender();
  }

  override render(width: number): string[] {
    const lines = super.render(width);
    const borderLineIndex = this.findBottomBorderLineIndex(lines);

    if (borderLineIndex === -1) return lines;

    const borderLine = lines[borderLineIndex];
    if (borderLine === undefined) return lines;

    lines[borderLineIndex] = this.renderModeOnBorder(borderLine, width);
    return lines;
  }

  override handleInput(data: string): void {
    if (this.mode === 'insert') {
      this.handleInsertMode(data);
      return;
    }

    super.handleInput(data);
  }

  private handleInsertMode(data: string): void {
    const matchedId = this.keySeq.toNormalMode.match(data);

    if (matchedId) {
      this.setMode('normal');
      return;
    }

    super.handleInput(data);
  }

  private renderModeOnBorder(borderLine: string, width: number): string {
    const label = crayon.reverseVideo(crayon.colorize(this.modeLabel, { fg: this.config.getModeColors(this.mode) }));
    const labelWidth = visibleWidth(label);
    const borderWidth = Math.max(0, width - labelWidth);

    if (borderWidth === 0) {
      return truncateToWidth(label, width, '');
    }

    return `${truncateToWidth(borderLine, borderWidth, '', true)}${label}`;
  }

  private findBottomBorderLineIndex(lines: string[]): number {
    for (let i = lines.length - 1; i >= 0; i--) {
      const plainLine = crayon.stripAnsi(lines[i] ?? '');
      if (plainLine.startsWith('─')) {
        return i;
      }
    }

    return -1;
  }
}
