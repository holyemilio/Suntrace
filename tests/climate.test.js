/**
 * climate.test.js — thermal model and Comfort Rate.
 * Covers airTemperature, solarThermalGain, apparentTemperature, cozynessScore,
 * seasonalTemperatures (including the per-season obstruction function) and the
 * label helpers. Pure functions: no DOM, no network.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  airTemperature,
  solarThermalGain,
  apparentTemperature,
  seasonalTemperatures,
  cozynessScore,
  obstructionLabel,
  cardinalLabel,
} from '../src/climate.js';

// ─── airTemperature ───────────────────────────────────────────────────────────

test('airTemperature: warmest in the afternoon, coldest before dawn', () => {
  const july = 6, lat = 41.9;
  const at14 = airTemperature(july, 14, lat);
  const at02 = airTemperature(july, 2, lat);
  const at08 = airTemperature(july, 8, lat);
  assert.ok(at14 > at08, `14:00 (${at14}) should beat 08:00 (${at08})`);
  assert.ok(at08 > at02, `08:00 (${at08}) should beat 02:00 (${at02})`);
});

test('airTemperature: July is warmer than January', () => {
  assert.ok(airTemperature(6, 12, 41.9) > airTemperature(0, 12, 41.9));
});

test('airTemperature: northern latitudes are colder (Rome table only)', () => {
  const rome = airTemperature(0, 12, 41.9);
  const milan = airTemperature(0, 12, 45.5);
  assert.ok(milan < rome, `Milan (${milan}) should be colder than Rome (${rome})`);
});

test('airTemperature: real normals bypass the latitude adjustment', () => {
  const normals = new Array(12).fill(20);
  const a = airTemperature(0, 12, 41.9, normals);
  const b = airTemperature(0, 12, 47.0, normals); // far north, same normals
  assert.equal(a, b, 'with real per-location normals latitude must not shift the mean');
});

// ─── solarThermalGain ─────────────────────────────────────────────────────────

test('solarThermalGain: zero without sun or when fully obstructed', () => {
  assert.equal(solarThermalGain(6, 0, 1.0), 0);
  assert.equal(solarThermalGain(6, 1, 0), 0);
});

test('solarThermalGain: scales with irradiance and obstruction', () => {
  const full = solarThermalGain(6, 1.0, 1.0);
  const half = solarThermalGain(6, 0.5, 1.0);
  const shaded = solarThermalGain(6, 1.0, 0.15);
  assert.ok(Math.abs(full / 2 - half) < 1e-9);
  assert.ok(shaded < full / 5, 'deep shade must cut the gain sharply');
});

// ─── apparentTemperature ──────────────────────────────────────────────────────

test('apparentTemperature: humidity makes summer heat feel hotter', () => {
  const dry = apparentTemperature(30, 30, 5);
  const muggy = apparentTemperature(30, 80, 5);
  assert.ok(muggy > dry, `humid (${muggy}) should feel hotter than dry (${dry})`);
  assert.ok(muggy > 30, 'muggy 30 °C should feel above the air temperature');
});

test('apparentTemperature: wind makes winter cold feel colder', () => {
  const calm = apparentTemperature(9, 80, 0);
  const windy = apparentTemperature(9, 80, 30);
  assert.ok(windy < calm, `windy (${windy}) should feel colder than calm (${calm})`);
  assert.ok(windy < 9, 'windy 9 °C should feel below the air temperature');
});

// ─── seasonalTemperatures ─────────────────────────────────────────────────────

const noonSun = () => ({ elevation: 50, azimuth: 180 }); // sun due south, high

test('seasonalTemperatures: returns all four seasons, summer above winter', () => {
  const s = seasonalTemperatures(noonSun, 180, 41.9, 1.0);
  assert.deepEqual(Object.keys(s).sort(), ['autumn', 'spring', 'summer', 'winter']);
  assert.ok(s.summer > s.winter);
});

test('seasonalTemperatures: insulation warms winter and cools summer', () => {
  const bare = seasonalTemperatures(noonSun, 180, 41.9, 1.0, null, 'double', 'none');
  const coat = seasonalTemperatures(noonSun, 180, 41.9, 1.0, null, 'double', 'coat');
  assert.ok(coat.winter > bare.winter, 'insulation should raise winter comfort');
  assert.ok(coat.summer < bare.summer, 'insulation should lower summer heat');
});

test('seasonalTemperatures: single glazing lets in more solar heat than triple', () => {
  const single = seasonalTemperatures(noonSun, 180, 41.9, 1.0, null, 'single', 'none');
  const triple = seasonalTemperatures(noonSun, 180, 41.9, 1.0, null, 'triple', 'none');
  assert.ok(single.summer > triple.summer);
});

test('seasonalTemperatures: obstruction may be a per-season function', () => {
  const monthsSeen = [];
  const perSeason = m => { monthsSeen.push(m); return 0.15; };
  const shaded = seasonalTemperatures(noonSun, 180, 41.9, perSeason);
  const open = seasonalTemperatures(noonSun, 180, 41.9, 1.0);
  assert.deepEqual(monthsSeen, [0, 3, 6, 9], 'must be queried for each representative month');
  assert.ok(shaded.summer < open.summer, 'a shaded facade must run cooler in summer');
});

// ─── cozynessScore ────────────────────────────────────────────────────────────

test('cozynessScore: comfortable temperatures earn five stars', () => {
  const r = cozynessScore(18, 24, 1.0, 'triple', 'coat');
  assert.equal(r.stars, 5);
  assert.equal(r.tipKey, 'tip-ok');
  assert.match(r.color, /^#[0-9a-f]{6}$/i);
});

test('cozynessScore: cold winter and hot summer drag the rating down', () => {
  const r = cozynessScore(10, 31, 1.0, 'triple', 'coat');
  assert.ok(r.stars <= 2, `expected a poor rating, got ${r.stars}`);
});

test('cozynessScore: stars stay within 1..5 in the worst case', () => {
  const r = cozynessScore(5, 40, 0.15, 'single', 'none');
  assert.ok(r.stars >= 1 && r.stars <= 5);
  assert.equal(r.stars, 1);
});

test('cozynessScore: single glazing is penalised and advised against', () => {
  const good = cozynessScore(18, 24, 1.0, 'triple', 'coat');
  const bad = cozynessScore(18, 24, 1.0, 'single', 'coat');
  assert.ok(bad.stars < good.stars);
  assert.equal(bad.tipKey, 'tip-windows');
});

test('cozynessScore: muggy summer costs a star and raises the humidity tip', () => {
  const feels = { winter: 8, summer: 34 }; // +6 °C over the air temperature
  const plain = cozynessScore(18, 28, 1.0, 'triple', 'coat');
  const muggy = cozynessScore(18, 28, 1.0, 'triple', 'coat', feels);
  assert.equal(muggy.stars, plain.stars - 1);
  assert.equal(muggy.tipKey, 'tip-humid');
});

test('cozynessScore: missing feels-like data changes nothing', () => {
  assert.deepEqual(
    cozynessScore(18, 24, 1.0, 'double', 'coat', null),
    cozynessScore(18, 24, 1.0, 'double', 'coat')
  );
});

// ─── labels ───────────────────────────────────────────────────────────────────

test('obstructionLabel: maps sun access to the three shading levels', () => {
  assert.equal(obstructionLabel(0.15), 'obs-high');
  assert.equal(obstructionLabel(0.50), 'obs-partial');
  assert.equal(obstructionLabel(1.00), 'obs-none');
});

test('cardinalLabel: cardinal points and wrap-around', () => {
  assert.equal(cardinalLabel(0), 'card-n');
  assert.equal(cardinalLabel(90), 'card-e');
  assert.equal(cardinalLabel(180), 'card-s');
  assert.equal(cardinalLabel(270), 'card-w');
  assert.equal(cardinalLabel(359), 'card-n', 'just before north wraps to north');
  assert.equal(cardinalLabel(450), 'card-e', '450° normalises to 90°');
  assert.equal(cardinalLabel(-90), 'card-w', 'negative angles normalise');
});
