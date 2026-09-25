// Read-only world diagnostics. Nothing returned here is an actor-policy input.
import assert from 'node:assert/strict';
import { exactDecimal, exactSum } from './rc1-resource-journal.js';

export function exactConcentration(entries) {
  const values = entries.map(({ quantity }) => exactDecimal(quantity));
  assert(values.every((value) => value.coefficient >= 0n), 'Concentration requires nonnegative holdings');
  const scale = Math.max(0, ...values.map((value) => value.scale));
  const integers = values.map((value) => value.coefficient * 10n ** BigInt(scale - value.scale))
    .sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  const total = integers.reduce((sum, value) => sum + value, 0n), n = BigInt(integers.length);
  // Exact ratios: consumers may format them but must not round resource amounts.
  return { holders: entries.length, nonzeroHolders: integers.filter((value) => value > 0n).length,
    total: exactSum(entries.map((entry) => entry.quantity)),
    largestShare: total ? { numerator: integers.at(-1).toString(), denominator: total.toString() } : null,
    gini: total ? { numerator: integers.reduce((sum, value, i) => sum + (2n * BigInt(i) - n + 1n) * value, 0n).toString(),
      denominator: (n * total).toString() } : null };
}

export function latencyDistribution(roster, latencies, actors) {
  const summarize = values => {
    assert(values.every(value => Number.isFinite(value) && value >= 0), 'Invalid measured latency');
    const ordered = [...values].sort((a, b) => a - b);
    const percentile = fraction => ordered.length ? ordered[Math.ceil(ordered.length * fraction) - 1] : null;
    return { count: ordered.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99),
      maximumMs: ordered.at(-1) ?? null };
  };
  const scopes = Object.keys(latencies);
  assert.deepEqual(scopes.sort(), ['command', 'read']);
  for (const scope of scopes) {
    assert.equal(latencies[scope].length, actors[scope].length, 'Missing latency actor attribution');
    assert(actors[scope].every(accountId => accountId === null || roster.includes(accountId)), 'Undeclared latency actor');
  }
  const select = accountId => Object.fromEntries(scopes.map(scope => [scope,
    summarize(latencies[scope].filter((_, index) => actors[scope][index] === accountId))]));
  return { totals: Object.fromEntries(scopes.map(scope => [scope, summarize(latencies[scope])])),
    perPlayer: roster.map(accountId => ({ accountId, ...select(accountId) })), unattributed: select(null),
    scope: 'Measured actor wrapper wall time including required proof observers. Read/command classes include denials and retries; ordinary unauthenticated entry is unattributed. This is not real-time HTTP capacity evidence.' };
}

export function actionDistribution(roster, actions) {
  assert.equal(new Set(roster).size, roster.length);
  for (const [accountId, count] of Object.entries(actions)) {
    assert(roster.includes(accountId), 'Activity belongs to an undeclared actor');
    assert(Number.isSafeInteger(count) && count >= 0);
  }
  const perPlayer = roster.map((accountId) => ({ accountId, actions: actions[accountId] || 0 }));
  return { perPlayer, activePlayers: perPlayer.filter((row) => row.actions > 0).length,
    inactivePlayers: perPlayer.filter((row) => row.actions === 0).length,
    concentration: exactConcentration(perPlayer.map((row) => ({ quantity: row.actions }))) };
}

