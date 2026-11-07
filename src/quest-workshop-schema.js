// Optional additive fixture bootstrap. Production uses the canonical schema.sql.
// pg-mem rejects repeated CREATE TABLE constraint ASTs, so inspect each table
// before its literal DDL. Every emitted SQL statement remains statically visible.
export async function ensureQuestWorkshop(queryable) {
  const mysteries = await queryable.query("SELECT table_name FROM information_schema.tables WHERE table_name='quest_workshop_mysteries'");
  if (!mysteries.rowCount) {
    await queryable.query(`CREATE TABLE IF NOT EXISTS quest_workshop_mysteries (
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
    )`);
  }
  await queryable.query('CREATE INDEX IF NOT EXISTS ix_quest_workshop_author ON quest_workshop_mysteries(author_account_id)');
  await queryable.query('CREATE INDEX IF NOT EXISTS ix_quest_workshop_published ON quest_workshop_mysteries(status,published_at)');
  const plays = await queryable.query("SELECT table_name FROM information_schema.tables WHERE table_name='quest_workshop_plays'");
  if (!plays.rowCount) {
    await queryable.query(`CREATE TABLE IF NOT EXISTS quest_workshop_plays (
      mystery_id TEXT NOT NULL REFERENCES quest_workshop_mysteries(id),
      account_id TEXT NOT NULL REFERENCES accounts(id),
      attempts INT NOT NULL DEFAULT 0,
      solved_at TIMESTAMPTZ,
      stars INT CHECK (stars BETWEEN 1 AND 5),
      PRIMARY KEY (mystery_id,account_id)
    )`);
  }
}
