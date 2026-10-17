# Event economy actor and obligation bounds

These are additive N19 bounds. Existing Game, Items and equipment-rental actor limits are unchanged.

| Role of one original account | Enforced current bound | Authority and disposition |
| --- | --- | --- |
| Host / actual publisher | One offered, active or suspended event | Own cash reserve only; at most three validated campaign slots and 300,000 game cash. Suspended reserve remains this host's obligation until its own close or estate refund. |
| Vendor / actual merchant | One active event | Explicit original vendor consent. Withdrawal or estate suspends metadata; it does not refund another host or credit another player. |
| Venue / actual consignment host | One active event | Original venue consent after vendor consent. The source is the actual original N01 host. Withdrawal or estate suspends metadata only. |
| Participant / actual buyer | One joined or visited participation across events | No attendance payment or funded customer liability. Final reward follows two independently paid canonical purchases and is capped to the actual UID price. |

The host capacity partial unique index includes suspended events. Vendor and pickup partial unique indexes include only active events. Offered proposals and vendor signatures remain inactive until the pickup's own consent; they cannot occupy an unconsenting original's active membership. Suspension is terminal for participation. It releases peer membership without releasing the host's financial obligation. A historical successful consent ACK cannot reactivate an old event.

Each active event contains one to three distinct actual N16 campaigns and UIDs, one N11 GIN vendor, one publisher and one N01 pickup host. These roles are checked against the actual canonical sources; the original three seller/publisher/host accounts are distinct. N16's three pending merchant campaigns alone would not bound historical event membership after campaigns become paid or cancelled, so N19 does not rely on that assumption. Its active role indexes remain explicit.

An estate can affect at most one own funded event and two active provider events (one vendor membership and one pickup membership). The provider query reads up to three rows and rejects an impossible excess; it never silently truncates. At most three event metadata rows and nine related pending participation rows can change. One additional own active participation can retire. Only the victim host's own unused reserve can change the victim's cash; provider and participant retirement writes metadata only. No additional character is introduced into Game or rental prelock roots, and no counterparty cash is written by provider recovery.

The GIN visit retains the actual two-original Game pair: buyer and seller. The UID finish retains the same four original N16 parties: buyer, merchant/vendor, publisher/event host and consignment/pickup host. The host already funded the reward from its own cash. There is no fifth actor, arbitrary ID list, courier scope, caller callback, shared arity increase or new customer spending authority. The new fixed Game completion hooks only verify private results after actual character, cargo and account ACKs; ordinary unbranded results are inert.

Canonical PostgreSQL tests must verify the actual unique predicates, genuine multi-event refusals and their complete row rollback, original venue post-account-ACK rollback, terminal suspension, original-host refund, metadata-only provider estates, fixed-role fresh purchase proof, real post-ACK expiry and genuine attempted allocator behavior. Earlier source phases and failed fixtures remain separate evidence. This derivation is not final migration, source-pair or release clearance.
