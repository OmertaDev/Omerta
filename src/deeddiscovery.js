// Primary property issuance is earned in the city. Progress belongs to the account, while
// buildings stay globally available until a successful claim consumes one permanent identity.
import { GameError, assertStreetActor } from './game.js';
import { DISTRICTS, levelOf } from './rules.js';
import { buildingAtlas, deedBuildingById } from './deedbuildings.js';
import { verifiedQuestDeedEligibility } from './deedquesteligibility.js';

export const DEED_DISCOVERY = Object.freeze({
  minimumLevel: 15, stepsRequired: 4, cooldownSeconds: 0, energyPerStep: 5, policyVersion: 2,
  primaryClaimsPerAccount: 1,
});

const ROUTE_DISTRICTS = Object.freeze(['docks', 'neon', 'foundry', 'brick', 'canal', 'cathedral']);

export function deedInvestigationRoute(building) {
  const home = ROUTE_DISTRICTS.indexOf(building.district);
  const variant = Number(building.number) % 2;
  const registry = ROUTE_DISTRICTS[(home + 1 + variant) % ROUTE_DISTRICTS.length];
  const witness = ROUTE_DISTRICTS[(home + 3 + variant) % ROUTE_DISTRICTS.length];
  return [
    { id: 'site', actionId: 'inspect-site', title: 'Inspect the property', requiredDistrict: building.district,
      description: `Inspect ${building.id} and record its original address and building markings.` },
    { id: 'registry', actionId: 'verify-registry', title: 'Verify the registry record', requiredDistrict: registry,
      description: `Take the address to the registry contact in ${registry} and match the original title entry.` },
    { id: 'witness', actionId: 'question-witness', title: 'Question the title witness', requiredDistrict: witness,
      description: `Find the title witness in ${witness} and corroborate the registry record for ${building.id}.` },
    { id: 'title', actionId: 'secure-title', title: 'Secure the property title', requiredDistrict: building.district,
      description: 'Return to the property with the address, registry record and witness statement to secure the title.' },
  ];
}

function progressFor(record, building) {
  if (!record || record.source !== 'exploration') return { steps: 0, evidence: [], legacyReset: false };
  const legacyReset = Number(record.policy_version) !== DEED_DISCOVERY.policyVersion;
  if (legacyReset) return { steps: 0, evidence: [], legacyReset: true };
  let evidence;
  try { evidence = JSON.parse(record.objective_evidence || '[]'); } catch { evidence = null; }
  const route = deedInvestigationRoute(building);
  const steps = Number(record.steps);
  const valid = Array.isArray(evidence) && Number.isInteger(steps) && steps >= 0 && steps <= route.length
    && (steps === route.length ? !!record.qualified_at : !record.qualified_at)
    && evidence.length === steps && evidence.every((entry, index) => entry && entry.buildingId === building.id
      && entry.policyVersion === DEED_DISCOVERY.policyVersion && entry.objectiveId === route[index].id
      && entry.actionId === route[index].actionId && entry.district === route[index].requiredDistrict
      && typeof entry.characterId === 'string' && entry.characterId.length > 0
      && typeof entry.at === 'string' && Number.isFinite(Date.parse(entry.at)));
  return valid ? { steps, evidence, legacyReset: false } : { steps: 0, evidence: [], legacyReset: true };
}

function assertExplorer(ch, building = null) {
  if (!ch?.alive || ch.is_npc) throw new GameError('no_character', 'A living player must investigate the property.');
  if (levelOf(Number(ch.respect || 0)) < DEED_DISCOVERY.minimumLevel)
    throw new GameError('level', `Property discovery opens at level ${DEED_DISCOVERY.minimumLevel}.`);
  assertStreetActor(ch);
  if (building && ch.loc !== building.district)
    throw new GameError('location', 'Visit the property’s district first.', { district: building.district });
}

function actorReason(ch) {
  try { assertExplorer(ch); return null; } catch (error) { return error.code || 'unavailable'; }
}

async function primaryClaim(client, accountId) {
  return (await client.query('SELECT * FROM street_deed_primary_claims WHERE account_id=$1', [accountId])).rows[0] || null;
}

async function lockExplorer(client, ch) {
  // Same ordering as withCharacter: character, account, then leaf discovery and supply rows.
  const actor = (await client.query(
    'SELECT id FROM characters WHERE id=$1 AND account_id=$2 AND alive AND NOT is_npc FOR UPDATE',
    [ch.id, ch.account_id])).rows[0];
  if (!actor) throw new GameError('no_character', 'A living player must investigate the property.');
  await client.query('SELECT account_id FROM account_persistent WHERE account_id=$1 FOR UPDATE', [ch.account_id]);
  assertExplorer(ch);
  if (await primaryClaim(client, ch.account_id))
    throw new GameError('deed_primary_claimed', 'Your bloodline has already claimed its discovery deed. Trade for other properties.');
}

