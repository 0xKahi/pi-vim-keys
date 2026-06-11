import { parseKey } from '@earendil-works/pi-tui';
import type { VimKeyId } from '../types';

export type PendingKey = {
  leader: VimKeyId;
  seqKey?: string;
};

export type KeySeqMatchRes = {
  result: 'completed' | 'pending' | 'none';
  matched?: PendingKey;
};

export interface KeySequenceStrategy {
  /** leader key to start sequence */
  readonly leader: VimKeyId;

  pendingSequence: boolean;

  match(key: string): KeySeqMatchRes;
}

export class KeySequencer {
  private _registry: Map<string, KeySequenceStrategy> = new Map();
  private lastPendingLeader: VimKeyId | null = null;
  private lastPendingSeqKey: string | null = null;

  get registry(): Map<string, KeySequenceStrategy> {
    return this._registry;
  }

  get pendingKey(): PendingKey | null {
    if (!this.lastPendingLeader) return null;

    const strategy = this.registry.get(this.lastPendingLeader);
    if (strategy?.pendingSequence === true) {
      return {
        leader: strategy.leader,
        seqKey: this.lastPendingSeqKey ?? undefined,
      };
    }

    return null;
  }

  match(data: string): KeySeqMatchRes {
    const parsed = parseKey(data);
    if (!parsed) return { result: 'none' };

    const strategy = this.registry.get(this.pendingKey?.leader ?? parsed);
    if (strategy) {
      const data = strategy.match(parsed);
      if (data.result === 'pending') {
        this.lastPendingLeader = strategy.leader;
        if (data?.matched?.seqKey) this.lastPendingSeqKey = data?.matched?.seqKey;
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
    this.lastPendingLeader = null;
    this.lastPendingSeqKey = null;
  }
}
