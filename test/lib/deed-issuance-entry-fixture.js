// Opt-in LOCAL TEST simulation only. Imports below are built-ins; application/PG/viem
// are loaded only after explicit endpoint, ownership and retained-artifact checks.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const HERE = fileURLToPath(import.meta.url);
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const REVIEW_SHA = '31d1e9ef2792243624db006f92f53b52d5be9cf068dfa6830d04d9dc36729f24';
const OWNER = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
const PLAYER = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
const RECIPIENT = '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc';
// Widely published default Anvil/Hardhat TEST key, never a user or release key.
const PUBLIC_TEST_SIGNER = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const CHAIN = '0x7a69', HEX = /^0x(?:[0-9a-f]{2})+$/i, HASH = /^0x[0-9a-f]{64}$/i;
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const stringify = v => JSON.stringify(v, (_k, x) => typeof x === 'bigint' ? x.toString() : x);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const ensure = (value, message) => assert(value, message);

function localUrl(raw, kind) {
  ensure(typeof raw === 'string' && raw.length, 'Explicit local URL required');
  let u; try { u = new URL(raw); } catch { throw Error('Invalid local URL'); }
  ensure(u.hostname === '127.0.0.1' && /^\d+$/.test(u.port), 'Numeric loopback and explicit nondefault port required');
  const port = Number(u.port);
  ensure(port >= 1024 && port <= 65535, 'Local port out of bounds');
  ensure(!u.search && !u.hash, 'URL query/fragment refused');
  if (kind === 'postgres') {
    ensure(['postgres:', 'postgresql:'].includes(u.protocol) && port !== 5432, 'Nondefault local PostgreSQL required');
    ensure(/^\/rc1_world_[a-f0-9]{24}$/.test(u.pathname), 'Existing exclusively owned world database required');
  } else {
    ensure(u.protocol === 'http:' && port !== 8545 && !u.username && !u.password && u.pathname === '/', 'Nondefault local Anvil HTTP origin required');
  }
  return u;
}

export function parseLocalDeedFixtureArgs(argv) {
  ensure(argv.includes('--local-deed-fixture'), 'Explicit --local-deed-fixture required');
  const names = ['postgres-url', 'database-lease', 'database-lease-sha256', 'anvil-url', 'anvil-ownership',
    'anvil-ownership-sha256', 'app-port', 'artifact-review', 'output'];
  const values = Object.create(null);
  for (const arg of argv) {
    if (arg === '--local-deed-fixture' || arg === '--source-preflight') continue;
    const m = /^--([^=]+)=(.+)$/.exec(arg);
    ensure(m && names.includes(m[1]) && !Object.hasOwn(values, m[1]), 'Unknown, duplicate or empty fixture argument');
    values[m[1]] = m[2];
  }
  ensure(names.every(n => Object.hasOwn(values, n)), 'Every fixture input must be explicit; environment fallback is forbidden');
  ensure(/^[a-f0-9]{64}$/.test(values['database-lease-sha256']) && /^[a-f0-9]{64}$/.test(values['anvil-ownership-sha256']), 'Explicit ownership packet hashes required');
  ensure(/^[1-9]\d*$/.test(values['app-port']), 'Explicit app port required');
  const appPort = Number(values['app-port']);
  ensure(appPort >= 1024 && appPort <= 65535 && ![5432, 8545, 8787].includes(appPort), 'Nondefault app port required');
  const pg = localUrl(values['postgres-url'], 'postgres'), anvil = localUrl(values['anvil-url'], 'anvil');
  ensure(new Set([appPort, Number(pg.port), Number(anvil.port)]).size === 3, 'Fixture services require distinct ports');
  return {pg, anvil, appPort, origin: 'http://127.0.0.1:' + appPort,
    leasePath: path.resolve(values['database-lease']), leaseSha: values['database-lease-sha256'],
    ownershipPath: path.resolve(values['anvil-ownership']), ownershipSha: values['anvil-ownership-sha256'],
    reviewPath: path.resolve(values['artifact-review']), output: path.resolve(values.output),
    sourcePreflight: argv.includes('--source-preflight')};
}

async function pinnedJson(file, expected) {
  const bytes = await fs.readFile(file);
  ensure(sha(bytes) === expected, 'Pinned input changed');
  return {value: JSON.parse(bytes), pin: {path: file, sha256: sha(bytes), bytes: bytes.length}};
}

