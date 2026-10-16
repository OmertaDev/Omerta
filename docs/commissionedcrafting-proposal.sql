-- Component proposal only: canonical schema, cash-escrow books and estate bridge are root-owned.
CREATE TABLE IF NOT EXISTS commissioned_crafting_contracts (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES business_depots(id),
 customer_account TEXT NOT NULL REFERENCES accounts(id), customer_character TEXT NOT NULL REFERENCES characters(id),
 maker_account TEXT NOT NULL REFERENCES accounts(id), maker_character TEXT NOT NULL REFERENCES characters(id),
 fee_total INT NOT NULL CHECK(fee_total BETWEEN 1 AND 100000), fee_remaining INT NOT NULL CHECK(fee_remaining>=0),
 fee_paid INT NOT NULL DEFAULT 0 CHECK(fee_paid>=0), fee_refunded INT NOT NULL DEFAULT 0 CHECK(fee_refunded>=0),
 source_pin JSONB NOT NULL, source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64), expires_at TIMESTAMPTZ NOT NULL,
 reserve_transaction TEXT NOT NULL UNIQUE REFERENCES transactions(id), fund_guard TEXT NOT NULL UNIQUE REFERENCES item_mutation_guards(idempotency_key),
 status TEXT NOT NULL CHECK(status IN ('funded','accepted','completed','refunded')), settlement JSONB,
 CHECK(customer_account<>maker_account AND customer_character<>maker_character),
 CHECK(fee_total=fee_remaining+fee_paid+fee_refunded),
 CHECK((status IN ('funded','accepted') AND fee_remaining=fee_total AND fee_paid=0 AND fee_refunded=0 AND settlement IS NULL) OR (status='completed' AND fee_remaining=0 AND fee_paid=fee_total AND fee_refunded=0 AND settlement IS NOT NULL) OR (status='refunded' AND fee_remaining=0 AND fee_refunded=fee_total AND fee_paid=0 AND settlement IS NOT NULL)));
CREATE TABLE IF NOT EXISTS commissioned_crafting_requests (
 account_id TEXT NOT NULL, key_hash TEXT NOT NULL CHECK(char_length(key_hash)=64), body_hash TEXT NOT NULL CHECK(char_length(body_hash)=64), run_id TEXT NOT NULL UNIQUE,
 receipt JSONB, account_ref TEXT REFERENCES accounts(id), original_character TEXT REFERENCES characters(id), PRIMARY KEY(account_id,key_hash),
 CHECK((receipt IS NULL AND account_ref IS NULL AND original_character IS NULL) OR (receipt IS NOT NULL AND account_ref=account_id AND account_ref IS NOT NULL AND original_character IS NOT NULL)));
