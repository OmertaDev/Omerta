import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {nextFiveSourceBaseline} from '../tools/next-five-source-compatibility.js';
import { FIRST_FIVE_ADDITIVE_PAIR as pin,qualifyFirstFiveAdditiveBootstrap,sourcePairStateDifference,sourcePairReviewedTreeHash,ADDITIVE_KNOWLEDGE_OUTPUTS } from '../tools/rc1-source-pair.js';
const catalog=JSON.parse(nextFiveSourceBaseline('test/lib/phase2-architecture-upgrade-catalog.json',await fs.readFile(new URL('lib/phase2-architecture-upgrade-catalog.json',import.meta.url),'utf8')));
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
assert.equal(secondPin.predecessor,'18e28bda62759c4d18aaefea461a407b43c0b62f');
assert.equal(secondPin.reviewedCandidate,'960e5ac8444313fdc2dfcd0930cccbb27dacc1fd');
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

const {THIRD_BATCH_ADDITIVE_PAIR: thirdPin,qualifyThirdBatchAdditiveBootstrap}=await import('../tools/rc1-source-pair.js');
assert.equal(thirdPin.predecessor,'7cd8476ee7cf0b2dba66cb86928f43487cbfaa5f');assert.equal(thirdPin.reviewedCandidate,'9583e8ef4ca71112ff18efb2e74045756d390188');assert.equal(thirdPin.tables.length,16);
const thirdPredecessor={source:thirdPin.predecessor,thirdBatchAdditiveSource:{tree:thirdPin.predecessorTree,schema:thirdPin.predecessorSchema,catalog:thirdPin.predecessorCatalog}},thirdCandidate={source:thirdPin.reviewedCandidate,thirdBatchAdditiveSource:{tree:thirdPin.candidateTree,schema:thirdPin.candidateSchema,catalog:thirdPin.candidateCatalog,catalogTables:Object.fromEntries(thirdPin.tables.map(name=>[name,{constraints:catalog.added.filter(row=>row.table_name===name),notNullColumns:catalog.notNullColumns[name]??null}]))}};
const thirdOld={tables:{...secondOld.tables,...Object.fromEntries([...pin.tables,...secondPin.tables].map(name=>[name,[]]))},sequences:structuredClone(old.sequences)},thirdFresh={tables:{...thirdOld.tables,...Object.fromEntries(thirdPin.tables.map(name=>[name,[]]))},sequences:structuredClone(old.sequences)};
const thirdQualified=qualifyThirdBatchAdditiveBootstrap(thirdOld,thirdFresh,thirdPredecessor,thirdCandidate);assert.equal(thirdQualified.relation,'REVIEWED_SIXTEEN_EMPTY_TABLE_ADDITIVE_BOOTSTRAP');assert.deepEqual(thirdQualified.addedEmptyTables,thirdPin.tables);assert.notEqual(thirdQualified.beforeNormalizedSha256,thirdQualified.afterNormalizedSha256);
let thirdNegatives=0;const thirdNegative=(label,mutate,pattern)=>{const a=structuredClone(thirdOld),b=structuredClone(thirdFresh),p=structuredClone(thirdPredecessor),c=structuredClone(thirdCandidate);mutate(a,b,p,c);assert.throws(()=>qualifyThirdBatchAdditiveBootstrap(a,b,p,c),pattern,label);thirdNegatives++;};
thirdNegative('unknown table',(_a,b)=>{b.tables.new_unreviewed_authority=[];},/unlisted/);
for(const name of thirdPin.tables){thirdNegative('missing '+name,(_a,b)=>{delete b.tables[name];},/snapshot type|Missing expected/);thirdNegative('nonempty '+name,(_a,b)=>{b.tables[name]=['{"consent":true}'];},/not empty/);thirdNegative('invalid table type '+name,(_a,b)=>{b.tables[name]={};},/snapshot type/);thirdNegative('NN missing '+name,(_a,_b,_p,c)=>{c.thirdBatchAdditiveSource.catalogTables[name].notNullColumns=[];},/catalog evidence differs/);for(let i=0;i<thirdCandidate.thirdBatchAdditiveSource.catalogTables[name].constraints.length;i++)thirdNegative('catalog constraint '+name+' '+i,(_a,_b,_p,c)=>{c.thirdBatchAdditiveSource.catalogTables[name].constraints[i].definition='CHECK (true)';},/catalog evidence differs/);}
for(const name of thirdPin.tables)for(let i=0;i<thirdCandidate.thirdBatchAdditiveSource.catalogTables[name].notNullColumns.length;i++)for(const change of ['missing','renamed'])thirdNegative('each NN binding '+name+' '+i+' '+change,(_a,_b,_p,c)=>{const columns=c.thirdBatchAdditiveSource.catalogTables[name].notNullColumns;if(change==='missing')columns.splice(i,1);else columns[i]+='__unknown';},/catalog evidence differs/);
thirdNegative('old table removed',(_a,b)=>{delete b.tables.unknown_existing_custody;},/removed/);thirdNegative('old row changed',(_a,b)=>{b.tables.accounts=['{"id":"replacement"}'];},/row\/table changed/);thirdNegative('sequence changed',(_a,b)=>{b.sequences[0].last_value='11';},/Sequence state changed/);thirdNegative('sequence added',(_a,b)=>{b.sequences.push({sequencename:'unreviewed',last_value:null});},/Sequence state changed/);
for(const field of ['tree','schema','catalog'])for(const side of ['predecessor','candidate'])thirdNegative(side+' '+field,(_a,_b,p,c)=>{(side==='predecessor'?p:c).thirdBatchAdditiveSource[field]='0'.repeat(64);},/source changed|schema definitions|catalog differs/);
thirdNegative('wrong predecessor',(_a,_b,p)=>{p.source=secondPin.predecessor;},/predecessor/);thirdNegative('invalid candidate',(_a,_b,_p,c)=>{c.source='not-a-source';},/source identity/);thirdNegative('second catalog substituted',(_a,_b,_p,c)=>{c.thirdBatchAdditiveSource.catalogTables=structuredClone(secondCandidate.secondBatchAdditiveSource.catalogTables);},/catalog evidence differs/);thirdNegative('second identity cannot qualify',(_a,_b,_p,c)=>{c.secondBatchAdditiveSource=c.thirdBatchAdditiveSource;delete c.thirdBatchAdditiveSource;},/source changed/);
assert.throws(()=>qualifyFirstFiveAdditiveBootstrap(thirdOld,thirdFresh,thirdPredecessor,thirdCandidate),/predecessor/);assert.throws(()=>qualifySecondBatchAdditiveBootstrap(thirdOld,thirdFresh,thirdPredecessor,thirdCandidate),/predecessor/);assert.throws(()=>qualifyThirdBatchAdditiveBootstrap(old,fresh,predecessor,candidate),/predecessor/);assert.throws(()=>qualifyThirdBatchAdditiveBootstrap(secondOld,secondFresh,secondPredecessor,secondCandidate),/predecessor/);assert.deepEqual(qualifyFirstFiveAdditiveBootstrap(old,fresh,predecessor,candidate),qualified);assert.deepEqual(qualifySecondBatchAdditiveBootstrap(secondOld,secondFresh,secondPredecessor,secondCandidate),secondQualified);
for(const file of ['src/workertraining.js','src/social/estate.js','schema.sql','package.json','.github/workflows/ci.yml','test/lib/phase2-architecture-upgrade-catalog.json','knowledge/generated/not-listed.md'])assert.notEqual(sourcePairReviewedTreeHash([...sourceRecords,record(file)]),sourceHash,'Third relation grants no new source exclusion');
console.log('rc1-source-pair-additive THIRD PASS: separate16 empty tables/104constraints/121NN, '+thirdNegatives+' negatives; first7/second14 unchanged, no populated authority/deployed/backing claim');

const {FOURTH_BATCH_ADDITIVE_PAIR: fourthPin,qualifyFourthBatchAdditiveBootstrap}=await import('../tools/rc1-source-pair.js');
assert.equal(fourthPin.predecessor,'fe4a75a8b21fc41fd3d3bc75cf7720612c581463');assert.equal(fourthPin.reviewedCandidate,'8bfd960f62f295cc4022a0f7faa81f22053dacc8');assert.equal(fourthPin.tables.length,13);
const fourthPredecessor={source:fourthPin.predecessor,fourthBatchAdditiveSource:{tree:fourthPin.predecessorTree,schema:fourthPin.predecessorSchema,catalog:fourthPin.predecessorCatalog}},fourthCandidate={source:fourthPin.reviewedCandidate,fourthBatchAdditiveSource:{tree:fourthPin.candidateTree,schema:fourthPin.candidateSchema,catalog:fourthPin.candidateCatalog,catalogTables:Object.fromEntries(fourthPin.tables.map(name=>[name,{constraints:catalog.added.filter(row=>row.table_name===name),notNullColumns:catalog.notNullColumns[name]??null}]))}};
const fourthOld={tables:{...thirdOld.tables,...Object.fromEntries([...pin.tables,...secondPin.tables,...thirdPin.tables].map(name=>[name,[]]))},sequences:structuredClone(old.sequences)},fourthFresh={tables:{...fourthOld.tables,...Object.fromEntries(fourthPin.tables.map(name=>[name,[]]))},sequences:structuredClone(old.sequences)};
const fourthQualified=qualifyFourthBatchAdditiveBootstrap(fourthOld,fourthFresh,fourthPredecessor,fourthCandidate);assert.equal(fourthQualified.relation,'REVIEWED_THIRTEEN_EMPTY_TABLE_ADDITIVE_BOOTSTRAP');assert.deepEqual(fourthQualified.addedEmptyTables,fourthPin.tables);assert.notEqual(fourthQualified.beforeNormalizedSha256,fourthQualified.afterNormalizedSha256);
let fourthNegatives=0;const fourthNegative=(label,mutate,pattern)=>{const a=structuredClone(fourthOld),b=structuredClone(fourthFresh),p=structuredClone(fourthPredecessor),c=structuredClone(fourthCandidate);mutate(a,b,p,c);assert.throws(()=>qualifyFourthBatchAdditiveBootstrap(a,b,p,c),pattern,label);fourthNegatives++;};
fourthNegative('unknown table',(_a,b)=>{b.tables.new_unreviewed_authority=[];},/unlisted/);
for(const name of fourthPin.tables){fourthNegative('missing '+name,(_a,b)=>{delete b.tables[name];},/snapshot type|Missing expected/);fourthNegative('nonempty '+name,(_a,b)=>{b.tables[name]=['{"consent":true}'];},/not empty/);fourthNegative('invalid table type '+name,(_a,b)=>{b.tables[name]={};},/snapshot type/);fourthNegative('NN missing '+name,(_a,_b,_p,c)=>{c.fourthBatchAdditiveSource.catalogTables[name].notNullColumns=[];},/catalog evidence differs/);for(let i=0;i<fourthCandidate.fourthBatchAdditiveSource.catalogTables[name].constraints.length;i++)fourthNegative('catalog constraint '+name+' '+i,(_a,_b,_p,c)=>{c.fourthBatchAdditiveSource.catalogTables[name].constraints[i].definition='CHECK (true)';},/catalog evidence differs/);}
for(const name of fourthPin.tables)for(let i=0;i<fourthCandidate.fourthBatchAdditiveSource.catalogTables[name].notNullColumns.length;i++)for(const change of ['missing','renamed'])fourthNegative('each NN binding '+name+' '+i+' '+change,(_a,_b,_p,c)=>{const columns=c.fourthBatchAdditiveSource.catalogTables[name].notNullColumns;if(change==='missing')columns.splice(i,1);else columns[i]+='__unknown';},/catalog evidence differs/);
fourthNegative('old table removed',(_a,b)=>{delete b.tables.unknown_existing_custody;},/removed/);fourthNegative('old row changed',(_a,b)=>{b.tables.accounts=['{"id":"replacement"}'];},/row\/table changed/);fourthNegative('sequence changed',(_a,b)=>{b.sequences[0].last_value='11';},/Sequence state changed/);fourthNegative('sequence added',(_a,b)=>{b.sequences.push({sequencename:'unreviewed',last_value:null});},/Sequence state changed/);
for(const field of ['tree','schema','catalog'])for(const side of ['predecessor','candidate'])fourthNegative(side+' '+field,(_a,_b,p,c)=>{(side==='predecessor'?p:c).fourthBatchAdditiveSource[field]='0'.repeat(64);},/source changed|schema definitions|catalog differs/);
fourthNegative('wrong predecessor',(_a,_b,p)=>{p.source=secondPin.predecessor;},/predecessor/);fourthNegative('invalid candidate',(_a,_b,_p,c)=>{c.source='not-a-source';},/source identity/);fourthNegative('second catalog substituted',(_a,_b,_p,c)=>{c.fourthBatchAdditiveSource.catalogTables=structuredClone(secondCandidate.secondBatchAdditiveSource.catalogTables);},/catalog evidence differs/);fourthNegative('second identity cannot qualify',(_a,_b,_p,c)=>{c.secondBatchAdditiveSource=c.fourthBatchAdditiveSource;delete c.fourthBatchAdditiveSource;},/source changed/);
assert.throws(()=>qualifyFirstFiveAdditiveBootstrap(fourthOld,fourthFresh,fourthPredecessor,fourthCandidate),/predecessor/);assert.throws(()=>qualifySecondBatchAdditiveBootstrap(fourthOld,fourthFresh,fourthPredecessor,fourthCandidate),/predecessor/);assert.throws(()=>qualifyFourthBatchAdditiveBootstrap(old,fresh,predecessor,candidate),/predecessor/);assert.throws(()=>qualifyFourthBatchAdditiveBootstrap(secondOld,secondFresh,secondPredecessor,secondCandidate),/predecessor/);assert.deepEqual(qualifyFirstFiveAdditiveBootstrap(old,fresh,predecessor,candidate),qualified);assert.deepEqual(qualifySecondBatchAdditiveBootstrap(secondOld,secondFresh,secondPredecessor,secondCandidate),secondQualified);
for(const file of ['src/workertraining.js','src/social/estate.js','schema.sql','package.json','.github/workflows/ci.yml','test/lib/phase2-architecture-upgrade-catalog.json','knowledge/generated/not-listed.md'])assert.notEqual(sourcePairReviewedTreeHash([...sourceRecords,record(file)]),sourceHash,'Fourth relation grants no new source exclusion');
console.log('rc1-source-pair-additive FOURTH PASS: separate13 empty tables/132constraints/114NN, '+fourthNegatives+' negatives; first7/second14/third16 unchanged, no populated authority/deployed/backing claim');

