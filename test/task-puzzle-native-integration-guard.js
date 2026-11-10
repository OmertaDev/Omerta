// Current entrypoints must refuse unauthorized callers before touching a backend.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as quest from '../tools/questing-ux-release-phase2-native-catalog.js';
import { questingCatalogSource } from '../tools/questing-enterprise-catalog.js';
const raw=fs.readFileSync('schema.sql','utf8');assert.throws(()=>questingCatalogSource(raw));
assert.equal(typeof quest.assertTaskPuzzlePhase2SourceInputs,'function','Current Phase2 needs a separate586 admission');
const enterprise=await import('../tools/task-puzzle-enterprise-catalog.js').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND'&&error.url?.endsWith('/tools/task-puzzle-enterprise-catalog.js'))return {};throw error;});
assert.equal(typeof enterprise.verifyTaskPuzzleEnterpriseCatalog,'function','Current Enterprise needs a separate586 catalog lane');
let nativeAttempts=0,refusals=0;const forbidden={query(){nativeAttempts++;throw Error('No backend may be queried by pure guards');},connect(){nativeAttempts++;throw Error('No connection may be opened by pure guards');}};
for(const fn of [()=>quest.assertTaskPuzzlePhase2SourceInputs(),()=>quest.assertTaskPuzzlePhase2SourceInputs({}),()=>quest.assertQuestingPhase2SourceInputs()]){assert.throws(fn,error=>error?.code==='ERR_ASSERTION');refusals++;}
for(const fn of [()=>enterprise.verifyTaskPuzzleEnterpriseCatalog(forbidden,'postgres://pilot_runner@127.0.0.1:35439/enterprise_native_catalog_test_123456789abc',raw),
  ()=>enterprise.verifyTaskPuzzleEnterpriseCatalog(forbidden,'postgres://pilot_runner@127.0.0.1:5432/production',raw),
  ()=>quest.createTaskPuzzleReleasePhase2MigrationCatalog(forbidden,'postgres://pilot_runner@127.0.0.1:35439/omerta_check',raw,{legacyProfile:'phase2',includeNotNull:true}),
  ()=>quest.verifyTaskPuzzleNativeBranches(forbidden,'postgres://pilot_runner@127.0.0.1:35439/omerta_check'),
  ()=>quest.verifyTaskPuzzleReleasePhase2CausalNegatives(forbidden,{},[],()=>{}),
  ()=>quest.createCommerceReleasePhase2MigrationCatalog(forbidden,'postgres://pilot_runner@127.0.0.1:35439/omerta_check',raw,{legacyProfile:'phase2',includeNotNull:true})]){await assert.rejects(fn,error=>error?.code==='ERR_ASSERTION');refusals++;}
assert.equal(nativeAttempts,0);
// Original strict585 catalog engine and pins are not silently rewritten.
const retained=execFileSync('git',['show','73d8d41dd7aec4768bd0aee9118d2a3930844aa6:tools/questing-enterprise-catalog.js']);
assert.equal(crypto.createHash('sha256').update(fs.readFileSync('tools/questing-enterprise-catalog.js','utf8').replaceAll('\r\n','\n')).digest('hex'),crypto.createHash('sha256').update(retained).digest('hex'));
console.log(JSON.stringify({phase:'TASK_PUZZLE586_ENTRY_REFUSALS',refusals,nativeAttempts,priorResultsTransferred:false}));

