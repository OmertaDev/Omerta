import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { concatHex, encodeAbiParameters, keccak256, toHex } from 'viem';
import { buildWbtcRewardEpoch, canonicalJson, rewardLeaf, verifyRewardProof, MAX_SNAPSHOTS,
  MAX_ROWS_PER_SNAPSHOT, OMR_SUPPLY } from '../tools/wbtc-reward-epoch.js';

const A = n => `0x${BigInt(n).toString(16).padStart(40, '0')}`;
const H = n => `0x${BigInt(n).toString(16).padStart(64, '0')}`;
const E = 10n ** 18n;
const clone = value => JSON.parse(JSON.stringify(value));
const a = A(1), b = A(2), c = A(3), custody = A(80), vault = A(81), lp = A(82), treasury = A(83), genesis = A(84);
const raw = value => (BigInt(value) * E).toString();
function fixture() {
  const snapshots = [1000, 1010, 1020].map((time, i) => ({ timestamp: String(time),
    walletBalances: [{ account: a, balance: raw(i ? 20 : 10) }, { account: b, balance: raw(i ? 10 : 20) },
      { account: c, balance: '0' }, { account: custody, balance: raw(50) }, { account: vault, balance: '0' },
      { account: lp, balance: raw(100) }, { account: treasury, balance: raw(60) }, { account: genesis, balance: raw(50) }],
    gameBalances: [{ accountId: 'game-a', account: a, balance: raw(i ? 5 : 10) },
      { accountId: 'game-c', account: c, balance: raw(i ? 25 : 20) }],
    backing: { custody, domain: H(1), blockNumber: String(100 + i), blockHash: H(100 + i), observedAt: String(time),
      physicalCustody: raw(50), allDatabaseLiabilities: raw(40), reserveFunded: raw(50), requiredReserve: raw(40),
      provenanceHash: H(2), liabilitiesHash: H(3) } }));
  return { schemaVersion: 1, mode: 'wallet-and-backed-game', chainId: '31337', rewardsVault: vault,
    epochId: '1', startTime: '1000', endTime: '1020', totalRewards: '1200',
    exclusions: { protocolCustody: [custody, vault], lp: [lp], treasury: [treasury], unclaimedGenesis: [genesis] },
    funding: { chainId: '31337', rewardsVault: vault, blockNumber: '102', blockHash: H(102), observedAt: '1020',
      vaultWbtcBalance: '1200', reservedWbtc: '0', sourceManifestHash: H(5) },
    coverage: { kind: 'complete-change-history', through: '1020', maxGapSeconds: '10', sourceManifestHash: H(4) }, snapshots };
}
function simple(balances, budget) {
  const f = fixture(); f.totalRewards = String(budget);
  f.funding.vaultWbtcBalance = String(budget);
  for (const s of f.snapshots) {
    s.gameBalances = [];
    s.walletBalances = [...balances.map(([account, balance]) => ({ account, balance: String(balance) })),
      ...[custody, vault, lp, treasury, genesis].map(account => ({ account, balance: account === custody ? '10' : '0' }))];
    Object.assign(s.backing, { physicalCustody: '10', allDatabaseLiabilities: '10', reserveFunded: '10', requiredReserve: '1' });
  }
  return f;
}
const amounts = output => Object.fromEntries(output.claims.map(x => [x.account, x.amount]));
const independentPair = (x, y) => keccak256(concatHex([x, y].sort()));
function independentLeaf(input, claim) {
  const encoded = encodeAbiParameters([{ type: 'uint256' }, { type: 'address' }, { type: 'uint256' },
    { type: 'address' }, { type: 'uint256' }], [BigInt(input.chainId), input.rewardsVault,
    BigInt(input.epochId), claim.account, BigInt(claim.amount)]);
  return keccak256(keccak256(encoded));
}
let groups = 0;
function test(name, run) { run(); ++groups; console.log(`PASS ${name}`); }
function rejects(change, pattern) { const f = fixture(); change(f); assert.throws(() => buildWbtcRewardEpoch(f), pattern); }

