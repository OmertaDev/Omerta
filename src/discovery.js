// THE ROLODEX — people you have met or heard about, using what you last learned.
// Reading a board never discovers a stranger or refreshes their whereabouts.
import { DISCOVERY, CREW, levelOf, districtName } from './rules.js';
import { playerIntelMap } from './playerintel.js';

export async function discoveryBoard(ch, client, onlineIds = [], filters = {}) {
  const district = filters.district || null;
  const nofam = !!filters.nofam;
  const onlineOnly = !!filters.online;
  const myLevel = levelOf(Number(ch.respect));
  const myCrew = (await client.query('SELECT crew_id FROM crew_members WHERE account_id=$1', [ch.account_id])).rows[0]?.crew_id || null;
  const intel = await playerIntelMap(client, ch.account_id);
  const ids = [...intel.keys()].filter((id) => id !== ch.id);
  // Classification is the only live read of known people. Location, level and ordering come
  // entirely from stored observations; filtering on a live column would reveal it indirectly.
  const humans = ids.length ? (await client.query(
    `SELECT c.id FROM characters c JOIN account_persistent a ON a.account_id=c.account_id
      WHERE c.alive AND NOT c.is_npc AND NOT a.agent_flag
        AND c.id IN (${ids.map((_, i) => `$${i + 1}`).join(',')})`, ids)).rows : [];
  const cards = humans.map((r) => intel.get(r.id)).map((seen) => ({
    id: seen.id, name: seen.name, level: seen.level ?? null,
    district: seen.loc ?? null, districtName: seen.loc ? districtName(seen.loc) : null,
    observedAt: seen.observedAt, learnedAt: seen.learnedAt,
    source: seen.source, sourceName: seen.sourceName,
    gangTag: null, lfg: null, hasCrew: null, online: null, seekingMentor: null, vouches: null,
  })).filter((r) => (!district || r.district === district) && !nofam && !onlineOnly);
  const peers = cards.filter((r) => r.level != null && Math.abs(r.level - myLevel) <= DISCOVERY.BAND)
    .sort((a, b) => Math.abs(a.level - myLevel) - Math.abs(b.level - myLevel))
    .slice(0, DISCOVERY.LIMIT);
  const newcomers = [...cards].sort((a, b) => new Date(b.learnedAt) - new Date(a.learnedAt))
    .slice(0, DISCOVERY.LIMIT);

  // A recruiting crew advertises its name and available room. Its members' live levels
  // are private; a single-member range would otherwise expose an unknown player's level.
  const crewRows = (await client.query(
    `SELECT cr.id, cr.name, cm.account_id FROM crews cr
       JOIN crew_members cm ON cm.crew_id = cr.id WHERE cr.recruiting`)).rows;
  const byCrew = new Map();
  for (const r of crewRows) {
    if (r.id === myCrew) continue;
    const crew = byCrew.get(r.id) || { id: r.id, name: r.name, members: 0, minLevel: null, maxLevel: null };
    crew.members += 1;
    byCrew.set(r.id, crew);
  }
  const crews = [...byCrew.values()].filter((r) => r.members < CREW.MAX_MEMBERS)
    .sort((a, b) => b.members - a.members).slice(0, DISCOVERY.LIMIT);
  return {
    me: { level: myLevel, lfg: !!ch.lfg, inCrew: !!myCrew, band: DISCOVERY.BAND, crewMax: CREW.MAX_MEMBERS },
    filters: { district, nofam, online: onlineOnly },
    looking: [], peers, newcomers, crews,
  };
}
// ── LFG — advertise that you're open to a crew (or take the flag down). A boolean + a freshness stamp,
// written by direct SQL (outside persistCharacter's positional UPDATE — the active_at pattern; the
// column is not persisted positionally, so a later persisting action can't clobber it). Dies with the
// street: a fresh heir is not looking until they say so, which is correct. §10.4-free. ──
export async function setLfg(ch, on, client, h) {
  const flag = !!on;
  await client.query('UPDATE characters SET lfg=$2, lfg_at = CASE WHEN $2 THEN now() ELSE lfg_at END WHERE id=$1', [ch.id, flag]);
  return { ok: true, discovery: flag ? 'looking' : 'not_looking', lfg: flag };
}
