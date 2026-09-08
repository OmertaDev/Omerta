# Shared static diagnostics and dependency limits — 2026-09-08

Every diagnostic occurrence from the **31 selected successful Slither runs** has a disposition or a
reference to its contract review in [shared-static-triage.json](shared-static-triage.json). The result
contains **1,616 raw occurrences, 561 distinct diagnostic IDs, and zero unassigned occurrences**.
These numbers describe tool output, not vulnerabilities or independent security findings.

The selected input files are defined by [static-run-selection.json](static-run-selection.json).
Repeated attempts, failed aggregate compilations, the Hook structural printer, and ERC conformance
logs are not silently added to that count. Their retained logs remain separate evidence. The
GearVault ERC warning is resolved below without presenting its tool invocation as a clean check.

| Disposition owner | Raw occurrences | Distinct diagnostic IDs |
| --- | ---: | ---: |
| Core review | 52 | 52 |
| Market review | 89 | 63 |
| Acquisition review | 179 | 179 |
| Shared dependencies and local interfaces | 1,296 | 267 |
| Total | 1,616 | 561 |

There are 1,055 repeated occurrences beyond the first instance of each diagnostic ID, in 188 repeated
ID groups. At generation, there are **no multiply assigned occurrences and no IDs assigned to
multiple review groups**. The JSON retains `duplicateGroups`, `crossGroupOverlaps`, and
`multiAssignedOccurrences` explicitly, including the empty overlap sets. A `coverage` row identifies
the source run, raw file, detector array index, exact ID and assigned review for all 1,616 occurrences.
Each of the 267 shared diagnostic records includes its original description, locations, reported
severity/confidence, explicit disposition and every selected occurrence. Repeated library diagnostics
therefore remain traceable without becoming extra findings.

The source baseline is repository commit `e1d0e8476b6f1ebf590b13bd07c072d9d9d33aee` plus the
working-tree content hashes in [source-before.json](source-before.json). This pass pins **75 local
source files**, all matching that baseline byte-for-byte. It also pins each raw input and prior triage
file it consumes. The vendored `lib/` directories resolve Git queries to the enclosing repository;
this report does **not** infer an independent upstream commit or package version from that result.
The canonical build selects native Solidity 0.8.26, optimizer 800 and Cancun with its per-file via-IR
configuration. Imported pragma ranges are not additional selected compiler versions.

| Shared rule | Raw occurrences | Distinct IDs | Disposition |
| --- | ---: | ---: | --- |
| `incorrect-exp` | 19 | 3 | Intentional modular inverse seeds or Base64 alphabet XOR. |
| `divide-before-multiply` | 160 | 23 | Exact modular division, Euclidean remainder, byte allocation, or defined fixed-point/tick rounding. |
| `incorrect-shift` | 2 | 2 | Intentional bit-table lookups; bounded mathematical cross-check retained. |
| `incorrect-modifier` | 2 | 1 | Hook callback recursion suppression intentionally skips its body for self-calls. |
| `uninitialized-local` | 2 | 1 | Zero-initialized `BalanceDelta` is the intended no-delta result. |
| `unused-return` | 12 | 6 | `callHook` already validates call success and returned selector. |
| `missing-zero-check` | 20 | 1 | Zero pending owner cancels a pending two-step transfer; current ownership is preserved. |
| `timestamp` | 4 | 1 | Signed ERC-20 permit expiry. |
| `assembly` | 725 | 122 | Assembly presence inventory, with additional tracing only for the named paths below. |
| `dead-code` | 97 | 27 | Internal helper unused in that selected compilation. |
| `solc-version` | 74 | 39 | Imported pragma-range observations; actual compiler remains pinned. |
| `naming-convention` | 46 | 20 | ABI/style observations. |
| `shadowing-local` | 10 | 3 | Interface labels or the explicitly forwarded ERC20Permit constructor name. |
| `too-many-digits` | 104 | 15 | Masks, lookup tables, selector/fee flags, scale and sentinel readability. |
| `unindexed-event-address` | 18 | 2 | Paused/Unpaused address-topic filtering limitation. |
| `cyclomatic-complexity` | 1 | 1 | Checked tick decomposition into fixed lookup multiplications. |

