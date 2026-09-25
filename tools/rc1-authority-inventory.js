// Mounted mutation inventory, source pointers, and unauthenticated denial probes.
// This discovers review obligations; it does not turn a route census into RC1-04 clearance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parse } from 'acorn';

assert(!process.env.DATABASE_URL, 'Authority inventory uses only a disposable in-memory database');
const output = path.resolve(process.argv.find((arg) => arg.startsWith('--out='))?.slice(6)
  || 'output/rc1-authority-inventory.json');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const sources = new Map();
const read = (file) => {
  if (!sources.has(file)) sources.set(file, fs.readFileSync(file, 'utf8'));
  return sources.get(file);
};
const reference = (file, needle) => {
  const text = read(file), offset = text.indexOf(needle);
  assert(offset >= 0, `Update missing source reference: ${file}: ${needle}`);
  return { file, line: text.slice(0, offset).split('\n').length, symbol: needle };
};
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc') continue;
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
}
const ast = (file) => parse(read(file), { ecmaVersion: 'latest', sourceType: 'module', locations: true });
const methods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const sourceRoutes = new Map();
const routeFiles = ['src/server.js', ...fs.readdirSync('src/routes').filter((name) => name.endsWith('.js')).map((name) => `src/routes/${name}`)];
for (const file of routeFiles) walk(ast(file), (node) => {
  if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression' || node.callee.computed) return;
  const method = node.callee.property.name?.toUpperCase(), url = node.arguments[0]?.value;
  if (node.callee.object.name !== 'app' || !methods.has(method) || typeof url !== 'string') return;
  const calls = new Set();
  walk(node.arguments.at(-1), (child) => {
    if (child.type === 'CallExpression') calls.add(read(file).slice(child.callee.start, child.callee.end));
  });
  const key = `${method} ${url}`, entries = sourceRoutes.get(key) || [];
  entries.push({ file, line: node.loc.start.line, endLine: node.loc.end.line,
    handlerCalls: [...calls].filter((call) => call.length < 100).slice(0, 20),
    handlerCallCount: calls.size });
  sourceRoutes.set(key, entries);
});

// Dispatch inventory comes from the executable comparisons and the domain's
// explicit action field table, not only commands visible to a fixture player.
const commandFile = 'src/player-commands.js', dispatch = new Map();
walk(ast(commandFile), (node) => {
  if (node.type === 'IfStatement' && node.test.type === 'BinaryExpression' && node.test.operator === '==='
    && node.test.left.name === 'type' && typeof node.test.right.value === 'string') {
    dispatch.set(node.test.right.value, { file: commandFile, line: node.loc.start.line, endLine: node.loc.end.line });
  }
});
walk(ast('src/coordination/operations.js'), (node) => {
  if (node.type === 'VariableDeclarator' && node.id.name === 'fields' && node.init?.type === 'ObjectExpression'
    && node.init.properties.some((entry) => entry.key.name === 'contribute')) {
    for (const property of node.init.properties) dispatch.set(`operation.${property.key.name}`, {
      file: 'src/coordination/operations.js', line: property.loc.start.line,
      endLine: property.loc.end.line, fields: property.value.elements.map((entry) => entry.value) });
  }
});
assert(dispatch.size >= 20, 'Command dispatcher inventory unexpectedly shrank');

