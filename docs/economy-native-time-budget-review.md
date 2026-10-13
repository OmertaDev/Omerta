# Native release time budget

Scope: existing PostgreSQL16/18.4 CI job wall-clock limit only; no game runtime or activation change.
Baseline reviewed head: c2b22dd305c3db853a7adea37d9f55ce18b356fb. Hosted evidence: PR257 run38303046101 job114990364599 and its check annotation, retained by scoped bank triage.

The16 lane exceeded its45-minute job limit after passing the actual bank core/API/native globals and later loadtest assertions; final concurrency was skipped. This is an incomplete gate, not a successful native release. Same-head18.4 completed in44m41s, establishing negligible slack. The remaining bounded graph adds mandatory native proof processes, including a real120-second prospective season window.

Raise only the existing native job limit to60minutes and pin that finite limit in test/gates.js with invalid/shorter/longer-bound controls. Preserve both versions, every existing/native command and assertion, existing75-minute memory and20-minute browser bounds, source guards, negative controls and SQL scanner ceilings. Root gate retest is required; both complete hosted native lanes remain mandatory on the new exact revision. No canceled/skipped command is accepted as passed.
