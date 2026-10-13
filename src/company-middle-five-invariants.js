// Independent bounded source bindings; never authorization for new effects.
export async function collectMiddleFiveIssues(c) {
  const issues=[],partnerships=(await c.query('SELECT * FROM business_partnerships ORDER BY id LIMIT 1001')).rows;
  if(partnerships.length>1000)issues.push({reason:'partnership_check_limit'});
  for(const p of partnerships.slice(0,1000)){
    const contributions=(await c.query('SELECT * FROM business_partnership_contributions WHERE partnership_id=$1 ORDER BY id LIMIT 3',[p.id])).rows;
    const amounts=new Map();
    for(const row of contributions){const j=(await c.query('SELECT depot_id,reason,cash_delta FROM business_depot_journal WHERE id=$1',[row.fund_journal_id])).rows[0];
      if(![p.owner_character,p.partner_character].includes(row.actor_character)||!j||j.depot_id!==p.depot_id||j.reason!=='fund'||Number(j.cash_delta)!==Number(row.amount))issues.push({reason:'partnership_capital_source',id:p.id});
      amounts.set(row.actor_character,(amounts.get(row.actor_character)||0)+Number(row.amount));}
    if(contributions.length>2||(amounts.get(p.owner_character)||0)!==Number(p.owner_funded)||(amounts.get(p.partner_character)||0)!==Number(p.partner_funded))issues.push({reason:'partnership_capital_total',id:p.id});
    const transfers=(await c.query("SELECT character_id,reason,amount FROM transactions WHERE currency='cash' AND counterparty=$1 AND reason IN ('business_partnership:fund:pay','business_partnership:fund:receive','business_partnership:profit:pay','business_partnership:profit:receive') ORDER BY id LIMIT 1001",[p.id])).rows;
    const sum=(character,reason)=>transfers.filter(row=>row.character_id===character&&row.reason===reason).reduce((n,row)=>n+Number(row.amount),0);
    if(transfers.length>1000||sum(p.partner_character,'business_partnership:fund:pay')!==-Number(p.partner_funded)||sum(p.owner_character,'business_partnership:fund:receive')!==Number(p.partner_funded)
      ||sum(p.owner_character,'business_partnership:profit:pay')!==-Number(p.partner_paid)||sum(p.partner_character,'business_partnership:profit:receive')!==Number(p.partner_paid)
      ||transfers.some(row=>row.character_id!==(['business_partnership:fund:pay','business_partnership:profit:receive'].includes(row.reason)?p.partner_character:p.owner_character)))issues.push({reason:'partnership_transfer_binding',id:p.id});
    const distributions=(await c.query('SELECT * FROM business_partnership_distributions WHERE partnership_id=$1 ORDER BY id LIMIT 1001',[p.id])).rows;
    if(distributions.length>1000||distributions.reduce((n,r)=>n+Number(r.amount),0)!==Number(p.paid_total)||distributions.reduce((n,r)=>n+Number(r.partner_cash),0)!==Number(p.partner_paid)
      ||Math.floor(Number(p.paid_total)*p.terms.partnerBps/10000)!==Number(p.partner_paid))issues.push({reason:'partnership_distribution_total',id:p.id});
    for(const row of distributions.slice(0,1000)){const j=(await c.query('SELECT depot_id,reason,cash_delta FROM business_depot_journal WHERE id=$1',[row.withdraw_journal_id])).rows[0];
      if(!j||j.depot_id!==p.depot_id||j.reason!=='withdraw'||Number(j.cash_delta)!==-Number(row.amount))issues.push({reason:'partnership_withdraw_source',id:p.id});}
  }
  const proposals=(await c.query("SELECT g.*,p.owner_account,p.partner_account,p.owner_character,p.partner_character FROM company_governance_proposals g JOIN business_partnerships p ON p.id=g.partnership_id WHERE g.state='executed' ORDER BY g.id LIMIT 1001")).rows;
  if(proposals.length>1000)issues.push({reason:'governance_check_limit'});
  for(const p of proposals.slice(0,1000)){const votes=(await c.query('SELECT * FROM company_governance_votes WHERE proposal_id=$1 ORDER BY account_id LIMIT 3',[p.id])).rows;
    if(votes.length!==2||!p.executed_at||votes.some(v=>v.approve!==true||v.proposal_hash!==p.proposal_hash||v.character_id!==(v.account_id===p.owner_account?p.owner_character:v.account_id===p.partner_account?p.partner_character:null)))issues.push({reason:'governance_original_consents',id:p.id});}
  const acquisitions=(await c.query("SELECT * FROM company_acquisitions WHERE state='executed' ORDER BY id LIMIT 1001")).rows;
  if(acquisitions.length>1000)issues.push({reason:'acquisition_check_limit'});
  for(const a of acquisitions.slice(0,1000)){const legs=(await c.query("SELECT * FROM transactions WHERE counterparty=$1 AND currency='cash' AND reason IN ('company_acquisition:pay','company_acquisition:receive') ORDER BY id LIMIT 3",[a.id])).rows;
    if(legs.length!==2||!a.accepted_at||!a.executed_at||a.pay_journal===a.receive_journal
      ||!legs.some(j=>j.id===a.pay_journal&&j.character_id===a.buyer_character&&j.reason==='company_acquisition:pay'&&Number(j.amount)===-Number(a.price))
      ||!legs.some(j=>j.id===a.receive_journal&&j.character_id===a.seller_character&&j.reason==='company_acquisition:receive'&&Number(j.amount)===Number(a.price))
      ||legs.some(j=>+new Date(j.at)<+new Date(a.accepted_at)||+new Date(j.at)>+new Date(a.executed_at)))issues.push({reason:'acquisition_paired_source',id:a.id});}
  return issues;
}
