import assert from 'node:assert/strict';
import { makeDb } from '../src/db.js';
import * as Bonds from '../src/bonds.js';
import * as Chain from '../src/chain.js';
import * as Desk from '../src/desk.js';
import {
  GENESIS_PHASES,
  assertExistingDeskFillOpen,
  assertGenesisBondsOpen,
  genesisLaunchPhase,
  genesisLaunchStatus,
} from '../src/genesislaunch.js';

assert.equal(genesisLaunchPhase({}), 'legacy');
for (const phase of GENESIS_PHASES) assert.equal(genesisLaunchPhase({ GENESIS_LAUNCH_PHASE: phase }), phase);
assert.throws(() => genesisLaunchPhase({ GENESIS_LAUNCH_PHASE: 'open-ish' }), (e) => e.code === 'launch_config');
assert.equal(genesisLaunchStatus({ GENESIS_LAUNCH_PHASE: 'auction' }).bondQuotesOpen, false);
assert.equal(genesisLaunchStatus({ GENESIS_LAUNCH_PHASE: 'oracle_warmup' }).deskAuctionsOpen, false);
assert.equal(genesisLaunchStatus({ GENESIS_LAUNCH_PHASE: 'live' }).bondQuotesOpen, true);
assert.throws(() => assertGenesisBondsOpen({ GENESIS_LAUNCH_PHASE: 'migration' }), (e) => e.code === 'genesis_launch');
assert.doesNotThrow(() => assertExistingDeskFillOpen({ GENESIS_LAUNCH_PHASE: 'prepare' }));
assert.throws(() => assertExistingDeskFillOpen({ GENESIS_LAUNCH_PHASE: 'auction' }), (e) => e.code === 'genesis_launch');

const prior = process.env.GENESIS_LAUNCH_PHASE;
const pool = await makeDb();
try {
  process.env.GENESIS_LAUNCH_PHASE = 'auction';
  assert.deepEqual(
    await Desk.openAuction(pool),
    { opened: false, reason: 'genesis_launch', phase: 'auction' },
    'the worker cannot open a parallel Desk sale',
  );
  await assert.rejects(() => Bonds.setBondOffering(pool, 100_000), (e) => e.code === 'genesis_launch');
  await assert.rejects(() => Chain.quoteBond(pool, 'account', 1), (e) => e.code === 'genesis_launch');
  await assert.rejects(
    () => Desk.recordAuctionBuy(pool, { ref: 'would-be-fill', accountId: 'account', omr: 1 }),
    (e) => e.code === 'genesis_launch',
  );
  assert.equal((await Desk.deskBoard(pool)).genesis.phase, 'auction');
  assert.equal((await Bonds.bondBoard(pool, null)).genesis.phase, 'auction');

  process.env.GENESIS_LAUNCH_PHASE = 'prepare';
  await assert.rejects(
    () => Desk.recordAuctionBuy(pool, {}),
    (e) => e.code === 'ref',
    'prepare blocks new lots but still honors already-open fill ingestion until the drain window ends',
  );

  process.env.GENESIS_LAUNCH_PHASE = 'live';
  const offering = await Bonds.setBondOffering(pool, 100_000);
  assert.equal(offering.offeredOmr, 100_000, 'normal bonds reopen only after the operator declares oracle-ready live');
  assert.notEqual((await Desk.openAuction(pool)).reason, 'genesis_launch');
} finally {
  if (prior == null) delete process.env.GENESIS_LAUNCH_PHASE;
  else process.env.GENESIS_LAUNCH_PHASE = prior;
  await pool.end();
}

console.log('✅ Genesis launch gate test passed — Desk and bonds close through auction/migration/oracle warm-up, prepare drains existing fills, and live reopens normal operations.');
