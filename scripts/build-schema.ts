#!/usr/bin/env bun
import { createConfigJsonSchema } from './build-schema-document';

const SCHEMA_OUTPUT_PATH = 'assets/config.schema.json';
// const DIST_SCHEMA_OUTPUT_PATH = 'dist/config.schema.json';

async function main() {
  console.log('Generating JSON Schema...');

  const finalSchema = createConfigJsonSchema();
  await Bun.write(SCHEMA_OUTPUT_PATH, JSON.stringify(finalSchema, null, 2));
  // await Bun.write(DIST_SCHEMA_OUTPUT_PATH, JSON.stringify(finalSchema, null, 2));

  console.log(`✓ JSON Schema generated: ${SCHEMA_OUTPUT_PATH}`);
}

main();
