// Character-life deed custody. SQL is authoritative for game deaths; only finalized
// registry events project physical NFT custody. A dynasty's next generation never
// replaces a historical life in this graph. This module signs and sends nothing.
import { randomBytes } from 'node:crypto';
import { getAddress, isAddress, keccak256, encodeFunctionData, parseAbi } from 'viem';
import { GameError } from './game.js';

export const CHARACTER_DEED_EXIT_NOTICE_MS = 24 * 60 * 60 * 1000;
export const CHARACTER_DEED_EXIT_INTENT_TTL_SEC = 5 * 60;
export const CHARACTER_DEED_ESTATE_DELAY_MS = 24 * 60 * 60 * 1000;
const ZERO = '0x0000000000000000000000000000000000000000';
const MAX_UINT = (1n << 256n) - 1n;
const fail = (code, message) => { throw new GameError(code, message); };
const uint = (value, label) => {
  if (!/^(?:0x[0-9a-f]+|[0-9]+)$/i.test(String(value))) fail('custody_args', `${label} must be an unsigned integer.`);
  const n = BigInt(value);
  if (n > MAX_UINT) fail('custody_args', `${label} is too large.`);
  return n.toString();
};
const hash = value => {
  if (!/^0x[0-9a-f]{64}$/i.test(String(value))) fail('custody_args', 'A character life hash is required.');
  return String(value).toLowerCase();
};
const lower = value => String(value || '').toLowerCase();
export const characterDeedCustodyEnabled = (env = process.env) => env.CHARACTER_DEED_CUSTODY_ENABLED === 'true';
const EXIT_ABI = parseAbi(['function unequip((bytes32 lifeId,uint256 deedId,uint256 nonce,uint256 issuedAt,uint256 deadline),bytes)']);
export function characterDeedExitJobKey(exit, lifeHash) {
  const data = encodeFunctionData({ abi: EXIT_ABI, functionName: 'unequip', args: [{ lifeId: lifeHash,
    deedId: BigInt(exit.deed_token_id), nonce: BigInt(exit.user_nonce), issuedAt: BigInt(exit.user_issued_at),
    deadline: BigInt(exit.user_deadline) }, exit.user_signature] });
  return `deed-exit:${keccak256(data)}`;
}

// Caller holds the normal character lock. A durable raw exit transaction commits a
// safe-state barrier even if the worker crashes before updating the exit row.
export async function assertCharacterDeedActionsAvailable(client, characterId) {
  const life = (await client.query('SELECT life_hash FROM character_deed_lives WHERE life_id=$1', [characterId])).rows[0];
  if (!life) return;
  const exits = (await client.query("SELECT * FROM character_deed_exits WHERE life_id=$1 AND status IN ('pending','releasing')", [characterId])).rows;
  for (const exit of exits) {
    if (exit.status === 'releasing') fail('custody_exit_finalizing', 'Your safe Deed exit is finalizing. Actions resume after chain confirmation.');
    if (!exit.user_signature || exit.user_nonce == null) continue;
    const job = (await client.query('SELECT status FROM keeper_transactions WHERE job_key=$1', [characterDeedExitJobKey(exit, life.life_hash)])).rows[0];
    if (job && job.status !== 'reverted') fail('custody_exit_finalizing', 'Your safe Deed exit is finalizing. Actions resume after chain confirmation.');
  }
}

// Opaque persisted identifiers avoid publishing a dictionary-testable hash of
// public character IDs. Public wallet/NFT movements remain observable on-chain.
export function createCharacterDeedLifeHash() {
  let value;
  do { value = `0x${randomBytes(32).toString('hex')}`; } while (/^0x0+$/.test(value));
  return value;
}

async function lockState(client) {
  const row = (await client.query('SELECT next_death_sequence,last_death_at FROM character_deed_state WHERE id=1 FOR UPDATE')).rows[0];
  if (!row) fail('custody_unconfigured', 'Character deed custody is not configured.');
  return row;
}

async function ensureLife(client, characterId) {
  let row = (await client.query('SELECT * FROM character_deed_lives WHERE life_id=$1', [characterId])).rows[0];
  if (row) return row;
  const ch = (await client.query('SELECT id, account_id, generation FROM characters WHERE id=$1', [characterId])).rows[0];
  if (!ch) fail('custody_character', 'The character life does not exist.');
  await client.query(
    `INSERT INTO character_deed_lives (life_id,life_hash,account_id,generation,status)
     VALUES ($1,$2,$3,$4,'alive')`, [ch.id, createCharacterDeedLifeHash(), ch.account_id, Number(ch.generation || 1)]);
  return (await client.query('SELECT * FROM character_deed_lives WHERE life_id=$1', [ch.id])).rows[0];
}

