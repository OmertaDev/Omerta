// Independent regressions for the two custody adapter defects identified in review.
// Real journal/signature code; deterministic receipt/RPC fixture, no network sends.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newDb } from 'pg-mem';
import { encodeFunctionData, keccak256, parseTransaction, recoverTransactionAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { DEED_CUSTODY_ABI } from '../src/deedcustodychain.js';
import { runKeeperTransaction } from '../src/keepertransactions.js';

const definition = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const keeperSchema = definition.match(/CREATE TABLE IF NOT EXISTS keeper_transactions \([\s\S]*?\n\);/)?.[0];
const custodySchema = definition.match(/-- Character-life deed custody\.[\s\S]*?-- End character-life deed custody\./)?.[0];
assert(keeperSchema && custodySchema);
const db = newDb();
db.public.none(keeperSchema);
db.public.none(custodySchema);
db.public.none('CREATE TABLE dynasty_tokens(token_id TEXT PRIMARY KEY,account_id TEXT)');
const adapter = db.adapters.createPg(), pool = new adapter.Pool();
const source = fs.readFileSync(new URL('../src/deedcustodychain.js', import.meta.url), 'utf8');
try {
  for (let i=1; i<=101; ++i) await pool.query(
    `INSERT INTO character_deed_lives(life_id,life_hash,account_id,generation,status,created_at)
     VALUES ($1,$2,$3,1,'alive',$4)`, [`life-${i}`,`0x${i.toString(16).padStart(64,'0')}`,`account-${i}`,new Date(i*1000)]);
  await pool.query("INSERT INTO dynasty_tokens VALUES ('900','account-101')");
  const legacy = (await pool.query("SELECT * FROM character_deed_lives WHERE status='alive' ORDER BY created_at LIMIT 100")).rows;
  assert(!legacy.some(r => r.account_id === 'account-101'), 'legacy query permanently omitted eligible later lives');
  const query = source.match(/`(SELECT l\.\*,d\.token_id AS identity_token_id[\s\S]*?LIMIT 100)`/)?.[1];
  assert(query, 'reviewed binding query must filter eligibility before its bounded batch');
  assert.deepEqual((await pool.query(query)).rows.map(r=>r.account_id), ['account-101']);
  for (let i=1; i<=100; ++i) {
    await pool.query('INSERT INTO dynasty_tokens(token_id,account_id) VALUES ($1,$2)', [String(i),`account-${i}`]);
    await pool.query(
      `INSERT INTO character_deed_lives(life_id,life_hash,account_id,generation,status,closure_reason,dynasty_token_id)
       VALUES ($1,$2,$3,1,'dead','estate_escrow',$4)`,
      [`held-${i}`,`0x${(i+1000).toString(16).padStart(64,'0')}`,`account-${i}`,String(i)]);
  }
  assert.deepEqual((await pool.query(query)).rows.map(r=>r.account_id), ['account-101'],
    'one hundred policy-held dynasties cannot monopolize the binding candidate window');

  const account = privateKeyToAccount('0x'+'17'.repeat(32));
  const target = '0x'+'d'.repeat(40), code='0x60006000';
  let nonce=0,head=100n,sends=0,revert=true;
  const receipts = new Map();
  const blockHash = n => `0x${BigInt(n).toString(16).padStart(64,'0')}`;
  const pub = {
    getChainId:async()=>4663,getCode:async()=>code,getBlockNumber:async()=>head,
    getBlock:async({blockNumber})=>({number:blockNumber,hash:blockHash(blockNumber),timestamp:1_700_000_000n+blockNumber}),
    getTransactionCount:async()=>nonce,estimateGas:async()=>50000n,
    getTransactionReceipt:async({hash})=>{
      if(!receipts.has(hash))throw Object.assign(new Error('not found'),{name:'TransactionReceiptNotFoundError'});
      return receipts.get(hash);
    },
    sendRawTransaction:async({serializedTransaction})=>{
      ++sends; const tx=parseTransaction(serializedTransaction),hash=keccak256(serializedTransaction);
      ++head;nonce=Number(tx.nonce)+1;
      receipts.set(hash,{transactionHash:hash,from:await recoverTransactionAddress({serializedTransaction}),to:tx.to,
        blockNumber:head,blockHash:blockHash(head),status:revert?'reverted':'success',gasUsed:45000n,effectiveGasPrice:1n,logs:[]});
      return hash;
    },
  };
  const clients={account,publicClient:pub,walletClient:{prepareTransactionRequest:async r=>r,signTransaction:async r=>account.signTransaction(r)}};
  const life='0x'+'a'.repeat(64);
  const encode=issuedAt=>encodeFunctionData({abi:DEED_CUSTODY_ABI,functionName:'unequip',args:[
    {lifeId:life,deedId:77n,nonce:0n,issuedAt,deadline:issuedAt+300n},'0x1234']});
  const first=encode(1000n),fresh=encode(1400n);
  const legacyKey=`deed-exit:${life}:77:0`;
  const options=(jobKey,data)=>({chainId:4663,wallet:account.address,clients,target,targetCodeHash:keccak256(code),jobKey,
    request:{data,value:'0'},maxGas:100000n,maxFeePerGas:10n,maxPriorityFeePerGas:1n,confirmations:1,retryMs:0,
    gasBudget:{key:'review-custody',period:'fixture',limit:'10000000'}});
  assert.equal((await runKeeperTransaction(pool,options(legacyKey,first))).state,'reverted');
  assert.equal((await runKeeperTransaction(pool,options(legacyKey,fresh))).reason,'action_rebound',
    'refreshing an expired/reverted intent keeps contract nonce but changes the signed transaction');
  revert=false;
  const fixedKey=`deed-exit:${keccak256(fresh)}`;
  assert(source.includes('characterDeedExitJobKey(exit, life.life_hash)'), 'adapter shares the exact signed-intent journal key with its gameplay barrier');
  assert.equal((await runKeeperTransaction(pool,options(fixedKey,fresh))).state,'settled');
  assert.equal((await runKeeperTransaction(pool,options(fixedKey,fresh))).state,'settled');
  assert.equal(sends,2,'identical refreshed intent reuses its journal record without another send');
  console.log('deedcustody-review: PASS (101st-life eligibility behind unminted and policy-held dynasties, reproduced legacy action_rebound, refreshed intent retry, exact replay idempotency with real signed journal)');
} finally { await pool.end(); }
