import { withItemTransaction } from '../items.js';
import * as Rentals from '../equipmentrentals.js';
export function register(app, { pool, auth, relayEscrowCustody }) {
  if (typeof auth !== 'function' || typeof pool?.connect !== 'function' || typeof relayEscrowCustody !== 'function') throw new Error('Equipment rentals require authenticated canonical custody relay integration.');
  app.get('/v1/equipment/rentals', { preHandler: auth }, req => { if (Object.keys(req.query || {}).length) throw Object.assign(new Error('Unknown rental filters'), { statusCode: 400 }); return Rentals.equipmentRentalBoard(pool, req.user.sub); });
  app.post('/v1/equipment/rentals/offers', { preHandler: auth }, req => withItemTransaction(pool, c => Rentals.createEquipmentRentalOffer(c, req.user.sub, req.body, req.headers['idempotency-key'])));
  app.post('/v1/equipment/rentals/offers/cancel', { preHandler: auth }, req => withItemTransaction(pool, c => Rentals.cancelEquipmentRentalOffer(c, req.user.sub, req.body, req.headers['idempotency-key'])));
  app.post('/v1/equipment/rentals/accept', { preHandler: auth }, req => withItemTransaction(pool, c => Rentals.acceptEquipmentRental(c, req.user.sub, req.body, req.headers['idempotency-key'])));
  app.post('/v1/equipment/rentals/end', { preHandler: auth }, req => withItemTransaction(pool, c => Rentals.endEquipmentRental(c, req.user.sub, req.body, req.headers['idempotency-key'])));
}
