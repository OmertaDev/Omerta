// Actual projection with a fixture RPC, including unsafe transfers and a receiver
// callback that moves a deed again before the outer custody event is emitted.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newDb } from 'pg-mem';
import { keccak256, toEventSelector, toFunctionSelector } from 'viem';
import { DEED_CUSTODY_ABI, characterDeedChainConfig, syncCharacterDeedEvents,
  verifyCharacterDeedDeployment } from '../src/deedcustodychain.js';
import { ensureCharacterDeedLife, recordCharacterDeedDeath } from '../src/deedcustody.js';
import { deedTargetRows } from '../src/stockdeliver.js';

const address = n => '0x' + String(n).padStart(40, '0');
const txHash = '0x' + '11'.repeat(32), code = '0x60006000', zero = address(0);
const config = { address: address(99), deed: address(98), dynasty: address(97), implementation: address(96), omr: address(93),
  chainId: 31337, confirmations: 2, startBlock: 1n, codeHash: keccak256(code) };
const envBefore = process.env.CHARACTER_DEED_CUSTODY_ADDRESS;
const flagBefore = process.env.CHARACTER_DEED_CUSTODY_ENABLED;
const schema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const migration = schema.match(/-- Character-life deed custody\.[\s\S]*?-- End character-life deed custody\./)[0];
const db = newDb();
db.public.none(`CREATE TABLE characters(id TEXT PRIMARY KEY,account_id TEXT,generation INT,alive BOOLEAN);
  CREATE TABLE dynasty_tokens(token_id TEXT PRIMARY KEY,account_id TEXT);
  CREATE TABLE chain_cursor(stream TEXT PRIMARY KEY,last_block BIGINT);
  CREATE TABLE street_deeds(account_id TEXT PRIMARY KEY,name TEXT,district TEXT,onchain_token_id TEXT,
    extracted_by_account TEXT,extracted_at TIMESTAMPTZ,onchain_owner TEXT,building_id TEXT);
  CREATE TABLE account_persistent(account_id TEXT PRIMARY KEY,wallet_address TEXT);`);