const domains = {
  mystery: {
    functions: ['startMystery(', 'discoverNode(', 'completeNode(', 'commitChoice('], file: 'src/mysteries.js',
    authority: ['async function authorizeOwner(', 'async function actorOf('],
    accounting: ['withItemMutation(', 'MYSTERY_EFFECT_ADAPTERS'],
    note: 'Graph/node conditions, choice exclusions, and effects require branch review; do not invent a cash reward for nonmonetary progression.',
    tests: ['test/player-commands.js', 'test/player-command-api.js', 'test/mysteries.js', 'test/rc1-command-redteam.js'],
  },
  discovery: {
    functions: ['async create(', 'async act('], file: 'src/coordination/runtime.js',
    authority: ['async function admissionFor(', 'async function command('],
    accounting: ['const fingerprint = hash(', 'INSERT INTO coordination_commands'],
    note: 'Graph content hash, instance revision, authorized actions and Knowledge must be reviewed per graph/effect.',
    tests: ['test/coordination.js', 'test/coordination-api.js', 'test/player-commands.js'],
  },
  knowledge: {
    functions: ['shareKnowledgeWithGroup(', 'revokeKnowledge('], file: 'src/coordination/runtime.js',
    authority: ['async function command('], accounting: ['INSERT INTO coordination_commands'],
    note: 'Live membership and ACL revision belong to canonical Knowledge authority; sharing does not imply permission to mutate hidden world facts.',
    tests: ['test/coordination-knowledge-runtime.js', 'test/coordination-knowledge-api.js', 'test/player-commands.js'],
  },
  operation: {
    functions: ['async create(', 'async command('], file: 'src/coordination/operations.js',
    authority: ['async function authority(', 'async function readiness('],
    accounting: ['depositCapital(', 'refundCapital(', 'settleCapital(', 'consumeStack(', 'const logicalKey ='],
    note: 'Role/participant union, materials, cash capital, custody and terminal disposition must be reviewed per operation/action.',
    tests: ['test/family-operations.js', 'test/family-operations-api.js', 'test/family-operation-concurrency.js', 'test/player-commands.js'],
  },
  recipe: {
    functions: ['export async function craftWorldGraphRecipe('], file: 'src/crafting.js',
    authority: ['await resolveRecipeAuthority(', 'assertRequirements(recipe, actor)'],
    accounting: ['const cash = await debitRecipeCash(', 'const inputs = await consumeRecipeInputs(', 'const outputs = await produceRecipeOutputs('],
    note: 'Authoritative recipe sets cash, material and output quantities; recipe scarcity and definition-specific branches remain individual review obligations.',
    tests: ['test/crafting.js', 'test/recipe-policy.js', 'test/player-commands.js'],
  },
  item: {
    functions: ['export async function salvageCar('], file: 'src/crafting.js',
    authority: ['const car = await consumeOwnedCarForItemMutation(', 'assertRequirements(recipe, actor, { selectedCarId: carId'],
    accounting: ['const cash = await debitRecipeCash(', 'const outputs = await produceRecipeOutputs('],
    note: 'The selected owned car is consumed once; escrow/listing/pledge/chain/racing exclusions and per-recipe output branches need individual review.',
    tests: ['test/crafting.js', 'test/player-commands.js'],
  },
  world: {
    functions: ['async function applyCommand('], file: 'src/world-kernel.js',
    authority: ['if (!allowed(accountId) || !action)', 'if (Number(row.revision) !== input.expectedRevision'],
    accounting: ['for (const material of action.materials)', 'await consumeItem(', 'INSERT INTO world_kernel_events'],
    note: 'Object/action definition fixes material/item cost and resulting state; known object, actor location, ownership and operation proof are rechecked.',
    tests: ['test/world-kernel.js', 'test/world-kernel-api.js', 'test/player-commands.js'],
  },
  situation: {
    functions: ['async function command('], file: 'src/director/runtime.js',
    authority: ['async function validateAction(', 'async function actor('],
    accounting: ['INSERT INTO director_action_intents', 'const committed = await receipt('],
    note: 'An authorized situation delegates to existing operation/discovery/mystery domain authority and receipt; no independent reward authority.',
    tests: ['test/director-commands.js', 'test/director-security.js', 'test/director-network-recovery.js'],
  },
};
const commandFamilies = Object.entries(domains).map(([family, spec]) => ({ family,
  reviewStatus: 'MISSING_COMPLETE_BRANCH_ROLE_REVIEW',
  commands: [...dispatch].filter(([type]) => type.startsWith(`${family}.`)).map(([type, source]) => ({ type, source })),
  authoritativeFunctions: spec.functions.map((needle) => reference(spec.file, needle)),
  prerequisitesParticipantsTargets: spec.authority.map((needle) => reference(spec.file, needle)),
  costsEffectsRewardsAndReplay: spec.accounting.map((needle) => reference(spec.file, needle)),
  note: spec.note, tests: spec.tests.map((file) => ({ file, mapping: 'REVIEW_CANDIDATE_NOT_EXECUTION_PROOF' })) }));
