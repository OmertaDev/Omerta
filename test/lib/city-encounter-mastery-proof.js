import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Called by the original encounter command in both memory and real PostgreSQL modes.
export async function proveEncounterMastery({ app, player, board, act, call, ok }) {
  const actor=await player('Rhythm Witness');
  await app.pool.query('UPDATE characters SET muscle=50,cunning=50 WHERE id=$1',[actor.id]);
  const resources=async()=>({
    character:(await app.pool.query('SELECT cash,bank,health,energy,nerve,heat,respect,ammo FROM characters WHERE id=$1',[actor.id])).rows[0],
    ledger:Number((await app.pool.query('SELECT count(*) n FROM transactions WHERE character_id=$1 OR account_id=$2',[actor.id,actor.account])).rows[0].n)
  });
  const before=await resources(),cycles=new Set();
  for(const district of ['docks','neon','foundry','brick','canal','cathedral']) {
    await app.pool.query('UPDATE characters SET loc=$2 WHERE id=$1',[actor.id,district]);
    const initial=await board(actor),classic=initial.scenarios.find(s=>s.id===district+'-patrol'),scenario=initial.scenarios.find(s=>s.id===district+'-mastery-v1');
    assert(classic && scenario);assert.equal(initial.scenarios.length,2);assert.equal(classic.challenge,undefined);
    assert.match(scenario.challenge,/8 rounds.*half your drill health/);
    const startKey=crypto.randomUUID(),started=await act(actor,scenario.action,startKey);
    assert.deepEqual(await act(actor,scenario.action,startKey),started,'Exact start replay retains the same server-selected rhythm');
    assert.equal(started.encounter.mastery.achieved,false);assert.equal(started.encounter.enemyMaxHealth,28);
    assert.equal((await call(actor,'POST','/v1/city/encounters/start',{...scenario.action.body,mastery:true})).statusCode,400);
    let active=started.encounter,rounds=0,final,lastAction,lastKey;const announced=[];
    while(active && rounds++<12){
      announced.push(active.intent);
      const move=active.intent==='strike'?'guard':active.intent==='brace'&&active.stamina>=2?'feint':active.stamina>=2?'strike':'guard';
      lastAction=active.actions.find(a=>a.id===move);assert.equal(lastAction.available,true);
      lastKey=crypto.randomUUID();final=await act(actor,lastAction,lastKey);
      active=final.encounter.status==='active'?final.encounter:null;
    }
    assert(final);assert.equal(final.encounter.status,'won',district+' responds to its announced intents');
    assert.equal(final.encounter.mastery.achieved,true,district+' achieves the published optional challenge');
    assert(final.encounter.turn<=8&&final.encounter.health>=Math.ceil(final.encounter.maxHealth/2));
    assert.match(final.encounter.last,/Rhythm mastered/);assert.match(final.encounter.clue,/four-beat rhythm/);
    assert.deepEqual(await act(actor,lastAction,lastKey),final,'Exact final replay cannot create another completion');
    assert.equal((await call(actor,lastAction.method,lastAction.path,{...lastAction.body,move:'retreat'},lastKey)).statusCode,422);
    const fresh=await board(actor);assert.equal(fresh.active,null);assert.deepEqual(fresh.history[0],final.encounter);
    cycles.add(announced.join(','));
  }
  assert(cycles.size>=4,'The six new opponents use meaningfully different announced rhythms');
  const finalBoard=await board(actor);assert.equal(finalBoard.history.length,6);assert.equal(finalBoard.clues.length,6);
  const outsider=await player('Rhythm Outsider');assert.equal((await board(outsider)).history.length,0);
  assert.deepEqual((await board(outsider)).clues,[]);
  // Negotiation is a distinct valid ending, not a mastery award.
  const scenario=(await board(actor)).scenarios.find(s=>s.id==='cathedral-mastery-v1');
  await act(actor,scenario.action);let b=await board(actor);
  while(b.active.enemyHealth>14){
    const e=b.active,move=e.intent==='brace'?'feint':e.intent==='strike'?'guard':'strike';
    await act(actor,e.actions.find(a=>a.id===move));b=await board(actor);
  }
  const truce=await act(actor,b.active.actions.find(a=>a.id==='negotiate'));
  assert.equal(truce.encounter.status,'truce');assert.equal(truce.encounter.mastery.achieved,false);
  assert.match(truce.encounter.last,/agreed terms/);
  assert.deepEqual(await resources(),before,'Mastery and negotiation change no core resources or money');
  console.log('City encounter mastery: six actual rhythms, published optional challenge, both conclusions, exact replay, closed input, privacy and unchanged resources passed');
}
