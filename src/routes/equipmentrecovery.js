import * as R from '../equipmentrecovery.js';
import { GameError } from '../game.js';
import { withItemRead,withItemTransaction } from '../items.js';
export function register(app,{pool,auth}){
  if(typeof pool?.connect!=='function'||typeof auth!=='function')throw Error('Equipment recovery requires canonical transactions and authentication.');
  app.get('/v1/equipment-recovery',{preHandler:auth},req=>{
    if(Object.keys(req.query||{}).sort().join(',')!=='businessId,itemId')throw new GameError('equipment_recovery_terms','query');
    return withItemRead(pool,c=>R.inspectEquipmentRecovery(c,req.user.sub,req.query.businessId,req.query.itemId));
  });
  app.post('/v1/equipment-recovery',{preHandler:auth},req=>{
    if(Object.keys(req.query||{}).length)throw new GameError('equipment_recovery_terms','query');
    return withItemTransaction(pool,c=>R.recoverEquipment(c,req.user.sub,req.body,req.headers['idempotency-key']));
  });
}
