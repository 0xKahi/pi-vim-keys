import type { KeyId } from '@earendil-works/pi-tui';
import z from 'zod';
import type { SurroundOpts } from './editor/text-edit-controller';
import type { CapitalLetterKey } from './schemas/key.schema';

export const VimModeSchema = z.enum(['normal', 'insert', 'visual', 'visualLine']);
export type VimMode = z.infer<typeof VimModeSchema>;

export type VimKeyId = KeyId | CapitalLetterKey;

export type ObjectValues<T> = T[keyof T];

export const BracketPairs: Record<string, { open: string; close: string }> = {
  b: { open: '(', close: ')' },
  '(': { open: '(', close: ')' },
  '{': { open: '{', close: '}' },
  '[': { open: '[', close: ']' },
  '<': { open: '<', close: '>' },
};

export const QuotePairs: Record<string, { open: string; close: string }> = {
  q: { open: '"', close: '"' },
  '"': { open: '"', close: '"' },
  "'": { open: "'", close: "'" },
  '`': { open: '`', close: '`' },
};

const generatePairs = (type: SurroundOpts['type'], record: Record<string, { open: string; close: string }>): Record<string, SurroundOpts> => {
  const prefix = type === 'inside' ? 'i' : 'a';
  return Object.fromEntries(Object.entries(record).map(([key, { open, close }]) => [`${prefix}${key}`, { type, open, close }]));
};

export const SurroundPairs: Record<string, SurroundOpts> = {
  ...generatePairs('inside', BracketPairs),
  ...generatePairs('around', BracketPairs),
  ...generatePairs('inside', QuotePairs),
  ...generatePairs('around', QuotePairs),
};
