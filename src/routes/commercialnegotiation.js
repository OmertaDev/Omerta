import * as G from '../game.js';
import * as N from '../commercialnegotiation.js';
export function register(app,{pool,auth}){
 app.get('/v1/company/negotiations',{preHandler:auth},req=>{if(Object.keys(req.query||{}).length)throw new G.GameError('commercial_negotiation','filters');return N.commercialNegotiationBoard(pool,req.user.sub);});
 app.post('/v1/company/negotiations',{preHandler:auth},req=>G.withTwoCharacters(pool,req.user.sub,N.commercialNegotiationCreateTarget(req.body),(ch,other,c)=>N.createCommercialNegotiation(ch,other,req.body,req.headers['idempotency-key'],c,req.user.agent===true),{meet:false}));
 app.post('/v1/company/negotiations/:id/act',{preHandler:auth},async req=>{const other=await N.commercialNegotiationParty(pool,req.user.sub,req.params.id);return G.withTwoCharacters(pool,req.user.sub,other,(ch,target,c)=>N.actCommercialNegotiation(ch,target,req.params.id,req.body,req.headers['idempotency-key'],c,req.user.agent===true),{meet:false});});
 app.post('/v1/company/negotiations/:id/expire',{preHandler:auth},req=>G.withCharacter(pool,req.user.sub,(ch,c)=>N.expireCommercialNegotiation(ch,req.params.id,req.body??{},req.headers['idempotency-key'],c)));
}
