export async function runCompanyBankPortfolioInvariants(client) {
  const portfolios = (await client.query('SELECT * FROM company_bank_portfolios ORDER BY account_id')).rows;
  const issues = [];
  for (const portfolio of portfolios) {
    const bindings = (await client.query('SELECT * FROM company_bank_portfolio_loans WHERE account_id=$1', [portfolio.account_id])).rows;
    const funded = bindings.filter(b => b.origin === 'portfolio').reduce((sum, b) => sum + Number(b.principal), 0);
    if (funded !== Number(portfolio.lifetime_spent) || funded > portfolio.terms.lifetimeBudget) issues.push({ accountId: portfolio.account_id, reason: 'lifetime_budget' });
    const receipts = (await client.query('SELECT identity,receipt FROM company_bank_portfolio_receipts WHERE account_id=$1', [portfolio.account_id])).rows;
    for (const binding of bindings) {
      const lender = (await client.query('SELECT account_id FROM characters WHERE id=$1', [binding.original_lender])).rows[0];
      if (lender?.account_id !== portfolio.account_id) issues.push({ accountId: portfolio.account_id, loanId: binding.loan_id, reason: 'original_account' });
      if (binding.origin === 'portfolio') {
        const matching = receipts.filter(r => r.identity.action === 'run' && r.receipt.loanId === binding.loan_id && r.receipt.funded === Number(binding.principal));
        if (matching.length !== 1) issues.push({ accountId: portfolio.account_id, loanId: binding.loan_id, reason: 'funding_receipt' });
      }
    }
  }
  return { ok: issues.length === 0, portfolioCount: portfolios.length, issues };
}
