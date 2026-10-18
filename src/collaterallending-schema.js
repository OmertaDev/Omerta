import crypto from 'node:crypto';

export const COLLATERAL_LENDING = Object.freeze({ templateId: 'item:precision_lock_tool', maximumPledges: 1,
  custody: 'original_borrower_account', liquidation: false, cashCurrency: 'game_cash', nativeOnly: true });
export const collateralStable = value => JSON.stringify(value, (_, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
  ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : entry);
export const collateralHash = value => crypto.createHash('sha256').update(collateralStable(value)).digest('hex');
export const collateralDate = value => new Date(value).toISOString();
export function collateralPledgeSource(row) {
  return { id: row.id, loanId: row.loan_id, itemId: row.item_id, borrowerAccount: row.borrower_account,
    borrowerCharacter: row.borrower_character, lenderAccount: row.original_lender_account, lenderCharacter: row.original_lender_character,
    principal: Number(row.principal), rate: Number(row.rate), hours: Number(row.hours), offeredAt: collateralDate(row.offered_at),
    dueAt: collateralDate(row.due_at), birthEvent: row.birth_event, birthMutation: row.birth_mutation,
    condition: Number(row.initial_condition), conditionRevision: Number(row.initial_condition_revision),
    takeJournal: row.take_journal, escrowEvent: row.escrow_event, createdAt: collateralDate(row.created_at) };
}
export function collateralTerminalSource(row) {
  return { pledgeId: row.pledge_id, loanId: row.loan_id, borrowerCharacter: row.borrower_character,
    holderCharacter: row.holder_character, holderAccount: row.holder_account, kind: row.kind,
    paid: Number(row.paid_cash), received: Number(row.received_cash), vig: Number(row.vig_cash),
    payJournal: row.pay_journal, receiveJournal: row.receive_journal, receipt: typeof row.receipt === 'string' ? JSON.parse(row.receipt) : row.receipt,
    createdAt: collateralDate(row.created_at) };
}

// Component DDL proposal; canonical schema, books and release catalogs belong to the coordinator.
// loan_id intentionally has no FK: ordinary canonical borrower death deletes its cash-loan row.
export const collateralLendingDDL = `CREATE TABLE IF NOT EXISTS collateral_lending_pledges (
 id TEXT PRIMARY KEY,loan_id TEXT NOT NULL UNIQUE,item_id TEXT NOT NULL REFERENCES item_instances(id),
 borrower_account TEXT NOT NULL REFERENCES accounts(id),borrower_character TEXT NOT NULL REFERENCES characters(id),
 original_lender_account TEXT NOT NULL REFERENCES accounts(id),original_lender_character TEXT NOT NULL REFERENCES characters(id),
 principal INT NOT NULL CHECK(principal BETWEEN 5000 AND 1000000),rate NUMERIC NOT NULL CHECK(rate>0 AND rate<=0.5),
 hours INT NOT NULL CHECK(hours BETWEEN 1 AND 72),offered_at TIMESTAMPTZ NOT NULL,due_at TIMESTAMPTZ NOT NULL,
 birth_event TEXT NOT NULL REFERENCES item_events(id),birth_mutation TEXT NOT NULL,
 initial_condition INT NOT NULL CHECK(initial_condition BETWEEN 10 AND 100),initial_condition_revision INT NOT NULL CHECK(initial_condition_revision>=0),
 take_journal TEXT NOT NULL UNIQUE REFERENCES transactions(id),escrow_event TEXT NOT NULL UNIQUE REFERENCES item_events(id),
 source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64),created_at TIMESTAMPTZ NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('held','released','estate_released')),released_at TIMESTAMPTZ,
 release_event TEXT UNIQUE REFERENCES item_events(id),release_kind TEXT CHECK(release_kind IN ('repaid','collected','borrower_estate')),
 CHECK(borrower_account<>original_lender_account AND borrower_character<>original_lender_character),
 CHECK(due_at>offered_at),CHECK((state='held' AND released_at IS NULL AND release_event IS NULL AND release_kind IS NULL)
 OR (state='released' AND released_at IS NOT NULL AND release_event IS NOT NULL AND release_kind IN ('repaid','collected'))
 OR (state='estate_released' AND released_at IS NOT NULL AND release_event IS NOT NULL AND release_kind='borrower_estate')));
CREATE UNIQUE INDEX IF NOT EXISTS collateral_lending_one_held_uid ON collateral_lending_pledges(item_id) WHERE state='held';
CREATE UNIQUE INDEX IF NOT EXISTS collateral_lending_one_held_original ON collateral_lending_pledges(borrower_character) WHERE state='held';
CREATE TABLE IF NOT EXISTS collateral_lending_requests (
 account_id TEXT NOT NULL,request_key TEXT NOT NULL CHECK(char_length(request_key) BETWEEN 1 AND 128),
 run_id TEXT NOT NULL UNIQUE,action TEXT NOT NULL CHECK(action IN ('pledge','repay','release')),
 body_hash TEXT NOT NULL CHECK(char_length(body_hash)=64),request_json JSONB NOT NULL,receipt JSONB,
 account_ref TEXT REFERENCES accounts(id),original_character TEXT REFERENCES characters(id),pledge_id TEXT REFERENCES collateral_lending_pledges(id),
 PRIMARY KEY(account_id,request_key),CHECK((receipt IS NULL AND account_ref IS NULL AND original_character IS NULL AND pledge_id IS NULL)
 OR (receipt IS NOT NULL AND account_ref=account_id AND account_ref IS NOT NULL AND original_character IS NOT NULL AND pledge_id IS NOT NULL)));
CREATE TABLE IF NOT EXISTS collateral_lending_terminals (
 pledge_id TEXT PRIMARY KEY REFERENCES collateral_lending_pledges(id),loan_id TEXT NOT NULL UNIQUE,
 borrower_character TEXT NOT NULL REFERENCES characters(id),holder_character TEXT NOT NULL REFERENCES characters(id),
 holder_account TEXT NOT NULL REFERENCES accounts(id),kind TEXT NOT NULL CHECK(kind IN ('repaid','collected')),
 paid_cash INT NOT NULL CHECK(paid_cash>=0),received_cash INT NOT NULL CHECK(received_cash>=0),vig_cash INT NOT NULL CHECK(vig_cash>=0),
 pay_journal TEXT UNIQUE REFERENCES transactions(id),receive_journal TEXT UNIQUE REFERENCES transactions(id),receipt JSONB NOT NULL,
 mutation_key TEXT NOT NULL UNIQUE REFERENCES item_mutation_guards(idempotency_key),source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64),
 created_at TIMESTAMPTZ NOT NULL,CHECK(paid_cash=received_cash+vig_cash),CHECK(borrower_character<>holder_character),
 CHECK((paid_cash=0 AND pay_journal IS NULL AND receive_journal IS NULL) OR
 (paid_cash>0 AND pay_journal IS NOT NULL AND receive_journal IS NOT NULL AND pay_journal<>receive_journal)));`;