export async function readRetainedDeedFixtureInputs(config) {
  const lease = await pinnedJson(config.leasePath, config.leaseSha);
  ensure(lease.value.created === true && lease.value.name === config.pg.pathname.slice(1)
    && Number.isSafeInteger(Number(lease.value.oid)) && Number(lease.value.oid) > 0, 'Created database lease identity required');
  let marker; try { marker = JSON.parse(lease.value.ownerMarker); } catch { throw Error('Invalid database owner marker'); }
  ensure(marker.tool === 'rc1-native-world' && marker.format === 1 && /^[a-f0-9]{24}$/.test(marker.nonce)
    && lease.value.name === 'rc1_world_' + marker.nonce && /^[a-f0-9]{40}$/.test(marker.sourceRevision), 'Unsupported database lease marker');
  const ownership = await pinnedJson(config.ownershipPath, config.ownershipSha);
  const o = ownership.value;
  ensure(o.schema === 'omerta.local-deed-anvil-ownership/v1' && o.unforked === true && o.chainId === 31337
    && o.rpcOrigin === config.anvil.origin && typeof o.instanceId === 'string' && o.instanceId.length > 0
    && HASH.test(o.genesisHash) && o.freshAtBlockZero === true, 'Explicit fresh unforked Anvil ownership packet required');
  const review = await pinnedJson(config.reviewPath, REVIEW_SHA);
  const artifacts = await pinnedJson(review.value.reports.artifactReport.path, review.value.reports.artifactReport.sha256);
  const source = await pinnedJson(review.value.reports.sourceReport.path, review.value.reports.sourceReport.sha256);
  ensure(artifacts.value.selectedSeven.length === 7, 'Seven selected artifact pins required');
  let street;
  for (const row of artifacts.value.selectedSeven) {
    const bytes = await fs.readFile(row.path);
    ensure(sha(bytes) === row.sha256 && bytes.length === row.bytes, 'Selected retained artifact changed');
    const s = source.value.rawSourceRows.find(s => s.path === row.source);
    ensure(s, 'Selected source pin absent');
    const current = await fs.readFile(path.join(ROOT, 'omerta-contracts', row.source));
    ensure(sha(current) === s.staged.sha256, 'Selected managed product source changed');
    if (row.name === 'StreetDeed') {
      ensure(row.source === 'src/StreetDeed.sol' && row.viaIR === false && row.runtimeTemplateBytes === 17958, 'Unexpected StreetDeed artifact');
      street = {artifact: JSON.parse(bytes), descriptor: row};
    }
  }
  ensure(street && HEX.test(street.artifact.bytecode.object)
    && Object.keys(street.artifact.bytecode.linkReferences || {}).length === 0, 'Concrete unlinked StreetDeed creation artifact required');
  return {lease, ownership, review, artifacts, source, street};
}

function walletScript(capability) {
  // Only this explicit test provider is advertised; real injected providers are not usable.
  return `(() => { 'use strict';
    const cap=${JSON.stringify(capability)};
    const provider={isOmertaLocalTest:true,on(){},removeListener(){},async request(input){
      const r=await fetch('/__fixture/rpc',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-local-fixture':cap},body:JSON.stringify(input)});
      const j=await r.json(); if(j.error)throw Object.assign(new Error(j.error.message),{code:j.error.code}); return j.result;
    }};
    window.addEventListener('eip6963:announceProvider',e=>{if(e.detail?.provider!==provider)e.stopImmediatePropagation();},true);
    Object.defineProperty(window,'ethereum',{value:provider,configurable:true});
    const announce=()=>window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{uuid:'fd3bb51e-7d8e-4977-942e-c11211995282',name:'TEST ONLY — owned local Anvil',icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',rdns:'test.local.omerta'},provider}}));
    window.addEventListener('eip6963:requestProvider',announce);announce();
    window.__OMERTA_LOCAL_DEED_FIXTURE__=Object.freeze({testOnly:true,chainId:31337,realWallet:false});
  })();`;
}

