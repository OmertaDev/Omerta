#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateResourceOutcomeRecord, reconcileResourceOutcomeRecord } from '../src/resourceoutcomeobserver.js';
import { readComputeExperimentInput, computeExperimentJson } from './compute-experiment.js';
export async function observeResourceOutcomes({baseUrl='https://www.omerta.fun',accountId,token=process.env.OMERTA_BUSINESS_TOKEN,routingInput=null,fetchImpl=fetch}={}) {
  const url=new URL(baseUrl),loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(url.username||url.password||url.pathname!=='/'||url.search||url.hash||(url.protocol!=='https:'&&!(url.protocol==='http:'&&loopback))||typeof token!=='string'||token.length<8||token.length>8192||/[\s\x00-\x1f]/.test(token))throw new Error('Invalid outcome observer options');
  const response=await fetchImpl(`${url.origin}/v1/resources/outcomes`,{method:'GET',redirect:'error',headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)});
  if(!response.ok||!response.body||Number(response.headers.get('content-length'))>1048576||response.url&&new URL(response.url).origin!==url.origin)throw new Error('Outcome feed unavailable');
  const reader=response.body.getReader(),chunks=[];let bytes=0;
  try { for(;;) {const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>1048576){await reader.cancel();throw new Error('Outcome feed too large');}chunks.push(Buffer.from(value));} }finally {reader.releaseLock();}
  const raw=Buffer.concat(chunks).toString('utf8');if(raw.includes(token))throw new Error('Unsafe outcome feed');
  const feed=validateResourceOutcomeRecord(JSON.parse(raw),accountId);
  const result = routingInput ? {mode:'observe',observationRequests:1,...reconcileResourceOutcomeRecord(feed,routingInput,accountId)} : {mode:'observe',observationRequests:1,financialRequests:0,feed};
  if(JSON.stringify(result).includes(token))throw new Error('Unsafe outcome record');
  return result;
}
export async function runResourceOutcomeObserver(args) {
  const options={};let routingFile=null;
  if(args.length%2)throw new Error('Invalid outcome observer option');
  const seen=new Set();for(let i=0;i<args.length;i+=2){const key=args[i],value=args[i+1];if(!['--base','--account','--routing'].includes(key)||seen.has(key)||typeof value!=='string'||!value)throw new Error('Invalid outcome observer option');seen.add(key);if(key==='--base')options.baseUrl=value;if(key==='--account')options.accountId=value;if(key==='--routing')routingFile=value;}
  if(!options.accountId)throw new Error('Account required');if(routingFile)options.routingInput=await readComputeExperimentInput(routingFile);
  return observeResourceOutcomes(options);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))runResourceOutcomeObserver(process.argv.slice(2)).then(result=>process.stdout.write(computeExperimentJson(result))).catch(()=>{process.stderr.write('resource_outcome_observer_error\n');process.exitCode=1;});
