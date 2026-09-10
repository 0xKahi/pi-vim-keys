import type { Editor } from '@earendil-works/pi-tui';

/** Pi's internal text buffer + cursor position. */
export type EditorState = {
  lines: string[];
  cursorLine: number;
  cursorCol: number;
};

/**
 * Pi's internal undo stack (only the surface our text editing touches).
 * Entries were historically raw EditorState; newer pi-tui versions store
 * { state, pastes, pasteCounter } wrappers, so pop() returns unknown.
 */
export type UndoStackLike = {
  push: (state: EditorState | { state: EditorState; pastes?: Map<number, string>; pasteCounter?: number }) => void;
  pop: () => unknown;
  clear?: () => void;
  length?: number;
};

/**
 * Narrow, capability-oriented view of the host editor that controllers need.
 * VimModalEditor owns these capabilities publicly (or via pi-tui's protected
 * `tui`), so controllers receive them explicitly instead of casting the editor.
 */
export type EditorHostServices = {
  /** Public `Editor.focused`. */
  isFocused: () => boolean;
  /** Public `Editor.onChange`, invoked with the editor's current text. */
  notifyChange: (text: string) => void;
  /** Protected `Editor.tui.requestRender()`. */
  requestRender: () => void;
  /** `TUI.getShowHardwareCursor()`. */
  isHardwareCursorEnabled: () => boolean;
};

/**
 * The single slice of Pi's Editor internals our editor layer depends on.
 *
 * Public members and injected host services provide focus, change notification,
 * render requests, and hardware-cursor state. This adapter retains only the
 * private state and helpers that Pi does not expose.
 *
 * All fields are optional: this is an unsafe view, and treating every access as
 * "might be missing" keeps the controllers defensive if Pi ever drops one.
 */
export type EditorInternals = {
  // text buffer + cursor
  state?: EditorState;

  // render / layout state (visual highlight)
  /** Wrap width Pi's editor last rendered with; reused so wrapping can't drift. */
  lastWidth?: number;

  // cursor bookkeeping (movement + text edit)
  preferredVisualCol?: number | null;
  snappedFromCursorCol?: number | null;
  lastAction?: unknown;

  // paste metadata (undo/redo correctness)
  // Pi's undo entries carry paste identity and expansion data, so restoring text
  // without the Map and counter makes [paste #N] markers resolve incorrectly.
  pastes?: Map<number, string>;
  pasteCounter?: number;

  // history / undo (text edit)
  historyIndex?: number;
  undoStack?: UndoStackLike;
  pushUndoSnapshot?: () => void;
  cancelAutocomplete?: () => void;

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
