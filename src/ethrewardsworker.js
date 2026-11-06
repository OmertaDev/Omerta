// Existing-worker native ETH upkeep clock. Public policy is checked before any credential/client.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {dbCaps} from './db.js';
import {validateMarketV2Manifest,makeMarketV2Clients,runMarketV2} from './marketv2keeper.js';
const INTERVAL_MS=60000;
const problem=code=>Object.assign(Error(code),{keeperCode:code});
const publicCodes=new Set(['disabled','eth_manifest_disabled','eth_manifest_required','eth_manifest_sha_required','eth_manifest_unavailable',
  'eth_manifest_sha_mismatch','eth_manifest_invalid','eth_manifest_domain_mismatch','postgres_required','rpc_required','keeper_key_required',
  'signer_mismatch','wrong_chain','runtime_mismatch','target_code_mismatch','snapshot_reorg','stale_block','pending_target_not_approved',
  'unknown_pending_nonce','unknown_consumed_nonce','invalid_nonce','budget_exceeded','budget_policy_changed','gas_limit_exceeded',
  'journal_integrity','action_rebound','rpc_or_storage_unavailable','wallet_has_pending_transaction','receipt_mismatch','broadcast_hash_mismatch']);
const publicStates=new Set(['disabled','busy','idle','locked','blocked','prepared','broadcast','confirmed','settled','reverted','planned','pending']);
const safeCode=code=>publicCodes.has(code)?code:'eth_upkeep_unavailable';

export function ethRewardsAutomationEnabled(){return process.env.ETH_REWARDS_AUTOMATION_ENABLED==='on';}

export function ethRewardsWorkerConfig({readFile=fs.readFileSync}={}){
  if(!ethRewardsAutomationEnabled())return{enabled:false,reason:'disabled'};
  const file=process.env.ETH_REWARDS_MANIFEST_PATH,expected=process.env.ETH_REWARDS_MANIFEST_SHA256;
  if(typeof file!=='string'||!file.trim())throw problem('eth_manifest_required');
  if(!/^[a-f\d]{64}$/i.test(expected||''))throw problem('eth_manifest_sha_required');
  let bytes;
  try{bytes=readFile(file);}catch{throw problem('eth_manifest_unavailable');}
  if(createHash('sha256').update(bytes).digest('hex')!==expected.toLowerCase())throw problem('eth_manifest_sha_mismatch');
  let manifest;
  try{manifest=validateMarketV2Manifest(JSON.parse(bytes.toString()));}catch{throw problem('eth_manifest_invalid');}
  if(manifest.chainId!==4663||!manifest.jobs.length||manifest.jobs.some(j=>!j.kind.startsWith('eth_')))throw problem('eth_manifest_domain_mismatch');
  if(!manifest.ethAutomation?.enabled||!manifest.ethAutomation?.productionEnabled)return{enabled:false,reason:'eth_manifest_disabled'};
  if(!/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL||''))throw problem('postgres_required');
  return{enabled:true,manifest};
}

// This separate function is reached only after all three opt-ins, integrity and DB checks.
export function ethRewardsWorkerCredentials(){
  return{rpcUrl:process.env.MARKET_V2_RPC_URL,privateKey:process.env.MARKET_V2_KEEPER_KEY};
}

export function createEthRewardsWorker(pool,{enabled=ethRewardsAutomationEnabled,config=ethRewardsWorkerConfig,
  credentials=ethRewardsWorkerCredentials,makeClients=makeMarketV2Clients,run=runMarketV2,
  postgres=()=>dbCaps.skipLocked===true,schedule=setInterval,cancel=clearInterval,
  report=summary=>console[summary.alert?'error':'log']('native ETH upkeep',summary)}={}){
  let inFlight=false,timer=null,lastNotice=null,stopped=false;
  const publish=value=>{
    const summary={state:publicStates.has(value?.state)?value.state:'blocked',reason:value?.reason?safeCode(value.reason):null,alert:Boolean(value?.alert)};
    const notice=JSON.stringify(summary);
    if(notice!==lastNotice){lastNotice=notice;try{report(summary);}catch{/* Logging cannot strand the scheduler. */}}
    return summary;
  };
  const tick=async()=>{
    if(inFlight)return{state:'busy',reason:null,alert:false};
    if(stopped)return{state:'disabled',reason:'disabled',alert:false};
    inFlight=true;
    try{
      const current=config();
      if(!current.enabled)return publish({state:'disabled',reason:current.reason,alert:false});
      if(!pool||typeof pool.query!=='function'||typeof pool.connect!=='function'||!postgres())throw problem('postgres_required');
      const access=credentials();
      const clients=makeClients(current.manifest,{rpcUrl:access.rpcUrl,privateKey:access.privateKey,signing:true});
      return publish(await run(pool,current.manifest,clients,{dryRun:false}));
    }catch(error){return publish({state:'blocked',reason:safeCode(error?.keeperCode),alert:true});}
    finally{inFlight=false;}
  };
  const start=()=>{
    if(timer!==null)return{state:'scheduled',intervalMs:INTERVAL_MS};
    if(!enabled())return publish({state:'disabled',reason:'disabled',alert:false});
    stopped=false;
    timer=schedule(()=>{void tick();},INTERVAL_MS);
    timer?.unref?.();
    void tick();
    return{state:'scheduled',intervalMs:INTERVAL_MS};
  };
  const stop=()=>{stopped=true;if(timer!==null)cancel(timer);timer=null;};
  return{tick,start,stop};
}

export function startEthRewardsWorker(pool,dependencies){
  const controller=createEthRewardsWorker(pool,dependencies);controller.start();return controller;
}
