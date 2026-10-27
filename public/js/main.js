import { api, filterParams } from './api.js';
import { state, getArea, setDays } from './state.js';
import { initMap, onMapMoved, currentBbox, fitCountry, mapReady, displayPoints, changeMapColors } from './map.js';
import { renderCharts, renderComparison } from './charts.js';
import { toast, showDashboard, updateContext, updateLegend, updateSatellites, updateMapMeta, populateAreas, updateCompareLabels } from './ui.js';

const $ = id => document.getElementById(id);
let dashboardController;
let mapController;
let dashboardVersion = 0;
let pointVersion = 0;
let mapTimer;
const common = () => filterParams(state);

async function refreshPoints() {
  if (!mapReady()) return;
  const version = ++pointVersion;
  mapController?.abort(); mapController = new AbortController();
  $('mapLoading').hidden=false;
  try {
    // bbox is map viewport; selectedBbox is the analysis rectangle. The API intersects both.
    const data = await api.points({country:state.country,satellite:state.satellite,
      from:state.from,to:state.to,bbox:currentBbox(),selectedBbox:state.selectedBbox,limit:2000}, mapController.signal);
    if (version !== pointVersion) return;
    displayPoints(data); state.mapMeta=data.meta; updateMapMeta(data.meta);
  } catch(e) { if (e.name !== 'AbortError') toast(`Map data: ${e.message}`); }
  finally { if(version === pointVersion) $('mapLoading').hidden=true; }
}
function queueMapRefresh() {
  clearTimeout(mapTimer);mapTimer=setTimeout(refreshPoints,260);
}
async function refreshComparison(version = dashboardVersion) {
  if (!state.dashboard) return;
  const secondCode = state.compareCountry;
  $('compareStatus').textContent = 'Updating comparison…';
  try {
    const comparison = secondCode === state.country && !state.selectedBbox
      ? state.dashboard
      : await api.dashboard({ ...common(), country: secondCode,
          bbox: undefined }); // country-wide comparison, regardless of a selected map rectangle
    if (version !== dashboardVersion || secondCode !== state.compareCountry) return;
    state.comparison = comparison;
    updateCompareLabels();
    renderComparison(getArea(state.country)?.name || state.country,state.dashboard,
      getArea(secondCode)?.name || secondCode,comparison,state.compareMetric);
    $('compareStatus').textContent = 'Equal date range & satellite filter';
  } catch(e) { if (version === dashboardVersion) { $('compareStatus').textContent = 'Unavailable';toast(`Comparison: ${e.message}`); } }
}
async function refreshDashboard() {
  const version = ++dashboardVersion;
  dashboardController?.abort();dashboardController = new AbortController();
  updateContext();
  $('statusText').textContent = 'Loading selected observations…';
  try {
    const dashboard = await api.dashboard(common(), dashboardController.signal);
    if (version !== dashboardVersion) return;
    state.dashboard = dashboard;
    showDashboard(dashboard);
    renderCharts(dashboard);
    if (state.satellite === 'ALL') updateSatellites(dashboard);
    refreshComparison(version);
  } catch(e) { if(e.name !== 'AbortError') { $('statusText').textContent='Unable to load data';toast(`Data request: ${e.message}`); } }
  queueMapRefresh();
}
function setCountry(code) {
  state.country=code;state.satellite='ALL';state.selectedBbox=null;
  $('satelliteSelect').value='ALL';
  updateContext();fitCountry(getArea(code));
  refreshDashboard();
}
function applyDates() {
  const from=$('dateFrom').value,to=$('dateTo').value;
  if (!from || !to || from > to) { toast('Choose a valid start and end date.');return; }
  if ((Date.parse(to)-Date.parse(from))/86400000 > 365) {toast('Choose a range of 366 days or less.');return;}
  state.from=from;state.to=to;refreshDashboard();
}
function downloadCSV() {
  if(!state.dashboard) {toast('No chart data available yet.');return;}
  const {trends}=state.dashboard;
  const csv=['date,fire_detections,avg_temperature,avg_brightness', ...trends.map(d=>
    [d.date,d.count,d.avgTemperature ?? '',d.avgBrightness ?? ''].join(','))].join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;
  a.download=`terrawatch_${state.country}_${state.from}_${state.to}.csv`;a.click();
  setTimeout(()=>URL.revokeObjectURL(href),1000);
}
function bindControls() {
  $('countrySelect').addEventListener('change',e=>setCountry(e.target.value));
  $('satelliteSelect').addEventListener('change',e=>{state.satellite=e.target.value;refreshDashboard();});
  $('colorSelect').addEventListener('change',e=>{state.colorBy=e.target.value;changeMapColors(state.colorBy);updateLegend();});
  $('rangeSelect').addEventListener('change',e=>{
    $('customDates').hidden=e.target.value!=='custom';
    if(e.target.value!=='custom') {setDays(Number(e.target.value));$('dateFrom').value=state.from;$('dateTo').value=state.to;refreshDashboard();}
  });
  $('applyDates').addEventListener('click',applyDates);
  $('selectViewBtn').addEventListener('click',()=>{
    if(!mapReady()) {toast('The map has not loaded. Check your internet connection.');return;}
    state.selectedBbox=currentBbox();
    if (!state.selectedBbox) {toast('Could not read a valid map area.');return;}
    refreshDashboard();
  });
  $('clearViewBtn').addEventListener('click',()=>{state.selectedBbox=null;refreshDashboard();});
  $('mapHome').addEventListener('click',()=>fitCountry(getArea(state.country)));
  $('compareSelect').addEventListener('change',e=>{state.compareCountry=e.target.value;refreshComparison();});
  $('metricSelect').addEventListener('change',e=>{
    state.compareMetric=e.target.value;
    if(state.dashboard && state.comparison) {
      renderComparison(getArea(state.country)?.name||state.country,state.dashboard,
        getArea(state.compareCountry)?.name||state.compareCountry,state.comparison,state.compareMetric);
    }
  });
  $('downloadBtn').addEventListener('click',downloadCSV);
  $('dateFrom').value=state.from;$('dateTo').value=state.to;
}
async function start() {
  bindControls();updateLegend();
  const areaRequest = api.areas().then(data=>{
    state.areas=data.areas;state.mode=data.mode;
    if (!data.areas?.length) throw new Error('The area catalog is empty.');
    populateAreas(data.areas);updateContext();
    refreshDashboard();
  }).catch(e=>toast(`Country catalog: ${e.message}`));
  // Map loads independently so dashboard/charts still work if tile networking fails.
  const mapRequest=initMap().then(()=>{
    onMapMoved(queueMapRefresh);
    fitCountry(getArea(state.country));queueMapRefresh();
  }).catch(e=>toast(`Map error: ${e.message}`));
  await areaRequest;
  void mapRequest;
}
start();
