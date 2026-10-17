export const workshopFloorDDL=`
CREATE TABLE IF NOT EXISTS workshop_floorplans (
 business_id TEXT PRIMARY KEY REFERENCES business_depots(id), id TEXT NOT NULL UNIQUE,
 account_id TEXT NOT NULL REFERENCES accounts(id), original_character TEXT NOT NULL REFERENCES characters(id),
 revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 2147483647),
 source_json JSONB NOT NULL, source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64), allocations JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS workshop_floor_requests (
 account_id TEXT NOT NULL, key_hash TEXT NOT NULL, body_hash TEXT NOT NULL, run_id TEXT NOT NULL UNIQUE,
 request_json JSONB NOT NULL, receipt JSONB, source_json JSONB,
 account_ref TEXT REFERENCES accounts(id), original_character TEXT REFERENCES characters(id), business_ref TEXT REFERENCES business_depots(id),
 PRIMARY KEY(account_id,key_hash), CHECK(account_ref IS NULL OR account_ref=account_id),
 CHECK((receipt IS NULL AND source_json IS NULL AND account_ref IS NULL AND original_character IS NULL AND business_ref IS NULL)
 OR (receipt IS NOT NULL AND source_json IS NOT NULL AND account_ref IS NOT NULL AND original_character IS NOT NULL AND business_ref IS NOT NULL))
);`;
