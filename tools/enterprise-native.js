import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ENTERPRISE_NATIVE_BASE_REVISION,ENTERPRISE_NATIVE_FILES as HISTORICAL_ENTERPRISE_NATIVE_FILES,ENTERPRISE_NATIVE_BASE_INPUTS,ENTERPRISE_NATIVE_BINARY_FILES,ENTERPRISE_NATIVE_DIRECTORY_MEMBERSHIPS,ENTERPRISE_NATIVE_COMMERCE_GUI_INPUTS} from './enterprise-native-inputs.js';
import {ENTERPRISE_NATIVE_CONTINUOUS_CITY_INPUTS} from './enterprise-native-continuous-city-inputs.js';

const SUCCESSOR_DATA='tools/enterprise-native-continuous-city-inputs.js';
const SUCCESSOR_PREDECESSOR='792f1da708375fc28fca6fe9c4fb9c2c7c756ee6';
// Closed GUI and bridge import/read closure; historical boot assets and inputs remain intact.
export const ENTERPRISE_NATIVE_SUCCESSOR_REPLACEMENT_FILES=Object.freeze([
 'package.json',
 'public/city-scene.js',
 'public/city-world-ui.css',
 'public/city-world-ui.js',
 'public/index.html',
 'src/agentgateway.js',
 'src/cityhomes.js',
 'src/server.js',
 'test/enterprise-current-source-compatibility.js',
 'test/lib/rc1-historical-source-fixture.js',
 'test/market-operations-source-compatibility.js',
 'test/next-layer-source-compatibility.js',
 'test/rc1-city-gameplay-source-compatibility.js',
 'test/rc1-first-batch-source-compatibility.js',
]);
export const ENTERPRISE_NATIVE_SUCCESSOR_ADDITIONAL_FILES=Object.freeze([
 'public/city-world-layout.js',
 'test/city-connected-scene-browser.js',
 'test/city-homes-api.js',
 'test/city-scene-browser.js',
 'test/city-world-host-browser.js',
 'test/city-world-layout-ui-browser.js',
 'test/city-world-layout.js',
 'test/continuous-city-host-contract.js',
 'test/continuous-city-source-compatibility.js',
 'test/deed-discovery-fixture.js',
 'test/deed-quest-source-compatibility.js',
 'test/economy-release-composition.js',
 'test/next-five-source-compatibility.js',
 'test/player-intel-source-compatibility.js',
 'test/rc1-business-season-source-compatibility.js',
 'test/rc1-buyer-cooperative-source-compatibility.js',
 'test/rc1-checkpoint-recovery-review.js',
 'test/rc1-commercial-premises-source-compatibility.js',
 'test/rc1-commercial-reputation-source-compatibility.js',
 'test/rc1-company-bank-source-compatibility.js',
 'test/rc1-company-logistics-hub-source-compatibility.js',
 'test/rc1-company-operator-source-compatibility.js',
 'test/rc1-company-opportunity-source-compatibility.js',
 'test/rc1-company-succession-source-compatibility.js',
 'test/rc1-company-workflow-source-compatibility.js',
 'test/rc1-fifth-batch-source-compatibility.js',
 'test/rc1-fourth-batch-source-compatibility.js',
 'test/rc1-game-employment-source-compatibility.js',
 'test/rc1-intel-source-compatibility.js',
 'test/rc1-invoice-source-compatibility.js',
 'test/rc1-lifecycle-applicability.js',
 'test/rc1-logistics-coverage-source-compatibility.js',
 'test/rc1-market-feed-source-compatibility.js',
 'test/rc1-second-batch-source-compatibility.js',
 'test/rc1-strategy-league-source-compatibility.js',
 'test/rc1-strategy-source-compatibility.js',
 'test/rc1-third-batch-source-compatibility.js',
 'test/rc1-world-checkpoint-series.js',
 'test/rc1-world-qualification.js',
 'test/release-source-transfer.js',
 'tools/continuous-city-fixture-source-data.js',
 'tools/continuous-city-source-compatibility.js',
 'tools/continuous-city-source-data.js',
 'tools/genesis-auction-deployment-plan.js',
 'tools/genesis-auction-preflight.js',
 'tools/market-v2-deployment-plan.js',
]);
export const ENTERPRISE_NATIVE_FILES=Object.freeze([...HISTORICAL_ENTERPRISE_NATIVE_FILES,...ENTERPRISE_NATIVE_COMMERCE_GUI_INPUTS.additions.map(row=>row.file)]);
const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const ENTERPRISE_NATIVE_PROOFS=Object.freeze([
 ['workshopfloor','WORKSHOP_FLOOR_TEST_DATABASE_URL','workshop_floor_test_',35439,300000],
 ['workshopfloor-recipes','WORKSHOP_FLOOR_TEST_DATABASE_URL','workshop_floor_test_',35439,300000],
 ['workshopfloor-capacity','WORKSHOP_FLOOR_TEST_DATABASE_URL','workshop_floor_test_',35439,300000],
 ['workshopfloor-adversarial','WORKSHOP_FLOOR_TEST_DATABASE_URL','workshop_floor_test_',35439,300000],
 ['workshopfloor-expiry','WORKSHOP_FLOOR_TEST_DATABASE_URL','workshop_floor_test_',35439,300000],
 ['workshopfloor-estate','WORKSHOP_FLOOR_TEST_DATABASE_URL','workshop_floor_test_',35439,300000],
 ['workshopfloor-api','WORKSHOP_FLOOR_TEST_DATABASE_URL','workshop_floor_test_',35439,300000],
 ['workshopfloor-acquisition-compatibility','DEPOT_ACQUISITION_RUNTIME_TEST_DATABASE_URL','depot_acquisition_runtime_test_',35439,300000],
 ['businessrelocation-acquisition-negative','DEPOT_ACQUISITION_RUNTIME_TEST_DATABASE_URL','depot_acquisition_runtime_test_',35439,300000],
 ['mobileshops-integration','MOBILE_SHOP_INTEGRATION_TEST_DATABASE_URL','mobile_shop_integration_test_',35449,300000],
 ['businessrelocation-native','BUSINESS_RELOCATION_TEST_DATABASE_URL','business_relocation_test_',35439,300000],
 ['manufacturinglicenses-native','MANUFACTURING_LICENSE_NATIVE_TEST_DATABASE_URL','manufacturing_license_native_test_',35439,300000],
 ['manufacturinglicenses-native-estate','MANUFACTURING_LICENSE_NATIVE_TEST_DATABASE_URL','manufacturing_license_native_test_',35439,300000],
 ['manufacturinglicenses-native-acquisition','MANUFACTURING_LICENSE_NATIVE_TEST_DATABASE_URL','manufacturing_license_native_test_',35439,300000],
 ['equipmentrecovery-native','EQUIPMENT_RECOVERY_NATIVE_TEST_DATABASE_URL','equipment_recovery_native_test_',35439,300000],
 ['enterprise-release-phase2-migration-catalog','ENTERPRISE_NATIVE_CATALOG_TEST_DATABASE_URL','enterprise_native_catalog_test_',35439,600000],
].map(row=>Object.freeze(row)));
const INVENTORY=JSON.stringify(ENTERPRISE_NATIVE_PROOFS);
const STAGED=Object.freeze(['tools/enterprise-native.js','test/enterprise-native-guard.js','tools/enterprise-native-inputs.js']);
// The combined definition resides in the existing catalogue; no extra metadata exemption.
const SUCCESSOR_STAGED=STAGED;
const ADMINS=Object.freeze({35439:'postgresql://pilot_runner@127.0.0.1:35439/postgres',35449:'postgresql://pilot_runner@127.0.0.1:35449/postgres',5432:'postgresql://postgres:pgcheck@127.0.0.1:5432/postgres'});
const DIRECTORIES=Object.freeze({35439:'c:/users/jorge/appdata/local/temp/omerta-economy-oct15-pg184',35449:'c:/users/jorge/appdata/local/temp/omerta-employment-pg184-proof'});
const LEGAL=Object.freeze({LEGAL_OPERATOR_NAME:'CI Test Operator',LEGAL_POSTAL_ADDRESS:'123 Fixture Street, Test City',PRIVACY_CONTACT_EMAIL:'privacy@example.test',DMCA_AGENT_NAME:'CI Test Agent',DMCA_AGENT_EMAIL:'copyright@example.test',DMCA_AGENT_ADDRESS:'123 Fixture Street, Test City',DMCA_AGENT_PHONE:'+1 202 555 0100',DMCA_AGENT_REGISTERED:'true',PAYMENT_REFUND_POLICY:'Test fixture policy; not a production policy.'});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',['--no-optional-locks','--no-replace-objects',...args],{cwd:ROOT,maxBuffer:64*1024*1024,windowsHide:true});
const textGit=(...args)=>git(...args).toString().trim();
export function assertEnterpriseInventory(rows){assert.equal(JSON.stringify(rows),INVENTORY,'Only the exact ordered sixteen proofs and original deadlines/profiles are permitted');}
export function assertEnterpriseNativeMode(argv,env,execArgv=process.execArgv){
 assert.deepEqual(execArgv,[],'Bare Node only');assert.equal(argv.length,2,'No partial/filter/root/alternate fixture arguments');
 const profile=env.ENTERPRISE_NATIVE_PROFILE;assert(profile==='local'||profile==='ci','Explicit closed local or ci profile required');
 const keys=profile==='local'?['ENTERPRISE_NATIVE_PROFILE','ENTERPRISE_NATIVE_ADMIN39_DATABASE_URL','ENTERPRISE_NATIVE_ADMIN49_DATABASE_URL']:['ENTERPRISE_NATIVE_PROFILE','ENTERPRISE_NATIVE_CI_ADMIN_DATABASE_URL'];
 for(const key of Object.keys(env)){const upper=key.toUpperCase();if(upper.startsWith('ENTERPRISE_NATIVE_'))assert(keys.includes(key),'Unknown/aliased parent selector: '+key);if(/DATABASE_URL$/i.test(key))assert(keys.includes(key)&&key!=='ENTERPRISE_NATIVE_PROFILE','No ambient database target: '+key);assert(!/^PG|^RC1/i.test(key)&&!['NODE_OPTIONS','NODE_PATH','NODE_PG_FORCE_NATIVE','LEGAL_PROFILE_DEFER','GENESIS_AUCTION_MANIFEST_PATH','GENESIS_AUCTION_MANIFEST_SHA256'].includes(upper),'No ambient backend/loader/rehearsal/legal/external-manifest override: '+key);}
 for(const key of keys)assert(Object.hasOwn(env,key),'Explicit own profile/admin setting required: '+key);assert.equal(env.CHAIN_ENABLED,'off');assert.equal(env.RESOURCE_ECONOMY,'off');
 if(profile==='local'){assert.equal(env.ENTERPRISE_NATIVE_ADMIN39_DATABASE_URL,ADMINS[35439]);assert.equal(env.ENTERPRISE_NATIVE_ADMIN49_DATABASE_URL,ADMINS[35449]);}else assert.equal(env.ENTERPRISE_NATIVE_CI_ADMIN_DATABASE_URL,ADMINS[5432]);
 return profile;
}
export function assertEnterpriseNativeTrackedBytes(raw,canonical,binary){
 assert(Buffer.isBuffer(raw)&&Buffer.isBuffer(canonical));assert.equal(typeof binary,'boolean');
 if(raw.equals(canonical))return;
 assert(!binary,'Binary inputs must match exact Git bytes');const a=raw.toString('utf8'),b=canonical.toString('utf8');assert(Buffer.from(a).equals(raw)&&Buffer.from(b).equals(canonical),'Lossless UTF8 text required');assert(!a.includes('\0')&&!b.includes('\0'));assert(!b.includes('\r'),'Canonical text must use Git LF');assert.equal(a,b.replaceAll('\n','\r\n'),'Only exact Git LF or uniform checkout CRLF');
}
export function assertEnterpriseInputDefinition(){
 assert.match(ENTERPRISE_NATIVE_BASE_REVISION,/^[a-f0-9]{40}$/);assert(Object.isFrozen(HISTORICAL_ENTERPRISE_NATIVE_FILES)&&Object.isFrozen(ENTERPRISE_NATIVE_BASE_INPUTS)&&Object.isFrozen(ENTERPRISE_NATIVE_BINARY_FILES));assert(Array.isArray(HISTORICAL_ENTERPRISE_NATIVE_FILES)&&HISTORICAL_ENTERPRISE_NATIVE_FILES.length>0);assert.equal(new Set(HISTORICAL_ENTERPRISE_NATIVE_FILES).size,HISTORICAL_ENTERPRISE_NATIVE_FILES.length);
 for(const f of HISTORICAL_ENTERPRISE_NATIVE_FILES)assert(typeof f==='string'&&!f.includes('\\')&&!f.includes(':')&&!f.includes('\0')&&!path.posix.isAbsolute(f)&&f.split('/').every(p=>p&&p!=='.'&&p!=='..'&&p!=='.git'),'Canonical relative input only');
 for(const f of STAGED)assert(HISTORICAL_ENTERPRISE_NATIVE_FILES.includes(f),'All parent/guard/data staged paths are captured');
 assert.equal(new Set(ENTERPRISE_NATIVE_BASE_INPUTS.map(x=>x.file)).size,ENTERPRISE_NATIVE_BASE_INPUTS.length);assert.deepEqual(ENTERPRISE_NATIVE_BASE_INPUTS.map(x=>x.file).sort(),HISTORICAL_ENTERPRISE_NATIVE_FILES.filter(f=>!STAGED.includes(f)).slice().sort());
 for(const r of ENTERPRISE_NATIVE_BASE_INPUTS){assert(Object.isFrozen(r));assert.deepEqual(Object.keys(r).sort(),['file','blob','sha256'].sort());assert.match(r.blob,/^[a-f0-9]{40}$/);assert.match(r.sha256,/^[a-f0-9]{64}$/);}
 assert.equal(new Set(ENTERPRISE_NATIVE_BINARY_FILES).size,ENTERPRISE_NATIVE_BINARY_FILES.length);for(const f of ENTERPRISE_NATIVE_BINARY_FILES)assert(ENTERPRISE_NATIVE_FILES.includes(f)&&!STAGED.includes(f));for(const[name]of ENTERPRISE_NATIVE_PROOFS)assert(ENTERPRISE_NATIVE_FILES.includes('test/'+name+'.js'));assert(ENTERPRISE_NATIVE_FILES.includes('src/server.js'),'Whole actual directory-predicate source is pinned');
 assert(Object.isFrozen(ENTERPRISE_NATIVE_DIRECTORY_MEMBERSHIPS));assert.deepEqual(ENTERPRISE_NATIVE_DIRECTORY_MEMBERSHIPS.map(r=>r.directory),['public/art','public/art/hype']);for(const r of ENTERPRISE_NATIVE_DIRECTORY_MEMBERSHIPS){assert(Object.isFrozen(r)&&Object.isFrozen(r.eligibleNames));assert.deepEqual(Object.keys(r).sort(),['directory','eligibleNames'].sort());assert.equal(new Set(r.eligibleNames).size,r.eligibleNames.length);assert.deepEqual(r.eligibleNames,[...r.eligibleNames].sort());for(const name of r.eligibleNames)assert(ENTERPRISE_NATIVE_FILES.includes(r.directory+'/'+name));assertEnterpriseDirectoryEntries(r.directory,r.eligibleNames);}
}
export function assertEnterpriseSuccessorInputDefinition(manifest,basis){
 assert(basis&&Object.isFrozen(basis),'Explicit immutable historical E basis required; never current combined authority');const{baseRevision:ENTERPRISE_NATIVE_BASE_REVISION,baseInputs:ENTERPRISE_NATIVE_BASE_INPUTS,files:HISTORICAL_ENTERPRISE_NATIVE_FILES}=basis;
 assert.equal(manifest.status,'SEALED','Commit actual authored source before sealing native successor inputs');
 assert(Object.isFrozen(manifest)&&Object.isFrozen(manifest.replacements)&&Object.isFrozen(manifest.additions));
 assert.deepEqual(Object.keys(manifest).sort(),['status','revision','predecessor','legacyBaseRevision','replacements','additions'].sort());
 assert.match(manifest.revision,/^[a-f0-9]{40}$/);assert.equal(manifest.predecessor,SUCCESSOR_PREDECESSOR);assert.equal(manifest.legacyBaseRevision,ENTERPRISE_NATIVE_BASE_REVISION);
 const old=new Map(ENTERPRISE_NATIVE_BASE_INPUTS.map(row=>[row.file,row])),seen=new Set();
 const pin=value=>{assert(Object.isFrozen(value));assert.deepEqual(Object.keys(value).sort(),['blob','sha256','mode'].sort());assert.match(value.blob,/^[a-f0-9]{40}$/);assert.match(value.sha256,/^[a-f0-9]{64}$/);assert(['100644','100755'].includes(value.mode));};
 for(const row of manifest.replacements){
  assert(Object.isFrozen(row)&&Object.isFrozen(row.before));assert.deepEqual(Object.keys(row).sort(),['file','before','after'].sort());assert(old.has(row.file)&&!seen.has(row.file),'Unique existing historical pin replacement required');seen.add(row.file);
  assert.deepEqual(Object.keys(row.before).sort(),['blob','sha256'].sort());assert.equal(row.before.blob,old.get(row.file).blob,'Historical blob pin remains immutable');assert.equal(row.before.sha256,old.get(row.file).sha256,'Historical SHA256 pin remains immutable');
  pin(row.after);assert.notEqual(row.after.blob,row.before.blob,'Only actual changed authored inputs belong in the delta');assert.notEqual(row.after.sha256,row.before.sha256);
 }
 for(const row of manifest.additions){
  assert(Object.isFrozen(row));assert.deepEqual(Object.keys(row).sort(),['file','blob','sha256','mode'].sort());
  const f=row.file;assert(typeof f==='string'&&!f.includes('\\')&&!f.includes(':')&&!f.includes('\0')&&!path.posix.isAbsolute(f)&&f.split('/').every(p=>p&&p!=='.'&&p!=='..'&&p!=='.git'),'Canonical relative successor input only');
  assert(!HISTORICAL_ENTERPRISE_NATIVE_FILES.includes(f)&&f!==SUCCESSOR_DATA&&!seen.has(f),'Only unique additional inputs; no new metadata exemptions');seen.add(f);
  assert.match(row.blob,/^[a-f0-9]{40}$/);assert.match(row.sha256,/^[a-f0-9]{64}$/);assert(['100644','100755'].includes(row.mode));
 }
 assert.deepEqual(manifest.replacements.map(row=>row.file).sort(),[...ENTERPRISE_NATIVE_SUCCESSOR_REPLACEMENT_FILES],'Complete closed authored replacement set required');
 assert.deepEqual(manifest.additions.map(row=>row.file).sort(),[...ENTERPRISE_NATIVE_SUCCESSOR_ADDITIONAL_FILES],'Complete closed GUI/bridge helper, data, test, asset, and physical-read additions required');
}
export function assertEnterpriseSuccessorTrackedInput(file,current,authored,canonical,manifest,basis){
 assert(basis&&Object.isFrozen(basis),'Explicit immutable historical E basis required');const{baseInputs:ENTERPRISE_NATIVE_BASE_INPUTS}=basis;
 const pin=manifest.replacements.find(row=>row.file===file)?.after||manifest.additions.find(row=>row.file===file)||ENTERPRISE_NATIVE_BASE_INPUTS.find(row=>row.file===file);
 assert(pin,'No undeclared runtime input: '+file);assert(Buffer.isBuffer(canonical));
 assert(current&&authored&&current.type==='blob'&&authored.type==='blob'&&['100644','100755'].includes(current.mode),'Regular current and authored source required: '+file);
 assert.equal(current.mode,authored.mode,'Actual authored mode drift: '+file);if(pin.mode)assert.equal(current.mode,pin.mode,'Sealed input mode drift: '+file);
 assert.equal(authored.blob,pin.blob,'Pin must name the actual committed authored source: '+file);
 assert.equal(current.blob,pin.blob,'Actual runtime input changed after authored seal: '+file);assert.equal(sha(canonical),pin.sha256,'Actual runtime bytes changed after authored seal: '+file);
}

