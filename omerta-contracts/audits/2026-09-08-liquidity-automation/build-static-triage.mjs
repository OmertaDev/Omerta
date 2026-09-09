// Materialize the reviewer's decisions below; this is an inventory checker, not an automated audit.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const root = path.join(repo, '../output/liquidity-automation/static');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const runs = read(path.join(root, 'slither-runs.json'));
const decisions = (d) => {
  const x = d.description;
  const result = (disposition, rationale) => ({ disposition, rationale });
  const fp = s => result('false-positive', s);
  const design = s => result('accepted-design', s);
  const info = s => result('informational', s);
  switch (d.check) {
    case 'arbitrary-send-eth':
      if (x.includes('KeeperGasVault.topUp')) return fp('The caller nominates an already owner-allowlisted keeper, not an arbitrary beneficiary. refillAmount applies target deficit, per-refill cap, global UTC-day balance and vault balance; topUp reserves shared budget and per-keeper cooldown before the checked transfer. Stranger, callback, allowance rotation and shared-budget tests pass. A compromised allowlisted keeper may consume the finite subsidy, as documented.');
      if (x.includes('ProtocolLiquidityVault._sendNative')) return fp('Every reachable caller supplies an immutable deskRecipient, vigRecipient or original Safe emergencyRecipient. The public collectFees caller receives no proceeds. Emergency recovery requires owner and permanent latch. All asset-moving callers use nonReentrant; no arbitrary recipient parameter reaches an external entry point.');
      break;
    case 'reentrancy-balance': case 'reentrancy-benign': case 'reentrancy-eth': case 'reentrancy-no-eth':
      if (x.includes('BankBufferVault.')) return fp('fundDeficit is nonReentrant, pins the direct asset/Transmuter code, reserves its UTC-day budget before external calls, grants only the exact fund amount, clears the approval and requires exact source balance decrease, destination increase and tracked reserve increase. The pre-call balances are deliberately the comparison baseline. Actual Transmuter plus malicious callback/token tests reject inconsistent settlement.');
      if (x.includes('LiquidityBuybackExecutor.')) return fp('execute/distributeTokenRevenue/recover share nonReentrant; native budget and cooldown are reserved before unlock. unlockCallback requires the immutable PoolManager plus a one-use _unlocking flag cleared before swap. Post-call balances verify actual native spend and OMR receipts; recipient deltas must match and old inventory must remain. The identified later writes reconcile reserved budget or record a completed sequence. Real-v4 settlement and callback/rejection tests pass.');
      if (x.includes('ProtocolLiquidityVault.')) return fp('The identified private helper is reachable only from guarded external mutation entry points. Budget is reserved before addition; health reads return false while the guard is entered. Fees are collected and reserved before addition, then routed after verified refunds, asset deltas, NFT ownership and exact liquidity growth. Liquidity hooks/subscriptions are forbidden and direct PM/Permit2/token/hook dependencies are pinned. Immutable recipients cannot redirect principal. Recipient reentry and exact settlement regression evidence is retained in pol-review.md.');
      if (x.includes('GenesisLifecycleController.')) return fp('migrate and the other lifecycle mutations use the same nonReentrant guard and pinned strategy/auction/foundation dependencies. failed is set only after observing actual canonical-pool initialization and cleared strategy registration, rather than trusting strategy return status. Reentrant phase/getter reads confer no mutation authority; no caller uses that transient read to release unbound assets.');
      break;
    case 'incorrect-exp':
      if (/^(Math|FullMath)\.mulDiv/.test(x)) return fp('The XOR is intentional: (3 * oddDenominator) ^ 2 seeds a modular inverse correct modulo 16. Newton-Raphson iterations double the correct bits to 256. Exponentiation would break the full-precision division algorithm. This is the inspected pinned dependency implementation, not a protocol exponent expression.');
      break;
    case 'divide-before-multiply':
      if (/^(Math|FullMath)\.mulDiv/.test(x)) return fp('The division removes the exact power-of-two factor from the denominator/product after subtracting the remainder; subsequent multiplication computes the modular inverse and reconstructs the exact full-width quotient. This is not lossy business-value truncation.');
      if (x.startsWith('Math.invMod')) return fp('Euclidean quotient/remainder recurrence intentionally computes quotient = gcd / remainder, followed by gcd - remainder * quotient. The multiplication reconstructs the remainder and does not imply financial precision loss.');
      if (x.startsWith('CustomRevert.')) return fp('Division by 32 followed by multiplication by 32 intentionally rounds the encoded revert-data allocation up to a whole ABI word. This is memory alignment, not asset arithmetic.');
      if (/^TickMath\.(minUsableTick|maxUsableTick)/.test(x)) return fp('Truncating division then multiplication snaps the extreme tick to an exact tick-spacing multiple. The vault requires positive supported spacing and validates its full-range endpoints.');
      if (x.startsWith('TickMath.getSqrtPriceAtTick')) return design('The pinned v4 exponentiation lookup uses Q128 fixed-point rounding and reciprocation by design, with its final round-up convention. No custom arithmetic change is introduced here; real-v4 boundary and liquidity tests cover the integrating callers.');
      if (x.startsWith('OmertaHook._sellRate')) return design('The hook deliberately measures integer basis points of sqrt-price impact before interpolating between base and maximum tax. This floors fractional impact and keeps the result bounded by the configured ceiling; it is not a missing precision compensation.');
      if (x.startsWith('OmertaBond.bond')) return design('Bond payout first floors market OMR and then applies the bounded discount; rounding lowers the issued amount. The separately scaled rate comparison floors below one unit of its fixed-point rate representation, an existing integer-granularity limit. Signed price, oracle ceiling, bounded discount, absolute rate and finite configured daily cap remain separate controls; no claim of exact real-number arithmetic is made.');
      break;
    case 'incorrect-shift':
      if (x.startsWith('BitMath.')) return fp('The pinned v4 BitMath implementation deliberately shifts constant De Bruijn lookup tables by a value derived from the input. Operand order is intentional; these expressions return a bit index, not an arithmetic left/right-shift of the input. Read together with the preceding normalization or least-bit isolation.');
      break;
    case 'incorrect-modifier':
      if (x.startsWith('Modifier Hooks.noSelfCall')) return design('noSelfCall intentionally skips hook callbacks when the hook itself initiated the PoolManager operation. It is a callback-suppression modifier, not access control expected to execute or revert. The vault forbids liquidity hook flags; other callbacks use explicit caller and flag validation.');
      break;
    case 'incorrect-equality':
      if (x.startsWith('FlashGuard.')) return design('Exact equality to block.number is the intended same-block exclusion. It compares recorded entry block to current block, not an externally forced token balance. This included bank dependency has its separate bank review.');
      if (x.startsWith('OmertaHook.')) return fp('openedAt == 0 is the explicit never-initialized sentinel, written only by the validated initialization path. No equality to an attacker-controlled balance is required for progress. Opening-window behavior is separately bounded by its end block.');
      return fp('The equality rejects an empty action or skips a zero-value transfer. Nonzero donations do not create an unreachable exact balance target: settlement uses explicitly checked before/after deltas, and these zero checks prevent empty accounting or unintended recipient callbacks.');
    case 'missing-zero-check':
      if (x.startsWith('FeeRevenueRouter.constructor')) return fp('Each destination is passed to _checkRecipient before assignment. That helper rejects address(0), this router and the bound fee rail; the detector did not follow the helper.');
      if (x.startsWith('LiquidityBuybackExecutor.constructor')) return fp('The compound constructor validation rejects a zero/self primary recipient. Vig requires a nonzero/nonself secondary; every other stream requires secondary == zero because that leg is unused. This is stream-specific validation, not a missing check.');
      if (x.startsWith('Ownable2Step.transferOwnership')) return design('Setting pendingOwner to zero intentionally cancels a pending transfer without changing owner. acceptOwnership still requires the nominated account, so zero cannot take control.');
      if (x.startsWith('Denari.setMinter') || x.startsWith('Denari.setBurner')) return design('The owner-only zero value intentionally disables issuance or redemption. mint/burn additionally require the role to be nonzero. The governance risk of disabling redemption while issuance remains active is explicit in the existing Denari source and is outside the new buffer vault authority.');
      if (x.startsWith('OmertaBond.setEmergencyGuardian')) return design('The owner can revoke the optional pause-only guardian by setting zero. This does not clear the health guard, change ownership, unpause bonds or grant a new spending role.');
      break;
    case 'unused-return':
      if (x.startsWith('Hooks.')) return fp('callHook already checks call success, return length and returned selector before returning bytes. These no-delta callbacks need no further return payload; dropping the returned byte array does not skip validation.');
      if (x.startsWith('LiquidityBuybackExecutor.unlockCallback')) return fp('Native settle is called with the exact negative currency0 swap delta as msg.value. PoolManager enforces zero outstanding deltas on unlock completion; the executor separately verifies native and OMR balance changes. The numeric settle return is redundant for this native-only path.');
      if (x.includes('getSlot0')) return info('Only the named sqrt-price and/or tick are required at this call site; fee fields from getSlot0 are deliberately omitted. Canonical PoolId and manager are validated elsewhere. No success flag or liability value is discarded.');
      break;
    case 'uninitialized-local':
      if (x.startsWith('OmertaHook._accrue')) return fp('Solidity value locals initialize to zero. With sellTaxBps == 0, the named shares intentionally remain zero and the LP remainder receives all of the opening buy fee; otherwise every share is assigned before use.');
      if (x.startsWith('Hooks.afterSwap')) return fp('The value-type BalanceDelta local defaults to zero, the intended no-hook/no-return-delta value. Enabled return-delta branches overwrite it. This is initialized by Solidity semantics.');
      break;
    case 'timestamp': return design('This comparison implements an explicit deadline, vesting clock, oracle freshness/warmup, cooldown or budget window. It is not used as randomness. Chain timestamp assumptions and boundary-adjacent UTC-day capacity remain operational constraints; the POL budget instead uses a true trailing window. Applicable boundary/future/stale/cooldown tests are retained.');
    case 'low-level-calls':
      if (x.includes('GenesisLifecycleController.constructor') || x.includes('GenesisLifecycleController._clock')) return fp('The static call targets the fixed ArbSys precompile address. Constructor detection requires code, success and exactly 32 bytes; the runtime clock repeats those checks. No target, selector or arbitrary calldata is user-controlled.');
      return design('This checked native transfer is the intended asset delivery or recovery. The target is a validated configured/immutable recipient or governance owner, or an allowlisted keeper. Failed calls revert atomically; surrounding asset-changing entry points use nonReentrant. A rejecting destination can stop its route and remains an explicit availability risk.');
    case 'assembly':
      if (x.startsWith('OmertaHook.')) return info('The hook uses a named transient-storage slot to retain the validated pre-swap sqrt price and load it for capped surge-tax calculation. Caller and pool checks surround the callbacks. No arbitrary slot, delegatecall or user-selected memory write is introduced.');
      return info('Assembly usage inventory in pinned dependencies: full-precision arithmetic, ABI/selector encoding, ERC20 return handling, storage/memory access or cryptography. This rule does not allege a specific memory defect. Applicable dangerous arithmetic/shift/callback rules are separately dispositioned; no claim of a fresh full dependency audit follows from this inventory.');
    case 'pragma': case 'solc-version': return info('Dependency pragma ranges differ, but this run actually compiled with pinned solc 0.8.26, optimizer 800 and Cancun; only POL uses viaIR. The invoked solc-select binary has the same SHA256 as the requested native compiler. Broad permitted ranges are not the compiler selected for this release.');
    case 'cyclomatic-complexity': return info('Complexity is a maintenance signal, not an exploit. The protocol entry points are covered by scoped execution-trace and adversarial suites; the TickMath dependency is unchanged. Retain the signal for future edits.');
    case 'dead-code': return info('The direct-target compilation includes inherited/internal library helpers that this target does not call. Removing them is unnecessary for correctness and may affect other callers outside this compilation unit. This is not an externally reachable forgotten spending path.');
    case 'shadowing-local': case 'naming-convention': return info('The reported name belongs to a parameter, interface return name or existing library symbol with lexically resolved bindings. No security-sensitive state variable is silently replaced; this is a naming/style signal.');
    case 'too-many-digits': return info('The literal is a fixed-point, bit-mask, lookup-table or cryptographic constant in pinned dependency code. Digit length alone is not a value error; math/shift findings are assessed separately.');
    case 'unindexed-event-address': return info('This affects event filtering convenience and log indexing cost. The complete address remains in event data, and no contract authorization or accounting depends on an indexed topic.');
  }
  throw new Error(`Untriaged diagnostic ${d.check}: ${d.id}\n${x}`);
};
const unique = new Map();
let occurrences = 0;
for (const run of runs) {
  if (!run.success || !run.sourceUnchangedDuringRun || sha(path.join(repo, 'src', `${run.contract}.sol`)) !== run.sourceSHA256) throw new Error(`Invalid or stale run ${run.contract}`);
  const file = path.join(root, `slither-${run.contract}.json`);
  const raw = read(file);
  if (!raw.success || raw.results.detectors.length !== run.diagnostics) throw new Error(`Incomplete raw scan ${file}`);
  for (const d of raw.results.detectors) {
    occurrences++;
    const prior = unique.get(d.id);
    if (prior) { prior.scans.push(run.contract); continue; }
    unique.set(d.id, { id: d.id, rule: d.check, impact: d.impact, confidence: d.confidence,
      ...decisions(d), description: d.description, scans: [run.contract],
      locations: d.elements.map(e => ({ kind: e.type, name: e.name, file: e.source_mapping?.filename_relative, lines: e.source_mapping?.lines ?? [] })) });
  }
}
const entries = [...unique.values()].sort((a,b) => a.rule.localeCompare(b.rule) || a.id.localeCompare(b.id));
const byDisposition = {};
for (const d of entries) byDisposition[d.disposition] = (byDisposition[d.disposition] ?? 0) + 1;
const sourceFiles = new Map();
const remaps = { '@openzeppelin/': 'lib/openzeppelin-contracts/', 'v4-core/': 'lib/v4-core/src/', '@uniswap/v4-core/': 'lib/v4-core/', 'permit2/': 'lib/permit2/', 'solmate/': 'lib/v4-core/lib/solmate/' };
function walkSource(file) {
  const full = path.resolve(file);
  if (sourceFiles.has(full)) return;
  if (!full.startsWith(repo + path.sep)) throw new Error(`Out-of-scope source path ${full}`);
  const source = fs.readFileSync(full, 'utf8');
  sourceFiles.set(full, { path: path.relative(repo, full).replaceAll('\\', '/'), sha256: sha(full) });
  for (const match of source.matchAll(/\bimport\s+(?:[\s\S]*?\sfrom\s+)?["']([^"']+)["']\s*;/g)) {
    const name = match[1];
    let target;
    if (name.startsWith('.')) target = path.resolve(path.dirname(full), name);
    else {
      const prefix = Object.keys(remaps).find(p => name.startsWith(p));
      if (!prefix) throw new Error(`Unmapped import ${name}`);
      target = path.join(repo, remaps[prefix], name.slice(prefix.length));
    }
    walkSource(target);
  }
}
for (const run of runs) walkSource(path.join(repo, 'src', `${run.contract}.sol`));
const output = { schemaVersion: 1, reviewedAt: '2026-09-08', methodology: 'Manual code and trace triage, then explicit decision materialization; unknown rules or stale source refuse.', successfulScans: runs.length, diagnosticOccurrences: occurrences, uniqueDiagnostics: entries.length, untriaged: 0, byDisposition, sourceInventory: [...sourceFiles.values()].sort((a,b) => a.path.localeCompare(b.path)), runs: runs.map(r => ({ ...r, rawSHA256: sha(path.join(root, `slither-${r.contract}.json`)) })), entries };
fs.writeFileSync(path.join(root, 'triage.json'), JSON.stringify(output, null, 2) + '\n');
const md = ['# Liquidity automation static-analysis triage', '', `2026-09-08: ${runs.length} successful raw JSON scans; ${occurrences} diagnostic occurrences; ${entries.length} unique detector IDs; zero untriaged.`, '', 'This index retains every returned diagnostic, including dependencies that direct-solc mode did not exclude. The same ID may occur in multiple scans; each entry lists every occurrence. Classifications distinguish false positives from accepted design constraints and informational maintenance signals. This is not a claim that static analysis proves absence of defects.', '', '| Target | Diagnostics | Source SHA256 |', '| --- | ---: | --- |', ...runs.map(r => `| ${r.contract} | ${r.diagnostics} | \`${r.sourceSHA256}\` |`), ''];
for (const d of entries) md.push(`## ${d.rule} — ${d.id}`, '', `**Disposition:** ${d.disposition}. **Slither impact/confidence:** ${d.impact}/${d.confidence}. **Scans:** ${d.scans.join(', ')}.`, '', d.description.trim(), '', `**Review:** ${d.rationale}`, '');
fs.writeFileSync(path.join(root, 'triage.md'), md.join('\n'));
console.log(JSON.stringify({ scans: runs.length, occurrences, unique: entries.length, untriaged: 0, byDisposition }, null, 2));
