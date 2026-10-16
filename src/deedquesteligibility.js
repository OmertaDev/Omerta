// Economic eligibility is an explicit server policy, separate from authored cosmetic rewards.
// A content edit or retirement must receive a fresh review before it can qualify a primary deed.
import crypto from 'node:crypto';
import { GameError } from './game.js';
import { PHASE1_WORLD_GRAPH_PACKAGES } from './content/phase1.js';

export const QUEST_DEED_SOURCE = Object.freeze({
  graphId: 'property-investigation',
  version: 1,
  nodeId: 'mystery:property-verify-title',
  contentHash: 'eaffd022fc54d4be114ac0652c38786bc297c1a74e31aebd90631e884661769e',
  definitionHash: 'b9e206f3a393224e494b539838d7906cac67fc5efb472f3c1413462278ebf5c2',
});

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

// Pure inspection for release checks. The eligibility lookup always uses the production manifest.
export function isApprovedDeedQuestSource(packages) {
  if (!Array.isArray(packages)) return false;
  const matches = packages.filter((pkg) => pkg?.id === QUEST_DEED_SOURCE.graphId);
  if (matches.length !== 1) return false;
  const pkg = matches[0];
  if (pkg.version !== QUEST_DEED_SOURCE.version || !Array.isArray(pkg.nodes)) return false;
  const terminal = pkg.nodes.find((node) => node.id === QUEST_DEED_SOURCE.nodeId);
  if (terminal?.type !== 'mystery_step' || terminal.metadata?.terminal !== true) return false;
  return crypto.createHash('sha256').update(JSON.stringify(canonical(pkg))).digest('hex')
    === QUEST_DEED_SOURCE.contentHash;
}

// Board reads stay pure. A primary claim must hold the living character lock (or request it here)
// to serialize eligibility with death; its caller owns the account lifetime and building reservations.
// Neither an arbitrary reward node nor a client-supplied quest identifier grants this authority.
export async function verifiedQuestDeedEligibility(client, { accountId, characterId, lock = false } = {}) {
  const actor = (await client.query(
    `SELECT id FROM characters WHERE id=$1 AND account_id=$2 AND alive${lock ? ' FOR UPDATE' : ''}`,
    [characterId, accountId],
  )).rows[0];
  if (!actor) throw new GameError('no_character', 'A living character owned by this account is required.');
  if (!isApprovedDeedQuestSource(PHASE1_WORLD_GRAPH_PACKAGES)) return null;
  const source = QUEST_DEED_SOURCE;
  const row = (await client.query(
    `SELECT i.id FROM mystery_instances i
       JOIN mystery_node_state n ON n.instance_id=i.id AND n.node_id=$5
      WHERE i.authority_account_id=$1 AND i.owner_scope='character' AND i.owner_id=$2
        AND i.graph_id=$3 AND i.graph_version=$4 AND i.status='completed'
        AND i.definition_hash=$6
        AND i.completed_at IS NOT NULL AND n.state='completed' AND n.completed_at IS NOT NULL`,
    [accountId, characterId, source.graphId, source.version, source.nodeId, source.definitionHash],
  )).rows[0];
  return row ? Object.freeze({ graphId: source.graphId, version: source.version,
    nodeId: source.nodeId, instanceId: row.id }) : null;
}
