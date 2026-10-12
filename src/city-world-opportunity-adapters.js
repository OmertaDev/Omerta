// Pure closed authoring semantics shared by graph validation and the native runtime.
import { M3 } from './rules.js';

export const CITY_WORLD_MAX_HEAT_RAISE = M3.CRIME_APPROACHES.loud.heat;
const invalid = (code, message) => { const error = new TypeError(message); error.code = code; throw error; };
const closed = (value, fields, code) => {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype
    || Reflect.ownKeys(value).length !== fields.length
    || fields.some(key => { const descriptor = Object.getOwnPropertyDescriptor(value, key); return !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value'); })) {
    invalid(code, 'Neighborhood adapters require an exact plain data record.');
  }
};
export function normalizeCityOpportunityCondition(value) {
  const code = 'bad_mystery_condition';
  const descriptor = value && Object.getOwnPropertyDescriptor(value, 'adapter');
  if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) invalid(code, 'Neighborhood adapters require plain data fields.');
  const adapter = descriptor.value;
  if (adapter === 'heat') {
    closed(value, ['adapter', 'maximum'], code);
    if (!Number.isInteger(value.maximum) || value.maximum < 0 || value.maximum > 100) invalid(code, 'Heat maximum must be an integer from 0 to 100.');
    return Object.freeze({ adapter: 'heat', maximum: value.maximum });
  }
  if (adapter === 'recurring_window') {
    closed(value, ['adapter', 'periodMs', 'openMs', 'offsetMs'], code);
    if (!Number.isSafeInteger(value.periodMs) || value.periodMs < 60000 || value.periodMs > 7 * 86400000
      || !Number.isSafeInteger(value.openMs) || value.openMs < 1 || value.openMs > value.periodMs
      || !Number.isSafeInteger(value.offsetMs) || value.offsetMs < 0 || value.offsetMs >= value.periodMs) invalid(code, 'Recurring windows require bounded immutable integer periods.');
    return Object.freeze({ adapter: 'recurring_window', periodMs: value.periodMs, openMs: value.openMs, offsetMs: value.offsetMs });
  }
  if (adapter === 'npc_present') {
    closed(value, ['adapter'], code);
    return Object.freeze({ adapter: 'npc_present' });
  }
  if (adapter === 'npc_favor') {
    closed(value, ['adapter', 'minimum'], code);
    if (!Number.isInteger(value.minimum) || value.minimum < 0 || value.minimum > 3) invalid(code, 'Favor minimum must be an integer from 0 to 3.');
    return Object.freeze({ adapter: 'npc_favor', minimum: value.minimum });
  }
  invalid(code, 'Unsupported neighborhood condition.');
}
export function normalizeCityOpportunityEffect(value) {
  const code = 'bad_mystery_effect';
  closed(value, ['adapter', 'amount'], code);
  const maximum = value.adapter === 'heat_raise' ? CITY_WORLD_MAX_HEAT_RAISE : value.adapter === 'npc_favor_award' ? 1 : 0;
  if (!Number.isInteger(value.amount) || value.amount < 1 || value.amount > maximum) invalid(code, 'Neighborhood effects exceed their positive bounded amount.');
  return Object.freeze({ adapter: value.adapter, amount: value.amount });
}
export function cityRecurringWindow(nowMs, input) {
  const window = normalizeCityOpportunityCondition(input);
  if (window.adapter !== 'recurring_window' || !Number.isFinite(nowMs)) invalid('bad_mystery_context', 'A valid server clock is required.');
  const startsAtMs = Math.floor((nowMs - window.offsetMs) / window.periodMs) * window.periodMs + window.offsetMs;
  const endsAtMs = startsAtMs + window.openMs;
  const open = nowMs >= startsAtMs && nowMs < endsAtMs;
  return Object.freeze({ open, startsAtMs, endsAtMs, nextStartsAtMs: open ? startsAtMs : startsAtMs + window.periodMs });
}
export function cityRaisedHeat(current, input) {
  const effect = normalizeCityOpportunityEffect(input), before = Number(current);
  if (effect.adapter !== 'heat_raise' || !Number.isFinite(before) || before < 0) invalid('bad_mystery_state', 'Canonical heat is invalid.');
  return Object.freeze({ before, after: Math.max(before, Math.min(100, before + effect.amount)) });
}
