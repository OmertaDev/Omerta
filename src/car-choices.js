import { carMelt, carVal, carOf, CONSTANTS } from './rules.js';

// One quote for both the owner's board and the mutations. Values are recomputed on action.
export function carChoiceQuote(car, { yieldMult = 1, yieldMultipliers = [yieldMult], fenceMult = 1, inFamily = false } = {}) {
  const damage = Number(car.dmg || 0);
  const value = carVal(car.model_id, car.trim_id);
  const multiply = base => yieldMultipliers.reduce((value, mult) => value * mult, base);
  const total = Math.floor(multiply(carMelt(car.model_id, car.trim_id, damage)));
  const family = inFamily ? Math.floor(total * CONSTANTS.MELT_TITHE) : 0;
  const gross = Math.floor(multiply(value * 0.5 * (1 - damage / 100) * fenceMult));
  const fee = Math.ceil(gross * 0.01), tax = Math.ceil(gross * 0.01);
  return {
    melt: { total, personal: total - family, family, treasury: family * CONSTANTS.TITHE_ROUND_VALUE },
    fence: { gross, fee, tax, net: gross - fee - tax },
    repair: damage > 0 ? {
      cost: Math.max(50, Math.floor(damage / 100 * value * 0.2)),
      chance: Math.max(0.05, ((carOf(car.model_id)?.rare ? 50 : 100) - damage) / 100),
    } : null,
  };
}
