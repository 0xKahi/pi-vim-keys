import z from 'zod';

export const VimModeSchema = z.enum(['normal', 'insert']);
export type VimMode = z.infer<typeof VimModeSchema>;
