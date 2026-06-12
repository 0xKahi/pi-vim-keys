import { appendFileSync } from 'node:fs';
import { parseKey } from '@earendil-works/pi-tui';

export function logKeyInput(data: string, extra?: string) {
  appendFileSync(
    'pi-vim-keys-input.log',
    `${new Date().toISOString()} data=${JSON.stringify(data)} parsed=${parseKey(data) || 'undefined'} codes=${JSON.stringify([...data].map(char => char.charCodeAt(0)))} ${extra ?? ''}\n`,
  );
}

export function logData(data: unknown) {
  appendFileSync('pi-vim-log-input.log', `${new Date().toISOString()} data=${JSON.stringify(data)}\n`);
}
