import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BLACK_MARKET, GOODS, POPULATION } from '../src/rules.js';
import { reconcileNpcMarketOrder, NPC_MARKET_SQL as SQL, NPC_MARKET_SOURCE_PINS } from '../tools/rc1-npc-market-order-journal.js';
const text=fs.readFileSync(new URL('../src/population.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
const line=needle=>text.slice(0,text.indexOf(needle)).split('\n').length;
export function fixture(){
 const at=Date.parse('2026-09-24T00:00:00Z'),cash=100000,good=GOODS[0],unit=good.base;
 const qty=Math.min(BLACK_MARKET.ORDER_MAX_QTY,Math.floor(Math.floor(cash*POPULATION.BEHAVIOUR.ORDER_BPS/10000)/unit));
 const escrow=qty*unit,fee=Math.max(BLACK_MARKET.LIST_FEE_MIN,Math.floor(escrow*BLACK_MARKET.LIST_FEE_BPS/10000));
 const person={id:'npc',account_id:'account',alive:true,is_npc:true,cash:String(cash),bank:'0',ammo:25,cb:0,loc:'docks',npc_seed:String(cash),
  guard_price:'12000',fade_limit:'8000',duel_limit:'9000',jail_until:null,hosp_until:null,safe_until:null};
 const before={format:1,tables:{characters:[person,{...person,id:'other',account_id:'other-account'}],account_persistent:[{account_id:'account',npc_flag:true}],
  market_listings:[],transactions:[],loans:[{id:'loan',lender_character:'npc',status:'open'}]}};
 const after=structuredClone(before);after.tables.characters[0].cash=String(cash-escrow-fee);
 const event={sequence:17,transactionId:1,command:'COMMIT',outcome:'COMMITTED',context:{authority:'original-worker',logicalAt:at}};
 const receipt=(id,reason,amount)=>({id,character_id:'npc',account_id:null,currency:'cash',amount:String(-amount),reason,counterparty:null,at:new Date(at).toISOString()});
 const receipts=[receipt('fee','market:list',fee),receipt('escrow','market:order',escrow)];after.tables.transactions=receipts;
 const listing={id:'order',seller_character:'npc',kind:'order',car_id:null,good_id:good.id,qty,filled_qty:0,district:'docks',price:String(unit),buy_now:null,reserve:null,
  bid:null,bidder:null,status:'live',expires_at:new Date(at+BLACK_MARKET.MAX_TTL_H*3600000).toISOString(),created_at:new Date(at).toISOString()};
 after.tables.market_listings=[listing];
 const origin=sql=>({kind:'native-npc-market-source-v1',frames:sql===SQL.locked
  ?[{caller:'runResidentBehaviour',line:line('const live = (await client.query(')}]
  :[{caller:'residentAct',line:sql===SQL.listing?line("await client.query(\n        '"+SQL.listing):line('export async function residentAct(')},
    {caller:'runResidentBehaviour',line:line('const did = live ? await residentAct(client, live) : null;')}]});
 const entry=(sql,parameters,command,rowCount=0,rows=[])=>({sql,parameters,command,rowCount,rows,logicalAt:at,origin:origin(sql)});
 const queries=[entry('BEGIN',[],'BEGIN'),entry(SQL.locked,['npc'],'SELECT',1,[Object.fromEntries(['id','cash','loc','npc_seed','guard_price','fade_limit','duel_limit'].map(k=>[k,person[k]]))]),
  entry(SQL.fighters,['npc',1000,cash],'UPDATE'),entry(SQL.racers,['npc',1000,cash],'UPDATE'),
  entry(SQL.loans,['npc'],'SELECT',1,[{n:'1'}]),entry(SQL.orders,['npc'],'SELECT',1,[{n:'0'}]),entry(SQL.cash,['npc',escrow+fee],'UPDATE',1),
  ...receipts.map(r=>entry(SQL.receipt,[r.id,'npc','cash',Number(r.amount),r.reason],'INSERT',1)),
  entry(SQL.listing,['order','npc','order',good.id,qty,'docks',unit,listing.expires_at],'INSERT',1),entry('COMMIT',[],'COMMIT')];
 const provenance={format:1,boundary:event,extensions:{npcMarketOrder:{format:1,sourcePins:NPC_MARKET_SOURCE_PINS}},queries,unsupported:null};
 return {before,after,receipts,provenance,event,escrow,fee};
}
const run=p=>reconcileNpcMarketOrder(p.before,p.after,p.receipts,p.provenance,p.event);
const good=fixture(),result=run(good);assert.equal(result.movements.length,1);assert.equal(result.usedReceipts.size,2);assert.equal(result.checks.length,2);
assert.equal(result.movements[0].escrow,String(good.escrow));assert.equal(result.movements[0].fee,String(good.fee));
const rejected=[];const reject=(label,mutate)=>{const p=fixture();mutate(p);assert.throws(()=>run(p),undefined,label);rejected.push(label);};
reject('foreign boundary',p=>{p.provenance.boundary={...p.event,transactionId:2};});
reject('wrong source',p=>{p.provenance.extensions.npcMarketOrder.sourcePins={wrong:'hash'};});
reject('rollback cannot qualify',p=>{p.event.outcome='ROLLED_BACK';});
reject('missing original caller',p=>{p.provenance.queries.at(-2).origin.frames.pop();});
reject('SQL-literal line is not the call expression',p=>{p.provenance.queries[1].origin.frames[0].line=line(SQL.locked);});
reject('INSERT-literal line is not the call expression',p=>{p.provenance.queries.at(-2).origin.frames[0].line=line(SQL.listing);});
reject('changed locked input',p=>{p.provenance.queries[1].rows[0].cash='100001';});
reject('ineligible NPC',p=>{p.before.tables.characters[0].safe_until='2027-01-01T00:00:00Z';});
reject('duplicate receipt',p=>{p.receipts.push(structuredClone(p.receipts[0]));});
reject('reused receipt',p=>{p.before.tables.transactions.push(structuredClone(p.receipts[0]));});
reject('wrong receipt owner',p=>{p.receipts[0].character_id='other';});
reject('balanced wrong custody',p=>{p.after.tables.characters[0].cash=p.before.tables.characters[0].cash;p.after.tables.characters[1].cash=String(100000-p.escrow-p.fee);p.receipts.forEach(r=>r.character_id='other');});
reject('wrong fee',p=>{p.receipts[0].amount='-1';});
reject('wrong escrow',p=>{p.receipts[1].amount='-1';});
reject('wrong owner listing',p=>{p.after.tables.market_listings[0].seller_character='other';});
reject('wrong district',p=>{p.after.tables.market_listings[0].district='casino';});
reject('wrong price',p=>{p.after.tables.market_listings[0].price='1';});
reject('wrong quantity',p=>{p.after.tables.market_listings[0].qty++;});
reject('unfunded filled warehouse',p=>{p.after.tables.market_listings[0].filled_qty=1;});
reject('altered deadline',p=>{p.after.tables.market_listings[0].expires_at='2026-09-24T00:00:00Z';});
reject('terminal disposition',p=>{p.after.tables.market_listings[0].status='sold';});
reject('duplicate listing',p=>{p.after.tables.market_listings.push(structuredClone(p.after.tables.market_listings[0]));});
reject('occupied live order',p=>{p.before.tables.market_listings.push({...p.after.tables.market_listings[0],id:'prior'});});
reject('skipped canonical loan priority',p=>{p.before.tables.loans=[];p.after.tables.loans=[];p.provenance.queries[4].rows=[{n:'0'}];});
reject('unrelated resource mutation',p=>{p.after.tables.characters[1].ammo++;});
reject('changed witness order',p=>{[p.provenance.queries[7],p.provenance.queries[8]]=[p.provenance.queries[8],p.provenance.queries[7]];});
const unknown=[];for(const [label,mutate] of [
 ['missing witness',p=>{p.provenance=null;}],['bounded collector overflow',p=>{p.provenance.unsupported='bounded-trace-overflow';}],
 ['ordinary player authority',p=>{p.provenance.queries.at(-2).origin=null;}],
 ['native maintenance compound',p=>{p.provenance.queries[2].rowCount=1;}],
]){const p=fixture();mutate(p);assert.equal(run(p).movements.length,0);unknown.push(label);}
const retained=process.argv.find(arg=>arg.startsWith('--retained='));let nativeInputRechecked=false;
if(retained){
 const input=JSON.parse(fs.readFileSync(retained.slice('--retained='.length),'utf8'));
 const ids=new Set(input.before.tables.transactions.map(row=>row.id));
 const evidence={...input,provenance:input.transaction,receipts:input.after.tables.transactions.filter(row=>!ids.has(row.id))};
 assert.equal(run(evidence).movements.length,1);
 for(const sql of [SQL.locked,SQL.listing]){const corrupt=structuredClone(evidence);const entry=corrupt.provenance.queries.find(row=>row.sql===sql);
  const caller=sql===SQL.locked?'runResidentBehaviour':'residentAct';entry.origin.frames.find(frame=>frame.caller===caller).line=line(sql);
  assert.throws(()=>run(corrupt));}
 nativeInputRechecked=true;
}
console.log(JSON.stringify({status:'PASS_SCOPED_CONTROLS',nativeExecution:false,positivePlacements:1,rejected:rejected.length,explicitUnsupported:unknown.length,
 nativeInputRechecked,retainedLiteralLineCorruptions:nativeInputRechecked?2:0}));
