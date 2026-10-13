// Append current-source authority proofs to the existing City native command. The CI service
// supplies this explicit fixture URL; no production/environment-selected DATABASE_URL fallback.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const CITY_GAMEPLAY_NATIVE_PROOFS=Object.freeze([
  ['test/city-home-migration.js','CITY_HOME_TEST_DATABASE_URL',[]],
  ['test/city-district-arcs.js','CITY_DISTRICT_ARCS_TEST_DATABASE_URL',['--postgres']],
  ['test/staged-crew-missions-api.js','STAGED_CREW_MISSIONS_TEST_DATABASE_URL',['--postgres']],
  ['test/city-home-interiors-api.js','CITY_HOME_INTERIORS_TEST_DATABASE_URL',['--postgres']],
  ['test/city-encounters.js','CITY_ENCOUNTERS_TEST_DATABASE_URL',['--postgres']],
  ['test/city-encounters-native-proof.js','CITY_ENCOUNTERS_TEST_DATABASE_URL',['--postgres']],
  ['test/city-world-opportunities.js','CITY_WORLD_OPPORTUNITIES_TEST_DATABASE_URL',['--postgres']],
].map(([file,key,args])=>Object.freeze([file,key,Object.freeze(args)])));
async function run() {
assert.equal(process.argv.length,2,'This qualification runner has no partial/tail-only mode');
assert(process.env.CITY_HOMES_TEST_DATABASE_URL,'Existing explicit City native fixture required');
const endpoint=new URL(process.env.CITY_HOMES_TEST_DATABASE_URL);
assert(!endpoint.search && !endpoint.hash,'Fixture URLs cannot override driver host or connection options');
assert(['postgres:','postgresql:'].includes(endpoint.protocol));
assert(['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname));
assert(/^\/(omerta_query|omerta_check)$/.test(endpoint.pathname),'Use the reviewed disposable CI database');
for(const[file,key,args]of CITY_GAMEPLAY_NATIVE_PROOFS){
  const hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),start=Date.now();
  console.log(JSON.stringify({proof:file,sourceSha256:hash,state:'started'}));
  const status=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[file,...args],{
    stdio:'inherit',env:{...process.env,[key]:endpoint.toString()}});child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});
  assert.equal(status.signal,null,file+' interrupted');assert.equal(status.code,0,file+' failed');
  console.log(JSON.stringify({proof:file,sourceSha256:hash,state:'passed',elapsedMs:Date.now()-start}));
}
console.log('City gameplay native: all seven current-source proofs passed; no partial qualification');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await run();
