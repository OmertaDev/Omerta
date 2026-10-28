// Generated exact source-only envelope for bank-interest request-frequency hardening.
// Historical pins remain unchanged; unknown or non-exact bytes pass through.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export const ECONOMY_BANK_INTEREST_HARDENING_REVISION = "9afbb9b78c22876dbe8d8e0b41c3b78fc2212d4a";
export const ECONOMY_BANK_INTEREST_HARDENING_TREE = "517d2e04218d70a105959831460e886b95350873";
export const ECONOMY_BANK_INTEREST_HARDENING_PREDECESSOR = "b933d6e2cf86e3b756e092496e41d3c848eea3cb";
export const ECONOMY_BANK_INTEREST_HARDENING_PREDECESSOR_TREE = "989a0cf2d309e61171f07f6e6eadb00c0d35f39f";
export const ECONOMY_BANK_INTEREST_HARDENING_PHASE = 'exact-bank-interest-request-frequency-hardening-source-transfer-only; no historical runtime, native, migration, financial, activation or deployment clearance';
export const ECONOMY_BANK_INTEREST_HARDENING_DOMAINS = {
  "src/accrual.js": {
    "mode": "100644",
    "currentSha256": "ff99ed4d9194ce09c32aa5f8811665db13e58703bd7d27210761d96701dcc2cd",
    "currentBlob": "46e33a86e875eecc148ae7418923edc00f143f15",
    "currentBytes": 15605,
    "baselineSha256": "7a2d1e0be61b02dc939614ac31be2741be3e085ff0d8691a9aa3f5296836c51c",
    "baselineBlob": "96f6b6d074e7104021834755cb686b267b7e31ed",
    "baselineBytes": 14426,
    "contextLines": 3,
    "inverses": [
      {
        "current": "         assetIncome, assetEnergyCap, drugOf, crewCold, envelopeActive, foundationBleedMult , seasonModOf, KITCHEN, M4, PACING, pathFx, racketIncomeLeveled,\n         energyCapOf, nerveCapOf, ladderFx } from './rules.js';\n\n// Apply the configured bank return as a partition-invariant time evolution. The old linear step used\n// the newly-grown balance as principal on the next touch, so splitting one eligible window across many\n// requests paid more than settling it once. These two closed forms preserve the exact configured\n// 12-hour map on either side of the taper and compose to the same result for every partition.\nfunction bankAfterInterest(principal, eligibleMs) {\n  const elapsedPeriods = eligibleMs / CONSTANTS.BANK_PERIOD_MS;\n  if (!(principal > 0) || !(elapsedPeriods > 0) || !(CONSTANTS.BANK_RATE > 0)) return principal;\n\n  const threshold = CONSTANTS.BANK_TAPER_ABOVE;\n  const keep = CONSTANTS.BANK_TAPER_KEEP;\n  const belowBase = 1 + CONSTANTS.BANK_RATE;\n  const above = (bank, periods) => {\n    if (!(periods > 0)) return bank;\n    if (!(keep > 0)) return bank + threshold * CONSTANTS.BANK_RATE * periods;\n    const anchor = threshold * (1 - keep) / keep;\n    return (bank + anchor) * Math.pow(1 + CONSTANTS.BANK_RATE * keep, periods) - anchor;\n  };\n\n  if (!(threshold > 0) || principal >= threshold) return above(principal, elapsedPeriods);\n  const periodsToThreshold = Math.log(threshold / principal) / Math.log(belowBase);\n  if (elapsedPeriods <= periodsToThreshold) return principal * Math.pow(belowBase, elapsedPeriods);\n  return above(threshold, elapsedPeriods - periodsToThreshold);\n}\n\n\n// ch is the character row (mutated in place); acct is account_persistent (mutated);\n// ctx carries the owned racket/asset id lists (income) and ctx.held — the district\n",
        "baseline": "         assetIncome, assetEnergyCap, drugOf, crewCold, envelopeActive, foundationBleedMult , seasonModOf, KITCHEN, M4, PACING, pathFx, racketIncomeLeveled,\n         energyCapOf, nerveCapOf, ladderFx } from './rules.js';\n\n\n// ch is the character row (mutated in place); acct is account_persistent (mutated);\n// ctx carries the owned racket/asset id lists (income) and ctx.held — the district\n"
      },
      {
        "current": "  // BALANCE D5 (founder override of the prototype flat rate): interest TAPERS at whale scale —\n  // the full rate on the first BANK_TAPER_ABOVE, BANK_TAPER_KEEP of it beyond. The bank stops\n  // being the game's only unbounded exponential; street money out-earns vault money at the top.\n  ch.bank = bankAfterInterest(bankBefore, bankEligibleMs);\n  ch._bankInterest = Number(ch.bank) - bankBefore;\n\n  // §7.1 racket + front income — capped at the 8h offline window, never minted\n",
        "baseline": "  // BALANCE D5 (founder override of the prototype flat rate): interest TAPERS at whale scale —\n  // the full rate on the first BANK_TAPER_ABOVE, BANK_TAPER_KEEP of it beyond. The bank stops\n  // being the game's only unbounded exponential; street money out-earns vault money at the top.\n  const effPrincipal = Math.min(bankBefore, CONSTANTS.BANK_TAPER_ABOVE)\n    + Math.max(0, bankBefore - CONSTANTS.BANK_TAPER_ABOVE) * CONSTANTS.BANK_TAPER_KEEP;\n  ch.bank = bankBefore + effPrincipal * CONSTANTS.BANK_RATE * (bankEligibleMs / CONSTANTS.BANK_PERIOD_MS);\n  ch._bankInterest = Number(ch.bank) - bankBefore;\n\n  // §7.1 racket + front income — capped at the 8h offline window, never minted\n"
      }
    ]
  },
  "test/economy-balance.js": {
    "mode": "100644",
    "currentSha256": "c463978a6796b940404673bb1bf8e46387420c15bc04ebc48e1e8d560c916a18",
    "currentBlob": "f30beb86c5465bb9690efdc7f55c2b9740e79435",
    "currentBytes": 17417,
    "baselineSha256": "d9477d68d82ada9675dec3db260623175c9fc84fdbccce7797b7c88479139b27",
    "baselineBlob": "3ff9523045e20fb92711e1cdec8c5b303a418dca",
    "baselineBytes": 16125,
    "contextLines": 3,
    "inverses": [
      {
        "current": "  return { units, proceeds, credit: Number(f.ch.crew_sale_credit_ms) };\n}\n\nfunction bankAdvance(bank, steps) {\n  const ch = { respect: 0, energy: 0, nerve: 0, health: 100, cash: 0, bank, heat: 0, crew: 0,\n    last_accrued_at: new Date(start), bank_credit_ms: 0, racket_credit_ms: 0 };\n  let elapsed = 0;\n  for (const ms of steps) {\n    elapsed += ms;\n    accrue(ch, null, { preview: true, stash: [], rackets: [], assets: [], held: [] }, new Date(start + elapsed));\n  }\n  return { bank: Number(ch.bank), credit: Number(ch.bank_credit_ms) };\n}\n\n// Bank returns depend on elapsed eligible time, never request count. An empty daily bucket makes a\n// two-hour real window exactly one eligible hour; one settlement and 7,200 one-second touches must\n// therefore agree below, through, and above the whale taper.\nfor (const principal of [1_000_000, 9_990_000, 30_000_000]) {\n  const once = bankAdvance(principal, [2 * 3600000]);\n  const split = bankAdvance(principal, Array(7200).fill(1000));\n  assert.equal(split.credit, once.credit, `bank credit is partition-invariant at $${principal}`);\n  assert(Math.abs(split.bank - once.bank) < 0.001,\n    `splitting bank accrual cannot change its return at $${principal}: ${split.bank} vs ${once.bank}`);\n  assert(split.bank <= once.bank + 0.001, `splitting bank accrual cannot create a request-frequency bonus at $${principal}`);\n}\n\nassert.deepEqual(advance(fixture(), Array(60).fill(1000)), advance(fixture(), [minute]),\n  'splitting one minute into requests cannot create extra work');\nlet seed = 0x21c001d;\n",
        "baseline": "  return { units, proceeds, credit: Number(f.ch.crew_sale_credit_ms) };\n}\n\nassert.deepEqual(advance(fixture(), Array(60).fill(1000)), advance(fixture(), [minute]),\n  'splitting one minute into requests cannot create extra work');\nlet seed = 0x21c001d;\n"
      }
    ]
  }
};
for (const pin of Object.values(ECONOMY_BANK_INTEREST_HARDENING_DOMAINS)) {
  for (const inverse of pin.inverses) Object.freeze(inverse);
  Object.freeze(pin.inverses); Object.freeze(pin);
}
Object.freeze(ECONOMY_BANK_INTEREST_HARDENING_DOMAINS);
const lf = text => text.replaceAll('\r\n', '\n');
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const uniform = text => typeof text === 'string' && (text === lf(text) || text === lf(text).replaceAll('\n', '\r\n'));

