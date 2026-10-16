// Component DDL proposal. The coordinator owns canonical schema/catalog integration.
export const merchantLoyaltyDDL = `
CREATE TABLE IF NOT EXISTS merchant_loyalty_programs (
 id TEXT PRIMARY KEY, seller_account TEXT NOT NULL REFERENCES accounts(id),
 seller_character TEXT NOT NULL REFERENCES characters(id), required_purchases INTEGER NOT NULL CHECK(required_purchases BETWEEN 2 AND 5),
 discount_bps INTEGER NOT NULL CHECK(discount_bps BETWEEN 1 AND 2000), maximum_discount INTEGER NOT NULL CHECK(maximum_discount BETWEEN 1 AND 100000),
 maximum_uses INTEGER NOT NULL CHECK(maximum_uses BETWEEN 1 AND 20), used_count INTEGER NOT NULL DEFAULT 0 CHECK(used_count BETWEEN 0 AND 20),
 observed_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL, source_hash TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('active','closed')), CHECK(expires_at>observed_at), CHECK(used_count<=maximum_uses)
);
CREATE TABLE IF NOT EXISTS merchant_loyalty_quotes (
 id TEXT PRIMARY KEY, program_id TEXT NOT NULL REFERENCES merchant_loyalty_programs(id), program_hash TEXT NOT NULL,
 consignment_id TEXT NOT NULL REFERENCES consignments(id), sale_hash TEXT NOT NULL, item_id TEXT NOT NULL REFERENCES item_instances(id),
 seller_account TEXT NOT NULL REFERENCES accounts(id), seller_character TEXT NOT NULL REFERENCES characters(id),
 host_account TEXT NOT NULL REFERENCES accounts(id), host_character TEXT NOT NULL REFERENCES characters(id),
 buyer_account TEXT NOT NULL REFERENCES accounts(id), buyer_character TEXT NOT NULL REFERENCES characters(id),
 gross_price INTEGER NOT NULL CHECK(gross_price BETWEEN 1 AND 1000000), buyer_paid INTEGER NOT NULL CHECK(buyer_paid BETWEEN 1 AND 1000000),
 host_fee INTEGER NOT NULL CHECK(host_fee BETWEEN 0 AND 200000), seller_paid INTEGER NOT NULL CHECK(seller_paid>=0),
 discount_cash INTEGER NOT NULL CHECK(discount_cash BETWEEN 1 AND 100000), qualification JSONB NOT NULL,
 observed_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL, source_hash TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('quoted','consumed')), sale_witness JSONB, sale_receipt JSONB,
 CHECK(buyer_paid+discount_cash=gross_price), CHECK(seller_paid+host_fee=buyer_paid), CHECK(expires_at>observed_at),
 CHECK(seller_account<>host_account AND seller_account<>buyer_account AND host_account<>buyer_account),
 CHECK(seller_character<>host_character AND seller_character<>buyer_character AND host_character<>buyer_character),
 CHECK((status='quoted' AND sale_witness IS NULL AND sale_receipt IS NULL) OR (status='consumed' AND sale_witness IS NOT NULL AND sale_receipt IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS merchant_loyalty_one_buyer_use ON merchant_loyalty_quotes(program_id,buyer_character) WHERE status='consumed';
CREATE UNIQUE INDEX IF NOT EXISTS merchant_loyalty_one_sale_use ON merchant_loyalty_quotes(consignment_id) WHERE status='consumed';
CREATE TABLE IF NOT EXISTS merchant_loyalty_requests (
 account_id TEXT NOT NULL, key_hash TEXT NOT NULL, body_hash TEXT NOT NULL, run_id TEXT NOT NULL UNIQUE,
 request_json JSONB NOT NULL, receipt JSONB, account_ref TEXT REFERENCES accounts(id), original_character TEXT REFERENCES characters(id),
 PRIMARY KEY(account_id,key_hash), CHECK(account_ref IS NULL OR account_ref=account_id),
 CHECK((receipt IS NULL AND account_ref IS NULL AND original_character IS NULL) OR (receipt IS NOT NULL AND account_ref IS NOT NULL AND original_character IS NOT NULL))
);`;
