import { readFileSync } from 'node:fs';
import type { AppKeybinding, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { KeyId } from '@earendil-works/pi-tui';
import { type ZodSafeParseResult, z } from 'zod';
import { DEFAULT_KEY_TIMEOUT, DEFAULT_LEADER_KEY } from './constants';
import { type PartialPiVimKeysConfig, PartialPiVimKeysConfigSchema, type PiVimKeysConfig, PiVimKeysConfigSchema } from './schemas/config.schema';
import { BaseKeyBindSchema, KeybindWithLeaderKeySchema } from './schemas/key.schema';
import type { VimMode } from './types';
import type { KeySequence } from './utils/key-sequencer.util';
import { PathUtil } from './utils/path.util';

export class ConfigLoader {
  private config: PiVimKeysConfig;
  private keyToAppKeybindingMap = new Map<KeyId, AppKeybinding>();
  private leaderKeyToAppKeybindingMap = new Map<KeyId, AppKeybinding>();

  constructor() {
    this.config = this.defaultConfig;
    this.initializeAppKeybindingMaps();
  }

  get toNormalModeSequence(): KeySequence {
    if (this.config.normalModeRemap.type === 'single') {
      return {
        leader: this.config.normalModeRemap.key,
        sequences: [],
        timeout: DEFAULT_KEY_TIMEOUT,
      };
    }
    return {
      leader: this.config.normalModeRemap.firstKey,
      sequences: [this.config.normalModeRemap.secondKey],
      timeout: DEFAULT_KEY_TIMEOUT,
    };
  }

  get leaderKeyAppKeySequences(): KeySequence {
    const sequences: KeyId[] = [];
    for (const key of this.leaderKeyToAppKeybindingMap.keys()) {
      sequences.push(key);
    }
    return {
      leader: DEFAULT_LEADER_KEY,
      sequences,
      timeout: DEFAULT_KEY_TIMEOUT,
    };
  }

  get defaultConfig(): PiVimKeysConfig {
    return PiVimKeysConfigSchema.parse({});
  }

  getModeColors(type: VimMode): string {
    return this.config.colors[type];
  }

  getAppKeybindingForKey({ key, leaderKey }: { key: KeyId; leaderKey: boolean }): AppKeybinding | undefined {
    if (leaderKey) {
      return this.leaderKeyToAppKeybindingMap.get(key);
    }
    return this.keyToAppKeybindingMap.get(key);
  }

  initializeConfig(ctx: ExtensionContext): { success: boolean; error?: string } {
    const globalRes = PathUtil.findExtensionConfig({ type: 'global' });

    if (globalRes.exists) {
      const { success, data, error } = this.loadConfig(globalRes.path);
      if (!success && error) {
        const err = z.prettifyError(error);
        return { success: false, error: `at path => ${globalRes.path} \n ${err}` };
      }

      this.config = PiVimKeysConfigSchema.parse({
        ...this.config,
        ...data,
        colors: {
          ...this.config.colors,
          ...data.colors,
        },
        keybinds: {
          ...this.config.keybinds,
          ...data.keybinds,
        },
      });
    }

    const projectRes = PathUtil.findExtensionConfig({ type: 'project', cwd: ctx.cwd });
    if (projectRes.exists) {
      const { success, data, error } = this.loadConfig(projectRes.path);
      if (!success && error) {
        const err = z.prettifyError(error);
        return { success: false, error: `at path => ${projectRes.path} \n ${err}` };
      }

      this.config = PiVimKeysConfigSchema.parse({
        ...this.config,
        ...data,
        colors: {
          ...this.config.colors,
          ...data.colors,
        },
        keybinds: {
          ...this.config.keybinds,
          ...data.keybinds,
        },
      });
    }

    this.initializeAppKeybindingMaps();

    return { success: true };
  }

  private initializeAppKeybindingMaps() {
    for (const [appKeybinding, vimKeybind] of Object.entries(this.config.keybinds) as [AppKeybinding, string][]) {
      if (KeybindWithLeaderKeySchema.safeParse(vimKeybind).success) {
        const key = vimKeybind.slice('<leader>'.length);
        const res = BaseKeyBindSchema.safeParse(key);
        if (res.success) {
          this.leaderKeyToAppKeybindingMap.set(res.data, appKeybinding);
        }
      } else {
        this.keyToAppKeybindingMap.set(vimKeybind as KeyId, appKeybinding);
      }
    }
  }

  private loadConfig(path: string): ZodSafeParseResult<PartialPiVimKeysConfig> {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    return PartialPiVimKeysConfigSchema.safeParse(raw);
  }
}
