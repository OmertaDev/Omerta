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
    monitor: { revision: '966228e58e3b948ddcd3b85f40375dbf5364df1c', tree: '7a3a8e8768d8b4e386f39b313ac540eb7819f383' },
    wiki: { revision: '6c4d37842f4d7ebd7f96d5fee9935720f442007a', tree: 'ca38e8e705f4d48df651a843b7f28d93d720a963' },
  },
  files: [],
  sourceOnly: true,
  runtime: false,
  native: false,
});
export const BUSINESS_DESK_COMBINED_SOURCE_SHA256 = 'UNBOUND';
