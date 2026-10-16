// Component registrar/auth/DTO proof only. Actual shared server registration is coordinator-owned.
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
assert(!process.env.DATABASE_URL,'No ambient endpoint');
const {makeDb}=await import('../src/db.js'),{register}=await import('../src/routes/mobileshops.js');
const {MOBILE_SHOP_BOARD}=await import('../src/mobileshops-contracts.js');
const pool=await makeDb(),app=Fastify();
try {
  for(const table of ['mobile_shops','mobile_shop_requests'])assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM '+table)).rows[0].n,0,'Use fresh canonical migrated mobile shop tables');
  await app.register(jwt,{secret:'mobile-shop-component-fixture-only'});
  app.setErrorHandler((e,req,reply)=>reply.code(e.statusCode||400).send({error:e.code||'error',message:e.message}));
  register(app,{pool,auth:req=>req.jwtVerify()});
  const call=(agent,method,url,payload,key='same-original-body')=>app.inject({method,url,payload,headers:{...(agent===null?{}:{authorization:'Bearer '+app.jwt.sign({sub:'boundary-owner',agent})}),'idempotency-key':key}});
  assert.equal((await call(null,'GET','/v1/mobile-shops')).statusCode,401);
  const ajv=new Ajv({strict:false});addFormats(ajv);const validate=ajv.compile(MOBILE_SHOP_BOARD);
  for(const agent of [false,true]) {
    const board=await call(agent,'GET','/v1/mobile-shops');assert.equal(board.statusCode,200,board.body);assert(validate(board.json()),JSON.stringify(validate.errors));
    assert.equal((await call(agent,'GET','/v1/mobile-shops?private=true')).statusCode,400);
    assert.equal((await call(agent,'POST','/v1/mobile-shops/open',{quantity:1,unitPrice:100,lifetimeSeconds:60,consent:true,foreign:true})).json().error,'mobile_shop_terms');
    const refused=await call(agent,'POST','/v1/mobile-shops/open',{quantity:1,unitPrice:100,lifetimeSeconds:60,consent:true});
    assert.equal(refused.statusCode,400);assert.equal(refused.json().error,'mobile_shop_transactional_backend_required');
    assert.equal((await call(agent,'POST','/v1/mobile-shops/open?unknown=true',{})).statusCode,400);
  }
  assert.equal((await pool.query('SELECT * FROM mobile_shop_requests')).rows.length,0);
  assert.equal((await pool.query('SELECT * FROM market_listings')).rows.length,0);
  console.log('PASS N11 component JWT parity/closed DTO/query/body/fresh-action refusal. No shared-server gameplay claim.');
} finally {await app.close();await pool.end();}
