import { deedAllocationHistoricalInput } from '../tools/deed-allocation-source-transfer.js';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { uxAfterwordHistoricalInput } from '../tools/ux-afterword-source-compatibility.js';
import {
  ECONOMY_HARDENING_SOURCE_REVISION, ECONOMY_HARDENING_SOURCE_TREE,
  ECONOMY_HARDENING_SOURCE_PREDECESSOR, ECONOMY_HARDENING_SOURCE_PREDECESSOR_TREE,
  ECONOMY_HARDENING_SOURCE_PHASE, ECONOMY_HARDENING_SOURCE_DOMAINS, ECONOMY_HARDENING_BINDING_DOMAINS,
  ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION, ECONOMY_HARDENING_BINDING_SUCCESSOR_TREE,
  ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR, ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR_TREE,
  ECONOMY_HARDENING_BINDING_SUCCESSOR_PHASE, ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS,
  ECONOMY_HARDENING_REPAIR_REVISION, ECONOMY_HARDENING_REPAIR_TREE,
  ECONOMY_HARDENING_REPAIR_PREDECESSOR, ECONOMY_HARDENING_REPAIR_PREDECESSOR_TREE,
  ECONOMY_HARDENING_REPAIR_PHASE, ECONOMY_HARDENING_REPAIR_DOMAINS,
  ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION, ECONOMY_HARDENING_REPAIR_SUCCESSOR_TREE,
  ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR, ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR_TREE,
  ECONOMY_HARDENING_REPAIR_SUCCESSOR_PHASE, ECONOMY_HARDENING_REPAIR_SUCCESSOR_DOMAINS,
  ECONOMY_HARDENING_RELEASE_REPAIR_REVISION, ECONOMY_HARDENING_RELEASE_REPAIR_TREE,
  ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR, ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR_TREE,
  ECONOMY_HARDENING_RELEASE_REPAIR_PHASE, ECONOMY_HARDENING_RELEASE_REPAIR_DOMAINS,
  ECONOMY_HARDENING_DIRECTOR_FIXTURE_REVISION, ECONOMY_HARDENING_DIRECTOR_FIXTURE_TREE,
  ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR, ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR_TREE,
  ECONOMY_HARDENING_DIRECTOR_FIXTURE_PHASE, ECONOMY_HARDENING_DIRECTOR_FIXTURE_DOMAINS,
  ECONOMY_HARDENING_PHASE2_TIMEOUT_REVISION, ECONOMY_HARDENING_PHASE2_TIMEOUT_TREE,
  ECONOMY_HARDENING_PHASE2_TIMEOUT_PREDECESSOR, ECONOMY_HARDENING_PHASE2_TIMEOUT_PREDECESSOR_TREE,
  ECONOMY_HARDENING_PHASE2_TIMEOUT_PHASE, ECONOMY_HARDENING_PHASE2_TIMEOUT_DOMAINS,
  ECONOMY_HARDENING_GROWTH_DETERMINISM_REVISION, ECONOMY_HARDENING_GROWTH_DETERMINISM_TREE,
  ECONOMY_HARDENING_GROWTH_DETERMINISM_PREDECESSOR, ECONOMY_HARDENING_GROWTH_DETERMINISM_PREDECESSOR_TREE,
  ECONOMY_HARDENING_GROWTH_DETERMINISM_PHASE, ECONOMY_HARDENING_GROWTH_DETERMINISM_DOMAINS,
  ECONOMY_HARDENING_CAMPAIGN_EXPIRY_REVISION, ECONOMY_HARDENING_CAMPAIGN_EXPIRY_TREE,
  ECONOMY_HARDENING_CAMPAIGN_EXPIRY_PREDECESSOR, ECONOMY_HARDENING_CAMPAIGN_EXPIRY_PREDECESSOR_TREE,
  ECONOMY_HARDENING_CAMPAIGN_EXPIRY_PHASE, ECONOMY_HARDENING_CAMPAIGN_EXPIRY_DOMAINS,
  ECONOMY_HARDENING_COMMERCE_ADMISSION_REVISION, ECONOMY_HARDENING_COMMERCE_ADMISSION_TREE,
  ECONOMY_HARDENING_COMMERCE_ADMISSION_PREDECESSOR, ECONOMY_HARDENING_COMMERCE_ADMISSION_PREDECESSOR_TREE,
  ECONOMY_HARDENING_COMMERCE_ADMISSION_PHASE, ECONOMY_HARDENING_COMMERCE_ADMISSION_DOMAINS,
  assertEconomyHardeningSourceTransfer, assertEconomyHardeningBindingTransfer,
  assertEconomyHardeningBindingSuccessorTransfer, assertEconomyHardeningRepairTransfer,
  assertEconomyHardeningRepairSuccessorTransfer, assertEconomyHardeningReleaseRepairTransfer,
  assertEconomyHardeningDirectorFixtureTransfer, assertEconomyHardeningPhase2TimeoutTransfer,
  assertEconomyHardeningGrowthDeterminismTransfer, assertEconomyHardeningCampaignExpiryTransfer,
  assertEconomyHardeningCommerceAdmissionTransfer,
  economyHardeningSourceBaseline,
} from '../tools/economy-hardening-source-transfer.js';
import { ECONOMY_READINESS_MERGE_SOURCE, economyHardeningMergeHistoricalInput,
  qualifyEconomyHardeningSuccessorSource } from '../tools/economy-readiness-merge-source-compatibility.js';
import {
  ECONOMY_RELEASE_TAIL_REVISION, ECONOMY_RELEASE_TAIL_TREE,
  ECONOMY_RELEASE_TAIL_PREDECESSOR, ECONOMY_RELEASE_TAIL_PREDECESSOR_TREE,
  ECONOMY_RELEASE_TAIL_PHASE, ECONOMY_RELEASE_TAIL_DOMAINS,
  assertEconomyReleaseTailTransfer,
} from '../tools/economy-release-tail-source-transfer.js';
import { ECONOMY_UX_MERGE_SOURCE,
  economyUxMergeCandidateHistoricalInput,
  economyUxMergeMainHistoricalInput } from '../tools/economy-ux-merge-source-compatibility.js';
import {
  ECONOMY_BANK_INTEREST_HARDENING_REVISION, ECONOMY_BANK_INTEREST_HARDENING_TREE,
  ECONOMY_BANK_INTEREST_HARDENING_PREDECESSOR, ECONOMY_BANK_INTEREST_HARDENING_PREDECESSOR_TREE,
  ECONOMY_BANK_INTEREST_HARDENING_PHASE, ECONOMY_BANK_INTEREST_HARDENING_DOMAINS,
  assertEconomyBankInterestHardeningSourceTransfer, economyBankInterestHardeningHistoricalInput,
} from '../tools/economy-bank-interest-source-transfer.js';
import {
  ECONOMY_SOCIAL_PROOF_CUTOVER_REVISION, ECONOMY_SOCIAL_PROOF_CUTOVER_TREE,
  ECONOMY_SOCIAL_PROOF_CUTOVER_PREDECESSOR, ECONOMY_SOCIAL_PROOF_CUTOVER_PREDECESSOR_TREE,
  ECONOMY_SOCIAL_PROOF_CUTOVER_PHASE, ECONOMY_SOCIAL_PROOF_CUTOVER_DOMAINS,
  assertEconomySocialProofCutoverSourceTransfer, economySocialProofCutoverHistoricalInput,
} from '../tools/economy-social-proof-cutover-source-transfer.js';
import {
  ECONOMY_SOCIAL_RECEIPT_SAFETY_REVISION, ECONOMY_SOCIAL_RECEIPT_SAFETY_TREE,
  ECONOMY_SOCIAL_RECEIPT_SAFETY_PREDECESSOR, ECONOMY_SOCIAL_RECEIPT_SAFETY_PREDECESSOR_TREE,
  ECONOMY_SOCIAL_RECEIPT_SAFETY_PHASE, ECONOMY_SOCIAL_RECEIPT_SAFETY_DOMAINS,
  assertEconomySocialReceiptSafetySourceTransfer, economySocialReceiptSafetyHistoricalInput,
} from '../tools/economy-social-proof-receipt-safety-source-transfer.js';
import {
  ECONOMY_SOCIAL_RECEIPT_REVISION, ECONOMY_SOCIAL_RECEIPT_TREE,
  ECONOMY_SOCIAL_RECEIPT_PREDECESSOR, ECONOMY_SOCIAL_RECEIPT_PREDECESSOR_TREE,
  ECONOMY_SOCIAL_RECEIPT_PHASE, ECONOMY_SOCIAL_RECEIPT_DOMAINS,
  assertEconomySocialReceiptSourceTransfer, economySocialReceiptHistoricalInput,
} from '../tools/economy-social-proof-receipt-source-transfer.js';

const expectedRevision = 'aaab91ff6bec4c8a0ec53e0ef88682b317a7a182';
const expectedPredecessor = '9f39df80598d38507c9f6b4ea2414312eb8e7700';
const files = [
  '.github/workflows/ci.yml',
  'public/index.html', 'schema.sql', 'src/accrual.js', 'src/agentreferrals.js', 'src/auth.js', 'src/boxing.js', 'src/db.js',
  'src/economy.js', 'src/explore.js', 'src/game.js', 'src/goodsquote.js', 'src/invariants.js', 'src/kitchen.js', 'src/market.js',
  'src/routes/gateway.js', 'src/routes/rwa.js', 'src/rules.tail.js', 'src/server.js',
  'src/pen.js', 'src/population.js', 'src/preflight.js', 'src/races.js', 'src/social/estate.js', 'src/stable.js',
  'test/gates.js', 'test/growth.js', 'test/phase2-postgres.js', 'test/rc1-native-world-workload.js',
  'tools/arena.js', 'tools/commerce-deed-release-phase2-native-catalog.js',
  'test/commerce-release-phase2-migration-catalog.js',
  'test/continuous-city-source-compatibility.js', 'test/enterprise-release-phase2-migration-catalog.js',
  'test/lib/rc1-historical-source-fixture.js',
  'tools/commerce-current-enterprise-source-compatibility.js',
  'tools/deed-quest-source-transfer.js', 'tools/enterprise-deed-release-phase2-migration-catalog.js',
  'tools/player-intel-source-compatibility.js', 'tools/rc1-company-operator-source-compatibility.js',
  'tools/rc1-deed-source-compatibility.js', 'tools/rc1-invoice-source-compatibility.js',
  'tools/rc1-npc-cargo-journal.js', 'tools/rc1-player-car-provenance.js',
  'tools/rc1-world-market-resources.js', 'tools/rc1-world-qualification.js', 'tools/rc1-world-resource-observer.js',
];
const bindingFiles = [
  'package.json', 'test/lib/rc1-historical-source-fixture.js',
];
const successorFiles = ['test/lib/rc1-historical-source-fixture.js'];
const repairFiles = [
  'tools/commerce-deed-release-phase2-native-catalog.js',
  'src/game.js', 'src/growth.js', 'src/verify.js',
  'test/growth.js', 'test/hardening.js', 'test/sweeps.js',
];
const repairSuccessorFiles = [
  'schema.sql',
  'src/db.js', 'src/growth.js', 'src/rules.tail.js', 'src/server.js', 'src/socialproof.js', 'src/verify.js', 'src/wire.js',
  'test/growth.js', 'test/sweeps.js',
];
const releaseRepairFiles = [
  'schema.sql',
  'tools/commerce-deed-release-phase2-native-catalog.js',
  'tools/pgcheck.js',
];
const directorFixtureFiles = ['test/director-migration.js'];
const phase2TimeoutFiles = ['test/phase2-postgres.js'];
const growthDeterminismFiles = ['test/growth.js'];
const campaignExpiryFiles = ['src/commercialcampaigns.js', 'test/commercialcampaigns-integration.js', 'test/hardening.js'];
const commerceAdmissionFiles = ['tools/commerce-source-compatibility.js'];
const releaseTailFiles = [
  'src/growth.js', 'test/gates.js', 'test/lib/rc1-historical-source-fixture.js', 'tools/pgquery.js',
  'src/managementteamautonomy.js', 'test/managementteams-retry-integration.js',
];
const bankInterestHardeningFiles = ['src/accrual.js', 'test/economy-balance.js'];
const socialProofCutoverFiles = [
  '.github/workflows/economy-hardening.yml',
  'BALANCE.md',
  'docs/WIKI.md',
  'package-lock.json',
  'package.json',
  'public/wiki.html',
  'render.yaml',
  'schema.sql',
  'src/db.js',
  'src/growth.js',
  'src/rules.tail.js',
  'src/verify.js',
  'test/city-home-migration.js',
  'test/db-boot-lock-postgres.js',
  'test/gates.js',
  'test/growth.js',
  'test/levers.js',
  'test/migrate.js',
  'test/social-receipt-postgres.js',
  'test/worldgraph-api.js',
  'tools/pgquery.js',
  'tools/ux-release-phase2-native-catalog.js',
];
const socialProofCutoverAdditions = new Set([
  'test/db-boot-lock-postgres.js', 'test/social-receipt-postgres.js',
]);
const socialReceiptSafetyFiles = [
  'schema.sql',
  'src/accountdaily.js', 'src/db.js', 'src/growth.js',
  'test/gates.js', 'test/growth.js', 'test/sweeps.js',
  'tools/commerce-deed-release-phase2-native-catalog.js',
  'tools/economy-social-proof-receipt-source-transfer.js',
  'tools/generate-economy-social-proof-receipt-source-transfer.js',
];
const socialReceiptFiles = ['src/db.js', 'src/growth.js', 'test/growth.js', 'test/sweeps.js'];
const lf = text => text.replaceAll('\r\n', '\n');
const deedAllocationPhysicalSource = file => deedAllocationHistoricalInput(file, fs.readFileSync(file, 'utf8'));
const physicalCandidateSource = file => lf(economyUxMergeCandidateHistoricalInput(
  file, uxAfterwordHistoricalInput(file, deedAllocationPhysicalSource(file))));
