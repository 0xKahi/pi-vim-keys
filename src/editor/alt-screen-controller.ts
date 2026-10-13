import { type TUI, TuiAltScreen } from '@earendil-works/pi-tui';

// Pi does not expose these fullscreen members publicly. Keep the unsafe view
// here and feature-detect them so upstream changes degrade to a fallback/no-op.
type AltScreenInternals = {
  getPrimaryScrollView?: unknown;
  toggleSearch?: unknown;
  activeSearch?: unknown;
};

export class AltScreenController {
  constructor(private readonly tui: TUI) {}

  isAvailable(): boolean {
    // The editor's TUI proxy can change renderer at runtime; never cache this.
    return this.tui instanceof TuiAltScreen;
  }

  scrollLines(n: number): boolean {
    if (!this.isAvailable()) return false;

    (this.tui as TuiAltScreen).scrollBy(n);
    this.tui.requestRender();
    return true;
  }

  scrollHalfPage(dir: 1 | -1): boolean {
    if (!this.isAvailable()) return false;

    const internal = this.tui as unknown as AltScreenInternals;
    const height = typeof internal.getPrimaryScrollView === 'function' ? internal.getPrimaryScrollView()?.viewportHeight : undefined;
    const amount = Math.max(1, Math.floor((typeof height === 'number' ? height : this.tui.terminal.rows) / 2));
    return this.scrollLines(dir * amount);
  }

  scrollToTop(): boolean {
    if (!this.isAvailable()) return false;

    (this.tui as TuiAltScreen).scrollToTop();
    this.tui.requestRender();
    return true;
  }

  scrollToBottom(): boolean {
    if (!this.isAvailable()) return false;

    (this.tui as TuiAltScreen).scrollToBottom();
    this.tui.requestRender();
    return true;
  }

  openSearch(): boolean {
    if (!this.isAvailable()) return false;

    const internal = this.tui as unknown as AltScreenInternals;
    // toggleSearch closes an existing search, so only invoke it when inactive.
    if (internal.activeSearch || typeof internal.toggleSearch !== 'function') return false;

    internal.toggleSearch();
    this.tui.requestRender();
    return true;
  }
}
