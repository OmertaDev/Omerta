// Canonical deed authority and durable account items; no travel, currency or character custody conversion.
import crypto from 'node:crypto';
import { GameError } from './game.js';
import { withItemRead, withItemTransaction, registerItemTransactionUndo, inventoryBoard,
  storeItem, retrieveStoredItem } from './items.js';
import { finalizeHttpIdempotency } from './http-idempotency.js';
import { validateCityRoom } from './city-social.js';
import { DEFAULT_CRAFTING_CONTEXT, homeRecipeCatalogForPlayer, craftWorldGraphRecipe } from './crafting.js';
import { nodeOf } from './worldgraph.js';
import { HOME_STORAGE_CAPACITY, HOME_VISITOR_CAPACITY, HOME_INVITATION_MS, HOME_ROOM_SIZE,
  CITY_FURNITURE, HOME_PUZZLES, HOME_ACTIVITY_CAPACITY, validateHomeBody, validateHomeQuery } from './city-home-contract.js';

const fail = (code = 'home_unavailable', message = 'That home action is unavailable. Refresh your home view.') => { throw new GameError(code, message); };
const viewerOf = actor => ({ characterId: actor.id, generation: Number(actor.generation), district: actor.loc });
const external = deed => !deed || deed.onchain_token_id != null || String(deed.account_id).startsWith('onchain:');
const decode = value => typeof value === 'string' ? JSON.parse(value) : value;
const action = (id, label, path, body, blockedBy = [], inputFields = []) => ({ id, label, method: 'POST', path,
  body, available: blockedBy.length === 0, blockedBy, ...(inputFields.length ? { inputFields } : {}) });
const path = value => '/v1/city/home/' + value;
const innerKey = receipt => 'home:http:v1:' + crypto.createHash('sha256').update(JSON.stringify([receipt.accountId, receipt.key, receipt.bodyHash])).digest('hex');
const location = deed => ({ homeKey: deed.name_lc, authorityToken: deed.home_authority_token });