for(const name of fourthPin.tables)for(let i=0;i<fourthCandidate.fourthBatchAdditiveSource.catalogTables[name].constraints.length;i++)for(const field of ['constraint_type','constraint_name','table_name'])fourthNegative('each definition metadata '+name+' '+i+' '+field,(_a,_b,_p,c)=>{c.fourthBatchAdditiveSource.catalogTables[name].constraints[i][field]='unreviewed';},/catalog evidence differs/);
assert.throws(()=>qualifyThirdBatchAdditiveBootstrap(fourthOld,fourthFresh,fourthPredecessor,fourthCandidate),/predecessor/);assert.throws(()=>qualifyFourthBatchAdditiveBootstrap(thirdOld,thirdFresh,thirdPredecessor,thirdCandidate),/predecessor/);
fourthNegative('third catalog substituted',(_a,_b,_p,c)=>{c.fourthBatchAdditiveSource.catalogTables=structuredClone(thirdCandidate.thirdBatchAdditiveSource.catalogTables);},/catalog evidence differs/);
fourthNegative('third identity cannot qualify fourth',(_a,_b,_p,c)=>{c.thirdBatchAdditiveSource=c.fourthBatchAdditiveSource;delete c.fourthBatchAdditiveSource;},/source changed/);
assert.deepEqual(qualifyFirstFiveAdditiveBootstrap(old,fresh,predecessor,candidate),qualified);assert.deepEqual(qualifySecondBatchAdditiveBootstrap(secondOld,secondFresh,secondPredecessor,secondCandidate),secondQualified);assert.deepEqual(qualifyThirdBatchAdditiveBootstrap(thirdOld,thirdFresh,thirdPredecessor,thirdCandidate),thirdQualified);
console.log('rc1-source-pair-additive FOURTH COMPLETE PASS: '+fourthNegatives+' negatives + cross-profile controls; exact132definition/114NN evidence; old three profiles/exclusions unchanged; no populated or deployed authority');

fourthNegative('sequence removed',(_a,b)=>{b.sequences=[];},/Sequence state changed/);
assert.equal(fourthNegatives,826);
console.log('rc1-source-pair-additive FOURTH FINAL PASS: '+fourthNegatives+' negatives; all three original profiles and every unknown/old row/sequence remain exact');

// The current main branch has additional gateway/legal work. Its separate exact
// source relation retains that work and the four historical qualification pins.
const { COMMERCIAL_MAIN_ADDITIVE_PAIR: commercialMainPin, qualifyCommercialMainAdditiveBootstrap } = await import('../tools/rc1-source-pair.js');
assert.equal(commercialMainPin.predecessor, '23f115c6f142321e1796e272bea406e1feb137ba');
assert.deepEqual(commercialMainPin.tables, fourthPin.tables);
const commercialMainPredecessor = structuredClone(fourthPredecessor);
const commercialMainCandidate = structuredClone(fourthCandidate);
commercialMainPredecessor.source = commercialMainPin.predecessor;
commercialMainCandidate.source = commercialMainPin.reviewedCandidate;
for (const [identity, side] of [[commercialMainPredecessor, 'predecessor'], [commercialMainCandidate, 'candidate']])
  for (const field of ['tree', 'schema', 'catalog'])
    identity.fourthBatchAdditiveSource[field] = commercialMainPin[side + field[0].toUpperCase() + field.slice(1)];
const commercialMainQualified = qualifyCommercialMainAdditiveBootstrap(fourthOld, fourthFresh, commercialMainPredecessor, commercialMainCandidate);
assert.equal(commercialMainQualified.relation, 'REVIEWED_COMMERCIAL_MAIN_THIRTEEN_EMPTY_TABLE_ADDITIVE_BOOTSTRAP');
let commercialMainNegatives = 0;
const commercialMainNegative = mutate => {
  const a = structuredClone(fourthOld), b = structuredClone(fourthFresh);
  const p = structuredClone(commercialMainPredecessor), c = structuredClone(commercialMainCandidate);
  mutate(a, b, p, c);
  assert.throws(() => qualifyCommercialMainAdditiveBootstrap(a, b, p, c));
  commercialMainNegatives++;
};
for (const table of commercialMainPin.tables) {
  commercialMainNegative((_a, b) => { delete b.tables[table]; });
  commercialMainNegative((_a, b) => { b.tables[table] = ['{"unreviewed":true}']; });
  for (let i = 0; i < commercialMainCandidate.fourthBatchAdditiveSource.catalogTables[table].constraints.length; i++)
    commercialMainNegative((_a, _b, _p, c) => { c.fourthBatchAdditiveSource.catalogTables[table].constraints[i].definition = 'CHECK (true)'; });
  for (let i = 0; i < commercialMainCandidate.fourthBatchAdditiveSource.catalogTables[table].notNullColumns.length; i++)
    commercialMainNegative((_a, _b, _p, c) => { c.fourthBatchAdditiveSource.catalogTables[table].notNullColumns.splice(i, 1); });
}
for (const field of ['tree', 'schema', 'catalog']) for (const side of ['predecessor', 'candidate'])
  commercialMainNegative((_a, _b, p, c) => { (side === 'predecessor' ? p : c).fourthBatchAdditiveSource[field] = '0'.repeat(64); });
commercialMainNegative((_a, b) => { b.tables.unreviewed_authority = []; });
commercialMainNegative((_a, b) => { b.tables.accounts = ['{"replacement":true}']; });
commercialMainNegative((_a, b) => { delete b.tables.unknown_existing_custody; });
commercialMainNegative((_a, b) => { b.sequences[0].last_value = '11'; });
commercialMainNegative((_a, _b, p) => { p.source = fourthPin.predecessor; });
commercialMainNegative((_a, _b, _p, c) => { c.source = 'unknown'; });
assert.throws(() => qualifyFourthBatchAdditiveBootstrap(fourthOld, fourthFresh, commercialMainPredecessor, commercialMainCandidate));
assert.throws(() => qualifyCommercialMainAdditiveBootstrap(fourthOld, fourthFresh, fourthPredecessor, fourthCandidate));
assert.deepEqual(qualifyFourthBatchAdditiveBootstrap(fourthOld, fourthFresh, fourthPredecessor, fourthCandidate), fourthQualified);
console.log(`rc1-source-pair additive commercial/main: ${commercialMainNegatives} rejecting controls; four historical profiles unchanged`);
const { SOURCE_PAIR_COMMAND_WINDOW: clockPolicy, sourcePairCommandWindow, waitForSourcePairCommandWindow, assertSourcePairCommandWindow } = await import('../tools/rc1-source-pair.js');
assert.deepEqual(clockPolicy,{periodMs:600000,minimumCampaignMs:240000,schedulingHeadroomMs:30000,waitSliceMs:30000});
assert.equal(sourcePairCommandWindow(330000).ready,true);
assert.equal(sourcePairCommandWindow(330001).ready,false);
assert.equal(sourcePairCommandWindow(600000).remainingMs,600000);
for(const at of[-1,NaN,Infinity,0.5])assert.throws(()=>sourcePairCommandWindow(at),/Invalid/);
let simulatedNow=599999;const waits=[];
const scheduled=await waitForSourcePairCommandWindow({now:()=>simulatedNow,sleep:async ms=>{waits.push(ms);simulatedNow+=ms;}});
assert.deepEqual(waits,[1]);assert.equal(scheduled.scheduledExpiresAt,new Date(1200000).toISOString());
simulatedNow=330001;waits.length=0;
await waitForSourcePairCommandWindow({now:()=>simulatedNow,sleep:async ms=>{waits.push(ms);simulatedNow+=ms;}});
assert(waits.every(ms=>ms>0&&ms<=30000));assert.equal(waits.reduce((a,b)=>a+b,0),269999);
await assert.rejects(waitForSourcePairCommandWindow({now:()=>599999,sleep:async()=>{throw Error('human interruption');}}),/human interruption/);
const actualDeadline=new Date(600000).toISOString();assert.equal(assertSourcePairCommandWindow(actualDeadline,599999,'before').remainingMs,1);
assert.throws(()=>assertSourcePairCommandWindow(actualDeadline,600000,'boundary'),/expired/);
assert.throws(()=>assertSourcePairCommandWindow(actualDeadline,600001,'after'),/expired/);
assert.throws(()=>assertSourcePairCommandWindow('invalid',0,'invalid'),/Invalid/);
negative('expired-window added board remains a strict old-table change',(a,b)=>{a.tables.player_command_boards=['{"id":"old","expires_at":"old"}'];b.tables.player_command_boards=[...a.tables.player_command_boards,'{"id":"fresh","expires_at":"new"}'];},/row\/table changed/);
secondNegative('clock metadata never normalizes a new projection',(a,b)=>{a.tables.player_command_boards=['{"id":"old","expires_at":"old"}'];b.tables.player_command_boards=[...a.tables.player_command_boards,'{"id":"fresh","expires_at":"new"}'];},/row\/table changed/);
console.log('rc1-source-pair timing PASS: real-window scheduler bounds, exact boundary refusal, interrupt propagation, strict new-cache-row refusal in both historical relations; no runtime clock or TTL override');

