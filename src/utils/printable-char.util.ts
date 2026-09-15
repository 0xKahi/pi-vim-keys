const PRINTABLE_ASCII_MIN = 0x20;
const PRINTABLE_ASCII_MAX = 0x7e;

export function keyToPrintableChar(parsedKey: string | null | undefined): string | null {
  if (!parsedKey) return null;
  if (parsedKey === 'space') return ' ';

  if (parsedKey.length === 1) {
    const code = parsedKey.charCodeAt(0);
    if (code >= PRINTABLE_ASCII_MIN && code <= PRINTABLE_ASCII_MAX) return parsedKey;
  }

  return null;
}
