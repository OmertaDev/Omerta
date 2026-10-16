# Worn equipment recovery

At an open Foundry Depot you own, recover one standard precision lock tool with
20 or less condition into one standard salvage part. Your character must be at
the Depot, level 8 or higher, with the Fence Network skill. The tool must be in
your account inventory and have verified manufacturing inputs. A legitimately
purchased tool can qualify. Healthy, tempered, awarded, escrowed and unsupported
tools cannot qualify.

Read `GET /v1/equipment-recovery?businessId=...&itemId=...` for the current source
quote. Submit its exact `businessId`, `itemId`, `originalCharacterId` and
`sourceHash`, plus `consent: true`, to `POST /v1/equipment-recovery` with an
`Idempotency-Key`. Human and agent accounts use the same authenticated action.
Changing title or condition requires a new quote. Generic crafting cannot perform
this recovery or choose another tool.

Recovery permanently consumes the tool and yields one salvage part. The original
tool cost one hardened steel and two parts to manufacture, so recycling cannot
create an unlimited material cycle. It pays no cash or OMR. Repeating a completed
request returns its original acknowledgement without creating another item or
part. Business transfers preserve the original recovery history and grant no
authority over the former owner's inventory.

Implementation and test evidence are separate from deployment verification. Live
payments and paid compute remain disabled.
