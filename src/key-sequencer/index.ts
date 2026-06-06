import { parseKey } from '@earendil-works/pi-tui';
import type { VimKeyId } from '../types';

export type KeySeqMatchRes = {
  result: 'completed' | 'pending' | 'none';
  matched?: { leader: VimKeyId; seqKey?: string };
};

export interface KeySequenceStrategy {
  /** leader key to start sequence */
  readonly leader: VimKeyId;
  /** keyId as string -> keyId map for easier data parsing */
  // readonly sequences: Map<string, VimKeyId>;

  pendingSequence: boolean;

  match(key: string): KeySeqMatchRes;
}

export class KeySequencer {
  private _registry: Map<string, KeySequenceStrategy> = new Map();
  private lastPendingMatch: VimKeyId | null = null;

  get registry(): Map<string, KeySequenceStrategy> {
    return this._registry;
  }

  get pendingKey(): VimKeyId | null {
    if (!this.lastPendingMatch) return null;

    const strategy = this.registry.get(this.lastPendingMatch);
    if (strategy?.pendingSequence === true) {
      return strategy.leader;
    }

    return null;
  }

  match(data: string): KeySeqMatchRes {
    const parsed = parseKey(data);
    if (!parsed) return { result: 'none' };

    const strategy = this.registry.get(this.pendingKey ?? parsed);
    if (strategy) {
      const data = strategy.match(parsed);
      if (data.result === 'pending') {
        this.lastPendingMatch = strategy.leader;
      } else {
        this.clearPendingMatch();
      }

      return data;
    }
    return { result: 'none' };
  }

  register(strategy: KeySequenceStrategy) {
    if (this._registry.has(strategy.leader)) {
      throw new Error(`leaderKey: ${strategy.leader} already registered`);
    }
    this._registry.set(strategy.leader, strategy);
  }

  private clearPendingMatch() {
    this.lastPendingMatch = null;
  }
}
