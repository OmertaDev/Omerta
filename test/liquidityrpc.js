import assert from 'node:assert/strict';
import http from 'node:http';
import { toFunctionSelector } from 'viem';
import { makeLiquidityKeeperClients } from '../src/liquiditykeeper.js';
let failed = 0, succeeded = 0;
let secondAvailable=true,secondChain='0x1237';
const methods=[];
const first = http.createServer((_req, res) => { failed++; res.writeHead(503); res.end('unavailable'); });
const second = http.createServer((req, res) => {
  let data = '';
  req.on('data', (value) => { data += value; });
  req.on('end', () => {
    const input = JSON.parse(data);
    methods.push(input.method);
    if(!secondAvailable){res.writeHead(503);res.end('unavailable');return;}
    succeeded++;
    let result;
    if(input.method==='eth_chainId')result=secondChain;
    else if(input.method==='eth_blockNumber')result='0x64';
    else if(input.method==='eth_getLogs')result=[];
    else if(input.method==='eth_call')result='0x'+(input.params[0].data===toFunctionSelector('vigBps()')?6000n:10000n).toString(16).padStart(64,'0');
    else assert.fail(`unexpected read method ${input.method}`);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', id: input.id, result }));
  });
});
const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
try {
  await Promise.all([listen(first), listen(second)]);
  const rpcUrls = [first, second].map((server) => `http://127.0.0.1:${server.address().port}`);
  const clients = makeLiquidityKeeperClients({ manifest: { chainId: 4663 }, rpcUrl: rpcUrls[0], rpcUrls });
  assert.equal(await clients.publicClient.getChainId(), 4663);
  assert.equal(failed, 1);
  assert.equal(succeeded, 1);
  assert.equal(clients.walletClient, undefined);
  console.log('PASS failed primary RPC falls back to the next endpoint without creating a signer');
  process.env.CHAIN_ID='4663';process.env.CHAIN_RPC_URL=rpcUrls[0];
  process.env.OMERTA_FEES_ADDRESS='0x1111111111111111111111111111111111111111';
  const {makeViemSource}=await import('../src/watcher.js');
  const {assertChainId}=await import('../src/chain.js');
  assert.equal(await assertChainId({publicClient:clients.publicClient}),4663);
  const source=await makeViemSource({publicClient:clients.publicClient});
  assert.equal(await source.head(),100n);assert.deepEqual(await source.feeLogs(0,100),[]);
  assert.equal(methods.filter(method=>method==='eth_getLogs').length,3);
  console.log('PASS read-only watcher constructor and chain probe share fallback for fee inflow reads');
  secondAvailable=false;await assert.rejects(()=>assertChainId({publicClient:clients.publicClient}));
  secondAvailable=true;secondChain='0x1';await assert.rejects(()=>assertChainId({publicClient:clients.publicClient}),/CHAIN_ID mismatch/);
  secondChain='0x1237';assert.equal(await assertChainId({publicClient:clients.publicClient}),4663);
  console.log('PASS repeated chain probes refuse outage/wrong chain and recover on the next healthy probe');
} finally {
  await Promise.all([first, second].map((server) => new Promise((resolve) => server.close(resolve))));
}
