import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseUnits } from 'viem';
import { buildLiquidityManifestExample } from '../tools/liquidity-manifest-example.js';
if (process.argv.includes('--memory')) delete process.env.DATABASE_URL;
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  assert.equal(url.pathname, '/omerta_liquidity_policy_test', 'use the dedicated disposable database');
}
const { makeDb } = await import('../src/db.js');
const { buildLiquidityPlanningContext: observe, refreshLiquidityObservation: refresh, ensureDailyBondOffering: offer } = await import('../src/liquiditypolicy.js');
const { setBondOffering } = await import('../src/bonds.js');
const { dayOf } = await import('../src/rules.js');
async function withPinnedManifest(manifest, run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-liquidity-policy-fixture-'));
  const file = path.join(dir, 'manifest.json'), bytes = JSON.stringify(manifest);
  fs.writeFileSync(file, bytes);
  const values = {
    LIQUIDITY_AUTOMATION_ENABLED: 'on', LIQUIDITY_AUTOMATION_MANIFEST_PATH: file,
    LIQUIDITY_AUTOMATION_MANIFEST_SHA256: createHash('sha256').update(bytes).digest('hex'),
    CHAIN_ID: '4663', CHAIN_RPC_URL: 'https://example.invalid', LIQUIDITY_RPC_URLS: undefined,
    DEX_BOT_ENABLED: undefined, DEX_BOT_PK: undefined,
  };
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  const apply = (entries) => {
    for (const [key, value] of Object.entries(entries)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  };
  try { apply(values); return await run(); }
  finally { apply(previous); fs.unlinkSync(file); fs.rmdirSync(dir); }
}
const pool = await makeDb();
const now = Date.now();
const manifest = { chainId: 4663, jobs: [{ id: 'desk', kind: 'buyback', stream: 1 }] };
const config = { enabled: true, manifest };
const snapshot = { health: true, genesisPhase: 5, readAt: now, blockNumber: '100', blockHash: `0x${'11'.repeat(32)}`,
  oracle: { omrPerEth: parseUnits('60000', 18).toString() }, jobs: { desk: { amount: parseUnits('0.01', 18).toString() } },
  bond: { ready: true, dailyCapOmrWei: parseUnits('250.9', 18).toString() } };
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
try {
  await check('absent, expired and deployment-mismatched observations close authority', async () => {
    assert.equal((await refresh(pool, { config, now })).ready, false);
    await observe(pool, manifest, snapshot);
    assert.equal((await refresh(pool, { config, now: now + 90_000 })).ready, false);
    assert.equal((await refresh(pool, { config, now: now - 1 })).ready, false);
    assert.equal((await refresh(pool, { config: { ...config, manifest: { ...manifest, chainId: 46630 } }, now })).ready, false);
  });
  await check('bond pause leaves general market health available but prevents daily authority', async () => {
    await observe(pool, manifest, { ...snapshot, bond: { ready: false } });
    const state = await refresh(pool, { config, now });
    assert.equal(state.ready, true);
    assert.equal(state.bondReady, false);
    assert.equal((await offer(pool, { config, now, dailyOmr: 100 })).created, false);
  });
  await check('read-only planning does not publish a heartbeat or open issuance', async () => {
    await observe(pool, manifest, snapshot, { persist: false });
    assert.equal((await refresh(pool, { config, now })).bondReady, false);
  });
  await check('daily offering requires explicit policy and clips to the contract cap', async () => {
    await observe(pool, manifest, snapshot);
    await pool.query('UPDATE bond_reserve SET capacity_omr=1000,committed_omr=0 WHERE id=1');
    assert.equal((await offer(pool, { config, now, dailyOmr: 0 })).reason, 'daily_policy_unset');
    assert.equal((await offer(pool, { config, now, dailyOmr: 500 })).offeredOmr, 250);
    assert.equal((await offer(pool, { config, now, dailyOmr: 1000 })).reason, 'already_defined');
  });
  await check('a manual emergency stop survives automatic retries even while unhealthy', async () => {
    await observe(pool, manifest, { ...snapshot, health: false });
    await withPinnedManifest(buildLiquidityManifestExample({ placeholders: false }), async () => {
      assert.equal((await setBondOffering(pool, 0, dayOf(now))).offeredOmr, 0);
    });
    await observe(pool, manifest, snapshot);
    assert.equal((await offer(pool, { config, now, dailyOmr: 500 })).offeredOmr, 0);
  });
  await check('the next day clips to exact remaining lifetime capacity and never refills it', async () => {
    const tomorrow = now + 86400_000;
    await pool.query('UPDATE bond_reserve SET capacity_omr=1000,committed_omr=900.000001 WHERE id=1');
    await observe(pool, manifest, { ...snapshot, readAt: tomorrow });
    assert.equal((await offer(pool, { config, now: tomorrow, dailyOmr: 500 })).offeredOmr, 99);
    const reserve = (await pool.query('SELECT capacity_omr,committed_omr FROM bond_reserve WHERE id=1')).rows[0];
    assert.equal(Number(reserve.capacity_omr), 1000);
    assert.equal(Number(reserve.committed_omr), 900.000001);
  });
  await check('Genesis warmup, failed migration and unhealthy foundation do not open markets', async () => {
    for (const genesisPhase of [0, 1, 2, 3, 4]) {
      await observe(pool, manifest, { ...snapshot, readAt: now + 86400_001, genesisPhase });
      assert.equal((await refresh(pool, { config, now: now + 86400_001 })).ready, false);
    }
  });
  if (process.env.DATABASE_URL) await check('concurrent workers publish only one offering under the lifetime reserve lock', async () => {
    const next = now + 2 * 86400_000;
    await observe(pool, manifest, { ...snapshot, readAt: next });
    const result = await Promise.all(Array.from({ length: 6 }, () => offer(pool, { config, now: next, dailyOmr: 10 })));
    assert.equal(result.filter((r) => r.created).length, 1);
  });
  const unlimitedManifest = buildLiquidityManifestExample({ placeholders: false });
  unlimitedManifest.bondDailyIssuance = 'unlimited';
  const unlimitedConfig = { enabled: true, manifest: unlimitedManifest };
  const unlimitedNow = now + 3 * 86400_000;
  const unlimitedSnapshot = { ...snapshot, readAt: unlimitedNow,
    bond: { ready: true, dailyCapOmrWei: '0', dailyIssuancePolicy: 'unlimited' } };
  await check('explicit unlimited heartbeat requires zero cap and creates no daily offering row', async () => {
    await observe(pool, unlimitedManifest, unlimitedSnapshot);
    const state = await refresh(pool, { config: unlimitedConfig, now: unlimitedNow });
    assert.equal(state.bondReady, true);
    assert.equal(state.dailyIssuancePolicy, 'unlimited');
    assert.equal((await offer(pool, { config: unlimitedConfig, now: unlimitedNow, dailyOmr: 1000 })).reason, 'daily_limit_removed');
    assert.equal((await pool.query('SELECT offered_omr FROM bond_offerings WHERE day=$1', [dayOf(unlimitedNow)])).rows.length, 0);
    const cappedManifest = { ...unlimitedManifest, bondDailyIssuance: 'capped' };
    assert.equal((await refresh(pool, { config: { enabled: true, manifest: cappedManifest }, now: unlimitedNow })).bondReady, false,
      'an observation for unlimited mode cannot authorize a different manifest');
    assert.equal((await refresh(pool, { config: unlimitedConfig, now: unlimitedNow + 90_000 })).bondReady, false);
  });
  await check('unlimited readiness still fails for positive cap, bond pause and unhealthy foundation', async () => {
    for (const changed of [
      { bond: { ready: true, dailyCapOmrWei: '1' } },
      { bond: { ready: false, dailyCapOmrWei: '0' } },
      { health: false },
    ]) {
      await observe(pool, unlimitedManifest, { ...unlimitedSnapshot, ...changed });
      assert.equal((await refresh(pool, { config: unlimitedConfig, now: unlimitedNow })).bondReady, false);
      assert.equal((await offer(pool, { config: unlimitedConfig, now: unlimitedNow })).reason, 'liquidity_unavailable');
    }
  });
  await check('unlimited mode rejects legacy daily controls instead of reporting an ineffective pause', async () => {
    await withPinnedManifest(unlimitedManifest, async () => {
      for (const amount of [0, 1000]) {
        await assert.rejects(() => setBondOffering(pool, amount, dayOf(unlimitedNow)),
          (error) => error.code === 'daily_offerings_disabled' && /Safe or guardian/.test(error.message));
      }
    });
  });
  console.log(`${passed} liquidity policy checks passed`);
} finally { await pool.end(); }
