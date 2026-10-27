import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs';
import { state } from './state.js';

const EMPTY = { type: 'FeatureCollection', features: [] };
const styles = {
  confidence: ['match', ['get', 'confidenceGroup'],
    'High', '#ef4b49', 'Nominal', '#f5963a', 'Low', '#eed176', 'Other', '#a58cfc', '#8096ae'],
  satellite: ['match', ['get', 'satellite'],
    'Terra', '#f26e55', 'Aqua', '#f6be5d', 'Suomi NPP', '#51c3bc', 'NOAA-20', '#7b9df3', '#a995fa']
};
let map;
let loaded = false;
let onMoveEnd = () => {};
const escapeHtml = value => String(value ?? '—').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'", '&#39;');

export async function initMap() {
  map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/dark',
    center: [17.6, -11.8], zoom: 4.4, minZoom: 2, maxZoom: 16,
    attributionControl: { compact: true }
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
  map.on('moveend', () => onMoveEnd());
  map.on('error', e => console.warn('Map tile/style error:', e.error?.message ?? e));
  return new Promise(resolve => {
    map.on('load', () => {
      loaded = true;
      map.addSource('detections', { type: 'geojson', data: EMPTY,
        cluster: true, clusterRadius: 46, clusterMaxZoom: 10 });
      map.addLayer({ id: 'clusters', type: 'circle', source: 'detections', filter: ['has', 'point_count'],
        paint: { 'circle-color': '#fb7d4f', 'circle-opacity': .83,
          'circle-radius': ['step', ['get','point_count'], 17, 20, 22, 100, 29],
          'circle-stroke-width': 2, 'circle-stroke-color': '#ffddad' } });
      map.addLayer({ id: 'cluster-count', type: 'symbol', source: 'detections', filter: ['has', 'point_count'],
        layout: { 'text-field': ['get','point_count_abbreviated'], 'text-size': 11 },
        paint: { 'text-color': '#122238' } });
      map.addLayer({ id: 'detections', type: 'circle', source: 'detections', filter: ['!', ['has', 'point_count']],
        paint: { 'circle-color': styles.confidence, 'circle-radius': ['interpolate',['linear'],['zoom'],2,3,8,6,14,9],
          'circle-opacity': .78, 'circle-stroke-width': .65, 'circle-stroke-color': '#fff5dc' } });
      map.on('click', 'clusters', e => {
        const feat = e.features?.[0];
        if (!feat) return;
        map.getSource('detections').getClusterExpansionZoom(feat.properties.cluster_id).then(zoom => {
          map.easeTo({ center: feat.geometry.coordinates, zoom });
        }).catch(console.warn);
      });
      map.on('click','detections',e => {
        const f = e.features?.[0]; if (!f) return;
        const p = f.properties;
        const units = state.dashboard?.meta?.units || {};
        const tUnit = units.temperature || '(source units unconfirmed)';
        const bUnit = units.brightness || '(source units unconfirmed)';
        new maplibregl.Popup({ maxWidth:'240px' }).setLngLat(f.geometry.coordinates)
          .setHTML(`<div class="popup-content" style="font-family:sans-serif;color:#1b2835;line-height:1.6"><b>Satellite fire detection</b><div>${escapeHtml(p.dateTime)}</div><div>Satellite: <b>${escapeHtml(p.satellite)}</b></div><div>Temperature: ${escapeHtml(p.temperature)} ${escapeHtml(tUnit)}</div><div>Brightness: ${escapeHtml(p.brightness)} ${escapeHtml(bUnit)}</div><div>Confidence: ${escapeHtml(p.confidence)} (${escapeHtml(p.confidenceGroup)})</div><small>${escapeHtml(p.region)}</small></div>`)
          .addTo(map);
      });
      for (const layer of ['clusters','detections']) {
        map.on('mouseenter',layer,() => { map.getCanvas().style.cursor='pointer'; });
        map.on('mouseleave',layer,() => { map.getCanvas().style.cursor=''; });
      }
      resolve(map);
    });
  });
}
export function onMapMoved(handler) { onMoveEnd = handler; }
export function mapReady() { return loaded; }
export function currentBbox() {
  if (!map || !loaded) return null;
  const b = map.getBounds();
  const w = Math.max(-180, b.getWest()), e = Math.min(180, b.getEast());
  const s = Math.max(-90, b.getSouth()), n = Math.min(90, b.getNorth());
  return w < e && s < n ? [w, s, e, n].map(v => +v.toFixed(5)) : null;
}
export function fitCountry(area) {
  if (loaded && area?.bounds) map.fitBounds([[area.bounds[0],area.bounds[1]],[area.bounds[2],area.bounds[3]]], { padding: 38, duration: 850 });
}
export function displayPoints(geojson) {
  if (loaded) map.getSource('detections')?.setData(geojson || EMPTY);
}
export function changeMapColors(colorBy) {
  if (loaded) map.setPaintProperty('detections', 'circle-color', styles[colorBy] ?? styles.confidence);
}