// Caller supplies its existing transaction (and character lock where applicable).
export async function ensureCharacterDeedLife(client, characterId) {
  await lockState(client);
  return ensureLife(client, characterId);
}

// Called after the authoritative alive=false write, in the SAME estate transaction.
// Global ordering makes every kill edge point to a life still alive at that event.
export async function recordTrackedCharacterDeedDeath(client, args) {
  const tracked = (await client.query('SELECT life_id FROM character_deed_lives WHERE life_id=$1', [args.victimCharacterId])).rows[0];
  // Untracked lives cannot have canonical equipped or pending-incoming deeds.
  // Preserve tracked deaths even while the rail is disabled, without creating a
  // historical gas backlog for people who never entered on-chain custody.
  if (!tracked) return { recorded: false, untracked: true };
  return recordCharacterDeedDeath(client, args);
}

export async function recordCharacterDeedDeath(client, { victimCharacterId, killerCharacterId = null, heirCharacterId = null }) {
  await assertCharacterDeedActionsAvailable(client, victimCharacterId);
  const state = await lockState(client);
  const victim = (await client.query('SELECT id, alive FROM characters WHERE id=$1', [victimCharacterId])).rows[0];
  if (!victim || victim.alive !== false) fail('custody_death', 'Only a committed-path character death can close deed custody.');
  const life = await ensureLife(client, victim.id);
  if (life.status === 'dead') {
    const successorId = killerCharacterId || heirCharacterId;
    if ((life.killer_life_id || null) !== killerCharacterId
      || (successorId && (life.successor_life_id || life.killer_life_id) !== successorId))
      fail('custody_death_conflict', 'This life already has another death disposition.');
    return { recorded: false, lifeHash: life.life_hash, deathSequence: String(life.death_sequence) };
  }
  if (killerCharacterId === victim.id) fail('custody_death_cycle', 'A life cannot loot itself.');
  let killer = null;
  if (killerCharacterId !== null) {
    const ch = (await client.query('SELECT id, alive FROM characters WHERE id=$1', [killerCharacterId])).rows[0];
    if (!ch?.alive) fail('custody_killer', 'The killer must be the exact living character responsible for this death.');
    killer = await ensureLife(client, ch.id);
    if (killer.status !== 'alive') fail('custody_death_cycle', 'A closed life cannot become a new killer destination.');
  }
  const heir = (await client.query('SELECT id,account_id,generation,alive FROM characters WHERE id=$1', [heirCharacterId])).rows[0];
    if (!heir?.alive || heir.account_id !== life.account_id || Number(heir.generation) !== Number(life.generation) + 1)
      fail('custody_heir', 'Estate custody requires the exact living next-generation heir created by this death.');
  const heirLife = await ensureLife(client, heir.id);
  if (heirLife.status !== 'alive') fail('custody_heir', 'The newly created estate heir is already closed.');
  const successor = killer || heirLife;
  const sequence = String(state.next_death_sequence);
  const deathAt = Math.max(Math.floor(Date.now() / 1000), Number(state.last_death_at || 0));
  await client.query('UPDATE character_deed_state SET next_death_sequence=$1,last_death_at=$2 WHERE id=1', [(BigInt(sequence) + 1n).toString(), deathAt]);
  await client.query(
    `UPDATE character_deed_lives SET status='dead',killer_life_id=$2,death_sequence=$3,
       closure_reason=$4,closed_at=$6,successor_life_id=$5,heir_life_id=$7,death_at=$8 WHERE life_id=$1`,
    [life.life_id, killer?.life_id || null, sequence, killer ? 'player_kill' : 'estate_inheritance', successor.life_id,
      new Date(deathAt * 1000), heirLife.life_id, deathAt]);
  await client.query(
    `INSERT INTO character_deed_deaths (life_id,death_sequence,killer_life_id,status,successor_life_id)
     VALUES ($1,$2,$3,'pending',$4)`, [life.life_id, sequence, killer?.life_id || null, successor.life_id]);
  await client.query("UPDATE character_deed_exits SET status='cancelled',user_signature=NULL WHERE life_id=$1 AND status='pending'", [life.life_id]);
  await client.query("UPDATE character_deed_safe_house_intents SET status='cancelled' WHERE life_id=$1 AND status='pending'", [life.life_id]);
  return { recorded: true, lifeHash: life.life_hash, killerLifeHash: killer?.life_hash || null,
    successorLifeHash: successor.life_hash, deathSequence: sequence, disposition: killer ? 'player_kill' : 'estate_inheritance' };
}

