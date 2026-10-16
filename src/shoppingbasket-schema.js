// Component proposal only. The coordinator owns canonical schema and native catalog integration.
export const shoppingBasketDDL = `
CREATE TABLE IF NOT EXISTS shopping_baskets (
 id TEXT PRIMARY KEY, buyer_account TEXT NOT NULL REFERENCES accounts(id), buyer_character TEXT NOT NULL REFERENCES characters(id),
 host_account TEXT NOT NULL REFERENCES accounts(id), host_character TEXT NOT NULL REFERENCES characters(id),
 lines JSONB NOT NULL, total_cash INTEGER NOT NULL CHECK(total_cash BETWEEN 2 AND 2000000),
 observed_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL, source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64),
 status TEXT NOT NULL CHECK(status IN ('quoted','completed','cancelled')), settlement JSONB,
 CHECK(buyer_account<>host_account AND buyer_character<>host_character), CHECK(expires_at>observed_at),
 CHECK((status='completed' AND settlement IS NOT NULL) OR(status<>'completed' AND settlement IS NULL))
);
CREATE TABLE IF NOT EXISTS shopping_basket_requests (
 account_id TEXT NOT NULL, key_hash TEXT NOT NULL CHECK(char_length(key_hash)=64), body_hash TEXT NOT NULL CHECK(char_length(body_hash)=64),
 run_id TEXT NOT NULL UNIQUE, request_json JSONB NOT NULL, receipt JSONB, account_ref TEXT REFERENCES accounts(id),
 original_character TEXT REFERENCES characters(id), basket_ref TEXT REFERENCES shopping_baskets(id), PRIMARY KEY(account_id,key_hash),
 CHECK((receipt IS NULL AND account_ref IS NULL AND original_character IS NULL AND basket_ref IS NULL)
  OR(receipt IS NOT NULL AND account_ref=account_id AND account_ref IS NOT NULL AND original_character IS NOT NULL AND basket_ref IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS shopping_basket_buyer_quotes ON shopping_baskets(buyer_character,status,expires_at);
CREATE INDEX IF NOT EXISTS shopping_basket_request_history ON shopping_basket_requests(basket_ref,original_character);
`;
