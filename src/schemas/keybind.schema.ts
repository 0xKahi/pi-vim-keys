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
  'app.session.toggleNamedFilter': true,
  'app.editor.external': true,
  'app.message.followUp': true,
  'app.message.dequeue': true,
  'app.clipboard.pasteImage': true,
  'app.session.new': true,
  'app.session.tree': true,
  'app.session.fork': true,
  'app.session.resume': true,
  'app.tree.foldOrUp': true,
  'app.tree.unfoldOrDown': true,
  'app.tree.editLabel': true,
  'app.tree.toggleLabelTimestamp': true,
  'app.session.togglePath': true,
  'app.session.toggleSort': true,
  'app.session.rename': true,
  'app.session.delete': true,
  'app.session.deleteNoninvasive': true,
  'app.models.save': true,
  'app.models.enableAll': true,
  'app.models.clearAll': true,
  'app.models.toggleProvider': true,
  'app.models.reorderUp': true,
  'app.models.reorderDown': true,
  'app.tree.filter.default': true,
  'app.tree.filter.noTools': true,
  'app.tree.filter.userOnly': true,
  'app.tree.filter.labeledOnly': true,
  'app.tree.filter.all': true,
  'app.tree.filter.cycleForward': true,
  'app.tree.filter.cycleBackward': true,
} as const satisfies Record<AppKeybinding, true>;

export const AppKeybindingSchema = z.enum(Object.keys(APP_KEYBINDINGS) as [AppKeybinding, ...AppKeybinding[]]);
export type AppKeybindingId = z.infer<typeof AppKeybindingSchema>;

export const ExtensionKeybindSchema = z.templateLiteral([z.literal('pi.vimKeys.event:'), z.string()]);
export const CombinedKeybindSchema = z.union([ExtensionKeybindSchema, AppKeybindingSchema]);
export type CombinedKeybindId = z.infer<typeof CombinedKeybindSchema>;
