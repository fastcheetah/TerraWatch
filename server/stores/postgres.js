import { classifyConfidence, pointFeature } from '../analytics.js';


function whereClause(filters) {
  const values = [filters.country, filters.from, filters.to];
  const clauses = [
    `country_code = $1`,
    `recorded_at >= $2::date`,
    `recorded_at < ($3::date + INTERVAL '1 day')`
  ];
  if (filters.satellite !== 'ALL') {
    values.push(filters.satellite);
    clauses.push(`satellite = $${values.length}`);
  }
  for (const box of [filters.bbox, filters.selectedBbox]) {
    if (!box) continue;
    const start = values.length + 1;
    values.push(...box);
    clauses.push(`geom && ST_MakeEnvelope($${start}, $${start + 1}, $${start + 2}, $${start + 3}, 4326)`);
  }
  return { sql: clauses.join(' AND '), values };
}

function countNumber(value) { return Number(value) || 0; }
function numOrNull(v) { return v === null || v === undefined ? null : Number(v); }

export async function createPostgresStore() {
  // Lazy import: demo mode runs with Node alone, without installing pg.
  const { default: pg } = await import('pg');
  const { Pool } = pg;
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required for DATA_SOURCE=postgres');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_POOL_SIZE || 10),
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false,
    statement_timeout: 30000,
    query_timeout: 35000
  });
  const units = {
    temperature: process.env.TEMPERATURE_UNIT || '',
    brightness: process.env.BRIGHTNESS_UNIT || ''
  };

  return {
    async areas() {
      const result = await pool.query(`SELECT code, name, flag,
        west, south, east, north FROM country_catalog ORDER BY name`);
      return result.rows.map(row => ({ code: row.code, name: row.name, flag: row.flag || '🌐',
        bounds: [row.west,row.south,row.east,row.north].map(Number) }));
    },
    async dashboard(f) {
      const { sql, values } = whereClause(f);
      const [summary, trends, satellites, confidences, regions, scatter] = await Promise.all([
        pool.query(`SELECT COUNT(*)::bigint AS detections, AVG(temperature) AS avg_temperature,
          AVG(brightness) AS avg_brightness, COUNT(DISTINCT satellite) AS satellites
          FROM fire_detections WHERE ${sql}`, values),
        pool.query(`SELECT (recorded_at AT TIME ZONE 'UTC')::date AS date,
          COUNT(*)::bigint AS count, AVG(temperature) AS avg_temperature,
          AVG(brightness) AS avg_brightness FROM fire_detections WHERE ${sql}
          GROUP BY 1 ORDER BY 1`, values),
        pool.query(`SELECT COALESCE(satellite, 'Unknown') AS name, COUNT(*)::bigint AS count
          FROM fire_detections WHERE ${sql} GROUP BY 1 ORDER BY 2 DESC LIMIT 25`, values),
        pool.query(`SELECT confidence, COUNT(*)::bigint AS count
          FROM fire_detections WHERE ${sql} GROUP BY confidence`, values),
        pool.query(`SELECT region AS name, COUNT(*)::bigint AS count
          FROM fire_detections WHERE ${sql} AND region IS NOT NULL
          GROUP BY region ORDER BY 2 DESC LIMIT 6`, values),
        pool.query(`SELECT temperature, brightness, satellite FROM fire_detections
          WHERE ${sql} AND temperature IS NOT NULL AND brightness IS NOT NULL
          ORDER BY recorded_at DESC LIMIT 180`, values)
      ]);
      const row = summary.rows[0];
      const byDay = new Map(trends.rows.map(d => [
        d.date instanceof Date ? d.date.toISOString().slice(0, 10) : String(d.date).slice(0, 10), d
      ]));
      const daily = [];
      for (let t = Date.parse(`${f.from}T00:00:00Z`); t <= Date.parse(`${f.to}T00:00:00Z`); t += 86400000) {
        const date = new Date(t).toISOString().slice(0, 10);
        const d = byDay.get(date);
        daily.push({ date, count: d ? countNumber(d.count) : 0,
          avgTemperature: d ? numOrNull(d.avg_temperature) : null,
          avgBrightness: d ? numOrNull(d.avg_brightness) : null });
      }
      const confidenceBuckets = new Map();
      for (const c of confidences.rows) {
        const group = classifyConfidence(c.confidence);
        confidenceBuckets.set(group, (confidenceBuckets.get(group) || 0) + countNumber(c.count));
      }
      return {
        summary: { detections: countNumber(row.detections),
          avgTemperature: numOrNull(row.avg_temperature), avgBrightness: numOrNull(row.avg_brightness),
          satellites: countNumber(row.satellites) },
        trends: daily,
        satellites: satellites.rows.map(d => ({ name: d.name, count: countNumber(d.count) })),
        confidence: [...confidenceBuckets].map(([label, count]) => ({ label, count })),
        regions: regions.rows.map(d => ({ name: d.name, count: countNumber(d.count) })),
        scatter: scatter.rows.map(d => ({ temperature: Number(d.temperature), brightness: Number(d.brightness), satellite: d.satellite })),
        meta: { mode: 'postgres', units, scatterNote: '180 most recent matched detections at most',
          filters: { from: f.from, to: f.to } }
      };
    },
    async mapPoints(f) {
      const { sql, values } = whereClause(f);
      const i = values.length + 1;
      const result = await pool.query(`SELECT id, recorded_at AS "dateTime", latitude,
        longitude, temperature, brightness, satellite, confidence, region
        FROM fire_detections WHERE ${sql} ORDER BY recorded_at DESC LIMIT $${i}`,
      [...values, f.limit + 1]);
      const limited = result.rows.length > f.limit;
      return { type: 'FeatureCollection', features: result.rows.slice(0, f.limit).map(pointFeature),
        meta: { mode: 'postgres', returned: Math.min(result.rows.length, f.limit), limited,
          note: 'Map shows most recent matches; charts summarize all matching records.' } };
    },
    async close() { await pool.end(); }
  };
}
