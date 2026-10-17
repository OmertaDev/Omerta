CREATE TABLE IF NOT EXISTS production_slot_reservations (
 id TEXT PRIMARY KEY,commission_id TEXT NOT NULL REFERENCES commissioned_crafting_contracts(id),commission_source_hash TEXT NOT NULL CHECK(char_length(commission_source_hash)=64),business_id TEXT NOT NULL REFERENCES business_depots(id),
 maker_account TEXT NOT NULL REFERENCES accounts(id),maker_character TEXT NOT NULL REFERENCES characters(id),customer_account TEXT NOT NULL REFERENCES accounts(id),customer_character TEXT NOT NULL REFERENCES characters(id),
 profile_revision INT NOT NULL CHECK(profile_revision>=1),profile_source JSONB NOT NULL,observed_at TIMESTAMPTZ NOT NULL,ready_at TIMESTAMPTZ NOT NULL,deadline TIMESTAMPTZ NOT NULL,
 source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64),status TEXT NOT NULL CHECK(status IN ('offered','active','consumed','released','expired','void')),completion JSONB,
 CHECK(maker_account<>customer_account AND maker_character<>customer_character),CHECK(ready_at<deadline),CHECK((status='consumed')=(completion IS NOT NULL)));
CREATE UNIQUE INDEX IF NOT EXISTS production_slot_one_business ON production_slot_reservations(business_id) WHERE status='active';
CREATE UNIQUE INDEX IF NOT EXISTS production_slot_live_commission ON production_slot_reservations(commission_id) WHERE status IN ('offered','active');
CREATE TABLE IF NOT EXISTS production_slot_requests (
 account_id TEXT NOT NULL REFERENCES accounts(id),request_key TEXT NOT NULL CHECK(char_length(request_key) BETWEEN 1 AND 128),body_hash TEXT NOT NULL CHECK(char_length(body_hash)=64),original_character TEXT NOT NULL REFERENCES characters(id),reservation_id TEXT NOT NULL REFERENCES production_slot_reservations(id),receipt JSONB NOT NULL,PRIMARY KEY(account_id,request_key));
