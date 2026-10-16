// Separate current-source phase; original historical helper and all payload oracles stay unchanged.
import assert from 'node:assert/strict';
import {admitCommerceCurrentLeaf} from '../tools/commerce-current-native-guard.js';
export function assertSaleAttributionNativeMode(argv, environment) {
  assert.equal(argv.length, 3); assert.equal(argv[2], '--postgres');
  assert(!Object.hasOwn(environment, 'DATABASE_URL'), 'No ambient database authority');
  assert.equal(environment.RESOURCE_ECONOMY, 'off'); assert.equal(environment.CHAIN_ENABLED, 'off');
  for (const key of Object.keys(environment)) assert(!['NODE_OPTIONS', 'NODE_PATH'].includes(key.toUpperCase()), 'No preload source authority');
}
export function saleAttributionNativeEndpoint(value) {
  const url = new URL(value);
  assert(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.equal(url.hostname, '127.0.0.1'); assert(!url.search && !url.hash);
  assert.match(url.pathname, /^\/consignment_test_[a-f0-9]{12}$/);
  const local = ['35439', '35449'].includes(url.port) && url.username === 'pilot_runner' && !url.password;
  const ci = url.port === '5432' && url.username === 'postgres' && url.password === 'pgcheck';
  assert(local || ci, 'Only the original owned consignment native profile is admitted');
  return { url, local };
}
export function assertSaleAttributionNativeBackend(backend, context) {
  assert.deepEqual(Object.keys(backend).sort(), ['database', 'directory', 'owner', 'role', 'version']);
  assert.equal(backend.role, context.url.username); assert.equal(backend.owner, context.url.username);
  assert.equal('/' + backend.database, context.url.pathname);
  assert.match(backend.version, context.local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
  assert.equal(typeof backend.directory, 'string'); assert(backend.directory.length);
  if (context.local) assert.equal(backend.directory.replaceAll('\\', '/'), context.url.port === '35439'
    ? 'C:/Users/Jorge/AppData/Local/Temp/omerta-economy-oct15-pg184'
    : 'C:/Users/Jorge/AppData/Local/Temp/omerta-employment-pg184-proof');
}
export async function nativeFixture(){
  assertSaleAttributionNativeMode(process.argv,process.env);
  const current=admitCommerceCurrentLeaf("N16",process.argv,process.env,process.execArgv);
  const context=saleAttributionNativeEndpoint(process.env.CONSIGNMENT_TEST_DATABASE_URL);
  assert.equal(context.url.href,current.u.href);
  const {default:pg}=await import('pg'),probe=new pg.Client({connectionString:context.url.href});
  try{await probe.connect();assertSaleAttributionNativeBackend((await probe.query("SELECT current_user AS role,current_database() AS database,current_setting('server_version') AS version,current_setting('data_directory') AS directory,(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()) AS owner")).rows[0],context);}finally{await probe.end();}
  const {canonicalDatabaseSnapshot}=await import('../tools/rc1-native-proof.js');
  const {fixture:originalFixture}=await import("./saleattribution-fixture.js");
  const f = await originalFixture(); assert.equal(f.native, true);
  let serial = 0;
  const prepare = async () => {
    const suffix = ++serial, openKey = 'native-open-' + suffix;
    const sale = await f.list(), campaign = await f.act('owner', 'open', sale.open, openKey);
    await f.act('other', 'accept', f.ref(campaign), 'native-consent-' + suffix);
    const attribution = await f.act('buyer', 'attribute', f.ref(campaign), 'native-attribution-' + suffix);
    return { sale, campaign, attribution, openKey };
  };
  const books = async () => {
    await f.books(); assert.deepEqual(await f.C.collectConsignmentIssues(f.pool), []);
    const { runLedgerInvariants } = await import('../src/invariants.js');
    const result = await runLedgerInvariants(f.pool, { alert: false });
    assert.equal(result.ok, true, JSON.stringify(result.checks.filter(check => !check.ok)));
    return result.checks.length;
  };
  return { ...f, prepare, books, snapshot: () => canonicalDatabaseSnapshot(f.pool) };
}
export async function observeItemAllocations(client, events, execute, failBefore = null) {
  const query = client.query;
  client.query = async function (...args) {
    const sql = typeof args[0] === 'string' ? args[0] : args[0]?.text;
    if (failBefore?.(sql)) throw new Error('N16 native final ACK fault');
    const result = await query.apply(this, args);
    if (/^\s*INSERT INTO item_events\b/.test(sql || '')) {
      const row = (await query.call(this, 'SELECT id,sequence,event_kind,item_id FROM item_events WHERE id=$1', [args[1][0]])).rows[0];
      assert(row); events.push({ ...row, sequence: String(row.sequence) });
    }
    return result;
  };
  try { return await execute(); } finally { client.query = query; }
}
export function assertExactRollback(before, after, events) {
  assert.deepEqual(after.tables, before.tables, 'Every canonical row/table must roll back');
  const sequences = structuredClone(before.sequences);
  if (events.length) {
    assert.equal(new Set(events.map(row => row.id)).size, events.length);
    for (let n = 1; n < events.length; n++) assert(BigInt(events[n].sequence) > BigInt(events[n - 1].sequence));
    const sequence = sequences.find(row => row.sequencename === 'item_events_sequence_seq'); assert(sequence);
    sequence.last_value = events.at(-1).sequence;
  }
  assert.deepEqual(after.sequences, sequences, 'Only actually observed attempted item allocations survive rollback');
}
