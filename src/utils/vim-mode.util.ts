import type { PendingKey } from '../key-sequencer';
import type { VimKeyId, VimMode } from '../types';

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

const formatLeader = (key: VimKeyId): string => {
  if (key === 'space') return '<leader>';
  return key;
};

export const formatModeLabel = (mode: VimMode, pendingKey?: PendingKey) => {
  let label = MODE_TO_LABEL[mode];

  if (pendingKey) {
    label = `${label} ${formatLeader(pendingKey.leader)}`;
    if (pendingKey?.seqKey) {
      label = `${label}${pendingKey.seqKey}`;
    }
    label = `${label}_`;
  }

  return ` ${label} `;
};
