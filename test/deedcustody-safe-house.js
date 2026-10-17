// Genuine EIP-712 signatures and SQL projections against deterministic pinned RPC reads.
// Actual OMR burning and settlement transitions are exercised by the Solidity suites.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newDb } from 'pg-mem';
import { keccak256, recoverTypedDataAddress, decodeFunctionData, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { characterDeedSafeHouseIntent, submitCharacterDeedSafeHouse } from '../src/deedcustodychain.js';
import { ensureCharacterDeedLife, bindCharacterDeedAccount, recordCharacterDeedEquipment,
  recordCharacterDeedSafeHouse, characterDeedStatus, recordCharacterDeedDeath,
  resolveCharacterDeedBeneficiary, confirmCharacterDeedDeath } from '../src/deedcustody.js';

const before = process.env.CHARACTER_DEED_CUSTODY_ENABLED;
process.env.CHARACTER_DEED_CUSTODY_ENABLED = 'true';
const db = newDb();
db.public.none(`CREATE TABLE characters(id TEXT PRIMARY KEY,account_id TEXT,generation INT,alive BOOLEAN);
  CREATE TABLE dynasty_tokens(token_id TEXT PRIMARY KEY,account_id TEXT);
  CREATE TABLE keeper_transactions(job_key TEXT PRIMARY KEY,status TEXT);`);
db.public.none(fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8')
  .match(/-- Character-life deed custody\.[\s\S]*?-- End character-life deed custody\./)[0]);
const adapter = db.adapters.createPg(), pool = new adapter.Pool();
const addr = n => `0x${BigInt(n).toString(16).padStart(40,'0')}`;
const owner = privateKeyToAccount(`0x${'32'.repeat(32)}`), other = privateKeyToAccount(`0x${'33'.repeat(32)}`);
const code = '0x60006000', txHash = `0x${'42'.repeat(32)}`;
const config = { address:addr(99),deed:addr(98),dynasty:addr(97),implementation:addr(96),omr:addr(95),chainId:4663,codeHash:keccak256(code) };
let day = BigInt(Math.floor(Date.now()/86400000)), quoteMissing = false;
let life, chainDead = false;
const pub = { getChainId:async()=>4663,getCode:async()=>code,
  readContract:async({functionName})=> {
    if (functionName === 'safeHouseQuote') {
      if (quoteMissing) throw new Error('DC: full volume day unavailable');
      return [day,100000n*10n**18n,5n*10n**18n];
    }
    if (functionName === 'lifeState') return { account:addr(1),wallet:owner.address,dynastyId:7n,dead:chainDead };
    return { deed:config.deed,dynasty:config.dynasty,accountImplementation:config.implementation,
      omr:config.omr,volumeSource:addr(94),volumeSourceRuntimeHash:keccak256(code),settlementManager:addr(94),
      lifecycleOperator:addr(93),accountRegistry:addr(92),ESTATE_DELAY:86400n,safeHouseNonce:0n,safeHouseUntil:0n }[functionName];
  },
  verifyTypedData:async({address,...args})=>(await recoverTypedDataAddress(args)).toLowerCase()===address.toLowerCase(),
};
const proof = n => ({finalized:true,txHash,ref:`${txHash}:${n}`,blockNumber:String(n),logIndex:0,blockTimestamp:Math.floor(Date.now()/1000)});
try {
  await pool.query("INSERT INTO characters VALUES ('a','account-a',1,true),('a2','account-a',2,true),('b','account-b',1,true)");
  await pool.query("INSERT INTO dynasty_tokens VALUES ('7','account-a')");
  life = await ensureCharacterDeedLife(pool,'a');
  await bindCharacterDeedAccount(pool,{lifeHash:life.life_hash,address:addr(1),dynastyTokenId:'7',...proof(1)});
  await recordCharacterDeedEquipment(pool,{tokenId:'77',lifeHash:life.life_hash,...proof(2)});
  const options = {config,publicClient:pub};
  const plan = await characterDeedSafeHouseIntent(pool,'account-a','77',2,options);
  assert.equal(plan.costOmr,'10'); assert.equal(plan.dailyBurnOmr,'5'); assert.equal(plan.priceDay,String(day));
  assert.equal(plan.previousDayVolumeAtomic,String(100000n*10n**18n));
  const approval = decodeFunctionData({abi:parseAbi(['function approve(address,uint256) returns(bool)']),data:plan.steps[0].data});
  assert.equal(approval.args[0].toLowerCase(),config.address.toLowerCase());
  assert.equal(approval.args[1],10n*10n**18n,'Approval is exact owner-authorized total burn');
  assert.equal((await characterDeedStatus(pool,'account-a')).equipment[0].protected,false);
  const args = {tokenId:'77',days:2,priceDay:plan.priceDay,maxBurn:plan.maxBurnAtomic,
    userNonce:plan.typedData.message.nonce,userIssuedAt:plan.typedData.message.issuedAt,userDeadline:plan.typedData.message.deadline,
    userSignature:await owner.signTypedData(plan.typedData)};
  const wrong = await other.signTypedData(plan.typedData);
  await assert.rejects(()=>submitCharacterDeedSafeHouse(pool,'account-a',{...args,userSignature:wrong},options),{code:'custody_consent'});
  await assert.rejects(()=>submitCharacterDeedSafeHouse(pool,'account-a',{...args,maxBurn:'1'},options),{code:'custody_quote'});
  assert.equal((await submitCharacterDeedSafeHouse(pool,'account-a',args,options)).pending,true);
  assert.equal((await submitCharacterDeedSafeHouse(pool,'account-a',args,options)).duplicate,true);
  assert.equal((await characterDeedStatus(pool,'account-a')).equipment[0].protected,false,'A queued signature never creates protection');
  quoteMissing = true;
  await assert.rejects(()=>characterDeedSafeHouseIntent(pool,'account-a','77',1,options),/full volume day unavailable/);
  quoteMissing = false; day -= 1n;
  await assert.rejects(()=>characterDeedSafeHouseIntent(pool,'account-a','77',1,options),{code:'custody_quote'});
  day += 1n;
  const now = BigInt(Math.floor(Date.now()/1000));
  const event = {...proof(3),tokenId:'77',dynastyTokenId:'7',lifeHash:life.life_hash,startsAt:now-10n,until:now+86400n,
    burnAmount:plan.maxBurnAtomic,priceDay:day,previousDayVolume:100000n*10n**18n,nonce:'0'};
  await assert.rejects(()=>recordCharacterDeedSafeHouse(pool,{...event,finalized:false}),{code:'custody_receipt'});
  await recordCharacterDeedSafeHouse(pool,event);
  assert.equal((await recordCharacterDeedSafeHouse(pool,event)).duplicate,true);
  const status = await characterDeedStatus(pool,'account-a');
  assert.equal(status.equipment[0].protected,true); assert.equal(status.equipment[0].coverageStatus,'confirmed');
  assert.equal(status.safeHouseIntents.length,0,'Finalized event closes the queued burn');
  chainDead = true;
  await assert.rejects(()=>characterDeedSafeHouseIntent(pool,'account-a','77',1,options),{code:'custody_binding'});
  await pool.query("UPDATE characters SET alive=false WHERE id='a'");
  const death = await recordCharacterDeedDeath(pool,{victimCharacterId:'a',killerCharacterId:'b',heirCharacterId:'a2'});
  const closed = (await pool.query("SELECT * FROM character_deed_lives WHERE life_id='a'")).rows[0];
  const releaseAt = BigInt(closed.death_at)+86400n;
  assert.equal((await resolveCharacterDeedBeneficiary(pool,'a',{tokenId:'77'})).disposition,'estate_waiting');
  await confirmCharacterDeedDeath(pool,{lifeHash:life.life_hash,deathSequence:death.deathSequence,chainReleaseAt:releaseAt,...proof(4)});
  assert.equal((await resolveCharacterDeedBeneficiary(pool,'a',{tokenId:'77',now:Number(releaseAt)*1000})).lifeId,'a2','Protected deed follows exact heir');
  await recordCharacterDeedSafeHouse(pool,{...event,...proof(5),tokenId:'88',startsAt:BigInt(closed.death_at)+1n,until:releaseAt+1n});
  assert.equal((await resolveCharacterDeedBeneficiary(pool,'a',{tokenId:'88'})).lifeId,'b','Post-death coverage cannot rewrite loot rights');
  console.log('deedcustody-safe-house: PASS (canonical completed-day quote, exact approval/max burn, real owner EIP712 signatures, UTC rollover/missing history fail closed, finalized coverage, protected heir and post-death purchase exclusion)');
} finally {
  await pool.end();
  if (before == null) delete process.env.CHARACTER_DEED_CUSTODY_ENABLED; else process.env.CHARACTER_DEED_CUSTODY_ENABLED=before;
}
