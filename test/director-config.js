import assert from 'node:assert/strict';
import { directorConfiguration } from '../src/director/config.js';
import { coreProgressionContent } from '../src/content/core-progression.js';

const keys = ['CORE_PROGRESSION','WORLD_GRAPH_KERNEL','COORDINATION_ENGINE','COORDINATION_KNOWLEDGE',
  'COORDINATION_KNOWLEDGE_SHARING','COORDINATION_OPERATIONS','LIVING_WORLD_DIRECTOR','DIRECTOR_ACCOUNT_IDS','COORDINATION_ACCOUNT_IDS'];
const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
try {
  for (const key of keys) delete process.env[key];
  assert.equal(directorConfiguration().mode, 'DIRECTOR_DISABLED');
  assert.throws(() => directorConfiguration({ LIVING_WORLD_DIRECTOR: 'enabled' }));
  assert.throws(() => directorConfiguration({ LIVING_WORLD_DIRECTOR: 'LIVE' }));
  for (const key of keys.slice(0, 6)) process.env[key] = 'on';
  const baseline = coreProgressionContent();
  for (const mode of ['SHADOW_MODE', 'INTERNAL_SIMULATION']) {
    process.env.LIVING_WORLD_DIRECTOR = mode;
    assert.equal(coreProgressionContent(), baseline, `${mode} must not add public investigations or mystery catalogs`);
  }
  process.env.LIVING_WORLD_DIRECTOR = 'LIMITED_COHORT';
  assert.throws(() => directorConfiguration());
  process.env.DIRECTOR_ACCOUNT_IDS = 'reviewer';
  assert.throws(() => directorConfiguration(), 'all existing content APIs must enforce the same limited cohort');
  process.env.COORDINATION_ACCOUNT_IDS = 'reviewer';
  assert.deepEqual(directorConfiguration().accountIds, ['reviewer']);
  const admitted = coreProgressionContent();
  assert(admitted.directorContent);
  assert(admitted.objects.length > baseline.objects.length);
  assert(baseline.objects.every((object) => admitted.objects.includes(object)), 'existing foundations preserved');
  process.env.LIVING_WORLD_DIRECTOR = 'DIRECTOR_DISABLED';
  assert.equal(coreProgressionContent(), baseline, 'disable removes catalog exposure immediately on restart');
  console.log('PASS Director configuration: disabled default, prerequisite/cohort gates, no shadow content exposure, retained foundation interfaces');
} finally { for (const key of keys) saved[key] === undefined ? delete process.env[key] : process.env[key] = saved[key]; }
