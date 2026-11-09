import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';
import { compileContentPack } from '../src/content/compiler.js';
import { activateContentBundle } from '../src/content/runtime.js';
import { narrativeVariant } from '../src/content/narrative.js';

assert(!process.env.DATABASE_URL, 'Quest browser verification uses disposable pg-mem.');
process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off';
const executablePath = process.env.CHROMIUM_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(candidate => fs.existsSync(candidate));
assert(executablePath, 'Set CHROMIUM_PATH to an installed Chromium.');

// A small linear fixture exercises every production structured verifier through actual routes.
const source = JSON.parse(fs.readFileSync(new URL('../content/packs/docks-missed-tide/pack.json', import.meta.url), 'utf8'));
source.namespace = 'test.quest-browser';
source.nodes.find(node => node.id === 'missed-tide').payload.expectations = { durationMinutes: 20, difficulty: 'Intermediate', summary: 'A browser verification case.' };
source.nodes = source.nodes.filter(node => !['manifest-puzzle', 'manifest-answer'].includes(node.id));
source.edges = source.edges.filter(edge => edge.from !== 'manifest-puzzle' && edge.to !== 'manifest-puzzle');
const kinds = ['deduction', 'interrogation', 'timeline', 'scene', 'planning', 'stealth', 'inventory'];
const answers = new Map();
for (let index = 0; index < kinds.length; index++) {
  const kind = kinds[index], id = 'browser-' + kind, spec = id + '-answer';
  const verifier = kind === 'scene' ? 'mapping' : kind === 'timeline' ? 'ordered_ids' : 'unordered_ids';
  const interaction = { kind, items: [{ id: 'first', label: 'First document', description: 'The arrival at eight.' }, { id: 'second', label: 'Second document', description: 'The departure at nine.' }, { id: 'decoy', label: 'Unrelated document', description: 'An unrelated receipt.' }] };
  if (verifier === 'mapping') interaction.slots = [{ id: 'arrival', label: 'Arrival record' }, { id: 'departure', label: 'Departure record' }];
  const solution = verifier === 'mapping' ? { arrival: 'first', departure: 'second' } : ['first', 'second'];
  source.nodes.push({ id, type: 'puzzle', payload: { title: 'Browser ' + kind, prompt: 'Use the arrival and departure records.', gates: [{ kind: 'party_role', role: 'investigator' }], answerMode: 'server_owned_canonical', answerSpecId: spec, interaction, hints: ['The unrelated receipt does not establish a time.', 'Place arrival before departure.'] } }, { id: spec, type: 'answer_spec', payload: { verifier, solution } });
  source.edges.push({ from: index ? 'browser-' + kinds[index - 1] : 'missing-man', type: 'UNLOCKS', to: id });
  answers.set(kind, solution);
}
source.edges.push({ from: 'browser-inventory', type: 'UNLOCKS', to: 'tide-choice' });
source.runtime.nodeIds = source.nodes.map(node => node.id);
source.runtime.actionNodeIds = [...kinds.map(kind => 'browser-' + kind), 'tide-choice'];

