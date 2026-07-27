import { Editor } from '@earendil-works/pi-tui';
import type { EditorInternals, EditorState } from './types';

/**
 * oh-my-pi (omp) compatibility adapter.
 *
 * Pi's Editor keeps its text buffer and cursor in TypeScript-`private` fields,
 * which compile to plain runtime properties — so on pi, `getEditorInternals`
 * can simply cast the editor. oh-my-pi's `@oh-my-pi/pi-tui` Editor uses
 * ECMAScript-private fields (`#state`, `#moveCursor`), which are truly
 * inaccessible at runtime, so the same reads return `undefined` and every
 * motion/edit silently no-ops (see issue #16).
 *
 * This adapter reproduces the `EditorInternals` surface on top of omp's
 * PUBLIC Editor API:
 *
 * - Buffer reads: `getLines()` / `getCursor()`.
 * - Buffer writes: `setText()` (which natively fires `onChange`), then a
 *   cursor restore because `setText` anchors the cursor to the end.
 * - Cursor writes: synthetic legacy arrow-key input (`\x1b[C` / `\x1b[D`)
 *   dispatched to the BASE Editor implementation. omp's native cursor step is
 *   grapheme-aware and wraps across logical line boundaries, so walking
 *   left/right reaches any (line, col) exactly. Vertical arrows are only
 *   injected away from the buffer edges: omp's up/down handling switches to
 *   prompt-history navigation / line-end jumps on the first/last visual line,
 *   which must never fire from a vim motion.
 *
 * Fields the pi internals expose but omp keeps private are intentionally left
 * `undefined` — every consumer already degrades:
 * - `undoStack` / `pushUndoSnapshot` → TextEditController uses its own
 *   fallback undo stack (applySnapshot writes through this adapter).
 * - `onChange` → must stay undefined: omp's `setText` fires it natively, so
 *   forwarding it here would double-fire on every edit.
 * - `tui` → renders are driven by the host after input dispatch.
 * - `scrollOffset` / `lastWidth` → VisualHighlightRenderer has fallbacks.
 * - `segment` → TextEditController falls back to `Intl.Segmenter`.
 */

/** Legacy CSI arrow sequences; omp canonicalizes these to its cursor bindings. */
const ARROW = { left: '\x1b[D', right: '\x1b[C', up: '\x1b[A', down: '\x1b[B' } as const;

/** Array methods that mutate in place; routed through replaceBuffer. */
const MUTATING_ARRAY_METHODS: Record<string, true> = {
  copyWithin: true,
  fill: true,
  pop: true,
  push: true,
  reverse: true,
  shift: true,
  sort: true,
  splice: true,
  unshift: true,
};

export class OmpEditorInternalsAdapter implements EditorInternals {
  // Plugin-owned bookkeeping fields, mirroring pi's internal cursor state.
  preferredVisualCol: number | null = null;
  snappedFromCursorCol: number | null = null;
  lastAction: unknown = null;
  historyIndex = -1;

  private readonly stateProxy: EditorState;

  constructor(private readonly editor: Editor) {
    this.stateProxy = this.createStateProxy();
  }

  get focused(): boolean {
    const editor: unknown = this.editor;
    return typeof editor === 'object' && editor !== null && 'focused' in editor && editor.focused === true;
  }

  get state(): EditorState {
    return this.stateProxy;
  }

  /**
   * Mirrors pi-tui's moveCursor: vertical steps are delegated to the host's
   * own visual-line movement (one arrow per step, never past the buffer edge),
   * horizontal steps wrap across logical lines exactly like pi's.
   */
  moveCursor(deltaLine: number, deltaCol: number): void {
    this.lastAction = null;

    if (deltaLine !== 0) {
      const lines = this.editor.getLines();
      const { line } = this.editor.getCursor();
      const target = line + deltaLine;
      if (target >= 0 && target < lines.length) {
        this.inject(deltaLine > 0 ? ARROW.down : ARROW.up, Math.abs(deltaLine));
      }
    }

    if (deltaCol !== 0) {
      this.inject(deltaCol > 0 ? ARROW.right : ARROW.left, Math.abs(deltaCol));
    }
  }

  /**
   * Positions the cursor via synthetic left/right arrows. omp's native
   * horizontal step wraps across line boundaries, so the walk is exact and
   * monotone in the linear offset; vertical arrows are deliberately avoided
   * here (visual-line ambiguity + history-nav edge cases).
   */
  private setCursor(position: { line: number; col: number }): void {
    const lines = this.editor.getLines();
    const line = Math.max(0, Math.min(Math.max(0, lines.length - 1), Math.floor(position.line)));
    const col = Math.max(0, Math.min((lines[line] ?? '').length, Math.floor(position.col)));

    this.lastAction = null;
    this.preferredVisualCol = null;
    this.snappedFromCursorCol = null;

    const targetOffset = this.linearOffset(lines, line, col);

    // omp exposes moveToMessageStart() (pi's Editor type does not), so probe
    // before calling; without it the walk below still reaches (0, 0).
    if (targetOffset === 0) {
      const host: unknown = this.editor;
      if (typeof host === 'object' && host !== null && 'moveToMessageStart' in host && typeof host.moveToMessageStart === 'function') {
        host.moveToMessageStart();
        return;
      }
    }

    // Guard against divergence: the walk can need at most targetOffset steps
    // from the buffer start, so cap total steps generously above the distance.
    const from = this.editor.getCursor();
    let remaining = this.linearOffset(lines, from.line, from.col) + targetOffset + 8;
    while (remaining-- > 0) {
      const currentLines = this.editor.getLines();
      const current = this.editor.getCursor();
      const currentOffset = this.linearOffset(currentLines, current.line, current.col);
      if (currentOffset === targetOffset) return;
      this.inject(currentOffset < targetOffset ? ARROW.right : ARROW.left, 1);
    }
  }

