import assert from 'node:assert/strict';

assert(!process.env.DATABASE_URL, 'Memory-only Base observer mount regression');
assert.deepEqual(process.argv.slice(2), []);
Object.assign(process.env, {
  NODE_ENV: 'test', RATE_LIMIT: 'off', SOCIAL_VERIFY_MODE: 'off', INVITE_MODE: 'off',
  CHAIN_ENABLED: 'off', RESOURCE_ECONOMY: 'off',
  JWT_SECRET: 'base-observer-mount-fixture', MARKET_SEED: 'base-observer-mount-fixture',
  MOD_KEY: 'base-observer-mount-fixture-mod',
});
const previousConfig = process.env.BASE_WORK_ESCROW_OBSERVER_CONFIG;
const originalFetch = globalThis.fetch;
let networkAttempts = 0, checks = 0, closedApps = 0;
globalThis.fetch = async () => { networkAttempts++; throw Error('Network denied by Base mount regression'); };
const configurations = [
  undefined, '{', '{}',
  JSON.stringify({ chainId: '8453', address: '0x' + '5'.repeat(40),
    creationTransactionHash: '0x' + '3'.repeat(64), rpcUrl: 'https://unpaid-fixture.invalid/', approved: true }),
];

try {
  const { buildServer } = await import('./server-fixture.js');
  for (const config of configurations) {
    if (config === undefined) delete process.env.BASE_WORK_ESCROW_OBSERVER_CONFIG;
    else process.env.BASE_WORK_ESCROW_OBSERVER_CONFIG = config;
    const app = await buildServer();
    try {
      assert.equal(networkAttempts, 0, 'Unavailable observers perform no startup RPC');
      const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest' });
      assert.equal(guest.statusCode, 200, guest.body);
      const token = guest.json().token;
      for (const [url, error] of [
        ['/v1/company/external-work/base-observation', 'base_work_observation_unavailable'],
        ['/v1/company/external-work/base-outcome', 'base_work_outcome_unavailable'],
      ]) {
        const denied = await app.inject({ method: 'POST', url, payload: {} });
        assert.equal(denied.statusCode, 401, denied.body); checks++;
        const read = await app.inject({ method: 'POST', url, payload: {},
          headers: { authorization: 'Bearer ' + token } });
        assert.equal(read.statusCode, 503, read.body);
        const value = read.json();
        assert.equal(value.error, error);
        assert.equal(value.observationOnly, true);
        assert.equal(value.financialActivation, false);
        assert.equal(value.executableWorkGrant, false);
        assert(!read.body.includes('unpaid-fixture'));
        checks++;
      }
    } finally { await app.close(); closedApps++; }
  }
  assert.equal(checks, 16);
  assert.equal(closedApps, configurations.length);
  assert.equal(networkAttempts, 0);
  console.log('baseworkobserver-mount PASS', JSON.stringify({
    phase: 'ACTUAL_SERVER_MOUNT_DEFAULT_CLOSED_MEMORY_ONLY', checks,
    configurations: configurations.length, closedApps, networkAttempts,
    actualDatabase: false, realTransactions: 0, financialActivation: false,
    executableWorkGrant: false,
  }));
} finally {
  if (previousConfig === undefined) delete process.env.BASE_WORK_ESCROW_OBSERVER_CONFIG;
  else process.env.BASE_WORK_ESCROW_OBSERVER_CONFIG = previousConfig;
  globalThis.fetch = originalFetch;
}