const COMMERCE_SOURCE="a7319058183ff6420745be685cf39e39cc091a7e",COMMERCE_DEFINITION_SHA256="0b48fd7ba46c4b39f1dec0b61148236fa6f2b174a13518e6ce21d66267075447",COMMERCE_BASE="181422abe5312e24be5bd76ec56fe87454bda664";
const COMMERCE_PREFIX_SHA256="49f338f174e4ad10500857cc7cf1151c561f7854c810f0d1d95a52904bb05c03",COMMERCE_FIXED_SHA256="7bae0b97c7b72866e2740e31c23110be3087675fa29edfc9f927e8168040e4ba",COMMERCE_BINARY_SHA256="b5ed2b5b2596d2304b0677c2cbf065ca87911ee77d5c1c7e964c0d445e15e4ba",COMMERCE_DIRECTORIES_SHA256="29492ff3000f91feac695d24d18baae676f58c93aaeab2a9ae15b9e26f134716";
const GUI_SOURCE="3b2617aace9aabe94de816f6104783ebd62cb53b",GUI_WITNESS_PIN=Object.freeze({"file":"tools/enterprise-native-continuous-city-inputs.js","mode":"100644","blob":"f54c85b7fdf7c9e45c6543dbbecbc2fd6094b8ad","sha256":"cd27e2ee872445bd04d370b8ea80e0cb6f9c3db9ee1450ff65312ea2ac18e13a"}),GUI_AUTHORED_REVISION="7051faddd4beea253d0fb2f9693546c883e01ab5",GUI_LEGACY_BASE="5909e505513186136f19c0d76997359321594926";
export function assertEnterpriseCombinedInputDefinition(manifest=ENTERPRISE_NATIVE_COMMERCE_GUI_INPUTS){
 assert.equal(manifest?.status,'SEALED','Combined native inputs remain UNSEALED until Root compiles actual authored source');
 assertEnterpriseInputDefinition();assert(Object.isFrozen(manifest)&&Object.isFrozen(manifest.replacements)&&Object.isFrozen(manifest.additions));assert.deepEqual(Object.keys(manifest).sort(),['version','status','revision','commerceSource','commerceDefinitionSHA256','guiSource','guiWitnessSHA256','replacements','additions'].sort());
 assert.equal(manifest.version,1);assert.match(manifest.revision,/^[a-f0-9]{40}$/);assert.equal(manifest.commerceSource,COMMERCE_SOURCE);assert.equal(manifest.commerceDefinitionSHA256,COMMERCE_DEFINITION_SHA256);assert.equal(manifest.guiSource,GUI_SOURCE);assert.equal(manifest.guiWitnessSHA256,GUI_WITNESS_PIN.sha256);
 assert.equal(ENTERPRISE_NATIVE_BASE_REVISION,COMMERCE_BASE);assert.equal(sha(JSON.stringify(HISTORICAL_ENTERPRISE_NATIVE_FILES)),COMMERCE_PREFIX_SHA256,'Original ordered C prefix remains immutable');assert.equal(sha(JSON.stringify(ENTERPRISE_NATIVE_BASE_INPUTS)),COMMERCE_FIXED_SHA256,'Original C before pins remain immutable');assert.equal(sha(JSON.stringify(ENTERPRISE_NATIVE_BINARY_FILES)),COMMERCE_BINARY_SHA256);assert.equal(sha(JSON.stringify(ENTERPRISE_NATIVE_DIRECTORY_MEMBERSHIPS)),COMMERCE_DIRECTORIES_SHA256);
 const old=new Map(ENTERPRISE_NATIVE_BASE_INPUTS.map(row=>[row.file,row])),seen=new Set();const pin=value=>{assert(value&&Object.isFrozen(value));assert.deepEqual(Object.keys(value).sort(),['blob','sha256','mode'].sort());assert.match(value.blob,/^[a-f0-9]{40}$/);assert.match(value.sha256,/^[a-f0-9]{64}$/);assert(['100644','100755'].includes(value.mode));};
 for(const row of manifest.replacements){assert(row&&Object.isFrozen(row)&&Object.isFrozen(row.before));assert.deepEqual(Object.keys(row).sort(),['file','before','after'].sort());assert(old.has(row.file)&&!seen.has(row.file),'Unique fixed C replacement required');seen.add(row.file);assert.deepEqual(Object.keys(row.before).sort(),['blob','sha256'].sort());assert.deepEqual(row.before,{blob:old.get(row.file).blob,sha256:old.get(row.file).sha256});pin(row.after);assert.notEqual(row.after.blob,row.before.blob);assert.notEqual(row.after.sha256,row.before.sha256);assert(!ENTERPRISE_NATIVE_BINARY_FILES.includes(row.file),'Existing binary inputs remain unchanged');}
 for(const row of manifest.additions){assert(row&&Object.isFrozen(row));assert.deepEqual(Object.keys(row).sort(),['file','mode','blob','sha256'].sort());assert(typeof row.file==='string'&&!row.file.includes('\\')&&!row.file.includes(':')&&!row.file.includes('\0')&&!path.posix.isAbsolute(row.file)&&row.file.split('/').every(p=>p&&p!=='.'&&p!=='..'&&p!=='.git'),'Canonical relative combined addition only');assert(!HISTORICAL_ENTERPRISE_NATIVE_FILES.includes(row.file)&&!seen.has(row.file),'Addition must not collide with original C prefix');seen.add(row.file);pin(Object.freeze({mode:row.mode,blob:row.blob,sha256:row.sha256}));}
 assert.deepEqual(manifest.additions.find(row=>row.file===SUCCESSOR_DATA),GUI_WITNESS_PIN,'Original GUI witness is ordinary fixed captured input');
 return manifest;
}
export function assertEnterpriseCombinedTrackedInput(file,current,authored,canonical,manifest=ENTERPRISE_NATIVE_COMMERCE_GUI_INPUTS){
 const pin=manifest.replacements.find(row=>row.file===file)?.after||manifest.additions.find(row=>row.file===file)||ENTERPRISE_NATIVE_BASE_INPUTS.find(row=>row.file===file);assert(pin,'No undeclared combined input: '+file);assert(Buffer.isBuffer(canonical));assert(current&&authored&&current.type==='blob'&&authored.type==='blob'&&['100644','100755'].includes(current.mode),'Regular actual combined source required');assert.equal(current.mode,authored.mode,'Combined authored mode drift');if(pin.mode)assert.equal(current.mode,pin.mode);assert.equal(authored.blob,pin.blob,'Pin must name actual combined authored Git');assert.equal(current.blob,pin.blob,'Combined runtime source changed after seal');assert.equal(sha(canonical),pin.sha256,'Actual combined bytes changed after seal');
}
function assertHistoricalGUIWitness(){
 const manifest=ENTERPRISE_NATIVE_CONTINUOUS_CITY_INPUTS;assert.equal(manifest.status,'SEALED');assert.equal(manifest.revision,GUI_AUTHORED_REVISION);assert.equal(manifest.predecessor,SUCCESSOR_PREDECESSOR);assert.equal(manifest.legacyBaseRevision,GUI_LEGACY_BASE);assert.equal(sha(git('show',GUI_SOURCE+':'+SUCCESSOR_DATA)),GUI_WITNESS_PIN.sha256);assert.equal(sha(git('show',COMMERCE_SOURCE+':tools/enterprise-native-inputs.js')),COMMERCE_DEFINITION_SHA256);
 git('merge-base','--is-ancestor',GUI_LEGACY_BASE,SUCCESSOR_PREDECESSOR);git('merge-base','--is-ancestor',SUCCESSOR_PREDECESSOR,GUI_AUTHORED_REVISION);git('merge-base','--is-ancestor',GUI_AUTHORED_REVISION,GUI_SOURCE);
 const original=new Map(tree(GUI_LEGACY_BASE).map(row=>[row.file,row])),authored=new Map(tree(GUI_AUTHORED_REVISION).map(row=>[row.file,row])),gui=new Map(tree(GUI_SOURCE).map(row=>[row.file,row]));assert.equal(gui.get(SUCCESSOR_DATA)?.mode,GUI_WITNESS_PIN.mode);assert.equal(gui.get(SUCCESSOR_DATA)?.blob,GUI_WITNESS_PIN.blob);
 for(const row of manifest.replacements){const before=original.get(row.file);assert(before&&before.type==='blob');assert.equal(before.blob,row.before.blob);assert.equal(sha(git('show',GUI_LEGACY_BASE+':'+row.file)),row.before.sha256);}
 for(const row of [...manifest.replacements.map(row=>({file:row.file,...row.after})),...manifest.additions]){for(const map of[authored,gui]){const actual=map.get(row.file);assert(actual&&actual.type==='blob');assert.equal(actual.mode,row.mode);assert.equal(actual.blob,row.blob);}assert.equal(sha(git('show',GUI_AUTHORED_REVISION+':'+row.file)),row.sha256);assert.equal(sha(git('show',GUI_SOURCE+':'+row.file)),row.sha256);}
}