async function availableBuilding(client, ch, id, { atProperty = true } = {}) {
  const building = deedBuildingById(id);
  if (!building) throw new GameError('building', 'Choose a building from the property atlas.');
  assertExplorer(ch, atProperty ? building : null);
  if ((await client.query('SELECT 1 FROM street_deed_building_assignments WHERE building_id=$1', [building.id])).rowCount)
    throw new GameError('deed_building_claimed', 'That building has already been claimed. Investigate another property.');
  return building;
}

export async function deedDiscoveryBoard(client, ch, { district = ch.loc } = {}) {
  if (!DISTRICTS.some(item => item.id === district))
    throw new GameError('district', 'Choose a district from the property atlas.');
  // withCharacter owns one physical transaction client; never overlap queries on that client.
  const receipt = await primaryClaim(client, ch.account_id);
  const owned = (await client.query('SELECT 1 FROM street_deeds WHERE account_id=$1', [ch.account_id])).rowCount > 0;
  const atlas = await buildingAtlas(client, { district });
  const records = await client.query(
    'SELECT * FROM street_deed_discoveries WHERE account_id=$1 ORDER BY last_step_at DESC,building_id', [ch.account_id]);
  const reason = actorReason(ch);
  const questSource = !receipt && !reason
    ? await verifiedQuestDeedEligibility(client, { accountId: ch.account_id, characterId: ch.id }) : null;
  const progress = new Map(records.rows.map((row) => [row.building_id, row]));
  const project = (building) => {
    const row = progress.get(building.id);
    const state = progressFor(row, building);
    const explored = state.steps === DEED_DISCOVERY.stepsRequired && !!row?.qualified_at;
    // Quest approval is checked at claim too; a stale quest flag cannot grant a deed.
    const qualified = !!questSource || explored;
    const step = deedInvestigationRoute(building)[state.steps] || null;
    const open = !receipt && !reason && !building.claimed;
    const blockedReason = !open ? receipt ? 'deed_primary_claimed' : reason || 'deed_building_claimed'
      : !step ? 'deed_discovered' : ch.loc !== step.requiredDistrict ? 'location'
        : Number(ch.energy) < DEED_DISCOVERY.energyPerStep ? 'energy' : null;
    const objective = step ? { ...step, canAct: !blockedReason && !qualified, blockedReason } : null;
    return { ...building, steps: state.steps, qualified, legacyReset: state.legacyReset,
      source: explored ? 'exploration' : questSource ? 'quest' : row?.source || null,
      nextInvestigateAt: null, objective,
      canInvestigate: !!objective?.canAct,
      canClaim: !!(open && qualified && !owned && ch.loc === building.district),
    };
  };
  const buildings = atlas.buildings.map(project);
  // An investigation remains visible while its next objective sends the player across the city.
  // The global ledger still determines whether another player has since claimed the property.
  const atlasIds = new Set(buildings.map(building => building.id));
  const investigationRecords = records.rows.filter(row => row.source === 'exploration');
  const activeRecords = investigationRecords.slice(0, 20);
  let otherBuildings = [];
  if (activeRecords.some(row => !atlasIds.has(row.building_id))) {
    const all = await buildingAtlas(client);
    const activeIds = new Set(activeRecords.map(row => row.building_id));
    otherBuildings = all.buildings.filter(building => activeIds.has(building.id) && !atlasIds.has(building.id));
  }
  const activeIds = new Set(activeRecords.map(row => row.building_id));
  const activeInvestigations = [...buildings.filter(building => activeIds.has(building.id)), ...otherBuildings.map(project)];
  return {
    ...DEED_DISCOVERY, config: { ...DEED_DISCOVERY }, primaryClaimed: !!receipt, claimedName: receipt?.street_name || null,
    currentDistrict: ch.loc, questEligible: !!questSource, questSource,
    actorEligible: !reason, reason: receipt ? 'deed_primary_claimed' : reason || (owned ? 'have_deed' : null),
    buildings, activeInvestigations, activeInvestigationCount: investigationRecords.length,
  };
}

export async function discoveryAvailability(ch, client) {
  const board = await deedDiscoveryBoard(client, ch);
  const choices = [...board.activeInvestigations, ...board.buildings];
  const claim = choices.find((building) => building.canClaim);
  const investigate = choices.find((building) => building.canInvestigate);
  return { canClaim: !!claim, canInvestigate: !!investigate,
    buildingId: (claim || investigate)?.id || null, reason: board.reason,
    actionId: investigate?.objective?.actionId || null,
    requiredDistrict: investigate?.objective?.requiredDistrict || null };
}

