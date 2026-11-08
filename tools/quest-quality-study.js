#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Evidence labels describe how a response was collected, not proof of someone's humanity.
export function questStudyReport(rows, now = Date.now()) {
  const sessions = rows.flatMap(row => {
    const actor = typeof row.value_json === 'string' ? JSON.parse(row.value_json) : row.value_json;
    const study = actor?.study;
    if (!study?.consented) return [];
    const sessionId = crypto.createHash('sha256').update(`${row.instance_id}\0${row.fact_key}`).digest('hex').slice(0, 24);
    return [{ sessionId, namespace: row.namespace, version: Number(row.version), contentHash: row.content_hash,
      evidenceType: study.evidenceType, familiarity: study.familiarity, consentedAt: study.consentedAt,
      comprehension: study.comprehension || null, recallEligibleAt: study.eligibleAt,
      recall: study.recall || null,
      status: study.recall ? 'recall_submitted' : study.comprehension
        ? now >= Date.parse(study.eligibleAt) ? 'recall_eligible' : 'waiting_24_hours' : 'comprehension_pending' }];
  });
  return { generatedAt: new Date(now).toISOString(),
    evidenceStatement: 'Self-reported human sessions require the organizer’s observation to establish human research. Automated sessions are listed separately. No participant results are inferred from code checks.',
    counts: { total: sessions.length, selfReportedHuman: sessions.filter(row => row.evidenceType === 'self_reported_human').length,
      automated: sessions.filter(row => row.evidenceType === 'ai').length,
      unspecified: sessions.filter(row => row.evidenceType === 'unspecified').length,
      comprehension: sessions.filter(row => row.comprehension).length, delayedRecall: sessions.filter(row => row.recall).length },
    researchStatus: sessions.some(row => row.evidenceType === 'self_reported_human' && row.comprehension)
      ? 'responses_available_for_organizer_review' : 'awaiting_user_arranged_testers', sessions };
}

async function main() {
  const [command, target] = process.argv.slice(2);
  if (!['export', 'report'].includes(command) || !target) throw new Error('Usage: node tools/quest-quality-study.js export output.json | report exported-rows.json');
  if (command === 'report') {
    const input = JSON.parse(fs.readFileSync(target, 'utf8'));
    const report = Array.isArray(input) ? questStudyReport(input) : input;
    if (!report || !Array.isArray(report.sessions) || !report.counts || typeof report.evidenceStatement !== 'string') {
      throw new Error('Use a study export or an array of operator-exported study rows.');
    }
    console.log(JSON.stringify(report, null, 2)); return;
  }
  if (!process.env.DATABASE_URL) throw new Error('The operator export needs its database connection supplied by the environment.');
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout = '20s'");
    const { rows } = await client.query(
      `SELECT f.instance_id,f.fact_key,f.value_json,i.namespace,i.version,i.content_hash
         FROM content_instance_facts f JOIN content_instances i ON i.id=f.instance_id
        WHERE f.fact_key LIKE 'runtime.quality.actor:%'
        ORDER BY i.namespace,f.instance_id,f.fact_key LIMIT 10001`,
    );
    if (rows.length > 10000) throw new Error('The study export exceeds its bounded batch; narrow the cohort before exporting.');
    const report = questStudyReport(rows);
    const output = path.resolve(target);
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    await client.query('COMMIT');
    console.log(JSON.stringify({ output, counts: report.counts, researchStatus: report.researchStatus }));
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
