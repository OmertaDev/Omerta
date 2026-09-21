import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createNativeCommitObserver } from '../tools/rc1-native-commit-observer.js';
import { createNpcFamilyCommitObserver } from '../tools/rc1-npc-family-provenance.js';
import { verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { verifyNpcFamilyBoundary, npcFamilyCorruptions } from './lib/rc1-npc-family-controls.js';

// This is an adapter control, not PostgreSQL or original-caller evidence.
const deliveries = [], marker = { preservedInnerWitness: true };
const observer = createNpcFamilyCommitObserver({
  innerObserverFactory: options => createNativeCommitObserver({ ...options,
    onBoundary: event => options.onBoundary(event, marker) }),
  onBoundary: (event, inner, npc) => { assert.equal(inner, marker); deliveries.push({ event, npc }); },
});
let aborted = false;
const query = observer.wrapQuery({}, async sql => {
  if (sql === 'SELECT failure') { aborted = true; throw Object.assign(Error('deliberate'), { code: 'TEST' }); }
  return { command: sql === 'COMMIT' && aborted ? 'ROLLBACK' : sql, rowCount: null, rows: [] };
});
observer.arm(); await query('BEGIN'); await query('COMMIT');
await query('BEGIN'); await assert.rejects(query('SELECT failure')); await query('COMMIT');
observer.assertComplete(); observer.disarm();
assert.deepEqual(deliveries.map(row => row.event.outcome), ['COMMITTED', 'ROLLED_BACK']);
assert(deliveries.every(row => row.npc === null));
assert.equal(observer.diagnostic().npcFamilyProvenance.open, 0);

const directory = process.argv[2]; let nativeCases = 0, negativeControls = 0;
if (directory) {
  const run = JSON.parse(await fs.readFile(path.join(directory, 'run.json'), 'utf8'));
  await verifyArtifactIndex(directory, run);
  assert.equal(run.result.status, 'PASS_SCOPED');
  for (const file of (await fs.readdir(directory)).filter(file => /^npc-candidate-\d+\.json$/.test(file))) {
    const input = JSON.parse(await fs.readFile(path.join(directory, file), 'utf8'));
    if (input.event.outcome === 'COMMITTED') { verifyNpcFamilyBoundary(input); negativeControls += npcFamilyCorruptions(input).length; nativeCases++; }
    else { assert.equal(input.event.outcome, 'ROLLED_BACK'); verifyNpcFamilyBoundary(input, 0); }
  }
  assert.equal(nativeCases, run.result.committedCount); assert.equal(negativeControls, run.result.controls);
}
console.log(JSON.stringify({ status: 'PASS', adapterCompositionAndAbortedCommit: true, nativeCases, negativeControls }));
