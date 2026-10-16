import { fixture as consignmentFixture } from './lib/consignments-fixture.js';
import * as Ads from '../src/saleattribution.js';

export async function fixture(api = false) {
  const f = await consignmentFixture(api); let serial = 0;
  const act = (account, action, body, key = 'ad-' + (++serial)) => f.tx(c => Ads.saleAttributionAction(c, account, action, body, key));
  const ref = campaign => ({ campaignId: campaign.campaignId, sourceHash: campaign.sourceHash, consent: true });
  const attributionRef = row => ({ attributionId: row.attributionId, sourceHash: row.sourceHash, consent: true });
  const list = async () => {
    const itemId = await f.tool(), offer = await f.invoke('createConsignment', 'owner', f.terms(itemId), 'listing-' + (++serial));
    await f.invoke('acceptConsignment', 'host', f.ref(offer), 'host-' + serial);
    return { itemId, offer, open: { ...f.ref(offer), publisherAccountId: 'other', commissionCash: 17, lifetimeSeconds: 60 } };
  };
  const state = async () => {
    const out = {};
    for (const table of ['characters', 'transactions', 'item_instances', 'operation_escrow', 'item_events', 'item_mutation_guards',
      'item_mutation_inputs', 'item_mutation_outputs', 'consignments', 'consignment_requests',
      'sale_attribution_campaigns', 'sale_attributions', 'sale_attribution_requests']) out[table] = (await f.pool.query('SELECT * FROM ' + table)).rows
      .sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0);
    return out;
  };
  const books = async () => {
    const assert = (await import('node:assert/strict')).default;
    assert.deepEqual(await Ads.collectSaleAttributionIssues(f.pool), []);
    const rows = (await f.pool.query("SELECT COALESCE(SUM(amount),0) AS cash FROM transactions WHERE reason IN ('sale_attribution:reserve','sale_attribution:commission','sale_attribution:refund')")).rows;
    const reserve = (await f.pool.query(Ads.saleAttributionEscrowQuery)).rows;
    assert.equal(Number(rows[0].cash) + Number(reserve[0].cash), 0, 'every advertising dollar is ledgered or held');
  };
  return { ...f, consignmentRef: f.ref, Ads, act, ref, attributionRef, list, state, books };
}
