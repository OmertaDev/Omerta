import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export async function runJourneyModelProof() {
  const context = vm.createContext({ window: {} });
  vm.runInContext(readFileSync(new URL('../../public/ux-progression.js', import.meta.url), 'utf8'), context);
  const { openingUpgrades, openingReceipt } = context.window.OmertaProgressionModel;
  const asset = { id: 'beater', name: 'Beater Sedan', stat: 'speed', boost: 2,
    cost: { price: 5000, fee: 50, tax: 50, total: 5100 }, affordable: true };
  const actor = 'one:1', startedAt = '2026-10-30T18:00:00Z';
  const plan = { actor, asset, startedAt, seen: [] };
  const before = { id: 'one', generation: 1, cash: 5100, assets: [], eff: { speed: 5 } };
  const earned = { ...before, cash: 5300 };
  const receipt = { actor, feedbackId: 'job-1', feedbackState: 'confirmed', state: 'success', method: 'POST',
    path: '/v1/crimes/pickpocket', label: 'A street job', atIso: '2026-10-30T18:01:00Z', resourceCurrent: true };
  const result = { code: 200, body: { ok: true, success: true, take: 200, decisionContext: { crimeId: 'pickpocket', projectedAt: receipt.atIso } } };
  assert.equal(openingUpgrades(before, { openingUpgrades: [asset] }).length, 1);
  assert.equal(openingUpgrades({ ...before, assets: ['beater'] }, { openingUpgrades: [asset] }).length, 0);
  for (const bad of [{ ...asset, id: 'x"] [onclick]' }, { ...asset, cost: { total: 2 } }, { ...asset, stat: 'cash' },
    { ...asset, boost: NaN }, { ...asset, name: '<b>'.repeat(100) }]) {
    assert.equal(openingUpgrades(before, { openingUpgrades: [bad] }).length, 0);
  }
  const first = openingReceipt(plan, receipt, before, earned, result);
  assert.equal(first.job.take, 200);
  assert.equal(first.purchase, undefined);
  assert.equal(plan.job, undefined, 'Observation does not mutate the prior journey');
  assert.equal(openingReceipt(first, receipt, before, earned, result), first, 'Duplicate receipts do not advance progress');
  for (const change of [{ feedbackState: 'unknown' }, { resourceCurrent: false }, { state: 'error' },
    { actor: 'other:1' }, { method: 'GET' }, { isCurrent: () => false }]) {
    assert.equal(openingReceipt(plan, { ...receipt, ...change }, before, earned, result), plan);
  }
  for (const bad of [{ code: 500, body: result.body }, { code: 200, body: { ok: true, success: false, take: 200 } },
    { code: 200, body: { ok: true, success: true, take: 0 } }]) {
    assert.equal(openingReceipt(plan, receipt, before, earned, bad).job, undefined);
  }
  assert.equal(openingReceipt(plan, receipt, before, before, result).job, undefined, 'No cash increase means no confirmed earned step');
  assert.equal(openingReceipt(plan, receipt, before, { ...earned, generation: 2 }, result), plan);
  assert.equal(openingReceipt(plan, { ...receipt, atIso: '2026-10-29T18:00:00Z' }, before, earned, result), plan, 'Old receipts cannot advance a reset journey');
  assert.equal(openingReceipt(plan, receipt, before, earned, { code: 200, body: { ...result.body,
    decisionContext: { crimeId: 'pickpocket', projectedAt: '2026-10-29T18:00:00Z' } } }).job, undefined, 'A replayed pre-start decision cannot earn a fresh step');
  assert.equal(openingReceipt(plan, { ...receipt, resourceCurrent: () => false }, before, earned, result), plan);
  assert.equal(openingReceipt({ actor, startedAt, asset: null }, receipt, before, earned, result).job, undefined);
  const purchaseReceipt = { ...receipt, feedbackId: 'purchase-1', path: '/v1/assets/beater/buy' };
  const purchased = { ...earned, cash: 200, assets: ['beater'], eff: { speed: 7 } };
  const purchaseResult = { code: 200, body: { ok: true, asset: 'beater', spent: 5100 } };
  const complete = openingReceipt(first, purchaseReceipt, earned, purchased, purchaseResult);
  assert.equal(complete.purchase.spent, 5100);
  assert.equal(complete.gain.before, 5); assert.equal(complete.gain.after, 7);
  assert.equal(openingReceipt(plan, purchaseReceipt, earned, purchased, purchaseResult).purchase, undefined,
    'A purchase alone cannot substitute for the earned-job step');
  assert.equal(openingReceipt(first, purchaseReceipt, earned, { ...purchased, eff: earned.eff }, purchaseResult).gain, undefined,
    'A receipt without an observed capability increase does not complete the journey');
  assert.equal(openingReceipt(first, { ...purchaseReceipt, path: '/v1/assets/wasp/buy' }, earned, purchased, purchaseResult).purchase, undefined);
  assert.equal(openingReceipt(first, purchaseReceipt, earned, { ...purchased, assets: [] }, purchaseResult).purchase, undefined);
  console.log('UX journey model: real earnings, exact purchase identity, observed effective gain, duplicate/stale/foreign/unknown refusals and safe catalog passed.');
}
