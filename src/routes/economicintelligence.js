import * as G from '../game.js';import * as E from '../economicintelligence.js';
export function register(app,{pool,auth}){
 app.get('/v1/company/intelligence/market',{preHandler:auth},req=>{if(Object.keys(req.query||{}).length)throw new G.GameError('economic_intelligence','terms');return E.economicIntelligenceMarket(pool);});
 app.get('/v1/company/intelligence/mine',{preHandler:auth},req=>{if(Object.keys(req.query||{}).length)throw new G.GameError('economic_intelligence','terms');return E.economicIntelligenceEntitlements(pool,req.user.sub);});
 app.post('/v1/company/intelligence/:depotId/preview',{preHandler:auth},req=>G.withCharacter(pool,req.user.sub,(ch,c,h)=>E.previewEconomicIntelligence(ch,req.params.depotId,req.body,c,h)));
 app.post('/v1/company/intelligence/publish',{preHandler:auth},req=>G.withCharacter(pool,req.user.sub,(ch,c,h)=>E.publishEconomicIntelligence(ch,req.body,req.headers['idempotency-key'],c,h,req.user.agent===true)));
 app.post('/v1/company/intelligence/:id/purchase',{preHandler:auth},async req=>{const prior=await E.economicIntelligencePurchaseReplay(pool,req.user.sub,req.params.id,req.body,req.headers['idempotency-key']);if(prior)return prior;const seller=await E.intelligenceSeller(pool,req.params.id);return G.withTwoCharacters(pool,req.user.sub,seller,(ch,s,c,h)=>E.purchaseEconomicIntelligence(ch,s,req.params.id,req.body,req.headers['idempotency-key'],c,h),{meet:false});});
 app.post('/v1/company/intelligence/:id/withdraw',{preHandler:auth},req=>G.withCharacter(pool,req.user.sub,(ch,c)=>E.withdrawEconomicIntelligence(ch,req.params.id,req.body,req.headers['idempotency-key'],c)));
}
