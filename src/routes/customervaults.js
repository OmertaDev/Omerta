import * as V from '../customervaults.js';
import { GameError } from '../game.js';
export function register(app,{pool,auth,assertEstateBridgeReady}) {
  if(typeof auth!=='function')throw new Error('Customer vaults require canonical authentication.');
  const runtime=V.createCustomerVaultRuntime({pool,assertEstateBridgeReady});
  const query=req=>{if(Object.keys(req.query||{}).length)throw new GameError('customer_vault','query');};
  const ready=async()=>{if(!await runtime.ready())throw Object.assign(new GameError('customer_vault_unavailable','Canonical estate bridge required.'),{statusCode:503});};
  app.get('/v1/company/vaults/availability',{preHandler:auth},async req=>{query(req);return {available:await runtime.ready(),currency:'game_cash',custody:'fully_reserved_original_customer',requiresEstateAndCashbookIntegration:true,cryptoAvailable:false};});
  app.get('/v1/company/vaults',{preHandler:auth},async req=>{query(req);await ready();return V.customerVaultBoard(pool,req.user.sub);});
  app.get('/v1/company/vaults/offers',{preHandler:auth},async req=>{query(req);await ready();return V.customerVaultOffers(pool,req.user.sub);});
  for(const action of ['open','deposit','withdraw','close'])app.post('/v1/company/vaults/'+action,{preHandler:auth},req=>{query(req);return runtime.action(req.user.sub,action,req.body,req.headers['idempotency-key'],{agent:req.user.agent===true});});
}