// Upgrade historical holds only from their exact generation+1 row. The living
// current character is never used as a shortcut over deaths in the intervening gap.
export async function backfillCharacterDeedEstates(pool) {
  return transaction(pool, async client => {
    await lockState(client);
    await client.query('UPDATE character_deed_lives SET successor_life_id=killer_life_id WHERE successor_life_id IS NULL AND killer_life_id IS NOT NULL');
    await client.query('UPDATE character_deed_deaths SET successor_life_id=killer_life_id WHERE successor_life_id IS NULL AND killer_life_id IS NOT NULL');
    const pending = (await client.query("SELECT * FROM character_deed_deaths WHERE status='policy_pending' ORDER BY death_sequence")).rows;
    const blocked = [];
    let converted = 0;
    for (const old of pending) {
      const life = (await client.query('SELECT * FROM character_deed_lives WHERE life_id=$1', [old.life_id])).rows[0];
      const heirs = (await client.query('SELECT id,alive FROM characters WHERE account_id=$1 AND generation=$2',
        [life.account_id, Number(life.generation) + 1])).rows;
      if (heirs.length !== 1) { blocked.push({ lifeId: life.life_id, lifeHash: life.life_hash, reason: heirs.length ? 'ambiguous_exact_heir' : 'missing_exact_heir' }); continue; }
      let heir = (await client.query('SELECT * FROM character_deed_lives WHERE life_id=$1', [heirs[0].id])).rows[0];
      if (!heir && !heirs[0].alive) { blocked.push({ lifeId: life.life_id, lifeHash: life.life_hash, reason: 'missing_heir_death_record' }); continue; }
      heir ||= await ensureLife(client, heirs[0].id);
      if (heir.status === 'alive' && !heirs[0].alive) { blocked.push({ lifeId: life.life_id, lifeHash: life.life_hash, reason: 'missing_heir_death_record' }); continue; }
      if (heir.status === 'dead' && (heir.death_sequence == null || BigInt(heir.death_sequence) <= BigInt(life.death_sequence))) {
        blocked.push({ lifeId: life.life_id, lifeHash: life.life_hash, reason: 'invalid_heir_chronology' }); continue;
      }
      await client.query("UPDATE character_deed_lives SET successor_life_id=$2,closure_reason='estate_inheritance' WHERE life_id=$1",
        [life.life_id, heir.life_id]);
      await client.query("UPDATE character_deed_deaths SET successor_life_id=$2,status='pending' WHERE life_id=$1 AND status='policy_pending'",
        [life.life_id, heir.life_id]);
      ++converted;
    }
    return { converted, blocked };
  });
}

function estateAvailability(life) {
  const minimum = new Date(life.closed_at).getTime() + CHARACTER_DEED_ESTATE_DELAY_MS;
  const confirmed = life.chain_release_at == null ? null : new Date(life.chain_release_at).getTime();
  return { availableAt: new Date(Math.max(minimum, confirmed ?? minimum)), chainReleaseKnown: confirmed !== null };
}