export function assertEconomyBankInterestHardeningSourceTransfer(file, input) {
  assert(Object.hasOwn(ECONOMY_BANK_INTEREST_HARDENING_DOMAINS, file),
    'Unknown bank-interest hardening source domain');
  assert(uniform(input), 'Uniform whole bank-interest hardening LF/CRLF source text required');
  const pin = ECONOMY_BANK_INTEREST_HARDENING_DOMAINS[file], text = lf(input);
  assert.equal(sha256(text), pin.currentSha256, 'Complete bank-interest hardening source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete bank-interest hardening blob drift: ' + file);
  assert.equal(Buffer.byteLength(text), pin.currentBytes);
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length);
    assert.equal(baselineText.split(inverse.current).length - 1, 1,
      'Missing or duplicate bank-interest hardening inverse: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha256(baselineText), pin.baselineSha256,
    'Complete bank-interest hardening predecessor source mismatch: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob,
    'Complete bank-interest hardening predecessor blob mismatch: ' + file);
  assert.equal(Buffer.byteLength(baselineText), pin.baselineBytes);
  return Object.freeze({ file, baselineText, postimageSha256: pin.currentSha256,
    sourceRevision: ECONOMY_BANK_INTEREST_HARDENING_REVISION,
    predecessorRevision: ECONOMY_BANK_INTEREST_HARDENING_PREDECESSOR,
    inverseChunks: pin.inverses.length, phase: ECONOMY_BANK_INTEREST_HARDENING_PHASE,
    sourceOnly: true, runtime: false, native: false });
}

export function economyBankInterestHardeningHistoricalInput(file, input) {
  if (!Object.hasOwn(ECONOMY_BANK_INTEREST_HARDENING_DOMAINS, file)) return input;
  const pin = ECONOMY_BANK_INTEREST_HARDENING_DOMAINS[file];
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical source only');
  if (!uniform(text) || sha256(lf(text)) !== pin.currentSha256) return input;
  const baseline = assertEconomyBankInterestHardeningSourceTransfer(file, text).baselineText;
  return buffer ? Buffer.from(baseline) : baseline;
}
