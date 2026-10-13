import * as G from '../game.js';
import * as P from '../businesspartnerships.js';
export function register(app,{pool,auth}){
 app.get('/v1/company/partnerships',{preHandler:auth},req=>P.businessPartnershipBoard(pool,req.user.sub));
 app.post('/v1/company/partnerships',{preHandler:auth},req=>{const t=P.businessPartnershipTerms(req.body);return G.withTwoCharacters(pool,req.user.sub,t.partnerCharacter,(ch,p,c)=>P.inviteBusinessPartnership(ch,p,req.body,req.headers['idempotency-key'],c,req.user.agent===true),{meet:false});});
 const pair=async(req,fn)=>G.withTwoCharacters(pool,req.user.sub,await P.businessPartnershipParty(pool,req.user.sub,req.params.id),fn,{meet:false});
 app.post('/v1/company/partnerships/:id/accept',{preHandler:auth},req=>pair(req,(ch,p,c)=>P.acceptBusinessPartnership(ch,p,req.params.id,req.body,req.headers['idempotency-key'],c)));
 app.post('/v1/company/partnerships/:id/contribute',{preHandler:auth},req=>pair(req,(ch,p,c,h)=>P.contributeBusinessPartnership(ch,p,req.params.id,req.body,req.headers['idempotency-key'],c,h,req.user.agent===true)));
 app.get('/v1/company/partnerships/:id/quote',{preHandler:auth},req=>pair(req,(ch,p,c)=>P.businessPartnershipQuote(ch,p,req.params.id,c)));
 app.post('/v1/company/partnerships/:id/distribute',{preHandler:auth},req=>pair(req,(ch,p,c,h)=>P.distributeBusinessPartnership(ch,p,req.params.id,req.body,req.headers['idempotency-key'],c,h,req.user.agent===true)));
 app.post('/v1/company/partnerships/:id/close',{preHandler:auth},req=>G.withCharacter(pool,req.user.sub,(ch,c)=>P.closeBusinessPartnership(ch,req.params.id,req.body,req.headers['idempotency-key'],c)));
}
