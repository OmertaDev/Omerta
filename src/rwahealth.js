import {
  encodeAbiParameters, getAddress, keccak256, stringToHex, toBytes,
} from 'viem';
import { RwaHealthError } from './rwahealtherror.js';

export { RwaHealthError } from './rwahealtherror.js';

const ENDPOINT = 'https://api.robinhood.com/rhj/assets';
const MAX_BODY = 2_000_000;
const MAX_DEPTH = 32;
const MAX_NODES = 65_536;
const MAX_KEY_BYTES = 128;
const MAX_STRING_BYTES = 4_096;
const ZERO_HASH = `0x${'00'.repeat(32)}`;
const PREDICATE_CODES = Object.freeze([
  'provider_record', 'supported_chain', 'ticker_identity', 'token_identity',
  'token_decimals', 'provider_active', 'fractional_tradable',
]);
const RESULT_NAMES = Object.freeze(['pass', 'unknown', 'verified_failure']);
const KIND_NAMES = Object.freeze(['healthy', 'health_unknown', 'operational_quarantine']);
const textEncoder = new TextEncoder();

const tag = (value) => keccak256(toBytes(value));
export const RWA_HEALTH_RULE_SET_HASH = keccak256(encodeAbiParameters([
  { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' },
  { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' },
  { type: 'uint8' }, { type: 'uint8' }, { type: 'uint8' },
], [
  tag('RWA_HEALTH_RHJ_ASSET_IDENTITY_V2'), ...PREDICATE_CODES.map(tag), 0, 1, 2,
]));
export const RWA_HEALTH_PROVIDER_ENDPOINT_HASH = keccak256(toBytes(ENDPOINT));

function fail(code, message) { throw new RwaHealthError(code, message); }
function withProviderFailure(error, providerFailureCode) {
  Object.defineProperty(error, 'providerFailureCode', {
    value: providerFailureCode, enumerable: false, configurable: false, writable: false,
  });
  return error;
}
function providerFail(code, providerFailureCode) {
  throw withProviderFailure(new RwaHealthError(code), providerFailureCode);
}
function providerSyntax(providerFailureCode, message) {
  return withProviderFailure(new SyntaxError(message), providerFailureCode);
}
function hashUtf8(value) { return keccak256(stringToHex(String(value))); }
function abi(types, values) {
  return keccak256(encodeAbiParameters(types.map((type) => ({ type })), values));
}
function bytes32(value) { return typeof value === 'string' && /^0x[0-9a-f]{64}$/.test(value); }
function address(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) return null;
  try { return getAddress(value).toLowerCase(); } catch { return null; }
}
function canonicalUint(value, max) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) return null;
  const parsed = BigInt(value);
  return parsed <= max ? parsed : null;
}
function deepFreeze(value) {
  if (ArrayBuffer.isView(value)) return value;
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

class RawNumber {
  constructor(raw) { this.raw = raw; }
}

class BoundedJsonParser {
  constructor(input) {
    this.input = input;
    this.index = 0;
    this.nodes = 0;
  }

  error(message) { throw providerSyntax('provider_json', `malformed JSON: ${message}`); }
  bump() { this.nodes += 1; if (this.nodes > MAX_NODES) this.error('node limit'); }
  skip() { while (/\s/.test(this.input[this.index] || '')) this.index += 1; }

  parse() {
    const value = this.value(0);
    this.skip();
    if (this.index !== this.input.length) this.error('trailing content');
    return value;
  }

  value(depth) {
    if (depth > MAX_DEPTH) this.error('depth limit');
    this.skip(); this.bump();
    const ch = this.input[this.index];
    if (ch === '{') return this.object(depth + 1);
    if (ch === '[') return this.array(depth + 1);
    if (ch === '"') return this.string(MAX_STRING_BYTES, 'string');
    for (const [literal, value] of [['true', true], ['false', false], ['null', null]]) {
      if (this.input.startsWith(literal, this.index)) { this.index += literal.length; return value; }
    }
    return this.number();
  }

  object(depth) {
    this.index += 1;
    const out = Object.create(null);
    const seen = new Set();
    this.skip();
    if (this.input[this.index] === '}') { this.index += 1; return out; }
    while (true) {
      this.skip();
      if (this.input[this.index] !== '"') this.error('object key');
      const key = this.string(MAX_KEY_BYTES, 'key');
      if (seen.has(key)) this.error('duplicate key');
      seen.add(key);
      this.skip();
      if (this.input[this.index++] !== ':') this.error('missing colon');
      out[key] = this.value(depth);
      this.skip();
      const delimiter = this.input[this.index++];
      if (delimiter === '}') return out;
      if (delimiter !== ',') this.error('object delimiter');
    }
  }

  array(depth) {
    this.index += 1;
    const out = [];
    this.skip();
    if (this.input[this.index] === ']') { this.index += 1; return out; }
    while (true) {
      out.push(this.value(depth));
      this.skip();
      const delimiter = this.input[this.index++];
      if (delimiter === ']') return out;
      if (delimiter !== ',') this.error('array delimiter');
    }
  }

  string(limit, kind) {
    const start = this.index;
    this.index += 1;
    let escaped = false;
    while (this.index < this.input.length) {
      const ch = this.input[this.index++];
      if (!escaped && ch === '"') {
        const raw = this.input.slice(start, this.index);
        let decoded;
        try { decoded = JSON.parse(raw); } catch { this.error(kind); }
        if (textEncoder.encode(decoded).length > limit) this.error(`${kind} limit`);
        return decoded;
      }
      if (!escaped && ch.charCodeAt(0) < 0x20) this.error(kind);
      if (!escaped && ch === '\\') escaped = true;
      else escaped = false;
    }
    this.error(`unterminated ${kind}`);
  }

  number() {
    const rest = this.input.slice(this.index);
    // Preserve the exact spelling of a syntactically valid JSON number. Domain
    // reducers decide whether that spelling is the required canonical integer;
    // extensions such as a leading plus or a leading zero are not JSON at all.
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+\-]?[0-9]+)?/.exec(rest);
    if (!match) this.error('value');
    this.index += match[0].length;
    return new RawNumber(match[0]);
  }
}

