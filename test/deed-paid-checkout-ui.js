import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const start = html.indexOf('  // Street Deed checkout uses the server-authored transaction;');
const end = html.indexOf('  async function renderDeeds(', start);
assert(start > 0 && end > start);
const source = html.slice(start, end);
const wallet = '0x' + '12'.repeat(20), contract = '0x' + '34'.repeat(20), txHash = '0x' + '56'.repeat(32);
const clone = x => JSON.parse(JSON.stringify(x));
function fixture(value = '100000000000000001') {
  return { status: 'signed', chainId: 4663, contract, primaryType: 'DeedVoucher', claimMethod: 'claim', issuanceRoute: 'paid',
    voucher: { to: wallet, name: 'Exact Street', district: 'The Docks', nonce: '7', deadline: '1900000000' },
    signature: '0x' + '78'.repeat(65), quote: { name: 'Exact Street', district: 'The Docks', chainId: 4663, contract,
      runtimeHash: '0x' + '9a'.repeat(32), blockHash: '0x' + 'bc'.repeat(32), blockNumber: '42', timestamp: '1800000000',
      identityIssued: false, nativeName: '', nativeDistrict: '', gameplayIdentity: false, liveOwner: null, valueWei: value, usedNonce: false },
    transaction: { to: contract, data: '0xaabbccdd' + 'ef'.repeat(64), value } };
}
function harness(options = {}) {
  const calls = [], prompts = [], notices = [], storage = options.storage || new Map(); let reads = 0, renders = 0;
  const c = vm.createContext({ console, BigInt, Number, Object, Error, me: { id: 'synthetic-player', generation: 1, wallet }, token: 'synthetic-session',
    navigationRevision: 1, currentTab: 'deeds', toast: (...args) => notices.push(args),
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => { if (options.storageFailure) throw Error('private storage failure'); storage.set(key, value); }, removeItem: key => storage.delete(key) },
    ask: async (...args) => { prompts.push(args); options.onPrompt?.(c, prompts.length); return options.approvals?.[prompts.length - 1] ?? true; },
    renderDeeds: async () => { renders++; },
    api: async (method, path, body, guards) => {
      calls.push({ method, path, body: clone(body) }); assert.equal(guards.beforeDispatch(), true); assert.equal(guards.isCurrent(), true);
      if (path.endsWith('/paid/reserve')) return { code: 200, body: { status: 'payment_required', benefitEligible: false } };
      reads++; options.onApi?.(c, reads);
      return options.responses?.[reads - 1] || { code: 200, body: clone(options.body || fixture()) };
    },
    navigator: options.locksUnsupported ? {} : { locks: options.lockService || { request: async (_key, _options, work) => work(options.lockDenied ? null : {}) } },
  });
  const provider = { request: async input => {
    calls.push(clone(input)); options.onProvider?.(c, input.method); await options.providerTick?.(input.method);
    if (input.method === 'eth_requestAccounts') return [wallet];
    if (input.method === 'eth_accounts') return [options.account || wallet];
    if (input.method === 'eth_chainId') return options.chain || '0x1237';
    if (input.method === 'eth_sendTransaction') { if (options.sendError) throw options.sendError; return options.sendResult ?? txHash; }
    throw Error('Unplanned provider method ' + input.method);
  } };
  c.pickProvider = async () => options.noProvider ? null : provider;
  vm.runInContext(source + '\nthis.checkout = { validateDeedCheckout, deedEthPrice, beginDeedCheckout, reservePaidDeed };', c);
  return { c, client: c.checkout, calls, prompts, notices, storage, renders: () => renders, sends: () => calls.filter(x => x.method === 'eth_sendTransaction') };
}

test('all inline scripts remain syntactically valid; actual controls call the reviewed paths', () => {
  let scripts = 0;
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc=|application\/ld\+json|type="module"/.test(m[1])) continue;
    new vm.Script(m[2]); scripts++;
  }
  assert(scripts > 0);
  assert.match(html, /el\.onclick = \(\) => beginDeedCheckout\(\)/);
  assert.match(html, /await reservePaidDeed\(p, name, district\)/);
  assert.match(html, /const canReserve = paid && p\.claimed === false && p\.reserved === false && !deed && !paidIntent/);
});

