import { canonicalBytes, compareCanonicalText } from './canonical.js';

export const PHASE2_VALUE_QUANTITY_LIMIT = 1_000_000;

export const PRODUCTION_PROFILE_REGISTRY = Object.freeze([
  'phase2_economy',
  'phase3_mystery',
]);

export const PHASE2_LIMITS = Object.freeze({
  maxPackages: 2_048,
  maxFilesPerPackage: 128,
  maxPackageBytes: 1024 * 1024,
  maxCorpusBytes: 64 * 1024 * 1024,
  maxJsonDepth: 64,
  maxStringBytes: 64 * 1024,
  maxNodes: 20_000,
  maxEdges: 100_000,
  maxReferencesPerNode: 256,
  maxExactComponentVertices: 256,
  maxWitnessIds: 128,
  maxReportBytes: 8 * 1024 * 1024,
  maxEconomyReachabilitySteps: 4_000_000,
  maxOverlayBytesPerCorpus: 64 * 1024 * 1024,
  maxCatalogBundles: 2_048,
  maxCatalogBytes: 64 * 1024 * 1024,
  maxCatalogNodes: 100_000,
  maxCatalogEdges: 500_000,
  maxCatalogReferences: 1_000_000,
  maxBundleWorkspaceBytes: 48 * 1024 * 1024,
  maxValueQuantity: PHASE2_VALUE_QUANTITY_LIMIT,
});

export const PHASE2_FIXTURE_LIMITS = Object.freeze({
  ...PHASE2_LIMITS,
  maxNodes: 10_000,
  maxEdges: 100_000,
});

const ROOT_FIELDS = new Set([
  'packageId', 'version', 'kind', 'profile', 'entrypoint', 'metadata',
  'definitions', 'nodes', 'edges', 'exports', 'dependencies', 'imports',
]);
const DEFINITION_FIELDS = new Set([
  'id', 'definitionVersion', 'kind', 'family', 'tags', 'rarity', 'stackable',
  'tradePolicy', 'ownerScopes', 'qualityMode', 'maximumLotQuantity',
  'conservationClass', 'metadata',
]);
const NODE_FIELDS = new Set(['id', 'kind', 'refs', 'adapter', 'public', 'metadata']);
const EDGE_FIELDS = new Set(['from', 'to', 'kind', 'quantity']);
const DEPENDENCY_FIELDS = new Set(['packageId', 'version', 'bundleHash']);
const IMPORT_FIELDS = new Set(['id', 'definitionHash', 'dependencyBundleHash']);
const METADATA_FIELDS = new Set(['title', 'summary', 'tags']);
const TRADE_POLICY_FIELDS = new Set(['mode', 'transferable']);
const ADAPTER_FIELDS = new Set(['kind', 'args', 'cash']);
const COMPILED_ADAPTER_FIELDS = new Set([
  'kind', 'registryVersion', 'adapterVersion', 'args', 'cash',
]);
const CASH_FIELDS = new Set(['classification', 'grossCashEmission', 'netCashDelta']);

const LOCAL_ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const MAX_ID_BYTES = 128;
const SHA256 = /^[a-f0-9]{64}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/u;
const NODE_KINDS = new Set([
  'step', 'experience', 'terminal', 'recovery', 'source', 'sink', 'use',
  'recipe', 'item_definition', 'material_definition',
]);
const EDGE_KINDS = new Set([
  'requires', 'optional', 'consumes', 'produces', 'discovers', 'reveals',
  'shares', 'contributes', 'aggregates', 'rewards', 'recovery', 'sinks',
]);
const DEFINITION_KINDS = new Set(['concept', 'material', 'item']);
const RARITIES = new Set(['common', 'uncommon', 'rare', 'specialty']);
const OWNER_SCOPES = new Set(['account', 'character', 'organization', 'project']);
const QUALITY_MODES = new Set(['none', 'fixed', 'inherited', 'bounded']);
const CONSERVATION_CLASSES = new Set(['renewable', 'finite', 'durable', 'consumable']);
const TRADE_MODES = new Set(['closed', 'ordinary', 'restricted']);
const EPOCHS = new Set(['day', 'week', 'season']);
const OMR_MOVEMENT_KEYS = new Set([
  'adapter', 'allocation', 'asset', 'cost', 'currency', 'effect', 'input', 'ledgerasset',
  'ledgerreason', 'output', 'reserve', 'reward', 'token',
]);
const MAX_ADAPTER_UNITS = PHASE2_VALUE_QUANTITY_LIMIT;

export const ECONOMY_ADAPTER_REGISTRY_VERSION = 1;

function adapterDescriptor({
  nodeKinds,
  transactionClass,
  lockClasses,
  replayPolicy,
  visibilityPolicy,
  valueClass,
  reportClass,
  args,
  cash = null,
  issuancePolicy = 'none',
  sourceCapIdentity = 'none',
  usagePolicy = 'none',
}) {
  return Object.freeze({
    adapterVersion: 1,
    profiles: Object.freeze(['phase2_economy']),
    authorityProfiles: Object.freeze(['production', 'fixture']),
    nodeKinds: Object.freeze([...nodeKinds]),
    transactionClass,
    lockClasses: Object.freeze([...lockClasses]),
    replayPolicy,
    visibilityPolicy,
    valueClass,
    reportClass,
    issuancePolicy,
    sourceCapIdentity,
    usagePolicy,
    args: Object.freeze(args),
    cash,
  });
}

