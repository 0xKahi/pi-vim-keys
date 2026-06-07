import type { Editor } from '@earendil-works/pi-tui';

/** Pi's internal text buffer + cursor position. */
export type EditorState = {
  lines: string[];
  cursorLine: number;
  cursorCol: number;
};

/** Pi's internal undo stack (only the surface our text editing touches). */
export type UndoStackLike = {
  push: (state: EditorState) => void;
  pop: () => EditorState | undefined;
  clear?: () => void;
  length?: number;
};

type EditorTuiInternals = {
  requestRender?: () => void;
  getShowHardwareCursor?: () => boolean;
};

/**
 * The single slice of Pi's Editor internals our editor layer depends on.
 *
 * Pi does not expose the text buffer, cursor writes, undo primitives, or render
 * layout state on its public API, so every editor component reaches in through
 * this one shape instead of redeclaring its own cast. Keeping it centralized
 * means a pi-tui change that renames or removes any of these fields breaks a
 * single type and a single test (test/editor-internals.test.ts) — a loud,
 * one-location failure rather than N scattered casts silently drifting apart.
 *
 * All fields are optional: this is an unsafe view, and treating every access as
 * "might be missing" keeps the controllers defensive if Pi ever drops one.
 */
export type EditorInternals = {
  // text buffer + cursor
  state?: EditorState;

  // render / layout state (visual highlight)
  focused?: boolean;
  scrollOffset?: number;
  /** Wrap width Pi's editor last rendered with; reused so wrapping can't drift. */
  lastWidth?: number;

  // cursor bookkeeping (movement + text edit)
  preferredVisualCol?: number | null;
  snappedFromCursorCol?: number | null;
  lastAction?: unknown;

  // history / undo (text edit)
  historyIndex?: number;
  undoStack?: UndoStackLike;
  pushUndoSnapshot?: () => void;
  cancelAutocomplete?: () => void;

  // callbacks + host
  onChange?: (text: string) => void;
  tui?: EditorTuiInternals;

  // helpers
  moveCursor?: (deltaLine: number, deltaCol: number) => void;
  segment?: (text: string, mode: 'grapheme' | 'word') => Iterable<Intl.SegmentData>;
};

/**
 * The one contained, unsafe view into Pi's Editor internals. Import this from
 * editor components instead of casting `editor as unknown as ...` inline.
 */
export function getEditorInternals(editor: Editor): EditorInternals {
  return editor as unknown as EditorInternals;
}
