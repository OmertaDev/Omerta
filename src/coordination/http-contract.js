// Closed Phase 1 knowledge projections and inputs, shared by Fastify and OpenAPI.
// Principal identity, private provenance and ACL authority never come from these DTOs.
const id = { type: 'string', minLength: 1, maxLength: 200, pattern: '^[!-~]+$' };
const token = { type: 'string', minLength: 1, maxLength: 2048, pattern: '^[A-Za-z0-9_-]+$' };
const revision = { type: 'integer', minimum: 0, maximum: 2_147_483_647 };
const date = { type: 'string', format: 'date-time' };
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, required, properties });
const list = (name, maxItems = 50) => ({ type: 'array', maxItems, items: ref(name) });
const cursor = { anyOf: [token, { type: 'null' }] };

export const KNOWLEDGE_INPUTS = {
  share: object({ targetId: token, expectedAclRevision: revision }),
  revoke: object({ grantId: id, expectedAclRevision: revision }),
  link: object({ fromClaimId: id, toClaimId: id, relation: { type: 'string', enum: ['corroborates', 'contradicts'] } }),
  archive: object({ claimId: id }),
  rebuild: object({}),
};
export const KNOWLEDGE_QUERIES = {
  page: object({ cursor: token, limit: { type: 'string', pattern: '^(?:[1-9]|[1-4][0-9]|50)$' } }, []),
  targets: object({ characterName: { type: 'string', minLength: 2, maxLength: 24 } }, []),
};
export const KNOWLEDGE_SCHEMAS = {
  CoordinationKnowledgeValue: { anyOf: [
    object({ type: { type: 'string', const: 'boolean' }, value: { type: 'boolean' } }),
    object({ type: { type: 'string', const: 'integer' }, value: { type: 'integer', minimum: -Number.MAX_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER } }),
    object({ type: { type: 'string', const: 'text' }, value: { type: 'string', maxLength: 200 } }),
  ] },
  CoordinationKnowledgeGrant: object({ id, kind: { type: 'string', enum: ['crew', 'family', 'account'] }, label: { type: 'string', maxLength: 200 } }),
  CoordinationKnowledgeClaim: object({ id, domain: id, proposition: id,
    value: ref('CoordinationKnowledgeValue'), contentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    discoveredAt: date, owned: { type: 'boolean' },
    source: object({ kind: { type: 'string', const: 'coordination_discovery' }, root: id }),
    aclRevision: revision, grants: list('CoordinationKnowledgeGrant', 64),
  }, ['id', 'domain', 'proposition', 'value', 'contentHash', 'discoveredAt', 'owned', 'source']),
  CoordinationKnowledgeLink: object({ id, fromClaimId: id, toClaimId: id,
    relation: { type: 'string', enum: ['corroborates', 'contradicts'] },
    assertion: { type: 'string', const: 'player' }, createdAt: date }),
  CoordinationKnowledgeBoard: object({ claims: list('CoordinationKnowledgeClaim'), nextCursor: cursor }),
  CoordinationKnowledgeDetail: object({ claim: ref('CoordinationKnowledgeClaim'), links: list('CoordinationKnowledgeLink', 128) }),
  CoordinationKnowledgeTarget: object({ id: token, kind: { type: 'string', enum: ['crew', 'family', 'account'] }, label: { type: 'string', maxLength: 200 } }),
  CoordinationKnowledgeTargets: object({ targets: list('CoordinationKnowledgeTarget', 3), expiresAt: date }),
  CoordinationKnowledgeArchiveEntry: object({ id, claim: ref('CoordinationKnowledgeClaim'), addedAt: date }),
  CoordinationKnowledgeArchive: object({ entries: list('CoordinationKnowledgeArchiveEntry'), nextCursor: cursor }),
  CoordinationKnowledgeClaimReceipt: object({ claim: ref('CoordinationKnowledgeClaim'), replayed: { type: 'boolean' } }),
  CoordinationKnowledgeLinkReceipt: object({ link: object({ id,
    relation: { type: 'string', enum: ['corroborates', 'contradicts'] },
    assertion: { type: 'string', const: 'player' }, createdAt: date }), replayed: { type: 'boolean' } }),
  CoordinationKnowledgeArchiveReceipt: object({ archive: object({ id, addedAt: date }), replayed: { type: 'boolean' } }),
  CoordinationKnowledgeRebuildReceipt: object({ rebuilt: object({ grants: { type: 'integer', minimum: 0 },
    archiveEntries: { type: 'integer', minimum: 0 } }), replayed: { type: 'boolean' } }),
};

export function knowledgeContracts(contract) {
  const read = (operationId, response, query) => ({ ...contract(operationId, response),
    pathSchemas: { claimId: id }, ...(query ? { requestParameters: Object.entries(query.properties)
      .map(([name, schema]) => ({ name, in: 'query', required: false, schema })) } : {}) });
  const write = (operationId, response, input) => ({ ...contract(operationId, response, input), pathSchemas: { claimId: id } });
  return {
    'GET /v1/coordination/knowledge': read('getCoordinationKnowledge', 'CoordinationKnowledgeBoard', KNOWLEDGE_QUERIES.page),
    'GET /v1/coordination/knowledge/targets': read('getCoordinationKnowledgeTargets', 'CoordinationKnowledgeTargets', KNOWLEDGE_QUERIES.targets),
    'GET /v1/coordination/knowledge/archive': read('getCoordinationKnowledgeArchive', 'CoordinationKnowledgeArchive', KNOWLEDGE_QUERIES.page),
    'GET /v1/coordination/knowledge/:claimId': read('getCoordinationKnowledgeClaim', 'CoordinationKnowledgeDetail'),
    'POST /v1/coordination/knowledge/:claimId/share': write('shareCoordinationKnowledge', 'CoordinationKnowledgeClaimReceipt', KNOWLEDGE_INPUTS.share),
    'POST /v1/coordination/knowledge/:claimId/revoke': write('revokeCoordinationKnowledge', 'CoordinationKnowledgeClaimReceipt', KNOWLEDGE_INPUTS.revoke),
    'POST /v1/coordination/knowledge/links': write('linkCoordinationKnowledge', 'CoordinationKnowledgeLinkReceipt', KNOWLEDGE_INPUTS.link),
    'POST /v1/coordination/knowledge/archive': write('archiveCoordinationKnowledge', 'CoordinationKnowledgeArchiveReceipt', KNOWLEDGE_INPUTS.archive),
    'POST /v1/coordination/knowledge/rebuild': write('rebuildCoordinationKnowledge', 'CoordinationKnowledgeRebuildReceipt', KNOWLEDGE_INPUTS.rebuild),
  };
}
