-- OFF-REPOSITORY coordinator proposal, not applied to canonical schema.
CREATE TABLE IF NOT EXISTS business_relocation_plans (
 id TEXT PRIMARY KEY,
 depot_id TEXT NOT NULL REFERENCES business_depots(id),
 account_id TEXT NOT NULL REFERENCES accounts(id),
 original_character TEXT NOT NULL REFERENCES characters(id),
 destination TEXT NOT NULL,
 source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64),
 source_snapshot JSONB NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 revision INT NOT NULL CHECK(revision BETWEEN 1 AND 2),
 state TEXT NOT NULL CHECK(state IN ('ready','executed','cancelled','expired','owner_dead')),
 receipt JSONB,
 CHECK((state='executed')=(receipt IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS business_relocation_one_ready
 ON business_relocation_plans(account_id) WHERE state='ready';
CREATE UNIQUE INDEX IF NOT EXISTS business_relocation_depot_ready
 ON business_relocation_plans(depot_id) WHERE state='ready';
CREATE TABLE IF NOT EXISTS business_relocation_requests (
 account_id TEXT NOT NULL,
 key_hash TEXT NOT NULL CHECK(char_length(key_hash)=64),
 body_hash TEXT NOT NULL CHECK(char_length(body_hash)=64),
 run_id TEXT NOT NULL UNIQUE,
 receipt JSONB,
 account_ref TEXT REFERENCES accounts(id),
 actor_ref TEXT REFERENCES characters(id),
 PRIMARY KEY(account_id,key_hash),
 CHECK((receipt IS NULL AND account_ref IS NULL AND actor_ref IS NULL)
 OR(receipt IS NOT NULL AND account_ref=account_id AND account_ref IS NOT NULL AND actor_ref IS NOT NULL))
);
