// Launch admission codes. Player allowances are account-scoped and never reset on death or Crew changes.
import crypto from 'node:crypto';
import { GameError } from './game.js';

export const CREW_INVITE_LIMIT = 3;
export function inviteModeEnabled(env = { INVITE_MODE: process.env.INVITE_MODE,
  NODE_ENV: process.env.NODE_ENV, DATABASE_URL: process.env.DATABASE_URL }) {
  if (env.INVITE_MODE !== undefined) return env.INVITE_MODE !== 'off';
  return env.NODE_ENV === 'production' || !!env.DATABASE_URL;
}

export function generateInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  // Rejection-free crypto.randomInt keeps all 20 base-32 characters uniform (100 bits).
  const chars = Array.from({ length: 20 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
  return 'OMR-' + chars.match(/.{5}/g).join('-');
}

export function normalizeInviteCode(code) {
  if (typeof code !== 'string' || code.length > 128) return '';
  const trimmed = code.trim();
  return /^omr-/i.test(trimmed) ? trimmed.toUpperCase() : trimmed;
}

export async function inviteBoard(client, accountId) {
  const rows = (await client.query(
    'SELECT code, uses_left, created_at FROM invite_codes WHERE created_by=$1 ORDER BY created_at, code', [accountId],
  )).rows;
  const member = (await client.query('SELECT crew_id FROM crew_members WHERE account_id=$1', [accountId])).rows[0];
  const living = (await client.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true', [accountId])).rows[0];
  const enabled = inviteModeEnabled();
  const remaining = Math.max(0, CREW_INVITE_LIMIT - rows.length);
  const blockedBy = !enabled ? 'invites_disabled' : !living ? 'no_character' : !member ? 'no_crew' : !remaining ? 'invite_limit' : null;
  return { enabled, limit: CREW_INVITE_LIMIT, remaining, eligible: !blockedBy, blockedBy,
    codes: rows.map((r) => ({ code: r.code, usesLeft: Number(r.uses_left), createdAt: r.created_at })) };
}

// Caller holds Crew -> living character -> account -> membership locks through withCharacter.
export async function issueCrewInvite(ch, client) {
  const board = await inviteBoard(client, ch.account_id);
  if (!board.eligible) throw new GameError(board.blockedBy,
    board.blockedBy === 'invite_limit' ? 'You have issued all three of your launch invites.' : 'Join a crew to issue launch invites while the doors are invite-only.');
  const code = generateInviteCode();
  await client.query('INSERT INTO invite_codes (code, uses_left, created_by) VALUES ($1,1,$2)', [code, ch.account_id]);
  return { inviteIssued: true, code, ...await inviteBoard(client, ch.account_id) };
}
