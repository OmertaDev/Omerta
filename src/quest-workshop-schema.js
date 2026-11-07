// Additive persistence for player-authored, value-neutral deduction puzzles.
export const QUEST_WORKSHOP_SCHEMA = `
CREATE TABLE IF NOT EXISTS quest_workshop_mysteries (
  id TEXT PRIMARY KEY,
  author_account_id TEXT NOT NULL REFERENCES accounts(id),
  author_credit TEXT NOT NULL,
  title TEXT NOT NULL,
  template_id TEXT NOT NULL,
  scene_id TEXT NOT NULL,
  culprit_id TEXT NOT NULL,
  clue_ids TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_quest_workshop_author ON quest_workshop_mysteries(author_account_id);
CREATE INDEX IF NOT EXISTS ix_quest_workshop_published ON quest_workshop_mysteries(status,published_at);
CREATE TABLE IF NOT EXISTS quest_workshop_plays (
  mystery_id TEXT NOT NULL REFERENCES quest_workshop_mysteries(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  attempts INT NOT NULL DEFAULT 0,
  solved_at TIMESTAMPTZ,
  stars INT CHECK (stars BETWEEN 1 AND 5),
  PRIMARY KEY (mystery_id,account_id)
);
`;

export async function ensureQuestWorkshop(queryable) {
  for (const statement of QUEST_WORKSHOP_SCHEMA.split(';').map((sql) => sql.trim()).filter(Boolean)) {
    const table = statement.match(/^CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
    // pg-mem rejects a repeated CREATE's unused constraint AST; PostgreSQL simply
    // skips it. Inspect table presence so this optional helper works in either driver.
    if (table && (await queryable.query('SELECT table_name FROM information_schema.tables WHERE table_name=$1', [table])).rowCount) continue;
    await queryable.query(statement);
  }
}
