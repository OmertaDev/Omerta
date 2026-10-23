import assert from 'node:assert/strict';
import { heistMemberReadiness, recommendHeistRole } from '../src/heist-readiness.js';
import { carChoiceQuote } from '../src/car-choices.js';
import { carMelt, carVal, carOf, CONSTANTS } from '../src/rules.js';

const now = Date.parse('2026-10-22T12:00:00Z');
const person = { alive: true, jail_until: null, hosp_until: null, safe_until: null, heist_at: null };
assert.deepEqual(heistMemberReadiness(person, now), { ready: true, blockers: [] });
for (const [field, code] of [['jail_until','jailed'], ['hosp_until','hospitalized'], ['safe_until','safehouse'], ['heist_at','cooldown']]) {
  assert.deepEqual(heistMemberReadiness({ ...person, [field]: new Date(now + 60000) }, now),
    { ready: false, blockers: [code] }, `${field} prevents a ready claim`);
  assert.equal(heistMemberReadiness({ ...person, [field]: new Date(now) }, now).ready, true, 'expired status does not block');
}
assert.deepEqual(heistMemberReadiness({ ...person, alive: false }, now), { ready: false, blockers: ['dead'] });
assert.deepEqual(heistMemberReadiness({ ...person, jail_until: new Date(now+1), hosp_until: new Date(now+1) }, now).blockers, ['jailed','hospitalized']);
assert.equal(recommendHeistRole(['driver','muscle'], { driver: 'speed', muscle: 'muscle' }, { speed: 25, muscle: 40 }), 'muscle');
assert.equal(recommendHeistRole([], {}, {}), null);
assert.equal(recommendHeistRole(['driver','muscle'], { driver: 'speed', muscle: 'muscle' }, { speed: 40, muscle: 40 }), 'driver', 'ties preserve role order');

const car = { model_id: 'clio', trim_id: null, dmg: 25 };
// Use a real catalog model to verify quotes against canonical rules.
const { CARS } = await import('../src/rules.js');
car.model_id = CARS[0].id;
const q = carChoiceQuote(car, { yieldMult: 1.25, fenceMult: 1.1, inFamily: true });
const rounds = Math.floor(carMelt(car.model_id, null, 25) * 1.25);
assert.equal(q.melt.total, rounds);
assert.equal(q.melt.family, Math.floor(rounds * CONSTANTS.MELT_TITHE));
assert.equal(q.melt.personal + q.melt.family, q.melt.total, 'melt preview conserves ammunition');
assert.equal(q.melt.treasury, q.melt.family * CONSTANTS.TITHE_ROUND_VALUE);
const gross = Math.floor(carVal(car.model_id, null) * .5 * .75 * 1.1 * 1.25);
assert.equal(q.fence.net, gross - 2 * Math.ceil(gross * .01));
assert.equal(q.repair.cost, Math.max(50, Math.floor(.25 * carVal(car.model_id, null) * .2)));
assert.equal(q.repair.chance, Math.max(.05, ((carOf(car.model_id).rare ? 50 : 100) - 25)/100));
assert.equal(carChoiceQuote({ ...car, dmg: 0 }).repair, null, 'undamaged car needs no repair');
assert.equal(carChoiceQuote({ ...car, dmg: 100 }).fence.net, 0);
assert.equal(carChoiceQuote(car).melt.family, 0, 'solo player keeps all rounds');
// Preserve the old operation order: rounding a product of modifiers first can change a payout.
for (const model of CARS) for (const damage of [0,1,25,50,99,100]) {
  const mods=[1.08,1.15,1.025];
  const preview=carChoiceQuote({model_id:model.id,trim_id:null,dmg:damage},{yieldMultipliers:mods,fenceMult:1.1});
  const expectedRounds=Math.floor(carMelt(model.id,null,damage)*mods[0]*mods[1]*mods[2]);
  const expectedGross=Math.floor(carVal(model.id,null)*.5*(1-damage/100)*1.1*mods[0]*mods[1]*mods[2]);
  assert.equal(preview.melt.total,expectedRounds);
  assert.equal(preview.fence.gross,expectedGross);
}
console.log('player experience quote and readiness tests passed');
