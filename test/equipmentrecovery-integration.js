import assert from 'node:assert/strict';
assert(!process.env.DATABASE_URL,'No ambient database endpoint');
assert.deepEqual(process.argv.slice(2),[],'Native entry is separate');
const {runEquipmentRecoveryScenario}=await import('./equipmentrecovery-integration-fixture.js');
await runEquipmentRecoveryScenario();
