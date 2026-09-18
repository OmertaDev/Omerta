// One server-owned read snapshot composes existing authorities into stable player views.
// These cards describe what can be attempted; commands always re-check locked authority.
import { GameError } from './game.js';
import { withItemRead } from './items.js';
import { planCraftingSnapshot } from './crafting.js';
import { knowledgeRequirementKey } from './world-knowledge.js';
import { createMysteryContext, planMysterySnapshot } from './mysteries.js';
import { isWorldGraphRegistry } from './worldgraph.js';

const unavailable = () => { throw new GameError('projection_unavailable', 'That view is unavailable.'); };
const identifier = (value) => typeof value === 'string' && /^[\x21-\x7e]{1,160}$/.test(value);
const emptyOperations = () => ({ catalog: [], instances: [], selected: null, truncated: false });

export function createWorldProjection({ pool, query, kernel, knowledge, familyOperations = null, crafting, recipeIds = [], mysteries = null, director = null }) {
  if (!pool || !query || !kernel || !knowledge || !crafting) unavailable();
  const caseDefinitions = [];
  if (mysteries) {
    if (!isWorldGraphRegistry(mysteries.registry) || !Array.isArray(mysteries.graphIds)
      || mysteries.graphIds.length > 16 || new Set(mysteries.graphIds).size !== mysteries.graphIds.length) unavailable();
    for (const graphId of mysteries.graphIds) {
      if (!identifier(graphId)) unavailable();
      const pkg = mysteries.registry.byPackage.get(graphId);
      const nodes = [...mysteries.registry.nodes.values()].filter((node) => node.packageId === graphId
        && ['mystery_step', 'world_gate', 'choice'].includes(node.type));
      if (!pkg || !nodes.length) unavailable();
      caseDefinitions.push(Object.freeze({ graphId, version: Number(pkg.version),
        title: nodes.find((node) => node.visibility === 'public')?.metadata?.title
          || graphId.split(/[._:-]+/).filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join(' ') }));
    }
  }
  return Object.freeze({ async snapshot(accountId, options = {}) {
    if (!identifier(accountId) || !options || ![Object.prototype, null].includes(Object.getPrototypeOf(options))
      || Object.keys(options).some((key) => !['operationId', 'mysteryGraphId'].includes(key))
      || (options.operationId !== undefined && !identifier(options.operationId))
      || (options.mysteryGraphId !== undefined && (!identifier(options.mysteryGraphId)
        || !caseDefinitions.some((entry) => entry.graphId === options.mysteryGraphId)))) unavailable();
    return withItemRead(pool, async (client) => {
      const asOf = Date.now();
      const characters = (await client.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2', [accountId])).rows;
      if (characters.length > 1) unavailable();
      const characterId = characters[0]?.id ?? null;
      const catalog = [];
      let mysteryPlan = { groups: [], render: async () => null };
      if (mysteries) {
        for (const entry of caseDefinitions) {
          const instance = characterId ? (await client.query(`SELECT id,status FROM mystery_instances
            WHERE authority_account_id=$1 AND owner_scope='character' AND owner_id=$2 AND graph_id=$3 AND graph_version=$4 LIMIT 1`,
          [accountId, characterId, entry.graphId, entry.version])).rows[0] : null;
          catalog.push({ graphId: entry.graphId, title: entry.title, status: instance?.status || 'available',
            started: !!instance, canStart: !!characterId && !instance });
          if (instance && options.mysteryGraphId === entry.graphId) {
            const context = createMysteryContext({ registry: mysteries.registry, accountId, now: asOf,
              knowledgeEnabled: mysteries.knowledgeEnabled === true, sharingEnabled: mysteries.sharingEnabled === true,
              accountIds: mysteries.accountIds || [], worldDefinitions: mysteries.worldDefinitions || [],
              prerequisitesEnabled: true, operationOutcomesEnabled: true });
            mysteryPlan = await planMysterySnapshot(client, context, { scope: 'character', id: characterId }, entry.graphId);
          }
        }
      }
      const operationPlan = familyOperations ? await familyOperations.planSnapshot(client, accountId, { operationId: options.operationId ?? null, asOf })
        : { groups: [], render: async () => emptyOperations() };
      const situationPlan = director ? await director.planSnapshot(client, accountId, { expectedCharacterId: characterId, asOf })
        : { groups: [], render: async () => [] };
      const recipePlan = await planCraftingSnapshot(client, accountId, crafting, recipeIds, { asOf });
      const groups = new Map();
      for (const group of [...operationPlan.groups, ...recipePlan.groups, ...mysteryPlan.groups, ...situationPlan.groups,
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
      const selectedCase = await mysteryPlan.render(knowledgeSnapshot);
      const situations = await situationPlan.render(knowledgeSnapshot, { operations });
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
        ...(director ? { situations } : {}),
        activity: graph.nodes.filter((n) => n.type === 'event').map(eventCard),
        worldObjects: world.objects, recipes,
        ...(mysteries ? { cases: { catalog, selected: selectedCase } } : {}),
        objectives: graph.nodes.filter((n) => n.type === 'objective').map((n) => ({ id: n.id, kind: n.kind, target: n.target, progress: n.progress, done: n.done })),
        mysteries: graph.nodes.filter((n) => n.type === 'mystery').map((n) => ({ id: n.id, status: n.status })),
        operationReferences: graph.nodes.filter((n) => n.type === 'operation').map((n) => ({ id: n.id, status: n.status })),
        truncated: { ...graph.truncated, worldObjects: world.truncated, operationInstances: operations.truncated } };
    });
  } });
}
