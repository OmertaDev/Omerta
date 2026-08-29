// Authored-content barter. Offers are account-owned, exact-hash, whole-lot exchanges: one compiled
// authored material for another. No route in this module reads or writes cash, $OMR, ordinary item
// inventory, the transaction ledger, combat state, or export state.
import crypto from 'node:crypto';
import { GameError } from '../game.js';
import {
  consumeContentLots,
  insertContentLot,
  loadActiveBundle,
  loadBundle,
  projectWorkshop,
} from './crafting.js';

const fail = (code, message, data) => { throw new GameError(code, message, data); };

const itemDefinitions = (bundle) => new Map(bundle.nodes
  .filter((node) => node.type === 'item_def').map((node) => [node.id, node]));

const exchangeManifest = (bundle) => {
  const exchange = bundle.crafting?.exchange;
  if (!exchange) fail('exchange_closed', 'That authored workshop has no material exchange.');
  return exchange;
};

const exchangeItem = (bundle, itemId) => {
  const exchange = exchangeManifest(bundle);
  if (!exchange.itemIds.includes(itemId)) {
    fail('bad_exchange_item', 'That item is not admitted to this authored exchange.');
  }
  const item = itemDefinitions(bundle).get(itemId);
  if (!item || item.payload?.tradeable !== true || item.payload?.gameplayPower !== 'none'
    || !item.payload?.stackable) {
    fail('unsupported_content_feature', 'The authored exchange item definition is not executable.');
  }
  return item;
};

const safeItem = (bundle, itemId, quantity) => {
  const item = exchangeItem(bundle, itemId);
  return { itemId, title: item.payload.title, quantity: Number(quantity) };
};

const positiveQuantity = (value, label) => {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
    fail('qty', `${label} quantity must be a whole number from 1 to 10,000.`);
  }
  return quantity;
};

async function availableQuantity(client, accountId, namespace, contentHash, itemId) {
  const row = (await client.query(
    `SELECT COALESCE(SUM(quantity_remaining),0)::int AS qty
       FROM content_inventory_lots
      WHERE account_id=$1 AND namespace=$2 AND content_hash=$3 AND item_id=$4`,
    [accountId, namespace, contentHash, itemId],
  )).rows[0];
  return Number(row?.qty || 0);
}

async function escrowedQuantity(client, accountId, namespace, contentHash, itemId) {
  const row = (await client.query(
    `SELECT COALESCE(SUM(offered_quantity),0)::int AS qty
       FROM content_exchange_listings
      WHERE seller_account=$1 AND namespace=$2 AND content_hash=$3
        AND offered_item_id=$4 AND status='live'`,
    [accountId, namespace, contentHash, itemId],
  )).rows[0];
  return Number(row?.qty || 0);
}

async function ownedQuantity(client, accountId, namespace, contentHash, itemId) {
  return await availableQuantity(client, accountId, namespace, contentHash, itemId)
    + await escrowedQuantity(client, accountId, namespace, contentHash, itemId);
}

async function capacityBlock(client, accountId, bundle, itemId, incoming, kind = 'inventory_cap') {
  const item = exchangeItem(bundle, itemId);
  const current = await ownedQuantity(
    client, accountId, bundle.namespace, bundle.contentHash, itemId,
  );
  if (current + Number(incoming) <= Number(item.payload.maxOwned)) return null;
  return {
    kind, label: `${item.payload.title} ownership limit`, passed: false,
    itemId, current, incoming: Number(incoming), required: Number(item.payload.maxOwned),
  };
}

