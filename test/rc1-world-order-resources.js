import assert from 'node:assert/strict';
import { WORLD_RESOURCE_TABLES, reconcileWorldResources } from '../tools/rc1-world-resource-observer.js';
const at = '2026-09-20T12:00:00.000Z', logicalAt = Date.parse(at);
const state = () => {
  const result = { format: 1, tables: Object.fromEntries(WORLD_RESOURCE_TABLES.map(table => [table, []])) };
  result.tables.characters = ['one', 'two'].map(id => ({ id, account_id: 'account-' + id, alive: true, is_npc: false, cash: '4000', bank: '0', bank_intransit: '0', ammo: 25, cb: 0, loc: 'docks' }));
  result.tables.account_persistent = result.tables.characters.map(row => ({ account_id: row.account_id, omr: '0', staked: '0', unbonding: '0' }));
  return result;
};
const receipt = (id, character_id, amount, reason, counterparty = null, currency = 'cash') => ({ id, at, character_id, account_id: null, currency, amount, reason, counterparty });
const order = { id: 'order', seller_character: 'one', kind: 'order', car_id: null, good_id: 'gin', qty: 1, district: 'docks', price: '2000',
  buy_now: null, bid: null, bidder: null, status: 'live', created_at: at, expires_at: '2026-09-20T16:00:00.000Z', reserve: null, filled_qty: 0 };
const controls = [], cases = [];
function verify(name, before, after, options, field, count) {
  const journal = reconcileWorldResources(before, after, options); assert.equal(journal.unsupported.length, 0, JSON.stringify(journal.unsupported));
  assert.equal(journal[field].movements.length, count); assert.equal(journal.qualifyingFullResourcePass, false);
  assert.equal(reconcileWorldResources(after, after, options)[field].movements.length, 0);
  const item = { name, before, after, options }; cases.push(item); return item;
}
function reject(item, label, mutation) {
  const before = structuredClone(item.before), after = structuredClone(item.after), options = structuredClone(item.options);
  mutation(before, after, options); let journal, rejected = false;
  try { journal = reconcileWorldResources(before, after, options); } catch { rejected = true; }
  assert(rejected || journal.unsupported.length > 0, label); controls.push(label);
}
const birthBefore = state(), birthAfter = structuredClone(birthBefore);
birthAfter.tables.characters[0].cash = '1980'; birthAfter.tables.market_listings = [order];
birthAfter.tables.transactions = [receipt('fee', 'one', '-20', 'market:list'), receipt('principal', 'one', '-2000', 'market:order')];
const placement = verify('player-order', birthBefore, birthAfter, { identity: { method: 'POST', path: '/v1/market/order', accountId: 'account-one', logicalAt, body: { goodId: 'gin', qty: 1, price: 2000 } } }, 'orderResources', 1);
reject(placement, 'order-wrong-owner', (_, b) => { b.tables.market_listings[0].seller_character = 'two'; });
reject(placement, 'order-wrong-principal', (_, b) => { b.tables.market_listings[0].price = '2001'; });
reject(placement, 'order-wrong-recipient', (_, b) => { b.tables.transactions[1].character_id = 'two'; });
reject(placement, 'order-invented-warehouse', (_, b) => { b.tables.market_listings[0].filled_qty = 1; });
reject(placement, 'order-wrong-source-cash', (_, b) => { b.tables.characters[0].cash = '1981'; });
reject(placement, 'order-redirected-bank', (_, b) => { b.tables.characters[0].cash = '1880'; b.tables.characters[0].bank = '100'; });
reject(placement, 'order-price-request-mismatch', (_, __, o) => { o.identity.body.price = 2001; });
reject(placement, 'order-unrelated-extra-field', (_, b) => { b.tables.market_listings[0].grant = true; });
const npc = structuredClone(birthBefore); npc.tables.characters[0].is_npc = true;
const npcAfter = structuredClone(birthAfter); npcAfter.tables.characters[0].is_npc = true;
assert(reconcileWorldResources(npc, npcAfter, placement.options).unsupported.some(row => row.table === 'market_listings'));
controls.push('npc-without-native-placement-provenance-remains-unsupported');
assert(reconcileWorldResources(birthBefore, birthAfter).unsupported.some(row => row.table === 'market_listings'));
controls.push('player-order-without-route-remains-unsupported');

const deathBefore = state(); deathBefore.tables.characters[0].cash = '880'; deathBefore.tables.market_listings = [order];
const deathAfter = structuredClone(deathBefore); Object.assign(deathAfter.tables.characters[0], { alive: false, cash: '0', ammo: 0 });
deathAfter.tables.characters[1].cash = '4720'; deathAfter.tables.characters[1].ammo = 5; deathAfter.tables.market_listings = [];
deathAfter.tables.transactions = [receipt('pocket-out', 'one', '-220', 'whack:loot', 'two'), receipt('pocket-in', 'two', '220', 'whack:loot', 'one'),
  receipt('order-out', null, '-500', 'market:loot', 'one'), receipt('order-in', 'two', '500', 'whack:loot', 'one'), receipt('order-burn', null, '-1500', 'market:death', 'one'),
  receipt('estate', 'one', '-660', 'death:estate'), receipt('rounds', 'one', '-25', 'death:estate', null, 'ammo'), receipt('shot', 'two', '-20', 'fire', null, 'ammo')];
