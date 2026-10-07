# Committee tax configuration proposal

Requested October 6, 2026. The founder confirmed a permanent 2% sell-value operations rate and its existing recipient, plus Safe-executed Committee proposals with a 48-hour delay. The launch LP fee remains the already-approved static 0.3%; dynamic LP fees are not authorized. The extension is implemented and undergoing independent/release checks; no governance authority is deployed.

## Intended scope

Keep the approved launch settings. Permit Committee decisions to change future market tax rates and non-founder allocation percentages. The founder/operations portion must remain unchanged. Auction 50/50 proceeds allocation, closure claims, NFT eligibility, bond custody, liquidity ownership and accrued obligations are outside this authority.

Current market sell base: 9% of the taxed swap amount, apportioned 2% developer/operations, 1.6% RWA, 2.4% community and 3% protocol liquidity. A separately accrued pressure surcharge is at most 1%. The proposed base LP swap fee is 0.3%; opening buy penalties and caps are disabled.

## Required invariants

- Founder/operations percentage is an absolute percentage of the taxed swap amount, not a fraction of the mutable tax pool. A changing total tax must not change this fixed slice. The proposed locked value is the current 2%, subject to owner confirmation.
- The Committee cannot change that rate, waive it through a special trading route, or retroactively reallocate accrued fees. The recipient is permanently locked to `0xA87b7A7eEcB6f4c771445f5cBa5bb0d4b29E5ceD` in the production instance.
- Every new configuration must conserve its fee amounts and obey explicit hard bounds; the existing 10% hook-tax ceiling is the proposed safety boundary. Rounding must be allocated deterministically without reducing the founder/operations entitlement.
- Fixed receiving addresses remain distinct from percentage configuration; allocation changes do not authorize arbitrary recipient changes or withdrawals.
- Changes apply prospectively, are publicly queued and emitted, and have an explicit effective time. Neither an owner change nor a parameter update may reset consumed budgets or reopen a launch restriction.
- Swaps read bounded local configuration, without arbitrary Committee, oracle or recipient callbacks. Refunds, claims and genesis accounting remain independent of Committee configuration.

## Confirmed authority design

Confirmed launch design: Committee proposals recorded for review, the existing Safe as on-chain executor, and a 48-hour delay before a queued configuration can take effect. Queue, cancellation and execution all require the Safe. Passing the delay does not automatically execute a change. This is a trusted Safe execution process, not cryptographic proof of an in-game vote. Safe owners cannot rewrite earlier entitlements. A separate token-voting authority is not part of this approval.

A separate deployed governor is not necessarily required: the immutable Safe authority and queued bounded configuration can live in the hook, subject to code-size, callback gas and independent review. This can preserve five EOA deployments. Constructor arguments and hook mining would change, invalidating the previous signing packet and runtime hashes.

## LP fee decision

The existing 0.3% LP fee is part of a static Uniswap pool key. Changing game-tax percentages does not change it. Reconfigurable LP fees require an explicitly configured dynamic-fee pool before initialization; the existing static pool cannot silently be treated as dynamic. The approved launch uses the static 0.3% fee.

## Launch decision

The launch keeps the previously approved static LP fee at 0.3%. Dynamic LP fees are outside the selected tax-governance scope.

Implementation and the focused/full contract checks passed. Independent retesting and final release verification remain required before signing. No signing, deployment or activation is performed by this proposal.
