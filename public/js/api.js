function queryString(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  return params.toString();
}
async function get(path, filters = {}, signal) {
  const url = `/api/${path}?${queryString(filters)}`;
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
  return data;
}
export const api = {
  areas: () => get('areas'),
  dashboard: (filters, signal) => get('dashboard', filters, signal),
  points: (filters, signal) => get('map-points', filters, signal)
};
export function filterParams(state, extra = {}) {
  return { country: state.country, satellite: state.satellite, from: state.from, to: state.to,
    ...(state.selectedBbox ? { bbox: state.selectedBbox } : {}), ...extra };
}
