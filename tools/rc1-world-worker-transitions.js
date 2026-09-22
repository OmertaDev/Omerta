// Classify existing worker/Family transitions; never authorize or execute them.
import assert from 'node:assert/strict';
import { isDeepStrictEqual as equal } from 'node:util';
import { EXCHANGE, dayOf, weekOf, familyTaskOf } from '../src/rules.js';
import { exactSum, negate } from './rc1-resource-journal.js';

const rows = (state, table) => state.tables[table] || [];
const omit = (row, fields) => Object.fromEntries(Object.entries(row).filter(([key]) => !fields.includes(key)));
const unchangedExcept = (before, after, tables) => Object.keys(before.tables).every(table => tables.includes(table) || equal(before.tables[table], after.tables[table]));
const delta = (a, b) => exactSum([b, negate(a)]);

export function reconcileWorkerTransitions(before, after, { identity = {}, receipts = [] } = {}) {
  const result = { exchange: false, familyFields: new Map(), checks: [], movements: [] };
  const context = identity?.context || {}, logicalAt = context.logicalAt;
  if (!Number.isSafeInteger(logicalAt)) return result;
  const worker = context.authority === 'original-worker';
  const oldPool = rows(before, 'exchange_pool'), newPool = rows(after, 'exchange_pool');
  if (worker && !equal(oldPool, newPool) && unchangedExcept(before, after, ['street_tax', 'exchange_pool'])) {
    assert.equal(identity.outcome, 'COMMITTED', 'Exchange funding must commit atomically');
    const oldTax = rows(before, 'street_tax'), newTax = rows(after, 'street_tax');
    for (const values of [oldPool, newPool, oldTax, newTax]) assert.equal(values.length, 1, 'Exchange singleton missing/duplicated');
    const [a] = oldPool, [b] = newPool, [tax] = oldTax, [nextTax] = newTax;
    assert.equal(a.id, 1); assert.equal(tax.id, 1);
    assert(equal(omit(a, ['balance', 'lifetime_funded']), omit(b, ['balance', 'lifetime_funded'])), 'Exchange funding changed another field');
    assert(equal(omit(tax, ['pool', 'last_buyback']), omit(nextTax, ['pool', 'last_buyback'])), 'Exchange funding changed another tax field');
    const pool = BigInt(exactSum([tax.pool])), take = pool * BigInt(EXCHANGE.FUND_BPS) / 10000n;
    assert(take > 0n, 'Exchange funding lacks a positive canonical carve');
    assert.equal(delta(a.balance, b.balance), String(take), 'Exchange balance differs from canonical tax carve');
    assert.equal(delta(a.lifetime_funded, b.lifetime_funded), String(take), 'Exchange lifetime funding differs');
    assert.equal(delta(tax.pool, nextTax.pool), String(-take), 'Exchange tax source does not conserve');
    assert.equal(Date.parse(nextTax.last_buyback), logicalAt, 'Exchange funding deadline differs from worker time');
    assert(logicalAt - Date.parse(tax.last_buyback) >= 12 * 3600000, 'Exchange funding repeated before deadline');
    result.exchange = true;
    result.checks.push({ kind: 'exchange-tax-transfer', resource: 'cash', amount: String(take), drift: '0', authority: 'src/worker.js runBuyback -> src/exchange.js carveExchange' });
    result.movements.push({ kind: 'exchange-tax-funding', amount: String(take), source: 'street_tax.pool', destination: 'exchange_pool.balance' });
  }
  const oldFamilies = new Map(rows(before, 'gangs').map(row => [row.id, row]));
  for (const next of rows(after, 'gangs')) {
    const prior = oldFamilies.get(next.id);
    if (!prior || equal(prior, next)) continue;
    const seasonFields = ['season', 'season_tribute', 'season_wars'];
    if (worker && equal(omit(prior, seasonFields), omit(next, seasonFields)) && unchangedExcept(before, after, ['gangs'])) {
      const current = Math.floor(dayOf(logicalAt) / 28);
      assert(prior.season < current && next.season === current, 'Family season marker is not the due transition');
      assert.equal(exactSum([next.season_tribute]), '0', 'Family seasonal tribute not reset');
      assert.equal(exactSum([next.season_wars]), '0', 'Family seasonal wars not reset');
      result.familyFields.set(next.id, new Set(seasonFields));
      result.movements.push({ kind: 'family-season-counters', familyId: next.id, from: prior.season, to: current, economicGrant: false });
    }
    const weeklyFields = ['weekly_progress', 'weekly_week', 'weekly_done'];
    if (context.authority === 'canonical-crime' && equal(omit(prior, weeklyFields), omit(next, weeklyFields))) {
      const wk = weekOf(dayOf(logicalAt)), task = familyTaskOf(wk);
      if (task.key !== 'crime' || next.weekly_done !== false) continue;
      const members = rows(before, 'gang_members').filter(row => row.gang_id === prior.id);
      const crimes = receipts.filter(row => row.currency === 'cash' && row.reason.startsWith('crime:') && members.some(member => member.character_id === row.character_id));
      assert.equal(crimes.length, 1, 'Family crime progress lacks exactly one member receipt');
      assert(BigInt(exactSum([crimes[0].amount])) > 0n, 'Family crime progress lacks successful crime');
      assert.equal(next.weekly_week, wk, 'Family weekly marker differs from crime time');
      assert(prior.weekly_week !== wk || !prior.weekly_done, 'Completed Family task progressed again');
      const expected = exactSum([prior.weekly_week === wk ? prior.weekly_progress : '0', 1]);
      assert.equal(exactSum([next.weekly_progress]), expected, 'Family crime progress differs from one successful crime');
      assert(BigInt(expected) < BigInt(task.goal * Math.max(1, Math.ceil(members.length / 4))), 'Family completion cannot be classified as progress only');
      result.familyFields.set(next.id, new Set(weeklyFields));
      result.movements.push({ kind: 'family-crime-progress', familyId: next.id, receiptId: crimes[0].id, economicGrant: false });
    }
  }
  return result;
}