export async function investigateDeed(ch, { buildingId, actionId } = {}, client, h) {
  await lockExplorer(client, ch);
  const building = await availableBuilding(client, ch, buildingId, { atProperty: false });
  const record = (await client.query(
    'SELECT * FROM street_deed_discoveries WHERE account_id=$1 AND building_id=$2 FOR UPDATE',
    [ch.account_id, building.id])).rows[0];
  const progress = progressFor(record, building);
  if (progress.steps === DEED_DISCOVERY.stepsRequired && record?.qualified_at)
    throw new GameError('deed_discovered', 'This building is ready to claim. Name your property.');
  const objective = deedInvestigationRoute(building)[progress.steps];
  if (actionId !== objective.actionId)
    throw new GameError('deed_action', 'Follow this property’s current investigation objective.',
      { actionId: objective.actionId, district: objective.requiredDistrict });
  if (ch.loc !== objective.requiredDistrict)
    throw new GameError('location', 'Visit the district named in this investigation objective.', { district: objective.requiredDistrict });
  assertStreetActor(ch, { energy: DEED_DISCOVERY.energyPerStep });
  const steps = progress.steps + 1;
  const qualified = steps === DEED_DISCOVERY.stepsRequired;
  const source = 'exploration';
  const at = new Date();
  const evidence = [...progress.evidence, { policyVersion: DEED_DISCOVERY.policyVersion, buildingId: building.id,
    objectiveId: objective.id, actionId: objective.actionId, district: ch.loc, characterId: ch.id, at: at.toISOString() }];
  if (record) await client.query(
    `UPDATE street_deed_discoveries SET steps=$3,last_step_at=$4,qualified_at=$5,source=$6,source_ref=NULL,
      policy_version=$7,objective_evidence=$8
      WHERE account_id=$1 AND building_id=$2`,
    [ch.account_id, building.id, steps, at, qualified ? at : null, source, DEED_DISCOVERY.policyVersion, JSON.stringify(evidence)]);
  else await client.query(
    `INSERT INTO street_deed_discoveries
      (account_id,building_id,steps,last_step_at,qualified_at,source,policy_version,objective_evidence)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [ch.account_id, building.id, steps, at, qualified ? at : null, source, DEED_DISCOVERY.policyVersion, JSON.stringify(evidence)]);
  ch.energy = Number(ch.energy) - DEED_DISCOVERY.energyPerStep;
  if (h?.track) await h.track(client, ch.account_id, 'deed_investigate', { buildingId: building.id, steps, qualified, source, actionId });
  return { ok: true, building, steps, qualified, source, energySpent: DEED_DISCOVERY.energyPerStep,
    policyVersion: DEED_DISCOVERY.policyVersion, legacyReset: progress.legacyReset,
    completedObjective: objective, objective: deedInvestigationRoute(building)[steps] || null, nextInvestigateAt: null };
}

// Called inside the claim transaction, before the global issuance lock. No client-supplied
// quest flag or completion count participates in either qualification or the permanent receipt.
export async function prepareDiscoveredDeedClaim(client, ch, buildingId) {
  await lockExplorer(client, ch);
  const building = await availableBuilding(client, ch, buildingId);
  const record = (await client.query(
    'SELECT * FROM street_deed_discoveries WHERE account_id=$1 AND building_id=$2 FOR UPDATE',
    [ch.account_id, building.id])).rows[0];
  if (record?.qualified_at && progressFor(record, building).steps === DEED_DISCOVERY.stepsRequired)
    return { building, source: 'exploration', record };
  const quest = await verifiedQuestDeedEligibility(client, { accountId: ch.account_id, characterId: ch.id });
  if (!quest) throw new GameError('deed_not_discovered', 'Investigate this building, or finish its approved quest, before claiming it.');
  return { building, source: 'quest', sourceRef: JSON.stringify(quest), record };
}

export async function consumeDiscoveredDeedClaim(client, ch, name, eligibility) {
  const { building, source, sourceRef, record } = eligibility;
  await client.query(
    'INSERT INTO street_deed_primary_claims (account_id,street_name,building_id,source) VALUES ($1,$2,$3,$4)',
    [ch.account_id, name, building.id, source]);
  if (source === 'quest') {
    if (record) await client.query(
      `UPDATE street_deed_discoveries SET qualified_at=now(),source='quest',source_ref=$3
        WHERE account_id=$1 AND building_id=$2`, [ch.account_id, building.id, sourceRef]);
    else await client.query(
      `INSERT INTO street_deed_discoveries (account_id,building_id,qualified_at,source,source_ref)
        VALUES ($1,$2,now(),'quest',$3)`, [ch.account_id, building.id, sourceRef]);
  }
}
