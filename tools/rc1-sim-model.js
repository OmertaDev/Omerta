// Supplementary long-horizon selection model. Never substitute these numbers
// for the PostgreSQL command/custody evidence in rc1-sim.js.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { runDirectorSimulation } from './director-sim.js';
import { runCampaignNetworkSimulation } from './campaign-network-sim.js';
import { rosterFor } from './rc1-sim.js';

const results = [], populations = [25, 100, 500, 1000], seeds = ['rc1-alpha', 'rc1-beta'];
const response = { solo: 65, high_activity: 95, low_activity: 20, crew_focused: 85, family_focused: 85,
  economic: 70, information_focused: 65, aggressive: 90, cooperative: 90, opportunistic: 80,
  disappearing: 0, repeated_failure: 10, hoarder: 15 };
for (const players of populations) for (const seed of seeds) for (let replicate = 0; replicate < 2; replicate++) {
  const roster = rosterFor(players, seed, replicate);
  const scenario = { id: `rc1_${players}_${seed}_${replicate}`, players,
    families: Math.max(2, Math.ceil(players / 15)), crews: Math.max(2, Math.ceil(players / 4)),
    territories: Math.max(2, Math.ceil(players / 40)),
    responsePercent: Math.round(roster.reduce((sum, actor) => sum + response[actor.archetype], 0) / roster.length),
    delayHours: 4 + replicate * 2, branches: ['protect', 'intercept', 'alternate'],
    // The production observation adapter caps distinct discovery sources at 32.
    discoveries: Math.min(32, Math.ceil(players / 5)), limitedStock: replicate === 1 };
  const result = runCampaignNetworkSimulation({ scenarios: [scenario], seed: `${seed}/${replicate}` });
  results.push({ population: players, seed, replicate, ...result });
  console.log(JSON.stringify({ population: players, seed, replicate, crossCampaignChanges: result.results[0].crossCampaignChanges }));
}
// The existing Dock model deliberately admits only its frozen scenario catalog.
// Keep that guard; its horizon evidence is separate from population-size runs.
const directorCatalog = seeds.flatMap((seed) => [0, 1].map((replicate) =>
  ({ seed, replicate, ...runDirectorSimulation({ periods: [1, 7, 30], seed: `${seed}/${replicate}` }) })));
const out = 'docs/release/evidence/simulation/model';
await fs.mkdir(out, { recursive: true });
const sources = {};
for (const file of ['tools/rc1-sim-model.js', 'tools/director-sim.js', 'tools/campaign-network-sim.js']) {
  sources[file] = crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
}
await fs.writeFile(`${out}/matrix.json`, `${JSON.stringify({
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  generatedAt: new Date().toISOString(), populations, seeds, replicates: 2, sources,
  classification: 'MODEL_ONLY',
  limitations: ['Synthetic actor policies are aggregated into response and discovery rates.',
    'No PostgreSQL transactions, Player Command execution, inventory custody or authorization occurs in this model.',
    'Separate canonical fixture scopes represent pre-existing territory; the model does not create canonical worlds in the game.',
    'Independent-replicate identities and policies are declared; this is not measured real-player retention.'],
  results, directorCatalog,
}, null, 2)}\n`);