export const ECONOMY_ADAPTER_REGISTRY = Object.freeze(Object.assign(Object.create(null), {
  observe: adapterDescriptor({
    nodeKinds: ['step', 'experience', 'terminal', 'recovery'],
    transactionClass: 'none',
    lockClasses: [],
    replayPolicy: 'none',
    visibilityPolicy: 'declared',
    valueClass: 'none',
    reportClass: 'observe',
    args: {},
  }),
  inventory_source: adapterDescriptor({
    nodeKinds: ['source'],
    transactionClass: 'inventory_write',
    lockClasses: ['content_inventory'],
    replayPolicy: 'idempotency_key',
    visibilityPolicy: 'server_projection',
    valueClass: 'create',
    reportClass: 'source',
    issuancePolicy: 'periodic_per_owner_scope',
    sourceCapIdentity: 'bundle_node_owner_scope_epoch',
    args: {
      definitionId: Object.freeze({ type: 'definitionId' }),
      maxUnitsPerEpoch: Object.freeze({ type: 'positiveInteger', maximum: MAX_ADAPTER_UNITS }),
      epoch: Object.freeze({ type: 'enum', values: Object.freeze(['day', 'week', 'season']) }),
    },
  }),
  inventory_sink: adapterDescriptor({
    nodeKinds: ['sink'],
    transactionClass: 'inventory_write',
    lockClasses: ['content_inventory'],
    replayPolicy: 'idempotency_key',
    visibilityPolicy: 'server_projection',
    valueClass: 'destroy',
    reportClass: 'sink',
    usagePolicy: 'destructive_sink',
    args: {
      definitionId: Object.freeze({ type: 'definitionId' }),
      quantity: Object.freeze({ type: 'positiveInteger', maximum: MAX_ADAPTER_UNITS }),
    },
  }),
  inventory_consume: adapterDescriptor({
    nodeKinds: ['use', 'recipe'],
    transactionClass: 'inventory_write',
    lockClasses: ['content_inventory'],
    replayPolicy: 'idempotency_key',
    visibilityPolicy: 'server_projection',
    valueClass: 'consume',
    reportClass: 'use',
    usagePolicy: 'consuming',
    args: {
      definitionId: Object.freeze({ type: 'definitionId' }),
      quantity: Object.freeze({ type: 'positiveInteger', maximum: MAX_ADAPTER_UNITS }),
    },
  }),
  inventory_create: adapterDescriptor({
    // A recipe node currently owns only one adapter, so it cannot bind both an
    // input and an output conservation equation. Keep creation source-only
    // until a reviewed multi-input/output recipe capability exists.
    nodeKinds: ['source'],
    transactionClass: 'inventory_write',
    lockClasses: ['content_inventory'],
    replayPolicy: 'idempotency_key',
    visibilityPolicy: 'server_projection',
    valueClass: 'create',
    reportClass: 'source',
    issuancePolicy: 'one_time_per_owner_scope',
    sourceCapIdentity: 'bundle_node_owner_scope',
    args: {
      definitionId: Object.freeze({ type: 'definitionId' }),
      quantity: Object.freeze({ type: 'positiveInteger', maximum: MAX_ADAPTER_UNITS }),
    },
  }),
  inventory_durable_use: adapterDescriptor({
    nodeKinds: ['use'],
    transactionClass: 'none',
    lockClasses: [],
    replayPolicy: 'none',
    visibilityPolicy: 'declared',
    valueClass: 'durable_use',
    reportClass: 'use',
    usagePolicy: 'bounded_durable',
    args: {
      definitionId: Object.freeze({ type: 'definitionId' }),
      maximumConcurrentUses: Object.freeze({ type: 'positiveInteger', maximum: MAX_ADAPTER_UNITS }),
    },
  }),
  cash_transfer: adapterDescriptor({
    nodeKinds: ['step'],
    transactionClass: 'ledger_write',
    lockClasses: ['character_ledger'],
    replayPolicy: 'idempotency_key',
    visibilityPolicy: 'private_projection',
    valueClass: 'cash_transfer',
    reportClass: 'cash',
    args: {
      ledgerReason: Object.freeze({ type: 'enum', values: Object.freeze(['phase2_transfer']) }),
    },
    cash: 'transfer',
  }),
  cash_sink: adapterDescriptor({
    nodeKinds: ['sink'],
    transactionClass: 'ledger_write',
    lockClasses: ['character_ledger'],
    replayPolicy: 'idempotency_key',
    visibilityPolicy: 'private_projection',
    valueClass: 'cash_sink',
    reportClass: 'cash',
    args: {
      ledgerReason: Object.freeze({ type: 'enum', values: Object.freeze(['phase2_sink']) }),
    },
    cash: 'sink',
  }),
}));

function ownObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function assertObject(value, path, raise) {
  if (!ownObject(value)) raise('content_schema_invalid', `${path} must be an object`, path);
  return value;
}

function assertArray(value, path, raise) {
  if (!Array.isArray(value)) raise('content_schema_invalid', `${path} must be an array`, path);
  return value;
}

function assertFields(value, allowed, path, raise) {
  assertObject(value, path, raise);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      raise('content_schema_invalid', `${path} has unknown field ${key}`, `${path}.${key}`);
    }
  }
}

function plainText(value, path, raise, { required = false } = {}) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || (required && value.length === 0)) {
    raise('content_schema_invalid', `${path} must be ${required ? 'a non-empty' : 'a'} string`, path);
  }
  if (CONTROL_CHARACTERS.test(value) || /[<>]/u.test(value)) {
    raise('content_schema_invalid', `${path} must be control-free plain text`, path);
  }
  return value;
}

function safePositiveInteger(value, path, raise) {
  if (!Number.isSafeInteger(value) || value < 1) {
    raise('content_schema_invalid', `${path} must be a positive safe integer`, path);
  }
  return value;
}

function safeNonnegativeInteger(value, path, raise) {
  if (!Number.isSafeInteger(value) || value < 0) {
    raise('content_schema_invalid', `${path} must be a non-negative safe integer`, path);
  }
  return value;
}

function localId(value, path, raise) {
  if (typeof value === 'string' && omrAlias(value)) {
    raise('content_omr_forbidden', `OMR authority identifier is forbidden at ${path}`, path);
  }
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > MAX_ID_BYTES
      || value.includes('::') || !LOCAL_ID.test(value)) {
    raise('content_schema_invalid', `${path} must be a canonical package-local ID`, path);
  }
  return value;
}

function packageId(value, path, raise) {
  return localId(value, path, raise);
}

function qualifiedId(value, path, raise) {
  if (typeof value !== 'string') {
    raise('content_schema_invalid', `${path} must be a qualified ID`, path);
  }
  const parts = value.split('::');
  if (parts.length !== 2) {
    raise('content_schema_invalid', `${path} must be <packageId>::<localId>`, path);
  }
  localId(parts[0], `${path}.packageId`, raise);
  localId(parts[1], `${path}.localId`, raise);
  return value;
}

function qualify(value, ownerPackageId, path, raise) {
  if (typeof value !== 'string') raise('content_schema_invalid', `${path} must be an ID`, path);
  return value.includes('::')
    ? qualifiedId(value, path, raise)
    : `${ownerPackageId}::${localId(value, path, raise)}`;
}

function exactHash(value, path, raise) {
  if (typeof value !== 'string' || !SHA256.test(value)) {
    raise('content_dependency_unresolved', `${path} must be an exact lowercase SHA-256 hash`, path);
  }
  return value;
}

function sortedUniqueStrings(values, path, raise, normalize) {
  assertArray(values, path, raise);
  const normalized = values.map((value, index) => normalize(value, `${path}[${index}]`, raise));
  normalized.sort(compareCanonicalText);
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index] === normalized[index - 1]) {
      raise('content_schema_invalid', `${path} contains a duplicate value`, path);
    }
  }
  return normalized;
}

function semanticTokens(value) {
  return value.replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
}

function omrAlias(value) {
  if (typeof value !== 'string') return false;
  const tokens = semanticTokens(value);
  const compact = tokens.join('');
  if (['omr', 'omrtoken', 'omertatoken', 'wrappedomr'].includes(compact)) return true;
  if (tokens.some((token) => ['omr', 'omrtoken', 'omertatoken', 'wrappedomr'].includes(token))) return true;
  return tokens.some((token, index) => (
    (token === 'omr' && tokens[index + 1] === 'token')
    || (token === 'omerta' && tokens[index + 1] === 'token')
    || (token === 'wrapped' && tokens[index + 1] === 'omr')
  ));
}

export function inspectOmrAuthority(source) {
  const pending = [{ value: source, path: '$', prose: false, movement: false }];
  const references = [];
  let movement = 0;
  while (pending.length > 0) {
    const { value, path, prose, movement: movementContext } = pending.pop();
    if (!prose && omrAlias(value)) {
      references.push(path);
      if (movementContext) movement += 1;
    }
    if (Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index -= 1) {
        pending.push({ value: value[index], path: `${path}[${index}]`, prose, movement: movementContext });
      }
    } else if (ownObject(value)) {
      for (const key of Object.keys(value)) {
        const normalizedKey = key.toLowerCase();
        const inMetadataProse = path.endsWith('.metadata') && ['title', 'summary'].includes(key);
        pending.push({
          value: value[key],
          path: `${path}.${key}`,
          prose: inMetadataProse,
          movement: movementContext || OMR_MOVEMENT_KEYS.has(normalizedKey),
        });
        if (!inMetadataProse && omrAlias(key)) {
          references.push(`${path}.${key}`);
          if (movementContext || OMR_MOVEMENT_KEYS.has(normalizedKey)) movement += 1;
        }
      }
    }
  }
  return { references, movement };
}

