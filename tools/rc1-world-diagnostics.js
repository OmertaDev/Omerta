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
  characters: 'SELECT id,account_id,alive,is_npc,cash::text,bank::text,ammo,cb,season FROM characters ORDER BY id',
  familyMembers: 'SELECT gang_id,character_id,role FROM gang_members ORDER BY gang_id,character_id',
  families: 'SELECT id,npc_flag,treasury::text,omr_reserve::text,ammo_bank FROM gangs ORDER BY id',
  campaigns: 'SELECT id,definition_id,status,created_at,updated_at,expires_at FROM director_campaigns ORDER BY id',
  situations: 'SELECT id,campaign_id,definition_id,state,terminal,outcome,expires_at FROM director_situations ORDER BY id',
  operations: 'SELECT id,coordination_mode,crew_id,family_id,status,created_at,updated_at,expires_at FROM world_operations ORDER BY id',
  participants: 'SELECT operation_id,account_id,character_id,role_id FROM world_operation_roles ORDER BY operation_id,role_id',
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
  return { logicalAt, actions: actionDistribution(roster, actorActions),
    population: { declaredAccounts: roster.length, livingDeclaredCharacters: living.length,
      residentCharacters: rows.characters.filter((row) => row.is_npc).length, allCharacters: rows.characters.length },
    director: { campaignsCreated: rows.campaigns.length, campaignStatuses: counts(rows.campaigns.map((row) => row.status)),
      situationsCreated: rows.situations.length, situationStates: counts(rows.situations.map((row) => row.state)),
      terminalOutcomes: counts(rows.situations.filter((row) => row.terminal).map((row) => row.outcome || 'unspecified')),
      // An overdue observation is actionable context, not proof of permanent deadlock.
      overdueActiveCampaignIds: rows.campaigns.filter((row) => row.status === 'active' && new Date(row.expires_at).getTime() <= logicalAt).map((row) => row.id) },
    coordination: { statuses: counts(rows.operations.map((row) => row.status)),
      participants: rows.participants, distinctParticipatingAccounts: new Set(rows.participants.map((row) => row.account_id)).size,
      overdueOpenOperationIds: rows.operations.filter((row) => ['forming', 'active'].includes(row.status)
        && row.expires_at && new Date(row.expires_at).getTime() <= logicalAt).map((row) => row.id) },
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
    unresolved: ['Permanent deadlocks and unreachable objectives require canonical prerequisite/recovery exploration',
      'Orphaned operations require lifecycle and custody disposition verification',
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