  /** Offset treating each newline as one step; matches the wrap-on-arrow model. */
  private linearOffset(lines: string[], line: number, col: number): number {
    let offset = 0;
    for (let index = 0; index < line; index++) {
      offset += (lines[index] ?? '').length + 1;
    }
    return offset + col;
  }

  /**
   * Replaces the whole buffer through `setText` (which fires onChange
   * natively) and restores the cursor, clamped into the new buffer.
   */
  private replaceBuffer(lines: string[]): void {
    const before = this.editor.getCursor();
    this.editor.setText((lines.length === 0 ? [''] : lines).join('\n'));
    this.setCursor(before);
  }

  private createStateProxy(): EditorState {
    const adapter = this;
    const editor = this.editor;

    return new Proxy({} as EditorState, {
      get(_target, prop) {
        if (prop === 'lines') return adapter.createLinesProxy();
        const { line, col } = editor.getCursor();
        if (prop === 'cursorLine') return line;
        if (prop === 'cursorCol') return col;
        return undefined;
      },
      set(_target, prop, value) {
        if (prop === 'lines') {
          adapter.replaceBuffer(Array.isArray(value) ? (value as string[]) : ['']);
          return true;
        }
        const { line, col } = editor.getCursor();
        if (prop === 'cursorLine') {
          adapter.setCursor({ line: Number(value), col });
          return true;
        }
        if (prop === 'cursorCol') {
          adapter.setCursor({ line, col: Number(value) });
          return true;
        }
        return false;
      },
    });
  }

  /**
   * Live, write-through view of the buffer. Reads snapshot from `getLines()`;
   * writes (index assignment, length, and mutating methods like `splice`)
   * apply to a copy that is committed with `setText`.
   */
  private createLinesProxy(): string[] {
    const adapter = this;
    const editor = this.editor;

    return new Proxy([] as string[], {
      get(_target, prop) {
        const lines = editor.getLines();
        if (prop === 'length') return lines.length;
        if (typeof prop === 'string' && prop in MUTATING_ARRAY_METHODS) {
          return (...args: unknown[]) => {
            const next = [...editor.getLines()];
            // Guarded by the MUTATING_ARRAY_METHODS membership check above;
            // every Array carries these on its prototype.
            const mutate = next as unknown as Record<string, unknown>;
            const method = mutate[prop];
            if (typeof method !== 'function') return undefined;
            const result = Reflect.apply(method, next, args);
            adapter.replaceBuffer(next);
            return result;
          };
        }
        const value = Reflect.get(lines, prop, lines) as unknown;
        return typeof value === 'function' ? value.bind(lines) : value;
      },
      set(_target, prop, value) {
        const next = [...editor.getLines()];
        Reflect.set(next, prop, value);
        adapter.replaceBuffer(next);
        return true;
      },
    });
  }

  /**
   * Sends a synthetic key to the host editor's BASE input handler, bypassing
   * the modal editor's own handleInput override (which would re-enter vim
   * dispatch). On omp the plugin's `Editor` import resolves to the host
   * bundle, so `Editor.prototype.handleInput` is the native implementation.
   * Test doubles fall back to their own public `handleInput`.
   */
  private inject(sequence: (typeof ARROW)[keyof typeof ARROW], count: number): void {
    for (let index = 0; index < count; index++) {
      if (this.editor instanceof Editor && typeof Editor.prototype.handleInput === 'function') {
        Editor.prototype.handleInput.call(this.editor, sequence);
        continue;
      }
      // Test doubles are not instanceof the bundled Editor; they implement the
      // host's public input handler (arrow semantics included) directly.
      const double = this.editor as unknown as { handleInput(data: string): void };
      double.handleInput(sequence);
    }
  }
}

const adapterCache = new WeakMap<Editor, OmpEditorInternalsAdapter>();

/**
 * True when the host editor exposes pi-style runtime-accessible internals
 * (TypeScript-`private` fields), false on hosts with ECMAScript-private
 * fields like oh-my-pi.
 */
export function hasNativeInternals(editor: Editor): boolean {
  const internals = editor as unknown as EditorInternals;
  return internals.state !== undefined && typeof internals.moveCursor === 'function';
}

export function getOrCreateAdapter(editor: Editor): OmpEditorInternalsAdapter {
  let adapter = adapterCache.get(editor);
  if (!adapter) {
    adapter = new OmpEditorInternalsAdapter(editor);
    adapterCache.set(editor, adapter);
  }
  return adapter;
}