async function insertEvent(client, listing, eventKind, actorAccount, counterpartyAccount = null) {
  await client.query(
    `INSERT INTO content_exchange_events
       (id, listing_id, actor_account, counterparty_account, namespace, version, content_hash,
        event_kind, offered_item_id, offered_quantity, requested_item_id, requested_quantity)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [crypto.randomUUID(), listing.id, actorAccount, counterpartyAccount,
      listing.namespace, Number(listing.version), listing.content_hash, eventKind,
      listing.offered_item_id, Number(listing.offered_quantity),
      listing.requested_item_id, Number(listing.requested_quantity)],
  );
}

async function activeWorkshopWithExchange(ch, client, h, namespace) {
  const bundle = await loadActiveBundle(client, namespace);
  const workshop = await projectWorkshop(ch, client, h, bundle);
  return attachContentExchange(ch, client, h, workshop);
}

async function staleActiveWorkshop(ch, client, h, namespace, message) {
  fail('stale_content', message, {
    workshop: await activeWorkshopWithExchange(ch, client, h, namespace),
  });
}

async function loadListingBundle(client, listing) {
  const bundle = await loadBundle(
    client, listing.namespace, Number(listing.version), listing.content_hash,
  );
  exchangeItem(bundle, listing.offered_item_id);
  exchangeItem(bundle, listing.requested_item_id);
  return bundle;
}

async function listingProjection(ch, client, row, bundle, activeContentHash) {
  const mine = row.seller_account === ch.account_id;
  const expired = new Date(row.expires_at).getTime() <= Date.now();
  const requestedAvailable = await availableQuantity(
    client, ch.account_id, row.namespace, row.content_hash, row.requested_item_id,
  );
  const blockedBy = [];
  if (expired) blockedBy.push({
    kind: 'exchange_expired', label: 'Offer expired', passed: false,
    current: row.expires_at, required: 'future',
  });
  if (mine) blockedBy.push({
    kind: 'exchange_self', label: 'Your own offer', passed: false,
    current: 'seller', required: 'buyer',
  });
  if (!mine && requestedAvailable < Number(row.requested_quantity)) blockedBy.push({
    kind: 'materials', label: 'Requested authored materials unavailable', passed: false,
    itemId: row.requested_item_id, current: requestedAvailable,
    required: Number(row.requested_quantity),
  });
  if (!mine) {
    const buyerCap = await capacityBlock(
      client, ch.account_id, bundle, row.offered_item_id, row.offered_quantity,
    );
    if (buyerCap) blockedBy.push(buyerCap);
    const sellerCap = await capacityBlock(
      client, row.seller_account, bundle, row.requested_item_id, row.requested_quantity,
      'seller_inventory_cap',
    );
    if (sellerCap) blockedBy.push(sellerCap);
  }
  const fillable = !mine && blockedBy.length === 0;
  const action = mine ? {
    kind: 'cancel', method: 'POST',
    path: `/v1/content/${encodeURIComponent(row.namespace)}/exchange/${encodeURIComponent(row.id)}/cancel`,
    body: { expectedContentHash: row.content_hash },
  } : (fillable ? {
    kind: 'fill', method: 'POST',
    path: `/v1/content/${encodeURIComponent(row.namespace)}/exchange/${encodeURIComponent(row.id)}/fill`,
    body: { expectedContentHash: row.content_hash },
  } : null);
  return {
    id: row.id, version: Number(row.version), contentHash: row.content_hash,
    currentVersion: row.content_hash === activeContentHash,
    seller: row.seller_name || 'An unnamed bloodline', mine, expired,
    offered: safeItem(bundle, row.offered_item_id, row.offered_quantity),
    requested: safeItem(bundle, row.requested_item_id, row.requested_quantity),
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    fillable, blockedBy, action,
  };
}

export async function projectContentExchange(ch, client, h, workshop) {
  const bundle = await loadBundle(
    client, workshop.namespace, Number(workshop.version), workshop.contentHash,
  );
  const exchange = bundle.crafting?.exchange;
  if (!exchange) return null;
  const rows = (await client.query(
    `SELECT l.*, c.name AS seller_name
       FROM content_exchange_listings l
       LEFT JOIN characters c ON c.account_id=l.seller_account AND c.alive
      WHERE l.namespace=$1 AND l.status='live'
      ORDER BY l.created_at, l.id`,
    [workshop.namespace],
  )).rows;
  const bundles = new Map([[bundle.contentHash, bundle]]);
  const listings = [];
  for (const row of rows) {
    if (!bundles.has(row.content_hash)) {
      bundles.set(row.content_hash, await loadListingBundle(client, row));
    }
    listings.push(await listingProjection(
      ch, client, row, bundles.get(row.content_hash), bundle.contentHash,
    ));
  }
  const inventory = new Map(workshop.inventory.map((item) => [item.id, item]));
  const ownOpenListings = rows.filter((row) => row.seller_account === ch.account_id).length;
  return {
    kind: 'authored_barter', settlement: 'item_for_item',
    listingTtlHours: Number(exchange.listingTtlHours),
    maxOpenListingsPerAccount: Number(exchange.maxOpenListingsPerAccount),
    ownOpenListings,
    items: exchange.itemIds.map((itemId) => {
      const item = inventory.get(itemId);
      return {
        itemId, title: item?.title || itemId, available: Number(item?.quantity || 0),
        escrowed: Number(item?.escrowed || 0), maxOwned: Number(item?.maxOwned || 0),
      };
    }),
    listings,
  };
}

export async function attachContentExchange(ch, client, h, workshop) {
  const exchange = await projectContentExchange(ch, client, h, workshop);
  return exchange ? { ...workshop, exchange } : workshop;
}

export async function attachContentExchanges(ch, client, h, workshops) {
  const result = [];
  for (const workshop of workshops) {
    result.push(await attachContentExchange(ch, client, h, workshop));
  }
  return result;
}

export async function createContentExchangeListing(ch, namespace, opts, client, h) {
  const bundle = await loadActiveBundle(client, namespace);
  if (bundle.contentHash !== String(opts?.expectedContentHash || '')) {
    await staleActiveWorkshop(
      ch, client, h, namespace, 'The active authored workshop changed; refresh before listing.',
    );
  }
  const exchange = exchangeManifest(bundle);
  const offeredItemId = String(opts?.offeredItemId || '');
  const requestedItemId = String(opts?.requestedItemId || '');
  if (offeredItemId === requestedItemId) {
    fail('same_exchange_item', 'Offer and request two different authored materials.');
  }
  const offered = exchangeItem(bundle, offeredItemId);
  const requested = exchangeItem(bundle, requestedItemId);
  const offeredQuantity = positiveQuantity(opts?.offeredQuantity, 'Offered');
  const requestedQuantity = positiveQuantity(opts?.requestedQuantity, 'Requested');
  if (offeredQuantity > Number(offered.payload.maxOwned)
    || requestedQuantity > Number(requested.payload.maxOwned)) {
    fail('qty', 'An authored exchange quantity cannot exceed its compiled ownership limit.');
  }
  const open = Number((await client.query(
    `SELECT COUNT(*) AS n FROM content_exchange_listings
      WHERE seller_account=$1 AND namespace=$2 AND status='live'`,
    [ch.account_id, namespace],
  )).rows[0]?.n || 0);
  if (open >= Number(exchange.maxOpenListingsPerAccount)) {
    fail('exchange_listing_limit', 'Pull an open authored offer before posting another.');
  }
  const available = await availableQuantity(
    client, ch.account_id, namespace, bundle.contentHash, offeredItemId,
  );
  if (available < offeredQuantity) {
    fail('materials', 'You do not have the authored materials you offered.');
  }
  const recipientCap = await capacityBlock(
    client, ch.account_id, bundle, requestedItemId, requestedQuantity,
  );
  if (recipientCap) fail('owned_limit', recipientCap.label, recipientCap);

  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + Number(exchange.listingTtlHours) * 60 * 60 * 1000);
  await consumeContentLots(client, {
    accountId: ch.account_id, namespace, contentHash: bundle.contentHash,
    itemId: offeredItemId, quantity: offeredQuantity,
  });
  const listing = {
    id, seller_account: ch.account_id, namespace, version: Number(bundle.version),
    content_hash: bundle.contentHash, offered_item_id: offeredItemId, offered_quantity: offeredQuantity,
    requested_item_id: requestedItemId, requested_quantity: requestedQuantity,
  };
  await client.query(
    `INSERT INTO content_exchange_listings
       (id, seller_account, namespace, version, content_hash, offered_item_id, offered_quantity,
        requested_item_id, requested_quantity, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, ch.account_id, namespace, Number(bundle.version), bundle.contentHash,
      offeredItemId, offeredQuantity, requestedItemId, requestedQuantity, expiresAt],
  );
  await insertEvent(client, listing, 'list', ch.account_id);
  return {
    ok: true,
    receipt: {
      id, kind: 'exchange_list', contentHash: bundle.contentHash,
      offered: safeItem(bundle, offeredItemId, offeredQuantity),
      requested: safeItem(bundle, requestedItemId, requestedQuantity),
      expiresAt: expiresAt.toISOString(),
    },
    workshop: await activeWorkshopWithExchange(ch, client, h, namespace),
  };
}

