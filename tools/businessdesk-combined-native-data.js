// UNBOUND current source-provenance catalog; no native admission or prior-result authority.
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const BUSINESS_DESK_COMBINED_NATIVE=freeze({
  version:1,status:'UNBOUND',phase:'EXACT_MONITOR_WIKI_DESK_NATIVE_PROVENANCE_ONLY',
  sourceRevision:null,sourceTree:null,topSourceDefinitionSha256:null,parentRegistryDefinitionSha256:null,
  nativeClosure:[],reviewedFiles:[],files:[],sourceOnly:true,nativeAdmission:false,priorResultsTransferred:false,
});
export const BUSINESS_DESK_COMBINED_NATIVE_SHA256='UNBOUND';
