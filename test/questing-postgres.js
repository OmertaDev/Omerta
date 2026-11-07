// Native-only questing evidence. No DATABASE_URL fallback, RPC, signer, or live database access.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function questingPostgresTarget(raw) {
  if (!raw) throw new Error('Set QUESTING_TEST_DATABASE_URL to a disposable loopback omerta_questing* PostgreSQL database; pg-mem is not accepted.');
  let endpoint;
  try { endpoint = new URL(raw); } catch { throw new Error('QUESTING_TEST_DATABASE_URL must be a valid PostgreSQL URL.'); }
  if (!['postgres:', 'postgresql:'].includes(endpoint.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
    || !/^\/omerta_questing[a-z0-9_]*$/i.test(endpoint.pathname)
    || endpoint.pathname.length > 64 || endpoint.search || endpoint.hash) {
    throw new Error('Use a loopback PostgreSQL URL with an omerta_questing* database and no URL option overrides.');
  }
  return { endpoint, database: endpoint.pathname.slice(1) };
}

export async function runQuestingPostgres(raw = process.env.QUESTING_TEST_DATABASE_URL) {
  const { endpoint, database } = questingPostgresTarget(raw);
  const { Pool } = await import('pg');
  const { dbCaps, migrateSchemaUnderLock } = await import('../src/db.js');
  const { withCharacter } = await import('../src/game.js');
  const { QUEST_SAGA_PACKS } = await import('../src/content/quest-saga.js');
  const { compileContentPack } = await import('../src/content/compiler.js');
  const {
    activateContentBundle, actOnContentInstance, addContentCaseNote, claimContentRewards,
    contentBoard, contentInstanceBoard, createContentInstance, joinContentInstance, releaseContentRole,
  } = await import('../src/content/runtime.js');
  const { createQuestWorkshopService } = await import('../src/quest-workshop.js');
  const schema = `questing_native_${crypto.randomBytes(8).toString('hex')}`;
  assert.match(schema, /^questing_native_[a-f0-9]{16}$/);
  // Pin localhost to a literal address; neither DNS nor PGHOST/URL options may redirect the test.
  const connection = { host: endpoint.hostname === '[::1]' ? '::1' : '127.0.0.1',
    port: Number(endpoint.port || 5432), database,
    ...(endpoint.username ? { user: decodeURIComponent(endpoint.username) } : {}),
    ...(endpoint.password ? { password: decodeURIComponent(endpoint.password) } : {}),
    ssl: false, connectionTimeoutMillis: 5000 };
  const admin = new Pool({ ...connection, max: 2 });
  const scoped = { ...connection, max: 6,
    options: `-c search_path=${schema} -c statement_timeout=15000 -c lock_timeout=10000 -c idle_in_transaction_session_timeout=20000` };
  const pool = new Pool(scoped), peer = new Pool(scoped);
  const priorCaps = { ...dbCaps };
  let created = false, primaryFailure = null;
  const packs = new Map(QUEST_SAGA_PACKS.filter(pack => ['sixth-envelope', 'rival-accord'].includes(pack.runtime.experienceId))
    .map(pack => [pack.runtime.experienceId, pack]));
  const as = (who, fn, db = pool) => withCharacter(db, who.accountId, fn);
  const read = (who, id, db = pool) => as(who, (ch, client, h) => contentInstanceBoard(ch, id, client, h), db);
  const mutate = (who, board, fn, input = {}, db = pool) => as(who, (ch, client, h) => fn(ch, board.instance.id,
    { expectedRevision: board.instance.revision, ...input }, client, h), db);
  const act = (who, board, action, input = {}, db = pool) => mutate(who, board, actOnContentInstance, { actionId: action.id, ...input }, db);
  const reject = (action, code) => assert.rejects(action, error => error.code === code);
  const log = message => console.log(`PASS ${message}`);
  const raceSummary = results => results.map(result => result.status === 'fulfilled' ? 'committed' : result.reason?.code || result.reason?.message);
  function oneWinner(results, code, label) {
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1, `${label}: ${JSON.stringify(raceSummary(results))}`);
    assert.equal(results.filter(result => result.status === 'rejected' && result.reason?.code === code).length, 1,
      `${label}: expected exactly one ${code}, got ${JSON.stringify(raceSummary(results))}`);
    return results.find(result => result.status === 'fulfilled').value;
  }
  async function identity(name) {
    const accountId = crypto.randomUUID(), characterId = crypto.randomUUID();
    await pool.query('INSERT INTO accounts (id,auth_provider,auth_subject) VALUES ($1,$2,$3)', [accountId, 'questing-native-test', accountId]);
    await pool.query('INSERT INTO account_persistent (account_id) VALUES ($1)', [accountId]);
    await pool.query('INSERT INTO characters (id,account_id,name,season) VALUES ($1,$2,$3,1)', [characterId, accountId, name]);
    return { accountId, characterId, name };
  }
  async function crew(members) {
    const id = crypto.randomUUID();
    await pool.query('INSERT INTO crews (id,name,leader_account) VALUES ($1,$2,$3)', [id, `Native ${id.slice(0, 8)}`, members[0].accountId]);
    for (const person of members) await pool.query('INSERT INTO crew_members (crew_id,account_id,name) VALUES ($1,$2,$3)', [id, person.accountId, person.name]);
    return id;
  }
  function create(who, name, opts = {}, db = pool) {
    return as(who, (ch, client, h) => createContentInstance(ch, packs.get(name).namespace, {
      scopeKind: 'crew', roleId: 'clerk', consent: true, agendaConsent: true, ...opts,
    }, client, h), db);
  }
  async function solve(who, board, action, choiceId) {
    if (action.kind === 'start_instance') return act(who, board, action);
    if (action.kind === 'choose') return act(who, board, action, { choiceId: choiceId || action.options.find(option => option.available).id });
    const pack = packs.get(board.instance.experienceId);
    const node = pack.nodes.find(candidate => candidate.id === action.nodeId);
    const spec = pack.nodes.find(candidate => candidate.id === node.payload.answerSpecId).payload;
    return act(who, board, action, { submission: spec.verifier === 'mapping' ? { assignments: spec.solution } : { ids: spec.solution } });
  }
  async function finish(people, instanceId, choices = {}) {
    for (let step = 0; step < 40; step++) {
      let progressed = false;
      for (const who of people) {
        const board = await read(who, instanceId);
        if (board.instance.status === 'completed') return board;
        const action = board.instance.actions[0];
        if (!action) continue;
        await solve(who, board, action, choices[action.nodeId]); progressed = true;
      }
      assert.ok(progressed, 'The actual authored graph must retain a satisfiable next contribution.');
    }
    assert.fail('The actual authored graph did not finish within its bounded action count.');
  }
  try {
    const proofConnection = await admin.connect();
    let server;
    try {
      // Docker port forwarding changes the server's interface address; the client's socket
      // still proves that this process connected only to its explicitly allowed loopback endpoint.
      assert.ok(['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(proofConnection.connection.stream.remoteAddress),
        'The client socket must connect only to loopback.');
      server = (await proofConnection.query('SELECT current_database() AS database, inet_server_addr()::text AS address, version() AS version')).rows[0];
    } finally { proofConnection.release(); }
    assert.equal(server.database, database);
    assert.match(server.version, /PostgreSQL/);
    await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    const boot = await pool.connect();
    let bootstrapFailure = null;
    try {
      await boot.query('SELECT pg_advisory_lock(hashtext($1))', [schema]);
      await migrateSchemaUnderLock(boot, {
        schemaText: fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'), compatibility: 'postgres',
      });
    } catch (error) { bootstrapFailure = error; throw error; }
    finally {
      try { await boot.query('SELECT pg_advisory_unlock(hashtext($1))', [schema]); }
      catch (error) {
        if (!bootstrapFailure) throw error;
        console.error(`Native bootstrap unlock also failed: ${error.code || error.message}`);
      } finally { boot.release(); }
    }
    Object.assign(dbCaps, { skipLocked: true, indexedTextArrayAny: true, timestampText: true });
    const firstConnection = await pool.connect(), secondConnection = await peer.connect();
    try {
      const firstPid = (await firstConnection.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      const secondPid = (await secondConnection.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      assert.notEqual(firstPid, secondPid, 'Concurrency must use independent native PostgreSQL connections.');
      console.log(JSON.stringify({ nativePostgres: true, database, schema, serverInterface: server.address, backendPids: [firstPid, secondPid], node: process.version, utc: new Date().toISOString() }));
    } finally { firstConnection.release(); secondConnection.release(); }
    for (const pack of packs.values()) {
      const bundle = compileContentPack(pack);
      await activateContentBundle(pool, { bundle, expectedHash: bundle.contentHash });
    }
    const clerk = await identity('Native Clerk'), courier = await identity('Native Courier');
    const replacement = await identity('Native Replacement'), delegate = await identity('Native Delegate');
    const outsider = await identity('Native Outsider');
    await crew([clerk, courier, replacement]); const rivalCrew = await crew([delegate, outsider]);
    let board = await create(clerk, 'sixth-envelope');
    const instanceId = board.instance.id;
    await reject(() => mutate(courier, board, joinContentInstance, { roleId: 'courier', consent: true }), 'agenda_consent_required');
    board = await mutate(courier, board, joinContentInstance, { roleId: 'courier', consent: true, agendaConsent: true });
    board = await read(clerk, instanceId); board = await solve(clerk, board, board.instance.actions[0]);
    const courierAgenda = packs.get('sixth-envelope').nodes.find(node => node.id === 'courier').payload.privateAgenda.prompt;
    assert.ok(!JSON.stringify(board).includes(courierAgenda));
    assert.ok(!board.instance.nodes.some(node => node.id === 'door-map'));
    board = await solve(clerk, board, board.instance.actions.find(action => action.nodeId === 'manifest'));
    assert.ok(board.instance.nodes.some(node => node.id === 'private-manifest'));
    assert.ok(!(await read(courier, instanceId)).instance.nodes.some(node => node.id === 'private-manifest'));
    log('actual Sixth Envelope consent, complementary private evidence, and private objectives');

    const noteRevision = board.instance.revision;
    const noteRace = await Promise.allSettled([
      mutate(clerk, board, addContentCaseNote, { text: 'The manifest confirms a triangle seal.' }, pool),
      mutate(courier, board, addContentCaseNote, { text: 'The route map assigns triangle seals to Bay Seven.' }, peer),
    ]);
    oneWinner(noteRace, 'stale_instance', 'simultaneous same-revision notes');
    assert.equal((await pool.query('SELECT revision FROM content_instances WHERE id=$1', [instanceId])).rows[0].revision, noteRevision + 1);
    assert.equal(Number((await pool.query("SELECT COUNT(*) AS n FROM content_instance_facts WHERE instance_id=$1 AND fact_key LIKE 'runtime.note:%'", [instanceId])).rows[0].n), 1);
    log('two accounts race one revision: exactly one note commits and the other transaction is stale');

    board = await read(clerk, instanceId);
    const originalContribution = (await pool.query('SELECT actor_account,result_json FROM content_instance_nodes WHERE instance_id=$1 AND node_id=$2', [instanceId, 'manifest'])).rows[0];
    await mutate(clerk, board, releaseContentRole);
    const released = await read(clerk, instanceId);
    assert.equal(released.instance.notes, undefined);
    await reject(() => mutate(clerk, released, addContentCaseNote, { text: 'Released membership gives no write authority.' }), 'not_member');
    board = await read(replacement, instanceId);
    board = await mutate(replacement, board, joinContentInstance, { roleId: 'clerk', consent: true, agendaConsent: true });
    assert.deepEqual((await pool.query('SELECT actor_account,result_json FROM content_instance_nodes WHERE instance_id=$1 AND node_id=$2', [instanceId, 'manifest'])).rows[0], originalContribution);
    assert.equal(board.instance.notes.length, 1);
    assert.equal(Number((await pool.query("SELECT COUNT(*) AS n FROM content_instance_facts WHERE instance_id=$1 AND fact_key LIKE 'runtime.handoff:%'", [instanceId])).rows[0].n), 2);
    board = await finish([replacement, courier], instanceId, { 'clerk-oath': 'preserve', 'courier-oath': 'anonymous' });
    assert.ok(board.instance.debrief.every(entry => entry.completed));
    log('self-release and replacement preserve original contribution, shared notes, and both audit events');

    const claimBoard = await read(replacement, instanceId);
    const claims = await Promise.allSettled([
      mutate(replacement, claimBoard, claimContentRewards, {}, pool),
      mutate(replacement, claimBoard, claimContentRewards, {}, peer),
    ]);
    assert.equal(oneWinner(claims, 'stale_instance', 'simultaneous same-account reward claims').claimed.length, 1);
    assert.equal(Number((await pool.query("SELECT COUNT(*) AS n FROM content_instance_effects WHERE instance_id=$1 AND subject_account=$2 AND state='applied'", [instanceId, replacement.accountId])).rows[0].n), 1);
    const exhausted = await read(replacement, instanceId);
    await reject(() => mutate(replacement, exhausted, claimContentRewards), 'nothing_to_claim');
    const courierClaim = await read(courier, instanceId);
    assert.equal((await mutate(courier, courierClaim, claimContentRewards)).claimed.length, 1);
    assert.equal(Number((await pool.query("SELECT COUNT(*) AS n FROM content_instance_effects WHERE instance_id=$1 AND state='applied'", [instanceId])).rows[0].n), 2);
    log('simultaneous reward requests apply one entitlement once; each current participant retains only their own claim');

    const invitation = { scopeKind: 'invitation', roleId: 'mediator', invitedAccountIds: [delegate.accountId] };
    await reject(() => create(clerk, 'rival-accord', { ...invitation, consent: false }), 'consent_required');
    await reject(() => create(clerk, 'rival-accord', { ...invitation, invitedAccountIds: [courier.accountId] }), 'quorum');
    board = await create(clerk, 'rival-accord', invitation);
    const rivalId = board.instance.id;
    assert.ok((await as(delegate, contentBoard)).lobbies.some(lobby => lobby.id === rivalId));
    assert.ok(!(await as(outsider, contentBoard)).lobbies.some(lobby => lobby.id === rivalId));
    await reject(() => read(outsider, rivalId), 'not_member');
    await reject(() => mutate(outsider, board, joinContentInstance, { roleId: 'delegate', consent: true }), 'wrong_organization');
    await reject(() => mutate(delegate, board, joinContentInstance, { roleId: 'delegate' }), 'consent_required');
    board = await mutate(delegate, board, joinContentInstance, { roleId: 'delegate', consent: true });
    board = await read(clerk, rivalId); board = await solve(clerk, board, board.instance.actions[0]);
    assert.ok(!board.instance.nodes.some(node => node.id === 'loan-record'));
    await pool.query('DELETE FROM crew_members WHERE account_id=$1', [delegate.accountId]);
    const beforeRefusal = board.instance.revision;
    await reject(() => solve(clerk, board, board.instance.actions[0]), 'wrong_organization');
    assert.equal((await pool.query('SELECT revision FROM content_instances WHERE id=$1', [rivalId])).rows[0].revision, beforeRefusal);
    assert.equal((await pool.query('SELECT state FROM content_instance_nodes WHERE instance_id=$1 AND node_id=$2', [rivalId, 'house-ledger'])).rows[0].state, 'available');
    await pool.query('INSERT INTO crew_members (crew_id,account_id,name) VALUES ($1,$2,$3)', [rivalCrew, delegate.accountId, delegate.name]);
    await finish([clerk, delegate], rivalId, { offer: 'sealed', 'sealed-response': 'accept' });
    log('actual Rival Accord restricts invitations and consent, rechecks organization membership, and rolls back rejected contributions');

    const workshop = createQuestWorkshopService({ pool }), otherWorkshop = createQuestWorkshopService({ pool: peer });
    const draft = { title: 'Native Ledger Mystery', templateId: 'missing-ledger', sceneId: 'docks', culpritId: 'courier', clueIds: ['courier_at_docks', 'tailor_at_canal'] };
    const firstDraft = await workshop.create(clerk.accountId, draft);
    for (let index = 1; index < 19; index++) await workshop.create(clerk.accountId, { ...draft, title: `Native Ledger Mystery ${index}` });
    oneWinner(await Promise.allSettled([
      workshop.create(clerk.accountId, { ...draft, title: 'Native Last Slot A' }),
      otherWorkshop.create(clerk.accountId, { ...draft, title: 'Native Last Slot B' }),
    ]), 'workshop_limit', 'concurrent final author slot');
    assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM quest_workshop_mysteries WHERE author_account_id=$1', [clerk.accountId])).rows[0].n), 20);
    const mysteryId = firstDraft.mystery.id;
    const published = await Promise.all([workshop.publish(clerk.accountId, mysteryId, {}), otherWorkshop.publish(clerk.accountId, mysteryId, {})]);
    assert.equal(+new Date(published[0].mystery.publishedAt), +new Date(published[1].mystery.publishedAt));
    await Promise.all([
      workshop.solve(delegate.accountId, mysteryId, { suspectId: 'courier' }),
      otherWorkshop.solve(delegate.accountId, mysteryId, { suspectId: 'tailor' }),
    ]);
    await Promise.all([workshop.rate(delegate.accountId, mysteryId, { stars: 3 }), otherWorkshop.rate(delegate.accountId, mysteryId, { stars: 5 })]);
    const play = (await pool.query('SELECT attempts,solved_at,stars FROM quest_workshop_plays WHERE mystery_id=$1 AND account_id=$2', [mysteryId, delegate.accountId])).rows[0];
    assert.equal(play.attempts, 2); assert.ok(play.solved_at); assert.ok([3, 5].includes(play.stars));
    assert.equal((await workshop.get(delegate.accountId, mysteryId)).mystery.ratings, 1);
    log('native workshop races enforce author cap, once-only publication, monotonic solving, and one rating per reader');
    assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM transactions')).rows[0].n), 0);
    console.log('PASS native PostgreSQL questing proof; real transactions and independent connections, no pg-mem fallback or economic movement.');
    return { nativePostgres: true, passed: true };
  } catch (error) { primaryFailure = error; throw error; }
  finally {
    Object.assign(dbCaps, priorCaps);
    await Promise.all([pool.end(), peer.end()]);
    try { if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); }
    catch (error) {
      if (!primaryFailure) throw error;
      console.error(`Native schema cleanup also failed: ${error.code || error.message}`);
    }
    finally { await admin.end(); }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await runQuestingPostgres(); }
  catch (error) { console.error(`Questing PostgreSQL proof FAILED: ${error.stack || error.message}`); process.exitCode = 1; }
}
