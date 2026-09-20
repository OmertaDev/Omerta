import assert from 'node:assert/strict';
import { ARCHETYPES, rosterFor, verifyLedgerChecks } from '../tools/rc1-sim.js';

for (const population of [25, 100, 250, 500, 1000]) {
  const roster = rosterFor(population, 'rc1-alpha', 0);
  assert.equal(roster.length + 5, population);
  assert.equal(new Set(roster.map((r) => r.id)).size, population - 5);
  assert.deepEqual([...new Set(roster.map((r) => r.archetype))].sort(), [...ARCHETYPES].sort());
  assert.deepEqual(roster, rosterFor(population, 'rc1-alpha', 0));
  assert.notDeepEqual(roster, rosterFor(population, 'rc1-alpha', 1));
  assert.notDeepEqual(roster, rosterFor(population, 'rc1-beta', 0));
}
const baseline = { checks: [{ name: 'character cash', drift: 2487500, ok: false },
  { name: '$OMR conservation', drift: 0, ok: true },
  { name: 'world graph unique custody and provenance', drift: 0, ok: true }] };
assert(verifyLedgerChecks(baseline, structuredClone(baseline), 25).every((c) => c.ok));
for (const name of baseline.checks.map((c) => c.name)) {
  const corrupt = structuredClone(baseline);
  const check = corrupt.checks.find((c) => c.name === name); check.drift++; check.ok = false;
  assert.throws(() => verifyLedgerChecks(baseline, corrupt, 25), /Conservation\/provenance/);
}
const missing = structuredClone(baseline); missing.checks.pop();
assert.throws(() => verifyLedgerChecks(baseline, missing, 25), /retain every/);
const brokenBaseline = structuredClone(baseline); brokenBaseline.checks[1].ok = false;
assert.throws(() => verifyLedgerChecks(brokenBaseline, baseline, 25), /Unexpected baseline corruption/);
assert.throws(() => verifyLedgerChecks(baseline, baseline, 100), /Expected values to be strictly equal/);
console.log('RC1 simulation: heterogeneous seeded roster, independent replicates, mandatory invariant retention and corruption detection PASS');
