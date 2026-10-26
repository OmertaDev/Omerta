// Exact sale-page source transfer only. Seal against the committed authored source before use.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const SALE_SOURCE = freeze({ status: 'UNSEALED', files: [] });
export const SALE_SOURCE_SHA256 = '';
