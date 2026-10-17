-- N15 proposal only. No new money or item bucket; coordinator integrates canonical schema.
CREATE TABLE IF NOT EXISTS manufacturing_licenses (
 id TEXT PRIMARY KEY,licensor_account TEXT NOT NULL REFERENCES accounts(id),licensor_character TEXT NOT NULL REFERENCES characters(id),
 licensee_account TEXT NOT NULL REFERENCES accounts(id),licensee_character TEXT NOT NULL REFERENCES characters(id),
 licensor_business TEXT NOT NULL REFERENCES business_depots(id),licensee_business TEXT REFERENCES business_depots(id),
 acceptance_key TEXT,production_key TEXT NOT NULL,production_hash TEXT NOT NULL,source_pin JSONB NOT NULL,source_hash TEXT NOT NULL,
 fee_cash INT NOT NULL CHECK(fee_cash BETWEEN 1 AND 10000),maximum_runs INT NOT NULL CHECK(maximum_runs BETWEEN 1 AND 8),
 completed_runs INT NOT NULL DEFAULT 0 CHECK(completed_runs BETWEEN 0 AND maximum_runs),expires_at TIMESTAMPTZ NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('offered','accepted','cancelled','exhausted')),
 CONSTRAINT manufacturing_license_distinct CHECK(licensor_account<>licensee_account AND licensor_character<>licensee_character),
 CONSTRAINT manufacturing_license_hashes CHECK(char_length(production_hash)=64 AND char_length(source_hash)=64),
 CONSTRAINT manufacturing_license_business CHECK(status NOT IN ('accepted','exhausted') OR licensee_business IS NOT NULL),
 CONSTRAINT manufacturing_license_exhaustion CHECK((status='exhausted')=(completed_runs=maximum_runs))
);
CREATE TABLE IF NOT EXISTS manufacturing_license_requests (
 account_id TEXT NOT NULL REFERENCES accounts(id),request_key TEXT NOT NULL,body_hash TEXT NOT NULL,receipt JSONB NOT NULL,
 PRIMARY KEY(account_id,request_key),CONSTRAINT manufacturing_license_request_hash CHECK(char_length(body_hash)=64)
);