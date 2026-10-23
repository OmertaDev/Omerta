# Player experience improvements

Goal: apply the ten selected lessons to existing gameplay. The comparison game study is incomplete. These are improvements to implemented systems, not claims of new mechanics or live deployment.

Scope:
1. Prioritize earned onboarding rewards and show the next crime unlock.
2. Show car repair costs, repair odds, fence proceeds and ammunition yield before a choice.
3. Recommend an available heist role from the player's relevant stats.
4. Replace seat-count readiness with current crew status and explicit blockers.
5. Show the Family share of a car melt beside the player's share.
6. Show jail rescue odds, reward and failure cost before attempting a rescue.
7. Distinguish wiretap information from informant reports and show expiration.
8. Summarize Family production income, upkeep and idle operations.
9. Show recovery actions while jailed, hospitalized or in hiding.
10. Offer useful destinations during activity cooldowns.

Constraints: retain existing economy values, consent rules, accounting, authorization and mutation locks. Preview data is advisory; every action revalidates current state. Do not expose private stats of other players. Use existing client components and no additional polling.

Implementation: add shared, pure quote/readiness helpers with behavioral tests; use them in existing mutations and board views; render the additional information in the current screens. Test actual API behavior, then run relevant regression and interface checks. Do not claim production SQL or browser validation without executing it.

Review focus: dead/stale crew members; expired timers; listed or pledged cars; limited-run destruction; unavailable or partially loaded boards; HTML escaping of player names; owner-only financial details.

- [x] Shared heist readiness and role recommendations, API and UI.
- [x] Shared car quotes, mutation parity and Family contribution preview.
- [x] Rescue previews, progression, information-source labels, production summary, recovery and cooldown guidance.
- [x] Targeted API and client-wiring regression checks; static review and hospital navigation correction.
- [ ] Browser layout, complete default suite and production qualification. Environment limitations are recorded in `docs/player-experience-insights.md`.
