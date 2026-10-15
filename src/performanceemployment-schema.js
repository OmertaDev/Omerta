export const performanceEmploymentDDL=`CREATE TABLE IF NOT EXISTS performance_employment_contracts (
 employment_id TEXT PRIMARY KEY REFERENCES game_employment_jobs(id), depot_id TEXT NOT NULL REFERENCES business_depots(id),
 employer_account TEXT NOT NULL REFERENCES accounts(id), employer_character TEXT NOT NULL REFERENCES characters(id),
 source_json JSONB NOT NULL, source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64),
 minimum_units INT NOT NULL CHECK(minimum_units BETWEEN 1 AND 40), bonus_cash INT NOT NULL CHECK(bonus_cash BETWEEN 1 AND 10000),
 slots INT NOT NULL CHECK(slots BETWEEN 1 AND 5), total_cash INT NOT NULL CHECK(total_cash=slots*bonus_cash),
 escrow_cash INT NOT NULL CHECK(escrow_cash>=0), paid_cash INT NOT NULL DEFAULT 0 CHECK(paid_cash>=0),
 refunded_cash INT NOT NULL DEFAULT 0 CHECK(refunded_cash>=0), burned_cash INT NOT NULL DEFAULT 0 CHECK(burned_cash>=0),
 looted_cash INT NOT NULL DEFAULT 0 CHECK(looted_cash>=0), reserve_transaction TEXT NOT NULL UNIQUE REFERENCES transactions(id),
 state TEXT NOT NULL CHECK(state IN ('open','closed')), created_at TIMESTAMPTZ NOT NULL,
 CHECK(total_cash=escrow_cash+paid_cash+refunded_cash+burned_cash+looted_cash), CHECK(state<>'closed' OR escrow_cash=0));
CREATE TABLE IF NOT EXISTS performance_employment_assignments (
 assignment_id TEXT PRIMARY KEY REFERENCES game_employment_assignments(id), employment_id TEXT NOT NULL REFERENCES performance_employment_contracts(employment_id),
 commitment_id TEXT NOT NULL UNIQUE REFERENCES delivery_commitments(id), worker_account TEXT NOT NULL REFERENCES accounts(id),
 worker_character TEXT NOT NULL REFERENCES characters(id), source_json JSONB NOT NULL, source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64),
 delivered_units INT NOT NULL DEFAULT 0 CHECK(delivered_units BETWEEN 0 AND 40), fills JSONB NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('assigned','paid')), bonus_cash INT NOT NULL DEFAULT 0 CHECK(bonus_cash BETWEEN 0 AND 10000),
 bonus_transaction TEXT UNIQUE REFERENCES transactions(id), wage_transaction TEXT UNIQUE REFERENCES transactions(id),
 claim_json JSONB, paid_at TIMESTAMPTZ,
 CHECK((state='paid')=(paid_at IS NOT NULL)), CHECK((bonus_cash>0)=(bonus_transaction IS NOT NULL)));
CREATE TABLE IF NOT EXISTS performance_employment_requests (
 account_id TEXT NOT NULL REFERENCES accounts(id), request_key TEXT NOT NULL CHECK(char_length(request_key) BETWEEN 1 AND 128),
 original_character TEXT NOT NULL REFERENCES characters(id), terms JSONB NOT NULL, receipt JSONB NOT NULL,
 employment_id TEXT NOT NULL UNIQUE REFERENCES performance_employment_contracts(employment_id),
 PRIMARY KEY(account_id,request_key));`;
