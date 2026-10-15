import { museManifest } from './manifest.js';
import { museTools } from './tools.js';
import { validateToolRequest } from './schemas.js';
import { museResponse } from './responses.js';

export { museManifest, CONSIGLIERE_INSTRUCTIONS, STARTER_PROMPTS } from './manifest.js';
export { MUSE_CALL_SCHEMA } from './schemas.js';

// Authentication, scopes, data visibility, replay handling and auditing remain Gateway concerns.
// This module neither queries the database nor has access to wallet signing authority.
export function createMuseAdapter({ gateway, capabilities }) {
  const mapped = museTools(capabilities);
  const byName = new Map(mapped.map(tool => [tool.name, tool]));
  return {
    manifest: museManifest,
    listTools(scopes = null) { return museTools(capabilities, scopes); },
    async callTool(principal, request) {
      validateToolRequest(request);
      const tool = byName.get(request.name);
      if (!tool) {
        const error = new Error('This tool is unavailable. Retrieve the current tool list.');
        error.code = 'unknown_tool';
        error.statusCode = 404;
        throw error;
      }
      const envelope = await gateway.execute(principal, tool.capability, request.arguments, { requestId: request.requestId });
      return museResponse(envelope);
    },
  };
}