const {FIFTH_BATCH_ADDITIVE_PAIR: fifthPin,qualifyFifthBatchAdditiveBootstrap}=await import('../tools/rc1-source-pair.js');
assert.equal(fifthPin.predecessor,'0c72a29748df6b1c6955ebcb648efe5f20fec6a1');assert.equal(fifthPin.reviewedCandidate,'94ae0cf067939d05e18f997aef7ddd7b3fd18615');assert.equal(fifthPin.tables.length,17);
const fifthPredecessor={source:fifthPin.predecessor,fifthBatchAdditiveSource:{tree:fifthPin.predecessorTree,schema:fifthPin.predecessorSchema,catalog:fifthPin.predecessorCatalog}},fifthCandidate={source:fifthPin.reviewedCandidate,fifthBatchAdditiveSource:{tree:fifthPin.candidateTree,schema:fifthPin.candidateSchema,catalog:fifthPin.candidateCatalog,catalogTables:Object.fromEntries(fifthPin.tables.map(name=>[name,{constraints:catalog.added.filter(row=>row.table_name===name),notNullColumns:catalog.notNullColumns[name]??null}]))}};
const fifthOld=structuredClone(fourthFresh),fifthFresh={tables:{...fifthOld.tables,...Object.fromEntries(fifthPin.tables.map(name=>[name,[]]))},sequences:structuredClone(old.sequences)};
const fifthQualified=qualifyFifthBatchAdditiveBootstrap(fifthOld,fifthFresh,fifthPredecessor,fifthCandidate);assert.equal(fifthQualified.relation,'REVIEWED_SEVENTEEN_EMPTY_TABLE_ADDITIVE_BOOTSTRAP');assert.deepEqual(fifthQualified.addedEmptyTables,fifthPin.tables);assert.notEqual(fifthQualified.beforeNormalizedSha256,fifthQualified.afterNormalizedSha256);
let fifthNegatives=0;const fifthNegative=(label,mutate,pattern)=>{const a=structuredClone(fifthOld),b=structuredClone(fifthFresh),p=structuredClone(fifthPredecessor),c=structuredClone(fifthCandidate);mutate(a,b,p,c);assert.throws(()=>qualifyFifthBatchAdditiveBootstrap(a,b,p,c),pattern,label);fifthNegatives++;};
fifthNegative('unknown table',(_a,b)=>{b.tables.new_unreviewed_authority=[];},/unlisted/);
for(const name of fifthPin.tables){fifthNegative('missing '+name,(_a,b)=>{delete b.tables[name];},/snapshot type|Missing expected/);fifthNegative('nonempty '+name,(_a,b)=>{b.tables[name]=['{"consent":true}'];},/not empty/);fifthNegative('invalid table type '+name,(_a,b)=>{b.tables[name]={};},/snapshot type/);fifthNegative('NN missing '+name,(_a,_b,_p,c)=>{c.fifthBatchAdditiveSource.catalogTables[name].notNullColumns=[];},/catalog evidence differs/);for(let i=0;i<fifthCandidate.fifthBatchAdditiveSource.catalogTables[name].constraints.length;i++)fifthNegative('catalog constraint '+name+' '+i,(_a,_b,_p,c)=>{c.fifthBatchAdditiveSource.catalogTables[name].constraints[i].definition='CHECK (true)';},/catalog evidence differs/);}
for(const name of fifthPin.tables)for(let i=0;i<fifthCandidate.fifthBatchAdditiveSource.catalogTables[name].notNullColumns.length;i++)for(const change of ['missing','renamed'])fifthNegative('each NN binding '+name+' '+i+' '+change,(_a,_b,_p,c)=>{const columns=c.fifthBatchAdditiveSource.catalogTables[name].notNullColumns;if(change==='missing')columns.splice(i,1);else columns[i]+='__unknown';},/catalog evidence differs/);
fifthNegative('old table removed',(_a,b)=>{delete b.tables.unknown_existing_custody;},/removed/);fifthNegative('old row changed',(_a,b)=>{b.tables.accounts=['{"id":"replacement"}'];},/row\/table changed/);fifthNegative('sequence changed',(_a,b)=>{b.sequences[0].last_value='11';},/Sequence state changed/);fifthNegative('sequence added',(_a,b)=>{b.sequences.push({sequencename:'unreviewed',last_value:null});},/Sequence state changed/);
for(const field of ['tree','schema','catalog'])for(const side of ['predecessor','candidate'])fifthNegative(side+' '+field,(_a,_b,p,c)=>{(side==='predecessor'?p:c).fifthBatchAdditiveSource[field]='0'.repeat(64);},/source changed|schema definitions|catalog differs/);
fifthNegative('wrong predecessor',(_a,_b,p)=>{p.source=secondPin.predecessor;},/predecessor/);fifthNegative('invalid candidate',(_a,_b,_p,c)=>{c.source='not-a-source';},/source identity/);fifthNegative('second catalog substituted',(_a,_b,_p,c)=>{c.fifthBatchAdditiveSource.catalogTables=structuredClone(secondCandidate.secondBatchAdditiveSource.catalogTables);},/catalog evidence differs/);fifthNegative('second identity cannot qualify',(_a,_b,_p,c)=>{c.secondBatchAdditiveSource=c.fifthBatchAdditiveSource;delete c.fifthBatchAdditiveSource;},/source changed/);
assert.throws(()=>qualifyFirstFiveAdditiveBootstrap(fifthOld,fifthFresh,fifthPredecessor,fifthCandidate),/predecessor/);assert.throws(()=>qualifySecondBatchAdditiveBootstrap(fifthOld,fifthFresh,fifthPredecessor,fifthCandidate),/predecessor/);assert.throws(()=>qualifyFifthBatchAdditiveBootstrap(old,fresh,predecessor,candidate),/predecessor/);assert.throws(()=>qualifyFifthBatchAdditiveBootstrap(secondOld,secondFresh,secondPredecessor,secondCandidate),/predecessor/);assert.deepEqual(qualifyFirstFiveAdditiveBootstrap(old,fresh,predecessor,candidate),qualified);assert.deepEqual(qualifySecondBatchAdditiveBootstrap(secondOld,secondFresh,secondPredecessor,secondCandidate),secondQualified);
for(const file of ['src/workertraining.js','src/social/estate.js','schema.sql','package.json','.github/workflows/ci.yml','test/lib/phase2-architecture-upgrade-catalog.json','knowledge/generated/not-listed.md'])assert.notEqual(sourcePairReviewedTreeHash([...sourceRecords,record(file)]),sourceHash,'Fifth relation grants no new source exclusion');
console.log('rc1-source-pair-additive FIFTH PASS: separate17 empty tables/105constraints/152NN, '+fifthNegatives+' negatives; first7/second14/third16 unchanged, no populated authority/deployed/backing claim');

for(const name of fifthPin.tables)for(let i=0;i<fifthCandidate.fifthBatchAdditiveSource.catalogTables[name].constraints.length;i++)for(const field of ['constraint_type','constraint_name','table_name'])fifthNegative('each definition metadata '+name+' '+i+' '+field,(_a,_b,_p,c)=>{c.fifthBatchAdditiveSource.catalogTables[name].constraints[i][field]='unreviewed';},/catalog evidence differs/);
assert.throws(()=>qualifyThirdBatchAdditiveBootstrap(fifthOld,fifthFresh,fifthPredecessor,fifthCandidate),/predecessor/);assert.throws(()=>qualifyFifthBatchAdditiveBootstrap(thirdOld,thirdFresh,thirdPredecessor,thirdCandidate),/predecessor/);
fifthNegative('third catalog substituted',(_a,_b,_p,c)=>{c.fifthBatchAdditiveSource.catalogTables=structuredClone(thirdCandidate.thirdBatchAdditiveSource.catalogTables);},/catalog evidence differs/);
fifthNegative('third identity cannot qualify fifth',(_a,_b,_p,c)=>{c.thirdBatchAdditiveSource=c.fifthBatchAdditiveSource;delete c.fifthBatchAdditiveSource;},/source changed/);
assert.deepEqual(qualifyFirstFiveAdditiveBootstrap(old,fresh,predecessor,candidate),qualified);assert.deepEqual(qualifySecondBatchAdditiveBootstrap(secondOld,secondFresh,secondPredecessor,secondCandidate),secondQualified);assert.deepEqual(qualifyThirdBatchAdditiveBootstrap(thirdOld,thirdFresh,thirdPredecessor,thirdCandidate),thirdQualified);
console.log('rc1-source-pair-additive FIFTH COMPLETE PASS: '+fifthNegatives+' negatives + cross-profile controls; exact105definition/152NN evidence; old three profiles/exclusions unchanged; no populated or deployed authority');

fifthNegative('sequence removed',(_a,b)=>{b.sequences=[];},/Sequence state changed/);
assert.equal(fifthNegatives,810);
console.log('rc1-source-pair-additive FIFTH FINAL PASS: '+fifthNegatives+' negatives; all three original profiles and every unknown/old row/sequence remain exact');
// Actual frozen Git blobs, not catalog expectations learned from a live database.
const {execFileSync: gitProof}=await import('node:child_process');
const {sha256: hashProof,canonicalJson: jsonProof}=await import('../tools/rc1-native-proof.js');
for(const[revision,prefix]of[[fifthPin.predecessor,'predecessor'],[fifthPin.reviewedCandidate,'candidate']]){
 const records=gitProof('git',['ls-tree','-r','-z',revision],{encoding:'utf8'}).split('\0').filter(Boolean);
 assert.equal(sourcePairReviewedTreeHash(records),fifthPin[prefix+'Tree']);
 for(const[field,file]of[['Schema','schema.sql'],['Catalog','test/lib/phase2-architecture-upgrade-catalog.json']])assert.equal(hashProof(gitProof('git',['show',revision+':'+file])),fifthPin[prefix+field]);
}
assert.equal(catalog.added.length,1153);assert.equal(fifthPin.constraints,105);assert.equal(fifthPin.notNull,152);
assert.equal(hashProof(jsonProof(fifthCandidate.fifthBatchAdditiveSource.catalogTables)),fifthPin.candidateTableCatalog);
for(const name of fifthPin.tables){
 fifthNegative('catalog table absent '+name,(_a,_b,_p,c)=>{delete c.fifthBatchAdditiveSource.catalogTables[name];},/catalog evidence differs/);
 fifthNegative('extra NN '+name,(_a,_b,_p,c)=>{c.fifthBatchAdditiveSource.catalogTables[name].notNullColumns.push('unreviewed');},/catalog evidence differs/);
 for(let i=0;i<fifthCandidate.fifthBatchAdditiveSource.catalogTables[name].constraints.length;i++){
  fifthNegative('actual constraint name '+name+' '+i,(_a,_b,_p,c)=>{c.fifthBatchAdditiveSource.catalogTables[name].constraints[i].name+='__unreviewed';},/catalog evidence differs/);
  fifthNegative('constraint removed '+name+' '+i,(_a,_b,_p,c)=>{c.fifthBatchAdditiveSource.catalogTables[name].constraints.splice(i,1);},/catalog evidence differs/);
  fifthNegative('constraint duplicated '+name+' '+i,(_a,_b,_p,c)=>{c.fifthBatchAdditiveSource.catalogTables[name].constraints.push(c.fifthBatchAdditiveSource.catalogTables[name].constraints[i]);},/catalog evidence differs/);
 }
}
fifthNegative('fourth catalog substituted',(_a,_b,_p,c)=>{c.fifthBatchAdditiveSource.catalogTables=structuredClone(fourthCandidate.fourthBatchAdditiveSource.catalogTables);},/catalog evidence differs/);
fifthNegative('fourth identity cannot qualify fifth',(_a,_b,_p,c)=>{c.fourthBatchAdditiveSource=c.fifthBatchAdditiveSource;delete c.fifthBatchAdditiveSource;},/source changed/);
assert.throws(()=>qualifyFourthBatchAdditiveBootstrap(fifthOld,fifthFresh,fifthPredecessor,fifthCandidate),/predecessor/);
assert.throws(()=>qualifyFifthBatchAdditiveBootstrap(fourthOld,fourthFresh,fourthPredecessor,fourthCandidate),/predecessor/);
assert.deepEqual(qualifyFourthBatchAdditiveBootstrap(fourthOld,fourthFresh,fourthPredecessor,fourthCandidate),fourthQualified);
for(const file of ['src/managementteamautonomy.js','src/fundedworkescrowadapter.js','omerta-contracts/src/market-v2/OmertaWorkEscrowV2.sol','schema.sql','package.json','.github/workflows/ci.yml','test/lib/phase2-architecture-upgrade-catalog.json','knowledge/generated/not-listed.md'])assert.notEqual(sourcePairReviewedTreeHash([...sourceRecords,record(file)]),sourceHash,'Fifth grants no new source exclusion');
fifthNegative('unknown old row changed',(_a,b)=>{b.tables.unknown_existing_custody=['{"id":"changed"}'];},/row\/table changed/);
fifthNegative('unknown empty catalog table',(_a,_b,_p,c)=>{c.fifthBatchAdditiveSource.catalogTables.unreviewed={constraints:[],notNullColumns:[]};},/catalog evidence differs/);
console.log('rc1-source-pair-additive FIFTH COMPLETE FINAL PASS: '+fifthNegatives+' negatives plus actual Git tree/schema/catalog pins and cross-profile/source-exclusion controls; no native or deployed qualification');