db.public.none(migration);
const adapter = db.adapters.createPg(), pool = new adapter.Pool();
let logs = [], head = 10n;
const pub = {
  getChainId: async () => config.chainId, getCode: async () => code,
  getBlockNumber: async () => head, getBlock: async ({ blockNumber }) => ({ timestamp: 1_700_000_000n + blockNumber }),
  readContract: async ({ functionName }) => ({ deed: config.deed, dynasty: config.dynasty,
    accountImplementation: config.implementation, lifecycleOperator: address(95), accountRegistry: address(94), ESTATE_DELAY: 86400n,
    omr: config.omr, volumeSource: address(92), volumeSourceRuntimeHash: keccak256(code), settlementManager: address(92) })[functionName],
  getLogs: async ({ address: target, fromBlock, toBlock }) => logs.filter(l => l.blockNumber >= fromBlock
    && l.blockNumber <= toBlock && (l.eventName === 'Transfer' ? target === config.deed : target === config.address)),
};
const log = (eventName, args, block, index) => ({ eventName, args, blockNumber: BigInt(block), logIndex: index, transactionHash: txHash });
async function seed(id) {
  await pool.query('INSERT INTO characters(id,account_id,generation,alive) VALUES ($1,$1,1,true)', [id]);
  return ensureCharacterDeedLife(pool, id);
}
try {
  assert.equal(characterDeedChainConfig({}), null);
  assert.equal(characterDeedChainConfig({ CHARACTER_DEED_CUSTODY_ADDRESS: address(99) }), null, 'Address alone cannot activate custody');
  assert.throws(() => characterDeedChainConfig({ CHARACTER_DEED_CUSTODY_ENABLED:'true' }), /configured/);
  await verifyCharacterDeedDeployment(config, pub, address(95));
  await assert.rejects(() => verifyCharacterDeedDeployment(config, { ...pub, getChainId: async () => 1 }), /another chain/);
  await assert.rejects(() => verifyCharacterDeedDeployment(config, { ...pub, getCode: async () => '0x6001' }), /runtime/);
  await assert.rejects(() => verifyCharacterDeedDeployment(config, pub, address(93)), /operator/);
  await assert.rejects(() => verifyCharacterDeedDeployment(config, { ...pub,
    readContract: async args => args.functionName === 'ESTATE_DELAY' ? 0n : pub.readContract(args) }), /24-hour estate policy/);
  const a = await seed('a'), b = await seed('b'), c = await seed('c');
  process.env.CHARACTER_DEED_CUSTODY_ADDRESS = config.address;
  process.env.CHARACTER_DEED_CUSTODY_ENABLED = 'true';
  for (const [i, life] of [a, b, c].entries()) logs.push(log('LifeRegistered', {
    lifeId: life.life_hash, account: address(i + 1), wallet: zero, dynastyId: 0n,
  }, 1, i));
  await pool.query("INSERT INTO street_deeds(account_id,name,district,onchain_token_id,extracted_by_account,extracted_at,onchain_owner) VALUES ('onchain:77','Test Property','docks','77','a',now(),$1)", [address(1)]);
  // No custody event: this is a direct ERC721.transferFrom into a life account.
  logs.push(log('Transfer', { from: address(8), to: address(1), tokenId: 77n }, 2, 0));
  await syncCharacterDeedEvents(pool, { config, publicClient: pub });
  let equipment = (await pool.query("SELECT * FROM character_deed_equipment WHERE deed_token_id='77'")).rows[0];
  assert.equal(equipment.life_hash, a.life_hash, 'unsafe deposits are automatically recognized and locked');
  assert.equal((await deedTargetRows(pool))[0].accountId, 'a', 'confirmed nested owner is a delivery target');
  await pool.query("UPDATE characters SET alive=false WHERE id='a'");
  await pool.query("INSERT INTO characters VALUES ('a2','a',2,true),('b2','b',2,true)");
  await recordCharacterDeedDeath(pool, { victimCharacterId: 'a', killerCharacterId: 'b', heirCharacterId:'a2' });
  await pool.query("UPDATE characters SET alive=false WHERE id='b'");
  await recordCharacterDeedDeath(pool, { victimCharacterId: 'b', killerCharacterId: 'c', heirCharacterId:'b2' });
  assert.equal((await deedTargetRows(pool)).length, 0, 'dead-owner allocations wait during unsettled loot');
  head = 20n;
  const closed = (await pool.query("SELECT * FROM character_deed_lives")).rows;
  const closedById = new Map(closed.map(row=>[row.life_id,row]));
  logs.push(log('DeathRecorded', { victimLifeId: a.life_hash, killerLifeId: b.life_hash, heirLifeId:closedById.get('a2').life_hash,
    deathAt:BigInt(closedById.get('a').death_at), deathSequence: 1n }, 11, 0));
  logs.push(log('DeathRecorded', { victimLifeId: b.life_hash, killerLifeId: c.life_hash, heirLifeId:closedById.get('b2').life_hash,
    deathAt:BigInt(closedById.get('b').death_at), deathSequence: 2n }, 11, 1));
  logs.push(log('Transfer', { from: address(1), to: address(3), tokenId: 77n }, 12, 0));
  logs.push(log('DeedSettled', { deedId: 77n, fromLifeId: a.life_hash, toLifeId: c.life_hash, hops: 2n }, 12, 1));
  await pool.query("UPDATE street_deeds SET onchain_owner=$1 WHERE onchain_token_id='77'", [address(3)]);
  await syncCharacterDeedEvents(pool, { config, publicClient: pub });
  assert.equal((await deedTargetRows(pool))[0].accountId, 'c', 'successor receives future allocations after physical settlement');
  head = 30n;
  // Receiver callback deposits back into life C before DeedUnequipped is emitted.
  logs.push(log('Transfer', { from: address(3), to: address(8), tokenId: 77n }, 21, 0));
  logs.push(log('Transfer', { from: address(8), to: address(3), tokenId: 77n }, 21, 1));
  logs.push(log('DeedUnequipped', { deedId: 77n, lifeId: c.life_hash, wallet: address(8), nonce: 1n }, 21, 2));
  await syncCharacterDeedEvents(pool, { config, publicClient: pub });
  equipment = (await pool.query("SELECT * FROM character_deed_equipment WHERE deed_token_id='77'")).rows[0];
  assert.equal(equipment.active, true);
  assert.equal(equipment.life_hash, c.life_hash, 'outer custody event cannot erase callback ownership');
  assert.equal((await syncCharacterDeedEvents(pool, { config, publicClient: pub })).processed, 0, 'cursor replay is idle');
  // Compare every adapter function/event selector to the genuinely compiled ABI.
  const artifactPath = new URL('../omerta-contracts/out/CharacterDeedCustody.sol/CharacterDeedCustody.json', import.meta.url);
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath));
    const outputShape = parameter => ({ type: parameter.type, name: parameter.name || '',
      ...(parameter.components ? { components: parameter.components.map(outputShape) } : {}) });
    for (const entry of DEED_CUSTODY_ABI) {
      const actual = artifact.abi.find(x => x.name === entry.name && x.type === entry.type);
      assert(actual, `${entry.name} must exist in the compiled contract`);
      const selector = entry.type === 'event' ? toEventSelector : toFunctionSelector;
      assert.equal(selector(entry), selector(actual), `${entry.name} ABI matches compiled source`);
      if (entry.type === 'function' && entry.stateMutability === 'view') assert.deepEqual(entry.outputs.map(outputShape), actual.outputs.map(outputShape),
        `${entry.name} return types, tuple field names and ordering match compiled source`);
      else if (entry.type === 'event') assert.deepEqual(entry.inputs.map(input => ({ ...outputShape(input), indexed: !!input.indexed })),
        actual.inputs.map(input => ({ ...outputShape(input), indexed: !!input.indexed })),
        `${entry.name} indexed fields and decoded argument names match compiled source`);
    }
  } else {
    console.log('Compiled ABI comparison skipped: run Forge build to create the local artifact.');
  }
  console.log('custody chain adapter: deployment pins, unsafe deposits, ordered A→B→C, nested stock targeting and callback authority passed');
} finally {
  if (envBefore === undefined) delete process.env.CHARACTER_DEED_CUSTODY_ADDRESS;
  else process.env.CHARACTER_DEED_CUSTODY_ADDRESS = envBefore;
  if (flagBefore === undefined) delete process.env.CHARACTER_DEED_CUSTODY_ENABLED; else process.env.CHARACTER_DEED_CUSTODY_ENABLED = flagBefore;
  await pool.end();
}
