import type { AppKeybinding } from '@earendil-works/pi-coding-agent';
import z from 'zod';

const APP_KEYBINDINGS = {
  'app.interrupt': true,
  'app.clear': true,
  'app.exit': true,
  'app.suspend': true,
  'app.thinking.cycle': true,
  'app.model.cycleForward': true,
  'app.model.cycleBackward': true,
  'app.model.select': true,
  'app.tools.expand': true,
  'app.thinking.toggle': true,
  'app.editor.external': true,
  'app.message.followUp': true,
  'app.message.dequeue': true,
  'app.clipboard.pasteImage': true,
  'app.session.new': true,
  'app.session.tree': true,
  'app.session.fork': true,
  'app.session.resume': true,
} as const satisfies Partial<Record<AppKeybinding, boolean>>;

export const AppKeybindingSchema = z.enum(Object.keys(APP_KEYBINDINGS) as [keyof typeof APP_KEYBINDINGS, ...(keyof typeof APP_KEYBINDINGS)[]]);
export type AppKeybindingId = z.infer<typeof AppKeybindingSchema>;

export const ExtensionKeybindSchema = z.templateLiteral([z.literal('pi.vimKeys.event:'), z.string()]);
export const CombinedKeybindSchema = z.union([ExtensionKeybindSchema, AppKeybindingSchema]);
export type CombinedKeybindId = z.infer<typeof CombinedKeybindSchema>;
