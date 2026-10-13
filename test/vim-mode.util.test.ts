import { describe, expect, it } from 'bun:test';
import { formatModeLabel } from '../src/utils/vim-mode.util';

describe('formatModeLabel', () => {
  it('renders alt-screen as ALT-S, including pending suffixes', () => {
    expect(formatModeLabel('altScreen')).toBe(' ALT-S ');
    expect(formatModeLabel('altScreen', { leader: 'g' })).toBe(' ALT-S g_ ');
    expect(formatModeLabel('altScreen', { leader: 'space', seqKey: '/' })).toBe(' ALT-S <leader>/_ ');
  });
  it('renders the REPLACE label for replace mode', () => {
    expect(formatModeLabel('replace')).toBe(' REPLACE ');
  });
});
