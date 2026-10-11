import { DISTRICTS, GOODS, priceBlock } from './rules.js';

export const INTEL_FORECAST = Object.freeze({ good: 'gin', minFeeCash: 50, maxFeeCash: 5000,
  minStock: 1, maxStock: 40, minLeadMs: 5 * 60000, maxLeadMs: 30 * 60000,
  reportLeadMs: 60000, scoreGraceMs: 30000, maxOpen: 3, blockMs: 4 * 3600000, stockPerBlock: 500 });
const gin = GOODS.find(good => good.id === INTEL_FORECAST.good);
const snapshotFields = ['good', 'goodName', 'districtId', 'districtName', 'block', 'observedAt', 'refreshAt', 'stock'];
const fail = () => { throw new TypeError('Invalid intel forecast observation or terms.'); };
const whole = (value, min, max) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail();
  return value;
};
const clock = value => {
  whole(value, 0, Number.MAX_SAFE_INTEGER);
  if (!Number.isFinite(new Date(value).getTime())) fail();
  return value;
};
const timestamp = value => {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail();
  return clock(Date.parse(value));
};
const district = value => {
  const row = DISTRICTS.find(candidate => candidate.id === value);
  if (!row) fail();
  return row;
};
function exact(body, fields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(body))) fail();
  const keys = Reflect.ownKeys(body);
  if (keys.length !== fields.length || keys.some(key => !fields.includes(key))) fail();
  for (const field of fields) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(body, field), 'value')) fail();
}

export function intelForecastTerms(body, now = Date.now()) {
  exact(body, ['districtId', 'minimumStock', 'feeCash', 'targetAt']); clock(now); district(body.districtId);
  whole(body.minimumStock, INTEL_FORECAST.minStock, INTEL_FORECAST.maxStock);
  whole(body.feeCash, INTEL_FORECAST.minFeeCash, INTEL_FORECAST.maxFeeCash);
  const target = timestamp(body.targetAt), lead = target - now;
  if (lead < INTEL_FORECAST.minLeadMs || lead > INTEL_FORECAST.maxLeadMs || priceBlock(target) !== priceBlock(now)) fail();
  return { districtId: body.districtId, minimumStock: body.minimumStock, feeCash: body.feeCash, targetAt: body.targetAt };
}
export function validateIntelForecastReport(body) {
  exact(body, ['predictsAvailable']);
  if (typeof body.predictsAvailable !== 'boolean') fail();
  return { predictsAvailable: body.predictsAvailable };
}

// Whitelist the existing public price/liquidity board. No private signal is read or copied.
export function intelForecastSnapshot(publicMarketPrices, districtId, observedAt) {
  const place = district(districtId), at = clock(observedAt), block = publicMarketPrices?.block;
  whole(block, 0, Number.MAX_SAFE_INTEGER);
  if (block !== priceBlock(at)) fail();
  const refreshAt = publicMarketPrices?.liquidity?.refreshAt;
  if (timestamp(refreshAt) !== (block + 1) * INTEL_FORECAST.blockMs) fail();
  const stock = whole(publicMarketPrices?.liquidity?.districts?.[districtId]?.gin?.stock, 0, INTEL_FORECAST.stockPerBlock);
  return { good: INTEL_FORECAST.good, goodName: gin.name, districtId, districtName: place.name,
    block, observedAt: new Date(at).toISOString(), refreshAt, stock };
}
function checkedSnapshot(value) {
  exact(value, snapshotFields);
  const canonical = intelForecastSnapshot({ block: value.block,
    liquidity: { refreshAt: value.refreshAt, districts: { [value.districtId]: { gin: { stock: value.stock } } } } },
  value.districtId, timestamp(value.observedAt));
  for (const field of snapshotFields) if (value[field] !== canonical[field]) fail();
  return canonical;
}

// Root callers bind immutable job terms and server-captured snapshots. These pure inputs
// alone cannot authenticate an all-valid replacement or grant payment/transaction authority.
export function intelForecastOutcome(report, sample, now = Date.now()) {
  try {
    clock(now); exact(report, ['districtId', 'minimumStock', 'targetAt', 'reportedAt', 'predictsAvailable', 'observation']);
    const target = timestamp(report.targetAt), reported = timestamp(report.reportedAt);
    const observation = checkedSnapshot(report.observation), observed = timestamp(observation.observedAt);
    const scored = checkedSnapshot(sample), sampled = timestamp(scored.observedAt);
    district(report.districtId); whole(report.minimumStock, INTEL_FORECAST.minStock, INTEL_FORECAST.maxStock);
    if (typeof report.predictsAvailable !== 'boolean' || reported !== observed || reported > target - INTEL_FORECAST.reportLeadMs
        || observed > now || sampled > now || sampled < target || sampled > target + INTEL_FORECAST.scoreGraceMs
        || observation.districtId !== report.districtId || scored.districtId !== report.districtId
        || observation.block !== priceBlock(target) || scored.block !== observation.block || priceBlock(now) !== observation.block
        || scored.stock > observation.stock) return 'unknown';
    return report.predictsAvailable === (scored.stock >= report.minimumStock) ? 'correct' : 'incorrect';
  } catch { return 'unknown'; }
}
