import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { ConfigLoader } from './config-loader';
import { VimModalEditor } from './vim-modal-editor';

export default function (pi: ExtensionAPI) {
  pi.on('session_start', (_event, ctx) => {
    const config = new ConfigLoader();

    const { error } = config.initializeConfig(ctx);
    if (error) {
      ctx.ui.notify(error, 'error');
    }

    ctx.ui.setEditorComponent((tui, theme, kb) => {
      const editor = new VimModalEditor(tui, theme, kb, { config });
      return editor;
    });
  });
}
