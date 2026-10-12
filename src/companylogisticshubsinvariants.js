import { isDeepStrictEqual } from 'node:util';
export async function logisticsHubInvariant(client) {
  const hubs=(await client.query('SELECT id,total_units,warehouse_lease_id,supplier_character,state FROM company_logistics_hubs')).rows;
  const sources=(await client.query('SELECT * FROM company_logistics_hub_sources')).rows;
  const defects=[];
  for(const hub of hubs) {
    const items=sources.filter(item=>item.hub_id===hub.id);
    if(items.length<1||items.length>3||items.reduce((n,item)=>n+item.quantity,0)!==hub.total_units) defects.push({ hubId:hub.id,reason:'batch_bound' });
    for(const item of items.filter(row=>row.state==='completed')) {
      const finance=(await client.query('SELECT state,settlement,supplier_character FROM delivery_loan_requests WHERE id=$1',[item.finance_request_id])).rows[0];
      if(!finance||finance.state!=='settled'||finance.supplier_character!==hub.supplier_character||!isDeepStrictEqual(finance.settlement,item.settlement)
        ||item.settlement?.delivery?.delivered!==item.quantity) defects.push({ hubId:hub.id,position:item.position,reason:'canonical_settlement' });
      if(item.withdrawal_journal_id) {
        const journal=(await client.query('SELECT * FROM business_depot_journal WHERE id=$1',[item.withdrawal_journal_id])).rows[0];
        if(!journal||journal.reason!=='warehouse_withdraw'||journal.lease_id!==hub.warehouse_lease_id
          ||journal.customer_character!==hub.supplier_character||Number(journal.lease_stock_delta)!==-item.quantity) defects.push({ hubId:hub.id,position:item.position,reason:'own_custody' });
      }
    }
    if(hub.state==='completed'&&items.some(item=>item.state!=='completed')) defects.push({ hubId:hub.id,reason:'completion' });
  }
  return { name:'company logistics hub canonical work',ok:!defects.length,hubs:hubs.length,defects };
}
