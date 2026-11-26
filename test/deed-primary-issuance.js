import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {getAddress, isAddress, keccak256, toBytes, encodeFunctionData, decodeFunctionData, hashTypedData} from 'viem';
import {classifyDeedIssuance, deedBuildingById} from '../src/deedbuildings.js';

// Actual production bodies; only SQL, signer and chain reads are finite fakes. No database,
// wallet, private key, network, server, SDK prover or native process is started by this test.
const source = readFileSync(new URL('../src/chain.js', import.meta.url), 'utf8');
const deeds = readFileSync(new URL('../src/deeds.js', import.meta.url), 'utf8');
const watcher = readFileSync(new URL('../src/watcher.js', import.meta.url), 'utf8');
function body(name, text = source) {
  const start = new RegExp(`^(?:export )?(?:async )?function ${name}\\(`, 'm').exec(text);
  assert.ok(start, name);
  const end = text.indexOf('\n}', start.index);
  assert.ok(end > start.index, name);
  return text.slice(start.index, end + 2).replace(/^export /, '');
}
class GameError extends Error { constructor(code, message) { super(message); this.code = code; } }
const address = getAddress('0x' + '12'.repeat(20)), contract = getAddress('0x' + '34'.repeat(20));
const hash = c => '0x' + c.repeat(64), runtime = '0x60016000';
const domain = {name: 'OmertaStreetDeed', version: '1', chainId: 31337, verifyingContract: contract, runtimeHash: keccak256(runtime)};
const signature = '0x' + '12'.repeat(65);
const types = {DeedVoucher: [
  {name:'to',type:'address'}, {name:'name',type:'string'}, {name:'district',type:'string'},
  {name:'nonce',type:'uint256'}, {name:'deadline',type:'uint256'}]};
const abi = ['claim','claimGameplay'].map(name => ({type:'function',name,stateMutability:'payable',
  inputs:[{name:'v',type:'tuple',components:types.DeedVoucher},{name:'sig',type:'bytes'}],outputs:[]}));
const name = 'Synthetic Avenue', token = BigInt(keccak256(toBytes(name))).toString();
const row = (kind = 'gameplay') => ({account_id:'alice',name,name_lc:name.toLowerCase(),district:'docks',
  building_id:kind === 'gameplay' ? 'docks-0001' : kind === 'paid' ? 'docks-0168' : 'docks-0334',
  home_authority_token:'old-home',issuance_kind:kind});
const quoteFor = (overrides = {}) => ({name,district:'The Docks',tokenId:token,chainId:domain.chainId,contract,
  runtimeHash:domain.runtimeHash,blockNumber:'100',blockHash:hash('a'),timestamp:'1700000000',
  identityIssued:false,nativeName:'',nativeDistrict:'',gameplayIdentity:false,liveOwner:null,valueWei:'10000000000000000',usedNonce:false,...overrides});
const meta = (overrides = {}) => ({confirmed:true,chainId:domain.chainId,contract,runtimeHash:domain.runtimeHash,
  transactionHash:hash('b'),blockHash:hash('a'),blockNumber:'100',logIndex:2,tokenId:token,...overrides});
const event = (kind = 'paid') => ({...meta(),nonce:1,to:address,name,district:'The Docks',
  issue:{...meta({logIndex:3}),kind,to:address,count:'1',...(kind === 'paid' ? {payer:address,amount:'10000000000000000'} : {})}});
const burn = () => ({...meta({logIndex:1,blockNumber:'90'}),kind:'burn',from:address});
const refuses = run => assert.rejects(run, e => ['migration_required','claim_pending'].includes(e.code) && !/PRIVATE/.test(e.message));

