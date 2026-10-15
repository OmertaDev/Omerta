// Only existing, durable game commands can be prepared. No arbitrary URL, body, signer,
// balance, eligibility, quantity, recipient, or callback is accepted from the agent.
import { fail } from './security.js';
const id = encodeURIComponent;
export function actionTarget(name, args) {
  switch (name) {
    case 'prepare_crafting_operation': return args.carId
      ? { url: `/v1/worldgraph/recipes/${id(args.recipeId)}/salvage/${id(args.carId)}`, body: {} }
      : { url: `/v1/worldgraph/recipes/${id(args.recipeId)}/craft`, body: {} };
    case 'prepare_operation': return {
      url: `/v1/worldgraph/operations/${id(args.graphId)}/${id(args.operationNodeId)}/open`, body: {},
    };
    case 'prepare_resource_pledge': return {
      url: `/v1/worldgraph/operations/${id(args.operationId)}/contributions/${id(args.nodeId)}`,
      body: args.interactionId ? { interactionId: args.interactionId } : {},
    };
    case 'prepare_coordination_request': return {
      url: `/v1/coordination/${id(args.graphId)}/instances`, body: { expectedContentHash: args.expectedContentHash },
    };
    case 'respond_to_coordination_request': return {
      url: `/v1/coordination/instances/${id(args.instanceId)}/act`,
      body: { expectedRevision: args.expectedRevision, actionId: args.actionId },
    };
    case 'submit_mystery_action': {
      const base = `/v1/worldgraph/mysteries/${id(args.graphId)}`;
      if (args.action === 'start') return { url: base + '/start', body: {} };
      if (args.action === 'cancel' && args.instanceId) return { url: base + '/cancel', body: { instanceId: args.instanceId } };
      if (!args.nodeId) fail('invalid_arguments');
      const body = args.interactionId ? { interactionId: args.interactionId } : {};
      if (args.action === 'choice' && args.optionId) return {
        url: `${base}/choices/${id(args.nodeId)}`, body: { ...body, optionId: args.optionId },
      };
      if (['discover', 'complete'].includes(args.action)) return {
        url: `${base}/nodes/${id(args.nodeId)}/${args.action}`, body,
      };
      fail('invalid_arguments');
      break;
    }
    default: fail('capability_unavailable', 409);
  }
}
