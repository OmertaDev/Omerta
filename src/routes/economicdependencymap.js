import { GameError } from '../game.js';
import { economicDependencyMap } from '../economicdependencymap.js';
export function register(app,{pool,auth}){
 if(typeof auth!=='function'||typeof pool?.connect!=='function')throw Error('Economic dependency maps require authenticated canonical read snapshots.');
 app.get('/v1/company/dependency-map/:depotId',{preHandler:[auth,async req=>{if(Object.keys(req.query||{}).length)throw new GameError('economic_dependency_map','terms');}]},req=>economicDependencyMap(pool,req.user.sub,req.params.depotId));
}
