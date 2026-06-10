import { CustomEditor, type KeybindingsManager, type Theme } from '@earendil-works/pi-coding-agent';
import { type EditorTheme, matchesKey, parseKey, type TUI, truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';
import type { ConfigLoader } from './config-loader';
import { DEFAULT_LEADER_KEY } from './constants';
import { EditorCompassController } from './editor/editor-compass-controller';
import { HardwareCursorController } from './editor/hardware-cursor-controller';
import { MovementController } from './editor/movement-controller';
import { TextEditController } from './editor/text-edit-controller';
import { VisualHighlightRenderer } from './editor/visual-highlight-renderer';
import { KeySequencer } from './key-sequencer';
import { MultiCharKeySequence } from './key-sequencer/strategies/multi-char-sequence';
import { SchemaBasedKeySequence } from './key-sequencer/strategies/schema-based-sequence';
import { TimeBasedKeySequence } from './key-sequencer/strategies/time-based-sequence';
import { CharOnlyKeySchema } from './schemas/key.schema';
import { AppKeybindingSchema } from './schemas/keybind.schema';
import type { VimMode } from './types';
import { crayon } from './utils/crayon.util';
import { logKeyInput } from './utils/debug-input.util';
import { formatModeLabel, isVisualMode } from './utils/vim-mode.util';

const DEBUG_INPUT = false;

type VimModalEditorOpts = {
  config: ConfigLoader;
  getTheme: () => Theme;
  emitEvent: (channel: string, data: unknown) => void;
};

export class VimModalEditor extends CustomEditor {
  private mode: VimMode = 'normal';
  private keySeq: Record<VimMode, KeySequencer> = {
    normal: new KeySequencer(),
    insert: new KeySequencer(),
    visual: new KeySequencer(),
    visualLine: new KeySequencer(),
  };
  readonly config: ConfigLoader;
  private readonly getTheme: () => Theme;
  private readonly emitEvent: (channel: string, data: unknown) => void;
  private readonly movement: MovementController;
  private readonly textEdit: TextEditController;
  private readonly compass: EditorCompassController;
  private readonly visualHighlight: VisualHighlightRenderer;
  private readonly hardwareCursor: HardwareCursorController;

  kb: KeybindingsManager;

  constructor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager, opts: VimModalEditorOpts) {
    super(tui, theme, keybindings);
    this.kb = keybindings;
    this.config = opts.config;
    this.getTheme = opts.getTheme;
    this.emitEvent = opts.emitEvent;
    this.movement = new MovementController(this);
    this.textEdit = new TextEditController(this);
    this.compass = new EditorCompassController(this);
    this.visualHighlight = new VisualHighlightRenderer(this);
    this.hardwareCursor = new HardwareCursorController(tui);
    this.hardwareCursor.apply(this.mode);
    this.registerInsertModeSequences();
    this.registerNormalModeSequences();
    this.registerVisualModeSequences();
    this.registerVisualLineModeSequences();
  }

  get modeLabel(): string {
    return formatModeLabel(this.mode, this.keySeq[this.mode]?.pendingKey ?? undefined);
  }

  private setMode(mode: VimMode): boolean {
    const currentMode = this.mode;
    if (currentMode === mode) return false;

    if (isVisualMode(currentMode)) {
      this.compass.clearAnchor();
    }

    if (isVisualMode(mode)) {
      const anchorType = mode === 'visualLine' ? 'line' : 'cursor';
      this.compass.anchor(anchorType);
    }

    this.mode = mode;
    this.hardwareCursor.apply(this.mode);
    this.tui.requestRender();
    return true;
  }

  cleanup(): void {
    this.hardwareCursor.restore();
  }

  override render(width: number): string[] {
    const lines = super.render(width);
    this.hardwareCursor.stripFakeCursor(lines);

    if (isVisualMode(this.mode)) {
      this.visualHighlight.render({
        lines,
        width,
        range: this.compass.getAnchoredRange(),
        style: text => this.getTheme().bg('selectedBg', text),
      });
    }

    const borderLineIndex = this.findBottomBorderLineIndex(lines);

    if (borderLineIndex === -1) return lines;

    const borderLine = lines[borderLineIndex];
    if (borderLine === undefined) return lines;

    lines[borderLineIndex] = this.renderModeOnBorder(borderLine, width);
    return lines;
  }

  override handleInput(data: string): void {
    if (DEBUG_INPUT) logKeyInput(data, `cursor=${JSON.stringify(this.getCursor())}`);

    switch (this.mode) {
      case 'insert': {
        this.handleInsertMode(data);
        return;
      }
      case 'normal': {
        this.handleNormalMode(data);
        return;
      }
      case 'visual': {
        this.handleVisualMode(data);
        return;
      }
      case 'visualLine': {
        this.handleVisualLineMode(data);
        return;
      }
      default: {
        super.handleInput(data);
        return;
      }
    }
  }

  private handleInsertMode(data: string): void {
    const { result } = this.keySeq.insert.match(data);

    if (result === 'completed') {
      if (this.config.toNormalModeSequence.sequences.length > 0) {
        // delete char when toNormal Mode Has Sequence
        // for example keybind -> `kj`
        // on k text is written  on j sequence will execute so delete first inital key taht was meant for the sequence
        this.textEdit.delete('backward', { saveToRegister: false });
      }
      // move back to mimic vim cursor
      // unless we are at start of line
      if (this.getCursor().col > 0) {
        this.movement.move('left');
      }
      this.setMode('normal');
      return;
    }

    super.handleInput(data);
  }

  private handleNormalMode(data: string): void {
    const { result, matched } = this.keySeq.normal.match(data);

    if (result === 'pending') {
      this.tui.requestRender();
      return;
    }

    if (result === 'completed' && matched) {
      this.tui.requestRender();

      if (matched.leader === DEFAULT_LEADER_KEY && matched?.seqKey) {
        this.handleActionCommands(matched.seqKey, true);
        return;
      }
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

      if (matched.leader === 'd' && matched?.seqKey) {
        if (this.handlePendingD(matched.seqKey)) return;
      }

      if (matched.leader === 'y' && matched?.seqKey) {
        if (this.handlePendingY(matched.seqKey)) return;
      }
    }

    if (this.handleBackToInsertMode(data)) return;
    if (data === 'v' && this.setMode('visual')) return;
    if (data === 'V' && this.setMode('visualLine')) return;
    if (this.handleMovementCommand(data)) return;
    if (this.handleNormalEditComands(data)) return;

    // submits input
    if (matchesKey(data, 'enter')) {
      super.handleInput('\r');
      return;
    }
    // handle app actions key bindings
    const parsed = parseKey(data);
    if (parsed && this.handleActionCommands(parsed, false)) return;
  }

  private handleVisualMode(data: string): void {
    const { result, matched } = this.keySeq.visual.match(data);

    if (result === 'pending') {
      this.tui.requestRender();
      return;
    }

    if (result === 'completed' && matched) {
      this.tui.requestRender();
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

    if (this.handleEscapeVisualCommand(data)) return;
    if (this.handleMovementCommand(data)) return;
    if (this.handleVisualEditCommands(data)) return;
  }

  private handleVisualLineMode(data: string): void {
    const { result, matched } = this.keySeq.visualLine.match(data);

    if (result === 'pending') {
      this.tui.requestRender();
      return;
    }

    if (result === 'completed' && matched) {
      this.tui.requestRender();
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

    if (this.handleEscapeVisualCommand(data)) return;
    if (this.handleMovementCommand(data)) return;
    if (this.handleVisualEditCommands(data)) return;
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
        this.movement.move('right');
        this.setMode('insert');
        return true;
      }
      case 'A': {
        this.movement.leap('end', 'line');
        this.setMode('insert');
        return true;
      }
      case 'o': {
        this.textEdit.newLine('down');
        this.setMode('insert');
        return true;
      }
      case 'O': {
        this.textEdit.newLine('up');
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

  private handleNormalEditComands(data: string): boolean {
    if (data === 'x') return this.textEdit.delete('forward');
    if (data === 'X') return this.textEdit.delete('backward');
    if (data === 'u') return this.textEdit.undo();
    if (data === 'U') return this.textEdit.redo();
    if (data === 'p') return this.textEdit.paste('forward');
    if (data === 'P') return this.textEdit.paste('backward');
    return false;
  }

  private handleVisualEditCommands(data: string): boolean {
    if (['x', 'd'].includes(data)) {
      const range = this.compass.getAnchoredRange();
      if (!range) return false;
      this.textEdit.deleteRange(range);
      return this.setMode('normal');
    }

    if (data === 'y') {
      const range = this.compass.getAnchoredRange();
      if (!range) return false;
      this.textEdit.yankRange(range);
      return this.setMode('normal');
    }

    if (data === 'p') {
      const range = this.compass.getAnchoredRange();
      if (!range) return false;
      this.textEdit.deleteRange(range, { saveToRegister: false });
      this.textEdit.paste('forward');
      return this.setMode('normal');
    }

    return false;
  }

  private handleEscapeVisualCommand(data: string): boolean {
    if (matchesKey(data, 'escape')) return this.setMode('normal');

    if (this.mode === 'visual') {
      if (data === 'v') return this.setMode('normal');
      if (data === 'V') return this.setMode('visualLine');
    }

    if (this.mode === 'visualLine') {
      if (data === 'v') return this.setMode('visual');
      if (data === 'V') return this.setMode('normal');
    }

    return false;
  }

  private handlePendingG(data: string): boolean {
    if (data === 'g') return this.movement.leap('start', 'page');
    if (data === 'e') return this.movement.jumpWord('backward', { pos: 'end', includePunctuation: false });
    if (data === 'E') return this.movement.jumpWord('backward', { pos: 'end', includePunctuation: true });
    return false;
  }

  private handlePendingD(data: string): boolean {
    if (data === 'd') return this.textEdit.deleteLine();
    return false;
  }

  private handlePendingY(data: string): boolean {
    if (data === 'y') return this.textEdit.yankLine();
    return false;
  }

  private handleActionCommands(data: string, leaderKey: boolean): boolean {
    const bind = this.config.getActionKeybindingForKey({ key: data, leaderKey });
    if (!bind) return false;
    const { success, data: parsed } = AppKeybindingSchema.safeParse(bind);
    if (success && data) {
      const handler = this.actionHandlers.get(parsed);
      handler?.();
      return true;
    }
    this.emitEvent(bind, '');
    return true;
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

  private registerInsertModeSequences() {
    this.keySeq.insert.register(new TimeBasedKeySequence(this.config.toNormalModeSequence));
  }

  private registerNormalModeSequences() {
    this.keySeq.normal.register(new TimeBasedKeySequence(this.config.leaderKeyAppKeySequences)); //leader key actions
    this.keySeq.normal.register(new SchemaBasedKeySequence({ leader: 'f', schema: CharOnlyKeySchema }));
    this.keySeq.normal.register(new SchemaBasedKeySequence({ leader: 'F', schema: CharOnlyKeySchema }));
    this.keySeq.normal.register(new MultiCharKeySequence({ leader: 'g', sequences: ['g', 'e', 'E'] }));
    this.keySeq.normal.register(new MultiCharKeySequence({ leader: 'd', sequences: ['d'] }));
    this.keySeq.normal.register(new MultiCharKeySequence({ leader: 'y', sequences: ['y'] }));
  }

  private registerVisualModeSequences() {
    this.keySeq.visual.register(new SchemaBasedKeySequence({ leader: 'f', schema: CharOnlyKeySchema }));
    this.keySeq.visual.register(new SchemaBasedKeySequence({ leader: 'F', schema: CharOnlyKeySchema }));
    this.keySeq.visual.register(new MultiCharKeySequence({ leader: 'g', sequences: ['g', 'e', 'E'] }));
  }

  private registerVisualLineModeSequences() {
    this.keySeq.visualLine.register(new SchemaBasedKeySequence({ leader: 'f', schema: CharOnlyKeySchema }));
    this.keySeq.visualLine.register(new SchemaBasedKeySequence({ leader: 'F', schema: CharOnlyKeySchema }));
    this.keySeq.visualLine.register(new MultiCharKeySequence({ leader: 'g', sequences: ['g', 'e', 'E'] }));
  }
}
