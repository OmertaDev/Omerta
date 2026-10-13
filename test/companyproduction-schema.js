// Exact metadata-only integration DDL, applied only to owned isolated fixtures.
export const PRODUCTION_DDL = `CREATE TABLE IF NOT EXISTS company_production_receipts (
  account_id TEXT NOT NULL,
  account_ref TEXT REFERENCES accounts(id),
  request_key TEXT NOT NULL CHECK(char_length(request_key) BETWEEN 1 AND 128),
  run_id TEXT NOT NULL UNIQUE,
  original_character TEXT REFERENCES characters(id),
  business_id TEXT REFERENCES business_depots(id),
  body_hash TEXT NOT NULL CHECK(char_length(body_hash)=64),
  source_pin JSONB NOT NULL,
  normalized_body JSONB NOT NULL,
  receipt JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(account_id,request_key),
  CHECK((receipt IS NULL AND account_ref IS NULL AND original_character IS NULL AND business_id IS NULL)
    OR (receipt IS NOT NULL AND account_ref=account_id AND account_ref IS NOT NULL AND original_character IS NOT NULL AND business_id IS NOT NULL
      AND normalized_body->>'businessId' IS NOT NULL AND receipt->>'businessId' IS NOT NULL AND receipt->>'originalCharacter' IS NOT NULL
      AND normalized_body->>'businessId'=business_id AND receipt->>'businessId'=business_id
      AND receipt->>'originalCharacter'=original_character))
);`;
