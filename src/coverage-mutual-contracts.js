// Equal, explicit game-cash capital; one prospective equipment policy per original.
export const COVERAGE_MUTUAL = Object.freeze({ members: 2, maximumContribution: 1000,
  maximumPolicies: 2, maximumClaims: 2, maximumPolicySeconds: 3600, invitationSeconds: 300,
  product: 'member_funded_equipment_underwriting_loss', underlying: 'one_owned_belladonna_maintenance_fee' });

export const coverageMutualDDL = `
CREATE TABLE IF NOT EXISTS coverage_mutual_pools (
 id TEXT PRIMARY KEY, creator_account TEXT NOT NULL REFERENCES accounts(id), creator_character TEXT NOT NULL REFERENCES characters(id),
 partner_account TEXT NOT NULL REFERENCES accounts(id), partner_character TEXT NOT NULL REFERENCES characters(id),
 contribution_cash INT NOT NULL CHECK(contribution_cash BETWEEN 1 AND 1000),
 deductible_cash INT NOT NULL CHECK(deductible_cash BETWEEN 1 AND contribution_cash),
 creator_policy TEXT NOT NULL REFERENCES equipment_insurance_policies(id), partner_policy TEXT NOT NULL REFERENCES equipment_insurance_policies(id),
 policy_sources JSONB NOT NULL, source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64),
 state TEXT NOT NULL CHECK(state IN ('offered','active','closed')), created_at TIMESTAMPTZ NOT NULL,
 offer_expires_at TIMESTAMPTZ NOT NULL, activated_at TIMESTAMPTZ, closed_at TIMESTAMPTZ, close_reason TEXT,
 contributed_cash INT NOT NULL CHECK(contributed_cash BETWEEN 1 AND 2000), reserve_cash INT NOT NULL CHECK(reserve_cash BETWEEN 0 AND 2000),
 paid_cash INT NOT NULL DEFAULT 0 CHECK(paid_cash BETWEEN 0 AND 2000), refunded_cash INT NOT NULL DEFAULT 0 CHECK(refunded_cash BETWEEN 0 AND 2000),
 closure JSONB, CHECK(creator_account<>partner_account AND creator_character<>partner_character AND creator_policy<>partner_policy),
 CHECK(contributed_cash=reserve_cash+paid_cash+refunded_cash), CHECK(state<>'closed' OR reserve_cash=0));
CREATE TABLE IF NOT EXISTS coverage_mutual_positions (
 pool_id TEXT NOT NULL REFERENCES coverage_mutual_pools(id), original_account TEXT NOT NULL REFERENCES accounts(id),
 original_character TEXT NOT NULL REFERENCES characters(id), contribution_cash INT NOT NULL CHECK(contribution_cash BETWEEN 1 AND 1000),
 contribution_id TEXT NOT NULL UNIQUE REFERENCES transactions(id), state TEXT NOT NULL CHECK(state IN ('funded','released')),
 refunded_cash INT NOT NULL DEFAULT 0 CHECK(refunded_cash BETWEEN 0 AND contribution_cash), refund_id TEXT UNIQUE REFERENCES transactions(id),
 PRIMARY KEY(pool_id,original_character));
CREATE UNIQUE INDEX IF NOT EXISTS coverage_mutual_one_funded_position ON coverage_mutual_positions(original_character) WHERE state='funded';
CREATE TABLE IF NOT EXISTS coverage_mutual_enrollments (
 policy_id TEXT PRIMARY KEY REFERENCES equipment_insurance_policies(id), pool_id TEXT NOT NULL REFERENCES coverage_mutual_pools(id),
 member_account TEXT NOT NULL REFERENCES accounts(id), member_character TEXT NOT NULL REFERENCES characters(id),
 source JSONB NOT NULL, source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64), enrolled_at TIMESTAMPTZ NOT NULL,
 UNIQUE(pool_id,member_character));
CREATE TABLE IF NOT EXISTS coverage_mutual_claims (
 policy_id TEXT PRIMARY KEY REFERENCES coverage_mutual_enrollments(policy_id), pool_id TEXT NOT NULL REFERENCES coverage_mutual_pools(id),
 repair_id TEXT NOT NULL UNIQUE REFERENCES equipment_maintenance_repairs(id), wear_event_id TEXT NOT NULL UNIQUE REFERENCES item_durability_uses(event_id),
 canonical_payout_id TEXT NOT NULL UNIQUE REFERENCES transactions(id), member_account TEXT NOT NULL REFERENCES accounts(id),
 member_character TEXT NOT NULL REFERENCES characters(id), gross_payout_cash INT NOT NULL CHECK(gross_payout_cash BETWEEN 1 AND 1000),
 premium_cash INT NOT NULL CHECK(premium_cash BETWEEN 1 AND 1000), deductible_cash INT NOT NULL CHECK(deductible_cash BETWEEN 1 AND 1000),
 payout_cash INT NOT NULL CHECK(payout_cash BETWEEN 1 AND 1000), payout_id TEXT NOT NULL UNIQUE REFERENCES transactions(id),
 source JSONB NOT NULL, source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64), created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS coverage_mutual_requests (
 account_id TEXT NOT NULL REFERENCES accounts(id), request_key TEXT NOT NULL, action TEXT NOT NULL CHECK(action IN ('open','join','claim','close','estate_close')),
 identity JSONB NOT NULL, request_hash TEXT NOT NULL CHECK(char_length(request_hash)=64), receipt JSONB NOT NULL,
 PRIMARY KEY(account_id,request_key));`;

