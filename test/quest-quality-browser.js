import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';
import { compileContentPack } from '../src/content/compiler.js';
import { activateContentBundle } from '../src/content/runtime.js';
import { QUEST_QUALITY_PACKS } from '../src/content/quest-quality-packs.js';
import { qualityActorKey } from '../src/content/quality-runtime.js';

assert(!process.env.DATABASE_URL, 'Quality browser checks require disposable pg-mem.');
process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off';
const executablePath = process.env.CHROMIUM_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(candidate => fs.existsSync(candidate));
assert(executablePath, 'Set CHROMIUM_PATH to an installed Chromium.');
const packs = new Map(QUEST_QUALITY_PACKS.map(pack => [pack.runtime.experienceId, pack]));
const pilot = packs.get('three-witnesses'), fieldNotes = packs.get('quality-field-notes'), smallFire = packs.get('quality-small-fire');
const app = await buildServer(), errors = [], writes = [], artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-quality-'));
let browser, debugPage;
const api = async (method, url, person, payload) => {
  const response = await app.inject({ method, url, payload, headers: {
    ...(person ? { authorization: 'Bearer ' + person.token } : {}), ...(method !== 'GET' ? { 'idempotency-key': randomUUID() } : {}),
  } });
  return { code: response.statusCode, body: response.json() };
};
const read = async (person, id) => { const reply = await api('GET', '/v1/content/instances/' + id, person); assert.equal(reply.code, 200, JSON.stringify(reply.body)); return reply.body.instance; };
const act = async (person, instance, action, payload = {}) => {
  const reply = await api('POST', '/v1/content/instances/' + instance.id + '/act', person, { expectedRevision: instance.revision, actionId: action.id, ...payload });
  assert.equal(reply.code, 200, JSON.stringify(reply.body)); return reply.body.instance;
};
async function solve(person, id, pack, nodeId, choiceId) {
  const instance = await read(person, id), action = instance.actions.find(item => item.nodeId === nodeId);
  assert(action, 'Setup action is genuinely issued: ' + nodeId);
  if (action.kind === 'choose') return act(person, instance, action, { choiceId: choiceId || action.options.find(option => option.available).id });
  const source = pack.nodes.find(node => node.id === nodeId), spec = pack.nodes.find(node => node.id === source.payload.answerSpecId).payload;
  const payload = spec.verifier === 'normalized_exact' ? { answer: spec.acceptedValues[0] }
    : { submission: spec.verifier === 'mapping' ? { assignments: spec.solution } : { ids: spec.solution } };
  return act(person, instance, action, payload);
}
async function create(name) {
  const auth = await api('POST', '/v1/auth/guest'); assert.equal(auth.code, 200);
  const person = { token: auth.body.token };
  const created = await api('POST', '/v1/character', person, { name }); assert.equal(created.code, 200, JSON.stringify(created.body));
  person.ch = (await app.pool.query('SELECT * FROM characters WHERE name=$1', [name])).rows[0]; return person;
}
async function start(person, pack, scopeKind = 'personal', roleId = 'investigator', partner) {
  const created = await api('POST', '/v1/content/' + pack.namespace + '/instances', person, { scopeKind, roleId });
  assert.equal(created.code, 200, JSON.stringify(created.body)); let instance = created.body.instance;
  if (partner) {
    const joined = await api('POST', '/v1/content/instances/' + instance.id + '/join', partner.person, { expectedRevision: instance.revision, roleId: partner.roleId });
    assert.equal(joined.code, 200, JSON.stringify(joined.body)); instance = await read(person, instance.id);
  }
  return act(person, instance, instance.actions.find(action => action.kind === 'start_instance'));
}
const openDetails = async locator => { if (!await locator.evaluate(node => node.open)) await locator.locator(':scope > summary').click(); };
const qualitySection = (page, name) => page.locator('#ux-quests [data-quality-section="' + name + '"]');
async function openQualitySection(page, name) { const section = qualitySection(page, name); await openDetails(section); return section; }
async function showCase(page, id) {
  await page.locator('#ux-quests').getByLabel('Case file', { exact: true }).selectOption('run:' + id);
  await page.locator('[data-quest-quality="' + id + '"]').waitFor();
}
async function refresh(page) { await page.locator('#ux-quests').getByRole('button', { name: 'Refresh quest files', exact: true }).click(); await page.locator('#ux-quests[aria-busy="false"]').waitFor(); }
async function shell(person) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addInitScript(token => { localStorage.setItem('omerta_token', token); for (const key of ['omerta_tour2', 'omerta_welcomed', 'omerta_alltabs']) localStorage.setItem(key, '1'); }, person.token);
  const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.method() === 'POST' && /\/v1\/content\/instances\/[^/]+\/(?:act|quality)$/.test(new URL(request.url()).pathname)) writes.push({ path: new URL(request.url()).pathname, body: request.postDataJSON() }); });
  await page.goto('http://127.0.0.1:' + app.server.address().port, { waitUntil: 'domcontentloaded' });
  await page.locator('#screen-main:not(.hidden)').waitFor();
  await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach(node => node.classList.add('hidden')));
  await page.locator('#btn-jump').click(); await page.locator('#jump-q').fill('desk'); await page.locator('#jump-list [data-jump="desk"]').first().click();
  await page.locator('#tab-desk.on #ux-quests').waitFor(); return page;
}
async function qualityWrite(page, operation, run) {
  const response = page.waitForResponse(reply => reply.request().method() === 'POST' && reply.url().endsWith('/quality') && reply.request().postDataJSON()?.operation === operation);
  await run(); const reply = await response; const body = await reply.json(); assert.equal(reply.status(), 200, JSON.stringify(body));
  await page.locator('#ux-quests[aria-busy="false"]').waitFor(); return body.instance;
}
async function decision(page, nodeId, label) {
  const action = page.locator('[data-quest-node="' + nodeId + '"]');
  await action.getByRole('button', { name: label, exact: true }).click();
  const response = page.waitForResponse(reply => reply.request().method() === 'POST' && reply.url().endsWith('/act'));
  await action.getByRole('button', { name: 'Confirm decision', exact: true }).click();
  const reply = await response; assert.equal(reply.status(), 200, JSON.stringify(await reply.json()));
  await page.locator('#ux-quests[aria-busy="false"]').waitFor();
}
try {
  const alice = await create('Quality Browser Reader'), bob = await create('Quality Browser Partner');
  for (const pack of [pilot, fieldNotes, smallFire]) {
    const bundle = compileContentPack(pack); await activateContentBundle(app.pool, { bundle, expectedHash: bundle.contentHash, operatorId: 'quality-browser' });
  }
  let instance = await start(alice, pilot), pilotId = instance.id;
  for (const [nodeId, choice] of [['clock-procedure', 'learn'], ['clock-check'], ['photo'], ['registry']]) instance = await solve(alice, pilotId, pilot, nodeId, choice);
  await app.listen({ host: '127.0.0.1', port: 0 });
  for (const asset of ['/ux-quests.js', '/ux-quest-quality.js', '/ux-quest-quality.css']) {
    const served = await app.inject({ method: 'GET', url: asset }); assert.equal(served.statusCode, 200, 'Production asset serves ' + asset);
    assert.equal(served.body, fs.readFileSync(new URL('../public' + asset, import.meta.url), 'utf8'), 'Browser uses actual production source');
  }
  browser = await chromium.launch({ executablePath, headless: true }); const page = await shell(alice); debugPage = page;
  await showCase(page, pilotId);
  await page.locator('[data-desk-case="instance:' + pilotId + '"]').click();
  assert.equal(await page.locator('[data-desk-choice]').count(), 0, 'The standard Desk does not bypass the quality commitment preview.');
  await page.locator('[data-desk-quality-case="' + pilotId + '"]').click();
  assert.equal(await page.locator('#ux-quests').getByLabel('Case file', { exact: true }).inputValue(), 'run:' + pilotId);
  assert.equal(await page.evaluate(() => typeof createOmertaQuestQuality), 'function');
  assert.notEqual(await page.locator('.quest-quality').evaluate(node => getComputedStyle(node).borderTopStyle), 'none');
  assert.equal(await page.locator('#ux-quests [data-quest-node="finding"] .quest-quality-proof input[type=checkbox]').count(), 2, 'Only two actually revealed proof items reach the live form.');
  const framing = await openQualitySection(page, 'framing');
  const design = pilot.nodes.find(node => node.id === pilot.runtime.entryNodeId).payload.quality;
  assert.ok((await framing.innerText()).includes(design.assumptions[0].text), 'Known assumptions remain separate from established evidence.');
  assert.equal(await framing.locator('[data-quality-clause="rule-2"] p').textContent(), design.clauses.find(clause => clause.id === 'rule-2').text, 'The exact authored negation survives presentation.');
  assert.equal(await framing.locator('[data-quality-clause="rule-1"]').count(), 0, 'Unrevealed source clauses have no hidden markup.');
  const reentry = await openQualitySection(page, 'reentry');
  await reentry.getByLabel('Search your revealed questions').fill('inventory');
  assert.ok(await reentry.locator('[data-quality-question]').count());
  await reentry.getByLabel('Search your revealed questions').fill('archive lending slip');
  assert.equal(await reentry.locator('[data-quality-question]').count(), 0, 'Search cannot expose an unrevealed branch question.');
  await reentry.getByLabel('Search your revealed questions').fill('');

  const workbench = qualitySection(page, 'workbench'), note = 'Private interpretation <img id="quality-xss">: distinguish a coat from its wearer.';
  await workbench.getByLabel('Your private case theory').fill(note);
  await workbench.getByLabel('Your working conclusion').selectOption('luca');
  for (const id of ['door-image', 'ledger-register']) await workbench.locator('[data-quality-evidence="' + id + '"] input').check();
  const publicRevision = instance.revision, ownRevision = instance.quality.revision;
  instance = await qualityWrite(page, 'save_draft', () => workbench.getByRole('button', { name: 'Save private case draft', exact: true }).click());
  assert.match(await page.locator('#toast').innerText(), /case file updated:/, 'A private save is not described as advancing the fictional case.');
  assert.equal(instance.revision, publicRevision, 'A private draft does not invalidate another participant’s public action token.');
  assert.equal(instance.quality.revision, ownRevision + 1); assert.equal(await page.locator('#quality-xss').count(), 0);
  const stale = await api('POST', '/v1/content/instances/' + pilotId + '/quality', alice, { expectedRevision: instance.revision, expectedQualityRevision: ownRevision, operation: 'save_draft', text: 'stale tab', evidenceIds: [] });
  assert.ok(stale.code >= 400, 'A stale private tab cannot overwrite the newer draft.');
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor();
  await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach(node => node.classList.add('hidden')));
  await page.locator('#btn-jump').click(); await page.locator('#jump-q').fill('desk'); await page.locator('#jump-list [data-jump="desk"]').first().click(); await showCase(page, pilotId);
  assert.equal(await qualitySection(page, 'workbench').getByLabel('Your private case theory').inputValue(), note, 'An actual reload restores the server-owned private draft.');
  const beforeUndo = writes.filter(write => write.path.endsWith('/quality')).length;
  await qualitySection(page, 'workbench').getByLabel('Your private case theory').fill('Unsaved revision');
  await qualitySection(page, 'workbench').getByRole('button', { name: 'Undo unsaved draft changes', exact: true }).click();
  assert.equal(await qualitySection(page, 'workbench').getByLabel('Your private case theory').inputValue(), note);
  assert.equal(writes.filter(write => write.path.endsWith('/quality')).length, beforeUndo);

  const motives = await openQualitySection(page, 'motives'), beforeMotive = await read(alice, pilotId);
  await motives.getByLabel('Why are you taking this case?').selectOption('duty'); await motives.getByRole('button', { name: 'Review my motive', exact: true }).click();
  await motives.getByRole('button', { name: 'Keep editing · undo this intent', exact: true }).click();
  assert.equal((await read(alice, pilotId)).quality.motiveId, null);
  await motives.getByRole('button', { name: 'Review my motive', exact: true }).click();
  instance = await qualityWrite(page, 'set_motive', () => motives.getByRole('button', { name: 'Confirm my motive', exact: true }).click());
  assert.equal(instance.quality.motiveId, 'duty'); assert.equal(instance.revision, beforeMotive.revision);
  assert.deepEqual(instance.quality.evidence, beforeMotive.quality.evidence, 'A private motive cannot manufacture NPC knowledge or evidence.');
  const study = await openQualitySection(page, 'study');
  await study.getByLabel('I consent to the optional comprehension and delayed recall study').check();
  await study.getByLabel('Study participant type').selectOption('ai'); await study.getByLabel('Prior familiarity with this case').selectOption('familiar');
  await qualityWrite(page, 'study_consent', () => study.getByRole('button', { name: 'Enroll in optional study', exact: true }).click());
  assert.equal(await study.getByLabel('What are you investigating?').count(), 0, 'Blind comprehension waits for case completion.');

  let proof = page.locator('[data-quest-node="finding"] .quest-quality-proof');
  await proof.getByLabel('Conclusion to test').selectOption('orsini');
  const beforeIntent = writes.filter(write => write.path.endsWith('/act')).length;
  await proof.getByRole('button', { name: 'Review deduction intent', exact: true }).click();
  await proof.getByRole('button', { name: 'Keep editing · undo this intent', exact: true }).click();
  assert.equal(writes.filter(write => write.path.endsWith('/act')).length, beforeIntent);
  await proof.getByRole('button', { name: 'Review deduction intent', exact: true }).click();
  const wrongResponse = page.waitForResponse(reply => reply.request().method() === 'POST' && reply.url().endsWith('/act'));
  await proof.getByRole('button', { name: 'Confirm deduction', exact: true }).click(); await wrongResponse;
  await page.locator('#ux-quests[aria-busy="false"]').waitFor();
  assert.ok((await read(alice, pilotId)).actions.some(action => action.nodeId === 'finding'), 'A wrong conclusion with real evidence does not complete the deduction.');
  proof = page.locator('[data-quest-node="finding"] .quest-quality-proof'); await proof.getByLabel('Conclusion to test').selectOption('luca');
  await proof.getByRole('button', { name: 'Review deduction intent', exact: true }).click();
  await page.screenshot({ path: path.join(artifacts, 'quality-proof-preview.png'), fullPage: false });
  const correctResponse = page.waitForResponse(reply => reply.request().method() === 'POST' && reply.url().endsWith('/act'));
  await proof.getByRole('button', { name: 'Confirm deduction', exact: true }).click(); assert.equal((await correctResponse).status(), 200);
  await page.locator('[data-quest-node="commission"]').waitFor();
  const proofWrite = writes.filter(write => write.body.submission?.conclusionId === 'luca').at(-1);
  assert.deepEqual(proofWrite.body.submission, { conclusionId: 'luca', evidenceIds: ['photo-proof', 'register-proof'] });
  await decision(page, 'commission', 'Challenge the accusation and verify Luca’s authority');
  await solve(alice, pilotId, pilot, 'authority'); await refresh(page);
  await decision(page, 'closing', pilot.nodes.find(node => node.id === 'closing').payload.options[0].label);
  instance = await read(alice, pilotId); assert.equal(instance.status, 'completed'); assert.equal(instance.quality.debrief.opened, false); assert.equal(instance.quality.debrief.text, undefined);
  const completedStudy = await openQualitySection(page, 'study');
  for (const [label, value] of [['What are you investigating?', 'AI fixture: who carried the identified ledger.'], ['Why does it matter?', 'AI fixture: distinguish proof from an accusation.'], ['What would you do next?', 'AI fixture: retain only supported facts.']]) await completedStudy.getByLabel(label).fill(value);
  instance = await qualityWrite(page, 'study_comprehension', () => completedStudy.getByRole('button', { name: 'Submit my understanding', exact: true }).click());
  assert.equal(instance.quality.study.evidenceType, 'ai'); assert.equal(instance.quality.study.recallEligible, false);
  assert.ok(Date.parse(instance.quality.study.eligibleAt) >= Date.now() + 23.9 * 60 * 60 * 1000);
  assert.equal(await completedStudy.getByLabel('What do you remember about the case?').count(), 0, 'A future recall form has no hidden markup.');
  const earlyRecall = await api('POST', '/v1/content/instances/' + pilotId + '/quality', alice, { expectedRevision: instance.revision, expectedQualityRevision: instance.quality.revision, operation: 'study_recall', memory: 'too early', enjoyment: 3, understanding: 3 });
  assert.ok(earlyRecall.code >= 400, 'The authoritative endpoint also refuses premature recall.');
  // Advance only this AI fixture's persisted study clock. This is not evidence of an elapsed human study.
  const stored = (await app.pool.query('SELECT value_json FROM content_instance_facts WHERE instance_id=$1 AND fact_key=$2', [pilotId, qualityActorKey(alice.ch.account_id)])).rows[0].value_json;
  const actor = typeof stored === 'string' ? JSON.parse(stored) : stored;
  actor.study.consentedAt = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
  actor.study.comprehension.submittedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  actor.study.eligibleAt = new Date(Date.parse(actor.study.comprehension.submittedAt) + 24 * 60 * 60 * 1000).toISOString();
  await app.pool.query('UPDATE content_instance_facts SET value_json=$3 WHERE instance_id=$1 AND fact_key=$2', [pilotId, qualityActorKey(alice.ch.account_id), JSON.stringify(actor)]);
  await refresh(page); const recall = await openQualitySection(page, 'study');
  await recall.getByLabel('What do you remember about the case?').fill('Automated fixture input, not a human observation.');
  await recall.getByLabel('Enjoyment · 1 low to 5 high').selectOption('4'); await recall.getByLabel('Understanding · 1 low to 5 high').selectOption('3');
  instance = await qualityWrite(page, 'study_recall', () => recall.getByRole('button', { name: 'Submit delayed recall', exact: true }).click());
  assert.equal(instance.quality.study.recallSubmitted, true); assert.equal(instance.quality.study.evidenceType, 'ai');
  const debrief = await openQualitySection(page, 'debrief');
  instance = await qualityWrite(page, 'open_debrief', () => debrief.getByRole('button', { name: 'Reveal my debrief', exact: true }).click());
  assert.equal(instance.quality.debrief.opened, true); assert.ok(instance.quality.debrief.text);

  const fieldInstance = await start(alice, fieldNotes); await refresh(page); await showCase(page, fieldInstance.id);
  let fieldwork = await openQualitySection(page, 'fieldwork');
  await fieldwork.getByLabel('Ina: check permit P-4 · question', { exact: true }).selectOption('registered'); await fieldwork.getByLabel('Ina: check permit P-4 · method', { exact: true }).selectOption('observe');
  await fieldwork.getByRole('button', { name: 'Review fieldwork · Ina: check permit P-4', exact: true }).click();
  await fieldwork.getByRole('button', { name: 'Keep editing · undo this intent', exact: true }).click();
  assert.equal((await read(alice, fieldInstance.id)).quality.fieldworkReports.length, 0);
  await fieldwork.getByRole('button', { name: 'Review fieldwork · Ina: check permit P-4', exact: true }).click();
  instance = await qualityWrite(page, 'fieldwork', () => fieldwork.getByRole('button', { name: 'Confirm fieldwork', exact: true }).click());
  assert.match(instance.quality.fieldworkReports[0].report, /cannot establish/);
  fieldwork = await openQualitySection(page, 'fieldwork'); await fieldwork.getByLabel('Ina: check permit P-4 · method', { exact: true }).selectOption('registry');
  await fieldwork.getByRole('button', { name: 'Review fieldwork · Ina: check permit P-4', exact: true }).click();
  instance = await qualityWrite(page, 'fieldwork', () => fieldwork.getByRole('button', { name: 'Confirm fieldwork', exact: true }).click());
  assert.ok(instance.quality.evidence.some(record => record.id === 'registry-report'));
  const disclosure = await openQualitySection(page, 'disclosure');
  await disclosure.getByLabel('Evidence to disclose', { exact: true }).selectOption('registry-report');
  await disclosure.getByLabel('Who should receive it?', { exact: true }).selectOption('clerk');
  await disclosure.getByRole('button', { name: 'Review disclosure intent', exact: true }).click();
  assert.match(await disclosure.locator('.quest-quality-preview').innerText(), /registry clerk/i);
  instance = await qualityWrite(page, 'disclose', () => disclosure.getByRole('button', { name: 'Confirm disclosure', exact: true }).click());
  assert.ok(instance.quality.evidence.some(record => record.id === 'clerk-reaction')); assert.equal(instance.quality.disclosureReports.at(-1).npcId, 'clerk');

  const crewId = randomUUID(); await app.pool.query('INSERT INTO crews (id,name,leader_account) VALUES ($1,$2,$3)', [crewId, 'Quality Browser Crew', alice.ch.account_id]);
  for (const person of [alice, bob]) await app.pool.query('INSERT INTO crew_members (crew_id,account_id,name) VALUES ($1,$2,$3)', [crewId, person.ch.account_id, person.ch.name]);
  const joint = await start(alice, smallFire, 'crew', 'records', { person: bob, roleId: 'residents' });
  await refresh(page); await showCase(page, joint.id); const bobPage = await shell(bob); await showCase(bobPage, joint.id);
  const volunteerAction = (await read(bob, joint.id)).actions.find(action => action.nodeId === 'register');
  assert.equal(volunteerAction.spotlight.roleId, 'records');
  const volunteer = bobPage.locator('[data-quest-node="register"]');
  assert.ok((await volunteer.innerText()).includes(volunteerAction.spotlight.title + ' has the spotlight; any participant can volunteer.'));
  await volunteer.getByLabel('Scheduled stove inspection', { exact: true }).check();
  const volunteered = bobPage.waitForResponse(reply => reply.request().method() === 'POST' && reply.url().endsWith('/act'));
  await volunteer.getByRole('button', { name: 'Test this deduction', exact: true }).click(); assert.equal((await volunteered).status(), 200);
  assert.ok((await read(bob, joint.id)).nodes.some(node => node.id === 'register' && node.state === 'completed'), 'A participant in the other role can actually volunteer through the original public control.');
  await solve(bob, joint.id, smallFire, 'whistle');
  await solve(alice, joint.id, smallFire, 'stove'); await solve(alice, joint.id, smallFire, 'join');
  await refresh(page); await refresh(bobPage);
  const ownDraft = qualitySection(page, 'workbench'); await ownDraft.getByLabel('Your private case theory', { exact: true }).fill('Only this actor owns the shared-case draft.');
  await qualityWrite(page, 'save_draft', () => ownDraft.getByRole('button', { name: 'Save private case draft', exact: true }).click());
  await refresh(bobPage);
  assert.equal(await qualitySection(bobPage, 'workbench').getByLabel('Your private case theory', { exact: true }).inputValue(), '', 'The other participant never receives a private workbench draft.');
  assert.ok(!JSON.stringify((await read(bob, joint.id)).quality).includes('Only this actor owns'));
  let impression = await openQualitySection(page, 'impression');
  await impression.getByLabel('Your first impression', { exact: true }).fill('Private independent thought from the records role.');
  await impression.getByLabel('I am unsure of this interpretation', { exact: true }).check();
  await qualityWrite(page, 'first_impression', () => impression.getByRole('button', { name: 'Record first impression', exact: true }).click());
  await refresh(bobPage); await openQualitySection(bobPage, 'impression');
  assert.ok(!(await qualitySection(bobPage, 'impression').innerText()).includes('Private independent thought'));
  impression = await openQualitySection(page, 'impression'); await impression.getByLabel('Share this impression with case participants', { exact: true }).check();
  await qualityWrite(page, 'first_impression', () => impression.getByRole('button', { name: 'Record first impression', exact: true }).click());
  await refresh(bobPage); assert.match(await qualitySection(bobPage, 'impression').innerText(), /Private independent thought/);
  assert.match(await qualitySection(bobPage, 'impression').innerText(), /unsure/);
  let group = await openQualitySection(page, 'cooperation'); instance = await read(alice, joint.id);
  const own = instance.quality.participants.find(member => member.isMe).id;
  assert.ok(!JSON.stringify(instance.quality).includes(bob.ch.account_id), 'Opaque participant handles do not expose account IDs.');
  await group.getByLabel('Decision to delegate', { exact: true }).selectOption('brief'); await group.getByLabel('Proposed decision maker', { exact: true }).selectOption(own);
  await group.getByRole('button', { name: 'Review decision mandate', exact: true }).click();
  await qualityWrite(page, 'propose_mandate', () => group.getByRole('button', { name: 'Confirm decision mandate', exact: true }).click());
  group = await openQualitySection(page, 'cooperation');
  await qualityWrite(page, 'clear_mandate', () => group.getByRole('button', { name: 'Withdraw mandate · keep the decision open', exact: true }).click());
  assert.equal((await read(alice, joint.id)).status, 'active'); assert.equal((await read(alice, joint.id)).quality.delegations.length, 0);
  group = await openQualitySection(page, 'cooperation'); await group.getByRole('button', { name: 'Review decision mandate', exact: true }).click();
  await qualityWrite(page, 'propose_mandate', () => group.getByRole('button', { name: 'Confirm decision mandate', exact: true }).click());
  group = await openQualitySection(page, 'cooperation');
  if (await group.getByRole('button', { name: 'Acknowledge this mandate', exact: true }).count()) await qualityWrite(page, 'acknowledge_mandate', () => group.getByRole('button', { name: 'Acknowledge this mandate', exact: true }).click());
  const pendingDecision = page.locator('[data-quest-node="brief"]');
  await pendingDecision.getByRole('button', { name: 'Challenge the arson brief and repair the documented danger', exact: true }).click();
  assert.equal(await pendingDecision.getByRole('button', { name: 'Confirm decision', exact: true }).isDisabled(), true, 'A missing participant acknowledgement blocks commitment in the actual UI.');
  await pendingDecision.getByRole('button', { name: 'Keep editing · undo this intent', exact: true }).click();
  await refresh(bobPage); const partnerGroup = await openQualitySection(bobPage, 'cooperation');
  assert.equal(await partnerGroup.locator('[data-quality-mandate="brief"]').count(), 1, 'The other role receives the shared mandate without receiving the private action.');
  await qualityWrite(bobPage, 'acknowledge_mandate', () => partnerGroup.getByRole('button', { name: 'Acknowledge this mandate', exact: true }).click());
  await refresh(page); await decision(page, 'brief', 'Challenge the arson brief and repair the documented danger');
  assert.ok((await read(alice, joint.id)).nodes.some(node => node.id === 'brief' && node.state === 'completed'));
  await page.setViewportSize({ width: 390, height: 844 });
  const dimensions = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); assert.ok(dimensions[0] <= dimensions[1] + 2, 'The production quality workbench fits390px.');
  await page.locator('.quest-quality-heading').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(artifacts, 'quality-mobile.png'), fullPage: false });
  assert.deepEqual(errors, [], 'Production shell has no page errors.');
  console.log('Quest quality production browser PASS: real pilot proof/conclusion/evidence, exact clauses, hidden-question boundary, private revision/reload/peer isolation, drafts/undo, motive, commitments, truthful AI study/24h refusal and eligible recall, opt-in debrief, actual fieldwork/disclosure, independent unsure/share, real cross-role volunteering, opaque mandate/pre-ack blocker/ack/withdraw/commit and390px. Artifacts: ' + artifacts);
} catch (error) {
  console.error('Last quality browser writes: ' + JSON.stringify(writes.slice(-3)));
  if (debugPage && !debugPage.isClosed()) { console.error((await debugPage.locator('#ux-quests').innerText().catch(() => '')).slice(-5000)); await debugPage.screenshot({ path: path.join(artifacts, 'quality-failure.png'), fullPage: false }).catch(() => {}); }
  throw error;
} finally { await browser?.close(); await app.close(); }
