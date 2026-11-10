// Current entrypoints must refuse unauthorized callers before touching a backend.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parse } from 'acorn';
import { commerceCurrentDeedSources } from '../tools/commerce-deed-release-phase2-native-catalog.js';
import { ageRemovalHistoricalInput } from '../tools/age-removal-source-transfer.js';
import { deedQuestSourceBaseline } from '../tools/deed-quest-source-transfer.js';
import { questingCatalogSource } from '../tools/questing-enterprise-catalog.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as immutablePredecessor, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as immutablePredecessorHash } from '../tools/enterprise-native-contract-release-inputs.js';
// Historical source comparison may evolve only above the unchanged native helpers.
// Verify all60 original immutable records before the public reader regression.
const roundGit=(...args)=>execFileSync('git',['--no-replace-objects',...args],{encoding:'utf8',windowsHide:true,maxBuffer:32e6});
const commerceFile='tools/commerce-deed-release-phase2-native-catalog.js';
const immutableFile='tools/enterprise-native-contract-release-inputs.js';
assert.equal(fs.readFileSync(immutableFile,'utf8').replaceAll('\r\n','\n'),roundGit('show','0992cf178fdd31144cc9758b22e06ac847e1000f:'+immutableFile),'The complete original immutable definition, including its pin set, is retained');
const immutableSha=value=>crypto.createHash('sha256').update(value).digest('hex');
assert.equal(immutableSha(JSON.stringify(immutablePredecessor)),immutablePredecessorHash);
const immutableInputs=immutablePredecessor.files.filter(({file})=>/^tools\/[^/]*native[^/]*\.js$/.test(file)||/^test\/lib\/[^/]*native[^/]*\.js$/.test(file)||file==='test/enterprise-native-guard.js');
assert.equal(immutableInputs.length,60,'The original closed predecessor protection is not reduced');
const immutableRecord=(pin,input)=>{
  assert.equal(input.head,pin.mode+' blob '+pin.blob+'\t'+pin.file,'Original immutable HEAD record: '+pin.file);
  assert.equal(input.index,pin.mode+' '+pin.blob+' 0\t'+pin.file,'Original immutable index record: '+pin.file);
  assert.equal(input.regular,true);assert.equal(input.symbolic,false);
  const lf=input.physical.replaceAll('\r\n','\n');assert(!lf.includes('\r')&&(input.physical===lf||input.physical===lf.replaceAll('\n','\r\n')));
  assert.equal(immutableSha(lf),pin.sha256,'Original immutable physical SHA: '+pin.file);
  assert.equal(crypto.createHash('sha1').update('blob '+Buffer.byteLength(lf)+'\0').update(lf).digest('hex'),pin.blob);
};
let immutableRefusals=0;
for(const pin of [...immutableInputs,{file:'tools/enterprise-deed-release-phase2-migration-catalog.js',mode:'100644',blob:'f72928e9f6db7c23601bdffdfe842a8a82124962',sha256:'d9ce65cc618b419f7be1efca0c7926d7f72cd28a21abbdc4e7f86a0f14672ef7'}]){
  const stat=fs.lstatSync(pin.file),input={head:roundGit('ls-tree','HEAD','--',pin.file).trim(),index:roundGit('ls-files','--stage','--',pin.file).trim(),physical:fs.readFileSync(pin.file,'utf8'),regular:stat.isFile(),symbolic:stat.isSymbolicLink()};
  immutableRecord(pin,input);immutableRecord(pin,{...input,physical:input.physical.replaceAll('\r\n','\n').replaceAll('\n','\r\n')});
  for(const changed of [{...input,physical:input.physical+'\n'},{...input,head:input.head.replace(pin.blob,'0'.repeat(40))},{...input,index:input.index.replace(pin.mode,'120000')},{...input,symbolic:true}]){assert.throws(()=>immutableRecord(pin,changed));immutableRefusals++;}
}
assert.equal(fs.readFileSync('tools/questing-ux-release-phase2-native-catalog.js','utf8').replaceAll('\r\n','\n'),roundGit('show','0992cf178fdd31144cc9758b22e06ac847e1000f:tools/questing-ux-release-phase2-native-catalog.js'),'Undo only the obsolete round1 enclosing view; every reviewed current586 byte is retained');
console.log(JSON.stringify({phase:'TASK_PUZZLE_ORIGINAL_NATIVE_RECORDS',immutableRecords:immutableInputs.length,restoredHelpers:2,immutableRefusals,nativeAttempts:0}));
const commerceSource=roundGit('show','52c582d7859843e02f45ed5d5c2377c996dd43da:schema.sql');
assert.equal(crypto.createHash('sha256').update(commerceSource).digest('hex'),'833373245ddb1ce5a3c9ed386a9b3245d81ddb0bdb51e75d1e5ffee2a7684335');
for(const input of [commerceSource,commerceSource.replaceAll('\n','\r\n')])assert.equal(commerceCurrentDeedSources(input).current,commerceSource);
let commerceSourceRefusals=0;
for(const input of [commerceSource+'\n',commerceSource.slice(1),'\ufeff'+commerceSource,commerceSource.replace('\n','\r\n'),commerceSource.replace('DEFAULT 0','DEFAULT 42'),fs.readFileSync('schema.sql','utf8'),roundGit('cat-file','blob','86b671c5d6f6928ff3e66f1ad0fca5f46a7364e3'),null]){
  assert.throws(()=>commerceCurrentDeedSources(input),error=>error?.code==='ERR_ASSERTION');commerceSourceRefusals++;
}
// Execute the actual private comparison with a read-only file double for mutation controls.
// Its complete source is conserved above; imports, raw SQL and native admission are untouched.
const commerceText=fs.readFileSync(commerceFile,'utf8').replaceAll('\r\n','\n');
const commerceNodes=parse(commerceText,{ecmaVersion:'latest',sourceType:'module'}).body;
const protectedNode=commerceNodes.find(node=>node.type==='FunctionDeclaration'&&node.id.name==='assertCommerceDeedProtectedSources');
const uniformNode=commerceNodes.find(node=>node.type==='VariableDeclaration'&&node.declarations.some(row=>row.id.name==='commerceDeedUniform'));
assert(protectedNode&&uniformNode);
const protectedPins=JSON.parse(commerceText.match(/const COMMERCE_DEED_PROTECTED=(\{.*\});/)[1]);assert.equal(Object.keys(protectedPins).length,8);
const protectedUrls=new Map(Object.keys(protectedPins).map(file=>[new URL('../'+file,import.meta.url).href,file]));
const runProtected=(target,transform)=>{
  const readOnly={readFileSync(url,encoding){assert.equal(encoding,'utf8');const file=protectedUrls.get(url.href);assert(file,'Only the eight exact protected source reads');const value=fs.readFileSync(file,encoding);return file===target?transform(value.replaceAll('\r\n','\n')):value;}};
  const body=commerceText.slice(uniformNode.start,uniformNode.end)+'\n'+commerceText.slice(protectedNode.start,protectedNode.end).replaceAll('import.meta.url',JSON.stringify(new URL('../'+commerceFile,import.meta.url).href))+'\nassertCommerceDeedProtectedSources();';
  new Function('assert','COMMERCE_DEED_PROTECTED','fs','URL','hash','deedQuestSourceBaseline',body)(assert,protectedPins,readOnly,URL,value=>crypto.createHash('sha256').update(value).digest('hex'),deedQuestSourceBaseline);
};
runProtected();let protectedSourceRefusals=0;
for(const file of Object.keys(protectedPins)){
  runProtected(file,input=>input);runProtected(file,input=>input.replaceAll('\n','\r\n'));
  for(const transform of [input=>input+'\n',input=>input.slice(1),input=>'\ufeff'+input,input=>input.replace('\n','\r\n'),input=>input.slice(0,-1),input=>input+'// unreviewed\n']){
    assert.throws(()=>runProtected(file,transform),error=>error?.code==='ERR_ASSERTION');protectedSourceRefusals++;
  }
}
console.log(JSON.stringify({phase:'TASK_PUZZLE_COMMERCE_READER_REGRESSION',publicPositives:2,commerceSourceRefusals,immutableRecords:immutableInputs.length,restoredHelpers:2,immutableRefusals,protectedInputs:8,protectedSourceRefusals,nativeAttempts:0}));
// Keep the public regression independently observable before metadata-dependent module checks.
const quest=await import('../tools/questing-ux-release-phase2-native-catalog.js');
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

const frozenFile='tools/enterprise-deed-release-phase2-migration-catalog.js';
const frozenRaw=fs.readFileSync(frozenFile,'utf8').replaceAll('\r\n','\n');
const frozenView=input=>deedQuestSourceBaseline(frozenFile,ageRemovalHistoricalInput(frozenFile,input));
assert.equal(sha(frozenView(frozenRaw)),'8ed9ee0e08e9bbbc25bc921ea5ec96e4de495121454b0e21857a7d318f31a49e','The missing outer reader restores exactly the unchanged historical guard hash');
for(const bad of [frozenRaw+'\n',frozenRaw.slice(1),'\ufeff'+frozenRaw,frozenRaw.replace('\n','\r\n')])assert.notEqual(sha(frozenView(bad)),'8ed9ee0e08e9bbbc25bc921ea5ec96e4de495121454b0e21857a7d318f31a49e');
console.log(JSON.stringify({phase:'TASK_PUZZLE_FROZEN_READER_BOUNDARY',positives:1,refusals:4,nativeAttempts:0}));
