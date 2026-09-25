// Canonical state eligibility only; this does not claim returned-query/caller provenance.
import assert from 'node:assert/strict';
import { isDeepStrictEqual as equal } from 'node:util';
import { M3, POPULATION } from '../src/rules.js';
import { assertNpcFamilySourcePins } from './rc1-npc-family-provenance.js';

export function reconcileNpcFamilyRecruitment(before, after, { identity = null } = {}) {
  const result = { memberIds: new Set(), movements: [] };
  const context = identity?.context;
  if (context?.authority !== 'original-worker' || identity.outcome !== 'COMMITTED' || identity.command !== 'COMMIT') return result;
  assert.equal(before.format, 1); assert.equal(after.format, 1);
  const tables = Object.keys(before.tables).sort();
  assert.deepEqual(tables, Object.keys(after.tables).sort(), 'Recruitment changed observed table coverage');
  const oldMembers = before.tables.gang_members, members = after.tables.gang_members;
  if (equal(oldMembers, members)) return result;
  if (tables.some(table => table !== 'gang_members' && !equal(before.tables[table], after.tables[table]))) return result;
  const priorIds = new Set(oldMembers.map(row => row.character_id));
  assert.equal(priorIds.size, oldMembers.length, 'Duplicate prior membership identity');
  assert.equal(new Set(members.map(row => row.character_id)).size, members.length, 'Duplicate final membership identity');
  const fresh = members.filter(row => !priorIds.has(row.character_id));
  if (fresh.length !== 1 || members.length !== oldMembers.length + 1) return result;
  const member = fresh[0];
  assert.deepEqual(members.filter(row => row.character_id !== member.character_id), oldMembers, 'Recruitment changed an existing member');
  assertNpcFamilySourcePins();
  assert(Number.isSafeInteger(identity.transactionId), 'Recruitment lacks native transaction identity');
  assert(Number.isSafeInteger(context.logicalAt), 'Recruitment lacks original worker time');
  assert.equal(context.logicalAt % 3600000, 0, 'Recruitment is outside the original hourly callback');
  assert(POPULATION.FAMILIES.TARGET > 0, 'NPC Family recruitment is disabled');
  const families = before.tables.gangs.filter(row => row.id === member.gang_id);
  assert.equal(families.length, 1, 'Recruitment lacks one existing target Family');
  assert.equal(families[0].npc_flag, true, 'Worker recruited into a non-NPC Family');
  const count = oldMembers.filter(row => row.gang_id === member.gang_id).length;
  assert(count < POPULATION.FAMILIES.MIN_MEMBERS, 'Worker target was not thin');
  assert(count < POPULATION.FAMILIES.MAX_MEMBERS && count < M3.GANG_MAX_MEMBERS, 'Recruitment exceeds the authored cap');
  const characters = before.tables.characters;
  assert.equal(new Set(characters.map(row => row.id)).size, characters.length, 'Duplicate character identity');
  const eligible = characters.filter(row => row.alive === true && row.is_npc === true)
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).slice(0, 64).find(row => !priorIds.has(row.id));
  assert(eligible, 'Original worker shortlist has no unjoined living NPC');
  assert.equal(member.character_id, eligible.id, 'Recruit differs from the first eligible original shortlist entry');
  assert.deepEqual(Object.keys(member).sort(), ['character_id', 'gang_id', 'joined_at', 'post', 'post_at', 'role']);
  assert.equal(member.role, 'soldier', 'Recruitment granted a leadership role');
  assert.equal(member.post, null); assert.equal(member.post_at, null);
  assert.equal(Date.parse(member.joined_at), context.logicalAt, 'Recruitment time differs from original worker deadline');
  result.memberIds.add(member.character_id);
  result.movements.push({ kind: 'npc-family-recruitment', familyId: member.gang_id, characterId: member.character_id,
    membersBefore: count, membersAfter: count + 1, economicGrant: false,
    authority: 'Pinned runFamilies/recruitIntoFamily/joinGang state eligibility at an isolated original-worker COMMIT; no returned-query caller claim' });
  return result;
}
