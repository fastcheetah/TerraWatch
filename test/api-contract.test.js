import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFilters } from '../server/params.js';
import { demoStore } from '../server/stores/demo.js';
import { classifyConfidence } from '../server/analytics.js';

test('parseFilters accepts one country, date range, and optional bounding box', () => {
  const f = parseFilters({ country:'NGA',from:'2026-10-01',to:'2026-10-27',bbox:'2,4,15,14' });
  assert.equal(f.country,'NGA');
  assert.deepEqual(f.bbox,[2,4,15,14]);
  assert.equal(f.satellite,'ALL');
});
test('invalid date or inverted/illegal coordinates are rejected', () => {
  assert.throws(()=>parseFilters({from:'2026-02-30',to:'2026-10-27'}));
  assert.throws(()=>parseFilters({from:'2026-10-26',to:'2026-10-20'}));
  assert.throws(()=>parseFilters({bbox:'50,20,10,30'}));
});
test('confidence handles categorical and numeric satellite conventions',()=>{
  assert.equal(classifyConfidence('h'),'High');
  assert.equal(classifyConfidence('n'),'Nominal');
  assert.equal(classifyConfidence(83),'High');
  assert.equal(classifyConfidence(42),'Low');
  assert.equal(classifyConfidence(null),'Unknown');
});
test('dashboard and map use same country and date filters', async()=>{
  const filters = parseFilters({ country:'AGO',from:'2026-10-01',to:'2026-10-27' });
  const dashboard = await demoStore.dashboard(filters);
  assert.ok(dashboard.summary.detections > 0);
  assert.equal(dashboard.trends.length,27);
  assert.equal(dashboard.trends.reduce((sum,d)=>sum+d.count,0),dashboard.summary.detections);
  const geo = await demoStore.mapPoints({ ...filters,limit:100 });
  assert.equal(geo.type,'FeatureCollection');
  assert.ok(geo.features.length<=100);
  assert.ok(geo.features.every(f=>f.geometry.type==='Point'));
});
test('bounding rectangle restricts detections consistently',async()=>{
  const base = parseFilters({ country:'AGO',from:'2026-10-01',to:'2026-10-27' });
  const a = await demoStore.dashboard(base);
  const b = await demoStore.dashboard({...base,bbox:[14,-13,16,-10]});
  assert.ok(b.summary.detections <= a.summary.detections);
});
