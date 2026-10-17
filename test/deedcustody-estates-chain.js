// The real lifecycle adapter and signed keeper journal against deterministic RPC state. SQL
// projection is genuine pg-mem; contract timing/transfer behavior is modeled, not an EVM proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newDb } from 'pg-mem';
import { decodeFunctionData, keccak256, parseTransaction, recoverTransactionAddress, zeroHash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { DEED_CUSTODY_ABI, runCharacterDeedKeeper, syncCharacterDeedEvents } from '../src/deedcustodychain.js';
import { ensureCharacterDeedLife, recordCharacterDeedDeath } from '../src/deedcustody.js';
import { recordDeedTransfer } from '../src/chain.js';
import { deedTargetRows } from '../src/stockdeliver.js';

const schema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const custodySchema = schema.match(/-- Character-life deed custody\.[\s\S]*?-- End character-life deed custody\./)?.[0];
const keeperSchema = schema.match(/CREATE TABLE IF NOT EXISTS keeper_transactions \([\s\S]*?\n\);/)?.[0];
assert(custodySchema && keeperSchema);
const addr = n => `0x${BigInt(n).toString(16).padStart(40, '0')}`;
const code = '0x60006000', operator = privateKeyToAccount(`0x${'19'.repeat(32)}`);
const config = { address: addr(99), deed: addr(98), dynasty: addr(97), implementation: addr(96), omr:addr(93),
  chainId: 4663, confirmations: 1, startBlock: 1n, codeHash: keccak256(code) };
const env = { CHARACTER_DEED_CUSTODY_ENABLED:'true', CHARACTER_DEED_CUSTODY_ADDRESS: config.address, CHARACTER_DEED_MAX_GAS: '300000',
  CHARACTER_DEED_MAX_FEE_WEI: '10', CHARACTER_DEED_PRIORITY_FEE_WEI: '1',
  CHARACTER_DEED_DAILY_GAS_WEI: '100000000', ERC6551_REGISTRY: addr(94), ERC6551_SALT: zeroHash,
  NODE_ENV: 'test', DATABASE_URL: undefined };
const before = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
for (const [key, value] of Object.entries(env)) {
  if (value === undefined) delete process.env[key]; else process.env[key] = value;
}

async function fixture() {
  const db = newDb();
  db.public.none(`CREATE TABLE characters(id TEXT PRIMARY KEY,account_id TEXT,generation INT,alive BOOLEAN);
    CREATE TABLE dynasty_tokens(token_id TEXT PRIMARY KEY,account_id TEXT);
    CREATE TABLE account_persistent(account_id TEXT PRIMARY KEY,wallet_address TEXT);
    CREATE TABLE chain_cursor(stream TEXT PRIMARY KEY,last_block BIGINT);
    CREATE TABLE street_deeds(account_id TEXT PRIMARY KEY,name TEXT,district TEXT,building_id TEXT,
      onchain_token_id TEXT,extracted_by_account TEXT,extracted_at TIMESTAMPTZ,onchain_owner TEXT,
      name_lc TEXT,home_authority_token TEXT,ownership_since_day INT);
    CREATE TABLE city_home_activities(home_key TEXT,authority_token TEXT,status TEXT,close_reason TEXT,closed_at TIMESTAMPTZ);
    CREATE TABLE street_deed_history(account_id TEXT,kind TEXT,detail TEXT,at TIMESTAMPTZ DEFAULT now());
    CREATE TABLE notifications(character_id TEXT,type TEXT,payload TEXT);`);
  db.public.none(custodySchema);
  db.public.none(keeperSchema);
  const adapter = db.adapters.createPg(), pool = new adapter.Pool();
  const states = new Map(), positions = new Map(), releases = new Map(), receipts = new Map();
  const logs = [], sends = [], blockTimes = new Map();
  let head = 0n, nonce = 0, chainSequence = 0n, accountNumber = 1000;
  let chainTime = BigInt(Math.floor(Date.now() / 1000));
  const blockHash = block => `0x${BigInt(block).toString(16).padStart(64, '0')}`;
  const emit = (eventName, args, { block = ++head, index = 0, txHash = blockHash(block + 100000n) } = {}) => {
    blockTimes.set(String(block), chainTime);
    logs.push({ eventName, args, address: eventName === 'Transfer' ? config.deed : config.address,
      blockNumber: block, logIndex: index, transactionHash: txHash });
    return logs.at(-1);
  };
  const pub = {
    getChainId: async () => config.chainId, getCode: async () => code, getBlockNumber: async () => head,
    getBlock: async ({ blockNumber }) => ({ number: blockNumber, hash: blockHash(blockNumber),
      timestamp: blockTimes.get(String(blockNumber)) ?? chainTime }),
    getTransactionCount: async () => nonce, estimateGas: async () => 100000n,
    readContract: async ({ functionName, args = [] }) => {
      if (functionName === 'lifeState') return states.get(args[0]) || { account: addr(0) };
      if (functionName === 'estateReleaseAt') return releases.get(args[0]) || 0n;
      if (functionName === 'equippedLife') return positions.get(String(args[0])) || zeroHash;
      return { deed: config.deed, dynasty: config.dynasty, accountImplementation: config.implementation,
        lifecycleOperator: operator.address, accountRegistry: addr(94), activeLifeByDynasty: zeroHash, ESTATE_DELAY: 86400n,
        omr:config.omr, volumeSource:addr(92), volumeSourceRuntimeHash:keccak256(code),settlementManager:addr(92),safeHouseCoveredAt:false }[functionName];
    },
    getLogs: async ({ address, fromBlock, toBlock }) => logs.filter(log => log.address === address
      && log.blockNumber >= fromBlock && log.blockNumber <= toBlock),
    getTransactionReceipt: async ({ hash }) => {
      if (!receipts.has(hash)) throw Object.assign(new Error('not found'), { name: 'TransactionReceiptNotFoundError' });
      return receipts.get(hash);
    },
    sendRawTransaction: async ({ serializedTransaction: raw }) => {
      const tx = parseTransaction(raw), hash = keccak256(raw);
      assert.equal((await pool.query('SELECT raw_tx FROM keeper_transactions WHERE tx_hash=$1', [hash])).rows[0]?.raw_tx,
        raw, 'signed command is durable before broadcast');
      const call = decodeFunctionData({ abi: DEED_CUSTODY_ABI, data: tx.data });
      const block = ++head;
      blockTimes.set(String(block), chainTime);
      sends.push(call);
      if (call.functionName === 'recordDeath' || call.functionName === 'recordEstateDeath') {
        const [victim, successor] = call.args, state = states.get(victim);
        assert(state && !state.dead && states.has(successor) && !states.get(successor).dead);
        const estateDeath = call.functionName === 'recordEstateDeath';
        const heirLifeId = estateDeath ? successor : call.args[2];
        const expectedSequence = estateDeath ? call.args[2] : call.args[3];
        const deathAt = estateDeath ? call.args[3] : call.args[4];
        assert.equal(expectedSequence,chainSequence+1n);
        state.dead = true; state.killer = successor; state.deathSequence = ++chainSequence;
        Object.assign(state,{heir:heirLifeId,deathAt,estateDeath});
        emit('DeathRecorded', { victimLifeId: victim, killerLifeId: successor, heirLifeId,deathAt,deathSequence: chainSequence }, { block, txHash: hash });
        if (call.functionName === 'recordEstateDeath') {
          const releaseAt = deathAt + 86400n;
          releases.set(victim, releaseAt);
          emit('EstateDeathRecorded', { victimLifeId: victim, heirLifeId: successor, deathSequence: chainSequence, releaseAt },
            { block, index: 1, txHash: hash });
        }
      } else if (call.functionName === 'settleDeed') {
        const token = String(call.args[0]), source = positions.get(token);
        let target = source, hops = 0n;
        while (hops < call.args[1]) {
          const state = states.get(target);
          if (!state.dead || state.killer === zeroHash || chainTime < (releases.get(target) || 0n)) break;
          target = state.killer; ++hops;
        }
        assert(hops > 0n, 'keeper must never send settlement before the first edge matures');
        positions.set(token, target);
        emit('Transfer', { from: states.get(source).account, to: states.get(target).account, tokenId: BigInt(token) }, { block, txHash: hash });
        emit('DeedSettled', { deedId: BigInt(token), fromLifeId: source, toLifeId: target, hops }, { block, index: 1, txHash: hash });
      } else assert.fail(`Unexpected keeper command ${call.functionName}`);
      nonce = Number(tx.nonce) + 1;
      receipts.set(hash, { transactionHash: hash, from: await recoverTransactionAddress({ serializedTransaction: raw }),
        to: tx.to, blockNumber: block, blockHash: blockHash(block), status: 'success', gasUsed: 70000n,
        effectiveGasPrice: 1n, logs: [] });
      return hash;
    },
  };
  const clients = { account: operator, publicClient: pub, walletClient: {
    prepareTransactionRequest: async request => request, signTransaction: request => operator.signTransaction(request),
  } };
  async function seed(id, accountId = id, generation = 1) {
    await pool.query('INSERT INTO characters VALUES ($1,$2,$3,true)', [id, accountId, generation]);
    await pool.query('INSERT INTO account_persistent VALUES ($1,$2) ON CONFLICT (account_id) DO NOTHING', [accountId, addr(++accountNumber)]);
    const life = await ensureCharacterDeedLife(pool, id);
    const state = { account: addr(++accountNumber), wallet: addr(0), dynastyId: 0n, dead: false, killer: zeroHash, deathSequence: 0n,deathAt:0n,heir:zeroHash,estateDeath:false };
    states.set(life.life_hash, state);
    emit('LifeRegistered', { lifeId: life.life_hash, account: state.account, wallet: addr(0), dynastyId: 0n });
    return { ...life, id, account_id: accountId, alive: true };
  }
  async function equip(token, life) {
    await pool.query(`INSERT INTO street_deeds(account_id,name,district,building_id,onchain_token_id,extracted_by_account,extracted_at,onchain_owner) VALUES ($1,$2,'docks',$3,$4,$5,now(),$6)`,
      [`onchain:${token}`, `House ${token}`, `docks-${String(token).padStart(4, '0')}`, String(token), life.account_id, states.get(life.life_hash).account]);
    positions.set(String(token), life.life_hash);
    emit('Transfer', { from: addr(800), to: states.get(life.life_hash).account, tokenId: BigInt(token) });
  }
  async function close(life, { killer, heir } = {}) {
    if (!heir) heir = await seed(`${life.id}-heir`,life.account_id,Number(life.generation)+1);
    await pool.query('UPDATE characters SET alive=false WHERE id=$1', [life.id]);
    return recordCharacterDeedDeath(pool, { victimCharacterId: life.id, killerCharacterId: killer?.id || null,
      heirCharacterId: heir?.id || null });
  }
  const sync = async () => {
    ++head;
    // This is the ordinary ERC721 watcher, separate from the custody stream. Each is replay-safe.
    for (const log of logs.filter(log => log.eventName === 'Transfer' && log.blockNumber <= head - 1n))
      await recordDeedTransfer(pool, { tokenId: log.args.tokenId, from: log.args.from, to: log.args.to });
    return syncCharacterDeedEvents(pool, { config, publicClient: pub });
  };
  return { pool, seed, equip, close, sync, emit, states, releases, sends,
    now: () => Number(chainTime) * 1000,
    cursor: async () => (await pool.query('SELECT last_block FROM chain_cursor')).rows[0]?.last_block,
    run: () => runCharacterDeedKeeper(pool, { config, clients }),
    advanceTime: seconds => { chainTime += BigInt(seconds); blockTimes.set(String(head), chainTime); } };
}

try {
  const f = await fixture();
  try {
    const a = await f.seed('a'), b = await f.seed('b'), c = await f.seed('c'), d = await f.seed('d'), e = await f.seed('e');
    await f.equip(11, a); await f.equip(12, b); await f.equip(13, d); await f.sync();
    await f.close(a, { killer: b });
    await f.pool.query("UPDATE characters SET alive=false WHERE id='b'");
    const heir = await f.seed('b-heir', b.account_id, 2);
    await f.close(b, { heir }); await f.close(heir, { killer: c }); await f.close(d, { killer: e });
    await f.sync();
    for (const expected of ['recordDeath', 'recordEstateDeath', 'recordDeath', 'recordDeath']) {
      assert.equal((await f.run()).state, 'settled');
      assert.equal(f.sends.at(-1).functionName, expected, 'global outbox preserves player/estate chronology');
      await f.sync();
    }
    const closed = (await f.pool.query('SELECT * FROM character_deed_deaths ORDER BY death_sequence')).rows;
    assert(closed.every(row => row.status === 'confirmed'));
    assert.deepEqual(closed.map(row => String(row.chain_death_sequence)), ['1', '2', '3', '4']);
    const estate = (await f.pool.query("SELECT chain_release_at FROM character_deed_lives WHERE life_id='b'")).rows[0];
    assert.equal(BigInt(+estate.chain_release_at / 1000), f.releases.get(b.life_hash), 'estate event supplies the canonical chain maturity');
    await f.run();
    assert.equal(f.sends.at(-1).args[0], 11n, 'earlier player loot progresses up to the unmatured estate');
    await f.sync();
    assert.equal((await f.pool.query("SELECT life_hash FROM character_deed_equipment WHERE deed_token_id='11'")).rows[0].life_hash, b.life_hash);
    await f.run();
    assert.equal(f.sends.at(-1).args[0], 13n, 'blocked estates do not starve unrelated eligible loot');
    await f.sync();
    assert.equal((await f.run()).state, 'idle', 'only unmatured estate inventory remains');
    assert(!(await deedTargetRows(f.pool)).some(row => row.tokenId === '11'), 'pending inheritance does not route stocks early');
    f.advanceTime(86401);
    assert.equal((await f.run()).state, 'settled');
    assert.equal(f.sends.at(-1).args[0], 11n);
    await f.sync();
    assert.equal((await deedTargetRows(f.pool)).find(row => row.tokenId === '11').accountId, c.account_id,
      'only confirmed physical transfer activates stock targeting to the late killer');
  } finally { await f.pool.end(); }

  for (const kind of ['wrong_heir', 'estate_masking_player_kill', 'generic_estate_only']) {
    const f = await fixture();
    try {
      const victim = await f.seed('victim'), killer = await f.seed('killer');
      await f.pool.query("UPDATE characters SET alive=false WHERE id='victim'");
      const heir = await f.seed('heir', 'victim', 2);
      await f.sync();
      await f.close(victim, kind === 'estate_masking_player_kill' ? { killer } : { heir });
      const cursor = await f.cursor();
      const successor = kind === 'wrong_heir' ? killer.life_hash : kind === 'estate_masking_player_kill' ? killer.life_hash : heir.life_hash;
      const dead = (await f.pool.query('SELECT * FROM character_deed_lives WHERE life_id=$1',[victim.id])).rows[0];
      const exactHeir = (await f.pool.query('SELECT life_hash FROM character_deed_lives WHERE life_id=$1',[dead.heir_life_id])).rows[0].life_hash;
      const generic = f.emit('DeathRecorded', { victimLifeId: victim.life_hash, killerLifeId: successor, heirLifeId:exactHeir,deathAt:BigInt(dead.death_at),deathSequence: 1n });
      if (kind !== 'generic_estate_only') f.emit('EstateDeathRecorded', { victimLifeId: victim.life_hash,
        heirLifeId: successor, deathSequence: 1n, releaseAt: BigInt(Math.floor(Date.now() / 1000) + 86400) },
      { block: generic.blockNumber, index: 1, txHash: generic.transactionHash });
      if (kind === 'generic_estate_only') {
        await assert.rejects(f.sync, /Custody death event pair differs/);
        assert.equal(await f.cursor(), cursor, 'an incomplete estate pair cannot be skipped by the cursor');
        assert.equal((await f.pool.query('SELECT status FROM character_deed_deaths')).rows[0].status, 'pending',
          'generic DeathRecorded never unlocks an estate without its specific maturity event');
        f.emit('EstateDeathRecorded', { victimLifeId: victim.life_hash, heirLifeId: heir.life_hash,
          deathSequence: 1n, releaseAt: BigInt(Math.floor(Date.now() / 1000) + 86400) },
        { block: generic.blockNumber, index: 1, txHash: generic.transactionHash });
        await f.sync();
        assert.equal((await f.pool.query('SELECT status FROM character_deed_deaths')).rows[0].status, 'confirmed',
          'a complete RPC retry recovers the unchanged outbox and cursor');
      } else {
        await assert.rejects(f.sync, /Custody (?:death|estate).*differs/);
        assert.equal(await f.cursor(), cursor, 'a conflicting estate never advances the chain cursor');
        assert.equal((await f.pool.query('SELECT status FROM character_deed_deaths')).rows[0].status, 'pending',
          'a conflicting estate cannot acknowledge the outbox through its generic companion event');
      }
    } finally { await f.pool.end(); }
  }
  console.log('Estate chain integration: chronological mixed deaths, canonical maturity, non-blocking delayed loot, finality, successor stocks and conflicting-event rejection passed.');
} finally {
  for (const [key, value] of Object.entries(before)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
