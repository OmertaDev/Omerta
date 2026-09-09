#!/usr/bin/env node
// Produces unsigned public policy only. The human example intentionally fails validation until
// reviewed deployment addresses, runtime hashes, actors, caps and L2 bounds replace placeholders.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { keccak256, zeroAddress } from 'viem';
import { validateLiquidityManifest } from '../src/liquiditykeeper.js';

const address=(n)=>`0x${n.toString(16).padStart(40,'0')}`;
const E=10n**18n;
export function buildLiquidityManifestExample({placeholders=true}={}) {
  const names=['omr','poolManager','oracle','polVault','positionManager','hook','claim','gasVault','vig','desk','community','communityCustody','polBuyback','bond',
    'bankAlchemist','bankAsset','bankVault','bankTransmuter','bankDebt','bankBuffer','genesisController','auction','strategy','splitter'];
  const contracts=Object.fromEntries(names.map((name,i)=>[name,{address:address(0x1010+i),runtimeHash:keccak256('0x60006000')} ]));
  const m={schemaVersion:1,chainId:4663,governanceSafe:address(0x1001),keeper:address(0x1002),poolId:`0x${'11'.repeat(32)}`,contracts,indexing:{startL2Block:'1',maxBlocks:2000},
    gas:{maxGas:'500000',maxFeePerGas:'100000000',maxPriorityFeePerGas:'10000000',dailyBudget:String(E/10n),confirmations:8,maxSnapshotAgeSeconds:60},
    genesis:{treasuryRecipient:address(0x1003),vigRecipient:contracts.vig.address,founderRecipient:address(0x1004),genesisStartL2Block:'0',maxLogScanBlocks:1000000,maxCandidatePositions:32},jobs:[]};
  const revenue=(id,kind,target,extra={})=>m.jobs.push({id,kind,target,intervalSeconds:600,minNativeValue:String(E/1000n),...extra});
  const service=(id,kind,target,extra={})=>m.jobs.push({id,kind,target,intervalSeconds:300,...extra});
  const recipients={dev:address(0x1004),rwa:address(0x1003),community:contracts.community.address,lp:contracts.polVault.address};
  for(const asset of ['native','omr'])revenue(`hook_${asset}`,'hook_sweep','hook',{asset,recipients,initializer:'strategy'});
  for(const [stream,target,primaryRecipient] of [[0,'vig',contracts.claim.address],[1,'desk',contracts.claim.address],[2,'community',contracts.communityCustody.address],[3,'polBuyback',contracts.polVault.address]]) {
    const policy={stream,primaryRecipient,secondaryRecipient:stream===0?contracts.claim.address:zeroAddress};
    revenue(`${target}_buy`,'buyback',target,{...policy,maxAmount:String(E/10n),dailyBudget:String(E)});
    revenue(`${target}_tokens`,'token_revenue',target,policy);
  }
  revenue('pol_fees','pol_collect','polVault',{deskRecipient:contracts.desk.address,vigRecipient:contracts.vig.address});
  revenue('pol_increase','pol_increase','polVault',{maxNative:String(E/2n),maxOmr:String(E*500n),dailyNativeBudget:String(E*2n),dailyOmrBudget:String(E*2000n),slippageBps:300});
  revenue('pol_inventory','pol_fund_inventory','polVault',{executor:'polBuyback',maxNative:String(E/4n),dailyNativeBudget:String(E)});
  revenue('keeper_gas','gas_topup','gasVault',{recipient:m.keeper,maxAmount:String(E/100n),dailyBudget:String(E/10n)});
  const bank={asset:'bankAsset',vault:'bankVault',transmuter:'bankTransmuter',debtToken:'bankDebt',assetDecimals:6,minAssetAmount:'1000000',feeRecipient:address(0x1003)};
  service('bank_owner_harvest','bank_harvest','bankAlchemist',{...bank,user:address(0x1005)});
  service('bank_fee_sweep','bank_sweep','bankAlchemist',bank);
  service('bank_buffer','bank_fund_buffer','bankBuffer',{asset:'bankAsset',transmuter:'bankTransmuter',debtToken:'bankDebt',assetDecimals:6,minAssetAmount:'1000000',maxAssetAmount:'100000000',dailyAssetBudget:'500000000'});
  for(const kind of ['genesis_checkpoint','genesis_migrate','genesis_accept_foundation','genesis_sweep_unsold','genesis_distribute'])service(kind,kind,'genesisController');
  const validated=validateLiquidityManifest(m);
  if(!placeholders)return validated;
  const actors=new Map([[m.governanceSafe,'GOVERNANCE_SAFE'],[m.keeper,'DEDICATED_KEEPER'],[address(0x1003),'TREASURY_RECIPIENT'],
    [address(0x1004),'FOUNDER_RECIPIENT'],[address(0x1005),'DECLARED_BANK_BORROWER'],...Object.entries(contracts).map(([name,c])=>[c.address,`${name.toUpperCase()}_ADDRESS`])]);
  const replace=(value)=>{
    if(Array.isArray(value))return value.map(replace);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='runtimeHash'?'<REVIEWED_RUNTIME_KECCAK256>':k==='poolId'?'<CANONICAL_POOL_ID>':k==='genesisStartL2Block'?'<OWNER_PINNED_L2_START_BLOCK>':replace(v)]));
    return actors.has(value)?`<${actors.get(value)}>`:value;
  };
  return replace(validated);
}

const direct=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(direct) {
  const command=process.argv[2]||'--print';
  if(!['--print','--write','--self-test'].includes(command)||process.argv.length>3)throw new Error('Usage: node tools/liquidity-manifest-example.js [--print|--write|--self-test]');
  const example=buildLiquidityManifestExample(),fixture=buildLiquidityManifestExample({placeholders:false});
  if(command==='--print')console.log(JSON.stringify(example,null,2));
  else if(command==='--self-test') {
    validateLiquidityManifest(fixture);
    let refused=false;try{validateLiquidityManifest(example);}catch{refused=true;}
    if(!refused)throw new Error('Placeholder deployment must fail closed');
    console.log(`PASS unsigned manifest schema: ${fixture.jobs.length} typed jobs; placeholders rejected; no network or signer`);
  } else {
    const dir=fileURLToPath(new URL('../output/liquidity-automation/',import.meta.url));fs.mkdirSync(dir,{recursive:true});
    for(const [name,value] of [['manifest.example.json',example],['manifest.schema-fixture.json',fixture]]) {
      const bytes=`${JSON.stringify(value,null,2)}\n`;fs.writeFileSync(`${dir}/${name}`,bytes);
      console.log(JSON.stringify({file:name,sha256:createHash('sha256').update(bytes).digest('hex'),unsigned:true,synthetic:true}));
    }
  }
}
