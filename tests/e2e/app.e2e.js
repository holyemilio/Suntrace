/**
 * app.e2e.js — drives the real app in a headless browser.
 *
 * Serves the project over HTTP (the app needs http://, not file://) and stubs the
 * three external data APIs so runs are deterministic and don't hammer public
 * services. Leaflet still loads from its CDN. Cases map to the testbook IDs.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

let server, browser, origin;

before(async () => {
  server = createServer(async (req, res) => {
    const path = req.url.split('?')[0];
    try {
      const body = await readFile(join(ROOT, path === '/' ? 'index.html' : decodeURIComponent(path)));
      res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404).end('not found'); }
  });
  await new Promise(r => server.listen(0, r));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await new Promise(r => server.close(r));
});

// ─── fixtures ─────────────────────────────────────────────────────────────────

/** One year of daily climate values — enough for all 12 monthly means. */
function climatePayload() {
  const time = [], temp = [], rh = [], wind = [], precip = [];
  const d = new Date(Date.UTC(1991, 0, 1));
  while (d.getUTCFullYear() === 1991) {
    time.push(d.toISOString().slice(0, 10));
    const m = d.getUTCMonth();
    temp.push(8 + 12 * Math.sin((m - 3) * Math.PI / 6));  // ~ -4..20, peaks in July
    rh.push(65); wind.push(9); precip.push(2);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return { daily: { time, temperature_2m_mean: temp, relative_humidity_2m_mean: rh,
                    windspeed_10m_mean: wind, precipitation_sum: precip } };
}

/** A closed courtyard of tall blocks around the point: guarantees real shadow. */
function overpassPayload(lat, lon, height = 30) {
  const mLat = 1 / 111320, mLng = 1 / (111320 * Math.cos(lat * Math.PI / 180));
  const rect = (x0, x1, y0, y1) => ({
    type: 'way', tags: { building: 'yes', 'building:levels': String(height / 3) },
    geometry: [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]
      .map(([x, y]) => ({ lat: lat + y * mLat, lon: lon + x * mLng })),
  });
  const d = 12, o = 18, len = 32;
  return { elements: [rect(-len, len, d, o), rect(-len, len, -o, -d),
                      rect(d, o, -len, len), rect(-o, -d, -len, len)] };
}

const ROME_RESULT = { display_name: 'Via Giusti, Roma', lat: '41.8955', lon: '12.5010' };

async function openApp(t, { buildings = true, buildingHeight = 30, searchResult = ROME_RESULT } = {}) {
  // An Italian locale makes the app start in Italian through its own auto-detect,
  // so the language-persistence test isn't fighting a forced localStorage value.
  const context = await browser.newContext({ locale: 'it-IT' });
  t.after(() => context.close());
  const page = await context.newPage();

  await page.route('**/climate-api.open-meteo.com/**', r =>
    r.fulfill({ json: climatePayload() }));
  await page.route('**/nominatim.openstreetmap.org/reverse**', r =>
    r.fulfill({ json: { address: { country_code: 'it' } } }));
  await page.route('**/nominatim.openstreetmap.org/search**', r =>
    r.fulfill({ json: [searchResult] }));
  await page.route('**/overpass-api.de/**', r => r.fulfill({
    json: buildings ? overpassPayload(41.9028, 12.4964, buildingHeight) : { elements: [] },
  }));

  await page.goto(`${origin}/index.html`);
  await page.waitForFunction(() => document.getElementById('thermal-result').textContent !== '--°C');
  return page;
}

const text = (page, id) => page.locator(`#${id}`).textContent();

// ─── T01 — the app boots ──────────────────────────────────────────────────────

test('T01: the app loads and renders an analysis, with no page errors', async (t) => {
  const errors = [];
  const page = await openApp(t);
  page.on('pageerror', e => errors.push(e.message));

  assert.match(await text(page, 'thermal-result'), /^-?\d+\.\d°C$/);
  assert.ok(await page.locator('#map').isVisible(), 'the map is visible');
  assert.ok(await page.locator('#sidebar').isVisible(), 'the sidebar is visible');
  assert.match(await text(page, 'comfort-rate-stars'), /⭐/);
  assert.equal(await page.locator('#mobile-warning').isVisible(), false, 'no mobile block on desktop');
  assert.deepEqual(errors, []);
});

// ─── T14 / T15 — time controls ────────────────────────────────────────────────

test('T14: moving the month slider updates the label and the estimate', async (t) => {
  const page = await openApp(t);
  await page.locator('#month-slider').fill('0');
  await page.waitForFunction(() => document.getElementById('month-label').textContent === 'Gennaio');
  const jan = await text(page, 'thermal-result');

  await page.locator('#month-slider').fill('6');
  await page.waitForFunction(() => document.getElementById('month-label').textContent === 'Luglio');
  const jul = await text(page, 'thermal-result');

  assert.notEqual(jan, jul);
  assert.ok(parseFloat(jul) > parseFloat(jan), `July (${jul}) should be warmer than January (${jan})`);
});

test('T15: moving the hour slider updates the label and the sun readouts', async (t) => {
  const page = await openApp(t);
  await page.locator('#hour-slider').fill('12');
  await page.waitForFunction(() => document.getElementById('hour-label').textContent === '12:00');
  const noonElevation = await text(page, 'val-sun-elevation');

  await page.locator('#hour-slider').fill('2');
  await page.waitForFunction(() => document.getElementById('hour-label').textContent === '02:00');
  const nightElevation = await text(page, 'val-sun-elevation');

  assert.notEqual(noonElevation, nightElevation);
});

// ─── T17 / T18 — building properties ──────────────────────────────────────────

test('T17: single glazing changes the seasonal figures', async (t) => {
  // Open sky: the facade keeps its default south orientation and actually gets
  // sun, so the glazing modifier has something to act on.
  const page = await openApp(t, { buildings: false });
  const before = await text(page, 'val-q-summer');
  await page.selectOption('#windows-select', 'single');
  await page.waitForFunction(b => document.getElementById('val-q-summer').textContent !== b, before);
  assert.notEqual(await text(page, 'val-q-summer'), before);
});

test('T18: insulation warms winter and cools summer', async (t) => {
  const page = await openApp(t, { buildings: false });
  const winterBefore = parseFloat(await text(page, 'val-q-winter'));
  const summerBefore = parseFloat(await text(page, 'val-q-summer'));

  await page.selectOption('#insulation-select', 'coat');
  await page.waitForFunction(w => document.getElementById('val-q-winter').textContent !== w,
    `${winterBefore.toFixed(1)}°C`);

  assert.ok(parseFloat(await text(page, 'val-q-winter')) > winterBefore);
  assert.ok(parseFloat(await text(page, 'val-q-summer')) < summerBefore);
});

// ─── T22 — Comfort Rate detail ────────────────────────────────────────────────

test('T22: the Comfort Rate badge opens a populated detail modal', async (t) => {
  const page = await openApp(t);
  assert.equal(await page.locator('#kpi-modal').isVisible(), false);

  await page.locator('#energy-class-field').click();
  await page.waitForSelector('#kpi-modal.open');

  assert.match(await text(page, 'kpi-winter-temp'), /°C$/);
  assert.match(await text(page, 'kpi-summer-temp'), /°C$/);
  assert.match(await text(page, 'kpi-humidity'), /^\d+%$/, 'humidity comes from the climate API');
  assert.match(await text(page, 'kpi-rain'), /mm$/);
  assert.ok((await text(page, 'kpi-tip')).length > 20, 'a tip is shown');
  assert.ok((await text(page, 'kpi-exposure')).length > 10, 'the sun-exposure line is shown');

  await page.locator('#modal-close-btn').click();
  await page.waitForSelector('#kpi-modal.open', { state: 'detached' }).catch(() => {});
  assert.equal(await page.locator('#kpi-modal').isVisible(), false, 'the modal closes');
});

// ─── T24 / T25 — language ─────────────────────────────────────────────────────

test('T24: the language switch translates static and dynamic text', async (t) => {
  const page = await openApp(t);
  assert.equal(await page.locator('#search-btn').textContent(), 'Vai');

  await page.locator('.lang-btn[data-lang="en"]').click();
  await page.waitForFunction(() => document.getElementById('search-btn').textContent === 'Go');

  assert.equal(await page.locator('.q-label').first().textContent(), 'Winter', 'seasons translate');
  assert.match(await text(page, 'main-output-title'), /^Estimate/, 'dynamic title translates');
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
});

test('T25: the chosen language survives a reload', async (t) => {
  const page = await openApp(t);
  await page.locator('.lang-btn[data-lang="en"]').click();
  await page.waitForFunction(() => document.getElementById('search-btn').textContent === 'Go');

  await page.reload();
  await page.waitForFunction(() => document.getElementById('thermal-result').textContent !== '--°C');
  assert.equal(await page.locator('#search-btn').textContent(), 'Go', 'still English after reload');
});

// ─── T03–T06 — address search ─────────────────────────────────────────────────

test('T03/T04: suggestions appear and clicking one only fills the field', async (t) => {
  const page = await openApp(t);
  const coordBefore = await text(page, 'coord-lat');

  await page.locator('#search-input').fill('Via Giusti Roma');
  await page.waitForSelector('.preview-item');
  await page.locator('.preview-item').first().click();

  assert.equal(await page.locator('#search-input').inputValue(), 'Via Giusti, Roma');
  assert.equal(await text(page, 'coord-lat'), coordBefore, 'the map must not move yet');
});

test('T05/T06: Enter does not search, the Go button does', async (t) => {
  const page = await openApp(t);
  const coordBefore = await text(page, 'coord-lat');

  await page.locator('#search-input').fill('Via Giusti Roma');
  await page.locator('#search-input').press('Enter');
  await page.waitForTimeout(300);
  assert.equal(await text(page, 'coord-lat'), coordBefore, 'Enter must not trigger a search');

  await page.locator('#search-btn').click();
  await page.waitForFunction(c => document.getElementById('coord-lat').textContent !== c, coordBefore);
  assert.notEqual(await text(page, 'coord-lat'), coordBefore, '"Vai" moves the map');
});

// ─── T11 — geofencing ─────────────────────────────────────────────────────────

test('T11: a point outside Italy is rejected and recentred on Rome', async (t) => {
  // Reach a foreign coordinate through the real search flow.
  const page = await openApp(t, {
    searchResult: { display_name: 'Paris, France', lat: '48.8566', lon: '2.3522' },
  });
  await page.locator('#search-input').fill('Paris');
  await page.locator('#search-btn').click();
  await page.waitForSelector('.map-error-toast', { state: 'visible' });
  const toast = await text(page, 'map-error-toast');
  assert.match(toast, /Ops! Ci hai scoperto/);
  await page.waitForFunction(() => document.getElementById('coord-lat').textContent.startsWith('41.90'));
});

// ─── T27 / T28 / T29 — floor, shadow ──────────────────────────────────────────

test('T28/T29: the direct-sun readout reflects the sun and the buildings', async (t) => {
  const page = await openApp(t);

  await page.locator('#hour-slider').fill('2');            // night
  await page.waitForFunction(() => document.getElementById('hour-label').textContent === '02:00');
  assert.match(await text(page, 'val-sun-direct'), /orizzonte/, 'night → below horizon');

  await page.locator('#month-slider').fill('0');           // January, low sun
  await page.locator('#hour-slider').fill('9');
  await page.waitForFunction(() => document.getElementById('hour-label').textContent === '09:00');
  assert.match(await text(page, 'val-sun-direct'), /ombra/, 'low winter sun in a courtyard → shadow');
});

test('T27: choosing a higher floor escapes the shadow and changes the reading', async (t) => {
  const page = await openApp(t, { buildingHeight: 15 });

  // Afternoon, when the sun is on the west-facing wall the stub produces.
  await page.locator('#month-slider').fill('0');
  await page.locator('#hour-slider').fill('15');
  await page.waitForFunction(() => document.getElementById('hour-label').textContent === '15:00');
  await page.waitForFunction(() => document.getElementById('val-manual-obs').textContent.includes('Elevata'));

  const groundShading = await text(page, 'val-manual-obs');
  const groundTemp = await text(page, 'thermal-result');
  assert.match(await text(page, 'val-sun-direct'), /ombra/, 'ground floor starts in shadow');

  await page.locator('.floor-btn[data-floor="5"]').click();
  await page.waitForFunction(() => document.getElementById('val-sun-direct').textContent.includes('sole'));

  assert.match(await text(page, 'val-sun-direct'), /sole/, 'the 5th floor sees the sun');
  assert.notEqual(await text(page, 'val-manual-obs'), groundShading, 'shading readout changes');
  assert.ok(parseFloat(await text(page, 'thermal-result')) > parseFloat(groundTemp),
    'escaping the shadow warms the room');
});
