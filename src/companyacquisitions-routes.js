import * as G from './game.js';import {companyAcquisitions,acquisitionParty,acquisitionBoard} from './companyacquisitions.js';
export function register(app,{pool,auth,canonicalAcquisition=null}){
 const service=companyAcquisitions(canonicalAcquisition),pair=(req,other,fn)=>G.withTwoCharacters(pool,req.user.sub,other,fn,{meet:false});
 const existing=(req,fn)=>acquisitionParty(pool,req.user.sub,req.params.id).then(other=>pair(req,other,fn));
 app.get('/v1/company/acquisitions',{preHandler:auth},req=>acquisitionBoard(pool,req.user.sub));
 app.post('/v1/company/acquisitions/quote',{preHandler:auth},req=>{if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||Object.keys(req.body).sort().join(',')!=='buyerCharacter,depotId')throw new G.GameError('company_acquisition','terms');return pair(req,req.body.buyerCharacter,(ch,b,c)=>service.quote(ch,b,req.body.depotId,c));});
 app.post('/v1/company/acquisitions',{preHandler:auth},req=>pair(req,req.body?.buyerCharacter,(ch,b,c)=>service.offer(ch,b,req.body,req.headers['idempotency-key'],c,req.user.agent===true)));
 app.post('/v1/company/acquisitions/:id/accept',{preHandler:auth},req=>existing(req,(ch,o,c)=>service.accept(ch,o,req.params.id,req.body,req.headers['idempotency-key'],c)));
 app.post('/v1/company/acquisitions/:id/execute',{preHandler:auth},req=>existing(req,(ch,o,c,h)=>service.execute(ch,o,req.params.id,req.body,req.headers['idempotency-key'],c,h,req.user.agent===true)));
 app.post('/v1/company/acquisitions/:id/cancel',{preHandler:auth},req=>existing(req,(ch,o,c)=>service.cancel(ch,o,req.params.id,req.body,req.headers['idempotency-key'],c)));
}