function fixture({kind='gameplay', legacy=false, signerFails=false, failOnceSQL=null, initial={}, quote=quoteFor()} = {}) {
  const signs=[], trace=[], errors=[];
  let state = {deed:kind === 'paid' ? null : row(kind),intent:kind === 'paid' ? row('paid') : null,
    assignment:kind === 'paid' ? null : {building_id:row(kind).building_id,street_name:name},
    claims:legacy ? [{street_name:name,building_id:row(kind).building_id,source:'legacy'}]
      : [{street_name:name,building_id:row(kind).building_id,source:'exploration'}],
    vouchers:[],nonce:1,issued:kind === 'paid' ? 0 : 1,activities:['open'],reimports:[],...structuredClone(initial)};
  let transaction=null;
  async function query(sql, p=[]) {
    trace.push({sql,p});
    if (sql === 'BEGIN') { assert.equal(transaction,null); transaction=structuredClone(state); return {rows:[]}; }
    if (sql === 'COMMIT') { assert.ok(transaction); state=transaction; transaction=null; return {rows:[]}; }
    if (sql === 'ROLLBACK') { transaction=null; return {rows:[]}; }
    const s=transaction || state;
    const rows = xs => ({rows:xs.filter(Boolean),rowCount:xs.filter(Boolean).length});
    if (sql.startsWith('SELECT * FROM account_persistent')) return rows([{account_id:'alice',minted:true,wallet_address:address}]);
    if (sql.startsWith('SELECT account_id FROM account_persistent')) return rows(sql.includes('lower(wallet_address)') && s.burnerLinked===false ? [] : [{account_id:'alice'}]);
    if (sql.startsWith('SELECT * FROM street_deeds WHERE account_id=')) return rows(s.deed?.account_id === p[0] ? [s.deed] : []);
    if (sql.startsWith('SELECT * FROM street_deeds WHERE name=')) return rows(s.deed?.name===p[0] ? [s.deed] : []);
    if (sql.startsWith('SELECT * FROM street_deeds WHERE onchain_token_id=')) return rows(s.deed?.onchain_token_id === p[0] ? [s.deed] : []);
    if (sql.startsWith('SELECT * FROM street_deed_paid_intents')) return rows(s.intent?.account_id === p[0] ? [s.intent] : []);
    if (sql.startsWith('SELECT * FROM street_deed_building_assignments')) return rows([s.assignment]);
    if (sql.startsWith('SELECT * FROM street_deed_primary_claims')) return rows(s.claims);
    if (sql.startsWith('SELECT 1 FROM street_deeds WHERE name_lc=')) return rows(s.deed?.name_lc===p[0] ? [s.deed] : []);
    if (sql.startsWith('SELECT 1 FROM street_deed_building_assignments')) return rows(s.assignment ? [s.assignment] : []);
    if (sql === 'SELECT COUNT(*) n FROM street_deed_paid_intents') return rows([{n:s.intent ? '1' : '0'}]);
    if (sql === 'SELECT COUNT(*) n FROM street_deeds') return rows([{n:s.deed ? '1' : '0'}]);
    if (sql === 'SELECT COUNT(*) n FROM street_deed_building_assignments') return rows([{n:s.assignment ? '1' : '0'}]);
    if (sql.startsWith('SELECT 1 FROM street_deeds WHERE account_id=')) return rows(s.deed?.account_id===p[0] ? [s.deed] : []);
    if (sql.startsWith('SELECT 1 FROM deed_reimports WHERE ref=')) return rows(s.reimports.filter(r=>r.ref===p[0]));
    if (sql.startsWith('SELECT status,burn_receipt')) return rows(s.reimports.filter(r=>r.ref===p[0]));
    if (sql.startsWith('SELECT ref, created_at, burn_receipt FROM deed_reimports')) return rows(s.reimports.filter(r=>r.token_id===p[0] && r.status==='pending'));
    if (sql.startsWith('SELECT ref, wallet_address, token_id, burn_receipt FROM deed_reimports')) return rows(s.reimports.filter(r=>r.status==='pending'));
    if (sql.startsWith('SELECT * FROM deed_reimports WHERE ref=')) return rows(s.reimports.filter(r=>r.ref===p[0]));
    if (sql.startsWith('SELECT * FROM vouchers WHERE account_id=')) return rows(s.vouchers.filter(v=>v.account_id===p[0] && v.status==='signed' && v.gear_id===p[1]));
    if (sql.startsWith('SELECT * FROM vouchers WHERE nonce=')) return rows(s.vouchers.filter(v=>String(v.nonce)===String(p[0])));
    if (sql.startsWith('SELECT * FROM vouchers WHERE id=')) return rows(s.vouchers.filter(v=>v.id===p[0]));
    if (sql.startsWith('SELECT id, nonce, gear_id, deadline, signed_payload FROM vouchers')) return rows(s.vouchers.filter(v=>v.status==='signed' && v.deadline<p[0]));
    if (sql.startsWith('SELECT status FROM vouchers WHERE id=')) return rows(s.vouchers.filter(v=>v.id===p[0]));
    if (sql === 'SELECT * FROM chain_reserve WHERE id=1 FOR UPDATE') return rows([{next_nonce:s.nonce}]);
    if (sql === 'SELECT issued FROM street_deed_supply WHERE id=1 FOR UPDATE') return rows([{issued:s.issued}]);
    assert.ok(transaction, 'Mutations require a transaction');
    if (failOnceSQL && sql.startsWith(failOnceSQL)) { failOnceSQL=null; throw new Error('PRIVATE synthetic SQL failure'); }
    if (sql.startsWith('UPDATE chain_reserve SET next_nonce')) { s.nonce++; return rows([]); }
    if (sql.startsWith('UPDATE city_home_activities')) { s.activities=['closed']; return rows([]); }
    if (sql.startsWith('UPDATE street_deeds SET onchain_token_id=$2')) { Object.assign(s.deed,{onchain_token_id:p[1],home_authority_token:p[2]}); return rows([]); }
    if (sql.includes('UPDATE street_deeds SET onchain_token_id=NULL')) { if(s.deed)Object.assign(s.deed,{onchain_token_id:null,home_authority_token:p[1],onchain_owner:null,extracted_by_account:null}); return rows([]); }
    if (sql.startsWith('INSERT INTO vouchers')) { s.vouchers.push({id:p[0],account_id:p[1],gear_id:p[4],nonce:p[5],to_address:p[6],deadline:p[7],status:p[8],signed_payload:p[9]}); return rows([]); }
    if (sql.startsWith('INSERT INTO street_deed_paid_intents')) { s.intent={account_id:p[0],name:p[1],name_lc:p[2],district:p[3],building_id:p[4]}; return rows([]); }
    if (sql.startsWith('INSERT INTO street_deed_building_assignments')) { assert.equal(s.assignment,null); s.assignment={building_id:p[0],street_name:p[1]}; return rows([]); }
    if (sql.startsWith('INSERT INTO street_deeds')) { assert.equal(s.deed,null); s.deed={account_id:p[0],name:p[1],name_lc:p[2],district:p[3],building_id:p[4],issuance_kind:'paid',primary_issuance_receipt:JSON.parse(p[5]),onchain_token_id:p[6],onchain_owner:p[7],extracted_by_account:p[8],home_authority_token:p[9],last_extraction_receipt:JSON.parse(p[10])}; return rows([]); }
    if (sql === 'UPDATE street_deed_supply SET issued=$1 WHERE id=1') { s.issued=p[0]; return rows([]); }
    if (sql.startsWith('DELETE FROM street_deed_paid_intents')) { s.intent=null; return rows([]); }
    if (sql.startsWith('UPDATE street_deeds SET primary_issuance_receipt=')) { assert.equal(s.deed.primary_issuance_receipt,undefined); s.deed.primary_issuance_receipt=JSON.parse(p[1]); return rows([]); }
    if (sql.startsWith('UPDATE street_deeds SET last_extraction_receipt=')) { s.deed.last_extraction_receipt=JSON.parse(p[1]); return rows([]); }
    if (sql.startsWith('UPDATE street_deeds SET last_burn_receipt=')) { if(s.deed)s.deed.last_burn_receipt=JSON.parse(p[1]); return rows([]); }
    if (sql.startsWith('UPDATE deed_reimports SET burn_receipt=')) { s.reimports.find(r=>r.ref===p[0]).burn_receipt=JSON.parse(p[1]); return rows([]); }
    if (sql.startsWith('INSERT INTO deed_reimports')) { s.reimports.push({ref:p[0],wallet_address:p[1],token_id:p[2],burn_receipt:JSON.parse(p[3]),status:'pending',created_at:new Date().toISOString()}); return rows([]); }
    if (sql.startsWith("UPDATE deed_reimports SET status='applied'")) { Object.assign(s.reimports.find(r=>r.ref===p[0]),{status:'applied',applied_account:p[1]}); return rows([]); }
    if (sql.startsWith("UPDATE deed_reimports SET status='superseded'")) { s.reimports.filter(r=>r.token_id===p[0] && r.status==='pending').forEach(r=>r.status='superseded'); return rows([]); }
    if (sql.startsWith('UPDATE street_deeds SET account_id=$2, onchain_token_id=NULL')) { Object.assign(s.deed,{account_id:p[1],onchain_token_id:null,extracted_by_account:null,extracted_at:null,onchain_owner:null,controller_account:null,control_until:null,sale_price:null,home_authority_token:p[3]}); return rows([]); }
    if (sql.startsWith('UPDATE street_deeds SET home_authority_token=')) { s.deed.home_authority_token=p[2]; return rows([]); }
    if (sql.startsWith('INSERT INTO street_deed_history')) return rows([]);
    if (sql.startsWith('UPDATE street_deed_history SET account_id=')) return rows([]);
    if (sql.startsWith('UPDATE street_deeds SET account_id=$2, extracted_by_account=')) { Object.assign(s.deed,{account_id:p[1],extracted_by_account:p[2],home_authority_token:p[3]}); return rows([]); }
    if (sql.startsWith("UPDATE vouchers SET status='claimed'")) { s.vouchers.find(v=>String(v.nonce)===String(p[0])).status='claimed'; return rows([]); }
    if (sql.startsWith("UPDATE vouchers SET status='expired'")) { s.vouchers.find(v=>v.id===p[0]).status='expired'; return rows([]); }
    assert.fail(`Unexpected finite-fake SQL: ${sql}`);
  }
  const client={query,release(){}};
  let ids=0;
  const context=vm.createContext({GameError,process:{env:{CHAIN_ID:'31337',STREET_DEED_ADDRESS:contract,STREET_DEED_RUNTIME_HASH:domain.runtimeHash,DEED_RECOVERY_ADDRESS:address}},
    isAddress,getAddress,keccak256,toBytes,encodeFunctionData,classifyDeedIssuance,deedBuildingById,DEED_VOUCHER_TYPES:types,
    GAMEPLAY_DEED_VOUCHER_TYPES:{GameplayDeedVoucher:types.DeedVoucher},DEED_CLAIM_ABI:abi,
    DISTRICTS:[{id:'docks',name:'The Docks'}],WITHDRAW_TTL_SEC:86400,DEED_RECOVER_AFTER_MS:30*86400000,RECLAIM_GRACE_SEC:600,dayOf:()=>100,
    readDeedClaimQuote:async()=>quote,uid:()=>`synthetic-${++ids}`,console:{error:(...args)=>errors.push(args)},
    signerAccount:()=>({async signTypedData(data){signs.push(data); if(signerFails)throw new Error('synthetic signer refusal'); return signature;}}),
    cleanText:value=>String(value),DEEDS:{NAME_MIN:3,NAME_MAX:48},
    loadDeed:async(_client,id)=>(transaction || state).deed?.account_id===id ? (transaction || state).deed : null,
    deedSupply:async()=>({remaining:2500-(transaction || state).issued,paid:{remaining:1000}})});
  vm.runInContext(['deedChainConfig','deedAdmissionConfig','deedTokenId','deedClaimTransaction','validateDeedEvent','requestDeedWithdraw','markDeedExtracted','applyDeedReimport','reimportDeed','recoverStrandedDeed','sweepDeedVouchers','sweepDeedReimports',
    ...(source.includes('function prepareDeedReimport(')?['prepareDeedReimport']:[])]
    .map(n=>body(n)).join('\n')+'\n'+body('reservePaidDeed',deeds)+'\nglobalThis.production={requestDeedWithdraw,markDeedExtracted,validateDeedEvent,reservePaidDeed,reimportDeed,recoverStrandedDeed,sweepDeedVouchers,sweepDeedReimports};',context,{timeout:1000});
  const pool={query,connect:async()=>client};
  return {signs,trace,errors,state:()=>state,quote,
    request:(options={})=>context.production.requestDeedWithdraw(pool,'alice',address,{attest:true,reader:async()=>quote,...options}),
    confirm:e=>context.production.markDeedExtracted(pool,e),
    reimport:e=>context.production.reimportDeed(pool,e,{reader:async()=>quote}),
    recover:()=>context.production.recoverStrandedDeed(pool,{street:name,reader:async()=>quote}),
    sweep:reader=>context.production.sweepDeedVouchers(pool,reader),
    sweepReimports:(options={})=>context.production.sweepDeedReimports(pool,{reader:async()=>quote,...options}),
    reserve:async data=>{await query('BEGIN');try{const r=await context.production.reservePaidDeed({account_id:'alice'},data,client);await query('COMMIT');return r;}catch(e){await query('ROLLBACK');throw e;}}};
}

