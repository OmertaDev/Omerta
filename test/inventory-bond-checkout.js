import assert from 'node:assert/strict';
import { encodeAbiParameters, encodeFunctionData, keccak256, parseAbi, parseEther } from 'viem';
import { inventoryBondTransaction, loadInventoryBondCheckout } from '../src/inventorybond.js';
import { savedBondIds, readBondNote, submitClaim, submitPurchase } from '../public/inventory-bond-client.js';

const addr = n => '0x'+n.toString(16).padStart(40,'0');
const word = n => BigInt(n).toString(16).padStart(64,'0');
const hash = n => '0x'+word(n);
const code = '0x60006000f3', runtimeCodeHash = keccak256(code);
const buyer = addr(8), pin = index => ({address:addr(index),runtimeCodeHash});
const contracts = {bond:pin(1),manager:pin(2),marketState:pin(3),omr:pin(4)};
const manifest = {chainId:4663,contract:'OmertaInventoryBondV2',approval:'inventory-bond-purchases',
  contracts,safe:addr(5),proceedsRecipient:addr(6),poolId:hash(9)};
const timestamp = Math.floor(Date.now()/1000), amount = parseEther('18.5'), eth = '0.1';
const fields = {safe:manifest.safe,proceedsRecipient:manifest.proceedsRecipient,omr:contracts.omr.address,
  marketState:contracts.marketState.address,manager:contracts.manager.address,poolId:manifest.poolId,paused:false,
  availableInventory:amount,outstandingClaims:1n,balanceOf:amount+1n,policySealed:true,isRecipient:true,
  operatorRole:2,isOperator:true,snapshot:{valid:true,epoch:21n},vestingSeconds:86400,discountBps:500,quote:amount};
const checkout = {manifest, client:{
  getChainId:async()=>4663,getCode:async()=>code,getBlock:async()=>({number:101n,hash:hash(21),timestamp:BigInt(timestamp)}),
  readContract:async({functionName,blockNumber})=>{assert.equal(blockNumber,101n);return fields[functionName];},
  simulateContract:async({functionName,args,value,account})=>{
    assert.equal(functionName,'purchase');assert.equal(value,parseEther(eth));assert.equal(account,buyer);
    const noteId = keccak256(encodeAbiParameters([{type:'uint256'},{type:'address'},{type:'address'},{type:'bytes32'}],
      [4663n,contracts.bond.address,buyer,args[3]]));
    return {result:[noteId,amount]};
  }
}};
assert.equal(loadInventoryBondCheckout({}),null);
assert.throws(()=>loadInventoryBondCheckout({INVENTORY_BOND_MANIFEST_PATH:'unapproved'}));
const quote = await inventoryBondTransaction(checkout,buyer,{principalEth:eth});
const prepare = intent => inventoryBondTransaction(checkout,buyer,intent,{prepare:true});
const tx = await prepare(quote.intent);
const abi = parseAbi(['function purchase(uint64,uint256,uint64,bytes32) payable returns (bytes32,uint256)',
  'function notes(bytes32) view returns (address,uint64,uint64,uint128,uint128)',
  'function claimable(bytes32) view returns (uint256)','function claim(bytes32) returns (uint256)']);
const purchase = encodeFunctionData({abi,functionName:'purchase',args:[21n,amount,BigInt(quote.intent.deadline),quote.intent.nonce]});
assert.equal(tx.data,purchase);
for (const patch of [{buyer:addr(9)},{epoch:'22'},{deadline:timestamp-1},{minimumOmr:'1'},{to:addr(2)},{nonce:hash(0)}])
  await assert.rejects(prepare({...quote.intent,...patch}));
for (const [key,value] of Object.entries({paused:true,availableInventory:0n,balanceOf:0n,policySealed:false,isRecipient:false,
  isOperator:false,operatorRole:1,manager:addr(9),snapshot:{valid:false}})) {
  const prior=fields[key];fields[key]=value;
  await assert.rejects(prepare(quote.intent));
  fields[key]=prior;
}
await assert.rejects(inventoryBondTransaction({...checkout,client:{...checkout.client,getCode:async()=>'0x6000'}},buyer,{principalEth:eth}));
const saved = new Map();
const storage = {getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)};
let account=buyer, chain='0x1237', walletCode=code, claimed=0n, purchased=false;
let switchAfterCall=false;
const sent=[];
const calldata = fn => encodeFunctionData({abi,functionName:fn,args:[quote.noteId]});
const provider = {async request({method,params}) {
  if (method==='eth_accounts') return [account];
  if (method==='eth_chainId') return chain;
  if (method==='eth_getCode') return walletCode;
  const [call] = params;
  assert.equal(call.to,contracts.bond.address);
  if (method==='eth_call') {
    if (call.data===purchase) {
      if (switchAfterCall) account=addr(9);
      return quote.noteId+word(amount);
    }
    if (call.data===calldata('notes')) return '0x'+[purchased ? buyer : 0,timestamp,timestamp+86400,amount,claimed].map(word).join('');
    if (call.data===calldata('claimable') || call.data===calldata('claim')) return hash(amount-claimed);
  }
  if (method==='eth_sendTransaction') {
    assert.equal(call.from,buyer);assert.equal(call.chainId,'0x1237');
    assert.deepEqual(savedBondIds(storage,contracts.bond,buyer),[quote.noteId]);
    if (call.data===purchase) { assert.equal(BigInt(call.value),parseEther(eth)); purchased=true; }
    else { assert.equal(call.data,calldata('claim'));assert.equal(call.value,'0x0');claimed=amount; }
    sent.push(call);return hash(sent.length);
  }
  throw Error('Unexpected wallet RPC '+method);
}};
const submit = prepared => submitPurchase(provider,contracts.bond,quote,prepared,buyer,storage);
for (const patch of [{value:'0x1'},{data:'0x1234'},{noteId:hash(1)},{intent:{...quote.intent,to:addr(7)}}])
  await assert.rejects(submit({...tx,...patch}));
account=addr(9);await assert.rejects(submit(tx));account=buyer;
chain='0x1';await assert.rejects(submit(tx));chain='0x1237';
walletCode='0x6000';await assert.rejects(submit(tx));walletCode=code;
switchAfterCall=true;await assert.rejects(submit(tx));switchAfterCall=false;account=buyer;
assert.equal(sent.length,0);
await submit(tx);
const [restored] = savedBondIds({getItem:key=>saved.get(key)}, contracts.bond,buyer);
assert.equal(restored,quote.noteId);
fields.paused=true;
assert.equal((await readBondNote(provider,contracts.bond,buyer,restored)).claimable,amount);
await submitClaim(provider,contracts.bond,buyer,restored);
await assert.rejects(submitClaim(provider,contracts.bond,buyer,restored));
assert.equal((await readBondNote(provider,contracts.bond,buyer,restored)).claimed,amount);
assert.equal(sent.length,2);
console.log('Inventory bond checkout and claim passed with a simulated deployment, wallet, receipt reload and sale pause.');
