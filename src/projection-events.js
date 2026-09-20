// Refresh hints carry no domain identifiers or state. Every client must re-read its
// authorized projection. Existing Crew bus events are intentionally not hint sources:
// those legacy producers can emit before their transaction commits.
import { coreProgressionContent } from './content/core-progression.js';

const HINT = JSON.stringify({ channel: 'projection', changed: true });
const mutations = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const requestContext = new WeakMap();
const membershipPath = (path) => /^\/v1\/(crew|gangs)(?:\/|$)/.test(path);
const membershipMutations = new Set([
  'POST /v1/crew', 'POST /v1/crew/accept/:crewId', 'POST /v1/crew/leave',
  'DELETE /v1/crew/member/:characterId', 'POST /v1/crew/request/:characterId/accept',
  'POST /v1/gangs', 'POST /v1/gangs/:id/join', 'POST /v1/gangs/leave', 'POST /v1/gangs/kick',
]);

export function createProjectionEvents({ pool, bus, clients, enabled = false, accountIds = [],
  sendable = (socket) => socket.readyState === 1, objects = coreProgressionContent().objects }) {
  const cohort = new Set(accountIds), tasks = new Set();
  let closed = false;
  const allowed = (accountId) => enabled && (!cohort.size || cohort.has(accountId));
  const track = (action) => {
    if (closed) return Promise.resolve();
    const task = Promise.resolve().then(action).catch(() => {}).finally(() => tasks.delete(task));
    tasks.add(task); return task;
  };
  async function group(kind, groupId) {
    if (!groupId) return [];
    if (kind === 'account') return [groupId];
    if (kind === 'crew') return (await pool.query('SELECT account_id FROM crew_members WHERE crew_id=$1', [groupId])).rows.map((row) => row.account_id);
    if (kind === 'family') return (await pool.query(`SELECT c.account_id FROM gang_members gm
      JOIN characters c ON c.id=gm.character_id WHERE gm.gang_id=$1 AND c.alive=true`, [groupId])).rows.map((row) => row.account_id);
    return [];
  }
  async function peers(accountId) {
    const crew = (await pool.query('SELECT crew_id FROM crew_members WHERE account_id=$1', [accountId])).rows[0];
    const family = (await pool.query(`SELECT gm.gang_id FROM characters c JOIN gang_members gm ON gm.character_id=c.id
      WHERE c.account_id=$1 AND c.alive=true`, [accountId])).rows[0];
    return new Set([accountId, ...await group('crew', crew?.crew_id), ...await group('family', family?.gang_id)]);
  }
  async function hint(recipients) {
    for (const accountId of new Set(recipients)) {
      if (closed || !allowed(accountId) || !clients.has(accountId)) continue;
      const account = (await pool.query('SELECT status FROM accounts WHERE id=$1', [accountId])).rows[0];
      if (closed || account?.status !== 'active') continue;
      for (const socket of clients.get(accountId) || []) {
        try { if (sendable(socket)) socket.send(HINT); } catch { /* disconnected */ }
      }
    }
  }
  async function claimAudience(claimId, revokedGrantId) {
    const owner = (await pool.query('SELECT owner_account_id FROM coordination_claims WHERE id=$1', [claimId])).rows[0];
    if (!owner) return [];
    const grants = (await pool.query('SELECT id,recipient_kind,recipient_id,active FROM coordination_claim_grants WHERE claim_id=$1', [claimId])).rows;
    const recipients = [owner.owner_account_id];
    for (const grant of grants) if (grant.active || grant.id === revokedGrantId) recipients.push(...await group(grant.recipient_kind, grant.recipient_id));
    return recipients;
  }
  async function operationAudience(operationId) {
    const row = (await pool.query('SELECT opened_by_account_id,family_id,crew_id,coordination_mode FROM world_operations WHERE id=$1', [operationId])).rows[0];
    if (!row) return [];
    const roles = (await pool.query('SELECT account_id FROM world_operation_roles WHERE operation_id=$1', [operationId])).rows;
    const historical = row.coordination_mode === 'family'
      ? (await pool.query('SELECT account_id FROM world_operation_commitments WHERE operation_id=$1', [operationId])).rows : [];
    return [row.opened_by_account_id, ...roles.map((role) => role.account_id), ...historical.map((promise) => promise.account_id),
      ...await group(row.coordination_mode === 'family' ? 'family' : 'crew', row.coordination_mode === 'family' ? row.family_id : row.crew_id)];
  }
  const onOperation = (event) => track(async () => {
    if (!enabled || typeof event?.operationId !== 'string' || !Number.isInteger(event?.revision)) return;
    if (!(await pool.query('SELECT id FROM world_operation_events WHERE operation_id=$1 AND revision=$2 LIMIT 1',
      [event.operationId, event.revision])).rows.length) return;
    await hint(await operationAudience(event.operationId));
  });
  const onWorld = (event) => track(async () => {
    if (!enabled || typeof event?.objectId !== 'string' || !Number.isInteger(event?.revision)) return;
    const row = (await pool.query(`SELECT actor_account_id,crew_id,family_id,next_state FROM world_kernel_events
      WHERE object_id=$1 AND revision=$2`, [event.objectId, event.revision])).rows[0];
    if (!row) return; // A noncommitted/forged bus hint cannot invent a world transition.
    const definition = objects.find((object) => object.id === event.objectId);
    const recipients = definition?.publicStates.includes(row.next_state) ? [...clients.keys()]
      : [row.actor_account_id]; // group membership alone does not reveal a hidden world transition
    await hint(recipients);
  });
  if (enabled) { bus.on('world:changed', onWorld); bus.on('coordination:changed', onOperation); }

  return Object.freeze({
    // Called before HTTP mutation execution. Only membership changes need historical
    // audience: the departed actor and former peers must discard the prior projection.
    async before(req, accountId) {
      if (!accountId || !mutations.has(req.method)) return;
      const path = req.routeOptions?.url || '';
      // Observing a card changes no game state. Refreshing on its own beacon
      // would close an active confirmation dialog and create a feedback loop.
      if (path === '/v1/commands/observations' || path === '/v1/screens') return;
      if (!path.startsWith('/v1/') || (!enabled && !membershipMutations.has(`${req.method} ${path}`))) return;
      const prior = enabled && membershipPath(path) ? await peers(accountId) : new Set([accountId]);
      requestContext.set(req, { accountId, path, prior });
    },
    after(req, reply) {
      return track(async () => {
        const context = requestContext.get(req);
        if (!context || reply.statusCode < 200 || reply.statusCode >= 300 || reply.getHeader?.('x-idempotent-replay')) return;
        const { accountId, path, prior } = context;
        // Route-owned claim/operation ids determine audiences; response bodies and
        // caller-supplied account ids never select hint recipients.
        if (path === '/v1/commands/execute') {
          const [boardId, commandId] = String(req.body?.executionId || '').split('.');
          const row = (await pool.query('SELECT commands_json FROM player_command_boards WHERE id=$1 AND account_id=$2',
            [boardId, accountId])).rows[0];
          const command = row && JSON.parse(row.commands_json).find((entry) => entry.commandId === commandId);
          const knowledgeChange = ['knowledge.share', 'knowledge.revoke'].includes(command?.commandType);
          await hint(knowledgeChange ? [accountId, ...await claimAudience(command.parameters.claimId,
            command.commandType === 'knowledge.revoke' ? command.parameters.grantId : undefined)] : [accountId]);
        } else if (/^\/v1\/coordination\/knowledge\/:claimId\/(share|revoke)$/.test(path)) {
          const revoked = path.endsWith('/revoke') ? req.body?.grantId : undefined;
          await hint([accountId, ...await claimAudience(req.params.claimId, revoked)]);
        } else if (path.startsWith('/v1/coordination/operations/') && req.params.operationId) {
          await hint([accountId, ...await operationAudience(req.params.operationId)]);
        } else if (path.startsWith('/v1/coordination/')) {
          await hint([accountId]); // private discovery/archive/link changes reveal no timing to peers
        } else if (membershipPath(path)) {
          await hint(new Set([...prior, ...await peers(accountId)]));
        } else {
          await hint([accountId]);
        }
        if (membershipMutations.has(`${req.method} ${path}`)) {
          const affected = [accountId], targetId = req.params?.characterId || req.body?.characterId;
          if (targetId) affected.push(...(await pool.query('SELECT account_id FROM characters WHERE id=$1', [targetId])).rows.map((row) => row.account_id));
          for (const affectedId of new Set(affected)) for (const socket of clients.get(affectedId) || []) {
            try { socket.close(4009, 'membership_changed'); } catch { /* already disconnected */ }
          }
        }
      });
    },
    // Legacy private channels are connected once. Recheck current identity and
    // membership before every private forward, independently of the projection flag.
    forwardPrivate({ accountId, characterId, tokenVersion, kind, groupId, event, send, close }) {
      return track(async () => {
        let rows;
        if (kind === 'crew') rows = (await pool.query(`SELECT a.status,a.token_version,c.id,m.crew_id AS group_id
          FROM accounts a JOIN characters c ON c.account_id=a.id LEFT JOIN crew_members m ON m.account_id=a.id
          WHERE a.id=$1 AND c.alive=true`, [accountId])).rows;
        else if (kind === 'family') rows = (await pool.query(`SELECT a.status,a.token_version,c.id,m.gang_id AS group_id
          FROM accounts a JOIN characters c ON c.account_id=a.id LEFT JOIN gang_members m ON m.character_id=c.id
          WHERE a.id=$1 AND c.alive=true`, [accountId])).rows;
        else { close(); return; }
        const current = rows[0];
        if (rows.length !== 1 || current.status !== 'active'
          || (tokenVersion !== undefined && Number(tokenVersion) !== Number(current.token_version))
          || current.id !== characterId || current.group_id !== groupId) {
          close(); return;
        }
        if (!closed) send(event);
      });
    },
    async settled() { while (tasks.size) for (const task of [...tasks]) await task; },
    async close() {
      closed = true;
      bus.off('world:changed', onWorld); bus.off('coordination:changed', onOperation);
      for (const task of [...tasks]) await task;
    },
  });
}

export function registerProjectionEvents(app, options) {
  const events = createProjectionEvents(options);
  app.addHook('preHandler', async (req) => {
    if (!mutations.has(req.method)) return;
    let accountId = req.user?.sub;
    if (!accountId) {
      const bearer = /^Bearer (.+)$/i.exec(String(req.headers.authorization || ''))?.[1];
      try { if (bearer) accountId = app.jwt.verify(bearer).sub; } catch { return; }
    }
    try { await events.before(req, accountId); } catch { /* hints never block gameplay */ }
  });
  app.addHook('onResponse', (req, reply) => events.after(req, reply));
  app.addHook('onClose', () => events.close());
  return events;
}
