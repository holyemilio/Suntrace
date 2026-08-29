/**
 * app.e2e.js — drives the real app in a headless browser.
 *
 * Serves the project over HTTP (the app needs http://, not file://) and stubs the
 * three external data APIs so runs are deterministic and don't hammer public
 * services. Leaflet and fonts are self-hosted (vendor/), so no network at all.
 * Cases map to the testbook IDs.
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

async function openApp(t, { buildings = true, buildingHeight = 30, searchResult = ROME_RESULT, viewport = null, seedTourSeen = true } = {}) {
  // An Italian locale makes the app start in Italian through its own auto-detect,
  // so the language-persistence test isn't fighting a forced localStorage value.
  const context = await browser.newContext({ locale: 'it-IT', ...(viewport ? { viewport } : {}) });
  t.after(() => context.close());
  const page = await context.newPage();

  // The first-run mobile tour is opt-in for a test (seedTourSeen: false) — by
  // default it's pre-marked "seen" so it can't cover/intercept clicks meant
  // for whatever a test is actually checking on a narrow viewport.
  if (seedTourSeen) {
    await page.addInitScript(() => localStorage.setItem('suntrace_mobile_tour_seen_v1', '1'));
  }

  await page.route('**/climate-api.open-meteo.com/**', r =>
    r.fulfill({ json: climatePayload() }));
  await page.route('**/nominatim.openstreetmap.org/reverse**', r =>
    r.fulfill({ json: { address: { country_code: 'it' } } }));
  await page.route('**/nominatim.openstreetmap.org/search**', r =>
    r.fulfill({ json: [searchResult] }));
  await page.route('**/overpass-api.de/**', r => r.fulfill({
    json: buildings ? overpassPayload(41.9028, 12.4964, buildingHeight) : { elements: [] },
  }));

  await page.goto(`${origin}/app.html`);
  // Only a genuinely too-small window (< 320px, MIN_USABLE_WIDTH in ui.js) shows
  // the block instead of starting — desktop and mobile both render normally.
  if (!viewport || viewport.width >= 320) {
    await page.waitForFunction(() => document.getElementById('thermal-result').textContent !== '--°C');
  }
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

test('T33: shrinking the window activates the mobile layout instead of hiding controls', async (t) => {
  const page = await openApp(t);
  assert.ok(await page.locator('#compass').isVisible(), 'the compass is there to begin with');
  assert.equal(await page.locator('#mobile-bottom-bar').isVisible(), false, 'no mobile UI yet, at desktop width');

  // Narrower than the desktop breakpoint — same as a live window resize or browser zoom.
  // The mobile layout activates on the spot (see updateMobileBlock in ui.js): the
  // sidebar's content moves into the mobile bottom bar / drawer / widgets, so
  // shrinking the window never leaves you with neither UI.
  //
  // Wait on the reparenting itself (initMobileLayout, run from the JS resize
  // handler), not on #mobile-bottom-bar's CSS display: that div is already
  // display:flex the instant the media query matches, which can beat the JS
  // handler to it and made this assertion below flaky.
  await page.setViewportSize({ width: 500, height: 820 });
  await page.waitForFunction(() => document.querySelector('#mobile-compass-widget #compass'));
  assert.ok(await page.locator('#mobile-compass-widget #compass').count(), 'the dial moved into the 🧭 widget, not off-screen');
  assert.match(await text(page, 'val-q-winter'), /°C$/, 'the seasonal reading followed into the bottom bar');
  assert.equal(await page.locator('#mobile-warning').isVisible(), false, 'this width is usable, not blocked');
});

test('T34: opening straight into a narrow window starts the mobile layout, not a block', async (t) => {
  const page = await openApp(t, { viewport: { width: 500, height: 820 } });
  assert.equal(await page.locator('#mobile-warning').isVisible(), false);
  assert.ok(await page.locator('#mobile-bottom-bar').isVisible(), 'the seasonal strip is there from the start');
  assert.ok(await page.locator('#mobile-drawer-toggle').isVisible(), 'so is the settings drawer handle');
  assert.ok(await page.locator('#mobile-compass-widget #compass').count(), 'the dial moved into the 🧭 widget');
});

