import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {AUTONOMY_NATIVE_PROOFS,AUTONOMY_REQUIRED_MEMORY_PROOFS,autonomyNativeEndpoint} from '../tools/company-autonomy-native.js';
for(const url of ['postgresql://pilot_runner@127.0.0.1:35449/postgres','postgres://postgres:pgcheck@127.0.0.1:5432/postgres'])assert(autonomyNativeEndpoint(url).u);
for(const bad of [undefined,'','https://127.0.0.1:35449/postgres','postgres://pilot_runner@localhost:35449/postgres','postgres://pilot_runner@192.0.2.1:35449/postgres','postgres://pilot_runner@127.0.0.1:35439/postgres','postgres://pilot_runner:secret@127.0.0.1:35449/postgres','postgres://postgres@127.0.0.1:5432/postgres','postgres://postgres:pgcheck@127.0.0.1:5432/live','postgres://pilot_runner@127.0.0.1:35449/postgres?sslmode=require','postgres://pilot_runner@127.0.0.1:35449/postgres#x'])assert.throws(()=>autonomyNativeEndpoint(bad));
assert.equal(AUTONOMY_NATIVE_PROOFS.length,11);
assert.equal(new Set(AUTONOMY_NATIVE_PROOFS.map(([file,,,mode])=>file+(mode??''))).size,11);
assert.deepEqual(AUTONOMY_NATIVE_PROOFS.find(([file])=>file==='fundedworkescrowadapter'),['fundedworkescrowadapter','FUNDED_WORK_ADAPTER_TEST_DATABASE_URL','funded_work_adapter_test_']);
assert.deepEqual(AUTONOMY_REQUIRED_MEMORY_PROOFS,['fundedworkchainobservations']);
assert(Object.isFrozen(AUTONOMY_REQUIRED_MEMORY_PROOFS));
assert(fs.existsSync('test/fundedworkchainobservations.js'));
for(const[file,key,prefix,mode]of AUTONOMY_NATIVE_PROOFS){assert(fs.existsSync('test/'+file+'.js'));assert.match(key,/^[A-Z_]+_TEST_DATABASE_URL$/);assert.match(prefix+'0123456789ab',/^[a-z0-9_]{1,63}$/);assert(Object.isFrozen(AUTONOMY_NATIVE_PROOFS));assert(!mode||mode==='--laboratories');}
assert(AUTONOMY_NATIVE_PROOFS.some(([f])=>f==='managementteams-retry-integration'));
assert(AUTONOMY_NATIVE_PROOFS.some(([f])=>f==='strategylaboratories-integration'));
const env={...process.env};delete env.DATABASE_URL;delete env.COMPANY_AUTONOMY_NATIVE_ADMIN_DATABASE_URL;
for(const [args,override,message]of [[['--tail'],{},'No partial or tail-only qualification'],[[],{DATABASE_URL:'postgres://forbidden.invalid/live'},'No ambient database endpoint'],[[],{COMPANY_AUTONOMY_NATIVE_ADMIN_DATABASE_URL:'postgres://pilot_runner@192.0.2.1:35449/postgres'},'127.0.0.1']]){const r=spawnSync(process.execPath,['tools/company-autonomy-native.js',...args],{env:{...env,...override},encoding:'utf8'});assert.notEqual(r.status,0);assert(r.stderr.includes(message),r.stderr);}
console.log('Company autonomy native endpoint guard PASS: closed endpoints, full eleven-proof inventory plus required offline memory vectors, no partial/ambient admission; no database connections.');
