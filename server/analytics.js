export function classifyConfidence(raw) {
  if (raw === null || raw === undefined || raw === '') return 'Unknown';
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0 && n <= 100) {
    if (n >= 80) return 'High';
    if (n >= 50) return 'Nominal';
    return 'Low';
  }
  const v = String(raw).trim().toLowerCase();
  if (['h', 'high'].includes(v)) return 'High';
  if (['n', 'nominal', 'medium', 'moderate'].includes(v)) return 'Nominal';
  if (['l', 'low'].includes(v)) return 'Low';
  return 'Other';
}

export function pointFeature(d) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [Number(d.longitude), Number(d.latitude)] },
    properties: {
      id: String(d.id),
      dateTime: typeof d.dateTime === 'string' ? d.dateTime : new Date(d.dateTime).toISOString(),
      temperature: d.temperature == null ? null : Number(d.temperature),
      brightness: d.brightness == null ? null : Number(d.brightness),
      satellite: d.satellite ?? 'Unknown',
      confidence: d.confidence ?? null,
      confidenceGroup: classifyConfidence(d.confidence),
      region: d.region ?? 'Unspecified'
    }
  };
}

export function buildDashboard(detections, { from, to }, mode, units) {
  const daily = new Map();
  const satellites = new Map();
  const confidence = new Map();
  const regions = new Map();
  let tempSum = 0, tempN = 0, brightSum = 0, brightN = 0;
  for (const d of detections) {
    const date = d.dateTime.slice(0, 10);
    if (!daily.has(date)) daily.set(date, { date, count: 0, t: 0, tn: 0, b: 0, bn: 0 });
    const day = daily.get(date);
    day.count++;
    if (Number.isFinite(d.temperature)) { day.t += d.temperature; day.tn++; tempSum += d.temperature; tempN++; }
    if (Number.isFinite(d.brightness)) { day.b += d.brightness; day.bn++; brightSum += d.brightness; brightN++; }
    satellites.set(d.satellite, (satellites.get(d.satellite) ?? 0) + 1);
    const bucket = classifyConfidence(d.confidence);
    confidence.set(bucket, (confidence.get(bucket) ?? 0) + 1);
    if (d.region) regions.set(d.region, (regions.get(d.region) ?? 0) + 1);
  }
  // Include days with zero detections so line charts never imply missing days are zero by accident.
  const trends = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10);
    const d = daily.get(date);
    trends.push({ date, count: d?.count ?? 0,
      avgTemperature: d?.tn ? d.t / d.tn : null,
      avgBrightness: d?.bn ? d.b / d.bn : null });
  }
  const sorted = [...detections].sort((a, b) => b.dateTime.localeCompare(a.dateTime));
  return {
    summary: { detections: detections.length, avgTemperature: tempN ? tempSum / tempN : null,
      avgBrightness: brightN ? brightSum / brightN : null, satellites: satellites.size },
    trends,
    satellites: [...satellites].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    confidence: [...confidence].map(([label, count]) => ({ label, count })),
    regions: [...regions].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6),
    scatter: sorted.filter(d => Number.isFinite(d.temperature) && Number.isFinite(d.brightness))
      .slice(0, 180).map(d => ({ temperature: d.temperature, brightness: d.brightness, satellite: d.satellite })),
    meta: { mode, units, scatterNote: '180 most recent matched detections at most', filters: { from, to } }
  };
}
