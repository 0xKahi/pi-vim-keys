import { describe, expect, it } from 'bun:test';
import type { TUI } from '@earendil-works/pi-tui';
import { HardwareCursorController } from '../src/editor/hardware-cursor-controller';

function makeController(hardwareCursor = true) {
  const writes: string[] = [];
  const tui = {
    getShowHardwareCursor: () => hardwareCursor,
    terminal: { write: (data: string) => writes.push(data) },
  } as unknown as TUI;
  return { controller: new HardwareCursorController(tui), writes };
}

describe('HardwareCursorController replace mode', () => {
  it('emits the replace underline shape on apply', () => {
    const { controller, writes } = makeController();

    controller.apply('replace');

    expect(writes).toEqual(['\x1b[4 q']);
  });

  it('uses a shape distinct from normal and insert', () => {
    const replace = makeController();
    const normal = makeController();
    const insert = makeController();

    replace.controller.apply('replace');
    normal.controller.apply('normal');
    insert.controller.apply('insert');

    expect(replace.writes).not.toEqual(normal.writes);
    expect(replace.writes).not.toEqual(insert.writes);
  });

  it('returns to the next mode shape after replace', () => {
    const { controller, writes } = makeController();

    controller.apply('replace');
    controller.apply('normal');

    expect(writes).toEqual(['\x1b[4 q', '\x1b[2 q']);
  });
});