const QUERIES = {
  accounts: 'SELECT id,status FROM accounts ORDER BY id',
  characters: 'SELECT id,account_id,alive,is_npc,cash::text,bank::text,ammo,cb,season FROM characters ORDER BY id',
  familyMembers: 'SELECT gang_id,character_id,role FROM gang_members ORDER BY gang_id,character_id',
  families: 'SELECT id,npc_flag,treasury::text,omr_reserve::text,ammo_bank FROM gangs ORDER BY id',
  campaigns: 'SELECT id,definition_id,status,created_at,updated_at,expires_at FROM director_campaigns ORDER BY id',
  situations: 'SELECT id,campaign_id,definition_id,state,terminal,outcome,expires_at FROM director_situations ORDER BY id',
  operations: 'SELECT id,coordination_mode,crew_id,family_id,opened_by_account_id,status,revision,created_at,updated_at,expires_at FROM world_operations ORDER BY id',
  participants: 'SELECT operation_id,account_id,character_id,role_id FROM world_operation_roles ORDER BY operation_id,role_id',
  operationContributions: 'SELECT operation_id,node_id,role_id,account_id,character_id FROM world_operation_contributions ORDER BY operation_id,node_id',
  operationCommitments: 'SELECT operation_id,role_id,requirement_id,account_id,character_id,kind,quantity,template_id,item_id,state FROM world_operation_commitments ORDER BY operation_id,role_id,requirement_id',
  operationCapital: 'SELECT operation_id,role_id,requirement_id,account_id,character_id,amount::text,state FROM world_operation_capital ORDER BY operation_id,role_id,requirement_id',
  operationEscrow: 'SELECT operation_id,item_id,depositor_scope,depositor_id FROM operation_escrow ORDER BY operation_id,item_id',
  operationItems: "SELECT id,owner_id,state FROM item_instances WHERE owner_scope='operation' ORDER BY id",
  operationLots: "SELECT lot_id,owner_id,custody_id,depositor_scope,depositor_id,state,remaining_quantity FROM item_lots WHERE owner_scope='operation' AND remaining_quantity>0 ORDER BY lot_id",
  mysteries: 'SELECT id,authority_account_id,owner_scope,owner_id,graph_id,status FROM mystery_instances ORDER BY id',
  discoveries: 'SELECT id,owner_account_id,owner_character_id,graph_id,status FROM coordination_instances ORDER BY id',
  crewObjectives: 'SELECT crew_id,week,kind,target,progress,done FROM crew_objectives ORDER BY crew_id,week',
  claims: 'SELECT id,owner_account_id FROM coordination_claims ORDER BY id',
  grants: 'SELECT claim_id,recipient_kind,recipient_id,active FROM coordination_claim_grants ORDER BY claim_id,recipient_kind,recipient_id',
  inventory: `SELECT owner_scope,owner_id,template_id,quality,SUM(quantity)::text AS quantity
    FROM item_stacks GROUP BY owner_scope,owner_id,template_id,quality ORDER BY owner_scope,owner_id,template_id,quality`,
  uniqueItems: `SELECT owner_scope,owner_id,template_id,state,COUNT(*)::text AS quantity
    FROM item_instances GROUP BY owner_scope,owner_id,template_id,state ORDER BY owner_scope,owner_id,template_id,state`,
  lots: `SELECT owner_scope,owner_id,logical_item_id,custody_state,state,SUM(remaining_quantity)::text AS quantity
    FROM item_lots GROUP BY owner_scope,owner_id,logical_item_id,custody_state,state
    ORDER BY owner_scope,owner_id,logical_item_id,custody_state,state`,
  ledger: `SELECT account_id,character_id,currency,reason,COUNT(*)::text AS rows,
    SUM(amount)::text AS net,SUM(ABS(amount))::text AS gross,
    SUM(CASE WHEN amount>0 THEN amount ELSE 0 END)::text AS positive
    FROM transactions GROUP BY account_id,character_id,currency,reason
    ORDER BY account_id,character_id,currency,reason`,
};
const OPERATION_STATES = { crew: new Set(['forming', 'active', 'completed', 'canceled', 'abandoned']),
  family: new Set(['draft', 'recruiting', 'committed', 'ready', 'executing', 'resolving', 'completed', 'failed', 'canceled', 'expired']) };
const TERMINAL = new Set(['completed', 'failed', 'canceled', 'expired', 'abandoned']);
const operationOpen = (row) => OPERATION_STATES[row.coordination_mode]?.has(row.status) && !TERMINAL.has(row.status);
const by = (rows, key) => new Map(rows.map((row) => [row[key], row]));
const group = (rows, key) => {
  const result = new Map();
  for (const row of rows) { const values = result.get(row[key]) || []; values.push(row); result.set(row[key], values); }
  return result;
};