async function run(config, retained) {
  // This fixture must be a dedicated child. Clear inherited app/credential settings
  // before importing application modules. Never read a .env or mutate a parent.
  const osNames = new Set(['systemroot','windir','systemdrive','comspec','temp','tmp','path','pathext','userprofile','appdata','localappdata','programdata','programfiles','programfiles(x86)','number_of_processors','processor_architecture','os']);
  for (const name of Object.keys(process.env)) if (!osNames.has(name.toLowerCase())) delete process.env[name];
  await fs.mkdir(config.output, {recursive: false});
  const record = (file, value) => fs.writeFile(path.join(config.output, file), stringify(value) + '\n', {flag: 'wx'});
  let logTail = Promise.resolve();
  const log = (file, value) => { logTail = logTail.then(() => fs.appendFile(path.join(config.output, file), stringify(value) + '\n')); return logTail; };
  let app, db, stopped = false, stopPromise, deployment, runtimeHash, rpcId = 0, stage = 'preflight', sourcePins = [];
  const actors = new Set(), characters = new Set(), names = new Set();
  const capability = crypto.randomBytes(24).toString('hex');
  const safeError = e => ({stage, category: e?.name === 'AssertionError' ? 'fixture_guard_refused' : 'fixture_failed', code: typeof e?.code === 'string' && /^[A-Z0-9_]{1,40}$/.test(e.code) ? e.code : 'LOCAL_FIXTURE_FAILED'});
  const rawRpc = async (method, params = []) => {
    const request = {jsonrpc: '2.0', id: ++rpcId, method, params};
    const response = await fetch(config.anvil, {method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000), headers: {'content-type': 'application/json'}, body: stringify(request)});
    ensure(response.ok, 'Owned simulator HTTP refusal');
    const body = await response.json();
    await log('rpc.ndjson', {request, response: body});
    ensure(!body.error && body.id === request.id, 'Owned simulator RPC refused');
    return body.result;
  };
  const identity = async () => {
    ensure(await rawRpc('eth_chainId') === CHAIN, 'Local chain changed');
    const metadata = await rawRpc('anvil_metadata');
    ensure(metadata && metadata.instanceId === retained.ownership.value.instanceId && Number(metadata.chainId) === 31337
      && metadata.forkedNetwork == null, 'Unknown or forked simulator identity');
    return metadata;
  };
  const receipt = async hash => {
    ensure(HASH.test(hash), 'Invalid local transaction hash');
    for (let i = 0; i < 40; i++) { const r = await rawRpc('eth_getTransactionReceipt', [hash]); if (r) { ensure(r.status === '0x1', 'Local transaction reverted'); return r; } await pause(100); }
    throw Error('Local receipt not established');
  };
  const verifyDatabase = async (empty = false) => {
    const row = (await db.query("SELECT d.oid, d.datname, r.rolname AS owner, current_user AS connected_role, shobj_description(d.oid,'pg_database') AS marker FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba WHERE d.datname=current_database()")).rows[0];
    ensure(row && row.datname === retained.lease.value.name && Number(row.oid) === Number(retained.lease.value.oid)
      && row.marker === retained.lease.value.ownerMarker && row.owner === row.connected_role, 'Owned database identity mismatch');
    if (empty) ensure(Number((await db.query("SELECT count(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')")).rows[0].n) === 0, 'Fresh empty leased database required');
    return row;
  };
  const snapshot = async reason => {
    const ids = [...actors], deedNames = [...names];
    return {reason,fixtureAssisted: true,
      accounts: (await db.query('SELECT account_id,minted,wallet_address,omr::text FROM account_persistent WHERE account_id=ANY($1::text[])', [ids])).rows,
      characters: (await db.query('SELECT id,account_id,name,respect::text,energy::text,nerve::text,health::text,cash::text,minted,loc FROM characters WHERE account_id=ANY($1::text[])', [ids])).rows,
      intents: (await db.query('SELECT account_id,name,building_id,district FROM street_deed_paid_intents WHERE account_id=ANY($1::text[])', [ids])).rows,
      deeds: (await db.query('SELECT name,account_id,building_id,district,onchain_token_id,onchain_owner FROM street_deeds WHERE name=ANY($1::text[])', [deedNames])).rows,
      assignments: (await db.query('SELECT building_id,street_name FROM street_deed_building_assignments WHERE street_name=ANY($1::text[])', [deedNames])).rows,
      supply: (await db.query('SELECT * FROM street_deed_supply WHERE id=1')).rows,
      vouchers: (await db.query("SELECT id,account_id,kind,nonce::text,to_address,status,claimed_onchain FROM vouchers WHERE account_id=ANY($1::text[]) AND kind='deed'", [ids])).rows};
  };
  const stop = reason => stopPromise ||= (async () => {
    stopped = true;
    let appClosed = false, applicationPoolEnded = false, databasePoolEnded = false, postRunSourcePinsStable = false;
    try {
      try {
        await readRetainedDeedFixtureInputs(config);
        for (const pin of sourcePins) ensure(sha(await fs.readFile(path.join(ROOT,pin.path)))===pin.sha256,'Fixture source drift');
        postRunSourcePinsStable = true;
      } catch { process.exitCode=1; }
      if (app) { await app.close(); appClosed = true; }
    }
    finally { try { if (app?.pool) { await app.pool.end(); applicationPoolEnded = true; } }
    finally { try { if (db) { await db.end(); databasePoolEnded = true; } } finally {
      await logTail;
      await record('STOPPED.json', {reason,appClosed,applicationPoolEnded,databasePoolEnded,postRunSourcePinsStable,parentResourceStopOrDropAttempted:false,anvilStopped:false,postgresStopped:false,databaseDropped:false,exhaustiveProcessTree:false,
        bootFailureBeforeAppHandleMayLeavePoolUnknown:!app});
    } } }
  })();
  try {
    sourcePins=await Promise.all(['test/lib/deed-issuance-entry-fixture.js','src/server.js','src/chain.js','src/deeds.js','src/deedbuildings.js','src/watcher.js','src/db.js','schema.sql','public/index.html'].map(async p=>({path:p,sha256:sha(await fs.readFile(path.join(ROOT,p)))})));
    await record('SOURCE.json', {phase:'LOCAL_TEST_FIXTURE_START_NO_RELEASE_AUTHORITY',fixture: {path:HERE,sha256:sha(await fs.readFile(HERE))},
      retainedReview:retained.review.pin,sevenArtifacts:retained.artifacts.value.selectedSeven.map(r=>({path:r.path,sha256:r.sha256,source:r.source})),
      backendSources:sourcePins,
      databaseLease:retained.lease.pin,anvilOwnership:retained.ownership.pin,fixtureAssisted:true,production:false});
    stage = 'owned_resource_verification';
    await identity();
    ensure(await rawRpc('eth_blockNumber') === '0x0', 'Simulator already used');
    const genesis = await rawRpc('eth_getBlockByNumber', ['0x0', false]);
    ensure(genesis.hash === retained.ownership.value.genesisHash, 'Simulator genesis changed');
    const accounts = (await rawRpc('eth_accounts')).map(a=>a.toLowerCase());
    ensure(accounts[0] === OWNER && accounts[1] === PLAYER && accounts[2] === RECIPIENT, 'Only known PUBLIC synthetic accounts are admitted');
    for (const account of [OWNER,PLAYER,RECIPIENT]) ensure(await rawRpc('eth_getTransactionCount',[account,'pending']) === '0x0','Synthetic account already used');
    const {default: pg} = await import('pg');
    db = new pg.Pool({connectionString:config.pg.href,max:3,connectionTimeoutMillis:5000,options:'-c statement_timeout=15000 -c lock_timeout=8000'});
    await verifyDatabase(true);
    const viem = await import('viem'), {privateKeyToAccount} = await import('viem/accounts');
    const signer = privateKeyToAccount(PUBLIC_TEST_SIGNER); ensure(signer.address.toLowerCase()===OWNER,'Public fixture signer mismatch');
    stage = 'street_deed_local_simulation_deployment';
    const expected = viem.getContractAddress({from:OWNER,nonce:0n});
    ensure(await rawRpc('eth_getCode',[expected,'latest']) === '0x','Unknown existing local deployment');
    const data = viem.encodeDeployData({abi:retained.street.artifact.abi,bytecode:retained.street.artifact.bytecode.object,
      args:[OWNER,signer.address,config.origin+'/__fixture/art/',config.origin+'/deed/',25n]});
    const deployHash = await rawRpc('eth_sendTransaction',[{from:OWNER,data,gas:'0x989680'}]);
    const deployReceipt = await receipt(deployHash);
    ensure(deployReceipt.contractAddress?.toLowerCase()===expected.toLowerCase(),'Unexpected local deployment address');
    deployment = expected;
    const configure = viem.encodeFunctionData({abi:retained.street.artifact.abi,functionName:'configurePrimarySale',args:[RECIPIENT,RECIPIENT,false]});
    const setupHash = await rawRpc('eth_sendTransaction',[{from:OWNER,to:deployment,data:configure,gas:'0x1e8480'}]);
    const setupReceipt = await receipt(setupHash), code = await rawRpc('eth_getCode',[deployment,'latest']);
    ensure(HEX.test(code),'Deployed local runtime missing'); runtimeHash = viem.keccak256(code);
    await record('LOCAL-DEPLOYMENT.json',{chainId:31337,contract:deployment,runtimeHash,code,deployReceipt,setupReceipt,
      owner:OWNER,signer:OWNER,player:PLAYER,partnershipRecipient:RECIPIENT,proceedsRecipient:RECIPIENT,routeProceeds:false,dailyMintCap:'25',
      limitation:'PUBLIC synthetic direct-proceeds fixture; no routed fee-policy or production role separation qualification.',localSimulatorOnly:true,releaseDeployment:false});
    Object.assign(process.env,{NODE_ENV:'test',DATABASE_URL:config.pg.href,JWT_SECRET:crypto.randomBytes(32).toString('hex'),MARKET_SEED:crypto.randomBytes(32).toString('hex'),MOD_KEY:crypto.randomBytes(32).toString('hex'),
      LEGAL_PROFILE_DEFER:'on',SOCIAL_VERIFY_MODE:'off',INVITE_MODE:'off',PUBLIC_URL:config.origin,CHAIN_ID:'31337',CHAIN_RPC_URL:config.anvil.href,CHAIN_CONFIRMATIONS:'0',
      STREET_DEED_ADDRESS:deployment,STREET_DEED_RUNTIME_HASH:runtimeHash,VOUCHER_SIGNER_PK:PUBLIC_TEST_SIGNER});
    stage = 'actual_buildServer_full_postgres_schema';
    const {buildServer} = await import('../../src/server.js');
    app = await buildServer();
    await verifyDatabase();
    ensure(Number((await db.query('SELECT count(*) AS n FROM accounts')).rows[0].n)===0,'Fixture may assist only newly created guests');
    const {PACING} = await import('../../src/rules.js');
    const watcher = await import('../../src/watcher.js');
    const publicClient = viem.createPublicClient({cacheTime:0,transport:viem.custom({request:({method,params})=>rawRpc(method,params)},{retryCount:0})});
    const source = await watcher.makeViemSource({publicClient}); ensure(source,'Actual canonical watcher source unavailable');
    let syncTail=Promise.resolve(), scenario='normal';
    const sync = () => {
      const operation=syncTail.then(async()=>{
      await identity();const observation={};
      const observed={...source};for(const method of ['deedExtractedLogs','deedTransferLogs','deedRedeemedLogs'])observed[method]=async(...args)=>{const logs=await source[method](...args);await log('canonical-events.ndjson',{method,args,logs});return logs;};
      for(const [key,fn]of [['extracted',watcher.syncDeedExtractedEvents],['transferred',watcher.syncDeedTransferEvents],['redeemed',watcher.syncDeedRedeemedEvents]])observation[key]=await fn(app.pool,observed,{confirmations:0,startBlock:0});
        await log('states.ndjson',await snapshot('after_actual_watcher_sync'));return observation;
      });
      syncTail=operation.catch(()=>{});
      return operation;
    };
    app.addHook('onRequest',async(req,reply)=>{
      if (req.headers.host!==new URL(config.origin).host || (req.headers.origin&&req.headers.origin!==config.origin)
        || req.headers['sec-fetch-site']==='cross-site')return reply.code(403).send({error:'local_fixture_origin'});
      req.headers['accept-encoding']='identity'; delete req.headers['if-none-match'];
      if(req.url.startsWith('/__fixture/')&&req.method==='POST'&&req.headers['x-local-fixture']!==capability)return reply.code(403).send({error:'local_fixture_capability'});
    });
    app.addHook('onSend',async(req,reply,payload)=>{
      if (req.url==='/' && reply.statusCode===200 && String(reply.getHeader('content-type')).startsWith('text/html')) {
        ensure(!reply.getHeader('content-encoding'),'Unexpected compressed fixture page');
        const html=Buffer.isBuffer(payload)?payload.toString('utf8'):payload;ensure(typeof html==='string'&&html.includes('<head>'),'Actual app shell unavailable');
        reply.removeHeader('etag');reply.removeHeader('content-length');reply.header('cache-control','no-store');
        return html.replace('<head>','<head><script src="/__fixture/wallet.js"></script>');
      }
      if(!req.url.startsWith('/v1/')||payload==null)return payload;
      const raw=Buffer.isBuffer(payload)?payload:Buffer.from(String(payload));let body;
      try{body=JSON.parse(raw.toString('utf8'));}catch{return payload;}
      if(req.method==='POST'&&req.url==='/v1/auth/guest'&&reply.statusCode<400&&body.token){
        const id=app.jwt.verify(body.token).sub;ensure(typeof id==='string','Real guest session missing');
        if(!actors.has(id)){ensure(actors.size===0,'Only one fresh synthetic guest is admitted');const account=(await db.query("SELECT id FROM accounts WHERE id=$1 AND auth_provider='guest' AND auth_subject=id",[id])).rows[0];ensure(account,'Fresh guest account required');actors.add(id);
          await db.query('UPDATE account_persistent SET minted=true,wallet_address=$2 WHERE account_id=$1',[id,PLAYER]);
          const persisted=(await db.query('SELECT minted,wallet_address FROM account_persistent WHERE account_id=$1',[id])).rows[0];
          ensure(persisted?.minted===true&&persisted.wallet_address?.toLowerCase()===PLAYER,'Fixture account eligibility did not persist');
          await log('fixture-assistance.ndjson',{phase:'BEFORE_CHARACTER_BASELINE',accountId:id,minted:true,linkedPublicWallet:PLAYER,realMintOrWalletProof:false});}
      }
      if(req.method==='POST'&&req.url==='/v1/character'&&reply.statusCode<400&&body.id){
        const id=req.user?.sub;ensure(actors.has(id)&&!characters.has(body.id),'Character must belong to the newly created fixture guest');
        await db.query('UPDATE characters SET respect=$3,minted=true,energy=100,nerve=20,health=100,cash=100000,loc=$4 WHERE id=$1 AND account_id=$2 AND alive',[body.id,id,PACING.LEVEL_DIVISOR*24*24,'docks']);characters.add(body.id);
        await log('fixture-assistance.ndjson',{phase:'BEFORE_CHECKOUT_BASELINE',accountId:id,characterId:body.id,level:25,explicitResources:{energy:'100',nerve:'20',health:'100',cash:'100000'},ordinaryProgressionEarned:false});
        await log('states.ndjson',await snapshot('baseline_after_explicit_fixture_assistance'));
      }
      if(req.url==='/v1/deeds/paid/reserve'&&reply.statusCode<400&&typeof body.name==='string')names.add(body.name);
      const selected=/^\/v1\/(deeds(?:\/|$)|session$|character$|me$)/.test(req.url);
      await log('http.ndjson',{method:req.method,path:req.url.split('?')[0],status:reply.statusCode,responseSha256:sha(raw),bytes:raw.length,
        ...(req.url.startsWith('/v1/auth/')?{authBodyOmitted:true}:selected?{response:body}:{responseBodyOmitted:true})});
      if(req.url==='/v1/deeds/paid/reserve'&&reply.statusCode<400)await log('states.ndjson',await snapshot('after_paid_reservation_no_ownership'));
      return payload;
    });
    app.get('/__fixture',async(_req,reply)=>reply.type('text/html').send('<!doctype html><title>LOCAL TEST — Omertà deed entry</title><h1>Owned local test only</h1><p>Fresh guest and character creation use the real app. Eligibility, minted status and linked PUBLIC test wallet are fixture-assisted before the checkout baseline. No real player, wallet, money, deployment or release.</p><a href="/">Open the actual application</a><p>Finite test wallet controls:</p><button data-mode="normal">Normal test wallet</button> <button data-mode="reject_next">Reject next request</button> <button data-mode="unknown_after_send">Lose next submission result</button><p id="status"></p><script>document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=async()=>{const r=await fetch("/__fixture/scenario",{method:"POST",headers:{"content-type":"application/json","x-local-fixture":'+JSON.stringify(capability)+'},body:JSON.stringify({mode:b.dataset.mode})});document.getElementById("status").textContent=r.ok?"Test mode set: "+b.dataset.mode:"Test mode refused";});</script>'));
    app.get('/__fixture/wallet.js',async(_req,reply)=>reply.header('cache-control','no-store').type('application/javascript').send(walletScript(capability)));
    app.post('/__fixture/scenario',async req=>{ensure(['normal','reject_next','unknown_after_send'].includes(req.body?.mode),'Unknown finite fixture scenario');scenario=req.body.mode;return {mode:scenario,testOnly:true};});
    app.post('/__fixture/rpc',async(req,reply)=>{
      try{
        ensure(!stopped,'Fixture stopping');await identity();const {method,params=[]}=req.body||{};ensure(Array.isArray(params),'RPC params must be an array');
        if(['eth_requestAccounts','eth_accounts'].includes(method))return {result:[PLAYER]};
        if(method==='eth_chainId')return {result:CHAIN};
        ensure(method==='eth_sendTransaction'&&params.length===1,'Unsupported test wallet RPC');
        const tx=params[0];ensure(tx&&Object.keys(tx).every(k=>['from','to','data','value','chainId'].includes(k)),'Unexpected wallet transaction fields');
        ensure(tx.from?.toLowerCase()===PLAYER&&tx.to?.toLowerCase()===deployment.toLowerCase()&&tx.chainId===CHAIN
          && HEX.test(tx.data)&&['0x05ffca2f','0xe7c68f4f'].includes(tx.data.slice(0,10).toLowerCase())&&/^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(tx.value),'Wallet transaction outside selected local deed claim');
        if(scenario==='reject_next'){scenario='normal';return {error:{code:4001,message:'Synthetic local wallet rejection'}};}
        const unknown=scenario==='unknown_after_send';scenario='normal';
        const hash=await rawRpc('eth_sendTransaction',[tx]),r=await receipt(hash);await log('player-receipts.ndjson',{hash,receipt:r});await sync();
        return unknown?{error:{code:4900,message:'Synthetic unknown outcome after actual local submission'}}:{result:hash};
      }catch{return reply.code(400).send({error:{code:-32602,message:'Owned local fixture refused the wallet request'}});}
    });
    app.post('/__fixture/sync',async()=>({testOnly:true,result:await sync()}));
    app.post('/__fixture/snapshot',async()=>{const state=await snapshot('explicit_snapshot');await log('states.ndjson',state);return state;});
    app.post('/__fixture/stop',async(_req,reply)=>{reply.send({stopping:true,parentOwnsResources:true});setImmediate(()=>stop('ROOT_HTTP_STOP').catch(()=>{process.exitCode=1;}));});
    stage='actual_app_listen';await app.listen({host:'127.0.0.1',port:config.appPort});
    await record('CONTROL.json',{schema:'omerta.local-deed-fixture-control/v1',origin:config.origin,
      stop:{method:'POST',path:'/__fixture/stop',headerName:'x-local-fixture'},capability,
      testOnly:true,parentOwnsResources:true});
    await record('READY.json',{url:config.origin,fixtureEntry:config.origin+'/__fixture',contract:deployment,runtimeHash,chainId:31337,
      controlFile:'CONTROL.json',
      publicPlayer:PLAYER,testOnly:true,fixtureAssistedEligibility:true,actualGuestAndCharacterRoutes:true,realPg:true,pgMem:false,
      automaticCanonicalSyncAfterSuccessfulLocalSend:true,confirmations:0,localSimulatorDeploymentOnly:true,production:false});
    console.log(stringify({phase:'LOCAL_DEED_FIXTURE_READY',url:config.origin,entry:config.origin+'/__fixture'}));
    for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>stop(signal).catch(()=>{process.exitCode=1;}));
  }catch(error){await record('FAILURE.json',safeError(error));await stop('START_OR_RUNTIME_FAILURE');throw Error('Local deed fixture failed; inspect bounded fixture evidence.');}
}

if (process.argv[1] && path.resolve(process.argv[1]) === HERE) {
  try {
    const config=parseLocalDeedFixtureArgs(process.argv.slice(2));
    const retained=await readRetainedDeedFixtureInputs(config);
    ensure(!(await fs.stat(config.output).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;})),'Fresh output directory required');
    if(config.sourcePreflight)console.log(stringify({phase:'SOURCE_PREFLIGHT_ONLY',sevenPins:true,ownershipPacketsParsed:true,serviceConnections:false}));
    else await run(config,retained);
  }catch{console.error('LOCAL_DEED_FIXTURE_REFUSED_OR_FAILED');process.exitCode=1;}
}
