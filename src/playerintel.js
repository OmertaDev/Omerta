// Player knowledge belongs to the account; observations describe one character at one moment.
// A phone number follows a bloodline, but a sighting never follows its next heir.
import { GameError } from './game.js';
import { hasContact } from './contacts.js';
import { levelOf, jailed, hospitalized } from './rules.js';

function publicIntel(row) {
  if (!row) return null;
  const facts = row.facts || {};
  const intel = { id: row.target_character, name: typeof facts.name === 'string' ? facts.name : null,
    npc: !!facts.npc };
  if (Number.isFinite(facts.level)) intel.level = facts.level;
  if (typeof facts.loc === 'string') intel.loc = facts.loc;
  if (Number.isFinite(facts.guardPrice)) intel.guardPrice = facts.guardPrice;
  if (facts.lfg === true && typeof facts.lfgAt === 'string' && Number.isFinite(new Date(facts.lfgAt).getTime())) {
    intel.lfg = true;
    intel.lfgAt = new Date(facts.lfgAt).toISOString();
  }
  if (Array.isArray(facts.fronts)) intel.fronts = facts.fronts.map((front) => ({ id: front.id, kind: front.kind }));
  return { ...intel, source: row.source, sourceName: row.source_name || null,
    observedAt: row.observed_at, learnedAt: row.learned_at };
}

function observation(target, location = true) {
  const facts = { id: target.id, name: target.name, npc: !!target.is_npc };
  if (location) {
    facts.level = levelOf(Number(target.respect) || 0);
    facts.loc = target.loc;
    if (target.guard_price != null) facts.guardPrice = Math.floor(Number(target.guard_price));
    const lfgAt = target.lfg_at == null ? NaN : new Date(target.lfg_at).getTime();
    if (target.lfg === true && Number.isFinite(lfgAt)) {
      facts.lfg = true;
      facts.lfgAt = new Date(lfgAt).toISOString();
    }
  }
  return facts;
}

async function saveIntel(q, ownerAccount, targetId, facts, source, sourceName, observedAt) {
  const conflict = facts.loc === undefined ? 'DO NOTHING' : `DO UPDATE
       SET facts=EXCLUDED.facts, source=EXCLUDED.source, source_name=EXCLUDED.source_name,
           observed_at=EXCLUDED.observed_at, learned_at=EXCLUDED.learned_at
       WHERE player_intel.observed_at < EXCLUDED.observed_at`;
  await q.query(
    `INSERT INTO player_intel (owner_account, target_character, facts, source, source_name, observed_at, learned_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (owner_account, target_character) ${conflict}`,
    [ownerAccount, targetId, JSON.stringify(facts), source, sourceName || null, observedAt, new Date()]);
  return readPlayerIntel(q, ownerAccount, targetId);
}

export async function recordPlayerIntel(q, ownerAccount, target, options = {}) {
  if (!ownerAccount || !target?.id || ownerAccount === target.account_id) return null;
  // Identity-only inserts never overwrite a sighting, including one acquired concurrently.
  const facts = observation(target, options.location !== false);
  // A paid dossier supplies property leads; a first introduction does not expose someone's books.
  if (options.source === 'dossier') facts.fronts = (await q.query(
    'SELECT id, kind FROM businesses WHERE character_id=$1', [target.id])).rows;
  return saveIntel(q, ownerAccount, target.id, facts,
    options.source || 'encounter', options.sourceName, options.observedAt || new Date());
}

export async function readPlayerIntel(q, ownerAccount, targetId) {
  return publicIntel((await q.query(
    'SELECT target_character, facts, source, source_name, observed_at, learned_at FROM player_intel WHERE owner_account=$1 AND target_character=$2',
    [ownerAccount, targetId])).rows[0]);
}

export async function playerIntelMap(q, ownerAccount) {
  const rows = (await q.query(
    'SELECT target_character, facts, source, source_name, observed_at, learned_at FROM player_intel WHERE owner_account=$1 ORDER BY learned_at DESC',
    [ownerAccount])).rows;
  return new Map(rows.map((row) => [row.target_character, publicIntel(row)]));
}

export async function requireKnownPlayer(q, ch, targetId) {
  const intel = await readPlayerIntel(q, ch.account_id, targetId);
  if (intel) return intel;
  const target = (await q.query('SELECT account_id FROM characters WHERE id=$1', [targetId])).rows[0];
  if (target && (await hasContact(q, ch.account_id, target.account_id) ||
      (await q.query('SELECT 1 FROM rival_events WHERE victim_account=$1 AND aggressor_account=$2 LIMIT 1',
        [ch.account_id, target.account_id])).rows.length)) return true;
  // Existing social ties already introduce their named participants. This grants identity only;
  // it does not create a sighting or disclose current whereabouts on the intelligence board.
  if (target && (await q.query(
    `SELECT 1 FROM mentorships WHERE (mentor_account=$1 AND protege_account=$2)
         OR (mentor_account=$2 AND protege_account=$1)
     UNION ALL SELECT 1 FROM mentor_offers WHERE (mentor_account=$1 AND protege_account=$2)
         OR (mentor_account=$2 AND protege_account=$1)
     UNION ALL SELECT 1 FROM crew_members mine JOIN crew_members theirs ON mine.crew_id=theirs.crew_id
       WHERE mine.account_id=$1 AND theirs.account_id=$2
     UNION ALL SELECT 1 FROM gang_members mine JOIN gang_members theirs ON mine.gang_id=theirs.gang_id
       WHERE mine.character_id=$3 AND theirs.character_id=$4
     UNION ALL SELECT 1 FROM dynasty_marriages WHERE (account_a=$1 AND account_b=$2)
         OR (account_a=$2 AND account_b=$1)
     UNION ALL SELECT 1 FROM consiglieri WHERE (dynasty_account=$1 AND adviser_account=$2)
         OR (dynasty_account=$2 AND adviser_account=$1)
     UNION ALL SELECT 1 FROM characters WHERE ((id=$3 AND guarded_by=$4) OR (id=$4 AND guarded_by=$3))
         AND guarded_until>now() LIMIT 1`, [ch.account_id, target.account_id, ch.id, targetId])).rows.length)
    return true;
  throw new GameError('unknown_player', 'Meet them or hear about them before investigating.');
}

