// Agent-interface regressions. Exercises the published MCP process over stdio against a real local
// HTTP server, so the assertions cover the same headers and session behavior an MCP host receives.
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

async function localApi() {
  const requests = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    requests.push({ method: req.method, path: req.url, headers: req.headers,
      body: raw ? JSON.parse(raw) : undefined });
    res.setHeader('content-type', 'application/json');
    if (req.url === '/v1/auth/guest') return res.end(JSON.stringify({ token: 'guest-token' }));
    if (req.url === '/v1/auth/agent-key') return res.end(JSON.stringify({ token: 'agent-token' }));
    if (req.url === '/v1/session') return res.end(JSON.stringify({ authed: true, hasCharacter: true }));
    if (req.url === '/v1/agent/turn') return res.end(JSON.stringify({
      turnId: 'turn_current',
      recommendedActionId: 'crime:pick:standard',
      actions: [{
        id: 'crime:pick:standard', kind: 'crime', method: 'POST', path: '/v1/crimes/pick',
        body: { approach: 'standard' }, executable: true,
      }, {
        id: 'crew:open', kind: 'crew_recruiting', method: 'POST', path: '/v1/crew/recruiting',
        body: { on: true }, executable: true,
      }],
    }));
    if (req.url === '/v1/agent/act') return res.end(JSON.stringify({
      actionId: raw ? JSON.parse(raw).actionId : null,
      result: { ok: true },
      turn: { turnId: 'turn_next', recommendedActionId: null, actions: [] },
    }));
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return { requests, base: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((e) => e ? reject(e) : resolve())) };
}

async function mcpProcess(base, sessionFile) {
  const child = spawn(process.execPath, ['index.js'], {
    cwd: new URL('../omerta-mcp/', import.meta.url),
    env: { ...process.env, OMERTA_BASE_URL: base, OMERTA_SESSION_FILE: sessionFile, OMERTA_TOKEN: '' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let seq = 0, stdout = '', stderr = '';
  const pending = new Map();
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
    while (stdout.includes('\n')) {
      const at = stdout.indexOf('\n');
      const line = stdout.slice(0, at).trim();
      stdout = stdout.slice(at + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      const waiter = pending.get(msg.id);
      if (waiter) { pending.delete(msg.id); waiter.resolve(msg); }
    }
  });
  child.on('exit', (code) => {
    for (const waiter of pending.values()) waiter.reject(new Error(`MCP exited ${code}: ${stderr}`));
    pending.clear();
  });
  const request = (method, params) => new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`MCP timeout for ${method}: ${stderr}`)); }, 5000);
    pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
  const init = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {},
    clientInfo: { name: 'omerta-test', version: '1.0.0' } });
  if (init.error) throw new Error(JSON.stringify(init.error));
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  return {
    serverInfo: init.result.serverInfo,
    async call(name, args = {}) {
      const reply = await request('tools/call', { name, arguments: args });
      if (reply.error) throw new Error(JSON.stringify(reply.error));
      return JSON.parse(reply.result.content[0].text);
    },
    async stop() {
      child.stdin.end();
      if (child.exitCode == null) child.kill();
      await new Promise((resolve) => child.once('exit', resolve));
    },
  };
}