test('classifier requires truthful exact gameplay provenance; never infers paid legacy entitlement',()=>{
  const deed=row(),assignment={building_id:deed.building_id,street_name:name},quote=quoteFor();
  const args={deed,assignment,quote,domain};
  for(const source of ['exploration','quest']) assert.equal(classifyDeedIssuance({...args,primaryClaim:{street_name:name,building_id:deed.building_id,source}}).route,'gameplay');
  for(const primaryClaim of [null,{street_name:name,building_id:deed.building_id,source:'legacy'},
    {street_name:'Other',building_id:deed.building_id,source:'quest'}]) assert.equal(classifyDeedIssuance({...args,primaryClaim}).ok,false);
  assert.equal(classifyDeedIssuance({deed:row('paid'),assignment:{building_id:row('paid').building_id,street_name:name},quote,domain}).ok,false);
  assert.equal(classifyDeedIssuance({intent:row('partnership'),quote,domain}).ok,false);
});

test('production gameplay signing selects exact native type/calldata and retains home closure/rotation',async()=>{
  const f=fixture(),result=await f.request();
  assert.equal(f.signs.length,1); assert.equal(f.signs[0].primaryType,'GameplayDeedVoucher');
  assert.equal(result.transaction.value,'0'); assert.equal(result.transaction.to,contract);
  const decoded=decodeFunctionData({abi,data:result.transaction.data});
  assert.equal(decoded.functionName,'claimGameplay'); assert.equal(decoded.args[0].name,name);
  const signed=f.signs[0],{runtimeHash,...nativeDomain}=signed.domain;
  assert.equal(hashTypedData(signed),hashTypedData({...signed,domain:nativeDomain}), 'Admission metadata does not change the exact native EIP-712 domain');
  assert.deepEqual(f.state().activities,['closed']); assert.notEqual(f.state().deed.home_authority_token,'old-home');
});

