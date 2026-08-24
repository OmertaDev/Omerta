// Coach-rung completion is a harness assertion, so it must depend on the state
// that exists after the action being credited.
export function crimeCoachRungObeyed({ label, successfulCrime, postActionLevel }) {
  if (!label || !successfulCrime) return false;
  if (label.startsWith('Get to level 5')) return Number(postActionLevel) >= 5;
  return label.startsWith('Pull your first job')
    || label.startsWith('Out of nerve');
}