export function assertEnterpriseDirectoryEntries(directory,entries){const row=ENTERPRISE_NATIVE_DIRECTORY_MEMBERSHIPS.find(r=>r.directory===directory);assert(row,'Only the two source-defined boot directory scans');const extensions=directory==='public/art'?['.jpg','.jpeg','.png','.webp','.woff2','.mp4','.m4a']:['.mp4','.m4a'];assert(Array.isArray(entries));for(const name of entries)assert(typeof name==='string'&&name&&!name.includes('/')&&!name.includes('\\')&&name!=='.'&&name!=='..');const eligible=entries.filter(name=>extensions.includes(name.slice(name.lastIndexOf('.')).toLowerCase())).sort();assert.deepEqual(eligible,row.eligibleNames,'Unseen/removed/ignored eligible boot input; no finite-inventory fallback');return eligible;}
function inspectDirectories(){return ENTERPRISE_NATIVE_DIRECTORY_MEMBERSHIPS.map(r=>({directory:r.directory,eligibleNames:assertEnterpriseDirectoryEntries(r.directory,fs.readdirSync(path.join(ROOT,r.directory)))}));}
function tree(revision){return git('ls-tree','-r','-z',revision).toString().split('\0').filter(Boolean).map(line=>{const i=line.indexOf('\t'),[mode,type,blob]=line.slice(0,i).split(' ');return{file:line.slice(i+1),mode,type,blob,line};});}
export function captureEnterpriseSource(){
 const successor=assertEnterpriseCombinedInputDefinition(),revision=textGit('rev-parse','HEAD');assert.match(revision,/^[a-f0-9]{40}$/);assert.equal(textGit('status','--porcelain','--untracked-files=all'),'','Clean exact committed source required');
 assertHistoricalGUIWitness();git('merge-base','--is-ancestor',COMMERCE_SOURCE,successor.revision);git('merge-base','--is-ancestor',GUI_SOURCE,successor.revision);git('merge-base','--is-ancestor',successor.revision,revision);
 const records=tree(revision),current=new Map(records.map(r=>[r.file,r])),base=new Map(tree(ENTERPRISE_NATIVE_BASE_REVISION).map(r=>[r.file,r])),authored=new Map(tree(successor.revision).map(r=>[r.file,r])),pins=new Map(ENTERPRISE_NATIVE_BASE_INPUTS.map(r=>[r.file,r])),binary=new Set(ENTERPRISE_NATIVE_BINARY_FILES),files={};
 assert.equal(new Set(ENTERPRISE_NATIVE_FILES).size,ENTERPRISE_NATIVE_FILES.length,'Complete combined input inventory has no duplicates');
 for(const f of ENTERPRISE_NATIVE_FILES){
  const tracked=current.get(f);assert(tracked&&tracked.type==='blob'&&['100644','100755'].includes(tracked.mode),'Regular committed file required: '+f);const file=path.join(ROOT,f),stat=fs.lstatSync(file);assert(stat.isFile()&&!stat.isSymbolicLink());const raw=fs.readFileSync(file),canonical=git('show',revision+':'+f);assert.equal(stat.size,raw.length,'Stable actual boot stat size');assertEnterpriseNativeTrackedBytes(raw,canonical,binary.has(f));
  if(STAGED.includes(f)){const actual=authored.get(f);assert(actual&&actual.type==='blob'&&tracked.mode===actual.mode,'Exact authored staged mode required');if(f!=='tools/enterprise-native-inputs.js')assert.equal(tracked.blob,actual.blob,'Reviewed staged parent/guard source remains exact');}
  if(!STAGED.includes(f)){const pin=pins.get(f),old=base.get(f);if(pin){assert(old&&old.type==='blob');assert.equal(old.blob,pin.blob,f);assert.equal(old.mode,tracked.mode,f);assert.equal(sha(git('show',ENTERPRISE_NATIVE_BASE_REVISION+':'+f)),pin.sha256,f);}assertEnterpriseCombinedTrackedInput(f,tracked,authored.get(f),canonical,successor);}
  files[f]={sha256:sha(raw),gitSha256:sha(canonical),blob:tracked.blob,binary:binary.has(f),bytes:raw.length};
 }
 const result={revision,baseRevision:ENTERPRISE_NATIVE_BASE_REVISION,authoredRevision:successor.revision,commerceRevision:successor.commerceSource,guiRevision:successor.guiSource,historicalGUIAuthoredRevision:GUI_AUTHORED_REVISION,fullGitTreeSha256:sha(JSON.stringify(records.map(r=>r.line).sort())),stagedFiles:[...STAGED],historicalStagedFiles:[...STAGED],successorReplacements:successor.replacements.map(row=>row.file),successorAdditions:successor.additions.map(row=>row.file),directoryMemberships:inspectDirectories(),directoryPredicateSource:{file:'src/server.js',...files['src/server.js']},files};assertStable(result);return result;
}
function assertStable(source){assert.equal(textGit('rev-parse','HEAD'),source.revision);assert.equal(textGit('status','--porcelain','--untracked-files=all'),'');for(const[f,p]of Object.entries(source.files)){const file=path.join(ROOT,f),stat=fs.lstatSync(file);assert(stat.isFile()&&!stat.isSymbolicLink());assert.equal(stat.size,p.bytes,'Actual boot stat size changed: '+f);assert.equal(sha(fs.readFileSync(file)),p.sha256,'Input changed during qualification: '+f);}assert.deepEqual(inspectDirectories(),source.directoryMemberships);}
export function assertEnterpriseBackend(row,profile,port){assert(profile==='local'||profile==='ci');assert.deepEqual(Object.keys(row).sort(),['role','database','version','directory'].sort());assert.equal(row.role,profile==='local'?'pilot_runner':'postgres');assert.equal(row.database,'postgres');assert.equal(typeof row.directory,'string');assert(row.directory.length);if(profile==='local'){assert(port===35439||port===35449);assert.match(row.version,/^18\.4\b/);assert.equal(row.directory.replaceAll('\\','/').toLowerCase(),DIRECTORIES[port]);}else{assert.equal(port,5432);assert.match(row.version,/^(?:16\b|18\.4\b)/);}}
export function enterpriseChildEnv(environment,row,profile,database){assertEnterpriseInventory(ENTERPRISE_NATIVE_PROOFS);assert(ENTERPRISE_NATIVE_PROOFS.some(r=>JSON.stringify(r)===JSON.stringify(row)));const[name,key,prefix,localPort]=row;assert.match(database,new RegExp('^'+prefix+'[a-f0-9]{12}$'));const port=profile==='local'?localPort:5432;assert(profile==='local'||profile==='ci');const endpoint=new URL(ADMINS[port]);endpoint.pathname='/'+database;const env={...environment};for(const k of Object.keys(env))if(/DATABASE_URL$|^PG|^RC1|^ENTERPRISE_NATIVE_/i.test(k)||['NODE_OPTIONS','NODE_PATH','NODE_PG_FORCE_NATIVE','LEGAL_PROFILE_DEFER','GENESIS_AUCTION_MANIFEST_PATH','GENESIS_AUCTION_MANIFEST_SHA256'].includes(k.toUpperCase()))delete env[k];Object.assign(env,{CHAIN_ENABLED:'off',RESOURCE_ECONOMY:'off',SOCIAL_VERIFY_MODE:'off',...LEGAL});env[key]=endpoint.href;return env;}
export function assertEnterpriseResults(rows,source,profile){assert(profile==='local'||profile==='ci');assertEnterpriseInventory(ENTERPRISE_NATIVE_PROOFS);assert.match(source.revision,/^[a-f0-9]{40}$/);assert.equal(rows.length,16,'No partial sixteen-case qualification');const dbs=new Set();for(const[i,r]of rows.entries()){const[name,,prefix,localPort,deadline]=ENTERPRISE_NATIVE_PROOFS[i];assert.deepEqual(Object.keys(r).sort(),['file','database','port','sourceSha256','code','signal','error','durationMs','state','logSha256'].sort());assert.equal(r.file,name);assert.equal(r.port,profile==='local'?localPort:5432);assert.match(r.database,new RegExp('^'+prefix+'[a-f0-9]{12}$'));assert(!dbs.has(r.database));dbs.add(r.database);assert.equal(r.sourceSha256,source.files['test/'+name+'.js'].sha256);assert.equal(r.code,0);assert.equal(r.signal,null);assert.equal(r.error,null);assert.equal(r.state,'passed');assert.match(r.logSha256,/^[a-f0-9]{64}$/);assert(Number.isFinite(r.durationMs)&&r.durationMs>=0&&r.durationMs<=deadline+10000);}}
export function assertEnterpriseCleanup(cleanup,profile){assert(profile==='local'||profile==='ci');const ports=profile==='local'?[35439,35449]:[5432];assert.equal(cleanup.complete,true);assert.equal(cleanup.adminsClosed,true);assert.equal(cleanup.adminEndings.length,ports.length);assert(cleanup.adminEndings.every(r=>r.closed===true&&!r.error));assert.equal(cleanup.freshZeros.length,ports.length);assert.deepEqual(cleanup.freshZeros.map(r=>r.port),ports);for(const row of cleanup.freshZeros){assert.equal(row.complete,true);assert.equal(row.readerClosed,true);assert(!row.failure);assertEnterpriseBackend(row.identity,profile,row.port);assert.deepEqual(row.activeNonAdminDatabaseClientSessions,[]);}}
async function backend(client){return(await client.query("SELECT current_user AS role,current_database() AS database,current_setting('server_version') AS version,current_setting('data_directory') AS directory")).rows[0];}
async function freshZero(pg,profile,port){const reader=new pg.Client({connectionString:ADMINS[port]}),receipt={port,at:new Date().toISOString(),readerClosed:false,complete:false};try{await reader.connect();await reader.query('BEGIN READ ONLY');receipt.identity=await backend(reader);assertEnterpriseBackend(receipt.identity,profile,port);receipt.activeNonAdminDatabaseClientSessions=(await reader.query("SELECT datname,pid,state FROM pg_stat_activity WHERE datname IS NOT NULL AND datname<>'postgres' AND backend_type='client backend' ORDER BY datname,pid")).rows;assert.deepEqual(receipt.activeNonAdminDatabaseClientSessions,[]);await reader.query('ROLLBACK');}catch(error){receipt.failure={code:error.code||'fresh_zero_failed',message:error.message};}finally{try{await reader.end();receipt.readerClosed=true;}catch(error){receipt.readerCloseFailure={message:error.message};}}receipt.complete=!receipt.failure&&receipt.readerClosed;return receipt;}
async function inspectFreshDatabase(pg,url,role,database){const fresh=new pg.Client({connectionString:url}),receipt={database,clientClosed:false,complete:false};try{await fresh.connect();receipt.identity=(await fresh.query('SELECT current_user AS role,current_database() AS database')).rows[0];assert.equal(receipt.identity.role,role);assert.equal(receipt.identity.database,database);receipt.publicRelations=(await fresh.query("SELECT c.relname,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,c.relkind")).rows;assert.deepEqual(receipt.publicRelations,[]);receipt.userSchemas=(await fresh.query("SELECT nspname FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname NOT IN ('information_schema','public') ORDER BY nspname")).rows;assert.deepEqual(receipt.userSchemas,[]);receipt.publicTypes=(await fresh.query("SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname")).rows;assert.deepEqual(receipt.publicTypes,[]);receipt.publicProcedures=(await fresh.query("SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.proname")).rows;assert.deepEqual(receipt.publicProcedures,[]);}catch(error){receipt.failure={code:error.code||'fresh_database_failed',message:error.message};}finally{try{await fresh.end();receipt.clientClosed=true;}catch(error){receipt.clientCloseFailure={message:error.message};}}receipt.complete=!receipt.failure&&receipt.clientClosed;return receipt;}
async function run(){
 const profile=assertEnterpriseNativeMode(process.argv,process.env);assertEnterpriseInventory(ENTERPRISE_NATIVE_PROOFS);const source=captureEnterpriseSource(),ports=profile==='local'?[35439,35449]:[5432],folder=path.join(ROOT,'output','enterprise-native-'+source.revision.slice(0,8)+'-'+crypto.randomBytes(4).toString('hex'));fs.mkdirSync(folder,{recursive:true});
 const result={source,profile,ports,node:process.version,financialActivation:'off',complete:false,status:'RUNNING_FULL_SIXTEEN_NATIVE',startedAt:new Date().toISOString(),allocations:[],backend:{},results:[],caseZeros:[],cleanup:{adminsClosed:false,freshZeros:[],complete:false}},save=()=>fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify(result,null,2)+'\n');save();
 // The package is imported only after mode/refusal guards and every genuine source pin pass.
 const{default:pg}=await import('pg');const admins=new Map();let failure=null;
 try{for(const port of ports){const admin=new pg.Client({connectionString:ADMINS[port]});admins.set(port,admin);await admin.connect();result.backend[port]=await backend(admin);assertEnterpriseBackend(result.backend[port],profile,port);const zero=await freshZero(pg,profile,port);result.caseZeros.push(zero);save();assert(zero.complete,'Initial strict fresh zero failed');}
  for(const row of ENTERPRISE_NATIVE_PROOFS){assertStable(source);const[name,_key,prefix,localPort,timeout]=row,port=profile==='local'?localPort:5432,admin=admins.get(port),database=prefix+crypto.randomBytes(6).toString('hex');assert.match(database,/^[a-z0-9_]{1,63}$/);assert.equal((await admin.query('SELECT datname FROM pg_database WHERE datname=$1',[database])).rows.length,0);await admin.query('CREATE DATABASE '+database);const allocation={file:name,database,port};result.allocations.push(allocation);save();allocation.owner=(await admin.query('SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=$1',[database])).rows[0].owner;save();assert.equal(allocation.owner,profile==='local'?'pilot_runner':'postgres');const endpoint=new URL(ADMINS[port]);endpoint.pathname='/'+database;allocation.fresh=await inspectFreshDatabase(pg,endpoint.href,profile==='local'?'pilot_runner':'postgres',database);save();assert(allocation.fresh.complete,'Fresh owned database namespace refused');
   const logFile=path.join(folder,name+'.log'),log=fs.createWriteStream(logFile),started=Date.now();let error=null;console.log(JSON.stringify({file:name,state:'started',source:source.revision,port,sourceSha256:source.files['test/'+name+'.js'].sha256}));const status=await new Promise(resolve=>{const child=spawn(process.execPath,['test/'+name+'.js','--postgres'],{cwd:ROOT,env:enterpriseChildEnv(process.env,row,profile,database),windowsHide:true,stdio:['ignore','pipe','pipe'],timeout});child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});child.once('error',e=>{error=e.code||'spawn_error';});child.once('close',(code,signal)=>resolve({code,signal}));});await new Promise(resolve=>log.end(resolve));const proof={file:name,database,port,sourceSha256:source.files['test/'+name+'.js'].sha256,...status,error,durationMs:Date.now()-started,state:status.code===0&&status.signal===null&&error===null?'passed':'failed',logSha256:sha(fs.readFileSync(logFile))};result.results.push(proof);save();assertStable(source);for(const used of ports){const zero=await freshZero(pg,profile,used);result.caseZeros.push(zero);save();assert(zero.complete,'Post-child strict fresh zero failed');}assert.equal(proof.state,'passed','Failure retained; no partial qualification: '+name);console.log(JSON.stringify({file:name,state:'passed'}));}
  assertStable(source);assertEnterpriseResults(result.results,source,profile);
 }catch(error){failure=error;result.failure={code:error.code||'qualification_failed',message:error.message};save();}
 finally{const endings=await Promise.allSettled([...admins.values()].map(a=>a.end()));result.cleanup.adminEndings=endings.map(r=>r.status==='fulfilled'?{closed:true}:{closed:false,error:String(r.reason)});result.cleanup.adminsClosed=endings.every(r=>r.status==='fulfilled');save();for(const port of ports)try{result.cleanup.freshZeros.push(await freshZero(pg,profile,port));save();}catch(error){result.cleanup.failure={code:error.code||'cleanup_failed',message:error.message};failure??=error;save();}result.cleanup.complete=result.cleanup.adminsClosed&&result.cleanup.freshZeros.length===ports.length&&result.cleanup.freshZeros.every(r=>r.complete&&r.readerClosed&&r.activeNonAdminDatabaseClientSessions.length===0);if(!result.cleanup.complete){failure??=Error('Strict fresh all-used-port zero/admin/reader closure failed');}save();}
 if(failure){result.status='FAIL_RETAINED_NO_NATIVE_COMPLETION';result.finishedAt=new Date().toISOString();save();throw failure;}assertStable(source);assertEnterpriseResults(result.results,source,profile);assertEnterpriseCleanup(result.cleanup,profile);result.complete=true;result.status='PASS_FULL_SIXTEEN_NATIVE_STRICT_FRESH_ZERO';result.finishedAt=new Date().toISOString();save();console.log(JSON.stringify({folder,source:source.revision,complete:true,cases:16,strictFreshZeroPorts:ports,financialActivation:'off'}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await run();