// Inspect whole tables, never inner joins that silently drop missing parents.
// Dead participants and dissolved Families/Crews are historical identities, not
// evidence of an orphan: both operation authorities retain release-only recovery.
export function operationLifecycleDiagnostics(rows, logicalAt) {
  const required = ['accounts', 'characters', 'operations', 'participants', 'operationContributions',
    'operationCommitments', 'operationCapital', 'operationEscrow', 'operationItems', 'operationLots', 'mysteries', 'inventory'];
  const missingTables = required.filter((key) => !Array.isArray(rows[key]));
  if (missingTables.length) return { complete: false, missingTables, structuralOrphanOperations: null,
    orphanedOperations: null, issues: [], recoveryRequiredOperationIds: [] };
  const operations = by(rows.operations, 'id'), accounts = by(rows.accounts, 'id'), characters = by(rows.characters, 'id');
  // Mystery effects share the generic operation custody namespace. Their
  // instance ID is a real parent even though it is not in world_operations.
  const mysteries = by(rows.mysteries, 'id'), custodyParents = new Map([...mysteries, ...operations]);
  const roles = new Map(rows.participants.map((row) => [JSON.stringify([row.operation_id, row.role_id]), row]));
  const promises = group(rows.operationCommitments, 'operation_id'), capital = group(rows.operationCapital, 'operation_id');
  const escrows = group(rows.operationEscrow, 'operation_id'), items = by(rows.operationItems, 'id');
  const escrowItems = by(rows.operationEscrow, 'item_id');
  const stacks = group(rows.inventory.filter((row) => row.owner_scope === 'operation'), 'owner_id');
  const issues = [], issue = (operationId, kind, identity) => issues.push({ operationId, kind, identity });
  for (const [table, values] of [['role', rows.participants], ['contribution', rows.operationContributions],
    ['commitment', rows.operationCommitments], ['capital', rows.operationCapital]]) for (const row of values) {
    const identity = JSON.stringify([row.role_id, row.requirement_id ?? row.node_id ?? null]);
    if (!operations.has(row.operation_id)) issue(row.operation_id, `${table}:missing-operation`, identity);
    if (!accounts.has(row.account_id) || characters.get(row.character_id)?.account_id !== row.account_id)
      issue(row.operation_id, `${table}:missing-or-mismatched-principal`, identity);
    if (table === 'contribution') {
      const role = roles.get(JSON.stringify([row.operation_id, row.role_id]));
      if (!role || role.account_id !== row.account_id || role.character_id !== row.character_id)
        issue(row.operation_id, 'contribution:missing-or-mismatched-role', identity);
    }
  }
  for (const row of rows.operationEscrow) {
    const item = items.get(row.item_id);
    if (!custodyParents.has(row.operation_id)) issue(row.operation_id, 'escrow:missing-operation', row.item_id);
    if (!item || item.owner_id !== row.operation_id || item.state !== 'escrowed') issue(row.operation_id, 'escrow:missing-or-mismatched-item', row.item_id);
    if (!(row.depositor_scope === 'account' ? accounts : row.depositor_scope === 'character' ? characters : new Map()).has(row.depositor_id))
      issue(row.operation_id, 'escrow:missing-return-owner', row.item_id);
    const mystery = mysteries.get(row.operation_id);
    if (mystery && (row.depositor_scope !== mystery.owner_scope || row.depositor_id !== mystery.owner_id))
      issue(row.operation_id, 'mystery:wrong-return-owner', row.item_id);
    if (mystery && mystery.status !== 'active') issue(row.operation_id, 'mystery:terminal-held-custody', row.item_id);
  }
  for (const row of rows.operationItems) {
    if (!custodyParents.has(row.owner_id)) issue(row.owner_id, 'item:missing-operation', row.id);
    // Canonical consumption retains the operation as historical owner and
    // deletes the escrow. The consumed provenance row is not stranded custody.
    if (row.state === 'consumed' ? escrowItems.has(row.id)
      : row.state !== 'escrowed' || escrowItems.get(row.id)?.operation_id !== row.owner_id)
      issue(row.owner_id, 'item:missing-or-mismatched-escrow', row.id);
  }
  for (const row of rows.operationLots) {
    if (!custodyParents.has(row.owner_id)) issue(row.owner_id, 'lot:missing-operation', row.lot_id);
    if (row.state !== 'escrowed' || row.custody_id !== row.owner_id) issue(row.owner_id, 'lot:invalid-custody', row.lot_id);
    if (!(row.depositor_scope === 'account' ? accounts : row.depositor_scope === 'character' ? characters : new Map()).has(row.depositor_id))
      issue(row.owner_id, 'lot:missing-return-owner', row.lot_id);
    if (TERMINAL.has(custodyParents.get(row.owner_id)?.status)) issue(row.owner_id, 'lot:terminal-held-custody', row.lot_id);
  }
  for (const [id, values] of stacks) if (!operations.has(id)) for (const row of values)
    issue(id, 'resource:missing-operation', JSON.stringify([row.template_id, row.quality]));
  for (const operation of operations.values()) {
    const id = operation.id, heldCash = (capital.get(id) || []).filter((row) => row.state === 'held');
    const commitments = promises.get(id) || [], heldItems = escrows.get(id) || [], heldStacks = stacks.get(id) || [];
    if (!OPERATION_STATES[operation.coordination_mode]?.has(operation.status)) issue(id, 'unknown-lifecycle-state', operation.status);
    if (!accounts.has(operation.opened_by_account_id)) issue(id, 'missing-opener', operation.opened_by_account_id);
    if (TERMINAL.has(operation.status) && (heldCash.length || heldItems.length
      || heldStacks.some((row) => exactDecimal(row.quantity).coefficient !== 0n)
      || commitments.some((row) => ['promised', 'fulfilled'].includes(row.state)))) issue(id, 'terminal-held-custody-or-promise', operation.status);
    if (operation.coordination_mode !== 'family') continue;
    const expectedStacks = new Map(), expectedItems = new Set();
    const promiseByKey = new Map(commitments.map((row) => [JSON.stringify([row.role_id, row.requirement_id]), row]));
    for (const row of heldCash) {
      const promise = promiseByKey.get(JSON.stringify([row.role_id, row.requirement_id]));
      if (!promise || promise.kind !== 'capital' || promise.state !== 'fulfilled' || promise.account_id !== row.account_id
        || promise.character_id !== row.character_id || exactSum([promise.quantity]) !== exactSum([row.amount]))
        issue(id, 'capital:unbound-deposit', JSON.stringify([row.role_id, row.requirement_id]));
    }
    for (const promise of commitments.filter((row) => row.state === 'fulfilled')) {
      if (promise.kind === 'capital' && !heldCash.some((row) => row.role_id === promise.role_id && row.requirement_id === promise.requirement_id))
        issue(id, 'capital:missing-deposit', JSON.stringify([promise.role_id, promise.requirement_id]));
      if (promise.kind === 'resource') expectedStacks.set(promise.template_id,
        exactSum([expectedStacks.get(promise.template_id) || '0', promise.quantity]));
      if (promise.kind === 'item') {
        expectedItems.add(promise.item_id);
        const escrow = escrowItems.get(promise.item_id);
        if (!escrow || escrow.operation_id !== id || escrow.depositor_scope !== 'account' || escrow.depositor_id !== promise.account_id)
          issue(id, 'item:unbound-promise', promise.item_id);
      }
    }
    for (const row of heldItems) if (!expectedItems.has(row.item_id)) issue(id, 'item:unbound-deposit', row.item_id);
    for (const row of heldStacks) {
      if (row.quality !== 'standard' || exactSum([row.quantity]) !== (expectedStacks.get(row.template_id) || '0'))
        issue(id, 'resource:unbound-deposit', JSON.stringify([row.template_id, row.quality]));
      expectedStacks.delete(row.template_id);
    }
    for (const [template, quantity] of expectedStacks) if (exactDecimal(quantity).coefficient !== 0n)
      issue(id, 'resource:missing-deposit', template);
  }
  const recoveryRequiredOperationIds = rows.operations.filter(operationOpen).map((row) => row.id);
  return { complete: true, missingTables: [], structuralOrphanOperations: new Set(issues.map((row) => row.operationId)).size,
    // Structural integrity does not prove that every open operation can progress
    // or recover. Join positive canonical operation-recovery paths separately.
    orphanedOperations: recoveryRequiredOperationIds.length ? null : new Set(issues.map((row) => row.operationId)).size,
    issues, recoveryRequiredOperationIds,
    overdueOpenOperationIds: rows.operations.filter((row) => operationOpen(row) && row.expires_at
      && new Date(row.expires_at).getTime() <= logicalAt).map((row) => row.id),
    note: 'Complete structural/lifecycle custody scan, including Mystery IDs in the shared operation escrow namespace; open operations need canonical recovery witnesses. Exact lot backing, capital conservation and receipt history remain the canonical invariant suite responsibility.' };
}

