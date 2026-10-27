import { state, getArea, displayDate } from './state.js';

const $ = id => document.getElementById(id);
const number = v => v == null || !Number.isFinite(v) ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 });
const text = (id, value) => { $(id).textContent = String(value); };
let toastTimeout;
export function toast(message) {
  const node = $('toast'); node.textContent = message; node.hidden = false;
  clearTimeout(toastTimeout); toastTimeout = setTimeout(()=> { node.hidden = true; }, 5500);
}
export function updateContext() {
  const area = getArea(state.country);
  const label = area?.name || state.country;
  text('mapCountryLabel', label.toUpperCase()); text('countryTitle', label);
  text('analyticsCountry', label); text('countryFlag', area?.flag || '🌐');
  text('periodLabel', `${displayDate(state.from)} — ${displayDate(state.to)} · UTC`);
  text('snapshotDates', `${state.from.slice(5)} / ${state.to.slice(5)}`);
  text('selectionNote', state.selectedBbox ? `Custom map area active · ${state.selectedBbox.map(v=>v.toFixed(2)).join(', ')}` : 'Analyzing the whole selected country.');
  $('clearViewBtn').disabled = !state.selectedBbox;
}
export function showDashboard(data) {
  const s = data.summary; const units = data.meta?.units || {};
  text('statDetections', number(s.detections));
  text('statTemperature', number(s.avgTemperature));
  text('statBrightness', number(s.avgBrightness));
  text('statSatellites', number(s.satellites));
  text('temperatureUnit', units.temperature ? `(${units.temperature})` : '(units unconfirmed)');
  text('brightnessUnit', units.brightness ? `(${units.brightness})` : '(units unconfirmed)');
  text('dataBadge', data.meta?.mode === 'demo' ? 'DEMO DATA · SYNTHETIC' : 'DATABASE');
  text('statusText', data.meta?.mode === 'demo' ? 'Illustrative, simulated observations' : 'Showing connected database records');
  const target = $('regionsList'); target.replaceChildren();
  if (!data.regions.length) {
    const p = document.createElement('p'); p.className = 'empty-state';
    p.textContent = 'No region names available for this selection.'; target.append(p); return;
  }
  const max = Math.max(1, ...data.regions.map(x=>x.count));
  for (const region of data.regions) {
    const row = document.createElement('div'); row.className = 'region-row';
    const label = document.createElement('span'); label.className='region-name';
    label.title=region.name; label.textContent=region.name;
    const bar = document.createElement('div'); bar.className='region-bar';
    const fill = document.createElement('div'); fill.className='region-fill'; fill.style.width=`${region.count/max*100}%`;bar.append(fill);
    const n = document.createElement('span');n.className='region-count';n.textContent=number(region.count);
    row.append(label,bar,n);target.append(row);
  }
}
export function updateLegend() {
  const items = state.colorBy === 'satellite' ? [
    ['#f26e55','Terra'],['#f6be5d','Aqua'],['#51c3bc','Suomi NPP'],['#7b9df3','NOAA-20'],['#a995fa','Other satellites']
  ] : [['#ef4b49','High confidence'],['#f5963a','Nominal confidence'],['#eed176','Low confidence'],['#a58cfc','Other'],['#8096ae','Unknown']];
  const parent = $('legendItems'); parent.replaceChildren();
  for (const [color,label] of items) {
    const row = document.createElement('div');
    const dot = document.createElement('i');dot.className='legend-dot';dot.style.background=color;
    const span=document.createElement('span');span.textContent=label;row.append(dot,span);parent.append(row);
  }
}
export function updateSatellites(data) {
  if (state.satellite !== 'ALL') return;
  const select = $('satelliteSelect');select.replaceChildren(new Option('All satellites','ALL'));
  for (const sat of data.satellites) select.add(new Option(sat.name,sat.name));
}
export function updateMapMeta(meta) {
  if (!meta) return;
  text('mapPointCount', `${number(meta.returned)} detections drawn${meta.limited ? ' · newest records only (capped)' : ''}`);
}
export function populateAreas(areas) {
  for (const id of ['countrySelect','compareSelect']) {
    const el = $(id);el.replaceChildren();
    for (const a of areas) el.add(new Option(`${a.flag||'🌐'}  ${a.name}`,a.code));
  }
  if (!areas.some(a => a.code === state.country)) state.country = areas[0]?.code;
  if (!areas.some(a=>a.code===state.compareCountry)) state.compareCountry = areas.find(a=>a.code!==state.country)?.code ?? state.country;
  $('countrySelect').value = state.country;
  $('compareSelect').value = state.compareCountry;
}
export function updateCompareLabels() {
  text('legendAreaA',getArea(state.country)?.name || state.country);
  text('legendAreaB',getArea(state.compareCountry)?.name || state.compareCountry);
}
