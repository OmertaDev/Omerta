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
  const context = identity?.context || identity || {}, logicalAt = context.logicalAt;
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
    const crimeRoute = context.method === 'POST' && (context.path || context.url)?.match(/^\/v1\/crimes\/([^/]+)$/);
    if ((context.authority === 'canonical-crime' || crimeRoute) && equal(omit(prior, weeklyFields), omit(next, weeklyFields))) {
      const wk = weekOf(dayOf(logicalAt)), task = familyTaskOf(wk);
      if (task.key !== 'crime' || next.weekly_done !== false) continue;
      const members = rows(before, 'gang_members').filter(row => row.gang_id === prior.id);
      const crimeId = context.crimeId || crimeRoute?.[1];
      const receiptOwners = new Set(receipts.filter(row => row.currency === 'cash' && ['crime:take', `crime:${crimeId}`].includes(row.reason)).map(row => row.character_id));
      assert(crimeId && (context.accountId || receiptOwners.size === 1), 'Family crime progress lacks original invocation identity');
      const owners = rows(before, 'characters').filter(row => row.alive && (context.accountId ? row.account_id === context.accountId : receiptOwners.has(row.id)));
      assert.equal(owners.length, 1, 'Family crime progress lacks one living invocation owner');
      const owner = owners[0], finalOwner = rows(after, 'characters').find(row => row.id === owner.id);
      assert(members.some(member => member.character_id === owner.id), 'Crime owner is not a member of this Family');
      assert(finalOwner && finalOwner.account_id === owner.account_id);
      assert.equal(exactSum([finalOwner.lc_crime, negate(owner.lc_crime)]), '1', 'Family progress is not one successful crime');
      const crimes = receipts.filter(row => row.currency === 'cash' && row.reason.startsWith('crime:') && row.character_id === owner.id);
      assert(crimes.length >= 1 && crimes.length <= 2, 'Family crime needs its optional funded/remainder receipts');
      assert.equal(new Set(crimes.map(row => row.reason)).size, crimes.length, 'Duplicate crime payout receipt');
      for (const receipt of crimes) {
        assert(['crime:take', `crime:${crimeId}`].includes(receipt.reason), 'Crime receipt belongs to another action');
        assert(BigInt(exactSum([receipt.amount])) > 0n, 'Family crime progress lacks successful crime');
      }
      assert.equal(next.weekly_week, wk, 'Family weekly marker differs from crime time');
      assert(prior.weekly_week !== wk || !prior.weekly_done, 'Completed Family task progressed again');
      const expected = exactSum([prior.weekly_week === wk ? prior.weekly_progress : '0', 1]);
      assert.equal(exactSum([next.weekly_progress]), expected, 'Family crime progress differs from one successful crime');
      assert(BigInt(expected) < BigInt(task.goal * Math.max(1, Math.ceil(members.length / 4))), 'Family completion cannot be classified as progress only');
      result.familyFields.set(next.id, new Set(weeklyFields));
      result.movements.push({ kind: 'family-crime-progress', familyId: next.id, receiptIds: crimes.map(row => row.id), economicGrant: false });
    }
  }
  return result;
}
