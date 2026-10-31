#!/usr/bin/env node
// Read-only public aggregate exports and offline stress arithmetic. Never signs or broadcasts.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const PILOT_SCHEMA = JSON.parse(fs.readFileSync(new URL('../omerta-contracts/docs/market-v2/tokenomics-pilot.schema.json', import.meta.url)));
export const PILOT_POLICY = Object.freeze({ days: 90, furtherRunwayDays: 90, lpBps: 5000,
  maximumExitSlippageBps: 4000,
  baseTradeBps: 350, rewardsTradeBps: 50, totalTradeBps: 400, maximumHookBps: 50, maximumCombinedTradeBps: 450,
  splitBps: { dev: 127, rwa: 51, community: 76, pol: 96 },
  stressedVolumeBps: 2500, firstWeekClaimSaleBps: 2500, bondDiscountMaximumBps: 50,
  bondMinimumVestingSeconds: 30 * 86400, bondsStartDormant: true });
const DAY = 86400000, Q96 = 1n << 96n, UINT256 = 1n << 256n;
const ceil = (n, d) => (n + d - 1n) / d;
function validate(value, schema, at = 'input') {
  if (schema.$ref) schema = PILOT_SCHEMA.$defs[schema.$ref.split('/').at(-1)];
  if (Object.hasOwn(schema, 'const') && value !== schema.const) throw Error(`${at}: wrong version`);
  const types = [].concat(schema.type || []);
  const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value;
  if (types.length && !types.includes(actual)) throw Error(`${at}: expected ${types.join('/')}`);
  if (value === null) return;
  if (actual === 'object') {
    for (const key of Object.keys(value)) if (!Object.hasOwn(schema.properties, key)) throw Error(`${at}.${key}: unknown public input field`);
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) throw Error(`${at}.${key}: missing`);
    for (const [key, item] of Object.entries(value)) validate(item, schema.properties[key], `${at}.${key}`);
  } else if (actual === 'array') {
    if (value.length > schema.maxItems) throw Error(`${at}: too many records`);
    value.forEach((item, i) => validate(item, schema.items, `${at}[${i}]`));
  } else if (actual === 'string') {
    if ((schema.maxLength && value.length > schema.maxLength) || (schema.pattern && !new RegExp(schema.pattern).test(value))) throw Error(`${at}: invalid public value`);
    if (schema === PILOT_SCHEMA.$defs.uint && BigInt(value) >= UINT256) throw Error(`${at}: exceeds uint256`);
  } else if (actual === 'integer') {
    if (!Number.isSafeInteger(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity)) throw Error(`${at}: outside bounds`);
  }
}
function instant(value, label) {
  const result = Date.parse(value);
  if (!Number.isFinite(result) || new Date(result).toISOString().replace('.000Z', 'Z') !== value) throw Error(`${label}: invalid UTC timestamp`);
  return result;
}
const fresh = (stamp, asOf) => { const time = instant(stamp, 'observation'); return time <= asOf && asOf - time <= 3600000; };

// OMR is currency1; a sale increases sqrtPrice. Only this locked protocol range is counted.
// Rounded down input/output and rounded up protocol fees deliberately understate proceeds.
export function pilotExit({ liquidity, sqrtPriceX96, sqrtUpperX96, lpFeePips }, offered) {
  const L = BigInt(liquidity), current = BigInt(sqrtPriceX96), upper = BigInt(sqrtUpperX96);
  if (L <= 0n || L >= (1n << 128n) || current < 4295128739n || upper <= current || upper > 1461446703485210103287273052203988822378723970342n) throw Error('liquidity: invalid bounded range');
  const effective = offered * BigInt(1000000 - lpFeePips) / 1000000n;
  const capacity = L * (upper - current) / Q96;
  const used = effective < capacity ? effective : capacity;
  const next = current + used * Q96 / L;
  const raw = L * Q96 * (next - current) / (next * current);
  // Charge original base, mandatory rewards and maximum stability separately. Each ceil
  // conservatively understates proceeds; execution uses its independent atomic-unit floors.
  const charges = ceil(raw * 350n, 10000n) + ceil(raw * 50n, 10000n) + ceil(raw * 50n, 10000n);
  const net = raw > charges ? raw - charges : 0n;
  const ideal = offered * Q96 * Q96 / (current * current);
  return { capacitySatisfied: effective <= capacity, effectiveInputAtoms: effective, capacityAtoms: capacity,
    modeledNativeWei: net, spotReferenceWei: ideal,
    protocolLpNativeWei: L * Q96 * (upper - current) / (upper * current) };
}

