import { canonicalBytes, hashFrame, HASH_DOMAINS } from './content/canonical.js';
import { parseAuthoredJson } from './content/json-source.js';
import { normalizeEconomyPackage } from './content/economy-profile.js';
import { withPhase2Transaction, withPhase2Read, assertPhase2Client, registerPhase2Undo } from './content/phase2-transactions.js';
import { failRegistry, ownRequest, validHash, storedNumber, freezeData,
  loadVerifiedStoredArtifact, verifiedArtifactData } from './content/artifact-storage.js';

const OPTIONAL = Object.freeze({ family: 'family', tags: 'tags_json', rarity: 'rarity',
  stackable: 'stackable', ownerScopes: 'owner_scopes_json', qualityMode: 'quality_mode',
  maximumLotQuantity: 'maximum_lot_quantity', conservationClass: 'conservation_class', metadata: 'metadata_json' });
const JSON_FIELDS = Object.freeze(['tags', 'ownerScopes', 'metadata']);
function commitment(input) {
  return hashFrame(HASH_DOMAINS.definition, [
    ['definitionFormatVersion', input.definitionFormatVersion],
    ['packageQualifiedLogicalId', input.packageQualifiedLogicalId],
    ['definitionVersion', input.definitionVersion],
    ['canonicalImmutableDefinition', input.canonicalImmutableDefinition],
  ]);
}
function projection(input, hash, packageId) {
  const semantic = input.canonicalImmutableDefinition;
  const result = { definition_hash: hash, logical_item_id: input.packageQualifiedLogicalId,
    definition_version: input.definitionVersion, package_id: packageId, definition_kind: semantic.kind };
  for (const [key, column] of Object.entries(OPTIONAL)) {
    result[column] = Object.hasOwn(semantic, key)
      ? (JSON_FIELDS.includes(key) ? canonicalBytes(semantic[key]).toString('utf8') : semantic[key]) : null;
  }
  result.trade_mode = semantic.tradePolicy?.mode ?? null;
  result.transferable = semantic.tradePolicy?.transferable ?? null;
  result.trade_policy_hash = Object.hasOwn(semantic, 'tradePolicy') ? hash : null;
  return result;
}
function ownedDefinitions(client, artifact) {
  const { bundle } = verifiedArtifactData(client, artifact);
  return bundle.ir.nodes.filter((node) => node.nodeClass === 'definition').map((node, ordinal) => {
    const input = bundle.canonicalHashInputs.definitionById[node.id];
    const hash = bundle.hashes.definitionHashById[node.id];
    if (!input || commitment(input) !== hash || !node.id.startsWith(`${bundle.package.id}::`)) {
      failRegistry('content_registry_corrupt');
    }
    return { input, bytes: canonicalBytes(input), row: projection(input, hash, bundle.package.id), ordinal };
  });
}
function inspectIntrinsic(row) {
  try {
    const input = parseAuthoredJson(row.canonical_definition_bytes, { maxBytes: 67108864,
      maxDepth: 64, maxStringBytes: 65536, maxObjectMembers: 100000, maxArrayItems: 100000 });
    ownRequest(input, ['definitionFormatVersion', 'packageQualifiedLogicalId', 'definitionVersion', 'canonicalImmutableDefinition']);
    if (input.definitionFormatVersion !== 1 || !canonicalBytes(input).equals(Buffer.from(row.canonical_definition_bytes))
        || commitment(input) !== row.definition_hash || input.definitionVersion !== storedNumber(row.definition_version)
        || !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*::[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(input.packageQualifiedLogicalId)
        || input.packageQualifiedLogicalId.split('::')[0] !== row.package_id) failRegistry('content_registry_corrupt');
    const expected = projection(input, row.definition_hash, row.package_id);
    for (const [key, value] of Object.entries(expected)) {
      if ((key === 'definition_version' ? storedNumber(row[key]) : row[key]) !== value) failRegistry('content_registry_corrupt');
    }
    const semantic = input.canonicalImmutableDefinition;
    if (!['concept', 'material', 'item'].includes(semantic.kind)
        || Object.keys(semantic).some((key) => !['kind', 'tradePolicy', ...Object.keys(OPTIONAL)].includes(key))) {
      failRegistry('content_registry_corrupt');
    }
    // Reuse the pure semantic validator, with no discovery, source compilation or artifact
    // construction. This keeps intrinsic output closed even after direct database corruption.
    const normalized = normalizeEconomyPackage({ authorityProfile: 'production',
      raise: () => failRegistry('content_registry_corrupt'), source: {
        packageId: row.package_id, version: 1, kind: 'library', profile: 'phase2_economy',
        definitions: [{ id: input.packageQualifiedLogicalId.split('::')[1],
          definitionVersion: input.definitionVersion, ...semantic }], nodes: [], edges: [],
        dependencies: [], imports: [], exports: [],
      } }).normalized.definitions[0];
    const { id, localId, definitionVersion, ...normalizedSemantic } = normalized;
    if (!canonicalBytes(normalizedSemantic).equals(canonicalBytes(semantic))) failRegistry('content_registry_corrupt');
    return { input, expected };
  } catch { failRegistry('content_registry_corrupt'); }
}
function compareIntrinsic(row, definition) {
  inspectIntrinsic(row);
  if (!Buffer.from(row.canonical_definition_bytes).equals(definition.bytes)) failRegistry('content_registry_corrupt');
  for (const [key, value] of Object.entries(definition.row)) {
    if ((key === 'definition_version' ? storedNumber(row[key]) : row[key]) !== value) failRegistry('content_registry_corrupt');
  }
}
export async function registerVerifiedDefinitions(client, artifact) {
  assertPhase2Client(client);
  const { row: artifactRow } = verifiedArtifactData(client, artifact);
  for (const definition of ownedDefinitions(client, artifact)) {
    const row = definition.row;
    const sameVersion = (await client.query(
      'SELECT * FROM item_definition_versions WHERE logical_item_id=$1 AND definition_version=$2',
      [row.logical_item_id, row.definition_version],
    )).rows[0];
    if (sameVersion) {
      inspectIntrinsic(sameVersion);
      if (sameVersion.definition_hash !== row.definition_hash) failRegistry('item_definition_conflict');
      compareIntrinsic(sameVersion, definition);
    } else {
      const sameHash = (await client.query('SELECT * FROM item_definition_versions WHERE definition_hash=$1', [row.definition_hash])).rows[0];
      if (sameHash) failRegistry('content_registry_corrupt');
      const maximum = (await client.query(
        'SELECT MAX(definition_version) AS maximum FROM item_definition_versions WHERE logical_item_id=$1', [row.logical_item_id],
      )).rows[0].maximum;
      if (maximum !== null && maximum !== undefined && storedNumber(maximum) > row.definition_version) failRegistry('item_definition_conflict');
      registerPhase2Undo(client, () => client.query('DELETE FROM item_definition_versions WHERE definition_hash=$1', [row.definition_hash]));
      await client.query(`INSERT INTO item_definition_versions
        (definition_hash,logical_item_id,definition_version,package_id,definition_kind,family,tags_json,rarity,
         stackable,trade_mode,transferable,trade_policy_hash,owner_scopes_json,quality_mode,
         maximum_lot_quantity,conservation_class,metadata_json,canonical_definition_bytes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [row.definition_hash, row.logical_item_id, row.definition_version, row.package_id, row.definition_kind,
        row.family, row.tags_json, row.rarity, row.stackable, row.trade_mode, row.transferable, row.trade_policy_hash,
        row.owner_scopes_json, row.quality_mode, row.maximum_lot_quantity, row.conservation_class,
        row.metadata_json, definition.bytes]);
    }
    registerPhase2Undo(client, () => client.query(
      'DELETE FROM content_bundle_item_definitions WHERE bundle_hash=$1 AND logical_item_id=$2',
      [artifactRow.bundle_hash, row.logical_item_id],
    ));
    await client.query(`INSERT INTO content_bundle_item_definitions
      (bundle_hash,logical_item_id,definition_hash,ordinal) VALUES ($1,$2,$3,$4)`,
    [artifactRow.bundle_hash, row.logical_item_id, row.definition_hash, definition.ordinal]);
  }
}
export async function verifyRegisteredDefinitions(client, artifact) {
  assertPhase2Client(client);
  const { row } = verifiedArtifactData(client, artifact);
  const definitions = ownedDefinitions(client, artifact);
  const memberships = (await client.query(
    'SELECT * FROM content_bundle_item_definitions WHERE bundle_hash=$1 ORDER BY ordinal', [row.bundle_hash],
  )).rows;
  if (memberships.length !== definitions.length || definitions.length !== row.definition_count) failRegistry('content_registry_corrupt');
  for (const [index, definition] of definitions.entries()) {
    const member = memberships[index];
    if (member.logical_item_id !== definition.row.logical_item_id || member.definition_hash !== definition.row.definition_hash
        || member.ordinal !== index) failRegistry('content_registry_corrupt');
    const intrinsic = (await client.query('SELECT * FROM item_definition_versions WHERE definition_hash=$1', [member.definition_hash])).rows[0];
    if (!intrinsic) failRegistry('content_registry_corrupt');
    compareIntrinsic(intrinsic, definition);
  }
  return definitions.length;
}
export async function registerItemDefinitions(pool, request) {
  const { bundleHash } = ownRequest(request, ['bundleHash']);
  validHash(bundleHash);
  return withPhase2Transaction(pool, async (client) => {
    const artifact = await loadVerifiedStoredArtifact(client, bundleHash);
    const definitionCount = await verifyRegisteredDefinitions(client, artifact);
    return Object.freeze({ bundleHash, definitionCount, replayed: true });
  });
}
export async function definitionByHash(queryable, hash) {
  validHash(hash);
  return withPhase2Read(queryable, async (client) => {
    const row = (await client.query('SELECT * FROM item_definition_versions WHERE definition_hash=$1', [hash])).rows[0];
    if (!row) failRegistry('definition_not_found');
    const { input } = inspectIntrinsic(row);
    const semantic = input.canonicalImmutableDefinition;
    return freezeData({ logicalItemId: row.logical_item_id, definitionVersion: storedNumber(row.definition_version),
      definitionHash: hash, packageId: row.package_id, ...semantic, tradePolicyHash: row.trade_policy_hash });
  });
}