export function worldObjectiveInventory(rows) {
  const required = ['operations', 'campaigns', 'situations', 'mysteries', 'discoveries', 'crewObjectives'];
  const missingTables = required.filter((key) => !Array.isArray(rows[key]));
  const subjects = [
    ...(rows.operations || []).filter(operationOpen).map((row) => ({ type: 'operation', id: row.id })),
    ...(rows.campaigns || []).filter((row) => row.status === 'active').map((row) => ({ type: 'campaign', id: row.id })),
    ...(rows.situations || []).filter((row) => !row.terminal).map((row) => ({ type: 'situation', id: row.id })),
    ...(rows.mysteries || []).filter((row) => row.status === 'active').map((row) => ({ type: 'mystery', id: row.id })),
    ...(rows.discoveries || []).filter((row) => row.status === 'active').map((row) => ({ type: 'discovery', id: row.id })),
    ...(rows.crewObjectives || []).filter((row) => !row.done).map((row) => ({ type: 'crew_objective', id: JSON.stringify([row.crew_id, row.week]) })),
  ];
  return { tablesComplete: missingTables.length === 0, missingTables, subjects,
    note: 'Stored unresolved subjects, including historical generations/weeks; the canonical path must establish completion or legal recovery/retirement. This inventory alone does not enumerate actor eligibility, unmet resource prerequisites, Family access or Knowledge requirements.' };
}
const counts = (values) => Object.fromEntries([...new Set(values)].sort()
  .map((key) => [key, values.filter((value) => value === key).length]));
