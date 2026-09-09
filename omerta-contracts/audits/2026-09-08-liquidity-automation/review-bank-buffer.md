# Bank buffer vault boundary review

Date: 2026-09-08. Release phase: local implementation and regression evidence only. No deployment,
funding, live bank transaction, debt-authority change or activation occurred.

## Scope and pinned source

This review covers the new `BankBufferVault` and its direct integration with the existing real
`Transmuter` and `Denari`. Base repository commit is `e1d0e8476b6f1ebf590b13bd07c072d9d9d33aee`;
the vault and tests are new working-tree files. The existing Transmuter and Denari were read and
exercised but not changed by this work.

| File | SHA-256 at executed regression |
| --- | --- |
| `src/BankBufferVault.sol` | `cb164cca28e567371a25dc1933cd1f1ce3f400514dcc5b1357ad9b9d8c08a4be` |
| `test/BankBufferVault.t.sol` | `df10b528a0481d2b4bff73df91c64e7fa26d9241f13dbbee351ec43bf1d4e530` |
| `src/Transmuter.sol` | `21264df1c5a45f90658a3e09e6abb8ff7e75dd66bb4b5e2211b3f4166b871540` |
| `src/Denari.sol` | `f1ac4f24d2491d9b4c576670447526be4d3c08449427801619fdf570293b08fe` |
| `out/BankBufferVault.sol/BankBufferVault.json` | `09c692e7ef1b74c324493beefe66c992950443211a953cf44481d3d4553771b4` |

Compiler: Solidity 0.8.26, optimizer enabled with 800 runs, Cancun EVM target. Tool: Forge 1.7.1,
commit `4072e48705af9d93e3c0f6e29e93b5e9a40caed8`. The compiled artifact includes source metadata
for the vendored OpenZeppelin dependencies. Their relevant implementations were followed through
`SafeERC20.forceApprove`, exact transfers, `Ownable2Step`, `Pausable` and `ReentrancyGuard`.
Artifact hashes describe local compiled templates; no deployed chain/address/runtime is claimed.

Methods: the pinned Pashov adversarial access/execution passes, Plamen token-flow and accounting
passes, and Trail of Bits trust-boundary/property methods recorded in
[`SECURITY-REVIEW-POLICY.md`](../../SECURITY-REVIEW-POLICY.md) were adapted to this bounded
integration. Applied work includes authority mapping, independent conservation assertions,
stateful sequences, fee/debit/allowance adversaries, callback attempts and configuration drift.
No complete upstream orchestration or independent static-analysis run is claimed here; static
diagnostics and triage belong to the coordinating release package.

Excluded: economic sufficiency of the configured buffer ratio, complete Alchemist or ERC-4626
integration, a real reserve asset's solvency, bank activation, downstream database receipt booking
and the keeper deployment manifest. Existing bank tests provide regressions; they are not a new
review conclusion about an arbitrary production backing vault.

## Model and verified behavior

The vault holds only prefunded backing tokens. It owns no Denari minter/burner authority, chooses
no fee split, issues no debt and has no generic call path. Constructor bindings are immutable:
the backing asset, exact Transmuter, current runtime hashes and positive action/day budgets.
Governance must separately allow this vault through the existing `Transmuter.setFunder` policy.

| Entry point | Authority | Exact effect |
| --- | --- | --- |
| Backing-token transfer into vault | Any asset holder | Prefunds actual spendable backing; creates no debt or repayment entitlement. |
| `fundingAmount` | Read-only | Returns the minimum of current tracked deficit, per-action cap, remaining UTC-day budget and vault balance; zero if paused or no positive amount is due. Dependency drift reverts. |
| `fundDeficit` | Anyone, while unpaused | Recomputes the amount on chain and transfers only through immutable `Transmuter.fund(amount)`. Caller provides no amount, recipient, payload or debt choice. |
| `pause` / `unpause` | Current governance owner | Stops/resumes funding without resetting spent budget. |
| `recover(amount)` | Current governance owner, while paused | Returns only backing tokens to that same current owner, with exact transfer accounting. |
| Inherited two-step ownership | Current/pending owner | Controls the limited governance paths; cannot replace asset, destination or limits. |