export async function cancelContentExchangeListing(ch, namespace, listingId, opts, client, h) {
  const listing = (await client.query(
    `SELECT * FROM content_exchange_listings
      WHERE id=$1 AND namespace=$2 AND status='live' FOR UPDATE`,
    [listingId, namespace],
  )).rows[0];
  if (!listing) fail('gone', 'That authored exchange offer is no longer open.');
  if (listing.seller_account !== ch.account_id) fail('no_listing', 'That is not your authored offer.');
  if (listing.content_hash !== String(opts?.expectedContentHash || '')) {
    await staleActiveWorkshop(
      ch, client, h, namespace, 'The authored exchange offer changed; refresh before cancelling.',
    );
  }
  const bundle = await loadListingBundle(client, listing);
  await insertContentLot(client, {
    accountId: ch.account_id, namespace, version: Number(listing.version),
    contentHash: listing.content_hash, itemId: listing.offered_item_id,
    quantity: Number(listing.offered_quantity), acquiredVia: 'exchange_return',
    authorityId: listing.id,
  });
  await client.query(
    `UPDATE content_exchange_listings
        SET status='cancelled', settled_at=now()
      WHERE id=$1`,
    [listing.id],
  );
  await insertEvent(client, listing, 'cancel', ch.account_id);
  return {
    ok: true,
    receipt: {
      id: listing.id, kind: 'exchange_cancel', contentHash: listing.content_hash,
      returned: safeItem(bundle, listing.offered_item_id, listing.offered_quantity),
    },
    workshop: await activeWorkshopWithExchange(ch, client, h, namespace),
  };
}