const dir = await mkdtemp(join(tmpdir(), 'omerta-mcp-test-'));
const sessionFile = join(dir, 'session.json');
const api = await localApi();
let mcp;
try {
  mcp = await mcpProcess(api.base, sessionFile);
  assert.equal(mcp.serverInfo.version, '1.3.0',
    'the MCP handshake version stays aligned with the published package version');
  const started = await mcp.call('omerta_start');
  assert.match(started.next, /omerta_turn/, 'new agent sessions are directed to the compact turn loop');
  await mcp.call('omerta_request', { method: 'POST', path: '/v1/action', operationId: 'bodyless-1' });
  const action = api.requests.find((r) => r.path === '/v1/action');
  assert.ok(action?.headers['idempotency-key'], 'a bodyless mutation carries an idempotency key');

  await mcp.call('omerta_request', { method: 'POST', path: '/v1/repeat', body: { move: 'collect' }, operationId: 'collect-1' });
  await mcp.call('omerta_request', { method: 'POST', path: '/v1/repeat', body: { move: 'collect' }, operationId: 'collect-2' });
  const repeats = api.requests.filter((r) => r.path === '/v1/repeat');
  assert.notEqual(repeats[0].headers['idempotency-key'], repeats[1].headers['idempotency-key'],
    'two intentional identical mutations receive different idempotency keys');

  const firstTry = await mcp.call('omerta_request', { method: 'POST', path: '/v1/retry', body: { move: 'ship' } });
  assert.ok(firstTry.operationId, 'a mutation returns the operation id needed for an explicit retry');
  await mcp.call('omerta_request', { method: 'POST', path: '/v1/retry', body: { move: 'ship' }, operationId: firstTry.operationId });
  const retries = api.requests.filter((r) => r.path === '/v1/retry');
  assert.equal(retries[0].headers['idempotency-key'], retries[1].headers['idempotency-key'],
    'reusing the returned operation id retries with the same idempotency key');

  const turn = await mcp.call('omerta_turn');
  assert.equal(turn.body?.actions?.[0]?.id, 'crime:pick:standard', 'the MCP exposes the compact agent turn');
  const acted = await mcp.call('omerta_act', { operationId: 'turn-action-1' });
  assert.equal(acted.status, 200, 'the MCP executes the latest turn\'s server-recommended action when no id is supplied');
  const turnAction = api.requests.find((r) => r.path === '/v1/agent/act');
  assert.deepEqual(turnAction.body, { turnId: 'turn_current', actionId: 'crime:pick:standard' },
    'the MCP delegates execution to the server with the latest snapshot authority');
  assert.ok(turnAction.headers['idempotency-key'], 'turn actions retain mutation idempotency protection');
  const staleAction = await mcp.call('omerta_act', { actionId: 'crew:open' });
  assert.equal(staleAction.error, 'unknown_action',
    'a successful mutation invalidates every sibling action so the agent must refresh before acting again');

  const guestAuths = api.requests.filter((r) => r.path === '/v1/auth/guest').length;
  await mcp.stop();
  mcp = null;
  mcp = await mcpProcess(api.base, sessionFile);
  const resumed = await mcp.call('omerta_start');
  assert.equal(api.requests.filter((r) => r.path === '/v1/auth/guest').length, guestAuths,
    'restarting the MCP reuses the persisted agent identity instead of creating another guest');
  assert.equal(resumed.resumed, true, 'the start response identifies a resumed session');

  await mcp.stop();
  mcp = null;
  await writeFile(sessionFile, '{not-json', 'utf8');
  mcp = await mcpProcess(api.base, sessionFile);
  const corrupt = await mcp.call('omerta_start');
  assert.equal(corrupt.error, 'session_invalid', 'a corrupt durable session fails closed');
  assert.equal(api.requests.filter((r) => r.path === '/v1/auth/guest').length, guestAuths,
    'a corrupt session never creates a replacement identity silently');

  await mcp.stop();
  mcp = null;
  await writeFile(sessionFile, `${JSON.stringify({ version: 1, base: 'https://another-city.invalid', token: 'other-token' })}\n`, 'utf8');
  mcp = await mcpProcess(api.base, sessionFile);
  const wrongOrigin = await mcp.call('omerta_start');
  assert.equal(wrongOrigin.error, 'session_invalid', 'a session bound to another API origin fails closed');
  assert.equal(api.requests.filter((r) => r.path === '/v1/auth/guest').length, guestAuths,
    'an origin mismatch never overwrites the existing identity with a new guest');
} finally {
  if (mcp) await mcp.stop();
  await api.close();
  await rm(dir, { recursive: true, force: true });
}

console.log('✅ MCP agent-interface regressions passed');
