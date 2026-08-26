/**
 * shadow.test.js — urban geometry: facade orientation and line-of-sight solar
 * access through OSM building footprints. Pure functions: no DOM, no network.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  localXY,
  pointInPolygon,
  pointSegDist,
  outwardNormalAz,
  nearestFacadeAzimuth,
  sunBlocked,
  sunAccessFraction,
} from '../src/shadow.js';

const LAT = 41.9028, LNG = 12.4964;      // Rome
const M_LAT = 1 / 111320;                 // one metre in degrees of latitude
const M_LNG = 1 / (111320 * Math.cos(LAT * Math.PI / 180));

/** Rectangular footprint from local metres: x east, y north. */
function shape(x0, x1, y0, y1, h) {
  const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
  return {
    h,
    geom: corners.map(([x, y]) => ({ lat: LAT + y * M_LAT, lon: LNG + x * M_LNG })),
  };
}

/** Square block whose NEAREST wall sits `dist` metres away on the given side. */
function block(side, dist, size, h) {
  const half = size / 2;
  if (side === 'N') return shape(-half, half, dist, dist + size, h);
  if (side === 'S') return shape(-half, half, -dist - size, -dist, h);
  if (side === 'E') return shape(dist, dist + size, -half, half, h);
  return shape(-dist - size, -dist, -half, half, h);
}

/** A closed courtyard: four overlapping walls `dist` metres from the point. */
function courtyardAt(dist, h) {
  const out = dist + 6, len = dist + 20; // walls long enough to close the corners
  return [
    shape(-len, len, dist, out, h),   // north
    shape(-len, len, -out, -dist, h), // south
    shape(dist, out, -len, len, h),   // east
    shape(-out, -dist, -len, len, h), // west
  ];
}

const asOverpass = b => ({ geometry: b.geom });
const norm = deg => (deg % 360 + 360) % 360;

// ─── projection ───────────────────────────────────────────────────────────────

test('localXY: projects metres east and north with the right sign', () => {
  const xy = localXY(LAT, LNG);
  const p = xy(LAT + 10 * M_LAT, LNG + 20 * M_LNG); // 20 m east, 10 m north
  assert.ok(Math.abs(p.x - 20) < 0.1, `x=${p.x}, expected ~20`);
  assert.ok(Math.abs(p.y - 10) < 0.1, `y=${p.y}, expected ~10`);
  const origin = xy(LAT, LNG);
  assert.ok(Math.hypot(origin.x, origin.y) < 1e-6, 'the point itself maps to the origin');
});

// ─── polygon helpers ──────────────────────────────────────────────────────────

test('pointInPolygon: inside, outside and beyond a square', () => {
  const ring = [{ x: -5, y: -5 }, { x: 5, y: -5 }, { x: 5, y: 5 }, { x: -5, y: 5 }];
  assert.equal(pointInPolygon(0, 0, ring), true, 'centre is inside');
  assert.equal(pointInPolygon(10, 0, ring), false, 'east of the square is outside');
  assert.equal(pointInPolygon(0, 20, ring), false, 'north of the square is outside');
});

test('pointSegDist: perpendicular distance and clamping to the endpoints', () => {
  const a = { x: 10, y: -5 }, c = { x: 10, y: 5 };           // wall 10 m east
  assert.ok(Math.abs(pointSegDist({ x: 0, y: 0 }, a, c) - 10) < 1e-9);
  const far = { x: 10, y: 100 }, far2 = { x: 10, y: 200 };   // segment well north
  assert.ok(Math.abs(pointSegDist({ x: 10, y: 0 }, far, far2) - 100) < 1e-9, 'clamps to the nearest end');
});

test('outwardNormalAz: the normal points back at the observer', () => {
  const click = { x: 0, y: 0 };
  // wall running north-south, 10 m east of the point → faces west (270°)
  assert.equal(norm(Math.round(outwardNormalAz({ x: 10, y: -5 }, { x: 10, y: 5 }, click))), 270);
  // wall running east-west, 10 m north of the point → faces south (180°)
  assert.equal(Math.round(outwardNormalAz({ x: -5, y: 10 }, { x: 5, y: 10 }, click)), 180);
});

test('nearestFacadeAzimuth: picks the closest wall of the closest building', () => {
  const near = asOverpass(block('N', 10, 20, 15)); // wall 10 m north
  const far = asOverpass(block('E', 60, 20, 15));  // wall 60 m east
  const az = nearestFacadeAzimuth(LAT, LNG, [near, far]);
  assert.ok(Math.abs(az - 180) <= 2, `expected the north building's south face (~180°), got ${az}`);
});

// ─── shadow ray-casting ───────────────────────────────────────────────────────

