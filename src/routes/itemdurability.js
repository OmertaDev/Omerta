import { readCharacter } from '../game.js';
import { ownItemDurability } from '../itemdurability.js';
export function register(app,{pool,auth}) {
  app.get('/v1/items/durability',{preHandler:auth},req=>readCharacter(pool,req.user.sub,(ch,client)=>ownItemDurability(client,ch.account_id,ch.id)));
}
