import type { VimMode } from '../types';

const VISUAL_MODES: VimMode[] = ['visual', 'visualLine'];
const MODE_TO_LABEL: Record<VimMode, string> = {
  insert: 'INSERT',
  normal: 'NORMAL',
  visual: 'VISUAL',
  visualLine: 'V-LINE',
};

export const isVisualMode = (mode: VimMode) => {
  return VISUAL_MODES.includes(mode);
};

export const formatModeLabel = (mode: VimMode, pendingKey?: string) => {
  let label = MODE_TO_LABEL[mode];

  if (pendingKey) {
    label = `${label} ${pendingKey}`;
  }

  return ` ${label} `;
};