function rejectOmrAuthority(source, raise) {
  const result = inspectOmrAuthority(source);
  if (result.references.length > 0) {
    raise(
      'content_omr_forbidden',
      `OMR authority is forbidden at ${result.references[0]}`,
      result.references[0],
      { references: result.references.length, movement: result.movement },
    );
  }
}

const ADAPTER_DESCRIPTOR_FIELDS = new Set([
  'adapterVersion', 'profiles', 'authorityProfiles', 'nodeKinds', 'transactionClass',
  'lockClasses', 'replayPolicy', 'visibilityPolicy', 'valueClass', 'reportClass',
  'issuancePolicy', 'sourceCapIdentity', 'usagePolicy', 'args', 'cash',
]);
const ADAPTER_TRANSACTION_CLASSES = new Set(['none', 'inventory_write', 'ledger_write']);
const ADAPTER_LOCK_CLASSES = new Set(['content_inventory', 'character_ledger']);
const ADAPTER_REPLAY_POLICIES = new Set(['none', 'idempotency_key']);
const ADAPTER_VISIBILITY_POLICIES = new Set(['declared', 'server_projection', 'private_projection']);
const ADAPTER_VALUE_CLASSES = new Set([
  'none', 'create', 'consume', 'destroy', 'durable_use', 'cash_transfer', 'cash_sink',
]);
const ADAPTER_REPORT_CLASSES = new Set(['observe', 'source', 'use', 'sink', 'cash']);
const ADAPTER_ISSUANCE_POLICIES = new Set([
  'none', 'periodic_per_owner_scope', 'one_time_per_owner_scope',
]);
const ADAPTER_SOURCE_CAP_IDENTITIES = new Set([
  'none', 'bundle_node_owner_scope_epoch', 'bundle_node_owner_scope',
]);
const ADAPTER_USAGE_POLICIES = new Set([
  'none', 'consuming', 'destructive_sink', 'bounded_durable',
]);
const ADAPTER_CASH_CLASSES = new Set(['transfer', 'sink']);
const REPORT_CLASS_BY_VALUE_CLASS = Object.freeze({
  none: 'observe',
  create: 'source',
  consume: 'use',
  destroy: 'sink',
  durable_use: 'use',
  cash_transfer: 'cash',
  cash_sink: 'cash',
});

function registryFailure(code, message, path, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.path = path;
  error.details = details;
  throw error;
}

function validateRegistryArray(value, allowed, path, raise, { allowEmpty = false } = {}) {
  assertArray(value, path, raise);
  if (!allowEmpty && value.length === 0) {
    raise('content_schema_invalid', `${path} cannot be empty`, path);
  }
  const seen = new Set();
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    if (typeof entry !== 'string' || !allowed.has(entry) || seen.has(entry)) {
      raise('content_schema_invalid', `${path} is outside the closed adapter registry`, path);
    }
    seen.add(entry);
  }
}

export function validateEconomyAdapterRegistry(
  registry = ECONOMY_ADAPTER_REGISTRY,
  raise = registryFailure,
) {
  const omrInspection = inspectOmrAuthority(registry);
  if (omrInspection.references.length > 0) {
    raise(
      'content_omr_forbidden',
      `economy adapter registry grants OMR authority at ${omrInspection.references[0]}`,
      omrInspection.references[0],
      { references: omrInspection.references.length, movement: omrInspection.movement },
    );
  }
  assertObject(registry, '$.adapterRegistry', raise);
  const kinds = Object.keys(registry);
  if (kinds.length === 0) {
    raise('content_schema_invalid', 'economy adapter registry cannot be empty', '$.adapterRegistry');
  }
  for (const kind of kinds) {
    localId(kind, `$.adapterRegistry.${kind}`, raise);
    const descriptor = registry[kind];
    const path = `$.adapterRegistry.${kind}`;
    assertFields(descriptor, ADAPTER_DESCRIPTOR_FIELDS, path, raise);
    for (const field of ADAPTER_DESCRIPTOR_FIELDS) {
      if (!Object.hasOwn(descriptor, field)) {
        raise('content_schema_invalid', `${path}.${field} is required`, `${path}.${field}`);
      }
    }
    safePositiveInteger(descriptor.adapterVersion, `${path}.adapterVersion`, raise);
    validateRegistryArray(descriptor.profiles, new Set(['phase2_economy']), `${path}.profiles`, raise);
    validateRegistryArray(
      descriptor.authorityProfiles,
      new Set(['production', 'fixture']),
      `${path}.authorityProfiles`,
      raise,
    );
    validateRegistryArray(descriptor.nodeKinds, NODE_KINDS, `${path}.nodeKinds`, raise);
    if (!ADAPTER_TRANSACTION_CLASSES.has(descriptor.transactionClass)
        || !ADAPTER_REPLAY_POLICIES.has(descriptor.replayPolicy)
        || !ADAPTER_VISIBILITY_POLICIES.has(descriptor.visibilityPolicy)
        || !ADAPTER_VALUE_CLASSES.has(descriptor.valueClass)
        || !ADAPTER_REPORT_CLASSES.has(descriptor.reportClass)
        || !ADAPTER_ISSUANCE_POLICIES.has(descriptor.issuancePolicy)
        || !ADAPTER_SOURCE_CAP_IDENTITIES.has(descriptor.sourceCapIdentity)
        || !ADAPTER_USAGE_POLICIES.has(descriptor.usagePolicy)) {
      raise('content_schema_invalid', `${path} has an unclassified adapter capability`, path);
    }
    validateRegistryArray(
      descriptor.lockClasses,
      ADAPTER_LOCK_CLASSES,
      `${path}.lockClasses`,
      raise,
      { allowEmpty: true },
    );
    const expectedLockClasses = descriptor.transactionClass === 'inventory_write'
      ? ['content_inventory']
      : descriptor.transactionClass === 'ledger_write' ? ['character_ledger'] : [];
    if (descriptor.lockClasses.length !== expectedLockClasses.length
        || expectedLockClasses.some((entry) => !descriptor.lockClasses.includes(entry))) {
      raise('content_schema_invalid', `${path} transaction/lock classification disagrees`, path);
    }
    const expectedReplayPolicy = descriptor.transactionClass === 'none'
      ? 'none' : 'idempotency_key';
    if (descriptor.replayPolicy !== expectedReplayPolicy) {
      raise('content_schema_invalid', `${path} transaction/replay classification disagrees`, path);
    }
    const allowedVisibility = descriptor.transactionClass === 'none'
      ? new Set(['declared'])
      : new Set(['server_projection', 'private_projection']);
    if (!allowedVisibility.has(descriptor.visibilityPolicy)) {
      raise('content_schema_invalid', `${path} transaction/visibility classification disagrees`, path);
    }
    if (REPORT_CLASS_BY_VALUE_CLASS[descriptor.valueClass] !== descriptor.reportClass) {
      raise('content_schema_invalid', `${path} value/report classification disagrees`, path);
    }
    const expectedTransaction = descriptor.valueClass === 'none'
      || descriptor.valueClass === 'durable_use' ? 'none'
      : descriptor.valueClass.startsWith('cash_') ? 'ledger_write' : 'inventory_write';
    if (descriptor.transactionClass !== expectedTransaction) {
      raise('content_schema_invalid', `${path} transaction/value classification disagrees`, path);
    }
    const expectedCash = descriptor.valueClass.startsWith('cash_')
      ? descriptor.valueClass.slice('cash_'.length)
      : null;
    if (descriptor.cash !== expectedCash
        || (descriptor.cash !== null && !ADAPTER_CASH_CLASSES.has(descriptor.cash))) {
      raise('content_schema_invalid', `${path} cash/value classification disagrees`, path);
    }
    const createsValue = descriptor.valueClass === 'create';
    if (createsValue !== (descriptor.issuancePolicy !== 'none')
        || createsValue !== (descriptor.sourceCapIdentity !== 'none')) {
      raise('content_schema_invalid', `${path} source issuance classification disagrees`, path);
    }
    const expectedUsagePolicy = descriptor.valueClass === 'consume'
      ? 'consuming'
      : descriptor.valueClass === 'destroy'
        ? 'destructive_sink'
        : descriptor.valueClass === 'durable_use' ? 'bounded_durable' : 'none';
    if (descriptor.usagePolicy !== expectedUsagePolicy) {
      raise('content_schema_invalid', `${path} value/usage classification disagrees`, path);
    }
    assertObject(descriptor.args, `${path}.args`, raise);
    for (const [name, argument] of Object.entries(descriptor.args)) {
      if (!/^[A-Za-z][A-Za-z0-9]*$/u.test(name)) {
        raise('content_schema_invalid', `${path}.args has an invalid argument name`, `${path}.args`);
      }
      assertObject(argument, `${path}.args.${name}`, raise);
      if (argument.type === 'definitionId') {
        assertFields(argument, new Set(['type']), `${path}.args.${name}`, raise);
      } else if (argument.type === 'positiveInteger') {
        assertFields(argument, new Set(['type', 'maximum']), `${path}.args.${name}`, raise);
        const maximum = safePositiveInteger(argument.maximum, `${path}.args.${name}.maximum`, raise);
        if (maximum > PHASE2_VALUE_QUANTITY_LIMIT) {
          raise('content_input_limit', `${path}.args.${name}.maximum exceeds the value limit`, path, {
            limitKind: 'adapterValue', expected: PHASE2_VALUE_QUANTITY_LIMIT, actual: maximum,
          });
        }
      } else if (argument.type === 'enum') {
        assertFields(argument, new Set(['type', 'values']), `${path}.args.${name}`, raise);
        assertArray(argument.values, `${path}.args.${name}.values`, raise);
        if (argument.values.length === 0 || argument.values.some((entry) => typeof entry !== 'string')) {
          raise('content_schema_invalid', `${path}.args.${name}.values is invalid`, path);
        }
      } else {
        raise('content_schema_invalid', `${path}.args.${name}.type is unknown`, path);
      }
    }
  }
  return { references: omrInspection.references.length, movement: omrInspection.movement };
}

