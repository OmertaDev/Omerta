// Actual private home API and canonical custody/lifecycle; --postgres owns a disposable loopback schema.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const postgres = process.argv.includes('--postgres');
let app, admin, namespace, createdSchema = false;
function nativeEndpoint(value) {
  assert.equal(typeof value, 'string', 'Set CITY_HOME_INTERIORS_TEST_DATABASE_URL to a disposable loopback test database.');
  const endpoint = new URL(value);
  assert(!endpoint.search && !endpoint.hash, 'Fixture URLs cannot override driver host or connection options');
  assert(['postgres:', 'postgresql:'].includes(endpoint.protocol));
  assert(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname));
  assert(/^\/(?:omerta_query|omerta_check|city_homes_[a-z0-9_]+)$/.test(endpoint.pathname));
  return endpoint;
}
async function withPoolQueryFault(pool, afterQuery, work) {
  const originalConnect = pool.connect;
  const instrument = client => new Proxy(client, { get(target, property) {
    if (property === 'query') return (...args) => {
      const callback = args.at(-1);
      if (typeof callback === 'function') {
        const queryArgs = args.slice(0,-1);
        return target.query(...queryArgs,(error,result) => {
          if (error) { callback(error,result); return; }
          let fault;
          try { afterQuery(queryArgs,result); } catch (error) { fault = error; }
          callback(fault || null,fault ? undefined : result);
        });
      }
      return target.query(...args).then(result => { afterQuery(args,result); return result; });
    };
    const value = Reflect.get(target,property,target);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  pool.connect = (...args) => {
    if (typeof args[0] === 'function') {
      const callback = args[0];
      return originalConnect.call(pool,(error,client,release) => callback(error,error ? client : instrument(client),release),...args.slice(1));
    }
    return originalConnect.apply(pool,args).then(instrument);
  };
  try { return await work(); } finally { pool.connect = originalConnect; }
}
for (const value of [undefined, 'https://127.0.0.1/omerta_query', 'postgresql://live.invalid/omerta_query', 'postgresql://127.0.0.1/postgres']) assert.throws(() => nativeEndpoint(value));
for (const name of ['JWT_SECRET', 'MOD_KEY', 'MARKET_SEED']) process.env[name] = crypto.randomBytes(32).toString('hex');
process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off'; process.env.SOCIAL_VERIFY_MODE = 'off'; process.env.POPULATION_OFF = 'on';
try {
  if (postgres) {
    const endpoint = nativeEndpoint(process.env.CITY_HOME_INTERIORS_TEST_DATABASE_URL);
    const { Pool } = await import('pg'); admin = new Pool({ connectionString: endpoint.toString() });
    namespace = 'city_homes_' + crypto.randomBytes(8).toString('hex');
    assert(/^city_homes_[a-f0-9]{16}$/.test(namespace));
    await admin.query(`CREATE SCHEMA ${namespace}`); createdSchema = true;
    endpoint.searchParams.set('options', `-c search_path=${namespace}`); process.env.DATABASE_URL = endpoint.toString();
  } else assert(!process.env.DATABASE_URL, 'Memory proof requires disposable pg-mem.');
  const { buildServer } = await import('../src/server.js');
  const { ledger, withTwoCharacters } = await import('../src/game.js');
  const { runEstate } = await import('../src/social/estate.js');
  const { retireResident } = await import('../src/population.js');
  const { createItem, grantStack, consumeItem, storeItem, escrowItem, releaseEscrow, withItemTransaction, withLotMutation, inventoryBoard } = await import('../src/items.js');
  const { runLedgerInvariants } = await import('../src/invariants.js');
  const { buyDeed } = await import('../src/deeds.js');
  app = await buildServer();
  const { default: Ajv } = await import('ajv'), { CITY_HOME_SCHEMAS } = await import('../src/city-home-contract.js');
  const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
  const definitions = JSON.parse(JSON.stringify(CITY_HOME_SCHEMAS).replaceAll('#/components/schemas/', '#/definitions/'));
  const validators = Object.fromEntries(['CityHomeInterior','CityHomeInvitations','CityHomeRecovery','CityHomeAck','CityHomeActivityHistory'].map(name => [name,
    ajv.compile({ ...definitions[name], definitions })]));
  const validate = (name, reply) => { if (reply.statusCode === 200) assert(validators[name](reply.json()), JSON.stringify(validators[name].errors)); return reply; };
  if (postgres) {
    const provenance = (await app.pool.query('SELECT current_schema() AS schema,version() AS version')).rows[0];
    assert.equal(provenance.schema, namespace); assert.match(provenance.version, /^PostgreSQL /);
    console.log('Home native fixture:', JSON.stringify(provenance));
  }
  const post = async (actor, url, payload, key = crypto.randomUUID()) => {
    const reply = await app.inject({ method: 'POST', url, payload, headers: { ...(actor?.headers || {}), 'idempotency-key': key } });
    return url.startsWith('/v1/city/home/') ? validate('CityHomeAck', reply) : reply;
  };
  const get = async (actor, url) => {
    const reply = await app.inject({ url, headers: actor?.headers || {} });
    const schema = url.startsWith('/v1/city/home/interior?') ? 'CityHomeInterior' : url === '/v1/city/home/invitations' ? 'CityHomeInvitations' : url === '/v1/city/home/recovery' ? 'CityHomeRecovery' : url === '/v1/city/home/activity-history' ? 'CityHomeActivityHistory' : null;
    return schema ? validate(schema, reply) : reply;
  };
  const privateHeaders = reply => { assert.equal(reply.headers['cache-control'], 'private, no-store'); assert.match(reply.headers.vary, /authorization/i); };
  const ok = reply => { assert.equal(reply.statusCode, 200, reply.body); return reply.json(); };
  const actor = async (name, agent = false) => {
    const guest = ok(await post(null, '/v1/auth/guest', { birthDate: '1990-01-01' })), token = guest.token;
    const account = app.jwt.verify(token).sub, headers = { authorization: 'Bearer ' + token };
    ok(await post({ headers }, '/v1/character', { name }));
    const row = (await app.pool.query('SELECT id,generation,cash FROM characters WHERE account_id=$1 AND alive', [account])).rows[0];
    await app.pool.query("UPDATE characters SET loc='foundry',cash=100000,respect=100000,last_accrued_at=$2 WHERE id=$1", [row.id, new Date(Date.now() + 86400000)]);
    await ledger(app.pool, { characterId: row.id, currency: 'cash', amount: 100000 - Number(row.cash), reason: 'crime:home-fixture' });
    if (agent) await app.pool.query('UPDATE account_persistent SET agent_flag=true WHERE account_id=$1', [account]);
    return { ...row, account, headers, name };
  };
  const owner = await actor('Home Owner'), guest = await actor('Home Guest', true), buyer = await actor('Home Buyer');
  const outsider = await actor('Home Outsider'), maker = await actor('Home Maker');
  const claim = async (who, name) => ok(await post(who, '/v1/deeds/claim', { name, district: 'foundry' }));
  await claim(owner, 'Functional Home'); await claim(maker, 'Working Home');
  const read = async (who = owner, key = 'functional home') => {
    const reply = await get(who, '/v1/city/home/interior?homeKey=' + encodeURIComponent(key)); privateHeaders(reply); return ok(reply);
  };
  const anchors = board => ({ ...board.viewer, homeKey: board.home.key, authorityToken: board.home.authorityToken });
  const owned = () => read();
  const currentViewer = async who => {
    const row = (await app.pool.query('SELECT id,generation,loc FROM characters WHERE account_id=$1 AND alive ORDER BY created_at DESC,id LIMIT 1', [who.account])).rows[0];
    return { characterId: row.id, generation: Number(row.generation), district: row.loc };
  };
  const homePost = async (who, suffix, fields = {}, key = crypto.randomUUID(), board = null) => {
    const current = board || await read(who);
    return post(who, '/v1/city/home/' + suffix, { ...anchors(current),
      ...(suffix === 'layout' ? { expectedLayoutRevision: current.home.layoutRevision } : {}), ...fields }, key);
  };
  const award = who => withItemTransaction(app.pool, client => createItem(client, { scope: 'account', id: who.account }, 'item:precision_lock_tool', 'awarded', crypto.randomUUID()));
  const snapshot = async () => ({
    characters: (await app.pool.query('SELECT id,alive,generation,loc,cash,bank,cb,ammo,health,energy,nerve,heat,respect FROM characters ORDER BY id')).rows,
    accounts: (await app.pool.query('SELECT account_id,omr,unbonding FROM account_persistent ORDER BY account_id')).rows,
    items: (await app.pool.query('SELECT * FROM item_instances ORDER BY id')).rows,
    stacks: (await app.pool.query('SELECT * FROM item_stacks ORDER BY owner_scope,owner_id,template_id,quality')).rows,
    rooms: (await app.pool.query('SELECT * FROM city_home_rooms ORDER BY home_key,authority_token')).rows,
    grants: (await app.pool.query('SELECT * FROM city_home_visitors ORDER BY id')).rows,
    activities: (await app.pool.query('SELECT * FROM city_home_activities ORDER BY id')).rows,
    participants: (await app.pool.query('SELECT * FROM city_home_activity_members ORDER BY activity_id,account_id')).rows,
    storage: (await app.pool.query('SELECT * FROM city_home_storage_items ORDER BY item_id')).rows,
    events: (await app.pool.query('SELECT * FROM item_events ORDER BY sequence')).rows,
    guards: (await app.pool.query('SELECT * FROM item_mutation_guards ORDER BY idempotency_key')).rows,
    ledger: (await app.pool.query('SELECT * FROM transactions ORDER BY id')).rows,
  });

  for (const url of ['/v1/city/home/interior?homeKey=functional%20home', '/v1/city/home/invitations', '/v1/city/home/recovery']) {
    const reply = await get(null, url); assert.equal(reply.statusCode, 401); privateHeaders(reply);
  }
  let board = await owned(); assert.equal(board.room.active, false); assert.equal(board.storage, null);
  assert.equal(typeof board.home.authorityToken, 'string');
  for (const url of ['/v1/deeds','/v1/city/homes?district=foundry']) {
    const legacy = ok(await get(owner, url)); assert(!JSON.stringify(legacy).includes(board.home.authorityToken), 'Legacy deed/directory DTO never publishes the new home nonce.');
  }
  const beforeRead = await snapshot(); await owned(); assert.deepEqual(await snapshot(), beforeRead, 'Home GET is read-only, including recipe previews and canonical token.');
  ok(await homePost(owner, 'activate', {}, undefined, board));
  board = await owned(); assert.equal(board.room.active, true); assert.equal(board.storage.capacity, 8);
  const neutral = (await snapshot()).characters;
  ok(await homePost(owner, 'layout', { room: { furniture: [{ id: 'chair', x: 0, y: 0 }] } }));
  assert.deepEqual((await snapshot()).characters, neutral, 'Decorations grant no travel, cash, health, energy or stats.');
  const layoutVersion = await owned(), layoutKey = crypto.randomUUID();
  const savedLayout = ok(await homePost(owner, 'layout', { room: { furniture: [{ id: 'chair', x: 1, y: 0, rotation: 1 }] } }, layoutKey, layoutVersion));
  const afterLayout = await snapshot();
  assert.equal((await homePost(owner, 'layout', { room: { furniture: [] } }, undefined, layoutVersion)).json().error, 'home_layout_changed');
  assert.deepEqual(await snapshot(), afterLayout, 'A stale room draft cannot overwrite a newer layout or close its activities.');
  assert.deepEqual(ok(await homePost(owner, 'layout', { room: { furniture: [{ id: 'chair', x: 1, y: 0, rotation: 1 }] } }, layoutKey, layoutVersion)), savedLayout,
    'An exact replay retains its issued old revision and immutable result.');
  assert.equal((await post(owner, '/v1/city/home/layout', { ...anchors(await owned()), room: { furniture: [] } })).json().error, 'bad_home_request');
  assert.deepEqual(await snapshot(), afterLayout, 'Omitting the layout revision cannot bypass optimistic concurrency.');
  for (const fields of [{ x: 10 }, { accountId: owner.account }, { generation: 999 }, { district: 'docks' }]) {
    const before = await snapshot(), reply = await homePost(owner, 'layout', { room: { furniture: [] }, ...fields });
    assert.notEqual(reply.statusCode, 200); assert.deepEqual(await snapshot(), before, 'Malformed/stale anchors cannot change home state.');
  }
  const stranger = await get(outsider, '/v1/city/home/interior?homeKey=functional%20home');
  assert.equal(stranger.statusCode, 400); privateHeaders(stranger); assert(!stranger.body.includes(owner.account));
  assert.equal((await get(outsider, '/v1/city/home/interior?homeKey=absent')).body, stranger.body);

  const invite = ok(await homePost(owner, 'visitors/invite', { targetCharacterId: guest.id, rights: ['visit', 'workbench'] }));
  assert.notEqual((await get(guest, '/v1/city/home/interior?homeKey=functional%20home')).statusCode, 200, 'Invitation alone grants no entry.');
  const invitations = ok(await get(guest, '/v1/city/home/invitations')); assert.equal(invitations.invitations.length, 1);
  const acceptAction = invitations.invitations[0].action, acceptKey = crypto.randomUUID();
  const accepted = ok(await post(guest, acceptAction.path, acceptAction.body, acceptKey));
  const guestBoard = await read(guest); assert.equal(guestBoard.access.role, 'visitor'); assert.equal(guestBoard.storage, null); assert.deepEqual(guestBoard.visitors, []);
  assert(!JSON.stringify(guestBoard).includes(owner.account)); assert(!JSON.stringify(guestBoard).includes(guest.account));
  assert.equal((await homePost(guest, 'storage/store', { itemId: 'not-owned' }, undefined, guestBoard)).statusCode, 400);
  ok(await homePost(owner, 'visitors/revoke', { grantId: invite.effect.grantId }));
  assert.notEqual((await get(guest, '/v1/city/home/interior?homeKey=functional%20home')).statusCode, 200);
  assert.deepEqual(ok(await post(guest, acceptAction.path, acceptAction.body, acceptKey)), accepted, 'Historical consent ACK replays effects, not current permission.');
  assert.equal((await app.pool.query('SELECT status FROM city_home_visitors WHERE id=$1', [invite.effect.grantId])).rows[0].status, 'revoked');

  const item = await award(owner), storeBoard = await owned(), storeKey = crypto.randomUUID();
  const stored = ok(await homePost(owner, 'storage/store', { itemId: item.id }, storeKey, storeBoard));
  assert.equal(stored.effect.state, 'stored');
  const storedRow = (await app.pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [item.id])).rows[0];
  assert.deepEqual(storedRow, { owner_scope: 'account', owner_id: owner.account, state: 'stored' });
  const custodyCheck = async () => (await runLedgerInvariants(app.pool, { alert: false })).checks.find(check => check.name === 'world graph unique custody and provenance');
  assert.equal((await custodyCheck()).ok, true, 'Stored endpoint and same-owner history reconcile.');
  await app.pool.query('UPDATE city_home_rooms SET owner_account_id=$3 WHERE home_key=$1 AND authority_token=$2',
    [storeBoard.home.key, storeBoard.home.authorityToken, buyer.account]);
  try {
    assert.equal((await custodyCheck()).ok, false, 'The oracle detects a mismatched room owner snapshot.');
    assert.equal((await get(owner, '/v1/city/home/interior?homeKey=functional%20home')).statusCode, 503, 'Mismatched room snapshots fail closed.');
  } finally { await app.pool.query('UPDATE city_home_rooms SET owner_account_id=$3 WHERE home_key=$1 AND authority_token=$2', [storeBoard.home.key, storeBoard.home.authorityToken, owner.account]); }
  const storedEvent = (await app.pool.query("SELECT id,reason FROM item_events WHERE item_id=$1 AND event_kind='stored'", [item.id])).rows[0];
  await app.pool.query('UPDATE item_events SET reason=$2 WHERE id=$1', [storedEvent.id, JSON.stringify({ kind: 'home_storage', homeKey: 'functional home', authorityToken: crypto.randomUUID(), detail: 'forged location' })]);
  try { assert.equal((await custodyCheck()).ok, false, 'A forged storage-history location is detected.'); }
  finally { await app.pool.query('UPDATE item_events SET reason=$2 WHERE id=$1', [storedEvent.id, storedEvent.reason]); }
  assert.equal((await custodyCheck()).ok, true);
  assert.deepEqual(ok(await homePost(owner, 'storage/store', { itemId: item.id }, storeKey, storeBoard)), stored, 'Lost response retry uses the exact original ACK.');
  await assert.rejects(withItemTransaction(app.pool, client => consumeItem(client, { scope: 'account', id: owner.account }, item.id, 'must refuse stored', crypto.randomUUID())), error => error.code === 'item_unavailable');
  const assignment = await post(owner, '/v1/worldgraph/items/' + item.id + '/assign-current-character', {});
  assert.notEqual(assignment.statusCode, 200, 'Stored item cannot be assigned to a character.');
  const withdrawn = ok(await homePost(owner, 'storage/retrieve', { itemId: item.id })); assert.equal(withdrawn.effect.state, 'active');
  const carried = await award(owner);
  ok(await post(owner, '/v1/worldgraph/items/' + carried.id + '/assign-current-character', {}));
  assert.notEqual((await homePost(owner, 'storage/store', { itemId: carried.id })).statusCode, 200, 'Home never converts character custody to account custody.');
  assert.equal((await app.pool.query('SELECT owner_scope,owner_id FROM item_instances WHERE id=$1', [carried.id])).rows[0].owner_id, owner.id);
  const held = await award(owner), operation = 'home-storage-operation-fixture';
  await withItemTransaction(app.pool, client => escrowItem(client, { scope: 'account', id: owner.account }, operation, held.id, 'operation storage refusal', crypto.randomUUID()));
  const beforeHeld = await snapshot(); assert.notEqual((await homePost(owner, 'storage/store', { itemId: held.id })).statusCode, 200);
  assert.deepEqual(await snapshot(), beforeHeld, 'Home cannot take operation escrow.');
  await withItemTransaction(app.pool, client => releaseEscrow(client, operation, { scope: 'account', id: owner.account }, held.id, 'release storage fixture', crypto.randomUUID()));
  // A real sealed-definition unique object remains outside the generic home custody branch.
  const { compileFixture, materialSource } = await import('./lib/phase2-definition-fixtures.js');
  const { lotRequest } = await import('./lib/phase2-item-fixtures.js');
  const { storeSealedBundle } = await import('../src/content/artifacts.js');
  const { definitionByHash } = await import('../src/itemdefinitions.js');
  const { grantUnique } = await import('../src/itemlots.js');
  const exactSource = materialSource({ kind: 'item', stackable: false, maximumLotQuantity: 1, definitionVersion: 71 }); exactSource.version = 71;
  const sealed = compileFixture(exactSource); await storeSealedBundle(app.pool, sealed.request);
  const definition = await definitionByHash(app.pool, sealed.expectedDefinitions[0].definitionHash), exactOwner = { scope: 'account', id: owner.account };
  const exact = await withItemTransaction(app.pool, client => withLotMutation(client, lotRequest(exactOwner, definition), mutation => grantUnique(client, mutation, definition,
    { logicalItemId: definition.logicalItemId, definitionHash: definition.definitionHash, owner: exactOwner,
      qualityBand: null, qualityStateDigest: null, tradePolicyHash: definition.definitionHash,
      conditionSummary: null, exportPolicy: 'ineligible', provenanceClass: 'awarded', provenanceDigest: 'a'.repeat(64) })));
  assert.notEqual((await homePost(owner, 'storage/store', { itemId: exact.id })).statusCode, 200);
  const exactBefore = (await app.pool.query('SELECT * FROM item_instances WHERE id=$1', [exact.id])).rows[0];
  const exactLocation = { homeKey: 'functional home', authorityToken: (await owned()).home.authorityToken };
  await assert.rejects(withItemTransaction(app.pool, client => storeItem(client, exactOwner, exact.id,
    exactLocation, 'exact storage refused', crypto.randomUUID())), error => error.code === 'item_unavailable');
  assert.deepEqual((await app.pool.query('SELECT * FROM item_instances WHERE id=$1', [exact.id])).rows[0], exactBefore);

  // Actual late receipt SQL failure restores state/events/guards and storage attachments.
  const rollbackItem = await award(owner), rollbackKey = crypto.randomUUID(), rollbackBoard = await owned(), beforeRollback = await snapshot();
  let injected = false;
  console.log('Home fault boundary: late receipt started');
  await withPoolQueryFault(app.pool,(args) => {
    if (!injected && /^UPDATE idempotency SET status=\$3/.test(String(args[0])) && args[1]?.[1] === rollbackKey) {
      injected = true; throw new Error('home late receipt interruption');
    }
  },async () => { assert.equal((await homePost(owner, 'storage/store', { itemId: rollbackItem.id }, rollbackKey, rollbackBoard)).statusCode, 503); });
  assert(injected); assert.deepEqual(await snapshot(), beforeRollback, 'Late SQL failure rolls back the whole home effect and receipt boundary.');
  ok(await homePost(owner, 'storage/store', { itemId: rollbackItem.id }, rollbackKey, rollbackBoard));
  ok(await homePost(owner, 'storage/retrieve', { itemId: rollbackItem.id }));
  console.log('Home fault boundary: late receipt completed');

  // A real COMMIT completes, then its acknowledgement is withheld on that connection.
  const uncertainItem = await award(owner), uncertainKey = crypto.randomUUID(), uncertainBoard = await owned();
  let lostCommitAck = false;
  console.log('Home fault boundary: committed acknowledgement started');
  await withPoolQueryFault(app.pool,(args) => {
    if (!lostCommitAck && String(args[0]) === 'COMMIT') { lostCommitAck = true; throw new Error('withheld committed acknowledgement'); }
  },async () => {
    const uncertain = await homePost(owner, 'storage/store', { itemId: uncertainItem.id }, uncertainKey, uncertainBoard);
    assert.equal(uncertain.statusCode, 503); assert.equal(uncertain.json().error, 'item_commit_unknown');
  });
  assert(lostCommitAck);
  const recoveredAck = ok(await homePost(owner, 'storage/store', { itemId: uncertainItem.id }, uncertainKey, uncertainBoard));
  assert.equal(recoveredAck.effect.itemId, uncertainItem.id);
  assert.equal(Number((await app.pool.query("SELECT COUNT(*) n FROM item_events WHERE item_id=$1 AND event_kind='stored'", [uncertainItem.id])).rows[0].n), 1);
  ok(await homePost(owner, 'storage/retrieve', { itemId: uncertainItem.id }));
  console.log('Home fault boundary: committed acknowledgement completed');

  // Working home uses the actual authored recipe and the visitor's own account materials.
  const makerInitial = await read(maker, 'working home'); ok(await homePost(maker, 'activate', {}, undefined, makerInitial));
  await withItemTransaction(app.pool, client => grantStack(client, { scope: 'account', id: maker.account }, 'mat:scrap_steel', 4, 'standard', 'home crafting fixture', crypto.randomUUID()));
  const makerBoard = await read(maker, 'working home'), recipe = makerBoard.workbench.recipes.find(row => row.id === 'recipe:hardened_steel');
  assert.equal(recipe.available, true);
  const makerBefore = (await app.pool.query('SELECT cash,loc FROM characters WHERE id=$1', [maker.id])).rows[0], craftKey = crypto.randomUUID();
  const crafted = ok(await post(maker, recipe.action.path, recipe.action.body, craftKey));
  assert.equal(crafted.effect.recipeId, recipe.id);
  assert.deepEqual(ok(await post(maker, recipe.action.path, recipe.action.body, craftKey)), crafted);
  const makerAfter = (await app.pool.query('SELECT cash,loc FROM characters WHERE id=$1', [maker.id])).rows[0];
  assert.equal(Number(makerBefore.cash) - Number(makerAfter.cash), 300); assert.equal(makerAfter.loc, makerBefore.loc);
  const makerInventory = await inventoryBoard(app.pool, { scope: 'account', id: maker.account });
  assert(!makerInventory.stacks.some(row => row.templateId === 'mat:scrap_steel')); assert.equal(makerInventory.stacks.find(row => row.templateId === 'mat:hardened_steel').qty, 1);
  const craftRefusalBefore = await snapshot(); assert.notEqual((await post(maker, recipe.action.path, recipe.action.body)).statusCode, 200);
  assert.deepEqual(await snapshot(), craftRefusalBefore, 'Missing inputs retain the original recipe gate and no partial debit.');

  // Hosted puzzles use actual furnishings and a second explicit participant-consent boundary.
  const economic = async () => { const state = await snapshot(); return { characters: state.characters,accounts: state.accounts,items: state.items,stacks: state.stacks,ledger: state.ledger }; };
  const beforePuzzles = await economic();
  ok(await homePost(owner, 'layout', { room: { furniture: [{ id:'chair',x:0,y:0 },{ id:'table',x:1,y:0 },{ id:'lamp',x:2,y:0 },{ id:'window',x:3,y:0 }] } }));
  const puzzleInvite = ok(await homePost(owner, 'visitors/invite', { targetCharacterId: guest.id,rights:['visit'] }));
  const puzzleAccept = ok(await get(guest, '/v1/city/home/invitations')).invitations.find(row => row.id === puzzleInvite.effect.grantId).action;
  ok(await post(guest, puzzleAccept.path, puzzleAccept.body));
  let puzzleBoard = await owned();
  const openAction = puzzleBoard.activity.catalog.find(row => row.id === 'evening-notebook').action;
  const opened = ok(await post(owner, openAction.path, openAction.body));
  puzzleBoard = await read(guest); assert.equal(puzzleBoard.activity.active.self, null); assert.deepEqual(puzzleBoard.activity.active.roster, []);
  const joinAction = puzzleBoard.activity.active.actions.find(row => row.id === 'activity-join');
  assert.deepEqual(joinAction.inputFields, ['consent']); assert(!Object.hasOwn(joinAction.body, 'consent'));
  const noConsent = await snapshot(); assert.equal((await post(guest, joinAction.path, { ...joinAction.body,consent:false })).statusCode, 400);
  assert.deepEqual(await snapshot(), noConsent, 'Home entry never implies puzzle membership.');
  const puzzleRollbackKey = crypto.randomUUID(), puzzleRollbackBefore = await snapshot();
  let puzzleReceiptInterrupted = false;
  console.log('Home fault boundary: puzzle receipt started');
  await withPoolQueryFault(app.pool,(args) => {
    if (!puzzleReceiptInterrupted && /^UPDATE idempotency SET status=\$3/.test(String(args[0])) && args[1]?.[1] === puzzleRollbackKey) {
      puzzleReceiptInterrupted = true; throw new Error('late puzzle participant receipt interruption');
    }
  },async () => { assert.equal((await post(guest, joinAction.path, { ...joinAction.body,consent:true }, puzzleRollbackKey)).statusCode, 503); });
  assert(puzzleReceiptInterrupted); assert.deepEqual(await snapshot(), puzzleRollbackBefore, 'Late join receipt failure restores participant consent and room revision.');
  ok(await post(guest, joinAction.path, { ...joinAction.body,consent:true }));
  puzzleBoard = await read(guest); assert.deepEqual(puzzleBoard.activity.active.roster, [{ name: guest.name }]);
  assert.equal(puzzleBoard.activity.active.self.step, 0);
  console.log('Home fault boundary: puzzle receipt completed');
  const wrongCell = puzzleBoard.activity.active.cells.find(row => row.furnishingId === 'table').action, beforeWrong = await snapshot();
  assert.equal((await post(guest, wrongCell.path, wrongCell.body)).json().error, 'home_puzzle_clue');
  assert.deepEqual(await snapshot(), beforeWrong, 'An out-of-order furnishing has no progress or resource effect.');
  let solved, solvedAction, solveKey;
  for (const furnishing of ['chair','table','lamp']) {
    puzzleBoard = await read(guest); const answer = puzzleBoard.activity.active.cells.find(row => row.furnishingId === furnishing).action;
    const key = crypto.randomUUID(); solved = ok(await post(guest, answer.path, answer.body, key));
    solvedAction = answer; solveKey = key;
  }
  assert.equal(solved.effect.complete, true); assert.equal(solved.effect.step, 3);
  const ownHistory = ok(await get(guest, '/v1/city/home/activity-history')); assert.equal(ownHistory.outcomes[0].outcome.puzzleId, 'evening-notebook');
  assert.equal(ok(await get(owner, '/v1/city/home/activity-history')).outcomes.length, 0, 'Confirmed puzzle outcomes are per participant, not host rewards.');
  assert(!JSON.stringify(await owned()).includes(solved.effect.outcome.solvedAt), 'The host roster never reveals another participant’s outcome.');
  ok(await post(guest, '/v1/city/home/activity/leave', { ...(await currentViewer(guest)),activityId:opened.effect.activityId }));
  assert.equal((await post(guest, solvedAction.path, solvedAction.body)).statusCode, 400);
  assert.deepEqual(ok(await post(guest, solvedAction.path, solvedAction.body, solveKey)), solved, 'Sent solution ACK replays without reinstating participation.');
  assert.equal((await read(guest)).activity.active.self.status, 'left');
  ok(await homePost(owner, 'activity/close', { activityId: opened.effect.activityId }));
  assert.deepEqual(ok(await get(guest, '/v1/city/home/activity-history')), ownHistory);
  const coop = ok(await homePost(owner, 'activity/open', { puzzleId: 'two-voices-v1' }));
  const joinCoop = async who => {
    const action = (await read(who)).activity.active.actions.find(row => row.id === 'activity-join');
    return ok(await post(who, action.path, { ...action.body, consent: true }));
  };
  await joinCoop(owner);
  const soloCoop = (await owned()).activity.active;
  assert.equal(soloCoop.capacity, 2); assert(soloCoop.cells.every(cell => !cell.action.available));
  assert.equal((await post(owner, soloCoop.cells[0].action.path, soloCoop.cells[0].action.body)).json().error, 'home_puzzle_partner');
  await joinCoop(guest);
  let hostCoop = (await owned()).activity.active, guestCoop = (await read(guest)).activity.active;
  assert(!hostCoop.self.clue.includes('sits')); assert(guestCoop.self.clue.includes('sits'), 'Only the guest receives the host’s first furnishing clue.');
  assert(guestCoop.cells.every(cell => !cell.action.available));
  const hostFirst = hostCoop.cells.find(cell => cell.furnishingId === 'chair').action, firstKey = crypto.randomUUID();
  const firstCoop = ok(await post(owner, hostFirst.path, hostFirst.body, firstKey));
  assert.deepEqual(ok(await post(owner, hostFirst.path, hostFirst.body, firstKey)), firstCoop);
  hostCoop = (await owned()).activity.active; guestCoop = (await read(guest)).activity.active;
  assert(hostCoop.self.clue.includes('meal')); assert(!guestCoop.self.clue.includes('meal'));
  assert.equal((await post(owner, hostFirst.path, hostFirst.body)).json().error, 'home_puzzle_turn', 'One account cannot perform both roles.');
  const guestMove = guestCoop.cells.find(cell => cell.furnishingId === 'table').action;
  ok(await post(guest, guestMove.path, guestMove.body));
  const finalMove = (await owned()).activity.active.cells.find(cell => cell.furnishingId === 'lamp').action;
  const beforeCoopFinal = await snapshot(), finalKey = crypto.randomUUID(); let finalInterrupted = false;
  await withPoolQueryFault(app.pool, (args) => {
    if (!finalInterrupted && /^UPDATE idempotency SET status=\$3/.test(String(args[0])) && args[1]?.[1] === finalKey) {
      finalInterrupted = true; throw new Error('late cooperative outcome receipt interruption');
    }
  }, async () => { assert.equal((await post(owner, finalMove.path, finalMove.body, finalKey)).statusCode, 503); });
  assert(finalInterrupted); assert.deepEqual(await snapshot(), beforeCoopFinal, 'Late receipt failure rolls both consenting outcomes back.');
  const together = ok(await post(owner, finalMove.path, finalMove.body, finalKey)); assert(together.effect.complete);
  const hostHistory = ok(await get(owner, '/v1/city/home/activity-history'));
  assert.equal(hostHistory.outcomes[0].outcome.puzzleId, 'two-voices-v1');
  assert.deepEqual(ok(await get(guest, '/v1/city/home/activity-history')).outcomes[0].outcome, hostHistory.outcomes[0].outcome);
  assert.deepEqual(ok(await post(owner, finalMove.path, finalMove.body, finalKey)), together);
  ok(await homePost(owner, 'activity/close', { activityId: coop.effect.activityId }));
  const consentCoop = ok(await homePost(owner, 'activity/open', { puzzleId: 'two-voices-v1' }));
  await joinCoop(owner); await joinCoop(guest);
  const waitingAnswer = (await owned()).activity.active.cells.find(cell => cell.furnishingId === 'chair').action;
  const consentLeave = (await read(guest)).activity.active.actions.find(action => action.id === 'activity-leave');
  ok(await post(guest, consentLeave.path, consentLeave.body)); const withdrawnParty = await snapshot();
  assert.equal((await post(owner, waitingAnswer.path, waitingAnswer.body)).json().error, 'home_puzzle_partner');
  assert.deepEqual(await snapshot(), withdrawnParty, 'Withdrawn consent cannot be used to advance a cooperative stage.');
  ok(await homePost(owner, 'activity/close', { activityId: consentCoop.effect.activityId }));
  assert.deepEqual(await economic(), beforePuzzles, 'All puzzle actions change no cash, XP/respect, health, energy, inventory or ledger.');
  const closedLayoutBoard = await owned(), nextPuzzle = closedLayoutBoard.activity.catalog.find(row => row.id === 'lights-out').action;
  const layoutActivity = ok(await post(owner, nextPuzzle.path, nextPuzzle.body));
  const beforeLayoutVersion = (await owned()).home.layoutRevision;
  ok(await homePost(owner, 'layout', { room: { furniture: [{ id:'chair',x:0,y:0 },{ id:'table',x:1,y:0 },{ id:'lamp',x:2,y:0 },{ id:'window',x:3,y:0 }] } }));
  assert((await owned()).home.layoutRevision > beforeLayoutVersion);
  assert.equal((await app.pool.query('SELECT status FROM city_home_activities WHERE id=$1', [layoutActivity.effect.activityId])).rows[0].status, 'closed', 'Even restoring identical layout does not revive a former activity revision.');
  ok(await homePost(owner, 'visitors/revoke', { grantId: puzzleInvite.effect.grantId }));

  // Real sale, same-day rebuy, generation cleanup and original-owner archived storage.
  ok(await homePost(owner, 'storage/store', { itemId: item.id }));
  const oldBoard = await owned(), oldToken = oldBoard.home.authorityToken;
  const liveInvite = ok(await homePost(owner, 'visitors/invite', { targetCharacterId: guest.id, rights: ['visit'] }));
  const liveAccept = ok(await get(guest, '/v1/city/home/invitations')).invitations.find(row => row.id === liveInvite.effect.grantId).action;
  ok(await post(guest, liveAccept.path, liveAccept.body));
  const salePuzzle = ok(await homePost(owner, 'activity/open', { puzzleId:'visitor-welcome' }));
  const saleJoin = (await read(guest)).activity.active.actions.find(row => row.id === 'activity-join');
  ok(await post(guest, saleJoin.path, { ...saleJoin.body,consent:true }));
  ok(await post(owner, '/v1/deeds/list', { price: 10000 }));
  if (postgres) {
    const beforeBuy = (await app.pool.query('SELECT * FROM street_deeds WHERE name_lc=$1', ['functional home'])).rows[0];
    await assert.rejects(withTwoCharacters(app.pool, buyer.account, owner.id, async (ch, seller, client, h) => {
      await buyDeed(ch, seller, client, h); throw new Error('late canonical sale interruption');
    }), /late canonical sale interruption/);
    assert.deepEqual((await app.pool.query('SELECT * FROM street_deeds WHERE name_lc=$1', ['functional home'])).rows[0], beforeBuy);
  }
  ok(await post(buyer, '/v1/deeds/buy/' + owner.id, {}));
  assert.equal((await app.pool.query('SELECT status FROM city_home_activities WHERE id=$1', [salePuzzle.effect.activityId])).rows[0].status, 'closed');
  let bought = await read(buyer); assert.notEqual(bought.home.authorityToken, oldToken); assert.equal(bought.storage, null);
  ok(await homePost(buyer, 'activate', {}, undefined, bought)); bought = await read(buyer); assert.deepEqual(bought.storage.items, []); assert.deepEqual(bought.visitors, []);
  assert.notEqual((await get(guest, '/v1/city/home/interior?homeKey=functional%20home')).statusCode, 200);
  const archived = ok(await get(owner, '/v1/city/home/recovery')); assert(archived.items.some(row => row.id === item.id));
  assert(!JSON.stringify(await read(buyer)).includes(item.id), 'Sale never gifts or exposes old account contents.');
  assert.deepEqual(ok(await get(buyer, '/v1/city/home/recovery')).items, []);
  ok(await post(guest, '/v1/travel/docks', {}));
  const guestAway = await currentViewer(guest), leaveBefore = (await snapshot()).characters;
  const awayConsent = ok(await get(guest, '/v1/city/home/invitations'));
  const leaveAction = awayConsent.permissions.find(row => row.id === liveInvite.effect.grantId).action;
  assert.deepEqual(leaveAction.body, { ...guestAway, grantId: liveInvite.effect.grantId });
  assert(!JSON.stringify(awayConsent).includes(buyer.account)); assert(!JSON.stringify(awayConsent).includes(bought.home.authorityToken));
  ok(await post(guest, leaveAction.path, leaveAction.body));
  const awayPuzzleLeave = { ...guestAway,activityId:salePuzzle.effect.activityId };
  ok(await post(guest, '/v1/city/home/activity/leave', awayPuzzleLeave));
  assert.deepEqual((await snapshot()).characters, leaveBefore, 'Consent withdrawal while away/after sale does not move or grant resources.');
  ok(await post(buyer, '/v1/deeds/list', { price: 10000 })); ok(await post(owner, '/v1/deeds/buy/' + buyer.id, {}));
  const rebound = await owned(); assert.notEqual(rebound.home.authorityToken, oldToken); assert.notEqual(rebound.home.authorityToken, bought.home.authorityToken);
  assert.equal((await homePost(owner, 'layout', { room: { furniture: [] } }, undefined, oldBoard)).statusCode, 409, 'Same-day sale/rebuy cannot revive a former home epoch.');
  ok(await homePost(owner, 'activate', {}, undefined, rebound));
  assert.equal((await post(guest, liveAccept.path, liveAccept.body)).statusCode, 409, 'An away viewer cannot apply the old district invitation after rebuy.');
  ok(await post(owner, archived.items.find(row => row.id === item.id).action.path, archived.items.find(row => row.id === item.id).action.body));
  assert.equal((await app.pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [item.id])).rows[0].state, 'active');
  ok(await homePost(owner, 'storage/store', { itemId: item.id }));
  ok(await post(guest, '/v1/travel/foundry', {}));
  assert.equal((await post(guest, liveAccept.path, liveAccept.body)).statusCode, 400, 'Returning to the district never revives the old home epoch or revoked grant.');
  const inheritedInvite = ok(await homePost(owner, 'visitors/invite', { targetCharacterId: guest.id, rights: ['visit'] }));
  const inheritedAccept = ok(await get(guest, '/v1/city/home/invitations')).invitations.find(row => row.id === inheritedInvite.effect.grantId).action;
  ok(await post(guest, inheritedAccept.path, inheritedAccept.body));
  ok(await homePost(owner, 'layout', { room: { furniture: [{ id:'chair',x:0,y:0 },{ id:'table',x:1,y:0 },{ id:'lamp',x:2,y:0 }] } }));
  const deathActivity = ok(await homePost(owner, 'activity/open', { puzzleId:'evening-notebook' }));
  if (postgres) {
    const beforeEstateFailure = await snapshot();
    await assert.rejects(withTwoCharacters(app.pool,buyer.account,owner.id,async (_killer,victim,client,h) => {
      await runEstate(client,h,victim,'Hosted home late estate rollback'); throw new Error('late home estate interruption');
    }, {meet:false}), /late home estate interruption/);
    assert.deepEqual(await snapshot(), beforeEstateFailure, 'Native late estate failure restores visitor consent, live activity, members, inventory and financial state.');
  }
  await withTwoCharacters(app.pool, buyer.account, owner.id, async (_killer, victim, client, h) => runEstate(client, h, victim, 'Home estate proof'), { meet: false });
  assert.equal((await app.pool.query('SELECT status FROM city_home_visitors WHERE id=$1', [inheritedInvite.effect.grantId])).rows[0].status, 'revoked');
  assert.equal((await app.pool.query('SELECT status FROM city_home_activities WHERE id=$1', [deathActivity.effect.activityId])).rows[0].status, 'closed');
  assert.notEqual((await get(guest, '/v1/city/home/interior?homeKey=functional%20home')).statusCode, 200);
  const heir = await currentViewer(owner); assert.notEqual(heir.characterId, owner.id);
  assert.equal((await app.pool.query('SELECT owner_scope,owner_id FROM item_instances WHERE id=$1', [carried.id])).rows[0].owner_id, owner.id, 'No character-to-account inheritance conversion.');
  if (heir.district !== 'foundry') ok(await post(owner, '/v1/travel/foundry', {}));
  const heirHome = await owned(); assert.equal(heirHome.room.active, true); assert(heirHome.storage.items.some(row => row.id === item.id));
  assert(!ok(await get(owner, '/v1/worldgraph/inventory')).currentCharacterItems.some(row => row.id === carried.id));
  ok(await homePost(owner, 'storage/retrieve', { itemId: item.id }, undefined, heirHome));
  const retirementInvite = ok(await homePost(owner, 'visitors/invite', { targetCharacterId: guest.id, rights: ['visit'] }));
  await app.pool.query('UPDATE characters SET is_npc=true WHERE id=$1', [guest.id]);
  const retirementClient = await app.pool.connect();
  try { await retirementClient.query('BEGIN'); await retireResident(retirementClient, guest.id); await retirementClient.query('COMMIT'); }
  catch (error) { await retirementClient.query('ROLLBACK'); throw error; } finally { retirementClient.release(); }
  assert.equal((await app.pool.query('SELECT status FROM city_home_visitors WHERE id=$1', [retirementInvite.effect.grantId])).rows[0].status, 'revoked');

  // Native contention retains every assertion; memory validates functional outcomes only.
  if (postgres) {
    const racingLayout = await owned(), raceFields = { room: { furniture: [{ id: 'chair', x: 1, y: 1 }] } };
    const raced = await Promise.all([homePost(owner, 'layout', raceFields, undefined, racingLayout), homePost(owner, 'layout', raceFields, undefined, racingLayout)]);
    assert.deepEqual(raced.map(reply => reply.statusCode).sort(), [200,409], 'Two real same-revision layout writers have one winner.');
    assert.equal((await owned()).home.layoutRevision, racingLayout.home.layoutRevision + 1);
    for (const entry of (await owned()).storage.items) ok(await homePost(owner, 'storage/retrieve', { itemId: entry.id }));
    const race = await award(owner), raceBoard = await owned(), sameKey = crypto.randomUUID();
    const duplicates = await Promise.all([homePost(owner, 'storage/store', { itemId: race.id }, sameKey, raceBoard), homePost(owner, 'storage/store', { itemId: race.id }, sameKey, raceBoard)]);
    assert(duplicates.some(reply => reply.statusCode === 200)); assert(duplicates.every(reply => [200,409].includes(reply.statusCode)));
    ok(await homePost(owner, 'storage/store', { itemId: race.id }, sameKey, raceBoard));
    assert.equal(Number((await app.pool.query("SELECT COUNT(*) n FROM item_events WHERE item_id=$1 AND event_kind='stored'", [race.id])).rows[0].n), 1);
    ok(await homePost(owner, 'storage/retrieve', { itemId: race.id }));
    const competing = await award(owner), competingBoard = await owned();
    const competition = await Promise.allSettled([homePost(owner, 'storage/store', { itemId: competing.id }, undefined, competingBoard),
      withItemTransaction(app.pool, client => consumeItem(client, { scope: 'account', id: owner.account }, competing.id, 'native competing consume', crypto.randomUUID()))]);
    const afterCompetition = (await app.pool.query('SELECT state,owner_scope,owner_id FROM item_instances WHERE id=$1', [competing.id])).rows[0];
    assert(['stored','consumed'].includes(afterCompetition.state)); assert.equal(afterCompetition.owner_id, owner.account);
    assert.equal(competition.filter(entry => entry.status === 'fulfilled' && (entry.value?.statusCode === 200 || entry.value?.state === 'consumed')).length, 1);
    if (afterCompetition.state === 'stored') ok(await homePost(owner, 'storage/retrieve', { itemId: competing.id }));
    const assignRace = await award(owner), assignBoard = await owned();
    const assignedRace = await Promise.all([homePost(owner, 'storage/store', { itemId: assignRace.id }, undefined, assignBoard),
      post(owner, '/v1/worldgraph/items/' + assignRace.id + '/assign-current-character', {})]);
    assert.equal(assignedRace.filter(reply => reply.statusCode === 200).length, 1);
    const assignedRow = (await app.pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [assignRace.id])).rows[0];
    if (assignedRow.state === 'stored') { assert.equal(assignedRow.owner_id, owner.account); ok(await homePost(owner, 'storage/retrieve', { itemId: assignRace.id })); }
    else { assert.equal(assignedRow.owner_scope, 'character'); assert.equal(assignedRow.owner_id, (await currentViewer(owner)).characterId); }
    const escrowRace = await award(owner), escrowBoard = await owned(), raceOperation = 'home-native-escrow-race';
    const escrowCompetition = await Promise.allSettled([homePost(owner, 'storage/store', { itemId: escrowRace.id }, undefined, escrowBoard),
      withItemTransaction(app.pool, client => escrowItem(client, { scope: 'account', id: owner.account }, raceOperation, escrowRace.id, 'native escrow contender', crypto.randomUUID()))]);
    assert.equal(escrowCompetition.filter(entry => entry.status === 'fulfilled' && (entry.value?.statusCode === 200 || entry.value?.state === 'escrowed')).length, 1);
    const escrowRow = (await app.pool.query('SELECT state FROM item_instances WHERE id=$1', [escrowRace.id])).rows[0];
    if (escrowRow.state === 'stored') ok(await homePost(owner, 'storage/retrieve', { itemId: escrowRace.id }));
    else await withItemTransaction(app.pool, client => releaseEscrow(client, raceOperation, { scope: 'account', id: owner.account }, escrowRace.id, 'release native escrow race', crypto.randomUUID()));
    const candidates = await Promise.all(Array.from({ length: 9 }, () => award(owner)));
    for (const entry of candidates.slice(0, 7)) ok(await homePost(owner, 'storage/store', { itemId: entry.id }));
    const capacityBoard = await owned(), capacity = await Promise.all(candidates.slice(7).map(entry => homePost(owner, 'storage/store', { itemId: entry.id }, undefined, capacityBoard)));
    assert.equal(capacity.filter(reply => reply.statusCode === 200).length, 1); assert.equal(capacity.filter(reply => reply.json().error === 'home_storage_full').length, 1);
    for (const entry of (await owned()).storage.items) ok(await homePost(owner, 'storage/retrieve', { itemId: entry.id }));
    const makerCurrent = await read(maker, 'working home'), ownerCurrent = await owned(), ownerHeir = await currentViewer(owner);
    const opposite = await Promise.all([
      homePost(owner, 'visitors/invite', { targetCharacterId: maker.id, rights: ['visit'] }, undefined, ownerCurrent),
      homePost(maker, 'visitors/invite', { targetCharacterId: ownerHeir.characterId, rights: ['visit'] }, undefined, makerCurrent),
    ]);
    for (const reply of opposite) ok(reply);
    const craftInvite = ok(await homePost(maker, 'visitors/invite', { targetCharacterId: outsider.id, rights: ['visit','workbench'] }, undefined, await read(maker, 'working home')));
    const craftAccept = ok(await get(outsider, '/v1/city/home/invitations')).invitations.find(row => row.id === craftInvite.effect.grantId).action;
    ok(await post(outsider, craftAccept.path, craftAccept.body));
    await withItemTransaction(app.pool, client => grantStack(client, { scope: 'account', id: outsider.account }, 'mat:scrap_steel', 4, 'standard', 'native visitor workbench inputs', crypto.randomUUID()));
    const visitorRecipe = (await read(outsider, 'working home')).workbench.recipes.find(row => row.id === 'recipe:hardened_steel').action;
    const revokeCraft = await Promise.all([
      homePost(maker, 'visitors/revoke', { grantId: craftInvite.effect.grantId }, undefined, await read(maker, 'working home')),
      post(outsider, visitorRecipe.path, visitorRecipe.body),
    ]);
    ok(revokeCraft[0]); assert([200,400].includes(revokeCraft[1].statusCode));
    const visitorInventory = await inventoryBoard(app.pool, { scope: 'account', id: outsider.account });
    const visitorMade = visitorInventory.stacks.find(row => row.templateId === 'mat:hardened_steel')?.qty || 0;
    const visitorScrap = visitorInventory.stacks.find(row => row.templateId === 'mat:scrap_steel')?.qty || 0;
    assert.equal(visitorMade, revokeCraft[1].statusCode === 200 ? 1 : 0); assert.equal(visitorScrap, visitorMade ? 0 : 4);
    assert.notEqual((await get(outsider, '/v1/city/home/interior?homeKey=working%20home')).statusCode, 200);
    assert.equal((await inventoryBoard(app.pool, { scope: 'account', id: maker.account })).stacks.find(row => row.templateId === 'mat:hardened_steel').qty, 1, 'Guest craft never spends host materials.');
    const saleItem = await award(owner), saleBoard = await owned(), heirCash = Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [ownerHeir.characterId])).rows[0].cash);
    await app.pool.query('UPDATE characters SET cash=100000 WHERE id=$1', [ownerHeir.characterId]);
    await ledger(app.pool, { characterId: ownerHeir.characterId, currency: 'cash', amount: 100000 - heirCash, reason: 'crime:home-native-sale-fixture' });
    ok(await post(owner, '/v1/deeds/list', { price: 10000 }));
    const saleStore = await Promise.all([homePost(owner, 'storage/store', { itemId: saleItem.id }, undefined, saleBoard), post(buyer, '/v1/deeds/buy/' + ownerHeir.characterId, {})]);
    ok(saleStore[1]); assert([200,400].includes(saleStore[0].statusCode));
    const saleRow = (await app.pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [saleItem.id])).rows[0];
    assert.equal(saleRow.owner_id, owner.account); assert.equal(saleRow.owner_scope, 'account');
    assert.equal(saleRow.state, saleStore[0].statusCode === 200 ? 'stored' : 'active');
    const buyerNew = await read(buyer); ok(await homePost(buyer, 'activate', {}, undefined, buyerNew));
    assert(!JSON.stringify(await read(buyer)).includes(saleItem.id));
    if (saleRow.state === 'stored') {
      const reclaim = ok(await get(owner, '/v1/city/home/recovery')).items.find(row => row.id === saleItem.id).action;
      ok(await post(owner, reclaim.path, reclaim.body));
    }
    // Four actual participants; simultaneous last-seat joins serialize under the home/activity locks.
    const fifth = await actor('Home Puzzle Fifth'), people = [buyer,owner,maker,outsider,fifth];
    ok(await homePost(buyer, 'layout', { room: { furniture:[{id:'chair',x:0,y:0},{id:'table',x:1,y:0},{id:'lamp',x:2,y:0},{id:'window',x:3,y:0}] } }));
    const activityOpened = ok(await homePost(buyer, 'activity/open', { puzzleId:'evening-notebook' }));
    for (const person of people.slice(1)) {
      const identity = await currentViewer(person), invitation = ok(await homePost(buyer, 'visitors/invite', { targetCharacterId:identity.characterId,rights:['visit'] }));
      const accept = ok(await get(person, '/v1/city/home/invitations')).invitations.find(row => row.id === invitation.effect.grantId).action;
      ok(await post(person, accept.path, accept.body));
    }
    const issuedJoin = async person => (await read(person)).activity.active.actions.find(row => row.id === 'activity-join');
    for (const person of people.slice(0,3)) { const join = await issuedJoin(person); ok(await post(person, join.path, { ...join.body,consent:true })); }
    const lastJoins = await Promise.all(people.slice(3).map(async person => { const join = await issuedJoin(person); return post(person, join.path, { ...join.body,consent:true }); }));
    assert.equal(lastJoins.filter(reply => reply.statusCode === 200).length, 1); assert.equal(lastJoins.filter(reply => reply.json().error === 'home_activity_full').length, 1);
    assert.equal((await read(buyer)).activity.active.roster.length, 4);
    const ownAnswer = (await read(owner)).activity.active.cells.find(cell => cell.furnishingId === 'chair').action;
    const ownerGrant = (await read(buyer)).visitors.find(row => row.characterId === ownerHeir.characterId && row.status === 'active').action;
    const activityRevocation = await Promise.all([post(buyer, ownerGrant.path, ownerGrant.body),post(owner, ownAnswer.path, ownAnswer.body)]);
    ok(activityRevocation[0]); assert([200,400].includes(activityRevocation[1].statusCode));
    const departed = (await app.pool.query('SELECT step,status FROM city_home_activity_members WHERE activity_id=$1 AND account_id=$2', [activityOpened.effect.activityId,owner.account])).rows[0];
    assert.equal(departed.status, 'left'); assert.equal(Number(departed.step), activityRevocation[1].statusCode === 200 ? 1 : 0);
    assert.notEqual((await post(owner, ownAnswer.path, ownAnswer.body)).statusCode, 200);
    const hostAnswer = (await read(buyer)).activity.active.cells.find(cell => cell.furnishingId === 'chair').action;
    const hostDeath = await Promise.allSettled([post(buyer,hostAnswer.path,hostAnswer.body),
      withTwoCharacters(app.pool,maker.account,buyer.id,async (_killer,victim,client,h) => runEstate(client,h,victim,'Hosted puzzle death race'), {meet:false})]);
    assert.equal(hostDeath[1].status,'fulfilled');
    assert.equal(hostDeath[0].status,'fulfilled'); assert([200,400,409].includes(hostDeath[0].value.statusCode));
    assert.equal((await app.pool.query('SELECT status FROM city_home_activities WHERE id=$1', [activityOpened.effect.activityId])).rows[0].status,'closed');
    const deadParticipation = (await app.pool.query('SELECT status FROM city_home_activity_members WHERE activity_id=$1 AND account_id=$2', [activityOpened.effect.activityId,buyer.account])).rows[0];
    assert.equal(deadParticipation.status,'left');
  }
  // Actual signer and canonical event adapters; local fixtures never call an RPC or submit a transaction.
  process.env.CHAIN_ID = '46630'; process.env.STREET_DEED_ADDRESS = '0x3333333333333333333333333333333333333333';
  process.env.VOUCHER_SIGNER_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const { requestDeedWithdraw,markDeedExtracted,recordDeedTransfer,reimportDeed,sweepDeedVouchers,recoverStrandedDeed,DEED_VOUCHER_TYPES } = await import('../src/chain.js');
  const { recoverTypedDataAddress } = await import('viem'), { privateKeyToAccount } = await import('viem/accounts');
  const issuer = 'home-chain-issuer-' + crypto.randomUUID(), receiver = 'home-chain-receiver-' + crypto.randomUUID();
  const issuerWallet = '0x' + crypto.randomBytes(20).toString('hex'), receiverWallet = '0x' + crypto.randomBytes(20).toString('hex');
  for (const [id,wallet] of [[issuer,issuerWallet],[receiver,receiverWallet]]) {
    await app.pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,\'home-chain-fixture\',$1)', [id]);
    await app.pool.query('INSERT INTO account_persistent(account_id,wallet_address,minted) VALUES($1,$2,true)', [id,wallet]);
  }
  const chainName = 'Authority ' + crypto.randomUUID(), chainKey = chainName.toLowerCase(), originalToken = crypto.randomUUID();
  await app.pool.query('INSERT INTO street_deeds(account_id,name,name_lc,district,home_authority_token) VALUES($1,$2,$3,\'foundry\',$4)', [issuer,chainName,chainKey,originalToken]);
  const chainRow = async () => (await app.pool.query('SELECT * FROM street_deeds WHERE name_lc=$1', [chainKey])).rows[0];
  const noMint = Number((await app.pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n);
  await assert.rejects(requestDeedWithdraw(app.pool,issuer,issuerWallet,{attest:false}), error => error.code === 'attestation');
  assert.equal((await chainRow()).home_authority_token, originalToken);
  const voucher = await requestDeedWithdraw(app.pool,issuer,issuerWallet,{attest:true}), reservedToken = (await chainRow()).home_authority_token;
  assert.notEqual(reservedToken, originalToken);
  const signedBy = await recoverTypedDataAddress({ domain:{name:'OmertaStreetDeed',version:'1',chainId:46630,verifyingContract:process.env.STREET_DEED_ADDRESS},
    types:DEED_VOUCHER_TYPES,primaryType:'DeedVoucher',message:{...voucher.voucher,nonce:BigInt(voucher.voucher.nonce),deadline:BigInt(voucher.voucher.deadline)},signature:voucher.signature });
  assert.equal(signedBy.toLowerCase(),privateKeyToAccount(process.env.VOUCHER_SIGNER_PK).address.toLowerCase());
  await markDeedExtracted(app.pool,{nonce:voucher.nonce,tokenId:voucher.tokenId}); const extractedToken = (await chainRow()).home_authority_token;
  assert.notEqual(extractedToken,reservedToken);
  await markDeedExtracted(app.pool,{nonce:voucher.nonce,tokenId:voucher.tokenId}); assert.equal((await chainRow()).home_authority_token,extractedToken,'Repeated extraction does not create a fake ownership event.');
  await recordDeedTransfer(app.pool,{tokenId:voucher.tokenId,from:issuerWallet,to:receiverWallet}); const transferredToken = (await chainRow()).home_authority_token;
  assert.notEqual(transferredToken,extractedToken);
  await recordDeedTransfer(app.pool,{tokenId:voucher.tokenId,from:issuerWallet,to:receiverWallet}); assert.equal((await chainRow()).home_authority_token,transferredToken);
  await reimportDeed(app.pool,{ref:'home-event:' + crypto.randomUUID() + ':0',from:receiverWallet,tokenId:voucher.tokenId});
  const returned = await chainRow(); assert.equal(returned.account_id,receiver); assert.notEqual(returned.home_authority_token,transferredToken);
  const expiry = await requestDeedWithdraw(app.pool,receiver,receiverWallet,{attest:true}), expiringToken = (await chainRow()).home_authority_token;
  await app.pool.query('UPDATE vouchers SET deadline=0 WHERE id=$1', [expiry.id]);
  const swept = await sweepDeedVouchers(app.pool,{usedNonce:async () => false}); assert.equal(swept.cleared,1);
  const cleared = await chainRow(); assert.equal(cleared.onchain_token_id,null); assert.notEqual(cleared.home_authority_token,expiringToken);
  const stranded = await requestDeedWithdraw(app.pool,receiver,receiverWallet,{attest:true});
  await markDeedExtracted(app.pool,{nonce:stranded.nonce,tokenId:stranded.tokenId});
  const unlinked = '0x' + crypto.randomBytes(20).toString('hex'), strandedRef = 'home-stranded:' + crypto.randomUUID() + ':0';
  await reimportDeed(app.pool,{ref:strandedRef,from:unlinked,tokenId:stranded.tokenId});
  await app.pool.query('UPDATE deed_reimports SET created_at=$2 WHERE ref=$1', [strandedRef,new Date(0)]);
  process.env.DEED_RECOVERY_ADDRESS = receiverWallet;
  const strandedBefore = (await chainRow()).home_authority_token; await recoverStrandedDeed(app.pool,{tokenId:stranded.tokenId});
  assert.notEqual((await chainRow()).home_authority_token,strandedBefore,'Recovery voucher reservation retires the former home identity.');
  assert.equal(Number((await app.pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n),noMint,'Home epochs never change the signer/chain currency ledger.');
  console.log('Home authority PASS: actual signed reservation, extraction/replay, observed owner change/replay, reimport, confirmed-unused voucher clear and stranded reservation; historical deadline/burn fixtures seeded, elapsed grace/age and deployed chain activation not claimed.');
  const checks = (await runLedgerInvariants(app.pool, { alert: false })).checks.filter(check => ['world graph stack conservation','world graph unique custody and provenance'].includes(check.name));
  assert.equal(checks.length, 2); for (const check of checks) assert.equal(check.ok, true, JSON.stringify(check));
  console.log('city-home-interiors-api PASS: real activation/layout, explicit invite/accept/revoke/leave, private owner storage, own-input canonical workbench, opt-in furnishing puzzles with private outcomes and no economic effects, sale/same-day rebuy and original-account recovery, actual estate/retirement, late receipt rollback and committed-ACK recovery; ' +
    (postgres ? 'actual owned-schema PostgreSQL duplicate/consume/assignment/escrow/storage-and-puzzle-last-slot/opposite-invite/revoke-craft/sale-store/puzzle-revoke/host-death contention and canonical custody invariants' : 'pg-mem functional/compensation evidence only; native locking and restart durability not claimed'));
} finally {
  if (app) await app.close();
  if (admin) {
    if (createdSchema) {
      assert(/^city_homes_[a-f0-9]{16}$/.test(namespace));
      const ownership = (await admin.query('SELECT nspowner=current_user::regrole AS mine FROM pg_namespace WHERE nspname=$1', [namespace])).rows[0];
      assert.equal(ownership?.mine, true); await admin.query(`DROP SCHEMA ${namespace} CASCADE`);
    }
    await admin.end();
  }
}