test('production legacy and conflicting domain refuse before nonce/state/signing',async()=>{
  for(const options of [{legacy:true},{quote:quoteFor({runtimeHash:hash('f')})},{initial:{deed:{...row(),issuance_kind:'paid'}}}]){
    const f=fixture(options),before=structuredClone(f.state()); await refuses(f.request); assert.equal(f.signs.length,0); assert.deepEqual(f.state(),before);
  }
});

test('production paid intent signs actual quoted value yet remains absent from every owned-street table',async()=>{
  const f=fixture({kind:'paid'}),result=await f.request();
  assert.equal(result.issuanceRoute,'paid'); assert.equal(result.claimMethod,'claim'); assert.equal(result.transaction.value,'10000000000000000');
  assert.equal(decodeFunctionData({abi,data:result.transaction.data}).functionName,'claim');
  assert.equal(f.state().deed,null); assert.equal(f.state().assignment,null); assert.equal(f.state().issued,0);
  assert.deepEqual(f.state().activities,['open']); assert.equal(result.benefitEligible,false);
});

test('actual reservation stores only an inert intent, is idempotent, and rejects allocated/nonpaid property',async()=>{
  const f=fixture({kind:'paid',initial:{intent:null}});
  const input={name,buildingId:'docks-0168',district:'docks'};
  assert.equal((await f.reserve(input)).status,'payment_required');
  assert.equal((await f.reserve(input)).benefitEligible,false);
  assert.equal(f.state().deed,null); assert.equal(f.state().assignment,null); assert.equal(f.state().issued,0);
  await assert.rejects(()=>f.reserve({...input,name:'Other Avenue'}),e=>e.code==='intent_pending');
  for(const buildingId of ['docks-0001','docks-0334','unknown']) await assert.rejects(()=>f.reserve({...input,buildingId}),e=>e.code==='building');
});

