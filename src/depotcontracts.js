const config = {
  type: 'object', required: ['salePrice', 'bidPrice', 'targetStock', 'reorderAt', 'restockBudget'],
  properties: {
    salePrice: { type: 'integer', minimum: 50, maximum: 1000000 },
    bidPrice: { type: 'integer', minimum: 50, maximum: 1000000 },
    targetStock: { type: 'integer', minimum: 1, maximum: 40 },
    reorderAt: { type: 'integer', minimum: 0, maximum: 39 },
    restockBudget: { type: 'integer', minimum: 50, maximum: 100000000 },
  },
};
const amount = { type: 'object', required: ['amount'], properties: { amount: { type: 'integer', minimum: 1, maximum: 100000000 } } };
const quantity = { type: 'object', required: ['qty'], properties: { qty: { type: 'integer', minimum: 1, maximum: 40 } } };
const purchase = { type: 'object', required: ['qty', 'maxUnitPrice'], properties: {
  ...quantity.properties, maxUnitPrice: { type: 'integer', minimum: 50, maximum: 1000000 },
} };
const empty = { type: 'object', properties: {} };
const mutation = (operationId, requestSchema = empty) => ({ operationId, requestSchema });
export const DEPOT_CONTRACTS = {
  'POST /v1/depot/:id/policy': mutation('authorizeBusinessOperatingPolicy', {
    type: 'object', required: ['expectedRevision', 'enabled', 'allowRestock', 'allowReceive', 'businessPriority', 'maxSpend', 'reserveCash', 'expiresInSeconds'],
    properties: {
      expectedRevision: { type: 'integer', minimum: 0 }, enabled: { type: 'boolean' }, allowRestock: { type: 'boolean' },
      allowReceive: { type: 'boolean' }, businessPriority: { type: 'boolean' }, maxSpend: { type: 'integer', minimum: 0, maximum: 100000000 },
      reserveCash: { type: 'integer', minimum: 1000, maximum: 100000000 }, expiresInSeconds: { type: 'integer', minimum: 60, maximum: 604800 },
    },
  }),
  'POST /v1/depot/:id/external-costs': mutation('recordBusinessExternalCost', {
    type: 'object', required: ['usdMicros', 'category'], properties: {
      usdMicros: { type: 'integer', minimum: 1, maximum: 100000000000 }, category: { type: 'string', enum: ['inference', 'hosting', 'other'] },
    },
  }),
  'GET /v1/deliveries': { operationId: 'getDeliveryCommitments' },
  'POST /v1/market/:id/accept-delivery': mutation('acceptDeliveryCommitment', {
    type: 'object', required: ['qty', 'unitPrice', 'maxProcurementCash', 'deadlineSeconds'], properties: {
      qty: { type: 'integer', minimum: 1, maximum: 40 }, unitPrice: { type: 'integer', minimum: 1 },
      maxProcurementCash: { type: 'integer', minimum: 1, maximum: 100000 }, deadlineSeconds: { type: 'integer', minimum: 60, maximum: 21600 },
    },
  }),
  'POST /v1/deliveries/:id/deliver': mutation('settleDeliveryCommitment', quantity),
  'POST /v1/deliveries/:id/expire': mutation('expireDeliveryCommitment'),
  'GET /v1/depots': { operationId: 'listSupplyDepots' },
  'GET /v1/depot': { operationId: 'getOwnSupplyDepot' },
  'POST /v1/depot': mutation('openSupplyDepot', config),
  'POST /v1/depot/:id/configure': mutation('configureSupplyDepot', config),
  'POST /v1/depot/:id/fund': mutation('fundSupplyDepot', amount),
  'POST /v1/depot/:id/withdraw': mutation('withdrawSupplyDepotCash', amount),
  'POST /v1/depot/:id/restock': mutation('restockSupplyDepot'),
  'POST /v1/depot/:id/orders/:orderId/receive': mutation('receiveSupplyDepotOrder'),
  'POST /v1/depot/:id/orders/:orderId/cancel': mutation('cancelSupplyDepotOrder'),
  'POST /v1/depot/:id/buy': mutation('buySupplyDepotGoods', purchase),
  'POST /v1/depot/:id/stock/withdraw': mutation('withdrawSupplyDepotInventory', quantity),
  'POST /v1/depot/:id/close': mutation('closeSupplyDepot'),
};
