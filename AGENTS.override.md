# OMERTA - Repository coding instructions

This is the concise Codex instruction entry point. The root [AGENTS.md](AGENTS.md)
is the public player/API guide served at `/agents` and `/AGENTS.md`; consult only
relevant sections when gameplay or API behavior requires them. Gameplay and
recruiting instructions apply to requested gameplay, not routine repository work.

- Make surgical changes that match existing style. Preserve unrelated work;
  avoid speculative features, abstractions, and cleanup.
- Market V2 (`omerta-contracts/src/market-v2/`) is the sole current game and
  tokenomics model. Use unversioned public wording for the current market; omit
  superseded economic models and comparisons from game docs, investor material,
  GitHub descriptions, and future work. Preserve exact technical identifiers and
  source-pinned review evidence, and verify deployment/activation separately.
- Inspect known files and symbols directly with focused searches and reads.
  For nontrivial work, identify success criteria and material assumptions.
- Use ContextPlus for unfamiliar or cross-file investigations when it materially
  helps. Check callers before changing shared symbols, using ContextPlus or native
  search. Use relevant static analysis and native checks; unavailable optional
  tools are a reason to fall back, not to repair the tool environment.
- Store only stable project decisions in tool memory, never secrets, credentials,
  personal data, or transient debugging noise.
- Run the smallest relevant checks plus required repository/release checks.
  After successful verification, finish unless new evidence requires more work.
- Repository security work follows
  [the agent-led review policy](omerta-contracts/SECURITY-REVIEW-POLICY.md).
  Pin source revision, scope, and release phase; run relevant proofs, tests,
  fuzzing, and invariants; triage static findings and retain findings/retest
  evidence. Conclusions apply only to the reviewed revision and phase.
- Load linked guides, detailed specs, and specialized workflows only as needed
  for the current task. Keep this instruction entry point concise.
