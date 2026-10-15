CREATE TABLE IF NOT EXISTS atomic_barter_requests (
 account_id TEXT NOT NULL, request_key TEXT NOT NULL, request_hash TEXT NOT NULL, run_id TEXT NOT NULL UNIQUE,
 receipt JSONB, account_ref TEXT REFERENCES accounts(id), actor_ref TEXT REFERENCES characters(id),
 PRIMARY KEY(account_id,request_key), CHECK(char_length(request_key) BETWEEN 1 AND 128),
 CHECK(char_length(request_hash)=64), CHECK((receipt IS NULL AND account_ref IS NULL AND actor_ref IS NULL)
 OR(receipt IS NOT NULL AND account_ref=account_id AND account_ref IS NOT NULL AND actor_ref IS NOT NULL)));
CREATE TABLE IF NOT EXISTS atomic_barter_offers (
 id TEXT PRIMARY KEY, maker_account TEXT NOT NULL REFERENCES accounts(id), taker_account TEXT NOT NULL REFERENCES accounts(id),
 maker_character TEXT NOT NULL REFERENCES characters(id), taker_character TEXT NOT NULL REFERENCES characters(id),
 offered_item TEXT NOT NULL REFERENCES item_instances(id), requested_item TEXT NOT NULL REFERENCES item_instances(id),
 expires_at TIMESTAMPTZ NOT NULL, state TEXT NOT NULL CHECK(state IN ('offered','completed','cancelled','expired','party_dead')),
 receipt JSONB, CHECK(maker_account<>taker_account AND maker_character<>taker_character AND offered_item<>requested_item),
 CHECK((state='completed')=(receipt IS NOT NULL)));
CREATE INDEX IF NOT EXISTS atomic_barter_maker ON atomic_barter_offers(maker_character,state);
CREATE INDEX IF NOT EXISTS atomic_barter_taker ON atomic_barter_offers(taker_character,state);