const git = (...args) => lf(execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'] }));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const inverseHunks = (file, base = expectedPredecessor, tip = expectedRevision) => {
  const inverses = []; let hunk = null;
  const args = ['diff', '--no-ext-diff', '--unified=3', base]; if (tip) args.push(tip); args.push('--', file);
  for (const line of git(...args).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; inverses.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
    }
  }
  return inverses;
};

assert.equal(ECONOMY_HARDENING_SOURCE_REVISION, expectedRevision);
assert.equal(ECONOMY_HARDENING_SOURCE_PREDECESSOR, expectedPredecessor);
execFileSync('git', ['merge-base', '--is-ancestor', expectedPredecessor, expectedRevision]);
assert.equal(git('rev-parse', `${expectedRevision}^{tree}`).trim(), ECONOMY_HARDENING_SOURCE_TREE);
assert.equal(git('rev-parse', `${expectedPredecessor}^{tree}`).trim(), ECONOMY_HARDENING_SOURCE_PREDECESSOR_TREE);
assert.match(ECONOMY_HARDENING_SOURCE_PHASE, /exact-source-transfer-only/);
assert.equal(ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION, '66b4c6008e6b9c192ae20006c59bc591be82a27a');
assert.equal(ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR, 'c94bb20cf84de303a34730f4723cff17192d6923');
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR,
  ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION, 'HEAD']);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION}^{tree}`).trim(),
  ECONOMY_HARDENING_BINDING_SUCCESSOR_TREE);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR}^{tree}`).trim(),
  ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR_TREE);
assert.match(ECONOMY_HARDENING_BINDING_SUCCESSOR_PHASE, /exact-authored-binding-successor-source-transfer-only/);
assert.equal(ECONOMY_HARDENING_REPAIR_REVISION, 'a477313e15ae0eaaa5fd120a9375ac92bf369128');
assert.equal(ECONOMY_HARDENING_REPAIR_PREDECESSOR, '8e9b7408faceb6d6d69badff386c15e92cd02f69');
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION,
  ECONOMY_HARDENING_REPAIR_PREDECESSOR]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_REPAIR_PREDECESSOR,
  ECONOMY_HARDENING_REPAIR_REVISION]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_REPAIR_REVISION, 'HEAD']);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_REPAIR_REVISION}^{tree}`).trim(), ECONOMY_HARDENING_REPAIR_TREE);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_REPAIR_PREDECESSOR}^{tree}`).trim(),
  ECONOMY_HARDENING_REPAIR_PREDECESSOR_TREE);
assert.match(ECONOMY_HARDENING_REPAIR_PHASE, /exact-economy-qualification-repair-source-transfer-only/);
assert.equal(ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION, 'faa56bd0e27b6866fb9a7a11ae5d71e70ac68012');
assert.equal(ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR, 'd8650c6b0990a3eeb1697492fa50a6f7e4364fa0');
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_REPAIR_REVISION,
  ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR,
  ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION, 'HEAD']);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION}^{tree}`).trim(),
  ECONOMY_HARDENING_REPAIR_SUCCESSOR_TREE);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR}^{tree}`).trim(),
  ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR_TREE);
assert.match(ECONOMY_HARDENING_REPAIR_SUCCESSOR_PHASE, /exact-economy-repair-successor-source-transfer-only/);
assert.equal(ECONOMY_HARDENING_RELEASE_REPAIR_REVISION, 'ca63f69180ae63f3aa91d2994f5ca8a09dcfec0f');
assert.equal(ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR, 'aa4f7afb9bcc8fc31a84e1eb7bb1ac8fdde44d03');
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION,
  ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR,
  ECONOMY_HARDENING_RELEASE_REPAIR_REVISION]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_RELEASE_REPAIR_REVISION,
  ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR]);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_RELEASE_REPAIR_REVISION}^{tree}`).trim(),
  ECONOMY_HARDENING_RELEASE_REPAIR_TREE);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR}^{tree}`).trim(),
  ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR_TREE);
assert.match(ECONOMY_HARDENING_RELEASE_REPAIR_PHASE, /exact-economy-release-repair-source-transfer-only/);
assert.equal(ECONOMY_HARDENING_DIRECTOR_FIXTURE_REVISION, '5b3935106be36705186be940f61b50e334fd98ba');
assert.equal(ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR, 'ee8518fc930515b3d2d19a50f236107ae34cb956');
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR,
  ECONOMY_HARDENING_DIRECTOR_FIXTURE_REVISION]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_DIRECTOR_FIXTURE_REVISION,
  ECONOMY_HARDENING_PHASE2_TIMEOUT_PREDECESSOR]);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_DIRECTOR_FIXTURE_REVISION}^{tree}`).trim(),
  ECONOMY_HARDENING_DIRECTOR_FIXTURE_TREE);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR}^{tree}`).trim(),
  ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR_TREE);
assert.match(ECONOMY_HARDENING_DIRECTOR_FIXTURE_PHASE, /exact-economy-director-fixture-source-transfer-only/);
assert.equal(ECONOMY_HARDENING_PHASE2_TIMEOUT_REVISION, '363a0b6b772111e6e07d05ea8bd55147a3f37528');
assert.equal(ECONOMY_HARDENING_PHASE2_TIMEOUT_PREDECESSOR, '34cd8d8d49d2e0aba0f587995f9d7e2a6508cf27');
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_PHASE2_TIMEOUT_PREDECESSOR,
  ECONOMY_HARDENING_PHASE2_TIMEOUT_REVISION]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_PHASE2_TIMEOUT_REVISION, 'HEAD']);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_PHASE2_TIMEOUT_REVISION}^{tree}`).trim(),
  ECONOMY_HARDENING_PHASE2_TIMEOUT_TREE);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_PHASE2_TIMEOUT_PREDECESSOR}^{tree}`).trim(),
  ECONOMY_HARDENING_PHASE2_TIMEOUT_PREDECESSOR_TREE);
assert.match(ECONOMY_HARDENING_PHASE2_TIMEOUT_PHASE, /exact-economy-phase2-upgrade-timeout-source-transfer-only/);
assert.equal(ECONOMY_HARDENING_GROWTH_DETERMINISM_REVISION, '42f04cb6c34215563a1d97be6c8483ab06c02cf3');
assert.equal(ECONOMY_HARDENING_GROWTH_DETERMINISM_PREDECESSOR, '582211926fc8ba4632f080d9cf5752efe4643462');
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_GROWTH_DETERMINISM_PREDECESSOR,
  ECONOMY_HARDENING_GROWTH_DETERMINISM_REVISION]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_GROWTH_DETERMINISM_REVISION, 'HEAD']);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_GROWTH_DETERMINISM_REVISION}^{tree}`).trim(),
  ECONOMY_HARDENING_GROWTH_DETERMINISM_TREE);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_GROWTH_DETERMINISM_PREDECESSOR}^{tree}`).trim(),
  ECONOMY_HARDENING_GROWTH_DETERMINISM_PREDECESSOR_TREE);
assert.match(ECONOMY_HARDENING_GROWTH_DETERMINISM_PHASE, /exact-economy-growth-determinism-source-transfer-only/);
assert.equal(ECONOMY_HARDENING_CAMPAIGN_EXPIRY_REVISION, '38e3212ae4a58f888c5c484f8624159ce4f50eab');
assert.equal(ECONOMY_HARDENING_CAMPAIGN_EXPIRY_PREDECESSOR, '73e9fe6c1cedd44885656d54bd88e67459b81121');
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_CAMPAIGN_EXPIRY_PREDECESSOR,
  ECONOMY_HARDENING_CAMPAIGN_EXPIRY_REVISION]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_CAMPAIGN_EXPIRY_REVISION, 'HEAD']);
assert.equal(git('rev-parse', ECONOMY_HARDENING_CAMPAIGN_EXPIRY_REVISION + '^{tree}').trim(),
  ECONOMY_HARDENING_CAMPAIGN_EXPIRY_TREE);
assert.equal(git('rev-parse', ECONOMY_HARDENING_CAMPAIGN_EXPIRY_PREDECESSOR + '^{tree}').trim(),
  ECONOMY_HARDENING_CAMPAIGN_EXPIRY_PREDECESSOR_TREE);
assert.match(ECONOMY_HARDENING_CAMPAIGN_EXPIRY_PHASE, /exact-economy-campaign-expiry-source-transfer-only/);
assert.equal(ECONOMY_HARDENING_COMMERCE_ADMISSION_REVISION, '8b4a40ef54b7fd8734d7e91ab01da12bccee5146');
assert.equal(ECONOMY_HARDENING_COMMERCE_ADMISSION_PREDECESSOR, '6c2a948d40494b6cd5ea890b989880539c9e08a6');
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_COMMERCE_ADMISSION_PREDECESSOR,
  ECONOMY_HARDENING_COMMERCE_ADMISSION_REVISION]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_COMMERCE_ADMISSION_REVISION, 'HEAD']);
