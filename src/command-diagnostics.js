// RC1-OBS: operational stages only. Never serialize requests, domain objects or errors.
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const context = new AsyncLocalStorage();
const requestTrace = Symbol('command diagnostic context');
const phases = new Set(['request', 'authorization', 'command', 'mutation', 'consequence', 'opportunity', 'failure', 'response']);
const outcomes = new Set(['allowed', 'denied', 'completed', 'unavailable', 'db_down', 'internal']);

export function commandDiagnostic(phase, fields = {}, trace = context.getStore()) {
  if (!trace || !phases.has(phase)) return;
  const record = { component: 'player-command', phase, correlationId: trace.id };
  if (outcomes.has(fields.outcome)) record.outcome = fields.outcome;
  if (typeof fields.replayed === 'boolean') record.replayed = fields.replayed;
  for (const key of ['changes', 'statusCode', 'elapsedMs'])
    if (Number.isSafeInteger(fields[key]) && fields[key] >= 0) record[key] = fields[key];
  // Diagnostics must never turn a committed mutation into a failed response.
  try { console.info(JSON.stringify(record)); } catch { /* logging surface unavailable */ }
}

export async function commandRequestStart(req, reply) {
  const trace = { id: randomUUID() };
  req[requestTrace] = trace;
  reply.header('x-correlation-id', trace.id);
  commandDiagnostic('request', {}, trace);
}

export async function commandRequestEnd(req, reply) {
  const trace = req[requestTrace];
  // Auth also sends revoked/banned replies directly instead of throwing.
  if (trace && [401, 403].includes(reply.statusCode) && !trace.denied)
    commandDiagnostic('authorization', { outcome: 'denied' }, trace);
  commandDiagnostic('response', { statusCode: reply.statusCode, elapsedMs: Math.max(0, Math.round(reply.elapsedTime || 0)) }, trace);
}

export function commandRequestFailure(req, { unauthorized = false, database = false } = {}) {
  const trace = req[requestTrace];
  if (trace && unauthorized) trace.denied = true;
  commandDiagnostic(unauthorized ? 'authorization' : 'failure',
    { outcome: unauthorized ? 'denied' : database ? 'db_down' : 'unavailable' }, trace);
}

export function traceAuthorizedCommand(req, action) {
  return context.run(req[requestTrace], async () => {
    commandDiagnostic('authorization', { outcome: 'allowed' });
    return action();
  });
}
