import * as G from './game.js';import {companyAcquisitions,acquisitionParty,acquisitionBoard} from './companyacquisitions.js';
export function register(app,{pool,auth,canonicalAcquisition=null,withAcquisitionCharacters=null}){
 const service=companyAcquisitions(canonicalAcquisition),pair=(req,other,fn)=>{
  if(canonicalAcquisition!==null){if(typeof withAcquisitionCharacters!=='function')throw new G.GameError('company_acquisition','preflight_required');return withAcquisitionCharacters(pool,req.user.sub,other,fn);}
  return G.withTwoCharacters(pool,req.user.sub,other,fn,{meet:false});
 };
 const existing=(req,fn)=>acquisitionParty(pool,req.user.sub,req.params.id).then(other=>pair(req,other,fn));
 const originalSeller=async req=>{const row=(await pool.query('SELECT d.owner_character FROM business_depots d JOIN characters c ON c.id=d.owner_character WHERE d.id=$1 AND c.account_id=$2 AND c.alive=true AND c.is_npc=false',[req.body?.depotId,req.user.sub])).rows[0];if(!row)throw new G.GameError('company_acquisition','seller');};
 app.get('/v1/company/acquisitions',{preHandler:auth},req=>acquisitionBoard(pool,req.user.sub));
 app.post('/v1/company/acquisitions/quote',{preHandler:auth},async req=>{if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||Object.keys(req.body).sort().join(',')!=='buyerCharacter,depotId')throw new G.GameError('company_acquisition','terms');await originalSeller(req);return pair(req,req.body.buyerCharacter,(ch,b,c)=>service.quote(ch,b,req.body.depotId,c));});
 app.post('/v1/company/acquisitions',{preHandler:auth},async req=>{await originalSeller(req);return pair(req,req.body?.buyerCharacter,(ch,b,c)=>service.offer(ch,b,req.body,req.headers['idempotency-key'],c,req.user.agent===true));});
 app.post('/v1/company/acquisitions/:id/accept',{preHandler:auth},req=>existing(req,(ch,o,c)=>service.accept(ch,o,req.params.id,req.body,req.headers['idempotency-key'],c)));
 app.post('/v1/company/acquisitions/:id/execute',{preHandler:auth},req=>existing(req,(ch,o,c,h)=>service.execute(ch,o,req.params.id,req.body,req.headers['idempotency-key'],c,h,req.user.agent===true)));
 app.post('/v1/company/acquisitions/:id/cancel',{preHandler:auth},req=>existing(req,(ch,o,c)=>service.cancel(ch,o,req.params.id,req.body,req.headers['idempotency-key'],c)));
}
