import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PATH_MANIFEST } from '../src/path-funnel.js';

// Catches a production regression where the renderer's discovery filter silently drops a
// supported research-sheet family. --list exercises the real CLI without opening Chrome.
const result = spawnSync(process.execPath, ['tools/render-omr-excalidraw.mjs', '--list'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
  shell: false,
});

assert.equal(result.status, 0, result.stderr || 'diagram renderer --list should exit cleanly');
const files = result.stdout.trim().split(/\r?\n/).filter(Boolean);
assert.ok(files.includes('omr-01-severance.excalidraw'), 'the OMR research-sheet family remains discoverable');
assert.ok(files.includes('gameplay-01-choose-your-path.excalidraw'), 'the gameplay research-sheet family is discoverable');
assert.ok(files.includes('path-gun-1200x630.excalidraw'), 'the Path share-card family is discoverable');

for (const id of ['gun', 'ledger', 'kitchen', 'wheel', 'shadow', 'ring']) {
  assert.ok(files.includes(`path-${id}-1200x630.excalidraw`), `${id} has an editable Excalidraw share-card source`);
  const source = JSON.parse(readFileSync(new URL(`../docs/diagrams/path-${id}-1200x630.excalidraw`, import.meta.url), 'utf8'));
  const canvas = source.elements.find((element) => element.id === `pc-${id}-canvas`);
  assert.deepEqual([canvas?.width, canvas?.height], [1200, 630], `${id} has an explicit 1200×630 artboard`);
  const copy = source.elements.filter((element) => element.type === 'text').map((element) => element.text).join(' ').toUpperCase();
  const path = PATH_MANIFEST.find((entry) => entry.id === id);
  assert(copy.includes(path.name.toUpperCase()), `${id} card names its result`);
  for (const effect of path.effects) assert(copy.includes(effect.display.toUpperCase()), `${id} card states ${effect.display}`);
  for (const lane of [...path.mastery.home, ...path.mastery.rival])
    assert(copy.includes(lane.name.toUpperCase()), `${id} card states the ${lane.name} mastery lane`);
  const card = readFileSync(new URL(`../public/art/path-${id}-1200x630.png`, import.meta.url));
  assert.equal(card.toString('ascii', 1, 4), 'PNG', `${id} renders as a PNG`);
  assert.deepEqual([card.readUInt32BE(16), card.readUInt32BE(20)], [1200, 630],
    `${id} pixels match the Open Graph width and height exactly`);
  const fingerprint = createHash('sha256').update(card).digest('hex').slice(0, 12);
  assert.equal(path.shareCard, `/art/path-${id}-1200x630.png?v=${fingerprint}`,
    `${id} Open Graph URL is versioned by the current PNG bytes`);
}

console.log('✅ the diagram renderer discovers every supported research-sheet family');