assert.equal(git('rev-parse', ECONOMY_HARDENING_COMMERCE_ADMISSION_REVISION + '^{tree}').trim(),
  ECONOMY_HARDENING_COMMERCE_ADMISSION_TREE);
assert.equal(git('rev-parse', ECONOMY_HARDENING_COMMERCE_ADMISSION_PREDECESSOR + '^{tree}').trim(),
  ECONOMY_HARDENING_COMMERCE_ADMISSION_PREDECESSOR_TREE);
assert.match(ECONOMY_HARDENING_COMMERCE_ADMISSION_PHASE, /exact-economy-commerce-admission-source-transfer-only/);
assert.equal(ECONOMY_RELEASE_TAIL_REVISION, 'c15cbf7f61362e66b551de2729fe5b4e9313e829');
assert.equal(ECONOMY_RELEASE_TAIL_PREDECESSOR, 'f8de8b7ad0ec4ede750f6f94012494b1a9cdb1d5');
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_RELEASE_TAIL_PREDECESSOR,
  ECONOMY_RELEASE_TAIL_REVISION]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_RELEASE_TAIL_REVISION, 'HEAD']);
assert.equal(git('rev-parse', ECONOMY_RELEASE_TAIL_REVISION + '^{tree}').trim(), ECONOMY_RELEASE_TAIL_TREE);
assert.equal(git('rev-parse', ECONOMY_RELEASE_TAIL_PREDECESSOR + '^{tree}').trim(),
  ECONOMY_RELEASE_TAIL_PREDECESSOR_TREE);
assert.match(ECONOMY_RELEASE_TAIL_PHASE, /exact-economy-release-tail-source-transfer-only/);
assert.deepEqual(Object.keys(ECONOMY_HARDENING_SOURCE_DOMAINS), files);
assert(Object.isFrozen(ECONOMY_HARDENING_SOURCE_DOMAINS));
assert.deepEqual(Object.keys(ECONOMY_HARDENING_BINDING_DOMAINS), bindingFiles);
assert(Object.isFrozen(ECONOMY_HARDENING_BINDING_DOMAINS));
assert.deepEqual(Object.keys(ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS), successorFiles);
assert(Object.isFrozen(ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS));
assert.deepEqual(Object.keys(ECONOMY_HARDENING_REPAIR_DOMAINS), repairFiles);
assert(Object.isFrozen(ECONOMY_HARDENING_REPAIR_DOMAINS));
assert.deepEqual(Object.keys(ECONOMY_HARDENING_REPAIR_SUCCESSOR_DOMAINS), repairSuccessorFiles);
assert(Object.isFrozen(ECONOMY_HARDENING_REPAIR_SUCCESSOR_DOMAINS));
assert.deepEqual(Object.keys(ECONOMY_HARDENING_RELEASE_REPAIR_DOMAINS), releaseRepairFiles);
assert(Object.isFrozen(ECONOMY_HARDENING_RELEASE_REPAIR_DOMAINS));
assert.deepEqual(Object.keys(ECONOMY_HARDENING_DIRECTOR_FIXTURE_DOMAINS), directorFixtureFiles);
assert(Object.isFrozen(ECONOMY_HARDENING_DIRECTOR_FIXTURE_DOMAINS));
assert.deepEqual(Object.keys(ECONOMY_HARDENING_PHASE2_TIMEOUT_DOMAINS), phase2TimeoutFiles);
assert(Object.isFrozen(ECONOMY_HARDENING_PHASE2_TIMEOUT_DOMAINS));
assert.deepEqual(Object.keys(ECONOMY_HARDENING_GROWTH_DETERMINISM_DOMAINS), growthDeterminismFiles);
assert(Object.isFrozen(ECONOMY_HARDENING_GROWTH_DETERMINISM_DOMAINS));
assert.deepEqual(Object.keys(ECONOMY_HARDENING_CAMPAIGN_EXPIRY_DOMAINS), campaignExpiryFiles);
assert(Object.isFrozen(ECONOMY_HARDENING_CAMPAIGN_EXPIRY_DOMAINS));
assert.deepEqual(Object.keys(ECONOMY_HARDENING_COMMERCE_ADMISSION_DOMAINS), commerceAdmissionFiles);
assert(Object.isFrozen(ECONOMY_HARDENING_COMMERCE_ADMISSION_DOMAINS));
assert.deepEqual(Object.keys(ECONOMY_RELEASE_TAIL_DOMAINS), releaseTailFiles);
assert(Object.isFrozen(ECONOMY_RELEASE_TAIL_DOMAINS));
assert.equal(ECONOMY_BANK_INTEREST_HARDENING_REVISION, '9afbb9b78c22876dbe8d8e0b41c3b78fc2212d4a');
assert.equal(ECONOMY_BANK_INTEREST_HARDENING_PREDECESSOR, 'b933d6e2cf86e3b756e092496e41d3c848eea3cb');
assert.equal(git('rev-parse', ECONOMY_BANK_INTEREST_HARDENING_REVISION + '^').trim(),
  ECONOMY_BANK_INTEREST_HARDENING_PREDECESSOR);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_BANK_INTEREST_HARDENING_PREDECESSOR,
  ECONOMY_BANK_INTEREST_HARDENING_REVISION]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_BANK_INTEREST_HARDENING_REVISION, 'HEAD']);
assert.equal(git('rev-parse', ECONOMY_BANK_INTEREST_HARDENING_REVISION + '^{tree}').trim(),
  ECONOMY_BANK_INTEREST_HARDENING_TREE);
assert.equal(git('rev-parse', ECONOMY_BANK_INTEREST_HARDENING_PREDECESSOR + '^{tree}').trim(),
  ECONOMY_BANK_INTEREST_HARDENING_PREDECESSOR_TREE);
assert.match(ECONOMY_BANK_INTEREST_HARDENING_PHASE,
  /exact-bank-interest-request-frequency-hardening-source-transfer-only/);
assert.deepEqual(Object.keys(ECONOMY_BANK_INTEREST_HARDENING_DOMAINS), bankInterestHardeningFiles);
assert(Object.isFrozen(ECONOMY_BANK_INTEREST_HARDENING_DOMAINS));

let positives = 0, refusals = 0, hunks = 0;
for (const file of bankInterestHardeningFiles) {
  const pin = ECONOMY_BANK_INTEREST_HARDENING_DOMAINS[file];
  const current = git('show', ECONOMY_BANK_INTEREST_HARDENING_REVISION + ':' + file);
  const baseline = git('show', ECONOMY_BANK_INTEREST_HARDENING_PREDECESSOR + ':' + file);
  const physical = lf(deedAllocationPhysicalSource(file));
  assert.equal(physical, current, 'Physical bank-interest hardening source must remain exact: ' + file);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.deepEqual(Object.keys(pin).sort(), [
    'mode', 'currentSha256', 'currentBlob', 'currentBytes', 'baselineSha256', 'baselineBlob',
    'baselineBytes', 'contextLines', 'inverses',
  ].sort());
  assert.equal(pin.contextLines, 3);
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(Buffer.byteLength(current), pin.currentBytes);
  assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
  assert.equal(Buffer.byteLength(baseline), pin.baselineBytes);
  assert.equal(git('rev-parse', ECONOMY_BANK_INTEREST_HARDENING_REVISION + ':' + file).trim(),
    pin.currentBlob);
  assert.equal(git('rev-parse', ECONOMY_BANK_INTEREST_HARDENING_PREDECESSOR + ':' + file).trim(),
    pin.baselineBlob);
  assert.equal(git('ls-tree', ECONOMY_BANK_INTEREST_HARDENING_REVISION, '--', file).trim().split(/\s+/)[0],
    pin.mode);
  assert.deepEqual(pin.inverses, inverseHunks(file, ECONOMY_BANK_INTEREST_HARDENING_PREDECESSOR,
    ECONOMY_BANK_INTEREST_HARDENING_REVISION));
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const transfer = assertEconomyBankInterestHardeningSourceTransfer(file, input);
    assert.equal(transfer.baselineText, baseline); assert.equal(transfer.sourceOnly, true);
    assert.equal(transfer.runtime, false); assert.equal(transfer.native, false);
    assert.equal(economyBankInterestHardeningHistoricalInput(file, input), baseline);
    assert.equal(economyUxMergeCandidateHistoricalInput(file, input),
      economyUxMergeCandidateHistoricalInput(file, baseline));
    assert.equal(economyUxMergeMainHistoricalInput(file, input),
      economyUxMergeMainHistoricalInput(file, baseline));
    positives += 4;
  }
  const currentBuffer = Buffer.from(current), baselineBuffer = Buffer.from(baseline);
  assert.deepEqual(economyBankInterestHardeningHistoricalInput(file, currentBuffer), baselineBuffer);
  assert.deepEqual(economyUxMergeCandidateHistoricalInput(file, currentBuffer),
    economyUxMergeCandidateHistoricalInput(file, baselineBuffer));
  assert.deepEqual(economyUxMergeMainHistoricalInput(file, currentBuffer),
    economyUxMergeMainHistoricalInput(file, baselineBuffer));
  positives += 3;
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), null]) {
    assert.throws(() => assertEconomyBankInterestHardeningSourceTransfer(file, changed));
    assert.equal(economyBankInterestHardeningHistoricalInput(file, changed), changed); refusals++;
  }
  const invalidUtf8 = Buffer.from([0xc3, 0x28]);
  assert.throws(() => assertEconomyBankInterestHardeningSourceTransfer(file, invalidUtf8));
  assert.throws(() => economyBankInterestHardeningHistoricalInput(file, invalidUtf8)); refusals++;
  for (const inverse of pin.inverses) {
    assert.equal(current.split(inverse.current).length - 1, 1,
      'Unique complete bank-interest hardening inverse required: ' + file);
    for (const changed of [current.replace(inverse.current, ''),
      current.replace(inverse.current, () => inverse.current + inverse.current),
      current.replace(inverse.current, () => inverse.baseline),
      current.replace(inverse.current, () => inverse.current.replace(/\S/, '?'))]) {
      assert.throws(() => assertEconomyBankInterestHardeningSourceTransfer(file, changed));
      assert.equal(economyBankInterestHardeningHistoricalInput(file, changed), changed); refusals++;
    }
    hunks++;
  }
}
for (const file of ['__proto__', 'constructor', 'toString', 'src/unknown.js']) {
  const text = 'unknown\r\nbytes\n', invalidUtf8 = Buffer.from([0xc3, 0x28]);
  assert.throws(() => assertEconomyBankInterestHardeningSourceTransfer(file, text));
  assert.equal(economyBankInterestHardeningHistoricalInput(file, text), text);
  assert.strictEqual(economyBankInterestHardeningHistoricalInput(file, invalidUtf8), invalidUtf8); refusals++;
}
assert.equal(ECONOMY_SOCIAL_PROOF_CUTOVER_REVISION, '3d1e7efade73521910494dcfdb66590e70b95140');
assert.equal(ECONOMY_SOCIAL_PROOF_CUTOVER_PREDECESSOR, '62bee23255516ba3e5b05a6b27e8a0475e3a7895');
assert.equal(git('rev-parse', ECONOMY_SOCIAL_PROOF_CUTOVER_REVISION + '^').trim(),
  ECONOMY_SOCIAL_PROOF_CUTOVER_PREDECESSOR);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_SOCIAL_PROOF_CUTOVER_PREDECESSOR,
  ECONOMY_SOCIAL_PROOF_CUTOVER_REVISION]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_SOCIAL_PROOF_CUTOVER_REVISION, 'HEAD']);
