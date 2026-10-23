// Advisory board projections. Execution rechecks every condition under its existing locks.
export function heistMemberReadiness(member, now = Date.now()) {
  if (!member.alive) return { ready: false, blockers: ['dead'] };
  const blockers = [];
  for (const [field, code] of [['jail_until', 'jailed'], ['hosp_until', 'hospitalized'],
    ['safe_until', 'safehouse'], ['heist_at', 'cooldown']]) {
    if (member[field] && new Date(member[field]).getTime() > now) blockers.push(code);
  }
  return { ready: blockers.length === 0, blockers };
}

export function recommendHeistRole(roles, roleStats, stats) {
  return roles.reduce((best, role) => best === null || Number(stats[roleStats[role]] || 0) > Number(stats[roleStats[best]] || 0)
    ? role : best, null);
}