test('T38: an extreme width still gets the explanatory block', async (t) => {
  const page = await openApp(t, { viewport: { width: 280, height: 700 } });
  await page.waitForFunction(() =>
    getComputedStyle(document.getElementById('mobile-warning')).display === 'flex');
  // The overlay covers the map rather than hiding it, so check that startApp()
  // never ran instead of checking #map's own (unaffected) visibility.
  assert.equal(await text(page, 'thermal-result'), '--°C', 'the app never started at this width');
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
  await page.locator('input[name="windows"][value="single"]').check();
  await page.waitForFunction(b => document.getElementById('val-q-summer').textContent !== b, before);
  assert.notEqual(await text(page, 'val-q-summer'), before);
});

test('T18: insulation warms winter and cools summer', async (t) => {
  const page = await openApp(t, { buildings: false });
  const winterBefore = parseFloat(await text(page, 'val-q-winter'));
  const summerBefore = parseFloat(await text(page, 'val-q-summer'));

  await page.locator('input[name="insulation"][value="coat"]').check();
  await page.waitForFunction(w => document.getElementById('val-q-winter').textContent !== w,
    `${winterBefore.toFixed(1)}°C`);

  assert.ok(parseFloat(await text(page, 'val-q-winter')) > winterBefore);
  assert.ok(parseFloat(await text(page, 'val-q-summer')) < summerBefore);
});

test('T37: the local-climate card follows the selected month', async (t) => {
  const page = await openApp(t);
  await page.waitForFunction(() => document.getElementById('val-humidity').textContent !== '—');

  assert.match(await text(page, 'val-humidity'), /^\d+%$/);
  assert.match(await text(page, 'val-wind'), /km\/h$/);
  assert.match(await text(page, 'val-rain'), /mm$/);
  assert.match(await text(page, 'val-feels'), /°C$/);

  const julyRain = await text(page, 'val-rain');
  await page.locator('#month-slider').fill('1');   // February has fewer days
  await page.waitForFunction(r => document.getElementById('val-rain').textContent !== r, julyRain);
  assert.notEqual(await text(page, 'val-rain'), julyRain, 'rainfall is per month, not fixed');
});

// ─── T22 — Comfort Rate detail ────────────────────────────────────────────────

test('T32: the choice cards are single-select and the fortress tier is the strongest', async (t) => {
  const page = await openApp(t, { buildings: false });
  const bareWinter = parseFloat(await text(page, 'val-q-winter'));

  await page.locator('input[name="insulation"][value="coat"]').check();
  await page.waitForFunction(w => parseFloat(document.getElementById('val-q-winter').textContent) !== w, bareWinter);
  const coatWinter = parseFloat(await text(page, 'val-q-winter'));

  await page.locator('input[name="insulation"][value="fortress"]').check();
  await page.waitForFunction(w => parseFloat(document.getElementById('val-q-winter').textContent) !== w, coatWinter);
  const fortWinter = parseFloat(await text(page, 'val-q-winter'));

  assert.ok(fortWinter > coatWinter && coatWinter > bareWinter,
    `winter should rise with insulation: ${bareWinter} < ${coatWinter} < ${fortWinter}`);
  assert.equal(await page.locator('input[name="insulation"]:checked').count(), 1,
    'only one wall option can be selected');
  assert.equal(await page.locator('input[name="windows"]:checked').count(), 1,
    'only one glazing option can be selected');
});

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

test('T35: the Vatican and San Marino count as Italy, not abroad', async (t) => {
  for (const [nome, cc, lat, lon] of [['Vatican', 'va', '41.9022', '12.4539'],
                                      ['San Marino', 'sm', '43.9356', '12.4473']]) {
    const page = await openApp(t, {
      searchResult: { display_name: nome, lat, lon },
    });
    await page.route('**/nominatim.openstreetmap.org/reverse**', r =>
      r.fulfill({ json: { address: { country_code: cc } } }));

    await page.locator('#search-input').fill(nome);
    await page.locator('#search-btn').click();
    await page.waitForFunction(la => document.getElementById('coord-lat').textContent.startsWith(la),
      lat.slice(0, 5));

    assert.equal(await page.locator('#map-error-toast').isVisible(), false,
      `${nome} (${cc}) must not be rejected as foreign`);
    assert.ok((await text(page, 'coord-lat')).startsWith(lat.slice(0, 5)),
      'the analysis stays on the clicked point');
  }
});

