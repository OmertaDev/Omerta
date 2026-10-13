import { withItemTransaction } from '../items.js';
import { setCompanySpecialization,ownCompanySpecializations } from '../companyspecialization.js';
export function register(app,{pool,auth}) {
  app.get('/v1/company/specializations',{preHandler:auth},req=>ownCompanySpecializations(pool,req.user.sub));
  app.post('/v1/company/specializations',{preHandler:auth},req=>withItemTransaction(pool,client=>setCompanySpecialization(client,req.user.sub,req.body,req.headers['idempotency-key'],{ownerSession:req.user.agent!==true})));
}
