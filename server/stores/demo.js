import { AREAS } from '../countries.js';
import { pointFeature, buildDashboard } from '../analytics.js';

// Completely synthetic detections: do not use these numbers for scientific decisions.
const SATELLITES = ['Terra', 'Aqua', 'Suomi NPP', 'NOAA-20'];
let seed = 481516;
const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const records = [];
const now = Date.now();
for (const area of AREAS) {
  const [west, south, east, north] = area.bounds;
  const hotspots = Array.from({ length: 6 }, () => ({
    longitude: west + (east - west) * (0.14 + rand() * 0.72),
    latitude: south + (north - south) * (0.14 + rand() * 0.72)
  }));
  const labels = ['Northern', 'Central', 'Eastern', 'Southern', 'Western'];
  for (let i = 0; i < 3200; i++) {
    const h = hotspots[Math.floor(rand() * hotspots.length)];
    const lon = Math.max(west, Math.min(east, h.longitude + (rand() - rand()) * (east - west) * 0.22));
    const lat = Math.max(south, Math.min(north, h.latitude + (rand() - rand()) * (north - south) * 0.22));
    const age = Math.floor(rand() * 119 * 86400000);
    const dateTime = new Date(now - age).toISOString();
    records.push({ id: `${area.code}-${i}`, country: area.code,
      latitude: +lat.toFixed(5), longitude: +lon.toFixed(5), dateTime,
      temperature: +(26 + rand() * 34).toFixed(2),
      brightness: +(295 + rand() * 105).toFixed(2),
      satellite: SATELLITES[Math.floor(rand() * SATELLITES.length)],
      confidence: Math.floor(rand() * 101),
      region: labels[Math.floor(rand() * labels.length)] + ' zone' });
  }
}

function isInside(d, bbox) {
  return !bbox || (d.longitude >= bbox[0] && d.longitude <= bbox[2] && d.latitude >= bbox[1] && d.latitude <= bbox[3]);
}
function getRows(f) {
  const from = `${f.from}T00:00:00.000Z`;
  const to = `${f.to}T23:59:59.999Z`;
  return records.filter(d => d.country === f.country && d.dateTime >= from && d.dateTime <= to &&
    (f.satellite === 'ALL' || d.satellite === f.satellite) && isInside(d, f.bbox) && isInside(d, f.selectedBbox));
}
export const demoStore = {
  async areas() { return AREAS; },
  async dashboard(filters) {
    return buildDashboard(getRows(filters), filters, 'demo', { temperature: '°C', brightness: 'K' });
  },
  async mapPoints(filters) {
    // Newest points only; the cap protects browser memory in real data mode too.
    const all = getRows(filters).sort((a, b) => b.dateTime.localeCompare(a.dateTime));
    const capped = all.slice(0, filters.limit);
    return {
      type: 'FeatureCollection', features: capped.map(pointFeature),
      meta: { mode: 'demo', returned: capped.length, limited: all.length > capped.length,
        note: 'Map shows most recent matches; charts summarize all matching records.' }
    };
  }
};
