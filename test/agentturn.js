// The autonomous turn contract: one throttled read must give an agent current state, extraction
// readiness, the human coach context, live market signals, and at least one executable JSON action.
process.env.RATE_LIMIT = 'off';
process.env.JWT_SECRET = 'test-jwt-secret-for-agent-turn';

import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';

const app = await buildServer();
const call = async (method, url, { token, body, idempotencyKey } = {}) => {
  const res = await app.inject({ method, url,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
    }, payload: body });
  return { code: res.statusCode, body: res.json() };
};

try {
  const guest = (await call('POST', '/v1/auth/guest')).body.token;
  const token = (await call('POST', '/v1/auth/agent-key', { token: guest })).body.token;
  await call('POST', '/v1/character', { token, body: { name: 'Turn Machine' } });

  const turn = await call('GET', '/v1/agent/turn', { token });
  assert.equal(turn.code, 200, 'the agent turn endpoint is mounted and authenticated');
  assert.match(turn.body.turnId, /^turn_[0-9a-f]{64}$/,
    'every executable snapshot carries an opaque server-issued turn id');
  assert.deepEqual(turn.body.state.identity, {
    id: turn.body.state.identity.id, name: 'Turn Machine', level: 1, generation: 1, district: 'docks',
  }, 'the compact turn state identifies the living street without returning the whole sheet');
  assert.equal('character' in turn.body, false, 'the compact turn omits the read wrapper\'s full character sheet');
  assert.equal('events' in turn.body, false, 'the compact turn omits the empty mutation-event envelope');
  assert.deepEqual(turn.body.extraction, {
    stage: 'wallet_required', wallet: null, minted: false, canExtract: false,
  }, 'the turn makes the wallet and character-mint extraction gates explicit');
  await app.pool.query(
    "UPDATE account_persistent SET wallet_address='0x1111111111111111111111111111111111111111' WHERE account_id=(SELECT account_id FROM characters WHERE id=$1)",
    [turn.body.state.identity.id]);
  const linked = (await call('GET', '/v1/agent/turn', { token })).body;
  assert.equal(linked.extraction.stage, 'character_mint_required',
    'linking a wallet advances the agent to the mandatory character-mint gate');
  await app.pool.query(
    'UPDATE account_persistent SET minted=true WHERE account_id=(SELECT account_id FROM characters WHERE id=$1)',
    [turn.body.state.identity.id]);
  process.env.CHAIN_ID = '1';
  process.env.VOUCHER_CLAIM_ADDRESS = 'not-an-address';
  process.env.VOUCHER_SIGNER_PK = 'not-a-private-key';
  const minted = (await call('GET', '/v1/agent/turn', { token })).body;
  assert.deepEqual(minted.extraction, {
    stage: 'rail_dormant', wallet: '0x1111111111111111111111111111111111111111', minted: true, canExtract: false,
  }, 'minting completes the account prerequisites but malformed chain configuration still fails closed');
  delete process.env.CHAIN_ID;
  delete process.env.VOUCHER_CLAIM_ADDRESS;
  delete process.env.VOUCHER_SIGNER_PK;
  assert.ok(turn.body.coach?.label && Array.isArray(turn.body.coachPlan), 'the turn carries the personalized coach queue');
  assert.ok(turn.body.opportunities?.summary && turn.body.opportunities?.niches,
    'the turn includes the live economic signals that previously required a second throttled read');

  const crime = turn.body.actions.find((a) => a.kind === 'crime');
  assert.deepEqual({ method: crime?.method, path: crime?.path, body: crime?.body, executable: crime?.executable }, {
    method: 'POST', path: '/v1/crimes/stereo', body: { approach: 'standard' }, executable: true,
  }, 'the turn exposes a currently executable action as structured method/path/body JSON');
  assert.deepEqual(crime.cost, { nerve: 3 }, 'the action declares its exact immediate cost');
  assert.deepEqual(crime.reward.cash, { min: 90, max: 260 }, 'the action declares the published reward range');
  assert.equal(crime.risk.baseSuccessPct, 78, 'the action labels the published base rate as an estimate');
  assert.equal('successPct' in crime.risk, false, 'the action never presents the base rate as a personalized exact chance');
  assert.ok(turn.body.actions.every((action) => Number.isFinite(action.score) && action.ev?.basis),
    'every executable action carries a transparent expected-value score and basis');
  assert.deepEqual(turn.body.actions.map((action) => action.rank),
    turn.body.actions.map((_, index) => index + 1), 'the executable actions expose their one-based EV rank');
  assert.ok(turn.body.actions.every((action, index, actions) => index === 0 || actions[index - 1].score >= action.score),
    'the executable action queue is sorted from highest to lowest expected value');
  assert.equal(turn.body.recommendedActionId, turn.body.actions[0].id,
    'the turn names the highest-ranked executable action without making the agent infer it');
  assert.deepEqual(turn.body.ranking, {
    method: 'cash_equivalent', cashUnit: 'dollars', respectCashValue: 25,
    liabilityProtectionWeight: 1.25, refreshAfterEveryAction: true,
  }, 'the turn publishes the scoring policy and requires a fresh observation after every mutation');
  assert.equal(turn.body.policy.cashReserve, 1000,
    'the planner publishes the cash floor it will preserve when sizing investments');

  // Guaranteed server-side reward claims belong in the same EV queue. They must be derived from
  // the mounted boards and executed through /v1/agent/act, never reconstructed or paid by the MCP.
  await app.pool.query('UPDATE characters SET lc_crime=1 WHERE id=$1', [turn.body.state.identity.id]);
  const onboardTurn = (await call('GET', '/v1/agent/turn', { token })).body;
  const onboardClaim = onboardTurn.actions.find((action) => action.id === 'reward:onboard:ob_crime');
  assert.deepEqual({ kind: onboardClaim?.kind, method: onboardClaim?.method,
    path: onboardClaim?.path, body: onboardClaim?.body, risk: onboardClaim?.risk }, {
    kind: 'onboard_claim', method: 'POST', path: '/v1/onboard/ob_crime/claim',
    body: {}, risk: { level: 'none' },
  }, 'a ready First Week payout becomes its exact mounted, risk-free claim descriptor');
  assert.equal(onboardClaim?.ev?.confidence, 1,
    'a ready deterministic reward is ranked at full confidence');
  assert.match(onboardTurn.recommendedActionId, /^reward:onboard:/,
    'a guaranteed onboarding payout outranks the starter crime');
  assert.equal(onboardTurn.actions.some((action) => action.id === 'reward:onboard:ob_boost'), false,
    'an unfinished onboarding task is not executable');
  assert.equal(onboardTurn.actions.some((action) => action.kind === 'social_claim'), false,
    'human-only and proof-deferred social rewards are never synthesized');
  const onboardPaid = await call('POST', '/v1/agent/act', {
    token, idempotencyKey: 'agent-turn-onboard-claim',
    body: { turnId: onboardTurn.turnId, actionId: onboardClaim.id },
  });
  assert.equal(onboardPaid.code, 200,
    'the authoritative turn executor closes a ready onboarding reward loop');
  assert.equal(onboardPaid.body.result.cash, 500,
    'the executor delegates to the canonical onboarding payout');
  assert.equal(onboardPaid.body.turn.actions.some((action) => action.id === onboardClaim.id), false,
    'a paid onboarding action disappears from the returned replacement turn');

  const accountId = (await app.pool.query('SELECT account_id FROM characters WHERE id=$1',
    [turn.body.state.identity.id])).rows[0].account_id;
  const identity = (await app.pool.query('SELECT auth_provider,auth_subject FROM accounts WHERE id=$1',
    [accountId])).rows[0];
  const socialEnv = Object.fromEntries(['SOCIAL_VERIFY_MODE', 'X_BEARER_TOKEN', 'X_TARGET_USER_ID']
    .map((key) => [key, process.env[key]]));
  try {
    process.env.SOCIAL_VERIFY_MODE = 'live';
    process.env.X_BEARER_TOKEN = 'agent-turn-test-bearer';
    process.env.X_TARGET_USER_ID = 'agent-turn-target';
    await app.pool.query("UPDATE accounts SET auth_provider='x',auth_subject='agent-turn-player' WHERE id=$1",
      [accountId]);
    const proofDeferred = (await call('GET', '/v1/agent/turn', { token })).body;
    assert.equal(proofDeferred.actions.some((action) => action.id === 'reward:onboard:ob_x'), false,
      'a social card whose proof is deferred to an external verifier is never executable');
  } finally {
    await app.pool.query('UPDATE accounts SET auth_provider=$1,auth_subject=$2 WHERE id=$3',
      [identity.auth_provider, identity.auth_subject, accountId]);
    for (const [key, value] of Object.entries(socialEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  const dailyBoard = (await call('GET', '/v1/daily', { token })).body;
  const readyDaily = dailyBoard.jobs.find((job) => !job.blocked);
  assert(readyDaily, 'the daily board exposes at least one structurally executable contract');
  await app.pool.query(
    'INSERT INTO daily_progress (character_id,day,counters,claimed) VALUES ($1,$2,$3,$4)',
    [turn.body.state.identity.id, dailyBoard.day,
      JSON.stringify({ [readyDaily.kind]: readyDaily.goal }), '[]']);
  const dailyTurn = (await call('GET', '/v1/agent/turn', { token })).body;
  const dailyClaim = dailyTurn.actions.find((action) => action.id === `reward:daily:${readyDaily.id}`);
  assert.deepEqual({ kind: dailyClaim?.kind, method: dailyClaim?.method,
    path: dailyClaim?.path, body: dailyClaim?.body, confidence: dailyClaim?.ev?.confidence }, {
    kind: 'daily_claim', method: 'POST', path: `/v1/daily/${readyDaily.id}/claim`,
    body: {}, confidence: 1,
  }, 'a completed unblocked daily becomes its exact mounted claim descriptor');
  const dailyPaid = await call('POST', '/v1/agent/act', {
    token, idempotencyKey: 'agent-turn-daily-claim',
    body: { turnId: dailyTurn.turnId, actionId: dailyClaim.id },
  });
  assert.equal(dailyPaid.code, 200,
    'the authoritative turn executor closes a ready daily reward loop');
  assert.equal(dailyPaid.body.result.payout, dailyClaim.ev.cash,
    'the daily descriptor and canonical payout agree exactly');
  assert.equal(dailyPaid.body.turn.actions.some((action) => action.id === dailyClaim.id), false,
    'a paid daily action disappears from the returned replacement turn');

  await app.pool.query("UPDATE characters SET path='gun' WHERE id=$1", [turn.body.state.identity.id]);
  const careerTurn = (await call('GET', '/v1/agent/turn', { token })).body;
  const careerClaim = careerTurn.actions.find((action) => action.id === 'reward:career:ca_path');
  assert.deepEqual({ kind: careerClaim?.kind, method: careerClaim?.method,
    path: careerClaim?.path, body: careerClaim?.body, cash: careerClaim?.ev?.cash }, {
    kind: 'career_claim', method: 'POST', path: '/v1/career/ca_path', body: {}, cash: 1000,
  }, 'a ready open career rung becomes its exact mounted claim descriptor');
  assert.equal(careerTurn.actions.some((action) => action.id === 'reward:career:ca_strap'), false,
    'an incomplete career rung stays outside the executable queue');
  const careerPaid = await call('POST', '/v1/agent/act', {
    token, idempotencyKey: 'agent-turn-career-claim',
    body: { turnId: careerTurn.turnId, actionId: careerClaim.id },
  });
  assert.equal(careerPaid.code, 200,
    'the authoritative turn executor closes a ready career reward loop');
  assert.equal(careerPaid.body.result.pay, 1000,
    'the executor delegates to the canonical career payout');
  assert.equal(careerPaid.body.turn.actions.some((action) => action.id === careerClaim.id), false,
    'a paid career action disappears from the returned replacement turn');
  await app.pool.query(
    'UPDATE account_persistent SET onboard=$2 WHERE account_id=(SELECT account_id FROM characters WHERE id=$1)',
    [turn.body.state.identity.id, JSON.stringify({ ob_crime: true, ob_boost: true, ob_bank: true,
      ob_path: true, ob_family: true, ob_wallet: true })]);

  await app.pool.query('UPDATE characters SET cash=5000 WHERE id=$1', [turn.body.state.identity.id]);
  const fundedTurn = (await call('GET', '/v1/agent/turn', { token })).body;
  assert.ok(fundedTurn.plans.every((plan, index, plans) => index === 0 || plans[index - 1].score >= plan.score),
    'multi-step plans are EV-ranked independently of the immediate action queue');
  const arbitragePlan = fundedTurn.plans.find((plan) => plan.kind === 'arbitrage');
  assert(arbitragePlan?.ev?.cash > 0 && arbitragePlan.quantity > 0,
    `the deterministic market signal becomes a profitable sized arbitrage plan (${JSON.stringify(arbitragePlan)})`);
  assert.equal(arbitragePlan.refreshAfterStep, true,
    'multi-step market plans require a fresh turn after every state-changing leg');
  const arbitrageNext = fundedTurn.actions.find((action) => action.id === arbitragePlan.nextActionId);
  assert.equal(arbitrageNext?.planId, arbitragePlan.id,
    'only the plan\'s currently valid next step is promoted into the executable queue');
  const expectedArbitragePath = fundedTurn.state.identity.district === arbitragePlan.buyIn
    ? '/v1/goods/buy' : `/v1/travel/${arbitragePlan.buyIn}`;
  assert.equal(arbitrageNext.path, expectedArbitragePath,
    'the arbitrage plan starts with travel or purchase according to live location');
  await app.pool.query('UPDATE characters SET cash=500 WHERE id=$1', [turn.body.state.identity.id]);

  await app.pool.query('UPDATE characters SET loc=$2 WHERE id=$1',
    [turn.body.state.identity.id, arbitragePlan.buyIn]);
  await app.pool.query('INSERT INTO character_cargo (character_id,good_id,qty) VALUES ($1,$2,2)',
    [turn.body.state.identity.id, arbitragePlan.route[1].good]);
  const loadedTurn = (await call('GET', '/v1/agent/turn', { token })).body;
  const loadedPlan = loadedTurn.plans.find((plan) => plan.id === arbitragePlan.id);
  const sellward = loadedTurn.actions.find((action) => action.id === loadedPlan?.nextActionId);
  assert.deepEqual({ status: loadedPlan?.status, quantity: loadedPlan?.quantity, path: sellward?.path }, {
    status: 'travel_to_sell', quantity: 2, path: `/v1/travel/${arbitragePlan.sellIn}`,
  }, 'after acquisition, a fresh turn advances the same plan toward its sale district');
  await app.pool.query('DELETE FROM character_cargo WHERE character_id=$1', [turn.body.state.identity.id]);
  await app.pool.query("UPDATE characters SET loc='docks' WHERE id=$1", [turn.body.state.identity.id]);

  await app.pool.query(
    "INSERT INTO businesses (id,character_id,kind,tier,last_collect_at,upkeep_at) VALUES ('agent-front',$1,'laundromat',1,now()-interval '1 hour',now())",
    [turn.body.state.identity.id]);
  const frontTurn = (await call('GET', '/v1/agent/turn', { token })).body;
  const collectFronts = frontTurn.actions.find((action) => action.kind === 'business_collect');
  assert.deepEqual({ method: collectFronts?.method, path: collectFronts?.path, body: collectFronts?.body }, {
    method: 'POST', path: '/v1/business/collect', body: {},
  }, 'banked front income becomes a directly executable passive-collection action');
  assert(collectFronts.ev.cash >= 11_900,
    `the front collection score uses the live server-computed pending take (${collectFronts?.ev?.cash})`);
  assert.equal(frontTurn.recommendedActionId, collectFronts.id,
    'a large deterministic passive take outranks the starter crime');
  await app.pool.query("DELETE FROM businesses WHERE id='agent-front'");

  await app.pool.query("INSERT INTO gangs (id,name,tag) VALUES ('agent-family','Turn Family','TURN')");
  await app.pool.query("INSERT INTO gang_members (gang_id,character_id,role) VALUES ('agent-family',$1,'soldier')",
    [turn.body.state.identity.id]);
  await app.pool.query(
    "INSERT INTO territory_rackets (district_id,owner_gang,tier,kind,last_income_at,upkeep_at) VALUES ('docks','agent-family',1,'numbers',now()-interval '1 hour',now())");
  const territoryTurn = (await call('GET', '/v1/agent/turn', { token })).body;
  const collectTerritory = territoryTurn.actions.find((action) => action.kind === 'territory_collect');
  assert.deepEqual({ method: collectTerritory?.method, path: collectTerritory?.path, body: collectTerritory?.body }, {
    method: 'POST', path: '/v1/territory/collect', body: {},
  }, 'family territory income becomes a safe collection action for any member');
  assert(collectTerritory.ev.treasury > 0,
    'territory collection is ranked from the family board pending take without calling it personal cash');
  await app.pool.query("DELETE FROM territory_rackets WHERE owner_gang='agent-family'");
  await app.pool.query("DELETE FROM gang_members WHERE gang_id='agent-family'");
  await app.pool.query("DELETE FROM gangs WHERE id='agent-family'");

  await app.pool.query("UPDATE characters SET lab='bathtub' WHERE id=$1", [turn.body.state.identity.id]);
  await app.pool.query(
    "INSERT INTO batches (id,character_id,drug_id,qty,done_at) VALUES ('agent-batch',$1,'vim',10,now()-interval '1 minute')",
    [turn.body.state.identity.id]);
  const cookedTurn = (await call('GET', '/v1/agent/turn', { token })).body;
  const collectBatch = cookedTurn.actions.find((action) => action.kind === 'kitchen_collect');
  const kitchenPlan = cookedTurn.plans.find((plan) => plan.kind === 'kitchen');
  assert.deepEqual({ method: collectBatch?.method, path: collectBatch?.path, body: collectBatch?.body }, {
    method: 'POST', path: '/v1/kitchen/collect', body: {},
  }, 'a finished batch becomes an executable kitchen-collection action');
  assert.equal(kitchenPlan?.nextActionId, collectBatch.id,
    'the kitchen loop points at the currently valid batch step');
  assert(collectBatch.ev.inventory > 0 && collectBatch.risk.firePct === 8,
    'the batch action values expected inventory and publishes the lab fire risk');
  await app.pool.query("DELETE FROM batches WHERE id='agent-batch'");

  await app.pool.query(
    "INSERT INTO batches (id,character_id,drug_id,qty,done_at) VALUES ('agent-batch-wait',$1,'vim',10,now()+interval '5 seconds')",
    [turn.body.state.identity.id]);
  await app.pool.query('UPDATE characters SET nerve=0,last_accrued_at=now() WHERE id=$1',
    [turn.body.state.identity.id]);
  const cookingTurn = (await call('GET', '/v1/agent/turn', { token })).body;
  const blockedBatch = cookingTurn.blockedActions.find((action) => action.kind === 'kitchen_collect');
  assert.equal(blockedBatch?.blockedBy?.[0]?.code, 'cooking',
    'an active burner is represented as a timed blocked action, not an invalid executable call');
  const kitchenWaitMs = new Date(cookingTurn.nextWakeAt).getTime() - Date.now();
  assert(kitchenWaitMs >= 1_000 && kitchenWaitMs <= 6_000,
    `the batch clock beats nerve regeneration in the unified wake schedule (${kitchenWaitMs}ms)`);
  await app.pool.query("DELETE FROM batches WHERE id='agent-batch-wait'");
  await app.pool.query('UPDATE characters SET nerve=10,last_accrued_at=now() WHERE id=$1',
    [turn.body.state.identity.id]);
  await app.pool.query('UPDATE characters SET lab=NULL WHERE id=$1', [turn.body.state.identity.id]);

  await app.pool.query(
    "INSERT INTO convoys (id,owner_character,origin,destination,status,departed_at,arrives_at) VALUES ('agent-convoy',$1,'neon','docks','transit',now()-interval '1 hour',now()-interval '1 minute')",
    [turn.body.state.identity.id]);
  await app.pool.query("INSERT INTO convoy_cargo (convoy_id,good_id,qty) VALUES ('agent-convoy','gin',6)");
  const arrivedTurn = (await call('GET', '/v1/agent/turn', { token })).body;
  const collectConvoy = arrivedTurn.actions.find((action) => action.kind === 'convoy_collect');
  const convoyPlan = arrivedTurn.plans.find((plan) => plan.kind === 'convoy');
  assert.deepEqual({ method: collectConvoy?.method, path: collectConvoy?.path, body: collectConvoy?.body }, {
    method: 'POST', path: '/v1/convoy/agent-convoy/collect', body: {},
  }, 'arrived freight at the current district becomes an executable collection action');
  assert.equal(convoyPlan?.nextActionId, collectConvoy.id,
    'the convoy loop identifies collection as its live next step');
  assert(collectConvoy.ev.inventory > 0,
    'the convoy is ranked by the destination value of recoverable freight');
  await app.pool.query("UPDATE characters SET loc='neon' WHERE id=$1", [turn.body.state.identity.id]);
  const convoyTravelTurn = (await call('GET', '/v1/agent/turn', { token })).body;
  const travelForConvoy = convoyTravelTurn.actions.find((action) => action.kind === 'convoy_travel');
  assert.deepEqual({ path: travelForConvoy?.path, cashEv: travelForConvoy?.ev?.cash,
    displayedCost: travelForConvoy?.cost?.cash }, {
    path: '/v1/travel/docks', cashEv: -250, displayedCost: 250,
  }, 'an arrived convoy in another district subtracts its required travel from ranked EV');
  await app.pool.query("UPDATE characters SET loc='docks' WHERE id=$1", [turn.body.state.identity.id]);
  await app.pool.query("DELETE FROM convoy_cargo WHERE convoy_id='agent-convoy'");
  await app.pool.query("DELETE FROM convoys WHERE id='agent-convoy'");

  await app.pool.query(
    "INSERT INTO convoys (id,owner_character,origin,destination,status,departed_at,arrives_at) VALUES ('agent-convoy-wait',$1,'neon','docks','transit',now(),now()+interval '5 seconds')",
    [turn.body.state.identity.id]);
  await app.pool.query("INSERT INTO convoy_cargo (convoy_id,good_id,qty) VALUES ('agent-convoy-wait','gin',6)");
  await app.pool.query('UPDATE characters SET nerve=0,last_accrued_at=now() WHERE id=$1',
    [turn.body.state.identity.id]);
  const rollingTurn = (await call('GET', '/v1/agent/turn', { token })).body;
  const blockedConvoy = rollingTurn.blockedActions.find((action) => action.kind === 'convoy_collect');
  assert.equal(blockedConvoy?.blockedBy?.[0]?.code, 'en_route',
    'in-transit freight is a timed blocked action until its authoritative arrival clock');
  const convoyWaitMs = new Date(rollingTurn.nextWakeAt).getTime() - Date.now();
  assert(convoyWaitMs >= 1_000 && convoyWaitMs <= 6_000,
    `convoy arrival participates in the unified wake schedule (${convoyWaitMs}ms)`);
  await app.pool.query("DELETE FROM convoy_cargo WHERE convoy_id='agent-convoy-wait'");
  await app.pool.query("DELETE FROM convoys WHERE id='agent-convoy-wait'");
  await app.pool.query('UPDATE characters SET nerve=10,last_accrued_at=now() WHERE id=$1',
    [turn.body.state.identity.id]);

  const otherToken = (await call('POST', '/v1/auth/guest')).body.token;
  await call('POST', '/v1/character', { token: otherToken, body: { name: 'Order Buyer' } });
  const other = (await app.pool.query("SELECT id FROM characters WHERE name='Order Buyer'")).rows[0];

  await app.pool.query(
    "INSERT INTO loans (id,lender_character,borrower_character,principal,rate,hours,status,due_at) VALUES ('agent-debt',$1,$2,100,0.1,24,'active',now()+interval '1 hour')",
    [other.id, turn.body.state.identity.id]);
  await app.pool.query('UPDATE characters SET cash=2000 WHERE id=$1', [turn.body.state.identity.id]);
  const debtTurn = (await call('GET', '/v1/agent/turn', { token })).body;
  const repayDebt = debtTurn.actions.find((action) => action.kind === 'loan_repay');
  const debtPlan = debtTurn.plans.find((plan) => plan.kind === 'loan');
  assert.deepEqual({ method: repayDebt?.method, path: repayDebt?.path, body: repayDebt?.body }, {
    method: 'POST', path: '/v1/loans/agent-debt/repay', body: {},
  }, 'an affordable near-due debt becomes a conservative repayment action');
  assert.deepEqual({ cash: repayDebt?.ev?.cash, liability: repayDebt?.ev?.liability },
    { cash: -110, liability: 110 }, 'repayment distinguishes cash outflow from liability removed');
  assert.equal(debtPlan?.nextActionId, repayDebt.id,
    'the loan plan names repayment as its current safe next step');
  await app.pool.query("DELETE FROM loans WHERE id='agent-debt'");
  await app.pool.query('UPDATE characters SET cash=500 WHERE id=$1', [turn.body.state.identity.id]);

  const agentAccount = (await app.pool.query('SELECT account_id FROM characters WHERE id=$1',
    [turn.body.state.identity.id])).rows[0].account_id;
  await app.pool.query("INSERT INTO crews (id,name,leader_account,recruiting) VALUES ('agent-crew','Turn Crew',$1,false)",
    [agentAccount]);
  await app.pool.query("INSERT INTO crew_members (crew_id,account_id,name) VALUES ('agent-crew',$1,'Turn Machine')",
    [agentAccount]);
  const crewTurn = (await call('GET', '/v1/agent/turn', { token })).body;
  const openRecruiting = crewTurn.actions.find((action) => action.kind === 'crew_recruiting');
  const organizationPlan = crewTurn.plans.find((plan) => plan.kind === 'organization');
  assert.deepEqual({ method: openRecruiting?.method, path: openRecruiting?.path, body: openRecruiting?.body }, {
    method: 'POST', path: '/v1/crew/recruiting', body: { on: true },
  }, 'a crew-leading agent safely advertises an open seat under its standing recruiting order');
  assert.equal(organizationPlan?.nextActionId, openRecruiting.id,
    'organization growth is represented in the same plan contract as economic loops');
  assert.equal(openRecruiting.ev.cash, 0,
    'organization maintenance is not disguised as monetary expected value');
  const acted = await call('POST', '/v1/agent/act', {
    token, idempotencyKey: 'agent-turn-crew-open',
    body: { turnId: crewTurn.turnId, actionId: openRecruiting.id },
  });
  assert.equal(acted.code, 200, 'the server executes an action authorized by the matching turn');
  assert.equal(acted.body.actionId, openRecruiting.id,
    'the execution receipt identifies the exact authorized action');
  assert.equal(acted.body.result.crew, 'recruiting',
    'agent execution reaches the same authoritative crew domain action as the direct route');
  assert.notEqual(acted.body.turn.turnId, crewTurn.turnId,
    'a successful mutation returns a fresh, invalidated post-action turn in the same response');
  assert.equal(acted.body.turn.actions.some((action) => action.id === openRecruiting.id), false,
    'the returned post-action turn cannot replay a completed organization step');
  const stale = await call('POST', '/v1/agent/act', {
    token, idempotencyKey: 'agent-turn-stale-replay',
    body: { turnId: crewTurn.turnId, actionId: openRecruiting.id },
  });
  assert.equal(stale.code, 409, 'an invalidated turn cannot authorize a second mutation');
  assert.equal(stale.body.error, 'stale_turn', 'stale turns fail with a stable machine error code');
  assert.equal(stale.body.turn.turnId, acted.body.turn.turnId,
    'a stale-turn error carries the replacement snapshot needed to recover immediately');
  const unknown = await call('POST', '/v1/agent/act', {
    token, idempotencyKey: 'agent-turn-unknown-action',
    body: { turnId: acted.body.turn.turnId, actionId: 'not-issued-by-this-turn' },
  });
  assert.equal(unknown.code, 400, 'a matching turn cannot authorize an action id it never issued');
  assert.equal(unknown.body.error, 'unknown_action', 'unknown action ids use a stable machine error code');
  await app.pool.query("DELETE FROM crew_members WHERE crew_id='agent-crew'");
  await app.pool.query("DELETE FROM crews WHERE id='agent-crew'");

  await app.pool.query(
    "INSERT INTO market_listings (id,seller_character,kind,good_id,qty,district,price,expires_at) VALUES ('agent-order',$1,'order','gin',4,'docks',500,now()+interval '1 day')",
    [other.id]);
  const withoutCargo = (await call('GET', '/v1/agent/turn', { token })).body;
  assert.equal(withoutCargo.actions.some((a) => a.kind === 'market_fill'), false,
    'an order is not executable when this agent owns none of the requested cargo');

  await app.pool.query("INSERT INTO character_cargo (character_id,good_id,qty) VALUES ($1,'gin',2)",
    [turn.body.state.identity.id]);
  const withCargo = (await call('GET', '/v1/agent/turn', { token })).body;
  const fill = withCargo.actions.find((a) => a.kind === 'market_fill');
  assert.deepEqual({ method: fill?.method, path: fill?.path, body: fill?.body, cost: fill?.cost, reward: fill?.reward }, {
    method: 'POST', path: '/v1/market/agent-order/fill', body: { qty: 2 },
    cost: { goods: { gin: 2 } }, reward: { cash: { gross: 1000, net: 980 } },
  }, 'a fillable local order becomes a structured action sized to the agent\'s actual cargo');

  await app.pool.query('DELETE FROM character_cargo WHERE character_id=$1', [turn.body.state.identity.id]);
  await app.pool.query('UPDATE characters SET nerve=0,last_accrued_at=now() WHERE id=$1', [turn.body.state.identity.id]);
  const exhausted = (await call('GET', '/v1/agent/turn', { token })).body;
  assert.equal(exhausted.actions.some((a) => a.kind === 'crime'), false,
    'a nerve-gated crime is not presented as executable');
  assert.ok(Array.isArray(exhausted.blockedActions), 'the turn separates blocked actions from executable actions');
  const blockedCrime = exhausted.blockedActions.find((a) => a.kind === 'crime');
  assert.equal(blockedCrime.blockedBy[0].code, 'nerve', 'the turn names the resource blocking the action');
  const waitMs = new Date(exhausted.nextWakeAt).getTime() - Date.now();
  assert(waitMs >= 15_000 && waitMs <= 22_000,
    `the turn schedules the earliest crime refill instead of inviting blind polling (${waitMs}ms)`);

  const openapi = (await call('GET', '/openapi.json')).body;
  const turnOperation = openapi.paths['/v1/agent/turn'].get;
  assert.equal(turnOperation.operationId, 'getAgentTurn', 'the turn has a stable OpenAPI operation id');
  assert.equal(turnOperation.responses[200].content['application/json'].schema.$ref,
    '#/components/schemas/AgentTurn', 'the turn response is typed rather than an undocumented object');
  assert.deepEqual(openapi.components.schemas.AgentAction.required,
    ['id', 'kind', 'method', 'path', 'body', 'executable', 'score', 'ev'],
    'the reusable action descriptor includes the v2 valuation contract');
  assert.deepEqual(openapi.components.schemas.AgentPlan.required,
    ['id', 'kind', 'label', 'score', 'ev', 'status', 'nextActionId', 'refreshAfterStep', 'route'],
    'multi-step plans have a strict reusable OpenAPI contract');
  assert.deepEqual(openapi.components.schemas.AgentTurn.required,
    ['turnId', 'observedAt', 'state', 'extraction', 'policy', 'ranking', 'recommendedActionId',
      'actions', 'blockedActions', 'plans', 'nextWakeAt', 'opportunities'],
    'the v2 response requires policy, ranking, recommendation, and plans');
  const actOperation = openapi.paths['/v1/agent/act'].post;
  assert.equal(actOperation.operationId, 'executeAgentTurnAction',
    'server-enforced turn execution has a stable OpenAPI operation id');
  assert.deepEqual(actOperation.requestBody.content['application/json'].schema.required,
    ['turnId', 'actionId'], 'turn execution requires both the snapshot authority and issued action id');
  assert.equal(actOperation.responses[409].description.includes('stale_turn'), true,
    'the OpenAPI contract publishes stale-turn recovery as a stable 409');
  assert.deepEqual(openapi.paths['/v1/crimes/{id}'].post.requestBody.content['application/json'].schema.properties.approach.enum,
    ['quiet', 'standard', 'loud'], 'the emitted crime action body is typed in OpenAPI');
  assert.equal(openapi.paths['/v1/market/{id}/fill'].post.requestBody.content['application/json'].schema.properties.qty.minimum,
    1, 'the emitted market-fill quantity is typed and bounded');
  assert.deepEqual(openapi.paths['/v1/goods/buy'].post.requestBody.content['application/json'].schema.required,
    ['goodId', 'qty'], 'the emitted arbitrage purchase body is strictly typed');
  assert.equal(openapi.paths['/v1/crew/recruiting'].post.requestBody.content['application/json'].schema.properties.on.type,
    'boolean', 'the emitted organization action body is typed');
} finally {
  await app.close();
}

console.log('✅ agent turn contract passed');