// A distinct relation retains current main and the reviewed commercial candidate.
// The five earlier relations and their exact predecessor identities remain closed.
{
  const { AUTONOMY_MAIN_ADDITIVE_PAIR: pin, qualifyAutonomyMainAdditiveBootstrap: qualify } = await import('../tools/rc1-source-pair.js');
  const git = (...args) => gitProof('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  assert.equal(pin.predecessor, 'f976dd8722085fa3d2746cf0e60dd943cab571ba');
  assert.deepEqual(pin.tables, fifthPin.tables);
  const p = structuredClone(fifthPredecessor), c = structuredClone(fifthCandidate);
  p.source = pin.predecessor; c.source = pin.reviewedCandidate;
  for (const [identity, side] of [[p, 'predecessor'], [c, 'candidate']]) {
    for (const field of ['tree', 'schema', 'catalog'])
      identity.fifthBatchAdditiveSource[field] = pin[side + field[0].toUpperCase() + field.slice(1)];
    const revision = side === 'predecessor' ? pin.predecessor : pin.reviewedCandidate;
    const records = git('ls-tree', '-r', '-z', revision).split('\0').filter(Boolean);
    assert.equal(sourcePairReviewedTreeHash(records), pin[side + 'Tree']);
    assert.equal(hashProof(git('show', revision + ':schema.sql')), pin[side + 'Schema']);
    assert.equal(hashProof(git('show', revision + ':test/lib/phase2-architecture-upgrade-catalog.json')), pin[side + 'Catalog']);
  }
  assert.equal(qualify(fifthOld, fifthFresh, p, c).relation, 'REVIEWED_AUTONOMY_MAIN_SEVENTEEN_EMPTY_TABLE_ADDITIVE_BOOTSTRAP');
  let negatives = 0;
  const reject = mutate => {
    const a = structuredClone(fifthOld), b = structuredClone(fifthFresh);
    const before = structuredClone(p), after = structuredClone(c);
    mutate(a, b, before, after); assert.throws(() => qualify(a, b, before, after)); negatives++;
  };
  for (const name of pin.tables) {
    reject((_a, b) => { delete b.tables[name]; });
    reject((_a, b) => { b.tables[name] = {}; });
    reject((_a, b) => { b.tables[name] = ['{"unreviewed":true}']; });
    const evidence = c.fifthBatchAdditiveSource.catalogTables[name];
    for (let i = 0; i < evidence.constraints.length; i++)
      for (const field of ['definition', 'constraint_type', 'constraint_name', 'table_name'])
        reject((_a, _b, _p, c) => { c.fifthBatchAdditiveSource.catalogTables[name].constraints[i][field] = 'unreviewed'; });
    for (let i = 0; i < evidence.notNullColumns.length; i++) for (const change of ['missing', 'renamed'])
      reject((_a, _b, _p, c) => {
        const columns = c.fifthBatchAdditiveSource.catalogTables[name].notNullColumns;
        if (change === 'missing') columns.splice(i, 1); else columns[i] += '__unknown';
      });
  }
  for (const field of ['tree', 'schema', 'catalog']) for (const side of ['predecessor', 'candidate'])
    reject((_a, _b, p, c) => { (side === 'predecessor' ? p : c).fifthBatchAdditiveSource[field] = '0'.repeat(64); });
  reject((_a, b) => { b.tables.unreviewed_authority = []; });
  reject((_a, b) => { b.tables.accounts = ['{"replacement":true}']; });
  reject((_a, b) => { b.tables.unknown_existing_custody = ['{"replacement":true}']; });
  reject((_a, b) => { delete b.tables.unknown_existing_custody; });
  reject((_a, b) => { b.sequences[0].last_value = '11'; });
  reject((_a, b) => { b.sequences.push({ sequencename: 'unreviewed', last_value: null }); });
  reject((_a, _b, p) => { p.source = fifthPin.predecessor; });
  reject((_a, _b, _p, c) => { c.source = 'unknown'; });
  reject((_a, _b, _p, c) => { c.fifthBatchAdditiveSource.catalogTables.unreviewed = { constraints: [], notNullColumns: [] }; });
  assert.throws(() => qualifyFifthBatchAdditiveBootstrap(fifthOld, fifthFresh, p, c));
  assert.throws(() => qualify(fifthOld, fifthFresh, fifthPredecessor, fifthCandidate));
  assert.deepEqual(qualifyFifthBatchAdditiveBootstrap(fifthOld, fifthFresh, fifthPredecessor, fifthCandidate), fifthQualified);
  console.log(`rc1-source-pair autonomy/main: ${negatives} rejecting controls; five historical profiles unchanged; empty-bootstrap evidence only`);
}

// The next thirty's first five add exactly eleven empty tables. This does not
// change any historical profile or the three-QA/ten-derivative exclusion set.
{
  const {NEXT_THIRTY_FIRST_FIVE_ADDITIVE_PAIR:pin,qualifyNextThirtyFirstFiveAdditiveBootstrap:qualify} = await import('../tools/rc1-source-pair.js');
  const git=(...args)=>gitProof('git',args,{encoding:'utf8',maxBuffer:32*1024*1024});
  const catalog=JSON.parse(git('show',pin.reviewedCandidate+':test/lib/phase2-architecture-upgrade-catalog.json'));
  const catalogTables=Object.fromEntries(pin.tables.map(name=>[name,{constraints:catalog.added.filter(row=>row.table_name===name),notNullColumns:catalog.notNullColumns[name]}]));
  assert.equal(pin.tables.length,11);assert.equal(pin.constraints,90);assert.equal(pin.notNull,90);
  const p={source:pin.predecessor,nextThirtyFirstFiveAdditiveSource:{}},c={source:pin.reviewedCandidate,nextThirtyFirstFiveAdditiveSource:{catalogTables}};
  for(const[identity,side]of[[p,'predecessor'],[c,'candidate']]){
    const revision=side==='predecessor'?pin.predecessor:pin.reviewedCandidate;
    for(const field of['tree','schema','catalog'])identity.nextThirtyFirstFiveAdditiveSource[field]=pin[side+field[0].toUpperCase()+field.slice(1)];
    assert.equal(sourcePairReviewedTreeHash(git('ls-tree','-r','-z',revision).split('\0').filter(Boolean)),pin[side+'Tree']);
    assert.equal(hashProof(git('show',revision+':schema.sql')),pin[side+'Schema']);
    assert.equal(hashProof(git('show',revision+':test/lib/phase2-architecture-upgrade-catalog.json')),pin[side+'Catalog']);
  }
  const before=structuredClone(fifthFresh),after=structuredClone(before);
  for(const name of pin.tables){assert(!Object.hasOwn(before.tables,name));after.tables[name]=[];}
  assert.equal(qualify(before,after,p,c).relation,'REVIEWED_NEXT_THIRTY_FIRST_ELEVEN_EMPTY_TABLE_ADDITIVE_BOOTSTRAP');
  let negatives=0;
  const reject=mutate=>{
    const a=structuredClone(before),b=structuredClone(after),previous=structuredClone(p),current=structuredClone(c);
    mutate(a,b,previous,current);assert.throws(()=>qualify(a,b,previous,current));negatives++;
  };
  for(const name of pin.tables){
    reject((_a,b)=>{delete b.tables[name];});reject((_a,b)=>{b.tables[name]={};});reject((_a,b)=>{b.tables[name]=['{"unreviewed":true}'];});
    const evidence=catalogTables[name];
    for(let i=0;i<evidence.constraints.length;i++){
      for(const field of['table_name','name','definition','unknown'])
        reject((_a,_b,_p,c)=>{c.nextThirtyFirstFiveAdditiveSource.catalogTables[name].constraints[i][field]='unreviewed';});
      reject((_a,_b,_p,c)=>{c.nextThirtyFirstFiveAdditiveSource.catalogTables[name].constraints.splice(i,1);});
      reject((_a,_b,_p,c)=>{c.nextThirtyFirstFiveAdditiveSource.catalogTables[name].constraints.push(c.nextThirtyFirstFiveAdditiveSource.catalogTables[name].constraints[i]);});
    }
    for(let i=0;i<evidence.notNullColumns.length;i++)for(const operation of['missing','renamed','duplicated'])
      reject((_a,_b,_p,c)=>{const cols=c.nextThirtyFirstFiveAdditiveSource.catalogTables[name].notNullColumns;if(operation==='missing')cols.splice(i,1);else if(operation==='renamed')cols[i]+='__unreviewed';else cols.push(cols[i]);});
  }
  for(const side of['predecessor','candidate'])for(const field of['tree','schema','catalog'])
    reject((_a,_b,p,c)=>{(side==='predecessor'?p:c).nextThirtyFirstFiveAdditiveSource[field]='0'.repeat(64);});
  reject((_a,b)=>{b.tables.unreviewed_authority=[];});reject((_a,b)=>{b.tables.accounts=['{"replacement":true}'];});
  reject((_a,b)=>{b.tables.unknown_existing_custody=['{"replacement":true}'];});reject((_a,b)=>{delete b.tables.unknown_existing_custody;});
  reject((_a,b)=>{b.sequences[0].last_value='11';});reject((_a,b)=>{b.sequences.push({sequencename:'unreviewed',last_value:null});});
  reject((_a,_b,p)=>{p.source='0'.repeat(40);});reject((_a,_b,_p,c)=>{c.source='unknown';});
  reject((_a,_b,_p,c)=>{c.nextThirtyFirstFiveAdditiveSource.catalogTables.unreviewed={constraints:[],notNullColumns:[]};});
  reject((_a,_b,_p,c)=>{delete c.nextThirtyFirstFiveAdditiveSource;});
  assert.throws(()=>qualifyFifthBatchAdditiveBootstrap(before,after,p,c));
  assert.throws(()=>qualify(fifthOld,fifthFresh,fifthPredecessor,fifthCandidate));
  assert.deepEqual(qualifyFifthBatchAdditiveBootstrap(fifthOld,fifthFresh,fifthPredecessor,fifthCandidate),fifthQualified);
  for(const file of['src/atomicbarter.js','src/commissionedcrafting.js','src/social/estate.js','tools/next-five-release-phase2-migration-catalog.js','.github/workflows/ci.yml','test/lib/phase2-architecture-upgrade-catalog.json'])
    assert.notEqual(sourcePairReviewedTreeHash([...sourceRecords,record(file)]),sourceHash,'No first-five implementation or helper exclusion');
  console.log(`rc1-source-pair next thirty first-five: ${negatives} rejecting controls; 11empty/90constraints/90NN, strict old/unknown rows and sequences; original profiles/exclusions unchanged; no native or deployed clearance`);
}

// Next-layer source/EMPTY-bootstrap relation only. No populated or native authority.
{
  const A=(await import('node:assert/strict')).default,F=(await import('node:fs/promises')).default;
  const {execFileSync}=await import('node:child_process');
  const {canonicalJson,sha256}=await import('../tools/rc1-native-proof.js');
  const M=await import('../tools/rc1-source-pair.js'),pin=M.NEXT_LAYER_ADDITIVE_PAIR,qualify=M.qualifyNextLayerAdditiveBootstrap;
  const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024});
  const catalog=JSON.parse(git('show',pin.reviewedCandidate+':test/lib/phase2-architecture-upgrade-catalog.json'));
  const parentCatalog=JSON.parse(git('show',pin.predecessor+':test/lib/phase2-architecture-upgrade-catalog.json'));
  A.equal(parentCatalog.added.length,1243);A.equal(catalog.added.length,1332);A.deepEqual(catalog.added.slice(0,1243),parentCatalog.added);
  const restoredCatalog={...catalog,added:catalog.added.slice(0,1243),notNullColumns:{...catalog.notNullColumns}};
  for(const name of pin.tables){A(!Object.hasOwn(parentCatalog.notNullColumns,name));delete restoredCatalog.notNullColumns[name];}
  A.deepEqual(restoredCatalog,parentCatalog,'Complete genuine1243 parent catalog prefix and every old property/map retained');
  const catalogTables=Object.fromEntries(pin.tables.map(name=>[name,{constraints:catalog.added.filter(row=>row.table_name===name),notNullColumns:catalog.notNullColumns[name]}]));
  A.equal(pin.tables.length,8);A.equal(pin.constraints,89);A.equal(pin.notNull,78);
  const p={source:pin.predecessor,nextLayerAdditiveSource:{}},c={source:pin.reviewedCandidate,nextLayerAdditiveSource:{catalogTables}};
  for(const[identity,side]of[[p,'predecessor'],[c,'candidate']]){
    const revision=side==='predecessor'?pin.predecessor:pin.reviewedCandidate;
    for(const field of['tree','schema','catalog'])identity.nextLayerAdditiveSource[field]=pin[side+field[0].toUpperCase()+field.slice(1)];
    A.equal(M.sourcePairReviewedTreeHash(git('ls-tree','-r','-z',revision).split('\0').filter(Boolean)),pin[side+'Tree']);
    A.equal(sha256(git('show',revision+':schema.sql')),pin[side+'Schema']);
    A.equal(sha256(git('show',revision+':test/lib/phase2-architecture-upgrade-catalog.json')),pin[side+'Catalog']);
  }
  const before={tables:{accounts:['{"id":"preserved-original"}'],characters:[],unknown_existing_custody:['{"id":"opaque-a"}','{"id":"opaque-b"}']},sequences:[{sequencename:'item_events_sequence_seq',last_value:'10',is_called:true,start_value:'1',increment_by:'1',min_value:'1',max_value:'9223372036854775807',cache_size:'1',cycle:false}]};
  for(const name of M.NEXT_THIRTY_FIRST_FIVE_ADDITIVE_PAIR.tables)before.tables[name]=['{"old_acknowledged_fixture":true}'];
  const after=structuredClone(before);for(const name of pin.tables){A(!Object.hasOwn(before.tables,name));after.tables[name]=[];}
  const qualified=qualify(before,after,p,c);A.equal(qualified.relation,'REVIEWED_NEXT_LAYER_EIGHT_EMPTY_TABLE_ADDITIVE_BOOTSTRAP');
  A.deepEqual(qualified.addedEmptyTables,pin.tables);A(qualified.predecessorRowsExact&&qualified.allSequencesExact);
  let negatives=0;const reject=mutate=>{const a=structuredClone(before),b=structuredClone(after),previous=structuredClone(p),current=structuredClone(c);mutate(a,b,previous,current);A.throws(()=>qualify(a,b,previous,current),e=>e?.code==='ERR_ASSERTION');negatives++;};
  for(const name of pin.tables){
    reject((_a,b)=>{delete b.tables[name];});reject((_a,b)=>{b.tables[name]={};});reject((_a,b)=>{b.tables[name]=['{"unreviewed":true}'];});
    const evidence=catalogTables[name];
    for(let i=0;i<evidence.constraints.length;i++){
      for(const field of['table_name','name','definition','unknown'])reject((_a,_b,_p,c)=>{c.nextLayerAdditiveSource.catalogTables[name].constraints[i][field]='unreviewed';});
      reject((_a,_b,_p,c)=>{c.nextLayerAdditiveSource.catalogTables[name].constraints.splice(i,1);});
      reject((_a,_b,_p,c)=>{c.nextLayerAdditiveSource.catalogTables[name].constraints.push(c.nextLayerAdditiveSource.catalogTables[name].constraints[i]);});
    }
    for(let i=0;i<evidence.notNullColumns.length;i++)for(const op of['missing','renamed','duplicated'])reject((_a,_b,_p,c)=>{const cols=c.nextLayerAdditiveSource.catalogTables[name].notNullColumns;if(op==='missing')cols.splice(i,1);else if(op==='renamed')cols[i]+='__unknown';else cols.push(cols[i]);});
  }
  for(const side of['predecessor','candidate'])for(const field of['tree','schema','catalog'])reject((_a,_b,p,c)=>{(side==='predecessor'?p:c).nextLayerAdditiveSource[field]='0'.repeat(64);});
  reject((_a,b)=>{b.tables.unreviewed_authority=[];});reject((_a,b)=>{b.tables.accounts=['{"replacement":true}'];});
  reject((_a,b)=>{b.tables.unknown_existing_custody=['{"replacement":true}'];});reject((_a,b)=>{delete b.tables.unknown_existing_custody;});
  reject((_a,b)=>{b.sequences[0].last_value='11';});reject((_a,b)=>{b.sequences.push({sequencename:'unreviewed',last_value:null});});
  reject((_a,_b,p)=>{p.source='0'.repeat(40);});reject((_a,_b,_p,c)=>{c.source='unknown';});
  reject((_a,_b,_p,c)=>{c.nextLayerAdditiveSource.catalogTables.unreviewed={constraints:[],notNullColumns:[]};});reject((_a,_b,_p,c)=>{delete c.nextLayerAdditiveSource;});
  for(const name of Object.keys(before.tables)){
    reject((_a,b)=>{delete b.tables[name];});reject((_a,b)=>{b.tables[name]=[...b.tables[name],'{"old_row_changed":true}'];});
  }
  for(const field of Object.keys(before.sequences[0])){reject((_a,b)=>{delete b.sequences[0][field];});reject((_a,b)=>{b.sequences[0][field]='unreviewed';});}
  const families=[
    ['NEXT_LAYER_ADDITIVE_PAIR','qualifyNextLayerAdditiveBootstrap'],
    ['NEXT_THIRTY_FIRST_FIVE_ADDITIVE_PAIR','qualifyNextThirtyFirstFiveAdditiveBootstrap'],
    ['AUTONOMY_MAIN_ADDITIVE_PAIR','qualifyAutonomyMainAdditiveBootstrap'],
    ['FIFTH_BATCH_ADDITIVE_PAIR','qualifyFifthBatchAdditiveBootstrap'],
    ['COMMERCIAL_MAIN_ADDITIVE_PAIR','qualifyCommercialMainAdditiveBootstrap'],
    ['FOURTH_BATCH_ADDITIVE_PAIR','qualifyFourthBatchAdditiveBootstrap'],
    ['THIRD_BATCH_ADDITIVE_PAIR','qualifyThirdBatchAdditiveBootstrap'],
    ['SECOND_BATCH_ADDITIVE_PAIR','qualifySecondBatchAdditiveBootstrap'],
    ['FIRST_FIVE_ADDITIVE_PAIR','qualifyFirstFiveAdditiveBootstrap'],
    ['MARKET_OPERATIONS_ADDITIVE_PAIR','qualifyMarketOperationsAdditiveBootstrap'],
    ['ENTERPRISE_ADDITIVE_PAIR','qualifyEnterpriseAdditiveBootstrap'],
  ];
  const assertDenseFamilies=rows=>{A.equal(rows.length,11);for(let i=0;i<rows.length;i++){A(Object.hasOwn(rows,i),'No sparse dispatcher family slots');const tuple=rows[i];A(Array.isArray(tuple)&&tuple.length===2&&typeof tuple[0]==='string'&&typeof tuple[1]==='string');A(M[tuple[0]]&&typeof M[tuple[1]]==='function');}A.equal(new Set(rows.map(tuple=>tuple[0])).size,11);};assertDenseFamilies(families);
  for(const[name,fn]of families.slice(1)){A.throws(()=>M[fn](before,after,p,c),e=>e?.code==='ERR_ASSERTION');A.throws(()=>qualify(before,after,{...p,source:M[name].predecessor},c),e=>e?.code==='ERR_ASSERTION');}
  const pairSource=(await F.readFile(new URL('../tools/rc1-source-pair.js',import.meta.url),'utf8')).replaceAll('\r\n','\n');
  const eqStart=pairSource.indexOf('  const equal = (a, b, label, additive = false) => {'),eqEnd=pairSource.indexOf('\n  try {',eqStart);A(eqStart>0&&eqEnd>eqStart);const equalBody=pairSource.slice(eqStart,eqEnd),symbols=families.flat();
  const buildEqual=(source,spy,calls)=>new Function('assert','sourcePairStateDifference','canonicalJson','report','update','predecessor','candidate','ROOT_MARKET_COMBINED_ADDITIVE_PAIR','qualifyRootMarketCombinedAdditiveBootstrap',...symbols,equalBody+'\nreturn equal;')(
    A,M.sourcePairStateDifference,canonicalJson,{assertions:[]},()=>{}, {...p,source},c,M.ROOT_MARKET_COMBINED_ADDITIVE_PAIR,M.qualifyRootMarketCombinedAdditiveBootstrap,...families.flatMap(([name,fn])=>[M[name],spy?()=>{calls.push(fn);return{selectorOnly:true};}:M[fn]]));
  let dispatch=0,strict=0;
  for(const[name,fn]of families)for(const label of['upgrade preserves acknowledged state','upgrade replay creates no new effect']){
    const calls=[],equal=buildEqual(M[name].predecessor,true,calls);equal(before,after,label,true);A.deepEqual(calls,[fn]);dispatch++;
  }
  const equal=buildEqual(pin.predecessor,false,[]);
  for(const label of['upgrade preserves acknowledged state','upgrade replay creates no new effect']){equal(before,after,label,true);A.throws(()=>equal(before,after,label,false),e=>e?.code==='ERR_ASSERTION');strict++;}
  for(const label of['rollback preserves acknowledged state','rollback replay creates no new effect','second upgrade preserves acknowledged state']){
    equal(after,structuredClone(after),label,false);A.throws(()=>equal(before,after,label,true),e=>e?.code==='ERR_ASSERTION');strict++;
    for(const name of Object.keys(after.tables)){const changed=structuredClone(after);changed.tables[name]=[...changed.tables[name],'{"phase_drift":true}'];A.throws(()=>equal(after,changed,label,false),e=>e?.code==='ERR_ASSERTION');strict++;}
    for(const field of Object.keys(after.sequences[0])){const changed=structuredClone(after);changed.sequences[0][field]='phase_drift';A.throws(()=>equal(after,changed,label,false),e=>e?.code==='ERR_ASSERTION');strict++;}
    const unknown=structuredClone(after);unknown.tables.unknown_after_rollback=[];A.throws(()=>equal(after,unknown,label,false),e=>e?.code==='ERR_ASSERTION');strict++;
  }
  const records=['100644 blob '+ '1'.repeat(40)+'\tsrc/existing.js'],baseHash=M.sourcePairReviewedTreeHash(records),record=f=>'100644 blob '+ '2'.repeat(40)+'\t'+f;
  for(const name of['src/customerlayaway.js','src/customervaults.js','src/multihopcourier.js','tools/next-layer-release-phase2-migration-catalog.js','tools/next-layer-native.js','.github/workflows/ci.yml','schema.sql','package.json','test/lib/phase2-architecture-upgrade-catalog.json'])A.notEqual(M.sourcePairReviewedTreeHash([...records,record(name)]),baseHash,'No implementation/native/helper/CI/schema/catalog exclusion');
  for(const name of['tools/rc1-source-pair.js','test/rc1-source-pair-additive.js','docs/rc1-source-pair-additive-review.md',...M.ADDITIVE_KNOWLEDGE_OUTPUTS])A.equal(M.sourcePairReviewedTreeHash([...records,record(name)]),baseHash,'Only existing exact QA and derivative exclusions retained');
  console.log('rc1-source-pair next-layer proposal PASS: '+negatives+' EMPTY/source/catalog/old-state refusals; '+dispatch+' exact selector routes; '+strict+' strict phase refusals; 8empty/89structural/78NN, genuine1243→1332 prefix; no native/financial/deployed clearance');
}

