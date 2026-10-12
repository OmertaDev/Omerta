import * as G from '../game.js';
import * as Premises from '../commercialpremises.js';

export function register(app,{ pool,auth }) {
  const base='/v1/company/premises', key=req=>req.headers['idempotency-key'];
  app.get(base,{ preHandler:auth },req=>G.readCharacter(pool,req.user.sub,(ch,client)=>Premises.ownPremisesBoard(client,ch)));
  app.get(`${base}/offers`,{ preHandler:auth },req=>G.readCharacter(pool,req.user.sub,(_ch,client)=>Premises.publicPremisesOffers(client)));
  app.post(`${base}/offers`,{ preHandler:auth },req=>G.withCharacter(pool,req.user.sub,(ch,client)=>Premises.offerPremises(ch,req.body,key(req),client)));
  app.post(`${base}/offers/:id/lease`,{ preHandler:auth },async req=>{
    const prior=await Premises.replayPremisesLease(req.user.sub,req.params.id,req.body,key(req),pool);
    if (prior) return prior;
    const row=(await pool.query('SELECT landlord_character FROM commercial_premises_offers WHERE id=$1',[req.params.id])).rows[0];
    if (!row) throw new G.GameError('commercial_premises','offer');
    return G.withTwoCharacters(pool,req.user.sub,row.landlord_character,(ch,landlord,client,h)=>
      Premises.leasePremises(ch,landlord,req.params.id,req.body,key(req),client,h),{ meet:false });
  });
  app.post(`${base}/offers/:id/cancel`,{ preHandler:auth },req=>G.withCharacter(pool,req.user.sub,(ch,client)=>
    Premises.cancelPremisesOffer(ch,req.params.id,req.body,key(req),client)));
  app.post(`${base}/leases/:id/cancel`,{ preHandler:auth },req=>G.withCharacter(pool,req.user.sub,(ch,client)=>
    Premises.cancelPremisesLease(ch,req.params.id,req.body,key(req),client)));
  app.get(`${base}/leases/:id`,{ preHandler:auth },req=>G.readCharacter(pool,req.user.sub,(ch,client)=>
    Premises.commercialPremisesAccess(client,ch,req.params.id)));
}
