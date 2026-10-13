import { describe, expect, it, mock } from 'bun:test';
import { type TUI, TuiAltScreen } from '@earendil-works/pi-tui';
import { AltScreenController } from '../src/editor/alt-screen-controller';

function makeController(fullscreen = true) {
  const methods = {
    terminal: { rows: 25 },
    scrollBy: mock((_n: number) => {}),
    scrollToTop: mock(() => {}),
    scrollToBottom: mock(() => {}),
    requestRender: mock(() => {}),
    getPrimaryScrollView: undefined as unknown,
    toggleSearch: undefined as unknown,
    activeSearch: undefined as unknown,
  };
  const tui = Object.assign(Object.create(fullscreen ? TuiAltScreen.prototype : Object.prototype), methods) as typeof methods;
  return { tui, controller: new AltScreenController(tui as unknown as TUI) };
}

describe('AltScreenController', () => {
  it('does nothing when the renderer is not fullscreen', () => {
    const { tui, controller } = makeController(false);
    tui.toggleSearch = mock(() => {});

    expect(controller.isAvailable()).toBe(false);
    expect(controller.scrollLines(1)).toBe(false);
    expect(controller.scrollHalfPage(1)).toBe(false);
    expect(controller.scrollToTop()).toBe(false);
    expect(controller.scrollToBottom()).toBe(false);
    expect(controller.openSearch()).toBe(false);
    expect(tui.scrollBy).not.toHaveBeenCalled();
    expect(tui.scrollToTop).not.toHaveBeenCalled();
    expect(tui.scrollToBottom).not.toHaveBeenCalled();
    expect(tui.toggleSearch).not.toHaveBeenCalled();
    expect(tui.requestRender).not.toHaveBeenCalled();
  });

  it('checks availability again after a renderer change', () => {
    const { tui, controller } = makeController();
    expect(controller.isAvailable()).toBe(true);
    Object.setPrototypeOf(tui, Object.prototype);
    expect(controller.isAvailable()).toBe(false);
    expect(controller.scrollLines(1)).toBe(false);
    expect(tui.requestRender).not.toHaveBeenCalled();
  });

  it('delegates line scrolling and requests rendering', () => {
    const { tui, controller } = makeController();
    expect(controller.scrollLines(1)).toBe(true);
    expect(controller.scrollLines(-1)).toBe(true);
    expect(tui.scrollBy.mock.calls).toEqual([[1], [-1]]);
    expect(tui.requestRender).toHaveBeenCalledTimes(2);
  });

  it('uses half the viewport height in either direction', () => {
    const { tui, controller } = makeController();
    tui.getPrimaryScrollView = function (this: typeof tui) {
      expect(this).toBe(tui);
      return { viewportHeight: 15 };
    };
    expect(controller.scrollHalfPage(1)).toBe(true);
    expect(controller.scrollHalfPage(-1)).toBe(true);
    expect(tui.scrollBy.mock.calls).toEqual([[7], [-7]]);
    expect(tui.requestRender).toHaveBeenCalledTimes(2);
  });

  it('falls back to half the terminal rows when viewport height is unavailable', () => {
    for (const getPrimaryScrollView of [undefined, 42, () => undefined, () => ({}), () => ({ viewportHeight: '15' })]) {
      const { tui, controller } = makeController();
      tui.getPrimaryScrollView = getPrimaryScrollView;
      expect(controller.scrollHalfPage(1)).toBe(true);
      expect(tui.scrollBy).toHaveBeenCalledWith(12);
      expect(tui.requestRender).toHaveBeenCalledTimes(1);
    }
  });

  it('scrolls at least one line for a tiny viewport or terminal', () => {
    const { tui, controller } = makeController();
    tui.getPrimaryScrollView = () => ({ viewportHeight: 0 });
    controller.scrollHalfPage(-1);
    tui.getPrimaryScrollView = undefined;
    tui.terminal.rows = 1;
    controller.scrollHalfPage(1);
    expect(tui.scrollBy.mock.calls).toEqual([[-1], [1]]);
  });

  it('delegates top and bottom scrolling and requests rendering', () => {
    const { tui, controller } = makeController();
    expect(controller.scrollToTop()).toBe(true);
    expect(controller.scrollToBottom()).toBe(true);
    expect(tui.scrollToTop).toHaveBeenCalledTimes(1);
    expect(tui.scrollToBottom).toHaveBeenCalledTimes(1);
    expect(tui.requestRender).toHaveBeenCalledTimes(2);
  });

  it('opens search when toggleSearch is available', () => {
    const { tui, controller } = makeController();
    const toggleSearch = mock(function (this: typeof tui) {
      expect(this).toBe(tui);
    });
    tui.toggleSearch = toggleSearch;
    expect(controller.openSearch()).toBe(true);
    expect(toggleSearch).toHaveBeenCalledTimes(1);
    expect(tui.requestRender).toHaveBeenCalledTimes(1);
  });

  it('does nothing when toggleSearch is missing or not a function', () => {
    const { tui, controller } = makeController();
    expect(controller.openSearch()).toBe(false);
    tui.toggleSearch = true;
    expect(controller.openSearch()).toBe(false);
    expect(tui.requestRender).not.toHaveBeenCalled();
  });

  it('does not toggle an already active search closed', () => {
    const { tui, controller } = makeController();
    const toggleSearch = mock(() => {});
    tui.toggleSearch = toggleSearch;
    tui.activeSearch = {};
    expect(controller.openSearch()).toBe(false);
    expect(toggleSearch).not.toHaveBeenCalled();
    expect(tui.requestRender).not.toHaveBeenCalled();
  });
});
