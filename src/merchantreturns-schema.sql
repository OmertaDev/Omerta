-- N10 proposal only. Coordinator installs after genuine prelocker/private estate integration.
CREATE TABLE IF NOT EXISTS merchant_return_rights (
 id TEXT PRIMARY KEY, sale_id TEXT NOT NULL REFERENCES consignments(id), sale_hash TEXT NOT NULL,
 item_id TEXT NOT NULL REFERENCES item_instances(id), seller_account TEXT NOT NULL REFERENCES accounts(id),
 seller_character TEXT NOT NULL REFERENCES characters(id), buyer_account TEXT NOT NULL REFERENCES accounts(id),
 buyer_character TEXT NOT NULL REFERENCES characters(id), refund_cash BIGINT NOT NULL CHECK(refund_cash BETWEEN 1 AND 1000000),
 escrow_cash BIGINT NOT NULL CHECK(escrow_cash>=0), paid_cash BIGINT NOT NULL DEFAULT 0 CHECK(paid_cash>=0),
 refunded_cash BIGINT NOT NULL DEFAULT 0 CHECK(refunded_cash>=0), condition_floor INTEGER NOT NULL CHECK(condition_floor BETWEEN 10 AND 150),
 expires_at TIMESTAMPTZ NOT NULL, source_hash TEXT NOT NULL, reserve_journal TEXT NOT NULL UNIQUE REFERENCES transactions(id),
 state TEXT NOT NULL CHECK(state IN ('offered','accepted','returned','waived','cancelled','expired','party_dead')),
 accepted_at TIMESTAMPTZ, settlement JSONB,
 CHECK(seller_account<>buyer_account), CHECK(seller_character<>buyer_character),
 CHECK(refund_cash=escrow_cash+paid_cash+refunded_cash),
 CHECK((state IN ('offered','accepted') AND escrow_cash=refund_cash AND settlement IS NULL) OR (state NOT IN ('offered','accepted') AND escrow_cash=0 AND settlement IS NOT NULL)),
 CHECK((state='returned' AND paid_cash=refund_cash AND refunded_cash=0) OR (state<>'returned' AND paid_cash=0)),
 CHECK(state NOT IN ('accepted','returned','waived') OR accepted_at IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS merchant_return_one_live_sale ON merchant_return_rights(sale_id) WHERE state IN ('offered','accepted');
CREATE TABLE IF NOT EXISTS merchant_return_requests (
 account_id TEXT NOT NULL, key_hash TEXT NOT NULL, body_hash TEXT NOT NULL, run_id TEXT NOT NULL UNIQUE,
 request_json JSONB NOT NULL, receipt JSONB, account_ref TEXT REFERENCES accounts(id),
 original_character TEXT REFERENCES characters(id), return_ref TEXT REFERENCES merchant_return_rights(id),
 PRIMARY KEY(account_id,key_hash), CHECK(account_ref IS NULL OR account_ref=account_id),
 CHECK((receipt IS NULL AND account_ref IS NULL AND original_character IS NULL AND return_ref IS NULL) OR
 (receipt IS NOT NULL AND account_ref IS NOT NULL AND original_character IS NOT NULL AND return_ref IS NOT NULL))
);
