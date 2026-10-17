import assert from 'node:assert/strict';
import { buildServer } from '../../test/server-fixture.js';
import { ensureCharacterDeedLife, characterDeedExitJobKey } from '../../src/deedcustody.js';
import { withCharacter, withTwoCharacters } from '../../src/game.js';
import { runEstate } from '../../src/social/estate.js';
import { withItemTransaction } from '../../src/items.js';
assert(!process.env.DATABASE_URL, 'Disposable pg-mem only');
process.env.INVITE_MODE='off'; process.env.RATE_LIMIT='off';
const app=await buildServer();
try {
  const seed=async name=>{
    const guest=(await app.inject({method:'POST',url:'/v1/auth/guest'})).json();
    const headers={authorization:'Bearer '+guest.token};
    assert.equal((await app.inject({method:'POST',url:'/v1/character',headers,payload:{name}})).statusCode,200);
    const view=(await app.inject({method:'GET',url:'/v1/me',headers})).json().character;
    const character=(await app.pool.query('SELECT id,account_id FROM characters WHERE id=$1',[view.id])).rows[0];
    return {...view,accountId:character.account_id};
  };
  const actor=await seed('Barrier actor'), target=await seed('Barrier target');
  const life=await ensureCharacterDeedLife(app.pool,actor.id);
  const exit={deed_token_id:'77',user_nonce:'0',user_issued_at:'1700000000',user_deadline:'1700000300',user_signature:'0x1234'};
  await app.pool.query(`INSERT INTO character_deed_exits(life_id,deed_token_id,status,requested_at,available_at,user_nonce,user_issued_at,user_deadline,user_signature)
    VALUES ($1,'77','pending',now(),now(),'0','1700000000','1700000300','0x1234')`,[actor.id]);
  await app.pool.query(`INSERT INTO keeper_transactions(id,chain_id,wallet,target,target_code_hash,job_key,action_hash,nonce,raw_tx,tx_hash,request_json,budget_json,metadata_json,gas_limit,max_fee_per_gas,priority_fee_per_gas,confirmations,status)
    VALUES ('review-barrier',31337,'wallet','target','runtime',$1,'action',0,'fixture','hash','{}','[]','{}','50000','1','1',1,'prepared')`,[characterDeedExitJobKey(exit,life.life_hash)]);
  let called=0;
  const attempt=()=>{called++;return{ok:true};};
  await assert.rejects(()=>withCharacter(app.pool,actor.accountId,attempt),{code:'custody_exit_finalizing'});
  await assert.rejects(()=>withTwoCharacters(app.pool,actor.accountId,target.id,attempt),{code:'custody_exit_finalizing'});
  await assert.rejects(()=>withTwoCharacters(app.pool,target.accountId,actor.id,attempt),{code:'custody_exit_finalizing'});
  assert.equal(called,0,'Neither actor nor target can enter an offensive callback while the release is finalizing');
  await assert.rejects(()=>withItemTransaction(app.pool,async client=>{
    const victim=(await client.query('SELECT * FROM characters WHERE id=$1 FOR UPDATE',[actor.id])).rows[0];
    await runEstate(client,{},victim,'REVIEW NPC');
  }),{code:'custody_exit_finalizing'});
  assert.equal((await app.pool.query('SELECT alive FROM characters WHERE id=$1',[actor.id])).rows[0].alive,true);
  await app.pool.query("UPDATE keeper_transactions SET status='reverted' WHERE id='review-barrier'");
  await withCharacter(app.pool,actor.accountId,attempt);
  assert.equal(called,1,'A proven reverted raw transaction clears the barrier');
  console.log('independent actual action-wrapper proof: PASS (withCharacter, both sides of withTwoCharacters, headless runEstate block before callback/death; proven revert resumes actions; full disposable pg-mem app, synthetic journal row)');
} finally {await app.close();}
