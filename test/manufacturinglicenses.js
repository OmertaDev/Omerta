import assert from 'node:assert/strict';
import fs from 'node:fs';
assert(!process.env.DATABASE_URL,'No ambient database endpoint');
assert(!process.argv.includes('--postgres'),'No native campaign lease');
const {makeDb}=await import('../src/db.js');
const M=await import('../src/manufacturinglicenses.js');
const body={businessId:'owned-depot',productionKey:'canonical-key',licenseeCharacterId:'named-original',feeCash:25,maximumRuns:2,lifetimeSeconds:3600,consent:true};
assert.deepEqual(M.manufacturingLicenseTerms('publish',body),body);
for(const bad of [{...body,consent:false},{...body,feeCash:0},{...body,maximumRuns:9},{...body,lifetimeSeconds:59},{...body,recipeId:'invented'},{...body,feeCash:'25'}])assert.throws(()=>M.manufacturingLicenseTerms('publish',bad));
for(const action of ['configure','grant_recipe','mint','unknown'])assert.throws(()=>M.manufacturingLicenseTerms(action,body));
const pool=await makeDb();try{
 await pool.query(fs.readFileSync(new URL('../docs/manufacturing-license-proposal.sql',import.meta.url),'utf8'));
 assert.deepEqual((await M.manufacturingLicenseBoard(pool,'a')).licenses,[]);
 await assert.rejects(M.manufacturingLicenseAction(pool,'a','publish',body,'without-source'),e=>e.code==='manufacturing_license');
 assert.equal((await pool.query('SELECT * FROM manufacturing_licenses')).rows.length,0);
 assert.equal((await pool.query('SELECT * FROM manufacturing_license_requests')).rows.length,0);
 console.log('PASS closed voluntary package terms, no recipe/config authority, empty private board, absent canonical source refusal. No positive production/native proof.');
}finally{await pool.end();}