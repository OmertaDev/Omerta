import * as G from '../game.js';
import * as Training from '../workertraining.js';
export function register(app,{pool,auth}){
  if(typeof pool?.connect!=='function'||typeof auth!=='function')throw new Error('Worker training requires canonical game transactions and authentication.');
  const base='/v1/company/training',key=req=>req.headers['idempotency-key'];
  app.get(base,{preHandler:auth},req=>{if(Object.keys(req.query||{}).length)throw new G.GameError('worker_training','filters');return Training.workerTrainingBoard(pool,req.user.sub);});
  app.post(base,{preHandler:auth},async req=>{const prior=await Training.replayWorkerTraining(req.user.sub,'create',req.body,key(req),pool);if(prior)return prior;return G.withCharacter(pool,req.user.sub,(ch,c,h)=>Training.createWorkerTraining(ch,req.body,key(req),c,h,{agent:req.user.agent===true}));});
  for(const action of ['accept','train'])app.post(`${base}/${action}`,{preHandler:auth},async req=>{const prior=await Training.replayWorkerTraining(req.user.sub,action,req.body,key(req),pool);if(prior)return prior;const course=(await pool.query('SELECT employer_character FROM worker_training_courses WHERE id=$1',[req.body.courseId])).rows[0];if(!course)throw new G.GameError('worker_training','course');return G.withTwoCharacters(pool,req.user.sub,course.employer_character,(ch,employer,c,h)=>action==='accept'?Training.acceptWorkerTraining(ch,employer,req.body,key(req),c,h):Training.trainWorker(ch,employer,req.body,key(req),c,h),{meet:false});});
  app.post(`${base}/close`,{preHandler:auth},async req=>{const prior=await Training.replayWorkerTraining(req.user.sub,'close',req.body,key(req),pool);if(prior)return prior;return G.withCharacter(pool,req.user.sub,(ch,c,h)=>Training.closeWorkerTraining(ch,req.body,key(req),c,h));});
}
