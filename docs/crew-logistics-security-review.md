# Crew logistics consent source review

Date: 2026-10-11. Phase: local source review and native proofs; hosted checks
and deployment remain separate gates. Runtime boundaries `d7b1345c`, routes
`b5b0aeda`, source validation `139c3511360bee33da4cdd34c4ad1a07c9badf56`,
read guard fix `5f6d9b83496ddce31811d61c168d1ddd3cfb5896`, native proof
`128be7b11e8225faa17070813051d5cf7df4f460`; integrated source `89646ae6`.

Scope: explicit consent to display references to the publisher's own funded
tender, delivery commitment or warehouse claim within their current Crew.
References grant no task execution, treasury access, shared spending or owner
authority. Only fixed public progress fields are displayed; prices, balances,
procurement limits, cargo quantities and provider data are excluded.

Consent is capped at eight links per member and thirty-two per Crew, expires
after twenty-four hours, and binds original character and generation. Current
membership and living identity are revalidated. Death, expiry and generation
change hide links. Leave or kick irreversibly revokes them before membership
removal; rejoining cannot revive consent. Leaders can remove display consent
without executing or cancelling another member's underlying obligation.

The serialized GET transaction locks Crew before actor/account, revalidates
membership and returns through a callback client that rejects writes and locks.
It never accrues, settles, persists or renders account state. A concurrent leave
waits for the authorized snapshot or wins first and removes read authority.
Existing mutations retain their canonical wrappers and Crew-first posture.

Native PostgreSQL 18.4 and memory tests passed: actual ownership of all three
sources, strict projections, no-accrual snapshots, irreversible leave/kick
revocation, death/generation privacy, full Crew and member caps, competing last
slot publication and an observed native lock wait during leave versus read.
Seed 3919 covers two hundred bounded projection cases.

Finding CREW-READ-1: the existing read-client guard omitted FOR KEY SHARE. A
local native callback proved it could lock a source row. No current route accepts
caller SQL and the Crew projections contain no such lock, so no remote authority
bypass was demonstrated. The guard now rejects KEY SHARE and retests cover all
four row-lock forms, writes and multi-statement attempts. Initial and corrected
proofs are retained separately; guards were not weakened for test fixtures.

Frozen eight-constraint and nine-not-null migration additions passed native
definition and causal checks after the new additive DDL was placed after the
legacy fixture boundary. Complete predecessor source inverses preserve historical
pins; those qualifications do not extend to this new consent layer. Repository
security policy review focused on identity, privacy, replay and concurrency.
No real payment, compute purchase, financial activation or production mutation.

Further hosted qualification exposed the Director migration test's finite table
classification omitting these reviewed additive features. Test-only repair
c05b1e2c8c8adf86663c6dff7a640c0b8a93abdc recognizes only explicitly named
feature tables present in the frozen catalog, compares exact constraints and
nullability, and preserves the pinned baseline plus unknown-addition controls.
Native PostgreSQL 18.4 full-stack and new causal-negative retests passed;
partial-stack native PostgreSQL 16/18.4 hosted retests remain release gates.

## Native CI runtime repair

Revision `07b93a87de0360959acf9d9e96af129acd95cf1d` passed PostgreSQL18.4 in
19m43s, but PostgreSQL16 exceeded the exact twenty-minute job bound
(check `114553800237`, run `38167768262`). The previously tested thirty-minute
native job bound preserves the complete suite, both database versions and all
conditions; it changes no gameplay or financial authority. Fresh checks at the
repaired head are required. A separate inherited Crew race fixture can wait for
an unobserved Crew lock while due accrual is still waiting at a character lock;
that fixture and a journey stale-command clock boundary are being repaired and
must pass before this release is ready. Historical failed runs remain retained.
