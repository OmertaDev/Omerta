import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fixture as originalFixture } from './shoppingbasket-fixture.js';
import { canonicalDatabaseSnapshot } from '../tools/rc1-native-proof.js';

// Exact repaired N18 plus the original five proposed shared postimages.
// This component projection is separate from canonical integration/release.
export const SHOPPING_BASKET_NATIVE_SOURCES = Object.freeze({
  'src/shoppingbasket.js': '40a57a58f485354e31d5108252893aa122af6d97c73f3ae688f66f2bd0f903d6',
  'src/shoppingbasket-api.js': 'adb697191097ff5c82bac4bd57df6a61d97f52f62dfde4f1eb1681326261c3c4',
  'src/shoppingbasket-schema.js': '397eefe78eba764d04ab2541e8d6aaaa6766c310c836b453b43f38c89b561859',
  'src/shoppingbasket-contracts.js': '9c6157a797daa2b42cef54e73ade9606d3e6c7695d146ac663a24e0f3ad521b2',
  'src/consignments.js': '621a31a82542da25c2b4b20feca35151cf164053174fb0fb1a60cfdce1c06726',
  'src/server.js': 'bd0f7c0be770ee34b736378ffce6ccb1215c853376b87cb28fb98fec8b775738',
  'src/invariants.js': 'deefdaf8103401c762f9a100f1c205bbd116264b2cc63a44b7724aef5186c578',
  'src/agentgateway.js': '81287de690c5fc987195049853801a91e1373cc370261aaa0000f47e7dad9220',
  'schema.sql': '8f5317e64e8c3f54f20ed3981246dceacb2e617f0e75460c3f72b2af1a4f95e8',
  'src/items.js': 'e7d0661997cd2fe9360ed93b62b3cd10bc4ef16bf2e5f9dfa93522857b8401f4',
  'src/db.js': 'dabe71959257fe28a99c08be900e5b9ad0979144af41a121b0fcab24f9326808',
  'src/game.js': 'f429d6f54255e20b7b123efb20802a9ce70701c422620693ff702c9deb2424f0',
  'src/crafting.js': 'e5782603de2b4216af40176b4808589811241f6db2bbf849e7a57ea497ddbd56',
  'src/social/estate.js': 'a068718c4ad88498a6288f85c413432a0c699ed5a0343ee3e4fdf36eadc6224e',
  'src/merchantreturns.js': '178c4181a88e3a5c9a605a93712bc9f355808895f3bcb807b2324ee58e30bfd3',
  'test/shoppingbasket-fixture.js': '73eaee02af2af709a23a5bc707155f7b769d70f90f5dc2260b1f7e0e359eb074',
  'test/lib/company-middle-five-fixture-schema.js': 'e551c1f704023cf0c4ac83cf5729dd921cfd8865acabc8f387e2dcdd16e91de7',
  'tools/rc1-native-proof.js': 'dfd5f10465ebe2da155595b7f41dc2127b2bf1dfb5b59e3c58f607b885e6066c',
});
export function assertShoppingBasketNativeBytes(text, expected) {
  const lf = text.replaceAll('\r\n', '\n');
  assert(text === lf || text === lf.replaceAll('\n', '\r\n'), 'Uniform raw/Git source representation required');
  assert.equal(crypto.createHash('sha256').update(lf).digest('hex'), expected, 'Complete pinned source required');
}
export function assertShoppingBasketNativeMode(argv, env, execArgv = process.execArgv) {
  assert.equal(argv.length, 3); assert.equal(argv[2], '--postgres'); assert.equal(execArgv.length, 0, 'No process preloads');
  for (const key of Object.keys(env)) {
    const upper = key.toUpperCase();
    assert(!['DATABASE_URL', 'TEST_DATABASE_URL', 'NODE_OPTIONS', 'NODE_PATH', 'LEGAL_PROFILE_DEFER'].includes(upper)
      && !upper.startsWith('PG') && !(upper.endsWith('_DATABASE_URL') && upper !== 'SHOPPING_BASKET_TEST_DATABASE_URL'), 'No ambient database/preload/defer authority');
  }
  assert.equal(env.RESOURCE_ECONOMY, 'off'); assert.equal(env.CHAIN_ENABLED, 'off');
}
export function shoppingBasketNativeEndpoint(value) {
  const url = new URL(value);
  assert(['postgres:', 'postgresql:'].includes(url.protocol)); assert.equal(url.hostname, '127.0.0.1'); assert(!url.search && !url.hash);
  assert.match(url.pathname, /^\/shopping_basket_test_[a-f0-9]{12}$/);
  const local = url.port === '35439' && url.username === 'pilot_runner' && !url.password;
  const ci = url.port === '5432' && url.username === 'postgres' && url.password === 'pgcheck';
  assert(local || ci, 'Only the unchanged original N18 native profile'); return { url, local };
}
export function assertShoppingBasketNativeBackend(row, context) {
  assert.deepEqual(Object.keys(row).sort(), ['database', 'directory', 'owner', 'role', 'version']);
  assert.equal(row.role, context.url.username); assert.equal(row.owner, context.url.username); assert.equal(row.database, context.url.pathname.slice(1));
  assert.match(row.version, context.local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
  assert.equal(typeof row.directory, 'string'); assert(row.directory.length);
  if (context.local) assert.equal(row.directory.replaceAll('\\', '/'), 'C:/Users/Jorge/AppData/Local/Temp/omerta-economy-oct15-pg184');
}
export async function nativeFixture() {
  assertShoppingBasketNativeMode(process.argv, process.env);
  for (const [file, pin] of Object.entries(SHOPPING_BASKET_NATIVE_SOURCES)) assertShoppingBasketNativeBytes(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'), pin);
  const context = shoppingBasketNativeEndpoint(process.env.SHOPPING_BASKET_TEST_DATABASE_URL);
  const { default: pg } = await import('pg'), probe = new pg.Client({ connectionString: context.url.href });
  try {
    await probe.connect();
    assertShoppingBasketNativeBackend((await probe.query("SELECT current_user AS role,current_database() AS database,current_setting('server_version') AS version,current_setting('data_directory') AS directory,(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()) AS owner")).rows[0], context);
  } finally { await probe.end(); }
  const f = await originalFixture(); assert.equal(f.native, true);
  await f.pool.query('CREATE TABLE shopping_basket_native_unknown(marker TEXT PRIMARY KEY,value TEXT NOT NULL)');
  await f.pool.query("INSERT INTO shopping_basket_native_unknown VALUES('original','preserve unrelated row')");
  let serial = 0;
  const prepare = async (buyer = 'buyer') => {
    const n = ++serial, lines = await f.pair(), quote = await f.act(buyer, 'quote', f.quoteBody(lines), 'native-quote-' + n);
    return { n, lines, quote, buyer };
  };
  const books = async () => {
    await f.books();
    const { runLedgerInvariants } = await import('../src/invariants.js'), result = await runLedgerInvariants(f.pool, { alert: false });
    assert.equal(result.ok, true, JSON.stringify(result.checks.filter(c => !c.ok))); return result.checks.length;
  };
  const M = await import('../src/merchantreturns.js');
  return { ...f, M, prepare, books, snapshot: () => canonicalDatabaseSnapshot(f.pool) };
}
export async function observeItemAllocations(client, events, execute, afterQuery = null) {
  const query = client.query;
  client.query = async function (...args) {
    const sql = typeof args[0] === 'string' ? args[0] : args[0]?.text, result = await query.apply(this, args);
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
    const sequence = sequences.find(s => s.sequencename === 'item_events_sequence_seq'); assert(sequence); sequence.last_value = events.at(-1).sequence;
  }
  assert.deepEqual(after.sequences, sequences, 'Only actual observed attempted item allocations may survive');
}