async function latestActor(client, accountId) {
  const actor = (await client.query(`SELECT id,account_id,name,generation,loc,alive,is_npc FROM characters
    WHERE account_id=$1 AND alive ORDER BY created_at DESC,id LIMIT 1`, [accountId])).rows[0];
  if (!actor) fail();
  return actor;
}
async function checkAccount(client, actor) {
  const account = (await client.query('SELECT status FROM accounts WHERE id=$1', [actor.account_id])).rows[0];
  const flags = (await client.query('SELECT agent_flag,npc_flag FROM account_persistent WHERE account_id=$1', [actor.account_id])).rows[0];
  if (account?.status !== 'active' || actor.is_npc || flags?.npc_flag) fail();
  return flags?.agent_flag ? 'agent' : 'player';
}
function current(actor, body) {
  if (!actor.alive || actor.id !== body.characterId || Number(actor.generation) !== body.generation || actor.loc !== body.district) {
    fail('home_identity_changed', 'Your character or district changed. Refresh your home view.');
  }
}
async function lockActors(client, actors) {
  const locked = new Map();
  for (const id of [...new Set(actors.map(actor => actor.id))].sort()) {
    const row = (await client.query('SELECT id,account_id,name,generation,loc,alive,is_npc FROM characters WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!row?.alive) fail();
    locked.set(id, row);
  }
  for (const actor of actors) {
    const row = locked.get(actor.id), latest = await latestActor(client, actor.account_id);
    if (row.account_id !== actor.account_id || latest.id !== row.id || Number(row.generation) !== Number(actor.generation)) fail('contention');
    await checkAccount(client, row);
  }
  return locked;
}
async function homeAccess(client, accountId, key, { body = null, lock = false, targetId = null, activating = false, activityId = null } = {}) {
  const initial = (await client.query('SELECT * FROM street_deeds WHERE name_lc=$1', [key])).rows[0];
  if (external(initial)) fail();
  let actor = await latestActor(client, accountId), host = await latestActor(client, initial.account_id), target, lockedActorIds;
  if (targetId) {
    target = (await client.query('SELECT id,account_id,name,generation,loc,alive,is_npc FROM characters WHERE id=$1 AND alive', [targetId])).rows[0];
    if (!target || target.account_id === accountId) fail();
  }
  if (lock) {
    const partners = [];
    const activity = activityId ? (await client.query('SELECT puzzle_id FROM city_home_activities WHERE id=$1', [activityId])).rows[0] : null;
    if (activity?.puzzle_id === 'two-voices-v1') {
      const members = (await client.query("SELECT character_id FROM city_home_activity_members WHERE activity_id=$1 AND status IN ('active','solved')", [activityId])).rows;
      for (const member of members) {
        const partner = (await client.query('SELECT id,account_id,name,generation,loc,alive,is_npc FROM characters WHERE id=$1 AND alive', [member.character_id])).rows[0];
        if (partner) partners.push(partner);
      }
    }
    const locked = await lockActors(client, [actor, host, ...(target ? [target] : []), ...partners]);
    lockedActorIds = new Set(locked.keys());
    actor = locked.get(actor.id); host = locked.get(host.id); if (target) target = locked.get(target.id);
  } else { await checkAccount(client, actor); await checkAccount(client, host); }
  if (body) current(actor, body);
  const deed = lock ? (await client.query('SELECT * FROM street_deeds WHERE name_lc=$1 FOR UPDATE', [key])).rows[0] : initial;
  if (external(deed) || deed.account_id !== initial.account_id || actor.loc !== deed.district) fail();
  const owner = deed.account_id === accountId;
  if (!owner && activating) fail();
  const room = deed.home_authority_token ? (lock
    ? await client.query(`SELECT * FROM city_home_rooms
      WHERE home_key=$1 AND authority_token=$2 FOR UPDATE`, [key, deed.home_authority_token])
    : await client.query(`SELECT * FROM city_home_rooms
      WHERE home_key=$1 AND authority_token=$2`, [key, deed.home_authority_token])).rows[0] : null;
  if (room && room.owner_account_id !== deed.account_id) fail('item_integrity_error');
  let rights = ['visit', 'workbench'], permission = null;
  if (!owner) {
    const grants = (lock
      ? await client.query(`SELECT * FROM city_home_visitors WHERE home_key=$1 AND authority_token=$2
        AND guest_account_id=$3 AND guest_character_id=$4 AND guest_generation=$5 AND status='active' FOR UPDATE`,
      [key, deed.home_authority_token, accountId, actor.id, Number(actor.generation)])
      : await client.query(`SELECT * FROM city_home_visitors WHERE home_key=$1 AND authority_token=$2
        AND guest_account_id=$3 AND guest_character_id=$4 AND guest_generation=$5 AND status='active'`,
      [key, deed.home_authority_token, accountId, actor.id, Number(actor.generation)])).rows;
    const grant = grants.find(row => row.host_character_id === host.id && Number(row.host_generation) === Number(host.generation)
      && new Date(row.expires_at).getTime() > Date.now());
    if (!room || !grant || host.loc !== deed.district) fail();
    rights = decode(grant.rights_json);
    permission = grant;
  }
  if (body && body.authorityToken !== deed.home_authority_token) fail('home_authority_changed', 'Home ownership changed. Refresh before continuing.');
  return { actor, host, target, deed, room, owner, rights, permission, lockedActorIds };
}
function baseBody(access) { return { ...viewerOf(access.actor), homeKey: access.deed.name_lc, authorityToken: access.deed.home_authority_token }; }
async function completeReceipt(client, receipt, result) {
  if (!receipt?.accountId || !receipt.reservationToken || typeof receipt.key !== 'string' || typeof receipt.bodyHash !== 'string') fail('idempotency_required');
  const response = JSON.stringify(result);
  registerItemTransactionUndo(client, () => client.query(`UPDATE idempotency SET status=0,response=$4
    WHERE account_id=$1 AND key=$2 AND body_hash=$3 AND status=200 AND response=$5`,
  [receipt.accountId, receipt.key, receipt.bodyHash, receipt.reservationToken, response]));
  const completed = await finalizeHttpIdempotency(client, receipt, { status: 200, response });
  if (completed.rowCount !== 1) fail('contention');
}
function requireReceipt(accountId, receipt) {
  if (receipt?.accountId !== accountId || typeof receipt.reservationToken !== 'string'
    || typeof receipt.key !== 'string' || typeof receipt.bodyHash !== 'string') fail('idempotency_required');
}
async function advanceRoom(client, room, furniture = null) {
  registerItemTransactionUndo(client, () => client.query(`UPDATE city_home_rooms SET revision=$3,layout_json=$4,layout_revision=$5
    WHERE home_key=$1 AND authority_token=$2`, [room.home_key, room.authority_token, Number(room.revision), room.layout_json, Number(room.layout_revision)]));
  await client.query(`UPDATE city_home_rooms SET revision=revision+1,layout_json=$3,layout_revision=layout_revision+$4 WHERE home_key=$1 AND authority_token=$2`,
    [room.home_key, room.authority_token, furniture === null ? room.layout_json : JSON.stringify(furniture), furniture === null ? 0 : 1]);
  return Number(room.revision) + 1;
}
async function mutateHome(pool, accountId, kind, body, receipt, apply, options = {}) {
  validateHomeBody(kind, body); requireReceipt(accountId, receipt);
  return withItemTransaction(pool, async client => {
    const access = await homeAccess(client, accountId, body.homeKey, { body, lock: true,
      targetId: options.target ? body.targetCharacterId : null, activating: kind === 'activate',
      activityId: kind === 'activity_answer' ? body.activityId : null });
    if (options.owner && !access.owner) fail();
    if (kind !== 'activate' && !access.room) fail('home_not_active', 'Open your home before using its facilities.');
    const effect = await apply(client, access);
    const revision = kind === 'activate' ? 1 : await advanceRoom(client, access.room, effect.furniture ?? null);
    const result = { ok: true, kind: 'home_' + kind, viewer: viewerOf(access.actor), homeKey: access.deed.name_lc,
      authorityToken: access.deed.home_authority_token, revision, effect: effect.result || {}, message: effect.message || 'Home updated.' };
    await completeReceipt(client, receipt, result); return result;
  });
}
export function activateHome(pool, accountId, body, receipt) {
  return mutateHome(pool, accountId, 'activate', body, receipt, async (client, access) => {
    if (access.room) fail('home_already_active', 'Your home is already open.');
    if (!access.deed.home_authority_token) {
      const token = crypto.randomUUID();
      registerItemTransactionUndo(client, () => client.query('UPDATE street_deeds SET home_authority_token=NULL WHERE name_lc=$1 AND home_authority_token=$2', [body.homeKey, token]));
      await client.query('UPDATE street_deeds SET home_authority_token=$2 WHERE name_lc=$1', [body.homeKey, token]);
      access.deed.home_authority_token = token;
    }
    registerItemTransactionUndo(client, () => client.query('DELETE FROM city_home_rooms WHERE home_key=$1 AND authority_token=$2', [body.homeKey, access.deed.home_authority_token]));
    await client.query(`INSERT INTO city_home_rooms(home_key,authority_token,owner_account_id) VALUES($1,$2,$3)`,
      [body.homeKey, access.deed.home_authority_token, accountId]);
    return { message: 'Your home is open. Store durable items, use your workbench, or invite a visitor.' };
  }, { owner: true });
}
export function updateHomeLayout(pool, accountId, body, receipt) {
  return mutateHome(pool, accountId, 'layout', body, receipt, async (client, access) => {
    if (body.expectedLayoutRevision !== Number(access.room.layout_revision)) fail('home_layout_changed', 'The furnishings changed. Refresh this room and review your draft before saving.');
    await closeActivities(client, access.deed, 'layout_changed');
    return { furniture: validateCityRoom(body.room).furniture, message: 'Home furnishings saved.' };
  }, { owner: true });
}
async function grantRow(client, id, lock = false) {
  return (lock
    ? await client.query('SELECT * FROM city_home_visitors WHERE id=$1 FOR UPDATE', [id])
    : await client.query('SELECT * FROM city_home_visitors WHERE id=$1', [id])).rows[0];
}
function restoreGrant(client, row) {
  registerItemTransactionUndo(client, () => client.query(`UPDATE city_home_visitors SET status=$2,accepted_at=$3,revoked_at=$4 WHERE id=$1`,
    [row.id, row.status, row.accepted_at, row.revoked_at]));
}
export function inviteHomeVisitor(pool, accountId, body, receipt) {
  return mutateHome(pool, accountId, 'invite', body, receipt, async (client, access) => {
    const rows = (await client.query(`SELECT id,expires_at,guest_character_id FROM city_home_visitors WHERE home_key=$1 AND authority_token=$2
      AND status IN ('invited','active')`, [body.homeKey, body.authorityToken])).rows;
    if (rows.filter(row => new Date(row.expires_at).getTime() > Date.now()).length >= HOME_VISITOR_CAPACITY) fail('home_full', 'Revoke a visitor before inviting another.');
    if (rows.some(row => row.guest_character_id === access.target.id && new Date(row.expires_at).getTime() > Date.now())) {
      fail('home_already_invited', 'Revoke the previous invitation before changing this visitor permission.');
    }
    const id = crypto.randomUUID(), expiresAt = new Date(Date.now() + HOME_INVITATION_MS);
    registerItemTransactionUndo(client, () => client.query('DELETE FROM city_home_visitors WHERE id=$1', [id]));
    await client.query(`INSERT INTO city_home_visitors(id,home_key,authority_token,host_character_id,host_generation,
      guest_account_id,guest_character_id,guest_generation,rights_json,status,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'invited',$10)`, [id, body.homeKey, body.authorityToken, access.host.id,
      Number(access.host.generation), access.target.account_id, access.target.id, Number(access.target.generation), JSON.stringify(body.rights), expiresAt]);
    return { result: { grantId: id, expiresAt: expiresAt.toISOString() }, message: 'Invitation sent. The visitor must accept it.' };
  }, { owner: true, target: true });
}
// Acceptance is its own consent boundary: invited viewers cannot enter through homeAccess yet.
export async function acceptHomeVisitor(pool, accountId, body, receipt) {
  validateHomeBody('accept', body); requireReceipt(accountId, receipt);
  return withItemTransaction(pool, async client => {
    const before = await grantRow(client, body.grantId);
    if (!before || before.guest_account_id !== accountId) fail();
    const initial = (await client.query('SELECT * FROM street_deeds WHERE name_lc=$1', [body.homeKey])).rows[0];
    if (external(initial)) fail();
    let actor = await latestActor(client, accountId), host = await latestActor(client, initial.account_id);
    const locked = await lockActors(client, [actor, host]);
    actor = locked.get(actor.id); host = locked.get(host.id); current(actor, body);
    const deed = (await client.query('SELECT * FROM street_deeds WHERE name_lc=$1 FOR UPDATE', [body.homeKey])).rows[0];
    if (external(deed) || deed.account_id !== initial.account_id || deed.home_authority_token !== body.authorityToken
      || actor.loc !== deed.district || host.loc !== deed.district) fail();
    const room = (await client.query('SELECT * FROM city_home_rooms WHERE home_key=$1 AND authority_token=$2 FOR UPDATE', [body.homeKey, body.authorityToken])).rows[0];
    const grant = await grantRow(client, body.grantId, true);
    if (!room || !grant || grant.guest_account_id !== accountId || grant.status !== 'invited' || grant.home_key !== body.homeKey || grant.authority_token !== body.authorityToken
      || grant.guest_character_id !== actor.id || Number(grant.guest_generation) !== Number(actor.generation)
      || grant.host_character_id !== host.id || Number(grant.host_generation) !== Number(host.generation)
      || new Date(grant.expires_at).getTime() <= Date.now()) fail();
    restoreGrant(client, grant);
    await client.query("UPDATE city_home_visitors SET status='active',accepted_at=now() WHERE id=$1", [grant.id]);
    const result = { ok: true, kind: 'home_accept', viewer: viewerOf(actor), homeKey: body.homeKey, authorityToken: body.authorityToken,
      revision: await advanceRoom(client, room), effect: { grantId: grant.id }, message: 'Invitation accepted. You can visit this home while its host is here.' };
    await completeReceipt(client, receipt, result); return result;
  });
}
export function revokeHomeVisitor(pool, accountId, body, receipt) {
  return mutateHome(pool, accountId, 'revoke', body, receipt, async (client, access) => {
    const grant = await grantRow(client, body.grantId, true);
    if (!grant || grant.home_key !== body.homeKey || grant.authority_token !== body.authorityToken) fail();
    restoreGrant(client, grant);
    await client.query("UPDATE city_home_visitors SET status='revoked',revoked_at=now() WHERE id=$1", [grant.id]);
    await withdrawActivityConsent(client, grant);
    return { result: { grantId: grant.id }, message: 'Visitor permission revoked.' };
  }, { owner: true });
}
export async function leaveHomeVisitor(pool, accountId, body, receipt) {
  validateHomeBody('leave', body); requireReceipt(accountId, receipt);
  return withItemTransaction(pool, async client => {
    let actor = await latestActor(client, accountId); actor = (await lockActors(client, [actor])).get(actor.id); current(actor, body);
    const grant = await grantRow(client, body.grantId, true);
    if (!grant || grant.guest_account_id !== accountId || grant.guest_character_id !== actor.id || Number(grant.guest_generation) !== Number(actor.generation)) fail();
    restoreGrant(client, grant);
    await client.query("UPDATE city_home_visitors SET status='revoked',revoked_at=now() WHERE id=$1", [grant.id]);
    await withdrawActivityConsent(client, grant);
    const result = { ok: true, kind: 'home_leave', viewer: viewerOf(actor), homeKey: grant.home_key, authorityToken: grant.authority_token,
      effect: { grantId: grant.id }, message: 'Your visitor consent is withdrawn.' };
    await completeReceipt(client, receipt, result); return result;
  });
}
export function storeHomeItem(pool, accountId, body, receipt, craftingContext = DEFAULT_CRAFTING_CONTEXT) {
  return mutateHome(pool, accountId, 'store', body, receipt, async (client, access) => {
    const item = (await client.query("SELECT template_id FROM item_instances WHERE id=$1 AND owner_scope='account' AND owner_id=$2 AND state='active' AND definition_hash IS NULL", [body.itemId, accountId])).rows[0];
    if (!item || nodeOf(craftingContext.registry, item.template_id)?.type !== 'item_template') fail('item_unavailable');
    const count = Number((await client.query('SELECT COUNT(*) n FROM city_home_storage_items WHERE home_key=$1 AND authority_token=$2', [body.homeKey, body.authorityToken])).rows[0].n);
    if (count >= HOME_STORAGE_CAPACITY) fail('home_storage_full', 'Withdraw an item before storing another.');
    const stored = await storeItem(client, { scope: 'account', id: accountId }, body.itemId, location(access.deed), 'stored at home', innerKey(receipt));
    return { result: { itemId: stored.id, state: stored.state }, message: 'Item stored in your home.' };
  }, { owner: true });
}
export function retrieveHomeItem(pool, accountId, body, receipt) {
  return mutateHome(pool, accountId, 'retrieve', body, receipt, async (client, access) => {
    const item = await retrieveStoredItem(client, { scope: 'account', id: accountId }, body.itemId, location(access.deed), 'withdrawn at home', innerKey(receipt));
    return { result: { itemId: item.id, state: item.state }, message: 'Item returned to your Bag.' };
  }, { owner: true });
}
export function craftAtHome(pool, accountId, body, receipt, craftingContext = DEFAULT_CRAFTING_CONTEXT) {
  return mutateHome(pool, accountId, 'craft', body, receipt, async (client, access) => {
    if (!access.rights.includes('workbench')) fail();
    const result = await craftWorldGraphRecipe(client, { accountId, expectedCharacterId: access.actor.id }, body.recipeId, innerKey(receipt), craftingContext);
    return { result: { recipeId: result.recipe.recipeId }, message: 'Crafted with your own materials at the workbench.' };
  });
}
const itemDto = (item, registry) => ({ id: item.id, templateId: item.templateId, state: item.state,
  title: nodeOf(registry, item.templateId)?.metadata?.title || item.templateId });
const recipeEntry = (entry, registry) => ({ kind: entry.assetType || (nodeOf(registry, entry.templateId)?.type === 'material' ? 'material' : 'item'),
  ...(entry.templateId ? { templateId: entry.templateId, title: nodeOf(registry, entry.templateId)?.metadata?.title || entry.templateId } : {}),
  quantity: Number(entry.quantity), ...(entry.quality ? { quality: entry.quality } : {}) });
function workbenchRecipe(recipe, registry, body) {
  const blockedBy = (recipe.blockedBy || []).map(blocker => ({ code: 'recipe_' + (blocker.adapter || 'unavailable') }));
  if (recipe.available !== true && !blockedBy.length) blockedBy.push({ code: 'recipe_unavailable' });
  if ((recipe.inputs || []).some(entry => entry.assetType)) blockedBy.push({ code: 'salvage_required' });
  return { id: recipe.id, title: recipe.title, available: blockedBy.length === 0,
    cashCost: Number.isFinite(recipe.cashCost) ? recipe.cashCost : null,
    inputs: (recipe.inputs || []).map(entry => recipeEntry(entry, registry)), outputs: (recipe.outputs || []).map(entry => recipeEntry(entry, registry)),
    blockedBy, action: action('craft:' + recipe.id, 'Craft', path('workbench/craft'), { ...body, recipeId: recipe.id }, blockedBy) };
}
export async function homeInteriorBoard(pool, accountId, query, craftingContext = DEFAULT_CRAFTING_CONTEXT) {
  const key = validateHomeQuery(query);
  return withItemRead(pool, async client => {
    const access = await homeAccess(client, accountId, key), body = baseBody(access), actions = [];
    let storage = null, visitors = [];
    if (access.owner && !access.room) actions.push(action('activate', 'Open your home', path('activate'), body));
    if (!access.owner) actions.push(action('leave', 'Leave this home', path('visitors/leave'),
      { ...viewerOf(access.actor), grantId: access.permission.id }));
    if (access.owner && access.room) {
      const inventory = await inventoryBoard(client, { scope: 'account', id: accountId });
      const stored = inventory.items.filter(item => item.state === 'stored' && item.storage?.homeKey === key && item.storage.authorityToken === body.authorityToken);
      const available = inventory.items.filter(item => item.state === 'active' && nodeOf(craftingContext.registry, item.templateId)?.type === 'item_template').slice(0, 64);
      storage = { capacity: HOME_STORAGE_CAPACITY, items: stored.map(item => ({ ...itemDto(item, craftingContext.registry),
        action: action('retrieve:' + item.id, 'Withdraw', path('storage/retrieve'), { ...body, itemId: item.id }) })),
      availableItems: available.map(item => ({ ...itemDto(item, craftingContext.registry), action: action('store:' + item.id, 'Store', path('storage/store'),
        { ...body, itemId: item.id }, stored.length >= HOME_STORAGE_CAPACITY ? [{ code: 'home_storage_full' }] : []) })) };
      const grants = (await client.query('SELECT * FROM city_home_visitors WHERE home_key=$1 AND authority_token=$2 ORDER BY created_at DESC,id LIMIT 32', [key, body.authorityToken])).rows;
      for (const grant of grants) {
        const guest = (await client.query('SELECT name FROM characters WHERE id=$1', [grant.guest_character_id])).rows[0];
        visitors.push({ id: grant.id, name: guest?.name || 'Visitor', characterId: grant.guest_character_id,
          status: new Date(grant.expires_at).getTime() <= Date.now() ? 'expired' : grant.status, rights: decode(grant.rights_json),
          expiresAt: new Date(grant.expires_at).toISOString(), action: action('revoke:' + grant.id, 'Revoke', path('visitors/revoke'), { ...body, grantId: grant.id }) });
      }
      actions.push(action('layout', 'Save home furnishings', path('layout'), { ...body, expectedLayoutRevision: Number(access.room.layout_revision) }, [], ['room']));
      actions.push(action('invite', 'Invite visitor', path('visitors/invite'), { ...body, rights: ['visit'] }, [], ['targetCharacterId', 'rights']));
    }
    const recipes = access.room && access.rights.includes('workbench') ? await homeRecipeCatalogForPlayer(client, accountId, craftingContext) : [];
    return { viewer: viewerOf(access.actor), home: { key, street: access.deed.name, districtId: access.deed.district,
      authorityToken: body.authorityToken, revision: Number(access.room?.revision || 0), layoutRevision: Number(access.room?.layout_revision || 0),
      host: { characterId: access.host.id, generation: Number(access.host.generation), name: access.host.name } }, access: { role: access.owner ? 'owner' : 'visitor', rights: access.rights },
    room: { active: !!access.room, furniture: access.room ? decode(access.room.layout_json) : [], catalog: CITY_FURNITURE, size: HOME_ROOM_SIZE },
    storage, visitors, workbench: { recipes: recipes.map(recipe => workbenchRecipe(recipe, craftingContext.registry, body)) }, actions,
    activity: await activityBoard(client, access) };
  });
}
export async function homeInvitations(pool, accountId) {
  return withItemRead(pool, async client => {
    const actor = await latestActor(client, accountId); await checkAccount(client, actor);
    const rows = (await client.query(`SELECT * FROM city_home_visitors WHERE guest_account_id=$1 AND guest_character_id=$2
      AND guest_generation=$3 AND status IN ('invited','active') ORDER BY created_at DESC,id LIMIT 32`, [accountId, actor.id, Number(actor.generation)])).rows;
    const invitations = [], permissions = [];
    for (const row of rows) {
      const expiresAt = new Date(row.expires_at).toISOString(), expired = new Date(row.expires_at).getTime() <= Date.now();
      permissions.push({ id: row.id, homeKey: row.home_key, rights: decode(row.rights_json), status: expired ? 'expired' : row.status,
        expiresAt, action: action('leave:' + row.id, 'Withdraw visitor consent', path('visitors/leave'), { ...viewerOf(actor), grantId: row.id }) });
      if (expired || row.status !== 'invited') continue;
      const deed = (await client.query('SELECT * FROM street_deeds WHERE name_lc=$1', [row.home_key])).rows[0];
      if (external(deed) || deed.home_authority_token !== row.authority_token || actor.loc !== deed.district) continue;
      const host = (await client.query(`SELECT id,name,generation,loc FROM characters WHERE account_id=$1 AND alive
        ORDER BY created_at DESC,id LIMIT 1`, [deed.account_id])).rows[0];
      if (!host) continue;
      if (host.id !== row.host_character_id || Number(host.generation) !== Number(row.host_generation) || host.loc !== deed.district) continue;
      invitations.push({ id: row.id, homeKey: row.home_key, street: deed.name, host: { characterId: host.id, name: host.name },
        rights: decode(row.rights_json), expiresAt: new Date(row.expires_at).toISOString(), action: action('accept:' + row.id, 'Accept invitation', path('visitors/accept'),
          { ...viewerOf(actor), homeKey: row.home_key, authorityToken: row.authority_token, grantId: row.id }) });
    }
    return { viewer: viewerOf(actor), invitations, permissions };
  });
}
async function archivedStorage(client, accountId, itemId = null) {
  const rows = (await client.query('SELECT * FROM city_home_storage_items WHERE owner_scope=\'account\' AND owner_id=$1' + (itemId ? ' AND item_id=$2' : ''), itemId ? [accountId, itemId] : [accountId])).rows;
  const archived = [];
  for (const row of rows) {
    const deed = (await client.query('SELECT * FROM street_deeds WHERE name_lc=$1', [row.home_key])).rows[0];
    if (external(deed) || deed.account_id !== accountId || deed.home_authority_token !== row.authority_token) archived.push(row);
  }
  return archived;
}
export async function homeRecoveryBoard(pool, accountId) {
  return withItemRead(pool, async client => {
    const actor = await latestActor(client, accountId); await checkAccount(client, actor);
    const entries = await archivedStorage(client, accountId), items = [];
    for (const row of entries.slice(0, 64)) {
      const item = (await client.query("SELECT id,template_id FROM item_instances WHERE id=$1 AND owner_scope='account' AND owner_id=$2 AND state='stored' AND definition_hash IS NULL", [row.item_id, accountId])).rows[0];
      if (item) items.push({ id: item.id, templateId: item.template_id, homeKey: row.home_key,
        action: action('recover:' + item.id, 'Recover your stored item', path('storage/recover'), { ...viewerOf(actor), itemId: item.id }) });
    }
    return { viewer: viewerOf(actor), items };
  });
}
export async function recoverArchivedHomeItem(pool, accountId, body, receipt) {
  validateHomeBody('recover', body); requireReceipt(accountId, receipt);
  return withItemTransaction(pool, async client => {
    let actor = await latestActor(client, accountId); actor = (await lockActors(client, [actor])).get(actor.id); current(actor, body);
    const before = (await client.query("SELECT * FROM city_home_storage_items WHERE item_id=$1 AND owner_scope='account' AND owner_id=$2", [body.itemId, accountId])).rows[0];
    if (!before) fail('item_unavailable');
    // Keep the same characters→deed→item order as purchase and ordinary home actions.
    await client.query('SELECT name_lc FROM street_deeds WHERE name_lc=$1 FOR UPDATE', [before.home_key]);
    const archived = (await archivedStorage(client, accountId, body.itemId))[0];
    if (!archived) fail('home_storage_current', 'Withdraw this item at your current home.');
    const item = await retrieveStoredItem(client, { scope: 'account', id: accountId }, body.itemId,
      { homeKey: archived.home_key, authorityToken: archived.authority_token }, 'recovered after ownership change', innerKey(receipt));
    const result = { ok: true, kind: 'home_recover', viewer: viewerOf(actor), homeKey: archived.home_key, authorityToken: archived.authority_token,
      effect: { itemId: item.id, state: item.state }, message: 'Your item returned to your Bag. This grants no access to its former home.' };
    await completeReceipt(client, receipt, result); return result;
  });
}

function puzzleOf(id) { const puzzle = HOME_PUZZLES.find(entry => entry.id === id); if (!puzzle) fail('home_activity_unavailable'); return puzzle; }
const cellKey = cell => `${cell.id}:${cell.x}:${cell.y}`;
function puzzleCells(puzzle, furniture) {
  return puzzle.sequence.map(id => furniture.filter(cell => cell.id === id).sort((a, b) => (a.y * 6 + a.x) - (b.y * 6 + b.x))[0]);
}
function restoreActivity(client, row) {
  registerItemTransactionUndo(client, () => client.query('UPDATE city_home_activities SET status=$2,close_reason=$3,closed_at=$4 WHERE id=$1',
    [row.id, row.status, row.close_reason, row.closed_at]));
}
function restoreMember(client, row) {
  registerItemTransactionUndo(client, () => client.query(`UPDATE city_home_activity_members
    SET step=$3,status=$4,left_at=$5,solved_at=$6,outcome_json=$7 WHERE activity_id=$1 AND account_id=$2`,
    [row.activity_id,row.account_id,Number(row.step),row.status,row.left_at,row.solved_at,row.outcome_json]));
}
async function closeActivities(client, deed, reason) {
  const rows = (await client.query("SELECT * FROM city_home_activities WHERE home_key=$1 AND authority_token=$2 AND status='open' FOR UPDATE",
    [deed.name_lc, deed.home_authority_token])).rows;
  for (const row of rows) {
    restoreActivity(client, row);
    await client.query("UPDATE city_home_activities SET status='closed',close_reason=$2,closed_at=now() WHERE id=$1", [row.id, reason]);
  }
}
async function withdrawActivityConsent(client, grant) {
  const activities = (await client.query("SELECT id FROM city_home_activities WHERE home_key=$1 AND authority_token=$2 AND status='open'", [grant.home_key,grant.authority_token])).rows;
  for (const activity of activities) {
    const members = (await client.query(`SELECT * FROM city_home_activity_members WHERE activity_id=$1 AND character_id=$2 AND generation=$3
      AND status IN ('active','solved') FOR UPDATE`, [activity.id,grant.guest_character_id,Number(grant.guest_generation)])).rows;
    for (const member of members) {
      restoreMember(client, member);
      await client.query("UPDATE city_home_activity_members SET status='left',left_at=now() WHERE activity_id=$1 AND account_id=$2", [activity.id,member.account_id]);
    }
  }
}
async function lockedActivity(client, access, id) {
  const row = (await client.query('SELECT * FROM city_home_activities WHERE id=$1 FOR UPDATE', [id])).rows[0];
  if (!row || row.status !== 'open' || row.home_key !== access.deed.name_lc || row.authority_token !== access.deed.home_authority_token
    || row.host_account_id !== access.deed.account_id || row.host_character_id !== access.host.id || Number(row.host_generation) !== Number(access.host.generation)
    || Number(row.layout_revision) !== Number(access.room.layout_revision)) fail('home_activity_unavailable', 'That activity ended. Refresh your home view.');
  return row;
}
export function openHomeActivity(pool, accountId, body, receipt) {
  return mutateHome(pool, accountId, 'activity_open', body, receipt, async (client, access) => {
    const puzzle = puzzleOf(body.puzzleId), furniture = validateCityRoom({ furniture: decode(access.room.layout_json) }).furniture;
    if (puzzleCells(puzzle, furniture).some(cell => !cell)) fail('home_puzzle_furnishings', 'Place this puzzle’s required furnishings first.');
    if ((await client.query("SELECT id FROM city_home_activities WHERE home_key=$1 AND authority_token=$2 AND status='open'", [body.homeKey,body.authorityToken])).rows.length) fail('home_activity_open', 'Close your current activity before opening another.');
    const id = crypto.randomUUID();
    registerItemTransactionUndo(client, () => client.query('DELETE FROM city_home_activities WHERE id=$1', [id]));
    await client.query(`INSERT INTO city_home_activities(id,home_key,authority_token,host_account_id,host_character_id,host_generation,puzzle_id,layout_revision,layout_json,status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'open')`, [id,body.homeKey,body.authorityToken,accountId,access.host.id,Number(access.host.generation),puzzle.id,Number(access.room.layout_revision),JSON.stringify(furniture)]);
    return { result: { activityId: id,puzzleId: puzzle.id }, message: 'Puzzle opened. Visitors join only when they choose to.' };
  }, { owner: true });
}
export function joinHomeActivity(pool, accountId, body, receipt) {
  return mutateHome(pool, accountId, 'activity_join', body, receipt, async (client, access) => {
    const activity = await lockedActivity(client, access, body.activityId);
    const existing = (await client.query('SELECT * FROM city_home_activity_members WHERE activity_id=$1 AND account_id=$2 FOR UPDATE', [activity.id,accountId])).rows[0];
    if (existing) fail('home_activity_joined', 'This participation is already recorded. Leave is final for this activity.');
    const members = (await client.query("SELECT account_id FROM city_home_activity_members WHERE activity_id=$1 AND status IN ('active','solved')", [activity.id])).rows;
    if (puzzleOf(activity.puzzle_id).cooperative && !access.owner && members.some(member => member.account_id !== access.deed.account_id)) {
      fail('home_activity_full', 'This puzzle pairs the host with one consenting guest.');
    }
    if (members.length >= HOME_ACTIVITY_CAPACITY) fail('home_activity_full', 'This puzzle has four participants already.');
    registerItemTransactionUndo(client, () => client.query('DELETE FROM city_home_activity_members WHERE activity_id=$1 AND account_id=$2', [activity.id,accountId]));
    await client.query(`INSERT INTO city_home_activity_members(activity_id,account_id,character_id,generation,name_snapshot,step,status)
      VALUES($1,$2,$3,$4,$5,0,'active')`, [activity.id,accountId,access.actor.id,Number(access.actor.generation),access.actor.name]);
    return { result: { activityId: activity.id,puzzleId: activity.puzzle_id,step: 0,complete: false }, message: 'You joined the puzzle. Your chosen name appears in this home’s participant list.' };
  });
}
export function answerHomeActivity(pool, accountId, body, receipt) {
  return mutateHome(pool, accountId, 'activity_answer', body, receipt, async (client, access) => {
    const activity = await lockedActivity(client, access, body.activityId), puzzle = puzzleOf(activity.puzzle_id);
    const member = (await client.query('SELECT * FROM city_home_activity_members WHERE activity_id=$1 AND account_id=$2 FOR UPDATE', [activity.id,accountId])).rows[0];
    if (!member || member.status !== 'active' || member.character_id !== access.actor.id || Number(member.generation) !== Number(access.actor.generation)) fail('home_activity_unavailable');
    if (puzzle.cooperative) return answerCooperativeHome(client, access, activity, member, puzzle, body);
    const expected = puzzleCells(puzzle, decode(activity.layout_json))[Number(member.step)];
    if (!expected || body.cellKey !== cellKey(expected)) fail('home_puzzle_clue', 'That furnishing is out of order. Follow your current clue.');
    const step = Number(member.step) + 1, complete = step === 3;
    const solvedAt = complete ? new Date() : null, outcome = complete ? { puzzleId: puzzle.id,solvedAt: solvedAt.toISOString() } : null;
    restoreMember(client, member);
    await client.query(`UPDATE city_home_activity_members SET step=$3,status=$4,solved_at=$5,outcome_json=$6
      WHERE activity_id=$1 AND account_id=$2`, [activity.id,accountId,step,complete ? 'solved' : 'active',solvedAt,outcome ? JSON.stringify(outcome) : null]);
    return { result: { activityId: activity.id,puzzleId: puzzle.id,step,complete,...(outcome ? { outcome } : {}) }, message: complete ? 'Puzzle complete. Your outcome is saved.' : 'Clue confirmed. Continue with the next furnishing.' };
  });
}
// Only the new two-voices definition uses shared stages. The original three solo definitions
// retain their immutable per-participant sequence, receipts and outcome history.
async function cooperativeParty(client, access, activity) {
  const recorded = (await client.query("SELECT * FROM city_home_activity_members WHERE activity_id=$1 AND status IN ('active','solved') ORDER BY consent_at,account_id LIMIT 4", [activity.id])).rows;
  const valid = [];
  for (const member of recorded) {
    try {
      const peer = await homeAccess(client, member.account_id, access.deed.name_lc);
      if (peer.actor.id === member.character_id && Number(peer.actor.generation) === Number(member.generation)
        && peer.deed.home_authority_token === activity.authority_token) valid.push(member);
    } catch (error) { if (!(error instanceof GameError)) throw error; }
  }
  return valid.length === 2 && valid.some(member => member.account_id === activity.host_account_id) ? valid : [];
}
async function answerCooperativeHome(client, access, activity, member, puzzle, body) {
  const party = await cooperativeParty(client, access, activity);
  if (party.length !== 2 || party.some(peer => peer.status !== 'active')) fail('home_puzzle_partner', 'The host and one consenting guest must both be here.');
  if (party.some(peer => !access.lockedActorIds?.has(peer.character_id))) fail('contention', 'The room party changed. Refresh before continuing.');
  const stage = party.reduce((sum, peer) => sum + Number(peer.step), 0);
  if ((stage === 1) === access.owner) fail('home_puzzle_turn', 'It is your partner’s turn. Share your private clue.');
  const expected = puzzleCells(puzzle, decode(activity.layout_json))[stage];
  if (!expected || body.cellKey !== cellKey(expected)) fail('home_puzzle_clue', 'That furnishing does not match your partner’s clue.');
  const complete = stage === 2, solvedAt = complete ? new Date() : null;
  const outcome = complete ? { puzzleId: puzzle.id, solvedAt: solvedAt.toISOString() } : null;
  for (const peer of complete ? party : [member]) {
    restoreMember(client, peer);
    await client.query(`UPDATE city_home_activity_members SET step=$3,status=$4,solved_at=$5,outcome_json=$6
      WHERE activity_id=$1 AND account_id=$2`, [activity.id,peer.account_id,complete ? 3 : Number(peer.step) + 1,
      complete ? 'solved' : 'active',solvedAt,outcome ? JSON.stringify(outcome) : null]);
  }
  return { result: { activityId: activity.id,puzzleId: puzzle.id,step: complete ? 3 : Number(member.step) + 1,complete,...(outcome ? { outcome } : {}) },
    message: complete ? 'Together you solved the room. Both private histories are confirmed.' : 'Furnishing confirmed. Your partner now has the next move.' };
}
export function closeHomeActivity(pool, accountId, body, receipt) {
  return mutateHome(pool, accountId, 'activity_close', body, receipt, async (client, access) => {
    const activity = await lockedActivity(client, access, body.activityId);
    await closeActivities(client, access.deed, 'host_closed');
    return { result: { activityId: activity.id,puzzleId: activity.puzzle_id }, message: 'Activity closed. Confirmed outcomes remain in each participant’s history.' };
  }, { owner: true });
}
export async function leaveHomeActivity(pool, accountId, body, receipt) {
  validateHomeBody('activity_leave', body); requireReceipt(accountId, receipt);
  return withItemTransaction(pool, async client => {
    let actor = await latestActor(client, accountId); actor = (await lockActors(client, [actor])).get(actor.id); current(actor, body);
    const activity = (await client.query('SELECT * FROM city_home_activities WHERE id=$1 FOR UPDATE', [body.activityId])).rows[0];
    const member = (await client.query('SELECT * FROM city_home_activity_members WHERE activity_id=$1 AND account_id=$2 FOR UPDATE', [body.activityId,accountId])).rows[0];
    if (!activity || !member || member.character_id !== actor.id || Number(member.generation) !== Number(actor.generation)) fail('home_activity_unavailable');
    restoreMember(client, member);
    await client.query("UPDATE city_home_activity_members SET status='left',left_at=now() WHERE activity_id=$1 AND account_id=$2", [activity.id,accountId]);
    const result = { ok: true,kind: 'home_activity_leave',viewer: viewerOf(actor),homeKey: activity.home_key,authorityToken: activity.authority_token,
      effect: { activityId: activity.id,puzzleId: activity.puzzle_id },message: 'You left this activity. Your confirmed outcome stays private in your history.' };
    await completeReceipt(client, receipt, result); return result;
  });
}
async function activityBoard(client, access) {
  const body = baseBody(access), furniture = access.room ? decode(access.room.layout_json) : [];
  const row = access.room ? (await client.query("SELECT * FROM city_home_activities WHERE home_key=$1 AND authority_token=$2 AND status='open'",
    [body.homeKey,body.authorityToken])).rows[0] : null;
  const valid = row && row.host_character_id === access.host.id && Number(row.host_generation) === Number(access.host.generation)
    && row.host_account_id === access.deed.account_id && Number(row.layout_revision) === Number(access.room.layout_revision);
  const catalog = HOME_PUZZLES.map(puzzle => ({ id: puzzle.id,title: puzzle.title,requires: [...puzzle.sequence],
    action: access.owner ? action('puzzle:' + puzzle.id, 'Open puzzle', path('activity/open'), { ...body,puzzleId: puzzle.id },
      !access.room ? [{ code: 'home_not_active' }] : valid ? [{ code: 'home_activity_open' }] : puzzleCells(puzzle,furniture).some(cell => !cell) ? [{ code: 'home_puzzle_furnishings' }] : []) : null }));
  if (row && !valid) fail('item_integrity_error');
  if (!valid) return { catalog,active: null };
  const puzzle = puzzleOf(row.puzzle_id), members = (await client.query("SELECT * FROM city_home_activity_members WHERE activity_id=$1 AND status IN ('active','solved') ORDER BY consent_at,account_id LIMIT 4", [row.id])).rows;
  const recorded = (await client.query('SELECT * FROM city_home_activity_members WHERE activity_id=$1 AND account_id=$2', [row.id,access.actor.account_id])).rows[0];
  const member = recorded?.character_id === access.actor.id && Number(recorded.generation) === Number(access.actor.generation) ? recorded : null;
  const roster = [];
  for (const entry of members.filter(entry => entry.status !== 'left')) {
    const actor = (await client.query('SELECT alive,generation FROM characters WHERE id=$1', [entry.character_id])).rows[0];
    if (actor?.alive && Number(actor.generation) === Number(entry.generation)) roster.push({ name: entry.name_snapshot });
  }
  const party = puzzle.cooperative ? await cooperativeParty(client, access, row) : [];
  const stage = party.reduce((sum, peer) => sum + Number(peer.step), 0);
  const partnerReady = !puzzle.cooperative || party.length === 2;
  const turn = !puzzle.cooperative || partnerReady && ((stage === 1) !== access.owner);
  const actions = [];
  if (access.owner) actions.push(action('activity-close', 'Close activity', path('activity/close'), { ...body,activityId: row.id }));
  if (!member) actions.push(action('activity-join', 'Join puzzle', path('activity/join'), { ...body,activityId: row.id },
    recorded ? [{ code: 'home_activity_joined' }] : members.filter(entry => entry.status !== 'left').length >= HOME_ACTIVITY_CAPACITY
      || puzzle.cooperative && !access.owner && members.some(entry => entry.account_id !== row.host_account_id) ? [{ code: 'home_activity_full' }] : [], ['consent']));
  else if (member.status !== 'left') actions.push(action('activity-leave', 'Leave activity', path('activity/leave'), { ...viewerOf(access.actor),activityId: row.id }));
  const clue = puzzle.cooperative ? !partnerReady ? 'Waiting for the host and one consenting guest to join in this district.'
    : turn ? 'Your move: ask your partner for their private clue, then inspect a furnishing.' : puzzle.clues[stage] : puzzle.clues[Number(member?.step)];
  const self = member ? { status: member.status,step: Number(member.step),clue: member.status === 'active' ? clue : null,
    outcome: member.outcome_json ? decode(member.outcome_json) : null } : null;
  const cells = decode(row.layout_json).map(cell => ({ key: cellKey(cell),furnishingId: cell.id,
    label: (CITY_FURNITURE.find(entry => entry.id === cell.id)?.name || cell.id) + `, row ${cell.y + 1}, column ${cell.x + 1}`,
    action: member?.status === 'active' ? action('clue:' + cellKey(cell), 'Inspect furnishing', path('activity/answer'), { ...body,activityId: row.id,cellKey: cellKey(cell) },
      !partnerReady ? [{ code: 'home_puzzle_partner' }] : !turn ? [{ code: 'home_puzzle_turn' }] : []) : null }));
  return { catalog,active: { id: row.id,puzzleId: puzzle.id,title: puzzle.title,layoutRevision: Number(row.layout_revision),capacity: puzzle.cooperative ? 2 : HOME_ACTIVITY_CAPACITY,roster,self,cells,actions } };
}
export async function homeActivityHistory(pool, accountId) {
  return withItemRead(pool, async client => {
    const actor = await latestActor(client, accountId); await checkAccount(client, actor);
    const rows = (await client.query(`SELECT activity_id,character_id,generation,outcome_json FROM city_home_activity_members
      WHERE account_id=$1 AND outcome_json IS NOT NULL ORDER BY solved_at DESC,activity_id LIMIT 16`, [accountId])).rows;
    return { viewer: viewerOf(actor),outcomes: rows.map(row => { const outcome = decode(row.outcome_json); return { activityId: row.activity_id,
      characterId: row.character_id,generation: Number(row.generation),title: puzzleOf(outcome.puzzleId).title,outcome }; }) };
  });
}