export function evaluatePilot(input, { now = Date.now() } = {}) {
  validate(input, PILOT_SCHEMA);
  const started = instant(input.pilotStartedAt, 'pilotStartedAt'), asOf = instant(input.asOf, 'asOf');
  if (asOf < started) throw Error('asOf: before pilot');
  const elapsedDays = Math.floor((asOf - started) / DAY), g = input.genesis, c = input.cash;
  if (BigInt(g.claimedSaleOmrAtoms) > 60000000n * 10n ** 18n) throw Error('claimed sale inventory exceeds approved allocation');
  const offered = ceil(BigInt(g.claimedSaleOmrAtoms) * 2500n, 10000n) + BigInt(g.eligibleBondOmrAtoms);
  const curve = pilotExit(input.liquidity, offered);
  const approvals = input.approvals, retention = input.retention, quote = input.liquidity.quote;
  const quoteObserved = quote ? instant(quote.observedAt, 'quote observation') : null;
  const quoteExpiry = quote ? instant(quote.expiresAt, 'quote expiry') : null;
  const quoteValid = !!quote?.referenceHash && BigInt(quote.inputOmrAtoms) === offered
    && fresh(quote.observedAt, asOf) && quote.blockNumber === input.liquidity.blockNumber
    && quote.blockHash === input.liquidity.blockHash
    && quoteExpiry >= asOf && quoteExpiry >= now && quoteExpiry >= quoteObserved
    && quoteExpiry - quoteObserved <= 3600000;
  const quotedMinimum = quoteValid ? BigInt(quote.minimumNativeWei) : 0n;
  const exitMinimum = curve.capacitySatisfied && quoteValid
    ? (curve.modeledNativeWei < quotedMinimum ? curve.modeledNativeWei : quotedMinimum) : 0n;
  const slippageBps = curve.spotReferenceWei > 0n
    ? Number(ceil((curve.spotReferenceWei > exitMinimum ? curve.spotReferenceWei - exitMinimum : 0n) * 10000n, curve.spotReferenceWei)) : 10000;
  const consecutive = input.daily.length === 90 && input.daily.every((row, i) => row.day === new Date(started + i * DAY).toISOString().slice(0, 10));
  const recordsReferenced = input.daily.every(row => !!row.referenceHash)
    && new Set(input.daily.map(row => row.referenceHash)).size === input.daily.length;
  let burn = BigInt(input.budgetedSpendWeiPerDay);
  for (const row of input.daily) if (BigInt(row.operatingSpendWei) > burn) burn = BigInt(row.operatingSpendWei);
  const balance = BigInt(c.nativeBalanceWei), reserved = BigInt(c.reservedNativeWei);
  const free = balance > reserved ? balance - reserved : 0n;
  const stressSpend = burn * 90n, afterStress = free > stressSpend ? free - stressSpend : 0n;
  const claimsBacked = BigInt(input.claims.omrHeldAtoms) >= BigInt(input.claims.omrOwedAtoms)
    && reserved >= BigInt(input.claims.nativeOwedWei) && balance >= reserved;
  const retentionValid = !!retention?.referenceHash && !!approvals.referenceHash
    && approvals.minimumPayerRetentionBps !== null && approvals.minimumRepeatPayers !== null
    && retention.retainedDay90Payers <= retention.initialPayers && retention.repeatPayers <= retention.initialPayers
    && BigInt(retention.retainedDay90Payers) * 10000n >= BigInt(retention.initialPayers) * BigInt(approvals.minimumPayerRetentionBps)
    && retention.repeatPayers >= approvals.minimumRepeatPayers;
  const gates = {
    reportClockCurrent: Number.isFinite(now) && asOf <= now && now - asOf <= 3600000,
    completed90Days: elapsedDays >= 90,
    consecutive90DailyRecords: consecutive && recordsReferenced,
    retentionEvidenceMeetsApprovedCriteria: retentionValid,
    actualClaimsFullyBacked: claimsBacked,
    actualClaimsSnapshotFresh: !!input.claims.referenceHash && fresh(input.claims.observedAt, asOf),
    actualCashSnapshotFresh: !!c.referenceHash && fresh(c.observedAt, asOf),
    lockedLiquiditySnapshotFresh: !!input.liquidity.referenceHash && fresh(input.liquidity.observedAt, asOf),
    approved50PercentLpBudget: !!g.referenceHash && BigInt(g.lpNativeBudgetWei) > 0n
      && BigInt(g.lpNativeBudgetWei) === BigInt(g.acceptedProceedsWei) * 5000n / 10000n
      && curve.protocolLpNativeWei > 0n,
    currentExactExitSimulationReferenced: quoteValid && offered > 0n,
    executableCapacitySufficient: curve.capacitySatisfied,
    exitWithinExplicitApprovedSlippage: approvals.maximumExitSlippageBps !== null && !!approvals.referenceHash
      && slippageBps <= approvals.maximumExitSlippageBps,
    actual90FurtherDaysRunwayAfterStress: burn > 0n && free >= stressSpend && afterStress >= burn * 90n,
  };
  const valid = Object.values(gates).every(Boolean);
  return { schemaVersion: 1, phase: 'local economic pilot report; not deployment or activation authority', policy: PILOT_POLICY,
    inputSha256: createHash('sha256').update(JSON.stringify(input)).digest('hex'), elapsedDays,
    stress: { newPlayers: 0, rewardTopupsWei: '0', arbitrageIncomeWei: '0', durationDays: 90,
      volumeFractionBps: 2500, firstWeekClaimSaleFractionBps: 2500, eligibleBondsSoldFractionBps: 10000,
      stressedNativeFeeBaseWei: BigInt(input.plannedNativeFeeBaseWeiPerDay) * 90n / 4n,
      indicativeOperationsFeeWei: BigInt(input.plannedNativeFeeBaseWeiPerDay) * 90n * 127n / 40000n,
      futureFeeRevenueIncludedInRunway: false, offeredOmrAtoms: offered },
    exit: { ...curve, quotedMinimumNativeWei: quotedMinimum, conservativeMinimumNativeWei: exitMinimum, slippageBps },
    cash: { freeNativeWei: free, dailyBurnWei: burn, stressSpendWei: stressSpend, afterStressNativeWei: afterStress,
      furtherRunwayDays: burn > 0n ? afterStress / burn : null },
    gates, blockedBy: Object.keys(gates).filter(key => !gates[key]),
    expansionEligibleForOwnerReview: valid,
    limitations: ['Public aggregate evidence hashes are supplied attestations, not independently fetched or authenticated by this tool.',
      'Single-range v4 curve counts only locked protocol liquidity, assumes constant fees and no competing transactions; it is not an execution guarantee.',
      'A fresh exact-action simulation reference is mandatory; modeled proceeds never override its lower minimum.',
      'Runway excludes LP principal, OMR inventory, unrealized token fees, future buyers and all future fee receipts.',
      'Retention thresholds and slippage require explicit owner approval; mathematical eligibility does not establish product health or authorize expansion.'] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2), file = args[0];
    if (!file || args.length > 2 || (args[1] && args[1] !== '--require-expansion')) throw Error('Usage: node tools/tokenomics-pilot.js PUBLIC_INPUT.json [--require-expansion]');
    const input = JSON.parse(fs.readFileSync(file, 'utf8'));
    const result = evaluatePilot(input);
    console.log(JSON.stringify(result, (_, value) => typeof value === 'bigint' ? String(value) : value, 2));
    if (args.includes('--require-expansion') && !result.expansionEligibleForOwnerReview) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
