import { describe, expect, it } from 'bun:test';
import { formatModeLabel } from '../src/utils/vim-mode.util';

describe('formatModeLabel', () => {
  it('renders the REPLACE label for replace mode', () => {
    expect(formatModeLabel('replace')).toBe(' REPLACE ');
  });
});
