// Read-only review of complete native checkpoints. Original workers own every
// predicate and disposition below; this helper never expires or repairs state.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { canonicalJson, sha256 } from './rc1-native-proof.js';
import { LOAN, LAW, WORLD, PEN, CREW, MENTOR, BOXING, CASINO, FAMILY_YIELD, HEIST_PLAN_TTL_MS, dayOf, weekOf } from '../src/rules.js';

export const BACKLOG_SOURCE_PINS = Object.freeze({
  'src/worker.js': '7072264895a874fbcc1f068c85a8668c4cc34819918868459d71194c5f1eabf6',
  'src/market.js': 'ac65c72a32ce85e1e6cb5804a5c76c15e5d8f611ffab84122d6ddade1611fb40',
  'src/loans.js': '663f71b15332367689b5b4db5cf7fc8d94e49249d8697cc6b98bb986607cb14e',
  'src/social/gangs.js': 'f8ac8bdd2ee2706619d2d5cfd5ef8901f05415703c67cdd08d4e6e5554f53ad7',
  'src/social/contracts.js': '46c2c5293f89dde7a2dda71f48f5e517e014a7097cf7a44109cd02682c9a5c8d',
  'src/npcwar.js': '4f8be69d632e188cc0400646fb5dbedce6dc1b77dcce2ef5f362380c936f22d6',
  'src/world.js': '4946a0b43aa2f456a4f6cffcf2049cb576fbeee9241dc3bc4955db57a889553a',
  'src/convoy.js': 'a4d98d41a3f265fd5743b7e46aa0b2ae351695cfb47cdd62f5e9caa5eac6ee7b',
  'src/heists.js': '44031976626adacd64b56234bccc1d9a0067ec5bd63d1d44332597ecdb852b83',
  'src/pen.js': '11f992b7e89796e050384ab1834f024ffad13f6489b932c90132dc6fbab02506',
  'src/favors.js': '9026bd6a0e76da70e8307bbca45b08982904e455cf1e2e46ac8a843f14bb4f87',
  'src/auction.js': 'aa5b1931188d7e8294e6c1518b36ea2664544fd218c431ea62cd4b435bfdf743',
  'src/commission.js': '7e1aabd4aea45dc32ff68f3ba9307fd8e6a3794c74ad7e9387f308045da5445f',
  'src/rules.tail.js': 'ee6bdee29f049fcac9c3530729cbdca3039ea87a18b873cf7a6d548f0af1abed',
  'src/director/runtime.js': '04ff17562903a3593725921a9ba3b2f90620a1c6e71b85a3ae053540bc49e0f8',
  'src/invariants.js': 'ffbaae96e4ff8f9a62a0d8329020c13853a50ccc69a197f5c0b4c6a04bc7e9c4',
  'src/law.js': '24fef65ec00bf064bcd3db5513e047ff8339950e4c4ee80ad331747bf7510cca',
  'src/desk.js': 'c3f93aab7cac98192f266dad21e6ec0e0687cb0a1c7541ae0710f822607157e9',
  'src/diplomacy.js': 'dbfad062b79ea5fa8e21d0bf6c9d10b99899b801a68708cf8151c261be106d7b',
  'src/secrets.js': '4cd2e10e2980912669c1ff6b59fdb0f6b6bfb38cf619377329fedc0baa25307f',
  'src/contacts.js': 'ea88ff08c644905c6905c4fd6cf0da7478c553e1f82c084a44c505b01fa6291e',
  'src/crew.js': 'e13d9e745f62292ef47766c756ece7c9d14e10368cc30784053a8e5e4c2487ed',
  'src/mentor.js': 'a67b993c55b9fb675306033462ac5be11e6c0aa0bf0fb163031a5030e728a506',
  'src/wire.js': '3886c5a64f5c8594fe7e93194c8e282fa372076ccbec88dd2abf06b5d2da321c',
  'src/boxing.js': '50c085afb038020c0a44651c4350df02f217c7d8cbc9004cf59167d7a3314243',
  'src/casino.js': 'd3f4e7e9823a4d9767dc56251945116b4ed96b16dd23c831d4380881dedef284',
  'src/ring.js': '542fcf34d1233972d9061461b0a433a4908fc177905bea291c32ffec137089c2',
  'src/races.js': '8b95cb8b22f22b67823cf4942b354d40e9c471f385d389003fe0f8ad2ac23644',
  'src/stable.js': '28c7bb72e3e230e301dc429f522dcf1025c8a2f12e907fda62bc18cc75058dfb',
  'src/fees.js': '134e6c5862199bf90952f94043288621e13eeb7249ba871ebd290dbe716e413a',
  'src/store.js': '514ad59c728d126e101cc1c495d7073fcea288c6d70754ba07bff73b520f0bc0',
  'src/pass.js': '299a9465d324019a500b40f03d09a686d6b57b11498e5ff4a40543d75bde9997',
  'src/game.js': '7d6c61102dd14b8b54780fe2c32eb1f794ed2677263b8611edd37e7df1fa9645',
  'src/primetime.js': '48c4def2e7a270ee79a00504b9a1f8fd1098989b2ba775534dc19f28feaeb41f',
  'src/chain.js': 'ce26f5bdc6b9ac0a6f448b973bd47ad58b94675f58a3ba5576d7cf25a7532381',
  'src/exchange.js': 'ab28cdc4d722fce1699a486b66314b720bca93601b1b83e4fb88f2d542f4c956',
});
const compact = text => text.replace(/\s+/g, ' ').trim();
const digest = value => sha256(canonicalJson(value));
const round6 = x => Math.round(Number(x) * 1e6) / 1e6;
const instant = value => { if (value == null) return null; const n = new Date(value).getTime(); assert(Number.isSafeInteger(n), 'Invalid native timestamp'); return n; };
const due = (row, field, at, inclusive = true) => row[field] != null && (inclusive ? instant(row[field]) <= at : instant(row[field]) < at);
const key = (row, fields) => canonicalJson(fields.map(field => row[field]));
const sources = new Map(), revisions = new Set();
function sourceProof(revision) {
  assert.match(revision, /^[a-f0-9]{40}$/);
  if (revisions.has(revision)) return;
  for (const [file, expected] of Object.entries(BACKLOG_SOURCE_PINS)) {
    const actual = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(sha256(actual), expected, `Backlog reviewer source changed: ${file}`);
    const pinned = execFileSync('git', ['show', `${revision}:${file}`], { cwd: new URL('..', import.meta.url), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).replace(/\r\n/g, '\n');
    assert.equal(sha256(pinned), expected, `Checkpoint source is not covered: ${file}`); sources.set(file, compact(actual));
  }
  revisions.add(revision);
}
const specs = [];
function spec(id, label, file, table, fields, query, filter, disposition, keys = ['id'], extra = {}) {
  specs.push({ id, label, file, table, fields: [...new Set([...fields, ...keys])], query, filter, disposition, keys, periodMs: 3600000, ...extra });
}
spec('market-expiry', 'market sweep', 'src/market.js', 'market_listings', ['status', 'expires_at'],
  "SELECT id, kind, seller_character, bidder FROM market_listings WHERE status='live' AND expires_at <= now()",
  (r, at) => r.status === 'live' && due(r, 'expires_at', at), 'Original sweep settles/refunds or marks expired; expired goods and delivered warehouse cargo remain public-command recoverable.');
spec('loan-offer-expiry', 'loan sweep', 'src/loans.js', 'loans', ['status', 'offered_at'],
  "SELECT id, lender_character FROM loans WHERE status='open' AND offered_at < $1 ORDER BY id",
  (r, at) => r.status === 'open' && due(r, 'offered_at', at - LOAN.OFFER_TTL_MS, false), 'Cancel the expired offer and refund a living lender.');
spec('loan-house-collection', 'loan sweep', 'src/loans.js', 'loans', ['status', 'lender_character', 'due_at'],
  "SELECT id FROM loans WHERE status='active' AND lender_character='HOUSE' AND due_at < $1 ORDER BY id",
  (r, at) => r.status === 'active' && r.lender_character === 'HOUSE' && due(r, 'due_at', at, false), 'Collect or close the overdue house loan.');
spec('loan-collateral-forfeit', 'loan sweep', 'src/loans.js', 'loans', ['status', 'collateral_car', 'collateral_omr', 'due_at'],
  "SELECT id FROM loans WHERE status='active' AND (collateral_car IS NOT NULL OR collateral_omr > 0) AND due_at < $1 ORDER BY id",
  (r, at) => r.status === 'active' && (r.collateral_car != null || Number(r.collateral_omr) > 0) && due(r, 'due_at', at - LOAN.GRACE_MS, false),
  'Forfeit surviving collateral and close the loan after the canonical grace period.');
spec('loan-welsher-brand', 'loan sweep', 'src/loans.js', 'loans', ['status', 'due_at', 'borrower_character'],
  "SELECT DISTINCT borrower_character FROM loans WHERE status='active' AND due_at < $1",
  (r, at, tables) => r.status === 'active' && due(r, 'due_at', at, false) && tables.characters.some(c => c.id === r.borrower_character && c.alive && !c.welsher),
  'Only a living, not-yet-branded borrower needs worker action. An already branded unsecured debt can remain active for public repayment/collection.', ['borrower_character'],
  { dependencies: { characters: ['id', 'alive', 'welsher'] }, guards: ["SELECT id, welsher FROM characters WHERE id=$1 AND alive FOR UPDATE", 'if (!b || b.welsher || !still)'] });
spec('turf-contest', 'turf contest sweep', 'src/social/gangs.js', 'districts', ['contest_until'],
  'SELECT id FROM districts WHERE contest_until IS NOT NULL AND contest_until <= $1', (r, at) => due(r, 'contest_until', at), 'Resolve each sealed contest through resolveContest.');
spec('npc-family-war', 'family war sweep', 'src/npcwar.js', 'npc_wars', ['resolved', 'ends_at'],
  'SELECT attacker_gang, npc_gang FROM npc_wars WHERE NOT resolved AND ends_at <= now()',
  (r, at) => r.resolved === false && due(r, 'ends_at', at), 'Mark the elapsed NPC Family war resolved.', ['attacker_gang', 'npc_gang']);
spec('uprising', 'world uprising sweep', 'src/world.js', 'world_uprisings', ['status', 'day'],
  "SELECT day, npc_id FROM world_uprisings WHERE day < $1 AND status='active' ORDER BY day",
  (r, at) => r.status === 'active' && Number(r.day) < dayOf(at), 'Resolve the prior-day uprising.', ['day', 'npc_id']);
spec('npc-convoy-arrival', 'npc convoy despawn', 'src/convoy.js', 'convoys', ['is_npc', 'status', 'arrives_at'],
  "SELECT id FROM convoys WHERE is_npc AND status='transit' AND arrives_at <= now()",
  (r, at) => r.is_npc === true && r.status === 'transit' && due(r, 'arrives_at', at), 'Delete the arrived NPC convoy and its cargo/ambush rows atomically.');
spec('season-character', 'season rollover', 'src/worker.js', 'characters', ['alive', 'season'],
  'SELECT id FROM characters WHERE alive AND season < $1 ORDER BY id',
  (r, at) => r.alive === true && Number(r.season) < Math.floor(dayOf(at) / 28), 'Convert each living earlier-season character independently.');
spec('season-crown', 'season rollover', 'src/worker.js', 'season_records', ['crowned', 'season'],
  'SELECT season FROM season_records WHERE NOT crowned AND season < $1 ORDER BY season',
  (r, at) => r.crowned === false && Number(r.season) < Math.floor(dayOf(at) / 28), 'Retry the durable uncrowned season record.', ['season']);
spec('heist-plan', 'heist sweep', 'src/heists.js', 'crew_heists', ['status', 'created_at'],
  "SELECT id, job, leader_character FROM crew_heists WHERE status='planning' AND created_at < now() - $1::interval",
  (r, at) => r.status === 'planning' && due(r, 'created_at', at - HEIST_PLAN_TTL_MS, false), 'Abandon stale planning and refund a living leader.');
spec('pen-break-plan', 'pen break sweep', 'src/pen.js', 'pen_breaks', ['status', 'created_at'],
  "SELECT id, leader_character FROM pen_breaks WHERE status='planning' AND created_at < now() - $1::interval",
  (r, at) => r.status === 'planning' && due(r, 'created_at', at - PEN.COOP_TTL_MS, false), 'Abandon stale planning and return the living leader cutkit.');
spec('world-raid-plan', 'world raid sweep', 'src/world.js', 'world_raids', ['status', 'created_at'],
  "SELECT id FROM world_raids WHERE status='planning' AND created_at < $1",
  (r, at) => r.status === 'planning' && due(r, 'created_at', at - WORLD.COOP_TTL_MS, false), 'Abandon stale planning and release memberships.');
spec('bounty-expiry', 'bounty sweep', 'src/social/contracts.js', 'bounties', ['expires_at'],
  'SELECT target_character, kind FROM bounties WHERE expires_at IS NOT NULL AND expires_at <= now()',
  (r, at) => due(r, 'expires_at', at), 'Resolve the expired pot through the original refund transaction.', ['target_character', 'kind']);
spec('favor-expiry', 'favor sweep', 'src/favors.js', 'favors', ['status', 'expires_at'],
  "SELECT id, poster_character FROM favors WHERE status='open' AND expires_at < now() ORDER BY id",
  (r, at) => r.status === 'open' && due(r, 'expires_at', at, false), 'Refund the expired favor escrow.');
spec('auction-week', 'auction sweep', 'src/auction.js', 'auctions', ['status', 'week'],
  "SELECT lot_id FROM auctions WHERE status='live' AND week < $1 ORDER BY lot_id",
  (r, at) => r.status === 'live' && Number(r.week) < weekOf(dayOf(at)), 'Settle the earlier-week auction.', ['lot_id']);
spec('consignment-expiry', 'consignment sweep', 'src/auction.js', 'auction_consignments', ['status', 'closes_at'],
  "SELECT id FROM auction_consignments WHERE status='live' AND closes_at <= now() ORDER BY id",
  (r, at) => r.status === 'live' && due(r, 'closes_at', at), 'Settle or return the closed consignment.');
spec('commission-proposal', 'commission proposals', 'src/commission.js', 'commission_proposals', ['status', 'week'],
  "SELECT week FROM commission_proposals WHERE status='open' AND week < $1",
  (r, at) => r.status === 'open' && Number(r.week) < weekOf(dayOf(at)), 'Settle every open proposal from an earlier week.', ['week', 'gang_id', 'decree']);
for (const [id, table, field, query] of [
  ['director-situation', 'director_situations', 'terminal', 'SELECT * FROM director_situations WHERE terminal=false ORDER BY created_at,id LIMIT 33'],
  ['director-campaign', 'director_campaigns', 'status', "SELECT * FROM director_campaigns WHERE status='active' ORDER BY created_at,id LIMIT 33"],
]) spec(id, 'directorTick', 'src/director/runtime.js', table, [field, 'expires_at'], query,
  (r, at) => (field === 'terminal' ? r.terminal === false : r.status === 'active') && due(r, 'expires_at', at),
  'Original LIVE/LIMITED_COHORT tick resolves timely canonical consequences or expires/abandons; other modes do not mutate this lifecycle.', ['id'],
  { periodMs: 300000, originalReadLimit: 33, director: true });

spec('law-indictment', 'law sweep', 'src/law.js', 'characters', ['alive', 'indicted_at'],
  'SELECT id FROM characters WHERE alive AND indicted_at IS NOT NULL AND indicted_at <= $1 ORDER BY id',
  (r, at) => r.alive === true && due(r, 'indicted_at', at - LAW.INDICT_GRACE_MS), 'Force the canonical bust after indictment grace; both verdicts clear the indictment.');
spec('desk-auction-close', 'desk auction close', 'src/desk.js', 'desk_auctions', ['status', 'closes_at'],
  "UPDATE desk_auctions SET status='closed' WHERE status='live' AND closes_at <= $1",
  (r, at) => r.status === 'live' && due(r, 'closes_at', at), 'Close the expired selling right; unsold inventory never left the shelf.');
spec('family-retaliation', 'blood war manhunt', 'src/npcwar.js', 'family_aggro', ['scheduled_at'],
  'SELECT gang_id, target_character FROM family_aggro WHERE scheduled_at <= now()',
  (r, at) => due(r, 'scheduled_at', at), 'Claim and delete the one-shot retaliation, including a lost or shielded target.', ['gang_id']);
spec('npc-offensive-expiry', 'npc offensive', 'src/npcwar.js', 'npc_aggression', ['ends_at'],
  'DELETE FROM npc_aggression WHERE ends_at <= now()', (r, at) => due(r, 'ends_at', at), 'Reap the ended offensive before opening another.', ['npc_gang']);
spec('npc-offensive-strike', 'npc offensive', 'src/npcwar.js', 'npc_aggression', ['ends_at', 'next_strike_at'],
  'SELECT npc_gang, target_gang FROM npc_aggression WHERE next_strike_at <= now() AND ends_at > now()',
  (r, at) => due(r, 'next_strike_at', at) && instant(r.ends_at) > at,
  'Advance the strike clock even when no eligible mark exists or another retaliation is pending.', ['npc_gang']);
spec('npc-peace-offer', 'npc diplomacy', 'src/diplomacy.js', 'gang_relations', ['kind', 'accepted', 'proposed_by'],
  "SELECT gang_a, gang_b, proposed_by FROM gang_relations WHERE kind='pact' AND NOT accepted",
  (r, at, t) => r.kind === 'pact' && r.accepted === false && !t.gangs.some(g => g.id === r.proposed_by && g.npc_flag)
    && t.gangs.some(g => g.id === (r.proposed_by === r.gang_a ? r.gang_b : r.gang_a) && g.npc_flag),
  'NPC accepts a player peace proposal; player-player pacts are command-owned.', ['gang_a', 'gang_b'], { dependencies: { gangs: ['id', 'npc_flag'] } });
spec('secret-extortion', 'secrets sweep', 'src/secrets.js', 'secrets', ['extort_deadline', 'expires_at'],
  'SELECT * FROM secrets WHERE extort_deadline IS NOT NULL AND extort_deadline <= now() AND expires_at > now()',
  (r, at) => due(r, 'extort_deadline', at) && instant(r.expires_at) > at, 'Resolve the unpaid demand and delete the secret even if its target is gone.');
for (const [id, label, file, table, field, query, keys, inclusive] of [
  ['secret-expiry', 'secrets sweep', 'src/secrets.js', 'secrets', 'expires_at', 'DELETE FROM secrets WHERE expires_at <= now()', ['id'], true],
  ['coalition-expiry', 'diplomacy sweep', 'src/diplomacy.js', 'coalitions', 'expires_at', 'DELETE FROM coalitions WHERE expires_at <= now()', ['id'], true],
  ['contact-call-expiry', 'contact calls sweep', 'src/contacts.js', 'contact_calls', 'expires_at', 'DELETE FROM contact_calls WHERE expires_at < now()', ['character_id'], false],
  ['wiretap-expiry', 'wire sweep', 'src/wire.js', 'wiretaps', 'expires_at', 'DELETE FROM wiretaps WHERE expires_at <= now()', ['watcher_character', 'target_character'], true],
  ['wire-informant-expiry', 'wire sweep', 'src/wire.js', 'wire_informants', 'paid_until', 'DELETE FROM wire_informants WHERE paid_until <= now()', ['watcher_character', 'target_character'], true],
]) spec(id, label, file, table, [field], query, (r, at) => due(r, field, at, inclusive), 'Original worker removes the elapsed live-state row.', keys);
for (const [table, id] of [['crew_invites', 'crew-invite-expiry'], ['crew_requests', 'crew-request-expiry']])
  spec(id, 'crew invite sweep', 'src/crew.js', table, ['at'], `DELETE FROM ${table} WHERE at < $1`,
    (r, at) => due(r, 'at', at - CREW.INVITE_TTL_MS, false), 'Remove an invite/request older than the canonical shared TTL.', ['crew_id', 'account_id']);
spec('mentor-offer-expiry', 'mentor offer sweep', 'src/mentor.js', 'mentor_offers', ['at'],
  "DELETE FROM mentor_offers WHERE at < now() - ($1 || ' milliseconds')::interval",
  (r, at) => due(r, 'at', at - MENTOR.OFFER_TTL_MS, false), 'Remove the stale mentor offer.', ['mentor_account', 'protege_account']);
spec('mentor-seeking-expiry', 'mentor offer sweep', 'src/mentor.js', 'characters', ['seeking_mentor', 'seeking_mentor_at'],
  "UPDATE characters SET seeking_mentor=false WHERE seeking_mentor AND seeking_mentor_at < now() - ($1 || ' milliseconds')::interval",
  (r, at) => r.seeking_mentor === true && due(r, 'seeking_mentor_at', at - MENTOR.SEEKING_TTL_MS, false), 'Clear the expired seeking flag.');
for (const [id, label, file, table, status] of [
  ['boxing-card', 'main event sweep', 'src/boxing.js', 'boxing_bouts', 'booked'],
  ['poker-tournament', 'tournament sweep', 'src/casino.js', 'poker_tournaments', 'open'],
  ['track-futurity', 'futurity sweep', 'src/casino.js', 'futurities', 'open'],
  ['grand-prix', 'grand prix sweep', 'src/races.js', 'grand_prix', 'open'],
  ['stakes-race', 'stakes sweep', 'src/stable.js', 'stakes_races', 'open'],
]) spec(id, label, file, table, ['status', 'resolves_at'], `SELECT id FROM ${table} WHERE status='${status}' AND resolves_at <= now() ORDER BY resolves_at`,
  (r, at) => r.status === status && due(r, 'resolves_at', at), 'Resolve each due escrow-backed event through its original per-event transaction.');
spec('boxing-belt-deadline', 'belt defense', 'src/boxing.js', 'boxing_title', ['holder_fighter', 'callout_fighter', 'callout_deadline', 'last_defense', 'since'],
  'SELECT * FROM boxing_title WHERE id=1 AND holder_fighter IS NOT NULL FOR UPDATE',
  (r, at) => Number(r.id) === 1 && r.holder_fighter != null && ((r.callout_fighter != null && due(r, 'callout_deadline', at, false))
    || (r.last_defense || r.since) && instant(r.last_defense || r.since) < at - BOXING.DEFENSE_MS),
  'Resolve a ducked callout or strip an inactive champion; a dead challenger still has its callout cleared.');
spec('track-entry-settlement', 'track entries sweep', 'src/casino.js', 'track_entries', ['settled', 'day'],
  'SELECT DISTINCT day, race FROM track_entries WHERE day < $1 AND NOT settled',
  (r, at) => r.settled === false && Number(r.day) < dayOf(at), 'Settle each prior-day race group, including all its entries.', ['day', 'race']);
spec('ring-action-deadline', 'ring sweep', 'src/ring.js', 'poker_tables', ['street', 'act_deadline'],
  'SELECT id FROM poker_tables WHERE street IS NOT NULL AND act_deadline < now() ORDER BY id',
  (r, at) => r.street != null && due(r, 'act_deadline', at, false), 'Enforce the overdue action and settle a finished hand.');
spec('ring-idle-close', 'ring sweep', 'src/ring.js', 'poker_tables', ['street', 'last_action_at'],
  "SELECT id FROM poker_tables WHERE street IS NULL AND last_action_at < now() - ($1 || ' milliseconds')::interval ORDER BY id",
  (r, at) => r.street == null && due(r, 'last_action_at', at - CASINO.RING.IDLE_MS, false), 'Cash out or estate-burn remaining stacks, then delete seats and idle table.', ['id'],
  { sourceLiteral: "SELECT id FROM poker_tables WHERE street IS NULL AND last_action_at < now() - ($1 || \\' milliseconds\\')::interval ORDER BY id" });
for (const [id, label, file, table, alias, settled] of [
  ['linked-fee-credit', 'fee reconcile', 'src/fees.js', 'fee_payments', 'f', 'credited'],
  ['linked-store-grant', 'store reconcile', 'src/store.js', 'store_payments', 's', 'granted'],
]) spec(id, label, file, table, [settled, 'payer_address'],
  `SELECT DISTINCT ${alias}.payer_address, a.account_id FROM ${table} ${alias} JOIN account_persistent a ON lower(a.wallet_address) = lower(${alias}.payer_address) WHERE NOT ${alias}.${settled}`,
  (r, at, t) => r[settled] === false && r.payer_address != null && t.account_persistent.some(a => a.wallet_address != null
    && a.wallet_address.toLowerCase() === r.payer_address.toLowerCase()),
  'Credit/grant each unprocessed payment whose wallet is linked; unlinked payments wait for the canonical link prerequisite.', ['nonce'],
  { dependencies: { account_persistent: ['account_id', 'wallet_address'] } });
spec('funded-pass-stipend', 'pass stipend sweep', 'src/pass.js', 'account_persistent', ['pass_owed'],
  'SELECT account_id FROM account_persistent WHERE pass_owed > 0',
  (r, at, t) => round6(r.pass_owed) > 0 && t.vig_prize_pool.some(p => Number(p.id) === 1 && round6(p.balance) > 0),
  'Pay min(owed, backed pool balance); a dry pool is a source-defined funding prerequisite, not a failed payout.', ['account_id'],
  { dependencies: { vig_prize_pool: ['id', 'balance'] }, guards: ['if (!(pay > 0))'] });
spec('grand-referral-credit', 'grand-referral reconcile', 'src/game.js', 'account_persistent', ['ref_paid', 'ref_l2_paid', 'agent_flag', 'referred_by'],
  'SELECT r2.account_id AS r2 FROM account_persistent r2 JOIN account_persistent r ON r.account_id = r2.referred_by WHERE r2.ref_paid AND NOT r2.ref_l2_paid AND NOT r2.agent_flag AND r2.referred_by IS NOT NULL AND r.ref_paid AND NOT r.agent_flag AND r.referred_by IS NOT NULL LIMIT 1000',
  (r2, at, t) => {
    if (!r2.ref_paid || r2.ref_l2_paid || r2.agent_flag || r2.referred_by == null) return false;
    const r = t.account_persistent.find(a => a.account_id === r2.referred_by);
    if (!r?.ref_paid || r.agent_flag || r.referred_by == null || [r2.account_id, r.account_id].includes(r.referred_by)) return false;
    return t.account_persistent.some(a => a.account_id === r.referred_by && !a.agent_flag)
      && t.characters.some(c => c.account_id === r.referred_by && c.alive);
  }, 'Pay the qualified distinct two-level non-agent chain only when its non-agent grandrecruiter has a living street.', ['account_id'],
  { dependencies: { characters: ['id', 'account_id', 'alive'] }, originalReadLimit: 1000 });
spec('idempotency-orphan-reservation', 'idempotency prune (orphan reservations)', 'src/worker.js', 'idempotency', ['status', 'created_at'],
  "DELETE FROM idempotency WHERE status = 0 AND created_at < now() - interval '7 days'",
  (r, at) => Number(r.status) === 0 && due(r, 'created_at', at - 7 * 86400000, false), 'Remove only stale unresolved request reservations; completed replay receipts have separate retention.', ['account_id', 'key'], { periodMs: 86400000 });
spec('street-tax-due', 'buyback', 'src/worker.js', 'street_tax', ['pool', 'last_buyback'],
  'SELECT pool, last_buyback FROM street_tax WHERE id=1',
  (r, at) => Number(r.id) === 1 && Number(r.pool) > 0 && instant(r.last_buyback) <= at - 12 * 3600000,
  'Move the due street take through the original exchange carve; positive take inside the twelve-hour clock is not overdue.');
for (const [table, field] of [['stake_pool', 'balance'], ['rwa_dividend_pool', 'pool'], ['rwa_family_dividend_pool', 'pool']])
  spec('legacy-merge-' + table, 'legacy pools', 'src/exchange.js', table, [field], `SELECT ${field} FROM ${table} WHERE id=1 FOR UPDATE`,
    r => Number(r.id) === 1 && Number(r[field]) > 0, 'Drain the retired positive singleton into the Family yield pot.');

// A complete empty candidate set proves this conditional queue inapplicable.
// Present candidates retain UNKNOWN until their additional authority is supplied;
// no provider outage, funding condition or finite recovery window is guessed away.
const conditional = (id, label, file, table, fields, query, filter, reason, keys = ['id'], extra = {}) =>
  spec(id, label, file, table, fields, query, filter, reason, keys, { conditional: true, ...extra });
conditional('family-yield-eligible-payout', 'family yield', 'src/exchange.js', 'family_yield_pool', ['balance'],
  'SELECT balance FROM family_yield_pool WHERE id=1 FOR UPDATE', r => Number(r.balance) >= FAMILY_YIELD.MIN_PAYOUT,
  'A funded pot additionally needs the exact canonical decree/chamber/standing eligibility and payout-rounding review.');
conditional('prime-time-unsettled', 'prime time settle', 'src/primetime.js', 'primetime_rally', ['settled'],
  'SELECT r.character_id, ap.agent_flag, c.alive FROM primetime_rally r JOIN characters c ON c.id=r.character_id JOIN account_persistent ap ON ap.account_id=c.account_id WHERE r.day=$1 AND NOT r.settled',
  r => r.settled === false, 'Present rows need the declared seed/mechanic, exact closing window, join eligibility and original today-through-today-minus-three recovery limit. Older rows are not silently discarded.', ['day', 'character_id']);
conditional('nft-reimport-pending', 'reimport sweep', 'src/chain.js', 'nft_reimports', ['status'],
  "SELECT id, wallet_address, kind, catalog_id, rarity, amount FROM nft_reimports WHERE status='pending' ORDER BY created_at LIMIT 200",
  r => r.status === 'pending', 'Pending imports need the original wallet, living street, capacity and ownership prerequisites.', ['id'], { originalReadLimit: 200 });
conditional('deed-reimport-pending', 'deed reimport sweep', 'src/chain.js', 'deed_reimports', ['status'],
  "SELECT ref, wallet_address, token_id FROM deed_reimports WHERE status='pending' ORDER BY created_at LIMIT 200",
  r => r.status === 'pending', 'Pending deeds need original linked-wallet and existing-street eligibility; absence of a provider does not prove recovery.', ['ref'], { originalReadLimit: 200 });
for (const [id, label, query, kind] of [
  ['voucher-chain-reclaim', 'voucher reclaim', 'SELECT id, account_id, kind, amount, gear_id, nonce FROM vouchers WHERE status=\'signed\' AND NOT claimed_onchain AND deadline < $1 AND kind IN (${kindPh})', 'claim'],
  ['deed-voucher-reclaim', 'deed voucher sweep', "SELECT id, nonce, gear_id FROM vouchers WHERE kind='deed' AND status='signed' AND NOT claimed_onchain AND deadline < $1", 'deed'],
]) conditional(id, label, 'src/chain.js', 'vouchers', ['status', 'claimed_onchain', 'deadline', 'kind'], query,
  (r, at, t, config) => {
    if (r.status !== 'signed' || r.claimed_onchain !== false || !(kind === 'deed' ? r.kind === 'deed' : ['omr', 'gear', 'car', 'boat'].includes(r.kind))) return false;
    if (config.VOUCHER_RECLAIM_GRACE_SEC == null) return true;
    const grace = Number(config.VOUCHER_RECLAIM_GRACE_SEC); assert(Number.isFinite(grace) && grace >= 0, 'Invalid declared voucher reclaim grace');
    return Number(r.deadline) < Math.floor(at / 1000) - grace;
  }, 'Signed vouchers need the declared reclaim grace and, when due, actual chain nonce authority. Missing RPC is a skip/retry, never proof of no outstanding claim.');
conditional('wire-standing-watch-renewal', 'wire watches', 'src/wire.js', 'wire_watches', ['watcher_character'],
  'SELECT DISTINCT wc.id, wc.account_id, wc.wire_tier FROM wire_watches wa JOIN characters wc ON wc.id = wa.watcher_character AND wc.alive AND wc.wire_until > now()',
  (r, at, t) => t.characters.some(c => c.id === r.watcher_character && c.alive && instant(c.wire_until) > at),
  'An active subscription still needs original tier-slot ordering, live target, tap-renewal deadline and affordable account balance.', ['watcher_character', 'target_character'],
  { dependencies: { characters: ['id', 'alive', 'wire_until'] } });
conditional('wire-alert-delivery', 'wire alerts', 'src/wire.js', 'wiretaps', ['expires_at'],
  'SELECT w.watcher_character, w.target_character, t.name, t.wanted_until, t.indicted_at FROM wiretaps w JOIN characters t ON t.id = w.target_character AND t.alive JOIN characters wc ON wc.id = w.watcher_character AND wc.alive WHERE w.expires_at > now() AND wc.wire_until > now()',
  (r, at, t) => instant(r.expires_at) > at && t.characters.some(c => c.id === r.target_character && c.alive)
    && t.characters.some(c => c.id === r.watcher_character && c.alive && instant(c.wire_until) > at),
  'Present eligible taps require the original per-event alert flags and search/wanted/indictment witnesses; an active tap alone is not pending notification work.', ['watcher_character', 'target_character'],
  { dependencies: { characters: ['id', 'alive', 'wire_until'] } });

export const BACKLOG_REVIEW_TABLES = Object.freeze([...new Set(specs.flatMap(s => [s.table, ...Object.keys(s.dependencies || {})]))].sort());
export const BACKLOG_CLASS_COUNT = specs.length;
// This is a disposition of every other original safe() job, not a claim that
// provider availability, recurring economic production or retention is tested
// by this inventory. Those jobs keep their original scheduling/outcome proofs.
const nonQueueJobs = {
  'recurring-production-or-accrual': ['fair draw stamp', 'desk auction', 'capo license', 'ticker ballot', 'broker epoch',
    'contact calls', 'npc convoy spawn', 'population', 'resident behaviour', 'wanted hunt', 'city leg'],
  'historical-retention': ['vendetta prune', 'troll box retention', 'cellphone retention', 'results retention', 'duel log retention',
    'gala guest retention', 'telemetry retention', 'oauth state sweep', 'social claims sweep', 'rivals sweep', 'convoy hauls sweep', 'idempotency prune (completed)'],
  'monitoring-and-invariants': ['heartbeat', 'archiver health', 'oracle keeper health', 'chain parity', '§10.4 invariants',
    'vig invariants', 'bond invariants', 'treasury invariants', 'desk invariants', 'bank invariants', 'exchange invariants',
    'router invariants', 'family buyback invariants', 'dex bot invariants', 'RWA health'],
  'external-delivery-or-provider-keeper': ['stock token catalog', 'RWA ballot publish', 'web push sweep', 'email digest sweep',
    'liquidity automation', 'fee sync', 'store sync', 'claimed sync', 'bank harvest sync', 'bond sync', 'v4 oracle keeper',
    'gear re-import sync', 'deed extracted sync', 'deed redeemed sync', 'deed transfer sync', 'stock delivered sync',
    'stock delivery keeper', 'dynasty mint sync', 'dynasty transfer sync', 'lp depth sync', 'dex buyback', 'pol pairing'],
};
function workerJobCoverage() {
  const worker = sources.get('src/worker.js'), labels = [...new Set([...worker.matchAll(/safe\('([^']+)'/g)].map(match => match[1]))].sort();
  const queues = new Set(specs.map(s => s.label)), dispositions = [], unmapped = [];
  for (const label of labels) {
    if (queues.has(label)) continue;
    const category = Object.entries(nonQueueJobs).find(([, values]) => values.includes(label))?.[0]
      || (worker.includes(`safe('${label}', () => alertDrift(`) ? 'outbound-monitor-alert' : null);
    if (!category) { unmapped.push(label); continue; }
    dispositions.push({ workerLabel: label, category, status: 'NOT_APPLICABLE_TO_ROW_DRAINER_INVENTORY', sourceFile: 'src/worker.js',
      sourceSha256: BACKLOG_SOURCE_PINS['src/worker.js'], note: 'This is not evidence of disabled configuration, successful provider delivery, or completed recurring production.' });
  }
  return { originalSafeJobLabels: labels.length, inventoriedJobLabels: [...queues].sort(), dispositions, unmapped,
    policyScope: 'The same inventory applies to all 15 frozen workload policies; actor-policy choice never suppresses an original worker queue.' };
}
const INVARIANT_NAMES = ['world graph stack conservation', 'world graph unique custody and provenance', 'world graph object transitions',
  'family operation history', 'family operation custody', 'family operation capital', 'item lot definition integrity',
  'item lot quantity integrity', 'item lot custody integrity', 'item lot lineage parity', 'item lot conservation'];

export function reviewWorldBacklog(snapshot, { logicalAt, sourceRevision, configuration, lifecycleDiagnostics = null, invariants = null } = {}) {
  sourceProof(sourceRevision); assert(Number.isSafeInteger(logicalAt)); assert(configuration && typeof configuration === 'object');
  assert.equal(instant(snapshot.capturedAt), logicalAt, 'Snapshot clock differs from backlog boundary');
  assert.equal(snapshot.stateSha256, digest({ tables: snapshot.tables, sequences: snapshot.sequences }), 'Native snapshot hash mismatch');
  const tables = {}, unknown = [], inventory = [];
  for (const name of BACKLOG_REVIEW_TABLES) {
    if (!Array.isArray(snapshot.tables[name])) continue;
    tables[name] = snapshot.tables[name].map(row => { assert.equal(typeof row, 'string', 'Use complete native snapshot rows'); return JSON.parse(row); });
  }
  const mode = configuration.LIVING_WORLD_DIRECTOR;
  for (const s of specs) {
    assert(sources.get(s.file).includes(compact(s.sourceLiteral || s.query)), `Original backlog selector changed: ${s.id}`);
    for (const guard of s.guards || []) assert(sources.get(s.file).includes(compact(guard)), 'Original backlog guard changed');
    assert(sources.get('src/worker.js').includes(s.label), `Original worker no longer registers ${s.label}`);
    const required = { [s.table]: s.fields, ...s.dependencies };
    const missing = Object.entries(required).flatMap(([table, fields]) => !tables[table] ? [table]
      : tables[table].some(row => fields.some(field => !Object.hasOwn(row, field))) ? [table + ':columns'] : []);
    const meta = { id: s.id, workerLabel: s.label, schedulingPeriodMs: s.periodMs, sourceFile: s.file,
      sourceSha256: BACKLOG_SOURCE_PINS[s.file], selector: s.query, originalReadLimit: s.originalReadLimit || null,
      disposition: s.disposition, scope: 'All checkpoint rows matching original selection and documented skip guards; no internal commit order inferred' };
    if (missing.length) { inventory.push({ ...meta, status: 'UNKNOWN', dueIds: null, count: null }); unknown.push({ kind: 'missing-checkpoint-columns', id: s.id, missing }); continue; }
    const ids = [...new Set(tables[s.table].filter(row => s.filter(row, logicalAt, tables, configuration)).map(row => key(row, s.keys)))].sort();
    if (s.conditional) {
      inventory.push({ ...meta, scope: 'Complete conservative candidate inventory; prerequisite-dependent candidates are not relabeled as exact due work',
        status: ids.length ? 'UNKNOWN' : 'NOT_APPLICABLE', dueIds: ids.length ? null : [], count: ids.length ? null : 0,
        candidateIds: ids, reason: ids.length ? s.disposition : 'Complete checkpoint has no original conditional-queue candidates' });
      if (ids.length) unknown.push({ kind: 'conditional-worker-authority-required', id: s.id, candidateIds: ids, reason: s.disposition });
    } else if (s.director && !['LIVE', 'LIMITED_COHORT'].includes(mode)) {
      inventory.push({ ...meta, status: ['DIRECTOR_DISABLED', 'INTERNAL_SIMULATION', 'SHADOW_MODE'].includes(mode) ? 'NON_MUTATING_MODE' : 'UNKNOWN',
        dueIds: null, count: null, observedOverdueIds: ids });
      if (!['DIRECTOR_DISABLED', 'INTERNAL_SIMULATION', 'SHADOW_MODE'].includes(mode)) unknown.push({ kind: 'director-mutation-mode-not-declared', id: s.id });
    } else inventory.push({ ...meta, status: 'OBSERVED', dueIds: ids, count: ids.length });
  }
  const lifecycle = lifecycleDiagnostics?.coordination?.lifecycle || lifecycleDiagnostics?.lifecycle;
  if (lifecycleDiagnostics) assert.equal(lifecycleDiagnostics.logicalAt, logicalAt, 'Lifecycle evidence clock differs');
  const invariantResult = invariants?.checks ? invariants : invariants?.result;
  if (invariants?.logicalAt != null) assert.equal(invariants.logicalAt, logicalAt, 'Invariant evidence clock differs');
  const checks = INVARIANT_NAMES.map(name => invariantResult?.checks?.find(check => check.name === name)).filter(Boolean);
  const liveState = { structuralOrphanOperations: lifecycle?.complete ? lifecycle.structuralOrphanOperations : null,
    orphanedOperations: lifecycle?.complete ? lifecycle.orphanedOperations : null,
    issues: lifecycle?.issues || [], recoveryRequiredOperationIds: lifecycle?.recoveryRequiredOperationIds || null,
    overdueCommandOwnedOperationIds: lifecycle?.overdueOpenOperationIds || null,
    canonicalChecks: checks, failedCanonicalChecks: checks.filter(check => check.ok !== true).map(check => check.name),
    evidenceSha256: digest({ lifecycleDiagnostics, invariants }),
    scope: 'Existing operation lifecycle diagnostics and canonical custody/history/conservation checks; command expiry and positive recovery are separate authorities' };
  if (!lifecycle?.complete) unknown.push({ kind: 'operation-lifecycle-evidence-missing' });
  if (invariants && invariants.logicalAt == null) unknown.push({ kind: 'canonical-invariant-clock-binding-missing' });
  if (checks.length !== INVARIANT_NAMES.length) unknown.push({ kind: 'canonical-invariant-evidence-missing', missing: INVARIANT_NAMES.filter(name => !checks.some(c => c.name === name)) });
  const jobCoverage = workerJobCoverage();
  if (jobCoverage.unmapped.length) unknown.push({ kind: 'original-worker-job-disposition-missing', workerLabels: jobCoverage.unmapped });
  const report = { format: 1, logicalAt, snapshotStateSha256: snapshot.stateSha256, sourceRevision, sourcePins: BACKLOG_SOURCE_PINS,
    configuration, configurationSha256: digest(configuration), inventory, liveState, jobCoverage, unknown,
    scope: 'Original internal lifecycle drainers across the same workload policies, including Law, deferred financial work and explicitly conditional external-input queues. Recurring generators, provider polling, external notification transport and historical retention are separate from this row-draining inventory.',
    qualification: 'OBSERVATIONS_ONLY' };
  return { ...report, sha256: digest(report) };
}

export function compareWorldBacklogWindows(checkpoints) {
  const comparisons = [];
  for (const [index, current] of checkpoints.entries()) {
    const { sha256: hash, ...body } = current; assert.equal(hash, digest(body), 'Backlog checkpoint changed');
    if (!index) continue;
    const previous = checkpoints[index - 1]; assert(current.logicalAt > previous.logicalAt, 'Backlog windows must advance');
    assert.deepEqual(current.sourcePins, previous.sourcePins, 'Backlog authorities changed across windows');
    assert.equal(current.configurationSha256, previous.configurationSha256, 'Backlog configuration changed across windows');
    const rows = current.inventory.map(row => {
      const before = previous.inventory.find(prior => prior.id === row.id); assert(before);
      if (![row.status, before.status].every(status => ['OBSERVED', 'NOT_APPLICABLE'].includes(status)))
        return { id: row.id, status: 'UNKNOWN', beforeStatus: before.status, afterStatus: row.status };
      return { id: row.id, status: row.count > before.count ? 'GROWTH_OBSERVED' : 'NO_COUNT_GROWTH', before: before.count, after: row.count,
        added: row.dueIds.filter(id => !before.dueIds.includes(id)), cleared: before.dueIds.filter(id => !row.dueIds.includes(id)),
        persisting: row.dueIds.filter(id => before.dueIds.includes(id)) };
    });
    const a = previous.liveState.orphanedOperations, b = current.liveState.orphanedOperations;
    comparisons.push({ from: previous.logicalAt, to: current.logicalAt, beforeSha256: previous.sha256, afterSha256: current.sha256, rows,
      liveStateOrphans: { before: a, after: b, status: a == null || b == null ? 'UNKNOWN' : b > a ? 'GROWTH_OBSERVED' : 'NO_COUNT_GROWTH',
        beforeFailedCanonicalChecks: previous.liveState.failedCanonicalChecks, afterFailedCanonicalChecks: current.liveState.failedCanonicalChecks } });
  }
  return { format: 1, observations: checkpoints.length, comparisons,
    unknown: [...(checkpoints.length < 2 ? [{ kind: 'successive-lifecycle-window-checkpoints-missing' }] : []),
      ...checkpoints.filter(row => row.unknown.length).map(row => ({ checkpointSha256: row.sha256, logicalAt: row.logicalAt, unknown: row.unknown }))],
    qualification: 'OBSERVATIONS_ONLY', note: 'The caller selects the actual successive lifecycle windows. Counts are exact with no tolerance; recurring queues can reuse a primary key, so a persisting key alone does not prove uninterrupted backlog. No callback completion, resource parity or two endpoint snapshots alone establishes full-window qualification.' };
}