export const ECONOMY_ADAPTER_REGISTRY_OMR_AUTHORITY = Object.freeze(
  validateEconomyAdapterRegistry(ECONOMY_ADAPTER_REGISTRY),
);

function lookupEconomyAdapterDescriptor(kind) {
  return typeof kind === 'string' && Object.hasOwn(ECONOMY_ADAPTER_REGISTRY, kind)
    ? ECONOMY_ADAPTER_REGISTRY[kind]
    : undefined;
}

function unknownAdapter(kind) {
  const error = new TypeError(`unknown normalized economy adapter ${String(kind)}`);
  error.code = 'content_schema_invalid';
  throw error;
}

function normalizeMetadata(value, path, raise) {
  if (value === undefined) return undefined;
  assertFields(value, METADATA_FIELDS, path, raise);
  const metadata = {};
  if (value.title !== undefined) metadata.title = plainText(value.title, `${path}.title`, raise);
  if (value.summary !== undefined) metadata.summary = plainText(value.summary, `${path}.summary`, raise);
  if (value.tags !== undefined) {
    metadata.tags = sortedUniqueStrings(value.tags, `${path}.tags`, raise, (tag, tagPath, fail) => {
      const text = plainText(tag, tagPath, fail);
      if (omrAlias(text)) fail('content_omr_forbidden', `OMR authority tag is forbidden at ${tagPath}`, tagPath);
      return text;
    });
  }
  return metadata;
}

function normalizeTradePolicy(value, path, raise) {
  assertFields(value, TRADE_POLICY_FIELDS, path, raise);
  if (!TRADE_MODES.has(value.mode) || typeof value.transferable !== 'boolean') {
    raise('content_schema_invalid', `${path} has an invalid trade policy`, path);
  }
  return { mode: value.mode, transferable: value.transferable };
}

function normalizeDefinition(value, index, ownerPackageId, limits, raise) {
  const path = `$.definitions[${index}]`;
  assertFields(value, DEFINITION_FIELDS, path, raise);
  const id = localId(value.id, `${path}.id`, raise);
  const kind = value.kind;
  if (!DEFINITION_KINDS.has(kind)) {
    raise('content_schema_invalid', `${path}.kind is not a Phase 2 definition kind`, `${path}.kind`);
  }
  const normalized = {
    id: `${ownerPackageId}::${id}`,
    localId: id,
    definitionVersion: safePositiveInteger(value.definitionVersion, `${path}.definitionVersion`, raise),
    kind,
  };
  if (value.family !== undefined) normalized.family = localId(value.family, `${path}.family`, raise);
  if (value.tags !== undefined) {
    normalized.tags = sortedUniqueStrings(value.tags, `${path}.tags`, raise, localId);
  }
  if (value.rarity !== undefined) {
    if (!RARITIES.has(value.rarity)) raise('content_schema_invalid', `${path}.rarity is unknown`, `${path}.rarity`);
    normalized.rarity = value.rarity;
  }
  if (value.stackable !== undefined) {
    if (typeof value.stackable !== 'boolean') raise('content_schema_invalid', `${path}.stackable must be boolean`, `${path}.stackable`);
    normalized.stackable = value.stackable;
  }
  if (value.tradePolicy !== undefined) {
    normalized.tradePolicy = normalizeTradePolicy(value.tradePolicy, `${path}.tradePolicy`, raise);
  }
  if (value.ownerScopes !== undefined) {
    normalized.ownerScopes = sortedUniqueStrings(
      value.ownerScopes,
      `${path}.ownerScopes`,
      raise,
      (scope, scopePath, fail) => {
        if (!OWNER_SCOPES.has(scope)) fail('content_schema_invalid', `${scopePath} is unknown`, scopePath);
        return scope;
      },
    );
  }
  if (value.qualityMode !== undefined) {
    if (!QUALITY_MODES.has(value.qualityMode)) raise('content_schema_invalid', `${path}.qualityMode is unknown`, `${path}.qualityMode`);
    normalized.qualityMode = value.qualityMode;
  }
  if (value.maximumLotQuantity !== undefined) {
    normalized.maximumLotQuantity = safePositiveInteger(value.maximumLotQuantity, `${path}.maximumLotQuantity`, raise);
    if (normalized.maximumLotQuantity > limits.maxValueQuantity) {
      raise('content_input_limit', `${path}.maximumLotQuantity exceeds the value limit`, `${path}.maximumLotQuantity`, {
        limitKind: 'valueQuantity', expected: limits.maxValueQuantity, actual: normalized.maximumLotQuantity,
      });
    }
  }
  if (value.conservationClass !== undefined) {
    if (!CONSERVATION_CLASSES.has(value.conservationClass)) {
      raise('content_schema_invalid', `${path}.conservationClass is unknown`, `${path}.conservationClass`);
    }
    normalized.conservationClass = value.conservationClass;
  }
  if (value.metadata !== undefined) normalized.metadata = normalizeMetadata(value.metadata, `${path}.metadata`, raise);

  if (kind !== 'concept') {
    for (const required of ['family', 'tags', 'rarity', 'stackable', 'tradePolicy', 'ownerScopes',
      'qualityMode', 'maximumLotQuantity', 'conservationClass']) {
      if (!Object.hasOwn(normalized, required)) {
        raise('content_schema_invalid', `${path}.${required} is required for ${kind}`, `${path}.${required}`);
      }
    }
  }
  return normalized;
}

