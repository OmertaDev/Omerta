import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { FIRST_FIVE_ADDITIVE_PAIR as pin,CRITIQUE_ECONOMY_ADDITIVE_PAIR as combinedPin,qualifyFirstFiveAdditiveBootstrap,
  qualifyCritiqueEconomyAdditiveBootstrap,qualifyReviewedAdditiveBootstrap,sourcePairStateDifference,sourcePairReviewedTreeHash,ADDITIVE_KNOWLEDGE_OUTPUTS } from '../tools/rc1-source-pair.js';
const catalog=JSON.parse(await fs.readFile(new URL('lib/phase2-architecture-upgrade-catalog.json',import.meta.url),'utf8'));
const predecessor={source:pin.predecessor,additiveSource:{tree:pin.predecessorTree,schema:pin.predecessorSchema,catalog:pin.predecessorCatalog}},candidate={source:pin.reviewedCandidate,additiveSource:{tree:pin.candidateTree,schema:pin.candidateSchema,catalog:pin.candidateCatalog,catalogTables:Object.fromEntries(pin.tables.map(name=>[name,{constraints:catalog.added.filter(row=>row.table_name===name),notNullColumns:catalog.notNullColumns[name]??null}]))}};
const old={tables:{accounts:['{"id":"owned-source-pair-fixture"}'],characters:[],telemetry:[]},sequences:[{sequencename:'item_events_sequence_seq',last_value:'10'}]},fresh={tables:{...old.tables,...Object.fromEntries(pin.tables.map(name=>[name,[]]))},sequences:structuredClone(old.sequences)};
const qualified=qualifyFirstFiveAdditiveBootstrap(old,fresh,predecessor,candidate);assert.equal(qualified.relation,'REVIEWED_SEVEN_EMPTY_TABLE_ADDITIVE_BOOTSTRAP');assert.notEqual(qualified.beforeNormalizedSha256,qualified.afterNormalizedSha256);assert.deepEqual(qualified.addedEmptyTables,pin.tables);assert.deepEqual(sourcePairStateDifference(old,fresh).added,pin.tables);
const negative=(label,mutate,pattern)=>{const left=structuredClone(old),right=structuredClone(fresh),p=structuredClone(predecessor),c=structuredClone(candidate);mutate(left,right,p,c);assert.throws(()=>qualifyFirstFiveAdditiveBootstrap(left,right,p,c),pattern,label);};
negative('unknown table',(_a,b)=>{b.tables.unreviewed_authority=[];},/unlisted/);
negative('missing required table',(_a,b)=>{delete b.tables.item_durability_uses;},/Missing expected/);
negative('populated new authority',(_a,b)=>{b.tables.company_specializations=['{"grant_spent":1}'];},/not empty/);
negative('removed old table',(_a,b)=>{delete b.tables.characters;},/removed/);
negative('changed acknowledged row',(_a,b)=>{b.tables.accounts=['{"id":"replacement"}'];},/row\/table changed/);
negative('changed existing sequence',(_a,b)=>{b.sequences[0].last_value='11';},/Sequence state changed/);
negative('new sequence',(_a,b)=>{b.sequences.push({sequencename:'unexpected_seq',last_value:null});},/Sequence state changed/);
negative('changed unrelated candidate source',(_a,_b,_p,c)=>{c.additiveSource.tree='0'.repeat(64);},/Unrelated source changed/);
negative('changed predecessor source',(_a,_b,p)=>{p.source='1'.repeat(40);},/predecessor/);
negative('changed schema definitions',(_a,_b,_p,c)=>{c.additiveSource.schema='0'.repeat(64);},/schema definitions/);
negative('changed frozen catalog',(_a,_b,_p,c)=>{c.additiveSource.catalog='0'.repeat(64);},/catalog differs/);
negative('changed actual catalog definition evidence',(_a,_b,_p,c)=>{c.additiveSource.catalogTables.item_durability_uses.constraints[0].definition='CHECK (true)';},/catalog evidence differs/);
negative('missing NN evidence',(_a,_b,_p,c)=>{c.additiveSource.catalogTables.item_durability_states.notNullColumns=[];},/catalog evidence differs/);
const sequenceDelta=sourcePairStateDifference(old,{...fresh,sequences:[{sequencename:'item_events_sequence_seq',last_value:'12'}]});assert.deepEqual(sequenceDelta.sequences,['item_events_sequence_seq']);assert.equal(sequenceDelta.sequenceStateEqual,false);
const record = (file, hash = '1'.repeat(40)) => '100644 blob ' + hash + '\t' + file;
const sourceRecords = [record('src/game.js'), record('schema.sql'), record('package.json'), record('test/migrate.js'), record('tools/knowledge.js'), record('test/lib/phase2-architecture-upgrade-catalog.json')];
const sourceHash = sourcePairReviewedTreeHash(sourceRecords);
assert.equal(ADDITIVE_KNOWLEDGE_OUTPUTS.length, 10);
assert.equal(sourcePairReviewedTreeHash([...sourceRecords, ...ADDITIVE_KNOWLEDGE_OUTPUTS.map(file => record(file))]), sourceHash);
assert.notEqual(sourcePairReviewedTreeHash([...sourceRecords, record('knowledge/generated/unreviewed-authority.json')]), sourceHash, 'Unlisted derivative path remains frozen source');
for (const file of ['tools/knowledge.js', 'package.json', 'test/migrate.js', 'test/lib/phase2-architecture-upgrade-catalog.json']) {
  assert.notEqual(sourcePairReviewedTreeHash(sourceRecords.map(line => line.endsWith('\t' + file) ? record(file, '2'.repeat(40)) : line)), sourceHash, 'Generator, package, census and native catalog remain source authority');
}
console.log('rc1-source-pair-additive PASS: exact reviewed seven-empty-table relation; unknown/missing/nonempty/removed/old-row/sequence/unrelated-source/schema/catalog/NN negatives; full raw state remains unequal');