export async function resolveCharacterDeedBeneficiary(pool, lifeIdOrHash, { now = Date.now(), tokenId = null } = {}) {
  const rows = (await pool.query('SELECT * FROM character_deed_lives')).rows;
  const coverage = tokenId == null ? [] : (await pool.query('SELECT * FROM character_deed_safe_house WHERE deed_token_id=$1', [String(tokenId)])).rows;
  const byId = new Map(rows.map(r => [r.life_id, r]));
  let row = byId.get(lifeIdOrHash) || rows.find(r => r.life_hash === lower(lifeIdOrHash));
  if (!row) return null;
  const seen = new Set();
  while (row.status === 'dead' && (row.successor_life_id || row.killer_life_id)) {
    if (seen.has(row.life_id)) fail('custody_death_cycle', 'The recorded death graph is inconsistent.');
    seen.add(row.life_id);
    const protectedDeed = coverage.some(window => window.dynasty_token_id === row.dynasty_token_id
      && BigInt(window.starts_at) <= BigInt(row.death_at) && BigInt(row.death_at) < BigInt(window.until_at));
    if (!row.killer_life_id || protectedDeed) {
      const availability = estateAvailability(row);
      if (!availability.chainReleaseKnown || now < availability.availableAt.getTime())
        return { lifeId: row.life_id, lifeHash: row.life_hash, accountId: row.account_id,
          custodyAddress: row.custody_address, status: row.status, disposition: 'estate_waiting', ...availability };
    }
    const next = byId.get(protectedDeed ? row.heir_life_id : row.successor_life_id || row.killer_life_id);
    if (!next || (next.death_sequence != null && BigInt(next.death_sequence) <= BigInt(row.death_sequence)))
      fail('custody_death_cycle', 'The recorded death sequence is inconsistent.');
    row = next;
  }
  return { lifeId: row.life_id, lifeHash: row.life_hash, accountId: row.account_id,
    custodyAddress: row.custody_address, status: row.status,
    disposition: row.status === 'alive' ? 'living_successor' : 'estate_successor_missing' };
}

function receipt(args) {
  if (args.finalized !== true || !/^0x[0-9a-f]{64}$/i.test(String(args.txHash)))
    fail('custody_receipt', 'A finalized registry receipt is required.');
  if (typeof args.ref !== 'string' || !args.ref.length) fail('custody_receipt', 'A finalized event reference is required.');
  return { ref: args.ref, txHash: lower(args.txHash) };
}

async function transaction(pool, fn) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}

// Indexer-only projection. Pending life accounts are valid without an identity NFT;
// later binding fills its immutable identity on this SAME historical life.
export async function bindCharacterDeedAccount(pool, args) {
  const proof = receipt(args), lifeHash = hash(args.lifeHash);
  if (!isAddress(args.address) || lower(args.address) === ZERO) fail('custody_args', 'A canonical custody address is required.');
  const address = getAddress(args.address).toLowerCase();
  const token = args.dynastyTokenId == null ? null : uint(args.dynastyTokenId, 'dynastyTokenId');
  return transaction(pool, async client => {
    await lockState(client);
    const life = (await client.query('SELECT * FROM character_deed_lives WHERE life_hash=$1', [lifeHash])).rows[0];
    if (!life) fail('custody_character', 'The registered character life is unknown.');
    if (life.custody_address && lower(life.custody_address) !== address)
      fail('custody_binding', 'A life cannot change its canonical custody account.');
    if (life.dynasty_token_id != null && token !== null && String(life.dynasty_token_id) !== token)
      fail('custody_binding', 'A historical life cannot change its dynasty identity.');
    if (token !== null) {
      const identity = (await client.query('SELECT account_id FROM dynasty_tokens WHERE token_id=$1', [token])).rows[0];
      if (!identity || identity.account_id !== life.account_id)
        fail('custody_binding', 'The dynasty identity belongs to another game account.');
    }
    await client.query(
      `UPDATE character_deed_lives SET custody_address=$2,dynasty_token_id=$3,registration_ref=$4 WHERE life_hash=$1`,
      [lifeHash, address, token ?? life.dynasty_token_id, proof.ref]);
    return { lifeHash, custodyAddress: address, dynastyTokenId: token ?? life.dynasty_token_id };
  });
}

