import assert from 'node:assert/strict';
import { questStudyReport } from '../tools/quest-quality-study.js';

const now = Date.parse('2026-11-07T12:00:00Z');
const row = (id, study) => ({ instance_id: `case-${id}`, fact_key: `runtime.quality.actor:private-account-${id}`,
  namespace: 'test.quest', version: 2, content_hash: 'a'.repeat(64), value_json: JSON.stringify({ study }) });
const comprehension = { answers: { what: 'A courier left.', why: 'Independent records agree.', next: 'Ask a narrower question.' }, submittedAt: new Date(now).toISOString() };
const rows = [row('withdrawn', null), row('ai', { consented: true, evidenceType: 'ai', familiarity: 'new', comprehension, eligibleAt: new Date(now + 86400000).toISOString() }),
  row('human', { consented: true, evidenceType: 'self_reported_human', familiarity: 'new', comprehension, eligibleAt: new Date(now - 1).toISOString() })];
const report = questStudyReport(rows, now);
assert.equal(report.counts.total, 2); assert.equal(report.counts.automated, 1); assert.equal(report.counts.selfReportedHuman, 1);
assert.equal(report.counts.delayedRecall, 0, 'Code verification cannot manufacture recall results.');
assert.equal(report.sessions[0].status, 'waiting_24_hours'); assert.equal(report.sessions[1].status, 'recall_eligible');
assert(!JSON.stringify(report).includes('private-account-'), 'Operator reports use pseudonymous session handles.');
assert.deepEqual(report.sessions[1].comprehension, comprehension, 'Raw free responses remain intact for organizer review.');
assert.equal(questStudyReport([], now).researchStatus, 'awaiting_user_arranged_testers');
console.log('quest quality study: consent withdrawal, evidence labels, pseudonyms, raw responses and honest pending research passed');
