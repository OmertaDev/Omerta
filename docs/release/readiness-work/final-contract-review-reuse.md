# Contract review applicability — 2026-09-24

Reviewed candidate: `40ef4e834f1a78a1b81a8bfc4b8407d351467671`, clean checkout. Phase: backend technical qualification; no contract deployment, funding, signer activation, address substitution or new rail activation. This consolidates retained scoped reviews under `omerta-contracts/SECURITY-REVIEW-POLICY.md`; it is not a new blanket contract audit.

All 59 production Solidity files match exact reviewed content after accounting only for LF/CRLF source representation. The applicable packages are the September 8 comprehensive, liquidity and character-mint amendments, September 9 Genesis bootstrap, retained Genesis wallet-cap amendments, and September 13 Market V2 review. No production contract changed since the admitted 1,247-test Foundry result at `8ba78e71705726e430605d905fa2af951728dd16` (workflow `35604360681`). No contract suite was rerun.

The comprehensive, liquidity, mint, bootstrap, wallet-cap and Market V2 packages retain the system models, entry/callee and custody boundaries, adversarial findings, executable regressions/invariants, static dispositions and conclusions required by the policy. They explicitly applied the pinned Pashov `c577eb7799c349de0acb187ba00ca98e14e436fd`, Plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69` and Trail of Bits `d3323cefbcf645678b8dc481de204b02ad3d02dc` methods. This continuation checked their applicability, custody and dispositions; it did not rerun upstream orchestrators or claim a new static scan.

## Verified custody and source applicability

Restricted evidence root: `C:\Users\Jorge\.codex\rc1-readiness-private-20260921`.

| Record | SHA-256 | Verified result |
| --- | --- | --- |
| `final-contract-review-package-verification-40ef4e83.json` | `fe49778233d8b8d13371936d9145e19a5e7d2986435759dc371455e96f12c319` | 59 production source files matched reviewed versions; 806 retained dependency files matched; 462 raw evidence files verified exactly. Every selected source/review binding and evidence location is retained. |
| `final-contract-static-verification-20260924.json` | `d8e6ab893068dccb6e2cf400436440be2e2fe094670b27761fb63362e00ec546` | All 1,616 comprehensive diagnostic occurrences resolve to a raw detector and one triaged assignment; 233 lint dispositions; liquidity 767 occurrences/293 IDs; V2 94 scoped dispositions; bootstrap 118 diagnostics and all 312 sealed package files; mint 16 dispositions. |

The comprehensive reconciliation traverses 29 raw files containing diagnostics. The selected-run inventory also contains two successful zero-diagnostic scans (AcquisitionIntentExecution and AcquisitionReconciliation), for 31 selected scans overall. These are not 31 independent exploit tests. Market V2's other 349 raw diagnostics remain outside that scoped V2 triage and are not newly declared clean; legacy/shared dependency dispositions retain their own scope.

Libraries are fetched by the unchanged hosted workflow rather than committed in this checkout. The 806 comparisons use retained local library content and reviewed content hashes. Hosted pins remain Forge 1.7.1, OpenZeppelin 5.6.1, forge-std 1.9.6, v4-core 1.0.2, v4-periphery `ad04c9f24a170accf5ea1b2836bbafd514537ca6`, and Permit2 `cc56ad0f3439c502c246fc5cfcc3db92bb8b7219`. The V2 manifest's parent-repository SHA values for some non-submodule dependency directories are not treated as upstream dependency commits; content and the explicit workflow pins supply that binding.

`foundry.toml` does not byte-match the retained source-manifest hashes. This is retained explicitly, not hidden as source equality. Its reviewed effective compiler settings remain Solidity 0.8.26, optimizer 800, Cancun, with the listed per-file via-IR restrictions. The V2 artifact manifest independently records those exact V2 settings. The configuration and entire contract tree are unchanged from the admitted full hosted build/test. This conclusion concerns reviewed source behavior and the recorded compiler profile, not equality of newly compiled or deployed runtime bytecode. Deployment must bind actual final artifacts and constructor/immutable parameters.

## Findings and release limits

The retained scoped conclusions establish no unresolved confirmed critical/high finding in this unchanged source/local qualification phase. Static tool impact labels are not substituted for confirmed severity. In particular, V2's two High labels are individually triaged: ReserveFunding uses its once-bound controller/immutable tranche; TurfFeeBridge's close/checkpoint share the reentrancy guard and cumulative fee settlement authority. Their exact raw reports, rationale and integration retests are retained.

Resolved findings remain visible: comprehensive M-01, INT-DEED-01, TEST-01/02 and DOC-01; liquidity AUT-BOND-01, POL-01/02/03, AUT-GEN-01/02/03/04 and the enumerated receipt/accounting/keeper corrections; Genesis GBOOT-01/02/03, GBOOT-REVIEW-01/02/03 and GBOOT-K01/K02; Market V2 hook/controller/keeper corrections. The original reports retain their concrete preconditions, before/after traces and retests; this consolidation does not reinterpret every failed draft test as a vulnerability.

The following limitations stay open and constrain later activation:

- **M-02**, medium conditional oracle/liquidity risk: empty or insufficient real liquidity and custody/removal controls need concrete evidence before bond activation. Local/source review is not economic depth attestation.
- **CORE-CFG-01**, fee custody/configuration: actual treasury/community/operations recipients, remittance and custody must be verified when wiring production.
- **ORACLE-SOURCE-HORIZON-001**, low: approximately 136 years without an accumulator write can cross the uint32 source horizon. The September 18 review retains this production limitation; its corrected test and full admitted CI do not fix it or establish unlimited-idle reliability.
- Replacement fee-contract indexing cannot safely reuse globally keyed historical nonces/cursors without the separately reviewed cutover. No contract-address replacement is authorized by this backend evidence.
- Actual Safe owners/threshold/modules, signer separation, chain/RPC/runtime pins, vault/assets/adapters, caps, liquidity custody, production PostgreSQL operator behavior and final funding/activation parameters require the existing deployment checks. Acquisition execution shells and other explicitly staged rails are not represented as operational.

These are preserved phase boundaries and known residual conditions, not new backend gameplay requirements. If final production configuration activates or changes an excluded rail, the existing policy reopens that rail's applicable review and rehearsal. This source applicability result contributes to the backend authority package; it does not by itself qualify the 225-cell world matrix, soak, deployed configuration or launch.
