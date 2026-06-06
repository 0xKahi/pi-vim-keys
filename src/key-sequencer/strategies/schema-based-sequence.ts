import type { ZodType } from 'zod';
import type { VimKeyId } from '../../types';
import type { KeySeqMatchRes, KeySequenceStrategy } from '..';

export type SchemaBasedSequenceOpts = {
  leader: VimKeyId;
  schema: ZodType<VimKeyId>;
};

export class SchemaBasedKeySequence implements KeySequenceStrategy {
  readonly leader: VimKeyId;
  readonly schema: ZodType<VimKeyId>;

  private pending = false;

  constructor({ leader, schema }: SchemaBasedSequenceOpts) {
    this.leader = leader;
    this.schema = schema;
  }

  get pendingSequence(): boolean {
    return this.pending;
  }

  match(key: string): KeySeqMatchRes {
    if (this.pendingSequence) {
      this.invalidate();
      const res = this.schema.safeParse(key);
      if (res.success) {
        return { result: 'completed', matched: { leader: this.leader, seqKey: res.data } };
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