test('T36: an unexpected failure surfaces as a message instead of a dead page', async (t) => {
  const page = await openApp(t);
  await page.evaluate(() => { throw new Error('guasto simulato'); }).catch(() => {});
  await page.evaluate(() => setTimeout(() => { throw new Error('guasto simulato'); }, 0));
  await page.waitForSelector('.map-error-toast', { state: 'visible' });
  const toast = await text(page, 'map-error-toast');
  assert.match(toast, /errore imprevisto/i, 'the user is told something went wrong');
  assert.match(toast, /guasto simulato/, 'and gets the detail worth reporting');
});

// ─── T27 / T28 / T29 — floor, shadow ──────────────────────────────────────────

test('T28/T29: the direct-sun readout reflects the sun and the buildings', async (t) => {
  const page = await openApp(t);

  await page.locator('#hour-slider').fill('2');            // night
  await page.waitForFunction(() => document.getElementById('hour-label').textContent === '02:00');
  assert.match(await text(page, 'val-sun-direct'), /orizzonte/, 'night → below horizon');

  // Afternoon in January: the sun is low AND on the west-facing wall the stub
  // produces, so a blocking roof is the only thing between them.
  await page.locator('#month-slider').fill('0');
  await page.locator('#hour-slider').fill('15');
  await page.waitForFunction(() => document.getElementById('hour-label').textContent === '15:00');
  assert.match(await text(page, 'val-sun-direct'), /ombra/, 'low winter sun in a courtyard → shadow');
});

test('T16: the compass sets the facade and highlights the chosen direction', async (t) => {
  const page = await openApp(t, { buildings: false });

  await page.locator('.compass-dir[data-az="90"]').click();   // East
  await page.waitForFunction(() =>
    document.getElementById('compass-needle').style.transform === 'rotate(90deg)');
  assert.equal(await page.locator('.compass-dir.active').textContent(), 'E', 'East is highlighted');

  const eastSummer = await text(page, 'val-q-summer');
  await page.locator('.compass-dir[data-az="180"]').click();  // South
  await page.waitForFunction(() =>
    document.getElementById('compass-needle').style.transform === 'rotate(180deg)');
  assert.notEqual(await text(page, 'val-q-summer'), eastSummer, 'a different wall gives a different estimate');
  assert.equal(await page.locator('.compass-dir.active').textContent(), 'S');
});

test('T31: the compass marks the sun and hides/shows with it', async (t) => {
  const page = await openApp(t, { buildings: false });
  await page.locator('#month-slider').fill('6');
  await page.locator('#hour-slider').fill('2');               // night
  await page.waitForFunction(() => document.getElementById('hour-label').textContent === '02:00');
  assert.ok(await page.locator('#compass-sun').evaluate(el => el.classList.contains('hidden')),
    'the sun marker hides when the sun is down');

  await page.locator('#hour-slider').fill('12');
  await page.waitForFunction(() => document.getElementById('hour-label').textContent === '12:00');
  assert.equal(await page.locator('#compass-sun').evaluate(el => el.classList.contains('hidden')), false);
  // "shaded" tracks the same verdict the sidebar shows in val-sun-direct — the
  // compass no longer repeats it as text (that duplication was removed), just
  // as this dimmed/lit marker.
  const shaded = await page.locator('#compass-sun').evaluate(el => el.classList.contains('shaded'));
  assert.equal(shaded, !(await text(page, 'val-sun-direct')).includes('sole'),
    'the sun marker dims exactly when the facade is not lit');
});

test('T30: a wall facing away reads "sun on the other side", not "in sun"', async (t) => {
  // The stubbed courtyard yields a west-facing facade. At 09:00 in January the
  // sun sits in the south-east, so even with a clear line of sight from a high
  // floor the wall itself gets nothing — and the estimate must not move. Floor 4
  // (12m) clears the 10m stub buildings; floor 5 is the roof, which has no wall
  // to face away with, so it doesn't belong in this case.
  const page = await openApp(t, { buildingHeight: 10 });

  await page.locator('#month-slider').fill('0');
  await page.locator('#hour-slider').fill('9');
  await page.waitForFunction(() => document.getElementById('hour-label').textContent === '09:00');
  await page.waitForFunction(() => document.querySelector('.compass-dir.active')?.textContent === 'O');
  assert.equal(await page.locator('.compass-dir.active').textContent(), 'O', 'the detected facade faces west');

  const tempBefore = await text(page, 'thermal-result');
  await page.locator('.floor-btn[data-floor="4"]').click();

  assert.match(await text(page, 'val-sun-direct'), /altro lato/,
    'a clear sky on a west wall at 09:00 is not "in sun"');
  assert.equal(await text(page, 'thermal-result'), tempBefore,
    'the estimate stays put, matching the label');
});

