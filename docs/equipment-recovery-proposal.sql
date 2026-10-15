-- Metadata only; no escrow, new material bucket, deposit or service enrollment.
CREATE TABLE IF NOT EXISTS equipment_recovery_requests (
 account_id TEXT NOT NULL REFERENCES accounts(id),
 key_hash TEXT NOT NULL CHECK(char_length(key_hash)=64),
 body_hash TEXT NOT NULL CHECK(char_length(body_hash)=64),
 original_character TEXT NOT NULL REFERENCES characters(id),
 business_id TEXT NOT NULL REFERENCES business_depots(id),
 item_id TEXT NOT NULL UNIQUE REFERENCES item_instances(id),
 receipt JSONB NOT NULL,
 craft_key TEXT NOT NULL UNIQUE,
 PRIMARY KEY(account_id,key_hash)
);
