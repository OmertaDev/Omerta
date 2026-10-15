import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { disableModalTracking } from '../tools/walletconnect-privacy.mjs';
import { buildServer } from '../src/server.js';
import { legalReadiness } from '../src/legal.js';
import { preflight } from '../src/preflight.js';
import { digestConfigured } from '../src/dispatch.js';
import { PATH_QUIZ_QUESTIONS } from '../src/path-funnel.js';

const profile = {
  LEGAL_OPERATOR_NAME: 'Test Operator <script>', LEGAL_POSTAL_ADDRESS: '123 Test Street, Example City',
  PRIVACY_CONTACT_EMAIL: 'privacy@example.test', DMCA_AGENT_NAME: 'Test Copyright Agent',
  DMCA_AGENT_EMAIL: 'copyright@example.test', DMCA_AGENT_ADDRESS: '123 Test Street, Example City',
  DMCA_AGENT_PHONE: '+1 202 555 0100', DMCA_AGENT_REGISTERED: 'true', PAYMENT_REFUND_POLICY: 'Requests are assessed under applicable law.',
};
const previous = Object.fromEntries([...Object.keys(profile), 'LEGAL_PROFILE_DEFER'].map(key => [key, process.env[key]]));
const app = await buildServer();
try {
  for (const key of Object.keys(profile)) delete process.env[key];
  assert.equal((await app.inject('/privacy')).statusCode, 503, 'missing operator details cannot publish a pretend policy');
  assert.equal(digestConfigured(), false, 'no postal address means no marketing sends');
  process.env.LEGAL_PROFILE_DEFER = 'on';
  assert.deepEqual(new Set(legalReadiness()), new Set(Object.keys(profile)), 'startup deferral does not make missing operator information ready');
  for (const path of ['/privacy', '/terms', '/dmca']) {
    const page = await app.inject(path);
    assert.equal(page.statusCode, 503, `${path} remains unavailable under startup deferral`);
    assert.equal(page.headers['cache-control'], 'no-store');
    assert(page.body.includes('This policy is not yet available.'));
  }
  assert.equal((await app.inject('/resources')).statusCode, 200);
  assert.equal(digestConfigured(), false, 'startup deferral does not enable marketing without a postal address');
  delete process.env.LEGAL_PROFILE_DEFER;
  Object.assign(process.env, profile);
  assert.deepEqual(legalReadiness(), []);
  for (const path of ['/privacy', '/terms', '/dmca', '/resources']) {
    const page = await app.inject(path);
    assert.equal(page.statusCode, 200, `${path} is public without account access`);
    assert.equal(page.headers['cache-control'], 'no-store', 'updated legal details cannot be cached indefinitely');
    assert(!page.body.includes('Test Operator <script>'), 'operator configuration is escaped');
    assert(page.body.includes('href="/privacy"'), 'legal navigation is available');
  }
  const privacy = (await app.inject('/privacy')).body;
  for (const description of ['IP addresses', 'Wallet addresses', 'Messages', 'Push endpoints', 'Delegated-agent', 'seven days', 'thirty days', 'not stored']) assert(privacy.includes(description));
  delete process.env.DMCA_AGENT_REGISTERED;
  assert.equal((await app.inject('/dmca')).statusCode, 503, 'unverified registration is not presented as registered');
  process.env.DMCA_AGENT_REGISTERED = 'true';
  const production = { ...profile, NODE_ENV: 'production', JWT_SECRET: 'a-real-jwt-secret-value-long-enough',
    MARKET_SEED: 'YqB7#tR2vLx9Kp4Wm6Zn8Cf3Hj5Ds1Ge', MOD_KEY: 'another-real-secret-value-here', SOCIAL_VERIFY_MODE: 'live', TRUST_PROXY: 'on' };
  assert.deepEqual(preflight(production).errors, [], 'complete legal profile permits otherwise valid production config');
  for (const key of Object.keys(profile)) {
    const missing = { ...production }; delete missing[key];
    assert(preflight(missing).errors.some(error => error.includes(key)), `${key} missing blocks production`);
  }
  const before = (await app.pool.query('SELECT COUNT(*) AS n FROM telemetry')).rows[0].n;
  const answers = Object.fromEntries(PATH_QUIZ_QUESTIONS.map(q => [q.id, q.options[0].id]));
  const scored = await app.inject({ method: 'POST', url: '/v1/path-quiz', payload: { event: 'complete', answers } });
  assert.equal(scored.statusCode, 200, 'functional quiz scoring works without tracking/session consent');
  for (const payload of [{ event: 'start' }, { event: 'answer', question: PATH_QUIZ_QUESTIONS[0].id, option: PATH_QUIZ_QUESTIONS[0].options[0].id, step: 1 }, { event: 'share', path: 'gun', channel: 'clipboard' }]) {
    assert.equal((await app.inject({ method: 'POST', url: '/v1/path-quiz', payload })).statusCode, 200);
  }
  const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { birthDate: '1990-01-01' } });
  const headers = { authorization: `Bearer ${guest.json().token}` };
  assert.equal((await app.inject({ method: 'POST', url: '/v1/screens', headers, payload: { screens: ['profile', 'wire'] } })).json().counted, 0);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/broadcast/shared', headers, payload: { kind: 'win' } })).statusCode, 200);
  assert.equal((await app.pool.query('SELECT COUNT(*) AS n FROM telemetry')).rows[0].n, before, 'quiz answers, screen views and shares persist no analytics');
  const quiz = (await app.inject('/path')).body;
  assert(!quiz.includes('sessionStorage'), 'quiz does not create a tracking identifier');
  const vendor = await app.inject('/vendor/walletconnect.js');
  assert.equal(vendor.statusCode, 200);
  const inventory = (await app.inject('/vendor/walletconnect-manifest.json')).json();
  assert(inventory.packages.some(pkg => pkg.name === '@walletconnect/ethereum-provider' && pkg.version === '2.26.0'));
  assert.equal(inventory.analytics, false);
  assert.equal(inventory.mandatoryModalEvents, false);
  let sends = 0;
  const upstream = fs.readFileSync('node_modules/@reown/appkit-controllers/dist/esm/src/controllers/EventsController.js', 'utf8');
  const controllerSource = disableModalTracking(upstream).replace(/^import .*;\r?\n/gm, '').replace(/export const EventsController/, 'const EventsController') + '\nglobalThis.controller = EventsController;';
  const sandbox = { proxy: value => value, sub: () => () => {},
    CoreHelperUtil: { getAnalyticsUrl: () => 'https://pulse.walletconnect.org' },
    FetchUtil: class { post() { sends++; } }, ChainController: { state: {} },
    OptionsController: { state: { features: { analytics: true } } },
    console, navigator: { sendBeacon() { sends++; } }, fetch() { sends++; } };
  vm.runInNewContext(controllerSource, sandbox);
  for (const event of ['INITIALIZE', 'CONNECT_SUCCESS', 'SOCIAL_LOGIN_SUCCESS', 'MODAL_OPEN']) sandbox.controller.sendEvent({ event });
  sandbox.controller.sendWalletImpressionEvent({ walletId: 'test-wallet' });
  sandbox.controller._submitPendingEvents();
  assert.equal(sends, 0, 'even mandatory events and forced analytics cannot submit tracking');
  const client = fs.readFileSync('public/index.html', 'utf8');
  assert(client.includes("import('/vendor/walletconnect.js')"));
  assert(!client.includes('https://esm.sh/'));
  assert(client.includes('telemetryEnabled: false'));
  console.log('legal-security: PASS — configured public policies, strict default and bounded startup deferral, no optional analytics, local vendor inventory');
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  await app.close();
}
