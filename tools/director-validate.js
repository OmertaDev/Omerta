// Compile the pilot or a proposed JSON bundle against existing admitted content.
// Outputs only authoring diagnostics; this is not a public player endpoint.
import fs from 'node:fs/promises';
import { createCampaignNetworkContent } from '../src/content/campaign-network.js';
import { campaignNetworkDefinitionSources, campaignNetworkDefinitionCatalog } from '../src/director/campaign-network.js';
import { compileDirectorDefinitions } from '../src/director/definitions.js';

try {
  if (process.argv.length > 3) throw new Error('Usage: node tools/director-validate.js [definition-bundle.json]');
  const content = createCampaignNetworkContent();
  const input = process.argv[2] ? JSON.parse(await fs.readFile(process.argv[2], 'utf8')) : campaignNetworkDefinitionSources(content);
  const result = compileDirectorDefinitions(input, campaignNetworkDefinitionCatalog(content));
  console.log(JSON.stringify({ valid: true, situations: result.situations.map(({ id, version, contentHash }) => ({ id, version, contentHash })),
    campaigns: result.campaigns.map(({ id, version, contentHash }) => ({ id, version, contentHash })) }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ valid: false, code: error.code || 'invalid_director_bundle', message: error.message,
    definition: error.definitionId, kind: error.definitionKind, field: error.field }));
  process.exitCode = 1;
}
