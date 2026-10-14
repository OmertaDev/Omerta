// Test/tool-only exact Crew projection inverse. Never use the reconstructed bytes as runtime authority.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const normalize = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

export const CREW_PROJECTION_SOURCE_TRANSFER = freeze({
  "sourceRevision": "299465106a662f90c4304b9535e2b2959d41bb2b",
  "predecessorRevision": "f254c64a54a019665d7a516d382d56b46f2dcd82",
  "currentPins": {
    "src/operations.js": "ad90d8c92c7d9e0b74374e86df3b00aa57cad829c9d416b42e69050a43049e43",
    "src/routes/worldgraph.js": "6e2fbd85539e315a8e8fa1ce544a86dfd4ae795ca9eebc3239424165f3d11613"
  },
  "baselinePins": {
    "src/operations.js": "175882731792bfd24f2cb7ff0ecd62dc3bb7273b817a77b8bcd5cb7817fdf679",
    "src/routes/worldgraph.js": "bfec86de2c0fac2132308115c366b30e0eda057fbe6570d46ac0afa01bfb938a"
  },
  "currentBlobs": {
    "src/operations.js": "49a6af1a5287101d6f1a5f0035b957703d8a07de",
    "src/routes/worldgraph.js": "e2ead6e3f6f907a692ff9a83629fa6f7beb6f5de"
  },
  "baselineBlobs": {
    "src/operations.js": "27df779d739f7d550558e50c8a412782a9e9290a",
    "src/routes/worldgraph.js": "f26c55435e4157ebbbda728b4c43b71390e3a9d0"
  },
  "inverses": {
    "src/operations.js": [
      {
        "current": "// or transaction-ledger adapter.\nimport crypto from 'node:crypto';\nimport { dbCaps } from './db.js';\nimport { readPlayerIntel } from './playerintel.js';\nimport { GameError } from './game.js';\nimport {\n  awaitItemReadBarrier,\n",
        "baseline": "// or transaction-ledger adapter.\nimport crypto from 'node:crypto';\nimport { dbCaps } from './db.js';\nimport { GameError } from './game.js';\nimport {\n  awaitItemReadBarrier,\n"
      },
      {
        "current": "    id: node.id,\n    type: node.type,\n    title: node.metadata?.title || node.id,\n    ...(node.metadata?.description ? { description: node.metadata.description } : {}),\n    status: state?.state || 'pending',\n    completedAt: dateString(state?.completed_at),\n  };\n",
        "baseline": "    id: node.id,\n    type: node.type,\n    title: node.metadata?.title || node.id,\n    status: state?.state || 'pending',\n    completedAt: dateString(state?.completed_at),\n  };\n"
      },
      {
        "current": "  return { actions, roles, nodes };\n}\n\n/** Shared role slots and public progress; names come only from this viewer's earned notebook. No account/character/Crew IDs. */\nexport async function operationBoard(client, contextValue, operationIdValue) {\n  const context = contextOf(contextValue);\n  await awaitItemReadBarrier(client);\n",
        "baseline": "  return { actions, roles, nodes };\n}\n\n/** Safe shared projection: role slots and public progress, never account/character/Crew identities. */\nexport async function operationBoard(client, contextValue, operationIdValue) {\n  const context = contextOf(contextValue);\n  await awaitItemReadBarrier(client);\n"
      },
      {
        "current": "  )).rows;\n  const countByRole = new Map(contributions.map((entry) => [entry.role_id, Number(entry.n)]));\n  const states = stateMap(await stateRows(client, row.id));\n  const occupants = new Map();\n  for (const assignment of roles) {\n    // Taking a role does not grant a new sighting of the person who filled it.\n    const self = assignment.account_id === context.accountId;\n    const known = self ? null : await readPlayerIntel(client, context.accountId, assignment.character_id);\n    occupants.set(assignment.role_id, { self, name: known?.name || null,\n      observedAt: known ? dateString(known.observedAt) : null });\n  }\n  const nextRoles = new Set([...context.registry.nodes.values()].filter(node =>\n    row.status === 'active' && node.packageId === row.graph_id && node.type === 'operation_step'\n    && node.metadata?.operationId === root.id && !['completed', 'excluded'].includes(states.get(node.id)?.state)\n    && (node.requires || []).every(id => states.get(id)?.state === 'completed')\n    && (node.requiresAny || []).every(group => group.some(id => states.get(id)?.state === 'completed'))\n    && !(node.excludes || []).some(id => states.get(id)?.state === 'completed')\n    && (node.metadata?.order === undefined || ![...context.registry.nodes.values()].some(prior =>\n      prior.packageId === row.graph_id && prior.type === 'operation_step' && prior.metadata?.operationId === root.id\n      && Number.isInteger(prior.metadata?.order) && prior.metadata.order < node.metadata.order\n      && states.get(prior.id)?.state !== 'completed'))).map(node => node.metadata.roleId));\n  const nodes = [...context.registry.nodes.values()].filter((node) => (\n    node.packageId === row.graph_id && GRAPH_STATE_TYPES.has(node.type)\n    && (node.id === root.id || node.metadata?.operationId === root.id)\n",
        "baseline": "  )).rows;\n  const countByRole = new Map(contributions.map((entry) => [entry.role_id, Number(entry.n)]));\n  const states = stateMap(await stateRows(client, row.id));\n  const nodes = [...context.registry.nodes.values()].filter((node) => (\n    node.packageId === row.graph_id && GRAPH_STATE_TYPES.has(node.type)\n    && (node.id === root.id || node.metadata?.operationId === root.id)\n"
      },
      {
        "current": "      title: role.title || role.id,\n      filled: roles.some((assignment) => assignment.role_id === role.id),\n      contributions: countByRole.get(role.id) || 0,\n      occupant: occupants.get(role.id) || null,\n      turn: nextRoles.has(role.id),\n    })),\n    filledRoleCount: roles.length,\n    requiredRoleCount: rolesOf(root).length,\n",
        "baseline": "      title: role.title || role.id,\n      filled: roles.some((assignment) => assignment.role_id === role.id),\n      contributions: countByRole.get(role.id) || 0,\n    })),\n    filledRoleCount: roles.length,\n    requiredRoleCount: rolesOf(root).length,\n"
      }
    ],
    "src/routes/worldgraph.js": [
      {
        "current": "        actions: [issuedAction('cancel:' + row.id, 'Close this operation and recover held items',\n          '/v1/worldgraph/operations/' + segment(row.id) + '/cancel', {}, [],\n          'Only its original opener can cancel. Held items return to their recorded depositors, even after crew or character changes.')] }));\n      const completedOperations = [];\n      const history = (await client.query(`SELECT operation.id,operation.operation_node_id,operation.completed_at,role.role_id\n        FROM world_operations operation JOIN world_operation_roles role ON role.operation_id=operation.id\n        WHERE role.account_id=$1 AND operation.status='completed'\n        ORDER BY operation.completed_at DESC,operation.id LIMIT 20`, [req.user.sub])).rows;\n      for (const record of history) {\n        const root = PHASE1_WORLD_GRAPH.nodes.get(record.operation_node_id);\n        const completed = (await client.query(\"SELECT node_id FROM world_operation_node_state WHERE operation_id=$1 AND state='completed'\", [record.id])).rows;\n        const milestones = completed.map(row => PHASE1_WORLD_GRAPH.nodes.get(row.node_id))\n          .filter(node => node?.type === 'operation_step' && node.visibility === 'public')\n          .slice(0, 16).map(node => node.metadata?.title || node.id);\n        completedOperations.push({ operationId: record.id, title: root?.metadata?.title || 'Completed Crew run',\n          roleTitle: root?.metadata?.roles?.find(role => role.id === record.role_id)?.title || record.role_id,\n          completedAt: new Date(record.completed_at).toISOString(), milestones });\n      }\n      return { operations, recoverableOperations, completedOperations };\n    }));\n\n  app.post('/v1/worldgraph/operations/:graphId/:operationNodeId/open', mutationOptions(auth),\n",
        "baseline": "        actions: [issuedAction('cancel:' + row.id, 'Close this operation and recover held items',\n          '/v1/worldgraph/operations/' + segment(row.id) + '/cancel', {}, [],\n          'Only its original opener can cancel. Held items return to their recorded depositors, even after crew or character changes.')] }));\n      return { operations, recoverableOperations };\n    }));\n\n  app.post('/v1/worldgraph/operations/:graphId/:operationNodeId/open', mutationOptions(auth),\n"
      }
    ]
  },
  "phase": "exact source transfer only",
  "scope": "Only two complete exact Crew read-projection files reconstruct the complete reviewed f254 predecessor before unchanged City/recovery source checks. ALL new Crew content, earned-name privacy, current gameplay authority, reachability, recovery behavior, native, worker, migration, activation and deployment qualification remain outside this historical source-only transfer. No new module or worker has an alias."
});