test('production resume retains signature/nonce and refreshes exact unsigned payment quote',async()=>{
  const f=fixture({kind:'paid'}),first=await f.request(); f.quote.valueWei='20000000000000000';
  const second=await f.request(); assert.equal(second.signature,first.signature); assert.equal(second.nonce,first.nonce);
  assert.equal(second.transaction.value,'20000000000000000'); assert.equal(f.signs.length,1); assert.equal(f.state().nonce,2);
  f.quote.usedNonce=true; await refuses(f.request); assert.equal(f.signs.length,1);
});

test('production signer failure and absent strict attestation roll back all pending effects',async()=>{
  for(const kind of ['paid','gameplay']){
    const f=fixture({kind,signerFails:true}),before=structuredClone(f.state());
    await assert.rejects(f.request,/synthetic signer refusal/); assert.deepEqual(f.state(),before);
    const g=fixture({kind}); await assert.rejects(()=>g.request({attest:'true'}),e=>e.code==='attestation'); assert.equal(g.signs.length,0);
  }
});

test('confirmed paid first event finalizes exactly once; JSONB key order does not change identity',async()=>{
  const f=fixture({kind:'paid'}); await f.request(); const e=event(); await f.confirm(e);
  assert.equal(f.state().deed.account_id,'onchain:'+token); assert.equal(f.state().intent,null); assert.equal(f.state().issued,1);
  assert.equal(f.state().deed.primary_issuance_receipt.amountWei,'10000000000000000');
  const receipt=f.state().deed.primary_issuance_receipt;
  f.state().deed.primary_issuance_receipt=Object.fromEntries(Object.entries(receipt).reverse());
  assert.equal((await f.confirm(e)).duplicate,true); assert.equal(f.state().issued,1);
});

test('missing, cross-transaction, wrong amount/domain and conflicting first events cannot create a paid street',async()=>{
  const mutations=[e=>e.issue=null,e=>e.issue.transactionHash=hash('c'),e=>e.issue.amount='1',e=>e.runtimeHash=hash('d'),e=>e.issue.kind='gameplay',e=>e.name='PRIVATE unknown'];
  for(const mutate of mutations){ const f=fixture({kind:'paid'}); await f.request(); const before=structuredClone(f.state()),e=event(); mutate(e);
    await refuses(()=>f.confirm(e)); assert.deepEqual(f.state(),before); }
});

test('confirmed gameplay receipt preserves entitlement while rekeying home authority',async()=>{
  const f=fixture(); await f.request(); await f.confirm(event('gameplay'));
  assert.equal(f.state().deed.primary_issuance_receipt.kind,'gameplay'); assert.equal(f.state().deed.account_id,'onchain:'+token); assert.equal(f.state().issued,1);
});

test('same-domain burned identity remints at zero without changing permanent issuance receipt/counter',async()=>{
  const q=quoteFor({identityIssued:true,nativeName:name,nativeDistrict:'The Docks',gameplayIdentity:true});
  const extraction=meta({blockNumber:'80',transactionHash:hash('e')});
  const f=fixture({quote:q,initial:{deed:{...row(),last_burn_receipt:burn(),last_extraction_receipt:extraction}}});
  const r=await f.request(); assert.equal(r.issuanceRoute,'remint'); assert.equal(r.transaction.value,'0'); assert.equal(f.signs[0].primaryType,'DeedVoucher');
  const e=event(); e.issue=null; await f.confirm(e); assert.equal(f.state().issued,1); assert.equal(f.state().deed.primary_issuance_receipt,undefined);
  for(const receipt of [null,{...burn(),chainId:1},{...burn(),blockNumber:'101'}]){
    const g=fixture({quote:q,initial:{deed:{...row(),last_burn_receipt:receipt,last_extraction_receipt:extraction}}}); await refuses(g.request); assert.equal(g.signs.length,0);
  }
  const live=fixture({quote:{...q,liveOwner:address},initial:{deed:{...row(),last_burn_receipt:burn(),last_extraction_receipt:extraction}}});
  await refuses(live.request); assert.equal(live.signs.length,0);
});