assert.equal(git('rev-parse', ECONOMY_SOCIAL_PROOF_CUTOVER_REVISION + '^{tree}').trim(),
  ECONOMY_SOCIAL_PROOF_CUTOVER_TREE);
assert.equal(git('rev-parse', ECONOMY_SOCIAL_PROOF_CUTOVER_PREDECESSOR + '^{tree}').trim(),
  ECONOMY_SOCIAL_PROOF_CUTOVER_PREDECESSOR_TREE);
assert.match(ECONOMY_SOCIAL_PROOF_CUTOVER_PHASE,
  /exact-social-proof-production-cutover-source-transfer-only/);
assert.deepEqual(Object.keys(ECONOMY_SOCIAL_PROOF_CUTOVER_DOMAINS), socialProofCutoverFiles);
assert(Object.isFrozen(ECONOMY_SOCIAL_PROOF_CUTOVER_DOMAINS));

for (const file of socialProofCutoverFiles) {
  const pin = ECONOMY_SOCIAL_PROOF_CUTOVER_DOMAINS[file];
  const current = git('show', ECONOMY_SOCIAL_PROOF_CUTOVER_REVISION + ':' + file);
  const predecessorAbsent = socialProofCutoverAdditions.has(file);
  const baseline = predecessorAbsent ? null
    : git('show', ECONOMY_SOCIAL_PROOF_CUTOVER_PREDECESSOR + ':' + file);
  const physical = lf(deedAllocationPhysicalSource(file));
  assert.equal(physical, current, 'Physical social-proof cutover source must remain exact: ' + file);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.deepEqual(Object.keys(pin).sort(), [
    'predecessorAbsent', 'mode', 'currentSha256', 'currentBlob', 'currentBytes',
    'baselineSha256', 'baselineBlob', 'baselineBytes', 'contextLines', 'inverses',
  ].sort());
  assert.equal(pin.predecessorAbsent, predecessorAbsent); assert.equal(pin.contextLines, 3);
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(Buffer.byteLength(current), pin.currentBytes);
  assert.equal(git('rev-parse', ECONOMY_SOCIAL_PROOF_CUTOVER_REVISION + ':' + file).trim(),
    pin.currentBlob);
  assert.equal(git('ls-tree', ECONOMY_SOCIAL_PROOF_CUTOVER_REVISION, '--', file).trim().split(/\s+/)[0],
    pin.mode);
  if (predecessorAbsent) {
    assert.equal(git('ls-tree', ECONOMY_SOCIAL_PROOF_CUTOVER_PREDECESSOR, '--', file), '');
    assert.equal(pin.baselineSha256, null); assert.equal(pin.baselineBlob, null);
    assert.equal(pin.baselineBytes, null); assert.deepEqual(pin.inverses, []);
  } else {
    assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
    assert.equal(Buffer.byteLength(baseline), pin.baselineBytes);
    assert.equal(git('rev-parse', ECONOMY_SOCIAL_PROOF_CUTOVER_PREDECESSOR + ':' + file).trim(),
      pin.baselineBlob);
    assert.deepEqual(pin.inverses, inverseHunks(file, ECONOMY_SOCIAL_PROOF_CUTOVER_PREDECESSOR,
      ECONOMY_SOCIAL_PROOF_CUTOVER_REVISION));
  }
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const transfer = assertEconomySocialProofCutoverSourceTransfer(file, input);
    assert.equal(transfer.baselineText, baseline); assert.equal(transfer.predecessorAbsent, predecessorAbsent);
    assert.equal(transfer.sourceOnly, true); assert.equal(transfer.runtime, false); assert.equal(transfer.native, false);
    const expected = predecessorAbsent ? input : baseline;
    assert.equal(economySocialProofCutoverHistoricalInput(file, input), expected);
    assert.equal(economyUxMergeCandidateHistoricalInput(file, input),
      predecessorAbsent ? input : economyUxMergeCandidateHistoricalInput(file, baseline));
    assert.equal(economyUxMergeMainHistoricalInput(file, input),
      predecessorAbsent ? input : economyUxMergeMainHistoricalInput(file, baseline));
    positives += 4;
  }
  const currentBuffer = Buffer.from(current);
  const expectedBuffer = predecessorAbsent ? currentBuffer : Buffer.from(baseline);
  assert.deepEqual(economySocialProofCutoverHistoricalInput(file, currentBuffer), expectedBuffer);
  assert.deepEqual(economyUxMergeCandidateHistoricalInput(file, currentBuffer),
    predecessorAbsent ? currentBuffer : economyUxMergeCandidateHistoricalInput(file, expectedBuffer));
  assert.deepEqual(economyUxMergeMainHistoricalInput(file, currentBuffer),
    predecessorAbsent ? currentBuffer : economyUxMergeMainHistoricalInput(file, expectedBuffer));
  positives += 3;
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), null]) {
    assert.throws(() => assertEconomySocialProofCutoverSourceTransfer(file, changed));
    assert.equal(economySocialProofCutoverHistoricalInput(file, changed), changed); refusals++;
  }
  const invalidUtf8 = Buffer.from([0xc3, 0x28]);
  assert.throws(() => assertEconomySocialProofCutoverSourceTransfer(file, invalidUtf8));
  assert.throws(() => economySocialProofCutoverHistoricalInput(file, invalidUtf8)); refusals++;
  for (const inverse of pin.inverses) {
    assert.equal(current.split(inverse.current).length - 1, 1,
      'Unique complete social-proof cutover inverse required: ' + file);
    for (const changed of [current.replace(inverse.current, ''),
      current.replace(inverse.current, () => inverse.current + inverse.current),
      current.replace(inverse.current, () => inverse.baseline),
      current.replace(inverse.current, () => inverse.current.replace(/\S/, '?'))]) {
      assert.throws(() => assertEconomySocialProofCutoverSourceTransfer(file, changed));
      assert.equal(economySocialProofCutoverHistoricalInput(file, changed), changed); refusals++;
    }
    hunks++;
  }
}
for (const file of ['__proto__', 'constructor', 'toString', 'src/unknown.js']) {
  const text = 'unknown\r\nbytes\n', invalidUtf8 = Buffer.from([0xc3, 0x28]);
  assert.throws(() => assertEconomySocialProofCutoverSourceTransfer(file, text));
  assert.equal(economySocialProofCutoverHistoricalInput(file, text), text);
  assert.strictEqual(economySocialProofCutoverHistoricalInput(file, invalidUtf8), invalidUtf8); refusals++;
}
assert.equal(ECONOMY_SOCIAL_RECEIPT_SAFETY_REVISION, '95a581119a7dd7c43e843d6c5b51363b902c3b74');
assert.equal(ECONOMY_SOCIAL_RECEIPT_SAFETY_PREDECESSOR, '7f070a5b09bd24ada8e27f6f6450970fc93a9e1e');
assert.equal(git('rev-parse', ECONOMY_SOCIAL_RECEIPT_SAFETY_REVISION + '^').trim(),
  ECONOMY_SOCIAL_RECEIPT_SAFETY_PREDECESSOR);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_SOCIAL_RECEIPT_SAFETY_PREDECESSOR,
  ECONOMY_SOCIAL_RECEIPT_SAFETY_REVISION]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_SOCIAL_RECEIPT_SAFETY_REVISION, 'HEAD']);
assert.equal(git('rev-parse', ECONOMY_SOCIAL_RECEIPT_SAFETY_REVISION + '^{tree}').trim(),
  ECONOMY_SOCIAL_RECEIPT_SAFETY_TREE);
assert.equal(git('rev-parse', ECONOMY_SOCIAL_RECEIPT_SAFETY_PREDECESSOR + '^{tree}').trim(),
  ECONOMY_SOCIAL_RECEIPT_SAFETY_PREDECESSOR_TREE);
assert.match(ECONOMY_SOCIAL_RECEIPT_SAFETY_PHASE,
  /exact-social-proof-receipt-safety-source-transfer-only/);
assert.deepEqual(Object.keys(ECONOMY_SOCIAL_RECEIPT_SAFETY_DOMAINS), socialReceiptSafetyFiles);
assert(Object.isFrozen(ECONOMY_SOCIAL_RECEIPT_SAFETY_DOMAINS));

for (const file of socialReceiptSafetyFiles) {
  const pin = ECONOMY_SOCIAL_RECEIPT_SAFETY_DOMAINS[file];
  const current = git('show', ECONOMY_SOCIAL_RECEIPT_SAFETY_REVISION + ':' + file);
  const baseline = git('show', ECONOMY_SOCIAL_RECEIPT_SAFETY_PREDECESSOR + ':' + file);
  const physical = lf(economySocialProofCutoverHistoricalInput(file, deedAllocationPhysicalSource(file)));
  assert.equal(physical, current, 'Physical receipt-safety repair source must remain exact: ' + file);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.deepEqual(Object.keys(pin).sort(), [
    'mode', 'currentSha256', 'currentBlob', 'currentBytes', 'baselineSha256', 'baselineBlob',
    'baselineBytes', 'contextLines', 'inverses',
  ].sort());
  assert.equal(pin.contextLines, 3);
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(Buffer.byteLength(current), pin.currentBytes);
  assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
  assert.equal(Buffer.byteLength(baseline), pin.baselineBytes);
  assert.equal(git('rev-parse', ECONOMY_SOCIAL_RECEIPT_SAFETY_REVISION + ':' + file).trim(), pin.currentBlob);
  assert.equal(git('rev-parse', ECONOMY_SOCIAL_RECEIPT_SAFETY_PREDECESSOR + ':' + file).trim(), pin.baselineBlob);
  assert.equal(git('ls-tree', ECONOMY_SOCIAL_RECEIPT_SAFETY_REVISION, '--', file).trim().split(/\s+/)[0], pin.mode);
  assert.deepEqual(pin.inverses, inverseHunks(file, ECONOMY_SOCIAL_RECEIPT_SAFETY_PREDECESSOR,
    ECONOMY_SOCIAL_RECEIPT_SAFETY_REVISION));
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const transfer = assertEconomySocialReceiptSafetySourceTransfer(file, input);
    assert.equal(transfer.baselineText, baseline); assert.equal(transfer.sourceOnly, true);
    assert.equal(transfer.runtime, false); assert.equal(transfer.native, false);
    assert.equal(economySocialReceiptSafetyHistoricalInput(file, input), baseline);
    assert.equal(economyUxMergeCandidateHistoricalInput(file, input),
      economyUxMergeCandidateHistoricalInput(file, baseline));
    assert.equal(economyUxMergeMainHistoricalInput(file, input),
      economyUxMergeMainHistoricalInput(file, baseline));
    positives += 4;
  }
  const currentBuffer = Buffer.from(current), baselineBuffer = Buffer.from(baseline);
  assert.deepEqual(economySocialReceiptSafetyHistoricalInput(file, currentBuffer), baselineBuffer);
  assert.deepEqual(economyUxMergeCandidateHistoricalInput(file, currentBuffer),
    economyUxMergeCandidateHistoricalInput(file, baselineBuffer));
  assert.deepEqual(economyUxMergeMainHistoricalInput(file, currentBuffer),
    economyUxMergeMainHistoricalInput(file, baselineBuffer));
  positives += 3;
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), null]) {
    assert.throws(() => assertEconomySocialReceiptSafetySourceTransfer(file, changed));
    assert.equal(economySocialReceiptSafetyHistoricalInput(file, changed), changed); refusals++;
  }
  const invalidUtf8 = Buffer.from([0xc3, 0x28]);
  assert.throws(() => assertEconomySocialReceiptSafetySourceTransfer(file, invalidUtf8));
  assert.throws(() => economySocialReceiptSafetyHistoricalInput(file, invalidUtf8)); refusals++;
  for (const inverse of pin.inverses) {
    assert.equal(current.split(inverse.current).length - 1, 1,
      'Unique complete receipt-safety repair inverse required: ' + file);
    for (const changed of [current.replace(inverse.current, ''),
      current.replace(inverse.current, () => inverse.current + inverse.current),
      current.replace(inverse.current, () => inverse.baseline),
      current.replace(inverse.current, () => inverse.current.replace(/\S/, '?'))]) {
      assert.throws(() => assertEconomySocialReceiptSafetySourceTransfer(file, changed));
      assert.equal(economySocialReceiptSafetyHistoricalInput(file, changed), changed); refusals++;
    }
    hunks++;
  }
}
for (const file of ['__proto__', 'constructor', 'toString', 'src/unknown.js']) {
  const text = 'unknown\r\nbytes\n', invalidUtf8 = Buffer.from([0xc3, 0x28]);
  assert.throws(() => assertEconomySocialReceiptSafetySourceTransfer(file, text));
  assert.equal(economySocialReceiptSafetyHistoricalInput(file, text), text);
  assert.strictEqual(economySocialReceiptSafetyHistoricalInput(file, invalidUtf8), invalidUtf8); refusals++;
}
assert.equal(ECONOMY_SOCIAL_RECEIPT_REVISION, '5318589c8e8fd7fa64e6e714e6f69111fb0dca0a');
assert.equal(ECONOMY_SOCIAL_RECEIPT_PREDECESSOR, '011930200e9f4266d92b7a8f77646013d96b697b');
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_SOCIAL_RECEIPT_PREDECESSOR,
  ECONOMY_SOCIAL_RECEIPT_REVISION]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_SOCIAL_RECEIPT_REVISION, 'HEAD']);