export async function fillContentExchangeListing(
  ch, seller, namespace, listingId, opts, client, h,
) {
  const listing = (await client.query(
    `SELECT * FROM content_exchange_listings
      WHERE id=$1 AND namespace=$2 AND status='live' FOR UPDATE`,
    [listingId, namespace],
  )).rows[0];
  if (!listing) fail('gone', 'Too slow — that authored offer is no longer open.');
  if (listing.seller_account !== seller.account_id) {
    fail('bad_seller', 'The authored offer no longer belongs to that seller.');
  }
  if (listing.seller_account === ch.account_id) fail('self', 'You cannot fill your own authored offer.');
  if (listing.content_hash !== String(opts?.expectedContentHash || '')) {
    await staleActiveWorkshop(
      ch, client, h, namespace, 'The authored exchange offer changed; refresh before filling.',
    );
  }
  if (new Date(listing.expires_at).getTime() <= Date.now()) {
    fail('exchange_expired', 'That authored offer expired; its owner can pull it back.');
  }
  const bundle = await loadListingBundle(client, listing);
  const requestedAvailable = await availableQuantity(
    client, ch.account_id, namespace, listing.content_hash, listing.requested_item_id,
  );
  if (requestedAvailable < Number(listing.requested_quantity)) {
    fail('materials', 'You no longer hold the authored materials this offer requests.');
  }
  const buyerCap = await capacityBlock(
    client, ch.account_id, bundle, listing.offered_item_id, listing.offered_quantity,
  );
  if (buyerCap) fail('owned_limit', buyerCap.label, buyerCap);
  const sellerCap = await capacityBlock(
    client, seller.account_id, bundle, listing.requested_item_id, listing.requested_quantity,
    'seller_inventory_cap',
  );
  if (sellerCap) fail('seller_inventory_cap', 'The seller has no room for the requested material.', sellerCap);

  await consumeContentLots(client, {
    accountId: ch.account_id, namespace, contentHash: listing.content_hash,
    itemId: listing.requested_item_id, quantity: Number(listing.requested_quantity),
  });
  await insertContentLot(client, {
    accountId: ch.account_id, namespace, version: Number(listing.version),
    contentHash: listing.content_hash, itemId: listing.offered_item_id,
    quantity: Number(listing.offered_quantity), acquiredVia: 'exchange_fill',
    authorityId: listing.id,
  });
  await insertContentLot(client, {
    accountId: seller.account_id, namespace, version: Number(listing.version),
    contentHash: listing.content_hash, itemId: listing.requested_item_id,
    quantity: Number(listing.requested_quantity), acquiredVia: 'exchange_fill',
    authorityId: listing.id,
  });
  await client.query(
    `UPDATE content_exchange_listings
        SET status='filled', buyer_account=$2, settled_at=now()
      WHERE id=$1`,
    [listing.id, ch.account_id],
  );
  await insertEvent(client, listing, 'fill', ch.account_id, seller.account_id);
  return {
    ok: true,
    receipt: {
      id: listing.id, kind: 'exchange_fill', contentHash: listing.content_hash,
      received: safeItem(bundle, listing.offered_item_id, listing.offered_quantity),
      delivered: safeItem(bundle, listing.requested_item_id, listing.requested_quantity),
      seller: seller.name,
    },
    workshop: await activeWorkshopWithExchange(ch, client, h, namespace),
  };
}