Funding reserves both action accounting and shared daily accounting before the external calls.
The approved allowance equals the computed amount and is reset to zero immediately after funding.
Successful execution requires the vault's actual backing decrease, Transmuter's actual backing
increase, and Transmuter's tracked reserves increase all to equal that amount, plus zero remaining
allowance. Failure rolls back all approvals, transfers, tracked reserves and budget entries.
Reentrant funding is rejected by the guard. Token donations directly to the Transmuter remain
outside tracked reserves, as its accounting specification requires.

The current buffer requirement follows outstanding debt. For example, after a real 100 DNR
redemption from 1000 DNR outstanding and 200 backing units reserved, supply is 900 DNR, reserves
are 100 units and the 20% requirement is 180 units. This vault funds at most the resulting 80-unit
deficit; it neither remints the redeemed debt nor pays a second redemption.

## Executed evidence

Command from `omerta-contracts`, with `FOUNDRY_INVARIANT_RUNS=128` and
`FOUNDRY_INVARIANT_DEPTH=64`:

```text
forge test --match-contract '^(BankBufferVaultTest|BankBufferVaultInvariantTest|BankTest|TransmuterFundingRedTeamTest)$' --fuzz-seed 0x20260908 -vv
```

Result: **66 passed, 0 failed, 0 skipped; exit 0**. Raw output is
[`forge-bank-buffer.txt`](../../../output/liquidity-automation/forge-bank-buffer.txt), with
[`forge-bank-buffer-exit.txt`](../../../output/liquidity-automation/forge-bank-buffer-exit.txt).

- 17 new focused unit/fuzz tests, including a 512-case minimum/deficit/balance property.
- One new stateful invariant: **128 runs × 64 calls = 8192 calls**, zero handler reverts. Randomized
  operations prefund, issue test debt through an explicitly assigned test minter, redeem real
  Denari through the real Transmuter, fund the buffer and advance UTC time. The invariant checks
  exact backing conservation, cumulative tracked funding, destination reserves, redemption output,
  action/day limits and zero standing approval. The test minter is the harness, never the vault.
- 45 existing `BankTest` regressions, including three 512-case fuzz properties.
- Three existing `TransmuterFundingRedTeamTest` regressions.

Focused cases execute actual Transmuter and Denari logic with an explicitly identified test backing
asset. They cover invalid bindings/limits, permissionless caller neutrality, shared UTC-day budget,
exact deficit after real redemption, prefunding exhaustion, ignored direct donations, zero-supply
seed behavior, funder revocation, pause/recovery and ownership rotation, token runtime replacement,
fee-on-transfer, extra sender debit, ignored approval reset and token callback reentry. The hostile
asset properties are deliberate mocks; this report does not claim a reviewed live backing asset.

## Hypothesis disposition and residual constraints

No confirmed new asset-redirection, unmetered-transfer or reentry defect was established in this
scope. Tested hypotheses that a caller could select a payout, a direct donation could replace
tracked funding, a fee/debit token could silently inflate reserves, approval could remain spendable,
or callback funding could exceed the action/day policy were rejected by the exercised boundaries.

1. Runtime hashes detect changes to the supplied runtime bytes. They do not authenticate that the
   initial asset/Transmuter is canonical, and cannot detect a proxy implementation change if proxy
   runtime bytes remain unchanged. Production preflight must bind the reviewed concrete contracts,
   debt asset, owner roles and any upgrade mechanisms; raw code-hash equality alone is insufficient.
2. This is a finite prefunded buffer, not a self-funding reserve. An empty vault or exhausted daily
   budget leaves the remaining deficit visible. UTC-day caps are calendar-day caps, not rolling
   24-hour caps. Multiple callers share one on-chain budget.
3. At zero debt supply the requirement is zero, so this vault deliberately cannot seed the first
   issuance. Governance must seed through the existing reviewed funder path before bank issuance.
4. Governance still controls the Transmuter's buffer ratio and funder allowlist. Revocation or a
   dependency that refuses funding stops progress without consuming funds. Ratio economics and
   underlying/ ERC-4626 backing risk remain separate review requirements.
5. A nonstandard or malicious asset can refuse transfers or lie in balance/allowance reads. Exact
   observed deltas detect the tested mismatches but do not make arbitrary tokens trustworthy.
   Paused recovery likewise depends on the asset honoring transfers.

The new bounded funding path passes its targeted and integration regressions at the hashes above.
This conclusion does not activate THE BANK or replace its concrete asset/ERC-4626 review.
