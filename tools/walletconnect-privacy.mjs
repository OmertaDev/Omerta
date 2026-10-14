// AppKit queues mandatory events despite features.analytics=false. Preserve its
// public controller interface while disabling collection and network submission.
export function disableModalTracking(source) {
  const eventStart = source.indexOf('    sendEvent(data) {');
  const eventEnd = source.indexOf('    /**', eventStart);
  const impressionStart = source.indexOf('    sendWalletImpressionEvent(item) {');
  const impressionEnd = source.indexOf('    _transformPendingEventsForBatch', impressionStart);
  const submitStart = source.indexOf('    _submitPendingEvents() {');
  const submitEnd = source.indexOf('    subscribeToFlushTriggers() {', submitStart);
  if ([eventStart, eventEnd, impressionStart, impressionEnd, submitStart, submitEnd].some(index => index < 0) || !source.includes('MANDATORY_EVENTS'))
    throw new Error('Wallet modal tracking adapter changed; review it before building.');
  return source.slice(0, eventStart) + '    sendEvent() {},\n' + source.slice(eventEnd, impressionStart)
    + '    sendWalletImpressionEvent() {},\n' + source.slice(impressionEnd, submitStart)
    + '    _submitPendingEvents() {},\n' + source.slice(submitEnd);
}
