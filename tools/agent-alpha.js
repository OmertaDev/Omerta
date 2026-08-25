#!/usr/bin/env node
// A finite, conservative Agent Turn client. Identity state is deliberately local and reports are
// deliberately lossy: the session owns the bearer token while telemetry owns no sensitive values.
import crypto from 'node:crypto';
import { appendFile, mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SESSION_VERSION = 1;
const MIN_INTERVAL_MS = 3100;
const POLICY = Object.freeze({
  cashReserve: 1000,
  minArbitrageProfit: 25,
  allowPvP: false,
  allowBorrowing: false,
});
const ALLOWED_KINDS = new Set([
  'onboard_claim', 'daily_claim', 'career_claim',
  'business_collect', 'territory_collect', 'kitchen_collect', 'convoy_collect',
  'convoy_travel', 'market_fill', 'arbitrage_buy', 'arbitrage_sell',
  'arbitrage_travel', 'loan_repay', 'crew_recruiting', 'crime',
]);

const defaultSleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

function originOf(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Agent Alpha base URL must be an HTTP(S) origin');
  }
  return url.origin;
}

async function pathExists(path) {
  try {
    await readFile(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function atomicJsonWrite(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`;
  let handle;
  let renamed = false;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(`${JSON.stringify(value)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, path);
    renamed = true;
    await syncDirectory(dirname(path));
  } catch (error) {
    await handle?.close().catch(() => {});
    if (!renamed) await unlink(temporary).catch((cleanupError) => {
      if (cleanupError?.code !== 'ENOENT') throw cleanupError;
    });
    throw error;
  }
}

async function syncDirectory(directory) {
  let handle;
  try {
    handle = await open(directory, 'r');
    await handle.sync();
  } catch (error) {
    // Windows does not expose directory fsync through Node on every filesystem. The temp file is
    // still flushed before rename there; POSIX hosts fail closed unless the directory entry syncs.
    const windowsUnsupported = process.platform === 'win32' &&
      ['EBADF', 'EINVAL', 'EISDIR', 'ENOTSUP', 'EPERM'].includes(error?.code);
    if (!windowsUnsupported) throw error;
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function appendReport(path, event) {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(event)}\n`, { encoding: 'utf8', mode: 0o600 });
}

async function requestJson(fetchImpl, base, path, { token, method = 'GET', body, idempotencyKey } = {}) {
  const headers = {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
  };
  const response = await fetchImpl(`${base}${path}`, {
    method,
    headers,
    redirect: 'manual',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (response.redirected || (response.status >= 300 && response.status < 400)) {
    throw new Error('Agent Alpha API redirects are forbidden by origin binding');
  }
  if (response.url && originOf(response.url) !== base) {
    throw new Error('Agent Alpha response escaped its bound origin');
  }
  let payload = null;
  try { payload = await response.json(); }
  catch { throw new Error(`Agent Alpha received non-JSON response (${response.status})`); }
  if (!response.ok) {
    const error = new Error(`Agent Alpha request failed (${response.status})`);
    error.status = response.status;
    error.code = typeof payload?.error === 'string' ? payload.error : 'http_error';
    error.payload = payload;
    throw error;
  }
  return payload;
}

function validName(name) {
  return typeof name === 'string' && name.trim() === name &&
    name.length >= 2 && name.length <= 24 && /^[\w .,'&-]+$/.test(name);
}

async function readSession(sessionFile) {
  let session;
  try { session = JSON.parse(await readFile(sessionFile, 'utf8')); }
  catch { throw new Error('Agent Alpha session is corrupt'); }
  const exactKeys = (value, keys) => value &&
    Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
  const pendingValid = session?.pending === null || (
    session?.pending &&
    exactKeys(session.pending, ['operationId', 'turnId', 'actionId', 'startedAt']) &&
    typeof session.pending.operationId === 'string' && session.pending.operationId &&
    typeof session.pending.turnId === 'string' && session.pending.turnId &&
    typeof session.pending.actionId === 'string' && session.pending.actionId &&
    typeof session.pending.startedAt === 'string' && session.pending.startedAt
  );
  if (!session || !exactKeys(session,
      ['version', 'base', 'phase', 'token', 'characterName', 'pending']) ||
      session.version !== SESSION_VERSION ||
      !['guest', 'initial_character_pending', 'agent'].includes(session.phase) ||
      typeof session.base !== 'string' ||
      typeof session.token !== 'string' || !session.token ||
      !validName(session.characterName) || !pendingValid) {
    throw new Error('Agent Alpha session is corrupt or missing required identity state');
  }
  return session;
}

function lockPort(sessionFile) {
  const identity = process.platform === 'win32'
    ? resolve(sessionFile).toLowerCase()
    : resolve(sessionFile);
  const digest = crypto.createHash('sha256').update(identity).digest();
  return 20000 + (digest.readUInt32BE(0) % 20000);
}

async function listenForLock(server, port) {
  await new Promise((resolveListen, rejectListen) => {
    const onError = (error) => {
      server.off('listening', onListening);
      rejectListen(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolveListen();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen({ host: '127.0.0.1', port, exclusive: true });
  });
}

async function closeLockServer(server) {
  if (!server.listening) return;
  await new Promise((resolveClose, rejectClose) => server.close((error) =>
    error ? rejectClose(error) : resolveClose()));
}

async function acquireLock(sessionFile) {
  await mkdir(dirname(sessionFile), { recursive: true });
  const path = `${sessionFile}.lock`;
  const port = lockPort(sessionFile);
  const server = createServer((socket) => socket.destroy());
  server.unref();
  try {
    await listenForLock(server, port);
  } catch (error) {
    if (error?.code === 'EADDRINUSE') {
      throw new Error('Agent Alpha session is locked by another live runner');
    }
    throw error;
  }

  const nonce = crypto.randomUUID();
  try {
    // The kernel-owned loopback lease is released on hard process death. Once it is acquired, any
    // leftover metadata is necessarily orphaned and can be replaced without PID-reuse/delete races.
    await atomicJsonWrite(path, {
      version: 1,
      sessionHash: crypto.createHash('sha256').update(resolve(sessionFile)).digest('hex'),
      port,
      pid: process.pid,
      nonce,
    });
  } catch (error) {
    await closeLockServer(server).catch(() => {});
    throw error;
  }
  return { path, nonce, server };
}

async function releaseLock(lock) {
  try {
    const current = JSON.parse(await readFile(lock.path, 'utf8'));
    if (current?.nonce === lock.nonce) {
      await unlink(lock.path);
      await syncDirectory(dirname(lock.path));
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  } finally {
    await closeLockServer(lock.server);
  }
}

async function createIdentity({ base, sessionFile, name, fetchImpl }) {
  if (!validName(name)) throw new Error('Explicit creation requires a valid 2-24 character name');
  const guest = await requestJson(fetchImpl, base, '/v1/auth/guest', { method: 'POST' });
  if (typeof guest?.token !== 'string' || !guest.token) {
    throw new Error('Guest creation returned no token');
  }
  let session = {
    version: SESSION_VERSION,
    base,
    phase: 'guest',
    token: guest.token,
    characterName: name,
    pending: null,
  };
  await atomicJsonWrite(sessionFile, session);

  const agent = await requestJson(fetchImpl, base, '/v1/auth/agent-key', {
    method: 'POST', token: session.token,
    idempotencyKey: operationKey(`agent-key\0${base}\0${session.token}`),
  });
  if (typeof agent?.token !== 'string' || !agent.token) {
    throw new Error('Agent-key creation returned no token');
  }
  session = { ...session, phase: 'initial_character_pending', token: agent.token };
  await atomicJsonWrite(sessionFile, session);

  await requestJson(fetchImpl, base, '/v1/character', {
    method: 'POST', token: session.token, body: { name },
    idempotencyKey: operationKey(`character\0${base}\0${session.token}\0${name}`),
  });
  return session;
}

async function ensureIdentity({ base, fetchImpl, sessionFile, session, requestedName }) {
  let probe = await requestJson(fetchImpl, base, '/v1/session', { token: session.token });
  if (!probe?.authed) throw new Error('Agent Alpha could not verify its bound session');

  if (session.phase === 'guest') {
    if (probe.hasCharacter) {
      throw new Error('Agent Alpha guest phase conflicts with an existing character');
    }
    const agent = await requestJson(fetchImpl, base, '/v1/auth/agent-key', {
      method: 'POST',
      token: session.token,
      idempotencyKey: operationKey(`agent-key\0${base}\0${session.token}`),
    });
    if (typeof agent?.token !== 'string' || !agent.token) {
      throw new Error('Agent-key creation returned no token');
    }
    session = { ...session, phase: 'initial_character_pending', token: agent.token };
    await atomicJsonWrite(sessionFile, session);
    probe = { ...probe, agent: true, hasCharacter: false, character: null };
  }

  if (!probe.agent) throw new Error('Agent Alpha session is not flagged as an agent');
  if (session.phase === 'initial_character_pending') {
    if (probe.hasCharacter) {
      if (probe.character?.name !== session.characterName) {
        throw new Error('Initial character does not match its pending bound name');
      }
      session = { ...session, phase: 'agent' };
      await atomicJsonWrite(sessionFile, session);
      return session;
    }
    if (requestedName !== undefined) {
      if (!validName(requestedName)) {
        throw new Error('Initial character name must use letters, numbers, and simple punctuation');
      }
      if (requestedName !== session.characterName) {
        session = { ...session, characterName: requestedName };
        await atomicJsonWrite(sessionFile, session);
      }
    }
    await requestJson(fetchImpl, base, '/v1/character', {
      method: 'POST',
      token: session.token,
      idempotencyKey: operationKey(
        `character\0${base}\0${session.token}\0${session.characterName}`),
      body: { name: session.characterName },
    });
    const confirmed = await requestJson(fetchImpl, base, '/v1/session', { token: session.token });
    if (!confirmed?.authed || !confirmed.agent || !confirmed.hasCharacter ||
        confirmed.character?.name !== session.characterName) {
      throw new Error('Initial character could not be confirmed under its bound name');
    }
    session = { ...session, phase: 'agent' };
    await atomicJsonWrite(sessionFile, session);
    return session;
  }

  if (!probe.hasCharacter) {
    throw new Error('Final agent has no living character; replacement is forbidden');
  }
  if (probe.character?.name !== session.characterName) {
    throw new Error('Agent Alpha session character does not match its bound identity');
  }
  return session;
}

function policyIsConservative(policy) {
  return policy && Object.entries(POLICY).every(([key, value]) => policy[key] === value);
}

function recommendationOf(turn) {
  if (!turn?.recommendedActionId) return { action: null, errorCode: null };
  const action = Array.isArray(turn.actions)
    ? turn.actions.find((candidate) => candidate?.id === turn.recommendedActionId)
    : null;
  if (!action || action.executable !== true || !ALLOWED_KINDS.has(action.kind)) {
    return { action: null, candidate: action, errorCode: 'unsafe_action' };
  }
  if (!policyIsConservative(turn.policy)) {
    return { action: null, candidate: action, errorCode: 'policy_mismatch' };
  }
  return { action, errorCode: null };
}

function operationKey(operationId) {
  return crypto.createHash('sha256').update(operationId).digest('hex');
}

async function settlePending({ base, fetchImpl, reportFile, sessionFile, session, actionKind }) {
  const pending = session.pending;
  let result;
  try {
    result = await requestJson(fetchImpl, base, '/v1/agent/act', {
      method: 'POST',
      token: session.token,
      idempotencyKey: operationKey(pending.operationId),
      body: { turnId: pending.turnId, actionId: pending.actionId },
    });
  } catch (error) {
    if (error?.status !== 409 || error?.code !== 'stale_turn') throw error;
    session = { ...session, pending: null };
    await atomicJsonWrite(sessionFile, session);
    await appendReport(reportFile, {
      timestamp: new Date().toISOString(),
      status: 'stale',
      errorCode: 'stale_turn',
      actionId: pending.actionId,
      ...(actionKind ? { actionKind } : {}),
    });
    return { session, status: 'stale', turn: error.payload?.turn || null };
  }

  session = { ...session, pending: null };
  await atomicJsonWrite(sessionFile, session);
  await appendReport(reportFile, {
    timestamp: new Date().toISOString(),
    status: 'executed',
    actionId: pending.actionId,
    ...(actionKind ? { actionKind } : {}),
  });
  return { session, status: 'executed', turn: result?.turn || null };
}

async function runUnlocked(options) {
  const base = originOf(options.baseUrl);
  const sessionFile = resolve(options.sessionFile);
  const reportFile = resolve(options.reportFile);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const sleep = options.sleep || defaultSleep;
  const maxActions = options.maxActions ?? 1;
  const intervalMs = options.intervalMs ?? MIN_INTERVAL_MS;
  if (!Number.isInteger(maxActions) || maxActions < 1 || maxActions > 50) {
    throw new Error('Agent Alpha maxActions must be an integer from 1 to 50');
  }
  if (!Number.isFinite(intervalMs) || intervalMs < MIN_INTERVAL_MS) {
    throw new Error(`Agent Alpha production cadence must be at least ${MIN_INTERVAL_MS}ms`);
  }

  let session;
  if (await pathExists(sessionFile)) {
    session = await readSession(sessionFile);
  } else {
    if (options.create !== true) {
      throw new Error('Agent Alpha session is missing; explicit --create is required');
    }
    session = await createIdentity({ base, sessionFile, name: options.name, fetchImpl });
  }

  if (session.base !== base) throw new Error('Agent Alpha session belongs to a different origin');
  session = await ensureIdentity({
    base, fetchImpl, sessionFile, session, requestedName: options.name,
  });

  let actions = 0;
  let attempts = 0;
  let currentTurn = null;
  if (session.pending) {
    await sleep(intervalMs);
    attempts += 1;
    const settled = await settlePending({
      base, fetchImpl, reportFile, sessionFile, session,
    });
    session = settled.session;
    currentTurn = settled.turn;
    if (settled.status === 'executed') actions += 1;
    if (settled.status === 'stale' && attempts >= maxActions) {
      await appendReport(reportFile, {
        timestamp: new Date().toISOString(),
        status: 'attempt_limit',
        errorCode: 'max_attempts',
      });
      return { status: 'attempt_limit', actions };
    }
  }
  while (attempts < maxActions) {
    const turn = currentTurn || await requestJson(fetchImpl, base, '/v1/agent/turn', { token: session.token });
    currentTurn = null;
    const recommendation = recommendationOf(turn);
    const action = recommendation.action;
    if (!action) {
      if (recommendation.errorCode) {
        await appendReport(reportFile, {
          timestamp: new Date().toISOString(),
          status: 'refused',
          errorCode: recommendation.errorCode,
          ...(typeof recommendation.candidate?.kind === 'string'
            ? { actionKind: recommendation.candidate.kind } : {}),
          ...(typeof recommendation.candidate?.id === 'string'
            ? { actionId: recommendation.candidate.id } : {}),
        });
        return { status: 'refused', actions };
      }
      break;
    }
    await sleep(intervalMs);

    const operationId = crypto.randomUUID();
    session = {
      ...session,
      pending: {
        operationId,
        turnId: turn.turnId,
        actionId: action.id,
        startedAt: new Date().toISOString(),
      },
    };
    await atomicJsonWrite(sessionFile, session);
    attempts += 1;
    const settled = await settlePending({
      base, fetchImpl, reportFile, sessionFile, session, actionKind: action.kind,
    });
    session = settled.session;
    currentTurn = settled.turn;
    if (settled.status === 'executed') actions += 1;
    if (settled.status === 'stale' && attempts >= maxActions) {
      await appendReport(reportFile, {
        timestamp: new Date().toISOString(),
        status: 'attempt_limit',
        errorCode: 'max_attempts',
      });
      return { status: 'attempt_limit', actions };
    }
  }

  return { status: 'complete', actions };
}

export async function runAgentAlpha(options = {}) {
  if (!options.sessionFile) throw new Error('Agent Alpha requires a session file');
  const sessionFile = resolve(options.sessionFile);
  const lock = await acquireLock(sessionFile);
  try {
    return await runUnlocked({ ...options, sessionFile });
  } finally {
    await releaseLock(lock);
  }
}

function cliOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--create') options.create = true;
    else if (arg === '--name') options.name = argv[++index];
    else if (arg === '--max-actions') options.maxActions = Number(argv[++index]);
    else if (arg === '--session') options.sessionFile = argv[++index];
    else if (arg === '--report') options.reportFile = argv[++index];
    else throw new Error('Unknown Agent Alpha option');
  }
  return options;
}

async function main() {
  const options = cliOptions(process.argv.slice(2));
  options.baseUrl = process.env.OMERTA_BASE_URL || 'https://www.omerta.fun';
  options.sessionFile ||= process.env.OMERTA_ALPHA_SESSION;
  options.reportFile ||= process.env.OMERTA_ALPHA_REPORT;
  if (!options.sessionFile || !options.reportFile) {
    throw new Error('Agent Alpha requires --session and --report');
  }
  const summary = await runAgentAlpha(options);
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    process.stderr.write('agent_alpha_error\n');
    process.exitCode = 1;
  });
}
