CREATE TABLE IF NOT EXISTS multi_hop_couriers (
 id TEXT PRIMARY KEY,item_id TEXT NOT NULL REFERENCES item_instances(id),
 owner_account TEXT NOT NULL REFERENCES accounts(id),owner_character TEXT NOT NULL REFERENCES characters(id),
 first_account TEXT NOT NULL,first_character TEXT NOT NULL,
 second_account TEXT NOT NULL,second_character TEXT NOT NULL,
 origin TEXT NOT NULL,handoff TEXT NOT NULL,destination TEXT NOT NULL,
 first_fee INT NOT NULL CHECK(first_fee BETWEEN 1 AND 1000),second_fee INT NOT NULL CHECK(second_fee BETWEEN 1 AND 1000),
 first_consent BOOLEAN NOT NULL DEFAULT false,second_consent BOOLEAN NOT NULL DEFAULT false,
 source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64),expires_at TIMESTAMPTZ NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('offered','ready','first_leg','second_leg','completed','cancelled','expired','party_dead')),
 reserved_cash INT NOT NULL DEFAULT 0 CHECK(reserved_cash>=0),earned_first INT NOT NULL DEFAULT 0 CHECK(earned_first>=0),earned_second INT NOT NULL DEFAULT 0 CHECK(earned_second>=0),refunded_cash INT NOT NULL DEFAULT 0 CHECK(refunded_cash>=0),
 deposit_guard TEXT REFERENCES item_mutation_guards(idempotency_key),first_travel JSONB,second_travel JSONB,receipt JSONB,
 CHECK(owner_account<>first_account AND owner_account<>second_account AND first_account<>second_account),
 CHECK(owner_character<>first_character AND owner_character<>second_character AND first_character<>second_character),
 CHECK(origin<>handoff AND origin<>destination AND handoff<>destination),
 CHECK(earned_first IN (0,first_fee) AND earned_second IN (0,second_fee)),
 CHECK((status IN ('offered','ready') AND reserved_cash=0 AND earned_first=0 AND earned_second=0 AND refunded_cash=0 AND deposit_guard IS NULL) OR
 (status NOT IN ('offered','ready') AND ((deposit_guard IS NOT NULL AND reserved_cash+earned_first+earned_second+refunded_cash=first_fee+second_fee) OR (status IN ('cancelled','expired','party_dead') AND deposit_guard IS NULL AND reserved_cash=0 AND earned_first=0 AND earned_second=0 AND refunded_cash=0)))),
 CHECK(status<>'ready' OR (first_consent AND second_consent)),CHECK(status<>'completed' OR (earned_first=first_fee AND earned_second=second_fee AND reserved_cash=0)),CHECK(status NOT IN ('cancelled','expired','party_dead') OR reserved_cash=0));
CREATE UNIQUE INDEX IF NOT EXISTS multi_hop_courier_live_item ON multi_hop_couriers(item_id) WHERE status IN ('offered','ready','first_leg','second_leg');
CREATE TABLE IF NOT EXISTS multi_hop_courier_requests (
 account_id TEXT NOT NULL REFERENCES accounts(id),request_key TEXT NOT NULL CHECK(char_length(request_key) BETWEEN 1 AND 128),body_hash TEXT NOT NULL CHECK(char_length(body_hash)=64),original_character TEXT NOT NULL REFERENCES characters(id),network_id TEXT NOT NULL REFERENCES multi_hop_couriers(id),receipt JSONB NOT NULL,PRIMARY KEY(account_id,request_key));