export function parseRwaHealthProviderBody(input) {
  if (!(input instanceof Uint8Array) || input.byteLength > MAX_BODY) {
    throw new TypeError('malformed provider bytes');
  }
  let source;
  try { source = new TextDecoder('utf-8', { fatal: true }).decode(input); }
  catch { throw providerSyntax('provider_utf8', 'invalid UTF-8 provider body'); }
  const parsed = new BoundedJsonParser(source).parse();
  if (!parsed || Object.getPrototypeOf(parsed) !== null || !Array.isArray(parsed.assets)
      || parsed.assets.length > 2_048) {
    throw providerSyntax('provider_shape', 'malformed provider shape');
  }

  const ids = new Set();
  const tickers = new Set();
  const tokens = new Set();
  for (const item of parsed.assets) {
    if (!item || Object.getPrototypeOf(item) !== null) {
      throw providerSyntax('provider_shape', 'malformed asset');
    }
    if (typeof item.id !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(item.id)) {
      throw providerSyntax('provider_identity_malformed', 'malformed provider identity');
    }
    const id = item.id.toLowerCase();
    if (ids.has(id)) {
      throw providerSyntax('provider_identity_duplicate', 'duplicate provider identity');
    }
    ids.add(id);
    if (typeof item.tokenSymbol === 'string') {
      const ticker = normalizeTicker(item.tokenSymbol);
      if (ticker) {
        if (tickers.has(ticker)) {
          throw providerSyntax('provider_identity_duplicate', 'ambiguous duplicate ticker');
        }
        tickers.add(ticker);
      }
    }
    if (item.deployments !== undefined) {
      if (!Array.isArray(item.deployments)) {
        throw providerSyntax('provider_shape', 'malformed deployments');
      }
      let selected = 0;
      for (const deployment of item.deployments) {
        if (!deployment || Object.getPrototypeOf(deployment) !== null
            || !(deployment.chainId instanceof RawNumber)
            || !/^(0|[1-9][0-9]*)$/.test(deployment.chainId.raw)
            || BigInt(deployment.chainId.raw) >= 2n ** 256n
            || !address(deployment.contractAddress)) {
          throw providerSyntax('provider_shape', 'malformed deployment');
        }
        if (deployment.chainId.raw === '4663') {
          selected += 1;
          const token = address(deployment.contractAddress);
          if (tokens.has(token)) {
            throw providerSyntax('provider_identity_duplicate', 'malformed ambiguous duplicate token');
          }
          tokens.add(token);
        }
      }
      if (selected > 1) throw providerSyntax('provider_shape', 'conflicting chain deployment');
    }
  }
  Object.defineProperty(parsed, '__rawBody', {
    value: source, enumerable: false, configurable: false, writable: false,
  });
  return parsed;
}