test('actual checkout displays exact ETH and submits the returned transaction losslessly', async () => {
  const h = harness(); await h.client.beginDeedCheckout();
  assert.equal(h.sends().length, 1); const actual = h.sends()[0].params[0], body = fixture();
  assert.deepEqual(actual, { from: wallet, to: body.transaction.to, data: body.transaction.data,
    value: '0x' + BigInt(body.transaction.value).toString(16), chainId: '0x1237' });
  assert.equal(BigInt(actual.value).toString(), body.transaction.value);
  assert.match(h.prompts[1][1], /0\.100000000000000001 ETH, plus network gas paid by you/);
  assert.match(h.prompts[0][1], /attest.*treasury-bought stock.*no further check/);
  assert.equal(h.calls.filter(x => x.path === '/v1/deeds/extract').length, 2);
  assert(h.calls.filter(x => x.path).every(x => x.body.address === wallet && x.body.attest === true));
  assert.equal([...h.storage.values()][0], txHash);
  assert.match(h.notices.at(-1)[0], /Wait for confirmed registration/);
});

test('ETH formatting preserves zero, one wei, huge integers and all eighteen decimals', () => {
  const { client } = harness();
  for (const [value, expected] of [['0', '0'], ['1', '0.000000000000000001'], ['1000000000000000000', '1'],
    ['9007199254740993000000000000000001', '9007199254740993.000000000000000001']]) assert.equal(client.deedEthPrice(value), expected);
  for (const bad of [1, -1, '1e18', '01', '1.0', ' 1', (1n << 256n).toString()]) assert.throws(() => client.deedEthPrice(bad));
});

test('malformed quote, route, chain, runtime, value and recipient refuse before any wallet call', async () => {
  const changes = [b => b.transaction.value = 1, b => b.transaction.value = '01', b => b.transaction.value = '-1',
    b => b.transaction.value = (1n << 256n).toString(), b => b.quote.valueWei = '2', b => b.transaction.to = wallet,
    b => b.quote.contract = wallet, b => b.quote.chainId = 1, b => b.chainId = Number.MAX_SAFE_INTEGER + 1,
    b => b.quote.runtimeHash = '0x', b => b.quote.blockHash = '0x' + '00'.repeat(32), b => b.quote.blockNumber = '1.5',
    b => b.quote.usedNonce = true, b => b.quote.nativeName = 'unissued mismatch', b => b.voucher.to = contract,
    b => b.voucher.deadline = b.quote.timestamp, b => b.claimMethod = 'claimGameplay', b => b.signature = '0x12',
    b => b.issuanceRoute = 'partnership', b => b.quote.district = 'docks', b => b.transaction.data = '0x123'];
  for (const change of changes) {
    const body = fixture(); change(body); const h = harness({ body }); await h.client.beginDeedCheckout();
    assert.equal(h.calls.filter(x => x.method?.startsWith('eth_')).length, 0);
    assert.equal(h.sends().length, 0); assert.equal(h.storage.size, 0);
  }
});

test('gameplay and remint use their returned zero-value route without manual claim encoding', async () => {
  for (const route of ['gameplay', 'remint']) {
    const body = fixture('0'); body.issuanceRoute = route;
    if (route === 'gameplay') { body.primaryType = 'GameplayDeedVoucher'; body.claimMethod = 'claimGameplay'; }
    else { body.quote.identityIssued = true; body.quote.nativeName = body.voucher.name; body.quote.nativeDistrict = body.voucher.district; }
    const h = harness({ body }); await h.client.beginDeedCheckout();
    assert.equal(h.sends().length, 1); assert.equal(h.sends()[0].params[0].value, '0x0');
    assert.equal(h.sends()[0].params[0].data, body.transaction.data);
    assert.match(h.prompts[1][1], /0 ETH, plus network gas/);
    const wrong = clone(body); wrong.transaction.value = wrong.quote.valueWei = '1';
    assert.throws(() => h.client.validateDeedCheckout(wrong, wallet));
  }
});

test('price, calldata, nonce and signature changes on refresh require fresh review and never send', async () => {
  for (const change of [b => b.transaction.value = b.quote.valueWei = '100000000000000002',
    b => b.transaction.data += '00', b => b.voucher.nonce = '8', b => b.signature = '0x' + 'ab'.repeat(65)]) {
    const fresh = fixture(); change(fresh);
    const h = harness({ responses: [{ code: 200, body: fixture() }, { code: 200, body: fresh }] });
    await h.client.beginDeedCheckout(); assert.equal(h.sends().length, 0); assert.equal(h.storage.size, 0);
    assert.match(h.notices.at(-1)[0], /changed.*Retry to review/);
  }
});