test('actual quote reader pins runtime, chain and canonical block; malformed admission refuses',async()=>{
  const env={CHAIN_ID:'31337',STREET_DEED_ADDRESS:contract,STREET_DEED_RUNTIME_HASH:domain.runtimeHash,CHAIN_CONFIRMATIONS:'5'};
  const bindings={GameError,process:{env},isAddress,getAddress,keccak256,toBytes,RECLAIM_GRACE_SEC:600};
  const read=new Function(...Object.keys(bindings), ['deedChainConfig','deedAdmissionConfig','deedTokenId','readDeedClaimQuote']
    .map(n=>body(n)).join('\n')+'\nreturn readDeedClaimQuote;')(...Object.values(bindings));
  const calls=[];
  const client={getChainId:async()=>31337,getBlockNumber:async()=>105n,getBlock:async()=>({hash:hash('a'),timestamp:1700000000n}),getCode:async()=>runtime,
    async readContract(call){calls.push(call); return {primarySaleConfigured:true,deedName:'',deedDistrict:'',gameplayIdentity:false,quoteClaim:10000000000000000n}[call.functionName];}};
  const q=await read(name,'The Docks',{publicClient:client}); assert.equal(q.valueWei,'10000000000000000'); assert.ok(calls.every(c=>c.blockNumber===100n));
  await assert.rejects(()=>read(name,'The Docks',{publicClient:{...client,getChainId:async()=>1}}),e=>e.code==='chain_unavailable');
  await assert.rejects(()=>read(name,'The Docks',{publicClient:{...client,getCode:async()=>'0x6002'}}),e=>e.code==='chain_unavailable');
  const makeReader=new Function(...Object.keys(bindings),['deedChainConfig','deedAdmissionConfig','makeDeedReader'].map(n=>body(n)).join('\n')+'\nreturn makeDeedReader;')(...Object.values(bindings));
  const nonceReader=await makeReader({publicClient:{...client,readContract:async()=>false}});
  const nonceState=await nonceReader.nonceState(1,1);assert.equal(nonceState.used,false);assert.equal(nonceState.expired,true);assert.equal(nonceState.domain.runtimeHash,domain.runtimeHash);
  const issued={...client,readContract:async call=>call.functionName==='deedName' ? name : call.functionName==='deedDistrict' ? 'The Docks'
    : call.functionName==='ownerOf' ? address : client.readContract(call)};
  assert.equal((await read(name,'The Docks',{publicClient:issued})).liveOwner,address);
  const absent={...issued,readContract:async call=>{if(call.functionName==='ownerOf'){const error=new Error('synthetic');error.walk=()=>({data:{errorName:'ERC721NonexistentToken',args:[BigInt(token)]}});throw error;}return issued.readContract(call);}};
  assert.equal((await read(name,'The Docks',{publicClient:absent})).liveOwner,null);
  await assert.rejects(()=>read(name,'The Docks',{publicClient:{...issued,readContract:async call=>{if(call.functionName==='ownerOf')throw new Error('PRIVATE transport');return issued.readContract(call);}}}),e=>e.code==='chain_unavailable'&&!e.message.includes('PRIVATE'));
  let reads=0;
  await assert.rejects(()=>read(name,'The Docks',{publicClient:{...client,getBlock:async()=>({hash:++reads===1 ? hash('a') : hash('c'),timestamp:1n})}}),e=>e.code==='chain_unavailable');
  delete env.STREET_DEED_RUNTIME_HASH; await assert.rejects(()=>read(name,'The Docks',{publicClient:client}),e=>e.code==='chain_unconfigured');
});

test('actual confirmed burn reimports the same identity, retaining issuance proof and rotating home authority',async()=>{
  const f=fixture(); await f.request(); await f.confirm(event('gameplay'));
  const receipt=structuredClone(f.state().deed.primary_issuance_receipt);
  Object.assign(f.quote,{identityIssued:true,nativeName:name,nativeDistrict:'The Docks',gameplayIdentity:true,blockNumber:'110',valueWei:'0'});
  const e={...meta({blockNumber:'110',logIndex:4,transactionHash:hash('c')}),from:address,ref:hash('c')+':4'};
  assert.equal((await f.reimport(e)).applied,true); assert.equal(f.state().deed.account_id,'alice'); assert.equal(f.state().deed.onchain_token_id,null);
  assert.equal(f.state().deed.extracted_by_account,null); assert.equal(f.state().deed.onchain_owner,null);
  assert.deepEqual(f.state().deed.primary_issuance_receipt,receipt); assert.deepEqual(f.state().activities,['closed']);
  assert.equal(f.state().reimports[0].status,'applied');
  assert.equal((await f.reimport(e)).duplicate,true);
  assert.equal((await f.confirm(event('gameplay'))).duplicate,true);
});

test('stale burn and live or conflicting native identity cannot reactivate benefits',async()=>{
  for(const change of [q=>q.liveOwner=address,q=>q.nativeDistrict='Wrong District',q=>q.runtimeHash=hash('f')]){
    const f=fixture(); await f.request(); await f.confirm(event('gameplay'));
    Object.assign(f.quote,{identityIssued:true,nativeName:name,nativeDistrict:'The Docks',gameplayIdentity:true,blockNumber:'110'});change(f.quote);
    const before=structuredClone(f.state()),e={...meta({blockNumber:'110',logIndex:4}),from:address,ref:hash('b')+':4'};
    await refuses(()=>f.reimport(e)); assert.deepEqual(f.state(),before);
  }
  const f=fixture(); await f.request(); await f.confirm(event('gameplay'));
  Object.assign(f.quote,{identityIssued:true,nativeName:name,nativeDistrict:'The Docks',gameplayIdentity:true,blockNumber:'110'});
  const e={...meta({blockNumber:'90',logIndex:4,transactionHash:hash('c')}),from:address,ref:hash('c')+':4'};
  const before=structuredClone(f.state());await refuses(()=>f.reimport(e));assert.deepEqual(f.state(),before);
});

test('recovery retains fixed recipient/delay and supersedes every pending burn only after validated provenance',async()=>{
  const f=fixture({initial:{burnerLinked:false}});await f.request();await f.confirm(event('gameplay'));
  Object.assign(f.quote,{identityIssued:true,nativeName:name,nativeDistrict:'The Docks',gameplayIdentity:true,blockNumber:'110'});
  const e={...meta({blockNumber:'110',logIndex:4,transactionHash:hash('c')}),from:address,ref:hash('c')+':4'};
  assert.equal((await f.reimport(e)).pending,true);
  await assert.rejects(f.recover,e=>e.code==='too_soon');assert.equal(f.signs.length,1);
  f.state().reimports[0].created_at=new Date(Date.now()-31*86400000).toISOString();
  f.state().reimports.push({...structuredClone(f.state().reimports[0]),ref:'retained-second-pending'});
  const r=await f.recover();assert.equal(r.to,address);assert.equal(f.signs.at(-1).primaryType,'DeedVoucher');
  assert.ok(f.state().reimports.every(r=>r.status==='superseded'));assert.equal(f.state().issued,1);
});

