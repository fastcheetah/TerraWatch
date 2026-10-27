// Public contract: state describes WHAT the user selected; the API supplies the DATA.
// Other frontend modules import this same object. Database code never needs to
// access browser variables; it receives these selections as URL query parameters.
const today = new Date();
const isoDay = date => date.toISOString().slice(0, 10);
export const state = {
  country: 'AGO',
  compareCountry: 'NGA',
  satellite: 'ALL',
  from: isoDay(new Date(today.getTime() - 29 * 86400000)),
  to: isoDay(today),
  selectedBbox: null,   // [west,south,east,north], EPSG:4326
  colorBy: 'confidence',
  compareMetric: 'count',
  areas: [],
  dashboard: null,
  comparison: null,
  mapMeta: null,
  mode: 'demo'
};
export function setDays(days) {
  state.to = isoDay(new Date());
  state.from = isoDay(new Date(Date.now() - (days - 1) * 86400000));
}
export function getArea(code) { return state.areas.find(a => a.code === code); }
export function displayDate(iso) {
  if (!iso) return '—';
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
