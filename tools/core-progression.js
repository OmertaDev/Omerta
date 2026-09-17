// Validate a proposed composition without connecting to a database or activating it.
import fs from 'node:fs';
import { createFurnaceLedger } from '../src/content/furnace-ledger.js';
import { compileProgressionContent } from '../src/content/progression-admission.js';
import { WORLD_KERNEL_REGISTRY } from '../src/content/world-kernel-pilot.js';

try {
  const [command, filename, ...extra] = process.argv.slice(2);
  if (command !== 'check' || extra.length) throw Error('Usage: node tools/core-progression.js check [proposal.json]');
  let admitted;
  if (filename) {
    const bytes = fs.readFileSync(filename);
    if (bytes.length > 1_000_000) throw Error('Proposal exceeds the one-megabyte admission limit.');
    admitted = compileProgressionContent(JSON.parse(bytes.toString('utf8')), { baseRegistry: WORLD_KERNEL_REGISTRY });
  } else admitted = createFurnaceLedger().admission;
  console.log(JSON.stringify({ ok: true, id: admitted.manifest.id, contentHash: admitted.contentHash,
    packages: admitted.manifest.packageIds.length, branches: admitted.manifest.branches.length,
    worldObjects: admitted.worldDefinitions.length, familyOperations: admitted.familyDefinitions.length,
    activated: false }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: error.code || 'progression_definition_invalid', message: error.message, activated: false }));
  process.exitCode = 1;
}
