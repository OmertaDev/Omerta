import assert from 'node:assert/strict';
import { fixture } from './lib/consignments-fixture.js';
import { runEstate } from '../src/social/estate.js';
import * as Rentals from '../src/equipmentrentals.js';
import { runLedgerInvariants } from '../src/invariants.js';
import { canonicalDatabaseSnapshot } from '../tools/rc1-native-proof.js';

const f = await fixture(), { pool, tx, tool, terms, ref, invoke, C, G, native, state } = f;
const books = async () => {
  assert.deepEqual(await C.collectConsignmentIssues(pool), []);
  const result = await runLedgerInvariants(pool, { alert: false });
  assert.deepEqual(result.checks.filter(check => !check.ok), []);
};
try {
  const item = await tool();
  const quote = await invoke('createConsignment', 'owner', terms(item), 'estate-offer');
  await invoke('acceptConsignment', 'host', ref(quote), 'estate-host');
  const rentalTool = await tool('host');
  const rentalOffer = await tx(c => Rentals.createEquipmentRentalOffer(c, 'host', {
    itemId: rentalTool, rentCash: 100, depositCash: 250, durationSeconds: 60, offerSeconds: 60, published: true,
  }, 'estate-rental-offer'));
  await tx(c => Rentals.acceptEquipmentRental(c, 'other', {
    offerId: rentalOffer.offerId, maxRentCash: 100, maxDepositCash: 250, consent: true,
  }, 'estate-rental-accept'));
  await books();

  const beforeForged = await state();
  await assert.rejects(G.withTwoCharacters(pool, 'buyer', 'host-actor', (_actor, victim, c, h) =>
    C.recoverConsignmentsInEstate(c, victim.id, h.rentalDeathScope, {}), { meet: false }),
  error => error.code === 'estate_scope');
  assert.deepEqual(await state(), beforeForged, 'An ordinary sorted pair is not an estate capability');

  const resolve = async (_actor, victim, c, h) => {
    const witness = await Rentals.assertEquipmentRentalDeathScope(c, victim.id, h.rentalDeathScope);
    assert.deepEqual([...witness.ids].sort(), ['buyer-actor', 'host-actor', 'other-actor', 'owner-actor']);
    await runEstate(c, h, victim, 'consignment canonical estate fixture');
  };
  if (native) {
    const original = await canonicalDatabaseSnapshot(pool);
    await assert.rejects(G.withTwoCharacters(pool, 'buyer', 'host-actor', async (...args) => {
      await resolve(...args); throw Error('after-canonical-estate');
    }, { meet: false }), /after-canonical-estate/);
    assert.deepEqual(await canonicalDatabaseSnapshot(pool), original, 'Late estate failure restores every canonical row and sequence');
  }
  await G.withTwoCharacters(pool, 'buyer', 'host-actor', resolve, { meet: false });
  assert.equal((await pool.query('SELECT alive FROM characters WHERE id=$1', ['host-actor'])).rows[0].alive, false);
  assert.equal((await pool.query('SELECT status FROM consignments WHERE id=$1', [quote.consignmentId])).rows[0].status, 'party_dead');
  assert.deepEqual((await pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [item])).rows[0],
    { owner_scope: 'account', owner_id: 'owner', state: 'active' });
  await pool.query("INSERT INTO characters(id,account_id,name,season,loc,cash) VALUES('host-heir','host','Consignment heir',1,'foundry',500)");
  await assert.rejects(invoke('acceptConsignment', 'host', ref(quote), 'heir-fresh'), /original_actor/);
  assert.deepEqual(await invoke('acceptConsignment', 'host', ref(quote), 'estate-host'), { ok: true, ...quote, status: 'active' });
  await books();
  console.log(`Consignments canonical estate ${native ? 'PostgreSQL18.4' : 'memory'} PASS: mixed rental/consignment actor union, private scope, actual death, original title return, heir refusal, historical ACK and complete global books${native ? ', full late-failure row/sequence rollback' : ''}.`);
} finally { await pool.end(); }
