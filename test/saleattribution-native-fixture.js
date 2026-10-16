import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fixture as originalFixture } from './saleattribution-fixture.js';
import { canonicalDatabaseSnapshot } from '../tools/rc1-native-proof.js';

// This native phase admits only the original reviewed N16 component and its six
// explicit shared proposals. A future canonical integration needs a new review.
export const SALE_ATTRIBUTION_NATIVE_SOURCES = Object.freeze({
  'src/saleattribution.js': 'e4d9d85e4b10b772e96805c5f12ab6a0a84a8c36592d2e4a56aabc07d8fa6e62',
  'src/consignments.js': 'c50a65f6b37c9669f24d11f37dbcba383ce354be199755947faa893ad210f08c',
  'src/social/estate.js': '9fa055b2fed8125903093122b1741a51e838a5f910f5b8f0f53b793595bd60d3',
  'src/server.js': '35d705293399bdebc4882d256ad499030a95b0cbef59844f5a319f44432e0819',
  'src/invariants.js': '50b5e24d896a05ac5cbb190ec01b9757902159d2022d7ef3f388ac97289cce70',
  'src/agentgateway.js': '0400f3738c5bd77ac5400d3622e3f68923b90adeb2f8eb0b559574929bf3f87a',
  'schema.sql': '79e9a4461519290fb18e68166db7031f30c5f99d61434bc8f8cb14da50b0141e',
  'src/items.js': 'e7d0661997cd2fe9360ed93b62b3cd10bc4ef16bf2e5f9dfa93522857b8401f4',
  'src/db.js': 'dabe71959257fe28a99c08be900e5b9ad0979144af41a121b0fcab24f9326808',
  'src/game.js': 'f429d6f54255e20b7b123efb20802a9ce70701c422620693ff702c9deb2424f0',
  'src/crafting.js': 'e5782603de2b4216af40176b4808589811241f6db2bbf849e7a57ea497ddbd56',
  'test/lib/consignments-fixture.js': 'a8d0154e636c23f81d6e56aaa8a591a5b41fda8ce4fa0d2468efa1b6946ad63e',
  'test/saleattribution-fixture.js': 'e54e6b0ca2bdb410001ea14a6e415dd1203754a0dc0046a9448fffbb98c6290b',
});
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export function assertSaleAttributionNativeBytes(text, expected) {
  const lf = text.replaceAll('\r\n', '\n');
  assert(text === lf || text === lf.replaceAll('\n', '\r\n'), 'Uniform source line representation required');
  assert.equal(hash(lf), expected, 'Complete original N16 phase source required');
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
export function assertSaleAttributionNativeMode(argv, environment) {
  assert.equal(argv.length, 3); assert.equal(argv[2], '--postgres');
  assert(!Object.hasOwn(environment, 'DATABASE_URL'), 'No ambient database authority');
  assert.equal(environment.RESOURCE_ECONOMY, 'off'); assert.equal(environment.CHAIN_ENABLED, 'off');
  for (const key of Object.keys(environment)) assert(!['NODE_OPTIONS', 'NODE_PATH'].includes(key.toUpperCase()), 'No preload source authority');
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
export async function nativeFixture() {
  assertSaleAttributionNativeMode(process.argv, process.env);
  for (const [file, pin] of Object.entries(SALE_ATTRIBUTION_NATIVE_SOURCES))
    assertSaleAttributionNativeBytes(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'), pin);
  const context = saleAttributionNativeEndpoint(process.env.CONSIGNMENT_TEST_DATABASE_URL);
  // Attest the owned backend before the unchanged original fixture migrates or seeds it.
  const { default: pg } = await import('pg'), probe = new pg.Client({ connectionString: context.url.href });
  try {
    await probe.connect();
    const backend = (await probe.query("SELECT current_user AS role,current_database() AS database,current_setting('server_version') AS version,current_setting('data_directory') AS directory,(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()) AS owner")).rows[0];
    assertSaleAttributionNativeBackend(backend, context);
  } finally { await probe.end(); }
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

// Observe real successful INSERT allocations on the actual branded client; no
// query result, capability, client identity or runtime callback is fabricated.
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
