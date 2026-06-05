import { type KeyId, parseKey } from '@earendil-works/pi-tui';

export type KeySequence = {
  leader: KeyId;
  sequences: KeyId[];
  timeout: number; // in milliseconds
};

export class KeySequencer {
  readonly leader: KeyId;
  readonly sequences: Map<string, KeyId>;
  readonly timeout: number;
  private timestamp = 0;

  constructor({ leader, sequences, timeout }: KeySequence) {
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

  match(data: string): KeyId | undefined {
    const key = parseKey(data);
    if (key) {
      if (this.pendingSequence) {
        this.invalidate();
        if (this.sequences.has(key)) {
          return this.sequences.get(key);
        }
      }

      const isLeader = this.leader === key;
      if (isLeader) {
        this.save();
        return this.hasSequence ? undefined : this.leader;
      }
    }
    return undefined;
  }

  // update the timestamp if key matches main and has sequence, otherwise return the main key if it matches
  private save(): void {
    if (this.hasSequence) {
      this.timestamp = Date.now();
    }
  }

  private invalidate(): void {
    this.timestamp = 0;
  }
}
