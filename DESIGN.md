# OMERTA interface direction

OMERTA is artifact-led noir: cinematic at thresholds and high-consequence moments; documentary during routine play. Operational screens should feel like ledgers, dossiers, maps, contracts, receipts, and case files—not generic dashboard cards wearing a dark theme.

## Product principles

1. **The city keeps receipts.** Show costs, risk, status, result, and recovery beside the action they describe.
2. **One move has the floor.** Every operational surface identifies a primary next action. Secondary and dangerous actions remain visually distinct.
3. **Drama is earned.** Use photography, motion, glow, and full-screen reveals for entry, death, indictment, victory, and other peaks. Routine operations stay calm and scannable.
4. **Depth unfolds.** New players get a compact route and one recommendation; advanced systems remain reachable through grouped navigation and search.
5. **Machine truth is human truth.** Public copy, the Codex, the console, and the API must describe the same status and constraints—especially the dormant extraction rail.

## Token contract

The source of truth is `public/omerta-ui.css`. New work uses `--om-*` tokens. Existing short aliases remain only as a compatibility layer.

### Colour

| Token | Value | Use |
|---|---:|---|
| `--om-surface-canvas` | `#0a0909` | Page background |
| `--om-surface-panel` | `#141214` | Standard ledger/panel |
| `--om-surface-raised` | `#1a1719` | Interactive or raised artifacts |
| `--om-border-subtle` | `#302a2d` | Rules and passive boundaries |
| `--om-text-primary` | `#eee6d7` | Headings and primary content |
| `--om-text-secondary` | `#c9c0b1` | Supporting readable content |
| `--om-text-muted` | `#9f9688` | Metadata; never essential information by itself |
| `--om-action-primary` | `#cda653` | Primary action and active location |
| `--om-status-danger` | `#d36b61` | Irreversible action, loss, blocking error |
| `--om-status-warning` | `#e0bd72` | Caution and a reversible risk state |
| `--om-status-success` | `#78ae8a` | Confirmed success |
| `--om-status-info` | `#80a6c1` | Neutral system status |

Colour never carries meaning alone. Status needs text or an icon, and text/background pairs must meet WCAG AA.

### Type

| Role | Token | Use |
|---|---|---|
| Display | `--om-font-display` | Wordmark, location plates, cinematic titles |
| Body | `--om-font-body` | Narrative, explanations, long reading |
| Data | `--om-font-data` | Balances, controls, labels, routes, time, status |

Display type is identity, not body copy. Dense operational copy should be at least 14px; public reading copy should be 16px with a 66–72 character measure.

### Spacing and shape

The spacing scale is 4, 8, 12, 16, 24, 32, 48, and 64px. Use 3–6px radii for ledgers and controls; reserve 10px for large overlays or cinematic panels. Target size is 44×44px on touch surfaces.

### Motion

Motion explains where an interface object came from, what just changed, or what completed. It is not ambient decoration.

| Timing | Token | Use |
|---|---|---|
| 80ms | `--duration-micro` | Press and direct feedback |
| 150ms | `--duration-quick` | Dismissal, hover, colour, and border changes |
| 250ms | `--duration-fast` | Menus, panels, modals, and operation receipts |
| 350–400ms | `--duration-medium` / `--duration-slow` | Toasts and larger public artifacts |

Entrances use `--ease-smooth-out`; direct state changes use `--ease-out`. Menus animate from their trigger edge, and closing is faster than opening. Avoid elastic or bouncing motion. All new animation must remain legible when `prefers-reduced-motion: reduce` collapses its duration.

## Navigation

- Public pages share: City, Codex, Arena, Agent setup, and a primary entry action.
- New human players see four high-frequency mobile destinations plus **More**.
- Full console navigation is grouped by player intent: Streets, Earners, Vice, Blood, Family, Legit.
- Search/quick-jump is the dependable route to the long tail and must remain keyboard reachable with `/`.
- Tabs expose `tablist`, `tab`, `tabpanel`, selection state, and arrow-key behavior.

## Content and voice

The voice is terse, specific, and in-world. It may be atmospheric, but it cannot obscure a term, consequence, or recovery path.

- Prefer: “Deposit clears in 1h 42m. Until then, a killer can take it.”
- Avoid: “Something went sideways.” when the system knows what failed.
- Button labels use concrete verbs: **Bank $500**, **Hire guard**, **Burn papers**.
- Dangerous confirmation copy names what changes, what is lost, and whether it can be undone.
- Public token/economy copy always distinguishes current production behavior from planned launch behavior.

## States and accessibility

Every async surface needs loading, success, empty, error, and retry states. Actions expose `aria-busy`; success uses a polite live region, blocking errors an assertive alert. Dialogs trap focus, support Escape when safe, and restore focus to the trigger. Reduced-motion and forced-colour modes preserve all information.

## Review rule

Before adding a new hex value, shadow, spacing value, button treatment, navigation rail, or modal pattern, check the shared tokens and existing primitives. If the system cannot express the needed intent, extend the token or pattern deliberately and document the new role here.