const text = { type: 'string', pattern: '^[A-Za-z0-9_-]{1,128}$' };
const hash = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const consent = { const: true };
const closed = properties => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
export const COVERAGE_MUTUAL_SCHEMAS = Object.freeze({
  CoverageMutualOpenBody: closed({ partnerCharacterId: text, creatorPolicyId: text, partnerPolicyId: text,
    contributionCash: { type: 'integer', minimum: 1, maximum: 1000 }, deductibleCash: { type: 'integer', minimum: 1, maximum: 1000 }, consent }),
  CoverageMutualJoinBody: closed({ poolId: text, sourceHash: hash, contributionCash: { type: 'integer', minimum: 1, maximum: 1000 },
    deductibleCash: { type: 'integer', minimum: 1, maximum: 1000 }, consent }),
  CoverageMutualClaimBody: closed({ poolId: text, sourceHash: hash, policyId: text, consent }),
  CoverageMutualCloseBody: closed({ poolId: text, sourceHash: hash, consent }),
});

const n = (minimum, maximum) => ({ type: 'integer', minimum, maximum });
const nullable = x => ({ anyOf: [x, { type: 'null' }] });
const date = { type: 'string', format: 'date-time' };
const refund = closed({ originalCharacter: text, originalAccount: text, amount: n(0, 1000), refundId: nullable(text) });
const claim = { ...closed({ policyId: text, payoutCash: n(1, 1000), grossPayoutCash: n(1, 1000), premiumCash: n(1, 1000),
  deductibleCash: n(1, 1000), alreadyPaid: { const: true } }), required: ['policyId','payoutCash','grossPayoutCash','premiumCash','deductibleCash'] };
const pool = closed({ id: text, state: { enum: ['offered','active','closed'] }, sourceHash: hash,
  creatorCharacterId: text, partnerCharacterId: text, creatorPolicyId: text, partnerPolicyId: text,
  contributionCash: n(1, 1000), deductibleCash: n(1, 1000), maximumBenefitCashPerMember: n(1, 1000),
  reserveCash: n(0, 2000), paidCash: n(0, 2000), refundedCash: n(0, 2000), offerExpiresAt: date,
  activatedAt: nullable(date), closedAt: nullable(date), closeReason: nullable({ enum: ['creator_cancelled','risk_resolved','member_death'] }),
  product: { const: COVERAGE_MUTUAL.product } });
const replayable = properties => ({ ...closed({ ...properties, replayed: { const: true } }), required: Object.keys(properties) });
export const COVERAGE_MUTUAL_RESPONSE_SCHEMAS = Object.freeze({
  CoverageMutualPool: pool,
  CoverageMutualBoard: closed({ pools: { type: 'array', maxItems: 50, items: pool }, product: { const: COVERAGE_MUTUAL.product } }),
  CoverageMutualPoolReceipt: replayable({ pool }),
  CoverageMutualClaimReceipt: replayable({ poolId: text, claim }),
  CoverageMutualCloseReceipt: replayable({ poolId: text, closed: { const: true }, settled: { type: 'array', maxItems: 2, items: claim },
    refunds: { type: 'array', minItems: 1, maxItems: 2, items: refund }, reason: { enum: ['creator_cancelled','risk_resolved','member_death'] }, closureHash: hash }),
});
const key = { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', minLength: 1, maxLength: 200, not: { pattern: '^estate:' } } };
const contract = (operationId, response, body) => ({ operationId, responseSchema: { $ref: '#/components/schemas/' + response },
  ...(body ? { requestSchema: COVERAGE_MUTUAL_SCHEMAS[body], requestParameters: [key] } : {}) });
export const COVERAGE_MUTUAL_CONTRACTS = Object.freeze({
  'GET /v1/company/coverage-mutuals': contract('readCoverageMutuals', 'CoverageMutualBoard'),
  'POST /v1/company/coverage-mutuals': contract('openCoverageMutual', 'CoverageMutualPoolReceipt', 'CoverageMutualOpenBody'),
  'POST /v1/company/coverage-mutuals/join': contract('joinCoverageMutual', 'CoverageMutualPoolReceipt', 'CoverageMutualJoinBody'),
  'POST /v1/company/coverage-mutuals/claim': contract('claimCoverageMutual', 'CoverageMutualClaimReceipt', 'CoverageMutualClaimBody'),
  'POST /v1/company/coverage-mutuals/close': contract('closeCoverageMutual', 'CoverageMutualCloseReceipt', 'CoverageMutualCloseBody'),
});
