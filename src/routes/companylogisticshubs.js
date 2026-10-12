import * as G from '../game.js';
import * as Hub from '../companylogisticshubs.js';
export function register(app,{ pool,auth }) {
  const base='/v1/company/logistics-hubs', key=req=>req.headers['idempotency-key'];
  app.get(base,{ preHandler:auth },req=>G.readCharacter(pool,req.user.sub,(ch,client)=>Hub.logisticsHubBoard(client,ch.account_id)));
  app.post(base,{ preHandler:auth },async req=>{
    const prior=await Hub.replayLogisticsHubRequest(req.user.sub,'setup',null,req.body,key(req),pool); if(prior) return prior;
    const lease=(await pool.query('SELECT landlord_character FROM commercial_premises_leases WHERE id=$1',[req.body.premisesLeaseId])).rows[0];
    if(!lease) throw new G.GameError('company_logistics_hub','premises');
    return G.withTwoCharacters(pool,req.user.sub,lease.landlord_character,(ch,landlord,client)=>Hub.setupLogisticsHub(ch,landlord,req.body,key(req),client),{ meet:false });
  });
  for(const action of ['accept','run']) app.post(`${base}/:id/${action}`,{ preHandler:auth },async req=>{
    const prior=await Hub.replayLogisticsHubRequest(req.user.sub,action,req.params.id,req.body,key(req),pool); if(prior) return prior;
    const row=(await pool.query('SELECT landlord_character FROM company_logistics_hubs WHERE id=$1',[req.params.id])).rows[0]; if(!row) throw new G.GameError('company_logistics_hub','hub');
    return G.withTwoCharacters(pool,req.user.sub,row.landlord_character,(ch,landlord,client,h)=>action==='accept'
      ?Hub.acceptLogisticsHub(ch,landlord,req.params.id,req.body,key(req),client):Hub.runLogisticsHub(ch,landlord,req.params.id,req.body,key(req),client,h),{ meet:false });
  });
  app.post(`${base}/:id/cancel`,{ preHandler:auth },req=>G.withCharacter(pool,req.user.sub,(ch,client)=>Hub.cancelLogisticsHub(ch,req.params.id,req.body,key(req),client)));
}