test('fresh block/quote metadata can change while the signed transaction stays exact', async () => {
  const fresh = fixture(); fresh.quote.blockNumber = '43'; fresh.quote.blockHash = '0x' + 'de'.repeat(32); fresh.quote.timestamp = '1800000001';
  const h = harness({ responses: [{ code: 200, body: fixture() }, { code: 200, body: fresh }] });
  await h.client.beginDeedCheckout(); assert.equal(h.sends().length, 1);
});

test('wrong wallet, wrong chain and linked-wallet drift stop before transaction submission', async () => {
  for (const options of [{ account: contract }, { chain: '0x1' }, { onProvider: (c, method) => { if (method === 'eth_chainId') c.me.wallet = contract; } }]) {
    const h = harness(options); await h.client.beginDeedCheckout(); assert.equal(h.sends().length, 0); assert.equal(h.storage.size, 0);
  }
});

test('session, character, generation and navigation changes discard stale responses', async () => {
  for (const mutate of [c => c.token = 'other', c => c.me.id = 'other', c => c.me.generation++, c => c.navigationRevision++, c => c.currentTab = 'market', c => c.me.wallet = contract]) {
    const h = harness({ onApi: (c, count) => { if (count === 1) mutate(c); } });
    await h.client.beginDeedCheckout(); assert.equal(h.sends().length, 0); assert.equal(h.calls.filter(x => x.method === 'eth_requestAccounts').length, 0);
  }
});

test('held migration/configuration/used nonce responses have clear messages and no wallet submission', async () => {
  for (const [error, expected] of [['migration_required', /reviewed migration/], ['chain_unconfigured', /runtime are configured/], ['claim_pending', /already being confirmed/]]) {
    const h = harness({ responses: [{ code: 409, body: { error, privateInternal: 'never display this' } }] });
    await h.client.beginDeedCheckout(); assert.match(h.notices.at(-1)[0], expected);
    assert.equal(h.sends().length, 0); assert.equal(h.calls.filter(x => x.method?.startsWith('eth_')).length, 0);
    assert(!JSON.stringify(h.notices).includes('never display this'));
  }
});

test('rejecting either confirmation or closing wallet picker never sends', async () => {
  for (const options of [{ approvals: [false] }, { approvals: [true, false] }, { noProvider: true }]) {
    const h = harness(options); await h.client.beginDeedCheckout(); assert.equal(h.sends().length, 0); assert.equal(h.storage.size, 0);
  }
});

test('wallet rejection permits same-pending retry; unknown outcomes and successful sends remain held', async () => {
  for (const [sendError, expectedSize] of [[{ code: 4001 }, 0], [Error('private wallet internals'), 1]]) {
    const h = harness({ sendError }); await h.client.beginDeedCheckout(); assert.equal(h.storage.size, expectedSize);
    assert(!JSON.stringify(h.notices).includes('private wallet internals'));
  }
  for (const options of [{}, { sendResult: 'malformed' }]) {
    const h = harness(options); await h.client.beginDeedCheckout(); await h.client.beginDeedCheckout();
    assert.equal(h.sends().length, 1); assert.match(h.notices.at(-1)[0], /pending or unknown outcome/);
  }
});

test('storage failure and another-tab lock refuse without sending', async () => {
  for (const options of [{ storageFailure: true }, { lockDenied: true }]) {
    const h = harness(options); await h.client.beginDeedCheckout(); assert.equal(h.sends().length, 0);
    assert(!JSON.stringify(h.notices).includes('private storage failure'));
  }
});

test('real reservation path admits only an unclaimed unreserved paid catalog property', async () => {
  const paid = { id: 'docks-paid-0001', issuanceKind: 'paid', claimed: false, reserved: false };
  const h = harness(); await h.client.reservePaidDeed(paid, 'Exact Street', 'docks');
  assert.deepEqual(h.calls[0], { method: 'POST', path: '/v1/deeds/paid/reserve', body: { name: 'Exact Street', buildingId: paid.id, district: 'docks' } });
  assert.match(h.notices[0][0], /No deed or benefits.*until.*confirmed/);
  for (const change of [p => p.issuanceKind = 'partnership', p => p.issuanceKind = 'gameplay', p => p.claimed = true,
    p => p.reserved = true, p => delete p.reserved]) {
    const p = clone(paid); change(p); const blocked = harness(); await blocked.client.reservePaidDeed(p, 'Name', 'docks'); assert.equal(blocked.calls.length, 0);
  }
  assert.equal(h.sends().length, 0);
});

