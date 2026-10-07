# Founder-term reconciliation

Financial source: `ead92ac404788a6792d2b7677fa2d8e6c96fc34b`. Phase: requirements reconciliation, before deployment. Founder confirmations were verified from direct user replies; the source announcement is unpublished. The [confirmed requirements](../../GENESIS-FOUNDER-TERMS.md) supersede the preceding 72-hour and allocation proposals. No contracts, financial source, runtime configuration or economic parameters were changed by this audit. Documentation now explicitly holds execution.

## Findings

| ID | Status | Verified discrepancy / necessary correction |
| --- | --- | --- |
| FR-01 | Open, blocks launch | Planner accepts only the preceding 72-hour duration; a calibrated 120-hour example is rejected. Change planner, schedule tests and current UI/docs to five days after selecting the exact block schedule. Opening remains approximate, not a newly approved timestamp. |
| FR-02 | Open, blocks launch | Sale and reserve amounts are arbitrary, and bond reservation is absent. Enforce 40/20/40 of verified total supply with conserved inventories and approved custody. On observed 100M supply this is 40M/20M/40M; neither bookkeeping nor an untracked ERC20 donation proves funded bond inventory. |
| FR-03 | Open, blocks launch | Claims require migration success and a configurable later cliff. Failed or delayed migration blocks claims after sale closure, contradicting the new requirement. Change the claim policy and tests, preserving graduation, bid ownership and no vesting. A UI edit alone cannot change the contract right. |
| FR-04 | Open, economic policy needed | ETH budget is 37.5% of proceeds; OMR reserve is a maximum, not an exact LP allocation. A tested equal-price 40%-sale example pairs about 15% of total supply and leaves about 5% unused rather than pairing 20%. Select LP price/ETH budget/shortfall policy; prove actual deposit and rounding against the revised allocation. Do not silently set 50% or redirect ETH. |

Source traces show continuous auction fills can have different prices. Therefore raised ETH is not generally final clearing price times tokens sold. Half the raise funds a 20%-of-supply LP only in the equal-price/full-sale illustration; final-price appreciation or undersubscription can require more than half or more than all proceeds. Current coordinator has no general external ETH funding rail. Follow-up decisions now approve Safe custody of the LP and all post-LP ETH for a Safe-held Family Yield treasury. The existing residual split must be replaced; LP budget/price/shortfall policy, bond segregation and unsold destination remain unresolved.

## Properties that match

- Fixed Character NFT admission applies to each bid's recipient on both overloads; distinct relayer payers cannot bypass ownership. No individual economic caps or gameplay-day tiers exist in the selected new API.
- Ownership is admission only. Subsequent NFT transfer does not revoke bid ownership/refund rights. NFT transfer reuse does not enforce unique-person identity, which was not requested.
- Failed graduation returns the bid's full deposited ETH through bid exit. In a graduated auction, filled amounts are final; exits return unused ETH. This is consistent with the founder's clarification and must not be described as refunds of completed purchases.
- Graduated spent principal currently has no cancellation/full-refund override if migration fails. This magnifies the claim-policy and LP-funding release blockers; it is not a reason to promise refunds absent code and approval.
- The backend may refuse preparation if mandatory runtime/dependency verification fails; direct contract recovery rights remain distinct from API availability. A documented direct recovery signing method is needed before launch.

## Retained evidence

Independent contract, planner and periphery reports include exact file pins. Seven existing focused contract traces passed: two migration/claim traces and five NFT/refund traces. A real-artifact offline planner proof rejected a calibrated five-day input. Public-chain reads verified supply and Safe holdings; no signing or live transactions occurred. The previous source review/CI results retain their earlier scope and are not proof of these revised requirements.

The actual Daybreak model is performing a further read-only specification review; its report/provenance is retained separately when available. No absent-test or author self-review is presented as independent coverage.

## Release decision

Not ready for deployment under the revised terms. Keep PR #191 in draft and the signing packet on hold. Numeric floor/ticks/issuance schedule/graduation, LP price/ETH budget/shortfall handling, bond segregation and unsold destination decisions are required before implementation, new source review and final-plan simulation can complete. Approved Safe LP custody and Family Yield ETH routing must be enforced by the revised code. Bond reservation does not itself authorize activating the bond desk. No source merge, production rollout, deployment, funding or activation is performed by this reconciliation.
