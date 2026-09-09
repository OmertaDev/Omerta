# OMERTÀ security review policy

**Owner decision — 2026-09-08.** Security reviews are performed by agents using the evidence requirements
below. This is the current policy for new work, release reviews, and material changes to previously
reviewed code. It supersedes older runbook statements about who must perform a security review.

The owner has authorized this review workflow. Agents proceed with code inspection, isolated proofs,
tests, fuzzing, invariant checks, static analysis, remediation, and verification within the requested
scope. A completed review is evidence for its exact scope and revision; it is not a blanket audit of
OMERTÀ, an assertion that no defects remain, or authorization to activate another rail.

## Pinned methods

Use the relevant methods from all three repositories. The 2026-09-08 method baseline was verified with
`git rev-parse HEAD` in the local checkouts under `output/audit-methods/`:

| Source | Pinned commit | Application |
| --- | --- | --- |
| [pashov/skills](https://github.com/pashov/skills/tree/c577eb7799c349de0acb187ba00ca98e14e436fd) | `c577eb7799c349de0acb187ba00ca98e14e436fd` | Adversarial passes over access control, execution traces, invariants, economic assumptions, boundaries, and periphery; a concrete trace or proof distinguishes a finding from a lead. |
| [PlamenTSV/plamen](https://github.com/PlamenTSV/plamen/tree/795962b96e254f2e423a2635fe7f8cb8ea1e6d69) | `795962b96e254f2e423a2635fe7f8cb8ea1e6d69` | Protocol-specific breadth and depth, state/accounting transitions, callback and transfer behavior, and verified exploit hypotheses. |
| [trailofbits/skills](https://github.com/trailofbits/skills/tree/d3323cefbcf645678b8dc481de204b02ad3d02dc) | `d3323cefbcf645678b8dc481de204b02ad3d02dc` | Build context and trust-boundary maps first; apply specification comparison, property/invariant testing, static-analysis triage, and false-positive checks where relevant. |

These are method sources, not evidence that a tool or a whole upstream orchestration ran. Record the
exact skills/passes actually used. Keep adaptations explicit: available agent slots, native toolchain,
language, dependency setup, and applicable scope may differ from upstream examples. Do not silently
replace a pin with a moving branch; record a new pin and the reason when adopting an update.

## Review package

Every release review retains a cohesive package containing:

1. **Source and scope.** Full source commit, dirty/clean state, hashes for reviewed working-tree files
   when applicable, file/function inventory, included dependencies, excluded surfaces, release phase,
   and the behavior/properties being claimed. Pin contract compiler, optimizer/EVM settings, dependency
   versions, artifact/runtime hashes, chain, addresses and deployment parameters when applicable.
2. **System model.** Entry points and callers, assets/liabilities, storage and event authority, replay
   domains, privilege boundaries, external calls, off-chain signer/indexer assumptions, and failure
   behavior. Follow callees; do not treat a helper's name as proof that it validates its input.
3. **Adversarial review.** Separate passes over the material trust boundaries, followed by cross-checking
   their findings. Include malicious recipients/adapters, reentrancy, replay, rounding, configuration
   drift, stale reads, cross-system state changes and recovery where they apply. Mark checklist items
   that do not apply and explain why; do not manufacture coverage for unrelated mechanisms.
4. **Executed evidence.** Commands, tool versions, run date, input/seed/run budget, exit status, and
   retained outputs for meaningful unit/integration regressions, executable exploit proofs, stateful
   fuzzing and invariants. Exercise persistence/concurrency against PostgreSQL where correctness
   depends on its locks or transactions; an in-memory test does not prove those properties. Use real
   supported contract compilers and include all in-scope suites. Record a missing or failed run plainly.
5. **Static-analysis triage.** Retain the raw diagnostics and disposition by finding/rule. Verify each
   actionable result against reachable code and invariants; document false positives, exclusions and
   tool failures. A successful tool invocation is not equivalent to a clean analysis.
6. **Findings and remediation.** Stable IDs, severity and rationale, prerequisites, affected source
   references, reproducible trace/proof, actual impact, correction, and retest evidence. Keep leads
   distinct from confirmed defects. Preserve resolved findings and invalidated hypotheses with their
   reasoning; do not erase the record when code is fixed.
7. **Scope-specific conclusion.** State what is ready, what remains open or unverified, accepted residual
   risks, and precisely which revision/phase the conclusion covers. Link the evidence package from the
   release manifest and retain its content hash.

For code where a category is inapplicable, retain an explicit rationale instead of an empty claim of
coverage. For example, a documentation-only change does not require Solidity fuzzing; a fee-to-NFT
release does require its payment, authorization, callback, indexing and recovery paths to be exercised.

## Completion and change control

- An in-scope critical or high finding must be fixed and retested before the affected release is ready.
  Record the disposition and rationale for every other finding, including any accepted residual risk.
  A lead or a failed/unavailable test remains visible and limits the conclusion accordingly.
- Conclusions apply to the exact reviewed source and configuration. Material changes to contracts,
  signers, authorization, accounting, replay domains, adapters/oracles, persistence or write routes
  reopen the affected review. Reassess shared dependencies and rerun the checks impacted by the change.
- Historic reports and test totals remain point-in-time evidence. Preserve them with their dates and
  hashes; do not present them as proof for changed source or rewrite them to imply a newer review.
- A report hash field is a reference, not a verifier. Check that it resolves to the retained package
  and that the package's scope/source match the release. Existing deployment wrapper field names such
  as `CORE_AUDIT_REPORT_SHA256` and `CORE_SIGNER_AUDIT_INCLUDED` retain their operational meaning under
  this policy: the hash identifies the scoped review package and the signer must actually be included.

## Deployment remains a separate operation

Review completion does not broadcast, fund, upgrade, configure, or enable a contract. Keep the
deployment runbook's exact source/bytecode verification, Safe owner/threshold and signer separation,
transaction simulation, caps, recipients, metadata routing, chain/database isolation, confirmation
policy, monitoring and recovery requirements. Owner launch acceptance and any applicable platform
routing approval remain separate from security evidence. A character NFT review does not clear token
issuance, liquidity, bonds, RWA delivery, THE BANK, or withdrawals outside its declared scope.

Canonical entry points: [contract deployment](DEPLOYMENT.md), [chain activation](../CHAIN-DEPLOY.md),
[launch readiness](../LAUNCH-READINESS.md), and [character NFT activation](CHARACTER-NFT-LAUNCH.md).
