const DATE = /^\d{4}-\d{2}-\d{2}$/;

function getDate(raw, field) {
  if (typeof raw !== 'string' || !DATE.test(raw)) throw new Error(`${field} must be YYYY-MM-DD`);
  const time = Date.parse(`${raw}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== raw) {
    throw new Error(`Invalid ${field}`);
  }
  return time;
}

export function parseBbox(raw) {
  if (raw === undefined || raw === '' || raw === null) return null;
  if (typeof raw !== 'string') throw new Error('Invalid bbox');
  const arr = raw.split(',').map(Number);
  if (arr.length !== 4 || arr.some(n => !Number.isFinite(n))) throw new Error('bbox must be west,south,east,north');
  const [w, s, e, n] = arr;
  if (w < -180 || e > 180 || s < -90 || n > 90 || w >= e || s >= n) {
    throw new Error('Invalid bbox bounds');
  }
  return arr;
}

export function parseFilters(query, { map = false } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const from = query.from ?? start;
  const to = query.to ?? today;
  const a = getDate(from, 'from');
  const b = getDate(to, 'to');
  if (a > b) throw new Error('from must not be after to');
  if ((b - a) / 86400000 > 365) throw new Error('Date range must be at most 366 days');
  const country = String(query.country ?? 'AGO').toUpperCase();
  if (!/^[A-Z]{3}$/.test(country)) throw new Error('country must be a three-letter ISO code');
  const satellite = String(query.satellite ?? 'ALL');
  if (satellite.length > 80 || /[\x00-\x1f]/.test(satellite)) throw new Error('Invalid satellite');
  const filters = { country, satellite, from, to, bbox: parseBbox(query.bbox) };
  if (map) {
    filters.selectedBbox = parseBbox(query.selectedBbox);
    filters.limit = Math.min(3000, Math.max(100, Number.parseInt(query.limit ?? '2000', 10) || 2000));
  }
  return filters;
}