{
  const A=(await import('node:assert/strict')).default,F=(await import('node:fs/promises')).default;
  const {execFileSync}=await import('node:child_process');
  const {canonicalJson,sha256}=await import('../tools/rc1-native-proof.js');
  const M=await import('../tools/rc1-source-pair.js'),pin=M.MARKET_OPERATIONS_ADDITIVE_PAIR,qualify=M.qualifyMarketOperationsAdditiveBootstrap;
  const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024});
  const catalog=JSON.parse(git('show',pin.reviewedCandidate+':test/lib/phase2-architecture-upgrade-catalog.json'));
  const parentCatalog=JSON.parse(git('show',pin.predecessor+':test/lib/phase2-architecture-upgrade-catalog.json'));
  A.equal(parentCatalog.added.length,1332);A.equal(catalog.added.length,1402);A.deepEqual(catalog.added.slice(0,1332),parentCatalog.added);
  const restoredCatalog={...catalog,added:catalog.added.slice(0,1332),notNullColumns:{...catalog.notNullColumns}};
  for(const name of pin.tables){A(!Object.hasOwn(parentCatalog.notNullColumns,name));delete restoredCatalog.notNullColumns[name];}
  A.deepEqual(restoredCatalog,parentCatalog,'Complete genuine1332 parent catalog prefix and every old property/map retained');
  const catalogTables=Object.fromEntries(pin.tables.map(name=>[name,{constraints:catalog.added.filter(row=>row.table_name===name),notNullColumns:catalog.notNullColumns[name]}]));
  A.equal(pin.tables.length,6);A.equal(pin.constraints,70);A.equal(pin.notNull,66);
  const p={source:pin.predecessor,marketOperationsAdditiveSource:{}},c={source:pin.reviewedCandidate,marketOperationsAdditiveSource:{catalogTables}};
  for(const[identity,side]of[[p,'predecessor'],[c,'candidate']]){
    const revision=side==='predecessor'?pin.predecessor:pin.reviewedCandidate;
    for(const field of['tree','schema','catalog'])identity.marketOperationsAdditiveSource[field]=pin[side+field[0].toUpperCase()+field.slice(1)];
    A.equal(M.sourcePairReviewedTreeHash(git('ls-tree','-r','-z',revision).split('\0').filter(Boolean)),pin[side+'Tree']);
    A.equal(sha256(git('show',revision+':schema.sql')),pin[side+'Schema']);
    A.equal(sha256(git('show',revision+':test/lib/phase2-architecture-upgrade-catalog.json')),pin[side+'Catalog']);
  }
  const before={tables:{accounts:['{"id":"preserved-original"}'],characters:[],unknown_existing_custody:['{"id":"opaque-a"}','{"id":"opaque-b"}']},sequences:[{sequencename:'item_events_sequence_seq',last_value:'10',is_called:true,start_value:'1',increment_by:'1',min_value:'1',max_value:'9223372036854775807',cache_size:'1',cycle:false}]};
  for(const name of [...M.NEXT_THIRTY_FIRST_FIVE_ADDITIVE_PAIR.tables,...M.NEXT_LAYER_ADDITIVE_PAIR.tables])before.tables[name]=['{"old_acknowledged_fixture":true}'];
  const after=structuredClone(before);for(const name of pin.tables){A(!Object.hasOwn(before.tables,name));after.tables[name]=[];}
  const qualified=qualify(before,after,p,c);A.equal(qualified.relation,'REVIEWED_MARKET_OPERATIONS_SIX_EMPTY_TABLE_ADDITIVE_BOOTSTRAP');
  A.deepEqual(qualified.addedEmptyTables,pin.tables);A(qualified.predecessorRowsExact&&qualified.allSequencesExact);
  let negatives=0;const reject=mutate=>{const a=structuredClone(before),b=structuredClone(after),previous=structuredClone(p),current=structuredClone(c);mutate(a,b,previous,current);A.throws(()=>qualify(a,b,previous,current),e=>e?.code==='ERR_ASSERTION');negatives++;};
  for(const name of pin.tables){
    reject((_a,b)=>{delete b.tables[name];});reject((_a,b)=>{b.tables[name]={};});reject((_a,b)=>{b.tables[name]=['{"unreviewed":true}'];});
    const evidence=catalogTables[name];
    for(let i=0;i<evidence.constraints.length;i++){
      for(const field of['table_name','name','definition','unknown'])reject((_a,_b,_p,c)=>{c.marketOperationsAdditiveSource.catalogTables[name].constraints[i][field]='unreviewed';});
      reject((_a,_b,_p,c)=>{c.marketOperationsAdditiveSource.catalogTables[name].constraints.splice(i,1);});
      reject((_a,_b,_p,c)=>{c.marketOperationsAdditiveSource.catalogTables[name].constraints.push(c.marketOperationsAdditiveSource.catalogTables[name].constraints[i]);});
    }
    for(let i=0;i<evidence.notNullColumns.length;i++)for(const op of['missing','renamed','duplicated'])reject((_a,_b,_p,c)=>{const cols=c.marketOperationsAdditiveSource.catalogTables[name].notNullColumns;if(op==='missing')cols.splice(i,1);else if(op==='renamed')cols[i]+='__unknown';else cols.push(cols[i]);});
  }
  for(const side of['predecessor','candidate'])for(const field of['tree','schema','catalog'])reject((_a,_b,p,c)=>{(side==='predecessor'?p:c).marketOperationsAdditiveSource[field]='0'.repeat(64);});
  reject((_a,b)=>{b.tables.unreviewed_authority=[];});reject((_a,b)=>{b.tables.accounts=['{"replacement":true}'];});
  reject((_a,b)=>{b.tables.unknown_existing_custody=['{"replacement":true}'];});reject((_a,b)=>{delete b.tables.unknown_existing_custody;});
  reject((_a,b)=>{b.sequences[0].last_value='11';});reject((_a,b)=>{b.sequences.push({sequencename:'unreviewed',last_value:null});});
  reject((_a,_b,p)=>{p.source='0'.repeat(40);});reject((_a,_b,_p,c)=>{c.source='unknown';});
  reject((_a,_b,_p,c)=>{c.marketOperationsAdditiveSource.catalogTables.unreviewed={constraints:[],notNullColumns:[]};});reject((_a,_b,_p,c)=>{delete c.marketOperationsAdditiveSource;});
  for(const name of Object.keys(before.tables)){
    reject((_a,b)=>{delete b.tables[name];});reject((_a,b)=>{b.tables[name]=[...b.tables[name],'{"old_row_changed":true}'];});
  }
  for(const field of Object.keys(before.sequences[0])){reject((_a,b)=>{delete b.sequences[0][field];});reject((_a,b)=>{b.sequences[0][field]='unreviewed';});}
  const families=[
    ['MARKET_OPERATIONS_ADDITIVE_PAIR','qualifyMarketOperationsAdditiveBootstrap'],
    ['NEXT_LAYER_ADDITIVE_PAIR','qualifyNextLayerAdditiveBootstrap'],
    ['NEXT_THIRTY_FIRST_FIVE_ADDITIVE_PAIR','qualifyNextThirtyFirstFiveAdditiveBootstrap'],
    ['AUTONOMY_MAIN_ADDITIVE_PAIR','qualifyAutonomyMainAdditiveBootstrap'],
    ['FIFTH_BATCH_ADDITIVE_PAIR','qualifyFifthBatchAdditiveBootstrap'],
    ['COMMERCIAL_MAIN_ADDITIVE_PAIR','qualifyCommercialMainAdditiveBootstrap'],
    ['FOURTH_BATCH_ADDITIVE_PAIR','qualifyFourthBatchAdditiveBootstrap'],
    ['THIRD_BATCH_ADDITIVE_PAIR','qualifyThirdBatchAdditiveBootstrap'],
    ['SECOND_BATCH_ADDITIVE_PAIR','qualifySecondBatchAdditiveBootstrap'],
    ['FIRST_FIVE_ADDITIVE_PAIR','qualifyFirstFiveAdditiveBootstrap'],
    ['ENTERPRISE_ADDITIVE_PAIR','qualifyEnterpriseAdditiveBootstrap'],
  ];
  const assertDenseFamilies=rows=>{A.equal(rows.length,11);for(let i=0;i<rows.length;i++){A(Object.hasOwn(rows,i),'No sparse dispatcher family slots');const tuple=rows[i];A(Array.isArray(tuple)&&tuple.length===2&&typeof tuple[0]==='string'&&typeof tuple[1]==='string');A(M[tuple[0]]&&typeof M[tuple[1]]==='function');}A.equal(new Set(rows.map(tuple=>tuple[0])).size,11);};assertDenseFamilies(families);
  for(const[name,fn]of families.slice(1)){A.throws(()=>M[fn](before,after,p,c),e=>e?.code==='ERR_ASSERTION');A.throws(()=>qualify(before,after,{...p,source:M[name].predecessor},c),e=>e?.code==='ERR_ASSERTION');}
  const pairSource=(await F.readFile(new URL('../tools/rc1-source-pair.js',import.meta.url),'utf8')).replaceAll('\r\n','\n');
  const eqStart=pairSource.indexOf('  const equal = (a, b, label, additive = false) => {'),eqEnd=pairSource.indexOf('\n  try {',eqStart);A(eqStart>0&&eqEnd>eqStart);const equalBody=pairSource.slice(eqStart,eqEnd),symbols=families.flat();
  const buildEqual=(source,spy,calls)=>new Function('assert','sourcePairStateDifference','canonicalJson','report','update','predecessor','candidate','ROOT_MARKET_COMBINED_ADDITIVE_PAIR','qualifyRootMarketCombinedAdditiveBootstrap',...symbols,equalBody+'\nreturn equal;')(
    A,M.sourcePairStateDifference,canonicalJson,{assertions:[]},()=>{}, {...p,source},c,M.ROOT_MARKET_COMBINED_ADDITIVE_PAIR,M.qualifyRootMarketCombinedAdditiveBootstrap,...families.flatMap(([name,fn])=>[M[name],spy?()=>{calls.push(fn);return{selectorOnly:true};}:M[fn]]));
  let dispatch=0,strict=0;
  for(const[name,fn]of families)for(const label of['upgrade preserves acknowledged state','upgrade replay creates no new effect']){
    const calls=[],equal=buildEqual(M[name].predecessor,true,calls);equal(before,after,label,true);A.deepEqual(calls,[fn]);dispatch++;
  }
  const equal=buildEqual(pin.predecessor,false,[]);
  for(const label of['upgrade preserves acknowledged state','upgrade replay creates no new effect']){equal(before,after,label,true);A.throws(()=>equal(before,after,label,false),e=>e?.code==='ERR_ASSERTION');strict++;}
  for(const label of['rollback preserves acknowledged state','rollback replay creates no new effect','second upgrade preserves acknowledged state']){
    equal(after,structuredClone(after),label,false);A.throws(()=>equal(before,after,label,true),e=>e?.code==='ERR_ASSERTION');strict++;
    for(const name of Object.keys(after.tables)){const changed=structuredClone(after);changed.tables[name]=[...changed.tables[name],'{"phase_drift":true}'];A.throws(()=>equal(after,changed,label,false),e=>e?.code==='ERR_ASSERTION');strict++;}
    for(const field of Object.keys(after.sequences[0])){const changed=structuredClone(after);changed.sequences[0][field]='phase_drift';A.throws(()=>equal(after,changed,label,false),e=>e?.code==='ERR_ASSERTION');strict++;}
    const unknown=structuredClone(after);unknown.tables.unknown_after_rollback=[];A.throws(()=>equal(after,unknown,label,false),e=>e?.code==='ERR_ASSERTION');strict++;
  }
  const records=['100644 blob '+ '1'.repeat(40)+'\tsrc/existing.js'],baseHash=M.sourcePairReviewedTreeHash(records),record=f=>'100644 blob '+ '2'.repeat(40)+'\t'+f;
  for(const name of['src/crossdocking.js','src/productionslots.js','src/merchantreturns.js','tools/market-operations-release-phase2-migration-catalog.js','tools/market-operations-native.js','.github/workflows/ci.yml','schema.sql','package.json','test/lib/phase2-architecture-upgrade-catalog.json'])A.notEqual(M.sourcePairReviewedTreeHash([...records,record(name)]),baseHash,'No implementation/native/helper/CI/schema/catalog exclusion');
  for(const name of['tools/rc1-source-pair.js','test/rc1-source-pair-additive.js','docs/rc1-source-pair-additive-review.md',...M.ADDITIVE_KNOWLEDGE_OUTPUTS])A.equal(M.sourcePairReviewedTreeHash([...records,record(name)]),baseHash,'Only existing exact QA and derivative exclusions retained');
  console.log('rc1-source-pair market-operations EMPTY bootstrap PASS: '+negatives+' EMPTY/source/catalog/old-state refusals; '+dispatch+' exact selector routes; '+strict+' strict phase refusals; 6empty/70structural/66NN, genuine1332→1402 prefix; no native/financial/deployed clearance');
}

