import crypto from 'node:crypto';

export const GENESIS_AUCTION_TARGET_SECONDS = 72 * 60 * 60;
export const GENESIS_CLAIM_TARGET_SECONDS = 24 * 60 * 60;
export const GENESIS_CADENCE_MIN_SPAN_MS = 3 * 60 * 1000;
export const GENESIS_CADENCE_MIN_SAMPLES = 5;

function integer(label, value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}`);
  }
  return parsed;
}

function uint(label, value) {
  try {
    const parsed = BigInt(value);
    if (parsed < 0n) throw new Error();
    return parsed;
  } catch {
    throw new Error(`${label} must be an unsigned integer`);
  }
}

function isoTimestamp(label, value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be an ISO timestamp`);
  }
  return new Date(value).toISOString();
}

function normalize(value) {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalize(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(normalize(value));
}

export function sha256Hex(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function median(values) {
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2n;
}

function blocksForDuration(seconds, cadenceMicrosPerBlock) {
  const durationMicros = BigInt(seconds) * 1_000_000n;
  return (durationMicros + cadenceMicrosPerBlock - 1n) / cadenceMicrosPerBlock;
}

export function buildGenesisCadenceEvidence(input = {}, {
  minSpanMs = GENESIS_CADENCE_MIN_SPAN_MS,
  minSamples = GENESIS_CADENCE_MIN_SAMPLES,
  requireFinality = true,
} = {}) {
  if (Number(input.chainId) !== 4663) throw new Error('cadence evidence must come from chain 4663');
  const generatedAt = isoTimestamp('generatedAt', input.generatedAt);
  const rpcClass = String(input.rpcClass || '');
  if (!['public', 'private', 'archive'].includes(rpcClass)) {
    throw new Error('rpcClass must be public, private, or archive');
  }
  if (!Array.isArray(input.samples) || input.samples.length < minSamples) {
    throw new Error(`cadence evidence needs at least ${minSamples} samples`);
  }

  const samples = input.samples.map((sample, index) => {
    const elapsedMs = integer(`samples[${index}].elapsedMs`, sample.elapsedMs);
    const blockNumberish = uint(`samples[${index}].blockNumberish`, sample.blockNumberish);
    const latestBlock = uint(`samples[${index}].latestBlock`, sample.latestBlock);
    const finalizedBlock = sample.finalizedBlock == null
      ? null : uint(`samples[${index}].finalizedBlock`, sample.finalizedBlock);
    if (finalizedBlock != null && finalizedBlock > latestBlock) {
      throw new Error(`samples[${index}] finalizedBlock cannot exceed latestBlock`);
    }
    return {
      elapsedMs,
      observedAt: isoTimestamp(`samples[${index}].observedAt`, sample.observedAt),
      blockNumberish,
      latestBlock,
      latestTimestamp: uint(`samples[${index}].latestTimestamp`, sample.latestTimestamp),
      finalizedBlock,
      finalityLagBlocks: finalizedBlock == null ? null : latestBlock - finalizedBlock,
    };
  });

  if (samples[0].elapsedMs !== 0) throw new Error('the first cadence sample must have elapsedMs 0');
  const cadenceMicros = [];
  for (let index = 1; index < samples.length; index++) {
    const before = samples[index - 1];
    const after = samples[index];
    if (after.elapsedMs <= before.elapsedMs) throw new Error('cadence sample elapsedMs values must increase');
    if (after.blockNumberish <= before.blockNumberish) {
      throw new Error('cadence sample BlockNumberish values must increase');
    }
    if (after.latestBlock < before.latestBlock) throw new Error('cadence latestBlock values cannot move backwards');
    const elapsedMicros = BigInt(after.elapsedMs - before.elapsedMs) * 1_000n;
    const blocks = after.blockNumberish - before.blockNumberish;
    cadenceMicros.push((elapsedMicros + blocks / 2n) / blocks);
  }
  const sampleSpanMs = samples.at(-1).elapsedMs;
  if (sampleSpanMs < minSpanMs) {
    throw new Error(`cadence sample span must be at least ${minSpanMs} ms`);
  }
  if (cadenceMicros.some((value) => value <= 0n)) throw new Error('cadence must be positive');
  if (requireFinality && samples.some((sample) => sample.finalizedBlock == null)) {
    throw new Error('every production cadence sample must include finalizedBlock');
  }

  const medianCadenceMicros = median(cadenceMicros);
  const finalityLags = samples.filter((sample) => sample.finalityLagBlocks != null)
    .map((sample) => sample.finalityLagBlocks);
  const auctionBlocks = blocksForDuration(GENESIS_AUCTION_TARGET_SECONDS, medianCadenceMicros);
  const claimDelayBlocks = blocksForDuration(GENESIS_CLAIM_TARGET_SECONDS, medianCadenceMicros);
  const body = {
    schemaVersion: 1,
    chainId: 4663,
    rpcClass,
    finalityTag: 'finalized',
    generatedAt,
    targets: {
      auctionSeconds: GENESIS_AUCTION_TARGET_SECONDS,
      claimDelaySeconds: GENESIS_CLAIM_TARGET_SECONDS,
      rounding: 'ceiling',
    },
    samples,
    summary: {
      sampleCount: samples.length,
      sampleSpanMs,
      intervalCadenceMicros: cadenceMicros,
      medianCadenceMicros,
      auctionBlocks,
      claimDelayBlocks,
      firstBlockNumberish: samples[0].blockNumberish,
      lastBlockNumberish: samples.at(-1).blockNumberish,
      medianFinalityLagBlocks: finalityLags.length ? median(finalityLags) : null,
      maxFinalityLagBlocks: finalityLags.length ? finalityLags.reduce((a, b) => (a > b ? a : b)) : null,
    },
  };
  return { ...body, evidenceSha256: sha256Hex(canonicalJson(body)) };
}
