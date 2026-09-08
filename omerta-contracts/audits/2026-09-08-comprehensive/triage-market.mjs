import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const names = ['Alchemist', 'Denari', 'Transmuter', 'CollateralEscrow', 'FlashGuard',
  'OmertaHook', 'OmrTwapOracle', 'OmrV4TwapOracle', 'StockTokenRegistry', 'RwaStockBuyer'];
const owned = new Set(names.map(name => `src/${name}.sol`));
const decisions = {
  'weak-prng': 'False positive: uint32 timestamp modulo implements V2 cumulative wrapping; no random outcome is derived.',
  'uninitialized-state': 'False positive: FlashGuard is abstract; Alchemist/Transmuter owner setters write the inherited allowlist. The empty map deliberately rejects contracts by default.',
  'arbitrary-send-eth': 'Constrained behavior: only keeper can enter buy; Safe selects code-bearing adapter while paused. Exact registry token, immutable vault, independent fresh quote floor, budget and actual balance delta constrain output. Adapter/source code and supported token behavior still require concrete activation review.',
  'reentrancy-balance': 'False positive for the supported exact-transfer asset model: buy is nonReentrant, pre-call balance is an intentional baseline, and post-call exact-token net increase enforces output. Rebasing/malicious balanceOf tokens are outside verified support and retained as dependency risks.',
  'reentrancy-no-eth': 'False positive: all Alchemist state-mutating position entry points are nonReentrant. Harvest rechecks actual collateral after vault withdrawal before funding. Public views can observe an intermediate value, but no in-scope consumer performs a mutation from that view during a callback.',
  'reentrancy-benign': 'False positive: deposit, withdraw and harvest share the Alchemist nonReentrant lock. Reverted external calls roll back state; withdrawal and harvest recheck collateral after vault execution.',
  'divide-before-multiply': 'Reviewed rounding: Alchemist ceils debt-to-assets then caps debt reduction; V2 follows canonical UQ112 reserve-ratio truncation before time accrual; hook rounds measured impact to integer bps, then stays between configured floor and hard-capped surge ceiling. No proven harmful loss from this rule.',
  'incorrect-equality': 'Intentional discrete/sentinel check: same-block separation, zero share early return, uninitialized pool/ballot/average, or exact prior-UTC-day binding. None compares a manipulable external token balance to a nonzero fixed expected amount.',
  'uninitialized-local': 'False positive: Solidity zero-initializes local uint256 dev/rwa/community. When sellTaxBps==0 the entire fee deliberately accrues to the LP remainder.',
  'unused-return': 'Intentional: escrow measures actual share-balance delta instead of trusting deposit return; vault withdraw share return is unused and subsequent Alchemist collateral is rechecked. Hook ignores LP/protocol fee fields it does not consume. Buyer ignores ballot display ticker/tally while binding asset key, token and active status.',
  'missing-zero-check': 'Intentional disabled role: zero minter/burner/publisher/keeper disables authority. Escrow owner is attribution only; production Alchemist passes nonzero msg.sender and only immutable controller has custody authority.',
  'timestamp': 'Expected time semantics: UTC ballot/day caps and bounded TWAP windows require block timestamp. No randomness/security entitlement derives from sub-block unpredictability; chain timestamp/sequencer availability remains an external assumption.',
  'assembly': 'Reviewed hook assembly accesses a dedicated transient pre-price slot through tstore/tload under Cancun. Hook has no delegatecall and both accesses occur in matched swap callbacks.',
  'pragma': 'Build configuration pins native solc 0.8.26 even though imported libraries declare compatible wider ranges.',
  'solc-version': 'Range-level diagnostic: actual selected compiler is pinned 0.8.26. Older versions permitted by generic dependency pragmas are not selected for this build.',
  'cyclomatic-complexity': 'Maintainability observation: harvest rounding, fee, collateral and funding branches reviewed; covered by existing dust, fee-limit, exit-fee and borrow-buffer regressions.',
  'unindexed-event-address': 'Indexing/performance observation only: event fields remain recoverable from receipt data; no event filter is authority for these on-chain checks.',
  'dead-code': 'Context artifact: abstract FlashGuard helpers are used by derived contracts; Transmuter intentionally does not use same-block entry/exit protection for redemption.',
  'naming-convention': 'Style only: PERIOD is immutable and deliberately uppercase.',
  'low-level-calls': 'Expected native transfer: owner-only sweepEth uses nonReentrant, nonzero amount/destination and checks success; reverted transfer preserves funds.'
};
const result = { date: '2026-09-08', note: 'Each entry links a raw diagnostic to a disposition. Imported dependency-only diagnostics remain with the shared-dependency/global review.', inputs: [], diagnostics: [] };
for (const name of names) {
  const input = path.join('output/comprehensive-audit', `slither-${name}-full.json`);
  const raw = fs.readFileSync(input);
  const parsed = JSON.parse(raw);
  result.inputs.push({path: input, sha256: crypto.createHash('sha256').update(raw).digest('hex'), success: parsed.success});
  for (const diagnostic of parsed.results?.detectors ?? []) {
    const files = diagnostic.elements.map(e => e.source_mapping?.filename_relative?.replaceAll('\\', '/')).filter(Boolean);
    if (!files.some(file => owned.has(file))) continue;
    if (!decisions[diagnostic.check]) throw Error(`Untriaged detector ${diagnostic.check}`);
    result.diagnostics.push({sourceRun: name, id: diagnostic.id, check: diagnostic.check, reportedImpact: diagnostic.impact,
      description: diagnostic.description, disposition: decisions[diagnostic.check]});
  }
}
const output = path.join('omerta-contracts/audits/2026-09-08-comprehensive', 'market-static-triage.json');
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({output, diagnostics: result.diagnostics.length, inputCount: result.inputs.length}));
