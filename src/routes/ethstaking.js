import {ethStakingBoard,prepareEthStakingTransaction} from '../ethstaking.js';

export function register(app,{pool,auth}){
  app.get('/v1/eth-staking',{preHandler:auth},async req=>ethStakingBoard(pool,req.user.sub,req.query));
  app.post('/v1/eth-staking/transaction',{preHandler:auth},async req=>prepareEthStakingTransaction(pool,req.user.sub,req.body));
}
