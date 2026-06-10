import { readFileSync } from 'node:fs';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { type ZodSafeParseResult, z } from 'zod';
import { DEFAULT_KEY_TIMEOUT, DEFAULT_LEADER_KEY } from './constants';
import type { TimeBasedSequenceOpts } from './key-sequencer/strategies/time-based-sequence';
import { type PartialPiVimKeysConfig, PartialPiVimKeysConfigSchema, type PiVimKeysConfig, PiVimKeysConfigSchema } from './schemas/config.schema';
import { KeybindWithLeaderKeySchema, VimBaseKeySequenceSchema } from './schemas/key.schema';
import type { CombinedKeybindId } from './schemas/keybind.schema';
import type { VimKeyId, VimMode } from './types';
import { PathUtil } from './utils/path.util';

export class ConfigLoader {
  private config: PiVimKeysConfig;
  private keyToAppKeybindingMap = new Map<string, CombinedKeybindId>();
  private leaderKeyToAppKeybindingMap = new Map<string, CombinedKeybindId>();

  constructor() {
    this.config = this.defaultConfig;
    this.initializeAppKeybindingMaps();
  }

  get toNormalModeSequence(): TimeBasedSequenceOpts {
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

  get leaderKeyAppKeySequences(): TimeBasedSequenceOpts {
    const sequences: string[] = [];
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

  getActionKeybindingForKey({ key, leaderKey }: { key: string; leaderKey: boolean }): CombinedKeybindId | undefined {
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
    for (const [vimKeybind, keybind] of Object.entries(this.config.keybinds)) {
      if (KeybindWithLeaderKeySchema.safeParse(vimKeybind).success) {
        const key = vimKeybind.slice('<leader>'.length);
        const res = VimBaseKeySequenceSchema.safeParse(key);
        if (res.success) {
          this.leaderKeyToAppKeybindingMap.set(res.data, keybind);
        }
      } else {
        this.keyToAppKeybindingMap.set(vimKeybind as VimKeyId, keybind);
      }
    }
  }

  private loadConfig(path: string): ZodSafeParseResult<PartialPiVimKeysConfig> {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    return PartialPiVimKeysConfigSchema.safeParse(raw);
  }
}
