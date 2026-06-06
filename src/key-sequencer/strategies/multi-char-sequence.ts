import type { VimKeyId } from '../../types';
import type { KeySeqMatchRes, KeySequenceStrategy } from '..';

export type MultiCharSequenceOpts = {
  leader: VimKeyId;
  sequences: string[];
};

export class MultiCharKeySequence implements KeySequenceStrategy {
  readonly leader: VimKeyId;
  readonly sequences: Set<string>;

  private pending = false;
  private savedSeq = '';

  constructor({ leader, sequences }: MultiCharSequenceOpts) {
    this.leader = leader;
    this.sequences = new Set(sequences);
  }

  get pendingSequence(): boolean {
    return this.pending;
  }

  match(key: string): KeySeqMatchRes {
    if (this.pendingSequence) {
      this.savedSeq += key;

      if (this.sequences.has(this.savedSeq)) {
        const seqKey = this.savedSeq;
        this.invalidate();
        return { result: 'completed', matched: { leader: this.leader, seqKey } };
      }

      const hasPrefix = this.hasPrefixMatch(this.savedSeq);
      if (hasPrefix) {
        return { result: 'pending', matched: { leader: this.leader, seqKey: this.savedSeq } };
      }

      this.invalidate();
      return { result: 'none' };
    }

    if (this.leader === key) {
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

  private hasPrefixMatch(prefix: string): boolean {
    for (const seq of this.sequences) {
      if (seq.startsWith(prefix)) return true;
    }
    return false;
  }

  private save(): void {
    this.pending = true;
  }

  private invalidate(): void {
    this.pending = false;
    this.savedSeq = '';
  }
}
