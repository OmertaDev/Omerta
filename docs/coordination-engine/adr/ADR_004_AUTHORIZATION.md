# ADR 004 — Historical ownership and current execution authority

Accepted for Phases 00–01; delegated organization execution remains planned. Accounts outlive characters, Crews are account-based, and Families are character-based. Treating these identities as interchangeable would grant heirs or former members unintended authority.

Decision: store immutable account/character ownership on each private run. Current original-character execution is a separate right from account historical read/cancel. Resolve current identity from existing server state under locks; no request nominates an owner. `public` node visibility is only within the private run.

Phase 01 claim reads and evidence-gated mutations revalidate current membership and grants under transaction locks. Account grants follow the account; Crew grants follow current account membership; Family grants follow the current living character's membership. They convey reading only. Later threshold approvals must bind the exact action, revision, participants and expiry and be consumed once. Trust or organization edges do not grant membership or bypass canonical role authority.

Consequences: history remains recoverable without automatic inheritance. Cached/replayed projections are observations and receipts, not enduring authorization. Financial or cross-account delegation requires a separately tested adapter.
