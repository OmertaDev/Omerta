# Coordination Phase 02 — Organizations and delegated authority

Status: planned. Depends on Coordination Phases 00–01; this phase does not replace existing Crew, family, or Extended Family systems. Read the [shared brief](https://chatgpt.com/share/6aa68e3e-9ad8-83ea-ab47-b9c624dce707) for product intent.

## Result and existing boundaries

An organization can grant a private coordination role, earn narrowly scoped trust through completed work, and authorize an exact action through a threshold of independent eligible members. Members can identify what authority they possess without exposing other members' private roles.

Existing `src/crew.js`, `src/social.js`, `crew_members`, and `gang_members` retain membership authority. Crew membership is account-scoped; the authored runtime resolves `extended_family` through the living character's `gang_members` row. `src/circle.js` is a read-only relationship projection, not a membership writer. `src/operations.js` owns the existing world-graph role assignments; `src/content/runtime.js` owns authored party membership and consent. Coordination roles must not write into either runtime's membership or completion rows.

## Proposed storage and interfaces

Add `src/coordination/organizations.js` with a typed organization reference resolved through small read-only adapters. Proposed additive tables are:

- `coordination_org_relationships`: exact source/target organization references, a closed relationship type, effective interval, issuer evidence, and revision. Accept only relationship types with an implemented meaning; no universal social graph.
- `coordination_role_grants`: organization, exact definition hash, role/capability, account, validity interval, revocation revision, and source event. Private membership projections disclose only what the caller needs.
- `coordination_trust_events`: dimension, source operation receipt, organization/account scope, bounded amount, rule version, and correction reference. Derived totals remain rebuildable and cannot confer capability by themselves.
- `coordination_authorizations` and `coordination_authorization_votes`: frozen request hash, target command, target instance revision, policy hash, deadline, voter account, consent revision, and a unique consumed-by command ID. Enforce one vote per account per authorization.

Initial trust dimensions are reliability, discretion, and task-specific competence. Each derives from a declared completion/failure event; none is purchasable, transferable, or a blanket global reputation. Freeze rule versions with their evidence. Granting a role requires explicit authorization and cannot be inferred from a high trust score.

Proposed routes under `/v1/coordination/organizations/:organizationRef` expose a caller-filtered board, own roles, and authorization proposals. Proposal, vote, revoke, and consume requests carry issued identifiers and expected revisions. The server derives the organization reference from a permitted board token or validates it through membership; submitted account IDs never become actor identity.

## Transaction and consent contract

Create an authorization only for a compiled capability and exact canonical command fingerprint. Votes name the frozen request, not an open-ended permission to act later. Recheck live membership, role validity, distinct account identity, deadline, and consent at consumption. A required quorum of three means three eligible accounts, not three characters or three roles.

Acquire character/account locks according to the existing canonical order, then the authorization and coordination rows. Before implementation, document the membership writer's lock sequence and demonstrate compatibility on PostgreSQL; do not assume a new organization lock serializes existing membership changes. Use row locks or conditional membership revision checks shared with the membership writer. Consuming authority, advancing the target, recording the event, and marking the unique consumption happen in one transaction. Failure leaves authority unconsumed. Ambiguous commit recovery uses the same command key.

Historical role holders and votes remain recorded after death, departure, succession, or dissolution. Historical votes cannot authorize a current action after their live eligibility ends. A dead character's run stays historical; an account role must explicitly state whether a replacement character can use it. Institution custody may transfer only by a compiled succession policy recorded as a new authority event; private character claims do not transfer with office.

## Acceptance and rollout

- Race last-vote withdrawal, membership exit, death, role revocation, and simultaneous consumption against execution; exactly one eligible execution may commit.
- Changing the action, body, instance revision, or policy after votes invalidates the authorization. Multiple roles and characters never inflate quorum.
- Rebuild trust from immutable events; repeated source receipts and replayed outcomes do not increase it. Corrections append evidence rather than editing history.
- Unauthorized readers cannot enumerate organizations, roles, votes, or hidden relationship endpoints by IDs, errors, or pagination counts.
- Verify succession under leader death and organization dissolution; archives remain readable only through their explicit custody policy.

Planned flag `COORDINATION_ORGANIZATIONS=on` requires engine and knowledge gates, with organization cohorts narrower than launch access. Start with read-only relationships, then private roles, then one value-neutral threshold action. Disable new proposals and role grants on rollback; retain revocation, expiry, owner history, and cancellation. Never undo an executed command by deleting its votes or trust evidence.

Out of scope: replacing membership systems, token-weighted governance, economic staking, off-platform reputation, new PvP authority, and general-purpose delegation tokens. Packages: CE-02-01 through CE-02-05.