test('actual canonical source pairs first events and preserves full burn metadata; stale/reorg/runtime logs refuse',async()=>{
  const env={CHAIN_ID:'31337',STREET_DEED_ADDRESS:contract,STREET_DEED_RUNTIME_HASH:domain.runtimeHash,CHAIN_CONFIRMATIONS:'5'};
  const bindings={GameError,process:{env},isAddress,getAddress,keccak256,toBytes,makeAssetDecimals:()=>null};
  const make=new Function(...Object.keys(bindings),body('deedChainConfig')+'\n'+body('deedAdmissionConfig')+'\n'+body('makeViemSource',watcher)+'\nreturn makeViemSource;')(...Object.values(bindings));
  let blockHash=hash('a'),code=runtime;
  const log=(args,index)=>({address:contract,args,blockNumber:100n,blockHash,transactionHash:hash('b'),logIndex:index});
  const client={getChainId:async()=>31337,getBlockNumber:async()=>105n,getBlock:async()=>({hash:blockHash}),getCode:async()=>code,
    async getLogs({event}){if(event.name==='Extracted')return [log({nonce:1n,to:address,tokenId:BigInt(token),name,district:'The Docks'},2)];
      if(event.name==='PublicSalePaid')return [log({payer:address,to:address,tokenId:BigInt(token),publicCount:1n,amount:10000000000000000n},3)];
      if(event.name==='Redeemed')return [log({from:address,tokenId:BigInt(token)},4)]; return [];}};
  const source=await make({publicClient:client});
  const [extracted]=await source.deedExtractedLogs(100,100); assert.equal(extracted.issue.kind,'paid'); assert.equal(extracted.issue.transactionHash,extracted.transactionHash);
  const [redeemed]=await source.deedRedeemedLogs(100,100); assert.equal(redeemed.ref,hash('b')+':4'); assert.equal(redeemed.confirmed,true); assert.equal(redeemed.runtimeHash,domain.runtimeHash);
  code='0x6002'; await assert.rejects(()=>source.deedExtractedLogs(100,100),/canonical event verification/); code=runtime;
  const bad={...client,getBlock:async()=>({hash:hash('f')})}; const badSource=await make({publicClient:bad});
  await assert.rejects(()=>badSource.deedExtractedLogs(100,100),/canonical event verification/);
});

test('nonce-only sweep cannot fabricate receipts or revive a deed without same-domain confirmed expiry',async()=>{
  for(const observation of [{used:true,expired:true,domain},{used:false,expired:false,domain},
    {used:false,expired:true,domain:{...domain,runtimeHash:hash('f')}},{used:false,expired:true,domain}]){
    const f=fixture();await f.request();const v=f.state().vouchers[0];v.deadline=1;
    const p=JSON.parse(v.signed_payload);p.voucher.deadline='1';v.signed_payload=JSON.stringify(p);
    const r=await f.sweep({nonceState:async()=>observation});
    const allowed=!observation.used&&observation.expired&&observation.domain.runtimeHash===domain.runtimeHash;
    assert.equal(r.cleared,allowed ? 1 : 0);assert.equal(f.state().deed.onchain_token_id,allowed ? null : token);
    assert.equal(f.state().deed.primary_issuance_receipt,undefined);
  }
});

const paidCallbackBurn = () => ({...meta({logIndex:1}),from:address,ref:hash('b')+':1'});
const readyPaidRemint = f => Object.assign(f.quote,{identityIssued:true,nativeName:name,nativeDistrict:'The Docks',
  gameplayIdentity:false,blockNumber:'110',valueWei:'0',liveOwner:null});

test('early paid callback burn stays pending and identical replay recovers after first-paid materialization',async()=>{
  const f=fixture({kind:'paid'});await f.request();readyPaidRemint(f);
  assert.equal((await f.reimport(paidCallbackBurn())).pending,true);
  assert.equal(f.state().deed,null);assert.equal(f.state().issued,0);
  assert.equal(f.state().reimports[0].status,'pending');assert.equal(f.state().reimports[0].burn_receipt.name,undefined);
  await f.confirm(event('paid'));
  const first=structuredClone(f.state().deed.primary_issuance_receipt);
  assert.equal((await f.reimport(paidCallbackBurn())).applied,true);
  assert.equal(f.state().deed.account_id,'alice');assert.equal(f.state().deed.onchain_token_id,null);
  assert.equal(f.state().reimports[0].burn_receipt.name,name);assert.equal(f.state().reimports[0].status,'applied');
  assert.deepEqual(f.state().deed.primary_issuance_receipt,first);assert.equal(f.state().issued,1);
  assert.equal((await f.reimport(paidCallbackBurn())).duplicate,true);
  assert.deepEqual(f.state().activities,['closed']);
});

