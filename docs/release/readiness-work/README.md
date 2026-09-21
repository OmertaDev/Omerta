# RC1 readiness engineering

The implementation request is not release clearance. The frozen acceptance scenario
manifest contains 225 required native cells. Its `UNIMPLEMENTED` workloads and zero
qualifying runs remain unmet proof, independently of passing scoped regressions.

## Source and owners

Work starts from fetched main `32859cf7d198d2a003160b2bb1ef005991697d73`.
The assessed repair source is `cce721029c86de7c6f0d875fef7cb8de29504dda`;
the sealed package at `a3d2d56aecc9e6d10c24e3c12ff9cf29e9257c8d` is unchanged.
The live API/worker predecessor observed through Render is
`468516d8d6f3729514711ad5a0b83e440c5c46f9`. Its observation is recorded in
`render-observation.json`; this is not an attestation of the candidate deployment.

| Package | Engineering owner | External dependency |
| --- | --- | --- |
| RC1-00 | Codex/source_repairs | Release owner must confirm deployment source pair |
| RC1-01 | Codex/native_harness | None for local engineering |
| RC1-02 | Codex/resource_proof | Enabled contract configuration/backing attestation |
| RC1-03 | Codex/native_harness | Production-equivalent soak envelope |
| RC1-04 | Codex/source_repairs | Deployment-phase integration scope |
| RC1-05 | Codex/source_repairs | Physical iPhone/Android tester names and access |
| RC1-06 | Codex/root | Named operator and isolated service/database configuration |
| RC1-07 | Unassigned; operator input required | Named coordinator and consenting real participants |
| RC1-08 | Codex/root for evidence packaging | Named release owner for qualification |

Agent labels name engineering responsibility. They do not invent human operators,
testers, participants, or organizational sign-off. My Workspace on Render was selected
by the user in this task. Only the existing live services/database were observed;
no existing service was changed or database overwritten.

## Capture and verify

Commit all source and generated artifacts first. Use a new ignored `tmp/rc1-*`
directory per candidate/run. Keep restricted actor state/checkpoints outside the
checkout in storage accessible only to the local user/operator. Never copy production
secrets or actor data into a committed evidence package.

```sh
node tools/rc1-evidence.mjs freeze --output=tmp/rc1-RUN --configuration=PATH --predecessor=FULL_SHA --registry=docs/release/readiness-work/gate-registry.json --scenarioManifest=docs/release/readiness-work/scenario-manifest.json
node tools/rc1-evidence.mjs run tmp/rc1-RUN npm-test
node tools/rc1-qualification.mjs index tmp/rc1-RUN
node tools/rc1-qualification.mjs verify tmp/rc1-RUN
node tools/rc1-qualification.mjs qualify tmp/rc1-RUN
```

`configuration.json` records the actual test/deployment configuration and identities
of secret sources, without secret values. A local test-suite configuration does not
attest the Render environment. Each gate retains argv, dates, source/config hashes,
exit code, log hash, timeout and source-mutation results. A gate may pass only if the
command succeeds and the checkout bytes remain frozen. Failed attempts are never
overwritten. The registry must retain workflow setup, platform requirements and
budgets; simply invoking a command without its prerequisites does not pass it.

`verify` checks artifact integrity only. Run `qualify` from this repository with
the pinned source commit available in Git. It verifies the complete source blob
inventory and canonical gate registry before accepting any proof. `qualify` requires all named proof records,
exact source/configuration, reviewed execution references and the specified numeric
acceptance criteria. It returns nonzero with **NOT RELEASE READY** for missing,
blocked, scoped or invalid proof. Declarations and hashes cannot establish that a
person participated or a deployment exists; the named reviewer must inspect the
underlying execution and human/operator attestation. The unsigned SHA256 index
checks consistency; publish its hash through the retained immutable evidence commit.

Execution records belong under `runs/<proof-id>/` and retain the source/configuration,
kind, command, assertion results and referenced logs. An arbitrary configuration or
summary file is not an execution record. The `proofs/*.json` records are deliberately absent until qualifying evidence exists.
Do not write PASS declarations to make this validator green. See the validator for
the typed measurement fields and `test/rc1-qualification.js` for negative cases.
The native recorder separately retains canonical PostgreSQL state, checkpoints,
receipts and invocation/completion history. Observation order is not a database
commit-order replay scheduler. Same-seed fresh-world equivalence remains unproven.

## Recovery and admission

Use the [sealed recovery runbook](https://github.com/OmertaDev/Omerta/blob/a3d2d56aecc9e6d10c24e3c12ff9cf29e9257c8d/docs/release/RC1-RECOVERY-RUNBOOK.md)
and `DEPLOY.md` with the exact new source/predecessor pair. Old recovery results retain their original SHA. Before
admission, attest API/worker versions and flags, singleton schedules, schema, enabled
integrations, invitation denial, private diagnostics and delivered operator alerts.
Rehearse code rollback and backup restore in separate disposable databases. Retain
actor/time/incident/reason, before/after hashes, receipt and conservation checks for
each recovery. Report backup recovery point separately from acknowledged-write
durability across process restart or code rollback.

No cohort admission or RC1 release tag is authorized by the current scoped results.
All technical safety gates precede the 30-person seven-day cohort, and the final
candidate needs 72 hours without unresolved P0/P1 before qualification.
