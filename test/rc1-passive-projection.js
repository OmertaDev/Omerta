// RC1-MOBILE-CONFIRM: passive screen telemetry must not invalidate a pending move.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { newDb } from 'pg-mem';
import { createProjectionEvents } from '../src/projection-events.js';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const main = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
const extract = (start, end) => main.slice(main.indexOf(start), main.indexOf(end, main.indexOf(start)));
const cleared = [];
const context = vm.createContext({ token: 'current', _authQueue: Promise.resolve(),
  apiNow: async () => ({ code: 200, body: { ok: true } }) });
vm.runInContext(extract('  function createProjectionRefresh(', '  // End projection refresh coordinator.')
  + '\nthis.create = createProjectionRefresh;', context);
context.projections = context.create({ request() {}, apply() {}, unauthorized() {}, clear: (kind) => cleared.push(kind) });
context.projections.setSession('current'); cleared.length = 0;
vm.runInContext(extract('  async function api(', '  async function apiNow(') + '\nthis.call = api;', context);
await context.call('POST', '/v1/screens', { screens: ['world'] });
await context.call('POST', '/v1/commands/observations', { phase: 'command_center', session: 'test' });
const clientClears = [...cleared]; cleared.length = 0;
await context.call('POST', '/v1/commands/execute', {});
assert(cleared.includes('world'), 'gameplay commands must still clear stale authority');

const { Pool } = newDb().adapters.createPg(), pool = new Pool();
const messages = [], bus = new EventEmitter();
const clients = new Map([['owner', new Set([{ readyState: 1, send: (message) => messages.push(JSON.parse(message)) }])]]);
const events = createProjectionEvents({ pool, bus, clients, enabled: true, objects: [] });
try {
  await pool.query('CREATE TABLE accounts(id TEXT PRIMARY KEY,status TEXT)');
  await pool.query("INSERT INTO accounts VALUES('owner','active')");
  for (const url of ['/v1/screens', '/v1/commands/observations']) {
    const request = { method: 'POST', routeOptions: { url } };
    await events.before(request, 'owner');
    await events.after(request, { statusCode: 200, getHeader() {} });
  }
  await events.settled();
  console.log(JSON.stringify({ passiveClientClears: clientClears, passiveServerHints: messages }));
  assert.deepEqual(clientClears, [], 'screen telemetry must not cancel a pending command confirmation');
  assert.deepEqual(messages, [], 'screen telemetry must not emit a websocket projection refresh');
  console.log('PASS RC1-MOBILE-CONFIRM: passive screen and command observations preserve confirmations; gameplay invalidation remains enabled');
} finally { await events.close(); await pool.end(); }
