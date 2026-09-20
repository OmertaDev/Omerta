// RC1 observability uses the existing telemetry store. No game service reads
// these observations to establish permission or decide what a player can know.
import { createHash } from 'node:crypto';
import { track } from './game.js';

const phases = new Set(['session', 'command_center', 'opportunities_shown', 'opportunity_open', 'preparation', 'consequence']);
const digest = (value) => createHash('sha256').update(value).digest('hex');
let writeFailures = 0, droppedWrites = 0;
const writers = new WeakMap();
// At most one observation holds a connection per pool, with a bounded backlog.
// The request never awaits telemetry I/O, especially after a domain COMMIT.
function bestEffort(pool, write) {
  const state = writers.get(pool) || { pending: 0, tail: Promise.resolve() };
  writers.set(pool, state);
  if (state.pending >= 128) { droppedWrites++; return; }
  state.pending++;
  state.tail = state.tail.then(write).catch(() => {
    writeFailures++; console.error('[world-telemetry] observation write failed');
  }).finally(() => { state.pending--; });
}
// An explicit test/operational flush; gameplay routes do not wait for this.
export const flushWorldTelemetry = (pool) => writers.get(pool)?.tail || Promise.resolve();

export async function recordWorldObservation(pool, accountId, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some((key) => !['phase', 'session', 'reference', 'count'].includes(key))
    || !phases.has(body.phase) || typeof body.session !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(body.session)
    || (body.reference !== undefined && (typeof body.reference !== 'string' || body.reference.length > 200))
    || (body.count !== undefined && (!Number.isInteger(body.count) || body.count < 0 || body.count > 200))) {
    const error = new Error('Invalid observation'); error.code = 'bad_command_request'; throw error;
  }
  bestEffort(pool, () => track(pool, accountId, 'world_view', { phase: body.phase,
    session: digest(body.session), ...(body.reference ? { reference: digest(body.reference) } : {}), count: body.count ?? 1 }));
}

export async function recordWorldCommand(pool, accountId, { phase, executionId, count, reason, replayed, consequenceReferences = [] }) {
  const knownReasons = new Set(['command_stale', 'command_expired', 'command_confirmation_required', 'bad_command_request',
    'command_unavailable', 'item_commit_unknown', 'item_recovery_required', 'contention', 'forbidden', 'unauthorized']);
  bestEffort(pool, () => track(pool, accountId, 'world_command', { phase,
    ...(typeof executionId === 'string' ? { execution: digest(executionId) } : {}),
    ...(count !== undefined ? { count } : {}), ...(phase === 'completed' ? { replayed: !!replayed,
      consequences: replayed ? [] : consequenceReferences.slice(0, 24).map(digest) } : {}),
    ...(phase === 'rejected' ? { reason: knownReasons.has(reason) ? reason : 'other' } : {}) }));
}

// Use only the current authorized response. An old consequence on a refreshed
// board is not evidence that this command changed the world. For each changed
// object, its newest visible event must identify this player as the actor.
export function commandConsequenceReferences(result) {
  if (result.replayed) return [];
  return (result.feedback?.worldChanges || []).flatMap((change) => {
    const event = result.projection?.consequences?.find((entry) => entry.subject?.id === change.id);
    return event?.cause ? [event.id] : [];
  });
}

