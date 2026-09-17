// Phase 1 knowledge is inert evidence. Only a pinned, executed discovery mints a
// claim; ACLs, assertions and archive references never manufacture provenance.
import crypto from 'node:crypto';
import { GameError } from '../game.js';
import { canonicalBytes } from '../content/canonical.js';
import { assertPhase2Client, phase2ContextIdentity, registerPhase2Undo } from '../content/phase2-transactions.js';
import { compileCoordinationGraph, coordinationEvidenceKey } from './graph.js';
import { normalizeKnowledgeRequirement } from '../world-knowledge.js';

const fail = (code) => { throw new GameError(code, 'The knowledge request could not complete.'); };
const parse = (value) => typeof value === 'string' ? JSON.parse(value) : value;
const hash = (value) => crypto.createHash('sha256').update(canonicalBytes(value)).digest('hex');
const iso = (value) => new Date(value).toISOString();
const contexts = new WeakMap();
const MAX_PAGE = 50, MAX_EVIDENCE = 256, MAX_LINKS = 100, MAX_GRANTS = 64, MAX_REBUILD = 2048;
const MAX_REBUILD_WORK = 4096;
const TOKEN_MS = 10 * 60 * 1000;
const id = (value) => {
  if (typeof value !== 'string' || !/^[\x21-\x7e]{1,200}$/.test(value)) fail('bad_knowledge_request');
  return value;
};
function record(value, allowed, required = allowed) {
  if (!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
      || Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowed.includes(key)
        || !Object.getOwnPropertyDescriptor(value, key)?.enumerable
        || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'))
      || required.some((key) => !Object.hasOwn(value, key))) fail('bad_knowledge_request');
  return value;
}
function checked(client, ctx) {
  assertPhase2Client(client);
  const value = contexts.get(ctx);
  if (!value || value.client !== client || value.identity !== phase2ContextIdentity(client)) {
    fail('content_transaction_required');
  }
  return value;
}
function command(input, fields) {
  record(input, [...fields, 'commandId', 'now']); id(input.commandId);
  if (!Number.isSafeInteger(input.now) || input.now < 0 || input.now > 8.64e15) fail('bad_knowledge_request');
  return input;
}
async function insert(client, table, row) {
  const keys = Object.keys(row);
  await client.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(row));
  const key = Object.hasOwn(row, 'id') ? 'id' : 'claim_id';
  registerPhase2Undo(client, () => client.query(`DELETE FROM ${table} WHERE ${key}=$1`, [row[key]]));
}
async function replace(client, table, key, previous, next) {
  const columns = Object.keys(next).filter((column) => column !== key);
  const query = `UPDATE ${table} SET ${columns.map((column, i) => `${column}=$${i + 2}`).join(',')} WHERE ${key}=$1`;
  await client.query(query, [next[key], ...columns.map((column) => next[column])]);
  registerPhase2Undo(client, () => client.query(query, [previous[key], ...columns.map((column) => previous[column])]));
}
async function lockClaims(client, ids) {
  const rows = new Map();
  // Every operation uses the same immutable-row mutex, including projection-only
  // reads. No claim is taken before this complete sorted set is known.
  for (const claimId of [...new Set(ids)].sort()) {
    const row = (await client.query('SELECT * FROM coordination_claims WHERE id=$1 FOR UPDATE', [claimId])).rows[0];
    if (row) rows.set(row.id, row);
  }
  return rows;
}
const safeLink = (row) => ({ id: row.id, fromClaimId: row.from_claim_id, toClaimId: row.to_claim_id,
  relation: row.relation, assertion: 'player', createdAt: iso(row.created_at) });
const linkReceipt = (row) => ({ id: row.id, relation: row.relation, assertion: 'player', createdAt: iso(row.created_at) });

