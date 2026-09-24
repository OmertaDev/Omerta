// Paid portrait reveal is enforced at the image and metadata routes, including frozen NFTs.
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { portraitRow } from '../src/portrait.js';
import { hasPaidPortraitFee } from '../src/portrait-access.js';
import { recordFeePayment, reconcileFees } from '../src/fees.js';

const app = await buildServer();
const pool = app.pool;
const TX = `0x${'ab'.repeat(32)}`;
const WALLET = '0x00000000000000000000000000000000000000aa';
let nonce = 800000;
const get = (id, suffix = '') => app.inject({ method: 'GET', url: `/v1/identity/${id}${suffix}` });

async function player(name) {
  const auth = await app.inject({ method: 'POST', url: '/v1/auth/guest' });
  const token = auth.json().token;
  const headers = { authorization: `Bearer ${token}` };
  const created = await app.inject({ method: 'POST', url: '/v1/character', headers, payload: { name } });
  assert.equal(created.statusCode, 200);
  const me = (await app.inject({ method: 'GET', url: '/v1/me', headers })).json();
  const id = me.id || me.character?.id;
  const account = (await pool.query('SELECT account_id FROM characters WHERE id=$1', [id])).rows[0].account_id;
  return { id, account, token };
}

async function receipt(account, changes = {}) {
  const r = { nonce: ++nonce, kind: 'mint', account, credited: true, amount: '10000000000000000', tx: TX, ...changes };
  await pool.query(`INSERT INTO fee_payments
    (nonce, kind, payer_address, amount_wei, tx_hash, account_id, credited)
    VALUES ($1,$2,$3,$4,$5,$6,$7)`, [r.nonce, r.kind, WALLET, r.amount, r.tx, r.account, r.credited]);
  return r.nonce;
}

async function sealed(id) {
  const svg = await get(id, '/portrait.svg');
  assert.equal(svg.statusCode, 200);
  assert.match(svg.headers['content-type'], /image\/svg\+xml/);
  assert.match(svg.headers['cache-control'], /no-store/);
  assert.match(svg.body, /ARTWORK SEALED/);
  assert.doesNotMatch(svg.body, /<image\b|data:image|data-identity-seal|Noir study|Commissioned portrait/);
  assert.ok(!svg.body.includes(String(id)), 'sealed artwork exposes no character seed');
  const meta = await get(id);
  assert.equal(meta.statusCode, 200);
  assert.match(meta.headers['cache-control'], /no-store/);
  assert.equal(meta.json().status, 'locked');
  assert.deepEqual(meta.json().attributes, []);
  assert.match(meta.json().description, /character.creation fee/i);
  assert.match(meta.json().description, /confirm/i);
  return svg.body;
}

async function revealed(id, name) {
  const svg = await get(id, '/portrait.svg');
  assert.equal(svg.statusCode, 200);
  assert.match(svg.body, /data:image\/jpeg;base64,/);
  assert.ok(svg.body.includes(name));
  assert.doesNotMatch(svg.body, /ARTWORK SEALED/);
  const meta = await get(id);
  assert.equal(meta.statusCode, 200);
  assert.notEqual(meta.json().status, 'locked');
  assert.ok(meta.json().attributes.some((t) => t.trait_type === 'Art Plate'));
}

