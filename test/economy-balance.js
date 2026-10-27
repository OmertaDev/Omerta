process.env.SEASON_MOD = 'dead_quiet';
process.env.NODE_ENV = 'test';
delete process.env.DATABASE_URL;

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { accrue } from '../src/accrual.js';
import { BUSINESSES, CONSTANTS, DRUGS, M4, crewCold, crewRehireDebt, crewWageOwed } from '../src/rules.js';
import { upkeepBps, isCold, payBusinessUpkeep } from '../src/business.js';
import { hireCrew, layOffCrew, payCrewWages } from '../src/kitchen.js';
import { withCharacter } from '../src/game.js';
import { buildServer } from './server-fixture.js';

const minute = 60000, day = 86400000, start = Date.now(), drug = DRUGS[0];
function fixture({ crew = 1, qty = 1000000, quality = 1, credit = 0 } = {}) {
  return {
    ch: { respect: 0, energy: 0, nerve: 0, health: 100, cash: 0, bank: 0, heat: 0,
      crew, crew_paid_at: new Date(start), crew_sale_credit_ms: credit,
      last_accrued_at: new Date(start), bank_credit_ms: 0, racket_credit_ms: 0 },
    ctx: { preview: true, stash: [{ drug_id: drug.id, qty, quality }] },
  };
}
function advance(f, steps) {
  let elapsed = 0, units = 0, proceeds = 0;
  for (const ms of steps) {
    elapsed += ms;
    delete f.ch._crewSale;
    accrue(f.ch, null, f.ctx, new Date(start + elapsed));
    units += f.ch._crewSale?.units || 0;
    proceeds += f.ch._crewSale?.proceeds || 0;
  }
  return { units, proceeds, credit: Number(f.ch.crew_sale_credit_ms) };
}

assert.deepEqual(advance(fixture(), Array(60).fill(1000)), advance(fixture(), [minute]),
  'splitting one minute into requests cannot create extra work');
let seed = 0x21c001d;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
for (let run = 0; run < 200; run++) {
  const crew = 1 + Math.floor(random() * 30);
  const total = 6 * 3600000 + Math.floor(random() * 1000) * 1000;
  const steps = [];
  for (let remaining = total; remaining;) {
    const ms = Math.min(remaining, (1 + Math.floor(random() * 60)) * 1000);
    steps.push(ms); remaining -= ms;
  }
  const split = advance(fixture({ crew, quality: 1.173 }), steps);
  const once = advance(fixture({ crew, quality: 1.173 }), [total]);
  assert.equal(split.units, Math.floor(crew * total / minute));
  assert.equal(split.units, once.units);
  assert.equal(split.credit, once.credit);
  assert(split.proceeds <= once.proceeds, 'partitioned rounding cannot increase proceeds');
}
const exhausted = fixture({ qty: 1, credit: minute - 1000 });
assert.equal(advance(exhausted, [minute]).credit, 0, 'empty shelves discard unused labor');
const empty = fixture({ qty: 0, credit: minute - 1000 });
assert.equal(advance(empty, [minute]).credit, 0, 'empty inventory cannot bank work');
empty.ctx.stash[0].qty = 2;
accrue(empty.ch, null, empty.ctx, new Date(start + minute + 1000));
assert.equal(empty.ch._crewSale?.units || 0, 0, 'later stock cannot consume labor from an empty interval');
const unpaid = fixture({ credit: minute - 1000 });
unpaid.ch.crew_paid_at = new Date(0);
assert.equal(advance(unpaid, [minute]).units, 0);
assert.equal(unpaid.ch.crew_sale_credit_ms, 0, 'cold crew cannot bank work');
const clockless = fixture({ credit: minute - 1000 });
clockless.ch.crew_paid_at = null;
assert.equal(crewCold(clockless.ch, start + minute), true, 'a paid crew without a wage clock fails closed');
assert.equal(crewWageOwed(clockless.ch, start + minute), 0, 'clock repair never invents retroactive debt');
assert.equal(advance(clockless, [minute]).units, 0, 'a missing wage clock cannot power free sales');
assert.equal(clockless.ch.crew_sale_credit_ms, 0, 'a missing clock cannot retain fractional work');
const freshlyStamped = fixture();
freshlyStamped.ch.last_accrued_at = new Date(start - day);
freshlyStamped.ch.crew_paid_at = new Date(start);
accrue(freshlyStamped.ch, null, freshlyStamped.ctx, new Date(start + minute));
assert.equal(freshlyStamped.ch._crewSale?.units, 1,
  'stamping a legacy crew starts work at the new clock instead of awarding the old offline gap');
assert.equal(advance(fixture(), [day]).units, CONSTANTS.OFFLINE_CAP_MS / minute);

