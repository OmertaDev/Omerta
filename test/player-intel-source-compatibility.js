import { cityGameplaySourceBaseline } from '../tools/rc1-city-gameplay-source-compatibility.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PLAYER_INTEL_SOURCE_TRANSFER as transfer, assertPlayerIntelSourceTransfer,
  playerIntelSourceBaseline } from '../tools/player-intel-source-compatibility.js';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  .replaceAll('\r\n', '\n');
assert.deepEqual(Object.keys(transfer.currentPins), ['src/server.js', 'src/game.js', 'src/crew.js',
  'src/secrets.js', 'src/contacts.js', 'src/wire.js']);
let negatives = 0, hunks = 0;
for (const file of Object.keys(transfer.currentPins)) {
  const source = cityGameplaySourceBaseline(file, fs.readFileSync(file, 'utf8')).replaceAll('\r\n', '\n');
  const baseline = git('show', `${transfer.predecessorRevision}:${file}`);
  assert.equal(source, git('show', `${transfer.sourceRevision}:${file}`), 'complete frozen runtime');
  assert.equal(source, git('show', transfer.currentBlobs[file]));
  assert.equal(baseline, git('show', transfer.baselineBlobs[file]));
  assert.equal(assertPlayerIntelSourceTransfer(file, source).baselineText, baseline);
  assert.equal(playerIntelSourceBaseline(file, source), baseline);
  assert.equal(playerIntelSourceBaseline(file, source.replaceAll('\n', '\r\n')), baseline);
  assert.equal(playerIntelSourceBaseline(file, baseline), baseline);

  const chunks = []; let hunk;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', transfer.predecessorRevision,
    transfer.sourceRevision, '--', file).split('\n')) {
    if (line.startsWith('@@ ')) { hunk = { current: '', baseline: '' }; chunks.push(hunk); continue; }
    if (!hunk) continue;
    if (line.startsWith(' ')) { hunk.current += line.slice(1) + '\n'; hunk.baseline += line.slice(1) + '\n'; }
    else if (line.startsWith('+')) hunk.current += line.slice(1) + '\n';
    else if (line.startsWith('-')) hunk.baseline += line.slice(1) + '\n';
  }
  assert.deepEqual(chunks, transfer.inverses[file], 'only the actual complete Git diff is reversible');
  const mutations = ['// unknown prefix\n' + source, source + '\n// unknown suffix\n',
    source.replace('requireKnown: true', 'requireKnown: false')];
  for (const chunk of chunks) {
    assert.equal(source.split(chunk.current).length, 2);
    mutations.push(source.replace(chunk.current, () => chunk.baseline),
      source.replace(chunk.current, () => chunk.current + chunk.current),
      source.replace(chunk.current, () => '// changed context\n' + chunk.current));
  }
  for (const mutated of mutations.filter(text => text !== source)) {
    assert.equal(playerIntelSourceBaseline(file, mutated), mutated, 'unknown runtime retains its rejecting bytes');
    assert.throws(() => assertPlayerIntelSourceTransfer(file, mutated));
    negatives++;
  }
  hunks += chunks.length;
}
assert.equal(playerIntelSourceBaseline('src/worker.js', 'unreviewed worker'), 'unreviewed worker');
assert.throws(() => assertPlayerIntelSourceTransfer('src/worker.js', 'unreviewed worker'));
assert.equal(transfer.phase, 'exact source transfer only');
console.log(`✅ intel source transfer: 6 complete runtime blobs, ${hunks} exact hunks, ${negatives} rejecting controls; historical financial evidence stays scoped to unchanged bytes`);
