import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

// A literal EVM-word model of the two flagged assembly lookups. This does not
// execute Solidity bytecode or replace the separately retained Foundry suites.
const sourcePath = 'omerta-contracts/lib/v4-core/src/libraries/BitMath.sol';
const source = fs.readFileSync(sourcePath);
const MASK = (1n << 256n) - 1n;
const word = x => x & MASK;
const shl = (n, x) => n >= 256n ? 0n : word(x << n);
const shr = (n, x) => n >= 256n ? 0n : word(x) >> n;
const byte = (n, x) => n >= 32n ? 0n : shr(248n - 8n * n, x) & 255n;
function msb(x) {
  assert(x > 0n && x <= MASK);
  let r = x > 0xffffffffffffffffffffffffffffffffn ? 128n : 0n;
  r |= shr(r, x) > 0xffffffffffffffffn ? 64n : 0n;
  r |= shr(r, x) > 0xffffffffn ? 32n : 0n;
  r |= shr(r, x) > 0xffffn ? 16n : 0n;
  r |= shr(r, x) > 0xffn ? 8n : 0n;
  r |= byte(31n & shr(shr(r, x), 0x8421084210842108cc6318c6db6d54ben),
    0x0706060506020500060203020504000106050205030304010505030400000000n);
  return r;
}
function lsb(x) {
  assert(x > 0n && x <= MASK);
  x &= word(-x);
  let r = shl(5n, shr(252n, shl(shl(2n, shr(250n,
    word(x * 0xb6db6db6ddddddddd34d34d349249249210842108c6318c639ce739cffffffffn))),
    0x8040405543005266443200005020610674053026020000107506200176117077n)));
  r |= byte((0xd76453e0n / shr(r, x)) & 31n,
    0x001f0d1e100c1d070f090b19131c1706010e11080a1a141802121b1503160405n);
  return r;
}
const values = new Set([1n, MASK]);
for (let i = 0n; i < 256n; i++) {
  const x = 1n << i;
  values.add(x);
  if (x > 1n) values.add(x - 1n);
  if (x < MASK) values.add(x + 1n);
}
for (let i = 0; i < 2048; i++) {
  const hex = crypto.createHash('sha256').update(`omerta-bitmath-triage:2026-09-08:${i}`).digest('hex');
  const x = BigInt(`0x${hex}`);
  if (x !== 0n) values.add(x);
}
for (const x of values) {
  assert.equal(msb(x), BigInt(x.toString(2).length - 1), `msb(${x})`);
  let expectedLsb = 0n;
  let shifted = x;
  while ((shifted & 1n) === 0n) { expectedLsb++; shifted >>= 1n; }
  assert.equal(lsb(x), expectedLsb, `lsb(${x})`);
}
const result = {
  date: '2026-09-08', command: 'node omerta-contracts/audits/2026-09-08-comprehensive/check-bitmath-model.mjs',
  runtime: process.version, sourcePath, sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
  method: 'Literal BigInt EVM-word translation compared with independent bit-string/shift reference; no compiler or EVM execution.',
  cases: values.size, comparisons: values.size * 2, passed: true,
  inputs: 'All 256 powers of two, adjacent nonzero in-range words, uint256.max, and 2048 SHA-256 deterministic words.',
  seed: 'omerta-bitmath-triage:2026-09-08:<0..2047>',
  limitation: 'Bounded mathematical cross-check of the two diagnostic expressions; not exhaustive over all uint256 inputs or a compiled-bytecode test.',
};
const destination = 'omerta-contracts/audits/2026-09-08-comprehensive/bitmath-model-result.json';
fs.writeFileSync(destination, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({destination, ...result}));
