#!/usr/bin/env node
// Retain each native diagnostic with the disposition reached by scoped code/trace review.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'output/market-v2-review');
const rawFile = path.join(dir, 'slither-final-retest.json');
const raw = JSON.parse(fs.readFileSync(rawFile));
if (!raw.success || !Array.isArray(raw.results?.detectors)) throw new Error('Slither did not complete');
const scope = raw.results.detectors.filter(d => d.description.includes('src/market-v2/'));
const reasons = {
  'arbitrary-send-eth': ['false-positive', 'ReserveFunding.flush sends only to the once-bound controller and immutable tranche. Safe-only binding verifies token and Safe; callers choose no destination or calldata. Actual hook-tax and solver-profit funding integration conserves both assets and leaves allowance zero.'],
  'reentrancy-eth': ['false-positive', 'TurfFeeBridge.close and checkpointFees share nonReentrant. Its fixed source/registry cannot mutate through the closed getter. Only claimed fee counters are forwarded, and an expired position is removed before closing. The closed flag is committed after successful settlement, with atomic revert on failure.'],
  'divide-before-multiply': ['reviewed-intentional-rounding', 'Epoch division intentionally identifies the fixed interval. Mean tick uses explicit negative floor; dispersion is computed around that floor. Controller anchors intentionally snap to the tick grid. Pressure decay/rate floors are bounded, not claimed to make split trades exactly equivalent. Dedicated timing, tick orientation, rounding and swap tests cover these boundaries.'],
  'incorrect-equality': ['reviewed-authoritative-sentinel', 'Zero time/fees/liquidity, exact epoch identity, empty siege and final split index are authoritative integer states. No equality here requires an externally donated balance to remain unchanged. Conservation, dust, expiry and vesting tests exercise these branches.'],
  'reentrancy-no-eth': ['false-positive', 'Commitment NFT transfer is guarded and goes through the pinned PositionManager to a restricted receiver; first checkpoint has no prior sample to reward. Game archive is guarded and its source lacks Safe registration authority. Controller deploy is guarded, while its callback requires the exact pending hash and manager, clears the hash before liquidity mutation, and settles deltas before recording final liquidity. Real manager custody invariants match recorded positions.'],
  'uninitialized-local': ['false-positive', 'Solidity initializes numeric accumulator locals to zero. The commitment snapshot local is assigned in the successful try branch; the catch resets the sample and returns before using it. Split, depth and reward zero paths are intentional and tested.'],
  'unused-return': ['reviewed-unused-fields', 'Only required slot0, season or NFT fields are consumed. Canonical NFT identity is checked before custody; immutable position bounds cannot change while held. Controller unlock intentionally returns empty bytes; the pending callback hash and PoolManager zero-delta enforcement determine successful completion.'],
  'calls-loop': ['accepted-bounded-liveness-coupling', 'Family treasury reassignment must checkpoint every active fee source before the wallet changes. The active set is bounded to 64 pre-registered bridges and closed seasons can be archived. A failed bridge can delay reassignment; it cannot redirect earned fees or block canonical swaps. This operational limitation is documented.'],
  'reentrancy-benign': ['reviewed-guarded-state-order', 'State-changing monetary entries are guarded; callback authority is independently pinned to the manager/pending hash, and externally called contracts have fixed typed authority. Post-call observations/flags are recorded only on a successful atomic transaction. Read-only interim getters confer no write or payment authority. See scoped controller/game reviews and integration traces.'],
  'reentrancy-events': ['reviewed-guarded-event-order', 'Events describe completed guarded transfers or NFT custody operations. Fixed dependencies do not gain access to the caller or Safe authority through event ordering. Accounting and callbacks are checked independently of logs; game indexing must respect transaction ordering and finality.'],
  timestamp: ['accepted-clock-assumption', 'Clock comparisons implement bounded epoch, cooldown, vesting, lock, deadline, opening or season rules, not randomness or a price guarantee. Small timestamp influence and actual keeper timing remain operational assumptions. Stale/future samples, zero time, gap, expiry, pause and maturity tests cover policy boundaries.'],
  assembly: ['reviewed-transient-storage', 'Hook assembly stores and reads the pre-swap tick in a dedicated transient slot under PoolManager-only callbacks, overwrites it for each swap and sign-extends int24 correctly. No arbitrary delegatecall or user-selected storage slot is exposed.'],
  pragma: ['reviewed-compiler-pin', 'Imported dependencies have different compatible pragma ranges. Actual builds are pinned to Solidity 0.8.26/Cancun/optimizer800 and V2 viaIR. Real PoolManager is deployed from its normal artifact to avoid the reproduced inline-viaIR compiler issue. This is not an assertion that the compiler has no bugs.'],
  'low-level-calls': ['reviewed-checked-transfer', 'Native claim/retirement calls have checked success, fixed or beneficiary-authorized destinations, effects-before-interaction and reentrancy guards. A failed recipient retains its entitlement through revert and cannot block other recipients or oracle-independent principal recovery.'],
};
for (const d of scope) if (!reasons[d.check]) throw new Error(`untriaged rule: ${d.check}`);
const entries = scope.map(d => ({ id: d.id, rule: d.check, reportedImpact: d.impact, reportedConfidence: d.confidence,
  description: d.description, disposition: reasons[d.check][0], rationale: reasons[d.check][1] }));
const sourceFiles = fs.readdirSync(path.join(root, 'omerta-contracts/src/market-v2')).filter(f => f.endsWith('.sol'));
const sha = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for (const f of sourceFiles) if (sha(path.join(root, 'omerta-contracts/src/market-v2', f))
  !== sha(path.join(dir, 'slither-final-workspace/src/market-v2', f))) throw new Error(`static snapshot drift: ${f}`);
const result = { raw: 'slither-final-retest.json', rawSha256: sha(rawFile), successfulNativeRun: true,
  totalDiagnostics: raw.results.detectors.length, scopeDiagnostics: scope.length, entries,
  note: 'Triage applies only to the exact source snapshot. Non-V2 diagnostics are retained in raw output and excluded from this review, not declared resolved.' };
fs.writeFileSync(path.join(dir, 'static-triage.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ raw: result.totalDiagnostics, scoped: scope.length, rules: [...new Set(scope.map(d => d.check))].length, untriaged: 0 }));
