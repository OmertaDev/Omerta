import { merchantLoyaltyAction,merchantLoyaltyBoard } from './merchantloyalty.js';
import { withItemTransaction,withItemRead } from './items.js';
import { GameError } from './game.js';
export function registerMerchantLoyalty(app,{pool,auth}){
  if(typeof auth!=='function'||typeof pool?.connect!=='function')throw Error('Merchant loyalty requires canonical authenticated Items transactions.');
  const base='/v1/items/merchant-loyalty',noQuery=async req=>{if(Object.keys(req.query||{}).length)throw new GameError('merchant_loyalty','terms');};
  app.get(base,{preHandler:auth},req=>{if(Object.keys(req.query||{}).some(k=>k!=='sellerAccountId'))throw new GameError('merchant_loyalty','terms');return withItemRead(pool,c=>merchantLoyaltyBoard(c,req.user.sub,req.query?.sellerAccountId??req.user.sub));});
  for(const action of ['create','close','quote','buy'])app.post(base+'/'+action,{preHandler:[auth,noQuery]},req=>withItemTransaction(pool,c=>merchantLoyaltyAction(c,req.user.sub,action,req.body,req.headers['idempotency-key'])));
}