const groupedInventory = (rows, identity) => {
  const groups = new Map();
  for (const row of rows) {
    const key = JSON.stringify(identity(row));
    const owners = groups.get(key) || new Map();
    const owner = JSON.stringify([row.owner_scope, row.owner_id]);
    owners.set(owner, exactSum([owners.get(owner) || '0', row.quantity])); groups.set(key, owners);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([identity, owners]) => ({
    identity: JSON.parse(identity), perOwner: [...owners].sort(([a], [b]) => a.localeCompare(b))
      .map(([owner, quantity]) => ({ owner: JSON.parse(owner), quantity })),
    concentration: exactConcentration([...owners.values()].map((quantity) => ({ quantity }))) }));
};

export function summarizeWorldDiagnostics(rows, { logicalAt, roster, actorActions }) {
  assert(Number.isSafeInteger(logicalAt));
  const actors = new Set(roster), living = rows.characters.filter((row) => row.alive && actors.has(row.account_id));
  const byCharacter = new Map(rows.characters.map((row) => [row.id, row]));
  const familyCounts = rows.families.map((family) => ({ familyId: family.id, npc: family.npc_flag,
    livingDeclaredMembers: rows.familyMembers.filter((member) => member.gang_id === family.id
      && byCharacter.get(member.character_id)?.alive && actors.has(byCharacter.get(member.character_id)?.account_id)).length }));
  const lifecycle = operationLifecycleDiagnostics(rows, logicalAt);
  return { logicalAt, actions: actionDistribution(roster, actorActions), objectiveInventory: worldObjectiveInventory(rows),
    population: { declaredAccounts: roster.length, livingDeclaredCharacters: living.length,
      residentCharacters: rows.characters.filter((row) => row.is_npc).length, allCharacters: rows.characters.length },
    director: { campaignsCreated: rows.campaigns.length, campaignStatuses: counts(rows.campaigns.map((row) => row.status)),
      situationsCreated: rows.situations.length, situationStates: counts(rows.situations.map((row) => row.state)),
      terminalOutcomes: counts(rows.situations.filter((row) => row.terminal).map((row) => row.outcome || 'unspecified')),
      // An overdue observation is actionable context, not proof of permanent deadlock.
      overdueActiveCampaignIds: rows.campaigns.filter((row) => row.status === 'active' && new Date(row.expires_at).getTime() <= logicalAt).map((row) => row.id) },
    coordination: { statuses: counts(rows.operations.map((row) => row.status)),
      participants: rows.participants, distinctParticipatingAccounts: new Set(rows.participants.map((row) => row.account_id)).size,
      lifecycle, overdueOpenOperationIds: lifecycle.overdueOpenOperationIds || [] },
    knowledge: { ownedClaimsPerDeclaredActor: roster.map((accountId) => ({ accountId,
      ownedClaims: rows.claims.filter((claim) => claim.owner_account_id === accountId).length })),
      totalClaims: rows.claims.length, activeGrantRecipientKinds: counts(rows.grants.filter((row) => row.active).map((row) => row.recipient_kind)),
      authorizedAccessibleClaims: null, note: 'Ownership and active grant records do not substitute for current membership and canonical read authorization.' },
    families: { perFamily: familyCounts,
      livingDeclaredMembershipConcentration: exactConcentration(familyCounts.map((row) => ({ quantity: row.livingDeclaredMembers }))),
      treasuryCashConcentration: exactConcentration(rows.families.map((row) => ({ quantity: row.treasury }))),
      reserveOmrConcentration: exactConcentration(rows.families.map((row) => ({ quantity: row.omr_reserve }))) },
    inventory: { stacks: groupedInventory(rows.inventory, (row) => [row.template_id, row.quality]),
      uniqueItems: groupedInventory(rows.uniqueItems, (row) => [row.template_id, row.state]),
      lots: groupedInventory(rows.lots, (row) => [row.logical_item_id, row.custody_state, row.state]),
      note: 'Representations are separate; lot backing and its item claim are never summed together.' },
    ledgerActivity: { byActorCurrencyReason: rows.ledger,
      note: 'Signed net and gross ledger-row amounts are exact. Gross counts transfer legs; it is not deduplicated resource velocity or reward attribution.' },
    unresolved: ['Permanent deadlocks and unreachable objectives require applicable canonical prerequisite/recovery evidence for the complete obligation inventory',
      ...(lifecycle.orphanedOperations === null ? ['Open or unobserved operation lifecycle recovery requires canonical path/goal evidence'] : []),
      'Complete Knowledge reachability and per-player authorized distribution',
      'Resource velocity and reward concentration need complete receipt disposition classification'] };
}