// Exact outer conservation is tested independently of regenerated source metadata.
const git=(...args)=>execFileSync('git',['--no-replace-objects',...args],{encoding:'utf8',maxBuffer:32e6});
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const helperFile='tools/questing-ux-release-phase2-native-catalog.js';
const helperEdits=[
  ["export function assertQuestingPhase2SourceInputs() {\n  assert.equal(arguments.length, 0);", "export function assertQuestingPhase2SourceInputs() {\n  assert.equal(arguments.length, 0); return phase2SourceInputs(false);\n}\nexport function assertTaskPuzzlePhase2SourceInputs() {\n  assert.equal(arguments.length, 0); return phase2SourceInputs(true);\n}\nfunction phase2SourceInputs(taskPuzzle) {"],
  ["'tools/questing-enterprise-catalog.js', 'test/questing-ux-release-phase2-native-catalog-guard.js', caller];", "'tools/questing-enterprise-catalog.js', 'test/questing-ux-release-phase2-native-catalog-guard.js', caller,\n    ...(taskPuzzle ? ['tools/task-puzzle-native-catalog.js', 'tools/task-puzzle-enterprise-catalog.js',\n      'test/task-puzzle-native-catalog-guard.js', 'test/task-puzzle-native-integration-guard.js'] : [])];"],
  ['  assert.equal(questSha(raw), QUESTING_CATALOG_SOURCE.sha256);','  if (taskPuzzle) taskPuzzleCatalogSource(raw);\n  else assert.equal(questSha(raw), QUESTING_CATALOG_SOURCE.sha256);'],
  ['  const actual = questActualInput(input);\n  await assertNativeCaller(pool, endpoint, options?.legacyProfile, options?.includeNotNull);','  const actual = questActualInput(input);\n  return createQuestCatalogComparison(pool, endpoint, actual, options);\n}\nasync function createQuestCatalogComparison(pool, endpoint, actual, options) {\n  await assertNativeCaller(pool, endpoint, options?.legacyProfile, options?.includeNotNull);'],
  ["  const actual = questActualInput(fs.readFileSync(path.join(questRoot, 'schema.sql'), 'utf8'));\n  await assertNativeCaller(pool, endpoint, 'fresh', true);", "  const actual = questActualInput(fs.readFileSync(path.join(questRoot, 'schema.sql'), 'utf8'));\n  return verifyQuestCatalogComparison(pool, endpoint, actual);\n}\nasync function verifyQuestCatalogComparison(pool, endpoint, actual) {\n  await assertNativeCaller(pool, endpoint, 'fresh', true);"],
];
const readerImport="import { ageRemovalHistoricalInput, ageRemovalHistoricalEntry } from '../../tools/age-removal-source-transfer.js';\n";
const readerOuter="  // Actual whole bytes and Git entry qualify above; only this pure comparison uses the outer view.\n  input = ageRemovalHistoricalInput(file, input);\n  entry = ageRemovalHistoricalEntry(file, entry, 'tree');\n";
const preservedFiles=[helperFile,'test/lib/questing-ux-native-reader-source-compatibility.js','test/lib/questing-ux-director-reader-source-compatibility.js','test/lib/questing-ux-enterprise-reader-source-compatibility.js'];
let conserved=0,conservationRefusals=0;
for(const file of preservedFiles){
  const old=git('show','73d8d41dd7aec4768bd0aee9118d2a3930844aa6:'+file),text=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
  const restore=input=>{
    assert.equal(typeof input,'string');let source=input.replaceAll('\r\n','\n');assert(!source.includes('\r')&&(input===source||input===source.replaceAll('\n','\r\n')));
    if(file===helperFile){
      const marker='\n// Distinct current586 admission;';assert.equal(source.split(marker).length,2);const at=source.indexOf(marker);
      assert.equal(sha(source.slice(at)),'2f8b604cd3c6980d0a62ad11cb4bb0ebca2edfed73ecb06bf3ed4bbb1689b6e2','Exact added current admission, same-client comparison and rollback implementation');source=source.slice(0,at);
      for(const[before,after]of helperEdits.toReversed()){assert.equal(source.split(after).length,2);source=source.replace(after,()=>before);}
    }else{
      assert(source.startsWith(readerImport));source=source.slice(readerImport.length);assert.equal(source.split(readerOuter).length,2);source=source.replace(readerOuter,'');
    }
    assert.equal(source,old,'Every prior byte and protected585 assertion survives only the literal outer bridge');return true;
  };
  assert(restore(text));assert(restore(text.replaceAll('\n','\r\n')));conserved++;
  for(const bad of [text+'\n',text.slice(1),'\ufeff'+text,text.replace('\n','\r\n'),text.replace('assert.equal','assert.notEqual')]){assert.throws(()=>restore(bad));conservationRefusals++;}
}
const nativeFile='tools/enterprise-native-questing.js',oldNative=git('show','73d8d41dd7aec4768bd0aee9118d2a3930844aa6:'+nativeFile);
const support="  'tools/task-puzzle-native-catalog.js', 'tools/task-puzzle-enterprise-catalog.js',\n  'test/task-puzzle-native-catalog-guard.js', 'test/task-puzzle-native-integration-guard.js',\n";
const native=fs.readFileSync(nativeFile,'utf8').replaceAll('\r\n','\n');assert.equal(native.split(support).length,2);assert.equal(native.replace(support,''),oldNative,'All16 native tuples, ordering, capture, deadlines and cleanup remain byte-exact');
console.log(JSON.stringify({phase:'TASK_PUZZLE586_OUTER_CONSERVATION',conserved,conservationRefusals,nativeAttempts:0}));

const {ageRemovalHistoricalInput}=await import('../tools/age-removal-source-transfer.js');
const {deedQuestSourceBaseline}=await import('../tools/deed-quest-source-transfer.js');
const frozenFile='tools/enterprise-deed-release-phase2-migration-catalog.js';
const frozenRaw=fs.readFileSync(frozenFile,'utf8').replaceAll('\r\n','\n');
const frozenView=input=>deedQuestSourceBaseline(frozenFile,ageRemovalHistoricalInput(frozenFile,input));
assert.equal(sha(frozenView(frozenRaw)),'8ed9ee0e08e9bbbc25bc921ea5ec96e4de495121454b0e21857a7d318f31a49e','The missing outer reader restores exactly the unchanged historical guard hash');
for(const bad of [frozenRaw+'\n',frozenRaw.slice(1),'\ufeff'+frozenRaw,frozenRaw.replace('\n','\r\n')])assert.notEqual(sha(frozenView(bad)),'8ed9ee0e08e9bbbc25bc921ea5ec96e4de495121454b0e21857a7d318f31a49e');
console.log(JSON.stringify({phase:'TASK_PUZZLE_FROZEN_READER_BOUNDARY',positives:1,refusals:4,nativeAttempts:0}));
