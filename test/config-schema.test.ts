import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { createConfigJsonSchema } from '../scripts/build-schema-document';

type JsonObject = Record<string, unknown>;

const generatedSchema = createConfigJsonSchema();

function asObject(value: unknown): JsonObject {
  if (typeof value !== 'object' || value === null) throw new Error('expected a JSON object');
  return value as JsonObject;
}

function requiredKeys(schema: JsonObject): string[] {
  return Array.isArray(schema.required) ? (schema.required as string[]) : [];
}

function colorsSchema(): JsonObject {
  return asObject(asObject(generatedSchema.properties).colors);
}

function replaceSchema(): JsonObject {
  return asObject(asObject(colorsSchema().properties).replace);
}

// The published schema is the input contract for user config files. `io: 'input'`
// keeps defaulted fields optional while `io: 'output'` would mark every field that
// has a default as required, rejecting legitimate partial configs.
const validator = z.fromJSONSchema(generatedSchema as Parameters<typeof z.fromJSONSchema>[0]);

describe('generated config JSON schema (issue 3 regression)', () => {
  it('does not require defaulted top-level fields', () => {
    expect(requiredKeys(generatedSchema)).not.toContain('colors');
    expect(requiredKeys(generatedSchema)).not.toContain('normalModeRemap');
    expect(requiredKeys(generatedSchema)).not.toContain('keybinds');
  });

  it('does not require defaulted mode colors, including replace', () => {
    const required = requiredKeys(colorsSchema());
    for (const mode of ['normal', 'insert', 'visual', 'visualLine', 'replace']) {
      expect(required).not.toContain(mode);
    }
  });

  it('retains the replace property and its default', () => {
    const replace = replaceSchema();
    expect(replace.type).toBe('string');
    expect(replace.default).toBe('#FDF980');
    expect(asObject(colorsSchema().default).replace).toBe('#FDF980');
  });

  it('accepts an empty config relying entirely on defaults', () => {
    expect(validator.safeParse({}).success).toBe(true);
  });

  it('accepts legacy mode-color configs that omit replace', () => {
    const result = validator.safeParse({
      colors: {
        normal: '#111111',
        insert: '#222222',
        visual: '#333333',
        visualLine: '#444444',
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial/defaulted configs and keybinds-only configs', () => {
    expect(validator.safeParse({ colors: {} }).success).toBe(true);
    expect(validator.safeParse({ colors: { normal: '#ABCDEF' } }).success).toBe(true);
    expect(validator.safeParse({ keybinds: { 'ctrl+w': 'app.interrupt' } }).success).toBe(true);
    expect(validator.safeParse({ normalModeRemap: { type: 'single', key: 'escape' } }).success).toBe(true);
  });

  it('still rejects invalid values so the schema has not become vacuous', () => {
    expect(validator.safeParse({ colors: { replace: 'not-a-color' } }).success).toBe(false);
    expect(validator.safeParse({ keybinds: { 'ctrl+w': 'not-a-command' } }).success).toBe(false);
  });
});
