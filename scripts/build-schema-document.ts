import { z } from 'zod';
import { PiVimKeysConfigSchema } from '../src/schemas/config.schema';

export function createConfigJsonSchema(): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(PiVimKeysConfigSchema, {
    target: 'draft-7',
    unrepresentable: 'any',
  }) as Record<string, unknown>;

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'https://raw.githubusercontent.com/0xKahi/pi-vim-keys/main/assets/config.schema.json',
    title: 'Pi Vim Key Extension Configuration',
    description: 'Configuration schema for pi-vim-keys extension',
    ...jsonSchema,
  };
}
