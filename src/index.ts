import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { ConfigLoader } from './config-loader';
import { VimModalEditor } from './vim-modal-editor';

export default function (pi: ExtensionAPI) {
  let cleanupEditor = () => {};

  const emitEvent = (channel: string, data?: unknown) => {
    pi.events.emit(channel, data);
  };

  pi.on('session_start', (_event, ctx) => {
    const config = new ConfigLoader();

    const { error } = config.initializeConfig(ctx);
    if (error) {
      ctx.ui.notify(error, 'error');
    }

    ctx.ui.setEditorComponent((tui, theme, kb) => {
      cleanupEditor();

      const editor = new VimModalEditor(tui, theme, kb, { config, getTheme: () => ctx.ui.theme, emitEvent });
      cleanupEditor = () => editor.cleanup();

      return editor;
    });
  });

  pi.on('session_shutdown', () => {
    cleanupEditor();
    cleanupEditor = () => {};
  });
}
