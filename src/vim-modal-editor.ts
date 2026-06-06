import { CustomEditor, type KeybindingsManager } from '@earendil-works/pi-coding-agent';
import { type EditorTheme, type TUI, truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';
import type { ConfigLoader } from './config-loader';
import { KeySequencer } from './key-sequencer';
import { MultiCharKeySequence } from './key-sequencer/strategies/multi-char-sequence';
import { SchemaBasedKeySequence } from './key-sequencer/strategies/schema-based-sequence';
import { TimeBasedKeySequence } from './key-sequencer/strategies/time-based-sequence';
import { CharOnlyKeySchema } from './schemas/key.schema';
import type { VimMode } from './types';
import { crayon } from './utils/crayon.util';
import { MovementController } from './utils/editor/movement-controller.util';

type VimModalEditorOpts = {
  config: ConfigLoader;
};

export class VimModalEditor extends CustomEditor {
  private mode: VimMode = 'normal';
  private keySeq = {
    normal: new KeySequencer(),
    insert: new KeySequencer(),
  };
  readonly config: ConfigLoader;
  private readonly movement: MovementController;

  kb: KeybindingsManager;

  constructor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager, opts: VimModalEditorOpts) {
    super(tui, theme, keybindings);
    this.kb = keybindings;
    this.config = opts.config;
    this.movement = new MovementController(this);
    this.registerInsertModeSequences();
    this.registerNormalModeSequences();
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
    const { result, matched } = this.keySeq.normal.match(data);

    if (result === 'pending') {
      return;
    }

    if (result === 'completed' && matched) {
      if (matched.leader === 'f') {
        this.movement.findChar('forward', data);
        return;
      }

      if (matched.leader === 'F') {
        this.movement.findChar('backward', data);
        return;
      }

      if (matched.leader === 'g' && matched?.seqKey) {
        if (this.handlePendingG(matched.seqKey)) return;
      }
    }

    if (this.handleBackToInsertMode(data)) return;
    if (this.handleMovementCommand(data)) return;
  }

  private handleInsertMode(data: string): void {
    const { result } = this.keySeq.insert.match(data);

    if (result === 'completed') {
      this.setMode('normal');
      return;
    }

    super.handleInput(data);
  }

  private handleBackToInsertMode(data: string): boolean {
    switch (data) {
      case 'i': {
        this.setMode('insert');
        return true;
      }
      case 'I': {
        this.movement.leap('start', 'line');
        this.setMode('insert');
        return true;
      }
      case 'a': {
        this.movement.move('left');
        this.setMode('insert');
        return true;
      }
      case 'A': {
        this.movement.leap('end', 'line');
        this.setMode('insert');
        return true;
      }
      default:
        return false;
    }
  }

  private handleMovementCommand(data: string): boolean {
    switch (data) {
      case 'h':
        return this.movement.move('left');
      case 'j':
        return this.movement.move('down');
      case 'k':
        return this.movement.move('up');
      case 'l':
        return this.movement.move('right');
      case 'w':
        return this.movement.jumpWord('forward', { pos: 'start', includePunctuation: false });
      case 'W':
        return this.movement.jumpWord('forward', { pos: 'start', includePunctuation: true });
      case 'b':
        return this.movement.jumpWord('backward', { pos: 'start', includePunctuation: false });
      case 'B':
        return this.movement.jumpWord('backward', { pos: 'start', includePunctuation: true });
      case 'e':
        return this.movement.jumpWord('forward', { pos: 'end', includePunctuation: false });
      case 'E':
        return this.movement.jumpWord('forward', { pos: 'end', includePunctuation: true });
      case '0':
        return this.movement.leap('start', 'line');
      case '$':
        return this.movement.leap('end', 'line');
      case 'G':
        return this.movement.leap('end', 'page');
      default:
        return false;
    }
  }

  private handlePendingG(data: string): boolean {
    if (data === 'g') return this.movement.leap('start', 'page');
    if (data === 'e') return this.movement.jumpWord('backward', { pos: 'end', includePunctuation: false });
    if (data === 'E') return this.movement.jumpWord('backward', { pos: 'end', includePunctuation: true });
    return false;
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

  private registerNormalModeSequences() {
    this.keySeq.normal.register(new TimeBasedKeySequence(this.config.leaderKeyAppKeySequences));
    this.keySeq.normal.register(new SchemaBasedKeySequence({ leader: 'f', schema: CharOnlyKeySchema }));
    this.keySeq.normal.register(new SchemaBasedKeySequence({ leader: 'F', schema: CharOnlyKeySchema }));
    this.keySeq.normal.register(new MultiCharKeySequence({ leader: 'g', sequences: ['g', 'e', 'E'] }));
  }

  private registerInsertModeSequences() {
    this.keySeq.insert.register(new TimeBasedKeySequence(this.config.toNormalModeSequence));
  }
}
