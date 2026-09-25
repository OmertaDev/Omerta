import assert from 'node:assert/strict';
import { reconcileNpcFamilyRecruitment } from '../tools/rc1-npc-family-recruitment.js';
import { WORLD_RESOURCE_TABLES } from '../tools/rc1-world-resource-observer.js';

const at = Date.parse('2026-09-24T02:00:00Z');
function fixture() {
  const before = { format: 1, tables: Object.fromEntries(WORLD_RESOURCE_TABLES.map(table => [table, []])) };
  before.tables.gangs = [{ id: 'family', npc_flag: true }, { id: 'other', npc_flag: true }];
  before.tables.characters = ['a', 'b', 'c'].map(id => ({ id, alive: true, is_npc: true, cash: '500' }));
  before.tables.gang_members = [{ character_id: 'a', gang_id: 'family', role: 'boss', joined_at: new Date(at - 3600000).toISOString(), post: null, post_at: null }];
  const after = structuredClone(before);
  after.tables.gang_members.push({ character_id: 'b', gang_id: 'family', role: 'soldier', joined_at: new Date(at).toISOString(), post: null, post_at: null });
  const identity = { context: { authority: 'original-worker', logicalAt: at }, outcome: 'COMMITTED', command: 'COMMIT', transactionId: 1 };
  return { before, after, identity };
}
const run = p => reconcileNpcFamilyRecruitment(p.before, p.after, { identity: p.identity });
const positive = run(fixture());
assert.deepEqual([...positive.memberIds], ['b']); assert.equal(positive.movements.length, 1); assert.equal(positive.movements[0].economicGrant, false);
const target = fixture(); target.after.tables.gang_members[1].gang_id = 'other'; assert.equal(run(target).memberIds.size, 1);
let rejected = 0;
for (const [name, mutate] of [
  ['foreign authority', p => { p.identity.context.authority = 'actor'; }],
  ['rollback', p => { p.identity.outcome = 'ROLLED_BACK'; }],
  ['no transaction', p => { p.identity.transactionId = null; }],
  ['wrong deadline', p => { p.identity.context.logicalAt++; }],
  ['stale membership time', p => { p.after.tables.gang_members[1].joined_at = new Date(at - 1).toISOString(); }],
  ['leader role', p => { p.after.tables.gang_members[1].role = 'boss'; }],
  ['post grant', p => { p.after.tables.gang_members[1].post = 'enforcer'; }],
  ['post timestamp', p => { p.after.tables.gang_members[1].post_at = new Date(at).toISOString(); }],
  ['undeclared member field', p => { p.after.tables.gang_members[1].reward = 1; }],
  ['changed old role', p => { p.after.tables.gang_members[0].role = 'soldier'; }],
  ['changed old owner', p => { p.after.tables.gang_members[0].gang_id = 'other'; }],
  ['member removed', p => { p.after.tables.gang_members.shift(); }],
  ['two new members', p => { p.after.tables.gang_members.push({ ...p.after.tables.gang_members[1], character_id: 'c' }); }],
  ['duplicate member', p => { p.after.tables.gang_members.push(structuredClone(p.after.tables.gang_members[1])); }],
  ['wrong selected NPC', p => { p.after.tables.gang_members[1].character_id = 'c'; }],
  ['already joined', p => { p.after.tables.gang_members[1].character_id = 'a'; }],
  ['non-NPC recruit', p => { for (const state of [p.before, p.after]) state.tables.characters[1].is_npc = false; }],
  ['dead recruit', p => { for (const state of [p.before, p.after]) state.tables.characters[1].alive = false; }],
  ['non-NPC target', p => { for (const state of [p.before, p.after]) state.tables.gangs[0].npc_flag = false; }],
  ['missing target', p => { p.after.tables.gang_members[1].gang_id = 'missing'; }],
  ['not thin', p => { const member = { ...p.before.tables.gang_members[0], character_id: 'c' }; p.before.tables.gang_members.push(member); p.after.tables.gang_members.splice(1, 0, structuredClone(member)); }],
  ['cash changed', p => { p.after.tables.characters[1].cash = '501'; }],
  ['receipt inserted', p => { p.after.tables.transactions.push({ id: 'unearned' }); }],
  ['new Family', p => { p.after.tables.gangs.push({ id: 'new', npc_flag: true }); }],
  ['missing table', p => { delete p.after.tables.loans; }],
  ['outside native LIMIT64', p => {
    const characters = Array.from({ length: 65 }, (_, i) => ({ id: String(i).padStart(3, '0'), alive: true, is_npc: true }));
    const members = characters.slice(0, 64).map(row => ({ ...p.before.tables.gang_members[0], gang_id: 'other', character_id: row.id }));
    for (const state of [p.before, p.after]) state.tables.characters = structuredClone(characters);
    p.before.tables.gang_members = members; p.after.tables.gang_members = [...structuredClone(members), { ...p.after.tables.gang_members[1], character_id: '064' }];
  }],
]) {
  const p = fixture(); mutate(p); let closed = false;
  try { closed = run(p).memberIds.size === 0; } catch (error) { assert.equal(error.name, 'AssertionError', name); closed = true; }
  assert(closed, name); rejected++;
}
const unchanged = fixture(); unchanged.after = structuredClone(unchanged.before); assert.equal(run(unchanged).memberIds.size, 0);
console.log(JSON.stringify({ status: 'PASS_SCOPED_CONTROLS', positiveTransitions: 2, rejected, nativeExecution: false,
  scope: 'Isolated original-worker canonical recruitment state eligibility. Any thin NPC target is allowed because the original Family SELECT is unordered; no retained caller or historical replay claim.' }));
