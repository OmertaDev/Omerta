// District PvE drills have their own encounter health/stamina. They never change a character's
// core health, inventory, money, respect or contact standing. Server stats/skills select tactics.
import crypto from 'node:crypto';
import { GameError } from './game.js';
import { withItemRead, withItemTransaction, registerItemTransactionUndo } from './items.js';
import { finalizeHttpIdempotency } from './http-idempotency.js';

export const CITY_ENCOUNTERS = Object.freeze([
  ['docks','Quayside sentry','Read the sentry’s patrol rhythm.'],
  ['neon','Backstage bouncer','Get past a patient, defensive opponent.'],
  ['foundry','Foundry automaton','Time your response to its heavy wind-up.'],
  ['brick','Brickyard sparring partner','Break a guard without wasting your stamina.'],
  ['canal','Canal lookout','Use a feint or negotiate a quiet passage.'],
  ['cathedral','Hill watchkeeper','Choose when to defend and when to advance.'],
].map(([district,name,description]) => Object.freeze({ id: district + '-patrol', district, name, description,
  enemyHealth: 24, enemyPower: 5, rounds: 12, clue: 'Patrol note: ' + name + ' announces a strike, a brace or a pressure move before committing.' })));
const MOVES = Object.freeze(['strike','guard','feint','negotiate','retreat']);
const fail = (code, message) => { throw new GameError(code, message); };
const viewer = actor => ({ characterId: actor.id, generation: Number(actor.generation), district: actor.loc });
const canonical = value => typeof value === 'string' && /^[!-~]{1,200}$/.test(value);
export function validateEncounterBody(kind, body) {
  const fields = kind === 'start' ? ['characterId','generation','district','scenarioId'] : ['characterId','generation','district','expectedRevision','move'];
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== fields.length
    || Object.keys(body).some(key => !fields.includes(key)) || !canonical(body.characterId) || !canonical(body.district)
    || !Number.isSafeInteger(body.generation) || body.generation < 1
    || kind === 'start' && !CITY_ENCOUNTERS.some(scenario => scenario.id === body.scenarioId)
    || kind === 'turn' && (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 1 || !MOVES.includes(body.move))) {
    fail('bad_encounter_request', 'Use the issued encounter action.');
  }
}
async function actorFor(client, accountId, lock = false) {
  const actor = (await client.query(`SELECT id,account_id,generation,loc,name,muscle,cunning,speed FROM characters
    WHERE account_id=$1 AND alive ORDER BY created_at DESC,id LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [accountId])).rows[0];
  const account = (await client.query('SELECT status FROM accounts WHERE id=$1', [accountId])).rows[0];
  if (!actor || account?.status === 'banned') fail('encounter_unavailable', 'A current living character is required.');
  const skills = (await client.query('SELECT skill_id FROM character_skills WHERE character_id=$1', [actor.id])).rows;
  return { ...actor, skills: new Set(skills.map(row => row.skill_id)) };
}
function current(actor, body) {
  if (actor.id !== body.characterId || Number(actor.generation) !== body.generation || actor.loc !== body.district)
    fail('encounter_identity_changed', 'Your character or district changed. Refresh before continuing.');
}
function action(id, label, path, body, blockedBy = []) {
  return { id, label, method: 'POST', path, body, available: !blockedBy.length, blockedBy };
}
function intent(model) { return ['strike','brace','pressure'][(model.turn + model.pattern) % 3]; }
function modelOf(row) {
  let model;
  try { model = JSON.parse(row.model_json); } catch { fail('encounter_integrity', 'The encounter cannot refresh.'); }
  const scenario=CITY_ENCOUNTERS.find(value=>value.id===row.scenario_id);
  if (!model || typeof model!=='object' || Array.isArray(model)
    || Object.keys(model).length!==9 || Object.keys(model).some(key=>!['turn','pattern','health','maxHealth','stamina','enemyHealth','enemyMaxHealth','tempo','last'].includes(key))
    || !scenario || row.district!==scenario.district
    || !Number.isSafeInteger(model.turn) || model.turn < 0 || model.turn > scenario.rounds
    || !Number.isSafeInteger(model.pattern) || model.pattern < 0 || model.pattern > 2
    || ![model.health,model.maxHealth,model.stamina,model.enemyHealth,model.enemyMaxHealth,model.tempo].every(Number.isSafeInteger)
    || model.maxHealth<20 || model.maxHealth>30 || model.enemyMaxHealth!==scenario.enemyHealth
    || model.health < 0 || model.health > model.maxHealth || model.enemyHealth < 0 || model.enemyHealth > model.enemyMaxHealth
    || model.stamina < 0 || model.stamina > 10 || model.tempo < 0 || model.tempo > 2 || typeof model.last !== 'string' || model.last.length>1000
    || !Number.isSafeInteger(Number(row.revision)) || Number(row.revision)!==model.turn+1
    || row.status==='active'&&(model.turn>=scenario.rounds||model.health===0||model.enemyHealth===0)
    || row.status==='won'&&(model.enemyHealth!==0||model.health===0||model.turn===0)
    || row.status==='lost'&&(model.health!==0||model.enemyHealth===0||model.turn===0)
    || ['truce','retreated'].includes(row.status)&&(model.health===0||model.enemyHealth===0||model.turn===0)
    || row.status==='stalemate'&&(model.turn!==scenario.rounds||model.health===0||model.enemyHealth===0)) {
    fail('encounter_integrity', 'The encounter cannot refresh.');
  }
  return model;
}
function project(actor, row) {
  const scenario = CITY_ENCOUNTERS.find(value => value.id === row.scenario_id), model = modelOf(row);
  if (!scenario) fail('encounter_integrity', 'The encounter cannot refresh.');
  const base = { ...viewer(actor), expectedRevision: Number(row.revision) };
  const actions = row.status === 'active' ? MOVES.map(move => {
    const blockers = [];
    if(row.district!==actor.loc&&move!=='retreat')blockers.push({code:'return_to_encounter_district'});
    if (['strike','feint'].includes(move) && model.stamina < 2) blockers.push({ code: 'encounter_stamina' });
    if (move === 'negotiate' && !actor.skills.has('fast_talker') && model.enemyHealth > model.enemyMaxHealth / 2) blockers.push({ code: 'weaken_or_learn_fast_talker' });
    return action(move, { strike:'Strike · 2 stamina',guard:'Guard · recover 1 stamina',feint:'Feint · 2 stamina',negotiate:'Negotiate a passage',retreat:'Retreat safely' }[move],
      '/v1/city/encounters/' + encodeURIComponent(row.id) + '/turn', { ...base, move }, blockers);
  }) : [];
  return { id: row.id, scenarioId: scenario.id, name: scenario.name, district: row.district,
    revision: Number(row.revision), status: row.status, turn: model.turn, roundLimit: scenario.rounds,
    health: model.health, maxHealth: model.maxHealth, stamina: model.stamina,
    enemyHealth: model.enemyHealth, enemyMaxHealth: model.enemyMaxHealth, intent: row.status === 'active' ? intent(model) : null,
    last: model.last, clue: ['won','truce'].includes(row.status) ? scenario.clue : null, actions };
}
export async function encounterBoard(pool, accountId) {
  return withItemRead(pool, async client => {
    const actor = await actorFor(client, accountId);
    const rows = (await client.query(`SELECT * FROM city_encounters WHERE owner_character_id=$1 AND owner_generation=$2
      ORDER BY created_at DESC,id DESC LIMIT 16`, [actor.id, Number(actor.generation)])).rows;
    const active = rows.find(row => row.status === 'active');
    const clues = [];
    const discovered = (await client.query(`SELECT DISTINCT scenario_id FROM city_encounters
      WHERE owner_character_id=$1 AND owner_generation=$2 AND status IN ('won','truce') ORDER BY scenario_id`,
    [actor.id,Number(actor.generation)])).rows;
    for (const row of discovered) {
      const scenario = CITY_ENCOUNTERS.find(value => value.id === row.scenario_id);
      if (scenario) clues.push({ scenarioId: scenario.id, title: scenario.name, text: scenario.clue });
    }
    return { viewer: viewer(actor), mode: 'district-drill', description: 'Tactical encounters use separate drill health and stamina. Core health, resources and money do not change.',
      scenarios: CITY_ENCOUNTERS.filter(scenario => scenario.district === actor.loc).map(scenario => ({ id:scenario.id,district:scenario.district,name:scenario.name,description:scenario.description,
        action: action('start:' + scenario.id, 'Prepare encounter', '/v1/city/encounters/start', { ...viewer(actor), scenarioId: scenario.id },
          active ? [{ code: 'encounter_already_active' }] : []) })),
      active: active ? project(actor, active) : null, history: rows.filter(row => row.status !== 'active').map(row => project(actor,row)), clues };
  });
}
async function acknowledge(client, receipt, result) {
  const response = JSON.stringify(result);
  registerItemTransactionUndo(client, () => client.query(`UPDATE idempotency SET status=0,response=$4
    WHERE account_id=$1 AND key=$2 AND body_hash=$3 AND status=200 AND response=$5`,
  [receipt.accountId,receipt.key,receipt.bodyHash,receipt.reservationToken,response]));
  const completion = await finalizeHttpIdempotency(client, receipt, { status: 200, response });
  if (completion.rowCount !== 1) fail('contention', 'Recover this same request key.');
}
async function mutate(pool, accountId, body, receipt, work) {
  if (receipt?.accountId !== accountId || !canonical(receipt.key) || typeof receipt.bodyHash !== 'string'
    || typeof receipt.reservationToken !== 'string') fail('idempotency_required', 'Use a reserved Idempotency-Key.');
  return withItemTransaction(pool, async client => {
    const actor = await actorFor(client, accountId, true); current(actor, body);
    const result = await work(client, actor);
    await acknowledge(client, receipt, result); return result;
  });
}
export function startEncounter(pool, accountId, body, receipt) {
  validateEncounterBody('start', body);
  return mutate(pool, accountId, body, receipt, async (client, actor) => {
    const scenario = CITY_ENCOUNTERS.find(value => value.id === body.scenarioId);
    if (scenario.district !== actor.loc) fail('encounter_district', 'Travel to this district before preparing its encounter.');
    if ((await client.query("SELECT id FROM city_encounters WHERE owner_character_id=$1 AND owner_generation=$2 AND status='active'",
      [actor.id,Number(actor.generation)])).rows.length) fail('encounter_already_active', 'Finish or retreat from your current encounter.');
    const id = crypto.randomUUID(), maxHealth = 20 + Math.min(10, Math.floor(Math.max(0,Number(actor.muscle) || 0) / 10));
    const model = { turn:0,pattern:crypto.randomInt(3),health:maxHealth,maxHealth,stamina:10,enemyHealth:scenario.enemyHealth,
      enemyMaxHealth:scenario.enemyHealth,tempo:0,last:'Prepared. Read the announced enemy intent before choosing a move.' };
    registerItemTransactionUndo(client, () => client.query('DELETE FROM city_encounters WHERE id=$1', [id]));
    const row = (await client.query(`INSERT INTO city_encounters(id,owner_character_id,owner_generation,scenario_id,district,revision,status,model_json)
      VALUES($1,$2,$3,$4,$5,1,'active',$6) RETURNING *`, [id,actor.id,Number(actor.generation),scenario.id,actor.loc,JSON.stringify(model)])).rows[0];
    return { ok:true, viewer:viewer(actor), encounter:project(actor,row), message:'Encounter prepared. No core resources were spent.' };
  });
}
export function takeEncounterTurn(pool, accountId, id, body, receipt) {
  if (!canonical(id)) fail('bad_encounter_request', 'Use the issued encounter.');
  validateEncounterBody('turn', body);
  return mutate(pool, accountId, body, receipt, async (client, actor) => {
    const row = (await client.query(`SELECT * FROM city_encounters WHERE id=$1 AND owner_character_id=$2 AND owner_generation=$3 FOR UPDATE`,
      [id,actor.id,Number(actor.generation)])).rows[0];
    if (!row || row.status !== 'active') fail('encounter_unavailable', 'That encounter is unavailable.');
    if (row.district !== actor.loc && body.move!=='retreat' || Number(row.revision) !== body.expectedRevision) fail('encounter_changed', 'Refresh or return to the encounter district before choosing another move.');
    const available = project(actor,row).actions.find(action => action.id === body.move);
    if (!available?.available) fail('encounter_move_unavailable', 'That tactic is unavailable.');
    const model = modelOf(row), announced = intent(model), scenario = CITY_ENCOUNTERS.find(value => value.id === row.scenario_id);
    let status = 'active', dealt = 0, taken = 0;
    if (body.move === 'retreat') { status='retreated'; model.last='You withdraw. Core health and resources are unchanged.'; }
    else if (body.move === 'negotiate') { status='truce'; model.last='A negotiated passage reveals the patrol rhythm.'; }
    else {
      const muscle = Math.min(4,Math.floor(Math.max(0,Number(actor.muscle)||0)/10));
      const cunning = Math.min(4,Math.floor(Math.max(0,Number(actor.cunning)||0)/10));
      if (body.move === 'strike') {
        dealt=5+muscle+(actor.skills.has('bruiser')?2:0)+model.tempo; model.tempo=0; model.stamina-=2;
        if (announced==='brace') dealt=Math.ceil(dealt/2);
      } else if (body.move==='feint') { dealt=(announced==='brace'?8:3)+cunning; model.stamina-=2; }
      else { model.stamina=Math.min(10,model.stamina+1); model.tempo=Math.min(2,model.tempo+1); }
      model.enemyHealth=Math.max(0,model.enemyHealth-dealt);
      if (!model.enemyHealth) status='won';
      else if (announced!=='brace') {
        taken=announced==='pressure'?3:scenario.enemyPower;
        if (body.move==='guard') taken=Math.max(0,taken-4);
        if (body.move==='feint' && cunning>=2) taken=Math.ceil(taken/2);
        model.health=Math.max(0,model.health-taken);
        if (!model.health) status='lost';
      }
      model.last=(body.move==='guard'?'You guard and recover stamina.':`Your ${body.move} deals ${dealt}.`) + ` The announced ${announced} deals ${taken} drill damage.`;
    }
    model.turn++;
    if (status==='active' && model.turn>=scenario.rounds) { status='stalemate'; model.last+=' The drill ends at its round limit.'; }
    registerItemTransactionUndo(client, () => client.query('UPDATE city_encounters SET revision=$2,status=$3,model_json=$4,completed_at=$5 WHERE id=$1',
      [row.id,row.revision,row.status,row.model_json,row.completed_at]));
    const changed=(await client.query(`UPDATE city_encounters SET revision=revision+1,status=$2,model_json=$3,
      completed_at=CASE WHEN $2='active' THEN NULL ELSE now() END WHERE id=$1 AND revision=$4 RETURNING *`,
    [row.id,status,JSON.stringify(model),body.expectedRevision])).rows[0];
    if (!changed) fail('contention','Recover this same request key.');
    return { ok:true,viewer:viewer(actor),encounter:project(actor,changed),message:model.last };
  });
}
