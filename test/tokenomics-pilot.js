import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluatePilot as evaluateAtClock, pilotExit, PILOT_POLICY, PILOT_SCHEMA } from '../tools/tokenomics-pilot.js';
import { RESTRICTED_MARKET_TRADE_FEE_BPS, RESTRICTED_MARKET_BASE_FEE_BPS, RESTRICTED_MARKET_REWARDS_FEE_BPS,
  RESTRICTED_MARKET_SPLIT_BPS } from '../tools/market-v2-deployment-plan.js';
const E = 10n ** 18n, Q96 = 1n << 96n;
const clone = x => JSON.parse(JSON.stringify(x));
const ref = n => n.toString(16).padStart(64, '0');
const evaluatePilot = input => evaluateAtClock(input, { now: Date.parse('2026-04-01T00:00:00Z') });
function fixture() {
  // Deliberately synthetic aggregates; this suite is not a real 90-day pilot receipt.
  const started = Date.parse('2026-01-01T00:00:00Z');
  const asOf = new Date(started + 90 * 86400000).toISOString().replace('.000Z', 'Z');
  return { version: 1, pilotStartedAt: '2026-01-01T00:00:00Z', asOf,
    genesis: { referenceHash: ref(7), acceptedProceedsWei: String(1000n * E), lpNativeBudgetWei: String(500n * E),
      claimedSaleOmrAtoms: String(400n * E), eligibleBondOmrAtoms: String(20n * E) },
    liquidity: { observedAt: asOf, blockNumber: '123', blockHash: '0x' + ref(123),
      liquidity: String(1000n * E), sqrtPriceX96: String(Q96), sqrtUpperX96: String(2n * Q96),
      lpFeePips: 0, referenceHash: ref(1), quote: { inputOmrAtoms: String(120n * E), minimumNativeWei: String(100n * E),
        observedAt: asOf, blockNumber: '123', blockHash: '0x' + ref(123), expiresAt: asOf, referenceHash: ref(2) } },
    cash: { observedAt: asOf, nativeBalanceWei: String(1000n * E), reservedNativeWei: String(100n * E), referenceHash: ref(3) },
    claims: { observedAt: asOf, referenceHash: ref(6), omrHeldAtoms: String(1000n * E),
      omrOwedAtoms: String(1000n * E), nativeOwedWei: String(100n * E) },
    plannedNativeFeeBaseWeiPerDay: String(100n * E), budgetedSpendWeiPerDay: String(E),
    daily: Array.from({ length: 90 }, (_, i) => ({ day: new Date(started + i * 86400000).toISOString().slice(0, 10),
      operatingSpendWei: String(E), nativeFeeBaseWei: String(20n * E), referenceHash: ref(100 + i) })),
    retention: { initialPayers: 100, retainedDay90Payers: 40, repeatPayers: 30, referenceHash: ref(4) },
    approvals: { maximumExitSlippageBps: 2000, minimumPayerRetentionBps: 3000, minimumRepeatPayers: 20, referenceHash: ref(5) } };
}
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`PASS ${name}`); };
check('pilot policy matches approved fee, proportional split, LP and dormant bond bounds', () => {
  assert.equal(PILOT_POLICY.baseTradeBps, RESTRICTED_MARKET_BASE_FEE_BPS);
  assert.equal(PILOT_POLICY.rewardsTradeBps, RESTRICTED_MARKET_REWARDS_FEE_BPS);
  assert.equal(PILOT_POLICY.totalTradeBps, RESTRICTED_MARKET_TRADE_FEE_BPS);
  assert.equal(PILOT_POLICY.maximumCombinedTradeBps, 450);
  assert.equal(PILOT_POLICY.maximumCombinedTradeBps, PILOT_POLICY.totalTradeBps + PILOT_POLICY.maximumHookBps);
  assert.deepEqual(PILOT_POLICY.splitBps, RESTRICTED_MARKET_SPLIT_BPS);
  assert.equal(PILOT_POLICY.lpBps, 5000); assert.equal(PILOT_POLICY.bondDiscountMaximumBps, 50);
  assert.equal(PILOT_POLICY.maximumExitSlippageBps, 4000);
  assert.equal(PILOT_POLICY.bondMinimumVestingSeconds, 30 * 86400); assert.equal(PILOT_POLICY.bondsStartDormant, true);
  assert.equal(PILOT_SCHEMA.additionalProperties, false);
});
check('complete synthetic evidence is only eligible for owner review and preserves all stress assumptions', () => {
  const report = evaluatePilot(fixture());
  assert.equal(report.expansionEligibleForOwnerReview, true); assert.deepEqual(report.blockedBy, []);
  assert.equal(report.stress.offeredOmrAtoms, 120n * E);
  assert.equal(report.stress.newPlayers, 0); assert.equal(report.stress.rewardTopupsWei, '0');
  assert.equal(report.stress.arbitrageIncomeWei, '0'); assert.equal(report.stress.stressedNativeFeeBaseWei, 2250n * E);
  assert.equal(report.stress.futureFeeRevenueIncludedInRunway, false);
  assert.equal(report.cash.afterStressNativeWei, 810n * E); assert.equal(report.cash.furtherRunwayDays, 810n);
  assert.match(report.limitations[0], /not independently fetched/);
});
check('bounded v4 curve understates the independent constant-product limit and deducts maximum protocol fees', () => {
  const input = fixture(), exit = pilotExit(input.liquidity, 120n * E);
  const raw = 1000n * E * 120n / 1120n;
  const independentlyRoundedNet = raw - (raw * 350n + 9999n) / 10000n
    - (raw * 50n + 9999n) / 10000n - (raw * 50n + 9999n) / 10000n;
  assert(exit.modeledNativeWei <= independentlyRoundedNet);
  assert(independentlyRoundedNet - exit.modeledNativeWei < 10n);
  assert.equal(evaluatePilot(input).exit.conservativeMinimumNativeWei, 100n * E, 'lower quoted output wins');
  input.liquidity.lpFeePips = 3000;
  assert(pilotExit(input.liquidity, 120n * E).modeledNativeWei < exit.modeledNativeWei);
});
check('mandatory reward and maximum stability are separate conservative charges at atomic boundaries', () => {
  const liquidity = { liquidity: '1000000', sqrtPriceX96: String(Q96), sqrtUpperX96: String(2n * Q96), lpFeePips: 0 };
  for (const offered of [1n, 2n, 100n, 199n, 200n, 201n, 9999n, 10000n, 10001n]) {
    const exit = pilotExit(liquidity, offered);
    const next = Q96 + offered * Q96 / 1000000n;
    const raw = 1000000n * Q96 * (next - Q96) / (next * Q96);
    const ceil = (n, d) => (n + d - 1n) / d;
    const charges = ceil(raw * 350n, 10000n) + 2n * ceil(raw * 50n, 10000n);
    assert.equal(exit.modeledNativeWei, raw > charges ? raw - charges : 0n);
    const actualCharges = raw * 350n / 10000n + 2n * (raw * 50n / 10000n);
    assert(charges >= actualCharges, 'model never overstates proceeds through fee rounding');
  }
});
check('a range cannot promise liquidity beyond its last tick', () => {
  const input = fixture(); input.genesis.eligibleBondOmrAtoms = String(1001n * E);
  const report = evaluatePilot(input);
  assert.equal(report.gates.executableCapacitySufficient, false);
  assert.equal(report.exit.conservativeMinimumNativeWei, 0n);
  assert.equal(report.expansionEligibleForOwnerReview, false);
});
check('90 elapsed days cannot be replaced by synthetic timestamps without complete daily evidence', () => {
  for (const alter of [x => { x.daily.pop(); }, x => { x.daily[40].day = x.daily[39].day; },
    x => { x.daily[40].referenceHash = x.daily[39].referenceHash; }, x => { x.asOf = '2026-03-31T00:00:00Z'; }]) {
    const input = fixture(); alter(input); assert.equal(evaluatePilot(input).expansionEligibleForOwnerReview, false);
  }
});
check('a future-dated or stale report cannot accelerate a genuine90-day pilot or clear current expansion', () => {
  const input = fixture(), asOf = Date.parse(input.asOf);
  assert.equal(evaluateAtClock(input, { now: asOf }).expansionEligibleForOwnerReview, true);
  assert.equal(evaluateAtClock(input, { now: asOf - 1 }).gates.reportClockCurrent, false);
  assert.equal(evaluateAtClock(input, { now: asOf + 3600001 }).gates.reportClockCurrent, false);
  assert.equal(evaluateAtClock(input, { now: Infinity }).expansionEligibleForOwnerReview, false);
});
check('missing retention criteria, retention receipt or explicit slippage approval blocks expansion', () => {
  for (const alter of [x => { x.retention = null; }, x => { x.approvals.referenceHash = null; },
    x => { x.approvals.maximumExitSlippageBps = null; }, x => { x.approvals.minimumPayerRetentionBps = null; },
    x => { x.retention.retainedDay90Payers = 29; }, x => { x.retention.repeatPayers = 19; }]) {
    const input = fixture(); alter(input); assert.equal(evaluatePilot(input).expansionEligibleForOwnerReview, false);
  }
});
check('approved40percent all-in ceiling permits stricter reports and rejects a one-basis-point relaxation', () => {
  const input = fixture(); input.approvals.maximumExitSlippageBps = 4000;
  input.liquidity.quote.minimumNativeWei = String(72n * E);
  const boundary = evaluatePilot(input);
  assert.equal(boundary.exit.slippageBps, 4000);
  assert.equal(boundary.gates.exitWithinExplicitApprovedSlippage, true);
  input.liquidity.quote.minimumNativeWei = String(72n * E - 1n);
  assert.equal(evaluatePilot(input).exit.slippageBps, 4001);
  assert.equal(evaluatePilot(input).gates.exitWithinExplicitApprovedSlippage, false);
  input.approvals.maximumExitSlippageBps = 4001;
  assert.throws(() => evaluatePilot(input), /outside bounds/);
  input.approvals.maximumExitSlippageBps = 3999; input.liquidity.quote.minimumNativeWei = String(72n * E);
  assert.equal(evaluatePilot(input).gates.exitWithinExplicitApprovedSlippage, false);
  input.approvals.maximumExitSlippageBps = 4000; input.approvals.referenceHash = null;
  assert.equal(evaluatePilot(input).gates.exitWithinExplicitApprovedSlippage, false, 'a static ceiling cannot replace the report approval reference');
});
check('unfunded OMR claims and spendable cash that consumes native liabilities fail closed', () => {
  const omr = fixture(); omr.claims.omrHeldAtoms = String(1000n * E - 1n);
  assert.equal(evaluatePilot(omr).gates.actualClaimsFullyBacked, false);
  const native = fixture(); native.cash.reservedNativeWei = String(100n * E - 1n);
  assert.equal(evaluatePilot(native).gates.actualClaimsFullyBacked, false);
  const unfunded = fixture(); unfunded.cash.nativeBalanceWei = String(99n * E);
  assert.equal(evaluatePilot(unfunded).gates.actualClaimsFullyBacked, false);
});
check('exact90 further days pass; one wei below fails even with enormous projected fee income', () => {
  const input = fixture(); input.cash.nativeBalanceWei = String(280n * E);
  assert.equal(evaluatePilot(input).cash.furtherRunwayDays, 90n);
  assert.equal(evaluatePilot(input).gates.actual90FurtherDaysRunwayAfterStress, true);
  input.cash.nativeBalanceWei = String(280n * E - 1n); input.plannedNativeFeeBaseWeiPerDay = String(1000000n * E);
  assert.equal(evaluatePilot(input).gates.actual90FurtherDaysRunwayAfterStress, false);
  input.budgetedSpendWeiPerDay = '0'; input.daily.forEach(row => { row.operatingSpendWei = '0'; });
  assert.equal(evaluatePilot(input).gates.actual90FurtherDaysRunwayAfterStress, false, 'missing cost evidence never becomes infinite runway');
});
check('stale, future, mismatched and absent simulation evidence cannot be replaced by the model', () => {
  for (const alter of [x => { x.liquidity.quote = null; }, x => { x.liquidity.quote.inputOmrAtoms = '1'; },
    x => { x.liquidity.quote.expiresAt = '2026-03-31T23:59:59Z'; }, x => { x.liquidity.observedAt = '2026-03-31T00:00:00Z'; },
    x => { x.cash.observedAt = '2026-04-02T00:00:00Z'; }, x => { x.liquidity.quote.minimumNativeWei = '1'; },
    x => { x.claims.referenceHash = null; }, x => { x.claims.observedAt = '2026-03-31T00:00:00Z'; }]) {
    const input = fixture(); alter(input); assert.equal(evaluatePilot(input).expansionEligibleForOwnerReview, false);
  }
});
check('exit simulation is fresh, bounded and pinned to the exact liquidity block', () => {
  for (const alter of [x => { x.liquidity.quote.observedAt = '2026-03-31T22:59:59Z'; },
    x => { x.liquidity.quote.observedAt = '2026-04-01T00:00:01Z'; },
    x => { x.liquidity.quote.expiresAt = '2026-04-01T01:00:01Z'; },
    x => { x.liquidity.quote.expiresAt = '2027-04-01T00:00:00Z'; },
    x => { x.liquidity.quote.blockNumber = '124'; }, x => { x.liquidity.quote.blockHash = '0x' + ref(124); }]) {
    const input = fixture(); alter(input);
    assert.equal(evaluatePilot(input).gates.currentExactExitSimulationReferenced, false);
    assert.equal(evaluatePilot(input).expansionEligibleForOwnerReview, false);
  }
  const boundary = fixture(); boundary.liquidity.quote.observedAt = '2026-03-31T23:00:00Z';
  assert.equal(evaluatePilot(boundary).gates.currentExactExitSimulationReferenced, true, 'exactly one hour is accepted');
  const expiredNow = evaluateAtClock(fixture(), { now: Date.parse('2026-04-01T00:00:00Z') + 1 });
  assert.equal(expiredNow.gates.reportClockCurrent, true);
  assert.equal(expiredNow.gates.currentExactExitSimulationReferenced, false, 'a current report cannot revive a quote expired against the actual clock');
});
check('closed schema rejects secret fields, unsafe integers, malformed money and invalid dates', () => {
  for (const alter of [x => { x.privateKey = 'never accept credentials'; }, x => { x.now = Date.now(); }, x => { x.cash.password = 'no'; },
    x => { x.cash.nativeBalanceWei = '-1'; }, x => { x.cash.nativeBalanceWei = String(1n << 256n); },
    x => { x.retention.initialPayers = Number.MAX_SAFE_INTEGER + 1; }, x => { x.asOf = '2026-02-30T00:00:00Z'; }]) {
    const input = fixture(); alter(input); assert.throws(() => evaluatePilot(input));
  }
});
check('input is immutable and result pins the exact submitted public export', () => {
  const input = fixture(), copy = clone(input), report = evaluatePilot(input);
  assert.deepEqual(input, copy); assert.match(report.inputSha256, /^[a-f0-9]{64}$/);
  input.daily[0].nativeFeeBaseWei = '1'; assert.notEqual(evaluatePilot(input).inputSha256, report.inputSha256);
});
check('the CLI emits a blocked report and a nonzero explicit expansion gate without inventing live history', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-pilot-'));
  const file = path.join(directory, 'synthetic-public-input.json');
  try {
    const input = fixture(); input.daily = []; input.retention = null;
    fs.writeFileSync(file, JSON.stringify(input));
    const normal = spawnSync(process.execPath, ['tools/tokenomics-pilot.js', file], { encoding: 'utf8' });
    assert.equal(normal.status, 0); assert.equal(JSON.parse(normal.stdout).expansionEligibleForOwnerReview, false);
    const gated = spawnSync(process.execPath, ['tools/tokenomics-pilot.js', file, '--require-expansion'], { encoding: 'utf8' });
    assert.equal(gated.status, 1); assert(JSON.parse(gated.stdout).blockedBy.includes('consecutive90DailyRecords'));
    const wrong = spawnSync(process.execPath, ['tools/tokenomics-pilot.js', file, '--unknown'], { encoding: 'utf8' });
    assert.equal(wrong.status, 2);
  } finally { fs.unlinkSync(file); fs.rmdirSync(directory); }
});
console.log(JSON.stringify({ pass: true, groups: passed, syntheticOnly: true, live90DayPilotCompleted: false }));