export function createCoordinationKnowledge({ enabled = false, sharingEnabled = false, accountIds = [] } = {}) {
  if (typeof enabled !== 'boolean' || typeof sharingEnabled !== 'boolean' || !Array.isArray(accountIds)
      || accountIds.some((value) => typeof value !== 'string' || !value)) fail('bad_knowledge_config');
  const cohort = new Set(accountIds), secret = crypto.randomBytes(32);
  const enabledFor = (accountId) => enabled && (!cohort.size || cohort.has(accountId));
  const sharingEnabledFor = (accountId) => enabledFor(accountId) && sharingEnabled;
  const requireEnabled = (ctx, sharing = false) => {
    if (!(sharing ? sharingEnabledFor(ctx.accountId) : enabledFor(ctx.accountId))) {
      fail(sharing ? 'knowledge_sharing_disabled' : 'knowledge_disabled');
    }
  };
  function seal(value) {
    const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', secret, iv);
    cipher.setAAD(Buffer.from('omerta:coordination:knowledge:v1'));
    return Buffer.concat([iv, cipher.update(canonicalBytes(value)), cipher.final(), cipher.getAuthTag()]).toString('base64url');
  }
  function unseal(token, purpose, accountId) {
    try {
      if (typeof token !== 'string' || token.length < 40 || token.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(token)) throw Error();
      const bytes = Buffer.from(token, 'base64url');
      if (bytes.toString('base64url') !== token) throw Error();
      const decipher = crypto.createDecipheriv('aes-256-gcm', secret, bytes.subarray(0, 12));
      decipher.setAAD(Buffer.from('omerta:coordination:knowledge:v1'));
      decipher.setAuthTag(bytes.subarray(-16));
      const value = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString('utf8'));
      if (value.purpose !== purpose || value.accountId !== accountId || !Number.isSafeInteger(value.expiresAt)
          || value.expiresAt <= Date.now()) throw Error();
      return value;
    } catch { fail(purpose === 'target' ? 'knowledge_stale_target' : 'bad_knowledge_cursor'); }
  }
  function audience(ctx) {
    if (!sharingEnabledFor(ctx.accountId)) return [];
    return [['account', ctx.accountId], ...(ctx.crewId ? [['crew', ctx.crewId]] : []),
      ...(ctx.familyId ? [['family', ctx.familyId]] : [])];
  }
  function visibleSql(ctx, values, alias = 'c') {
    values.push(ctx.accountId); const owner = `$${values.length}`;
    const clauses = audience(ctx).map(([kind, recipient]) => {
      values.push(kind, recipient); return `(recipient_kind=$${values.length - 1} AND recipient_id=$${values.length})`;
    });
    return `(${alias}.owner_account_id=${owner}${clauses.length ? ` OR ${alias}.id IN
      (SELECT claim_id FROM coordination_claim_grants WHERE active=true AND (${clauses.join(' OR ')}))` : ''})`;
  }
  async function readable(client, ctx, claim) {
    if (!claim) return false;
    if (claim.owner_account_id === ctx.accountId) return true;
    const readers = audience(ctx);
    if (!readers.length) return false;
    // Fresh after immutable claim lock: a pre-lock subquery snapshot alone is not
    // revocation authority at READ COMMITTED isolation.
    const grants = (await client.query('SELECT * FROM coordination_claim_grants WHERE claim_id=$1 AND active=true', [claim.id])).rows;
    return grants.some((grant) => readers.some(([kind, principal]) => grant.recipient_kind === kind && grant.recipient_id === principal));
  }
  async function authentic(client, claim, cache = new Map()) {
    let source;
    if (cache.has(claim.instance_id)) source = cache.get(claim.instance_id);
    else {
      const instance = (await client.query('SELECT * FROM coordination_instances WHERE id=$1', [claim.instance_id])).rows[0];
      const definition = instance && (await client.query('SELECT * FROM coordination_definitions WHERE graph_id=$1 AND graph_version=$2',
        [instance.graph_id, instance.graph_version])).rows[0];
      let graph;
      try { graph = definition && compileCoordinationGraph(parse(definition.definition_json)); } catch { fail('knowledge_corrupt'); }
      if (!instance || !graph || graph.id !== instance.graph_id || graph.version !== Number(instance.graph_version)
          || graph.contentHash !== instance.content_hash || graph.contentHash !== definition.content_hash) fail('knowledge_corrupt');
      source = { instance, graph }; cache.set(claim.instance_id, source);
    }
    const event = (await client.query('SELECT * FROM coordination_events WHERE id=$1', [claim.source_event_id])).rows[0];
    const node = source.graph.nodes.find((candidate) => candidate.id === claim.node_id);
    let value, payload, state;
    try { value = parse(claim.value_json); payload = event && parse(event.payload_json);
      state = parse(source.instance.state_json); } catch { fail('knowledge_corrupt'); }
    if (!node?.claim || claim.source_kind !== 'coordination_discovery' || !event
        || event.event_type !== 'coordination.node.discovered' || Number(event.event_version) !== 1
        || event.instance_id !== claim.instance_id || payload?.nodeId !== claim.node_id
        || !Array.isArray(state?.discovered) || !state.discovered.includes(claim.node_id)
        || Number(event.revision) > Number(source.instance.revision)
        || event.content_hash !== claim.content_hash || source.graph.contentHash !== claim.content_hash
        || event.actor_account_id !== claim.owner_account_id || source.instance.owner_account_id !== claim.owner_account_id
        || event.actor_character_id !== claim.origin_character_id || source.instance.owner_character_id !== claim.origin_character_id
        || node.claim.domain !== claim.domain || node.claim.proposition !== claim.proposition
        || node.claim.sourceRoot !== claim.source_root || hash(node.claim.value) !== hash(value)
        || claim.discovery_receipt !== hash({ instanceId: claim.instance_id, nodeId: claim.node_id,
          contentHash: claim.content_hash, sourceEventId: claim.source_event_id })
        || iso(event.occurred_at) !== iso(claim.discovered_at)) fail('knowledge_corrupt');
    return value;
  }
  async function projectClaim(client, ctx, claim, cache) {
    if (!await readable(client, ctx, claim)) fail('knowledge_unavailable');
    const value = await authentic(client, claim, cache);
    const owned = claim.owner_account_id === ctx.accountId;
    const result = { id: claim.id, domain: claim.domain, proposition: claim.proposition, value,
      contentHash: claim.content_hash, discoveredAt: iso(claim.discovered_at), owned,
      source: { kind: 'coordination_discovery', root: claim.source_root } };
    if (owned) {
      const state = (await client.query('SELECT * FROM coordination_claim_acl_state WHERE claim_id=$1', [claim.id])).rows[0];
      if (!state || !Number.isSafeInteger(Number(state.revision))) fail('knowledge_corrupt');
      result.aclRevision = Number(state.revision);
      result.grants = (await client.query('SELECT * FROM coordination_claim_grants WHERE claim_id=$1 AND active=true ORDER BY id', [claim.id])).rows
        .map((grant) => ({ id: grant.id, kind: grant.recipient_kind, label: grant.recipient_label }));
    }
    return result;
  }
  function pageInput(input, ctx, purpose) {
    record(input, ['cursor', 'limit'], []);
    const limit = input.limit ?? 20;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE) fail('bad_knowledge_request');
    const after = input.cursor === undefined ? '' : unseal(input.cursor, purpose, ctx.accountId).after;
    if (typeof after !== 'string') fail('bad_knowledge_cursor');
    return { limit, after };
  }
  function cursor(ctx, purpose, after) { return seal({ purpose, accountId: ctx.accountId, after, expiresAt: Date.now() + TOKEN_MS }); }

  async function matchesRequirements(client, token, inputs) {
    const ctx = checked(client, token);
    if (!Array.isArray(inputs) || inputs.length > 16) fail('bad_knowledge_requirement');
    const requirements = inputs.map(normalizeKnowledgeRequirement);
    if (!enabledFor(ctx.accountId)) return requirements.map(() => false);
    const selected = [], ids = new Set();
    for (const requirement of requirements) {
      const values = [requirement.contentHash, requirement.domain, requirement.proposition, requirement.sourceRoot];
      const filter = visibleSql(ctx, values);
      const candidates = (await client.query(`SELECT c.id FROM coordination_claims c
        WHERE c.content_hash=$1 AND c.domain=$2 AND c.proposition=$3 AND c.source_root=$4
          AND ${filter} ORDER BY c.id LIMIT ${MAX_EVIDENCE + 1}`, values)).rows;
      for (const row of candidates) ids.add(row.id);
      if (ids.size > MAX_EVIDENCE) return requirements.map(() => false);
      selected.push(candidates.map((row) => row.id));
    }
    // One global claim-lock order across all predicates, matching ACL commands.
    const locked = await lockClaims(client, [...ids]), eligible = new Map(), cache = new Map();
    for (const [claimId, claim] of locked) if (await readable(client, ctx, claim)) {
      eligible.set(claimId, await authentic(client, claim, cache));
    }
    return requirements.map((requirement, index) => {
      const values = selected[index].filter((claimId) => eligible.has(claimId)).map((claimId) => eligible.get(claimId));
      return values.length > 0 && values.every((value) => hash(value) === hash(requirement.value));
    });
  }

  return Object.freeze({
    enabledFor, sharingEnabledFor,
    async prelock(client, accountId) { assertPhase2Client(client); id(accountId); return null; },
    async context(client, { accountId, character = null, lock = false }) {
      assertPhase2Client(client); id(accountId);
      if (!lock || (character && (character.account_id !== accountId || character.alive !== true))) fail('content_transaction_required');
      if (character && !(await client.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2 AND alive=true',
        [character.id, accountId])).rows.length) fail('knowledge_unavailable');
      const crew = (await client.query('SELECT crew_id FROM crew_members WHERE account_id=$1 FOR SHARE', [accountId])).rows[0];
      const family = character && (await client.query('SELECT gang_id FROM gang_members WHERE character_id=$1 FOR SHARE', [character.id])).rows[0];
      const ctx = Object.freeze({ accountId });
      contexts.set(ctx, { client, identity: phase2ContextIdentity(client), accountId,
        characterId: character?.id ?? null, crewId: crew?.crew_id ?? null, familyId: family?.gang_id ?? null,
        gateBatch: null, issuedClaims: new Map() });
      return ctx;
    },
    async issueClaim(client, token, input) {
      const ctx = checked(client, token); requireEnabled(ctx);
      command(input, ['instanceId', 'nodeId', 'sourceEventId']);
      const { instanceId, nodeId, sourceEventId, commandId } = input;
      [instanceId, nodeId, sourceEventId].forEach(id);
      const instance = (await client.query('SELECT * FROM coordination_instances WHERE id=$1', [instanceId])).rows[0];
      const event = (await client.query('SELECT * FROM coordination_events WHERE id=$1', [sourceEventId])).rows[0];
      if (!instance || instance.owner_account_id !== ctx.accountId || instance.owner_character_id !== ctx.characterId
          || !event || event.correlation_id !== commandId || event.instance_id !== instanceId) fail('knowledge_unavailable');
      const definition = (await client.query('SELECT * FROM coordination_definitions WHERE graph_id=$1 AND graph_version=$2',
        [instance.graph_id, instance.graph_version])).rows[0];
      let graph;
      try { graph = compileCoordinationGraph(parse(definition.definition_json)); } catch { fail('knowledge_corrupt'); }
      const node = graph.nodes.find((candidate) => candidate.id === nodeId);
      if (!node?.claim || graph.contentHash !== instance.content_hash) fail('knowledge_unavailable');
      const claim = { id: crypto.randomUUID(), instance_id: instanceId, node_id: nodeId, content_hash: graph.contentHash,
        domain: node.claim.domain, proposition: node.claim.proposition, value_json: JSON.stringify(node.claim.value),
        discovery_receipt: hash({ instanceId, nodeId, contentHash: graph.contentHash, sourceEventId }),
        source_kind: 'coordination_discovery', source_event_id: sourceEventId, source_root: node.claim.sourceRoot,
        owner_account_id: ctx.accountId, origin_character_id: ctx.characterId, discovered_at: new Date(event.occurred_at) };
      await authentic(client, claim);
      const prior = (await client.query('SELECT * FROM coordination_claims WHERE instance_id=$1 AND node_id=$2', [instanceId, nodeId])).rows[0];
      if (prior) {
        if (prior.discovery_receipt !== claim.discovery_receipt) fail('knowledge_corrupt');
        return projectClaim(client, ctx, prior);
      }
      const ownedCount = Number((await client.query('SELECT count(*) AS n FROM coordination_claims WHERE owner_account_id=$1', [ctx.accountId])).rows[0].n);
      if (!Number.isSafeInteger(ownedCount) || ownedCount >= MAX_REBUILD) fail('knowledge_limit');
      await insert(client, 'coordination_claims', claim);
      await insert(client, 'coordination_claim_acl_state', { claim_id: claim.id, revision: 0 });
      ctx.issuedClaims.set(claim.id, claim);
      return projectClaim(client, ctx, claim);
    },
    // Cross-domain predicates use the same live ACL, immutable-source proof and
    // claim mutex as coordination. Never trust a caller-supplied claim value.
    matchesRequirements,
    async matchesRequirement(client, token, input) { return (await matchesRequirements(client, token, [input]))[0]; },
    async resolveGates(client, token, graph) {
      const ctx = checked(client, token), result = new Map();
      if (!enabledFor(ctx.accountId)) return result;
      const rules = new Map();
      const visit = (rule) => { if (rule.kind === 'independent_evidence') rules.set(coordinationEvidenceKey(rule), rule);
        for (const child of rule.rules || []) visit(child); };
      for (const node of graph.nodes) { visit(node.discover); visit(node.requires); }
      if (ctx.gateBatch && ctx.gateBatch.contentHash !== graph.contentHash) fail('knowledge_lock_scope');
      if (!ctx.gateBatch) {
        const candidates = new Map(), selected = new Map(), queries = new Map();
        for (const [key, rule] of rules) {
          const queryKey = hash({ domain: rule.domain, proposition: rule.proposition });
          let rows = queries.get(queryKey);
          if (!rows) {
            const values = [graph.contentHash, rule.domain, rule.proposition], filter = visibleSql(ctx, values);
            rows = (await client.query(`SELECT c.* FROM coordination_claims c WHERE c.content_hash=$1
              AND c.domain=$2 AND c.proposition=$3 AND ${filter} ORDER BY c.id LIMIT ${MAX_EVIDENCE + 1}`, values)).rows;
            queries.set(queryKey, rows);
          }
          selected.set(key, rows.length > MAX_EVIDENCE ? null : rows.map((row) => row.id));
          if (rows.length <= MAX_EVIDENCE) for (const row of rows) candidates.set(row.id, row);
          if (candidates.size > MAX_EVIDENCE) { candidates.clear(); selected.clear(); break; }
        }
        ctx.gateBatch = { contentHash: graph.contentHash, candidates, selected };
      }
      // Hold the first complete candidate batch for this graph across action and
      // its response. Newly issued own rows are uncommitted and cannot participate
      // in another transaction's lock cycle. Never expand with a concurrent grant.
      const candidates = new Map(ctx.gateBatch.candidates), selected = new Map(ctx.gateBatch.selected);
      for (const [key, rule] of rules) {
        const ids = selected.get(key);
        if (!ids) continue;
        const extra = [...ctx.issuedClaims.values()].filter((claim) => claim.content_hash === graph.contentHash
          && claim.domain === rule.domain && claim.proposition === rule.proposition);
        selected.set(key, [...new Set([...ids, ...extra.map((claim) => claim.id)])]);
        for (const claim of extra) candidates.set(claim.id, claim);
      }
      if (candidates.size > MAX_EVIDENCE) {
        for (const key of rules.keys()) result.set(key, { satisfied: false, contentHash: graph.contentHash, receiptIds: [] });
        return result;
      }
      const locked = await lockClaims(client, [...candidates.keys()]), cache = new Map();
      const eligible = new Map();
      for (const [claimId, claim] of locked) if (await readable(client, ctx, claim)) {
        eligible.set(claimId, { claim, value: await authentic(client, claim, cache) });
      }
      for (const [key, rule] of rules) {
        const ids = selected.get(key), envelope = { satisfied: false, contentHash: graph.contentHash, receiptIds: [] };
        result.set(key, envelope);
        if (!ids) continue; // Never authorize from a truncated contradiction scan.
        const rows = ids.map((claimId) => eligible.get(claimId)).filter(Boolean);
        if (rows.some(({ value }) => hash(value) !== hash(rule.value))) continue;
        const left = rows.filter(({ claim }) => claim.source_root === rule.sourceRoots[0]);
        const right = rows.filter(({ claim }) => claim.source_root === rule.sourceRoots[1]);
        outer: for (const a of left) for (const b of right) {
          if (a.claim.owner_account_id !== b.claim.owner_account_id && a.claim.discovery_receipt !== b.claim.discovery_receipt) {
            envelope.satisfied = true; envelope.receiptIds = [a.claim.discovery_receipt, b.claim.discovery_receipt].sort(); break outer;
          }
        }
      }
      return result;
    },
    async board(client, token, input = {}) {
      const ctx = checked(client, token), { limit, after } = pageInput(input, ctx, 'board');
      const values = [after], filter = visibleSql(ctx, values);
      const candidates = (await client.query(`SELECT c.id FROM coordination_claims c WHERE c.id>$1 AND ${filter}
        ORDER BY c.id LIMIT ${limit + 1}`, values)).rows;
      const locked = await lockClaims(client, candidates.map((row) => row.id)), claims = [], cache = new Map();
      // A revoke between filtering and row acquisition must not silently consume
      // a page slot or make nextCursor end early. Retry the complete read instead.
      for (const candidate of candidates) {
        const claim = locked.get(candidate.id);
        if (!await readable(client, ctx, claim)) fail('contention');
        claims.push(await projectClaim(client, ctx, claim, cache));
      }
      const more = claims.length > limit; claims.length = Math.min(claims.length, limit);
      return { claims, nextCursor: more ? cursor(ctx, 'board', claims.at(-1).id) : null };
    },
    async get(client, token, claimId) {
      const ctx = checked(client, token); id(claimId);
      // Filter both endpoints before bounding relations; hidden links never consume
      // the caller's page budget or disclose their existence through counts.
      const values = [claimId], left = visibleSql(ctx, values, 'a'), right = visibleSql(ctx, values, 'b');
      const links = (await client.query(`SELECT l.* FROM coordination_claim_links l
        JOIN coordination_claims a ON a.id=l.from_claim_id JOIN coordination_claims b ON b.id=l.to_claim_id
        WHERE (l.from_claim_id=$1 OR l.to_claim_id=$1) AND ${left} AND ${right} ORDER BY l.id LIMIT ${MAX_LINKS}`, values)).rows;
      const locked = await lockClaims(client, [claimId, ...links.flatMap((row) => [row.from_claim_id, row.to_claim_id])]);
      const claim = await projectClaim(client, ctx, locked.get(claimId)), visible = [];
      for (const row of links) if (await readable(client, ctx, locked.get(row.from_claim_id))
          && await readable(client, ctx, locked.get(row.to_claim_id))) visible.push(safeLink(row));
      return { claim, links: visible };
    },
    async targets(client, token, input = {}) {
      const ctx = checked(client, token);
      record(input, ['characterName'], []);
      const targets = [], expiresAt = Date.now() + TOKEN_MS;
      if (!sharingEnabledFor(ctx.accountId)) return { targets, expiresAt: iso(expiresAt) };
      const add = (kind, principal, label) => targets.push({ kind, label,
        id: seal({ purpose: 'target', accountId: ctx.accountId, kind, principal, label, expiresAt }) });
      if (ctx.crewId) add('crew', ctx.crewId, 'Current Crew');
      if (ctx.familyId) add('family', ctx.familyId, 'Current family');
      if (input.characterName !== undefined && input.characterName !== null) {
        const name = input.characterName;
        if (typeof name !== 'string' || name.trim() !== name || name.length < 2 || name.length > 24
            || /[\u0000-\u001f\u007f-\u009f]/u.test(name)) fail('bad_knowledge_request');
        const recipient = (await client.query(`SELECT c.account_id, c.name FROM characters c JOIN accounts a ON a.id=c.account_id
          WHERE c.name=$1 AND c.alive=true AND a.status='active'`, [name])).rows[0];
        if (recipient && recipient.account_id !== ctx.accountId) add('account', recipient.account_id, recipient.name);
      }
      return { targets, expiresAt: iso(expiresAt) };
    },
    async share(client, token, input) {
      const ctx = checked(client, token); requireEnabled(ctx, true);
      command(input, ['claimId', 'targetId', 'expectedAclRevision']); id(input.claimId);
      const target = unseal(input.targetId, 'target', ctx.accountId);
      if ((target.kind === 'crew' && target.principal !== ctx.crewId)
          || (target.kind === 'family' && target.principal !== ctx.familyId)) fail('knowledge_stale_target');
      if (!['account', 'crew', 'family'].includes(target.kind)) fail('knowledge_stale_target');
      const claim = (await lockClaims(client, [input.claimId])).get(input.claimId);
      if (!claim || claim.owner_account_id !== ctx.accountId) fail('knowledge_unavailable');
      const state = await aclRevision(client, claim.id, input.expectedAclRevision);
      const grants = (await client.query('SELECT * FROM coordination_claim_grants WHERE claim_id=$1 ORDER BY id', [claim.id])).rows;
      const prior = grants.find((grant) => grant.recipient_kind === target.kind && grant.recipient_id === target.principal);
      if (prior?.active) return { claim: await projectClaim(client, ctx, claim) };
      if (grants.length >= MAX_GRANTS && !prior) fail('knowledge_limit');
      // Reserve one future revoke per live grant within the bounded event log.
      // Reaching the creation limit must never prevent removing existing access.
      if (Number(state.revision) + grants.filter((grant) => grant.active).length + 2 > MAX_REBUILD) fail('knowledge_limit');
      const grant = { id: prior?.id ?? crypto.randomUUID(), claim_id: claim.id, recipient_kind: target.kind,
        recipient_id: target.principal, recipient_label: target.label, active: true, revision: Number(state.revision) + 1 };
      await changeAcl(client, ctx, claim, state, prior, grant, 'grant', input);
      return { claim: await projectClaim(client, ctx, claim) };
    },
    async revoke(client, token, input) {
      const ctx = checked(client, token); command(input, ['claimId', 'grantId', 'expectedAclRevision']);
      id(input.claimId); id(input.grantId);
      const claim = (await lockClaims(client, [input.claimId])).get(input.claimId);
      if (!claim || claim.owner_account_id !== ctx.accountId) fail('knowledge_unavailable');
      const state = await aclRevision(client, claim.id, input.expectedAclRevision);
      const prior = (await client.query('SELECT * FROM coordination_claim_grants WHERE claim_id=$1 AND id=$2', [claim.id, input.grantId])).rows[0];
      if (!prior) fail('knowledge_unavailable');
      if (prior.active) await changeAcl(client, ctx, claim, state, prior,
        { ...prior, active: false, revision: Number(state.revision) + 1 }, 'revoke', input);
      return { claim: await projectClaim(client, ctx, claim) };
    },
    async link(client, token, input) {
      const ctx = checked(client, token); requireEnabled(ctx);
      command(input, ['fromClaimId', 'toClaimId', 'relation']); id(input.fromClaimId); id(input.toClaimId);
      if (input.fromClaimId === input.toClaimId || !['corroborates', 'contradicts'].includes(input.relation)) fail('bad_knowledge_request');
      const locked = await lockClaims(client, [input.fromClaimId, input.toClaimId]);
      const from = locked.get(input.fromClaimId), to = locked.get(input.toClaimId);
      if (!await readable(client, ctx, from) || !await readable(client, ctx, to)) fail('knowledge_unavailable');
      await authentic(client, from); await authentic(client, to);
      if (from.content_hash !== to.content_hash || from.domain !== to.domain || from.proposition !== to.proposition) fail('knowledge_unavailable');
      const prior = (await client.query('SELECT * FROM coordination_claim_links WHERE author_account_id=$1 AND from_claim_id=$2 AND to_claim_id=$3 AND relation=$4',
        [ctx.accountId, from.id, to.id, input.relation])).rows[0];
      if (prior) return { link: linkReceipt(prior) };
      const row = { id: crypto.randomUUID(), from_claim_id: from.id, to_claim_id: to.id, relation: input.relation,
        assertion: 'player', author_account_id: ctx.accountId, command_id: input.commandId, created_at: new Date(input.now) };
      await insert(client, 'coordination_claim_links', row);
      return { link: linkReceipt(row) };
    },
    async archive(client, token, input) {
      const ctx = checked(client, token); requireEnabled(ctx); command(input, ['claimId']); id(input.claimId);
      const claim = (await lockClaims(client, [input.claimId])).get(input.claimId);
      if (!await readable(client, ctx, claim)) fail('knowledge_unavailable');
      await authentic(client, claim);
      let archive = (await client.query('SELECT * FROM coordination_knowledge_archives WHERE custodian_account_id=$1', [ctx.accountId])).rows[0];
      if (!archive) {
        archive = { id: crypto.randomUUID(), custodian_account_id: ctx.accountId, policy: 'personal_reference', created_at: new Date(input.now) };
        await insert(client, 'coordination_knowledge_archives', archive);
      }
      let event = (await client.query('SELECT * FROM coordination_archive_events WHERE archive_id=$1 AND claim_id=$2', [archive.id, claim.id])).rows[0];
      if (!event) {
        const entryCount = Number((await client.query('SELECT count(*) AS n FROM coordination_archive_events WHERE archive_id=$1', [archive.id])).rows[0].n);
        if (!Number.isSafeInteger(entryCount) || entryCount >= MAX_REBUILD) fail('knowledge_limit');
        event = { id: crypto.randomUUID(), archive_id: archive.id, claim_id: claim.id, command_id: input.commandId, added_at: new Date(input.now) };
        await insert(client, 'coordination_archive_events', event);
        const { command_id, ...entry } = event; await insert(client, 'coordination_archive_entries', entry);
      }
      return { archive: { id: event.id, addedAt: iso(event.added_at) } };
    },
    async archiveBoard(client, token, input = {}) {
      const ctx = checked(client, token), { limit, after } = pageInput(input, ctx, 'archive');
      const values = [ctx.accountId, after], filter = visibleSql(ctx, values);
      const rows = (await client.query(`SELECT e.* FROM coordination_archive_entries e
        JOIN coordination_knowledge_archives a ON a.id=e.archive_id JOIN coordination_claims c ON c.id=e.claim_id
        WHERE a.custodian_account_id=$1 AND e.id>$2 AND ${filter} ORDER BY e.id LIMIT ${limit + 1}`, values)).rows;
      const locked = await lockClaims(client, rows.map((row) => row.claim_id)), entries = [], cache = new Map();
      for (const row of rows) {
        if (!await readable(client, ctx, locked.get(row.claim_id))) fail('contention');
        entries.push({ id: row.id, claim: await projectClaim(client, ctx, locked.get(row.claim_id), cache), addedAt: iso(row.added_at) });
      }
      const more = entries.length > limit; entries.length = Math.min(entries.length, limit);
      return { entries, nextCursor: more ? cursor(ctx, 'archive', entries.at(-1).id) : null };
    },
    async rebuild(client, token, input) {
      const ctx = checked(client, token); command(input, []);
      const claims = (await client.query(`SELECT id FROM coordination_claims WHERE owner_account_id=$1 ORDER BY id LIMIT ${MAX_REBUILD + 1}`, [ctx.accountId])).rows;
      if (claims.length > MAX_REBUILD) fail('knowledge_limit');
      const archive = (await client.query('SELECT * FROM coordination_knowledge_archives WHERE custodian_account_id=$1', [ctx.accountId])).rows[0];
      const archiveEvents = archive ? (await client.query(`SELECT * FROM coordination_archive_events WHERE archive_id=$1 ORDER BY id LIMIT ${MAX_REBUILD + 1}`, [archive.id])).rows : [];
      if (archiveEvents.length > MAX_REBUILD) fail('knowledge_limit');
      let remainingWork = MAX_REBUILD_WORK;
      const charge = (count) => { remainingWork -= count; if (remainingWork < 0) fail('knowledge_limit'); };
      charge(claims.length + archiveEvents.length);
      // Reinserted foreign references also take an FK row lock. Include them in
      // the complete ordering up front, without granting projection authority.
      await lockClaims(client, [...claims.map((claim) => claim.id), ...archiveEvents.map((event) => event.claim_id)]);
      let grants = 0, archiveEntries = 0;
      for (const claim of claims) {
        const events = (await client.query(`SELECT * FROM coordination_claim_acl_events WHERE claim_id=$1 ORDER BY revision LIMIT ${Math.min(MAX_REBUILD, remainingWork) + 1}`, [claim.id])).rows;
        if (events.length > MAX_REBUILD) fail('knowledge_limit');
        charge(events.length);
        const latest = new Map(); let revision = 0;
        for (const event of events) {
          if (Number(event.revision) !== ++revision || event.author_account_id !== ctx.accountId) fail('knowledge_corrupt');
          const prior = latest.get(event.grant_id);
          if ((prior && (prior.recipient_kind !== event.recipient_kind || prior.recipient_id !== event.recipient_id))
              || (event.operation === 'revoke' && !prior?.active)
              || (event.operation === 'grant' && prior?.active)) fail('knowledge_corrupt');
          latest.set(event.grant_id, { id: event.grant_id, claim_id: claim.id, recipient_kind: event.recipient_kind,
            recipient_id: event.recipient_id, recipient_label: event.recipient_label, active: event.operation === 'grant', revision });
        }
        const current = (await client.query(`SELECT * FROM coordination_claim_grants WHERE claim_id=$1 LIMIT ${remainingWork + 1}`, [claim.id])).rows;
        charge(current.length);
        for (const prior of current) if (!latest.has(prior.id)) {
          await client.query('DELETE FROM coordination_claim_grants WHERE id=$1', [prior.id]);
          registerPhase2Undo(client, () => client.query(`INSERT INTO coordination_claim_grants (${Object.keys(prior).join(',')})
            VALUES (${Object.keys(prior).map((_, i) => `$${i + 1}`).join(',')})`, Object.values(prior)));
          grants++;
        }
        for (const next of latest.values()) {
          const prior = current.find((row) => row.id === next.id);
          if (!prior) { await insert(client, 'coordination_claim_grants', next); grants++; }
          else if (hash(prior) !== hash(next)) { await replace(client, 'coordination_claim_grants', 'id', prior, next); grants++; }
        }
        charge(1); // Include each state read, even when no repair is needed.
        const state = (await client.query('SELECT * FROM coordination_claim_acl_state WHERE claim_id=$1', [claim.id])).rows[0];
        if (!state) await insert(client, 'coordination_claim_acl_state', { claim_id: claim.id, revision });
        else if (Number(state.revision) !== revision) await replace(client, 'coordination_claim_acl_state', 'claim_id', state, { claim_id: claim.id, revision });
      }
      if (archive) {
        const events = archiveEvents;
        const current = (await client.query(`SELECT * FROM coordination_archive_entries WHERE archive_id=$1 LIMIT ${remainingWork + 1}`, [archive.id])).rows;
        charge(current.length);
        for (const prior of current) if (!events.some((event) => event.id === prior.id)) {
          await client.query('DELETE FROM coordination_archive_entries WHERE id=$1', [prior.id]);
          registerPhase2Undo(client, () => client.query('INSERT INTO coordination_archive_entries(id,archive_id,claim_id,added_at) VALUES($1,$2,$3,$4)',
            [prior.id, prior.archive_id, prior.claim_id, prior.added_at])); archiveEntries++;
        }
        for (const event of events) {
          const { command_id, ...next } = event, prior = current.find((entry) => entry.id === event.id);
          if (!prior) { await insert(client, 'coordination_archive_entries', next); archiveEntries++; }
          else if (prior.claim_id !== next.claim_id || iso(prior.added_at) !== iso(next.added_at)) {
            await replace(client, 'coordination_archive_entries', 'id', prior, next); archiveEntries++;
          }
        }
      }
      return { rebuilt: { grants, archiveEntries } };
    },
  });

  async function aclRevision(client, claimId, expected) {
    if (!Number.isSafeInteger(expected) || expected < 0) fail('bad_knowledge_request');
    const state = (await client.query('SELECT * FROM coordination_claim_acl_state WHERE claim_id=$1', [claimId])).rows[0];
    if (!state) fail('knowledge_corrupt');
    if (Number(state.revision) !== expected) fail('knowledge_stale_acl');
    if (Number(state.revision) >= 2147483647) fail('knowledge_limit');
    return state;
  }
  async function changeAcl(client, ctx, claim, state, prior, grant, operation, input) {
    const event = { id: crypto.randomUUID(), claim_id: claim.id, grant_id: grant.id, operation,
      recipient_kind: grant.recipient_kind, recipient_id: grant.recipient_id, recipient_label: grant.recipient_label,
      revision: grant.revision, author_account_id: ctx.accountId, command_id: input.commandId, occurred_at: new Date(input.now) };
    await insert(client, 'coordination_claim_acl_events', event);
    if (prior) await replace(client, 'coordination_claim_grants', 'id', prior, grant);
    else await insert(client, 'coordination_claim_grants', grant);
    await replace(client, 'coordination_claim_acl_state', 'claim_id', state, { claim_id: claim.id, revision: grant.revision });
  }
}
