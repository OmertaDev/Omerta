// One server-owned read snapshot composes existing authorities into stable player views.
// These cards describe what can be attempted; commands always re-check locked authority.
import { GameError } from './game.js';
import { withItemRead } from './items.js';
import { planCraftingSnapshot } from './crafting.js';
import { knowledgeRequirementKey } from './world-knowledge.js';

const unavailable = () => { throw new GameError('projection_unavailable', 'That view is unavailable.'); };
const identifier = (value) => typeof value === 'string' && /^[\x21-\x7e]{1,160}$/.test(value);
const emptyOperations = () => ({ catalog: [], instances: [], selected: null, truncated: false });

export function createWorldProjection({ pool, query, kernel, knowledge, familyOperations = null, crafting, recipeIds = [] }) {
  if (!pool || !query || !kernel || !knowledge || !crafting) unavailable();
  return Object.freeze({ async snapshot(accountId, options = {}) {
    if (!identifier(accountId) || !options || ![Object.prototype, null].includes(Object.getPrototypeOf(options))
      || Object.keys(options).some((key) => key !== 'operationId')
      || (options.operationId !== undefined && !identifier(options.operationId))) unavailable();
    return withItemRead(pool, async (client) => {
      const asOf = Date.now();
      const characters = (await client.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2', [accountId])).rows;
      if (characters.length > 1) unavailable();
      const characterId = characters[0]?.id ?? null;
      const operationPlan = familyOperations ? await familyOperations.planSnapshot(client, accountId, { operationId: options.operationId ?? null, asOf })
        : { groups: [], render: async () => emptyOperations() };
      const recipePlan = await planCraftingSnapshot(client, accountId, crafting, recipeIds, { asOf });
      const groups = new Map();
      for (const group of [...operationPlan.groups, ...recipePlan.groups,
        ...(characterId ? [{ accountId, characterId, requirements: kernel.definitions.flatMap((d) => d.knowledge) }] : [])]) {
        const key = JSON.stringify([group.accountId, group.characterId]);
        const merged = groups.get(key) || { accountId: group.accountId, characterId: group.characterId, requirements: new Map() };
        for (const requirement of group.requirements) merged.requirements.set(knowledgeRequirementKey(requirement), requirement);
        groups.set(key, merged);
      }
      const knowledgeSnapshot = await knowledge.readSnapshot(client, { viewer: { accountId, characterId },
        groups: [...groups.values()].map((g) => ({ ...g, requirements: [...g.requirements.values()] })), limit: 50 });
      const graph = await query.readSnapshot(client, accountId, { knowledgeSnapshot, asOf });
      const world = await kernel.readSnapshot(client, accountId, { knowledgeSnapshot, asOf });
      const operations = await operationPlan.render(knowledgeSnapshot);
      const recipes = await recipePlan.render(knowledgeSnapshot);
      const byRef = new Map(graph.nodes.map((node) => [node.ref, node]));
      const linked = (from, type) => graph.relationships.filter((edge) => edge.from === from && edge.type === type).map((edge) => ({ edge, node: byRef.get(edge.to) })).filter((entry) => entry.node);
      const street = linked(graph.root, 'current_character')[0]?.node ?? null;
      const crewNode = linked(graph.root, 'membership').find(({ node }) => node.type === 'crew')?.node;
      const familyNode = street && linked(street.ref, 'membership').find(({ node }) => node.type === 'family')?.node;
      const location = street && linked(street.ref, 'location')[0]?.node;
      let crew = null, family = null;
      if (crewNode) {
        const objective = linked(crewNode.ref, 'parent_child').find(({ node }) => node.type === 'objective')?.node;
        const members = (await client.query(`SELECT c.id,c.name FROM crew_members cm
          JOIN characters c ON c.account_id=cm.account_id AND c.alive=true
          WHERE cm.crew_id=$1 ORDER BY c.id LIMIT 5`, [crewNode.id])).rows;
        crew = { id: crewNode.id, name: crewNode.name, members: members.slice(0, 4), membersTruncated: members.length > 4,
          objective: objective ? { id: objective.id, week: objective.week, kind: objective.kind, target: objective.target,
            progress: objective.progress, done: objective.done, mine: objective.mine, claimed: objective.claimed } : null };
      }
      if (familyNode) {
        const member = (await client.query('SELECT role FROM gang_members WHERE character_id=$1', [street.id])).rows[0];
        family = { id: familyNode.id, name: familyNode.name, role: member?.role ?? null,
          relations: ['alliance', 'rivalry'].flatMap((kind) => linked(familyNode.ref, kind).map(({ node, edge }) => ({ kind, id: node.id, name: node.name, until: edge.until ?? null }))) };
      }
      const eventCard = (node) => ({ id: node.id, kind: node.kind, provenance: node.provenance, occurredAt: node.occurredAt });
      const items = graph.nodes.filter((node) => node.type === 'item').map((node) => ({ id: node.id,
        templateId: linked(node.ref, 'instance_of')[0]?.node.id ?? null, state: node.state, createdAt: node.createdAt,
        consumedAt: node.consumedAt, provenance: linked(node.ref, 'provenance').map(({ node: event }) => eventCard(event)) }));
      const resources = graph.nodes.filter((node) => node.type === 'resource').map((node) => ({
        templateId: linked(node.ref, 'instance_of')[0]?.node.id ?? null, quality: node.quality, quantity: node.quantity }));
      const claims = knowledgeSnapshot.board.claims.map((claim) => ({ id: claim.id, domain: claim.domain,
        proposition: claim.proposition, value: claim.value, contentHash: claim.contentHash, discoveredAt: claim.discoveredAt,
        owned: claim.owned, ...(claim.owned ? { aclRevision: claim.aclRevision, grants: claim.grants } : {}) }));
      return { schemaVersion: 1, asOf,
        player: { id: accountId, character: street ? { id: street.id, name: street.name, locationId: location?.id ?? null } : null },
        crew, family, territories: graph.nodes.filter((n) => n.type === 'territory').map((n) => ({ id: n.id,
          controlledByFamilyId: graph.relationships.some((e) => e.type === 'control' && e.to === n.ref && e.from === familyNode?.ref) ? familyNode.id : null })),
        inventory: { items, resources, truncated: { items: graph.truncated.items, resources: graph.truncated.resources, provenance: graph.truncated.events } },
        knowledge: { claims, truncated: knowledgeSnapshot.board.nextCursor !== null }, operations,
        activity: graph.nodes.filter((n) => n.type === 'event').map(eventCard),
        worldObjects: world.objects, recipes,
        objectives: graph.nodes.filter((n) => n.type === 'objective').map((n) => ({ id: n.id, kind: n.kind, target: n.target, progress: n.progress, done: n.done })),
        mysteries: graph.nodes.filter((n) => n.type === 'mystery').map((n) => ({ id: n.id, status: n.status })),
        operationReferences: graph.nodes.filter((n) => n.type === 'operation').map((n) => ({ id: n.id, status: n.status })),
        truncated: { ...graph.truncated, worldObjects: world.truncated, operationInstances: operations.truncated } };
    });
  } });
}
