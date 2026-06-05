import { CustomEditor, type KeybindingsManager } from '@earendil-works/pi-coding-agent';
import { type EditorTheme, type TUI, truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';
import type { ConfigLoader } from './config-loader';
import { KeySequencer } from './key-sequencer';
import { TimeBasedKeySequence } from './key-sequencer/strategies/time-based-sequnce';
import type { VimMode } from './types';
import { crayon } from './utils/crayon.util';

type VimModalEditorOpts = {
  config: ConfigLoader;
};

export class VimModalEditor extends CustomEditor {
  private mode: VimMode = 'normal';
  private keySeq: {
    normal: KeySequencer;
    insert: KeySequencer;
  };
  readonly config: ConfigLoader;

  kb: KeybindingsManager;

  constructor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager, opts: VimModalEditorOpts) {
    super(tui, theme, keybindings);
    this.kb = keybindings;
    this.config = opts.config;
    this.keySeq = {
      normal: new KeySequencer([new TimeBasedKeySequence(this.config.leaderKeyAppKeySequences)]),
      insert: new KeySequencer([new TimeBasedKeySequence(this.config.toNormalModeSequence)]),
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

    if (this.mode === 'normal') {
      this.handleNormalMode(data);
      return;
    }

    super.handleInput(data);
  }

  private handleNormalMode(data: string): void {
    const { result } = this.keySeq.normal.match(data);

    if (result === 'pending') {
      return;
    }

    if (data === 'i') {
      this.setMode('insert');
      return;
    }
  }

  private handleInsertMode(data: string): void {
    const { result } = this.keySeq.insert.match(data);

    if (result === 'completed') {
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
