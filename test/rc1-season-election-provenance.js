import assert from 'node:assert/strict';
import { canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { ELECTION_SQL, ELECTION_SOURCE_PINS, verifyColdSeasonElection } from '../tools/rc1-season-election-provenance.js';
import { WORLD_RESOURCE_TABLES, reconcileWorldResources } from '../tools/rc1-world-resource-observer.js';
import { levelOf, seasonModOf } from '../src/rules.js';
const cols = [...ELECTION_SQL.standing.matchAll(/COALESCE\(a\.([a-z_]+),0\) AS \1/g)].map(match => match[1]);
const pillars = { blood: 0, empire: 0, power: 0, legit: 0, hustle: 0, honor: 0 };
function fixture(reverse = false) {
  const before = { format: 1, tables: Object.fromEntries(WORLD_RESOURCE_TABLES.map(table => [table, []])) };
  const accounts = ['a', 'b', 'banned', 'npc', 'agent', 'dead'].map(id => ({ id, status: id === 'banned' ? 'banned' : 'active' }));
  for (const { id } of accounts) {
    before.tables.account_persistent.push({ account_id: id, agent_flag: id === 'agent', npc_flag: id === 'npc', ...Object.fromEntries(cols.map(col => [col, 0])),
      season_crowns: 0, omr: '0', staked: '0', unbonding: '0' });
    before.tables.characters.push({ id: 'char-' + id, account_id: id, alive: id !== 'dead', name: 'Name ' + id,
      respect: '0', cash: '500', bank: '0', ammo: 25, cb: 0 });
  }
  const input = (reverse ? ['b', 'a'] : ['a', 'b']).map(id => ({ account_id: id, ...Object.fromEntries(cols.map(col => [col, 0])), name: 'Name ' + id, respect: '0' }));
  const output = input.map(row => ({ accountId: row.account_id, name: row.name, level: levelOf(0), standing: 0, pillars }));
  const candidate = { format: 1, tables: { accounts, account_persistent: structuredClone(before.tables.account_persistent),
    characters: structuredClone(before.tables.characters), districts: [], gangs: [] }, fields: {} };
  for (const [table, rows] of Object.entries(candidate.tables)) candidate.fields[table] = (rows[0] ? Object.keys(rows[0]) : table === 'districts' ? ['id', 'holder_gang'] : ['id'])
    .map(name => ({ name, type: ['respect', 'cash', 'bank', 'omr', 'staked', 'unbonding'].includes(name) ? 1700 : cols.includes(name) || ['ammo', 'cb', 'season_crowns'].includes(name) ? 23 : ['alive', 'agent_flag', 'npc_flag'].includes(name) ? 16 : 25 }));
  const season = 739, top = { rank: 1, name: output[0].name, level: levelOf(0), standing: 0, title: 'Nobody Yet', pillars };
  const parameters = [season, seasonModOf(season).id, output[0].accountId, top.name, null, null, null, null, null];
  const select = (sql, parameters, rows, fields) => ({ sql, parameters, status: 'RETURNED', command: 'SELECT', rowCount: rows.length, rows, fields });
  const boundary = { command: 'INSERT', outcome: 'AUTOCOMMITTED', sqlSha256: sha256(ELECTION_SQL.insert), sequence: 4 };
  const witness = { format: 1, id: 1, sourcePins: ELECTION_SOURCE_PINS, season, logicalAt: Date.parse('2026-09-24T00:00:00Z'),
    before: candidate, after: structuredClone(candidate), scores: [{ input, output }], tops: [top], boundary,
    queries: [select(ELECTION_SQL.standing, [], input, Object.keys(input[0]).map(name => ({ name, type: name === 'respect' ? 1700 : cols.includes(name) ? 23 : 25 }))),
      select(ELECTION_SQL.lookup, [top.name], [{ account_id: output[0].accountId }], [{ name: 'account_id', type: 25 }]),
      select(ELECTION_SQL.districts, [], [], [{ name: 'id', type: 25 }, { name: 'holder_gang', type: 25 }]),
      { sql: ELECTION_SQL.insert, parameters, status: 'RUNNING' }] };
  const after = structuredClone(before); after.tables.season_records.push({ season, mod_id: parameters[1], champion_account: parameters[2], champion_name: parameters[3],
    champion_standing: null, family_gang: null, family_name: null, family_tag: null, family_districts: null, crowned: false, at: '2026-09-24T00:00:00.000Z' });
  return { before, after, witness };
}
const validate = pair => reconcileWorldResources(pair.before, pair.after, { identity: pair.witness.boundary, seasonElectionProvenance: pair.witness });
for (const reverse of [false, true]) {
  const pair = fixture(reverse), result = validate(pair);
  assert.equal(result.unsupported.length, 0); assert.equal(result.seasonCrowns.elections.length, 1);
  assert.equal(result.seasonCrowns.elections[0].accountId, reverse ? 'b' : 'a');
  assert.equal(result.seasonCrowns.elections[0].currencyGrant, false); assert.equal(result.seasonCrowns.movements.length, 0);
}
const rejected = [], unknown = [];
const reject = (label, mutate) => { const pair = fixture(); mutate(pair); assert.throws(() => validate(pair), undefined, label); rejected.push(label); };
const unsupported = (label, mutate) => { const pair = fixture(); mutate(pair); const result = validate(pair);
  assert.equal(result.seasonCrowns.elections.length, 0); assert(result.unsupported.some(row => row.kind === 'season-standing-selection')); unknown.push(label); };
reject('wrong source pin', p => { p.witness.sourcePins = { ...ELECTION_SOURCE_PINS, 'src/standing.js': 'wrong' }; });
reject('wrong native boundary hash', p => { p.witness.boundary.sqlSha256 = 'wrong'; });
reject('wrong command outcome', p => { p.witness.boundary.outcome = 'ROLLED_BACK'; });
reject('changed candidate state', p => { p.witness.after.tables.accounts[0].status = 'banned'; });
reject('changed eligibility status', p => { for (const state of [p.witness.before, p.witness.after]) state.tables.accounts[0].status = 'banned'; });
reject('null status is not SQL eligible', p => { for (const state of [p.witness.before, p.witness.after]) state.tables.accounts[0].status = null; });
reject('missing status column', p => { for (const state of [p.witness.before, p.witness.after]) delete state.tables.accounts[0].status; });
reject('omitted eligible owner', p => { for (const state of [p.witness.before, p.witness.after]) state.tables.accounts = state.tables.accounts.filter(row => row.id !== 'b'); });
reject('duplicate eligible owner', p => { for (const state of [p.witness.before, p.witness.after]) state.tables.accounts.push(structuredClone(state.tables.accounts[0])); });
reject('hidden resource input changed', p => { p.witness.before.tables.characters[0].cash = '501'; p.witness.after.tables.characters[0].cash = '501'; });
reject('missing returned row', p => { p.witness.queries[0].rows = p.witness.queries[0].rows.slice(1); });
reject('duplicate returned row', p => { p.witness.queries[0].rows.push(structuredClone(p.witness.queries[0].rows[0])); });
reject('wrong raw result type', p => { p.witness.queries[0].fields[0].type = 23; });
reject('wrong original tied order', p => { p.witness.scores[0].output.reverse(); });
reject('wrong selected board row', p => { p.witness.tops[0].name = 'Name b'; });
reject('wrong lookup authority', p => { p.witness.queries[1].rows[0].account_id = 'b'; });
reject('wrong lookup parameters', p => { p.witness.queries[1].parameters = ['Name b']; });
reject('wrong district read', p => { p.witness.queries[2].rows = [{ id: 'invented', holder_gang: 'g' }]; p.witness.queries[2].rowCount = 1; });
reject('wrong saved account parameters', p => { p.witness.queries[3].parameters[2] = 'b'; });
reject('wrong persisted owner', p => { p.after.tables.season_records[0].champion_account = 'b'; });
reject('premature crowned latch', p => { p.after.tables.season_records[0].crowned = true; });
reject('wrong recorded standing', p => { p.after.tables.season_records[0].champion_standing = 0; });
reject('record predates input', p => { p.after.tables.season_records[0].at = '2026-09-23T00:00:00Z'; });
reject('compound unrelated mutation', p => { p.after.tables.notifications.push({ id: 'new', character_id: 'char-a', type: 'other', payload: '{}', delivered: false, pushed: false, created_at: '2026-09-24T00:00:00Z' }); });
unsupported('cache hit or shared flight', p => { p.witness.scores = []; p.witness.queries.shift(); });
unsupported('repeated computation', p => { p.witness.scores.push(structuredClone(p.witness.scores[0])); });
unsupported('compound native query', p => { p.witness.queries.splice(1, 0, { sql: 'SELECT 1', status: 'RETURNED', command: 'SELECT', rows: [{ n: 1 }], rowCount: 1, parameters: [], fields: [] }); });
unsupported('nonzero standings', p => { for (const state of [p.before, p.after, p.witness.before, p.witness.after]) state.tables.account_persistent[0][cols[0]] = 1;
  p.witness.queries[0].rows[0][cols[0]] = 1; p.witness.scores[0].input[0][cols[0]] = 1; });
const noProof = fixture(); assert(reconcileWorldResources(noProof.before, noProof.after).unsupported.some(row => row.kind === 'season-standing-selection'));
assert.equal(verifyColdSeasonElection(noProof.before, noProof.after, null), null);
console.log(canonicalJson({ status: 'PASS_SCOPED_CONTROLS', actualNativeExecution: false, rejected: rejected.length, explicitUnsupported: unknown.length,
  tiedOrdersPreserved: 2, scope: 'Pure witness validation only; native original execution is a separate required proof' }));
