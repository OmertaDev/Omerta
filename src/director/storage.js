import { registerItemTransactionUndo } from '../items.js';
import { directorHash } from './selection.js';
import { GameError } from '../game.js';

export async function admitDefinitions(client, compiled) {
  for (const [kind, definitions] of [['situation', compiled.situations], ['campaign', compiled.campaigns]]) {
    for (const d of definitions) {
      const prior = (await client.query(`SELECT content_hash,definition_json FROM director_definitions
        WHERE kind=$1 AND definition_id=$2 AND version=$3`, [kind, d.id, d.version])).rows[0];
      const json = JSON.stringify(d);
      if (prior) {
        if (prior.content_hash !== d.contentHash || prior.definition_json !== json)
          throw new GameError('director_definition_changed', 'Director content is unavailable.');
        continue;
      }
      await client.query(`INSERT INTO director_definitions(kind,definition_id,version,content_hash,definition_json)
        VALUES($1,$2,$3,$4,$5)`, [kind, d.id, d.version, d.contentHash, json]);
      registerItemTransactionUndo(client, () => client.query(`DELETE FROM director_definitions
        WHERE kind=$1 AND definition_id=$2 AND version=$3`, [kind, d.id, d.version]));
    }
  }
}

export async function directorReceipt(client, key, kind, subject, result, at) {
  await client.query(`INSERT INTO director_receipts(execution_id,kind,subject_id,result_json,created_at)
    VALUES($1,$2,$3,$4,$5)`, [key, kind, subject, JSON.stringify(result), new Date(at)]);
  registerItemTransactionUndo(client, () => client.query('DELETE FROM director_receipts WHERE execution_id=$1', [key]));
  return result;
}

export async function changeSituation(client, row, state, terminal, outcome, eventId, kind, at) {
  const identity = directorHash([kind, row.id, Number(row.revision), state, outcome, eventId]);
  const prior = (await client.query('SELECT result_json FROM director_receipts WHERE execution_id=$1', [identity])).rows[0];
  if (prior) return JSON.parse(prior.result_json);
  const updated = { ...row, state, terminal, outcome, world_event_id: eventId,
    revision: Number(row.revision) + 1, updated_at: new Date(at) };
  await client.query(`UPDATE director_situations SET state=$2,terminal=$3,outcome=$4,world_event_id=$5,
    revision=$6,updated_at=$7 WHERE id=$1`, [row.id, state, terminal, outcome, eventId, updated.revision, updated.updated_at]);
  registerItemTransactionUndo(client, () => client.query(`UPDATE director_situations SET state=$2,terminal=$3,outcome=$4,world_event_id=$5,
    revision=$6,updated_at=$7 WHERE id=$1`, [row.id, row.state, row.terminal, row.outcome, row.world_event_id, row.revision, row.updated_at]));
  await directorReceipt(client, identity, kind, row.id, { state, outcome, revision: updated.revision, worldEventId: eventId }, at);
  return updated;
}

export async function changeCampaign(client, row, nodeId, status, at) {
  const identity = directorHash(['campaign', row.id, Number(row.revision), nodeId, status]);
  const next = { ...row, node_id: nodeId, status, revision: Number(row.revision) + 1, updated_at: new Date(at) };
  await client.query('UPDATE director_campaigns SET node_id=$2,status=$3,revision=$4,updated_at=$5 WHERE id=$1',
    [row.id, nodeId, status, next.revision, next.updated_at]);
  registerItemTransactionUndo(client, () => client.query('UPDATE director_campaigns SET node_id=$2,status=$3,revision=$4,updated_at=$5 WHERE id=$1',
    [row.id, row.node_id, row.status, row.revision, row.updated_at]));
  await directorReceipt(client, identity, 'campaign_transition', row.id, { nodeId, status, revision: next.revision }, at);
  return next;
}

export async function startSituation(client, candidate, at, tickId) {
  const { definition: d, facts, campaignDefinition: campaign } = candidate;
  const campaignId = candidate.campaignId || directorHash(['campaign', tickId, campaign.id, facts.objectId]);
  if (!candidate.campaignId) {
    await client.query(`INSERT INTO director_campaigns(id,definition_id,definition_version,definition_hash,object_id,
      node_id,status,revision,created_at,updated_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,'active',1,$7,$7,$8)`,
    [campaignId, campaign.id, campaign.version, campaign.contentHash, facts.objectId, candidate.nodeId,
      new Date(at), new Date(at + campaign.maxDurationSeconds * 1000)]);
    registerItemTransactionUndo(client, () => client.query('DELETE FROM director_campaigns WHERE id=$1', [campaignId]));
    await directorReceipt(client, directorHash(['campaign_create', campaignId]), 'campaign_create', campaignId,
      { campaignId, ...(candidate.recoveryOf ? { recoveryOf: candidate.recoveryOf } : {}) }, at);
  }
  const situationId = directorHash(['situation', campaignId, candidate.nodeId, d.contentHash]);
  await client.query(`INSERT INTO director_situations(id,definition_id,definition_version,definition_hash,campaign_id,node_id,
    object_id,starting_world_revision,controller_family_id,season,state,revision,terminal,created_at,updated_at,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1,false,$12,$12,$13)`,
  [situationId, d.id, d.version, d.contentHash, campaignId, candidate.nodeId, facts.objectId,
    facts.worldRevision, facts.controllerFamilyId, facts.season, d.initialState, new Date(at),
    new Date(at + d.expiryPolicy.afterSeconds * 1000)]);
  registerItemTransactionUndo(client, () => client.query('DELETE FROM director_situations WHERE id=$1', [situationId]));
  await directorReceipt(client, directorHash(['situation_create', situationId]), 'situation_create', situationId,
    { situationId, campaignId, state: d.initialState }, at);
  return { situationId, campaignId, definitionId: d.id };
}
