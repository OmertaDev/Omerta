CREATE TABLE IF NOT EXISTS picking_packing_jobs (
 id TEXT PRIMARY KEY, tenant_account TEXT NOT NULL REFERENCES accounts(id), provider_account TEXT NOT NULL REFERENCES accounts(id),
 tenant_character TEXT NOT NULL REFERENCES characters(id), provider_character TEXT NOT NULL REFERENCES characters(id),
 lease_id TEXT NOT NULL REFERENCES business_warehouse_leases(id), depot_id TEXT NOT NULL REFERENCES business_depots(id),
 quantity INT NOT NULL CHECK(quantity BETWEEN 1 AND 10), fee_cash INT NOT NULL CHECK(fee_cash BETWEEN 1 AND 1000),
 source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64), source JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('requested','accepted','fulfilled','cancelled','party_dead')), receipt JSONB,
 CHECK(tenant_account<>provider_account AND tenant_character<>provider_character), CHECK((state='fulfilled')=(receipt IS NOT NULL)));
CREATE TABLE IF NOT EXISTS picking_packing_requests (
 account_id TEXT NOT NULL REFERENCES accounts(id), request_key TEXT NOT NULL CHECK(char_length(request_key) BETWEEN 1 AND 128),
 request_hash TEXT NOT NULL CHECK(char_length(request_hash)=64), actor_ref TEXT NOT NULL REFERENCES characters(id),
 receipt JSONB NOT NULL, job_id TEXT NOT NULL REFERENCES picking_packing_jobs(id), PRIMARY KEY(account_id,request_key));
CREATE INDEX IF NOT EXISTS picking_packing_tenant ON picking_packing_jobs(tenant_character,state);
CREATE INDEX IF NOT EXISTS picking_packing_provider ON picking_packing_jobs(provider_character,state);
