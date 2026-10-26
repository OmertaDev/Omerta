const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const UX_DIRECTOR_READER_SOURCE = freeze({version:1,status:'UNSEALED',phase:'EXACT_UX_DIRECTOR_READER_SOURCE_ONLY',revision:null,tree:null,targetRevision:'8b6c4f73e691e9ab6518f1539da464d1af17026f',targetTree:null,contextLines:3,files:[]});
export const UX_DIRECTOR_READER_SOURCE_SHA256 = null;
