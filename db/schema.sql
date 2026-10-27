-- EXAMPLE schema for your teammate, NOT an instruction to overwrite their existing tables.
-- Apply this only to a new PostgreSQL/PostGIS database, or map an existing schema
-- to these column names in server/stores/postgres.js.
CREATE EXTENSION IF NOT EXISTS postgis;
-- Country catalog: add every country supported by the team's data.
-- Bounding boxes are map CAMERA extents, not country borders.
CREATE TABLE IF NOT EXISTS country_catalog (
  code CHAR(3) PRIMARY KEY,
  name TEXT NOT NULL,
  flag TEXT,
  west DOUBLE PRECISION NOT NULL,
  south DOUBLE PRECISION NOT NULL,
  east DOUBLE PRECISION NOT NULL,
  north DOUBLE PRECISION NOT NULL
);
INSERT INTO country_catalog(code,name,flag,west,south,east,north) VALUES
 ('AGO','Angola','🇦🇴',11.45,-18.04,24.08,-4.37),
 ('NGA','Nigeria','🇳🇬',2.67,4.28,14.68,13.90),
 ('GHA','Ghana','🇬🇭',-3.27,4.75,1.20,11.16),
 ('KEN','Kenya','🇰🇪',33.90,-4.68,41.91,5.08),
 ('ZAF','South Africa','🇿🇦',16.45,-34.82,32.90,-22.13)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS fire_detections (
  id BIGSERIAL PRIMARY KEY,
  country_code CHAR(3) NOT NULL,        -- AGO, NGA, GHA, KEN, ZAF, etc.
  region TEXT,                          -- optional state/province name
  recorded_at TIMESTAMPTZ NOT NULL,     -- UTC timestamps recommended
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  temperature DOUBLE PRECISION,         -- units declared separately in .env
  brightness DOUBLE PRECISION,          -- units declared separately in .env
  satellite TEXT NOT NULL,
  confidence TEXT,                      -- accepts numeric 0-100 or L/N/H etc.
  geom geometry(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
  ) STORED
);

-- Indexes useful for WHERE country, date range and viewport filter.
CREATE INDEX IF NOT EXISTS fire_country_time_idx
  ON fire_detections(country_code, recorded_at DESC);
CREATE INDEX IF NOT EXISTS fire_geom_gix
  ON fire_detections USING GIST(geom);
CREATE INDEX IF NOT EXISTS fire_satellite_idx
  ON fire_detections(satellite);
ANALYZE fire_detections;

-- For 67 GB: strongly consider partitions by recorded_at, region/category indexes
-- measured with EXPLAIN ANALYZE, precalculated daily rollups, and vector-tile or
-- geospatial aggregation endpoints for country/global zoom. Do not load the
-- entire table as GeoJSON into the browser.
