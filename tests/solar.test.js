/**
 * solar.test.js — Unit tests for the astronomical engine.
 *
 * Run with:  node --test tests/solar.test.js
 * Oracle:    SunCalc v1.9 (devDependency) for elevation/azimuth cross-checks.
 * Tolerance: ±0.5° elevation, ±1° azimuth (matching SunCalc's own precision).
 *
 * SunCalc azimuth convention (south=0, CCW) → our convention (north=0, CW):
 *   ourAz = (sunCalcAz * (180/π) + 180) % 360
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import SunCalc from 'suncalc';

import { solarPosition, sunriseSunset, localToUTC, facadeIrradiance } from '../src/solar.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

const RAD = 180 / Math.PI;
const ELEV_TOL = 0.5;  // degrees
const AZ_TOL   = 1.0;  // degrees

/** Convert SunCalc azimuth (rad, south=0, CCW) → our convention (deg, north=0, CW). */
function scAz(rad) { return ((rad * RAD) + 180 + 360) % 360; }

/** Angular difference wrapped to [0, 180]. */
function azDiff(a, b) { return Math.abs(((a - b + 540) % 360) - 180); }

function approxElev(date, lat, lon) {
  const sc = SunCalc.getPosition(date, lat, lon);
  return sc.altitude * RAD;
}
function approxAz(date, lat, lon) {
  return scAz(SunCalc.getPosition(date, lat, lon).azimuth);
}

// ─── locations ────────────────────────────────────────────────────────────────

const ROME  = { lat: 41.9028, lon: 12.4964, tz: 'Europe/Rome' };
const MILAN = { lat: 45.4654, lon:  9.1866, tz: 'Europe/Rome' };

// ─── test cases: Rome, four seasonal moments ─────────────────────────────────

const ROME_CASES = [
  // [description, utcDate, expectedElevApprox, expectedAzApprox]
  // Values verified against SunCalc; expected used only for sanity, actual tolerance via SunCalc.

  // Summer solstice — morning
  { desc: 'Roma, 21 Giu, 08:00 CEST (06:00 UTC)',
    date: new Date(Date.UTC(2024, 5, 21, 6, 0, 0)) },
  // Summer solstice — solar noon ~10:12 UTC
  { desc: 'Roma, 21 Giu, 12:12 CEST (10:12 UTC)',
    date: new Date(Date.UTC(2024, 5, 21, 10, 12, 0)) },
  // Summer solstice — afternoon
  { desc: 'Roma, 21 Giu, 17:00 CEST (15:00 UTC)',
    date: new Date(Date.UTC(2024, 5, 21, 15, 0, 0)) },

  // Winter solstice — morning
  { desc: 'Roma, 21 Dic, 08:00 CET (07:00 UTC)',
    date: new Date(Date.UTC(2024, 11, 21, 7, 0, 0)) },
  // Winter solstice — solar noon ~11:08 UTC
  { desc: 'Roma, 21 Dic, 12:08 CET (11:08 UTC)',
    date: new Date(Date.UTC(2024, 11, 21, 11, 8, 0)) },
  // Winter solstice — afternoon
  { desc: 'Roma, 21 Dic, 15:00 CET (14:00 UTC)',
    date: new Date(Date.UTC(2024, 11, 21, 14, 0, 0)) },

  // Spring equinox — noon
  { desc: 'Roma, 20 Mar, 12:00 CET (11:00 UTC)',
    date: new Date(Date.UTC(2024, 2, 20, 11, 0, 0)) },

  // Autumn equinox — noon
  { desc: 'Roma, 22 Set, 12:00 CEST (10:00 UTC)',
    date: new Date(Date.UTC(2024, 8, 22, 10, 0, 0)) },
];

for (const tc of ROME_CASES) {
  test(`Position accuracy: ${tc.desc}`, () => {
    const my  = solarPosition(tc.date, ROME.lat, ROME.lon);
    const refE = approxElev(tc.date, ROME.lat, ROME.lon);
    const refA = approxAz(tc.date, ROME.lat, ROME.lon);

    assert.ok(
      Math.abs(my.elevation - refE) <= ELEV_TOL,
      `Elevation ${my.elevation.toFixed(3)}° vs SunCalc ${refE.toFixed(3)}° (tolerance ±${ELEV_TOL}°)`
    );
    assert.ok(
      azDiff(my.azimuth, refA) <= AZ_TOL,
      `Azimuth ${my.azimuth.toFixed(3)}° vs SunCalc ${refA.toFixed(3)}° (tolerance ±${AZ_TOL}°)`
    );
  });
}

