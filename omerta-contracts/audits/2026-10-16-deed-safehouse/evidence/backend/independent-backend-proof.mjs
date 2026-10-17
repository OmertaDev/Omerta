import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import pg from 'pg';
import { keccak256, recoverTypedDataAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ensureCharacterDeedLife, bindCharacterDeedAccount, recordCharacterDeedEquipment,
  recordCharacterDeedSafeHouse, characterDeedStatus } from '../../src/deedcustody.js';
import { characterDeedSafeHouseIntent, submitCharacterDeedSafeHouse } from '../../src/deedcustodychain.js';

const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
assert(['127.0.0.1', 'localhost'].includes(endpoint.hostname));
assert.equal(endpoint.port, '15459');
const schema = 'independent_custody_' + crypto.randomBytes(8).toString('hex');
const admin = new pg.Pool({ connectionString: endpoint.toString() });
await admin.query(`CREATE SCHEMA ${schema}`);
const pool = new pg.Pool({ connectionString: endpoint.toString(), options: `-c search_path=${schema}` });
const saved = process.env.CHARACTER_DEED_CUSTODY_ENABLED;
process.env.CHARACTER_DEED_CUSTODY_ENABLED = 'true';
const address = n => '0x' + n.toString(16).padStart(40, '0');
const owner = privateKeyToAccount('0x' + '17'.repeat(32)), attacker = privateKeyToAccount('0x' + '18'.repeat(32));
const code = '0x60006000', volumeCode = '0x60016001', txHash = '0x' + '66'.repeat(32);
const config = { address: address(1), deed: address(2), dynasty: address(3), implementation: address(4),
  omr: address(5), chainId: 31337, codeHash: keccak256(code) };