function normalizeTicker(value) {
  if (typeof value !== 'string') return null;
  const ticker = value.trim().toUpperCase();
  return /^[A-Z0-9._-]{1,24}$/.test(ticker) ? ticker : null;
}

function rawUint8(value) {
  return value instanceof RawNumber && /^(0|[1-9][0-9]*)$/.test(value.raw)
    && BigInt(value.raw) <= 255n ? Number(value.raw) : null;
}

function classifyRecord(item) {
  const providerId = typeof item.id === 'string' && /^0x[0-9a-fA-F]{64}$/.test(item.id)
    ? { kind: 'exact', value: item.id } : { kind: item.id === undefined ? 'absent' : 'malformed' };
  const ticker = normalizeTicker(item.tokenSymbol);
  const deployments = item.deployments;
  let chain = { kind: 'malformed' };
  if (Array.isArray(deployments)) {
    const selected = deployments.filter((entry) => entry.chainId.raw === '4663');
    chain = selected.length === 0 ? { kind: 'absent' }
      : selected.length > 1 ? { kind: 'conflicting' }
        : { kind: 'exact', value: address(selected[0].contractAddress) };
  }
  let status = 'malformed';
  if (item.status === undefined) status = 'absent';
  else if (typeof item.status === 'string') {
    status = item.status === 'ASSET_STATUS_ACTIVE' ? 'active'
      : item.status === 'ASSET_STATUS_INACTIVE' ? 'inactive' : 'unrecognized';
  }
  const capabilities = item.tradingCapabilities;
  let fractional = 'malformed';
  if (capabilities === undefined) fractional = 'absent';
  else if (capabilities && Object.getPrototypeOf(capabilities) === null) {
    const a = capabilities.fractionalTradability;
    const marketPresent = capabilities.market !== undefined;
    const marketValid = !marketPresent
      || (capabilities.market && Object.getPrototypeOf(capabilities.market) === null);
    const b = marketValid && marketPresent ? capabilities.market.fractional : undefined;
    const map = (value, enabled, disabled) => value === undefined ? null
      : typeof value !== 'string' ? 'malformed'
        : value === enabled ? 'enabled' : value === disabled ? 'disabled' : 'unrecognized';
    const aa = map(a, 'tradable', 'untradable');
    const bb = map(b, 'TRADING_STATUS_TRADABLE', 'TRADING_STATUS_UNTRADABLE');
    fractional = !marketValid || aa === 'malformed' || bb === 'malformed'
      ? 'malformed' : aa && bb && aa !== bb ? 'malformed' : (aa || bb || 'absent');
  }
  return {
    providerId,
    ticker: ticker ? { kind: 'exact', value: ticker }
      : { kind: item.tokenSymbol === undefined ? 'absent' : 'malformed' },
    chain,
    status,
    fractional,
    decimals: rawUint8(item.tokenDecimals),
    decimalsKind: item.tokenDecimals === undefined ? 'absent' : rawUint8(item.tokenDecimals) === null ? 'malformed' : 'exact',
  };
}

