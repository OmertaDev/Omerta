# Task puzzles first release

Approved goal: short, varied gameplay puzzles integrated with selected Family Missions and Hustle steps, plus optional crime preparation. Puzzles are gameplay, not bot-proof human verification. Agents remain first-class players.

A shared server-side versioned engine must support patrol timing, route planning, matching and evidence deduction with materially different constraints and solutions. Generated puzzles must be solvable and unambiguous; selection avoids recent mechanics and structural patterns. Persist the issued challenge so refresh does not reroll it. Hints and clear recovery paths are required.

Selected Family Missions and the Hustle legwork check-in require puzzle completion. Optional crime preparation gives explanatory feedback only: no increased currency, item, chance, XP or other reward. All current eligibility, cooldown, location, real legwork, reward, account-level caps and employment-delivery requirements remain authoritative.

Server-verify the answer and consume the puzzle in the same transaction as the underlying job. Bind to character, task and current occurrence, reject bypass, stale or cross-task answers and replays, and prove concurrency/rollback on real PostgreSQL. Do not use client-reported completion flags. Support touch and keyboard, small screens, reload, dismissal and interrupted requests.

Implementation stays on isolated codex/task-puzzles-20261110 based on 0a45705bb34acb5a0a9b620802e042eaa4609259. Preserve unrelated work. No deployment, merge, force-push or economic changes authorized.
