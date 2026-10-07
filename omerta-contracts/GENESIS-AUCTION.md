# Genesis auction

The [approved founder terms](GENESIS-FOUNDER-TERMS.md) define one five-day native ETH auction for OMR. Character NFT ownership is the bid whitelist; both paid and free-credit mints qualify. There is no gameplay snapshot, separate player allocation or individual economic cap. NFT ownership is checked on each bid's recipient and does not revoke existing refund/claim rights after transfer.

40M of the existing 100M supply is offered, 20M funds the LP, and 40M stays in the Safe for the later bond desk. All custody uses the approved Safe; unsold auction tokens are separately accounted. The floor corresponds to a 10 ETH sale of the offered 40M, with a 10 ETH graduation requirement.

The coordinator uses 50% of accepted ETH with approximately 20M OMR to initialize full-range liquidity at the funded asset ratio, with tightly bounded rounding. The pool price is independent of and can be below the last auction price. Remaining accepted ETH is credited entirely to the Safe's Family Yield treasury. LP custody is the Safe, approvals are revoked atomically and failed migration rolls back. Holding the treasury ETH does not activate in-game reward conversion or payouts.

Claims become available at successful auction closure after bid exit, independently of migration. Completed purchases are final; exits return unused ETH and failed graduation returns deposited ETH. No extra vesting applies. Operations checkpoint and migrate after closure without delaying claim rights.

Market tax governance follows the [Committee specification](COMMITTEE-TAX-PROPOSAL.md). Safe-only queued changes have a 48-hour delay, preserve accrued fees and receiving addresses, and cannot change the fixed 2% founder/operations portion. The LP fee stays static at 0.3%; tax governance cannot change auction proceeds or user claim rights.

The target is approximately October 9 noon New York through October 14 noon. Native block-clock calibration determines actual boundaries. A segmented integer schedule releases tokens approximately evenly, with disclosed rounding and no large final-block cliff.

Follow the [deployment checklist](GENESIS-LAUNCH-STEPS.md). Five EOA deployments plus four funding/configuration calls are required. The auction internally creates its NFT validator and read-only schedule store, producing seven total addresses. The guarded route is deployed directly; legacy external CCA/LBP factories and older player-sale tools do not construct it.

All release conclusions are source- and phase-specific. Revised financial tests and example live-dependency forks do not replace independent review, hosted gates, final-plan native-clock simulation, runtime/recipient verification, funding, pinned site configuration or a user-signed production test. PR #191 remains a draft during these checks. Earlier review packages are retained as historical evidence.
