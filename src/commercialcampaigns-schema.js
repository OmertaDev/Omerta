// N20 owns this closed declaration. The coordinator owns canonical schema/migration wiring.
export const commercialCampaignsDDL = `
CREATE TABLE IF NOT EXISTS commercial_campaigns (
 id TEXT PRIMARY KEY,
 partnership_id TEXT NOT NULL REFERENCES management_teams(partnership_id),
 relationship_hash TEXT NOT NULL CHECK(char_length(relationship_hash)=64),
 team_revision INT NOT NULL CHECK(team_revision BETWEEN 1 AND 2147483647),
 business_id TEXT NOT NULL REFERENCES business_depots(id),
 owner_account TEXT NOT NULL REFERENCES accounts(id), owner_character TEXT NOT NULL REFERENCES characters(id),
 scout_account TEXT NOT NULL REFERENCES accounts(id), scout_character TEXT NOT NULL REFERENCES characters(id),
 manufacturer_account TEXT NOT NULL REFERENCES accounts(id), manufacturer_character TEXT NOT NULL REFERENCES characters(id),
 guard_account TEXT NOT NULL REFERENCES accounts(id), guard_character TEXT NOT NULL REFERENCES characters(id),
 first_carrier_account TEXT NOT NULL REFERENCES accounts(id), first_carrier_character TEXT NOT NULL REFERENCES characters(id),
 second_carrier_account TEXT NOT NULL REFERENCES accounts(id), second_carrier_character TEXT NOT NULL REFERENCES characters(id),
 source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64), source_json JSONB NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('offered','active','completed','cancelled','expired','suspended')),
 stage TEXT NOT NULL CHECK(stage IN ('scout','manufacture','guard','courier','complete')),
 created_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL CHECK(expires_at>created_at),
 activated_at TIMESTAMPTZ, closed_at TIMESTAMPTZ,
 closure_reason TEXT CHECK(closure_reason IS NULL OR closure_reason IN
 ('owner_cancel','provider_withdraw','source_expiry','original_dead','estate_scope','completed')),
 closure_original TEXT REFERENCES characters(id),
 CHECK(owner_account<>scout_account), CHECK(owner_character<>scout_character),
 CHECK((state='offered' AND activated_at IS NULL) OR state<>'offered'),
 CHECK((state IN ('offered','active') AND closed_at IS NULL AND closure_reason IS NULL AND closure_original IS NULL)
 OR (state IN ('completed','cancelled','expired','suspended') AND closed_at IS NOT NULL
 AND closure_reason IS NOT NULL AND closure_original IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_campaign_owner_capacity
 ON commercial_campaigns(owner_account) WHERE state IN ('offered','active');
CREATE TABLE IF NOT EXISTS commercial_campaign_requests (
 account_id TEXT NOT NULL REFERENCES accounts(id), key_hash TEXT NOT NULL CHECK(char_length(key_hash)=64),
 action TEXT NOT NULL CHECK(action IN ('create','consent','withdraw','cancel','expire','scout-fund','scout-report',
 'manufacture-fund','manufacture-accept','manufacture-complete','guard-hire','courier-publish','courier-consent',
 'courier-dispatch','courier-travel','courier-handoff','courier-arrive')),
 body_hash TEXT NOT NULL CHECK(char_length(body_hash)=64), original_character TEXT NOT NULL REFERENCES characters(id),
 campaign_id TEXT NOT NULL REFERENCES commercial_campaigns(id), receipt JSONB NOT NULL, acknowledged_at TIMESTAMPTZ NOT NULL,
 PRIMARY KEY(account_id,key_hash)
);
CREATE TABLE IF NOT EXISTS commercial_campaign_roles (
 campaign_id TEXT NOT NULL REFERENCES commercial_campaigns(id),
 role TEXT NOT NULL CHECK(role IN ('owner','scout','manufacturer','guard','first_carrier','second_carrier')),
 account_id TEXT NOT NULL REFERENCES accounts(id), original_character TEXT NOT NULL REFERENCES characters(id),
 state TEXT NOT NULL CHECK(state IN ('invited','consented','active','retired')),
 consent_key_hash TEXT CHECK(consent_key_hash IS NULL OR char_length(consent_key_hash)=64),
 consent_terms_hash TEXT CHECK(consent_terms_hash IS NULL OR char_length(consent_terms_hash)=64),
 consented_at TIMESTAMPTZ,
 PRIMARY KEY(campaign_id,role), UNIQUE(campaign_id,account_id), UNIQUE(campaign_id,original_character),
 FOREIGN KEY(account_id,consent_key_hash) REFERENCES commercial_campaign_requests(account_id,key_hash),
 CHECK((consent_key_hash IS NULL AND consent_terms_hash IS NULL AND consented_at IS NULL AND state IN ('invited','retired'))
 OR (consent_key_hash IS NOT NULL AND consent_terms_hash IS NOT NULL AND consented_at IS NOT NULL AND state IN ('consented','active','retired')))
);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_campaign_original_capacity
 ON commercial_campaign_roles(account_id) WHERE state='active';
CREATE TABLE IF NOT EXISTS commercial_campaign_stages (
 campaign_id TEXT NOT NULL REFERENCES commercial_campaigns(id),
 kind TEXT NOT NULL CHECK(kind IN ('scout','manufacture','guard','courier')),
 state TEXT NOT NULL CHECK(state IN ('pending','prepared','funded','accepted','completed','retired')),
 scout_job_id TEXT UNIQUE REFERENCES intel_forecast_jobs(id),
 commission_id TEXT UNIQUE REFERENCES commissioned_crafting_contracts(id),
 output_item_id TEXT REFERENCES item_instances(id),
 courier_network_id TEXT UNIQUE REFERENCES multi_hop_couriers(id),
 guard_payer_journal TEXT UNIQUE REFERENCES transactions(id), guard_payee_journal TEXT UNIQUE REFERENCES transactions(id),
 guard_until TIMESTAMPTZ,
 proof_json JSONB NOT NULL, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
 PRIMARY KEY(campaign_id,kind),
 CHECK((kind='scout' AND commission_id IS NULL AND output_item_id IS NULL AND courier_network_id IS NULL
 AND guard_payer_journal IS NULL AND guard_payee_journal IS NULL AND guard_until IS NULL)
 OR (kind='manufacture' AND scout_job_id IS NULL AND courier_network_id IS NULL
 AND guard_payer_journal IS NULL AND guard_payee_journal IS NULL AND guard_until IS NULL)
 OR (kind='guard' AND scout_job_id IS NULL AND commission_id IS NULL AND output_item_id IS NULL AND courier_network_id IS NULL)
 OR (kind='courier' AND scout_job_id IS NULL AND commission_id IS NULL
 AND guard_payer_journal IS NULL AND guard_payee_journal IS NULL AND guard_until IS NULL)),
 CHECK(state<>'completed' OR (completed_at IS NOT NULL AND
 ((kind='scout' AND scout_job_id IS NOT NULL)
 OR (kind='manufacture' AND commission_id IS NOT NULL AND output_item_id IS NOT NULL)
 OR (kind='guard' AND guard_payer_journal IS NOT NULL AND guard_payee_journal IS NOT NULL AND guard_until IS NOT NULL)
 OR (kind='courier' AND courier_network_id IS NOT NULL AND output_item_id IS NOT NULL))))
);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_campaign_output_consumption
 ON commercial_campaign_stages(output_item_id) WHERE kind='manufacture' AND output_item_id IS NOT NULL;
`;
