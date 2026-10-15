-- Proposal only. Root owns schema installation, complete books and estate wiring.
CREATE TABLE IF NOT EXISTS consignments (
 id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES item_instances(id),
 owner_account TEXT NOT NULL REFERENCES accounts(id), owner_character TEXT NOT NULL REFERENCES characters(id),
 host_account TEXT NOT NULL REFERENCES accounts(id), host_character TEXT NOT NULL REFERENCES characters(id),
 price INT NOT NULL CHECK(price BETWEEN 1 AND 1000000), host_fee_bps INT NOT NULL CHECK(host_fee_bps BETWEEN 0 AND 2000),
 expires_at TIMESTAMPTZ NOT NULL, source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64),
 status TEXT NOT NULL CHECK(status IN ('offered','active','sold','cancelled','expired','party_dead')),
 buyer_character TEXT REFERENCES characters(id), settlement JSONB,
 CHECK(owner_account<>host_account AND owner_character<>host_character),
 CHECK((status='sold' AND buyer_character IS NOT NULL AND buyer_character<>owner_character AND buyer_character<>host_character AND settlement IS NOT NULL) OR (status<>'sold' AND buyer_character IS NULL AND settlement IS NULL)));
CREATE UNIQUE INDEX IF NOT EXISTS consignment_live_item ON consignments(item_id) WHERE status IN ('offered','active');
CREATE TABLE IF NOT EXISTS consignment_requests (
 account_id TEXT NOT NULL, key_hash TEXT NOT NULL CHECK(char_length(key_hash)=64), body_hash TEXT NOT NULL CHECK(char_length(body_hash)=64), run_id TEXT NOT NULL UNIQUE,
 receipt JSONB, account_ref TEXT REFERENCES accounts(id), original_character TEXT REFERENCES characters(id), PRIMARY KEY(account_id,key_hash),
 CHECK((receipt IS NULL AND account_ref IS NULL AND original_character IS NULL) OR (receipt IS NOT NULL AND account_ref=account_id AND account_ref IS NOT NULL AND original_character IS NOT NULL)));
