// An authorization-aware window over canonical events, never a second event store.
import { GameError } from './game.js';
import { assertItemRead } from './items.js';
import { assertKnowledgeSnapshot, snapshotRequirementMatches } from './coordination/knowledge.js';

export const WORLD_CONSEQUENCE_LIMITS = Object.freeze({ cards: 24, queries: 64, rowsPerQuery: 25, policyDelaySeconds: 604800 });
const fail = () => { throw new GameError('bad_consequence_policy', 'Invalid world history policy.'); };
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const words = (value) => String(value).replace(/[_:.-]+/g, ' ');
// Player-facing explanations of already-authorized states. These add no actors,
// event identifiers, private causes, permissions, or promised follow-up actions.
const CANAL_STATE_DESCRIPTIONS = Object.freeze({
  idle: 'The canal depot has no registered shipment.',
  stranded: 'A registered shipment is stranded at the canal depot.',
  recovered: 'The missing shipment was recovered at the canal depot.',
  diverted: 'The missing shipment was intercepted and diverted from its registered route.',
  destroyed: 'The stranded canal depot was destroyed.',
  redistributed: 'The shipment was redistributed to reopen the community supply route.',
  market_open: 'An alternate market has opened at the canal depot.',
  market_supplied: 'The canal market received supplies. The contributed wire stays committed to the depot.',
  market_seized: 'The canal market route was seized.',
  restored: 'The registered supply route was restored.',
  exposed: 'The canal market route was exposed publicly. This disclosure does not establish who betrayed an operation.',
  public_trace: 'Independent records corroborate how the route became public. They do not establish betrayal or a guilty player.',
  secured: 'The shipping records are secured. This outcome does not establish that anyone betrayed the operation.',
  unproven: 'The shipping concern remains unresolved. The record does not establish betrayal or anyone\'s guilt.',
});
const describeState = (definition, state) => definition.id === 'infrastructure:canal_supply_depot'
  && CANAL_STATE_DESCRIPTIONS[state] || `${definition.title}: ${words(state)}.`;

export function createWorldConsequences({ definitions, policies = [] }) {
  if (!Array.isArray(definitions) || definitions.length > 100 || !Array.isArray(policies) || policies.length > 100) fail();
  const byId = new Map(definitions.map((entry) => [entry.id, entry])), delays = new Map();
  for (const policy of policies) {
    if (!policy || ![Object.prototype, null].includes(Object.getPrototypeOf(policy))
      || Reflect.ownKeys(policy).length !== 2 || !Object.hasOwn(policy, 'objectId') || !Object.hasOwn(policy, 'publicDelaySeconds')
      || Reflect.ownKeys(policy).some((key) => !Object.getOwnPropertyDescriptor(policy, key)?.enumerable
        || !Object.hasOwn(Object.getOwnPropertyDescriptor(policy, key), 'value'))
      || !byId.has(policy.objectId) || delays.has(policy.objectId)
      || !Number.isSafeInteger(policy.publicDelaySeconds) || policy.publicDelaySeconds < 0
      || policy.publicDelaySeconds > WORLD_CONSEQUENCE_LIMITS.policyDelaySeconds) fail();
    delays.set(policy.objectId, policy.publicDelaySeconds);
  }
  return Object.freeze({ async readSnapshot(client, { accountId, characterId, locationId, worldObjects,
    knowledge, knowledgeSnapshot, asOf }) {
    assertItemRead(client); assertKnowledgeSnapshot(client, knowledgeSnapshot, accountId);
    if (!Number.isSafeInteger(asOf) || asOf < 0 || !Array.isArray(worldObjects) || worldObjects.length > 50) fail();
    if (!characterId) return { entries: [], truncated: false };
    const windows = [];
    // Only the kernel's already authorized objects enter history. Public current
    // state is not permission to read earlier private states, actions or actors.
    for (const object of worldObjects) {
      const definition = byId.get(object.id);
      if (!definition) fail();
      const informed = definition.knowledge.length > 0 && knowledge.enabledFor(accountId)
        && definition.knowledge.every((requirement) => snapshotRequirementMatches(client, knowledgeSnapshot,
          { accountId, characterId, requirement, sharingEnabled: knowledge.sharingEnabledFor(accountId) }));
      for (const state of informed ? definition.states : definition.publicStates) windows.push({ definition, object, state, informed });
    }
    windows.sort((a, b) => Number(b.definition.locationId === locationId) - Number(a.definition.locationId === locationId)
      || compare(a.definition.id, b.definition.id) || compare(a.state, b.state));
    const entries = [], seen = new Set();
    let truncated = windows.length > WORLD_CONSEQUENCE_LIMITS.queries;
    for (const { definition, object, state, informed } of windows.slice(0, WORLD_CONSEQUENCE_LIMITS.queries)) {
      const delay = informed ? 0 : (delays.get(definition.id) || 0);
      // The visibility index bounds each authorized state window independently.
      // Private or delayed events cannot crowd out public records or change counts.
      const rows = (await client.query(`SELECT id,revision,next_state,actor_character_id,occurred_at FROM world_kernel_events
        WHERE object_id=$1 AND next_state=$2 AND definition_hash=$3 AND occurred_at<=$4
        ORDER BY occurred_at DESC,revision DESC LIMIT 25`,
      [definition.id, state, definition.contentHash, new Date(asOf - delay * 1000)])).rows;
      for (const row of rows) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        const publicState = definition.publicStates.includes(row.next_state);
        const isPublic = publicState && new Date(row.occurred_at).getTime() + (delays.get(definition.id) || 0) * 1000 <= asOf;
        const local = isPublic && locationId === definition.locationId;
        const own = row.actor_character_id === characterId;
        entries.push({ id: row.id, kind: 'world_change', title: definition.title,
          description: describeState(definition, row.next_state), occurredAt: new Date(row.occurred_at).toISOString(),
          informationLayer: isPublic ? local ? 'LOCAL_RUMOR' : 'PUBLIC_AFTERMATH' : 'DISCOVERED_INTELLIGENCE',
          whyKnown: own ? 'This change is recorded in your own actions.'
            : isPublic ? local ? 'Word of this change has reached your district.' : 'The visible aftermath is now public.'
              : 'Your evidence lets you understand this change.',
          cause: own ? 'You helped bring about this change.' : null,
          // Describe the known state, not an undisclosed intervening revision.
          remainsActive: object.state === row.next_state,
          subject: { type: 'world_object', id: object.id },
        });
      }
    }
    entries.sort((a, b) => compare(b.occurredAt, a.occurredAt) || compare(a.id, b.id));
    truncated ||= entries.length > WORLD_CONSEQUENCE_LIMITS.cards;
    return { entries: entries.slice(0, WORLD_CONSEQUENCE_LIMITS.cards), truncated };
  } });
}
