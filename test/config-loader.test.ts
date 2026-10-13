import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { ConfigLoader } from '../src/config-loader';
import { PathUtil } from '../src/utils/path.util';

const ctx = { cwd: '/project' } as ExtensionContext;
let configDir: string | undefined;
let findFileSpy: ReturnType<typeof spyOn<typeof PathUtil, 'findFile'>> | undefined;

function loadLayers(globalConfig: unknown, projectConfig: unknown): ConfigLoader {
  configDir = mkdtempSync(join(tmpdir(), 'pi-vim-keys-config-'));
  const globalPath = join(configDir, 'global.json');
  const projectPath = join(configDir, 'project.json');
  writeFileSync(globalPath, JSON.stringify(globalConfig));
  writeFileSync(projectPath, JSON.stringify(projectConfig));
  findFileSpy = spyOn(PathUtil, 'findFile')
    .mockReturnValueOnce({ exists: true, path: globalPath })
    .mockReturnValueOnce({ exists: true, path: projectPath });
  const loader = new ConfigLoader();
  expect(loader.initializeConfig(ctx)).toEqual({ success: true });
  return loader;
}

afterEach(() => {
  findFileSpy?.mockRestore();
  findFileSpy = undefined;
  if (configDir) rmSync(configDir, { recursive: true, force: true });
  configDir = undefined;
});

describe('ConfigLoader editor keybindings', () => {
  it('has no default bindings or injected leader sequences', () => {
    const loader = new ConfigLoader();
    expect(loader.getActionKeybindingForKey({ key: 'ctrl+w', leaderKey: false })).toBeUndefined();
    expect(loader.leaderKeyAppKeySequences.sequences).toEqual([]);
  });

  it('lets project keybinds override global bindings', () => {
    const loader = loadLayers({ keybinds: { 'ctrl+w': 'app.model.select' } }, { keybinds: { 'ctrl+w': 'pi.vimKeys.altScreenMode' } });
    expect(loader.getActionKeybindingForKey({ key: 'ctrl+w', leaderKey: false })).toBe('pi.vimKeys.altScreenMode');
  });

  it('retains global bindings when the project omits them', () => {
    const loader = loadLayers({ keybinds: { 'alt+s': 'pi.vimKeys.altScreenMode' } }, {});
    expect(loader.getActionKeybindingForKey({ key: 'alt+s', leaderKey: false })).toBe('pi.vimKeys.altScreenMode');
  });

  it('registers leader sequences for editor actions alongside app actions', () => {
    const loader = loadLayers({}, { keybinds: { '<leader>oe': 'pi.vimKeys.altScreenMode', '<leader>n': 'app.session.new' } });
    expect(loader.leaderKeyAppKeySequences.leader).toBe('space');
    expect(loader.leaderKeyAppKeySequences.sequences).toEqual(['oe', 'n']);
    expect(loader.getActionKeybindingForKey({ key: 'oe', leaderKey: true })).toBe('pi.vimKeys.altScreenMode');
  });
});