// Enterprise PREPARATION source/EMPTY-bootstrap relation only. No native or release authority.

{
  const A=(await import('node:assert/strict')).default,F=(await import('node:fs/promises')).default;
  const {execFileSync}=await import('node:child_process');
  const {canonicalJson,sha256}=await import('../tools/rc1-native-proof.js');
  const M=await import('../tools/rc1-source-pair.js'),pin=M.ENTERPRISE_ADDITIVE_PAIR,qualify=M.qualifyEnterpriseAdditiveBootstrap;
  const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024});
  const catalog=JSON.parse(git('show',pin.reviewedCandidate+':test/lib/phase2-architecture-upgrade-catalog.json'));
  const parentCatalog=JSON.parse(git('show',pin.predecessor+':test/lib/phase2-architecture-upgrade-catalog.json'));
  A.equal(parentCatalog.added.length,1402);A.equal(catalog.added.length,1475);A.deepEqual(catalog.added.slice(0,1402),parentCatalog.added);
  const restoredCatalog={...catalog,added:catalog.added.slice(0,1402),notNullColumns:{...catalog.notNullColumns}};
  for(const name of pin.tables){A(!Object.hasOwn(parentCatalog.notNullColumns,name));delete restoredCatalog.notNullColumns[name];}
  A.deepEqual(restoredCatalog,parentCatalog,'Complete genuine1402 parent catalog prefix and every old property/map retained');
  const catalogTables=Object.fromEntries(pin.tables.map(name=>[name,{constraints:catalog.added.filter(row=>row.table_name===name),notNullColumns:catalog.notNullColumns[name]}]));
  A.equal(pin.tables.length,9);A.equal(pin.constraints,73);A.equal(pin.notNull,73);
  const p={source:pin.predecessor,enterpriseAdditiveSource:{}},c={source:pin.reviewedCandidate,enterpriseAdditiveSource:{catalogTables}};
  for(const[identity,side]of[[p,'predecessor'],[c,'candidate']]){
    const revision=side==='predecessor'?pin.predecessor:pin.reviewedCandidate;
    for(const field of['tree','schema','catalog'])identity.enterpriseAdditiveSource[field]=pin[side+field[0].toUpperCase()+field.slice(1)];
    A.equal(M.sourcePairReviewedTreeHash(git('ls-tree','-r','-z',revision).split('\0').filter(Boolean)),pin[side+'Tree']);
    A.equal(sha256(git('show',revision+':schema.sql')),pin[side+'Schema']);
    A.equal(sha256(git('show',revision+':test/lib/phase2-architecture-upgrade-catalog.json')),pin[side+'Catalog']);
  }
  const before={tables:{accounts:['{"id":"preserved-original"}'],characters:[],unknown_existing_custody:['{"id":"opaque-a"}','{"id":"opaque-b"}']},sequences:[{sequencename:'item_events_sequence_seq',last_value:'10',is_called:true,start_value:'1',increment_by:'1',min_value:'1',max_value:'9223372036854775807',cache_size:'1',cycle:false}]};
  for(const name of [...M.MARKET_OPERATIONS_ADDITIVE_PAIR.tables,...M.NEXT_THIRTY_FIRST_FIVE_ADDITIVE_PAIR.tables,...M.NEXT_LAYER_ADDITIVE_PAIR.tables])before.tables[name]=['{"old_acknowledged_fixture":true}'];
  const after=structuredClone(before);for(const name of pin.tables){A(!Object.hasOwn(before.tables,name));after.tables[name]=[];}
  const qualified=qualify(before,after,p,c);A.equal(qualified.relation,'REVIEWED_ENTERPRISE_NINE_EMPTY_TABLE_ADDITIVE_BOOTSTRAP');
  A.deepEqual(qualified.addedEmptyTables,pin.tables);A(qualified.predecessorRowsExact&&qualified.allSequencesExact);
  let negatives=0;const reject=mutate=>{const a=structuredClone(before),b=structuredClone(after),previous=structuredClone(p),current=structuredClone(c);mutate(a,b,previous,current);A.throws(()=>qualify(a,b,previous,current),e=>e?.code==='ERR_ASSERTION');negatives++;};
  for(const name of pin.tables){
    reject((_a,b)=>{delete b.tables[name];});reject((_a,b)=>{b.tables[name]={};});reject((_a,b)=>{b.tables[name]=['{"unreviewed":true}'];});
    const evidence=catalogTables[name];
    for(let i=0;i<evidence.constraints.length;i++){
      for(const field of['table_name','name','definition','unknown'])reject((_a,_b,_p,c)=>{c.enterpriseAdditiveSource.catalogTables[name].constraints[i][field]='unreviewed';});
      reject((_a,_b,_p,c)=>{c.enterpriseAdditiveSource.catalogTables[name].constraints.splice(i,1);});
      reject((_a,_b,_p,c)=>{c.enterpriseAdditiveSource.catalogTables[name].constraints.push(c.enterpriseAdditiveSource.catalogTables[name].constraints[i]);});
    }
    for(let i=0;i<evidence.notNullColumns.length;i++)for(const op of['missing','renamed','duplicated'])reject((_a,_b,_p,c)=>{const cols=c.enterpriseAdditiveSource.catalogTables[name].notNullColumns;if(op==='missing')cols.splice(i,1);else if(op==='renamed')cols[i]+='__unknown';else cols.push(cols[i]);});
  }
  for(const side of['predecessor','candidate'])for(const field of['tree','schema','catalog'])reject((_a,_b,p,c)=>{(side==='predecessor'?p:c).enterpriseAdditiveSource[field]='0'.repeat(64);});
  reject((_a,b)=>{b.tables.unreviewed_authority=[];});reject((_a,b)=>{b.tables.accounts=['{"replacement":true}'];});
  reject((_a,b)=>{b.tables.unknown_existing_custody=['{"replacement":true}'];});reject((_a,b)=>{delete b.tables.unknown_existing_custody;});
  reject((_a,b)=>{b.sequences[0].last_value='11';});reject((_a,b)=>{b.sequences.push({sequencename:'unreviewed',last_value:null});});
  reject((_a,_b,p)=>{p.source='0'.repeat(40);});reject((_a,_b,_p,c)=>{c.source='unknown';});
  reject((_a,_b,_p,c)=>{c.enterpriseAdditiveSource.catalogTables.unreviewed={constraints:[],notNullColumns:[]};});reject((_a,_b,_p,c)=>{delete c.enterpriseAdditiveSource;});
  for(const name of Object.keys(before.tables)){
    reject((_a,b)=>{delete b.tables[name];});reject((_a,b)=>{b.tables[name]=[...b.tables[name],'{"old_row_changed":true}'];});
  }
  for(const field of Object.keys(before.sequences[0])){reject((_a,b)=>{delete b.sequences[0][field];});reject((_a,b)=>{b.sequences[0][field]='unreviewed';});}
  const families=[
    ['ENTERPRISE_ADDITIVE_PAIR','qualifyEnterpriseAdditiveBootstrap'],
    ['MARKET_OPERATIONS_ADDITIVE_PAIR','qualifyMarketOperationsAdditiveBootstrap'],
    ['NEXT_LAYER_ADDITIVE_PAIR','qualifyNextLayerAdditiveBootstrap'],
    ['NEXT_THIRTY_FIRST_FIVE_ADDITIVE_PAIR','qualifyNextThirtyFirstFiveAdditiveBootstrap'],
    ['AUTONOMY_MAIN_ADDITIVE_PAIR','qualifyAutonomyMainAdditiveBootstrap'],
    ['FIFTH_BATCH_ADDITIVE_PAIR','qualifyFifthBatchAdditiveBootstrap'],
    ['COMMERCIAL_MAIN_ADDITIVE_PAIR','qualifyCommercialMainAdditiveBootstrap'],
    ['FOURTH_BATCH_ADDITIVE_PAIR','qualifyFourthBatchAdditiveBootstrap'],
    ['THIRD_BATCH_ADDITIVE_PAIR','qualifyThirdBatchAdditiveBootstrap'],
    ['SECOND_BATCH_ADDITIVE_PAIR','qualifySecondBatchAdditiveBootstrap'],
    ['FIRST_FIVE_ADDITIVE_PAIR','qualifyFirstFiveAdditiveBootstrap'],
    ['ROOT_MARKET_COMBINED_ADDITIVE_PAIR','qualifyRootMarketCombinedAdditiveBootstrap']
  ];
  const assertDenseFamilies=rows=>{A.equal(rows.length,12);for(let i=0;i<rows.length;i++){A(Object.hasOwn(rows,i),'No sparse dispatcher family slots');const tuple=rows[i];A(Array.isArray(tuple)&&tuple.length===2&&typeof tuple[0]==='string'&&typeof tuple[1]==='string');A(M[tuple[0]]&&typeof M[tuple[1]]==='function');}A.equal(new Set(rows.map(tuple=>tuple[0])).size,12);};assertDenseFamilies(families);
  for(const[name,fn]of families.slice(1)){A.throws(()=>M[fn](before,after,p,c),e=>e?.code==='ERR_ASSERTION');A.throws(()=>qualify(before,after,{...p,source:M[name].predecessor},c),e=>e?.code==='ERR_ASSERTION');}
  const pairSource=(await F.readFile(new URL('../tools/rc1-source-pair.js',import.meta.url),'utf8')).replaceAll('\r\n','\n');
  const eqStart=pairSource.indexOf('  const equal = (a, b, label, additive = false) => {'),eqEnd=pairSource.indexOf('\n  try {',eqStart);A(eqStart>0&&eqEnd>eqStart);const equalBody=pairSource.slice(eqStart,eqEnd),symbols=families.flat();
  const buildEqual=(source,spy,calls,current=c)=>new Function('assert','sourcePairStateDifference','canonicalJson','report','update','predecessor','candidate',...symbols,equalBody+'\nreturn equal;')(
    A,M.sourcePairStateDifference,canonicalJson,{assertions:[]},()=>{}, {...p,source},current,...families.flatMap(([name,fn])=>[M[name],spy?()=>{calls.push(fn);return{selectorOnly:true};}:M[fn]]));
  let dispatch=0,strict=0;
  for(const[name,fn]of families.filter(([name])=>name!=='ROOT_MARKET_COMBINED_ADDITIVE_PAIR'))for(const label of['upgrade preserves acknowledged state','upgrade replay creates no new effect']){
    const calls=[],equal=buildEqual(M[name].predecessor,true,calls);equal(before,after,label,true);A.deepEqual(calls,[fn]);dispatch++;
  }
  // The new combined profile shares predecessor2a with old8; only its exact candidate tree selects it.
  for(const label of ['upgrade preserves acknowledged state','upgrade replay creates no new effect']){
    const calls=[],combined={...c,rootMarketCombinedAdditiveSource:{tree:M.ROOT_MARKET_COMBINED_ADDITIVE_PAIR.candidateTree}};
    buildEqual(M.ROOT_MARKET_COMBINED_ADDITIVE_PAIR.predecessor,true,calls,combined)(before,after,label,true);
    A.deepEqual(calls,['qualifyRootMarketCombinedAdditiveBootstrap']);dispatch++;
  }
  const equal=buildEqual(pin.predecessor,false,[]);
  for(const label of['upgrade preserves acknowledged state','upgrade replay creates no new effect']){equal(before,after,label,true);A.throws(()=>equal(before,after,label,false),e=>e?.code==='ERR_ASSERTION');strict++;}
  for(const label of['rollback preserves acknowledged state','rollback replay creates no new effect','second upgrade preserves acknowledged state']){
    equal(after,structuredClone(after),label,false);A.throws(()=>equal(before,after,label,true),e=>e?.code==='ERR_ASSERTION');strict++;
    for(const name of Object.keys(after.tables)){const changed=structuredClone(after);changed.tables[name]=[...changed.tables[name],'{"phase_drift":true}'];A.throws(()=>equal(after,changed,label,false),e=>e?.code==='ERR_ASSERTION');strict++;}
    for(const field of Object.keys(after.sequences[0])){const changed=structuredClone(after);changed.sequences[0][field]='phase_drift';A.throws(()=>equal(after,changed,label,false),e=>e?.code==='ERR_ASSERTION');strict++;}
    const unknown=structuredClone(after);unknown.tables.unknown_after_rollback=[];A.throws(()=>equal(after,unknown,label,false),e=>e?.code==='ERR_ASSERTION');strict++;
  }
  const records=['100644 blob '+ '1'.repeat(40)+'\tsrc/existing.js'],baseHash=M.sourcePairReviewedTreeHash(records),record=f=>'100644 blob '+ '2'.repeat(40)+'\t'+f;
  for(const name of['src/crossdocking.js','src/productionslots.js','src/merchantreturns.js','tools/market-operations-release-phase2-migration-catalog.js','tools/market-operations-native.js','.github/workflows/ci.yml','schema.sql','package.json','test/lib/phase2-architecture-upgrade-catalog.json'])A.notEqual(M.sourcePairReviewedTreeHash([...records,record(name)]),baseHash,'No implementation/native/helper/CI/schema/catalog exclusion');
  for(const name of['tools/rc1-source-pair.js','test/rc1-source-pair-additive.js','docs/rc1-source-pair-additive-review.md',...M.ADDITIVE_KNOWLEDGE_OUTPUTS])A.equal(M.sourcePairReviewedTreeHash([...records,record(name)]),baseHash,'Only existing exact QA and derivative exclusions retained');
  console.log('rc1-source-pair enterprise PREPARATION EMPTY bootstrap PASS: '+negatives+' EMPTY/source/catalog/old-state refusals; '+dispatch+' exact selector routes; '+strict+' strict phase refusals; 9empty/73structural/73NN, genuine1402→1475 prefix; no native/financial/deployed clearance');
}