function normalizeAdapter(value, path, ownerPackageId, nodeKind, profile, authorityProfile, raise, {
  compiled = false,
} = {}) {
  assertFields(value, compiled ? COMPILED_ADAPTER_FIELDS : ADAPTER_FIELDS, path, raise);
  if (typeof value.kind !== 'string' || omrAlias(value.kind)) {
    raise('content_omr_forbidden', `${path}.kind cannot grant OMR authority`, `${path}.kind`);
  }
  const descriptor = lookupEconomyAdapterDescriptor(value.kind);
  if (!descriptor) raise('content_schema_invalid', `${path}.kind is an unknown adapter`, `${path}.kind`);
  if (!descriptor.nodeKinds.includes(nodeKind)
      || !descriptor.profiles.includes(profile)
      || !descriptor.authorityProfiles.includes(authorityProfile)) {
    raise('content_schema_invalid', `${path}.kind is incompatible with its node/profile authority`, path);
  }
  if (compiled && (value.registryVersion !== ECONOMY_ADAPTER_REGISTRY_VERSION
      || value.adapterVersion !== descriptor.adapterVersion)) {
    raise('content_schema_invalid', `${path} has an unknown or unlocked adapter version`, path);
  }
  assertObject(value.args, `${path}.args`, raise);
  assertFields(value.args, new Set(Object.keys(descriptor.args)), `${path}.args`, raise);
  const args = {};
  for (const [name, argument] of Object.entries(descriptor.args)) {
    const argumentPath = `${path}.args.${name}`;
    if (argument.type === 'definitionId') {
      args[name] = qualify(value.args[name], ownerPackageId, argumentPath, raise);
    } else if (argument.type === 'positiveInteger') {
      const normalized = safePositiveInteger(value.args[name], argumentPath, raise);
      if (normalized > argument.maximum) {
        raise('content_input_limit', `${argumentPath} exceeds the adapter value limit`, argumentPath, {
          limitKind: 'adapterValue', expected: argument.maximum, actual: normalized,
        });
      }
      args[name] = normalized;
    } else if (argument.type === 'enum') {
      if (typeof value.args[name] !== 'string' || omrAlias(value.args[name])) {
        raise('content_omr_forbidden', `${argumentPath} cannot grant OMR authority`, argumentPath);
      }
      if (!argument.values.includes(value.args[name])) {
        raise(
          name === 'ledgerReason' ? 'content_cash_policy' : 'content_schema_invalid',
          `${argumentPath} is outside the server-owned registry`,
          argumentPath,
        );
      }
      args[name] = value.args[name];
    } else {
      raise('content_schema_invalid', `${argumentPath} has an unknown server argument type`, argumentPath);
    }
  }

  const normalizedAdapter = {
    kind: value.kind,
    ...(compiled ? {
      registryVersion: ECONOMY_ADAPTER_REGISTRY_VERSION,
      adapterVersion: descriptor.adapterVersion,
    } : {}),
    args,
  };
  if (descriptor.cash === null) {
    if (value.cash !== undefined) raise('content_cash_policy', `${path}.cash is not permitted`, `${path}.cash`);
    return normalizedAdapter;
  }
  if (value.cash === undefined) {
    raise('content_cash_policy', `${path} has an unclassified cash adapter`, path, { reason: 'unclassified' });
  }
  assertFields(value.cash, CASH_FIELDS, `${path}.cash`, raise);
  if (value.cash.classification !== descriptor.cash) {
    raise('content_cash_policy', `${path}.cash classification is invalid`, `${path}.cash.classification`);
  }
  const grossCashEmission = safeNonnegativeInteger(
    value.cash.grossCashEmission,
    `${path}.cash.grossCashEmission`,
    raise,
  );
  if (!Number.isSafeInteger(value.cash.netCashDelta)) {
    raise('content_cash_policy', `${path}.cash.netCashDelta must be a safe integer`, `${path}.cash.netCashDelta`);
  }
  if (grossCashEmission !== 0 || value.cash.netCashDelta !== 0) {
    raise('content_cash_policy', `${path} violates the Phase 2A zero-cash policy`, path, {
      reason: grossCashEmission !== 0 ? 'emission' : 'delta',
    });
  }
  normalizedAdapter.cash = {
    classification: descriptor.cash,
    grossCashEmission,
    netCashDelta: value.cash.netCashDelta,
  };
  return normalizedAdapter;
}

export function compileEconomyAdapter(adapter) {
  if (adapter === undefined) return undefined;
  const descriptor = lookupEconomyAdapterDescriptor(adapter.kind);
  if (!descriptor) unknownAdapter(adapter.kind);
  return {
    kind: String(adapter.kind),
    registryVersion: ECONOMY_ADAPTER_REGISTRY_VERSION,
    adapterVersion: descriptor.adapterVersion,
    args: adapter.args,
    ...(adapter.cash === undefined ? {} : { cash: adapter.cash }),
  };
}

function canonicalAdapterArgument(argument) {
  if (argument.type === 'enum') {
    return {
      type: argument.type,
      values: [...argument.values].sort(compareCanonicalText),
    };
  }
  if (argument.type === 'positiveInteger') {
    return { type: argument.type, maximum: argument.maximum };
  }
  return { type: argument.type };
}

function canonicalAdapterCapability(kind, descriptor) {
  const args = {};
  for (const name of Object.keys(descriptor.args).sort(compareCanonicalText)) {
    args[name] = canonicalAdapterArgument(descriptor.args[name]);
  }
  return {
    kind,
    adapterVersion: descriptor.adapterVersion,
    profiles: [...descriptor.profiles].sort(compareCanonicalText),
    authorityProfiles: [...descriptor.authorityProfiles].sort(compareCanonicalText),
    nodeKinds: [...descriptor.nodeKinds].sort(compareCanonicalText),
    transactionClass: descriptor.transactionClass,
    lockClasses: [...descriptor.lockClasses].sort(compareCanonicalText),
    replayPolicy: descriptor.replayPolicy,
    visibilityPolicy: descriptor.visibilityPolicy,
    valueClass: descriptor.valueClass,
    reportClass: descriptor.reportClass,
    issuancePolicy: descriptor.issuancePolicy,
    sourceCapIdentity: descriptor.sourceCapIdentity,
    usagePolicy: descriptor.usagePolicy,
    args,
    cash: descriptor.cash,
  };
}

