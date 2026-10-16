-- N08 component proposal only; root owns canonical schema/books/estate integration.
CREATE TABLE IF NOT EXISTS customer_layaways (
 id TEXT PRIMARY KEY,item_id TEXT NOT NULL REFERENCES item_instances(id),
 seller_account TEXT NOT NULL REFERENCES accounts(id),seller_character TEXT NOT NULL REFERENCES characters(id),
 buyer_account TEXT NOT NULL REFERENCES accounts(id),buyer_character TEXT NOT NULL REFERENCES characters(id),
 price_cash INT NOT NULL CHECK(price_cash BETWEEN 1 AND 1000000),source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64),expires_at TIMESTAMPTZ NOT NULL,
 status TEXT NOT NULL CHECK(status IN('offered','active','completed','cancelled','expired','party_dead')),
 total_paid INT NOT NULL DEFAULT 0 CHECK(total_paid>=0),escrow_cash INT NOT NULL DEFAULT 0 CHECK(escrow_cash>=0),
 paid_to_seller INT NOT NULL DEFAULT 0 CHECK(paid_to_seller>=0),refunded_cash INT NOT NULL DEFAULT 0 CHECK(refunded_cash>=0),
 installment_count INT NOT NULL DEFAULT 0 CHECK(installment_count BETWEEN 0 AND 8),deposit_guard TEXT REFERENCES item_mutation_guards(idempotency_key),settlement JSONB,
 CHECK(seller_account<>buyer_account AND seller_character<>buyer_character),CHECK(total_paid<=price_cash AND total_paid=escrow_cash+paid_to_seller+refunded_cash),
 CHECK((total_paid=0 AND installment_count=0 AND deposit_guard IS NULL) OR (total_paid>0 AND installment_count>0 AND deposit_guard IS NOT NULL)),
 CHECK((status='offered' AND total_paid=0 AND settlement IS NULL) OR (status='active' AND escrow_cash=total_paid AND total_paid>0 AND total_paid<price_cash AND settlement IS NULL) OR (status='completed' AND total_paid=price_cash AND paid_to_seller=price_cash AND settlement IS NOT NULL) OR (status IN('cancelled','expired','party_dead') AND refunded_cash=total_paid AND settlement IS NOT NULL)));
CREATE UNIQUE INDEX IF NOT EXISTS customer_layaway_active_item ON customer_layaways(item_id) WHERE status='active';
CREATE UNIQUE INDEX IF NOT EXISTS customer_layaway_seller_offer ON customer_layaways(seller_account,item_id) WHERE status IN('offered','active');
CREATE TABLE IF NOT EXISTS customer_layaway_installments (
 layaway_id TEXT NOT NULL REFERENCES customer_layaways(id),ordinal INT NOT NULL CHECK(ordinal BETWEEN 1 AND 8),amount_cash INT NOT NULL CHECK(amount_cash BETWEEN 1 AND 1000000),
 reserve_transaction TEXT NOT NULL UNIQUE REFERENCES transactions(id),PRIMARY KEY(layaway_id,ordinal));
CREATE TABLE IF NOT EXISTS customer_layaway_requests (
 account_id TEXT NOT NULL,key_hash TEXT NOT NULL CHECK(char_length(key_hash)=64),body_hash TEXT NOT NULL CHECK(char_length(body_hash)=64),run_id TEXT NOT NULL UNIQUE,
 receipt JSONB,account_ref TEXT REFERENCES accounts(id),original_character TEXT REFERENCES characters(id),PRIMARY KEY(account_id,key_hash),
 CHECK((receipt IS NULL AND account_ref IS NULL AND original_character IS NULL) OR (receipt IS NOT NULL AND account_ref=account_id AND account_ref IS NOT NULL AND original_character IS NOT NULL)));
