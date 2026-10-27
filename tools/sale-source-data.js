// Unreleased sale source awaits its final merged authored seal.
const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const SALE_SOURCE = freeze({
  "version": 1,
  "status": "UNSEALED",
  "phase": "EXACT_SALE_PAGE_SOURCE_ONLY",
  "targetRevision": "bb55398ccc135228353e890648bda18222e76a35",
  "files": []
});
export const SALE_SOURCE_SHA256 = "1f736fc80bc89d6bf40e9048ff7b3a4dfd51234c01ceb43c6248a4d974b6b4dc";