export function economyAdapterRegistryLock(nodes) {
  const kinds = [...new Set(nodes.map((node) => node.adapter?.kind).filter(Boolean))]
    .sort(compareCanonicalText);
  return {
    registryId: 'phase2_economy',
    registryVersion: ECONOMY_ADAPTER_REGISTRY_VERSION,
    adapters: kinds.map((kind) => {
      const descriptor = lookupEconomyAdapterDescriptor(kind);
      if (!descriptor) unknownAdapter(kind);
      return canonicalAdapterCapability(kind, descriptor);
    }),
  };
}

export function economyAdapterDescriptor(kind) {
  return lookupEconomyAdapterDescriptor(kind);
}

function normalizeNode(value, index, ownerPackageId, profile, authorityProfile, limits, raise) {
  const path = `$.nodes[${index}]`;
  assertFields(value, NODE_FIELDS, path, raise);
  const local = localId(value.id, `${path}.id`, raise);
  if (!NODE_KINDS.has(value.kind)) {
    raise('content_schema_invalid', `${path}.kind is not a Phase 2 node kind`, `${path}.kind`);
  }
  const refs = value.refs === undefined ? [] : assertArray(value.refs, `${path}.refs`, raise);
  if (refs.length > limits.maxReferencesPerNode) {
    raise('content_input_limit', `${path}.refs exceeds the reference limit`, `${path}.refs`, {
      limitKind: 'references', expected: limits.maxReferencesPerNode, actual: refs.length,
    });
  }
  const normalizedRefs = refs.map((ref, refIndex) => (
    qualify(ref, ownerPackageId, `${path}.refs[${refIndex}]`, raise)
  )).sort(compareCanonicalText);
  for (let refIndex = 1; refIndex < normalizedRefs.length; refIndex += 1) {
    if (normalizedRefs[refIndex] === normalizedRefs[refIndex - 1]) {
      raise('content_schema_invalid', `${path}.refs contains a duplicate`, `${path}.refs`);
    }
  }
  const normalized = {
    id: `${ownerPackageId}::${local}`,
    localId: local,
    kind: value.kind,
    refs: normalizedRefs,
    public: value.public === true,
  };
  if (value.public !== undefined && typeof value.public !== 'boolean') {
    raise('content_schema_invalid', `${path}.public must be boolean`, `${path}.public`);
  }
  if (value.adapter !== undefined) {
    normalized.adapter = normalizeAdapter(
      value.adapter,
      `${path}.adapter`,
      ownerPackageId,
      value.kind,
      profile,
      authorityProfile,
      raise,
    );
  }
  if (['source', 'sink', 'use', 'recipe'].includes(value.kind) && normalized.adapter === undefined) {
    raise('content_schema_invalid', `${path}.adapter is required for a value-bearing node`, `${path}.adapter`);
  }
  if (value.metadata !== undefined) normalized.metadata = normalizeMetadata(value.metadata, `${path}.metadata`, raise);
  return normalized;
}

function normalizeEdge(value, index, ownerPackageId, limits, raise) {
  const path = `$.edges[${index}]`;
  assertFields(value, EDGE_FIELDS, path, raise);
  if (!EDGE_KINDS.has(value.kind)) {
    raise('content_schema_invalid', `${path}.kind is not a Phase 2 dependency class`, `${path}.kind`);
  }
  const normalized = {
    from: qualify(value.from, ownerPackageId, `${path}.from`, raise),
    to: qualify(value.to, ownerPackageId, `${path}.to`, raise),
    kind: value.kind,
  };
  if (value.quantity !== undefined) {
    normalized.quantity = safePositiveInteger(value.quantity, `${path}.quantity`, raise);
    if (normalized.quantity > limits.maxValueQuantity) {
      raise('content_input_limit', `${path}.quantity exceeds the value limit`, `${path}.quantity`, {
        limitKind: 'valueQuantity', expected: limits.maxValueQuantity, actual: normalized.quantity,
      });
    }
  }
  return normalized;
}

function normalizeDependency(value, index, raise) {
  const path = `$.dependencies[${index}]`;
  assertFields(value, DEPENDENCY_FIELDS, path, raise);
  if (value.bundleHash === undefined) {
    raise('content_dependency_unresolved', `${path} is floating`, path, { reason: 'floating' });
  }
  return {
    packageId: packageId(value.packageId, `${path}.packageId`, raise),
    version: safePositiveInteger(value.version, `${path}.version`, raise),
    bundleHash: exactHash(value.bundleHash, `${path}.bundleHash`, raise),
  };
}

function normalizeImport(value, index, raise) {
  const path = `$.imports[${index}]`;
  assertFields(value, IMPORT_FIELDS, path, raise);
  return {
    id: qualifiedId(value.id, `${path}.id`, raise),
    definitionHash: exactHash(value.definitionHash, `${path}.definitionHash`, raise),
    dependencyBundleHash: exactHash(value.dependencyBundleHash, `${path}.dependencyBundleHash`, raise),
  };
}