{
  const A=(await import('node:assert/strict')).default,F=await import('node:fs/promises'),{execFileSync}=await import('node:child_process'),{canonicalJson,sha256}=await import('../tools/rc1-native-proof.js');
  const M=await import('../tools/rc1-source-pair.js'),pin=M.ROOT_MARKET_COMBINED_ADDITIVE_PAIR,qualify=M.qualifyRootMarketCombinedAdditiveBootstrap;
  const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024});
  const catalog=JSON.parse(git('show',pin.reviewedCandidate+':test/lib/phase2-architecture-upgrade-catalog.json')),old=JSON.parse(git('show',pin.predecessor+':test/lib/phase2-architecture-upgrade-catalog.json'));
  A.equal(old.added.length,1243);A.equal(catalog.added.length,1402);A.deepEqual(catalog.added.slice(0,1243),old.added);
  const restored={...catalog,added:catalog.added.slice(0,1243),notNullColumns:{...catalog.notNullColumns}};
  for(const name of pin.tables){A(!Object.hasOwn(old.notNullColumns,name));delete restored.notNullColumns[name];}A.deepEqual(restored,old,'All old catalog metadata, removed rows, ordered rows and required maps preserved');
  A.equal(pin.tables.length,14);A.equal(pin.constraints,159);A.equal(pin.notNull,144);
  const catalogTables=Object.fromEntries(pin.tables.map(name=>[name,{constraints:catalog.added.filter(row=>row.table_name===name),notNullColumns:catalog.notNullColumns[name]}]));
  const p={source:pin.predecessor,rootMarketCombinedAdditiveSource:{}},c={source:pin.reviewedCandidate,rootMarketCombinedAdditiveSource:{catalogTables}};
  for(const[identity,side]of[[p,'predecessor'],[c,'candidate']]){
    const revision=side==='predecessor'?pin.predecessor:pin.reviewedCandidate;
    for(const field of['tree','schema','catalog'])identity.rootMarketCombinedAdditiveSource[field]=pin[side+field[0].toUpperCase()+field.slice(1)];
    A.equal(M.sourcePairReviewedTreeHash(git('ls-tree','-r','-z',revision).split('\0').filter(Boolean)),pin[side+'Tree']);
    A.equal(sha256(git('show',revision+':schema.sql')),pin[side+'Schema']);A.equal(sha256(git('show',revision+':test/lib/phase2-architecture-upgrade-catalog.json')),pin[side+'Catalog']);
  }
  const before={tables:{accounts:['{"id":"original-ack"}'],characters:[],unknown_existing_custody:['{"opaque":1}','{"opaque":2}']},sequences:[{sequencename:'item_events_sequence_seq',last_value:'10',is_called:true,start_value:'1',increment_by:'1',min_value:'1',max_value:'9223372036854775807',cache_size:'1',cycle:false}]};
  for(const name of M.NEXT_THIRTY_FIRST_FIVE_ADDITIVE_PAIR.tables)before.tables[name]=['{"prior_ack":true}'];
  const after=structuredClone(before);for(const name of pin.tables){A(!Object.hasOwn(before.tables,name));after.tables[name]=[];}
  const result=qualify(before,after,p,c);A.equal(result.relation,'REVIEWED_ROOT_MARKET_COMBINED_FOURTEEN_EMPTY_TABLE_ADDITIVE_BOOTSTRAP');A.deepEqual(result.addedEmptyTables,pin.tables);A(result.predecessorRowsExact&&result.allSequencesExact);A.notEqual(result.beforeNormalizedSha256,result.afterNormalizedSha256);
  let negatives=0;const reject=mutate=>{const a=structuredClone(before),b=structuredClone(after),previous=structuredClone(p),current=structuredClone(c);mutate(a,b,previous,current);A.throws(()=>qualify(a,b,previous,current),e=>e?.code==='ERR_ASSERTION');negatives++;};
  for(const name of pin.tables){
    reject((_a,b)=>{delete b.tables[name];});reject((_a,b)=>{b.tables[name]={};});reject((_a,b)=>{b.tables[name]=['{"not_empty":true}'];});
    for(let i=0;i<catalogTables[name].constraints.length;i++){
      for(const field of ['table_name','name','definition','unknown'])reject((_a,_b,_p,c)=>{c.rootMarketCombinedAdditiveSource.catalogTables[name].constraints[i][field]='unknown';});
      reject((_a,_b,_p,c)=>{c.rootMarketCombinedAdditiveSource.catalogTables[name].constraints.splice(i,1);});reject((_a,_b,_p,c)=>{c.rootMarketCombinedAdditiveSource.catalogTables[name].constraints.push(c.rootMarketCombinedAdditiveSource.catalogTables[name].constraints[i]);});
    }
    for(let i=0;i<catalogTables[name].notNullColumns.length;i++)for(const op of ['missing','renamed','duplicated'])reject((_a,_b,_p,c)=>{const cols=c.rootMarketCombinedAdditiveSource.catalogTables[name].notNullColumns;if(op==='missing')cols.splice(i,1);else if(op==='renamed')cols[i]+='_unknown';else cols.push(cols[i]);});
  }
  for(const side of ['predecessor','candidate'])for(const field of ['tree','schema','catalog'])reject((_a,_b,p,c)=>{(side==='predecessor'?p:c).rootMarketCombinedAdditiveSource[field]='0'.repeat(64);});
  reject((_a,_b,p)=>{p.source='0'.repeat(40);});reject((_a,_b,_p,c)=>{c.source='unknown';});reject((_a,_b,_p,c)=>{delete c.rootMarketCombinedAdditiveSource;});reject((_a,_b,_p,c)=>{c.rootMarketCombinedAdditiveSource.catalogTables.unknown={constraints:[],notNullColumns:[]};});reject((_a,b)=>{b.tables.unknown_added=[];});
  for(const name of Object.keys(before.tables)){reject((_a,b)=>{delete b.tables[name];});reject((_a,b)=>{b.tables[name]=[...b.tables[name],'{"changed":true}'];});}
  for(const field of Object.keys(before.sequences[0])){reject((_a,b)=>{delete b.sequences[0][field];});reject((_a,b)=>{b.sequences[0][field]='unknown';});}reject((_a,b)=>{b.sequences.push({sequencename:'unknown',last_value:null});});
  const families=[['ROOT_MARKET_COMBINED_ADDITIVE_PAIR','qualifyRootMarketCombinedAdditiveBootstrap'],['ENTERPRISE_ADDITIVE_PAIR','qualifyEnterpriseAdditiveBootstrap'],['MARKET_OPERATIONS_ADDITIVE_PAIR','qualifyMarketOperationsAdditiveBootstrap'],['NEXT_LAYER_ADDITIVE_PAIR','qualifyNextLayerAdditiveBootstrap'],['NEXT_THIRTY_FIRST_FIVE_ADDITIVE_PAIR','qualifyNextThirtyFirstFiveAdditiveBootstrap'],['AUTONOMY_MAIN_ADDITIVE_PAIR','qualifyAutonomyMainAdditiveBootstrap'],['FIFTH_BATCH_ADDITIVE_PAIR','qualifyFifthBatchAdditiveBootstrap'],['COMMERCIAL_MAIN_ADDITIVE_PAIR','qualifyCommercialMainAdditiveBootstrap'],['FOURTH_BATCH_ADDITIVE_PAIR','qualifyFourthBatchAdditiveBootstrap'],['THIRD_BATCH_ADDITIVE_PAIR','qualifyThirdBatchAdditiveBootstrap'],['SECOND_BATCH_ADDITIVE_PAIR','qualifySecondBatchAdditiveBootstrap'],['FIRST_FIVE_ADDITIVE_PAIR','qualifyFirstFiveAdditiveBootstrap']];
  A.equal(families.length,12);A.deepEqual(Object.keys(families),Array.from({length:12},(_,i)=>String(i)));for(const pair of families){A(Array.isArray(pair));A.equal(pair.length,2);A.equal(Object.keys(pair).length,2);A.equal(typeof M[pair[1]],'function');}
  for(const[name,fn]of families.slice(1)){A.throws(()=>M[fn](before,after,p,c),e=>e?.code==='ERR_ASSERTION');if(M[name].predecessor!==pin.predecessor)A.throws(()=>qualify(before,after,{...p,source:M[name].predecessor},c),e=>e?.code==='ERR_ASSERTION');}
  const pairSource=(await F.readFile(new URL('../tools/rc1-source-pair.js',import.meta.url),'utf8')).replaceAll('\r\n','\n'),start=pairSource.indexOf('  const equal = (a, b, label, additive = false) => {'),end=pairSource.indexOf('\n  try {',start);A(start>0&&end>start);
  const build=(current,spy,calls)=>new Function('assert','sourcePairStateDifference','canonicalJson','report','update','predecessor','candidate',...families.flat(),pairSource.slice(start,end)+'\nreturn equal;')(A,M.sourcePairStateDifference,canonicalJson,{assertions:[]},()=>{},p,current,...families.flatMap(([name,fn])=>[M[name],spy?()=>{calls.push(fn);return{selectorOnly:true};}:M[fn]]));
  let dispatch=0,strict=0;
  for(const label of ['upgrade preserves acknowledged state','upgrade replay creates no new effect']){const calls=[];build(c,true,calls)(before,after,label,true);A.deepEqual(calls,['qualifyRootMarketCombinedAdditiveBootstrap']);build(c,false,[])(before,after,label,true);A.throws(()=>build(c,false,[])(before,after,label,false));dispatch++;}
  const bad=structuredClone(c);bad.rootMarketCombinedAdditiveSource.tree='0'.repeat(64);for(const label of ['upgrade preserves acknowledged state','upgrade replay creates no new effect'])A.throws(()=>build(bad,false,[])(before,after,label,true));
  for(const label of ['rollback preserves acknowledged state','rollback replay creates no new effect','second upgrade preserves acknowledged state']){
    build(c,false,[])(after,structuredClone(after),label,false);A.throws(()=>build(c,false,[])(before,after,label,true));strict++;
    for(const name of Object.keys(after.tables)){const changed=structuredClone(after);changed.tables[name]=[...changed.tables[name],'{"phase":true}'];A.throws(()=>build(c,false,[])(after,changed,label,false));strict++;}
    for(const field of Object.keys(after.sequences[0])){const changed=structuredClone(after);changed.sequences[0][field]='phase';A.throws(()=>build(c,false,[])(after,changed,label,false));strict++;}
    const unknown=structuredClone(after);unknown.tables.unknown_after_rollback=[];A.throws(()=>build(c,false,[])(after,unknown,label,false));strict++;
  }
  const records=['100644 blob '+'1'.repeat(40)+'\tsrc/existing.js'],hash=M.sourcePairReviewedTreeHash(records),record=file=>'100644 blob '+'2'.repeat(40)+'\t'+file;
  for(const file of ['src/customervaults.js','src/crossdocking.js','public/index.html','tools/mobile.js','schema.sql','package.json','.github/workflows/ci.yml','test/lib/phase2-architecture-upgrade-catalog.json'])A.notEqual(M.sourcePairReviewedTreeHash([...records,record(file)]),hash);
  for(const file of ['tools/rc1-source-pair.js','test/rc1-source-pair-additive.js','docs/rc1-source-pair-additive-review.md',...M.ADDITIVE_KNOWLEDGE_OUTPUTS])A.equal(M.sourcePairReviewedTreeHash([...records,record(file)]),hash);
  console.log('rc1-source-pair combined Root+market EMPTY bootstrap PASS: '+negatives+' refusals; '+dispatch+' exact selectors; '+strict+' strict phases;14EMPTY/159structural/144NN; no native, financial or deployment clearance');
}
