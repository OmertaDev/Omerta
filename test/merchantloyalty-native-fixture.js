import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fixture as originalFixture } from './merchantloyalty-fixture.js';
import { canonicalDatabaseSnapshot } from '../tools/rc1-native-proof.js';

// Original N17 plus exactly the two reviewed N01/N10 postimages. Later shared
// integration requires its own complete source/proposal phase.
export const MERCHANT_LOYALTY_NATIVE_SOURCES = Object.freeze({
  'src/merchantloyalty.js': '8cf4b3e14f7f5f2ef0a798cd1e435bac4fdf50ea96c25a546b30032faf4bf700',
  'src/merchantloyalty-schema.js': 'd308b35bc3e40f617d22b152dd3e88fb59cc08bf1d9ad93003b27e47ce767145',
  'src/merchantloyalty-api.js': '6fcf5e451776b1b1790451b588ecedfe68cca2062b1912a343efae6b5fc9045c',
  'src/merchantloyalty-contracts.js': '89d4543cf9d3b3a578c445b6fa4a9416c74a08139477a9c780217f23a39d4724',
  'src/consignments.js': 'c50a65f6b37c9669f24d11f37dbcba383ce354be199755947faa893ad210f08c',
  'src/merchantreturns.js': 'e7c76a66fc213b3352e4a849c2c58f00eced1b6135ead40cfdc94927e6fdf362',
  'src/items.js': 'e7d0661997cd2fe9360ed93b62b3cd10bc4ef16bf2e5f9dfa93522857b8401f4',
  'src/db.js': 'dabe71959257fe28a99c08be900e5b9ad0979144af41a121b0fcab24f9326808',
  'src/game.js': 'f429d6f54255e20b7b123efb20802a9ce70701c422620693ff702c9deb2424f0',
  'src/crafting.js': 'e5782603de2b4216af40176b4808589811241f6db2bbf849e7a57ea497ddbd56',
  'src/social/estate.js': 'a068718c4ad88498a6288f85c413432a0c699ed5a0343ee3e4fdf36eadc6224e',
  'src/invariants.js': 'c7a827a027ae9ccd7cd5ccb97cae11d7b79152d82b504ebdc07cd729a0a03e0d',
  'schema.sql': 'd8016c8f0ccfe0caa29184a0df2d25d46e5a2597d143f33ac167382832418dc9',
  'test/merchantloyalty-fixture.js': '12960e45fca65e10fcce7d85c1da5f2bedae0b46a4a6330171d3c7d9c045437f',
  'test/lib/company-middle-five-fixture-schema.js': 'e551c1f704023cf0c4ac83cf5729dd921cfd8865acabc8f387e2dcdd16e91de7',
  'tools/rc1-native-proof.js': 'dfd5f10465ebe2da155595b7f41dc2127b2bf1dfb5b59e3c58f607b885e6066c',
});
export function assertMerchantLoyaltyNativeBytes(text, expected) {
  const lf = text.replaceAll('\r\n', '\n');
  assert(text === lf || text === lf.replaceAll('\n', '\r\n'), 'Uniform raw/Git source representation required');
  assert.equal(crypto.createHash('sha256').update(lf).digest('hex'), expected, 'Complete original source required');
}
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
export async function nativeFixture() {
  assertMerchantLoyaltyNativeMode(process.argv, process.env);
  for (const [file, pin] of Object.entries(MERCHANT_LOYALTY_NATIVE_SOURCES)) assertMerchantLoyaltyNativeBytes(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'), pin);
  const context = merchantLoyaltyNativeEndpoint(process.env.MERCHANT_LOYALTY_TEST_DATABASE_URL);
  const { default: pg } = await import('pg'), probe = new pg.Client({ connectionString: context.url.href });
  try {
    await probe.connect();
    assertMerchantLoyaltyNativeBackend((await probe.query("SELECT current_user AS role,current_database() AS database,current_setting('server_version') AS version,current_setting('data_directory') AS directory,(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()) AS owner")).rows[0], context);
  } finally { await probe.end(); }
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
// Instrumentation preserves the actual client/query/results and observes only
// successful canonical allocations. Hooks are test faults, not runtime authority.
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
