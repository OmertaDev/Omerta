# Invite-only launch

`INVITE_MODE=on` requires admission to load the playable console, Codex, Arena, live city boards, and player spectator pages. The server sends a separate invitation page to visitors; game markup is withheld. Gameplay API routes continue to require account authentication. Documentation, the Path acquisition funnel, external token metadata, and account recovery stay available.

Render's checked-in launch configuration sets `INVITE_MODE=on`. Production and database-backed deployments also default to invite-only when the setting is absent. Local in-memory development stays open. An explicit `INVITE_MODE=off` opens admission.

Existing accounts retain access. Returning browsers exchange their saved bearer for a signed HttpOnly view cookie; returning players can use X sign-in or their OMERTA account token. Banned or revoked accounts cannot use old view cookies. The cookie cannot authenticate gameplay requests. Signing out clears it. Private pages use `private, no-store`, and the service worker no longer precaches the console.

## Generate and activate campaign codes

Generate a private export outside the repository:

```powershell
node tools/invites.js generate --count 5000 --output-dir C:/Users/Jorge/Documents/Omerta-private/launch-invites-2026-09-07
```

The directory contains a numbered `invites.csv` with share links, one code per line in `invites.txt`, the exact `invites.json` import manifest, an additive `import.sql`, and a README with the CSV checksum. Codes are cryptographically random, 100 bits, single-use, and formatted `OMR-XXXXX-XXXXX-XXXXX-XXXXX`. The generator refuses to overwrite an existing directory. Keep these admission credentials out of Git and public hosting.

Generation does **not** activate codes. With the intended database's `DATABASE_URL` set, import the saved batch:

```powershell
node tools/invites.js import --output-dir C:/Users/Jorge/Documents/Omerta-private/launch-invites-2026-09-07
```

The importer opens one transaction, inserts the exact saved codes, and reports new versus existing rows without printing codes or credentials. Repeating an import does not restore a used code. A collision with another batch aborts. Operators may instead run `import.sql` with normal database tooling; its `ON CONFLICT DO NOTHING` never replenishes uses.

Import before distributing links, deploy the gate with `INVITE_MODE=on`, and verify an anonymous browser receives the invitation screen. The configuration change must be applied to an existing Render service; editing the YAML alone does not update production. No codes are active on a target until imported there.

## Admission and recovery

The form posts `{inviteCode, bootstrapSecret}` to `POST /v1/access/redeem`. It saves a random 32-byte recovery secret before submitting and retains it across reloads, so an interrupted response recovers the same account without consuming an additional invitation. Account creation and invite consumption share a transaction. The browser saves its bearer before retiring the bootstrap credential. Direct guest, X, Privy, and agent signups also require admission while invite mode is enabled.

Share links use `https://www.omerta.fun/#invite=CODE`: the fragment is not sent in the HTTP request. A referral can stay in the query string (`?ref=CharacterName#invite=CODE`). The invitation admits one player; referral attribution and subsequent Crew membership remain separate choices.

## Player-issued Crew invitations

A living player in a Crew can issue **three codes for the lifetime of their account** from the Crew panel. `GET /v1/invites` shows only that account's codes, remaining allowance, and eligibility. `POST /v1/invites` issues one single-use code under the existing Crew, character, and account locks. Send an `Idempotency-Key` when issuing, as for other mutations.

Used codes still count. Death, replacement, leaving, or joining another Crew never resets the allowance. Codes admit a new player to the game; the existing invite-by-name flow determines who joins the Crew. This allowance is additional to the 5,000 campaign codes.

Moderators can still mint batches through `POST /v1/mod/invites` with `x-mod-key`, up to 100 at a time, using the same strong code format. Distribution is a separate operator action; the game sends no recruiting messages automatically.
