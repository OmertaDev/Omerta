import * as S from '../mobileshops.js';
import { GameError } from '../game.js';
import { withItemRead } from '../items.js';
export function register(app,{pool,auth}) {
  if(typeof pool?.connect!=='function'||typeof auth!=='function')throw Error('Mobile shops require canonical transactions and authentication.');
  app.get('/v1/mobile-shops',{preHandler:auth},req=>{
    if(Object.keys(req.query||{}).some(k=>k!=='after'))throw new GameError('mobile_shop','query');
    return withItemRead(pool,c=>S.mobileShopBoard(c,req.query?.after??''));
  });
  for(const action of ['open','buy','close','expire'])app.post('/v1/mobile-shops/'+action,{preHandler:auth},req=>{
    if(Object.keys(req.query||{}).length)throw new GameError('mobile_shop','query');
    return S.runMobileShop(pool,req.user.sub,action,req.body,req.headers['idempotency-key']);
  });
}