const control = { dead: false, nonce: 0n, stale: false, drift: false };
const pub = {
  getChainId: async () => 31337,
  getCode: async ({ address: target }) => target.toLowerCase() === address(6) ? volumeCode : control.drift ? '0x6002' : code,
  readContract: async ({ functionName }) => {
    const getters = { deed: config.deed, dynasty: config.dynasty, accountImplementation: config.implementation,
      lifecycleOperator: address(8), accountRegistry: address(7), ESTATE_DELAY: 86400n, omr: config.omr,
      volumeSource: address(6), volumeSourceRuntimeHash: keccak256(volumeCode), settlementManager: address(6),
      safeHouseNonce: control.nonce, safeHouseUntil: 0n };
    if (functionName in getters) return getters[functionName];
    if (functionName === 'lifeState') return { account: address(9), wallet: owner.address, dynastyId: 77n, dead: control.dead };
    if (functionName === 'safeHouseQuote') return [BigInt(Math.floor(Date.now() / 86400000) - (control.stale ? 1 : 0)), 100000n * 10n ** 18n, 5n * 10n ** 18n];
    throw Error('Unexpected getter ' + functionName);
  },
  verifyTypedData: async input => (await recoverTypedDataAddress(input)).toLowerCase() === input.address.toLowerCase(),
};
const options = { config, publicClient: pub };
try {
  await pool.query('CREATE TABLE characters(id TEXT PRIMARY KEY,account_id TEXT,generation INT,alive BOOLEAN); CREATE TABLE dynasty_tokens(token_id TEXT PRIMARY KEY,account_id TEXT); CREATE TABLE keeper_transactions(job_key TEXT,status TEXT);');
  const migration = fs.readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8').match(/-- Character-life deed custody\.[\s\S]*?-- End character-life deed custody\./)[0];
  await pool.query(migration);
  await pool.query("INSERT INTO characters VALUES ('life-a','a',1,true); INSERT INTO dynasty_tokens VALUES ('77','a')");
  const life = await ensureCharacterDeedLife(pool, 'life-a');
  await bindCharacterDeedAccount(pool, { finalized: true, txHash, ref: txHash + ':0', lifeHash: life.life_hash, address: address(9), dynastyTokenId: '77' });
  await recordCharacterDeedEquipment(pool, { finalized: true, txHash, ref: txHash + ':1', tokenId: '7', lifeHash: life.life_hash, blockNumber: 1, logIndex: 1, blockTimestamp: Math.floor(Date.now() / 1000) });
  const plan = await characterDeedSafeHouseIntent(pool, 'a', '7', 1, options);
  const signed = await owner.signTypedData(plan.typedData), message = plan.typedData.message;
  const args = { tokenId: '7', days: 1, priceDay: message.priceDay, maxBurn: message.maxBurn,
    userNonce: message.nonce, userIssuedAt: message.issuedAt, userDeadline: message.deadline, userSignature: signed };
  const bad = await attacker.signTypedData(plan.typedData);
  await assert.rejects(() => submitCharacterDeedSafeHouse(pool, 'a', { ...args, userSignature: bad }, options), { code: 'custody_consent' });
  for (const change of [{ days: 2 }, { maxBurn: String(BigInt(args.maxBurn) + 1n) }, { priceDay: String(BigInt(args.priceDay) - 1n) }, { userNonce: '1' }])
    await assert.rejects(() => submitCharacterDeedSafeHouse(pool, 'a', { ...args, ...change }, options), { code: 'custody_quote' });
  const accepted = await submitCharacterDeedSafeHouse(pool, 'a', args, options);
  assert.equal(accepted.pending, true); assert.equal(accepted.protected, false);
  const repeat = await submitCharacterDeedSafeHouse(pool, 'a', args, options);
  assert.equal(repeat.duplicate, true);
  assert.equal((await pool.query('SELECT count(*)::int n FROM character_deed_safe_house_intents')).rows[0].n, 1);
  assert.equal((await characterDeedStatus(pool, 'a')).equipment[0].protected, false, 'A valid queued owner signature never activates protection');
  control.nonce = 1n;
  await assert.rejects(() => submitCharacterDeedSafeHouse(pool, 'a', args, options), { code: 'custody_quote' });
  control.nonce = 0n; control.stale = true;
  await assert.rejects(() => characterDeedSafeHouseIntent(pool, 'a', '7', 1, options), { code: 'custody_quote' });
  control.stale = false; control.dead = true;
  await assert.rejects(() => submitCharacterDeedSafeHouse(pool, 'a', args, options), { code: 'custody_binding' });
  control.dead = false; control.drift = true;
  await assert.rejects(() => characterDeedSafeHouseIntent(pool, 'a', '7', 1, options), /pinned code/);
  control.drift = false;
  const now = Math.floor(Date.now() / 1000);
  await recordCharacterDeedSafeHouse(pool, { finalized: true, txHash, ref: txHash + ':2', tokenId: '7', dynastyTokenId: '77', lifeHash: life.life_hash,
    startsAt: now - 1, until: now + 86400, nonce: '0', priceDay: message.priceDay, previousDayVolume: plan.previousDayVolumeAtomic,
    burnAmount: plan.maxBurnAtomic, blockNumber: 2, logIndex: 2 });
  assert.equal((await characterDeedStatus(pool, 'a')).equipment[0].protected, true, 'Only finalized coverage activates protection');
  await pool.query("UPDATE characters SET alive=false WHERE id='life-a'; INSERT INTO characters VALUES ('life-a2','a',2,true)");
  await assert.rejects(() => submitCharacterDeedSafeHouse(pool, 'a', args, options), { code: 'custody_equipment' });
  console.log('independent backend Safe House proof: PASS (real owner signatures, attacker rejection, exact fee/days/day/nonce binding, idempotent queue, pending not protected, replay and UTC expiry, postdeath and changed life rejection, runtime pins, finalized-only coverage; isolated native PostgreSQL)');
} finally {
  if (saved === undefined) delete process.env.CHARACTER_DEED_CUSTODY_ENABLED; else process.env.CHARACTER_DEED_CUSTODY_ENABLED = saved;
  await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();
}
