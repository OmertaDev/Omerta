// Deed-backed addresses are illustrative landmarks, never character positions or authority.
import { GameError } from './game.js';
import { DISTRICTS } from './rules.js';
import { withItemRead } from './items.js';

const fail = (code, message) => { throw new GameError(code, message); };
// Legacy canonical deeds predate today's claim alphabet. A cursor is an opaque stored key.
const streetKey = value => typeof value === 'string' && value.length >= 1 && value.length <= 128
  && !/[\x00-\x1f\x7f]/.test(value);

export function validateHomesQuery(query = {}) {
  if (!query || typeof query !== 'object' || Array.isArray(query)
      || Object.keys(query).some(key => !['district', 'after', 'limit'].includes(key)))
    fail('city_homes_query', 'Use only district, after and limit.');
  if (typeof query.district !== 'string' || !DISTRICTS.some(d => d.id === query.district))
    fail('city_homes_district', 'Choose a current city district.');
  if (query.after !== undefined && !streetKey(query.after))
    fail('city_homes_cursor', 'Use a street key issued by this district directory.');
  const limit = query.limit === undefined ? 32 : typeof query.limit === 'string' && /^[1-9][0-9]?$/.test(query.limit)
    ? Number(query.limit) : query.limit;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 64)
    fail('city_homes_limit', 'Choose between 1 and 64 addresses.');
  return { district: query.district, after: query.after ?? '', limit };
}

export async function cityHomes(pool, accountId, query) {
  const { district, after, limit } = validateHomesQuery(query);
  return withItemRead(pool, async client => {
    const actor = (await client.query(`SELECT id,generation,loc FROM characters
      WHERE account_id=$1 AND alive ORDER BY created_at DESC,id LIMIT 1`, [accountId])).rows[0];
    if (!actor) fail('no_character', 'Create a living character first.');
    if (after && !(await client.query('SELECT name_lc FROM street_deeds WHERE district=$1 AND name_lc=$2',
      [district, after])).rows.length) fail('city_homes_cursor', 'That street key does not belong to this district.');
    const total = Number((await client.query('SELECT COUNT(*) n FROM street_deeds WHERE district=$1', [district])).rows[0].n);
    const rows = (await client.query(`SELECT account_id,name,name_lc,district,onchain_token_id FROM street_deeds
      WHERE district=$1 AND name_lc>$2 ORDER BY name_lc LIMIT $3`, [district, after, limit + 1])).rows;
    const project = async deed => {
      const external = deed.onchain_token_id != null || String(deed.account_id).startsWith('onchain:');
      // At most 64 scoped owner reads. Flat queries also work in the disposable pg-mem fixture.
      const steward = external ? null : (await client.query(`SELECT c.name,c.is_npc,a.agent_flag FROM characters c
        LEFT JOIN account_persistent a ON a.account_id=c.account_id
        WHERE c.account_id=$1 AND c.alive ORDER BY c.created_at DESC,c.id LIMIT 1`, [deed.account_id])).rows[0];
      return { key: deed.name_lc, street: deed.name, districtId: deed.district,
        owner: steward ? { name: steward.name, kind: steward.is_npc ? 'npc' : steward.agent_flag ? 'agent' : 'player' } : null,
        mine: !external && deed.account_id === accountId,
        ownership: external ? 'external' : steward ? 'city' : 'estate' };
    };
    const homes = [];
    for (const deed of rows.slice(0, limit)) homes.push(await project(deed));
    const own = (await client.query(`SELECT account_id,name,name_lc,district,onchain_token_id FROM street_deeds
      WHERE account_id=$1 AND district=$2`, [accountId, district])).rows[0];
    const myHome = own ? homes.find(home => home.key === own.name_lc) || await project(own) : null;
    return { viewer: { characterId: actor.id, generation: Number(actor.generation), district: actor.loc },
      districtId: district, placement: 'illustrative', homes, myHome,
      nextCursor: rows.length > limit ? homes.at(-1).key : null, total };
  });
}
