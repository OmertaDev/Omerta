// Exact formation fee and nonmonetary NPC standing; no invented reward ledger.
import assert from 'node:assert/strict';
import { M3, FAMILY_WAR, POPULATION, PACING, levelOf, dayOf } from '../src/rules.js';
import { exactSum, negate } from './rc1-resource-journal.js';
import { verifyNpcProvenanceEnvelope } from './rc1-npc-family-provenance.js';
const zeroFields = ['treasury', 'ammo_bank', 'omr_reserve', 'lifetime_tribute', 'season_tribute', 'seal', 'foundation', 'wars_won',
  'territory_earned', 'season_wars', 'weekly_progress', 'war_score_us', 'war_score_them', 'rwa_invested', 'sov_points', 'monument_built'];
const nullFields = ['color', 'weekly_week', 'war_with', 'war_until', 'dividend_at', 'dynasty_name', 'oathbreaker_until',
  'npc_aggro_until', 'held_by_gang', 'held_since', 'tribute_at', 'charter', 'charter_at'];
export function reconcileNpcFamilyFormation(before, after, receipts, provenance, identity) {
  const s = verifyNpcProvenanceEnvelope(provenance, identity), table = (state, name) => state.tables[name];
  assert.equal(receipts.length, 1, 'Only isolated original NPC formation is supported');
  const receipt = receipts[0]; assert.equal(receipt.currency, 'cash'); assert.equal(receipt.reason, 'gang:found');
  assert.equal(exactSum([receipt.amount]), String(-M3.GANG_FOUND_COST)); assert.equal(receipt.account_id, null); assert.equal(receipt.counterparty, null);
  const person = table(before, 'characters').find(row => row.id === receipt.character_id), finalPerson = table(after, 'characters').find(row => row.id === person?.id);
  assert(person?.alive && finalPerson?.alive && person.is_npc && finalPerson.is_npc && person.account_id === finalPerson.account_id);
  assert.equal(table(before, 'account_persistent').find(row => row.account_id === person.account_id)?.npc_flag, true);
  assert.equal(table(after, 'account_persistent').find(row => row.account_id === person.account_id)?.npc_flag, true);
  const minLevel = Math.min(...POPULATION.FAMILIES.FOUND_BANDS.map(id => POPULATION.BANDS.find(band => band.id === id)?.lvl[0]).filter(Number.isFinite));
  assert(levelOf(Number(person.respect)) >= Math.max(minLevel, M3.GANG_FOUND_LEVEL));
  assert(Math.floor(Number(person.cash) * (1 - POPULATION.BEHAVIOUR.KEEP_FLOOR)) >= M3.GANG_FOUND_COST);
  assert(table(before, 'gangs').filter(row => row.npc_flag).length < POPULATION.FAMILIES.TARGET);
  assert(!table(before, 'gang_members').some(row => row.character_id === person.id));
  const members = table(after, 'gang_members').filter(row => row.character_id === person.id); assert.equal(members.length, 1);
  const member = members[0], family = table(after, 'gangs').find(row => row.id === member.gang_id); assert(family);
  assert.equal(member.role, 'boss'); assert(!table(before, 'gangs').some(row => row.id === family.id));
  assert.equal(table(after, 'gang_members').filter(row => row.gang_id === family.id).length, 1);
  assert(POPULATION.FAMILIES.NAMES.some(([name, tag]) => name === family.name && tag === family.tag));
  assert(!table(before, 'gangs').some(row => row.name === family.name || row.tag === family.tag));
  assert.deepEqual(s[0].parameters, []); assert.equal(s[0].command, 'BEGIN');
  assert.deepEqual(s[1].parameters, []); assert.deepEqual(s[2].parameters, []);
  assert.deepEqual(s[3].parameters, [PACING.LEVEL_DIVISOR * (minLevel - 1) ** 2]);
  assert.deepEqual(s[4].parameters, [person.id]); assert.equal(s[4].rowCount, 1); assert.equal(s[4].rows.length, 1);
  const locked = s[4].rows[0];
  for (const field of ['id', 'account_id', 'alive', 'is_npc', 'respect', 'cash', 'bank'])
    assert.equal(String(locked[field]), String(person[field]), `Locked NPC founder differs: ${field}`);
  assert(s[3].rows.some(row => row.id === person.id), 'Locked founder was not in actual native shortlist');
  const candidate = s[3].rows.filter(row => !s[2].rows.some(member => member.character_id === row.id)
    && Math.floor(Number(row.cash) * (1 - POPULATION.BEHAVIOUR.KEEP_FLOOR)) >= M3.GANG_FOUND_COST)[0];
  assert.equal(candidate?.id, person.id, 'Founder differs from authored native shortlist selection');
  assert(!s[1].rows.some(row => row.name === family.name));
  assert.deepEqual(s[5].parameters, [person.id]); assert.equal(s[5].rowCount, 0); assert.deepEqual(s[5].rows, []);
  assert.deepEqual(s[6].parameters, [family.name, family.tag]); assert.equal(s[6].rowCount, 0); assert.deepEqual(s[6].rows, []);
  const logicalAt = identity.context.logicalAt; assert(Number.isSafeInteger(logicalAt));
  assert.equal(family.season, Math.floor(dayOf(logicalAt) / 28));
  assert.deepEqual(s[7].parameters, [family.id, family.name, family.tag, family.season]);
  assert.deepEqual(s[8].parameters, [family.id, person.id, 'boss']);
  assert.deepEqual(s[9].parameters, [receipt.id, person.id, null, 'cash', -M3.GANG_FOUND_COST, 'gang:found', null]);
  assert.deepEqual(s[10].parameters, [person.id, Number(person.cash) - M3.GANG_FOUND_COST]);
  assert.deepEqual(s[11].parameters, [family.id, FAMILY_WAR.POOL_MAX]);
  for (const i of [7, 8, 9]) { assert.equal(s[i].command, 'INSERT'); assert.equal(s[i].rowCount, 1); assert.deepEqual(s[i].rows, []); }
  for (const i of [10, 11]) { assert.equal(s[i].command, 'UPDATE'); assert.equal(s[i].rowCount, 1); assert.deepEqual(s[i].rows, []); }
  assert.deepEqual(s[12].parameters, []); assert.equal(s[12].command, 'COMMIT');
  assert.equal(exactSum([finalPerson.cash, negate(person.cash)]), receipt.amount); assert.equal(exactSum([finalPerson.bank]), exactSum([person.bank]));
  for (const row of table(before, 'characters')) if (row.id !== person.id) {
    const next = table(after, 'characters').find(item => item.id === row.id); assert(next);
    for (const field of ['cash', 'bank', 'ammo']) assert.equal(exactSum([next[field]]), exactSum([row[field]]), 'Other owner changed during NPC formation');
  }
  for (const field of zeroFields) if (Object.hasOwn(family, field)) assert.equal(exactSum([family[field]]), '0', `Unexpected NPC formation ${field}`);
  for (const field of nullFields) if (Object.hasOwn(family, field)) assert.equal(family[field], null, `Unexpected NPC formation ${field}`);
  assert.equal(family.npc_flag, true); assert.equal(family.weekly_done, false);
  assert.equal(exactSum([family.war_pool]), String(FAMILY_WAR.POOL_MAX), 'Wrong nonmonetary NPC war-pool initialization');
  for (const value of [receipt.at, member.joined_at, family.created_at, family.war_pool_at]) assert.equal(Date.parse(value), logicalAt, 'NPC formation timestamps differ from original COMMIT clock');
  assert.equal(member.post ?? null, null); assert.equal(member.post_at ?? null, null);
  const fields = new Set(['id', 'name', 'tag', 'season', 'created_at', 'npc_flag', 'war_pool', 'war_pool_at', 'weekly_done', ...zeroFields, ...nullFields]);
  const authority = [{ table: 'transactions', id: receipt.id }, { kind: 'native-returned-transaction', sha256: provenance.sha256, transactionId: identity.transactionId }];
  return { familyId: family.id, characterId: person.id, fields, memberFields: new Set(['gang_id', 'character_id', 'role', 'joined_at', 'post', 'post_at']),
    movement: { kind: 'npc-family-formation-cash-sink', familyId: family.id, characterId: person.id, accountId: person.account_id,
      currency: 'cash', amount: String(M3.GANG_FOUND_COST), disposition: 'cash-destroyed', authority,
      nonmonetaryState: { field: 'war_pool', before: 'absent', after: String(FAMILY_WAR.POOL_MAX), notCurrencyMintOrReward: true } } };
}
