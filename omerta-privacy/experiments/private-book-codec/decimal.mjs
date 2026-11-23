// Exact, bounded source decimal VALUE codec. No financial or constrained-parse authority.
export const MAX_COEFFICIENT = (1n << 256n) - 1n;
export const MAX_SCALE = 512;
const requireValue = (value, message = 'Invalid bounded decimal') => { if (!value) throw new TypeError(message); };
export function canonicalDecimal(value) {
  requireValue(value && Object.getPrototypeOf(value) === Object.prototype);
  requireValue(Object.keys(value).sort().join(',') === 'coefficient,negative,scale');
  requireValue(typeof value.negative === 'boolean' && typeof value.coefficient === 'bigint' && Number.isInteger(value.scale));
  const { negative, coefficient, scale } = value;
  requireValue(coefficient >= 0n && coefficient <= MAX_COEFFICIENT && scale >= -MAX_SCALE && scale <= MAX_SCALE, 'Raw decimal coefficient/scale outside admitted profile');
  requireValue(coefficient !== 0n ? coefficient % 10n !== 0n : !negative && scale === 0, 'Noncanonical decimal zero/trailing zeros');
  return { negative, coefficient, scale };
}
export function parseDecimal(text) {
  requireValue(typeof text === 'string' && text.length > 0 && text.length <= 200000, 'Original bounded decimal text required before Number coercion');
  const match = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/.exec(text);
  requireValue(match, 'Finite decimal text required');
  // Only digits and integer exponent are inspected before admission. Never call
  // Number(text) to decide whether an unsupported raw amount should be accepted.
  let digits = (match[2] + (match[3] ?? '')).replace(/^0+/, '');
  if (digits === '') return { negative: false, coefficient: 0n, scale: 0 };
  const exponentText = match[4] ?? '0'; requireValue(exponentText.length <= 8, 'Unsupported raw exponent');
  let scale = BigInt((match[3] ?? '').length) - BigInt(exponentText);
  const zeros = /0+$/.exec(digits)?.[0].length ?? 0;
  if (zeros) { digits = digits.slice(0, -zeros); scale -= BigInt(zeros); }
  requireValue(digits.length <= 78 && scale >= -512n && scale <= 512n, 'Raw decimal coefficient/scale outside admitted profile');
  return canonicalDecimal({ negative: match[1] === '-', coefficient: BigInt(digits), scale: Number(scale) });
}
export const decimalText = value => {
  const d = canonicalDecimal(value); return `${d.negative ? '-' : ''}${d.coefficient}${d.scale === 0 ? '' : 'e' + String(-d.scale)}`;
};
export const equalDecimal = (a, b) => a.negative === b.negative && a.coefficient === b.coefficient && a.scale === b.scale;
export function exactInteger(value, maximum) {
  const d = canonicalDecimal(value); requireValue(!d.negative && d.scale <= 0, 'Nonnegative exact integer required');
  const integer = d.coefficient * (10n ** BigInt(-d.scale)); requireValue(integer <= maximum, 'Integer outside source type bounds'); return integer;
}
export function numberProjection(value, policy) {
  const d = canonicalDecimal(value);
  if (policy === 'none') return 0n;
  requireValue(policy === 'nonnegative-safe-finite', 'Unknown Number projection policy');
  const number = Number(decimalText(d));
  requireValue(Number.isFinite(number) && number >= 0 && number <= Number.MAX_SAFE_INTEGER && !Object.is(number, -0), 'Unsupported source Number projection domain');
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, number, false); return view.getBigUint64(0, false);
}
export function isHostShortestNumberDecimal(value) {
  const d = canonicalDecimal(value), number = Number(decimalText(d));
  requireValue(Number.isFinite(number), 'Nonfinite Number assignment'); return equalDecimal(d, parseDecimal(number.toString()));
}