// The combined GUI/gameplay/economy tree has its own closed source and schema
// pins. None of the first-five controls above is replaced by this profile.
assert.match(combinedPin.reviewedCandidate || '', /^[a-f0-9]{40}$/, 'Combined source must be frozen before qualification');
assert.notEqual(combinedPin.candidateTree, pin.candidateTree);
assert.notEqual(combinedPin.candidateSchema, pin.candidateSchema);
assert.equal(combinedPin.candidateCatalog, pin.candidateCatalog);
assert.equal(combinedPin.candidateTableCatalog, pin.candidateTableCatalog);
assert.deepEqual(combinedPin.tables, pin.tables);
const combinedCandidate = { source: combinedPin.reviewedCandidate, additiveSource: {
  tree: combinedPin.candidateTree, schema: combinedPin.candidateSchema, catalog: combinedPin.candidateCatalog,
  catalogTables: structuredClone(candidate.additiveSource.catalogTables),
} };
const combined = qualifyCritiqueEconomyAdditiveBootstrap(old, fresh, predecessor, combinedCandidate);
assert.equal(combined.relation, qualified.relation);
assert.notEqual(combined.beforeNormalizedSha256, combined.afterNormalizedSha256);
assert.deepEqual(combined.addedEmptyTables, combinedPin.tables);
assert.equal(qualifyReviewedAdditiveBootstrap(old, fresh, predecessor, candidate).profile, 'first-five');
assert.equal(qualifyReviewedAdditiveBootstrap(old, fresh, predecessor, combinedCandidate).profile, 'critique-economy');
const combinedNegative = (label, mutate, pattern) => {
  const left = structuredClone(old), right = structuredClone(fresh), p = structuredClone(predecessor), c = structuredClone(combinedCandidate);
  mutate(left, right, p, c);
  assert.throws(() => qualifyCritiqueEconomyAdditiveBootstrap(left, right, p, c), pattern, label);
  assert.throws(() => qualifyReviewedAdditiveBootstrap(left, right, p, c), pattern, 'selected profile: ' + label);
};
combinedNegative('unknown table', (_a, b) => { b.tables.unreviewed_authority = []; }, /unlisted/);
combinedNegative('missing required table', (_a, b) => { delete b.tables.item_durability_uses; }, /Missing expected/);
combinedNegative('populated new authority', (_a, b) => { b.tables.company_specializations = ['{"grant_spent":1}']; }, /not empty/);
combinedNegative('removed old table', (_a, b) => { delete b.tables.characters; }, /removed/);
combinedNegative('changed acknowledged row', (_a, b) => { b.tables.accounts = ['{"id":"replacement"}']; }, /row\/table changed/);
combinedNegative('changed existing sequence', (_a, b) => { b.sequences[0].last_value = '11'; }, /Sequence state changed/);
combinedNegative('new sequence', (_a, b) => { b.sequences.push({ sequencename: 'unexpected_seq', last_value: null }); }, /Sequence state changed/);
combinedNegative('changed unrelated candidate source', (_a, _b, _p, c) => { c.additiveSource.tree = '0'.repeat(64); }, /Unrelated source changed/);
combinedNegative('changed predecessor source', (_a, _b, p) => { p.source = '1'.repeat(40); }, /predecessor/);
combinedNegative('changed schema definitions', (_a, _b, _p, c) => { c.additiveSource.schema = '0'.repeat(64); }, /schema definitions/);
combinedNegative('changed frozen catalog', (_a, _b, _p, c) => { c.additiveSource.catalog = '0'.repeat(64); }, /catalog differs/);
combinedNegative('changed actual catalog definition evidence', (_a, _b, _p, c) => { c.additiveSource.catalogTables.item_durability_uses.constraints[0].definition = 'CHECK (true)'; }, /catalog evidence differs/);
combinedNegative('missing NN evidence', (_a, _b, _p, c) => { c.additiveSource.catalogTables.item_durability_states.notNullColumns = []; }, /catalog evidence differs/);
assert.throws(() => qualifyFirstFiveAdditiveBootstrap(old, fresh, predecessor, combinedCandidate), /Unrelated source changed/);
assert.throws(() => qualifyCritiqueEconomyAdditiveBootstrap(old, fresh, predecessor, candidate), /Unrelated source changed/);
assert.throws(() => qualifyReviewedAdditiveBootstrap(old, fresh, predecessor,
  { ...combinedCandidate, additiveSource: { ...combinedCandidate.additiveSource, tree: pin.candidateTree } }), /schema definitions/);
assert.throws(() => qualifyReviewedAdditiveBootstrap(old, fresh, predecessor,
  { ...candidate, additiveSource: { ...candidate.additiveSource, tree: combinedPin.candidateTree } }), /schema definitions/);
console.log('rc1-source-pair-additive combined PASS: separate exact tree/schema profile; thirteen direct and selected negative controls, crossed-profile rejection, unchanged seven-table catalog/NN proof and unequal raw state');