// Returning at or after the cold boundary settles the bounded shift earned before tools went down.
// A later touch earns nothing, and cutting the final eligible shift at the boundary is partition-safe.
for (const returnAt of [M4.CREW_WAGE_COLD_MS, M4.CREW_WAGE_COLD_MS + day]) {
  const returning = fixture();
  accrue(returning.ch, null, returning.ctx, new Date(start + returnAt));
  assert.equal(returning.ch._crewSale?.units, CONSTANTS.OFFLINE_CAP_MS / minute,
    'a cold return keeps the pre-cold offline shift');
  delete returning.ch._crewSale;
  accrue(returning.ch, null, returning.ctx, new Date(start + returnAt + minute));
  assert.equal(returning.ch._crewSale?.units || 0, 0, 'a post-cold touch adds no crew work');
  assert.equal(returning.ch.crew_sale_credit_ms, 0, 'cold crews retain no fractional work');
}
const finalShiftStart = start + M4.CREW_WAGE_COLD_MS - minute;
const boundaryOnce = fixture(), boundarySplit = fixture();
boundaryOnce.ch.last_accrued_at = new Date(finalShiftStart);
boundarySplit.ch.last_accrued_at = new Date(finalShiftStart);
accrue(boundaryOnce.ch, null, boundaryOnce.ctx, new Date(start + M4.CREW_WAGE_COLD_MS + minute));
accrue(boundarySplit.ch, null, boundarySplit.ctx, new Date(start + M4.CREW_WAGE_COLD_MS));
const firstHalfUnits = boundarySplit.ch._crewSale?.units || 0;
delete boundarySplit.ch._crewSale;
accrue(boundarySplit.ch, null, boundarySplit.ctx, new Date(start + M4.CREW_WAGE_COLD_MS + minute));
assert.equal(firstHalfUnits + (boundarySplit.ch._crewSale?.units || 0), boundaryOnce.ch._crewSale?.units,
  'splitting the final minute through the cold boundary cannot change earned units');
assert.equal(boundaryOnce.ch._crewSale?.units, 1, 'only the pre-cold minute is eligible');
assert.equal(boundarySplit.ch.crew_sale_credit_ms, boundaryOnce.ch.crew_sale_credit_ms);

const realNow = Date.now;
let paymentNow = start;
const padFixture = ({ cash = 10000000, age = 0, count = 1, tier = 1 } = {}) => {
  const rows = BUSINESSES.slice(0, count).map((business, i) => ({ id: `pad-${i}`, kind: business.kind,
    tier: i ? 1 : tier, upkeep_at: new Date(paymentNow - age) }));
  const records = [], ch = { id: 'pad-owner', cash };
  const client = { query: async (sql, args) => {
    if (sql.startsWith('SELECT')) return { rows };
    assert.match(sql, /^UPDATE businesses SET upkeep_at=\$2/);
    rows.find((row) => row.id === args[0]).upkeep_at = args[1];
    return { rowCount: 1, rows: [] };
  } };
  const h = { owned: {}, ledger: async (_client, row) => records.push(row) };
  return { rows, ch, records, pay: () => payBusinessUpkeep(ch, client, h) };
};
const wageFixture = ({ cash = 10000000, age = 0 } = {}) => {
  const records = [], ch = { id: 'wage-owner', crew: 1, cash, crew_paid_at: new Date(paymentNow - age) };
  return { ch, records, pay: () => payCrewWages(ch, {}, { ledger: async (_client, row) => records.push(row) }) };
};
try {
  Date.now = () => paymentNow;
  async function schedule(make, step) {
    paymentNow = start;
    const f = make();
    for (let at = step; at < 3600000; at += step) { paymentNow = start + at; await f.pay(); }
    paymentNow = start + 3600000; await f.pay();
    const paid = f.records.reduce((sum, row) => sum - row.amount, 0);
    assert.equal(10000000 - f.ch.cash, paid);
    return paid;
  }
  assert.equal(await schedule(padFixture, 2999), await schedule(padFixture, 3600000),
    'frequent pad settlement cannot discount debt');
  assert.equal(await schedule(wageFixture, 5999), await schedule(wageFixture, 3600000),
    'frequent wage settlement cannot discount debt');
  const oddSplit = await schedule(() => padFixture({ count: 2, tier: 3 }), 1234);
  const oddOnce = await schedule(() => padFixture({ count: 2, tier: 3 }), 3600000);
  assert(oddSplit >= oddOnce && oddSplit - oddOnce < 20);
  for (const make of [padFixture, wageFixture]) {
    paymentNow = start;
    const old = make({ age: 10 * day });
    const result = await old.pay();
    const cap = old.rows ? CONSTANTS.BUSINESS_UPKEEP_CAP_MS : M4.CREW_WAGE_CAP_MS;
    const hourly = old.rows ? BUSINESSES[0].tiers[0].incomePerHr * upkeepBps(1) / 10000 : M4.CREW_WAGE_PER_HR;
    assert.equal(result.paid, hourly * cap / 3600000);
    assert.equal(old.rows ? isCold(old.rows[0]) : crewCold(old.ch), false);
  }
  assert.equal(M4.CREW_WAGE_COLD_MS, M4.CREW_WAGE_CAP_MS,
    'crew sales stop exactly when the bounded wage liability stops growing');
  const cappedCrew = { crew: 1, crew_paid_at: new Date(paymentNow - M4.CREW_WAGE_CAP_MS) };
  assert.equal(crewCold({ ...cappedCrew, crew_paid_at: new Date(+cappedCrew.crew_paid_at + 1) }, paymentNow), false,
    'the crew remains working through the final billed millisecond');
  assert.equal(crewCold(cappedCrew, paymentNow), true,
    'touching the game cannot collect crew sales during an unwaged grace window');
} finally { Date.now = realNow; }

