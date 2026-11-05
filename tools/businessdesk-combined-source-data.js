// Unbound source-only comparison catalog. Bind only from an explicit clean authored commit.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const BUSINESS_DESK_COMBINED_SOURCE = freeze({
  version: 1,
  status: 'UNBOUND',
  phase: 'EXACT_MONITOR_WIKI_DESK_SOURCE_ONLY',
  sourceRevision: null,
  sourceTree: null,
  contextLines: 8,
  profiles: {
    desk: { revision: 'de84c0f7b3dfb18b8cb44e9b3a4563ad890d0660', tree: '147add1847b8b34e019f1a24afaa9c1d48e538f7' },
    monitor: { revision: 'ee3457ee8641a77b0ccd465440b7bbb00b02bbb0', tree: 'fda632480025d4242c4b04d0e17389004647b07a' },
    wiki: { revision: '6c4d37842f4d7ebd7f96d5fee9935720f442007a', tree: 'ca38e8e705f4d48df651a843b7f28d93d720a963' },
  },
  files: [],
  sourceOnly: true,
  runtime: false,
  native: false,
});
export const BUSINESS_DESK_COMBINED_SOURCE_SHA256 = 'UNBOUND';