test('T39: the roof (floor 5) gets sun regardless of the facade\'s orientation, and disables the compass', async (t) => {
  // Same west-facing facade and morning sun as T30 — a wall would read "in
  // altro lato" here. The roof has no facing direction, so it must not.
  const page = await openApp(t, { buildingHeight: 10 });

  await page.locator('#month-slider').fill('0');
  await page.locator('#hour-slider').fill('9');
  await page.waitForFunction(() => document.getElementById('hour-label').textContent === '09:00');
  await page.waitForFunction(() => document.querySelector('.compass-dir.active')?.textContent === 'O');

  await page.locator('.floor-btn[data-floor="5"]').click();

  assert.match(await text(page, 'val-sun-direct'), /sole/,
    'the roof catches the sun even though every wall faces away from it');
  assert.ok(await page.locator('#compass').evaluate(el => el.classList.contains('roof-disabled')),
    'the compass is dimmed and inert once orientation stops mattering');

  // Switching back off the roof restores normal wall behaviour.
  await page.locator('.floor-btn[data-floor="4"]').click();
  assert.match(await text(page, 'val-sun-direct'), /altro lato/, 'leaving the roof brings the wall verdict back');
  assert.ok(!(await page.locator('#compass').evaluate(el => el.classList.contains('roof-disabled'))),
    'the compass is interactive again off the roof');
});

test('T27: choosing a higher floor escapes the shadow and changes the reading', async (t) => {
  const page = await openApp(t, { buildingHeight: 15 });

  // Afternoon, when the sun is on the west-facing wall the stub produces.
  await page.locator('#month-slider').fill('0');
  await page.locator('#hour-slider').fill('15');
  await page.waitForFunction(() => document.getElementById('hour-label').textContent === '15:00');
  await page.waitForFunction(() => document.getElementById('val-sun-direct').textContent.includes('ombra'));

  const groundTemp = await text(page, 'thermal-result');
  assert.match(await text(page, 'val-sun-direct'), /ombra/, 'ground floor starts in shadow');

  await page.locator('.floor-btn[data-floor="5"]').click();
  await page.waitForFunction(() => document.getElementById('val-sun-direct').textContent.includes('sole'));

  assert.match(await text(page, 'val-sun-direct'), /sole/, 'the 5th floor sees the sun');
  assert.ok(parseFloat(await text(page, 'thermal-result')) > parseFloat(groundTemp),
    'escaping the shadow warms the room');
});

test('T40: the first-run mobile tour walks through every control, then stays gone', async (t) => {
  const page = await openApp(t, { viewport: { width: 500, height: 820 }, seedTourSeen: false });

  // Starts on its own, no interaction needed, highlighting the first control.
  await page.waitForFunction(() => document.getElementById('mobile-tour-highlight')?.classList.contains('open'));
  assert.ok(await text(page, 'mobile-tour-text'), 'the first step has explanatory text');
  assert.equal(await page.locator('.mobile-tour-dot').count(), 6, 'one dot per step');
  assert.equal(await page.locator('.mobile-tour-dot.active').count(), 1, 'exactly one dot marks the current step');

  const firstText = await text(page, 'mobile-tour-text');
  await page.locator('#mobile-tour-next').click();
  const secondText = await text(page, 'mobile-tour-text');
  assert.notEqual(secondText, firstText, 'Avanti moves to the next step\'s explanation');

  // Skipping mid-way dismisses it and remembers not to show it again.
  await page.locator('#mobile-tour-skip').click();
  await page.waitForFunction(() => !document.getElementById('mobile-tour-highlight')?.classList.contains('open'));
  const seen = await page.evaluate(() => localStorage.getItem('suntrace_mobile_tour_seen_v1'));
  assert.equal(seen, '1', 'skipping marks the tour as seen');

  await page.reload();
  await page.waitForFunction(() => document.getElementById('thermal-result').textContent !== '--°C');
  await page.waitForTimeout(200); // the tour, if it were going to start, does so synchronously in initMobileLayout
  assert.equal(await page.locator('#mobile-tour-highlight').evaluate(el => el.classList.contains('open')), false,
    'a returning visitor does not see the tour again');
});
