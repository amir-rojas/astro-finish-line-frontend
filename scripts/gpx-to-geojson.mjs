// Convierte el GPX del recorrido en GeoJSON (fuente de verdad del trazado).
//
// Uso: node scripts/gpx-to-geojson.mjs <input.gpx> <output.geojson>
//
// El GeoJSON resultante es estándar (Feature + LineString con coordenadas
// [lon, lat, ele]). En `properties` se precalcula, por conveniencia de render,
// un perfil de elevación submuestreado [[km, ele], ...] y estadísticas reales
// (min/max/desnivel/distancia). La geometría sigue siendo el dato canónico.

import { readFileSync, writeFileSync } from 'node:fs';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('Uso: node scripts/gpx-to-geojson.mjs <input.gpx> <output.geojson>');
  process.exit(1);
}

const gpx = readFileSync(inPath, 'utf8');

// Nombre del track (metadata) si existe.
const nameMatch = gpx.match(/<name>([^<]+)<\/name>/);
const name = nameMatch ? nameMatch[1].trim() : 'Recorrido';

// Extrae cada <trkpt lat lon> con su <ele>.
const pts = [];
const re = /<trkpt[^>]*\blat="([^"]+)"[^>]*\blon="([^"]+)"[^>]*>\s*(?:<ele>([^<]+)<\/ele>)?/g;
let m;
while ((m = re.exec(gpx)) !== null) {
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  const ele = m[3] !== undefined ? Number(m[3]) : null;
  if (Number.isFinite(lat) && Number.isFinite(lon)) pts.push({ lat, lon, ele });
}

if (pts.length === 0) {
  console.error('No se encontraron <trkpt> en el GPX.');
  process.exit(1);
}

// Distancia haversine (metros) entre dos puntos.
const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
function haversine(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Distancia acumulada por punto (km) + estadísticas de elevación.
let cumM = 0;
let gain = 0;
let min = Infinity;
let max = -Infinity;
const withDist = pts.map((p, i) => {
  if (i > 0) {
    cumM += haversine(pts[i - 1], p);
    if (p.ele != null && pts[i - 1].ele != null) {
      const d = p.ele - pts[i - 1].ele;
      if (d > 0) gain += d;
    }
  }
  if (p.ele != null) {
    if (p.ele < min) min = p.ele;
    if (p.ele > max) max = p.ele;
  }
  return { ...p, km: cumM / 1000 };
});
const totalKm = cumM / 1000;

// Muestras submuestreadas (~140 puntos) para SVG limpio y liviano. Cada muestra
// lleva [km, ele, lon, lat] para alinear por índice el perfil de elevación con
// la silueta del trazado (hover sincronizado).
const TARGET = 140;
const step = Math.max(1, Math.floor(withDist.length / TARGET));
const samples = [];
for (let i = 0; i < withDist.length; i += step) {
  const p = withDist[i];
  if (p.ele != null) samples.push([round(p.km, 4), round(p.ele, 1), round(p.lon, 6), round(p.lat, 6)]);
}
// Asegura que el último punto (la meta) esté siempre presente.
const last = withDist[withDist.length - 1];
if (last.ele != null) samples.push([round(last.km, 4), round(last.ele, 1), round(last.lon, 6), round(last.lat, 6)]);

function round(n, dp) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

const geojson = {
  type: 'Feature',
  properties: {
    name,
    totalKm: round(totalKm, 2),
    elevation: {
      minM: round(min, 1),
      maxM: round(max, 1),
      gainM: Math.round(gain),
    },
    samples,
  },
  geometry: {
    type: 'LineString',
    coordinates: withDist.map((p) => [
      round(p.lon, 6),
      round(p.lat, 6),
      ...(p.ele != null ? [round(p.ele, 1)] : []),
    ]),
  },
};

writeFileSync(outPath, JSON.stringify(geojson, null, 2) + '\n');
console.log(
  `OK → ${outPath}\n  puntos: ${pts.length} (muestras: ${samples.length})` +
    `\n  distancia: ${geojson.properties.totalKm} km` +
    `\n  elevación: ${geojson.properties.elevation.minM}–${geojson.properties.elevation.maxM} m` +
    ` (desnivel +${geojson.properties.elevation.gainM} m)`,
);
