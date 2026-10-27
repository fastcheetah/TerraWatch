// These extents are approximate camera frames, NOT authoritative country polygons.
// Additional countries may be added here without changing frontend code.
export const AREAS = [
  { code: 'AGO', name: 'Angola', flag: '🇦🇴', bounds: [11.45, -18.04, 24.08, -4.37] },
  { code: 'NGA', name: 'Nigeria', flag: '🇳🇬', bounds: [2.67, 4.28, 14.68, 13.90] },
  { code: 'GHA', name: 'Ghana', flag: '🇬🇭', bounds: [-3.27, 4.75, 1.20, 11.16] },
  { code: 'KEN', name: 'Kenya', flag: '🇰🇪', bounds: [33.90, -4.68, 41.91, 5.08] },
  { code: 'ZAF', name: 'South Africa', flag: '🇿🇦', bounds: [16.45, -34.82, 32.90, -22.13] }
];
export const COUNTRY_CODES = new Set(AREAS.map(a => a.code));
