// Read-only presentation helpers. They never submit actions or grant game authority.
(() => {
  const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  window.PlayerExperience = Object.freeze({
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
