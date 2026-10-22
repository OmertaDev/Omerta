# Next ten player decisions

Approved scope: rebuild the ten improvements from the saved Infamous Gangsters study. Extend existing screens. Do not change economy values, authorization, settlement, privacy rules or activation gates.

| Improvement | Existing surface | Source of facts |
| --- | --- | --- |
| Quantity and totals | Market listing inputs | Listing stock, price, expiry, fee and owner sheet |
| Inheritance | Profile | Current estate and combat rules; gear may be looted |
| Personal defence | Wet Work | Owner-visible gun, protection, ammunition and health |
| Travel terms | Travel picker | Published fare, pocket cash, destination and jail status |
| Bank exposure | Streets bank | Total, in-transit partition and clearing clock |
| Activity progress | Life | Server mastery XP and next threshold |
| Comparison controls | Market | Numeric unit-price/expiry sort, direction, kind and district |
| Crew comparison | Find People | Published size and capacity; purpose marked unavailable |
| Activity receipts | Operation desk | Existing in-memory confirmed/error receipt journal |
| Access guidance | Crime controls | Current level and required level; unknown requires refresh |

Quotes are advisory. Invalid or excessive quantities cannot dispatch from these controls. The server still authorizes and settles every action. Unknown fees remain unknown. Cargo space includes all held goods. The client checks the listing expiry again at dispatch. New results and retries are bound to the character that started them. Receipts are not copied to persistent browser storage.

Verification commands: `npm run test:decision-guide`, `npm run test:player-experience`, `node test/client.js`, `npm run ui:quality`, `npm run mobile`, `npm test`, and the required native workflows on the final source.

Release repair preserves the historical source proofs. A separate exact successor source map and a separate native inventory admit the rebuilt source. This does not establish native PostgreSQL qualification by itself. Required checks must run again. No migration reset is part of this work.