export async function collectWorldDiagnostics(pool, options) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const rows = {};
    for (const [name, sql] of Object.entries(QUERIES)) rows[name] = (await client.query(sql)).rows;
    const tables = (await client.query(`SELECT table_name FROM information_schema.tables
      WHERE table_schema=current_schema() AND table_type='BASE TABLE' ORDER BY table_name`)).rows;
    const growth = [];
    for (const { table_name: table } of tables) {
      const identifier = `"${table.replaceAll('"', '""')}"`;
      const count = (await client.query(`SELECT COUNT(*)::text AS count FROM ${identifier}`)).rows[0].count;
      const bytes = (await client.query('SELECT pg_total_relation_size($1::regclass)::text AS bytes', [identifier])).rows[0].bytes;
      growth.push({ table, count, bytes });
    }
    const boundary = (await client.query('SELECT pg_current_snapshot()::text AS snapshot')).rows[0].snapshot;
    await client.query('COMMIT');
    return { semantic: { ...summarizeWorldDiagnostics(rows, options),
      worldRows: growth.map(({ table, count }) => ({ table, count })) },
      physicalDiagnostics: { databaseBoundary: boundary, relationBytes: growth.map(({ table, bytes }) => ({ table, bytes })),
        replayTreatment: 'MVCC identity and physical allocation are diagnostic metadata, excluded only from semantic diagnostic comparison. No canonical state field is removed.' } };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