// Moderator-only caller. Bounded retained sample; flags incomplete evidence.
// UI events are reported as observations, committed domain rows as facts.
export async function worldReleaseMetrics(pool, days = 7) {
  const windowDays = Math.max(1, Math.min(30, Number(days) || 7));
  const since = new Date(Date.now() - windowDays * 86400000);
  const rows = (await pool.query(`SELECT account_id,event,props,at FROM telemetry
    WHERE at >= $1 AND event IN ('world_view','world_command') ORDER BY at,id LIMIT 50001`, [since])).rows;
  const accounts = new Map(), commandKeys = new Set(), rejections = {}, totals = {};
  for (const row of rows.slice(0, 50000)) {
    if (!row.account_id) continue;
    const props = typeof row.props === 'string' ? JSON.parse(row.props) : row.props;
    const actor = accounts.get(row.account_id) || { stage: 0, firstOpportunity: null, session: null,
      commandSession: null, completedAt: null, consequences: new Set() };
    accounts.set(row.account_id, actor);
    totals[props.phase] = (totals[props.phase] || 0) + (props.phase === 'issued' || props.phase === 'opportunities_shown' ? props.count || 0 : 1);
    if (row.event === 'world_command') {
      if (props.phase === 'completed' && props.execution) {
        commandKeys.add(`${row.account_id}:${props.execution}`);
        if (actor.stage === 4) {
          actor.stage = 5; actor.completedAt = new Date(row.at).getTime(); actor.commandSession = actor.session;
        }
        if (actor.stage === 5 && !props.replayed) for (const reference of props.consequences || []) actor.consequences.add(reference);
      }
      if (props.phase === 'rejected') rejections[props.reason] = (rejections[props.reason] || 0) + 1;
    } else {
      if (props.phase === 'session' && actor.stage === 0) { actor.stage = 1; actor.session = props.session; }
      if (props.phase === 'command_center' && actor.stage === 1) actor.stage = 2;
      if (props.phase === 'opportunity_open' && props.reference) {
        if (actor.stage === 2) { actor.stage = 3; actor.firstOpportunity = props.reference; }
        if (actor.stage === 6 && props.reference !== actor.firstOpportunity) actor.stage = 7;
      }
      if (props.phase === 'preparation' && actor.stage === 3) actor.stage = 4;
      if (props.phase === 'consequence' && actor.stage === 5 && actor.consequences.has(props.reference)) actor.stage = 6;
      // A second page load alone does not establish a return session: require
      // a fresh session identity AND at least 30 minutes after the first move.
      if (props.phase === 'session' && actor.stage === 7 && props.session !== actor.commandSession
        && new Date(row.at).getTime() - actor.completedAt >= 1800000) actor.stage = 8;
      if (props.session) actor.session = props.session;
    }
  }
  const group = async (sql) => (await pool.query(sql, [since])).rows.map((row) => ({ ...row, count: Number(row.count) }));
  const operations = await group('SELECT status, COUNT(*) AS count FROM world_operations WHERE created_at >= $1 GROUP BY status');
  const campaigns = await group('SELECT status, COUNT(*) AS count FROM director_campaigns WHERE created_at >= $1 GROUP BY status');
  const situations = await group('SELECT state, COUNT(*) AS count FROM director_situations WHERE created_at >= $1 GROUP BY state');
  const knowledge = await group('SELECT COUNT(*) AS count FROM coordination_claims WHERE discovered_at >= $1');
  const itemEvents = await group('SELECT event_kind, template_id, COUNT(*) AS count, SUM(quantity_delta) AS quantity_delta FROM item_events WHERE created_at >= $1 GROUP BY event_kind,template_id');
  const worldEvents = await group('SELECT COUNT(*) AS count FROM world_kernel_events WHERE occurred_at >= $1');
  const selections = (await pool.query('SELECT candidates_json,selected_json FROM director_selections WHERE evaluated_at >= $1 ORDER BY evaluated_at DESC LIMIT 10001', [since])).rows;
  const crafting = await group("SELECT COUNT(*) AS count FROM item_mutation_guards WHERE completed_at >= $1 AND mutation_kind='craft'");
  const resolvedOperations = await group('SELECT status, COUNT(*) AS count FROM world_operations WHERE resolved_at >= $1 GROUP BY status');
  const updatedCampaigns = await group('SELECT status, COUNT(*) AS count FROM director_campaigns WHERE updated_at >= $1 GROUP BY status');
  const selected = selections.slice(0, 10000).map((row) => JSON.parse(row.selected_json));
  const candidates = selections.slice(0, 10000).map((row) => JSON.parse(row.candidates_json));
  return { windowDays, since, observationWriteFailuresSinceBoot: writeFailures, observationDroppedWritesSinceBoot: droppedWrites,
    truncated: rows.length > 50000 || selections.length > 10000,
    uiObservationsAreUntrusted: true, observationsMayUndercount: true, funnelOrder: 'server_receipt_time', activeObservedPlayers: accounts.size,
    observations: totals, completedCommandIdentities: commandKeys.size, rejectionReasons: rejections,
    funnel: ['LOGIN', 'COMMAND_CENTER', 'OPPORTUNITY_OPEN', 'PREPARATION', 'COMMAND', 'CONSEQUENCE', 'SECOND_OPPORTUNITY', 'SECOND_SESSION']
      .map((stage, index) => ({ stage, accounts: [...accounts.values()].filter((actor) => actor.stage > index).length })),
    canonical: { operations, campaigns, situations, knowledgeDiscoveries: knowledge[0]?.count || 0,
      operationsStarted: operations.reduce((sum, row) => sum + row.count, 0),
      operationsCompleted: resolvedOperations.find((row) => row.status === 'completed')?.count || 0,
      operationFailures: resolvedOperations.filter((row) => ['failed', 'expired'].includes(row.status)).reduce((sum, row) => sum + row.count, 0),
      campaignsStarted: campaigns.reduce((sum, row) => sum + row.count, 0),
      campaignsCompleted: updatedCampaigns.find((row) => row.status === 'completed')?.count || 0,
      campaignFailures: updatedCampaigns.filter((row) => ['failed', 'abandoned'].includes(row.status)).reduce((sum, row) => sum + row.count, 0),
      itemEvents, consequencesProduced: worldEvents[0]?.count || 0, crafting: crafting[0]?.count || 0,
      directorSelections: selected.reduce((sum, entries) => sum + (Array.isArray(entries) ? entries.length : 0), 0),
      directorEvaluations: Math.min(selections.length, 10000),
      directorCandidates: candidates.reduce((sum, entry) => sum + (Number(entry.eligible) || 0), 0),
      directorSuppressions: candidates.reduce((sum, entry) => sum + (entry.rejected?.length || 0), 0) } };
}