function fixedIdentity(input) {
  return abi(
    ['bytes32', 'uint256', 'address', 'bytes32', 'bytes32', 'address', 'uint8', 'bytes32', 'uint256', 'bytes32'],
    [tag('OMERTA_RWA_HEALTH_EXPECTED_IDENTITY_V2'), 4663n, input.registryAddress,
      input.assetVersionKey, hashUtf8(input.normalizedTicker), input.tokenAddress,
      input.tokenDecimals, input.robinhoodAssetIdHash, BigInt(input.catalogVersion),
      input.catalogSnapshotHash],
  );
}

function orderedHash(values) {
  return keccak256(encodeAbiParameters([{ type: 'bytes32[]' }], [values]));
}

function validateExpectedIdentity(input) {
  if (!input || input.chainId !== '4663'
      || address(input.registryAddress) !== input.registryAddress
      || canonicalUint(input.catalogVersion, 2n ** 256n - 1n) === null
      || !bytes32(input.catalogSnapshotHash) || input.catalogSnapshotHash === ZERO_HASH
      || !bytes32(input.assetVersionKey) || input.assetVersionKey === ZERO_HASH
      || normalizeTicker(input.normalizedTicker) !== input.normalizedTicker
      || address(input.tokenAddress) !== input.tokenAddress
      || !Number.isInteger(input.tokenDecimals) || input.tokenDecimals < 0 || input.tokenDecimals > 255
      || !bytes32(input.robinhoodAssetIdHash) || input.robinhoodAssetIdHash === ZERO_HASH) {
    throw new TypeError('invalid expected health identity');
  }
}

export function deriveRwaExpectedIdentityHash(input) {
  validateExpectedIdentity(input);
  return fixedIdentity(input);
}

export function deriveRwaActiveSetHash(expectedIdentityHashes) {
  if (!Array.isArray(expectedIdentityHashes) || expectedIdentityHashes.length > 2_048
      || expectedIdentityHashes.some((value) => !bytes32(value) || value === ZERO_HASH)
      || new Set(expectedIdentityHashes).size !== expectedIdentityHashes.length) {
    throw new TypeError('invalid ordered active identity set');
  }
  return abi(['bytes32', 'uint16', 'bytes32'], [
    tag('OMERTA_RWA_HEALTH_ACTIVE_SET_V2'), expectedIdentityHashes.length,
    orderedHash(expectedIdentityHashes),
  ]);
}

