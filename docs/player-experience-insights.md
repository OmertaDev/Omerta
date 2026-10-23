# Player experience changes, 22 October 2026

These changes apply ten selected lessons from an initial Infamous Gangsters play session to existing Omertà systems. The comparison game study is incomplete. The changes have not established a retention or enjoyment improvement, and source availability does not establish deployment.

| Lesson | Implemented change | Main source |
| --- | --- | --- |
| Fast progress and visible unlocks | Home shows the next crime level and moves earned, non-social onboarding rewards before other tasks. | `public/index.html`, `public/player-experience.js` |
| Items support useful choices | Owner-only car previews show repair cost and odds, fence proceeds after tax and fees, and ammunition yield. Fence and melt ask the player to confirm removal. | `src/car-choices.js`, `src/economy.js`, `src/game.js` |
| Find useful partners | Joinable heists sort before unavailable jobs; open roles have a suggestion based on the reader's own relevant stat. The player can choose another role. | `src/heists.js` |
| Coordinate readiness | A filled heist crew is ready only when all members are alive and free of the execution-blocking statuses. The board reports blockers and stale plans. | `src/heist-readiness.js`, `src/heists.js` |
| Show cooperative production | Car melting previews the player's rounds, the Family's rounds and the Family treasury credit. The quote and settlement use the same calculation. | `src/car-choices.js` |
| Turn failure into rescue work | A known player's rescue quote shows odds, reward, failure jail time and actor blockers before offering a separate attempt. Unknown players cannot be probed through this endpoint. | `src/rescue-quote.js`, `src/server.js`, `src/social/combat.js` |
| Explain information quality | Wiretap and informant cards identify source quality and expiration; expired or missing reports do not advertise current facts. | `public/player-experience.js`, `public/index.html` |
| Make production needs visible | Family operations show active listed income, upkeep, income awaiting collection and cold operations. Cold production is excluded from the active income total. | `public/player-experience.js`, `public/index.html` |
| Support recovery | Home links jailed players to the Pen, hospitalized players to the Doc on The Life tab, and hiding players to safehouse options. | `public/player-experience.js` |
| Give waiting players alternatives | Home lists current activity cooldowns and other screens to review. Recommendations navigate only; the server still checks every action. | `public/player-experience.js` |

## Authority and accounting

No balance constants, database migrations, wallet flows or financial activation gates change. Car arithmetic preserves the prior multiplication order and rounding. Existing mutation locks, authorization and ledger entries remain authoritative. Quotes are snapshots, not guarantees. Reading a rescue quote does not pay a reward or spend a rescue attempt. Private crew timestamps and other members' stats do not leave the server.

The new route is `GET /v1/streets/:targetId/rescue-quote`. It requires authentication, a living acting character and the existing `requireKnownPlayer` identity check before reading target prison status. The existing `POST /v1/streets/:targetId/bust` remains the only rescue mutation.

## Verification

Run `npm run test:player-experience` for quote arithmetic, readiness, source labels, navigation, API authorization, owner preview/settlement parity and non-mutating rescue reads. Existing economy, social, heist, Home, player-intel, Wire, client-wiring, rules and PWA suites cover adjacent behavior.

Release remains subject to the repository's full suite, real PostgreSQL requirements and browser layout checks. The local browser checks could not run because no Chromium binary was available and its download failed. The full default suite stops in `test/commerce-source-compatibility.js` with `Actual complete current C source required: package.json`: its sealed source snapshot does not admit this change. That guard has not been weakened or bypassed. Full documentation qualification also requires repository files omitted from the sparse checkout. The graph invariant check passed. Blocked checks are not passes.
