import assert from 'node:assert/strict';
import { nativeFixture, assertMetadataOnlyCancellation } from './manufacturinglicenses-native-fixture.js';

const f = await nativeFixture();
const { app, pool, G, M, A, action, ref, player, materials, productionSource, publish, snapshot, readOnly, books } = f;
try {
  const owner = await player(), buyer = await player(), livingOwner = await player(), stranger = await player();
  const source = await productionSource(owner), livingSource = await productionSource(livingOwner);
  await materials(buyer);
  const licenses = [];
  for (let index = 0; index < 4; index++) {
    const offered = await publish(owner, buyer, source);
    await action(buyer, 'accept', { ...ref(offered), businessId: buyer.business, consent: true }, 'native-dead-source-accept-' + index);
    licenses.push(offered);
  }
  const paid = await action(buyer, 'run', ref(licenses[0]), 'native-estate-paid-run');
  assert.equal(paid.royaltyPaid, 25);
  assert.equal(paid.status, 'accepted', 'Paid partial license still occupies the real acceptance cap');
  const livingOffer = await publish(livingOwner, buyer, livingSource);
  assert.equal((await pool.query("SELECT COUNT(*)::int n FROM manufacturing_licenses WHERE licensee_character=$1 AND status='accepted' AND expires_at>clock_timestamp()", [buyer.id])).rows[0].n, 4);
  const atCapacity = await snapshot();
  await assert.rejects(M.manufacturingLicenseAction(pool, buyer.account, 'accept', { ...ref(livingOffer), businessId: buyer.business, consent: true }, 'native-capacity-before-estate'),
    error => error.code === 'manufacturing_license' && error.message === 'capacity');
  assert.equal((await snapshot()).stateSha256, atCapacity.stateSha256);

  const { runEstate } = await import('../src/social/estate.js');
  await G.withTwoCharacters(pool, livingOwner.account, owner.id,
    (_actor, victim, client, house) => runEstate(client, house, victim, 'native N15 original licensor estate'), { meet: false });
  assert.equal((await pool.query('SELECT alive FROM characters WHERE id=$1', [owner.id])).rows[0].alive, false);
  const heirs = (await pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true', [owner.account])).rows;
  assert.equal(heirs.length, 1);
  assert.notEqual(heirs[0].id, owner.id, 'Actual canonical estate created an heir');
  const afterEstate = await snapshot();
  await assert.rejects(M.manufacturingLicenseAction(pool, buyer.account, 'run', ref(licenses[0]), 'native-no-dead-source-production'),
    error => error.code === 'manufacturing_license' && error.message === 'original_actor');
  assert.deepEqual(await action(buyer, 'run', ref(licenses[0]), 'native-estate-paid-run'), paid);
  assert.equal((await snapshot()).stateSha256, afterEstate.stateSha256, 'Fresh dead-source production fails and immutable paid ACK replays without effects');

  const cancelKey = 'native-surviving-original-release';
  const beforeCancel = await snapshot();
  const cancelled = await action(buyer, 'cancel', ref(licenses[1]), cancelKey);
  assert.equal(cancelled.status, 'cancelled');
  const afterCancel = await snapshot();
  assertMetadataOnlyCancellation(beforeCancel, afterCancel, licenses[1].licenseId, buyer.account, cancelKey);
  assert.deepEqual(await action(buyer, 'cancel', ref(licenses[1]), cancelKey), cancelled);
  assert.equal((await snapshot()).stateSha256, afterCancel.stateSha256);
  const accepted = await action(buyer, 'accept', { ...ref(livingOffer), businessId: buyer.business, consent: true }, 'native-real-living-source-after-recovery');
  assert.equal(accepted.status, 'accepted');
  assert.equal((await pool.query("SELECT COUNT(*)::int n FROM manufacturing_licenses WHERE licensee_character=$1 AND status='accepted' AND expires_at>clock_timestamp()", [buyer.id])).rows[0].n, 4,
    'One genuine recovered slot admits a real living source without changing the four-license cap');

  const noAuthority = await snapshot();
  for (const [account, kind, offer, requestKey] of [
    [owner.account, 'cancel', licenses[2], 'native-no-heir-release'],
    [stranger.account, 'cancel', licenses[2], 'native-no-foreign-release'],
    [buyer.account, 'run', licenses[2], 'native-no-dead-source-free-output']
  ]) await assert.rejects(M.manufacturingLicenseAction(pool, account, kind, ref(offer), requestKey), error => error.code === 'manufacturing_license');
  assert.equal((await snapshot()).stateSha256, noAuthority.stateSha256);
  const paidHistory = (await pool.query("SELECT * FROM transactions WHERE reason IN ('manufacturing_license:pay','manufacturing_license:receive') ORDER BY id")).rows;
  const oldPaid = (await pool.query('SELECT * FROM manufacturing_licenses WHERE id=$1', [licenses[0].licenseId])).rows[0];
  const beforePaidCancel = await snapshot(), paidCancelKey = 'native-survivor-paid-history-release';
  await action(buyer, 'cancel', ref(licenses[0]), paidCancelKey);
  assertMetadataOnlyCancellation(beforePaidCancel, await snapshot(), licenses[0].licenseId, buyer.account, paidCancelKey);
  assert.deepEqual((await pool.query('SELECT * FROM manufacturing_licenses WHERE id=$1', [licenses[0].licenseId])).rows[0], { ...oldPaid, status: 'cancelled' });
  assert.deepEqual(await action(buyer, 'run', ref(licenses[0]), 'native-estate-paid-run'), paid);
  assert.deepEqual((await pool.query("SELECT * FROM transactions WHERE reason IN ('manufacturing_license:pay','manufacturing_license:receive') ORDER BY id")).rows, paidHistory);

  await G.withTwoCharacters(pool, stranger.account, buyer.id,
    (_actor, victim, client, house) => runEstate(client, house, victim, 'native N15 original licensee estate'), { meet: false });
  assert.equal((await pool.query('SELECT alive FROM characters WHERE id=$1', [buyer.id])).rows[0].alive, false);
  const beforeOppositeCancel = await snapshot(), oppositeKey = 'native-original-licensor-survives';
  await action(livingOwner, 'cancel', ref(livingOffer), oppositeKey);
  assertMetadataOnlyCancellation(beforeOppositeCancel, await snapshot(), livingOffer.licenseId, livingOwner.account, oppositeKey);
  const beforeHeirRefusal = await snapshot();
  await assert.rejects(M.manufacturingLicenseAction(pool, buyer.account, 'cancel', ref(licenses[3]), 'native-no-licensee-heir-release'),
    error => error.code === 'manufacturing_license' && error.message === 'original_actor');
  assert.equal((await snapshot()).stateSha256, beforeHeirRefusal.stateSha256);
  assert.deepEqual(await A.collectManufacturingLicenseIssues(readOnly), []);
  await books();
  console.log('Manufacturing license native estate PASS: actual original licensor and licensee estates, unchanged four-license cap, surviving original metadata-only release across every native table and sequence, genuine living-source admission, paid history/ACK preserved and heir/foreign/dead-source authority refused. Backend ' + f.backend.version);
} finally { await app.close(); }