export function normalizeEconomyPackage({ source, authorityProfile, raise }) {
  try { canonicalBytes(source); }
  catch (error) { raise('content_schema_invalid', error.message, '$'); }
  rejectOmrAuthority(source, raise);
  assertFields(source, ROOT_FIELDS, '$', raise);

  const id = packageId(source.packageId, '$.packageId', raise);
  const version = safePositiveInteger(source.version, '$.version', raise);
  if (!['production', 'fixture'].includes(authorityProfile)) {
    raise('content_profile_invalid', 'descriptor authority is unknown', '$.authorityProfile');
  }
  if (!['library', 'experience'].includes(source.kind)) {
    raise('content_profile_invalid', 'authored package kind must be library or experience', '$.kind');
  }
  if (!PRODUCTION_PROFILE_REGISTRY.includes(source.profile)) {
    raise('content_profile_invalid', 'package profile is outside the closed production registry', '$.profile');
  }
  if (source.profile !== 'phase2_economy') {
    raise('content_profile_invalid', 'phase3_mystery compilation is not implemented in Phase 2A', '$.profile');
  }
  const limits = authorityProfile === 'fixture' ? PHASE2_FIXTURE_LIMITS : PHASE2_LIMITS;
  const definitionsInput = source.definitions ?? [];
  const nodesInput = source.nodes ?? [];
  const edgesInput = source.edges ?? [];
  const exportsInput = source.exports ?? [];
  const dependenciesInput = source.dependencies ?? [];
  const importsInput = source.imports ?? [];
  for (const [value, path] of [[definitionsInput, '$.definitions'], [nodesInput, '$.nodes'],
    [edgesInput, '$.edges'], [exportsInput, '$.exports'],
    [dependenciesInput, '$.dependencies'], [importsInput, '$.imports']]) {
    assertArray(value, path, raise);
  }
  if (definitionsInput.length + nodesInput.length > limits.maxNodes) {
    raise('content_input_limit', 'package exceeds the node limit', '$.nodes', {
      limitKind: 'nodes', expected: limits.maxNodes, actual: definitionsInput.length + nodesInput.length,
    });
  }
  if (edgesInput.length > limits.maxEdges) {
    raise('content_input_limit', 'package exceeds the edge limit', '$.edges', {
      limitKind: 'edges', expected: limits.maxEdges, actual: edgesInput.length,
    });
  }

  const definitions = definitionsInput.map((value, index) => normalizeDefinition(value, index, id, limits, raise));
  const nodes = nodesInput.map((value, index) => normalizeNode(
    value,
    index,
    id,
    source.profile,
    authorityProfile,
    limits,
    raise,
  ));
  const edges = edgesInput.map((value, index) => normalizeEdge(value, index, id, limits, raise));
  const exports = sortedUniqueStrings(exportsInput, '$.exports', raise, (value, exportPath, fail) => (
    qualify(value, id, exportPath, fail)
  ));
  const definitionIds = new Set(definitions.map((definition) => definition.id));
  for (const exported of exports) {
    if (!definitionIds.has(exported)) {
      raise('content_dependency_unresolved', 'export must name an owned immutable definition', '$.exports');
    }
  }
  const dependencies = dependenciesInput.map((value, index) => normalizeDependency(value, index, raise));
  const imports = importsInput.map((value, index) => normalizeImport(value, index, raise));
  dependencies.sort((left, right) => compareCanonicalText(left.packageId, right.packageId)
    || left.version - right.version || compareCanonicalText(left.bundleHash, right.bundleHash));
  imports.sort((left, right) => compareCanonicalText(left.id, right.id)
    || compareCanonicalText(left.definitionHash, right.definitionHash)
    || compareCanonicalText(left.dependencyBundleHash, right.dependencyBundleHash));
  const dependencyByHash = new Map(dependencies.map((dependency) => [dependency.bundleHash, dependency]));
  for (const imported of imports) {
    const dependency = dependencyByHash.get(imported.dependencyBundleHash);
    if (!dependency || !imported.id.startsWith(`${dependency.packageId}::`)) {
      raise(
        'content_dependency_unresolved',
        'import must belong to one declared exact direct dependency',
        '$.imports',
      );
    }
  }

  const normalized = {
    packageId: id,
    version,
    authoredKind: source.kind,
    kind: authorityProfile === 'fixture' ? 'fixture' : source.kind,
    profile: source.profile,
    authorityProfile,
    activatable: authorityProfile === 'production' && source.kind === 'experience',
    definitions,
    nodes,
    edges,
    exports,
    dependencies,
    imports,
  };
  if (source.metadata !== undefined) normalized.metadata = normalizeMetadata(source.metadata, '$.metadata', raise);
  if (source.kind === 'experience') {
    if (source.entrypoint === undefined) {
      raise('content_schema_invalid', 'experience requires an entrypoint', '$.entrypoint');
    }
    normalized.entrypoint = qualify(source.entrypoint, id, '$.entrypoint', raise);
    const primaryExperiences = nodes.filter((node) => node.kind === 'experience');
    if (primaryExperiences.length !== 1 || primaryExperiences[0].id !== normalized.entrypoint) {
      raise(
        'content_profile_invalid',
        'experience requires exactly one primary experience node whose ID is the entrypoint',
        '$.entrypoint',
      );
    }
  } else if (source.entrypoint !== undefined) {
    raise('content_schema_invalid', 'library cannot declare an entrypoint', '$.entrypoint');
  } else if (nodes.some((node) => node.kind === 'experience')) {
    raise('content_profile_invalid', 'library cannot contain an experience root', '$.nodes');
  }
  return { normalized, limits };
}

