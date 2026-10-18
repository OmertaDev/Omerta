import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertFinalservicesCurrentEnvironment,createFinalservicesHostedCapturePlan,loadFinalservicesHostedBinding,runFinalservicesBoundCapture} from './finalservices-current-native-guard.js';
export function finalservicesHostedInvocation(argv,execArgv){assert.deepEqual(execArgv,[]);assert(Array.isArray(argv));if(argv.length===1){assert.equal(argv[0],'--start');return{stage:'start'};}assert.equal(argv.length,3);assert(['--capture','--parent'].includes(argv[0]));assert(path.isAbsolute(argv[1]));assert.match(argv[2],/^[a-f0-9]{64}$/);return{stage:argv[0].slice(2),file:argv[1],sha256:argv[2]};}
export async function runFinalservicesHostedProducer(){
 const spec=finalservicesHostedInvocation(process.argv.slice(2),process.execArgv),allowed=spec.stage==='capture'?[]:['FINAL_SERVICES_CURRENT_NATIVE_CI_ADMIN_DATABASE_URL'];assertFinalservicesCurrentEnvironment(process.env,process.execArgv,allowed);assert.equal(process.env.CI,'true');
 if(spec.stage==='start'){const context=createFinalservicesHostedCapturePlan(),driver=await import('./finalservices-native.js');await driver.runFinalservicesNative(context,['--ci']);}
 else{const context=loadFinalservicesHostedBinding(spec.file,spec.sha256,spec.stage==='capture'?'capture':'execution');if(spec.stage==='capture'){assert.equal(context.documents.hosted.phase,'GHA_S31_CAPTURE_PLAN','Exactly one capture child; execution capsules cannot restart capture');console.log(JSON.stringify(runFinalservicesBoundCapture(context)));}else{const e=context.documents.execution,parent=await import('./finalservices-current-native.js');await parent.runFinalservicesNativeParent(context,['--ci',context.anchor.source,e.outputs.manifest,e.captureSHA256,e.outputs.n24,e.n24SHA256,e.outputs.output]);}}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await runFinalservicesHostedProducer();
