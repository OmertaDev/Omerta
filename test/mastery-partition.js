// Quantity-bearing mastery awards follow settled economic units, not request count.
// This focused model exercises the real shared funnel without a server or database.
process.env.STAT_USE_P = '1';

import assert from 'node:assert/strict';
import { bumpDaily, bumpMastery, masteryXpAward } from '../src/game.js';
import { MASTERY, PATH_FX } from '../src/rules.js';

const round6 = (n) => Math.round(n * 1e6) / 1e6;

// Exhaust every path multiplier: one 500-unit settlement and 500 one-unit
// settlements must add exactly the same persisted XP for every partitionable verb.
for (const [track, action, total] of [
  ['commerce', 'sell', 500],
  ['commerce', 'fill', 200],
  ['chemistry', 'deal', 500],
]) {
  for (const path of [null, ...Object.keys(PATH_FX)]) {
    const ch = { path };
    const once = masteryXpAward(ch, track, action, total);
    let split = 0;
    for (let i = 0; i < total; i++) split = round6(split + masteryXpAward(ch, track, action, 1));
    assert.equal(split, once, `${action}/${path || 'no-path'} XP is partition-independent`);
  }
}

function fixture() {
  const state = { legend: 0, rng: 0, notices: 0 };
  const ch = { id: 'street', account_id: 'account', name: 'Partition Pat', path: null,
    cunning: 10, statuse_used: 0, statuse_at: null };
  const h = { owned: { mastery: { commerce: 100000 } } };
  const client = { query: async (sql, args) => {
    if (sql.startsWith('UPDATE masteries SET xp=')) return { rowCount: 1, rows: [] };
    if (sql.startsWith('UPDATE mastery_legend SET xp = xp +')) {
      state.legend = round6(state.legend + Number(args[2]));
      return { rowCount: 1, rows: [] };
    }
    if (sql.startsWith('INSERT INTO rng_audit')) { state.rng++; return { rowCount: 1, rows: [] }; }
    if (sql.startsWith('UPDATE characters SET statuse_used=')) return { rowCount: 1, rows: [] };
    if (sql.startsWith('INSERT INTO notifications')) { state.notices++; return { rowCount: 1, rows: [] }; }
    throw new Error(`unexpected mastery-partition query: ${sql}`);
  } };
  return { state, ch, h, client };
}

async function run(parts, action) {
  const f = fixture();
  const startXp = f.h.owned.mastery.commerce;
  for (const units of parts) await bumpMastery(f.client, f.h, f.ch, 'commerce', action, { units });
  return { xp: round6(f.h.owned.mastery.commerce - startXp), legend: f.state.legend,
    stat: f.ch.cunning - 10, statUsed: round6(f.ch.statuse_used), rng: f.state.rng,
    notices: f.state.notices };
}

const realNow = Date.now;
Date.now = () => Date.parse('2026-10-21T12:00:00Z');
try {
  const saleOnce = await run([500], 'sell');
  const saleSplit = await run(Array(500).fill(1), 'sell');
  assert.deepEqual(saleSplit, saleOnce, '500 one-unit NPC sales equal one 500-unit sale, including stat exposure');
  assert.deepEqual(saleOnce, { xp: 100, legend: 100, stat: MASTERY.STAT_USE.CAP_DAY,
    statUsed: MASTERY.STAT_USE.CAP_DAY, rng: MASTERY.STAT_USE.CAP_DAY,
    notices: MASTERY.STAT_USE.CAP_DAY });

  const fillOnce = await run([200], 'fill');
  const fillSplit = await run(Array(200).fill(1), 'fill');
  assert.deepEqual(fillSplit, fillOnce, '200 one-unit order fills equal one max-size fill, including stat exposure');

  const dailyProgress = async (parts) => {
    let counters = null;
    const client = { query: async (sql, args) => {
      if (sql.startsWith('SELECT * FROM daily_progress'))
        return { rows: counters ? [{ counters: JSON.stringify(counters) }] : [] };
      if (sql.startsWith('UPDATE daily_progress')) {
        counters = JSON.parse(args[2]);
        return { rowCount: 1, rows: [] };
      }
      if (sql.startsWith('INSERT INTO daily_progress')) {
        counters = JSON.parse(args[2]);
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`unexpected daily-partition query: ${sql}`);
    } };
    for (const units of parts) await bumpDaily(client, 'street', 'goods', units / 10);
    return counters.goods;
  };
  assert.equal(await dailyProgress([500]), await dailyProgress(Array(500).fill(1)),
    'one 500-unit freight settlement and 500 one-unit settlements earn identical daily progress');
} finally {
  Date.now = realNow;
  delete process.env.STAT_USE_P;
}

console.log('mastery-partition: quantity-scaled XP, stat exposure, and freight daily progress are partition-independent');
