import type { VimKeyId } from '../../types';
import type { KeySeqMatchRes, KeySequenceStrategy } from '..';

export type TimeBasedSequenceOpts = {
  leader: VimKeyId;
  sequences: string[];
  timeout: number; // in milliseconds
};

export class TimeBasedKeySequence implements KeySequenceStrategy {
  readonly leader: VimKeyId;
  readonly sequences: Set<string>;

  private savedSeq = '';
  private timeout: number;
  private timestamp = 0;

  constructor({ leader, sequences, timeout }: TimeBasedSequenceOpts) {
    this.leader = leader;
    this.sequences = new Set(sequences);
    this.timeout = timeout;
  }

  get pendingSequence(): boolean {
    return Date.now() - this.timestamp <= this.timeout;
  }

  get hasSequence(): boolean {
    return this.sequences.size > 0;
  }

  match(key: string): KeySeqMatchRes {
    if (!this.hasSequence) return this.noSequenceMatch(key);

    if (this.pendingSequence) {
      this.savedSeq += key;

      if (this.sequences.has(this.savedSeq)) {
        const seqKey = this.savedSeq;
        this.invalidate();
        return { result: 'completed', matched: { leader: this.leader, seqKey } };
      }

      const hasPrefix = this.hasPrefixMatch(this.savedSeq);
      if (hasPrefix) {
        this.save();
        return { result: 'pending', matched: { leader: this.leader, seqKey: this.savedSeq } };
      }

      this.invalidate();
      return { result: 'none' };
    }

    if (this.leader === key) {
      this.invalidate(); // invalidate first to clear any timedout `saveSeq`
      this.save();
      return {
        result: 'pending',
        matched: {
          leader: this.leader,
        },
      };
    }
    return { result: 'none' };
  }

  // only here for toNormalModeSequence as we allow for single char no sequence
  private noSequenceMatch(key: string): KeySeqMatchRes {
    if (this.leader === key) {
      return {
        result: 'completed',
        matched: {
          leader: this.leader,
        },
      };
    }
    return { result: 'none' };
  }

  private hasPrefixMatch(prefix: string): boolean {
    for (const seq of this.sequences) {
      if (seq.startsWith(prefix)) return true;
    }
    return false;
  }

  private save(): void {
    this.timestamp = Date.now();
  }

  private invalidate(): void {
    this.timestamp = 0;
    this.savedSeq = '';
  }
}