// ─── sunrise / sunset ─────────────────────────────────────────────────────────

test('Sunrise/sunset day length: Rome summer solstice', () => {
  const date = new Date(Date.UTC(2024, 5, 21));
  const my   = sunriseSunset(date, ROME.lat, ROME.lon);
  const sc   = SunCalc.getTimes(date, ROME.lat, ROME.lon);

  // Day length should be close to SunCalc's (within 5 minutes = 0.083h)
  const scDL = (sc.sunset - sc.sunrise) / 3600000;
  assert.ok(
    Math.abs(my.dayLength - scDL) < 0.1,
    `Day length ${my.dayLength.toFixed(2)}h vs SunCalc ${scDL.toFixed(2)}h`
  );
  assert.ok(my.dayLength > 14 && my.dayLength < 16, `Summer day length should be ~15h, got ${my.dayLength.toFixed(2)}h`);
});

test('Sunrise/sunset day length: Rome winter solstice', () => {
  const date = new Date(Date.UTC(2024, 11, 21));
  const my   = sunriseSunset(date, ROME.lat, ROME.lon);
  const sc   = SunCalc.getTimes(date, ROME.lat, ROME.lon);

  const scDL = (sc.sunset - sc.sunrise) / 3600000;
  assert.ok(
    Math.abs(my.dayLength - scDL) < 0.1,
    `Day length ${my.dayLength.toFixed(2)}h vs SunCalc ${scDL.toFixed(2)}h`
  );
  assert.ok(my.dayLength > 8 && my.dayLength < 10.5, `Winter day length should be ~9.5h, got ${my.dayLength.toFixed(2)}h`);
});

test('Sunrise/sunset: sunrise before sunset (invariant)', () => {
  const dates = [
    new Date(Date.UTC(2024, 0, 15)),
    new Date(Date.UTC(2024, 3, 20)),
    new Date(Date.UTC(2024, 6, 4)),
    new Date(Date.UTC(2024, 9, 10)),
  ];
  for (const d of dates) {
    const { sunrise, sunset } = sunriseSunset(d, ROME.lat, ROME.lon);
    assert.ok(sunrise < sunset, `Sunrise ${sunrise?.toISOString()} should be before sunset ${sunset?.toISOString()}`);
  }
});

// ─── edge cases ───────────────────────────────────────────────────────────────

test('Edge case: midnight UTC (hour=0)', () => {
  const date = new Date(Date.UTC(2024, 5, 21, 0, 0, 0));
  const { elevation } = solarPosition(date, ROME.lat, ROME.lon);
  assert.ok(elevation < 0, `Sun should be below horizon at midnight UTC, got ${elevation.toFixed(2)}°`);
});

test('Edge case: summer solstice elevation at noon > winter at noon (Rome)', () => {
  const noonSummer = new Date(Date.UTC(2024, 5, 21, 10, 12, 0));
  const noonWinter = new Date(Date.UTC(2024, 11, 21, 11, 8, 0));
  const summer = solarPosition(noonSummer, ROME.lat, ROME.lon);
  const winter = solarPosition(noonWinter, ROME.lat, ROME.lon);
  assert.ok(summer.elevation > winter.elevation,
    `Summer noon elevation (${summer.elevation.toFixed(1)}°) should exceed winter (${winter.elevation.toFixed(1)}°)`);
  // Physical bounds
  assert.ok(summer.elevation > 65 && summer.elevation < 80, `Summer noon should be ~71.5°, got ${summer.elevation.toFixed(1)}°`);
  assert.ok(winter.elevation > 18 && winter.elevation < 35, `Winter noon should be ~24.7°, got ${winter.elevation.toFixed(1)}°`);
});

test('Edge case: DST boundary — last Sunday March 2024 (clock springs forward)', () => {
  // 2024-03-31: last Sunday of March — Italy transitions from CET(+1) to CEST(+2) at 02:00 local
  const utcDate = localToUTC(2024, 2, 31, 12, 'Europe/Rome'); // 12:00 local CEST
  // After DST, 12:00 local = 10:00 UTC
  assert.strictEqual(utcDate.getUTCHours(), 10,
    `12:00 CEST should be 10:00 UTC, got ${utcDate.getUTCHours()}:00 UTC`);
});

