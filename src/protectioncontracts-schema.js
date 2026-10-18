// Closed N28 declaration; shared schema, migration and invariant wiring is coordinator-owned.
export const protectionContractsDDL = `
CREATE TABLE IF NOT EXISTS protection_contracts (
 id TEXT PRIMARY KEY,
 campaign_id TEXT NOT NULL REFERENCES commercial_campaigns(id),
 campaign_source_hash TEXT NOT NULL CHECK(char_length(campaign_source_hash)=64),
 courier_id TEXT NOT NULL REFERENCES multi_hop_couriers(id),
 courier_source_hash TEXT NOT NULL CHECK(char_length(courier_source_hash)=64),
 item_id TEXT NOT NULL REFERENCES item_instances(id),
 leg TEXT NOT NULL CHECK(leg IN ('first_leg','second_leg')),
 payer_account TEXT NOT NULL REFERENCES accounts(id), payer_character TEXT NOT NULL REFERENCES characters(id),
 protected_account TEXT NOT NULL REFERENCES accounts(id), protected_character TEXT NOT NULL REFERENCES characters(id),
 guard_account TEXT NOT NULL REFERENCES accounts(id), guard_character TEXT NOT NULL REFERENCES characters(id),
 source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64), source_snapshot JSONB NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('funded','accepted','blocked','activated','refunded','expired')),
 price_cash INT NOT NULL CHECK(price_cash BETWEEN 10000 AND 100000),
 remaining_cash INT NOT NULL CHECK(remaining_cash>=0), paid_cash INT NOT NULL DEFAULT 0 CHECK(paid_cash>=0),
 refunded_cash INT NOT NULL DEFAULT 0 CHECK(refunded_cash>=0),
 reserve_transaction TEXT NOT NULL UNIQUE REFERENCES transactions(id),
 release_transaction TEXT UNIQUE REFERENCES transactions(id), refund_transaction TEXT UNIQUE REFERENCES transactions(id),
 guard_payer_journal TEXT UNIQUE REFERENCES transactions(id), guard_payee_journal TEXT UNIQUE REFERENCES transactions(id),
 coverage_until TIMESTAMPTZ, coverage_proof JSONB,
 created_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL CHECK(expires_at>created_at),
 accepted_at TIMESTAMPTZ, activated_at TIMESTAMPTZ, closed_at TIMESTAMPTZ,
 closure_reason TEXT CHECK(closure_reason IS NULL OR closure_reason IN
 ('payer_refund','source_expiry','guard_withdraw','guard_death','payer_estate','stale_source','service_purchased')),
 CHECK(payer_account=protected_account AND payer_character=protected_character),
 CHECK(payer_account<>guard_account AND payer_character<>guard_character),
 CHECK(guard_payer_journal IS NULL OR guard_payer_journal<>guard_payee_journal),
 CHECK(coverage_until IS NULL OR coverage_until>activated_at),
 CHECK(price_cash=remaining_cash+paid_cash+refunded_cash),
 CHECK((state IN ('funded','accepted','blocked') AND remaining_cash=price_cash AND paid_cash=0 AND refunded_cash=0
 AND release_transaction IS NULL AND refund_transaction IS NULL AND guard_payer_journal IS NULL
 AND guard_payee_journal IS NULL AND coverage_until IS NULL AND coverage_proof IS NULL AND activated_at IS NULL)
 OR (state='activated' AND remaining_cash=0 AND paid_cash=price_cash AND refunded_cash=0
 AND release_transaction IS NOT NULL AND refund_transaction IS NULL AND guard_payer_journal IS NOT NULL
 AND guard_payee_journal IS NOT NULL AND coverage_until IS NOT NULL AND coverage_proof IS NOT NULL
 AND activated_at IS NOT NULL AND accepted_at IS NOT NULL AND closed_at IS NOT NULL AND closure_reason='service_purchased')
 OR (state IN ('refunded','expired') AND remaining_cash=0 AND paid_cash=0 AND refunded_cash=price_cash
 AND release_transaction IS NULL AND refund_transaction IS NOT NULL AND guard_payer_journal IS NULL
 AND guard_payee_journal IS NULL AND coverage_until IS NULL AND coverage_proof IS NULL
 AND activated_at IS NULL AND closed_at IS NOT NULL AND closure_reason IS NOT NULL)),
 CHECK(state<>'funded' OR (accepted_at IS NULL AND closed_at IS NULL AND closure_reason IS NULL)),
 CHECK(state<>'accepted' OR (accepted_at IS NOT NULL AND closed_at IS NULL AND closure_reason IS NULL)),
 CHECK(state<>'blocked' OR (closed_at IS NOT NULL AND closure_reason IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS protection_contract_payer_capacity
 ON protection_contracts(payer_account) WHERE remaining_cash>0;
CREATE UNIQUE INDEX IF NOT EXISTS protection_contract_guard_capacity
 ON protection_contracts(guard_account) WHERE state='accepted';
CREATE TABLE IF NOT EXISTS protection_contract_requests (
 account_id TEXT NOT NULL REFERENCES accounts(id), key_hash TEXT NOT NULL CHECK(char_length(key_hash)=64),
 action TEXT NOT NULL CHECK(action IN ('fund','accept','activate','refund','expire','withdraw')),
 body_hash TEXT NOT NULL CHECK(char_length(body_hash)=64), original_character TEXT NOT NULL REFERENCES characters(id),
 contract_id TEXT NOT NULL REFERENCES protection_contracts(id), receipt JSONB NOT NULL, acknowledged_at TIMESTAMPTZ NOT NULL,
 PRIMARY KEY(account_id,key_hash)
);
CREATE TABLE IF NOT EXISTS protection_contract_acceptances (
 contract_id TEXT PRIMARY KEY REFERENCES protection_contracts(id),
 guard_account TEXT NOT NULL REFERENCES accounts(id), guard_character TEXT NOT NULL REFERENCES characters(id),
 request_key_hash TEXT NOT NULL CHECK(char_length(request_key_hash)=64),
 source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64), consented_at TIMESTAMPTZ NOT NULL,
 FOREIGN KEY(guard_account,request_key_hash) REFERENCES protection_contract_requests(account_id,key_hash)
);
`;