assert.equal(commandFamilies.flatMap((entry) => entry.commands).length, dispatch.size, 'Every dispatch type needs a family mapping');

const testFiles = git('ls-files', 'test/*.js').split('\n').filter(Boolean);
const routeTestRefs = new Map();
for (const file of testFiles) {
  const text = fs.readFileSync(file, 'utf8');
  for (const key of sourceRoutes.keys()) {
    const url = key.slice(key.indexOf(' ') + 1), offset = text.indexOf(url);
    if (offset >= 0) {
      const entries = routeTestRefs.get(key) || [];
      if (entries.length < 5) entries.push({ file, line: text.slice(0, offset).split('\n').length,
        mapping: 'TEXT_REFERENCE_REQUIRES_REVIEW' });
      routeTestRefs.set(key, entries);
    }
  }
}

for (const flag of ['CORE_PROGRESSION', 'WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE', 'COORDINATION_KNOWLEDGE',
  'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS']) process.env[flag] = 'on';
Object.assign(process.env, { INVITE_MODE: 'off', RATE_LIMIT: 'off', POPULATION_OFF: 'on', SOCIAL_VERIFY_MODE: 'off',
  LIVING_WORLD_DIRECTOR: 'LIVE', COORDINATION_ACCOUNT_IDS: '', DIRECTOR_ACCOUNT_IDS: '', MOD_KEY: crypto.randomBytes(32).toString('hex') });
