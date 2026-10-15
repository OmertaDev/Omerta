// Never interpolate game text into the trusted adviser instructions or link metadata.
export function museResponse(envelope) {
  const links = [{ label: 'Open Omerta', href: '/' }, { label: 'Manage Consigliere access', href: '/consigliere' }];
  if (['PREPARE', 'COMMIT'].includes(envelope.actionClass) && envelope.data?.confirmationRequired === true
    && typeof envelope.data.id === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(envelope.data.id)) {
    links.unshift({ label: 'Review this proposal in Omerta', href: '/consigliere?preparation=' + encodeURIComponent(envelope.data.id) });
  }
  return {
    schemaVersion: 'omerta.muse-result.v1',
    contentType: 'untrusted_game_data',
    gameData: envelope,
    links,
  };
}