assert.equal(git('rev-parse', ECONOMY_SOCIAL_RECEIPT_REVISION + '^{tree}').trim(),
  ECONOMY_SOCIAL_RECEIPT_TREE);
assert.equal(git('rev-parse', ECONOMY_SOCIAL_RECEIPT_PREDECESSOR + '^{tree}').trim(),
  ECONOMY_SOCIAL_RECEIPT_PREDECESSOR_TREE);
assert.match(ECONOMY_SOCIAL_RECEIPT_PHASE, /exact-social-proof-receipt-retention-source-transfer-only/);
assert.deepEqual(Object.keys(ECONOMY_SOCIAL_RECEIPT_DOMAINS), socialReceiptFiles);
assert(Object.isFrozen(ECONOMY_SOCIAL_RECEIPT_DOMAINS));

for (const file of socialReceiptFiles) {
  const pin = ECONOMY_SOCIAL_RECEIPT_DOMAINS[file];
  const current = git('show', ECONOMY_SOCIAL_RECEIPT_REVISION + ':' + file);
  const baseline = git('show', ECONOMY_SOCIAL_RECEIPT_PREDECESSOR + ':' + file);
  const cutoverPhysical = economySocialProofCutoverHistoricalInput(file, deedAllocationPhysicalSource(file));
  const physical = lf(economySocialReceiptSafetyHistoricalInput(file, cutoverPhysical));
  assert.equal(physical, current, 'Physical social-receipt repair source must remain exact: ' + file);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.deepEqual(Object.keys(pin).sort(), [
    'mode', 'currentSha256', 'currentBlob', 'currentBytes', 'baselineSha256', 'baselineBlob',
    'baselineBytes', 'contextLines', 'inverses',
  ].sort());
  assert.equal(pin.contextLines, 3);
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(Buffer.byteLength(current), pin.currentBytes);
  assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
  assert.equal(Buffer.byteLength(baseline), pin.baselineBytes);
  assert.equal(git('rev-parse', ECONOMY_SOCIAL_RECEIPT_REVISION + ':' + file).trim(), pin.currentBlob);
  assert.equal(git('rev-parse', ECONOMY_SOCIAL_RECEIPT_PREDECESSOR + ':' + file).trim(), pin.baselineBlob);
  assert.equal(git('ls-tree', ECONOMY_SOCIAL_RECEIPT_REVISION, '--', file).trim().split(/\s+/)[0], pin.mode);
  assert.deepEqual(pin.inverses, inverseHunks(file, ECONOMY_SOCIAL_RECEIPT_PREDECESSOR,
    ECONOMY_SOCIAL_RECEIPT_REVISION));
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const transfer = assertEconomySocialReceiptSourceTransfer(file, input);
    assert.equal(transfer.baselineText, baseline); assert.equal(transfer.sourceOnly, true);
    assert.equal(transfer.runtime, false); assert.equal(transfer.native, false);
    assert.equal(economySocialReceiptHistoricalInput(file, input), baseline);
    assert.equal(economyUxMergeCandidateHistoricalInput(file, input),
      economyUxMergeCandidateHistoricalInput(file, baseline));
    positives += 2;
  }
  assert.deepEqual(economySocialReceiptHistoricalInput(file, Buffer.from(current)), Buffer.from(baseline));
  positives++;
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), null]) {
    assert.throws(() => assertEconomySocialReceiptSourceTransfer(file, changed));
    assert.equal(economySocialReceiptHistoricalInput(file, changed), changed); refusals++;
  }
  for (const inverse of pin.inverses) {
    assert.equal(current.split(inverse.current).length - 1, 1,
      'Unique complete social-receipt repair inverse required: ' + file);
    for (const changed of [current.replace(inverse.current, ''),
      current.replace(inverse.current, () => inverse.current + inverse.current),
      current.replace(inverse.current, () => inverse.current.replace(/\S/, '?'))]) {
      assert.throws(() => assertEconomySocialReceiptSourceTransfer(file, changed));
      assert.equal(economySocialReceiptHistoricalInput(file, changed), changed); refusals++;
    }
    hunks++;
  }
}
for (const file of ['__proto__', 'constructor', 'toString']) {
  const text = 'inherited-name\r\nbytes\n', invalidUtf8 = Buffer.from([0xc3, 0x28]);
  assert.throws(() => assertEconomySocialReceiptSourceTransfer(file, text));
  assert.equal(economySocialReceiptHistoricalInput(file, text), text);
  assert.strictEqual(economySocialReceiptHistoricalInput(file, invalidUtf8), invalidUtf8); refusals++;
}
for (const file of releaseTailFiles) {
  const pin = ECONOMY_RELEASE_TAIL_DOMAINS[file];
  const current = git('show', ECONOMY_RELEASE_TAIL_REVISION + ':' + file);
  const baseline = git('show', ECONOMY_RELEASE_TAIL_PREDECESSOR + ':' + file);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.deepEqual(Object.keys(pin).sort(), [
    'mode', 'currentSha256', 'currentBlob', 'currentBytes', 'baselineSha256', 'baselineBlob',
    'baselineBytes', 'contextLines', 'inverses',
  ].sort());
  assert.equal(pin.contextLines, 3);
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(Buffer.byteLength(current), pin.currentBytes);
  assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
  assert.equal(Buffer.byteLength(baseline), pin.baselineBytes);
  assert.equal(git('rev-parse', ECONOMY_RELEASE_TAIL_REVISION + ':' + file).trim(), pin.currentBlob);
  assert.equal(git('rev-parse', ECONOMY_RELEASE_TAIL_PREDECESSOR + ':' + file).trim(), pin.baselineBlob);
  assert.equal(git('ls-tree', ECONOMY_RELEASE_TAIL_REVISION, '--', file).trim().split(/\s+/)[0], pin.mode);
  assert.deepEqual(pin.inverses, inverseHunks(file, ECONOMY_RELEASE_TAIL_PREDECESSOR,
    ECONOMY_RELEASE_TAIL_REVISION));
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const transfer = assertEconomyReleaseTailTransfer(file, input);
    assert.equal(transfer.baselineText, baseline); assert.equal(transfer.sourceOnly, true);
    assert.equal(transfer.runtime, false); assert.equal(transfer.native, false);
    assert.equal(economyHardeningSourceBaseline(file, input),
      economyHardeningSourceBaseline(file, baseline)); positives++;
  }
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), Buffer.from(current), null]) {
    assert.throws(() => assertEconomyReleaseTailTransfer(file, changed));
    assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
  }
  for (const inverse of pin.inverses) {
    assert.equal(current.split(inverse.current).length - 1, 1,
      'Unique complete economy release-tail inverse required: ' + file);
    for (const changed of [current.replace(inverse.current, ''),
      current.replace(inverse.current, () => inverse.current + inverse.current),
      current.replace(inverse.current, () => inverse.current.replace(/\S/, '?'))]) {
      assert.throws(() => assertEconomyReleaseTailTransfer(file, changed));
      assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
    }
    hunks++;
  }
}
const hardeningSuccessor = ECONOMY_READINESS_MERGE_SOURCE.hardeningSuccessor;
assert.equal(git('rev-parse', `${hardeningSuccessor.revision}^{tree}`).trim(), hardeningSuccessor.tree);
assert.equal(git('rev-parse', `${hardeningSuccessor.targetRevision}^{tree}`).trim(), hardeningSuccessor.targetTree);
assert.deepEqual(hardeningSuccessor.inverses, inverseHunks(hardeningSuccessor.file,
  hardeningSuccessor.targetRevision, hardeningSuccessor.revision));
