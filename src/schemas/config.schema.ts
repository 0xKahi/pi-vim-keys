import z from 'zod';
import { COLOR_HEX_REGEX } from '../constants';
import { BaseKeyBindSchema, KeybindWithModifierSchema, VimKeybindSchema } from './key.schema';
import { AppKeybindingSchema } from './keybind.schema';

const HtmlColorInputSchema = z.string().regex(COLOR_HEX_REGEX, { message: 'Invalid color format. Must be a 7-character hex code (e.g., #RRGGBB).' });

const ModeColorConfigSchema = z.object({
  normal: HtmlColorInputSchema.optional().default('#55BBF9'),
  insert: HtmlColorInputSchema.optional().default('#72F6B2'),
});

const NormalModeSingleKeySchema = z.object({
  type: z.literal('single').describe('A single key to go into normal mode e.g. "escape"'),
  key: z.union([BaseKeyBindSchema, KeybindWithModifierSchema]),
});

const NormalModeSequenceSchema = z.object({
  type: z.literal('sequence').describe('A sequence of two keys to go into normal mode e.g. "kj"'),
  firstKey: BaseKeyBindSchema,
  secondKey: BaseKeyBindSchema,
});

const NormalModeConfigSchema = z.union([NormalModeSingleKeySchema, NormalModeSequenceSchema]);

const AppKeybindConfigSchema = z.partialRecord(AppKeybindingSchema, VimKeybindSchema);

export const PiVimKeysConfigSchema = z.object({
  $schema: z.string().optional(),
  colors: ModeColorConfigSchema.default({
    normal: '#55BBF9',
    insert: '#72F6B2',
  }),
  normalModeRemap: NormalModeConfigSchema.default({
    type: 'single',
    key: 'escape',
  }),
  keybinds: AppKeybindConfigSchema.default({}),
});
export type PiVimKeysConfig = z.infer<typeof PiVimKeysConfigSchema>;

export const PartialPiVimKeysConfigSchema = z.object({
  $schema: z.string().optional(),
  colors: ModeColorConfigSchema.optional(),
  normalModeRemap: NormalModeConfigSchema.optional(),
  keybinds: AppKeybindConfigSchema.optional(),
});
export type PartialPiVimKeysConfig = z.infer<typeof PartialPiVimKeysConfigSchema>;