test('sunBlocked: no direct sun when the sun is at or below the horizon', () => {
  assert.equal(sunBlocked(LAT, LNG, [], 180, 0, 0), true);
  assert.equal(sunBlocked(LAT, LNG, [], 180, -5, 0), true);
});

test('sunBlocked: an open sky never blocks', () => {
  assert.equal(sunBlocked(LAT, LNG, [], 180, 45, 0), false);
});

test('sunBlocked: a 15 m building 10 m away blocks a low sun but not a high one', () => {
  const wall = [block('N', 10, 20, 15)]; // wall 10 m north, roof at 15 m
  // clearing the roof needs atan(15/10) ≈ 56°:
  assert.equal(sunBlocked(LAT, LNG, wall, 0, 20, 0), true, '20° is well under 56°');
  assert.equal(sunBlocked(LAT, LNG, wall, 0, 70, 0), false, '70° clears the roof');
});

test('sunBlocked: climbing above the rooftops escapes the shadow', () => {
  const wall = [block('N', 10, 20, 15)];
  assert.equal(sunBlocked(LAT, LNG, wall, 0, 20, 0), true, 'ground floor is shaded');
  assert.equal(sunBlocked(LAT, LNG, wall, 0, 20, 15), false, 'at roof height the sun is back');
});

test('sunBlocked: a building on the opposite side casts no shadow', () => {
  const south = [block('S', 10, 20, 30)]; // tall block to the south
  // sun in the north: the southern building is behind the observer
  assert.equal(sunBlocked(LAT, LNG, south, 0, 20, 0), false);
  // sun in the south: now it does block
  assert.equal(sunBlocked(LAT, LNG, south, 180, 20, 0), true);
});

test('sunBlocked: the observer\'s own building is ignored', () => {
  const own = shape(-15, 15, -15, 15, 40); // huge block centred on the observer
  assert.equal(pointInPolygon(0, 0, own.geom.map(p => localXY(LAT, LNG)(p.lat, p.lon))), true);
  assert.equal(sunBlocked(LAT, LNG, [own], 180, 30, 0), false, 'you are not shaded by your own roof');
});

// ─── sun access over a month ──────────────────────────────────────────────────

// Walls 15 m away and 15 m tall: the sun must clear ~45° to reach the ground.
// Rome peaks at ~27° in January and ~69° in July, so the seasons must differ.
const courtyard = courtyardAt(15, 15);

test('sunAccessFraction: open sky gets full access', () => {
  assert.equal(sunAccessFraction(LAT, LNG, [], 0, 6, 2026, 'Europe/Rome'), 1.0);
  assert.equal(sunAccessFraction(LAT, LNG, null, 0, 6, 2026, 'Europe/Rome'), 1.0);
});

test('sunAccessFraction: always within 0..1', () => {
  for (const month of [0, 3, 6, 9]) {
    const f = sunAccessFraction(LAT, LNG, courtyard, 0, month, 2026, 'Europe/Rome');
    assert.ok(f >= 0 && f <= 1, `month ${month} gave ${f}`);
  }
});

test('sunAccessFraction: summer sun clears a courtyard that winter sun cannot', () => {
  const jan = sunAccessFraction(LAT, LNG, courtyard, 0, 0, 2026, 'Europe/Rome');
  const jul = sunAccessFraction(LAT, LNG, courtyard, 0, 6, 2026, 'Europe/Rome');
  assert.ok(jul > jan, `July (${jul}) should beat January (${jan}) at ground level`);
});

test('sunAccessFraction: higher floors never get less sun, and the top gets more', () => {
  const byFloor = [0, 1, 2, 3, 4, 5].map(f =>
    sunAccessFraction(LAT, LNG, courtyard, f * 3, 0, 2026, 'Europe/Rome'));
  for (let i = 1; i < byFloor.length; i++) {
    assert.ok(byFloor[i] >= byFloor[i - 1],
      `floor ${i} (${byFloor[i]}) must not get less sun than floor ${i - 1} (${byFloor[i - 1]})`);
  }
  assert.ok(byFloor[5] > byFloor[0], `top floor (${byFloor[5]}) must beat the ground (${byFloor[0]})`);
  assert.equal(byFloor[5], 1, 'above the rooftops the sky is clear');
});

test('sunAccessFraction: a taller courtyard shades the ground floor more', () => {
  const tall = courtyardAt(15, 40);
  const low = sunAccessFraction(LAT, LNG, courtyard, 0, 0, 2026, 'Europe/Rome');
  const high = sunAccessFraction(LAT, LNG, tall, 0, 0, 2026, 'Europe/Rome');
  assert.ok(high <= low, `40 m walls (${high}) must not beat 15 m walls (${low})`);
});
