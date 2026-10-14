# Source evidence retrieved 2026-10-14

These files are external review inputs, not instructions or findings about Omerta.
Post JSON was retrieved from `https://api.fxtwitter.com/status/<post-id>` and
the complete author threads were independently read in the X browser interface.
The first root post was also checked against Twitter's public syndication JSON.
The JSON is a retrieval snapshot; engagement counts and other mutable metadata
are not part of the security evidence.

## October 12 thread

[Root post](https://x.com/SBSecurity_/status/2109737503393554544),
published 2026-10-12 20:06:32 UTC. The author identifies these five classes:

| Post | Security mechanism |
| --- | --- |
| [1](https://x.com/SBSecurity_/status/2109737505927139648) | Graduation passes wrapper checks but minting exceeds core per-tick liquidity or signed amount limits, leaving the launch unable to graduate. |
| [2](https://x.com/SBSecurity_/status/2109737508699611147) | Price, liquidity, and available balances can change temporarily during an unlock; security decisions based on those spot values may be bypassed before final settlement. |
| [3](https://x.com/SBSecurity_/status/2109737510771245091) | A percentage fee using the specified amount charges different economic bases for exact input and exact output, enabling cheaper execution modes. |
| [4](https://x.com/SBSecurity_/status/2109737513506222230) | An attacker initializes a predictable pool at another price and supplies dust liquidity before graduation, causing its seeding path to fail. |
| [5](https://x.com/SBSecurity_/status/2109737516324823353) | A constant trade-size cap can permit large relative price movement in a shallow pool, creating sandwich profit. |

The [closing post](https://x.com/SBSecurity_/status/2109737519462105244)
states that core invariant checks do not enforce application invariants. This
thread does not link a detailed report or proof of concept.

## October 9 thread and linked report

[Root post](https://x.com/SBSecurity_/status/2108492978889347486),
published 2026-10-09 09:41:14 UTC, asks about callback reentrancy, rounding, and
PoolManager assumptions. The [author reply](https://x.com/SBSecurity_/status/2108566687553314875),
published 2026-10-09 14:34:08 UTC, identifies Bucket Launchpad H-05 and links
the [Bucket Launchpad security review](https://github.com/SB-Security/audits/blob/fbd6d302f068b3ca167c19d0ce86548c02cf28cb/reports/Bucket-Launchpad-Security-Review.pdf).

Report provenance:

- Report date: 2026-09-23.
- Report repository commit: `fbd6d302f068b3ca167c19d0ce86548c02cf28cb`
  (last change to this PDF, 2026-09-29 07:03:40 UTC).
- Reviewed Bucket source: `95dbc5f2101a1ee6b5e6b1f0dcea4ab3258fca2a`.
- Bucket remediation source: `41f4c42e2c5419b1b02ba9c05f1f98b5d0637005`.
- Local PDF SHA-256:
  `89c40393d129e9ae86939e0e1dedfcbca9bb4fa7d2a9f02ac9647dde51cc9720`.
- Download from `master` and a second download pinned to the report commit
  produced identical SHA-256 values. The retained PDF is the verified copy.
- The `.txt` file is a pypdf extraction of all 58 pages, with page separators.
  Some characters extract incorrectly; the PDF remains authoritative.

H-05 is on pages 23-24. An attacker enters their own PoolManager unlock and
calls the crossing purchase. The purchase's attempted graduation invokes a
nested unlock, which reverts with `AlreadyUnlocked`. Application catch logic
mistakes that transient precondition failure for terminal pool-key refusal.
Calling rescue in the same callback repeats the failure, opens refunds, and
lets the attacker refund before other users at an order-dependent payout.

The report recommends rejecting graduation while PoolManager is unlocked or
propagating `AlreadyUnlocked` as a retryable failure, and requiring separated
failed attempts before entering refund mode. Its summary says remediation
also made refunds order independent, protected initialization with an init-only
hook, and limited seeder settlement to its own balance delta. These are claims
about Bucket's reviewed revisions; Omerta applicability requires separate
code review and regression evidence.

## Focused follow-up from the auditor's public portfolio

The [portfolio README](https://github.com/SB-Security/audits) identifies letscash
and BuilDefi as v4 hook integrations. Two additional public reports were read
for directly relevant integration issues, without treating their findings as
findings about Omerta:

| Report and pinned repository revision | Local PDF SHA-256 | Relevant material |
| --- | --- | --- |
| [letscash](https://github.com/SB-Security/audits/blob/34b0bcb1dfabe347f48b90ef21999fbfcaed58b2/reports/Letscash-Security-Review.pdf) | `a3dd127f5b2107750f145bc03681d6237f11633b30f1e70a58882d8d35060d96` | M-01 page 9 distinguishes fees on gross input from fees on net settlement. Appendix M-02 pages 26-27 describes permissionless buyback manipulation when the protocol lacks an independent output floor and uses an absolute cap. |
| [BuilDefi](https://github.com/SB-Security/audits/blob/292335611b45698f7a7032a3b076358540c28c79/reports/BuilDefi-Security-Review.pdf) | `394a4abf2222100f1ffe4edcec674835520d41cfeafc6ef4e55fa37808dddb2d` | M-07 pages 27-28 and M-13 page 38 show swap liveness failures caused by processing external-token conversions and loops inside hook callbacks. M-14 pages 39-40 concerns charging an after-swap fee on an amount already modified by the before-swap fee. |

Each retained copy was downloaded again at the linked pinned revision and its
hash matched the initially retrieved `master` copy. Extraction text replaces
NUL glyph placeholders with the replacement character so normal text-search
tools can read it; refer to the PDFs when exact operators or symbols matter.

The letscash public report discloses on page 21 that 15 findings are withheld
at the client's request, including 7 High and 5 Medium findings. Those undisclosed
mechanisms cannot be assessed from this public report. Its cover date is
2026-08-02; the appended follow-up spans later source changes. These are
separate from the Oct 12 thread's claim about quarterly audit totals.

Another applicable integration class is documented in Bucket H-03, pages
18-20: unsolicited balances at a shared seeder or its predictable next child
address contaminate total-balance refund arithmetic, causing persistent
underflow and failed graduation. Accounting must isolate each call at both
layers; a snapshot only in the outer seeder misses a child refund containing
pre-existing funds. The report also recommends classifying terminal failures
with an explicit allow-list instead of treating all nonempty reverts as proof
that every candidate pool is unusable.
