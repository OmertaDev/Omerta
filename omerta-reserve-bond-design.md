# OMERTÀ — inventory bonds

The canonical market sells prefunded OMR inventory for native ETH through [`OmertaInventoryBondV2`](omerta-contracts/src/market-v2/OmertaInventoryBondV2.sol). Read the [market design](omerta-contracts/docs/market/DESIGN.md) and [runbook](omerta-contracts/docs/market/RUNBOOK.md) for the complete market and deployment requirements. Source availability does not establish deployment, funding or an active sale.

## Purchase and funding

Anyone may fund inventory by transferring OMR into the contract; the received balance must match the requested amount exactly. A purchase reserves its entire OMR entitlement from that inventory immediately. ETH proceeds accrue to an immutable recipient; the market wiring routes that recipient through the War Chest funding adapter. The bond accepts native ETH, not LP tokens, and creates no token issuance authority.

The buyer supplies an expected observation epoch, minimum OMR output, deadline and nonzero nonce. The deadline must be no more than five minutes ahead. Quotes require a fresh, valid canonical-market observation, sufficient observed and current liquidity, and bounded spot deviation. The reference rate must not exceed `maxOmrPerEth`; the configured discount then determines the OMR amount. A quote is not a reservation: purchase checks the remaining inventory and budgets again.

## Terms and limits

- The discount is immutable for a deployment and cannot exceed **10%** (`discountBps <= 1000`). It is a purchase-price discount, not an interest rate or guaranteed return.
- The immutable linear vesting term is between **one and 365 days**. The constructor does not choose one universal launch term.
- Positive ETH and OMR limits apply per purchase, per observation epoch and over the contract's lifetime. Funding more inventory does not reset aggregate purchase budgets.
- Nontransferable notes bind the buyer and nonce to this chain and contract. Reusing a note identity cannot reserve inventory twice.
- `availableInventory`, `outstandingClaims` and `proceedsOwed` are separate accounting obligations. Actual assets must cover them.

The [contract](omerta-contracts/src/market-v2/OmertaInventoryBondV2.sol) and selected deployment configuration determine exact minimum purchase, maximum purchase, discount, vesting, observation age, liquidity requirement and total sale capacity. Do not import figures from an example manifest into public terms without verifying the deployed configuration.

## Claims and control

Vested OMR can be claimed even when purchases are paused, sale inventory is exhausted or the oracle is unavailable. Anyone may submit a claim, but tokens always go to the recorded beneficiary. The proceeds recipient claims its actual accumulated ETH separately. The Safe can pause purchases and retire available, uncommitted inventory; it cannot use that retirement function to consume outstanding note claims.

The bond has no mint function, sellback quote or promise to redeem notes for ETH. A holder who later sells OMR in the canonical market still pays the applicable sell fee, LP fee, price impact and gas. A discount alone does not establish a profitable exit.

## Token and liquidity boundaries

The bond's no-mint design is not a fixed-supply guarantee for OMR itself. [`OMR.sol`](omerta-contracts/src/OMR.sol) gives the token owner separate minter-appointment authority. Inspect that owner and minter configuration independently.

Bond proceeds funding the War Chest do not grant buyers ownership of controller liquidity, an irrevocable liquidity lock, a price floor or a claim on other protocol reserves. Controller custody and recovery powers follow the [market design](omerta-contracts/docs/market/DESIGN.md).

Review conclusions apply only to their pinned source and release phase under the [security review policy](omerta-contracts/SECURITY-REVIEW-POLICY.md). Funding and activation require the checks in the current runbook.
