import { withItemTransaction } from '../items.js';
import * as Maintenance from '../equipmentmaintenance.js';
export function register(app,{pool,auth}){
 const base='/v1/company/maintenance';
 app.get(base,{preHandler:auth},req=>Maintenance.ownMaintenanceOffers(pool,req.user.sub));
 app.get(`${base}/offers`,{preHandler:auth},()=>Maintenance.publicMaintenanceOffers(pool));
 app.post(base,{preHandler:auth},req=>withItemTransaction(pool,c=>Maintenance.setMaintenanceOffer(c,req.user.sub,req.body,req.headers['idempotency-key'],{agent:req.user.agent===true})));
 app.post(`${base}/repair`,{preHandler:auth},req=>withItemTransaction(pool,c=>Maintenance.repairEquipment(c,req.user.sub,req.body,req.headers['idempotency-key'],{agent:req.user.agent===true})));
}