// Changing headcount must never reset liabilities already earned by the existing crew.
const mutationNow = start + 20 * day;
try {
  Date.now = () => mutationNow;
  const records = [];
  const helpers = { ledger: async (_client, row) => records.push(row) };
  const age = M4.CREW_WAGE_CAP_MS - 1234;
  const hiring = { id: 'hire-owner', crew: 2, cash: 1000000,
    crew_paid_at: new Date(mutationNow - age) };
  const oldOwed = crewWageOwed(hiring, mutationNow);
  const oldPaidMs = Math.floor(oldOwed * 3600000 / (hiring.crew * M4.CREW_WAGE_PER_HR));
  const oldRemainderValue = hiring.crew * M4.CREW_WAGE_PER_HR * (age - oldPaidMs) / 3600000;
  const hireCost = M4.CREW_COST_STEP * 3;
  const hireResult = await hireCrew(hiring, {}, helpers);
  assert.equal(hireResult.settled, oldOwed, 'hiring settles the old headcount before mutation');
  assert.equal(hiring.cash, 1000000 - oldOwed - hireCost);
  assert.deepEqual(records.map((row) => [row.reason, row.amount]),
    [['crew:wages', -oldOwed], ['crew:hire', -hireCost]]);
  assert.equal(hiring.crew, 3);
  const carriedValue = hiring.crew * M4.CREW_WAGE_PER_HR
    * (mutationNow - new Date(hiring.crew_paid_at).getTime()) / 3600000;
  assert(carriedValue >= oldRemainderValue && carriedValue - oldRemainderValue < 0.01,
    'sub-dollar old-crew liability carries across the new headcount');

  const refused = { id: 'hire-short', crew: 2, cash: hireCost,
    crew_paid_at: new Date(mutationNow - age) };
  const refusedClock = +refused.crew_paid_at;
  await assert.rejects(hireCrew(refused, {}, helpers), (error) => error.code === 'cash');
  assert.equal(refused.crew, 2);
  assert.equal(refused.cash, hireCost);
  assert.equal(+refused.crew_paid_at, refusedClock, 'an unfunded hire changes no liability clock');

  const coldClock = new Date(mutationNow - M4.CREW_WAGE_COLD_MS - 3600000);
  const revolving = { id: 'cold-owner', crew: 2, cash: 1000000, crew_paid_at: coldClock };
  const layoff = await layOffCrew(revolving, {}, helpers);
  assert.equal(layoff.walked, true);
  assert.equal(revolving.crew, 1);
  assert.equal(+revolving.crew_paid_at, +coldClock, 'a cold layoff preserves the surviving crew debt');
  assert.equal(crewCold(revolving, mutationNow), true, 'the remaining cold crew stays cold');
  const remainingOwed = crewWageOwed(revolving, mutationNow);
  const rehireCost = M4.CREW_COST_STEP * 2;
  revolving.cash = rehireCost;
  await assert.rejects(hireCrew(revolving, {}, helpers), (error) => error.code === 'cash');
  assert.equal(revolving.crew, 1);
  assert.equal(+revolving.crew_paid_at, +coldClock, 'a failed rehire cannot clear the old clock');
  revolving.cash = rehireCost + remainingOwed;
  const rehired = await hireCrew(revolving, {}, helpers);
  assert.equal(rehired.settled, remainingOwed, 'rehiring pays the survivor debt instead of erasing it');
  assert.equal(revolving.crew, 2);
  assert.equal(revolving.cash, 0);
  assert.equal(crewCold(revolving, mutationNow), false);

  const finalHand = { id: 'final-cold-owner', crew: 1, cash: 1, crew_paid_at: coldClock };
  const finalDebt = crewWageOwed(finalHand, mutationNow);
  const finalLedgerStart = records.length;
  const finalLayoff = await layOffCrew(finalHand, {}, helpers);
  assert.deepEqual(finalLayoff, { ok: true, crew: 0, settled: 0, walked: true });
  assert.equal(finalHand.cash, 1, 'the cold final hand can leave without an immediate charge');
  assert.equal(+finalHand.crew_paid_at, +coldClock, 'the final hand leaves their capped tab behind');
  assert.equal(crewRehireDebt(finalHand, mutationNow), finalDebt);
  assert.equal(records.length, finalLedgerStart, 'the cold final layoff moves no value');

  const firstStep = M4.CREW_COST_STEP;
  finalHand.cash = firstStep;
  await assert.rejects(hireCrew(finalHand, {}, helpers), (error) => error.code === 'cash');
  assert.equal(finalHand.crew, 0);
  assert.equal(finalHand.cash, firstStep);
  assert.equal(+finalHand.crew_paid_at, +coldClock, 'an unfunded rehire cannot erase the deferred tab');

  finalHand.cash = firstStep + finalDebt;
  const finalRehire = await hireCrew(finalHand, {}, helpers);
  assert.equal(finalRehire.settled, finalDebt, 'rehiring after 1 → 0 settles the final hand\'s tab');
  assert.equal(finalHand.crew, 1);
  assert.equal(finalHand.cash, 0);
  assert.equal(crewRehireDebt(finalHand, mutationNow), 0);
  assert.equal(crewWageOwed(finalHand, mutationNow), 0);
  assert.deepEqual(records.slice(finalLedgerStart).map((row) => [row.reason, row.amount]),
    [['crew:wages', -finalDebt], ['crew:hire', -firstStep]]);
} finally { Date.now = realNow; }

