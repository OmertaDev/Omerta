// THE COLLISION — last-known places of people you have met or heard about.
// A board read supplies no new identities, live presence or remote location tracking.
import { DISCOVERY, levelOf, districtName } from './rules.js';
import { playerIntelMap } from './playerintel.js';

export async function collisionBoard(client, ch, onlineIds = []) {
  const you = { district: ch.loc || null, districtName: ch.loc ? districtName(ch.loc) : null };
  const myLevel = levelOf(Number(ch.respect));
  const intel = await playerIntelMap(client, ch.account_id);
  const ids = [...intel.keys()].filter((id) => id !== ch.id);
  const humans = ids.length ? (await client.query(
    `SELECT c.id FROM characters c JOIN account_persistent a ON a.account_id = c.account_id
      WHERE c.alive AND NOT c.is_npc AND NOT a.agent_flag
        AND c.id IN (${ids.map((_, i) => `$${i + 1}`).join(',')})`, ids)).rows : [];
  const cards = humans.map((r) => intel.get(r.id)).map((seen) => ({
    id: seen.id, name: seen.name, level: seen.level ?? null,
    district: seen.loc ?? null, districtName: seen.loc ? districtName(seen.loc) : null,
    observedAt: seen.observedAt, learnedAt: seen.learnedAt,
    source: seen.source, sourceName: seen.sourceName,
    gangTag: null, hasCrew: null, wanted: null, sameFamily: null, online: null,
  }));
  const closest = (a, b) => Math.abs((a.level ?? myLevel) - myLevel) - Math.abs((b.level ?? myLevel) - myLevel);
  const here = ch.loc ? cards.filter((r) => r.district === ch.loc).sort(closest).slice(0, 12) : [];
  const nearby = cards.filter((r) => r.district !== ch.loc && r.level != null && Math.abs(r.level - myLevel) <= DISCOVERY.BAND)
    .sort(closest).slice(0, 8);
  const byDistrict = new Map();
  for (const r of cards) {
    if (!r.district || r.district === ch.loc) continue;
    const group = byDistrict.get(r.district) || { district: r.district, districtName: r.districtName,
      count: 0, observedAt: r.observedAt };
    group.count += 1;
    if (new Date(r.observedAt) > new Date(group.observedAt)) group.observedAt = r.observedAt;
    byDistrict.set(r.district, group);
  }
  const hotDistricts = [...byDistrict.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  return { onlineNow: 0, here, nearby, hotDistricts, you };
}