// A Transfer projection is ordered by actual block/log, never watcher arrival time.
// Closed-life custody can physically receive loot; it confers no heir or active-game benefit.
export async function recordCharacterDeedEquipment(pool, args) {
  const proof = receipt(args), tokenId = uint(args.tokenId, 'tokenId');
  const lifeHash = args.lifeHash == null ? null : hash(args.lifeHash);
  const block = uint(args.blockNumber, 'blockNumber'), index = Number(uint(args.logIndex, 'logIndex'));
  if (!Number.isSafeInteger(index)) fail('custody_args', 'Invalid event log index.');
  const at = new Date(Number(uint(args.blockTimestamp, 'blockTimestamp')) * 1000);
  if (!Number.isFinite(at.getTime())) fail('custody_args', 'Invalid block timestamp.');
  return transaction(pool, async client => {
    await lockState(client);
    if (lifeHash) {
      const life = (await client.query('SELECT custody_address FROM character_deed_lives WHERE life_hash=$1', [lifeHash])).rows[0];
      if (!life?.custody_address) fail('custody_binding', 'Custody registration must be indexed first.');
    }
    const old = (await client.query('SELECT * FROM character_deed_equipment WHERE deed_token_id=$1 FOR UPDATE', [tokenId])).rows[0];
    if (old && (BigInt(old.last_block_number) > BigInt(block)
      || (BigInt(old.last_block_number) === BigInt(block) && Number(old.last_log_index) >= index)))
      return { recorded: false, stale: true };
    const equipped = lifeHash ? (old?.active && old.life_hash === lifeHash ? old.equipped_at : at) : old?.equipped_at || null;
    if (old) await client.query(
      `UPDATE character_deed_equipment SET life_hash=$2,active=$3,ref=$4,last_block_number=$5,
       last_log_index=$6,equipped_at=$7,released_at=$8,tx_hash=$9 WHERE deed_token_id=$1`,
      [tokenId, lifeHash, !!lifeHash, proof.ref, block, index, equipped, lifeHash ? null : at, proof.txHash]);
    else await client.query(
      `INSERT INTO character_deed_equipment (deed_token_id,life_hash,active,ref,last_block_number,
       last_log_index,equipped_at,released_at,tx_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [tokenId, lifeHash, !!lifeHash, proof.ref, block, index, equipped, lifeHash ? null : at, proof.txHash]);
    return { recorded: true, tokenId, lifeHash, active: !!lifeHash };
  });
}

export async function listCharacterDeedOutbox(pool, { limit = 100 } = {}) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) fail('custody_args', 'Invalid custody batch size.');
  const pending = (await pool.query("SELECT * FROM character_deed_deaths WHERE status IN ('pending','policy_pending') ORDER BY death_sequence LIMIT $1", [limit])).rows;
  const lives = (await pool.query('SELECT * FROM character_deed_lives')).rows;
  const byId = new Map(lives.map(r => [r.life_id, r]));
  return pending.map(row => {
    const life = byId.get(row.life_id), killer = byId.get(row.killer_life_id);
    const successor = byId.get(row.successor_life_id || row.killer_life_id);
    return { lifeId: row.life_id, lifeHash: life.life_hash, accountId: life.account_id,
      killerLifeId: row.killer_life_id, killerLifeHash: killer?.life_hash || null,
      successorLifeId: successor?.life_id || null, successorLifeHash: successor?.life_hash || null,
      heirLifeHash: byId.get(life.heir_life_id)?.life_hash || (row.killer_life_id ? null : successor?.life_hash || null),
      deathAt: String(life.death_at),
      deathSequence: String(row.death_sequence), status: row.status, disposition: life.closure_reason,
      custodyAddress: life.custody_address, killerCustodyAddress: killer?.custody_address || null,
      successorCustodyAddress: successor?.custody_address || null };
  });
}

export async function confirmCharacterDeedDeath(pool, args) {
  const proof = receipt(args), lifeHash = hash(args.lifeHash), sequence = uint(args.deathSequence, 'deathSequence');
  const chainSequence = uint(args.chainDeathSequence ?? args.deathSequence, 'chainDeathSequence');
  return transaction(pool, async client => {
    await lockState(client);
    const life = (await client.query('SELECT * FROM character_deed_lives WHERE life_hash=$1', [lifeHash])).rows[0];
    if (!life || String(life.death_sequence) !== sequence) fail('custody_receipt', 'The receipt does not match the recorded death.');
    const row = (await client.query('SELECT * FROM character_deed_deaths WHERE life_id=$1 FOR UPDATE', [life.life_id])).rows[0];
    if (row.status === 'policy_pending') fail('custody_policy', 'This death disposition awaits an explicit estate policy.');
    let releaseAt = null;
    if (!life.killer_life_id || args.chainReleaseAt != null) {
      if (args.chainReleaseAt == null) fail('custody_receipt', 'Estate confirmation requires its on-chain release time.');
      releaseAt = new Date(Number(uint(args.chainReleaseAt, 'chainReleaseAt')) * 1000);
      if (!Number.isFinite(releaseAt.getTime()) || releaseAt.getTime() <= 0) fail('custody_receipt', 'Invalid estate release time.');
    }
    if (row.status === 'confirmed') {
      if (row.tx_hash !== proof.txHash || String(row.chain_death_sequence) !== chainSequence)
        fail('custody_receipt', 'This death already has another confirmed receipt.');
      if (releaseAt && +new Date(life.chain_release_at) !== +releaseAt) fail('custody_receipt', 'This estate already has another release time.');
      return { confirmed: false, duplicate: true };
    }
    const head = (await client.query("SELECT life_id FROM character_deed_deaths WHERE status IN ('pending','policy_pending') ORDER BY death_sequence LIMIT 1")).rows[0];
    if (head?.life_id !== life.life_id) fail('custody_order', 'Earlier character deaths must settle first.');
    await client.query(
      `UPDATE character_deed_deaths SET status='confirmed',tx_hash=$2,chain_death_sequence=$3,
       confirmed_at=now(),confirmation_ref=$4 WHERE life_id=$1`, [life.life_id, proof.txHash, chainSequence, proof.ref]);
    if (releaseAt) await client.query('UPDATE character_deed_lives SET chain_release_at=$2 WHERE life_id=$1', [life.life_id, releaseAt]);
    return { confirmed: true, lifeHash, deathSequence: sequence, chainDeathSequence: chainSequence };
  });
}

export async function characterDeedStatus(pool, accountId) {
  const policy = { enabled: characterDeedCustodyEnabled(), pricing: 'previous_completed_utc_day_omr_volume',
    minDailyBurnOmr: '1', maxDailyBurnOmr: '25', volumeDivisor: '20000', maxPrepayDays: 7, coveredAssets: 'all' };
  if (!characterDeedCustodyEnabled()) return { enabled: false, life: null, equipment: [], exits: [], estates: [], policyHolds: [], safeHouse: policy };
  const policyHolds = (await pool.query(
    `SELECT l.life_id,l.life_hash,l.custody_address,l.closed_at FROM character_deed_lives l
     JOIN character_deed_deaths d ON d.life_id=l.life_id
     WHERE l.account_id=$1 AND d.status='policy_pending'`, [accountId])).rows;
  const estates = (await pool.query(
    "SELECT * FROM character_deed_lives WHERE account_id=$1 AND closure_reason='estate_inheritance'", [accountId])).rows
    .map(row => {
      const availability = estateAvailability(row);
      return { lifeId: row.life_id, lifeHash: row.life_hash, successorLifeId: row.successor_life_id,
        ...availability, status: !row.successor_life_id ? 'blocked' : availability.chainReleaseKnown
          && Date.now() >= availability.availableAt.getTime() ? 'available' : 'waiting' };
    });
  const life = (await pool.query(
    `SELECT l.* FROM character_deed_lives l JOIN characters c ON c.id=l.life_id
     WHERE c.account_id=$1 AND c.alive`, [accountId])).rows[0];
  if (!life) return { enabled: true, life: null, equipment: [], exits: [], policyHolds, estates, safeHouse: policy };
  const equipment = (await pool.query('SELECT * FROM character_deed_equipment WHERE life_hash=$1 AND active=true', [life.life_hash])).rows;
  const coverage = (await pool.query('SELECT * FROM character_deed_safe_house WHERE dynasty_token_id=$1', [life.dynasty_token_id || ''])).rows;
  const now = Math.floor(Date.now() / 1000);
  for (const deed of equipment) {
    const periods = coverage.filter(row => row.deed_token_id === deed.deed_token_id);
    const active = periods.filter(row => Number(row.starts_at) <= now && now < Number(row.until_at));
    const until = active.reduce((max, row) => Math.max(max, Number(row.until_at)), 0);
    Object.assign(deed, { safeUntil: until ? new Date(until * 1000).toISOString() : null, protected: until > now,
      coverageStatus: until > now ? 'confirmed' : 'unprotected' });
  }
  const exits = (await pool.query("SELECT * FROM character_deed_exits WHERE life_id=$1 AND status IN ('pending','releasing')", [life.life_id])).rows;
  const safeHouseIntents = (await pool.query("SELECT deed_token_id,status,user_deadline FROM character_deed_safe_house_intents WHERE life_id=$1 AND status IN ('pending','releasing')", [life.life_id])).rows;
  return { enabled: true, life, equipment, exits, policyHolds, estates, safeHouse: policy, safeHouseIntents };
}

// Notice grants no immunity. The lifecycle operator serializes a safe release
// commitment against character death; physical custody changes only on finality.
// Consent may be added/refreshed after notice; refreshing never restarts the notice clock.
export async function requestCharacterDeedExit(pool, accountId, args = {}) {
  const tokenId = uint(args.tokenId, 'tokenId');
  return transaction(pool, async client => {
    const ch = (await client.query('SELECT id FROM characters WHERE account_id=$1 AND alive FOR UPDATE', [accountId])).rows[0];
    if (!ch) fail('no_character', 'No living character.');
    await assertCharacterDeedActionsAvailable(client, ch.id);
    await lockState(client);
    const life = await ensureLife(client, ch.id);
    if (life.status !== 'alive') fail('custody_dead', 'A closed life cannot request an exit.');
    const equipment = (await client.query('SELECT * FROM character_deed_equipment WHERE deed_token_id=$1 FOR UPDATE', [tokenId])).rows[0];
    if (!equipment?.active || equipment.life_hash !== life.life_hash) fail('custody_equipment', 'This deed is not equipped by your current life.');
    const old = (await client.query('SELECT * FROM character_deed_exits WHERE life_id=$1 AND deed_token_id=$2 FOR UPDATE', [life.life_id, tokenId])).rows[0];
    if (old?.status === 'releasing') fail('custody_exit_committed', 'This safe exit is already committed and cannot be replaced.');
    const requested = old?.status === 'pending' ? new Date(old.requested_at) : new Date();
    const available = old?.status === 'pending' ? new Date(old.available_at) : new Date(requested.getTime() + CHARACTER_DEED_EXIT_NOTICE_MS);
    const supplied = ['userNonce', 'userIssuedAt', 'userDeadline', 'userSignature'].some(k => args[k] != null);
    let consent = [null, null, null, null];
    if (supplied) {
      const nonce = uint(args.userNonce, 'userNonce'), issued = uint(args.userIssuedAt, 'userIssuedAt'), deadline = uint(args.userDeadline, 'userDeadline');
      if (!/^0x(?:[0-9a-f]{2})+$/i.test(String(args.userSignature))) fail('custody_consent', 'A signed exit intent is required.');
      const now = BigInt(Math.floor(Date.now() / 1000));
      if (BigInt(issued) > now || BigInt(deadline) <= now || BigInt(deadline) > BigInt(issued) + BigInt(CHARACTER_DEED_EXIT_INTENT_TTL_SEC)
        || BigInt(issued) * 1000n < BigInt(available.getTime())) fail('custody_consent', 'Sign a fresh exit intent after the notice period.');
      consent = [nonce, issued, deadline, args.userSignature];
    } else if (old?.status === 'pending') consent = [old.user_nonce, old.user_issued_at, old.user_deadline, old.user_signature];
    if (old) await client.query(
      `UPDATE character_deed_exits SET status='pending',requested_at=$3,available_at=$4,user_nonce=$5,
       user_issued_at=$6,user_deadline=$7,user_signature=$8 WHERE life_id=$1 AND deed_token_id=$2`,
      [life.life_id, tokenId, requested, available, ...consent]);
    else await client.query(
      `INSERT INTO character_deed_exits (life_id,deed_token_id,status,requested_at,available_at,
       user_nonce,user_issued_at,user_deadline,user_signature) VALUES ($1,$2,'pending',$3,$4,$5,$6,$7,$8)`,
      [life.life_id, tokenId, requested, available, ...consent]);
    return { pending: true, lifeHash: life.life_hash, tokenId, requestedAt: requested, availableAt: available,
      consentStored: !!consent[3], benefitsActive: false };
  });
}

export async function cancelCharacterDeedExit(pool, accountId, { tokenId } = {}) {
  return transaction(pool, async client => {
    const ch = (await client.query('SELECT id FROM characters WHERE account_id=$1 AND alive FOR UPDATE', [accountId])).rows[0];
    if (!ch) fail('no_character', 'No living character.');
    await assertCharacterDeedActionsAvailable(client, ch.id);
    await lockState(client);
    const params = [ch.id];
    if (tokenId != null) params.push(uint(tokenId, 'tokenId'));
    const result = await client.query(`UPDATE character_deed_exits SET status='cancelled',user_signature=NULL
      WHERE life_id=$1 AND status='pending'${params.length > 1 ? ' AND deed_token_id=$2' : ''}`, params);
    const life = (await client.query('SELECT life_hash FROM character_deed_lives WHERE life_id=$1', [ch.id])).rows[0];
    return { cancelled: result.rowCount };
  });
}

export async function requestCharacterDeedSafeHouse(pool, accountId, args) {
  const tokenId = uint(args.tokenId, 'tokenId'), days = Number(args.days);
  if (!Number.isSafeInteger(days) || days < 1 || days > 7) fail('custody_args', 'Prepay between one and seven full days.');
  const nonce = uint(args.userNonce, 'nonce'), issued = uint(args.userIssuedAt, 'issuedAt');
  const deadline = uint(args.userDeadline, 'deadline'), priceDay = uint(args.priceDay, 'priceDay'), maxBurn = uint(args.maxBurn, 'maxBurn');
  if (!/^0x(?:[0-9a-f]{2})+$/i.test(String(args.userSignature))) fail('custody_consent', 'Sign the Safe House request with your identity wallet.');
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (BigInt(issued) > now || BigInt(deadline) <= now || BigInt(deadline) > BigInt(issued) + 300n
    || BigInt(priceDay) !== now / 86400n) fail('custody_consent', 'The Safe House quote expired. Request a fresh quote and sign it.');
  return transaction(pool, async client => {
    // Match estate lock order: exact character first, then global custody state.
    const ch = (await client.query('SELECT id FROM characters WHERE account_id=$1 AND alive FOR UPDATE', [accountId])).rows[0];
    if (!ch) fail('no_character', 'No living character.');
    await assertCharacterDeedActionsAvailable(client, ch.id);
    await lockState(client);
    const life = await ensureLife(client, ch.id);
    if (life.status !== 'alive' || life.life_hash !== args.lifeHash) fail('custody_dead', 'This quote belongs to a closed or different character life.');
    const equipped = (await client.query('SELECT * FROM character_deed_equipment WHERE deed_token_id=$1 FOR UPDATE', [tokenId])).rows[0];
    if (!equipped?.active || equipped.life_hash !== life.life_hash) fail('custody_equipment', 'Equip this deed before protecting it.');
    const old = (await client.query('SELECT * FROM character_deed_safe_house_intents WHERE life_id=$1 AND user_nonce=$2', [life.life_id, nonce])).rows[0];
    if (old) {
      if (old.deed_token_id !== tokenId || Number(old.days) !== days || String(old.price_day) !== priceDay
        || old.max_burn !== maxBurn || old.user_signature !== args.userSignature) fail('custody_consent', 'This Safe House nonce already has another signed request.');
      return { pending: ['pending','releasing'].includes(old.status), duplicate: true, status: old.status };
    }
    await client.query(`INSERT INTO character_deed_safe_house_intents
      (life_id,deed_token_id,days,price_day,max_burn,user_nonce,user_issued_at,user_deadline,user_signature,status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')`,
    [life.life_id, tokenId, days, priceDay, maxBurn, nonce, issued, deadline, args.userSignature]);
    return { pending: true, status: 'pending', protected: false, lifeHash: life.life_hash, tokenId,
      note: 'Protection starts only after the on-chain burn is confirmed. A queued request grants no protection.' };
  });
}

export async function recordCharacterDeedSafeHouse(pool, args) {
  const proof = receipt(args), tokenId = uint(args.tokenId, 'tokenId'), dynasty = uint(args.dynastyTokenId, 'dynastyTokenId');
  const starts = uint(args.startsAt, 'startsAt'), until = uint(args.until, 'until');
  if (BigInt(starts) >= BigInt(until)) fail('custody_receipt', 'Invalid Safe House coverage interval.');
  return transaction(pool, async client => {
    await lockState(client);
    const existing = (await client.query('SELECT * FROM character_deed_safe_house WHERE ref=$1', [proof.ref])).rows[0];
    if (existing) return { duplicate: true };
    await client.query(`INSERT INTO character_deed_safe_house
      (deed_token_id,dynasty_token_id,starts_at,until_at,burn_amount,price_day,previous_day_volume,ref,tx_hash,last_block_number,last_log_index)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [tokenId, dynasty, starts, until,
      uint(args.burnAmount, 'burnAmount'), uint(args.priceDay, 'priceDay'), uint(args.previousDayVolume, 'previousDayVolume'),
      proof.ref, proof.txHash, uint(args.blockNumber, 'blockNumber'), Number(uint(args.logIndex, 'logIndex'))]);
    await client.query(`UPDATE character_deed_safe_house_intents SET status='confirmed',tx_hash=$3
      WHERE life_id=(SELECT life_id FROM character_deed_lives WHERE life_hash=$1) AND user_nonce=$2`,
    [hash(args.lifeHash), uint(args.nonce, 'nonce'), proof.txHash]);
    return { recorded: true };
  });
}
