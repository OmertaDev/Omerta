// Read-only presentation helpers. They never submit actions or grant game authority.
(() => {
  const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const known = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null;
  window.PlayerExperience = Object.freeze({
    marketQuote(l, input, me, fees = {}, now = Date.now()) {
      const qty = /^\d+$/.test(String(input)) ? Number(input) : NaN;
      const fail = reason => ({ ready:false, reason, qty, net:null });
      if (!Number.isSafeInteger(qty) || qty < 1) return fail('Enter a whole quantity greater than zero.');
      if (!l || !['good','order'].includes(l.kind)) return fail('Refresh the listing.');
      if (!Number.isFinite(Date.parse(l.expiresAt)) || Date.parse(l.expiresAt) <= now) return fail('This listing expired. Refresh the market.');
      if (!me?.id || !l.sellerId) return fail('Refresh your identity and the listing.');
      if (l.sellerId === me.id) return fail('This is your listing.');
      if (!me.loc || l.district !== me.loc) return fail('Travel to the listed district first.');
      if (number(me.jailSeconds)>0) return fail('Leave jail before trade.');
      const stock = known(l.kind === 'order' ? l.wanted : l.qty), price = known(l.unitPrice);
      if (stock === null || qty > stock || price === null) return fail('Quantity or price is unavailable. Refresh the market.');
      const gross = qty * price;
      if (!Number.isSafeInteger(gross)) return fail('Total is outside the supported range.');
      if (l.kind === 'good') {
        const cap = known(me.cargoCap), cargo = me.cargo;
        if (cap === null || !cargo || Object.values(cargo).some(v=>known(v)===null)) return fail('Refresh your cargo capacity.');
        if (qty > cap - Object.values(cargo).reduce((a,b)=>a+Number(b),0)) return fail('Not enough cargo space for this quantity.');
        const cash = known(me.cash);
        if (cash === null || cash < gross) return fail('Not enough known pocket cash for this quantity.');
        return {ready:true,qty,gross,debit:gross,net:null,after:cash-gross,reason:''};
      }
      if (!me.cargo || known(me.cargo[l.good] ?? 0) < qty) return fail('Not enough goods in your trunk.');
      const bps=known(fees.takeBps), fee=bps !== null && bps <= 10000 ? Math.ceil(gross*bps/10000) : null;
      const net=fee===null?null:gross-fee, cash=known(me.cash);
      return {ready:true,qty,gross,fee,net,after:cash===null||net===null?null:cash+net,reason:''};
    },
    marketListings(listings, filters = {}) {
      return listings.filter(l=>(!filters.direction || filters.direction==='all' || (filters.direction==='sell' ? l.kind==='order' : l.kind!=='order'))
        && (!filters.kind || filters.kind==='all' || l.kind===filters.kind)
        && (!filters.district || l.district===filters.district)).slice().sort((a,b)=>filters.sort==='expiry'
          ? Date.parse(a.expiresAt)-Date.parse(b.expiresAt) : (known(a.unitPrice)??Infinity)-(known(b.unitPrice)??Infinity));
    },
    bank(me) {
      const total=known(me.bank), transit=known(me.bankInTransit);
      return {pocket:known(me.cash),total,transit,cleared:total===null||transit===null||transit>total?null:total-transit,seconds:known(me.bankClearSeconds)};
    },
    travel(me, cost, destination) {
      cost=known(cost); const cash=known(me?.cash);
      const reason=!me?.id || !me.loc || !destination || cost===null || cash===null ? 'Refresh the travel terms.'
        : destination===me.loc ? 'You are here.' : number(me.jailSeconds)>0 ? 'Leave jail before travel.' : cash<cost ? 'Not enough pocket cash.' : '';
      return {ready:!reason,reason,cost,after:cash===null||cost===null?null:cash-cost};
    },
    defence(me) {
      return [me.gun===undefined?'Gun status unknown.':!me.gun?'No gun carried.':`Gun: ${me.gun.name || me.gun}.`,
        me.vest===undefined?'Protection status unknown.':!me.vest?'No protection worn.':`Protection: ${me.vest.name || me.vest}.`,
        known(me.ammo)===null?'Ammunition unknown.':`Ammunition: ${me.ammo}.`];
    },
    progress(tracks) {
      const tabs={larceny:'streets',commerce:'market',wetwork:'pvp',chemistry:'kitchen',wheels:'garage',seamanship:'port',gambling:'den',muscle:'life',scores:'scores',fists:'boxing'};
      return tracks.map(t=>({...t,tab:tabs[t.id] || 'life',remaining:known(t.xp)===null||known(t.nextAt)===null?null:Math.max(0,Number(t.nextAt)-Number(t.xp))}));
    },
    crew(c, cap) {const members=known(c.members),capacity=known(cap);return {members,capacity,open:members===null||capacity===null?null:Math.max(0,capacity-members)};},
    activityReceipts(receipts, actor, tab) {return receipts.filter(r=>r.actor===actor && r.tab===tab && (!r.isCurrent || r.isCurrent()));},
    access(me, required) {
      return known(me?.level)===null||known(required)===null?'Refresh to load the access requirement.':Number(me.level)<Number(required)?`Requires level ${required}. You are level ${me.level}.`:'';
    },
    nextUnlock(me, crimes) {
      const next = crimes.filter(c => Number.isFinite(Number(c.lvl)) && Number(c.lvl) > number(me.level))
        .sort((a,b) => a.lvl-b.lvl);
      if (!next.length) return null;
      return { level: Number(next[0].lvl), names: next.filter(c=>Number(c.lvl)===Number(next[0].lvl)).map(c=>c.name) };
    },
    recovery(me) {
      return [
        number(me.jailSeconds)>0 && { label:'Review prison work and escape options', tab:'pen', seconds:number(me.jailSeconds) },
        number(me.hospSeconds)>0 && { label:'Review recovery at the Doc', tab:'life', seconds:number(me.hospSeconds) },
        number(me.safeSeconds)>0 && { label:'Review your safehouse before returning to the street', tab:'pvp', seconds:number(me.safeSeconds) },
      ].filter(Boolean);
    },
    waiting(me) {
      const clocks = [['gtaSeconds','Car theft'],['heistSeconds','Heists'],['trainSeconds','Training'],['missionSeconds','Missions']]
        .filter(([key])=>number(me[key])>0).map(([key,label])=>({label,seconds:number(me[key])}));
      const destinations = [];
      if (!number(me.jailSeconds) && !number(me.hospSeconds) && !number(me.safeSeconds)) {
        destinations.push({ tab:'streets',label:'Review crime and trade options' });
        if (!number(me.gtaSeconds)) destinations.push({ tab:'garage',label:'Review car theft' });
        if (!number(me.heistSeconds)) destinations.push({ tab:'scores',label:'Look for a heist role' });
      }
      destinations.push({ tab:'family',label:'Review Family goals' });
      return { clocks, destinations:destinations.slice(0,3) };
    },
    production(operations) {
      return operations.reduce((sum,op)=>({
        activeIncomePerHr:sum.activeIncomePerHr+(op.cold?0:number(op.incomePerHr)),
        upkeepPerHr:sum.upkeepPerHr+number(op.upkeepPerHr),
        pending:sum.pending+number(op.pending), upkeepOwed:sum.upkeepOwed+number(op.upkeepOwed),
        cold:sum.cold+(op.cold?1:0),
      }),{activeIncomePerHr:0,upkeepPerHr:0,pending:0,upkeepOwed:0,cold:0});
    },
    source(kind,seconds) {
      if (number(seconds)<=0) return 'Expired report. Refresh before use.';
      return kind==='informant' ? 'Informant report: bypasses disinformation.' : 'Wiretap report: disinformation can affect these facts.';
    },
    roleLabel(role,stats) { return `${role} (${stats[role] || 'role skill'})`; },
    blockerLabel(code) { return ({jailed:'in jail',hospitalized:'in hospital',safehouse:'in hiding',cooldown:'resting',dead:'dead',attempts:'no rescue attempts left',free:'already free'})[code] || 'not ready'; },
  });
})();