test('exact multiwallet and backed-game time integrals with excluded custody', () => {
  const f = fixture(), result = buildWbtcRewardEpoch(f);
  assert.deepEqual(amounts(result), { [a]: '450', [b]: '300', [c]: '450' });
  assert.equal(result.totals.weightedOmrSeconds, (1200n * E).toString());
  assert.equal(result.totals.walletOmrSeconds, (600n * E).toString());
  assert.equal(result.totals.gameOmrSeconds, (600n * E).toString());
  assert.equal(result.totals.excludedWalletOmrSeconds, (260n * 20n * E).toString());
  assert.equal(result.totals.unallocatedRewards, '0');
  assert.equal(result.manifestHash, keccak256(toHex(canonicalJson(f))));
  assert(![custody, vault, lp, treasury, genesis].some(x => Object.hasOwn(amounts(result), x)));
  for (const claim of result.claims) {
    const leaf = independentLeaf(f, claim);
    assert.equal(rewardLeaf({ chainId: f.chainId, rewardsVault: vault, epochId: '1', account: claim.account, amount: claim.amount }), leaf);
    assert.equal(claim.proof.reduce(independentPair, leaf), result.root);
  }
});
test('wallet-to-custody deposit keeps beneficial exposure without double shares', () => {
  const f = fixture(), before = buildWbtcRewardEpoch(f);
  for (const s of f.snapshots.slice(1)) {
    s.walletBalances.find(x => x.account === a).balance = raw(19);
    s.walletBalances.find(x => x.account === custody).balance = raw(51);
    s.gameBalances.find(x => x.account === a).balance = raw(6);
    Object.assign(s.backing, { physicalCustody: raw(51), allDatabaseLiabilities: raw(41) });
  }
  const after = buildWbtcRewardEpoch(f);
  assert.equal(after.root, before.root); assert.deepEqual(amounts(after), amounts(before));
  assert.notEqual(after.manifestHash, before.manifestHash);
});
test('end boundary has no exposure after period; input remains unchanged', () => {
  const f = fixture(), result = buildWbtcRewardEpoch(f);
  f.snapshots.at(-1).walletBalances.find(x => x.account === a).balance = raw(1000);
  const bytes = JSON.stringify(f);
  assert.equal(buildWbtcRewardEpoch(f).root, result.root);
  assert.equal(JSON.stringify(f), bytes);
});
test('largest remainder allocates exact sats with deterministic address ties', () => {
  let f = simple([[a, 1], [b, 1], [c, 1]], 2), result = buildWbtcRewardEpoch(f);
  assert.deepEqual(amounts(result), { [a]: '1', [b]: '1' });
  assert.equal(result.totals.positiveWeightAccounts, 3);
  assert.equal(result.totals.floorRemainderSats, '2');
  assert.equal(result.totals.distributedRemainderSats, '2');
  f = simple([[a, 2], [b, 3]], 7);
  assert.deepEqual(amounts(buildWbtcRewardEpoch(f)), { [a]: '3', [b]: '4' });
  f = simple([[a, 1], [b, 1], [c, 1]], 3); result = buildWbtcRewardEpoch(f);
  const leaves = result.claims.map(claim => independentLeaf(f, claim)).sort();
  assert.equal(result.root, independentPair(independentPair(leaves[0], leaves[1]), leaves[2]));
  for (const s of f.snapshots) s.walletBalances.reverse();
  assert.equal(buildWbtcRewardEpoch(f).root, result.root);
});
test('single recipient, zero shares and uint256-scale reward budget', () => {
  const f = simple([[a, 1], [b, 0]], (1n << 256n) - 1n), result = buildWbtcRewardEpoch(f);
  assert.equal(result.claims.length, 1); assert.deepEqual(result.claims[0].proof, []);
  assert.equal(result.claims[0].amount, f.totalRewards);
  assert.equal(result.root, independentLeaf(f, result.claims[0]));
  assert.throws(() => buildWbtcRewardEpoch(simple([[a, 0]], 1)), /no positive eligible/);
});
test('complete, ordered boundary coverage and fresh backing are mandatory', () => {
  rejects(f => f.snapshots.shift(), /boundary/);
  rejects(f => f.snapshots.pop(), /boundary/);
  rejects(f => f.snapshots[1].timestamp = '1000', /unordered/);
  rejects(f => f.snapshots.reverse(), /boundary/);
  rejects(f => f.coverage.maxGapSeconds = '9', /stale coverage/);
  rejects(f => f.coverage.maxGapSeconds = '86401', /one day/);
  rejects(f => f.coverage.through = '1010', /coverage/);
  rejects(f => f.coverage.kind = 'sampled-not-complete', /coverage/);
  rejects(f => f.snapshots[0].backing.observedAt = '699', /stale/);
  rejects(f => f.snapshots[0].backing.observedAt = '1001', /future/);
  rejects(f => f.snapshots[1].backing.blockNumber = '99', /canonical block/);
  rejects(f => f.snapshots[1].backing.blockNumber = '100', /canonical block/);
  rejects(f => f.snapshots[1].backing.domain = H(999), /cutover/);
});
test('all liabilities and reserve provenance must be backed at every point', () => {
  rejects(f => f.snapshots[1].backing.allDatabaseLiabilities = raw(51), /insufficient/);
  rejects(f => f.snapshots[1].backing.reserveFunded = raw(39), /insufficient/);
  rejects(f => f.snapshots[1].backing.reserveFunded = raw(49), /cumulative funding/);
  rejects(f => f.snapshots[1].backing.requiredReserve = raw(41), /baseline/);
  rejects(f => f.snapshots[1].backing.requiredReserve = '0', /outside bounds/);
  rejects(f => f.snapshots[1].backing.physicalCustody = raw(49), /differs/);
  rejects(f => f.snapshots[1].backing.provenanceHash = H(0), /nonzero bytes32/);
  rejects(f => delete f.snapshots[1].backing.liabilitiesHash, /missing/);
  rejects(f => f.snapshots[1].gameBalances[0].balance = raw(50), /backed liabilities/);
  rejects(f => f.snapshots[1].walletBalances[0].balance = OMR_SUPPLY.toString(), /exceeds fixed supply/);
  rejects(f => f.snapshots[1].backing.reserveFunded = (1n << 256n).toString(), /outside bounds/);
  const recycled = fixture();
  for (const s of recycled.snapshots) s.backing.reserveFunded = (OMR_SUPPLY + E).toString();
  assert.equal(buildWbtcRewardEpoch(recycled).root, buildWbtcRewardEpoch(fixture()).root);
});
test('epoch budget is bounded by domain-bound measured free WBTC after all reservations', () => {
  rejects(f => f.funding.vaultWbtcBalance = '1199', /unreserved WBTC/);
  rejects(f => f.funding.reservedWbtc = '1', /unreserved WBTC/);
  rejects(f => f.funding.reservedWbtc = '1201', /unreserved WBTC/);
  rejects(f => f.funding.chainId = '4663', /another chain/);
  rejects(f => f.funding.rewardsVault = A(999), /another chain or vault/);
  rejects(f => f.funding.blockNumber = '101', /precedes period end/);
  rejects(f => f.funding.blockHash = H(999), /canonical end block/);
  rejects(f => f.funding.observedAt = '1019', /precedes period end/);
  rejects(f => f.funding.sourceManifestHash = H(0), /nonzero bytes32/);
  rejects(f => delete f.funding, /missing/);
});
test('duplicate identities, links and exclusion overlaps fail closed', () => {
  rejects(f => f.snapshots[1].walletBalances.push(clone(f.snapshots[1].walletBalances[0])), /duplicate wallet/);
  rejects(f => f.snapshots[1].gameBalances.push(clone(f.snapshots[1].gameBalances[0])), /duplicate game/);
  rejects(f => f.snapshots[1].gameBalances[1].account = a, /duplicate game/);
  rejects(f => f.snapshots[1].gameBalances[1].accountId = 'game-a', /duplicate game/);
  rejects(f => f.snapshots[1].gameBalances[1].account = A(999), /linked wallet/);
  rejects(f => delete f.snapshots[1].gameBalances[1].account, /missing/);
  rejects(f => f.snapshots[1].gameBalances[1].account = treasury, /linked wallet/);
  rejects(f => f.exclusions.lp.push(custody), /overlapping/);
  rejects(f => f.exclusions.protocolCustody.pop(), /vault must/);
  rejects(f => f.exclusions.protocolCustody.shift(), /custody must/);
  rejects(f => f.snapshots[1].walletBalances = f.snapshots[1].walletBalances.filter(x => x.account !== genesis), /excluded address observation/);
});
test('canonical integer strings, closed schemas and bounded resource inputs', () => {
  for (const amount of [-1, 0.1, Number.MAX_SAFE_INTEGER + 1, '-1', '1.0', '01', '1e18', 'NaN', 'Infinity', '', null]) {
    rejects(f => f.snapshots[0].walletBalances[0].balance = amount, /decimal integer string/);
  }
  rejects(f => f.mode = 'wallet-only', /approved/);
  rejects(f => f.chainId = 31337, /decimal integer string/);
  rejects(f => f.totalRewards = '0', /outside bounds/);
  rejects(f => f.totalRewards = (1n << 256n).toString(), /outside bounds/);
  rejects(f => f.secret = 'SENSITIVE_CANARY', /unknown field/);
  rejects(f => f.snapshots[0].backing.override = true, /unknown field/);
  rejects(f => f.snapshots[0].walletBalances[0].unchecked = true, /unknown field/);
  rejects(f => f.snapshots = Array(MAX_SNAPSHOTS + 1).fill(f.snapshots[0]), /bounded array/);
  rejects(f => f.snapshots[0].walletBalances = Array(MAX_ROWS_PER_SNAPSHOT + 1).fill(f.snapshots[0].walletBalances[0]), /bounded array/);
  rejects(f => { for (const s of f.snapshots) s.walletBalances = Array(90000).fill(s.walletBalances[0]); }, /total resource/);
  assert.throws(() => canonicalJson({ bad: 0.1 }), /safe integer/);
  assert.throws(() => canonicalJson(new Date()), /plain object/);
  assert.throws(() => canonicalJson(Array(2)), /sparse/);
  assert.equal(canonicalJson({ z: 1, a: { z: '2', a: '1' } }), '{"a":{"a":"1","z":"2"},"z":1}');
});
test('claims are bound to chain, vault, epoch, claimant and exact amount', () => {
  const f = fixture(), result = buildWbtcRewardEpoch(f), claim = result.claims[0];
  const leafInput = { chainId: f.chainId, rewardsVault: vault, epochId: '1', account: claim.account, amount: claim.amount };
  assert(verifyRewardProof(result.root, rewardLeaf(leafInput), claim.proof));
  for (const delta of [{ chainId: '4663' }, { rewardsVault: A(999) }, { epochId: '2' },
    { account: A(999) }, { amount: (BigInt(claim.amount) + 1n).toString() }]) {
    assert(!verifyRewardProof(result.root, rewardLeaf({ ...leafInput, ...delta }), claim.proof));
  }
  const proof = [...claim.proof]; proof[0] = H(999);
  assert(!verifyRewardProof(result.root, rewardLeaf(leafInput), proof));
  assert(!verifyRewardProof(result.root, rewardLeaf(leafInput), ['invalid']));
});
test('synthetic varying-holder campaigns conserve exact budget and every proof', () => {
  let seed = 741n;
  const random = maximum => { seed = (seed * 48271n) % 2147483647n; return seed % maximum; };
  for (let count = 1; count <= 25; ++count) {
    const f = simple(Array.from({ length: count }, (_, i) => [A(i + 1), random(1000n) + 1n]), random(10000n) + 1n);
    const result = buildWbtcRewardEpoch(f);
    assert.equal(result.claims.reduce((sum, claim) => sum + BigInt(claim.amount), 0n), BigInt(f.totalRewards));
    assert.equal(new Set(result.claims.map(x => x.account)).size, result.claims.length);
    for (const claim of result.claims) {
      assert(BigInt(claim.amount) > 0n);
      assert.equal(claim.proof.reduce(independentPair, independentLeaf(f, claim)), result.root);
    }
  }
});
test('offline CLI roundtrip, overwrite refusal and redacted invalid input', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-reward-epoch-'));
  const script = fileURLToPath(new URL('../tools/wbtc-reward-epoch.js', import.meta.url));
  const input = path.join(dir, 'synthetic-input.json'), output = path.join(dir, 'synthetic-epoch.json');
  try {
    fs.writeFileSync(input, JSON.stringify(fixture()));
    const run = args => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    let result = run(['--input', input, '--output', output]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(fs.readFileSync(output)).root, buildWbtcRewardEpoch(fixture()).root);
    assert.equal(run(['--input', input, '--output', output]).status, 1);
    assert.equal(run(['--rpc-url', 'SENSITIVE_CANARY']).status, 1);
    fs.writeFileSync(input, '{"secret":"SENSITIVE_CANARY"');
    result = run(['--input', input]);
    assert.equal(result.status, 1); assert(!result.stderr.includes('SENSITIVE_CANARY')); assert.equal(result.stdout, '');
    fs.truncateSync(input, 64 * 1024 * 1024 + 1);
    result = run(['--input', input]);
    assert.equal(result.status, 1); assert.match(result.stderr, /64 MiB/); assert.equal(result.stdout, '');
  } finally {
    for (const file of [input, output]) if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(dir);
  }
});
console.log(`WBTC reward epoch: ${groups} groups passed; synthetic offline fixtures only.`);