export async function playerIntelBoard(q, ch) {
  const known = await playerIntelMap(q, ch.account_id);
  const represented = new Set((await q.query(
    `SELECT c.account_id FROM player_intel i JOIN characters c ON c.id=i.target_character
      WHERE i.owner_account=$1`, [ch.account_id])).rows.map((row) => row.account_id));
  // Compatibility for old books: a held line supplies identity, never a free live location/level.
  const contacts = (await q.query(
    `SELECT c.id, c.account_id, c.name, c.is_npc, ct.met_at
       FROM contacts ct JOIN characters c ON c.account_id=ct.contact_account AND c.alive
      WHERE ct.owner_account=$1 ORDER BY ct.met_at DESC LIMIT 200`, [ch.account_id])).rows;
  for (const contact of contacts) {
    if (known.has(contact.id) || represented.has(contact.account_id) || contact.id === ch.id) continue;
    known.set(contact.id, { id: contact.id, name: contact.name, npc: !!contact.is_npc,
      source: 'phone', sourceName: null, observedAt: contact.met_at, learnedAt: contact.met_at });
  }
  if (!jailed(ch) && !hospitalized(ch)) {
    const nearby = (await q.query(
      `SELECT id, is_npc FROM characters WHERE alive AND loc=$1 AND id<>$2
        AND (jail_until IS NULL OR jail_until<=now())
        AND (hosp_until IS NULL OR hosp_until<=now()) ORDER BY id LIMIT 200`, [ch.loc, ch.id])).rows;
    for (const stranger of nearby) {
      if (known.has(stranger.id)) known.get(stranger.id).nearby = true;
      else known.set(stranger.id, { id: stranger.id, name: null, npc: !!stranger.is_npc, nearby: true });
    }
  }
  return { streets: [...known.values()].map((intel) => ({
    level: null, loc: null, gangTag: null, jailed: null, hospitalized: null,
    guardPrice: null, fronts: [], nearby: false, ...intel,
  })) };
}

export async function sharePlayerIntel(ch, recipientId, targetId, q, h) {
  const recipient = (await q.query('SELECT id, account_id FROM characters WHERE id=$1 AND alive', [recipientId])).rows[0];
  if (!recipient) throw new GameError('gone', 'Nobody answers that number.');
  if (recipient.account_id === ch.account_id) throw new GameError('self', 'You already have your own notes.');
  const blocks = (await q.query(
    `SELECT blocker_account FROM dm_blocks
      WHERE (blocker_account=$1 AND blocked_account=$2) OR (blocker_account=$2 AND blocked_account=$1)`,
    [recipient.account_id, ch.account_id])).rows;
  if (blocks.some((row) => row.blocker_account === recipient.account_id))
    throw new GameError('blocked', "The line is dead — they're not taking your calls.");
  if (blocks.some((row) => row.blocker_account === ch.account_id))
    throw new GameError('you_blocked', 'You blocked this line — unblock it to talk.');
  if (!await hasContact(q, ch.account_id, recipient.account_id))
    throw new GameError('contact', 'Meet them or get their number before passing along gossip.');
  const intel = await readPlayerIntel(q, ch.account_id, targetId);
  if (!intel) throw new GameError('unknown_player', 'You have no information about them to share.');
  const facts = { id: intel.id, name: intel.name, npc: intel.npc };
  if (intel.level !== undefined) facts.level = intel.level;
  if (intel.loc !== undefined) facts.loc = intel.loc;
  if (intel.guardPrice !== undefined) facts.guardPrice = intel.guardPrice;
  if (intel.fronts !== undefined) facts.fronts = intel.fronts;
  if (intel.lfg === true) { facts.lfg = true; facts.lfgAt = intel.lfgAt; }
  const previous = await readPlayerIntel(q, recipient.account_id, targetId);
  // Identity-only gossip must not erase a located sighting, even if the call was more recent.
  const improves = !previous || (new Date(previous.observedAt) < new Date(intel.observedAt)
    && (intel.loc !== undefined || previous.loc === undefined));
  if (improves) await saveIntel(q, recipient.account_id, targetId, facts, 'gossip', ch.name, intel.observedAt);
  if (improves && typeof h?.notify === 'function')
    await h.notify(q, recipient.id, 'intel_shared', {
    from: ch.name, target: intel.id, name: intel.name });
  // Acknowledgements contain only the sender's notes, never the recipient's newer private intel.
  return { ok: true, op: 'intel_share', intel: { ...intel, source: 'gossip', sourceName: ch.name } };
}

export async function meetPlayer(ch, victim) {
  if (ch.id === victim.id) throw new GameError('self', "You already know yourself.");
  if (jailed(ch)) throw new GameError('jailed', 'No introductions from a cell.');
  if (hospitalized(ch)) throw new GameError('hosp', "You're in no shape to meet anyone.");
  if (!victim.alive || jailed(victim) || hospitalized(victim) || victim.loc !== ch.loc)
    throw new GameError('unavailable', 'They are not here to meet.');
  return { ok: true, op: 'intel_meet', met: observation(victim) };
}