const hardeningSuccessorCurrent = git('show', `${hardeningSuccessor.revision}:${hardeningSuccessor.file}`);
const hardeningSuccessorTarget = git('show', `${hardeningSuccessor.targetRevision}:${hardeningSuccessor.file}`);
for (const input of [hardeningSuccessorCurrent, hardeningSuccessorCurrent.replaceAll('\n', '\r\n')]) {
  assert.equal(qualifyEconomyHardeningSuccessorSource(hardeningSuccessor.file, input).baselineText,
    hardeningSuccessorTarget); positives++;
}
for (const input of [hardeningSuccessorCurrent + '\n', hardeningSuccessorCurrent.slice(1),
  '\ufeff' + hardeningSuccessorCurrent, hardeningSuccessorCurrent + '\0',
  hardeningSuccessorCurrent.replace('\n', '\r'), Buffer.from(hardeningSuccessorCurrent), null]) {
  assert.throws(() => qualifyEconomyHardeningSuccessorSource(hardeningSuccessor.file, input)); refusals++;
}
for (const file of files) {
  const pin = ECONOMY_HARDENING_SOURCE_DOMAINS[file];
  const current = git('show', `${expectedRevision}:${file}`), baseline = git('show', `${expectedPredecessor}:${file}`);
  const rawPhysical = physicalCandidateSource(file);
  const tailPhysical = releaseTailFiles.includes(file)
    ? assertEconomyReleaseTailTransfer(file, rawPhysical).baselineText : rawPhysical;
  const physical = lf(economyHardeningMergeHistoricalInput(file, tailPhysical));
  const campaignExpirySealed = campaignExpiryFiles.includes(file)
    ? assertEconomyHardeningCampaignExpiryTransfer(file, physical).baselineText : physical;
  const growthDeterminismSealed = growthDeterminismFiles.includes(file)
    ? assertEconomyHardeningGrowthDeterminismTransfer(file, campaignExpirySealed).baselineText : campaignExpirySealed;
  const phase2TimeoutSealed = phase2TimeoutFiles.includes(file)
    ? assertEconomyHardeningPhase2TimeoutTransfer(file, growthDeterminismSealed).baselineText : growthDeterminismSealed;
  const releaseRepaired = releaseRepairFiles.includes(file)
    ? assertEconomyHardeningReleaseRepairTransfer(file, phase2TimeoutSealed).baselineText : phase2TimeoutSealed;
  const repairSuccessorAuthored = repairSuccessorFiles.includes(file)
    ? assertEconomyHardeningRepairSuccessorTransfer(file, releaseRepaired).baselineText : releaseRepaired;
  const repairedAuthored = repairFiles.includes(file)
    ? assertEconomyHardeningRepairTransfer(file, repairSuccessorAuthored).baselineText : repairSuccessorAuthored;
  const successorAuthored = successorFiles.includes(file)
    ? assertEconomyHardeningBindingSuccessorTransfer(file, repairedAuthored).baselineText : repairedAuthored;
  const authored = bindingFiles.includes(file)
    ? assertEconomyHardeningBindingTransfer(file, successorAuthored).baselineText : successorAuthored;
  assert.equal(authored, current, `Physical source must reconstruct the authored candidate: ${file}`);
  assert.deepEqual(Object.keys(pin).sort(), ['mode', 'currentSha256', 'currentBlob', 'baselineSha256', 'baselineBlob', 'contextLines', 'inverses'].sort());
  assert.equal(pin.contextLines, 3); assert(Object.isFrozen(pin)); assert(Object.isFrozen(pin.inverses));
  assert(pin.inverses.length > 0 && pin.inverses.every(Object.isFrozen));
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
  assert.equal(git('rev-parse', `${expectedRevision}:${file}`).trim(), pin.currentBlob);
  assert.equal(git('rev-parse', `${expectedPredecessor}:${file}`).trim(), pin.baselineBlob);
  assert.equal(git('ls-tree', expectedRevision, '--', file).trim().split(/\s+/)[0], pin.mode);
  assert.deepEqual(pin.inverses, inverseHunks(file));
  const transfer = assertEconomyHardeningSourceTransfer(file, current);
  assert.equal(transfer.baselineText, baseline); assert.equal(transfer.sourceOnly, true);
  assert.equal(transfer.sourceRevision, expectedRevision); assert.equal(transfer.predecessorRevision, expectedPredecessor);
  assert.equal(economyHardeningSourceBaseline(file, current), baseline);
  assert.equal(economyHardeningSourceBaseline(file, current.replaceAll('\n', '\r\n')), baseline);
  assert.equal(economyHardeningSourceBaseline(file, baseline), baseline);
  if (bindingFiles.includes(file) || repairFiles.includes(file) || phase2TimeoutFiles.includes(file)) {
    assert.equal(economyHardeningSourceBaseline(file, physical), baseline);
    assert.equal(economyHardeningSourceBaseline(file, physical.replaceAll('\n', '\r\n')), baseline);
    positives += 2;
  }
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0', Buffer.from(current)]) {
    assert.throws(() => assertEconomyHardeningSourceTransfer(file, changed));
    assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
  }
  positives += 3; hunks += pin.inverses.length;
}
for (const file of repairFiles) {
  const pin = ECONOMY_HARDENING_REPAIR_DOMAINS[file];
  const current = git('show', `${ECONOMY_HARDENING_REPAIR_REVISION}:${file}`);
  const baseline = git('show', `${ECONOMY_HARDENING_REPAIR_PREDECESSOR}:${file}`);
  const historical = files.includes(file) ? git('show', `${expectedPredecessor}:${file}`) : baseline;
  const mergeQualified = physicalCandidateSource(file);
  const outerPhysical = lf(releaseTailFiles.includes(file)
    ? assertEconomyReleaseTailTransfer(file, mergeQualified).baselineText : mergeQualified);
  const campaignExpirySealed = campaignExpiryFiles.includes(file)
    ? assertEconomyHardeningCampaignExpiryTransfer(file, outerPhysical).baselineText : outerPhysical;
  const growthDeterminismSealed = growthDeterminismFiles.includes(file)
    ? assertEconomyHardeningGrowthDeterminismTransfer(file, campaignExpirySealed).baselineText : campaignExpirySealed;
  const releaseRepaired = releaseRepairFiles.includes(file)
    ? assertEconomyHardeningReleaseRepairTransfer(file, growthDeterminismSealed).baselineText : growthDeterminismSealed;
  const physical = repairSuccessorFiles.includes(file)
    ? assertEconomyHardeningRepairSuccessorTransfer(file, releaseRepaired).baselineText : releaseRepaired;
  assert.equal(physical, current, 'Physical qualification repair source must remain exact: ' + file);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.deepEqual(Object.keys(pin).sort(),
    ['mode', 'currentSha256', 'currentBlob', 'baselineSha256', 'baselineBlob', 'contextLines', 'inverses'].sort());
  assert.equal(pin.contextLines, 3);
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
  assert.equal(git('rev-parse', `${ECONOMY_HARDENING_REPAIR_REVISION}:${file}`).trim(), pin.currentBlob);
  assert.equal(git('rev-parse', `${ECONOMY_HARDENING_REPAIR_PREDECESSOR}:${file}`).trim(), pin.baselineBlob);
  assert.equal(git('ls-tree', ECONOMY_HARDENING_REPAIR_REVISION, '--', file).trim().split(/\s+/)[0], pin.mode);
  assert.deepEqual(pin.inverses, inverseHunks(file, ECONOMY_HARDENING_REPAIR_PREDECESSOR,
    ECONOMY_HARDENING_REPAIR_REVISION));
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const transfer = assertEconomyHardeningRepairTransfer(file, input);
    assert.equal(transfer.baselineText, baseline); assert.equal(transfer.sourceOnly, true);
    assert.equal(transfer.sourceRevision, ECONOMY_HARDENING_REPAIR_REVISION);
    assert.equal(transfer.predecessorRevision, ECONOMY_HARDENING_REPAIR_PREDECESSOR);
    assert.equal(economyHardeningSourceBaseline(file, input), historical); positives++;
  }
  assert.equal(economyHardeningSourceBaseline(file, baseline), historical); positives++;
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), Buffer.from(current), null]) {
    assert.throws(() => assertEconomyHardeningRepairTransfer(file, changed));
    assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
  }
  for (const inverse of pin.inverses) {
    assert.equal(current.split(inverse.current).length - 1, 1, 'Unique complete qualification repair inverse required: ' + file);
    const changedInputs = [current.replace(inverse.current, ''),
      current.replace(inverse.current, () => inverse.current + inverse.current)];
    // With a one-hunk repair, applying that hunk's baseline is the exact known predecessor. The
    // permissive composer must continue through older layers instead of treating it as source drift.
    if (pin.inverses.length > 1) changedInputs.push(current.replace(inverse.current, () => inverse.baseline));
    changedInputs.push(current.replace(inverse.current, () => inverse.current.replace(/\S/, '?')));
    for (const changed of changedInputs) {
      assert.throws(() => assertEconomyHardeningRepairTransfer(file, changed));
      assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
    }
    hunks++;
  }
}
for (const file of repairSuccessorFiles) {
  const pin = ECONOMY_HARDENING_REPAIR_SUCCESSOR_DOMAINS[file];
  const current = git('show', `${ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION}:${file}`);
  const predecessorEntry = git('ls-tree', ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR, '--', file).trim();
  const predecessorAbsent = predecessorEntry === '';
  const baseline = predecessorAbsent ? null
    : git('show', `${ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR}:${file}`);
  const historical = predecessorAbsent ? current
    : files.includes(file) ? git('show', `${expectedPredecessor}:${file}`)
      : repairFiles.includes(file) ? git('show', `${ECONOMY_HARDENING_REPAIR_PREDECESSOR}:${file}`) : baseline;
  const rawPhysical = physicalCandidateSource(file);
  const outerPhysical = lf(releaseTailFiles.includes(file)
    ? assertEconomyReleaseTailTransfer(file, rawPhysical).baselineText : rawPhysical);
  const growthDeterminismSealed = growthDeterminismFiles.includes(file)
    ? assertEconomyHardeningGrowthDeterminismTransfer(file, outerPhysical).baselineText : outerPhysical;
  const physical = releaseRepairFiles.includes(file)
    ? assertEconomyHardeningReleaseRepairTransfer(file, growthDeterminismSealed).baselineText : growthDeterminismSealed;
  assert.equal(physical, current, 'Physical repair successor source must remain exact: ' + file);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.deepEqual(Object.keys(pin).sort(),
    ['predecessorAbsent', 'mode', 'currentSha256', 'currentBlob', 'baselineSha256', 'baselineBlob',
      'contextLines', 'inverses'].sort());
  assert.equal(pin.contextLines, 3); assert.equal(pin.predecessorAbsent, predecessorAbsent);
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(git('rev-parse', `${ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION}:${file}`).trim(), pin.currentBlob);
  assert.equal(git('ls-tree', ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION, '--', file).trim().split(/\s+/)[0], pin.mode);
  if (predecessorAbsent) {
    assert.equal(file, 'src/socialproof.js');
    assert.equal(pin.baselineSha256, null); assert.equal(pin.baselineBlob, null); assert.deepEqual(pin.inverses, []);
    assert.throws(() => git('show', `${ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR}:${file}`));
  } else {
    assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
    assert.equal(git('rev-parse', `${ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR}:${file}`).trim(), pin.baselineBlob);
    assert.deepEqual(pin.inverses, inverseHunks(file, ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR,
      ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION));
  }
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const transfer = assertEconomyHardeningRepairSuccessorTransfer(file, input);
    assert.equal(transfer.baselineText, baseline); assert.equal(transfer.predecessorAbsent, predecessorAbsent);
    assert.equal(transfer.sourceOnly, true);
    assert.equal(transfer.sourceRevision, ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION);
    assert.equal(transfer.predecessorRevision, ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR);
    assert.equal(economyHardeningSourceBaseline(file, input), predecessorAbsent ? input : historical); positives++;
  }
  if (!predecessorAbsent) {
    assert.equal(economyHardeningSourceBaseline(file, baseline), historical); positives++;
  }
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), Buffer.from(current), null]) {
    assert.throws(() => assertEconomyHardeningRepairSuccessorTransfer(file, changed));
    assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
  }
  for (const inverse of pin.inverses) {
    assert.equal(current.split(inverse.current).length - 1, 1,
      'Unique complete repair successor inverse required: ' + file);
    const changedInputs = [current.replace(inverse.current, ''),
      current.replace(inverse.current, () => inverse.current + inverse.current)];
    if (pin.inverses.length > 1) changedInputs.push(current.replace(inverse.current, () => inverse.baseline));
    changedInputs.push(current.replace(inverse.current, () => inverse.current.replace(/\S/, '?')));
    for (const changed of changedInputs) {
      assert.throws(() => assertEconomyHardeningRepairSuccessorTransfer(file, changed));
      assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
    }
    hunks++;
  }
}
for (const file of releaseRepairFiles) {
  const pin = ECONOMY_HARDENING_RELEASE_REPAIR_DOMAINS[file];
  const current = git('show', `${ECONOMY_HARDENING_RELEASE_REPAIR_REVISION}:${file}`);
  const baseline = git('show', `${ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR}:${file}`);
  const historical = files.includes(file) ? git('show', `${expectedPredecessor}:${file}`) : baseline;
  const physical = physicalCandidateSource(file);
  assert.equal(physical, current, 'Physical release repair source must remain exact: ' + file);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.deepEqual(Object.keys(pin).sort(),
    ['mode', 'currentSha256', 'currentBlob', 'baselineSha256', 'baselineBlob', 'contextLines', 'inverses'].sort());
  assert.equal(pin.contextLines, 3);
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
  assert.equal(git('rev-parse', `${ECONOMY_HARDENING_RELEASE_REPAIR_REVISION}:${file}`).trim(), pin.currentBlob);
  assert.equal(git('rev-parse', `${ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR}:${file}`).trim(), pin.baselineBlob);
  assert.equal(git('ls-tree', ECONOMY_HARDENING_RELEASE_REPAIR_REVISION, '--', file).trim().split(/\s+/)[0], pin.mode);
  assert.deepEqual(pin.inverses, inverseHunks(file, ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR,
    ECONOMY_HARDENING_RELEASE_REPAIR_REVISION));
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const transfer = assertEconomyHardeningReleaseRepairTransfer(file, input);
    assert.equal(transfer.baselineText, baseline); assert.equal(transfer.sourceOnly, true);
    assert.equal(transfer.sourceRevision, ECONOMY_HARDENING_RELEASE_REPAIR_REVISION);
    assert.equal(transfer.predecessorRevision, ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR);
    assert.equal(economyHardeningSourceBaseline(file, input), historical); positives++;
  }
  assert.equal(economyHardeningSourceBaseline(file, baseline), historical); positives++;
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), Buffer.from(current), null]) {
    assert.throws(() => assertEconomyHardeningReleaseRepairTransfer(file, changed));
    assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
  }
  for (const inverse of pin.inverses) {
    assert.equal(current.split(inverse.current).length - 1, 1,
      'Unique complete release repair inverse required: ' + file);
    const changedInputs = [current.replace(inverse.current, ''),
      current.replace(inverse.current, () => inverse.current + inverse.current)];
    if (pin.inverses.length > 1) changedInputs.push(current.replace(inverse.current, () => inverse.baseline));
    changedInputs.push(current.replace(inverse.current, () => inverse.current.replace(/\S/, '?')));
    for (const changed of changedInputs) {
      assert.throws(() => assertEconomyHardeningReleaseRepairTransfer(file, changed));
      assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
    }
    hunks++;
  }
}
for (const file of directorFixtureFiles) {
  const pin = ECONOMY_HARDENING_DIRECTOR_FIXTURE_DOMAINS[file];
  const current = git('show', `${ECONOMY_HARDENING_DIRECTOR_FIXTURE_REVISION}:${file}`);
  const baseline = git('show', `${ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR}:${file}`);
  const physical = physicalCandidateSource(file);
  assert.equal(physical, current, 'Physical director fixture source must remain exact: ' + file);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.deepEqual(Object.keys(pin).sort(),
    ['mode', 'currentSha256', 'currentBlob', 'baselineSha256', 'baselineBlob', 'contextLines', 'inverses'].sort());
  assert.equal(pin.contextLines, 3);
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
  assert.equal(git('rev-parse', `${ECONOMY_HARDENING_DIRECTOR_FIXTURE_REVISION}:${file}`).trim(), pin.currentBlob);
  assert.equal(git('rev-parse', `${ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR}:${file}`).trim(), pin.baselineBlob);
  assert.equal(git('ls-tree', ECONOMY_HARDENING_DIRECTOR_FIXTURE_REVISION, '--', file).trim().split(/\s+/)[0], pin.mode);
  assert.deepEqual(pin.inverses, inverseHunks(file, ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR,
    ECONOMY_HARDENING_DIRECTOR_FIXTURE_REVISION));
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const transfer = assertEconomyHardeningDirectorFixtureTransfer(file, input);
    assert.equal(transfer.baselineText, baseline); assert.equal(transfer.sourceOnly, true);
    assert.equal(transfer.sourceRevision, ECONOMY_HARDENING_DIRECTOR_FIXTURE_REVISION);
    assert.equal(transfer.predecessorRevision, ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR);
    assert.equal(economyHardeningSourceBaseline(file, input), baseline); positives++;
  }
  assert.equal(economyHardeningSourceBaseline(file, baseline), baseline); positives++;
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), Buffer.from(current), null]) {
    assert.throws(() => assertEconomyHardeningDirectorFixtureTransfer(file, changed));
    assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
  }
  for (const inverse of pin.inverses) {
    assert.equal(current.split(inverse.current).length - 1, 1,
      'Unique complete director fixture inverse required: ' + file);
    const changedInputs = [current.replace(inverse.current, ''),
      current.replace(inverse.current, () => inverse.current + inverse.current)];
    if (pin.inverses.length > 1) changedInputs.push(current.replace(inverse.current, () => inverse.baseline));
    changedInputs.push(current.replace(inverse.current, () => inverse.current.replace(/\S/, '?')));
    for (const changed of changedInputs) {
      assert.throws(() => assertEconomyHardeningDirectorFixtureTransfer(file, changed));
      assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
    }
    hunks++;
  }
}
for (const file of phase2TimeoutFiles) {
  const pin = ECONOMY_HARDENING_PHASE2_TIMEOUT_DOMAINS[file];
  const current = git('show', `${ECONOMY_HARDENING_PHASE2_TIMEOUT_REVISION}:${file}`);
  const baseline = git('show', `${ECONOMY_HARDENING_PHASE2_TIMEOUT_PREDECESSOR}:${file}`);
  const historical = files.includes(file) ? git('show', `${expectedPredecessor}:${file}`) : baseline;
  const physical = physicalCandidateSource(file);
  assert.equal(physical, current, 'Physical Phase 2 timeout source must remain exact: ' + file);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.deepEqual(Object.keys(pin).sort(),
    ['mode', 'currentSha256', 'currentBlob', 'baselineSha256', 'baselineBlob', 'contextLines', 'inverses'].sort());
  assert.equal(pin.contextLines, 3);
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
  assert.equal(git('rev-parse', `${ECONOMY_HARDENING_PHASE2_TIMEOUT_REVISION}:${file}`).trim(), pin.currentBlob);
  assert.equal(git('rev-parse', `${ECONOMY_HARDENING_PHASE2_TIMEOUT_PREDECESSOR}:${file}`).trim(), pin.baselineBlob);
  assert.equal(git('ls-tree', ECONOMY_HARDENING_PHASE2_TIMEOUT_REVISION, '--', file).trim().split(/\s+/)[0], pin.mode);
  assert.deepEqual(pin.inverses, inverseHunks(file, ECONOMY_HARDENING_PHASE2_TIMEOUT_PREDECESSOR,
    ECONOMY_HARDENING_PHASE2_TIMEOUT_REVISION));
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const transfer = assertEconomyHardeningPhase2TimeoutTransfer(file, input);
    assert.equal(transfer.baselineText, baseline); assert.equal(transfer.sourceOnly, true);
    assert.equal(transfer.sourceRevision, ECONOMY_HARDENING_PHASE2_TIMEOUT_REVISION);
    assert.equal(transfer.predecessorRevision, ECONOMY_HARDENING_PHASE2_TIMEOUT_PREDECESSOR);
    assert.equal(economyHardeningSourceBaseline(file, input), historical); positives++;
  }
  assert.equal(economyHardeningSourceBaseline(file, baseline), historical); positives++;
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), Buffer.from(current), null]) {
    assert.throws(() => assertEconomyHardeningPhase2TimeoutTransfer(file, changed));
    assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
  }
  for (const inverse of pin.inverses) {
    assert.equal(current.split(inverse.current).length - 1, 1,
      'Unique complete Phase 2 timeout inverse required: ' + file);
    const changedInputs = [current.replace(inverse.current, ''),
      current.replace(inverse.current, () => inverse.current + inverse.current)];
    if (pin.inverses.length > 1) changedInputs.push(current.replace(inverse.current, () => inverse.baseline));
    changedInputs.push(current.replace(inverse.current, () => inverse.current.replace(/\S/, '?')));
    for (const changed of changedInputs) {
      assert.throws(() => assertEconomyHardeningPhase2TimeoutTransfer(file, changed));
      assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
    }
    hunks++;
  }
}
for (const file of growthDeterminismFiles) {
  const pin = ECONOMY_HARDENING_GROWTH_DETERMINISM_DOMAINS[file];
  const current = git('show', `${ECONOMY_HARDENING_GROWTH_DETERMINISM_REVISION}:${file}`);
  const baseline = git('show', `${ECONOMY_HARDENING_GROWTH_DETERMINISM_PREDECESSOR}:${file}`);
  const historical = files.includes(file) ? git('show', `${expectedPredecessor}:${file}`) : baseline;
  const physical = physicalCandidateSource(file);
  assert.equal(physical, current, 'Physical growth determinism source must remain exact: ' + file);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.deepEqual(Object.keys(pin).sort(),
    ['mode', 'currentSha256', 'currentBlob', 'baselineSha256', 'baselineBlob', 'contextLines', 'inverses'].sort());
  assert.equal(pin.contextLines, 3);
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
  assert.equal(git('rev-parse', `${ECONOMY_HARDENING_GROWTH_DETERMINISM_REVISION}:${file}`).trim(), pin.currentBlob);
  assert.equal(git('rev-parse', `${ECONOMY_HARDENING_GROWTH_DETERMINISM_PREDECESSOR}:${file}`).trim(), pin.baselineBlob);
  assert.equal(git('ls-tree', ECONOMY_HARDENING_GROWTH_DETERMINISM_REVISION, '--', file).trim().split(/\s+/)[0],
    pin.mode);
  assert.deepEqual(pin.inverses, inverseHunks(file, ECONOMY_HARDENING_GROWTH_DETERMINISM_PREDECESSOR,
    ECONOMY_HARDENING_GROWTH_DETERMINISM_REVISION));
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const transfer = assertEconomyHardeningGrowthDeterminismTransfer(file, input);
    assert.equal(transfer.baselineText, baseline); assert.equal(transfer.sourceOnly, true);
    assert.equal(transfer.sourceRevision, ECONOMY_HARDENING_GROWTH_DETERMINISM_REVISION);
    assert.equal(transfer.predecessorRevision, ECONOMY_HARDENING_GROWTH_DETERMINISM_PREDECESSOR);
    assert.equal(economyHardeningSourceBaseline(file, input), historical); positives++;
  }
  assert.equal(economyHardeningSourceBaseline(file, baseline), historical); positives++;
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), Buffer.from(current), null]) {
    assert.throws(() => assertEconomyHardeningGrowthDeterminismTransfer(file, changed));
    assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
  }
  for (const inverse of pin.inverses) {
    assert.equal(current.split(inverse.current).length - 1, 1,
      'Unique complete growth determinism inverse required: ' + file);
    const changedInputs = [current.replace(inverse.current, ''),
      current.replace(inverse.current, () => inverse.current + inverse.current)];
    if (pin.inverses.length > 1) changedInputs.push(current.replace(inverse.current, () => inverse.baseline));
    changedInputs.push(current.replace(inverse.current, () => inverse.current.replace(/\S/, '?')));
    for (const changed of changedInputs) {
      assert.throws(() => assertEconomyHardeningGrowthDeterminismTransfer(file, changed));
      assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
    }
    hunks++;
  }
}
for (const file of campaignExpiryFiles) {
  const pin = ECONOMY_HARDENING_CAMPAIGN_EXPIRY_DOMAINS[file];
  const current = git('show', ECONOMY_HARDENING_CAMPAIGN_EXPIRY_REVISION + ':' + file);
  const baseline = git('show', ECONOMY_HARDENING_CAMPAIGN_EXPIRY_PREDECESSOR + ':' + file);
  const historical = files.includes(file) ? git('show', expectedPredecessor + ':' + file)
    : repairFiles.includes(file) ? git('show', ECONOMY_HARDENING_REPAIR_PREDECESSOR + ':' + file) : baseline;
  const physical = physicalCandidateSource(file);
  assert.equal(physical, current, 'Physical campaign expiry source must remain exact: ' + file);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.deepEqual(Object.keys(pin).sort(),
    ['mode', 'currentSha256', 'currentBlob', 'baselineSha256', 'baselineBlob', 'contextLines', 'inverses'].sort());
  assert.equal(pin.contextLines, 3);
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
  assert.equal(git('rev-parse', ECONOMY_HARDENING_CAMPAIGN_EXPIRY_REVISION + ':' + file).trim(), pin.currentBlob);
  assert.equal(git('rev-parse', ECONOMY_HARDENING_CAMPAIGN_EXPIRY_PREDECESSOR + ':' + file).trim(), pin.baselineBlob);
  assert.equal(git('ls-tree', ECONOMY_HARDENING_CAMPAIGN_EXPIRY_REVISION, '--', file).trim().split(/\s+/)[0],
    pin.mode);
  assert.deepEqual(pin.inverses, inverseHunks(file, ECONOMY_HARDENING_CAMPAIGN_EXPIRY_PREDECESSOR,
    ECONOMY_HARDENING_CAMPAIGN_EXPIRY_REVISION));
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const transfer = assertEconomyHardeningCampaignExpiryTransfer(file, input);
    assert.equal(transfer.baselineText, baseline); assert.equal(transfer.sourceOnly, true);
    assert.equal(transfer.sourceRevision, ECONOMY_HARDENING_CAMPAIGN_EXPIRY_REVISION);
    assert.equal(transfer.predecessorRevision, ECONOMY_HARDENING_CAMPAIGN_EXPIRY_PREDECESSOR);
    assert.equal(economyHardeningSourceBaseline(file, input), historical); positives++;
  }
  assert.equal(economyHardeningSourceBaseline(file, baseline), historical); positives++;
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), Buffer.from(current), null]) {
    assert.throws(() => assertEconomyHardeningCampaignExpiryTransfer(file, changed));
    assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
  }
  for (const inverse of pin.inverses) {
    assert.equal(current.split(inverse.current).length - 1, 1,
      'Unique complete campaign expiry inverse required: ' + file);
    const changedInputs = [current.replace(inverse.current, ''),
      current.replace(inverse.current, () => inverse.current + inverse.current)];
    if (pin.inverses.length > 1) changedInputs.push(current.replace(inverse.current, () => inverse.baseline));
    changedInputs.push(current.replace(inverse.current, () => inverse.current.replace(/\S/, '?')));
    for (const changed of changedInputs) {
      assert.throws(() => assertEconomyHardeningCampaignExpiryTransfer(file, changed));
      assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
    }
    hunks++;
  }
}
for (const file of commerceAdmissionFiles) {
  const pin = ECONOMY_HARDENING_COMMERCE_ADMISSION_DOMAINS[file];
  const current = git('show', ECONOMY_HARDENING_COMMERCE_ADMISSION_REVISION + ':' + file);
  const baseline = git('show', ECONOMY_HARDENING_COMMERCE_ADMISSION_PREDECESSOR + ':' + file);
  const physical = physicalCandidateSource(file);
  assert.equal(physical, current, 'Physical commerce admission source must remain exact: ' + file);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.deepEqual(Object.keys(pin).sort(),
    ['mode', 'currentSha256', 'currentBlob', 'baselineSha256', 'baselineBlob', 'contextLines', 'inverses'].sort());
  assert.equal(pin.contextLines, 3);
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
  assert.equal(git('rev-parse', ECONOMY_HARDENING_COMMERCE_ADMISSION_REVISION + ':' + file).trim(), pin.currentBlob);
  assert.equal(git('rev-parse', ECONOMY_HARDENING_COMMERCE_ADMISSION_PREDECESSOR + ':' + file).trim(), pin.baselineBlob);
  assert.equal(git('ls-tree', ECONOMY_HARDENING_COMMERCE_ADMISSION_REVISION, '--', file).trim().split(/\s+/)[0],
    pin.mode);
  assert.deepEqual(pin.inverses, inverseHunks(file, ECONOMY_HARDENING_COMMERCE_ADMISSION_PREDECESSOR,
    ECONOMY_HARDENING_COMMERCE_ADMISSION_REVISION));
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const transfer = assertEconomyHardeningCommerceAdmissionTransfer(file, input);
    assert.equal(transfer.baselineText, baseline); assert.equal(transfer.sourceOnly, true);
    assert.equal(transfer.sourceRevision, ECONOMY_HARDENING_COMMERCE_ADMISSION_REVISION);
    assert.equal(transfer.predecessorRevision, ECONOMY_HARDENING_COMMERCE_ADMISSION_PREDECESSOR);
    assert.equal(economyHardeningSourceBaseline(file, input), baseline); positives++;
  }
  assert.equal(economyHardeningSourceBaseline(file, baseline), baseline); positives++;
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), Buffer.from(current), null]) {
    assert.throws(() => assertEconomyHardeningCommerceAdmissionTransfer(file, changed));
    assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
  }
  for (const inverse of pin.inverses) {
    assert.equal(current.split(inverse.current).length - 1, 1,
      'Unique complete commerce admission inverse required: ' + file);
    const changedInputs = [current.replace(inverse.current, ''),
      current.replace(inverse.current, () => inverse.current + inverse.current)];
    if (pin.inverses.length > 1) changedInputs.push(current.replace(inverse.current, () => inverse.baseline));
    changedInputs.push(current.replace(inverse.current, () => inverse.current.replace(/\S/, '?')));
    for (const changed of changedInputs) {
      assert.throws(() => assertEconomyHardeningCommerceAdmissionTransfer(file, changed));
      assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
    }
    hunks++;
  }
}
for (const file of bindingFiles) {
  const pin = ECONOMY_HARDENING_BINDING_DOMAINS[file], rawPhysical = physicalCandidateSource(file);
  const physical = releaseTailFiles.includes(file)
    ? assertEconomyReleaseTailTransfer(file, rawPhysical).baselineText : rawPhysical;
  const current = successorFiles.includes(file)
    ? assertEconomyHardeningBindingSuccessorTransfer(file, physical).baselineText : physical;
  const baseline = git('show', `${expectedRevision}:${file}`);
  const historical = files.includes(file) ? git('show', `${expectedPredecessor}:${file}`) : baseline;
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
  assert.equal(git('rev-parse', `${expectedRevision}:${file}`).trim(), pin.baselineBlob);
  assert.equal(git('ls-tree', expectedRevision, '--', file).trim().split(/\s+/)[0], pin.mode);
  const bindingTip = successorFiles.includes(file)
    ? ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR : ECONOMY_UX_MERGE_SOURCE.candidateParentRevision;
  assert.deepEqual(pin.inverses, inverseHunks(file, expectedRevision, bindingTip));
  const transfer = assertEconomyHardeningBindingTransfer(file, current);
  assert.equal(transfer.baselineText, baseline); assert.equal(transfer.sourceOnly, true);
  assert.equal(economyHardeningSourceBaseline(file, current), historical);
  assert.equal(economyHardeningSourceBaseline(file, current.replaceAll('\n', '\r\n')), historical);
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0', Buffer.from(current)]) {
    assert.throws(() => assertEconomyHardeningBindingTransfer(file, changed));
    assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
  }
  positives += 2; hunks += pin.inverses.length;
}
for (const file of successorFiles) {
  const pin = ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS[file];
  const current = git('show', `${ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION}:${file}`);
  const baseline = git('show', `${ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR}:${file}`);
  const rawPhysical = physicalCandidateSource(file);
  const physical = releaseTailFiles.includes(file)
    ? assertEconomyReleaseTailTransfer(file, rawPhysical).baselineText : rawPhysical;
  assert.equal(physical, current, 'Physical successor source must remain exact: ' + file);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.deepEqual(Object.keys(pin).sort(),
    ['mode', 'currentSha256', 'currentBlob', 'baselineSha256', 'baselineBlob', 'contextLines', 'inverses'].sort());
  assert.equal(pin.contextLines, 3);
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
  assert.equal(git('rev-parse', `${ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION}:${file}`).trim(), pin.currentBlob);
  assert.equal(git('rev-parse', `${ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR}:${file}`).trim(), pin.baselineBlob);
  assert.equal(git('ls-tree', ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION, '--', file).trim().split(/\s+/)[0], pin.mode);
  assert.deepEqual(pin.inverses, inverseHunks(file, ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR,
    ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION));
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const transfer = assertEconomyHardeningBindingSuccessorTransfer(file, input);
    assert.equal(transfer.baselineText, baseline); assert.equal(transfer.sourceOnly, true);
    assert.equal(transfer.sourceRevision, ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION);
    assert.equal(transfer.predecessorRevision, ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR);
    positives++;
  }
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), Buffer.from(current), null]) {
    assert.throws(() => assertEconomyHardeningBindingSuccessorTransfer(file, changed));
    assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
  }
  for (const inverse of pin.inverses) {
    assert.equal(current.split(inverse.current).length - 1, 1, 'Unique complete successor inverse required: ' + file);
    for (const changed of [current.replace(inverse.current, ''),
      current.replace(inverse.current, () => inverse.current + inverse.current),
      current.replace(inverse.current, () => inverse.baseline),
      current.replace(inverse.current, () => inverse.current.replace(/\S/, '?'))]) {
      assert.throws(() => assertEconomyHardeningBindingSuccessorTransfer(file, changed));
      assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
    }
    hunks++;
  }
}
for (const file of ['__proto__', 'src/unknown.js', 'schema.sql.extra']) {
  const text = 'unknown\r\nbytes\n';
  assert.throws(() => assertEconomyHardeningSourceTransfer(file, text));
  assert.throws(() => assertEconomyHardeningBindingSuccessorTransfer(file, text));
  assert.throws(() => assertEconomyHardeningRepairTransfer(file, text));
  assert.throws(() => assertEconomyHardeningRepairSuccessorTransfer(file, text));
  assert.throws(() => assertEconomyHardeningReleaseRepairTransfer(file, text));
  assert.throws(() => assertEconomyHardeningDirectorFixtureTransfer(file, text));
  assert.throws(() => assertEconomyHardeningPhase2TimeoutTransfer(file, text));
  assert.throws(() => assertEconomyHardeningGrowthDeterminismTransfer(file, text));
  assert.throws(() => assertEconomyHardeningCampaignExpiryTransfer(file, text));
  assert.throws(() => assertEconomyHardeningCommerceAdmissionTransfer(file, text));
  assert.throws(() => assertEconomyReleaseTailTransfer(file, text));
  assert.equal(economyHardeningSourceBaseline(file, text), text); refusals++;
}
assert.equal(positives, 645, 'positive control count drifted');
assert.equal(refusals, 1533, 'refusal control count drifted');
assert.equal(hunks, 436, 'inverse-hunk control count drifted');
console.log(`Economy-hardening exact source transfer PASS: ${positives} positives, ${refusals} refusals, ${hunks} inverse hunks; historical pins unchanged`);
