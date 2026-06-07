/**
 * TEST-ONLY deep import of pi-tui editor internals.
 *
 * ⚠️ DO NOT import this from any runtime/`src` code reachable from the
 * extension entry (src/index.ts). Pi's extension loader resolves the bare
 * `@earendil-works/pi-tui` specifier to its main file and then appends
 * subpaths, so `@earendil-works/pi-tui/dist/components/editor.js` resolves to a
 * bogus path and fails to load at runtime.
 *
 * Under Bun/Node (i.e. `bun test`) the subpath resolves correctly, so we use
 * this purely as a parity oracle: word-wrap.util.test.ts compares our local
 * `wordWrapLine` against pi-tui's real one. If pi-tui changes its wrap
 * algorithm, that parity test goes red — the drift tripwire, relocated from a
 * build-time import to a test.
 */
export { type TextChunk, wordWrapLine } from '@earendil-works/pi-tui/dist/components/editor.js';
