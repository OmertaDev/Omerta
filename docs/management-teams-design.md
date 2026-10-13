# Original human/agent management workflow

Source base `b0cf6767a7cd74a06dfdd8a1afbd0ccb7b6414f1`; reviewed F13/F14/F23 dependency commits are recorded in the evidence manifest. This component supports one original owner/operator and one original F13 partner/planner, for the same actually funded GIN Depot and existing two-consent F14 relationship. Each independently opts into its exact role and `selection_only` sharing. There are no automatic votes, generic partner owner actions, spending grants, ownership shares, secrets, API credentials or stored JWTs. Request keys are domain-hashed. Both original accounts/characters must remain current and active. Relationship expiry bounds the team, and plans last at most fifteen minutes with maximum three current plans.

The planner reads a limited F23 hint and may propose only the five existing canonical configuration fields through `proposeCompanyGovernance`. F23 factual past preference affects the hint, not authority, EV, votes or claimed forecast accuracy. The original owner may also propose. Neither posting nor joining supplies an approval. Both originals vote through the unchanged canonical F14 vote route. Only the original owner executes the joint plan, using the current human/agent credential and actual `executeCompanyGovernance` → `configureDepot`; the normal delegated-control guard remains authoritative. The team does not update Depot configuration directly and cannot spend the treasury. Actual customer price/configuration changes are observable normal gameplay, without an invented performance or profit receipt.

Required trusted registration:

```js
register(app, {
  pool, auth,
  currentTeamTurn: {
    kind: 'canonical_management_team_turn_v1',
    readCurrentTurn: async ({client, owner, helpers}) => /* actual server-authorized turn */
  }
});
```

The callback must use the existing real server turn generator/authorization context and current online/WS fingerprint with the provided transaction client, original owner and already loaded owner helpers. It may not construct an alternate permission snapshot, store credentials, open another pool transaction, call HTTP/app.inject while row locks are held or change gameplay state. The planner's helper view is normalized to the consenting owner for this read only. Public output shares only recommendation source/ID, at most three opaque fact IDs and memory policy revision/enabled state; it omits private past result amounts, source receipts, keys and full turn balances. Absent or incorrectly typed registration fails closed before a joint proposal/execution.

Lock order is canonical sorted two original characters/accounts, owned Depot/current policy, F13 relationship, F14 governance and existing proposal/votes where applicable, then team and joint plan. F14 execution relocks only sources already held. Fresh account status and deadline are checked after waits; plan identity binds original participants, relationship, team revision, F14 proposal/hash/config snapshot, real turn, factual selection hash and expiry. Changed roles, config/policy, turn, selected facts or proposal source invalidate future execution. Withdrawal permanently retires this team/revision and unexecuted joint plans, preserving receipts. It changes no independent canonical F14 rights or existing explicit F14 ballots; ordinary owner operations remain available outside this team workflow. A withdrawn team cannot execute its joint plan.

An optional team Agent Act executor is **not implemented or qualified**. Team proposal kind `agent_act` rejects. F23 may identify an already issued action which an authenticated original owner can submit through the existing normal Agent Act endpoint under its own current permission, but this creates no team execution receipt. A future coordinator-owned client/actor-aware `executeIssued` seam would require exact current turn/action/body/team/governance/source/expiry bindings, normal server authorization and actual canonical effect/receipt proofs. Existing public URL descriptors are not a DSL or a new executor.

Coordinator integration: apply the three exported team metadata tables after F13/F14/F23; register the authenticated routes and actual current-turn reader; add discovery, source/gate/catalog registration and mandatory CI; invoke `retireManagementTeamsAtDeath(client, victimId)` after original-member canonical estate in the existing transaction. Retirement is metadata only and never writes counterpart cash. Dead originals/heirs receive historical original-account reads/ACKs, never new role, vote or execution rights. Actual schema/server/AgentTurn/AgentAct/gateway/estate integration and parent graph release checks remain separate from this manually registered component proof.
