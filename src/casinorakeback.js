// Checkpoint historical den volume before casino membership changes. The den singleton lock
// serializes this with bets and other membership changes; caller owns the character transaction.
// Indices are text-serialized rational numbers so neither driver Number coercion nor repeated
// division can lose fractional claims. The denominator is reduced after every checkpoint.
import { CASINO } from './rules.js';

const fraction = (n, d = 1n) => {
  let a = n < 0n ? -n : n, b = d;
  while (b) [a, b] = [b, a % b];
  return { n: n / a, d: d / a };
};
const decode = (value) => {
  const [n, d = '1'] = String(value).split('/');
  return { n: BigInt(n), d: BigInt(d) };
};
const encode = ({ n, d }) => d === 1n ? n.toString() : `${n}/${d}`;
const plus = (a, b) => fraction(a.n * b.d + b.n * a.d, a.d * b.d);
const earnedIndex = (volume, owners) => fraction(
  owners > 0 ? BigInt(Math.max(0, Math.floor(volume))) * BigInt(CASINO.RAKEBACK_BPS || 0) : 0n,
  10000n * BigInt(owners || 1),
);

export async function checkpointCasinoRakeback(client) {
  const row = (await client.query(
    'SELECT total, rake_index, rake_checkpoint_volume, rake_legacy_owners FROM den_volume WHERE id=1 FOR UPDATE',
  )).rows[0];
  const volume = Number(row.total);
  const owners = Number((await client.query("SELECT COUNT(*) n FROM businesses WHERE kind='casino'")).rows[0].n);
  const initialized = row.rake_checkpoint_volume !== null && row.rake_checkpoint_volume !== undefined;
  const previous = initialized ? Number(row.rake_checkpoint_volume) : volume;
  const legacyOwners = initialized ? Number(row.rake_legacy_owners) : owners;
  const index = initialized
    ? plus(decode(row.rake_index), earnedIndex(Math.max(0, volume - previous), owners))
    : earnedIndex(volume, owners);
  await client.query(
    'UPDATE den_volume SET rake_index=$1, rake_checkpoint_volume=$2, rake_legacy_owners=$3 WHERE id=1',
    [encode(index), Math.max(previous, volume), legacyOwners],
  );
  return { volume, index: encode(index), legacyOwners };
}

export function casinoRakebackClaim(front, checkpoint) {
  // Pre-migration ownership history cannot be reconstructed. Freeze the legacy formula at the
  // first checkpoint's owner count, then use the historical index for every later interval.
  const cursor = front.rake_index_cursor === null || front.rake_index_cursor === undefined
    ? earnedIndex(Number(front.rake_cursor), checkpoint.legacyOwners)
    : decode(front.rake_index_cursor);
  const owed = plus(decode(checkpoint.index), { n: -cursor.n, d: cursor.d });
  const amount = Number((owed.n > 0n ? owed.n : 0n) / owed.d);
  return { amount, paidCursor: encode(plus(cursor, fraction(BigInt(amount)))) };
}

export async function checkpointCasinoOwnerRemoval(client, characterId) {
  if ((await client.query("SELECT 1 FROM businesses WHERE character_id=$1 AND kind='casino'", [characterId])).rows[0])
    return checkpointCasinoRakeback(client);
  return null;
}