const app = await buildServer(), errors = [], requests = [], browserPlayers = {}, artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-quests-'));
let browser, debugPage;
const api = async (method, url, token, payload) => {
  const reply = await app.inject({ method, url, payload, headers: { ...(token ? { authorization: 'Bearer ' + token } : {}), ...(method !== 'GET' ? { 'idempotency-key': randomUUID() } : {}) } });
  return { code: reply.statusCode, body: reply.json() };
};
const disclosure = async locator => { if (!await locator.evaluate(element => element.open)) await locator.locator(':scope > summary').click(); };
try {
  const create = async name => {
    const auth = await api('POST', '/v1/auth/guest'); assert.equal(auth.code, 200);
    const character = await api('POST', '/v1/character', auth.body.token, { name }); assert.equal(character.code, 200);
    const row = (await app.pool.query('SELECT * FROM characters WHERE name=$1', [name])).rows[0];
    await app.pool.query('UPDATE characters SET loc=$1 WHERE id=$2', ['docks', row.id]);
    return { token: auth.body.token, ch: row };
  };
  const alice = await create('Quest Browser Author'), bob = await create('Quest Browser Solver');
  Object.assign(browserPlayers, { alice, bob });
  const bundle = compileContentPack(source); await activateContentBundle(app.pool, { bundle, expectedHash: bundle.contentHash, operatorId: 'quest-browser' });
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' }); debugPage = page; page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<!doctype html><html><body style="margin:0"><main id="tab-desk"></main></body></html>');
  await page.addStyleTag({ content: fs.readFileSync(new URL('../public/ux-quests.css', import.meta.url), 'utf8') });
  let releaseWrongResponse, markWrongResponseReady;
  const wrongResponseReady = new Promise(resolve => { markWrongResponseReady = resolve; });
  const pendingWrongResponse = new Promise(resolve => { releaseWrongResponse = resolve; });
  await page.exposeFunction('questApi', async (method, url, player, payload) => {
    requests.push({ method, url, player, payload });
    const reply = await api(method, url, browserPlayers[player].token, payload);
    if (payload?.submission?.ids?.includes('decoy')) { markWrongResponseReady(); await pendingWrongResponse; }
    return reply;
  });
  await page.addScriptTag({ content: fs.readFileSync(new URL('../public/ux-quests.js', import.meta.url), 'utf8') });
  await page.evaluate(({ aliceId, bobId, aliceAccount, bobAccount }) => {
    window.questPlayers = { alice: { id: aliceId, accountId: aliceAccount, loc: 'docks' }, bob: { id: bobId, accountId: bobAccount, loc: 'docks' } };
    window.questPlayer = 'alice'; window.questNotes = {}; window.questMessages = [];
    window.questState = { me: questPlayers.alice, session: { accountId: aliceAccount }, currentTab: 'desk' };
    window.questUx = createOmertaQuests({ getState: () => questState, read: path => questApi('GET', path, questPlayer), action: (method, path, body) => questApi(method, path, questPlayer, body), notify: message => questMessages.push(message), navigate: tab => { questState.currentTab = tab; questUx.render(); },
      workspace: { get: key => questNotes[questState.me.accountId]?.[key] || {}, set: (key, value) => { (questNotes[questState.me.accountId] ||= {})[key] = value; } } });
    questUx.render();
  }, { aliceId: alice.ch.id, bobId: bob.ch.id, aliceAccount: alice.ch.account_id, bobAccount: bob.ch.account_id });
  await page.getByRole('button', { name: 'Open this case', exact: true }).waitFor();
  assert.match(await page.locator('#ux-quests').innerText(), /About 20 minutes/);
  await page.getByRole('button', { name: 'Open this case', exact: true }).click();
  await page.getByRole('button', { name: 'Start the case', exact: true }).click();
  const deduction = page.locator('[data-quest-action]').filter({ has: page.getByRole('heading', { name: 'Browser deduction', exact: true }) });
  await deduction.waitFor();
  await disclosure(deduction.locator('details'));
  await deduction.getByRole('button', { name: 'Ask for a small hint', exact: true }).click();
  await deduction.getByText('Hint 1: The unrelated receipt does not establish a time.', { exact: true }).waitFor();
  assert.equal(await deduction.getByText('Place arrival before departure.', { exact: true }).count(), 0, 'only the requested hint is revealed');
  await deduction.getByLabel('Unrelated document', { exact: false }).check();
  await deduction.getByRole('button', { name: 'Test this deduction', exact: true }).click();
  await wrongResponseReady;
  assert.equal(await deduction.getByLabel('First document', { exact: false }).isDisabled(), true, 'Pending deductions lock editable controls instead of leaving an interactive disabled-submit copy.');
  assert.equal(await deduction.getByLabel('Unrelated document', { exact: false }).isChecked(), true, 'The submitted evidence draft survives the pending repaint.');
  releaseWrongResponse();
  await page.waitForFunction(() => document.querySelector('#ux-quests')?.getAttribute('aria-busy') === 'false');
  assert.equal(await deduction.getByLabel('First document', { exact: false }).isDisabled(), false, 'The completed response and refetch restore editable evidence controls.');
  assert.equal(await deduction.getByRole('button', { name: 'Test this deduction', exact: true }).isDisabled(), false, 'A wrong answer can be corrected and resubmitted.');
  await deduction.waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Browser interrogation', exact: true }).count(), 0, 'incorrect structured answer never advances the client');
  for (const kind of kinds) {
    const panel = page.locator('[data-quest-action]').filter({ has: page.getByRole('heading', { name: 'Browser ' + kind, exact: true }) }); await panel.waitFor();
    if (kind === 'scene') { await panel.getByLabel('Arrival record', { exact: true }).selectOption('first'); await panel.getByLabel('Departure record', { exact: true }).selectOption('second'); }
    else {
      await panel.getByLabel('Unrelated document', { exact: false }).uncheck();
      await panel.getByLabel('First document', { exact: false }).check(); await panel.getByLabel('Second document', { exact: false }).check();
      if (kind === 'timeline') {
        await panel.getByRole('button', { name: 'Move Second document earlier', exact: true }).click();
        assert.match(await panel.locator('.quest-sequence li').first().innerText(), /^Second document/);
        await panel.getByRole('button', { name: 'Move Second document later', exact: true }).click();
      }
    }
    await panel.getByRole('button', { name: 'Test this deduction', exact: true }).click();
  }
  await page.getByRole('button', { name: 'The family hiding below the pier', exact: true }).click();
  await page.getByText('Case closed. Your decisions are on the record.', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('#ux-quests')?.getAttribute('aria-busy') === 'false');
  // A refetch may repaint before the browser delivers a details element's deferred toggle event.
  const disclosureRace = await page.evaluate(async () => {
    const findTheory = () => [...document.querySelectorAll('#ux-quests details')].find(panel => panel.querySelector(':scope > summary')?.textContent === 'Your working theory');
    const first = findTheory(), firstToggle = new Promise(resolve => first.addEventListener('toggle', resolve, { once: true }));
    first.querySelector(':scope > summary').click();
    questUx.render();
    const stayedOpen = findTheory().open;
    await firstToggle;
    const second = findTheory(), secondToggle = new Promise(resolve => second.addEventListener('toggle', resolve, { once: true }));
    second.querySelector(':scope > summary').click();
    questUx.render();
    const stayedClosed = !findTheory().open;
    await secondToggle;
    questUx.render();
    const remainsClosed = !findTheory().open;
    const cancelled = findTheory().querySelector(':scope > summary');
    cancelled.addEventListener('click', event => event.preventDefault(), { once: true });
    cancelled.click(); questUx.render();
    return { stayedOpen, stayedClosed, remainsClosed, cancelledClickRemainsClosed: !findTheory().open };
  });
  assert.deepEqual(disclosureRace, { stayedOpen: true, stayedClosed: true, remainsClosed: true, cancelledClickRemainsClosed: true }, 'Private-note disclosures retain native open and close choices across a refetch repaint and late detached toggle events.');
  const theories = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Your working theory' }) }); await disclosure(theories);
  const theorySummary = theories.locator(':scope > summary');
  await theorySummary.focus(); await theorySummary.press('Enter');
  assert.equal(await theories.evaluate(panel => panel.open), false, 'Native keyboard activation closes the disclosure.');
  await theorySummary.press('Space');
  assert.equal(await theories.evaluate(panel => panel.open), true, 'Native keyboard activation reopens the disclosure.');
  await page.getByLabel('Your private working theory', { exact: true }).fill('Only my account should see this <img id="quest-xss">');
  await page.getByRole('button', { name: 'Save private theory', exact: true }).click();
  assert.equal(await page.locator('#quest-xss').count(), 0, 'private theories are text, never HTML');
  await page.getByRole('button', { name: 'Claim my case record', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh quest files', exact: true }).click();
  assert.match(await page.locator('#ux-quests').innerText(), /Case closed/);
  const structuredWrites = requests.filter(request => request.payload?.submission);
  assert.equal(structuredWrites.length, kinds.length + 1, 'one wrong attempt and seven real structured submissions reached the authoritative API');
  assert.deepEqual(structuredWrites.find(request => request.payload.submission.assignments)?.payload.submission.assignments, answers.get('scene'));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(artifacts, 'quest-casefile-mobile.png'), fullPage: true });
  const widths = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); assert.ok(widths[0] <= widths[1] + 1, '390px case file does not overflow');
  await page.evaluate(() => { questPlayer = 'bob'; questState.me = questPlayers.bob; questState.session.accountId = questPlayers.bob.accountId; questUx.render(); });
  await page.getByRole('button', { name: 'Open this case', exact: true }).waitFor();
  assert.ok(!(await page.locator('#ux-quests').innerText()).includes('Only my account'), 'account changes clear private case presentation');

  await page.evaluate(() => { questPlayer = 'alice'; questState.me = questPlayers.alice; questState.session.accountId = questPlayers.alice.accountId; questUx.render(); });
  await page.getByRole('button', { name: 'Community mysteries', exact: true }).click();
  const builder = page.locator('details[data-quest-section="workshop:builder"]'); await builder.waitFor(); await disclosure(builder);
  await builder.getByLabel('Mystery title', { exact: true }).fill('A Parcel at the Docks');
  await builder.getByLabel('Story template', { exact: true }).selectOption('missing-ledger');
  await builder.getByLabel('Scene', { exact: true }).selectOption('docks');
  await builder.getByLabel('Culprit', { exact: true }).selectOption('courier');
  await builder.getByLabel('The Courier was at The Docks.', { exact: true }).check();
  await builder.getByLabel('The Tailor was at Canal Street.', { exact: true }).check();
  await builder.getByRole('button', { name: 'Save mystery draft', exact: true }).click();
  await page.getByRole('button', { name: 'Publish A Parcel at the Docks', exact: true }).click();
  await page.getByRole('button', { name: 'Investigate A Parcel at the Docks', exact: true }).waitFor();
  await page.evaluate(() => { questPlayer = 'bob'; questState.me = questPlayers.bob; questState.session.accountId = questPlayers.bob.accountId; questUx.render(); });
  await page.getByRole('button', { name: 'Community mysteries', exact: true }).click();
  await page.getByRole('button', { name: 'Investigate A Parcel at the Docks', exact: true }).click();
  const communityCase = page.locator('[data-quest-community-case]'); await communityCase.waitFor();
  await communityCase.getByLabel('Your suspect', { exact: true }).selectOption('tailor');
  await communityCase.getByRole('button', { name: 'Submit solution', exact: true }).click();
  await communityCase.getByRole('button', { name: 'Submit solution', exact: true }).waitFor();
  assert.equal(await communityCase.getByText('Your solution is recorded.', { exact: true }).count(), 0, 'a wrong community accusation cannot mark a case solved');
  await communityCase.getByLabel('Your suspect', { exact: true }).selectOption('courier');
  await communityCase.getByRole('button', { name: 'Submit solution', exact: true }).click();
  await communityCase.getByText('Your solution is recorded.', { exact: true }).waitFor();
  await communityCase.getByLabel('Your rating', { exact: true }).selectOption('4');
  await communityCase.getByRole('button', { name: 'Save rating', exact: true }).click();
  await page.waitForFunction(() => questMessages.includes('Your rating was saved.'));
  const rating = (await app.pool.query('SELECT solved_at,stars FROM quest_workshop_plays WHERE account_id=$1', [bob.ch.account_id])).rows[0];
  assert.ok(rating.solved_at); assert.equal(rating.stars, 4, 'the real workshop stores the solution and rating');
  await page.getByRole('button', { name: 'Your history', exact: true }).click();
  await page.getByText('distinct cases recorded', { exact: false }).waitFor();

  const carol = await create('Quest Browser Heir'), dave = await create('Quest Browser Rival');
  Object.assign(browserPlayers, { carol, dave });
  for (const player of [alice, bob, carol, dave]) await app.pool.query('UPDATE characters SET respect=5000 WHERE id=$1', [player.ch.id]);
  const crew = await api('POST', '/v1/crew', alice.token, { name: 'Browser Paper Crew' }); assert.equal(crew.code, 200);
  for (const player of [bob, carol]) {
    assert.equal((await api('POST', '/v1/crew/invite', alice.token, { name: player.ch.name })).code, 200);
    assert.equal((await api('POST', '/v1/crew/accept/' + crew.body.id, player.token)).code, 200);
  }
  assert.equal((await api('POST', '/v1/crew', dave.token, { name: 'Browser Rival Crew' })).code, 200);
  for (const pack of ['quest-sixth-envelope', 'quest-rival-accord']) {
    const bundle = compileContentPack(JSON.parse(fs.readFileSync(new URL('../content/packs/' + pack + '/pack.json', import.meta.url), 'utf8')));
    await activateContentBundle(app.pool, { bundle, expectedHash: bundle.contentHash, operatorId: 'quest-browser' });
  }
  const switchPlayer = async name => {
    const player = browserPlayers[name];
    await page.evaluate(({ name, id, accountId }) => { questPlayers[name] = { id, accountId }; questPlayer = name; questState.me = questPlayers[name]; questState.session.accountId = accountId; questUx.render(); }, { name, id: player.ch.id, accountId: player.ch.account_id });
    await page.getByLabel('Case file', { exact: true }).waitFor();
  };
  await switchPlayer('alice');
  await page.getByLabel('Case file', { exact: true }).selectOption('case:omerta.quest.sixth-envelope');
  await page.getByLabel('Your role', { exact: true }).selectOption('clerk');
  await page.getByLabel('Consent to this role', { exact: true }).check();
  await page.getByLabel('Opt in to a private agenda', { exact: true }).check();
  await page.getByRole('button', { name: 'Open this case', exact: true }).click();
  await page.getByText('Your source asked you to retain the carbon copy.', { exact: false }).waitFor();
  const envelopeId = await page.locator('[data-quest-instance]').getAttribute('data-quest-instance');
  await switchPlayer('bob');
  await page.getByLabel('Case file', { exact: true }).selectOption('lobby:' + envelopeId);
  await page.getByLabel('Consent to this role', { exact: true }).check();
  await page.getByLabel('Opt in to a private agenda', { exact: true }).check();
  await page.getByRole('button', { name: 'Join this case', exact: true }).click();
  await page.getByText('Your witness asked to remain anonymous', { exact: false }).waitFor();
  assert.ok(!(await page.locator('#ux-quests').textContent()).includes('Your source asked you to retain the carbon copy'), 'the courier never receives the clerk’s private agenda');
  await switchPlayer('alice'); await page.getByLabel('Case file', { exact: true }).selectOption('run:' + envelopeId);
  await page.getByRole('button', { name: 'Start the case', exact: true }).click();
  await page.getByLabel('Triangle seal', { exact: true }).check();
  await page.getByRole('button', { name: 'Test this deduction', exact: true }).click();
  await page.getByRole('button', { name: 'Preserve the carbon copy in sealed custody', exact: true }).click();
  const notes = page.locator('details[data-quest-section="' + envelopeId + ':notes"]'); await disclosure(notes);
  await notes.getByLabel('Shared case handoff', { exact: true }).fill('The manifest uses a triangle seal. <img id="quest-shared-xss">');
  await notes.getByRole('button', { name: 'Post shared handoff', exact: true }).click();
  await notes.getByText('The manifest uses a triangle seal. <img id="quest-shared-xss">', { exact: true }).waitFor();
  assert.equal(await page.locator('#quest-shared-xss').count(), 0, 'shared handoff notes stay inert text');
  await page.getByRole('button', { name: 'Release my seat for a replacement', exact: true }).click();
  await switchPlayer('carol'); await page.getByLabel('Case file', { exact: true }).selectOption('lobby:' + envelopeId);
  await page.getByLabel('Consent to this role', { exact: true }).check(); await page.getByLabel('Opt in to a private agenda', { exact: true }).check();
  await page.getByRole('button', { name: 'Join this case', exact: true }).click();
  const replacementNotes = page.locator('details[data-quest-section="' + envelopeId + ':notes"]'); await disclosure(replacementNotes);
  await replacementNotes.getByText('The manifest uses a triangle seal. <img id="quest-shared-xss">', { exact: true }).waitFor();
  assert.ok(!(await page.locator('#ux-quests').textContent()).includes('Your private door map places'), 'a replacement receives only its assigned role’s private information');
  assert.equal(await page.getByRole('button', { name: 'Preserve the carbon copy in sealed custody', exact: true }).count(), 0, 'completed role contributions survive replacement');

  await switchPlayer('alice'); await page.getByLabel('Case file', { exact: true }).selectOption('case:omerta.quest.rival-accord');
  await page.getByLabel('Your role', { exact: true }).selectOption('mediator');
  await page.getByLabel('Invited account IDs', { exact: false }).fill(dave.ch.account_id);
  await page.getByLabel('Consent to this role', { exact: true }).check();
  await page.getByRole('button', { name: 'Open this case', exact: true }).click();
  await page.locator('[data-quest-instance]').waitFor();
  const invitationId = await page.locator('[data-quest-instance]').getAttribute('data-quest-instance');
  await switchPlayer('dave'); await page.getByLabel('Case file', { exact: true }).selectOption('lobby:' + invitationId);
  await page.getByLabel('Consent to this role', { exact: true }).check();
  await page.getByRole('button', { name: 'Join this case', exact: true }).click();
  await page.locator('[data-quest-instance="' + invitationId + '"]').waitFor();
  const invitation = (await app.pool.query('SELECT scope_kind FROM content_instances WHERE id=$1', [invitationId])).rows[0]; assert.equal(invitation.scope_kind, 'invitation', 'the real invitation spans consenting members of distinct Crews');

  const aftermathPacks = new Map();
  for (const name of ['early-obituary', 'morning-after']) {
    const source = JSON.parse(fs.readFileSync(new URL('../content/packs/quest-' + name + '/pack.json', import.meta.url), 'utf8'));
    aftermathPacks.set(name, source); const bundle = compileContentPack(source);
    await activateContentBundle(app.pool, { bundle, expectedHash: bundle.contentHash, operatorId: 'quest-browser' });
  }
  const finishAftermath = async (player, name, decisions = {}) => {
    const pack = aftermathPacks.get(name); let current = await api('POST', '/v1/content/' + pack.namespace + '/instances', player.token, { scopeKind: 'personal', roleId: 'investigator' });
    assert.equal(current.code, 200, JSON.stringify(current.body));
    for (let index = 0; current.body.instance.status !== 'completed' && index < 40; index++) {
      const instance = current.body.instance, issued = instance.actions[0]; assert(issued, 'the aftermath case has an issued next step');
      let input = {};
      if (issued.kind === 'choose') input.choiceId = (issued.options.find(option => option.id === decisions[issued.nodeId]) || issued.options.find(option => option.available)).id;
      else if (issued.kind === 'solve') {
        const source = narrativeVariant(pack.nodes.find(node => node.id === issued.nodeId), instance.id), answer = pack.nodes.find(node => node.id === source.answerSpecId).payload;
        input = answer.verifier === 'mapping' ? { submission: { assignments: answer.solution } } : answer.verifier === 'normalized_exact' ? { answer: answer.acceptedValues[0] } : { submission: { ids: answer.solution } };
      }
      current = await api('POST', '/v1/content/instances/' + instance.id + '/act', player.token, { expectedRevision: instance.revision, actionId: issued.id, ...input });
      assert.equal(current.code, 200, JSON.stringify(current.body));
    }
    assert.equal(current.body.instance.status, 'completed'); return current.body.instance;
  };
  await finishAftermath(alice, 'early-obituary', { approach: 'witness', protection: 'public' });
  await finishAftermath(bob, 'early-obituary', { approach: 'records', protection: 'quiet' });
  const districtView = async name => {
    const player = browserPlayers[name];
    await page.evaluate(({ name, id, accountId }) => { if (!document.getElementById('tab-streets')) { const host = document.createElement('main'); host.id = 'tab-streets'; document.body.append(host); } questPlayers[name] = { id, accountId, loc: 'neon' }; questPlayer = name; questState.me = questPlayers[name]; questState.session.accountId = accountId; questState.currentTab = 'streets'; questUx.render(); }, { name, id: player.ch.id, accountId: player.ch.account_id });
  };
  await districtView('bob');
  await page.locator('#tab-streets #ux-quest-aftermath').getByRole('heading', { name: 'A temporarily shuttered printshop', exact: true }).waitFor();
  await page.evaluate(() => { questState.me.loc = 'docks'; questUx.render(); });
  assert.equal(await page.locator('#ux-quest-aftermath').count(), 0, 'personal aftermath appears only in its actual current district');
  await districtView('alice');
  await page.locator('#tab-streets #ux-quest-aftermath').getByRole('heading', { name: 'Light in the printshop window', exact: true }).waitFor();
  assert.ok(!(await page.locator('#ux-quest-aftermath').innerText()).includes('temporarily shuttered'), 'switching accounts clears the previous district outcome');
  await districtView('bob');
  await page.locator('#ux-quest-aftermath').getByRole('heading', { name: 'A temporarily shuttered printshop', exact: true }).waitFor();
  const morning = await finishAftermath(bob, 'morning-after');
  const aftermath = await api('GET', '/v1/questing', bob.token); assert.equal(aftermath.code, 200);
  await page.evaluate(body => questUx.observe('/v1/questing', body), aftermath.body);
  await page.locator('#ux-quest-aftermath').getByRole('heading', { name: 'Light in the printshop window', exact: true }).waitFor();
  assert.match(await page.locator('#ux-quest-aftermath').innerText(), /After you checked the arrangements with Ada/);
  await page.locator('#ux-quest-aftermath').getByRole('button', { name: 'Revisit the printshop case', exact: true }).click();
  await page.waitForFunction(id => document.querySelector('#ux-quests select[aria-label="Case file"]')?.value === 'run:' + id, morning.id);
  await districtView('dave'); await page.waitForTimeout(50);
  assert.equal(await page.locator('#ux-quest-aftermath').count(), 0, 'another account without this story receives no district aftermath');

  // Load the actual player shell as well: injected scripts alone would miss static-asset
  // allowlists, factory registration, and Content Desk redraw integration.
  await app.listen({ host: '127.0.0.1', port: 0 });
  const base = 'http://127.0.0.1:' + app.server.address().port;
  for (const asset of ['/ux-quests.js', '/ux-quests.css']) assert.equal((await app.inject({ method: 'GET', url: asset })).statusCode, 200, 'the production server serves ' + asset);
  const shell = await browser.newPage({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  shell.setDefaultTimeout(15000); shell.on('pageerror', error => errors.push(error.message));
  await shell.addInitScript(token => { localStorage.setItem('omerta_token', token); for (const key of ['omerta_tour2', 'omerta_welcomed', 'omerta_alltabs']) localStorage.setItem(key, '1'); }, bob.token);
  await shell.goto(base, { waitUntil: 'domcontentloaded' });
  await shell.locator('#screen-main:not(.hidden)').waitFor();
  await shell.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach(element => element.classList.add('hidden')));
  await shell.locator('#btn-jump').click(); await shell.locator('#jump-q').fill('desk');
  await shell.locator('#jump-list [data-jump="desk"]').first().click();
  await shell.locator('#tab-desk.on #ux-quests').waitFor();
  assert.equal(await shell.evaluate(() => typeof createOmertaQuests), 'function');
  await shell.locator('#ux-quests').getByRole('button', { name: 'Community mysteries', exact: true }).click();
  await shell.locator('#ux-quests').getByRole('button', { name: 'Investigate A Parcel at the Docks', exact: true }).waitFor();
  assert.notEqual(await shell.locator('#ux-quests').evaluate(element => getComputedStyle(element).borderTopStyle), 'none', 'the production stylesheet is applied');
  await shell.locator('#ux-quests').getByRole('button', { name: 'Case files', exact: true }).click();
  await shell.locator('#ux-quests').getByLabel('Case file', { exact: true }).selectOption('run:' + envelopeId);
  await shell.locator('#ux-quests').getByRole('heading', { name: "The Courier's Half", exact: true }).waitFor();
  const productionTheory = shell.locator('#ux-quests details[data-quest-section="' + envelopeId + ':theory"]'); await disclosure(productionTheory);
  await productionTheory.getByLabel('Your private working theory', { exact: true }).fill('Mid-case checkpoint note: compare the seal and the bay.');
  const syncedNote = shell.waitForResponse(reply => reply.url().endsWith('/v1/ux/workspace') && reply.request().method() === 'PUT' && reply.status() === 200 && reply.request().postData().includes('Mid-case checkpoint note'));
  await productionTheory.getByRole('button', { name: 'Save private theory', exact: true }).click(); await syncedNote;
  await shell.reload({ waitUntil: 'domcontentloaded' }); await shell.locator('#screen-main:not(.hidden)').waitFor();
  await shell.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach(element => element.classList.add('hidden')));
  await shell.locator('#btn-jump').click(); await shell.locator('#jump-q').fill('desk'); await shell.locator('#jump-list [data-jump="desk"]').first().click();
  await shell.locator('#tab-desk.on #ux-quests').waitFor();
  await shell.locator('#ux-quests').getByLabel('Case file', { exact: true }).selectOption('run:' + envelopeId);
  await shell.locator('#ux-quests').getByRole('heading', { name: "The Courier's Half", exact: true }).waitFor();
  const restoredTheory = shell.locator('#ux-quests details[data-quest-section="' + envelopeId + ':theory"]'); await disclosure(restoredTheory);
  assert.equal(await restoredTheory.getByLabel('Your private working theory', { exact: true }).inputValue(), 'Mid-case checkpoint note: compare the seal and the bay.', 'a real browser reload restores the active action and account-synced private theory');
  const syncedWorkspace = await api('GET', '/v1/ux/workspace', bob.token);
  assert.equal(syncedWorkspace.body.values.quests.theories[envelopeId], 'Mid-case checkpoint note: compare the seal and the bay.');
  const issuedCourier = shell.locator('#ux-quests [data-quest-action]').filter({ has: shell.getByRole('heading', { name: "The Courier's Half", exact: true }) });
  await issuedCourier.getByLabel('Triangle seal', { exact: true }).selectOption('seven');
  await issuedCourier.getByLabel('Circle seal', { exact: true }).selectOption('nine');
  await issuedCourier.getByRole('button', { name: 'Test this deduction', exact: true }).click();
  await shell.locator('#ux-quests').getByRole('button', { name: "Record the route without the witness's name", exact: true }).waitFor();
  await shell.setViewportSize({ width: 390, height: 844 });
  await shell.screenshot({ path: path.join(artifacts, 'quest-production-mobile.png'), fullPage: false });
  const rect = await shell.locator('#ux-quests').boundingBox(); assert.ok(rect.x >= 0 && rect.x + rect.width <= 391, 'production quest panel fits a phone');
  assert.equal((await api('POST', '/v1/travel/neon', bob.token, {})).code, 200);
  await shell.reload({ waitUntil: 'domcontentloaded' }); await shell.locator('#screen-main:not(.hidden)').waitFor();
  await shell.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach(element => element.classList.add('hidden')));
  await shell.locator('#btn-jump').click(); await shell.locator('#jump-q').fill('streets'); await shell.locator('#jump-list [data-jump="streets"]').first().click();
  await shell.locator('#tab-streets.on #ux-quest-aftermath').getByRole('heading', { name: 'Light in the printshop window', exact: true }).waitFor();
  await shell.screenshot({ path: path.join(artifacts, 'quest-aftermath-mobile.png'), fullPage: false });
  await shell.close();

  assert.deepEqual(errors, []);
  console.log('Quest browser verification passed: real case open/start, seven structured interactions, hints, wrong-answer refusal, ordered/mapping controls, checkpoints, private notes, claim, account isolation, community author/publish/solve/rate, private agendas, shared handoffs, active role replacement, rival invitation consent, history, personal district aftermath/public/quiet/epilogue/revisit, production shell/assets/actions, full reload with synced theory, and 390px layout. Screenshots: ' + artifacts);
} catch (error) {
  console.error('Quest browser failure state:', (await debugPage?.locator('#ux-quests').innerText().catch(() => 'No panel'))?.slice(0, 4000));
  console.error('Last quest requests:', JSON.stringify(requests.slice(-4)));
  throw error;
} finally { await browser?.close(); await app.close(); }
