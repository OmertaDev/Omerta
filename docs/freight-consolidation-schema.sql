CREATE TABLE IF NOT EXISTS freight_consolidations (
 id TEXT PRIMARY KEY,supplier_account TEXT NOT NULL,supplier_character TEXT NOT NULL,
 buyer_a_account TEXT NOT NULL,buyer_a_character TEXT NOT NULL,buyer_b_account TEXT NOT NULL,buyer_b_character TEXT NOT NULL,
 manifest JSONB NOT NULL,manifest_hash TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN('proposed','ready','completed','cancelled','retired')),
 revision INT NOT NULL CHECK(revision>0),expires_at TIMESTAMPTZ NOT NULL,receipt JSONB);
CREATE TABLE IF NOT EXISTS freight_consolidation_acceptances (
 batch_id TEXT NOT NULL REFERENCES freight_consolidations(id),buyer_account TEXT NOT NULL,buyer_character TEXT NOT NULL,
 order_id TEXT NOT NULL,commitment_id TEXT NOT NULL,manifest_hash TEXT NOT NULL,accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(batch_id,buyer_account),UNIQUE(batch_id,order_id),UNIQUE(batch_id,commitment_id));
CREATE TABLE IF NOT EXISTS freight_consolidation_requests (
 account_id TEXT NOT NULL,request_key TEXT NOT NULL,identity TEXT NOT NULL,receipt JSONB NOT NULL,
 PRIMARY KEY(account_id,request_key));
