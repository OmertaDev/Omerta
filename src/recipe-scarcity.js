import { GameError } from './game.js';
import { seasonIdxOf } from './rules.js';
import { registerItemTransactionUndo, assertItemTransaction } from './items.js';

const unavailable = () => { throw new GameError('recipe_exhausted', 'That recipe is unavailable for this period.'); };
function rowsFor(recipe, actor, asOf) {
  if (!Number.isSafeInteger(asOf) || asOf < 0) unavailable();
  const day = Math.floor(asOf / 86400000);
  return recipe.scarcity.caps.map((cap) => ({ ...cap,
    subject: cap.scope === 'global' ? '*' : cap.scope === 'territory' ? actor.character.loc : actor.owner.id,
    epoch: cap.period === 'lifetime' ? 'all' : cap.period === 'day' ? String(day)
      : cap.period === 'week' ? String(Math.floor(day / 7)) : String(seasonIdxOf(day)),
  })).sort((a, b) => JSON.stringify([recipe.id, a.scope, a.subject, a.period, a.epoch]).localeCompare(JSON.stringify([recipe.id, b.scope, b.subject, b.period, b.epoch])));
}
const key = (recipe, row) => [recipe.id, row.scope, row.subject, row.period, row.epoch];
export async function recipeScarcityAvailable(client, recipe, actor, asOf) {
  for (const row of rowsFor(recipe, actor, asOf)) {
    const current = (await client.query(`SELECT used FROM world_recipe_usage
      WHERE recipe_id=$1 AND scope=$2 AND subject_id=$3 AND period_kind=$4 AND period_key=$5`, key(recipe, row))).rows[0];
    if (Number(current?.used || 0) >= row.limit) return false;
  }
  return true;
}
export async function reserveRecipeScarcity(client, recipe, actor, asOf) {
  assertItemTransaction(client);
  for (const row of rowsFor(recipe, actor, asOf)) {
    const args = key(recipe, row);
    let prior = (await client.query(`SELECT used,updated_at FROM world_recipe_usage
      WHERE recipe_id=$1 AND scope=$2 AND subject_id=$3 AND period_kind=$4 AND period_key=$5 FOR UPDATE`, args)).rows[0];
    if (!prior) {
      // Read first avoids pg-mem's inaccurate ON CONFLICT rowCount. On PostgreSQL,
      // a concurrent inserter wins the unique key and the following lock sees its count.
      // Compensation is executed only by the globally serialized pg-mem writer.
      // Register before INSERT because acknowledgement can fail after the write.
      registerItemTransactionUndo(client, () => client.query(`DELETE FROM world_recipe_usage
        WHERE recipe_id=$1 AND scope=$2 AND subject_id=$3 AND period_kind=$4 AND period_key=$5`, args));
      await client.query(`INSERT INTO world_recipe_usage(recipe_id,scope,subject_id,period_kind,period_key,used)
        VALUES($1,$2,$3,$4,$5,0) ON CONFLICT DO NOTHING RETURNING recipe_id`, args);
      prior = (await client.query(`SELECT used,updated_at FROM world_recipe_usage
        WHERE recipe_id=$1 AND scope=$2 AND subject_id=$3 AND period_kind=$4 AND period_key=$5 FOR UPDATE`, args)).rows[0];
    }
    if (!prior || Number(prior.used) >= row.limit) unavailable();
    const saved = { used: Number(prior.used), updatedAt: prior.updated_at };
    registerItemTransactionUndo(client, () => client.query(`UPDATE world_recipe_usage SET used=$6,updated_at=$7
      WHERE recipe_id=$1 AND scope=$2 AND subject_id=$3 AND period_kind=$4 AND period_key=$5`, [...args, saved.used, saved.updatedAt]));
    const changed = await client.query(`UPDATE world_recipe_usage SET used=used+1,updated_at=now()
      WHERE recipe_id=$1 AND scope=$2 AND subject_id=$3 AND period_kind=$4 AND period_key=$5 AND used+1 <= $6 RETURNING used`, [...args, row.limit]);
    if (changed.rowCount !== 1) unavailable();
  }
}