const death = verify('order-pocket-death', deathBefore, deathAfter, {}, 'orderResources', 1);
reject(death, 'death-reallocated-credit', (_, b) => { b.tables.transactions[1].amount = '221'; b.tables.transactions[3].amount = '499'; });
reject(death, 'death-escrow-not-burned', (_, b) => { b.tables.transactions[4].amount = '-1499'; });
reject(death, 'death-wrong-market-owner', (_, b) => { b.tables.transactions[2].counterparty = 'two'; });
reject(death, 'death-wrong-personal-owner', (_, b) => { b.tables.transactions[0].counterparty = 'one'; });
reject(death, 'death-disposed-to-bank', (_, b) => { b.tables.characters[1].cash = '4620'; b.tables.characters[1].bank = '100'; });
reject(death, 'death-no-fire', (_, b) => { b.tables.transactions[7].reason = 'jump'; });
reject(death, 'death-wrong-pocket-burn', (_, b) => { b.tables.transactions[5].amount = '-659'; });
reject(death, 'death-extra-escrow-burn', (_, b) => { b.tables.transactions.push(receipt('duplicate', null, '-1500', 'market:death', 'one')); });
const filled = structuredClone(deathBefore); filled.tables.market_listings[0].filled_qty = 1;
assert(reconcileWorldResources(filled, deathAfter).unsupported.some(row => row.table === 'market_listings')); controls.push('death-warehouse-terminal-remains-unsupported');

const turfBefore = state();
turfBefore.tables.gangs = ['A','B','C'].map(id => ({ id, charter: null, treasury: '100000', ammo_bank: 0, omr_reserve: '0' }));
turfBefore.tables.districts = [{ id: 'cathedral', holder_gang: null, npc_holder: null, garrison: '0', seized_at: null, watch_hour: null, contest_until: null }];
const seized = structuredClone(turfBefore); seized.tables.gangs[0].treasury = '77500';
Object.assign(seized.tables.districts[0], { holder_gang: 'A', garrison: '30000', seized_at: at });
seized.tables.transactions = [receipt('seize', null, '-22500', 'turf:seize:cathedral', 'A')];
const seize = verify('unoccupied-turf', turfBefore, seized, {}, 'turfFunding', 1);
reject(seize, 'seize-wrong-family-debit', (_, b) => { b.tables.transactions[0].counterparty = 'B'; });
reject(seize, 'seize-wrong-garrison', (_, b) => { b.tables.districts[0].garrison = '22500'; });
reject(seize, 'seize-treasury-short', (_, b) => { b.tables.gangs[0].treasury = '77501'; });
reject(seize, 'seize-extra-family-mint', (_, b) => { b.tables.gangs[1].ammo_bank = 1; });
const stakes = structuredClone(seized); stakes.tables.transactions.push(...['A','B','C'].map((id,i) => receipt('stake-' + id, null, String(-10000*(i+1)), 'turf:claim', id)));
stakes.tables.district_bids = ['A','B','C'].map((gang_id,i) => ({ district_id: 'cathedral', gang_id, amount: String(10000*(i+1)), at }));
stakes.tables.gangs.forEach((row,i) => { row.treasury = String(Number(row.treasury)-10000*(i+1)); });
stakes.tables.districts[0].contest_until = '2026-09-20T12:15:00.000Z';
const staked = verify('three-family-stake', seized, stakes, {}, 'turfFunding', 3);
reject(staked, 'stake-wrong-escrow-owner', (_, b) => { b.tables.district_bids[0].gang_id = 'foreign'; });
reject(staked, 'stake-missing-escrow', (_, b) => { b.tables.district_bids.pop(); });
reject(staked, 'stake-wrong-escrow-amount', (_, b) => { b.tables.district_bids[0].amount = '10001'; });
reject(staked, 'stake-invented-bid-field', (_, b) => { b.tables.district_bids[0].grant = true; });
reject(staked, 'stake-changed-holder', (_, b) => { b.tables.districts[0].holder_gang = 'B'; });
reject(staked, 'stake-unrelated-treasury', (_, b) => { b.tables.gangs[0].treasury = '67499'; });
const raised = structuredClone(stakes); raised.tables.gangs[0].treasury = '67499'; raised.tables.district_bids[0].amount = '10001';
raised.tables.transactions.push(receipt('raise-A', null, '-1', 'turf:claim', 'A'));
const raise = verify('stake-raise', stakes, raised, {}, 'turfFunding', 1);
reject(raise, 'raise-shortened-window', (_, b) => { b.tables.districts[0].contest_until = '2026-09-20T12:10:00.000Z'; });
console.log(JSON.stringify({ status: 'PASS', cases: cases.map(row => row.name), controls: controls.length, quoteAuthority: 'native canonical commands; observer proves custody only' }));
