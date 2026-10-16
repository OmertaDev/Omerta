import { collateralStable, collateralHash, collateralDate } from './collaterallending-schema.js';
export { collateralStable as auctionStable, collateralHash as auctionHash, collateralDate as auctionDate };
export const COLLATERAL_AUCTION = Object.freeze({ maximumBids: 2, maximumOriginalBids: 1,
  minimumSeconds: 60, maximumSeconds: 3600, maximumBidCash: 2000000, currency: 'game_cash', nativeOnly: true,
  settlementWindowSeconds: 3600, cryptoAvailable: false, ranking: 'highest_cash_then_server_bid_id', consent: 'both_originals_before_loan_take' });
export function collateralAuctionTermsSource(row) {
  return { agreementId: row.id, loanId: row.loan_id, itemId: row.item_id, quoteHash: row.quote_hash,
    borrowerAccount: row.borrower_account, borrowerCharacter: row.borrower_character,
    lenderAccount: row.lender_account, lenderCharacter: row.lender_character, principal: Number(row.principal),
    owed: Number(row.owed), reserve: Number(row.reserve_cash), auctionSeconds: Number(row.auction_seconds),
    offeredAt: collateralDate(row.offered_at), preparedAt: collateralDate(row.prepared_at),
    proceeds: 'ordinary_full_cash_repayment_then_original_borrower_surplus',
    title: 'original_borrower_to_winning_account_after_actual_repayment',
    settlementWindowSeconds: COLLATERAL_AUCTION.settlementWindowSeconds, lawfulClaimTransfer: 'right_follows_holder_until_open_then_cancel_and_refund',
    emptyAuctionCancellation: 'original_borrower_or_current_holder_before_any_bid',
    termination: 'original_death_claim_transfer_terminal_debt_or_settlement_expiry_refunds_original_bids' };
}
export function collateralAuctionBidSource(row) {
  return { bidId: row.id, auctionId: row.auction_id, agreementHash: row.agreement_hash,
    bidderAccount: row.bidder_account, bidderCharacter: row.bidder_character, amount: Number(row.amount),
    debitJournal: row.debit_journal, createdAt: collateralDate(row.created_at),
    consent: 'escrow_until_settlement_or_original_refund', title: 'bidder_account' };
}
export const collateralAuctionDDL = `CREATE TABLE IF NOT EXISTS collateral_auction_agreements (
 id TEXT PRIMARY KEY,loan_id TEXT NOT NULL UNIQUE,item_id TEXT NOT NULL REFERENCES item_instances(id),
 quote_hash TEXT NOT NULL,borrower_account TEXT NOT NULL REFERENCES accounts(id),borrower_character TEXT NOT NULL REFERENCES characters(id),
 lender_account TEXT NOT NULL REFERENCES accounts(id),lender_character TEXT NOT NULL REFERENCES characters(id),
 principal INT NOT NULL CHECK(principal BETWEEN 5000 AND 1000000),owed INT NOT NULL CHECK(owed>=principal),
 reserve_cash INT NOT NULL CHECK(reserve_cash>=owed AND reserve_cash<=2000000),auction_seconds INT NOT NULL CHECK(auction_seconds BETWEEN 60 AND 3600),
 offered_at TIMESTAMPTZ NOT NULL,prepared_at TIMESTAMPTZ NOT NULL,source_hash TEXT NOT NULL,
 prepare_key TEXT NOT NULL UNIQUE REFERENCES item_mutation_guards(idempotency_key),
 approved_at TIMESTAMPTZ,approve_key TEXT UNIQUE REFERENCES item_mutation_guards(idempotency_key),
 CHECK(borrower_account<>lender_account AND borrower_character<>lender_character),
 CHECK((approved_at IS NULL AND approve_key IS NULL) OR (approved_at>=prepared_at AND approve_key IS NOT NULL)));
CREATE TABLE IF NOT EXISTS collateral_auctions (
 id TEXT PRIMARY KEY,agreement_id TEXT NOT NULL UNIQUE REFERENCES collateral_auction_agreements(id),
 pledge_id TEXT NOT NULL UNIQUE REFERENCES collateral_lending_pledges(id),pledge_hash TEXT NOT NULL,
 opened_at TIMESTAMPTZ NOT NULL,closes_at TIMESTAMPTZ NOT NULL,settle_until TIMESTAMPTZ NOT NULL,opened_by TEXT NOT NULL REFERENCES characters(id),
 open_key TEXT NOT NULL UNIQUE REFERENCES item_mutation_guards(idempotency_key),
 state TEXT NOT NULL CHECK(state IN ('open','settled','cancelled')),winning_bid TEXT,
 proceeds_journal TEXT UNIQUE REFERENCES transactions(id),sale_event TEXT UNIQUE REFERENCES item_events(id),
 release_request TEXT,settled_at TIMESTAMPTZ,closed_at TIMESTAMPTZ,close_reason TEXT,
 CHECK(closes_at>opened_at AND settle_until>closes_at),CHECK((state='open' AND closed_at IS NULL AND settled_at IS NULL AND winning_bid IS NULL)
 OR (state='cancelled' AND closed_at IS NOT NULL AND settled_at IS NULL AND winning_bid IS NULL)
 OR (state='settled' AND closed_at IS NOT NULL AND settled_at IS NOT NULL AND winning_bid IS NOT NULL AND proceeds_journal IS NOT NULL AND sale_event IS NOT NULL AND release_request IS NOT NULL)));
CREATE TABLE IF NOT EXISTS collateral_auction_bids (
 id TEXT PRIMARY KEY,auction_id TEXT NOT NULL REFERENCES collateral_auctions(id),agreement_hash TEXT NOT NULL,
 bidder_account TEXT NOT NULL REFERENCES accounts(id),bidder_character TEXT NOT NULL REFERENCES characters(id),
 amount INT NOT NULL CHECK(amount BETWEEN 5000 AND 2000000),debit_journal TEXT NOT NULL UNIQUE REFERENCES transactions(id),
 created_at TIMESTAMPTZ NOT NULL,source_hash TEXT NOT NULL,mutation_key TEXT NOT NULL UNIQUE REFERENCES item_mutation_guards(idempotency_key),
 state TEXT NOT NULL CHECK(state IN ('held','spent','refunded')),refund_journal TEXT UNIQUE REFERENCES transactions(id),resolved_at TIMESTAMPTZ,
 UNIQUE(auction_id,bidder_account),CHECK((state='held' AND refund_journal IS NULL AND resolved_at IS NULL)
 OR (state='spent' AND refund_journal IS NULL AND resolved_at IS NOT NULL)
 OR (state='refunded' AND refund_journal IS NOT NULL AND resolved_at IS NOT NULL)));
CREATE UNIQUE INDEX IF NOT EXISTS collateral_auction_one_original_held_bid ON collateral_auction_bids(bidder_character) WHERE state='held';
CREATE TABLE IF NOT EXISTS collateral_auction_requests (
 account_id TEXT NOT NULL REFERENCES accounts(id),request_key TEXT NOT NULL,action TEXT NOT NULL,
 body_hash TEXT NOT NULL,body_json JSONB NOT NULL,run_id TEXT NOT NULL UNIQUE,original_character TEXT NOT NULL REFERENCES characters(id),
 agreement_id TEXT REFERENCES collateral_auction_agreements(id),auction_id TEXT REFERENCES collateral_auctions(id),receipt JSONB,
 PRIMARY KEY(account_id,request_key));`;
