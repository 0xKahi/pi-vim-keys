import type { KeyId } from '@earendil-works/pi-tui';
import z from 'zod';
import type { CapitalLetterKey } from './schemas/key.schema';

export const VimModeSchema = z.enum(['normal', 'insert']);
export type VimMode = z.infer<typeof VimModeSchema>;

export type VimKeyId = KeyId | CapitalLetterKey;