test('production chain card shows inert intent, held configuration and signed-claim retry', () => {
  const begin = html.indexOf('    const chainCard = () => {'), end = html.indexOf('    // THE GROWING MAP', begin);
  const card = html.slice(begin, end) + '\nthis.card = chainCard();';
  const esc = value => String(value).replaceAll('<', '&lt;');
  for (const [chain, expected] of [[{ configured: true }, /Review ETH price and mint/], [{ configured: false }, /held until chain and contract runtime/]]) {
    const c = vm.createContext({ deed: null, paidIntent: { name: '<inert>', building: { id: 'paid-1' }, district: 'docks' }, chain, esc, burnWarning: '' });
    vm.runInContext(card, c); assert.match(c.card, expected); assert.match(c.card, /no property or benefits have been granted/); assert(!c.card.includes('<inert>'));
  }
  const c = vm.createContext({ deed: { name: 'Earned' }, paidIntent: null, chain: { configured: true, extractPending: true }, esc, burnWarning: 'Original burn warning' });
  vm.runInContext(card, c); assert.match(c.card, /Review pending claim and wallet transaction/); assert.match(c.card, /Original burn warning/);
});


test('remint refuses a live owner or missing owner readback', () => {
  const h = harness(), body = fixture('0'); body.issuanceRoute = 'remint'; body.quote.identityIssued = true;
  body.quote.nativeName = body.voucher.name; body.quote.nativeDistrict = body.voucher.district;
  for (const liveOwner of [wallet, undefined]) {
    body.quote.liveOwner = liveOwner; assert.throws(() => h.client.validateDeedCheckout(body, wallet));
  }
});

test('final session or navigation drift and concurrent checkout attempts never duplicate a send', async () => {
  for (const mutate of [c => c.token = 'other', c => c.me.id = 'other', c => c.me.generation++, c => c.navigationRevision++]) {
    const h = harness({ onProvider: (c, method) => { if (method === 'eth_chainId') mutate(c); } });
    await h.client.beginDeedCheckout(); assert.equal(h.sends().length, 0); assert.equal(h.storage.size, 0);
  }
  const h = harness(); await Promise.all([h.client.beginDeedCheckout(), h.client.beginDeedCheckout()]);
  assert.equal(h.sends().length, 1); assert.equal(h.calls.filter(x => x.path === '/v1/deeds/extract').length, 2);
});


test('two independent page contexts sharing storage require browser locking and send at most once', async () => {
  const storage = new Map();
  const tick = async method => { if (method === 'eth_accounts' || method === 'eth_chainId') await Promise.resolve(); };
  const unsupported = [harness({ storage, locksUnsupported: true, providerTick: tick }), harness({ storage, locksUnsupported: true, providerTick: tick })];
  await Promise.all(unsupported.map(h => h.client.beginDeedCheckout()));
  assert.equal(unsupported.reduce((sum, h) => sum + h.sends().length, 0), 0, 'Unsupported browsers must refuse, even across independent pages.');
  assert.equal(storage.size, 0);
  assert(unsupported.every(h => h.notices.some(([message]) => message.includes('browser cannot safely submit'))));
  let held = false;
  const locks = { request: async (_key, options, work) => {
    assert.equal(options.ifAvailable, true);
    if (held) return work(null);
    held = true; try { return await work({}); } finally { held = false; }
  } };
  const supportedStorage = new Map();
  const supported = [harness({ storage: supportedStorage, lockService: locks, providerTick: tick }), harness({ storage: supportedStorage, lockService: locks, providerTick: tick })];
  assert.notEqual(supported[0].c, supported[1].c);
  await Promise.all(supported.map(h => h.client.beginDeedCheckout()));
  assert.equal(supported.reduce((sum, h) => sum + h.sends().length, 0), 1);
  assert.equal(supportedStorage.size, 1);
  assert.equal([...supportedStorage.values()][0], txHash);
});
