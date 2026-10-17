// Full server/estate integration: unused lives never create future chain gas jobs,
// while already tracked custody still closes when the financial rail is disabled.
process.env.MOD_KEY = 'deed-custody-test-mod';
import assert from 'node:assert/strict';
import { buildServer } from './server-fixture.js';
import { ensureCharacterDeedLife } from '../src/deedcustody.js';
assert(!process.env.DATABASE_URL, 'Disposable in-memory app only');
const before = process.env.CHARACTER_DEED_CUSTODY_ENABLED;
delete process.env.CHARACTER_DEED_CUSTODY_ENABLED;
const app = await buildServer();
try {
  const seed = async name => {
    const guest = (await app.inject({method:'POST',url:'/v1/auth/guest'})).json();
    const headers = {authorization:`Bearer ${guest.token}`};
    assert.equal((await app.inject({method:'POST',url:'/v1/character',headers,payload:{name}})).statusCode,200);
    return (await app.inject({method:'GET',url:'/v1/me',headers})).json().character;
  };
  const kill = characterId => app.inject({method:'POST',url:'/v1/mod/kill',headers:{'x-mod-key':process.env.MOD_KEY},payload:{characterId}});
  const unused = await seed('Unused property life');
  assert.equal((await kill(unused.id)).statusCode,200);
  assert.equal((await app.pool.query('SELECT count(*)::int n FROM character_deed_lives')).rows[0].n,0);
  assert.equal((await app.pool.query('SELECT next_death_sequence FROM character_deed_state')).rows[0].next_death_sequence,1);
  const tracked = await seed('Tracked property life');
  await ensureCharacterDeedLife(app.pool,tracked.id);
  assert.equal((await kill(tracked.id)).statusCode,200);
  const death = (await app.pool.query('SELECT * FROM character_deed_deaths')).rows;
  assert.equal(death.length,1); assert.equal(death[0].life_id,tracked.id);
  const closed = (await app.pool.query('SELECT * FROM character_deed_lives WHERE life_id=$1',[tracked.id])).rows[0];
  const heir = (await app.pool.query('SELECT * FROM characters WHERE id=$1',[closed.heir_life_id])).rows[0];
  assert.equal(heir.alive,true); assert.equal(Number(heir.generation),Number(closed.generation)+1);
  assert.equal(closed.closure_reason,'estate_inheritance');
  console.log('deedcustody-estate-hook: PASS (real moderator death/estate skips untracked gas backlog, tracked death and exact heir remain journaled with rail disabled)');
} finally {
  await app.close();
  if (before == null) delete process.env.CHARACTER_DEED_CUSTODY_ENABLED; else process.env.CHARACTER_DEED_CUSTODY_ENABLED=before;
}
