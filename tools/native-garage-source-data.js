const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const NATIVE_GARAGE_SOURCE = freeze({"status":"UNBOUND"});
export const NATIVE_GARAGE_SOURCE_SHA256 = "e8bec795e604c7bf7cedd672452591393be3f2612d385d917f75c679400300f8";
