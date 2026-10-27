# TerraWatch — Wildfire Explorer

A working **MapLibre GL JS + Chart.js** dashboard for country-based active-fire observations. It combines a dark map and a scrollable light analytics dashboard, with two-country comparisons and a small REST API that a teammate can connect to a large database.

> **Important:** It launches in **DEMO mode** with fully synthetic measurements. These are not NASA observations. The real 67 GB dataset is **not included** and cannot be connected automatically without database details. The provided PostgreSQL/PostGIS adapter works when your team's data is available in the documented schema.

## Quick start (Mac, Windows, Linux)

Prerequisite: Node.js 22+. In the extracted folder:

```bash
cp .env.example .env      # On Windows, copy manually if `cp` is unavailable
npm run dev
```

Open **http://localhost:3000** in your browser. Internet access is needed for MapLibre, Chart.js, fonts, and OpenFreeMap tiles (loaded from their public CDNs).

**Do not open `public/index.html` as a file.** Start the server above so `/api/` requests work.

## Features

- MapLibre GL JS, dark OpenFreeMap basemap, detection circles, built-in clustering, clickable popups, reset camera.
- Country dropdown sourced from `GET /api/areas` — not hardwired to five countries in the frontend.
- Date range (7/30/90 days or custom), satellite filtering, color by confidence or satellite.
- **Analyze visible map area** applies a longitude/latitude bounding-box filter to the dashboard and the map; Clear returns to the entire selected country.
- Summary statistics; Chart.js daily counts, satellite comparison, confidence distribution, temperature-vs-brightness scatter; regional bars.
- Country comparison of counts, mean temperature, or mean brightness on the same period.
- CSV export of filtered daily aggregates (not the entire raw dataset).
- Responsive desktop/mobile layout, errors and empty states.

## Important data interpretation

- A satellite detection is **not** necessarily one confirmed wildfire; repeated detections can describe one event.
- `temperature` and `brightness` are *separate source fields*, not automatically ambient temperature or heatwave measures. The UI shows a heatwave note rather than faking data.
- The app cannot infer sensor units. In `postgres` mode set `TEMPERATURE_UNIT` and `BRIGHTNESS_UNIT` **only after your teammate confirms them**.
- `confidence`: numerical 0–100 values are categorized as Low (<50), Nominal (50–79), High (80–100). `L`, `N`, `H` (or full text) are supported. Any other values are Other/Unknown. If your data uses another convention, change `server/analytics.js`.
- The **map** shows only up to 2,000 *most recent* matching points in the current viewport; it explicitly says when capped. **Charts** aggregate **all** matching rows, subject to the query filters, and are not inferred from those 2,000 points.
- The **scatter** chart samples at most 180 most recent matched detections; it is not guaranteed representative of the full population.
- A selected map rectangle changes the country dashboard, but the **other country in comparison uses its whole country**. For strict like-for-like spatial comparison, add a region selection interface for each country.

## REST data contract — share this with your teammate

The frontend does not reach into your teammate's database variables. Instead, it sends **URL parameters** and receives **versionable JSON**. This is reliable even if the frontend and database are deployed separately.

### `GET /api/areas`

```json
{
  "mode": "postgres",
  "areas": [
    { "code": "AGO", "name": "Angola", "flag": "🇦🇴", "bounds": [11.45, -18.04, 24.08, -4.37] }
  ]
}
```

`bounds` are `[west, south, east, north]` in EPSG:4326 longitude/latitude. The area catalog is stored in `country_catalog` and can contain all countries available in the dataset. Camera bounds are *not* geographic country polygons.

### `GET /api/dashboard`

Parameters: `country=AGO`, `from=2026-10-01`, `to=2026-10-27`, optional `satellite=Terra` (default `ALL`), optional `bbox=11,-18,24,-4`. Inclusive day dates in UTC, maximum 366 days.

Response:

```json
{
  "summary": { "detections": 1200, "avgTemperature": 37.2, "avgBrightness": 328.5, "satellites": 3 },
  "trends": [{ "date": "2026-10-01", "count": 47, "avgTemperature": 35.8, "avgBrightness": 320.2 }],
  "satellites": [{ "name": "Terra", "count": 600 }],
  "confidence": [{ "label": "High", "count": 290 }],
  "regions": [{ "name": "Luanda", "count": 75 }],
  "scatter": [{ "temperature": 38.1, "brightness": 330.0, "satellite": "Terra" }],
  "meta": { "mode": "postgres", "units": { "temperature": "", "brightness": "" }, "scatterNote": "180 most recent matched detections at most" }
}
```

These example numbers are **illustrative schema values**, not measured data. Missing numeric averages must be JSON `null`, not zero.

### `GET /api/map-points`

Parameters: same selection plus `bbox=...` (current *viewport*), `selectedBbox=...` (optional analysis rectangle), and `limit=2000` (capped by server at 3,000). Returns a valid GeoJSON `FeatureCollection` with properties:

