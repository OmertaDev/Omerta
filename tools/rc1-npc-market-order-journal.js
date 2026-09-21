// Test-only native returned-statement evidence; one original resident buy order.
// Reuses the existing bounded transaction collector, never another SQL observer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BLACK_MARKET, GOODS, POPULATION, LOAN } from '../src/rules.js';
import { canonicalJson, sha256 } from './rc1-native-proof.js';
import { exactSum } from './rc1-resource-journal.js';
import { createNpcCarAcquisitionCommitObserver, NPC_CAR_SOURCE_PINS } from './rc1-npc-car-acquisition.js';

export const NPC_MARKET_SOURCE_PINS = NPC_CAR_SOURCE_PINS;
export const NPC_MARKET_SQL = Object.freeze({
  locked: 'SELECT id, cash, loc, npc_seed, guard_price, fade_limit, duel_limit FROM characters WHERE id=$1 AND alive AND is_npc FOR UPDATE',
  cash: 'UPDATE characters SET cash = cash - $2 WHERE id=$1',
  receipt: 'INSERT INTO transactions (id, character_id, currency, amount, reason) VALUES ($1,$2,$3,$4,$5)',
  listing: 'INSERT INTO market_listings (id, seller_character, kind, good_id, qty, district, price, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
  orders: "SELECT COUNT(*) n FROM market_listings WHERE seller_character=$1 AND status='live'",
  loans: "SELECT COUNT(*) n FROM loans WHERE lender_character=$1 AND status='open'",
  fighters: 'UPDATE fighters SET bout_limit=$2 WHERE character_id=$1 AND bout_limit > $3',
  racers: 'UPDATE racers SET race_limit=$2 WHERE character_id=$1 AND race_limit > $3',
});
const plain = value => JSON.parse(JSON.stringify(value));
const sorted = rows => rows.map(canonicalJson).sort();
let sites;
export function assertNpcMarketSources() {
  let text;
  for (const [file, expected] of Object.entries(NPC_MARKET_SOURCE_PINS)) {
    const value = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
    assert.equal(sha256(value), expected, 'NPC market source changed: ' + file);
    if (file === 'src/population.js') text = value;
  }
  const line = needle => { assert.equal(text.split(needle).length, 2); return text.slice(0, text.indexOf(needle)).split('\n').length; };
  sites = { start: line('export async function residentAct('), end: line('export async function runResidentBehaviour(') - 1,
    call: line('const did = live ? await residentAct(client, live) : null;'), lock: line(NPC_MARKET_SQL.locked), listing: line(NPC_MARKET_SQL.listing) };
}
const populationUrl = new URL('../src/population.js', import.meta.url).href;
function origin(sql) {
  if (!Object.values(NPC_MARKET_SQL).includes(sql)) return null;
  const prior = Error.stackTraceLimit; let stack;
  try { Error.stackTraceLimit = 40; stack = new Error('RC1_NPC_MARKET_ORIGIN').stack; }
  finally { Error.stackTraceLimit = prior; }
  const frames = [];
  for (const text of stack.split('\n')) {
    const at = text.indexOf(populationUrl + ':'); if (at < 0) continue;
    const numbers = text.slice(at + populationUrl.length + 1).match(/^(\d+):(\d+)/); assert(numbers);
    const caller = text.slice(0, at).trim().replace(/^at\s+(?:async\s+)?/, '').replace(/\s*\($/, '');
    frames.push({ file: 'src/population.js', caller, line: Number(numbers[1]), column: Number(numbers[2]) });
  }
  return frames.length ? { kind: 'native-npc-market-source-v1', frames } : null;
}
export function createNpcMarketOrderCommitObserver({ innerObserverFactory = createNpcCarAcquisitionCommitObserver,
  additionalQueryOrigin = null, additionalProvenanceExtensions = {}, ...options }) {
  assertNpcMarketSources(); assert(!Object.hasOwn(additionalProvenanceExtensions, 'npcMarketOrder'));
  return innerObserverFactory({ ...options,
    additionalQueryOrigin: sql => origin(sql) ?? additionalQueryOrigin?.(sql) ?? null,
    additionalProvenanceExtensions: { ...additionalProvenanceExtensions, npcMarketOrder: { format: 1, sourcePins: NPC_MARKET_SOURCE_PINS } } });
}

export function reconcileNpcMarketOrder(before, after, receipts, provenance, identity) {
  const result = { movements: [], checks: [], usedReceipts: new Set(), listingIds: new Set() };
  if (!provenance?.extensions?.npcMarketOrder || provenance.unsupported) return result;
  const q = provenance.queries;
  assert(Array.isArray(q));
  const placements = q.filter(row => row.sql === NPC_MARKET_SQL.listing);
  if (!placements.length) return result;
  // Ordinary player postOrder shares the SQL but has distinct authority/skills.
  if (!placements.some(row => row.origin?.kind === 'native-npc-market-source-v1')) return result;
  assertNpcMarketSources(); assert.deepEqual(provenance.extensions.npcMarketOrder, { format: 1, sourcePins: NPC_MARKET_SOURCE_PINS });
  assert.deepEqual(provenance.boundary, identity, 'Market witness belongs to another native boundary');
  assert.equal(identity.command, 'COMMIT'); assert.equal(identity.outcome, 'COMMITTED');
  assert.equal(identity.context?.authority, 'original-worker'); assert(Number.isSafeInteger(identity.transactionId) && identity.transactionId > 0);
  assert.equal(q[0].command, 'BEGIN'); assert.equal(q.at(-1).command, 'COMMIT');
  assert.equal(placements.length, 1, 'Compound NPC order placement');
  const only = sql => { const matches = q.filter(row => row.sql === sql); assert.equal(matches.length, 1, 'Missing/duplicate market authority query: ' + sql); return matches[0]; };
  const listingQuery = placements[0], locked = only(NPC_MARKET_SQL.locked), cashQuery = only(NPC_MARKET_SQL.cash),
    orderQuery = only(NPC_MARKET_SQL.orders), loanQuery = only(NPC_MARKET_SQL.loans);
  // Valid maintenance or unstamped-heir writes are not this isolated subset.
  if (q.some(row => ['INSERT','UPDATE','DELETE'].includes(row.command)
    && ![NPC_MARKET_SQL.cash,NPC_MARKET_SQL.receipt,NPC_MARKET_SQL.listing].includes(row.sql)
    && !([NPC_MARKET_SQL.fighters,NPC_MARKET_SQL.racers].includes(row.sql) && row.rowCount === 0))) return result;
  const ledgers = q.filter(row => row.sql === NPC_MARKET_SQL.receipt);
  assert.equal(ledgers.length, 2, 'Order needs exactly two new receipts'); assert.equal(receipts.length, 2);
  for (const row of [cashQuery, orderQuery, loanQuery, ...ledgers, listingQuery]) {
    assert.equal(row.origin?.kind, 'native-npc-market-source-v1');
    assert(row.origin.frames.some(f => f.caller === 'residentAct' && f.line >= sites.start && f.line <= sites.end));
    assert(row.origin.frames.some(f => f.caller === 'runResidentBehaviour' && f.line === sites.call), 'Missing original worker resident caller');
  }
  assert(locked.origin?.frames.some(f => f.caller === 'runResidentBehaviour' && f.line === sites.lock));
  assert(listingQuery.origin.frames.some(f => f.caller === 'residentAct' && f.line === sites.listing));
  const at = listingQuery.logicalAt; assert(Number.isSafeInteger(at)); assert.equal(identity.context.logicalAt, at);
  assert(q.every(row => row.logicalAt === at), 'Order crossed logical clock boundary');
  const table = (state, name) => { assert(Array.isArray(state.tables[name])); return state.tables[name]; };
  const [id, owner, kind, goodId, qty, district, unit, deadline] = listingQuery.parameters;
  assert.equal(listingQuery.parameters.length, 8); assert.equal(kind, 'order');
  const person = table(before, 'characters').find(row => row.id === owner), next = table(after, 'characters').find(row => row.id === owner);
  assert(person?.alive && person.is_npc && next); assert.equal(table(before, 'account_persistent').find(row => row.account_id === person.account_id)?.npc_flag, true);
  assert.deepEqual(locked.parameters, [owner]); assert.equal(locked.command, 'SELECT'); assert.equal(locked.rowCount, 1);
  assert.deepEqual(locked.rows, [Object.fromEntries(['id','cash','loc','npc_seed','guard_price','fade_limit','duel_limit'].map(field => [field, person[field]]))]);
  for (const field of ['jail_until','hosp_until','safe_until']) assert(person[field] === null || Date.parse(person[field]) < at, 'NPC is not eligible: ' + field);
  assert(Number(person.npc_seed) > 0, 'Unstamped heir is outside this isolated placement subset');
  const B = POPULATION.BEHAVIOUR, cash = Number(person.cash), good = GOODS.find(row => row.id === goodId);
  assert(good); assert(Number.isSafeInteger(cash) && cash >= 0); assert(Number.isSafeInteger(unit) && unit > 0);
  assert(Number.isSafeInteger(qty) && qty >= 1 && qty <= BLACK_MARKET.ORDER_MAX_QTY);
  assert(Array.from({length: B.ORDER_PRICE_BPS[1] - B.ORDER_PRICE_BPS[0] + 1}, (_, i) => B.ORDER_PRICE_BPS[0] + i)
    .some(bps => Math.max(1, Math.floor(good.base * bps / 10000)) === unit), 'Price is outside the authored selectable native range');
  const budget = Math.min(Math.floor(cash * (1-B.KEEP_FLOOR)), Math.floor(cash * B.ORDER_BPS / 10000));
  assert.equal(qty, Math.min(BLACK_MARKET.ORDER_MAX_QTY, Math.floor(budget/unit)));
  const escrow = qty * unit, fee = Math.max(BLACK_MARKET.LIST_FEE_MIN, Math.floor(escrow * BLACK_MARKET.LIST_FEE_BPS / 10000));
  assert(Number.isSafeInteger(escrow) && Number.isSafeInteger(fee));assert(escrow >= BLACK_MARKET.MIN_PRICE && cash >= escrow+fee);
  assert.equal(district,person.loc); assert.equal(Date.parse(deadline),at+BLACK_MARKET.MAX_TTL_H*3600000);
  assert.deepEqual(orderQuery.parameters,[owner]);assert.deepEqual(orderQuery.rows,[{n:'0'}]);assert.equal(orderQuery.rowCount,1);
  assert(!table(before,'market_listings').some(row=>row.seller_character===owner && row.status==='live'));
  const openLoans=table(before,'loans').filter(row=>row.lender_character===owner && row.status==='open').length;
  assert(openLoans>0 || Math.floor(cash*(1-B.KEEP_FLOOR))<LOAN.MIN,'Loan-first branch must be occupied or canonically unaffordable');
  assert.deepEqual(loanQuery.parameters,[owner]);assert.deepEqual(loanQuery.rows,[{n:String(openLoans)}]);assert.equal(loanQuery.rowCount,1);
  assert.deepEqual(cashQuery.parameters,[owner,escrow+fee]);assert.equal(cashQuery.rowCount,1);assert.equal(cashQuery.command,'UPDATE');
  assert.deepEqual(next,{...person,cash:exactSum([person.cash,-escrow,-fee])},'Order changed another character field or wrong pocket/owner');
  for(const [index,reason,amount] of [[0,'market:list',fee],[1,'market:order',escrow]]){
    const entry=ledgers[index], receiptId=entry.parameters[0];assert.equal(entry.command,'INSERT');assert.equal(entry.rowCount,1);assert.deepEqual(entry.rows,[]);
    assert.deepEqual(entry.parameters,[receiptId,owner,'cash',-amount,reason]);
    const receipt=receipts.find(row=>row.id===receiptId);assert(receipt);assert(!result.usedReceipts.has(receiptId));
    assert.deepEqual(receipt,{id:receiptId,character_id:owner,account_id:null,currency:'cash',amount:String(-amount),reason,counterparty:null,at:new Date(at).toISOString()});
    assert(!table(before,'transactions').some(row=>row.id===receiptId),'Reused market receipt');result.usedReceipts.add(receiptId);
  }
  assert.equal(listingQuery.command,'INSERT');assert.equal(listingQuery.rowCount,1);assert.deepEqual(listingQuery.rows,[]);
  assert(!table(before,'market_listings').some(row=>row.id===id),'Preexisting listing reused');
  const actual=table(after,'market_listings').filter(row=>row.id===id);assert.equal(actual.length,1);
  assert.deepEqual(actual[0],{id,seller_character:owner,kind:'order',car_id:null,good_id:goodId,qty,filled_qty:0,district,price:String(unit),buy_now:null,reserve:null,
    bid:null,bidder:null,status:'live',expires_at:new Date(deadline).toISOString(),created_at:new Date(at).toISOString()});
  assert.deepEqual(sorted(table(before,'market_listings')),sorted(table(after,'market_listings').filter(row=>row.id!==id)),'Other listing ownership/disposition changed');
  const order=[locked,loanQuery,orderQuery,cashQuery,...ledgers,listingQuery].map(row=>q.indexOf(row));assert(order.every((n,i)=>!i||n>order[i-1]));
  for(const row of q.filter(row=>!['SELECT','BEGIN','COMMIT'].includes(row.command))){
    if([cashQuery,...ledgers,listingQuery].includes(row))continue;
    assert([NPC_MARKET_SQL.fighters,NPC_MARKET_SQL.racers].includes(row.sql)&&row.command==='UPDATE'&&row.rowCount===0,'Unclassified compound NPC write');
  }
  for(const name of Object.keys(before.tables)){
    if(['transactions','market_listings'].includes(name))continue;
    const a=table(before,name),b=table(after,name);
    assert.deepEqual(sorted(name==='characters'?a.filter(row=>row.id!==owner):a),sorted(name==='characters'?b.filter(row=>row.id!==owner):b),'Other resource state changed: '+name);
  }
  const authority=[...receipts.map(row=>({table:'transactions',id:row.id})),{table:'market_listings',id},
    {kind:'native-returned-transaction',sha256:sha256(canonicalJson(provenance)),transactionId:identity.transactionId}];
  result.checks.push({kind:'npc-market-pocket',resource:'cash-pocket',owner,before:person.cash,after:next.cash,expectedDelta:String(-escrow-fee),drift:'0',authority},
    {kind:'npc-market-owned-escrow',resource:'cash-escrow',owner:`market-order:${id}:${owner}`,before:'0',after:String(escrow),expectedDelta:String(escrow),drift:'0',authority});
  result.movements.push({kind:'npc-market-order-placement',listingId:id,characterId:owner,accountId:person.account_id,goodId,qty,unitPrice:String(unit),
    escrow:String(escrow),fee:String(fee),feeDisposition:'cash-destroyed',escrowDisposition:'owned-live-buy-order',deadline:new Date(deadline).toISOString(),authority});
  result.listingIds.add(id);return result;
}
