export const eventMarketDDL=`
CREATE TABLE IF NOT EXISTS event_markets (
 id TEXT PRIMARY KEY,host_account TEXT NOT NULL REFERENCES accounts(id),host_character TEXT NOT NULL REFERENCES characters(id),
 vendor_account TEXT NOT NULL REFERENCES accounts(id),vendor_character TEXT NOT NULL REFERENCES characters(id),
 pickup_account TEXT NOT NULL REFERENCES accounts(id),pickup_character TEXT NOT NULL REFERENCES characters(id),
 shop_id TEXT NOT NULL,shop_hash TEXT NOT NULL,
 source_json JSONB NOT NULL,source_hash TEXT NOT NULL,district TEXT NOT NULL,
 reward_cash INT NOT NULL CHECK(reward_cash BETWEEN 1 AND 100000),slots INT NOT NULL CHECK(slots BETWEEN 1 AND 3),
 funded_cash INT NOT NULL,remaining_cash INT NOT NULL,paid_cash INT NOT NULL DEFAULT 0,refunded_cash INT NOT NULL DEFAULT 0,
 reserve_journal TEXT NOT NULL UNIQUE REFERENCES transactions(id),refund_journal TEXT UNIQUE REFERENCES transactions(id),
 state TEXT NOT NULL CHECK(state IN ('offered','active','suspended','closed','expired','party_dead')),created_at TIMESTAMPTZ NOT NULL,expires_at TIMESTAMPTZ NOT NULL,
 CHECK(host_account<>vendor_account AND host_account<>pickup_account AND vendor_account<>pickup_account AND host_character<>vendor_character AND host_character<>pickup_character AND vendor_character<>pickup_character),CHECK(expires_at>created_at),
 CHECK(funded_cash=reward_cash*slots AND remaining_cash>=0 AND paid_cash>=0 AND refunded_cash>=0 AND remaining_cash+paid_cash+refunded_cash=funded_cash));
CREATE UNIQUE INDEX IF NOT EXISTS event_market_host_capacity ON event_markets(host_account) WHERE state IN ('offered','active','suspended');
CREATE UNIQUE INDEX IF NOT EXISTS event_market_vendor_capacity ON event_markets(vendor_account) WHERE state='active';
CREATE UNIQUE INDEX IF NOT EXISTS event_market_pickup_capacity ON event_markets(pickup_account) WHERE state='active';
CREATE TABLE IF NOT EXISTS event_market_vendor_consents (
 event_id TEXT PRIMARY KEY REFERENCES event_markets(id),vendor_account TEXT NOT NULL REFERENCES accounts(id),vendor_character TEXT NOT NULL REFERENCES characters(id),
 source_hash TEXT NOT NULL,request_hash TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS event_market_venue_consents (
 event_id TEXT PRIMARY KEY REFERENCES event_markets(id),pickup_account TEXT NOT NULL REFERENCES accounts(id),pickup_character TEXT NOT NULL REFERENCES characters(id),
 source_hash TEXT NOT NULL,request_hash TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS event_market_participants (
 id TEXT PRIMARY KEY,event_id TEXT NOT NULL REFERENCES event_markets(id),buyer_account TEXT NOT NULL REFERENCES accounts(id),buyer_character TEXT NOT NULL REFERENCES characters(id),
 attribution_id TEXT NOT NULL,attribution_hash TEXT NOT NULL,campaign_id TEXT NOT NULL,campaign_hash TEXT NOT NULL,item_id TEXT NOT NULL,source_hash TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('joined','visited','completed','left','expired','party_dead')),
 created_at TIMESTAMPTZ NOT NULL,visit_json JSONB,completion_json JSONB,reward_journal TEXT UNIQUE REFERENCES transactions(id),
 reward_cash INT NOT NULL DEFAULT 0,CHECK(reward_cash>=0),UNIQUE(event_id,buyer_account),UNIQUE(event_id,attribution_id));
CREATE UNIQUE INDEX IF NOT EXISTS event_market_campaign_slot ON event_market_participants(event_id,campaign_id) WHERE state IN ('joined','visited','completed');
CREATE UNIQUE INDEX IF NOT EXISTS event_market_participant_capacity ON event_market_participants(buyer_account) WHERE state IN ('joined','visited');
CREATE UNIQUE INDEX IF NOT EXISTS event_market_one_uid_completion ON event_market_participants((completion_json->>'itemId')) WHERE state='completed';
CREATE TABLE IF NOT EXISTS event_market_requests (
 account_id TEXT NOT NULL REFERENCES accounts(id),key_hash TEXT NOT NULL,body_hash TEXT NOT NULL,action TEXT NOT NULL CHECK(action IN ('fund','enroll','venue','withdraw','join','leave','visit','finish','cancel','expire')),
 original_character TEXT NOT NULL REFERENCES characters(id),event_id TEXT NOT NULL REFERENCES event_markets(id),
 request_json JSONB NOT NULL,receipt JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL,PRIMARY KEY(account_id,key_hash));`;
