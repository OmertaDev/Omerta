-- N11 proposal only. Market listings/cargo/transactions remain authoritative.
CREATE TABLE IF NOT EXISTS mobile_shops (
  id TEXT PRIMARY KEY,
  seller_account TEXT NOT NULL REFERENCES accounts(id),
  seller_character TEXT NOT NULL REFERENCES characters(id),
  listing_id TEXT NOT NULL UNIQUE,
  district TEXT NOT NULL,
  initial_quantity INTEGER NOT NULL CHECK(initial_quantity BETWEEN 1 AND 10),
  remaining_quantity INTEGER NOT NULL CHECK(remaining_quantity BETWEEN 0 AND initial_quantity),
  unit_price INTEGER NOT NULL CHECK(unit_price BETWEEN 1 AND 1000000),
  source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64),
  expires_at TIMESTAMPTZ NOT NULL,
  listing_expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK(status IN('active','cancelled','sold','estate_scattered')),
  CHECK(initial_quantity*unit_price<=1000000),
  CHECK(expires_at<=listing_expires_at)
);
-- No listing FK: canonical estate deletes listing rows. Historical shop is not stock.
CREATE UNIQUE INDEX IF NOT EXISTS mobile_shop_one_active ON mobile_shops(seller_character) WHERE status='active';
CREATE TABLE IF NOT EXISTS mobile_shop_requests (
  account_id TEXT NOT NULL REFERENCES accounts(id),
  key_hash TEXT NOT NULL CHECK(char_length(key_hash)=64),
  body_hash TEXT NOT NULL CHECK(char_length(body_hash)=64),
  original_character TEXT NOT NULL REFERENCES characters(id),
  shop_id TEXT NOT NULL REFERENCES mobile_shops(id),
  receipt JSONB NOT NULL,
  journal_ids JSONB NOT NULL,
  PRIMARY KEY(account_id,key_hash)
);