delete process.env.RWA_REVIEWER_KEY; delete process.env.RWA_REVIEWER_ID;
const { buildServer } = await import('../src/server.js');
const app = await buildServer();
const routes = [];
try {
  for (const mounted of app.routes.filter((entry) => methods.has(entry.method)).sort((a, b) => `${a.method} ${a.url}`.localeCompare(`${b.method} ${b.url}`))) {
    const key = `${mounted.method} ${mounted.url}`;
    let denial = { state: 'NOT_RUN_PUBLIC_MUTATION', statusCode: null,
      reason: 'A public mutation cannot be classified as an authorization denial; requires purpose and abuse-boundary review.' };
    if (mounted.hasAuth) {
      const response = await app.inject({ method: mounted.method,
        url: mounted.url.replace(/:[A-Za-z_][A-Za-z_0-9]*/g, 'rc1-untrusted').replace(/\*/g, 'rc1-untrusted'), payload: {} });
      let errorCode = null;
      try { errorCode = response.json()?.error; } catch { /* non-JSON refusal remains hashed */ }
      const reviewerDisabled = mounted.authKind === 'rwaReviewerAuth' && response.statusCode === 503 && errorCode === 'rwa_reviewer_disabled';
      denial = { state: [401, 403].includes(response.statusCode) ? 'OBSERVED_AUTH_DENIAL'
        : reviewerDisabled ? 'OBSERVED_DISABLED_RAIL_AUTH_NOT_PROVEN'
        : response.statusCode >= 400 && response.statusCode < 500 ? 'OBSERVED_REJECTION_AUTH_NOT_PROVEN'
          : 'UNEXPECTED_RESPONSE_REQUIRES_REVIEW', statusCode: response.statusCode,
      ...(reviewerDisabled ? { disabledGuard: reference('src/routes/rwa.js', "if (!configured.enabled) return reply.code(503)") } : {}),
      responseSha256: digest(response.body), scope: 'One unauthenticated empty-payload request to synthetic IDs in pg-mem; no role/IDOR/economic proof.' };
    }
    routes.push({ id: key, mountedAuth: { authKind: mounted.authKind, hasAuth: mounted.hasAuth },
      sources: sourceRoutes.get(key) || [], sourceMapping: sourceRoutes.has(key) ? 'LOCATED' : 'MISSING_SOURCE_MAPPING',
      authoritativeMutationReview: 'MISSING_REVIEW', semantics: 'Trace costs/prerequisites/participants/targets/effects/rewards/receipt identity from source handler and callees.',
      denial, testReferences: routeTestRefs.get(key) || [], coverage: 'MISSING_COMPLETE_ROLE_AND_BRANCH_TEST_MAPPING' });
  }
  const report = { schemaVersion: 1, gate: 'RC1-04', owner: 'Codex/source_repairs',
    status: 'MISSING_REVIEW', generatedAt: new Date().toISOString(), sourceRevision: git('rev-parse', 'HEAD'),
    exitCodeMeaning: 'Zero means the census and bounded anonymous probes completed; MISSING_REVIEW never qualifies the authority gate.',
    sourceTree: git('rev-parse', 'HEAD^{tree}'), toolSha256: digest(fs.readFileSync(new URL(import.meta.url))),
    changedRuntimePaths: git('diff', '--name-only', 'HEAD', '--', 'src', 'schema.sql', 'public', 'package.json', 'package-lock.json').split('\n').filter(Boolean),
    runtime: { node: process.version, database: 'pg-mem', flags: 'Core/world/coordination/knowledge/operations on; LIVE director; invitations/rate limiting off; no cohort account filter; RWA reviewer unconfigured' },
    scope: 'All mounted POST/PUT/PATCH/DELETE registrations, including legacy/admin/public/passive routes. Classification as an authoritative effect is intentionally pending per route. GET side effects, websocket messages, workers and external callbacks beyond mounted routes require separate review.',
    summary: { mutationRoutes: routes.length, sourceMapped: routes.filter((route) => route.sources.length).length,
      authDenied: routes.filter((route) => route.denial.state === 'OBSERVED_AUTH_DENIAL').length,
      otherRejections: routes.filter((route) => route.denial.state === 'OBSERVED_REJECTION_AUTH_NOT_PROVEN').length,
      disabledRail: routes.filter((route) => route.denial.state === 'OBSERVED_DISABLED_RAIL_AUTH_NOT_PROVEN').length,
      publicNotProbed: routes.filter((route) => route.denial.state === 'NOT_RUN_PUBLIC_MUTATION').length,
      unexpected: routes.filter((route) => route.denial.state === 'UNEXPECTED_RESPONSE_REQUIRES_REVIEW').length,
      commandFamilies: commandFamilies.length, dispatchedCommandTypes: dispatch.size },
    commonCommandBoundary: { input: reference(commandFile, 'async function execute('),
      authority: reference(commandFile, 'await admit(accountId, issued.character_id)'),
      expiryAndChangedWorld: reference(commandFile, 'if (new Date(issued.expires_at)'),
      identity: reference(commandFile, 'const domainKey ='), receipt: reference(commandFile, 'async function receipt('),
      denialMapping: reference('src/routes/commands.js', 'function safeError('),
      denialCodes: [400, 401, 403, 409, 503, 500],
      note: '403 can originate in the account-auth preHandler; 500 is unexpected failure, never an authorization pass.' },
    requiredReviewAxes: ['cost', 'prerequisites', 'participants', 'target', 'effect', 'reward', 'idempotency identity', 'denial state unchanged',
      'sequential/concurrent duplicate', 'lost response', 'restart replay', 'expiry', 'changed world', 'unauthenticated/new/ordinary',
      'Crew member/leader', 'Family member/leadership', 'participant/nonparticipant', 'ally/enemy', 'partial/stale/revoked Knowledge'],
    sourceFiles: [...sources].map(([file, text]) => ({ file, sha256: digest(text) })),
    commandFamilies, presentationOnlyCommands: [{ type: 'mystery.inspect', reason: 'Rendered unavailable inspection card; no dispatch branch.' }],
    staticDeclarationsNotMounted: [...sourceRoutes].filter(([id]) => !routes.some((entry) => entry.id === id)).map(([id, sources]) => ({
      id, sources, status: 'NOT_MOUNTED_IN_RECORDED_CONFIGURATION_REQUIRES_REVIEW' })), routes };
  fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output, status: report.status, ...report.summary }));
  assert.equal(report.summary.unexpected, 0, 'Unexpected unauthenticated response retained for review');
  assert.equal(report.summary.sourceMapped, routes.length, 'Mounted mutation routes need explicit source mappings');
} finally { await app.close(); await app.pool.end(); }
