// Circle milestones reuse information the viewer can already read: their own inbox and
// messages explicitly shared to their current crew after they joined. No character stats,
// live whereabouts, or another person's private case progress are queried here.
const TYPES = ['mastery_up', 'protege_milestone', 'protege_graduated', 'mentor_accepted', 'crew_objective_done'];

export async function circleHighlights(client, ch) {
  const rows = (await client.query(
    `SELECT id, type, payload, created_at FROM notifications
      WHERE character_id=$1 AND type IN ($2,$3,$4,$5,$6)
      ORDER BY created_at DESC LIMIT 20`, [ch.id, ...TYPES])).rows;
  const highlights = rows.flatMap((row) => {
    let p;
    try { p = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload; } catch { return []; }
    if (!p || typeof p !== 'object') return [];
    const base = { id: row.id, at: row.created_at, source: 'inbox', relation: 'you' };
    if (row.type === 'mastery_up') return [{ ...base, kind: 'mastery', who: ch.name,
      text: `${String(p.name || 'A trade')} reached ${String(p.rank || 'a new rank')} (level ${Number(p.lvl) || 1})` }];
    if (row.type === 'protege_milestone') return [{ ...base, kind: 'mentor', relation: 'protégé',
      who: String(p.protege || 'Your protégé'), text: `reached level ${Number(p.lvl) || 1}` }];
    if (row.type === 'protege_graduated') return [{ ...base, kind: 'mentor', relation: 'protégé',
      who: String(p.protege || 'Your protégé'), text: 'graduated from your mentorship' }];
    if (row.type === 'mentor_accepted') return [{ ...base, kind: 'mentor', relation: 'protégé',
      who: String(p.protege || 'A newcomer'), text: 'began their mentorship with you' }];
    return [{ ...base, kind: 'objective', relation: 'crew', who: 'Your crew', text: 'completed its shared objective' }];
  });
  const mine = (await client.query('SELECT crew_id, joined_at FROM crew_members WHERE account_id=$1', [ch.account_id])).rows[0];
  if (mine) {
    const messages = (await client.query(
      `SELECT id, name, body, at FROM chat_messages
        WHERE channel=$1 AND at >= $2 AND body LIKE $3 ORDER BY at DESC LIMIT 20`,
      [`crew:${mine.crew_id}`, mine.joined_at || new Date(0), '[Milestone] %'])).rows;
    for (const m of messages) highlights.push({ id: m.id, at: m.at, kind: 'shared', source: 'crew message',
      relation: 'crew', who: m.name, text: String(m.body).slice('[Milestone] '.length) });
  }
  return highlights.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 20);
}