try {
  const free = await player('Sealed Sal');
  const other = await player('Paid Pia');
  const firstSeal = await sealed(free.id);
  await pool.query('UPDATE account_persistent SET minted=true, mint_credits=3 WHERE account_id=$1', [free.account]);
  await pool.query('UPDATE characters SET minted=true WHERE id=$1', [free.id]);
  assert.equal(await sealed(free.id), firstSeal, 'free credits and free minting do not reveal art');

  // Positive entitlements alone are insufficient; require an attributed confirmed real mint receipt.
  for (const changes of [
    { tx: null }, { tx: '' }, { tx: '0x1234' }, { tx: `0x${'zz'.repeat(32)}` },
    { kind: 'respawn' }, { credited: false },
    { amount: '0' }, { amount: '-1' }, { amount: '01' }, { amount: '1.0' }, { amount: '1e18' },
    { amount: ' 1' }, { amount: '0x10' },
  ]) {
    const n = await receipt(free.account, changes);
    assert.equal(await hasPaidPortraitFee(pool, free.account), false, JSON.stringify(changes));
    await sealed(free.id);
    await pool.query('DELETE FROM fee_payments WHERE nonce=$1', [n]);
  }
  await receipt(other.account);
  assert.equal(await sealed(free.id), firstSeal, 'another account paying never unlocks this character');
  await revealed(other.id, 'Paid Pia');

  // Frozen rows must not borrow receipt eligibility from the snapshot character or the token buyer.
  const paidSnapshot = await portraitRow(pool, other.id);
  await pool.query(`INSERT INTO dynasty_tokens
    (token_id, nonce, minter_address, owner_address, account_id, frozen, snapshot)
    VALUES ('800001',800001,$1,$1,$2,true,$3)`, [WALLET, free.account, JSON.stringify(paidSnapshot)]);
  await pool.query(`INSERT INTO dynasty_tokens
    (token_id, nonce, minter_address, owner_address, account_id, frozen, snapshot)
    VALUES ('800002',800002,$1,$1,NULL,true,$2)`, [WALLET, JSON.stringify(paidSnapshot)]);
  await pool.query(`INSERT INTO dynasty_tokens
    (token_id, nonce, minter_address, owner_address, account_id)
    VALUES ('800003',800003,$1,$1,$2)`, [WALLET, free.account]);
  await sealed('800001');
  await sealed('800002');
  await sealed('800003');
  const signedView = await app.inject({ method: 'GET', url: '/v1/identity/800001/portrait.svg',
    headers: { authorization: `Bearer ${other.token}` } });
  assert.equal(signedView.body, firstSeal, 'a paid viewer cannot reveal an unpaid minter portrait');

  // Receipt settlement reveals immediately, without requiring the separate credit-spend action.
  await pool.query('UPDATE account_persistent SET minted=false, mint_credits=0 WHERE account_id=$1', [free.account]);
  await pool.query('UPDATE characters SET minted=false WHERE id=$1', [free.id]);
  await receipt(free.account);
  await revealed(free.id, 'Sealed Sal');
  await revealed('800001', 'Paid Pia');
  await revealed('800003', 'Sealed Sal');
  await sealed('800002');

  // A payment before SIWE linking remains sealed until the existing reconciliation attributes it.
  const late = await player('Late Luca');
  const lateWallet = '0x00000000000000000000000000000000000000bb';
  const pending = await recordFeePayment(pool, { nonce: ++nonce, kind: 'mint', payer: lateWallet,
    amountWei: '10000000000000000', txHash: TX });
  assert.equal(pending.credited, false);
  await sealed(late.id);
  await pool.query('UPDATE account_persistent SET wallet_address=$2 WHERE account_id=$1', [late.account, lateWallet]);
  assert.equal((await reconcileFees(pool, late.account, lateWallet)).credited, 1);
  await revealed(late.id, 'Late Luca');
  assert.equal((await pool.query('SELECT minted FROM account_persistent WHERE account_id=$1', [late.account])).rows[0].minted, false);

  // Runtime static routes must not expose the per-character source file or starter collection.
  for (const path of ['/art/nft/portrait-00.jpg', '/art/nft/manifest.json']) {
    assert.equal((await app.inject({ method: 'GET', url: path })).statusCode, 404);
  }
  const beforeReads = Number((await pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n);
  await revealed(free.id, 'Sealed Sal');
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n), beforeReads,
    'revealing a portrait does not charge or mutate the game ledger');
} finally { await app.close(); }
console.log('Portrait access: confirmed fee receipts, sealed responses, free-credit isolation, token/snapshot ownership and late-link reconciliation pass.');
