import crypto from 'node:crypto';
import { GameError } from './game.js';

const contextKey = Symbol('decision execution context');
const invalid = () => new GameError('decision_call', 'Decision call cannot be associated with this action.');
const reused = () => new GameError('decision_reused', 'Decision call already has an execution association.');
const key = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);

// The caller holds the character lock and owns the encompassing transaction.
export async function validateDecisionCall(client, args) {
  const { callId, accountId, characterId, generation, turnId, actionId } = args || {};
  if (!client || typeof client.query !== 'function' || !key(callId) || !key(accountId) || !key(characterId)
      || !Number.isSafeInteger(generation) || generation < 1 || generation > 2147483647
      || typeof turnId !== 'string' || !/^turn_[0-9a-f]{64}$/.test(turnId)
      || typeof actionId !== 'string' || actionId.length < 1 || actionId.length > 512 || /[\x00-\x1f\x7f]/.test(actionId)) throw invalid();
  const { rows } = await client.query(`SELECT id, account_id, status, purpose, output, simulated, decision_execution_receipt
    FROM resource_calls WHERE id=$1 AND account_id=$2 FOR UPDATE`, [callId, accountId]);
  const row = rows?.length === 1 ? rows[0] : null;
  if (!row || row.id !== callId || row.account_id !== accountId || row.status !== 'succeeded'
      || typeof row.simulated !== 'boolean') throw invalid();
  if (row.decision_execution_receipt != null) throw reused();
  if (!row.purpose || row.purpose.kind !== 'game_decision' || row.purpose.turnId !== turnId
      || typeof row.output !== 'string' || row.output.length > 8192) throw invalid();
  let output;
  try { output = JSON.parse(row.output); } catch { throw invalid(); }
  if (!output || Array.isArray(output) || Object.keys(output).length !== 1 || output.actionId !== actionId) throw invalid();
  const validated = { ...row };
  Object.defineProperty(validated, contextKey, { value: { client, callId, accountId, characterId, generation, turnId, actionId, simulated: row.simulated, used: false } });
  return Object.freeze(validated);
}

function digestResult(result) {
  try {
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw invalid();
    const serialized = JSON.stringify(result);
    if (typeof serialized !== 'string' || Buffer.byteLength(serialized, 'utf8') > 1048576) throw invalid();
    const normalized = JSON.parse(serialized);
    if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) throw invalid();
    let nodes = 0;
    const canonical = (value, depth) => {
      if (depth > 64 || ++nodes > 100000) throw invalid();
      if (value === null || typeof value !== 'object') return JSON.stringify(value);
      if (Array.isArray(value)) return `[${value.map(item => canonical(item, depth + 1)).join(',')}]`;
      return `{${Object.keys(value).sort().map(name => `${JSON.stringify(name)}:${canonical(value[name], depth + 1)}`).join(',')}}`;
    };
    return crypto.createHash('sha256').update(canonical(normalized, 0)).digest('hex');
  } catch { throw invalid(); }
}

export async function recordDecisionExecution(client, validated, { actionKind, result } = {}) {
  const context = validated?.[contextKey];
  if (!context || context.client !== client) throw invalid();
  if (context.used) throw reused();
  if (typeof actionKind !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(actionKind)) throw invalid();
  const receipt = { id: crypto.randomUUID(), characterId: context.characterId, generation: context.generation,
    turnId: context.turnId, actionId: context.actionId, actionKind, resultDigest: digestResult(result), recordedAt: new Date().toISOString() };
  context.used = true;
  const updated = await client.query(`UPDATE resource_calls SET decision_execution_receipt=$3
    WHERE id=$1 AND account_id=$2 AND status='succeeded' AND decision_execution_receipt IS NULL RETURNING id`,
  [context.callId, context.accountId, receipt]);
  if (updated.rows?.length !== 1 || updated.rows[0].id !== context.callId) throw reused();
  return { id: receipt.id, callId: context.callId, turnId: context.turnId, actionId: context.actionId,
    executionRecorded: true, simulated: context.simulated, reasoningVerified: false, monetaryProof: false, causalEffect: null };
}
