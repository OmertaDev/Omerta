import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { FIRST_FIVE_ADDITIVE_PAIR as pin,qualifyFirstFiveAdditiveBootstrap,sourcePairStateDifference,sourcePairReviewedTreeHash,ADDITIVE_KNOWLEDGE_OUTPUTS } from '../tools/rc1-source-pair.js';
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

// A separate exact relation: original seven-table identity and negatives above remain unchanged.
const { SECOND_BATCH_ADDITIVE_PAIR: secondPin,qualifySecondBatchAdditiveBootstrap }=await import('../tools/rc1-source-pair.js');
const { EQUIPMENT_ECONOMY_MIGRATION_TABLES }=await import('./lib/equipment-economy-migration-catalog.js');
assert.deepEqual(secondPin.tables,[...EQUIPMENT_ECONOMY_MIGRATION_TABLES].sort());
assert.equal(secondPin.predecessor,'ed903348ee59e354bfae72bfbc2aed8273229bb2');
assert.equal(secondPin.reviewedCandidate,'98004e7f6838ee34445437868154dcc361784c85');
const secondPredecessor={source:secondPin.predecessor,secondBatchAdditiveSource:{tree:secondPin.predecessorTree,schema:secondPin.predecessorSchema,catalog:secondPin.predecessorCatalog}},secondCandidate={source:secondPin.reviewedCandidate,secondBatchAdditiveSource:{tree:secondPin.candidateTree,schema:secondPin.candidateSchema,catalog:secondPin.candidateCatalog,catalogTables:Object.fromEntries(secondPin.tables.map(name=>[name,{constraints:catalog.added.filter(row=>row.table_name===name),notNullColumns:catalog.notNullColumns[name]??null}]))}};
const secondOld={tables:{...old.tables,unknown_existing_custody:['{"owner":"original","reserved":3}']},sequences:structuredClone(old.sequences)},secondFresh={tables:{...secondOld.tables,...Object.fromEntries(secondPin.tables.map(name=>[name,[]]))},sequences:structuredClone(secondOld.sequences)};
const secondQualified=qualifySecondBatchAdditiveBootstrap(secondOld,secondFresh,secondPredecessor,secondCandidate);
assert.equal(secondQualified.relation,'REVIEWED_FOURTEEN_EMPTY_TABLE_ADDITIVE_BOOTSTRAP');assert.notEqual(secondQualified.beforeNormalizedSha256,secondQualified.afterNormalizedSha256);assert.deepEqual(secondQualified.addedEmptyTables,secondPin.tables);
let secondNegatives=0;
const secondNegative=(label,mutate,pattern)=>{const a=structuredClone(secondOld),b=structuredClone(secondFresh),p=structuredClone(secondPredecessor),c=structuredClone(secondCandidate);mutate(a,b,p,c);assert.throws(()=>qualifySecondBatchAdditiveBootstrap(a,b,p,c),pattern,label);secondNegatives++;};
secondNegative('unknown addition',(_a,b)=>{b.tables.unknown_new_authority=[];},/unlisted/);
for(const table of secondPin.tables){secondNegative('each required table missing '+table,(_a,b)=>{delete b.tables[table];},/Missing expected/);secondNegative('each new table populated '+table,(_a,b)=>{b.tables[table]=['{"id":"new-authority"}'];},/not empty/);}
secondNegative('unknown old row changed',(_a,b)=>{b.tables.unknown_existing_custody=['{"owner":"replacement","reserved":3}'];},/row\/table changed/);
secondNegative('unknown old table removed',(_a,b)=>{delete b.tables.unknown_existing_custody;},/removed/);
secondNegative('old row changed',(_a,b)=>{b.tables.accounts=['{"id":"replacement"}'];},/row\/table changed/);
secondNegative('old sequence changed',(_a,b)=>{b.sequences[0].last_value='11';},/Sequence state changed/);
secondNegative('new sequence',(_a,b)=>{b.sequences.push({sequencename:'unreviewed_seq',last_value:null});},/Sequence state changed/);
secondNegative('unrelated candidate source',(_a,_b,_p,c)=>{c.secondBatchAdditiveSource.tree='0'.repeat(64);},/Unrelated source changed/);
secondNegative('wrong predecessor',(_a,_b,p)=>{p.source=pin.predecessor;},/predecessor/);
secondNegative('predecessor schema drift',(_a,_b,p)=>{p.secondBatchAdditiveSource.schema='0'.repeat(64);},/schema definitions/);
secondNegative('candidate schema drift including predicate',(_a,_b,_p,c)=>{c.secondBatchAdditiveSource.schema='0'.repeat(64);},/schema definitions/);
secondNegative('full native catalog drift',(_a,_b,_p,c)=>{c.secondBatchAdditiveSource.catalog='0'.repeat(64);},/catalog differs/);
secondNegative('actual definition drift',(_a,_b,_p,c)=>{c.secondBatchAdditiveSource.catalogTables.contract_auctions.constraints[0].definition='CHECK (true)';},/catalog evidence differs/);
secondNegative('required clock NN missing',(_a,_b,_p,c)=>{c.secondBatchAdditiveSource.catalogTables.service_subscription_cycles.notNullColumns=[];},/catalog evidence differs/);
secondNegative('seven table catalog substituted',(_a,_b,_p,c)=>{c.secondBatchAdditiveSource.catalogTables=structuredClone(candidate.additiveSource.catalogTables);},/catalog evidence differs/);
secondNegative('first identity cannot qualify second',(_a,_b,_p,c)=>{c.additiveSource=c.secondBatchAdditiveSource;delete c.secondBatchAdditiveSource;},/Unrelated source changed/);
assert.throws(()=>qualifyFirstFiveAdditiveBootstrap(secondOld,secondFresh,secondPredecessor,secondCandidate),/predecessor/);
assert.throws(()=>qualifySecondBatchAdditiveBootstrap(old,fresh,predecessor,candidate),/predecessor/);
// New qualification cannot mutate or broaden the historical identity/catalog.
assert.deepEqual(qualifyFirstFiveAdditiveBootstrap(old,fresh,predecessor,candidate),qualified);
for(const file of ['src/equipmentrentals.js','src/social/estate.js','.github/workflows/ci.yml','test/lib/equipment-economy-migration-catalog.js','knowledge/generated/not-listed.md'])assert.notEqual(sourcePairReviewedTreeHash([...sourceRecords,record(file)]),sourceHash,'Second batch grants no new source exclusion');
console.log(`rc1-source-pair-additive SECOND PASS: separate14-empty-table relation, ${secondNegatives} negatives, cross-relation refusal, exact unknown/old rows/sequences/catalog/source and unchanged original7 identity; no populated authority or backing claim`);
