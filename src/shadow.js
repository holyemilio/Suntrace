/**
 * shadow.js — Urban geometry: facade orientation and line-of-sight solar access
 * through nearby OpenStreetMap building footprints. Pure functions, no DOM.
 *
 * Buildings are `{ geom: [{lat, lon}, …], h: metres }`; coordinates are projected
 * to local metres centred on the observation point.
 */

import { solarPosition, localToUTC } from './solar.js';

// ─── local projection ─────────────────────────────────────────────────────────

/** Projector from lat/lon to metres relative to the observation point. */
export function localXY(clat, clng) {
  const mLat = 111320;
  const mLng = 111320 * Math.cos(clat * Math.PI / 180);
  return (la, lo) => ({ x: (lo - clng) * mLng, y: (la - clat) * mLat });
}

export function pointInPolygon(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x, yi = ring[i].y, xj = ring[j].x, yj = ring[j].y;
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

export function pointSegDist(p, a, c) {
  const abx = c.x - a.x, aby = c.y - a.y;
  const ab2 = abx * abx + aby * aby || 1e-9;
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

/** Outward normal of edge a→c on the side of the click, as an azimuth (0=N, 90=E, 0..360). */
export function outwardNormalAz(a, c, click) {
  let nx = -(c.y - a.y);
  let ny = (c.x - a.x);
  const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
  if (nx * (click.x - mx) + ny * (click.y - my) < 0) { nx = -nx; ny = -ny; }
  const deg = Math.atan2(nx, ny) * 180 / Math.PI;
  return (deg % 360 + 360) % 360;
}

/**
 * Facade azimuth: the outward normal (facing the click) of the nearest building
 * edge. Takes raw Overpass elements, which carry `geometry`.
 */
export function nearestFacadeAzimuth(clat, clng, buildings) {
  const xy = localXY(clat, clng);
  const click = { x: 0, y: 0 };

  let bestDist = Infinity;
  let bestAz = 180;
  for (const b of buildings) {
    const g = b.geometry;
    for (let i = 0; i < g.length - 1; i++) {
      const a = xy(g[i].lat, g[i].lon);
      const c = xy(g[i + 1].lat, g[i + 1].lon);
      const dist = pointSegDist(click, a, c);
      if (dist < bestDist) { bestDist = dist; bestAz = outwardNormalAz(a, c, click); }
    }
  }
  return Math.round(((bestAz % 360) + 360) % 360);
}

// ─── solar access (line-of-sight to the sun) ──────────────────────────────────

/**
 * True when a neighbouring building blocks the direct sun for an observer at the
 * point, at the given height (obsH, m). Casts a horizontal ray toward the sun and
 * checks whether any roof rises above the ray where it crosses a footprint.
 */
export function sunBlocked(clat, clng, buildings, azDeg, elevDeg, obsH) {
  if (elevDeg <= 1) return true; // sun on/below the horizon → no direct sun
  const xy = localXY(clat, clng);
  const az = azDeg * Math.PI / 180;
  const dir = { x: Math.sin(az), y: Math.cos(az) }; // horizontal sun direction (E, N)
  const tanE = Math.tan(elevDeg * Math.PI / 180);

  for (const b of buildings) {
    const ring = b.geom.map(p => xy(p.lat, p.lon));
    if (pointInPolygon(0, 0, ring)) continue; // skip the observer's own building
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i], c = ring[i + 1];
      const ex = c.x - a.x, ey = c.y - a.y;
      const det = dir.x * (-ey) - (-ex) * dir.y;
      if (Math.abs(det) < 1e-9) continue;             // ray parallel to the edge
      const tt = (-a.x * ey + ex * a.y) / det;        // distance along the ray
      const ss = (dir.x * a.y - dir.y * a.x) / det;   // position along the edge
      if (tt > 1 && ss >= 0 && ss <= 1) {
        const rayH = obsH + tt * tanE;                // sun-ray height at that distance
        if (b.h > rayH) return true;                  // roof above the ray → shadow
      }
    }
  }
  return false;
}

/**
 * Fraction of the daylight hours the point gets direct sun in a given month
 * (0 = always shaded, 1 = always sunlit). Samples the representative day hourly.
 */
export function sunAccessFraction(clat, clng, buildings, obsH, month, year, timeZone) {
  if (!buildings || !buildings.length) return 1.0;
  let sunlit = 0, daylight = 0;
  for (let h = 4; h <= 21; h++) {
    const { elevation, azimuth } = solarPosition(localToUTC(year, month, 15, h, timeZone), clat, clng);
    if (elevation <= 1) continue;
    daylight++;
    if (!sunBlocked(clat, clng, buildings, azimuth, elevation, obsH)) sunlit++;
  }
  return daylight ? sunlit / daylight : 1.0;
}

// Cached per (point, floor, building set) so dragging the sliders stays cheap.
let accessCache = { key: null, byMonth: {} };

export function monthlySunAccess(clat, clng, buildings, obsH, month, year, timeZone) {
  const key = `${clat.toFixed(5)},${clng.toFixed(5)},${obsH},${buildings ? buildings.length : 0}`;
  if (accessCache.key !== key) accessCache = { key, byMonth: {} };
  if (accessCache.byMonth[month] === undefined) {
    accessCache.byMonth[month] = sunAccessFraction(clat, clng, buildings, obsH, month, year, timeZone);
  }
  return accessCache.byMonth[month];
}