// Verify fractional work survives the actual withCharacter persistence path.
const app = await buildServer();
try {
  const auth = await app.inject({ method: 'POST', url: '/v1/auth/guest' });
  const token = auth.json().token;
  await app.inject({ method: 'POST', url: '/v1/character', headers: { authorization: `Bearer ${token}` },
    payload: { name: `Work Mara ${crypto.randomBytes(3).toString('hex')}` } });
  const sheet = await app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${token}` } });
  const id = sheet.json().character.id;
  const accountId = (await app.pool.query('SELECT account_id FROM characters WHERE id=$1', [id])).rows[0].account_id;
  const warmWall = Date.now();
  await app.pool.query('UPDATE characters SET crew=1,crew_paid_at=$2,crew_sale_credit_ms=59000,last_accrued_at=$3 WHERE id=$1',
    [id, new Date(warmWall - 5000), new Date(warmWall - 1500)]);
  await app.pool.query('INSERT INTO stash (character_id,drug_id,qty,quality) VALUES ($1,$2,3,1)', [id, drug.id]);
  await withCharacter(app.pool, accountId, async () => ({ ok: true }));
  const row = (await app.pool.query('SELECT crew_sale_credit_ms FROM characters WHERE id=$1', [id])).rows[0];
  assert(Number(row.crew_sale_credit_ms) >= 100 && Number(row.crew_sale_credit_ms) < 10000);
  assert.equal(Number((await app.pool.query('SELECT qty FROM stash WHERE character_id=$1 AND drug_id=$2', [id, drug.id])).rows[0].qty), 2);

  // Drive the real accrual/persistence seam at the wage cap. Even frequent touches cannot sell a
  // single unit after the liability stops growing.
  const coldPaidAt = new Date(Date.now() - M4.CREW_WAGE_CAP_MS - 2000);
  const coldAt = new Date(+coldPaidAt + M4.CREW_WAGE_COLD_MS);
  const postColdAccrualAt = new Date(+coldAt + 500);
  await app.pool.query(
    'UPDATE characters SET crew=1,crew_paid_at=$2,crew_sale_credit_ms=59000,last_accrued_at=$3 WHERE id=$1',
    [id, coldPaidAt, postColdAccrualAt]);
  await withCharacter(app.pool, accountId, async () => ({ ok: true }));
  assert.equal(Number((await app.pool.query(
    'SELECT qty FROM stash WHERE character_id=$1 AND drug_id=$2', [id, drug.id])).rows[0].qty), 2,
  'the real accrual path moves no stash once wages are capped');
  assert.equal(Number((await app.pool.query(
    'SELECT crew_sale_credit_ms FROM characters WHERE id=$1', [id])).rows[0].crew_sale_credit_ms), 0,
  'cold accrual cannot bank fractional work for a later payout');
} finally { await app.close(); }

console.log('Economy pacing: crew partition, paid-through cadence, and persistence passed.');
