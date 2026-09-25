import assert from 'node:assert/strict';
import { createNpcBoatAcquisitionCommitObserver } from '../tools/rc1-npc-boat-journal.js';
const options={seed:'composition-control',readRandomTape:()=>{throw Error('Non-boat query must not read random tape');},onBoundary:async()=>{}};
assert.throws(()=>createNpcBoatAcquisitionCommitObserver({...options,additionalProvenanceExtensions:{npcBoatAcquisition:{}}}),/Cannot replace/);
assert.throws(()=>createNpcBoatAcquisitionCommitObserver({...options,additionalProvenanceExtensions:{npcCarAcquisition:{}}}),/Cannot replace/);
assert.throws(()=>createNpcBoatAcquisitionCommitObserver({...options,additionalQueryOrigin:1}));
let trace,extraCalls=0;
const observer=createNpcBoatAcquisitionCommitObserver({...options,additionalProvenanceExtensions:{testExtension:{format:1}},
 additionalQueryOrigin:sql=>{extraCalls++;return sql==='SELECT 1'?{kind:'controlled-extra-origin'}:null;},
 onBoundary:async(event,witness)=>{if(event.outcome==='COMMITTED')trace=witness;}});
const client={},query=observer.wrapQuery(client,async sql=>({command:sql.split(' ')[0],rows:sql==='SELECT 1'?[{n:1}]:[],rowCount:sql==='SELECT 1'?1:null}));
observer.arm();await query('BEGIN');await query('SELECT 1');await query('COMMIT');observer.assertComplete();observer.disarm();
assert.deepEqual(trace.extensions.testExtension,{format:1});assert(trace.extensions.npcCarAcquisition);assert(trace.extensions.npcBoatAcquisition);
assert.deepEqual(trace.queries[1].origin,{kind:'controlled-extra-origin'});assert.equal(extraCalls,3);
let defaultTrace;const defaults=createNpcBoatAcquisitionCommitObserver({...options,onBoundary:async(event,witness)=>{if(event.outcome==='COMMITTED')defaultTrace=witness;}});
const dq=defaults.wrapQuery({},async sql=>({command:sql,rows:[],rowCount:null}));defaults.arm();await dq('BEGIN');await dq('COMMIT');defaults.assertComplete();defaults.disarm();
assert.deepEqual(Object.keys(defaultTrace.extensions).sort(),['npcBoatAcquisition','npcCarAcquisition']);assert(defaultTrace.queries.every(row=>!row.origin));
console.log(JSON.stringify({status:'PASS_COMPOSITION_CONTROLS',actualNativeExecution:false,oneBaseObserver:true,namespaceRejections:2,defaultExtensionsUnchanged:true}));
