// Historical transfers remain verifiable after later trades; current title is not frozen forever.
export async function collectAtomicBarterIssues(client) {
  const offers = (await client.query('SELECT * FROM atomic_barter_offers ORDER BY id')).rows;
  const requests = (await client.query('SELECT * FROM atomic_barter_requests ORDER BY account_id,request_key')).rows;
  const guards = (await client.query("SELECT * FROM item_mutation_guards WHERE idempotency_key LIKE 'barter:%' ORDER BY idempotency_key")).rows;
  const events = (await client.query("SELECT * FROM item_events WHERE idempotency_key LIKE 'barter:%' ORDER BY id")).rows;
  const issues = [], used = new Set();
  for (const request of requests) {
    const offer = offers.find(row => row.id === request.receipt?.offerId);
    if (!offer || !request.receipt || request.account_ref !== request.account_id
      || ![offer.maker_account,offer.taker_account].includes(request.account_id)
      || request.actor_ref !== (request.account_id === offer.maker_account ? offer.maker_character : offer.taker_character)) issues.push({ id:request.run_id,reason:'request_binding' });
  }
  for (const offer of offers) {
    if (offer.state !== 'completed') continue;
    const completed = requests.filter(row => row.receipt?.offerId === offer.id && row.receipt?.state === 'completed');
    if (completed.length !== 1 || completed[0].account_id !== offer.taker_account
      || JSON.stringify(completed[0].receipt) !== JSON.stringify(offer.receipt)) { issues.push({id:offer.id,reason:'completion_binding'}); continue; }
    for (const [ordinal,itemId,from,to] of [[0,offer.offered_item,offer.maker_account,offer.taker_account],[1,offer.requested_item,offer.taker_account,offer.maker_account]]) {
      const key = 'barter:' + completed[0].run_id + ':' + ordinal;
      used.add(key);
      const guard = guards.find(row => row.idempotency_key === key), legs = events.filter(row => row.idempotency_key === key);
      if (!guard || guard.mutation_kind !== 'transfer_item' || guard.owner_scope !== 'account' || guard.owner_id !== from
        || !guard.completed_at || !guard.result_json || legs.length !== 1 || legs[0].event_kind !== 'transferred'
        || legs[0].provenance_kind !== 'transferred' || legs[0].item_id !== itemId || legs[0].template_id !== 'item:precision_lock_tool'
        || legs[0].from_owner_scope !== 'account' || legs[0].from_owner_id !== from || legs[0].to_owner_scope !== 'account'
        || legs[0].to_owner_id !== to || legs[0].reason !== 'atomic barter') issues.push({id:offer.id,reason:'transfer_witness'});
    }
  }
  for (const row of [...guards,...events]) if (!used.has(row.idempotency_key)) issues.push({id:row.idempotency_key,reason:'unbound_transfer'});
  return issues;
}
