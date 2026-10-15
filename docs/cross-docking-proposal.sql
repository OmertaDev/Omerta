CREATE TABLE IF NOT EXISTS cross_dock_links (
 id TEXT PRIMARY KEY,
 network_id TEXT NOT NULL REFERENCES multi_hop_couriers(id),
 network_source_hash TEXT NOT NULL CHECK(char_length(network_source_hash)=64),
 hub_id TEXT NOT NULL REFERENCES company_logistics_hubs(id),
 hub_source JSONB NOT NULL,
 item_id TEXT NOT NULL REFERENCES item_instances(id),
 owner_account TEXT NOT NULL REFERENCES accounts(id),
 owner_character TEXT NOT NULL REFERENCES characters(id),
 first_account TEXT NOT NULL REFERENCES accounts(id),
 first_character TEXT NOT NULL REFERENCES characters(id),
 second_account TEXT NOT NULL REFERENCES accounts(id),
 second_character TEXT NOT NULL REFERENCES characters(id),
 source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64),
 expires_at TIMESTAMPTZ NOT NULL,
 first_consent BOOLEAN NOT NULL DEFAULT false,
 second_consent BOOLEAN NOT NULL DEFAULT false,
 status TEXT NOT NULL CHECK(status IN ('offered','active','completed','released','expired','void')),
 completion JSONB,
 CHECK(owner_account<>first_account AND owner_account<>second_account AND first_account<>second_account),
 CHECK(owner_character<>first_character AND owner_character<>second_character AND first_character<>second_character),
 CHECK(status<>'active' OR (first_consent AND second_consent)),
 CHECK((status='completed')=(completion IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS cross_dock_hub_status ON cross_dock_links(hub_id,status,expires_at);
CREATE INDEX IF NOT EXISTS cross_dock_network_status ON cross_dock_links(network_id,status,expires_at);
CREATE TABLE IF NOT EXISTS cross_dock_requests (
 account_id TEXT NOT NULL REFERENCES accounts(id),
 request_key TEXT NOT NULL,
 body_hash TEXT NOT NULL CHECK(char_length(body_hash)=64),
 original_character TEXT NOT NULL REFERENCES characters(id),
 link_id TEXT NOT NULL REFERENCES cross_dock_links(id),
 receipt JSONB NOT NULL,
 PRIMARY KEY(account_id,request_key)
);
