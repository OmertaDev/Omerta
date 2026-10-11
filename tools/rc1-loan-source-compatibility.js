import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export const LOAN_CANCEL_BASELINE_PIN = '663f71b15332367689b5b4db5cf7fc8d94e49249d8697cc6b98bb986607cb14e';
export const LOAN_CANCEL_MARKER_PIN = 'e5440abea494c28d3726aae9aee489953b731e168fbdf3d7713d894c655f6843';
export const LOAN_CANCEL_MARKER_REVISION = '1a1ca3637500126bbf99a9ce1a83c4d3be9d6374';
export const LOAN_CANCEL_MARKER_BLOB = '4708d8256eb9d40a83202c3ac371a9e2d9e735d9';
export const LOAN_CANCEL_BASELINE_BLOB = 'db7ab27afd46b9d983aea2e035cffeae22d9eba4';
export const LOAN_CANCEL_SOURCE_INVERSE = Object.freeze([
  "  return { ok: true, loanAction: 'cancel_offer', refunded: Number(loan.principal) };\n",
  "  return { ok: true, refunded: Number(loan.principal) };\n",
]);
const normalize = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
export const LOAN_CANCEL_SOURCE_TRANSFER = Object.freeze({ sourceRevision: LOAN_CANCEL_MARKER_REVISION,
  sourceBlob: LOAN_CANCEL_MARKER_BLOB, predecessorBlob: LOAN_CANCEL_BASELINE_BLOB,
  actualSha256: LOAN_CANCEL_MARKER_PIN, baselineSha256: LOAN_CANCEL_BASELINE_PIN, inverseChunks: 1,
  scope: 'Only cancelLoan output marker; complete prior loan source reconstructed. No accounting, selector, refund or authority qualification expanded.' });

export function assertLoanCancelMarkerTransfer(input) {
  const text = normalize(input), actualSha256 = hash(text);
  assert.equal(actualSha256, LOAN_CANCEL_MARKER_PIN, 'Loan output marker source changed');
  const [current, original] = LOAN_CANCEL_SOURCE_INVERSE;
  assert.equal(text.split(current).length, 2, 'Loan output marker inverse must be exact and unique');
  const baselineText = text.replace(current, original);
  assert.equal(hash(baselineText), LOAN_CANCEL_BASELINE_PIN, 'Loan source differs beyond the exact output marker');
  return { ...LOAN_CANCEL_SOURCE_TRANSFER, baselineText };
}
// Historical checkpoint sources may use the original whole-file pin. All other
// inputs must prove the one reviewed addition against the complete original blob.
export function qualifyLoanCancelSource(input) {
  const text = normalize(input);
  if (hash(text) === LOAN_CANCEL_BASELINE_PIN)
    return { actualSha256: LOAN_CANCEL_BASELINE_PIN, baselineSha256: LOAN_CANCEL_BASELINE_PIN, baselineText: text, inverseChunks: 0 };
  return assertLoanCancelMarkerTransfer(text);
}