The arithmetic findings were checked against their actual expressions. `Math.mulDiv` and
`FullMath.mulDiv` subtract the 512-bit product remainder before factoring powers of two and
multiplying by the inverse of the resulting odd denominator. The intentional XOR provides an inverse
seed correct modulo 16; six Newton/Hensel steps extend it to 256 bits. This is not a premature token
amount division. `Math.invMod` uses the Euclidean quotient/remainder recurrence. Base64 allocation
counts complete/partial groups, and its `0x0670` XOR changes the `+/` suffix to `-_` for URL encoding.
CustomRevert rounds its copied revert payload to a 32-byte ABI boundary. Tick helpers retain their
documented integer/fixed-point rounding and positive-spacing/range preconditions.

For the two BitMath shift warnings, [check-bitmath-model.mjs](check-bitmath-model.mjs) translates the
flagged lookup expressions using 256-bit EVM word semantics and compares them with independent
bit-string/shift references. It passed **2,813 inputs and 5,626 comparisons**, covering every power
of two, adjacent values, `uint256.max`, and 2,048 deterministically hashed words. The command,
runtime, input construction, source hash and limitations are retained in
[bitmath-model-result.json](bitmath-model-result.json). This is a bounded mathematical cross-check;
it does not execute Solidity bytecode or prove the full uint256 input domain.

`Hooks.callHook` was followed through its successful call, allocated return-data copy, minimum
length and selector check. The six flagged void dispatchers have no further return value to consume;
delta-bearing paths check and parse their declared return. `Hooks.noSelfCall` skips the callback
when the hook initiated the action, while the surrounding manager operation continues. This local
dispatcher review does not verify any deployed PoolManager or third-party hook address. The
`afterSwap` zero-value result is an intentional zero-initialized int256-backed `BalanceDelta`.

The assembly notices are **not** labeled as a proof of every library helper. Additional source tracing
covered SafeERC20 call-success/return handling and scratch-memory restoration, ERC receiver revert
propagation, ERC1155 singleton-array construction, Base64 encoding, mulDiv, hook response validation,
terminal revert-data encoding, and the BitMath expressions above. Other presence-only rows state
their limited review depth explicitly; no whole-function memory-safety proof is claimed. Unused
internal helpers are compilation-local observations and were not deleted from shared dependencies.
Actual adapter/vault/token implementations, asset behavior, deployed code identity, and network
assumptions require their separate concrete integration review.

The inherited **GearVault ERC-1155 batch-event warning is a false positive**. The raw log
`output/comprehensive-audit/erc-GearVault.log` ends with
`safeBatchTransferFrom must emit TransferSingle or TransferBatch`; it was not discarded.
GearVault inherits the following path without overriding any of these functions:

1. `ERC1155.safeBatchTransferFrom`, lines 105–114, authorizes the sender and invokes
   `_safeBatchTransferFrom`, lines 259–273.
2. `_safeBatchTransferFrom` rejects zero endpoints and calls the **six-argument**
   `_updateWithAcceptanceCheck`, lines 204–224, with `batch = true`.
3. That function calls `_update`, lines 137–171. `_update` rejects mismatched array lengths and
   insufficient balances, applies balance changes, and emits `TransferSingle` at line 167 for one
   element or `TransferBatch` at line 169 otherwise, including the empty-array case.
4. The receiver callback happens afterward. A rejecting receiver reverts the entire operation,
   including its event and balance changes. A successful batch transfer therefore emits one of the
   required transfer events. Its callback remains the batch callback even for one element.

The optional missing `onERC1155Received` and `onERC1155BatchReceived` notices concern recipient
callbacks, not mandatory methods of the token issuer. The separate GearVault burn/reentrancy
diagnostics are also consistent with this source: `_burn`, lines 346–352, passes `to = address(0)`,
and line 213 gates both callbacks on a nonzero destination. This subtask performed a source trace;
it did not rerun an ERC checker/compiler or add a compiled event regression.

Reproduce reconciliation with
`node omerta-contracts/audits/2026-09-08-comprehensive/triage-shared.mjs` from the repository root.
The script fails on an unhandled rule, an unassigned production-file diagnostic, a changed baseline
dependency, an unsuccessful selected scan, count drift, a stale prior assignment, or a colliding ID.
It completed with exit 0 under Node v24.19.0. No production, test, compiler output or cache files were
modified by this pass. Its conclusion is complete **diagnostic accounting and the specific triage
above**, not a new blanket security assurance for OpenZeppelin, Uniswap, the wider repository or a
live release.
