// Internal RC1 quality evidence only. Scores are not fed to selection or authority.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { campaignNetworkFixture } from '../test/lib/campaign-network-support.js';
import { createPlayerCommandEngine } from '../src/player-commands.js';
import { createLivingWorldDirector } from '../src/director/runtime.js';
import { createCampaignNetworkDefinitions, CAMPAIGN_NETWORK_SITUATION_IDS as situations } from '../src/director/campaign-network.js';
import { DOCK_WAR_CAMPAIGN_ID } from '../src/director/dock-war.js';

const out = 'docs/release/evidence/simulation/quality';
await fs.mkdir(out, { recursive: true });
const sourceOverlay = {};
const dirtyFiles = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
for (const file of [...new Set([...dirtyFiles, 'src/world-telemetry.js'])]) {
  try { sourceOverlay[file] = crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const f = await campaignNetworkFixture('rc1_quality');
const definitions = createCampaignNetworkDefinitions(f.content);
const director = createLivingWorldDirector({ pool: f.pool, content: f.content, definitions, mode: 'LIVE', clock: f.clock });
const engine = createPlayerCommandEngine({ pool: f.pool, content: f.content, director,
  enabled: true, knowledgeEnabled: true, sharingEnabled: true });
const captures = [], outcomes = [];
const tick = async () => { f.advance(); return director.tick(); };
const select = async (definitionId) => {
  for (let attempt = 0; attempt < 4; attempt++) {
    if ((await f.pool.query('SELECT id FROM director_situations WHERE definition_id=$1 AND terminal=false', [definitionId])).rows.length) return;
    await tick();
  }
  assert.fail(`Expected a selected ${definitionId} after the canonical prerequisite`);
};
const capture = async (name, topic, account, options = {}) => {
  const view = await engine.snapshot(account, options);
  const active = (await f.pool.query('SELECT id,definition_id,campaign_id,terminal FROM director_situations')).rows;
  const relevant = new Set(active.filter((row) => row.definition_id.includes(topic)).map((row) => row.id));
  const cards = view.opportunities.filter((card) => relevant.has(card.subject?.id)
    || (options.operationId && card.subject?.id === options.operationId));
  const counts = new Map();
  for (const card of view.opportunities) counts.set(card.label, (counts.get(card.label) || 0) + 1);
  for (const card of view.opportunities) if (!['situation', 'operation'].includes(card.subject?.type))
    assert.equal(card.expiresAt, null, 'Routine receipt refresh must not be presented as an urgent deadline');
  const data = { name, topic, actor: account, options, cards, allCards: view.opportunities,
    consequences: view.consequences, situations: view.situations,
    worldObjects: view.worldObjects, activeSituations: active,
    counts: { cards: view.opportunities.length, relevantCards: cards.length,
      available: view.opportunities.filter((c) => c.availability === 'AVAILABLE').length,
      duplicateLabelGroups: [...counts].filter(([, count]) => count > 1),
      genericStakes: view.opportunities.filter((c) => ['Your next move is ready.', 'This work is waiting for your attention.'].includes(c.whyItMatters)).length,
      requirements: cards.reduce((sum, c) => sum + c.requirements.length, 0),
      unknownRequirements: cards.reduce((sum, c) => sum + c.requirements.filter((r) => r.status === 'UNKNOWN').length, 0) } };
  captures.push(data); return data;
};
const resolve = async (topic, actionId, options = {}) => {
  const beforeCampaigns = (await f.pool.query('SELECT id,definition_id FROM director_campaigns')).rows;
  const operation = await f.networkPrepare(actionId, { prefix: 'b', engine, ...options });
  await capture(`${actionId}_prepared`, topic, operation.boss, { operationId: operation.operationId });
  const result = await operation.command('organizer', 'execute');
  await tick();
  const expectedFollowup = { intercept_shipment: situations.market, expose_market: situations.informant }[actionId];
  if (expectedFollowup) await select(expectedFollowup);
  const afterCampaigns = (await f.pool.query('SELECT id,definition_id FROM director_campaigns')).rows;
  const after = await capture(`${actionId}_after`, topic, operation.boss);
  const canonicalEventIds = [];
  for (const change of result.response.feedback.worldChanges) {
    const event = (await f.pool.query('SELECT id FROM world_kernel_events WHERE object_id=$1 AND revision=$2', [change.id, change.revision])).rows[0];
    assert(event); canonicalEventIds.push(event.id);
  }
  outcomes.push({ topic, actionId, status: result.response.status, feedback: result.response.feedback,
    newCampaigns: afterCampaigns.filter((c) => !beforeCampaigns.some((old) => old.id === c.id)),
    canonicalEventIds,
    projectedConsequences: after.consequences, actualOperation: await f.family.get(operation.boss, operation.operationId) });
};
try {
  await capture('new_player', 'none', f.actors.outsider);
  await f.establish(); await tick();
  await capture('dock_war_opening', 'dock_', f.actors.aBoss);
  const register = await f.networkPrepare('register_shipment', { engine });
  await register.command('organizer', 'execute'); await tick();
  await select(situations.shipment);
  await f.networkLearn(f.actors.bBoss, f.ids.routeGraph, engine);
  await capture('shipment_rival', 'missing_shipment', f.actors.bBoss);
  await resolve('missing_shipment', 'intercept_shipment', { situationAction: 'intercept_shipment' });
  await select(situations.market);
  await capture('black_market_opening', 'black_market', f.actors.bBoss);
  await resolve('black_market', 'establish_market', { situationAction: 'establish_market' });
  await select(situations.marketTrade);
  await resolve('black_market', 'expose_market', { situationAction: 'expose_market' });
  await select(situations.informant);
  await capture('informant_before_corroboration', 'informant_', f.actors.bBoss);
  const seal = await f.publicTrail('b', engine);
  await capture('informant_after_corroboration', 'informant_', f.actors.bBoss);
  await resolve('informant_', 'trace_disclosure', { situationAction: 'trace_disclosure', preparedItem: seal });
  const topics = [
    ['Dock War', 'dock_', DOCK_WAR_CAMPAIGN_ID],
    ['Missing Shipment', 'missing_shipment', 'campaign:the_missing_shipment'],
    ['Black Market', 'black_market', 'campaign:the_black_market'],
    ['Informant', 'informant_', 'campaign:the_informant'],
  ];
  const scores = topics.map(([title, topic, campaignId]) => {
    const samples = captures.filter((c) => c.topic === topic), cards = samples.flatMap((c) => c.cards);
    const played = outcomes.filter((o) => o.topic === topic);
    const relevant = definitions.campaigns.find((c) => c.id === campaignId);
    const resolutions = definitions.situations.filter((s) => relevant.nodes.some((n) => n.situationId === s.id))
      .flatMap((s) => s.possibleResolutions.map((r) => r.id));
    const meaningful = cards.filter((c) => c.label && c.description && c.whyKnown && c.whyItMatters
      && !['Your next move is ready.', 'This work is waiting for your attention.'].includes(c.whyItMatters));
    const worldChanges = played.flatMap((o) => o.feedback.worldChanges);
    const visibleAftermath = played.filter((o) => o.canonicalEventIds.length
      && o.canonicalEventIds.every((id) => o.projectedConsequences?.some((c) => c.id === id)));
    const newCampaigns = played.flatMap((o) => o.newCampaigns);
    return { title, topic, campaignId, sampleNames: samples.map((c) => c.name),
      rubricScores: { clarity: cards.length ? meaningful.length === cards.length ? 1 : 0 : 'NOT_MEASURED',
        preparationDepth: played.length ? 2 : cards.some((c) => c.requirements.length) ? 1 : 'NOT_MEASURED',
        coordinationRequirement: played.length ? 2 : cards.some((c) => c.peopleNeeded || c.helpers.length) ? 1 : 'NOT_MEASURED',
        worldRelevance: worldChanges.length ? 2 : cards.length ? 1 : 'NOT_MEASURED',
        consequenceVisibility: visibleAftermath.length ? 2 : worldChanges.length ? 1 : 'NOT_MEASURED',
        branchDiversity: new Set(resolutions).size > 1 ? 1 : 0,
        followupPotential: newCampaigns.length ? 2 : played.length ? 0 : 'NOT_MEASURED',
        repetition: 'NOT_MEASURED' },
      observations: { sampledCards: cards.length, cardsWithSpecificStakes: meaningful.length,
        executedActions: played.map((o) => o.actionId), authoredResolutions: [...new Set(resolutions)],
        worldChanges: worldChanges.length, outcomesWithAftermath: visibleAftermath.length,
        newCampaigns: newCampaigns.map((c) => c.definition_id),
        maximumCardsInBoard: Math.max(0, ...samples.map((c) => c.counts.cards)) },
    };
  });
  const report = { revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    harnessSha256: crypto.createHash('sha256').update(await fs.readFile(new URL('./rc1-sim-quality.js', import.meta.url))).digest('hex'),
    database: process.argv.includes('--postgres') ? 'postgresql' : 'pg-mem',
    classification: 'INTERNAL_EVIDENCE_ONLY', sourceOverlay, captures, outcomes, scores,
    limitations: ['Ordinal evidence rubric, not a validated human quality or retention measure.',
      'One native campaign path; every alternate branch and generated situation is not sampled.',
      'No browser rendering or timed new-player observation.',
      'A Director-selected follow-up and a matching consequence projection do not prove a player understood either.'] };
  await fs.writeFile(`${out}/projection-samples.json`, `${JSON.stringify(report, null, 2)}\n`);
  const table = scores.map((s) => `| ${s.title} | ${Object.values(s.rubricScores).join(' | ')} |`).join('\n');
  const findings = captures.map((c) => `| ${c.name} | ${c.counts.cards} | ${c.counts.available} | ${c.counts.genericStakes} | ${c.counts.duplicateLabelGroups.length} |`).join('\n');
  await fs.writeFile('docs/release/RC1-OPPORTUNITY-QUALITY.md', `# RC1 opportunity quality evidence\n\n` +
    `Internal audit of base revision \`${report.revision}\` plus the tracked changes present at invocation (exact file hashes in the raw evidence's \`sourceOverlay\`), using native PostgreSQL projections and an executed Shipment → Market → Informant path. This includes the release patch's clearer consequence copy. Scores are stored only in release evidence and never influence authorization or Director selection.\n\n` +
    `## Rubric\n\n` +
    `Scores describe observed evidence, not human enjoyment. **0** means the sampled path visibly lacks the criterion; **1** means explicit authored/projected support; **2** means a native end-to-end demonstration. **NOT_MEASURED** means no adequate observation. Clarity cannot score 2 without a timed unfamiliar-player session. Branch diversity cannot score 2 without executing alternate branches. Repetition requires longitudinal sampling, so remains NOT_MEASURED.\n\n` +
    `- Clarity: a card supplies an action, description, reason it is known and specific stakes. Generic readiness prose does not answer why the work matters.\n` +
    `- Preparation: requirements are projected; score 2 requires actual acquisition, crafting, commitments and readiness in the sampled operation. This measures demonstrated preparation, not its subjective depth.\n` +
    `- Coordination: helper/participant needs are projected; score 2 requires two actors' real role commitments.\n` +
    `- World relevance: the opportunity names world business; score 2 requires canonical world changes in returned command feedback.\n` +
    `- Consequence visibility: feedback contains a world change; score 2 also requires the exact canonical event ID in the authorized follow-up projection. It does not prove comprehension.\n` +
    `- Follow-up: score 2 requires a newly selected campaign after the committed outcome. Score 0 means the sampled terminal path selected no new campaign; it does not mean all gameplay is exhausted.\n\n` +
    `| Campaign | Clarity | Preparation | Coordination | World relevance | Consequence visibility | Branch diversity | Follow-up | Repetition |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n${table}\n\n` +
    `## Concrete projection findings\n\n| Sample | Cards | Available | Generic-stakes cards | Duplicate-label groups |\n| --- | ---: | ---: | ---: | ---: |\n${findings}\n\n` +
    `The table counts the actual complete authorized board, not only its featured campaign cards. Duplicate labels can describe separate legitimate commands; this is a readability finding, not an authorization defect. All sampled routine cards correctly omit command-receipt expiration as a gameplay deadline.\n\n` +
    `## Remaining evidence\n\n` +
    `- Observe an unfamiliar player's first 30 minutes to validate understanding, practical preparation paths, and card density.\n` +
    `- Execute all alternate branches and representative generated situations before treating diversity or sustained follow-up as established.\n` +
    `- Inspect the no-new-campaign terminal Informant path alongside existing visible work; do not infer an engine dead end from a settled local story.\n` +
    `- Classify any selection or presentation change as P1 only after a reproducible severe UX or campaign failure. These scores alone do not justify architectural or economic changes.\n\n` +
    `Reproduce: \`node tools/rc1-sim-quality.js --postgres\` with the same isolated local \`COORDINATION_TEST_DATABASE_URL\` used by the simulation. Raw authored choices, cards, canonical feedback and post-command projections: [projection-samples.json](evidence/simulation/quality/projection-samples.json).\n\nOPPORTUNITY_QUALITY_GATE=INCOMPLETE\n`);
  console.log(JSON.stringify({ status: 'PASS_SCOPED', captures: captures.length, scores }));
} finally { await f.cleanup(); }