```json
{
  "type": "FeatureCollection",
  "features": [{
    "type": "Feature",
    "geometry": { "type": "Point", "coordinates": [17.21, -12.3] },
    "properties": {
      "id": "123", "dateTime": "2026-10-25T11:20:00Z",
      "temperature": 38.1, "brightness": 330.0,
      "satellite": "Terra", "confidence": "82", "confidenceGroup": "High",
      "region": "Central"
    }
  }],
  "meta": { "returned": 1, "limited": false, "mode": "postgres" }
}
```

The backend should use `country` to restrict country records, not just approximate map extents. Note that the map endpoint's bbox defaults to the camera viewport; the dashboard's bbox is only populated when the user clicks **Analyze visible map**.

## Connecting your team's 67 GB dataset

The project supports two modes:

1. **Demo**: `.env` has `DATA_SOURCE=demo`. The generated samples are entirely synthetic and useful only for UI development.
2. **PostgreSQL + PostGIS**: Run `npm install pg` first. If your teammate uses PostgreSQL, run `db/schema.sql` **in a new database** or map your existing schema to the same column names. In `.env`, configure `DATA_SOURCE=postgres`, `DATABASE_URL`, and confirmed source units. Restart the server.

If your teammate uses **MongoDB, Firebase, DuckDB, BigQuery, an HTTP API or another database**, keep the frontend unchanged. Implement the **same three endpoints** in `server/index.js` using a new adapter, or replace `server/stores/postgres.js` to query the real source. The frontend only imports `api.js`; it should never contain SQL queries or database secrets.

### PostgreSQL column mapping

See `db/schema.sql`. The adapter expects `fire_detections` columns:

| Source / adapter | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Unique record identifier |
| `country_code` | yes | ISO 3166-1 alpha-3 country identifier |
| `recorded_at` | yes | Timestamp with timezone |
| `latitude`, `longitude`, `geom` | yes | Geo coordinates; `geom` PostGIS point |
| `temperature` | optional numeric | Measurement; units set by team |
| `brightness` | optional numeric | Measurement; units set by team |
| `satellite` | yes | Satellite name |
| `confidence` | optional | Numerical 0–100 or L/N/H, stored as text |
| `region` | optional | Province/administrative subdivision |

**Raw data might not contain `country_code` or `region`.** Those fields should be populated during ingestion using a reliable country/region polygon spatial join; do **not** classify country by approximate camera extents. Map your teammate's original names in the adapter/ingestion process. If their database stores only lat/lon, PostGIS can derive `geom`.

### Scaling past 67 GB

This demo is a **functional integration scaffold, not a production-performance guarantee**. `LIMIT` prevents transmitting raw rows to the browser, but SQL `COUNT`, `GROUP BY` and AVG may still scan a large part of a 67 GB table. Production recommendations:

1. Partition wildfire detections by date (for example, monthly) and index country/date plus PostGIS geometry; benchmark with `EXPLAIN (ANALYZE, BUFFERS)`.
2. Precompute aggregate daily counts/averages per country, satellite and region (materialized views or rollup tables), and handle bbox aggregations separately.
3. Serve viewport-aware *aggregated clusters* or vector tiles (MVT) at low zoom. A capped list of 2,000 most-recent points is not a density-preserving heatmap.
4. Add a tile/summary cache, rate limiting and API monitoring; pool and secure database connections. The starter includes a small 60-second in-memory dashboard cache, not a distributed solution.
5. Never commit `.env`, credential strings or the full data file to GitHub. Keep secret credentials on the backend, not `public/js`.

## File overview

```
public/index.html                App HTML/layout
public/styles.css                Dark-to-light responsive design
public/js/state.js               Shared selection variables
public/js/api.js                 Fetch/REST integration contract
public/js/map.js                 MapLibre map + viewport interaction
public/js/charts.js              Chart.js chart rendering
public/js/ui.js                  UI labels, metrics, legends
public/js/main.js                Orchestrates filters/map/charts
server/index.js                  Built-in Node HTTP server + REST routes
server/params.js                 Validates query parameters
server/analytics.js              Normalizes fields and demo aggregates
server/countries.js              Demo countries/camera extents
server/stores/demo.js            Generated **synthetic** records
server/stores/postgres.js        PostgreSQL/PostGIS implementation
 db/schema.sql                   Example schema and indexes
.env.example                     Environment variable contract
```

## Testing

```bash
npm test
npm start
# Open http://localhost:3000 and change country, dates, satellite, area selection and comparison.
```

To test the endpoints, in a second terminal:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/areas
curl 'http://localhost:3000/api/dashboard?country=AGO&from=2026-10-01&to=2026-10-27'
curl 'http://localhost:3000/api/map-points?country=AGO&from=2026-10-01&to=2026-10-27&bbox=11,-18,24,-4&limit=100'
```

For production, deploy the HTTP server behind an HTTPS reverse proxy. Change CDN usage to locally bundled dependencies if working offline or in a restricted environment. See the license/attribution terms for MapLibre, OpenFreeMap, OpenStreetMap and Chart.js.