export function deriveRwaBatchId({
  registryAddress, catalogVersion, catalogSnapshotHash, activeSetHash,
  cycleSlot, providerCommitment,
}) {
  if (address(registryAddress) !== registryAddress
      || canonicalUint(catalogVersion, 2n ** 256n - 1n) === null
      || !bytes32(catalogSnapshotHash) || !bytes32(activeSetHash)
      || canonicalUint(cycleSlot, 2n ** 256n - 1n) === null
      || !bytes32(providerCommitment)) throw new TypeError('invalid health batch identity');
  return abi(
    ['bytes32', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256', 'bytes32', 'bytes32', 'bytes32'],
    [tag('OMERTA_RWA_HEALTH_BATCH_V2'), 4663n, registryAddress, BigInt(catalogVersion),
      catalogSnapshotHash, activeSetHash, BigInt(cycleSlot), RWA_HEALTH_RULE_SET_HASH,
      RWA_HEALTH_PROVIDER_ENDPOINT_HASH, providerCommitment],
  );
}

export function deriveRwaPageId({
  batchId, pageIndex, firstAssetVersionKey, lastAssetVersionKey, itemCount,
}) {
  if (!bytes32(batchId) || !Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex > 7
      || !bytes32(firstAssetVersionKey) || !bytes32(lastAssetVersionKey)
      || firstAssetVersionKey > lastAssetVersionKey || !Number.isInteger(itemCount)
      || itemCount < 1 || itemCount > 256) throw new TypeError('invalid health page identity');
  return abi(['bytes32', 'bytes32', 'uint8', 'bytes32', 'bytes32', 'uint16'], [
    tag('OMERTA_RWA_HEALTH_PAGE_V2'), batchId, pageIndex,
    firstAssetVersionKey, lastAssetVersionKey, itemCount,
  ]);
}

export function deriveRwaEvaluationIds({
  batchId, pageId, identity, predicateValues, evaluationKind, providerCommitment,
}) {
  validateExpectedIdentity(identity);
  if (!bytes32(batchId) || !bytes32(pageId) || !bytes32(providerCommitment)
      || !Array.isArray(predicateValues) || predicateValues.length !== 7
      || predicateValues.some((value) => !Number.isInteger(value) || value < 0 || value > 2)
      || !Number.isInteger(evaluationKind) || evaluationKind < 0 || evaluationKind > 2) {
    throw new TypeError('invalid health evaluation identity');
  }
  const winning = predicateValues.includes(2) ? 2 : predicateValues.includes(1) ? 1 : 0;
  if (winning !== evaluationKind) throw new TypeError('evaluation kind conflicts with predicates');
  const expectedIdentityHash = fixedIdentity(identity);
  const predicateCommitment = abi(
    ['bytes32', ...Array(7).fill('uint8')],
    [tag('OMERTA_RWA_HEALTH_PREDICATES_V2'), ...predicateValues],
  );
  const evidenceHash = abi(
    ['bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32'],
    [tag('OMERTA_RWA_HEALTH_EVIDENCE_V2'), batchId, pageId, identity.assetVersionKey,
      expectedIdentityHash, predicateCommitment, providerCommitment],
  );
  const evaluationId = abi(
    ['bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'uint8', 'bytes32'],
    [tag('OMERTA_RWA_HEALTH_EVALUATION_V2'), batchId, pageId, identity.assetVersionKey,
      expectedIdentityHash, predicateCommitment, evaluationKind, evidenceHash],
  );
  return deepFreeze({ expectedIdentityHash, predicateCommitment, evidenceHash, evaluationId });
}

export function deriveRwaEpisodeId({ registryAddress, assetVersionKey, generation }) {
  if (address(registryAddress) !== registryAddress || !bytes32(assetVersionKey)
      || canonicalUint(generation, 2n ** 256n - 1n) === null || generation === '0') {
    throw new TypeError('invalid health episode identity');
  }
  return abi(['bytes32', 'uint256', 'address', 'bytes32', 'uint256'], [
    tag('OMERTA_RWA_HEALTH_EPISODE_V2'), 4663n, registryAddress, assetVersionKey, BigInt(generation),
  ]);
}

export function deriveRwaEpisodeEventId({
  episodeId, eventKind, sourceId, resultingSeverity, evidenceHash,
}) {
  if (!bytes32(episodeId) || !Number.isInteger(eventKind) || eventKind < 0 || eventKind > 4
      || !bytes32(sourceId) || !Number.isInteger(resultingSeverity)
      || resultingSeverity < 0 || resultingSeverity > 2 || !bytes32(evidenceHash)
      || evidenceHash === ZERO_HASH) throw new TypeError('invalid health episode event identity');
  return abi(['bytes32', 'bytes32', 'uint8', 'bytes32', 'uint8', 'bytes32'], [
    tag('OMERTA_RWA_HEALTH_EPISODE_EVENT_V2'), episodeId, eventKind,
    sourceId, resultingSeverity, evidenceHash,
  ]);
}

function deriveStrict(input) {
  if (input.chainId !== '4663'
      || address(input.registryAddress) !== input.registryAddress
      || canonicalUint(input.catalogVersion, 2n ** 256n - 1n) === null
      || !bytes32(input.catalogSnapshotHash) || input.catalogSnapshotHash === ZERO_HASH
      || !bytes32(input.assetVersionKey) || input.assetVersionKey === ZERO_HASH
      || normalizeTicker(input.normalizedTicker) !== input.normalizedTicker
      || address(input.tokenAddress) !== input.tokenAddress
      || !Number.isInteger(input.tokenDecimals) || input.tokenDecimals < 0 || input.tokenDecimals > 255
      || !bytes32(input.robinhoodAssetIdHash) || input.robinhoodAssetIdHash === ZERO_HASH
      || canonicalUint(input.cycleSlot, 2n ** 256n - 1n) === null
      || !Number.isInteger(input.pageIndex) || input.pageIndex < 0 || input.pageIndex > 7
      || !bytes32(input.firstAssetVersionKey) || !bytes32(input.lastAssetVersionKey)
      || input.firstAssetVersionKey > input.lastAssetVersionKey
      || !Number.isInteger(input.itemCount) || input.itemCount < 1 || input.itemCount > 256
      || !Array.isArray(input.predicates) || input.predicates.length !== 7
      || input.predicates.some((value) => !Number.isInteger(value) || value < 0 || value > 2)
      || !Number.isInteger(input.evaluationKind) || input.evaluationKind < 0 || input.evaluationKind > 2
      || canonicalUint(input.episodeGeneration, 2n ** 256n - 1n) === null
      || input.episodeGeneration === '0'
      || typeof input.reviewerId !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(input.reviewerId)
      || ![1, 2].includes(input.requestedState)
      || !['reviewer_material_drift', 'reviewer_verification_unknown'].includes(input.ruleCode)
      || !bytes32(input.reasonHash) || input.reasonHash === ZERO_HASH
      || !bytes32(input.reviewerEvidenceHash) || input.reviewerEvidenceHash === ZERO_HASH
      || !Number.isInteger(input.eventKind) || input.eventKind < 0 || input.eventKind > 4
      || !Number.isInteger(input.resultingSeverity) || input.resultingSeverity < 0
      || input.resultingSeverity > 2 || !bytes32(input.sourceId)) {
    throw new TypeError('invalid canonical health identity input');
  }
  const winning = input.predicates.includes(2) ? 2 : input.predicates.includes(1) ? 1 : 0;
  if (input.evaluationKind !== winning) throw new TypeError('evaluation kind conflicts with predicates');
  const providerBodyBytes = typeof input.providerBody === 'string' ? toBytes(input.providerBody) : input.providerBody;
  if (!(providerBodyBytes instanceof Uint8Array) || providerBodyBytes.byteLength > MAX_BODY) {
    throw new TypeError('invalid provider body');
  }
  const providerBodyHash = keccak256(providerBodyBytes);
  if (input.providerBodyHash && input.providerBodyHash !== providerBodyHash) {
    throw new Error('evidence conflict: provider body hash mismatch');
  }
  const expectedIdentityHash = fixedIdentity(input);
  const orderedIdentityListHash = orderedHash([expectedIdentityHash]);
  const activeSetHash = abi(['bytes32', 'uint16', 'bytes32'], [
    tag('OMERTA_RWA_HEALTH_ACTIVE_SET_V2'), 1, orderedIdentityListHash,
  ]);
  const batchId = abi(
    ['bytes32', 'uint256', 'address', 'uint256', 'bytes32', 'bytes32', 'uint256', 'bytes32', 'bytes32', 'bytes32'],
    [tag('OMERTA_RWA_HEALTH_BATCH_V2'), 4663n, input.registryAddress,
      BigInt(input.catalogVersion), input.catalogSnapshotHash, activeSetHash,
      BigInt(input.cycleSlot), RWA_HEALTH_RULE_SET_HASH,
      RWA_HEALTH_PROVIDER_ENDPOINT_HASH, providerBodyHash],
  );
  const pageId = abi(['bytes32', 'bytes32', 'uint8', 'bytes32', 'bytes32', 'uint16'], [
    tag('OMERTA_RWA_HEALTH_PAGE_V2'), batchId, input.pageIndex,
    input.firstAssetVersionKey, input.lastAssetVersionKey, input.itemCount,
  ]);
  const predicateCommitment = abi(
    ['bytes32', ...Array(7).fill('uint8')],
    [tag('OMERTA_RWA_HEALTH_PREDICATES_V2'), ...input.predicates],
  );
  const evidenceHash = abi(
    ['bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32'],
    [tag('OMERTA_RWA_HEALTH_EVIDENCE_V2'), batchId, pageId, input.assetVersionKey,
      expectedIdentityHash, predicateCommitment, providerBodyHash],
  );
  const evaluationId = abi(
    ['bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes32', 'uint8', 'bytes32'],
    [tag('OMERTA_RWA_HEALTH_EVALUATION_V2'), batchId, pageId, input.assetVersionKey,
      expectedIdentityHash, predicateCommitment, input.evaluationKind, evidenceHash],
  );
  const episodeId = abi(['bytes32', 'uint256', 'address', 'bytes32', 'uint256'], [
    tag('OMERTA_RWA_HEALTH_EPISODE_V2'), 4663n, input.registryAddress,
    input.assetVersionKey, BigInt(input.episodeGeneration),
  ]);
  const reviewerActionId = abi(
    ['bytes32', 'uint256', 'address', 'bytes32', 'uint256', 'bytes32', 'uint8', 'bytes32', 'bytes32', 'bytes32'],
    [tag('OMERTA_RWA_HEALTH_REVIEWER_ACTION_V2'), 4663n, input.registryAddress,
      input.assetVersionKey, BigInt(input.episodeGeneration), hashUtf8(input.reviewerId),
      input.requestedState, hashUtf8(input.ruleCode), input.reasonHash, input.reviewerEvidenceHash],
  );
  const episodeEventId = abi(
    ['bytes32', 'bytes32', 'uint8', 'bytes32', 'uint8', 'bytes32'],
    [tag('OMERTA_RWA_HEALTH_EPISODE_EVENT_V2'), episodeId, input.eventKind,
      input.sourceId, input.resultingSeverity, input.reviewerEvidenceHash],
  );
  return {
    ruleSetHash: RWA_HEALTH_RULE_SET_HASH,
    providerEndpointHash: RWA_HEALTH_PROVIDER_ENDPOINT_HASH,
    providerBodyHash, expectedIdentityHash, orderedIdentityListHash, activeSetHash,
    batchId, pageId, predicateCommitment, evidenceHash, evaluationId, episodeId,
    reviewerActionId, episodeEventId,
  };
}

export function deriveRwaHealthIds(input) {
  if (!input || typeof input !== 'object') throw new TypeError('invalid identity input');
  if (input.providerBodyHash && input.providerBody
      && keccak256(toBytes(input.providerBody)) !== input.providerBodyHash) {
    throw new Error('evidence conflict: provider body hash mismatch');
  }
  return deepFreeze(deriveStrict(input));
}

export function evaluateRwaHealthAsset(identity, observation) {
  if (!identity || !observation || !Array.isArray(observation.assets)) throw new TypeError('invalid health evaluation');
  const matching = observation.assets.filter((item) => typeof item.id === 'string'
    && hashUtf8(item.id) === identity.robinhoodAssetIdHash);
  const values = Array(7).fill(1);
  if (matching.length === 1) {
    values[0] = 0;
    const record = classifyRecord(matching[0]);
    values[1] = record.chain.kind === 'exact' ? 0 : record.chain.kind === 'absent' ? 2 : 1;
    values[2] = record.ticker.kind !== 'exact' ? 1
      : record.ticker.value === identity.normalizedTicker ? 0 : 2;
    values[3] = record.chain.kind !== 'exact' ? 1
      : record.chain.value === identity.tokenAddress ? 0 : 2;
    values[4] = record.decimalsKind !== 'exact' ? 1
      : record.decimals === identity.tokenDecimals ? 0 : 2;
    values[5] = record.status === 'active' ? 0 : record.status === 'inactive' ? 2 : 1;
    values[6] = record.fractional === 'enabled' ? 0 : record.fractional === 'disabled' ? 2 : 1;
  }
  const winning = values.includes(2) ? 2 : values.includes(1) ? 1 : 0;
  const predicates = values.map((result, index) => ({ code: PREDICATE_CODES[index], result: RESULT_NAMES[result] }));
  const ruleIndex = values.findIndex((value) => value === winning && winning !== 0);
  return deepFreeze({
    providerBodyHash: keccak256(toBytes(observation.__rawBody)),
    expectedIdentityHash: fixedIdentity(identity),
    predicateCommitment: abi(
      ['bytes32', ...Array(7).fill('uint8')],
      [tag('OMERTA_RWA_HEALTH_PREDICATES_V2'), ...values],
    ),
    predicateValues: Object.freeze([...values]),
    robinhoodAssetIdHash: identity.robinhoodAssetIdHash,
    predicates, evaluationKind: KIND_NAMES[winning],
    ruleCode: ruleIndex === -1 ? null : PREDICATE_CODES[ruleIndex],
  });
}

export async function fetchRwaHealthProvider(fetchFn = globalThis.fetch) {
  if (typeof fetchFn !== 'function') fail('health_bad_input');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  let response;
  try {
    response = await fetchFn(ENDPOINT, {
      redirect: 'error', credentials: 'omit',
      headers: { accept: 'application/json', 'accept-encoding': 'identity' },
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    if (controller.signal.aborted || error?.name === 'AbortError') {
      providerFail('health_provider_timeout', 'provider_timeout');
    }
    providerFail('health_provider_http', 'provider_http');
  }
  try {
    if (response.redirected) providerFail('health_provider_http', 'provider_redirect');
    if (response.status < 200 || response.status > 299) {
      providerFail('health_provider_http', 'provider_http');
    }
    const encoding = response.headers.get('content-encoding');
    if (encoding && encoding !== 'identity') {
      providerFail('health_provider_malformed', 'provider_content_encoding');
    }
    const contentType = response.headers.get('content-type');
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType || '')) {
      providerFail('health_provider_malformed', 'provider_content_type');
    }
    const declaredText = response.headers.get('content-length');
    let declared = null;
    if (declaredText !== null) {
      if (!/^(0|[1-9][0-9]*)$/.test(declaredText)) {
        providerFail('health_provider_malformed', 'provider_shape');
      }
      declared = Number(declaredText);
      if (declared > MAX_BODY) providerFail('health_provider_oversized', 'provider_oversized');
    }
    const reader = response.body?.getReader();
    if (!reader) providerFail('health_provider_malformed', 'provider_shape');
    const chunks = [];
    let total = 0;
    const aborted = new Promise((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(new DOMException('deadline', 'AbortError')),
        { once: true });
    });
    while (true) {
      let chunk;
      try { chunk = await Promise.race([reader.read(), aborted]); }
      catch (error) {
        if (controller.signal.aborted || error?.name === 'AbortError') {
          await reader.cancel().catch(() => {});
          providerFail('health_provider_timeout', 'provider_timeout');
        }
        providerFail('health_provider_http', 'provider_http');
      }
      const { done, value } = chunk;
      if (done) break;
      if (!(value instanceof Uint8Array)) providerFail('health_provider_malformed', 'provider_shape');
      total += value.length;
      if (total > MAX_BODY) {
        await reader.cancel();
        providerFail('health_provider_oversized', 'provider_oversized');
      }
      if (declared !== null && total > declared) {
        await reader.cancel();
        providerFail('health_provider_malformed', 'provider_shape');
      }
      chunks.push(value);
    }
    if (declared !== null && total !== declared) {
      providerFail('health_provider_malformed', 'provider_shape');
    }
    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    return deepFreeze({
      body,
      providerBodyHash: keccak256(body),
      providerEndpointHash: RWA_HEALTH_PROVIDER_ENDPOINT_HASH,
    });
  } finally { clearTimeout(timer); }
}

export function healthDbNowSql(capability) {
  if (!capability || typeof capability.postgres !== 'boolean' || Object.keys(capability).length !== 1) {
    throw new TypeError('invalid database capability');
  }
  return capability.postgres ? "date_trunc('milliseconds',clock_timestamp())" : 'now()';
}
