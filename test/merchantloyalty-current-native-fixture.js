// Separate current-source phase; original historical helper and all payload oracles stay unchanged.
import assert from 'node:assert/strict';
import {admitCommerceCurrentLeaf} from '../tools/commerce-current-native-guard.js';
export function assertMerchantLoyaltyNativeMode(argv, env) {
  assert.equal(argv.length, 3); assert.equal(argv[2], '--postgres');
  for (const key of Object.keys(env)) assert(!['DATABASE_URL','NODE_OPTIONS','NODE_PATH'].includes(key.toUpperCase()), 'No ambient database/preload authority');
  assert.equal(env.RESOURCE_ECONOMY, 'off'); assert.equal(env.CHAIN_ENABLED, 'off');
}
export function merchantLoyaltyNativeEndpoint(value) {
  const url = new URL(value);
  assert(['postgres:', 'postgresql:'].includes(url.protocol)); assert.equal(url.hostname, '127.0.0.1'); assert(!url.search && !url.hash);
  assert.match(url.pathname, /^\/merchant_loyalty_test_[a-f0-9]{12}$/);
  const local = url.port === '35439' && url.username === 'pilot_runner' && !url.password;
  const ci = url.port === '5432' && url.username === 'postgres' && url.password === 'pgcheck';
  assert(local || ci, 'Only the unchanged original N17 native profile'); return { url, local };
}
export function assertMerchantLoyaltyNativeBackend(row, context) {
  assert.deepEqual(Object.keys(row).sort(), ['database','directory','owner','role','version']);
  assert.equal(row.role, context.url.username); assert.equal(row.owner, context.url.username); assert.equal(row.database, context.url.pathname.slice(1));
  assert.match(row.version, context.local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
  assert.equal(typeof row.directory, 'string'); assert(row.directory.length);
  if (context.local) assert.equal(row.directory.replaceAll('\\', '/'), 'C:/Users/Jorge/AppData/Local/Temp/omerta-economy-oct15-pg184');
}
export async function nativeFixture(){
  assertMerchantLoyaltyNativeMode(process.argv,process.env);
  const current=admitCommerceCurrentLeaf("N17",process.argv,process.env,process.execArgv);
  const context=merchantLoyaltyNativeEndpoint(process.env.MERCHANT_LOYALTY_TEST_DATABASE_URL);
  assert.equal(context.url.href,current.u.href);
  const {default:pg}=await import('pg'),probe=new pg.Client({connectionString:context.url.href});
  try{await probe.connect();assertMerchantLoyaltyNativeBackend((await probe.query("SELECT current_user AS role,current_database() AS database,current_setting('server_version') AS version,current_setting('data_directory') AS directory,(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()) AS owner")).rows[0],context);}finally{await probe.end();}
  const {canonicalDatabaseSnapshot}=await import('../tools/rc1-native-proof.js');
  const {fixture:originalFixture}=await import("./merchantloyalty-fixture.js");
  const f = await originalFixture(); assert.equal(f.native, true);
  // This test-only unknown row exists before mutations; full-world snapshots must
  // preserve it as well as every canonical table. It has no gameplay authority.
  await f.pool.query('CREATE TABLE merchant_loyalty_native_unknown(marker TEXT PRIMARY KEY,value TEXT NOT NULL)');
  await f.pool.query("INSERT INTO merchant_loyalty_native_unknown VALUES('original','preserve unrelated row')");
  let serial = 0; const history = new Map();
  const prepare = async ({ buyer = 'buyer', terms = {}, program = null } = {}) => {
    const n = ++serial;
    if (!history.has(buyer)) history.set(buyer, [await f.ordinary({ buyer }), await f.ordinary({ buyer })]);
    const prior = history.get(buyer), p = program || await f.act('owner', 'create', { ...f.programTerms, ...terms }, 'native-program-' + n);
    const next = await f.listing(), q = await f.act(buyer, 'quote', f.quoteBody(p, next, prior), 'native-quote-' + n);
    return { n, prior, program: p, listing: next, quote: q, buyer };
  };
  const books = async () => {
    assert.deepEqual(await f.L.collectMerchantLoyaltyIssues(f.pool), []); assert.deepEqual(await f.C.collectConsignmentIssues(f.pool), []);
    const { runLedgerInvariants } = await import('../src/invariants.js'); const result = await runLedgerInvariants(f.pool, { alert: false });
    assert.equal(result.ok, true, JSON.stringify(result.checks.filter(c => !c.ok))); return result.checks.length;
  };
  const close = p => f.act('owner', 'close', { programId: p.programId, programSourceHash: p.programSourceHash, consent: true }, 'native-close-' + p.programId);
  return { ...f, prepare, books, close, snapshot: () => canonicalDatabaseSnapshot(f.pool) };
}
export async function observeItemAllocations(client, events, execute, afterQuery = null) {
  const query = client.query;
  client.query = async function (...args) {
    const sql = typeof args[0] === 'string' ? args[0] : args[0]?.text;
    const result = await query.apply(this, args);
    if (/^\s*INSERT INTO item_events\b/.test(sql || '')) {
      const row = (await query.call(this, 'SELECT id,sequence,event_kind,item_id FROM item_events WHERE id=$1', [args[1][0]])).rows[0];
      assert(row); events.push({ ...row, sequence: String(row.sequence) });
    }
    if (afterQuery) await afterQuery(sql, result, args);
    return result;
  };
  try { return await execute(); } finally { client.query = query; }
}
export function assertExactRollback(before, after, events) {
  assert.deepEqual(after.tables, before.tables, 'Every canonical and unknown row/table must roll back');
  const sequences = structuredClone(before.sequences);
  if (events.length) {
    assert.equal(new Set(events.map(e => e.id)).size, events.length);
    for (let n = 1; n < events.length; n++) assert(BigInt(events[n].sequence) > BigInt(events[n - 1].sequence));
    const sequence = sequences.find(s => s.sequencename === 'item_events_sequence_seq'); assert(sequence);
    sequence.last_value = events.at(-1).sequence;
  }
  assert.deepEqual(after.sequences, sequences, 'Only actual observed attempted item allocations may survive');
}
