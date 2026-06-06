import { CURSOR_MARKER, type TUI } from '@earendil-works/pi-tui';
import type { VimMode } from '../../types';

const HARDWARE_CURSOR_SHAPES = {
  normal: '\x1b[2 q', // steady block
  insert: '\x1b[6 q', // steady vertical bar
  visual: '\x1b[2 q', // steady block
  visualLine: '\x1b[2 q', // steady block
} satisfies Record<VimMode, string>;

const RESET_HARDWARE_CURSOR_SHAPE = '\x1b[0 q';
const FAKE_CURSOR_STYLE_START = '\x1b[7m';
const FAKE_CURSOR_STYLE_ENDS = ['\x1b[0m', '\x1b[27m'];

export class HardwareCursorController {
  private lastAppliedShape?: string;

  constructor(private readonly tui: TUI) {}

  apply(mode: VimMode): void {
    if (!this.tui.getShowHardwareCursor()) {
      this.restore();
      return;
    }

    const shape = HARDWARE_CURSOR_SHAPES[mode];
    if (shape === this.lastAppliedShape) return;

    this.tui.terminal.write(shape);
    this.lastAppliedShape = shape;
  }

  restore(): void {
    if (this.lastAppliedShape === undefined) return;

    this.tui.terminal.write(RESET_HARDWARE_CURSOR_SHAPE);
    this.lastAppliedShape = undefined;
  }

  stripFakeCursor(lines: string[]): void {
    if (!this.tui.getShowHardwareCursor()) return;

    for (const [index, line] of lines.entries()) {
      const markerIndex = line.indexOf(CURSOR_MARKER);
      if (markerIndex === -1) continue;

      lines[index] = this.stripFakeCursorAfterMarker(line, markerIndex);
      return;
    }
  }

  private stripFakeCursorAfterMarker(line: string, markerIndex: number): string {
    const cursorStyleStartIndex = markerIndex + CURSOR_MARKER.length;
    if (!line.startsWith(FAKE_CURSOR_STYLE_START, cursorStyleStartIndex)) return line;

    const cursorTextStartIndex = cursorStyleStartIndex + FAKE_CURSOR_STYLE_START.length;
    const styleEnd = this.findFakeCursorStyleEnd(line, cursorTextStartIndex);
    if (!styleEnd) return line;

    const cursorText = line.slice(cursorTextStartIndex, styleEnd.index);

    return `${line.slice(0, cursorStyleStartIndex)}${cursorText}${line.slice(styleEnd.index + styleEnd.sequence.length)}`;
  }

  private findFakeCursorStyleEnd(line: string, fromIndex: number): { index: number; sequence: string } | undefined {
    let result: { index: number; sequence: string } | undefined;

    for (const sequence of FAKE_CURSOR_STYLE_ENDS) {
      const index = line.indexOf(sequence, fromIndex);
      if (index === -1) continue;
      if (!result || index < result.index) result = { index, sequence };
    }

    return result;
  }
}
