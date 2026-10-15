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
assert.equal(commercialMainPin.predecessor, '5c18acaaf47c84851729b82354340c4d56734dd9');
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
  assert.equal(pin.predecessor, 'f43cd963e8af7b8ada65d7f908331ceb606868d5');
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
