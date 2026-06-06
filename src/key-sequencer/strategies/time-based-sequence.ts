import type { VimKeyId } from '../../types';
import type { KeySeqMatchRes, KeySequenceStrategy } from '..';

export type TimeBasedSequenceOpts = {
  leader: VimKeyId;
  sequences: VimKeyId[];
  timeout: number; // in milliseconds
};

export class TimeBasedKeySequence implements KeySequenceStrategy {
  readonly leader: VimKeyId;
  readonly sequences: Map<string, VimKeyId>;

  private timeout: number;
  private timestamp = 0;

  constructor({ leader, sequences, timeout }: TimeBasedSequenceOpts) {
    this.leader = leader;
    this.sequences = new Map(sequences.map(key => [key, key]));
    this.timeout = timeout;
  }

  get pendingSequence(): boolean {
    return Date.now() - this.timestamp <= this.timeout;
  }

  get hasSequence(): boolean {
    return this.sequences.size > 0;
  }

  match(key: string): KeySeqMatchRes {
    if (this.pendingSequence) {
      this.invalidate();
      if (this.sequences.has(key)) {
        return { result: 'completed', matched: { leader: this.leader, seqKey: this.sequences.get(key) } };
      }
      return { result: 'none' };
    }

    if (this.leader === key) {
      const isPending = this.save();
      return {
        result: isPending ? 'pending' : 'completed',
        matched: {
          leader: this.leader,
        },
      };
    }
    return { result: 'none' };
  }

  // update the timestamp if key matches main and has sequence, otherwise return the main key if it matches
  private save(): boolean {
    if (this.hasSequence) {
      this.timestamp = Date.now();
      return true;
    }
    return false;
  }

  private invalidate(): void {
    this.timestamp = 0;
  }
}