test('Edge case: DST boundary — last Sunday October 2024 (clock falls back)', () => {
  // 2024-10-27: last Sunday of October — Italy transitions from CEST(+2) to CET(+1) at 03:00 local
  const utcDate = localToUTC(2024, 9, 27, 12, 'Europe/Rome'); // 12:00 local CET
  // After DST ends, 12:00 local = 11:00 UTC
  assert.strictEqual(utcDate.getUTCHours(), 11,
    `12:00 CET should be 11:00 UTC, got ${utcDate.getUTCHours()}:00 UTC`);
});

test('Edge case: leap year 2024-02-29 (valid date)', () => {
  const date = new Date(Date.UTC(2024, 1, 29, 11, 0, 0));
  const { elevation, azimuth } = solarPosition(date, ROME.lat, ROME.lon);
  assert.ok(isFinite(elevation), 'Elevation should be a finite number on Feb 29');
  assert.ok(isFinite(azimuth),   'Azimuth should be a finite number on Feb 29');
});

test('Edge case: longitude near UTC+0 (Greenwich)', () => {
  // Longitude 0° means lon/15 correction is 0 — pure EoT adjustment
  const date = new Date(Date.UTC(2024, 5, 21, 11, 58, 0)); // ~solar noon at Greenwich
  const { elevation } = solarPosition(date, 51.5, 0);
  assert.ok(elevation > 55, `Elevation at Greenwich summer noon should be >55°, got ${elevation.toFixed(1)}°`);
});

// ─── facade irradiance ────────────────────────────────────────────────────────

test('Facade irradiance: sun due south, facade south → maximum', () => {
  // Low elevation, sun exactly south, facade south
  const irr = facadeIrradiance(30, 180, 180);
  assert.ok(Math.abs(irr - Math.cos(30 * Math.PI / 180)) < 0.001,
    `Expected ~${Math.cos(30 * Math.PI / 180).toFixed(3)}, got ${irr.toFixed(3)}`);
});

test('Facade irradiance: sun due east, facade south → zero', () => {
  const irr = facadeIrradiance(30, 90, 180);
  assert.ok(Math.abs(irr) < 0.01, `Expected ~0, got ${irr.toFixed(3)}`);
});

test('Facade irradiance: sun below horizon → zero', () => {
  const irr = facadeIrradiance(-5, 180, 180);
  assert.strictEqual(irr, 0);
});

test('Facade irradiance: sun behind facade → zero (no negative)', () => {
  const irr = facadeIrradiance(30, 0, 180); // sun to north, facade south → behind
  assert.strictEqual(irr, 0);
});

// ─── additional Milan cases ───────────────────────────────────────────────────

test('Position accuracy: Milan summer solstice noon vs SunCalc', () => {
  const date = new Date(Date.UTC(2024, 5, 21, 10, 14, 0)); // ~solar noon Milan
  const my  = solarPosition(date, MILAN.lat, MILAN.lon);
  const refE = approxElev(date, MILAN.lat, MILAN.lon);
  const refA = approxAz(date, MILAN.lat, MILAN.lon);

  assert.ok(Math.abs(my.elevation - refE) <= ELEV_TOL,
    `Milan elevation ${my.elevation.toFixed(2)}° vs SunCalc ${refE.toFixed(2)}°`);
  assert.ok(azDiff(my.azimuth, refA) <= AZ_TOL,
    `Milan azimuth ${my.azimuth.toFixed(2)}° vs SunCalc ${refA.toFixed(2)}°`);
});

test('Position accuracy: Milan winter solstice noon vs SunCalc', () => {
  const date = new Date(Date.UTC(2024, 11, 21, 11, 10, 0));
  const my  = solarPosition(date, MILAN.lat, MILAN.lon);
  const refE = approxElev(date, MILAN.lat, MILAN.lon);

  assert.ok(Math.abs(my.elevation - refE) <= ELEV_TOL,
    `Milan winter elevation ${my.elevation.toFixed(2)}° vs SunCalc ${refE.toFixed(2)}°`);
});
