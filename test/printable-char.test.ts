import { describe, expect, it } from 'bun:test';
import { PrintableCharKeySequence } from '../src/key-sequencer/strategies/printable-char-sequence';
import { keyToPrintableChar } from '../src/utils/printable-char.util';

describe('keyToPrintableChar', () => {
  it('translates the space key to a literal space', () => {
    expect(keyToPrintableChar('space')).toBe(' ');
  });

  it('returns single printable ASCII characters unchanged', () => {
    for (const char of ['a', 'Z', '0', '9', '~', '!', '#']) {
      expect(keyToPrintableChar(char)).toBe(char);
    }
  });

  it('rejects named control keys', () => {
    for (const key of ['escape', 'enter', 'tab', 'backspace', 'delete']) {
      expect(keyToPrintableChar(key)).toBeNull();
    }
  });

  it('rejects cursor keys', () => {
    for (const key of ['up', 'down', 'left', 'right', 'home', 'end', 'pageUp', 'pageDown']) {
      expect(keyToPrintableChar(key)).toBeNull();
    }
  });

  it('rejects function keys', () => {
    for (let i = 1; i <= 12; i++) {
      expect(keyToPrintableChar(`f${i}`)).toBeNull();
    }
  });

  it('rejects modified key combinations', () => {
    expect(keyToPrintableChar('ctrl+a')).toBeNull();
    expect(keyToPrintableChar('alt+x')).toBeNull();
  });

  it('rejects null, undefined, and empty strings', () => {
    expect(keyToPrintableChar(null)).toBeNull();
    expect(keyToPrintableChar(undefined)).toBeNull();
    expect(keyToPrintableChar('')).toBeNull();
  });

  it('rejects multi-character strings that are not space', () => {
    expect(keyToPrintableChar('ab')).toBeNull();
    expect(keyToPrintableChar('hello')).toBeNull();
  });

  it('rejects non-printable ASCII code points', () => {
    expect(keyToPrintableChar('\x1f')).toBeNull();
    expect(keyToPrintableChar('\x7f')).toBeNull();
  });
});

describe('PrintableCharKeySequence', () => {
  const makeStrategy = () => new PrintableCharKeySequence({ leader: 'r' });

  it('goes pending when the leader is pressed', () => {
    const strategy = makeStrategy();

    expect(strategy.pendingSequence).toBe(false);
    expect(strategy.match('r')).toEqual({ result: 'pending', matched: { leader: 'r' } });
    expect(strategy.pendingSequence).toBe(true);
  });

  it('completes with a letter and clears pending state', () => {
    const strategy = makeStrategy();
    strategy.match('r');

    expect(strategy.match('a')).toEqual({ result: 'completed', matched: { leader: 'r', seqKey: 'a' } });
    expect(strategy.pendingSequence).toBe(false);
  });

  it('completes with space resolved to a literal space', () => {
    const strategy = makeStrategy();
    strategy.match('r');

    expect(strategy.match('space')).toEqual({ result: 'completed', matched: { leader: 'r', seqKey: ' ' } });
  });

  it('returns none for a rejected key and clears pending state', () => {
    const strategy = makeStrategy();
    strategy.match('r');

    expect(strategy.match('escape')).toEqual({ result: 'none' });
    expect(strategy.pendingSequence).toBe(false);
  });

  it('returns none when the leader is not pressed and the key is not the leader', () => {
    const strategy = makeStrategy();

    expect(strategy.match('a')).toEqual({ result: 'none' });
    expect(strategy.pendingSequence).toBe(false);
  });
});
