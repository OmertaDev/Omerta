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
assert.ok(files.includes('omr-06-the-omr-machine-1080x1350.excalidraw'), 'the OMR portrait campaign card is discoverable');
assert.ok(files.includes('gameplay-01-choose-your-path.excalidraw'), 'the gameplay research-sheet family is discoverable');
assert.ok(files.includes('path-gun-1200x630.excalidraw'), 'the Path share-card family is discoverable');

for (const id of ['gun', 'ledger', 'kitchen', 'wheel', 'shadow', 'ring']) {
  const path = PATH_MANIFEST.find((entry) => entry.id === id);
  const formats = [
    { size: '1200x630', width: 1200, height: 630, canvas: `pc-${id}-canvas`, url: path.shareCard, kind: 'Open Graph' },
    { size: '1080x1350', width: 1080, height: 1350, canvas: `pp-${id}-canvas`, url: path.socialCards.portrait, kind: 'portrait' },
    { size: '1080x1920', width: 1080, height: 1920, canvas: `pv-${id}-canvas`, url: path.socialCards.vertical, kind: 'vertical' },
  ];
  for (const format of formats) {
    const filename = `path-${id}-${format.size}`;
    assert.ok(files.includes(`${filename}.excalidraw`), `${id} has an editable ${format.kind} Excalidraw source`);
    const source = JSON.parse(readFileSync(new URL(`../docs/diagrams/${filename}.excalidraw`, import.meta.url), 'utf8'));
    const canvas = source.elements.find((element) => element.id === format.canvas);
    assert.deepEqual([canvas?.width, canvas?.height], [format.width, format.height],
      `${id} has an explicit ${format.size} artboard`);
    const copy = source.elements.filter((element) => element.type === 'text')
      .map((element) => element.text).join(' ').toUpperCase();
    assert(copy.includes(path.name.toUpperCase()), `${id} ${format.kind} card names its result`);
    for (const effect of path.effects)
      assert(copy.includes(effect.display.toUpperCase()), `${id} ${format.kind} card states ${effect.display}`);
    for (const lane of [...path.mastery.home, ...path.mastery.rival])
      assert(copy.includes(lane.name.toUpperCase()), `${id} ${format.kind} card states the ${lane.name} mastery lane`);
    if (format.size !== '1200x630') {
      assert(copy.includes('LVL 5') && copy.includes('150 $OMR') && copy.includes('7-DAY'),
        `${id} ${format.kind} card states the selection and switching gates`);
      assert(copy.includes('OMERTA.FUN/PATH'), `${id} ${format.kind} card carries the quiz destination`);
      assert(copy.includes('THREE-MOVE'), `${id} ${format.kind} card carries an operating playbook`);
    }
    const card = readFileSync(new URL(`../public/art/${filename}.png`, import.meta.url));
    assert.equal(card.toString('ascii', 1, 4), 'PNG', `${id} ${format.kind} export is a PNG`);
    assert.deepEqual([card.readUInt32BE(16), card.readUInt32BE(20)], [format.width, format.height],
      `${id} ${format.kind} pixels match ${format.size} exactly`);
    const fingerprint = createHash('sha256').update(card).digest('hex').slice(0, 12);
    assert.equal(format.url, `/art/${filename}.png?v=${fingerprint}`,
      `${id} ${format.kind} URL is versioned by the current PNG bytes`);
  }
}

{
  const filename = 'omr-06-the-omr-machine-1080x1350';
  const source = JSON.parse(readFileSync(new URL(`../docs/diagrams/${filename}.excalidraw`, import.meta.url), 'utf8'));
  const canvas = source.elements.find((element) => element.id === 'omr6-canvas');
  assert.deepEqual([canvas?.width, canvas?.height], [1080, 1350], 'the OMR machine has an explicit 1080x1350 artboard');
  const copy = source.elements.filter((element) => element.type === 'text').map((element) => element.text).join(' ');
  for (const claim of ['25% VIG', '75% POL', '50% reserve', 'hard max 3% float', 'chain_unconfigured'])
    assert(copy.includes(claim), `the OMR machine publishes ${claim}`);
  const card = readFileSync(new URL(`../public/art/${filename}.png`, import.meta.url));
  assert.equal(card.toString('ascii', 1, 4), 'PNG', 'the OMR machine export is a PNG');
  assert.deepEqual([card.readUInt32BE(16), card.readUInt32BE(20)], [1080, 1350], 'the OMR machine pixels match 1080x1350');
  const fingerprint = createHash('sha256').update(card).digest('hex').slice(0, 12);
  assert.equal(fingerprint, 'f8d21f2a315f', 'the Codex OMR machine URL fingerprint tracks the rendered bytes');
}

console.log('✅ the diagram renderer discovers every supported research-sheet family');
