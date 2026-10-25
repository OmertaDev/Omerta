// Sealed only after the authored native-reader fix checkpoint exists. No native admission.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const UX_NATIVE_READER_SOURCE = freeze({ version: 1, status: 'UNSEALED', phase: 'EXACT_UX_NATIVE_READER_SOURCE_ONLY', revision: null, tree: null, targetRevision: 'a93245c8eb798dd3760720b65e61c300cb0fceed', targetTree: null, contextLines: 3, files: [] });
export const UX_NATIVE_READER_SOURCE_SHA256 = null;
