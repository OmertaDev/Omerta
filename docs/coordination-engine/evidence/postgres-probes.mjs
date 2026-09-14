import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import pg from 'pg';
import { dbCaps } from '../../../src/db.js';
import { compileCoordinationGraph, createCoordinationRegistry } from '../../../src/coordination/graph.js';
import { createCoordinationService } from '../../../src/coordination/runtime.js';
// This fixed, isolated loopback cluster is the only connection target.
const config = { host: '127.0.0.1', port: 55483, database: 'postgres', user: 'coordination_review', max: 8 };
const admin = new pg.Pool(config);
const namespace = `coordination_review_${crypto.randomBytes(8).toString('hex')}`;
await admin.query(`CREATE SCHEMA ${namespace}`);
const pool = new pg.Pool({ ...config, options: `-c search_path=${namespace}` });
dbCaps.skipLocked = true;
const schema = fs.readFileSync(new URL('../../../schema.sql', import.meta.url), 'utf8');
const start = schema.indexOf('-- Coordination Phase 0 is a separate, inert authority.');
assert(start > 0);
await pool.query('CREATE TABLE accounts(id TEXT PRIMARY KEY,status TEXT NOT NULL); CREATE TABLE characters(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),respect NUMERIC NOT NULL,loc TEXT NOT NULL,alive BOOLEAN NOT NULL);');
await pool.query(schema.slice(start));
await pool.query("INSERT INTO accounts VALUES ('review-account','active'); INSERT INTO characters VALUES ('review-character','review-account',100,'docks',true)");
const always = { kind: 'always' };
const source = { schemaVersion: 1, id: 'review.graph', version: 1, title: 'Review graph', nodes: [
  {id:'a',kind:'task',title:'A',visibility:'public',discover:always,requires:always},
  {id:'b',kind:'task',title:'Hidden B',visibility:'hidden',discover:{kind:'node_completed',nodeId:'a'},requires:always},
  {id:'end',kind:'terminal',title:'End',visibility:'public',discover:always,requires:{kind:'node_completed',nodeId:'b'}},
] };
const registry = createCoordinationRegistry([source]);
const expectedContentHash = compileCoordinationGraph(source).contentHash;
const service = createCoordinationService({pool,registry,enabled:true});
const creations = await Promise.all([service.create('review-account',source.id,{expectedContentHash},'create1'),service.create('review-account',source.id,{expectedContentHash},'create2')]);
assert.equal(creations[0].instance.id,creations[1].instance.id);
assert.equal((await pool.query('SELECT COUNT(*) FROM coordination_events')).rows[0].count,'1');
const instance = creations[0].instance;
assert(!JSON.stringify(instance).includes('Hidden B'));
const request = {expectedRevision:instance.revision,actionId:instance.actions[0].id};
const race = await Promise.allSettled([service.act('review-account',instance.id,request,'act1'),service.act('review-account',instance.id,request,'act2')]);
assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
assert.equal(race.find(r=>r.status==='rejected').reason.code,'stale_coordination');
console.log('PASS PostgreSQL: concurrent creates converge and same-revision commands serialize');
const before = (await pool.query('SELECT state_json,revision,status FROM coordination_instances')).rows;
let failEvent = true;
const wrapped = { async connect(){const client=await pool.connect();return {query(sql,values){if(failEvent&&sql.includes('INSERT INTO coordination_events')){failEvent=false;throw Object.assign(new Error('injected'),{code:'review_injected'});}return client.query(sql,values);},release:(discard)=>client.release(discard)};} };
const failureService = createCoordinationService({pool:wrapped,registry,enabled:true});
const ready = await service.get('review-account',instance.id);
await assert.rejects(()=>failureService.act('review-account',instance.id,{expectedRevision:ready.revision,actionId:ready.actions[0].id},'fail-action'),{code:'review_injected'});
assert.deepEqual((await pool.query('SELECT state_json,revision,status FROM coordination_instances')).rows,before);
assert.equal((await pool.query("SELECT COUNT(*) FROM coordination_commands WHERE command_key='fail-action'")).rows[0].count,'0');
console.log('PASS PostgreSQL: event insert failure rolls progress and receipts back');

const killer = await pool.connect();
await killer.query('BEGIN');
await killer.query("UPDATE characters SET alive=false WHERE id='review-character'");
await killer.query("INSERT INTO characters VALUES('review-heir','review-account',100,'docks',true)");
let childLookup;
const lookupStarted = new Promise(resolve=>{childLookup=resolve;});
const racingPool = {async connect(){const client=await pool.connect();return {query(sql,values){if(sql.includes('FROM characters'))childLookup();return client.query(sql,values);},release:(discard)=>client.release(discard)};} };
const racingService = createCoordinationService({pool:racingPool,registry,enabled:true});
const creatingHeir = racingService.create('review-account',source.id,{expectedContentHash},'create-during-death');
await lookupStarted;
await new Promise(resolve=>setTimeout(resolve,75));
await killer.query('COMMIT');killer.release();
const deathResult = await creatingHeir.then(()=>({ok:true}),error=>({code:error.code}));
console.log('OBSERVED death-race create:',JSON.stringify(deathResult));
assert.equal(deathResult.ok,true,'the second living-character lookup resolves the committed heir');
assert.equal((await pool.query("SELECT COUNT(*) FROM characters WHERE id='review-heir' AND alive")).rows[0].count,'1');
const old = await service.get('review-account',instance.id);
assert.equal(old.historical,true);assert.equal(old.actions.length,0);
const cancelled = await service.cancel('review-account',instance.id,{expectedRevision:old.revision},'cancel-after-death');
assert.equal(cancelled.instance.status,'cancelled');
const cancelledEvent = (await pool.query("SELECT actor_character_id FROM coordination_events WHERE event_type='coordination.cancelled'")).rows[0];
console.log('OBSERVED post-death cancellation actor:',cancelledEvent.actor_character_id,'actual living character: review-heir');
const disabled = createCoordinationService({pool,registry,enabled:false});
const receipt = await disabled.create('review-account',source.id,{expectedContentHash},'create1');
assert.equal(receipt.replayed,true);
console.log('PASS historical owner cannot act; original account can cancel; disabled service replays receipt only');

const largeVersion = {...source,id:'review.large-version',version:2147483648};
assert.throws(()=>createCoordinationRegistry([largeVersion]),{code:'coordination_definition_invalid'});
console.log('PASS oversized persisted INTEGER version rejected by compiler');
await pool.end();
await admin.query(`DROP SCHEMA ${namespace} CASCADE`);await admin.end();

