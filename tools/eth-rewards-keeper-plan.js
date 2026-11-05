#!/usr/bin/env node
// Creates a public, disabled upkeep manifest. No keys, network client or signing/broadcast call.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validateMarketV2Manifest} from '../src/marketv2keeper.js';
import {loadEthReadinessCandidate} from './eth-rewards-readiness.js';
const requireThat=(value,reason)=>{if(!value)throw Error(reason);};
const amount=value=>{requireThat(/^[1-9]\d*$/.test(String(value??'')),'positive_upkeep_threshold_required');return BigInt(value);};
export function buildEthRewardsKeeperManifest(candidate,profile){
  requireThat(candidate.chainId===4663&&candidate.eth?.rewardAsset==='native ETH','native_eth_candidate_required');
  requireThat(candidate.eth.stakingEpochSeconds===2592000&&candidate.eth.stakingLockSeconds===2592000,'locked_staking_candidate_required');
  requireThat(candidate.eth.rewardsContinueAfterMaturity===true&&candidate.eth.renewalRequiredForRewards===false,'continuing_reward_candidate_required');
  requireThat(profile&&Object.keys(profile).every(k=>['gas','minimumNativeAmount','minimumOmrAmount','intervalSeconds'].includes(k)),'invalid_upkeep_profile');
  const interval=profile.intervalSeconds??60,native=amount(profile.minimumNativeAmount),omr=amount(profile.minimumOmrAmount);
  requireThat(Number.isSafeInteger(interval)&&interval>=60&&interval<=300&&BigInt(interval*4)<=BigInt(candidate.eth.policy.maxMarketAge),'upkeep_cadence_exceeds_market_window');
  requireThat(native<=BigInt(candidate.eth.policy.maxNativePerCall)&&omr<=BigInt(candidate.eth.policy.maxOmrPerCall),'upkeep_threshold_exceeds_per_call_cap');
  const pin=(role,artifact)=>({address:candidate.addresses[role],runtimeHash:candidate.runtimeHashes[role],artifact});
  return validateMarketV2Manifest({schemaVersion:2,chainId:4663,keeper:candidate.eth.keeper,governanceSafe:candidate.roles.safe,
    ethAutomation:{enabled:false,productionEnabled:false},
    contracts:{rewards:pin('ethRewards','OmertaEthRewardsV2'),vault:pin('ethStaking','OmertaEthStakingV2'),
      market:pin('marketState','OmertaMarketStateV2'),hook:pin('hook','OmertaHookV2'),manager:pin('poolManager','OmertaPoolManagerV2')},
    gas:profile.gas,jobs:[
      {id:'eth-finalize',kind:'eth_finalize',target:'vault',intervalSeconds:interval},
      {id:'eth-fund',kind:'eth_fund',target:'rewards',minimumAmount:String(native),intervalSeconds:interval},
      {id:'eth-refresh',kind:'eth_refresh',target:'market',intervalSeconds:interval},
      {id:'eth-convert',kind:'eth_convert',target:'rewards',minimumAmount:String(omr),intervalSeconds:interval},
      {id:'eth-collect',kind:'eth_collect',target:'rewards',minimumAmount:'1',intervalSeconds:interval},
    ]});
}
async function main(){
  const args={};for(let i=2;i<process.argv.length;i+=2){const k=process.argv[i],v=process.argv[i+1];requireThat(['--candidate','--expected-sha','--profile','--output'].includes(k)&&v&&!args[k],'invalid_arguments');args[k]=v;}
  requireThat(args['--profile']&&args['--output'],'public_profile_and_new_output_required');
  const candidate=loadEthReadinessCandidate(args['--candidate'],args['--expected-sha']);
  const profile=JSON.parse(fs.readFileSync(path.resolve(args['--profile']),'utf8')),manifest=buildEthRewardsKeeperManifest(candidate,profile);
  const data=JSON.stringify(manifest,null,2)+'\n';fs.writeFileSync(path.resolve(args['--output']),data,{flag:'wx'});
  console.log(JSON.stringify({status:'DISABLED_DRAFT_CREATED',sourceCandidateSha256:candidate.resultSha256,output:args['--output'],
    sha256:createHash('sha256').update(data).digest('hex'),productionEnabled:false,productionWrites:false,productionSigning:false,
    scheduling:'Run the existing single-shot keeper at least once per configured interval with its PostgreSQL journal; ready ETH jobs use last-service nonce fairness.'},null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(JSON.stringify({status:'BLOCKED',reason:e.message,productionWrites:false}));process.exitCode=2;});
