import type { VimKeyId } from '../../types';
import { keyToPrintableChar } from '../../utils/printable-char.util';
import type { KeySeqMatchRes, KeySequenceStrategy } from '..';

export type PrintableCharSequenceOpts = {
  leader: VimKeyId;
};

export class PrintableCharKeySequence implements KeySequenceStrategy {
  readonly leader: VimKeyId;

  private pending = false;

  constructor({ leader }: PrintableCharSequenceOpts) {
    this.leader = leader;
  }

  get pendingSequence(): boolean {
    return this.pending;
  }

  match(key: string): KeySeqMatchRes {
    if (this.pendingSequence) {
      this.invalidate();
      const char = keyToPrintableChar(key);
      if (char !== null) {
        return { result: 'completed', matched: { leader: this.leader, seqKey: char } };
      }
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

  private save(): void {
    this.pending = true;
  }

  private invalidate(): void {
    this.pending = false;
  }
}