export function assertCrewProjectionSourceTransfer(file, input) {
  const transfer = CREW_PROJECTION_SOURCE_TRANSFER;
  assert(Object.hasOwn(transfer.currentPins, file), 'Unknown Crew projection source: ' + file);
  assert.equal(typeof input, 'string', 'Crew projection source changed: non-text input');
  const text = normalize(input), actualSha256 = hash(text);
  const current = actualSha256 === transfer.currentPins[file];
  assert(current || actualSha256 === transfer.baselinePins[file], 'Crew projection source changed: ' + file);
  assert.equal(blob(text), current ? transfer.currentBlobs[file] : transfer.baselineBlobs[file], 'Crew projection complete blob changed: ' + file);
  let baselineText = text;
  if (current) for (const chunk of transfer.inverses[file]) {
    assert.equal(baselineText.split(chunk.current).length, 2, 'Crew projection inverse is not exact and unique: ' + file);
    baselineText = baselineText.replace(chunk.current, () => chunk.baseline);
  }
  assert.equal(hash(baselineText), transfer.baselinePins[file], 'Crew projection complete predecessor changed: ' + file);
  assert.equal(blob(baselineText), transfer.baselineBlobs[file], 'Crew projection predecessor blob changed: ' + file);
  return Object.freeze({ ...transfer, file, actualSha256, baselineText, baselineSha256: transfer.baselinePins[file],
    inverseChunks: current ? transfer.inverses[file].length : 0 });
}

export function crewProjectionSourceBaseline(file, input) {
  if (!Object.hasOwn(CREW_PROJECTION_SOURCE_TRANSFER.currentPins, file) || typeof input !== 'string') return input;
  const actual = hash(normalize(input));
  if (actual !== CREW_PROJECTION_SOURCE_TRANSFER.currentPins[file] && actual !== CREW_PROJECTION_SOURCE_TRANSFER.baselinePins[file]) return input;
  return assertCrewProjectionSourceTransfer(file, input).baselineText;
}
