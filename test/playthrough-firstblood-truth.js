import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Exercise the real harness branch with controlled public API outcomes. HTTP 200
// means an attempted jump was processed, not that the assigned rival was beaten.
const source = await readFile(new URL('../tools/playthrough.js', import.meta.url), 'utf8');
const start = source.indexOf("  if (label.startsWith('Settle your first score'))");
const end = source.indexOf('  if (/moved on you', start);
assert.ok(start >= 0 && end > start, 'the First Blood harness handler exists');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const handle = new AsyncFunction('label', 'm', 'call', 'token', 'coachCantAct',
  'did', 'first', 'obeyed', 'hit', source.slice(start, end));
const label = 'Settle your first score';
async function credited(body, code = 200) {
  let completed = false;
  const call = async (method, url) => {
    if (method === 'GET') {
      assert.equal(url, '/v1/streets');
      return { code: 200, body: { streets: [{ id: 'assigned-rival', name: 'Test Rival' }] } };
    }
    assert.equal(url, '/v1/streets/assigned-rival/jump');
    return { code, body };
  };
  await handle(label, { coach: { hint: 'Test Rival has been talking you down on the street.' } },
    call, 'test-token', new Map(), () => {}, () => {},
    () => { completed = true; return true; }, () => {});
  return completed;
}
assert.equal(await credited({ ok: true, win: false }), false,
  'a processed but lost jump must not mark First Blood complete');
for (const firstBlood of [null, undefined]) {
  await assert.rejects(credited({ ok: true, win: true, firstBlood }),
    /First Blood anomaly: won against assigned rival Test Rival without a settlement receipt/,
    'a winning named-rival fight without settlement must fail explicitly');
}
assert.equal(await credited({ error: 'energy' }, 409), false,
  'a blocked jump must not mark First Blood complete');
assert.equal(await credited({ ok: true, win: true, firstBlood: { cash: 500, rep: 20, rival: 'Test Rival' } }), true,
  'a successful assigned-rival settlement must mark First Blood complete');

// Keep the existing sticky-advice check: a genuine completion that remains
// advised for half the sitting is still a failure, not waived by the correction.
const pinStart = source.indexOf('  const PIN_PCT = 40;');
const pinEnd = source.indexOf('  if (pinned.length)', pinStart);
assert.ok(pinStart >= 0 && pinEnd > pinStart, 'the sticky-advice detector exists');
const detect = new Function('coachPostObeyMin', 'coachObeyed', 'totalAdvised',
  source.slice(pinStart, pinEnd) + 'return pinned;');
assert.deepEqual(detect(new Map([[label, 10]]), new Set([label]), 20), [[label, 10]],
  'genuinely completed First Blood still fails when advice stays pinned');
console.log('✓ First Blood completion truth and pinned-win control passed');
