// Independent adversarial policy review; retained failing run precedes fixes.
import assert from 'node:assert/strict';
import { parseUnits } from 'viem';
import { buildLiquidityPlanningContext } from '../src/liquiditypolicy.js';
import { automaticLiquidityPhase, setLiquidityObservation } from '../src/liquiditystate.js';

const now = Date.now();
const manifest = { chainId: 4663, jobs: [{ id: 'desk', kind: 'buyback', stream: 1 }] };
const snapshot = { readAt: now, health: true, genesisPhase: 5, blockNumber: '100', blockHash: `0x${'11'.repeat(32)}`,
  oracle: { omrPerEth: parseUnits('16', 18).toString() }, jobs: { desk: { amount: parseUnits('1', 18).toString() } } };
const outcomes = [];
const check = async (name, run) => {
  try { await run(); outcomes.push(true); console.log(`PASS ${name}`); }
  catch (error) { outcomes.push(false); console.log(`FAIL ${name}: ${error.message}`); }
};
await check('an older healthy observation cannot reopen the process-local phase after a newer unhealthy one', async () => {
  let stored = null;
  const q = { query: async (sql, args = []) => {
    if (/INSERT INTO liquidity_market_status/.test(sql)) {
      if (stored && stored.observed_at > args[6]) return { rowCount: 0, rows: [] };
      stored = { phase: args[2], ready: args[3], observed_at: args[6], expires_at: args[7], bond_ready: args[8], bond_daily_cap_wei: args[9] };
      return { rowCount: 1, rows: [stored] };
    }
    if (/SELECT phase,ready/.test(sql)) return { rows: stored ? [stored] : [] };
    return { rows: [] };
  } };
  setLiquidityObservation(null);
  await buildLiquidityPlanningContext(q, manifest, { ...snapshot, health: false });
  await buildLiquidityPlanningContext(q, manifest, { ...snapshot, readAt: now - 1000 });
  assert.equal(stored.phase, 'oracle_warmup');
  assert.equal(automaticLiquidityPhase(now), 'oracle_warmup');
});
await check('Desk minimum output rounds against the exact approved band ceiling', async () => {
  const q = { query: async () => ({ rows: [{ price_omr_per_eth: '10', created_at: new Date(now - 1000) }] }) };
  const context = await buildLiquidityPlanningContext(q, manifest, snapshot, { persist: false });
  assert.equal(context.desk.desk.buyAllowed, true);
  const exactCeiling = parseUnits('0.08', 18), amount = parseUnits('1', 18);
  const required = (amount * 10n ** 18n + exactCeiling - 1n) / exactCeiling;
  assert.ok(BigInt(context.desk.desk.minOutWei) >= required, `${context.desk.desk.minOutWei} permits an output below ${required}`);
});
await check('a Vig print timestamped after the snapshot cannot authorize the Desk strategy', async () => {
  const q = { query: async () => ({ rows: [{ price_omr_per_eth: '10', created_at: new Date(now + 1000) }] }) };
  const context = await buildLiquidityPlanningContext(q, manifest, snapshot, { persist: false });
  assert.notEqual(context.desk.desk?.buyAllowed, true);
});
console.log(JSON.stringify({ suite: 'liquidity policy adversarial review', passed: outcomes.filter(Boolean).length, failed: outcomes.filter((v) => !v).length }));
if (outcomes.some((v) => !v)) process.exitCode = 1;