export function validateEconomyIrSafety(ir, { authorityProfile, authoredKind, raise }) {
  if (!ownObject(ir) || !Array.isArray(ir.nodes) || !Array.isArray(ir.edges)
      || !Array.isArray(ir.imports) || !ownObject(ir.indexes)) {
    raise('unsupported_content_feature', 'compiled IR shape is invalid', '$.ir');
  }
  const limits = authorityProfile === 'fixture' ? PHASE2_FIXTURE_LIMITS : PHASE2_LIMITS;
  if (ir.nodes.length > limits.maxNodes) {
    raise('content_input_limit', 'compiled IR exceeds node limit', '$.ir.nodes', {
      limitKind: 'nodes', expected: limits.maxNodes, actual: ir.nodes.length,
    });
  }
  if (ir.edges.length > limits.maxEdges) {
    raise('content_input_limit', 'compiled IR exceeds edge limit', '$.ir.edges', {
      limitKind: 'edges', expected: limits.maxEdges, actual: ir.edges.length,
    });
  }
  try { canonicalBytes(ir); }
  catch (error) { raise('unsupported_content_feature', error.message, '$.ir'); }
  rejectOmrAuthority(ir, raise);
  assertFields(ir, new Set([
    'formatVersion', 'irVersion', 'profile', 'packageId', 'packageVersion', 'kind',
    'adapterRegistryVersion', 'adapterRegistry', 'nodes', 'edges', 'imports', 'exports', 'indexes', 'entrypoint',
  ]), '$.ir', raise);
  packageId(ir.packageId, '$.ir.packageId', raise);
  safePositiveInteger(ir.packageVersion, '$.ir.packageVersion', raise);
  if (ir.profile !== 'phase2_economy') {
    raise('content_profile_invalid', 'compiled IR profile is invalid', '$.ir.profile');
  }
  if (!['library', 'experience', 'fixture'].includes(ir.kind)) {
    raise('content_profile_invalid', 'compiled IR kind is invalid', '$.ir.kind');
  }
  if (ir.adapterRegistryVersion !== ECONOMY_ADAPTER_REGISTRY_VERSION) {
    raise('content_profile_invalid', 'compiled IR adapter registry version is not supported', '$.ir.adapterRegistryVersion');
  }
  const expectedRegistry = economyAdapterRegistryLock(ir.nodes);
  if (!canonicalBytes(ir.adapterRegistry).equals(canonicalBytes(expectedRegistry))) {
    raise('content_artifact_mismatch', 'compiled IR adapter capabilities do not match the server registry', '$.ir.adapterRegistry');
  }
  assertArray(ir.nodes, '$.ir.nodes', raise);
  assertArray(ir.edges, '$.ir.edges', raise);
  assertArray(ir.imports, '$.ir.imports', raise);
  assertArray(ir.exports, '$.ir.exports', raise);
  assertFields(ir.indexes, new Set(['incoming', 'outgoing']), '$.ir.indexes', raise);
  assertArray(ir.indexes.incoming, '$.ir.indexes.incoming', raise);
  assertArray(ir.indexes.outgoing, '$.ir.indexes.outgoing', raise);

  const definitionFields = new Set([
    'id', 'nodeClass', 'kind', 'definitionVersion', 'definitionHash', 'semantic', 'ordinal',
  ]);
  const graphFields = new Set([
    'id', 'nodeClass', 'kind', 'refs', 'public', 'adapter', 'metadata', 'ordinal',
  ]);
  const importFields = new Set([
    'id', 'nodeClass', 'kind', 'definitionVersion', 'definitionHash', 'semantic',
    'dependencyBundleHash', 'dependencyEconomyErrors', 'ordinal',
  ]);
  for (let index = 0; index < ir.nodes.length; index += 1) {
    const node = ir.nodes[index];
    const path = `$.ir.nodes[${index}]`;
    if (node?.nodeClass === 'definition') {
      assertFields(node, definitionFields, path, raise);
      const prefix = `${ir.packageId}::`;
      if (typeof node.id !== 'string' || !node.id.startsWith(prefix)) {
        raise('content_schema_invalid', `${path}.id is not owned by the compiled package`, `${path}.id`);
      }
      const normalized = normalizeDefinition({
        ...node.semantic,
        id: node.id.slice(prefix.length),
        definitionVersion: node.definitionVersion,
      }, index, ir.packageId, limits, raise);
      const expectedSemantic = Object.fromEntries(Object.entries(normalized)
        .filter(([key]) => !['id', 'localId', 'definitionVersion'].includes(key)));
      if (!canonicalBytes(expectedSemantic).equals(canonicalBytes(node.semantic))) {
        raise('content_schema_invalid', `${path}.semantic is not a normalized definition`, `${path}.semantic`);
      }
    } else if (node?.nodeClass === 'graph') {
      assertFields(node, graphFields, path, raise);
      if (!NODE_KINDS.has(node.kind)) {
        raise('content_schema_invalid', `${path}.kind is unknown`, `${path}.kind`);
      }
      qualifiedId(node.id, `${path}.id`, raise);
      if (!Array.isArray(node.refs) || node.refs.length > limits.maxReferencesPerNode) {
        raise('content_input_limit', `${path}.refs exceeds the reference limit`, `${path}.refs`, {
          limitKind: 'references', expected: limits.maxReferencesPerNode,
          actual: Array.isArray(node.refs) ? node.refs.length : 0,
        });
      }
      for (let refIndex = 0; refIndex < node.refs.length; refIndex += 1) {
        qualifiedId(node.refs[refIndex], `${path}.refs[${refIndex}]`, raise);
      }
      if (typeof node.public !== 'boolean') {
        raise('content_schema_invalid', `${path}.public must be boolean`, `${path}.public`);
      }
      if (node.adapter !== undefined) {
        const expectedAdapter = normalizeAdapter(
          node.adapter,
          `${path}.adapter`,
          ir.packageId,
          node.kind,
          ir.profile,
          authorityProfile,
          raise,
          { compiled: true },
        );
        if (!canonicalBytes(expectedAdapter).equals(canonicalBytes(node.adapter))) {
          raise('content_schema_invalid', `${path}.adapter is not normalized`, `${path}.adapter`);
        }
      }
      if (['source', 'sink', 'use', 'recipe'].includes(node.kind) && node.adapter === undefined) {
        raise('content_schema_invalid', `${path}.adapter is required for a value-bearing node`, `${path}.adapter`);
      }
      if (node.metadata !== undefined) normalizeMetadata(node.metadata, `${path}.metadata`, raise);
    } else if (node?.nodeClass === 'import') {
      assertFields(node, importFields, path, raise);
      qualifiedId(node.id, `${path}.id`, raise);
      if (!DEFINITION_KINDS.has(node.kind) || !Number.isSafeInteger(node.definitionVersion)
          || node.definitionVersion <= 0 || typeof node.definitionHash !== 'string'
          || !SHA256.test(node.definitionHash) || typeof node.dependencyBundleHash !== 'string'
          || !SHA256.test(node.dependencyBundleHash) || !ownObject(node.semantic)
          || !Array.isArray(node.dependencyEconomyErrors)) {
        raise('content_schema_invalid', `${path} is not an exact imported definition`, path);
      }
      const separator = node.id.indexOf('::');
      const ownerPackageId = node.id.slice(0, separator);
      const importedLocalId = node.id.slice(separator + 2);
      const normalized = normalizeDefinition({
        ...node.semantic,
        id: importedLocalId,
        definitionVersion: node.definitionVersion,
      }, index, ownerPackageId, limits, raise);
      const expectedSemantic = Object.fromEntries(Object.entries(normalized)
        .filter(([key]) => !['id', 'localId', 'definitionVersion'].includes(key)));
      if (!canonicalBytes(expectedSemantic).equals(canonicalBytes(node.semantic))) {
        raise('content_schema_invalid', `${path}.semantic is not a normalized imported definition`, `${path}.semantic`);
      }
      for (const dependencyError of node.dependencyEconomyErrors) {
        if (!ownObject(dependencyError) || typeof dependencyError.code !== 'string') {
          raise('content_schema_invalid', `${path}.dependencyEconomyErrors is invalid`, path);
        }
      }
    } else {
      raise('content_schema_invalid', `${path}.nodeClass is unknown`, `${path}.nodeClass`);
    }
    safeNonnegativeInteger(node.ordinal, `${path}.ordinal`, raise);
  }
  for (let index = 0; index < ir.edges.length; index += 1) {
    const edge = ir.edges[index];
    const path = `$.ir.edges[${index}]`;
    assertFields(edge, new Set(['from', 'to', 'kind', 'quantity', 'ordinal']), path, raise);
    qualifiedId(edge.from, `${path}.from`, raise);
    qualifiedId(edge.to, `${path}.to`, raise);
    if (!EDGE_KINDS.has(edge.kind)) raise('content_schema_invalid', `${path}.kind is unknown`, `${path}.kind`);
    if (edge.quantity !== undefined) {
      const quantity = safePositiveInteger(edge.quantity, `${path}.quantity`, raise);
      if (quantity > limits.maxValueQuantity) {
        raise('content_input_limit', `${path}.quantity exceeds the value limit`, `${path}.quantity`, {
          limitKind: 'valueQuantity', expected: limits.maxValueQuantity, actual: quantity,
        });
      }
    }
    safeNonnegativeInteger(edge.ordinal, `${path}.ordinal`, raise);
  }
  for (let index = 0; index < ir.imports.length; index += 1) {
    normalizeImport(ir.imports[index], index, raise);
  }
  const irNodeById = new Map(ir.nodes.map((node) => [node.id, node]));
  for (let index = 0; index < ir.exports.length; index += 1) {
    const exported = qualifiedId(ir.exports[index], `$.ir.exports[${index}]`, raise);
    const node = irNodeById.get(exported);
    if (!node || node.nodeClass !== 'definition'
        || !Number.isSafeInteger(node.definitionVersion) || node.definitionVersion <= 0
        || typeof node.definitionHash !== 'string' || !SHA256.test(node.definitionHash)) {
      raise(
        'content_dependency_unresolved',
        'compiled export must name an owned exact immutable definition',
        `$.ir.exports[${index}]`,
      );
    }
  }
  if (ir.entrypoint !== undefined) qualifiedId(ir.entrypoint, '$.ir.entrypoint', raise);
  const primaryExperiences = ir.nodes.filter((node) => node.nodeClass === 'graph' && node.kind === 'experience');
  if (authoredKind === 'experience') {
    if (primaryExperiences.length !== 1 || primaryExperiences[0].id !== ir.entrypoint) {
      raise('content_profile_invalid', 'compiled experience primary root is invalid', '$.ir.entrypoint');
    }
  } else if (authoredKind === 'library' && (primaryExperiences.length > 0 || ir.entrypoint !== undefined)) {
    raise('content_profile_invalid', 'compiled library cannot contain an experience root', '$.ir');
  }
  return limits;
}
