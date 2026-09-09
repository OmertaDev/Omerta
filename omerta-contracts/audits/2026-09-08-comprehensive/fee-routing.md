# Confirmed economics and destination wiring

Owner confirmation on 2026-09-08: preserve the recorded Path A splits and target Robinhood mainnet, chain 4663. No destination addresses have been supplied for this review; historical testnet addresses are not proposed mainnet recipients.

| Revenue flow | Confirmed allocation | Current implementation |
| --- | --- | --- |
| Gameplay payments / store accounting | 25% Vig, 10% treasury, 15% community, 50% operations | OmertaFees immediately sends 25% to Vig and 75% to feeRecipient. Treasury/community portions of that 75% are backend earmarks; they are not separate automatic ETH transfers. The separate StorePaid route is unbuilt. |
| Postlaunch bonds | 75% liquidity, 15% operations, 5% treasury, 5% Vig | Four on-chain recipients; Vig receives the arithmetic remainder. Mainnet wrapper requires the POL recipient equal the Treasury/Governance Safe. |
| Genesis whole raise | 37.5% liquidity, 25% treasury, 22.5% Vig, 15% founder | Launcher/LBP supplies liquidity first. Successful residual is split 40% treasury, 36% Vig, 24% founder, which gives the whole-raise percentages when 37.5% went to liquidity. Exact realized proceeds depend on launch outcome, dust and the reviewed upstream fee policy. Failed-launch ETH and recovered token dust go to treasury. |

Other existing Path A parameters were preserved: Hook sell tax totals 9% (2% operations, 1.6% treasury, 2.4% community, 3% LP of the trade); canonical venue token-layer sell tax stays zero to avoid adding two independent layers. Bank harvest fee is 20% at deployment, with a backend community allocation of 62.8% of that fee; a zero Bank fee recipient disables collection. Royalty default is 5% to the Safe through ERC-2981 metadata, subject to marketplace enforcement. These mechanisms do not imply automatic remittance wherever the contract has only one recipient.

## Public inputs needed after the review

| Role | Configuration destination |
| --- | --- |
| Vig / buyback wallet | VIG_WALLET; genesis Vig recipient; bond Vig recipient |
| Operator / operations wallet | DEV_WALLET; genesis founder recipient; Hook developer recipient |
| Treasury / governance Safe | SAFE; treasury recipients; postlaunch POL recipient; initial Dynasty royalty recipient |
| Community / family buyback wallet | Separate community Hook recipient and treasury/community funding custody; keep separate from treasury as required by current community accounting |
| Genesis LP position custodian | NFT positionRecipient; specify the Treasury Safe if that is intended, or the exact reviewed locker/custodian |

The governance runbook requires a 2-of-3 Safe and a separate voucher signer. A supplied Safe address permits read-only inspection of its actual owners and modules; there is no need to send private keys. Signer public address and final operational roles are part of later deployment configuration, not fee percentages.

## Custody decision that addresses alone do not resolve

The feeRecipient receives **75%** of gameplay ETH. Only **50%** is operations revenue under the agreed economic split; **10% treasury + 15% community** must be held and remitted for those purposes. Before activating that flow, identify whether that feeRecipient is the operations wallet or a dedicated custody Safe, who remits the earmarked amounts, and how held funds are reconciled with backend entitlements. Supplying a treasury/community address does not itself make the current two-recipient contract pay them. An automatic forwarding contract would be a new implementation requiring its own review; none was silently introduced here.

Actual recipients must be checked for receipt behavior before immutable genesis splitter deployment. Recipient failure reverts the entire distribution and the splitter has no destination rotation. The corrected Hook rejects self-recipient configuration, but final code hashes and CREATE2 artifacts must use the corrected source.
