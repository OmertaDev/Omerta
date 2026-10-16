import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const prefix='postgresql://pilot_runner@127.0.0.1:35439/customer_vault_test_123456789abc';
for(const url of [prefix.replace('127.0.0.1','example.invalid'),prefix.replace('postgresql:','https:'),prefix.replace('pilot_runner@','postgres@'),prefix.replace('35439','5433'),prefix.replace('pilot_runner@','pilot_runner:secret@'),prefix.replace('customer_vault_test_','other_'),prefix.replace('123456789abc','1234'),prefix+'?options=unsafe',prefix+'#fragment']){
  const env={...process.env,CUSTOMER_VAULT_TEST_DATABASE_URL:url};delete env.DATABASE_URL;const r=spawnSync(process.execPath,['test/customervaults.js','--postgres'],{env,encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,/AssertionError/);assert(!r.stdout.includes('[db]'),'Refusal precedes canonical DB boot');
}
console.log('Customer vault endpoint guards PASS: nine protocol/host/role/port/password/prefix/suffix/query/fragment refusals before database boot.');