test('actual reimport sweep re-enriches an early paid burn and preserves pending state on transient read failure',async()=>{
  const f=fixture({kind:'paid'});await f.request();readyPaidRemint(f);await f.reimport(paidCallbackBurn());
  assert.equal((await f.sweepReimports()).applied,0);assert.equal(f.state().reimports[0].status,'pending');
  await f.confirm(event('paid'));const before=structuredClone(f.state());
  assert.equal((await f.sweepReimports({reader:async()=>{throw new Error('PRIVATE synthetic endpoint');}})).applied,0);
  assert.deepEqual(f.state(),before);assert.ok(!JSON.stringify(f.errors).includes('PRIVATE'));
  assert.equal((await f.sweepReimports()).applied,1);assert.equal(f.state().deed.account_id,'alice');
  assert.equal(f.state().reimports[0].status,'applied');assert.equal((await f.sweepReimports()).applied,0);
});

test('pending paid replay refuses wrong-domain, stale and live-owner evidence without granting benefits',async()=>{
  for(const corrupt of [q=>q.runtimeHash=hash('f'),q=>q.liveOwner=address,q=>q.nativeDistrict='Wrong District',q=>q.blockNumber='99']){
    const f=fixture({kind:'paid'});await f.request();readyPaidRemint(f);await f.reimport(paidCallbackBurn());await f.confirm(event('paid'));
    corrupt(f.quote);const before=structuredClone(f.state());
    await refuses(()=>f.reimport(paidCallbackBurn()));assert.deepEqual(f.state(),before);
    assert.equal((await f.sweepReimports()).applied,0);assert.deepEqual(f.state(),before);
    readyPaidRemint(f);f.quote.runtimeHash=domain.runtimeHash;
    assert.equal((await f.sweepReimports()).applied,1);
  }
  const f=fixture({kind:'paid'});await f.request();readyPaidRemint(f);await f.reimport(paidCallbackBurn());await f.confirm(event('paid'));
  f.state().reimports[0].burn_receipt.name='Conflicting stored name';const before=structuredClone(f.state());
  await refuses(()=>f.reimport(paidCallbackBurn()));assert.deepEqual(f.state(),before);
  assert.equal((await f.sweepReimports()).applied,0);assert.deepEqual(f.state(),before);
});

test('reimport sweep rolls back enrichment and home changes on SQL failure then retries the same burn',async()=>{
  const f=fixture({kind:'paid',failOnceSQL:'UPDATE street_deed_history SET account_id='});
  await f.request();readyPaidRemint(f);await f.reimport(paidCallbackBurn());await f.confirm(event('paid'));
  const before=structuredClone(f.state());
  assert.equal((await f.sweepReimports()).applied,0);assert.deepEqual(f.state(),before);
  assert.ok(!JSON.stringify(f.errors).includes('PRIVATE'));assert.equal(f.state().reimports[0].status,'pending');
  assert.equal((await f.sweepReimports()).applied,1);assert.equal(f.state().deed.account_id,'alice');
});

test('unlinked early paid burn retains enriched recovery proof without granting a street to an account',async()=>{
  const f=fixture({kind:'paid',initial:{burnerLinked:false}});await f.request();readyPaidRemint(f);
  await f.reimport(paidCallbackBurn());await f.confirm(event('paid'));
  assert.equal((await f.sweepReimports()).applied,0);
  assert.equal(f.state().deed.account_id,'onchain:'+token);assert.equal(f.state().reimports[0].status,'pending');
  assert.equal(f.state().reimports[0].burn_receipt.name,name);assert.equal(f.state().deed.last_burn_receipt.name,name);
  await assert.rejects(f.recover,e=>e.code==='too_soon');
  f.state().reimports[0].created_at=new Date(Date.now()-31*86400000).toISOString();
  const recovery=await f.recover();assert.equal(recovery.to,address);assert.equal(f.state().reimports[0].status,'superseded');
  assert.equal(f.state().deed.account_id,'onchain:'+token);assert.equal(f.state().issued,1);
});

test('native claimGameplay payable ABI descriptor preserves selector and explicit zero-payment gate',()=>{
  const declaration=source.slice(source.indexOf('export const DEED_CLAIM_ABI ='),source.indexOf('// All reads are pinned')).split('export function deedAdmissionConfig')[0];
  const actual=new Function('DEED_VOUCHER_TYPES','GameError',declaration.replace('export const','const')+'\nreturn DEED_CLAIM_ABI;')(types,GameError);
  assert.ok(actual.every(fn=>fn.stateMutability==='payable'));
  const native=readFileSync(new URL('../omerta-contracts/src/StreetDeed.sol',import.meta.url),'utf8');
  assert.match(native,/function claimGameplay\([^]*?\) external payable/);
  const voucher={to:address,name,district:'The Docks',nonce:'1',deadline:'1700000010'};
  const transaction=new Function('GameError','DEED_CLAIM_ABI','encodeFunctionData',body('deedClaimTransaction')+'\nreturn deedClaimTransaction;')(GameError,actual,encodeFunctionData);
  assert.equal(transaction(domain,'claimGameplay',voucher,signature,'0').data,encodeFunctionData({abi,functionName:'claimGameplay',args:[{...voucher,nonce:1n,deadline:1700000010n},signature]}));
  assert.throws(()=>transaction(domain,'claimGameplay',voucher,signature,'1'),e=>e.code==='migration_required');
});
