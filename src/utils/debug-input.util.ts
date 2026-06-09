import { appendFileSync } from 'node:fs';
import { parseKey } from '@earendil-works/pi-tui';

export function logInput(data: string, extra?: string) {
  appendFileSync(
    'pi-vim-keys-input.log',
    `${new Date().toISOString()} data=${JSON.stringify(data)} parsed=${parseKey(data) || 'undefined'} codes=${JSON.stringify([...data].map(char => char.charCodeAt(0)))} ${extra ?? ''}\n`,
  );
}
