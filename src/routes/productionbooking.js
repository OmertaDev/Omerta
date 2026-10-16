import { GameError } from '../game.js';
import { withItemTransaction } from '../items.js';
import { productionBookingTerms, productionBookingBoard, offerProductionBooking, acceptProductionBooking, completeProductionBooking,
  cancelProductionBooking, expireProductionBooking } from '../productionbooking.js';
import { PRODUCTION_BOOKING_SCHEMAS } from '../productionbooking-contracts.js';

export function register(app,{pool,auth}) {
  if(typeof pool?.connect!=='function'||typeof auth!=='function')throw Error('Production bookings require canonical authenticated transactions.');
  const noQuery=async req=>{if(Object.keys(req.query||{}).length)throw new GameError('production_booking','terms');};
  const base='/v1/company/production-bookings';
  app.get(base,{preHandler:[auth,noQuery]},req=>productionBookingBoard(pool,req.user.sub));
  for(const [action,fn] of [['offer',offerProductionBooking],['accept',acceptProductionBooking],['complete',completeProductionBooking],['cancel',cancelProductionBooking],['expire',expireProductionBooking]]){
    const name=action==='offer'?'ProductionBookingOfferBody':action==='accept'?'ProductionBookingAcceptBody':'ProductionBookingReferenceBody';
    app.post(base+'/'+action,{preValidation:async req=>{productionBookingTerms(action,req.body);},preHandler:[auth,noQuery],schema:{body:PRODUCTION_BOOKING_SCHEMAS[name]}},req=>withItemTransaction(pool,c=>fn(c,req.user.sub,req.body,req.headers['idempotency-key'],{agentCredential:req.user.agent===true})));
  }
}
