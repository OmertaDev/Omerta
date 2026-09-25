import assert from 'node:assert/strict';
import { createQueryTapeWriter, createQueryTapeReader } from '../tools/rc1-native-query-tape.js';

const files = new Map();
const writer = createQueryTapeWriter({ maxEntries: 3, maxBytes: 2048,
  artifact: async (name, value) => { assert(!files.has(name)); files.set(name, JSON.stringify(value)); } });
const originals = [];
for (let sequence = 1; sequence <= 19; sequence++) {
  const record = { sequence, sql: 'SELECT id', parameters: [], rows: [{ id: String(sequence) }],
    eligibleRows: [`{"id":"${sequence}","cash":9007199254740993}`] };
  originals.push(record); await writer.append({ sequence, accepted: true, record, arrival: structuredClone(record) });
}
const manifest = await writer.manifest({ complete: true });
assert(manifest.chunks.length > 1); assert.equal(manifest.records, 19);
const load = async (name) => JSON.parse(files.get(name));
const reader = createQueryTapeReader({ manifest, load });
for (const record of originals) assert.deepEqual(await reader.next(), record);
reader.finish(); await assert.rejects(reader.next(), /Unrecorded/);
await assert.rejects(writer.append({ sequence: 20 }), /sealed/);
const unfinished = createQueryTapeReader({ manifest, load }); await unfinished.next();
assert.throws(() => unfinished.finish(), /Unconsumed/);
assert.throws(() => createQueryTapeReader({ manifest: { ...manifest, complete: false }, load }), /Incomplete/);
const badChunk = structuredClone(await load(manifest.chunks[0].path));
badChunk.entries[0].record.eligibleRows[0] = badChunk.entries[0].record.eligibleRows[0].replace('9007199254740993', '9007199254740992');
await assert.rejects(createQueryTapeReader({ manifest, load: async () => badChunk }).next(), /chunk hash/);
const badPath = structuredClone(manifest); badPath.chunks[0].path = '../escape.json';
assert.throws(() => createQueryTapeReader({ manifest: badPath, load }));
const failed = createQueryTapeWriter({ artifact: async () => {} });
await failed.append({ sequence: 1, accepted: false, arrival: { rows: [{ id: 'native' }] }, error: 'sentinel' });
const failedManifest = await failed.manifest({ complete: false });
assert.equal(failedManifest.rejected, 1); assert.equal(failedManifest.records, 0);
console.log('PASS: bounded lossless query chunks, lazy replay, exact large numerics, incomplete/tampered/path rejection and failed arrivals');
