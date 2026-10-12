import { employmentConservationQuery } from './gameemployment.js';

// Call in the existing canonical invariant's consistent snapshot. Reserve/wage/
// refund are custody transfers; death:employment is the only new cash sink.
export async function employmentCashInvariant(client) {
  const actual = Number((await client.query(employmentConservationQuery)).rows[0].employment_cash);
  const transfers = Number((await client.query("SELECT COALESCE(SUM(amount),0) AS amount FROM transactions WHERE currency='cash' AND reason LIKE 'employment:%' AND character_id IS NOT NULL")).rows[0].amount);
  const death = Number((await client.query("SELECT COALESCE(SUM(amount),0) AS amount FROM transactions WHERE currency='cash' AND reason LIKE 'death:employment:%'")).rows[0].amount);
  const loot = Number((await client.query("SELECT COALESCE(SUM(amount),0) AS amount FROM transactions WHERE currency='cash' AND reason LIKE 'employment:estate:loot:%' AND character_id IS NULL")).rows[0].amount);
  const bookLoot = Number((await client.query('SELECT COALESCE(SUM(looted_cash),0) AS amount FROM game_employment_jobs')).rows[0].amount);
  const expected = -transfers + death + loot;
  return { name:'game employment escrow',actual,expected,delta:actual-expected,lootedCash:bookLoot,lootDelta:bookLoot+loot,
    ok:Number.isFinite(actual) && Number.isFinite(expected) && actual===expected && bookLoot===-loot };
}
