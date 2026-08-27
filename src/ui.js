/**
 * ui.js — Application UI controller.
 * Imports solar.js and climate.js; manages Leaflet map, DOM interactions,
 * autocomplete, geolocation, KPI modal, and facade sun-hours chart.
 */

import {
  solarPosition,
  sunriseSunset,
  facadeIrradiance,
  dailySunHours,
  localToUTC,
  offsetByAzimuth,
} from './solar.js';

import {
  airTemperature,
  solarThermalGain,
  seasonalTemperatures,
  cozynessScore,
  apparentTemperature,
  obstructionLabel,
  cardinalLabel,
} from './climate.js';

import {
  nearestFacadeAzimuth,
  sunBlocked,
  monthlySunAccess,
} from './shadow.js';

import { t, monthName, getLang, setLang, applyTranslations } from './i18n.js';

// ─── constants ────────────────────────────────────────────────────────────────

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_DEBOUNCE_MS = 420;
const TIMEZONE = 'Europe/Rome';
const DEFAULT_YEAR = 2026;

// Bounding box covering Italy including islands (Sicily, Sardinia, Lampedusa)
const ITALY_BOUNDS = { latMin: 35.4, latMax: 47.1, lonMin: 6.6, lonMax: 18.6 };

// Vatican City and San Marino are enclaves surrounded by Italy: Nominatim gives
// them their own country code, but a click there is not "abroad".
const IN_ITALY_CODES = new Set(['it', 'va', 'sm']);

// Open-Meteo climate normals (1991-2020, EC-Earth3P-HR). "monthly" aggregation
// param returns an empty payload on this API — verified against the live
// endpoint — so we pull daily means and aggregate to 12 monthly values ourselves.
const OPEN_METEO_URL = 'https://climate-api.open-meteo.com/v1/climate';
const OPEN_METEO_RANGE = 'models=EC_Earth3P_HR&start_date=1991-01-01&end_date=2020-12-31&daily=temperature_2m_mean,relative_humidity_2m_mean,windspeed_10m_mean,precipitation_sum';
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Shadow model: one storey ≈ 3 m, and a facade in shadow still receives diffuse
// sky light — never zero, just a small fraction of the direct gain.
const FLOOR_HEIGHT_M = 3;
const DIFFUSE_K = 0.15;

// Nominatim reverse geocoding — precise land/water/country classification.
// Land returns address.country_code; open sea returns an error (no country).
const REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

// ─── state ────────────────────────────────────────────────────────────────────

let map = null;
let targetMarker = null;
let radarCircle = null;
let facadeLine = null;
let shadowPolygon = null;
let sunRay = null;
let errorTimeout = null;
let autocompleteTimeout = null;
let customBaseTemps = null; // 12 monthly temp means from Open-Meteo; null = fallback to climate.js Rome table
let climateExtra = null;    // { rh, wind, precip } monthly means from Open-Meteo (may be null / partial)
let currentFloor = 0;       // user's floor (0 = ground … 5); higher clears nearby rooftops → less obstruction
let lastAnalysis = null; // { seasonal, comfort, ... } from the latest refreshUI(), read by openKPIModal()
// Coordinates of the last picked autocomplete suggestion, kept so the "Vai"
// button can analyse them without a second Nominatim call. Includes the exact
// query text it was picked for, to invalidate it if the user edits the field.
let pendingSearch = null; // { query, lat, lng } | null

// Persists between map clicks; angle survives unless user clicks map again
let currentScan = {
  lat: 41.9028,
  lng: 12.4964,
  angleDeg: 180,   // facade azimuth 0=N, 90=E, 180=S, 270=W
  buildings: [],   // OSM footprints + heights near the point (for shadow casting)
  userAdjusted: false, // true when user manually moved the angle slider
};

// ─── DOM helpers ──────────────────────────────────────────────────────────────

function $(id) { return document.getElementById(id); }

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function showToast(msg, type = 'default', duration = 10000) {
  const toast = $('map-error-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'map-error-toast' + (type !== 'default' ? ` ${type}` : '');
  toast.style.display = 'block';
  if (errorTimeout) clearTimeout(errorTimeout);
  errorTimeout = setTimeout(() => { toast.style.display = 'none'; }, duration);
}

function hideToast() {
  const toast = $('map-error-toast');
  if (toast) toast.style.display = 'none';
  if (errorTimeout) { clearTimeout(errorTimeout); errorTimeout = null; }
}

// ─── time helpers ─────────────────────────────────────────────────────────────

function getSelectedUTCDate() {
  const month = parseInt($('month-slider').value);
  const localHour = parseInt($('hour-slider').value);
  return localToUTC(DEFAULT_YEAR, month, 15, localHour, TIMEZONE);
}

function getSelectedMonth() { return parseInt($('month-slider').value); }
function getSelectedLocalHour() { return parseInt($('hour-slider').value); }

// ─── map initialisation ───────────────────────────────────────────────────────

function initMap() {
  map = L.map('map', { zoomControl: false, maxZoom: 19 }).setView([41.9028, 12.4964], 17);
  L.control.zoom({ position: 'topright' }).addTo(map);
  // Standard OpenStreetMap tiles: free, no API key, and legible — CARTO's
  // basemaps now stamp "API KEY REQUIRED" over every style without a key.
  L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      attribution: '©<a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,          // the OSM tile server serves up to z19
    }
  ).addTo(map);

  map.on('click', e => analyzePoint(e.latlng.lat, e.latlng.lng, false));
}

// Clean custom marker (a green dot) — replaces Leaflet's default pin + grey shadow.
function markerIcon() {
  return L.divIcon({
    className: 'suntrace-marker',
    html: '<span class="suntrace-marker-dot"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

// ─── map overlays ─────────────────────────────────────────────────────────────

function clearOverlays() {
  if (radarCircle)   { map.removeLayer(radarCircle);   radarCircle   = null; }
  if (shadowPolygon) { map.removeLayer(shadowPolygon); shadowPolygon = null; }
  if (sunRay)        { map.removeLayer(sunRay);        sunRay        = null; }
  if (facadeLine)    { map.removeLayer(facadeLine);    facadeLine    = null; }
}

function renderMapOverlays(lat, lng, elevation, azimuth, facadeAz) {
  clearOverlays();

  radarCircle = L.circle([lat, lng], {
    radius: 35,
    color: '#22c55e',
    fillColor: '#22c55e',
    fillOpacity: 0.05,
    weight: 1.2,
    dashArray: '4 4',
  }).addTo(map);

  if (elevation > 0) {
    // Shadow polygon (opposite direction from sun)
    const shadowAz = (azimuth + 180) % 360;
    const L_shadow = Math.min(0.00055, 0.00004 + (1 / elevation) * 0.006);
    const p1 = offsetByAzimuth(lat, lng, shadowAz - 8, L_shadow);
    const p2 = offsetByAzimuth(lat, lng, shadowAz + 8, L_shadow);
    const opacity = Math.max(0.18, 0.58 - (elevation / 90) * 0.32);

    shadowPolygon = L.polygon([[lat, lng], p1, p2], {
      color: 'rgba(148, 163, 184, 0.45)', // faint outline so the wedge reads on the dark map
      fillColor: '#020509',
      fillOpacity: Math.min(0.6, opacity + 0.12),
      weight: 1,
    }).addTo(map);

    // Sun ray
    const sunPt = offsetByAzimuth(lat, lng, azimuth, 0.00028);
    sunRay = L.polyline([sunPt, [lat, lng]], {
      color: '#f5b301',
      weight: 2,
      dashArray: '6 5',
      opacity: 0.95,
    }).addTo(map);
  }

  // Facade orientation line
  const facadeTip = offsetByAzimuth(lat, lng, facadeAz, 0.00014);
  facadeLine = L.polyline([[lat, lng], facadeTip], {
    color: '#22c55e',
    weight: 6,
    opacity: 0.95,
  }).addTo(map);
}

// ─── geofencing ───────────────────────────────────────────────────────────────

const ROME = { lat: 41.9028, lng: 12.4964 };

// Fast offline pre-filter: true when clearly outside the Italian bounding box.
function isOutsideBox(lat, lng) {
  return lat < ITALY_BOUNDS.latMin || lat > ITALY_BOUNDS.latMax
      || lng < ITALY_BOUNDS.lonMin || lng > ITALY_BOUNDS.lonMax;
}

/**
 * Precise classification of a point via Nominatim reverse geocoding.
 * Land returns a country_code; open sea returns an error (no country), which we
 * read as water — Italian waters when inside the box, foreign waters otherwise.
 * @returns {Promise<'it-land'|'it-water'|'foreign'>}
 */
async function classifyLocation(lat, lng) {
  const url = `${REVERSE_URL}?format=jsonv2&lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}&zoom=10&addressdetails=1`;
  const res = await fetch(url);
  const data = await res.json();
  const cc = data && data.address ? data.address.country_code : null;
  if (cc && IN_ITALY_CODES.has(cc)) return 'it-land';
  if (cc) return 'foreign';               // some other country's land
  return isOutsideBox(lat, lng) ? 'foreign' : 'it-water';
}

function goToRome() {
  map.setView([ROME.lat, ROME.lng], 13);
  analyzePoint(ROME.lat, ROME.lng, false, true); // trusted reposition — skip geofence
}

function rejectForeign() {
  showToast(t('geo-foreign'), 'warn', 10000);
  goToRome();
}

function rejectWater() {
  showToast(t('geo-water'), 'warn', 10000);
  goToRome();
}

// Load real climate normals for a validated in-Italy point, then re-render.
function loadClimateFor(lat, lng) {
  fetchClimateNormals(lat, lng)
    .then(normals => {
      if (currentScan.lat === lat && currentScan.lng === lng) {
        customBaseTemps = normals.temp;
        climateExtra = { rh: normals.rh, wind: normals.wind, precip: normals.precip };
        refreshUI();
      }
    })
    .catch(() => { /* silent fallback — Rome table already in effect */ });
}

// ─── OSM building context (real facade orientation + obstruction) ─────────────

// The main Overpass instance is a heavily used free service that rate-limits and
// refuses connections under load; fall through to the community mirrors.
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

// Called for a validated in-Italy point: fetch real climate + building context.
function onValidLand(lat, lng) {
  loadClimateFor(lat, lng);
  detectBuildingContext(lat, lng);
}

/**
 * Derive facade orientation and obstruction from real OSM buildings around the
 * point, then update the scan (orientation only if the user hasn't set it
 * manually) and re-render. Cached, silent, best-effort — never throws upward.
 */
// Pulse the detected orientation/shading readouts while OSM is being queried.
function setBuildingLoading(on) {
  ['telemetry-cardinal', 'val-manual-obs'].forEach(id => {
    const el = $(id);
    if (el) el.classList.toggle('loading-pulse', on);
  });
}

async function detectBuildingContext(lat, lng) {
  setBuildingLoading(true);
  let ctx;
  try { ctx = await fetchBuildingContext(lat, lng); }
  catch { if (currentScan.lat === lat && currentScan.lng === lng) setBuildingLoading(false); return; }
  if (currentScan.lat !== lat || currentScan.lng !== lng) return; // superseded — a newer call owns the loading state
  setBuildingLoading(false);
  if (!ctx) return;                                              // no building nearby → keep the last values
  currentScan.buildings = ctx.buildings;                        // OSM footprints + heights, for shadow casting
  if (!currentScan.userAdjusted) currentScan.angleDeg = ctx.facadeAz;
  refreshUI();
}

// Floor-bar handler: the floor sets the observer height, so just re-render —
// refreshUI recomputes the shadow geometrically from currentScan.buildings.
function applyFloor() {
  if (currentScan) refreshUI();
}

async function fetchBuildingContext(lat, lng) {
  const cacheKey = `osm3_${lat.toFixed(4)}_${lng.toFixed(4)}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* corrupted cache — refetch */ }

  const q = `[out:json][timeout:20];(way["building"](around:90,${lat},${lng});relation["building"](around:90,${lat},${lng}););out geom;`;
  const data = await overpassQuery(q);

  const raw = (data.elements || []).filter(e => Array.isArray(e.geometry) && e.geometry.length >= 3);
  let ctx = null;
  if (raw.length) {
    const buildings = raw.map(e => ({ geom: e.geometry.map(p => ({ lat: p.lat, lon: p.lon })), h: heightOf(e) }));
    ctx = { facadeAz: nearestFacadeAzimuth(lat, lng, raw), buildings };
  }
  try { localStorage.setItem(cacheKey, JSON.stringify(ctx)); } catch { /* storage unavailable */ }
  return ctx;
}

/** Ask each Overpass instance in turn; the first one that answers wins. */
async function overpassQuery(q) {
  let lastError;
  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
        body: 'data=' + encodeURIComponent(q),
      });
      if (!res.ok) { lastError = new Error('Overpass ' + res.status); continue; }
      return await res.json();
    } catch (err) {
      lastError = err; // network refused this mirror — try the next one
    }
  }
  throw lastError ?? new Error('Overpass unreachable');
}

// Building height in metres: OSM `height` tag, else levels × 3 m, default 3 storeys.
function heightOf(el) {
  const t = el.tags || {};
  const h = parseFloat(t.height);
  if (!isNaN(h) && h > 0) return h;
  const lv = parseFloat(t['building:levels']);
  if (!isNaN(lv) && lv > 0) return lv * 3;
  return 9;
}

// ─── Open-Meteo climate normals ───────────────────────────────────────────────

// Aggregate a daily series into 12 monthly means, skipping nulls.
// Returns null if the series is missing or has an empty month (treat as unavailable).
function monthlyMean(time, values) {
  if (!Array.isArray(values) || values.length !== time.length) return null;
  const sums = new Array(12).fill(0);
  const counts = new Array(12).fill(0);
  for (let i = 0; i < time.length; i++) {
    const v = values[i];
    if (v === null || v === undefined) continue;
    const m = parseInt(time[i].slice(5, 7), 10) - 1;
    sums[m] += v;
    counts[m] += 1;
  }
  if (counts.some(c => c === 0)) return null;
  return sums.map((s, i) => s / counts[i]);
}

/**
 * Real monthly climate normals (1991-2020) for a coordinate — temperature plus
 * humidity, wind and precipitation — cached in localStorage. Throws on any
 * network/shape problem or if temperature is unavailable; humidity/wind/precip
 * may individually be null and are handled gracefully downstream.
 * @returns {Promise<{temp:number[], rh:?number[], wind:?number[], precip:?number[]}>}
 */
async function fetchClimateNormals(lat, lon) {
  const cacheKey = `omc_${lat.toFixed(2)}_${lon.toFixed(2)}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* corrupted cache entry — refetch */ }

  const url = `${OPEN_METEO_URL}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&${OPEN_METEO_RANGE}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Open-Meteo ' + res.status);
  const data = await res.json();

  const time = data?.daily?.time;
  if (!Array.isArray(time) || time.length === 0) throw new Error('Open-Meteo: risposta inattesa');

  const temp = monthlyMean(time, data.daily.temperature_2m_mean);
  if (!temp) throw new Error('Open-Meteo: temperatura mancante');

  const normals = {
    temp,
    rh: monthlyMean(time, data.daily.relative_humidity_2m_mean),
    wind: monthlyMean(time, data.daily.windspeed_10m_mean),
    precip: monthlyMean(time, data.daily.precipitation_sum),
  };
  try { localStorage.setItem(cacheKey, JSON.stringify(normals)); } catch { /* storage full/unavailable — non-fatal */ }
  return normals;
}

// ─── analysis ─────────────────────────────────────────────────────────────────

/**
 * Main entry point: analyse a geographic point, update all UI and map overlays.
 * @param {number}  lat
 * @param {number}  lng
 * @param {boolean} isDrag — true when triggered by marker drag (skip resetting angle)
 */
function analyzePoint(lat, lng, isDrag = false, skipGeofence = false) {
  // Update coordinates display
  setText('coord-lat', lat.toFixed(5) + '°N');
  setText('coord-lng', lng.toFixed(5) + '°E');

  // Place or move marker
  if (!targetMarker) {
    targetMarker = L.marker([lat, lng], { draggable: true, icon: markerIcon() }).addTo(map);
    targetMarker.on('dragend', e => {
      const p = e.target.getLatLng();
      analyzePoint(p.lat, p.lng, true);
    });
  } else if (!isDrag) {
    targetMarker.setLatLng([lat, lng]);
  }

  // Facade orientation & obstruction come from real OSM buildings, detected
  // asynchronously in onValidLand(). Keep the LAST known values as provisional
  // (no jump to South) until OSM refines them; if OSM finds nothing they simply
  // stay put. A manually-set angle stays locked across drags.
  const keepManual = isDrag && currentScan.userAdjusted;
  const angleDeg = currentScan.angleDeg;

  currentScan = { lat, lng, angleDeg, buildings: [], userAdjusted: keepManual };
  customBaseTemps = null; // reset to Rome fallback; upgraded async below if the fetch succeeds
  climateExtra = null;    // humidity/wind/precip reset with the point

  refreshUI();

  // Trusted internal repositioning (e.g. back to Rome) skips the geofence.
  if (skipGeofence) { onValidLand(lat, lng); return; }

  // Fast offline reject for points clearly outside Italy.
  if (isOutsideBox(lat, lng)) { rejectForeign(); return; }

  // Precise check near borders / on the sea: reverse-geocode the country.
  classifyLocation(lat, lng)
    .then(kind => {
      if (currentScan.lat !== lat || currentScan.lng !== lng) return; // superseded by a newer point
      if (kind === 'it-land') onValidLand(lat, lng);
      else if (kind === 'it-water') rejectWater();
      else rejectForeign();
    })
    .catch(() => {
      // Network / rate-limit failure: best-effort, keep the optimistic result.
      if (currentScan.lat === lat && currentScan.lng === lng) onValidLand(lat, lng);
    });
}

function refreshUI() {
  const { lat, lng, angleDeg, buildings } = currentScan;
  const month = getSelectedMonth();
  const localHour = getSelectedLocalHour();
  const utcDate = getSelectedUTCDate();

  // Solar position
  const { elevation, azimuth } = solarPosition(utcDate, lat, lng);
  const elevClamped = Math.max(0, elevation);

  // Property parameters
  const windowsType = checkedValue('windows', 'double');
  const insulationType = checkedValue('insulation', 'none');

  // Real shadow: cast a ray to the sun through the nearby OSM buildings from the
  // observer's floor height. When blocked, only diffuse sky light reaches the wall.
  const obsH = currentFloor * FLOOR_HEIGHT_M;
  const hasBuildings = !!(buildings && buildings.length);
  const hasSun = elevClamped > 1;
  const inShadow = hasSun && hasBuildings
    && sunBlocked(lat, lng, buildings, azimuth, elevation, obsH);

  // Sun access over the month (0 = always shaded … 1 = always sunlit) drives the
  // seasonal figures and the shading readout; the live gain uses the instant verdict.
  const kMonth = m => hasBuildings
    ? Math.max(DIFFUSE_K, monthlySunAccess(lat, lng, buildings, obsH, m, DEFAULT_YEAR, TIMEZONE))
    : 1.0;
  const kOmbra = kMonth(month);

  // Facade irradiance and room temperature
  const irr = facadeIrradiance(elevClamped, azimuth, angleDeg);
  const airTemp = airTemperature(month, localHour, lat, customBaseTemps);
  const gain = solarThermalGain(month, irr, inShadow ? DIFFUSE_K : 1.0);
  const roomTemp = airTemp + gain;

  // Sunrise / sunset
  const { sunrise, sunset, dayLength } = sunriseSunset(utcDate, lat, lng);
  const fmt = d => d ? d.toLocaleTimeString('it-IT', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' }) : '--:--';

  // Update main output
  setText('thermal-result', roomTemp.toFixed(1) + '°C');
  setText('main-output-title', t('main-title', { month: monthName(month), hour: localHour }));
  setText('month-label', monthName(month));
  setText('hour-label', String(localHour).padStart(2, '0') + ':00');

  // Seasonal analysis
  const seasonal = seasonalTemperatures(
    m => solarPosition(localToUTC(DEFAULT_YEAR, m, 15, 12, TIMEZONE), lat, lng),
    angleDeg, lat, kMonth, customBaseTemps, windowsType, insulationType
  );

  const seasonMap = {
    winter: { id: 'winter', label: 'Inverno',   temp: seasonal.winter },
    spring: { id: 'spring', label: 'Primavera', temp: seasonal.spring },
    summer: { id: 'summer', label: 'Estate',    temp: seasonal.summer },
    autumn: { id: 'autumn', label: 'Autunno',   temp: seasonal.autumn },
  };

  for (const [, s] of Object.entries(seasonMap)) {
    setText(`val-q-${s.id}`, s.temp.toFixed(1) + '°C');
    const card = $(`quad-${s.id}`);
    if (!card) continue;
    let color = 'var(--green)';
    if (s.id === 'winter') {
      if (s.temp < 13.5) color = 'var(--red)';
      else if (s.temp < 14.5) color = 'var(--orange)';
      else if (s.temp < 15.5) color = 'var(--yellow)';
    } else if (s.id === 'summer') {
      if (s.temp >= 29.5) color = 'var(--red)';
      else if (s.temp >= 27.5) color = 'var(--orange)';
      else if (s.temp >= 26.0) color = 'var(--yellow)';
    }
    card.style.setProperty('--q-color', color);
  }

  // Perceived ("feels-like") winter/summer temperatures from humidity + wind,
  // when climate data is available (winter = January, summer = July).
  let feels = null;
  if (climateExtra && climateExtra.rh && climateExtra.wind) {
    feels = {
      winter: apparentTemperature(seasonal.winter, climateExtra.rh[0], climateExtra.wind[0]),
      summer: apparentTemperature(seasonal.summer, climateExtra.rh[6], climateExtra.wind[6]),
    };
  }

  // Hero range: the coldest and warmest season, beside the headline number
  setText('hero-lo', seasonal.winter.toFixed(0) + '\u00b0');
  setText('hero-hi', seasonal.summer.toFixed(0) + '\u00b0');

  // Comfort Rate
  const comfort = cozynessScore(seasonal.winter, seasonal.summer, kOmbra, windowsType, insulationType, feels);
  const comfortLabel = t('comfort-' + comfort.stars);
  setText('comfort-rate-stars', '⭐'.repeat(comfort.stars));
  setText('comfort-rate-label', comfortLabel);
  const badge = $('energy-class-field');
  if (badge) {
    badge.style.setProperty('--comfort-color', comfort.color);
    badge.dataset.stars = String(comfort.stars);
    badge.dataset.label = comfortLabel;
  }
  // Direct sun hours today on the selected facade (folded into the Comfort Rate detail)
  const sunHoursToday = dailySunHours(utcDate, lat, lng, angleDeg);
  lastAnalysis = { seasonal, comfort, sunHoursToday, feels, climate: climateExtra };

  // Solar info
  setText('val-sunrise', fmt(sunrise));
  setText('val-sunset', fmt(sunset));
  setText('val-day-length', dayLength > 0 ? `${dayLength.toFixed(1)}h` : '--');
  setText('val-sun-elevation', elevClamped > 0 ? `${elevation.toFixed(1)}°` : t('below-horizon'));
  setText('val-sun-azimuth', `${azimuth.toFixed(0)}°`);
  // Direct-sun verdict. Orientation comes first: a wall facing away from the sun
  // gets nothing even under a clear sky, and removing the neighbours wouldn't help.
  let sunKey;
  if (!hasSun) sunKey = 'sun-night';
  else if (irr <= 0) sunKey = 'sun-other-side';
  else if (inShadow) sunKey = 'sun-shadow';
  else sunKey = 'sun-yes';
  setText('val-sun-direct', t(sunKey));
  updateCompass(angleDeg, azimuth, hasSun, sunKey);
  updateDayArc(sunrise, sunset, localHour);
  $('hero-sun')?.classList.toggle('night', !hasSun);

  // Local climate for the selected month (— when the API gave us nothing)
  const rhNow = climateExtra?.rh?.[month];
  const windNow = climateExtra?.wind?.[month];
  const rainNow = climateExtra?.precip?.[month];
  setText('val-humidity', rhNow != null ? Math.round(rhNow) + '%' : '—');
  setText('val-wind', windNow != null ? windNow.toFixed(1) + ' km/h' : '—');
  setText('val-rain', rainNow != null ? Math.round(rainNow * DAYS_IN_MONTH[month]) + ' mm' : '—');
  setText('val-feels', (rhNow != null && windNow != null)
    ? apparentTemperature(roomTemp, rhNow, windNow).toFixed(1) + '°C'
    : '—');

  // Facade info
  setText('val-manual-obs', t(obstructionLabel(kOmbra)));
  setText('telemetry-cardinal', `${angleDeg}° (${t(cardinalLabel(angleDeg))})`);

  // Map overlays
  renderMapOverlays(lat, lng, elevation, azimuth, angleDeg);
}

// ─── KPI modal ────────────────────────────────────────────────────────────────

/**
 * Turn today's direct-sun hours on the facade into a "good/bad news" line
 * for the Comfort Rate detail (replaces the removed sun-hours chart).
 */
function sunExposureNote(hours) {
  const h = hours.toFixed(1);
  if (hours >= 5)   return t('exp-great', { h });
  if (hours >= 2.5) return t('exp-ok', { h });
  if (hours > 0)    return t('exp-low', { h });
  return t('exp-none');
}

/** Value of the checked radio in a group, or a fallback. */
function checkedValue(name, fallback) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value ?? fallback;
}

/** Visible label of the checked radio in a group. */
function checkedLabel(name, fallback) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el?.parentElement?.querySelector('.choice-text')?.textContent ?? fallback;
}

function avg(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }

function openKPIModal() {
  if (!lastAnalysis) return;
  const { seasonal, comfort, sunHoursToday, feels, climate } = lastAnalysis;

  const comfortLabel = t('comfort-' + comfort.stars);
  setText('modal-class-title', t('modal-title', { label: comfortLabel }));
  const classBadge = $('modal-class-badge');
  if (classBadge) {
    classBadge.textContent = `${t('comfort-rate')} ${'⭐'.repeat(comfort.stars)}`;
    classBadge.style.setProperty('--comfort-color', comfort.color);
  }

  setText('kpi-winter-temp', seasonal.winter.toFixed(1) + '°C');
  setText('kpi-summer-temp', seasonal.summer.toFixed(1) + '°C');
  setText('kpi-infissi-selected', checkedLabel('windows', '--'));
  setText('kpi-isolamento-selected', checkedLabel('insulation', '--'));

  // Real-climate strip (humidity/wind → feels-like, plus rainfall)
  setText('kpi-feels-summer', feels ? feels.summer.toFixed(1) + '°C' : '—');
  setText('kpi-humidity', climate && climate.rh ? Math.round(avg(climate.rh)) + '%' : '—');
  setText('kpi-rain', climate && climate.precip
    ? Math.round(climate.precip.reduce((s, v, i) => s + v * DAYS_IN_MONTH[i], 0)) + ' mm'
    : '—');

  setText('kpi-exposure', sunExposureNote(sunHoursToday));
  setText('kpi-tip', t(comfort.tipKey));
  $('kpi-modal').classList.add('open');
}

function closeKPIModal() {
  $('kpi-modal').classList.remove('open');
}

// ─── daylight bar ─────────────────────────────────────────────────────────────

/**
 * Paint the daylight bar: the lit span of the day plus a dot on the hour being
 * analysed. Purely decorative — the same numbers sit in the rows underneath.
 * @param {Date|null} sunrise
 * @param {Date|null} sunset
 * @param {number} localHour  hour under analysis (0–23)
 */
function updateDayArc(sunrise, sunset, localHour) {
  const sunOrb = $('solar-arc-sun');

  const hourOf = d => {
    // The Date is UTC; read it back in the app's timezone, as the rows do.
    const parts = new Intl.DateTimeFormat('it-IT', {
      timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(d);
    const h = +parts.find(p => p.type === 'hour').value;
    const m = +parts.find(p => p.type === 'minute').value;
    return h + m / 60;
  };

  // No sunrise or sunset (polar edge cases): show defaults
  const rise = sunrise ? hourOf(sunrise) : 6;
  const set = sunset ? hourOf(sunset) : 18;
  const dayLength = Math.max(0.1, set - rise);
  const now = localHour + 0.5;
  const fraction = (now - rise) / dayLength;

  // SVG coordinate dimensions: x from 20 to 260, yBase = 70, yApex = 14
  const x0 = 20, x1 = 260, yBase = 70, yApex = 14;

  if (sunOrb) {
    if (fraction >= 0 && fraction <= 1) {
      const u = Math.max(0, Math.min(1, fraction));
      const x = x0 + u * (x1 - x0);
      // Parabolic arc height formula: y = yBase - (yBase - yApex) * 4 * u * (1 - u)
      const y = yBase - (yBase - yApex) * 4 * u * (1 - u);
      sunOrb.setAttribute('transform', `translate(${x.toFixed(1)}, ${y.toFixed(1)})`);
      sunOrb.classList.remove('night');
    } else {
      // Below horizon
      const isBeforeRise = fraction < 0;
      const x = isBeforeRise ? x0 : x1;
      const y = yBase + 4;
      sunOrb.setAttribute('transform', `translate(${x}, ${y})`);
      sunOrb.classList.add('night');
    }
  }
}

// ─── time sliders ─────────────────────────────────────────────────────────────

/** Fill the track up to the current value (CSS reads --p as 0…1). */
function paintSlider(el) {
  const min = +el.min, max = +el.max;
  el.style.setProperty('--p', String((el.value - min) / (max - min)));
}

function initSliders() {
  for (const id of ['month-slider', 'hour-slider']) {
    const el = $(id);
    paintSlider(el);
    el.addEventListener('input', () => {
      paintSlider(el);
      if (currentScan) refreshUI(); // refreshUI updates the month/hour labels
    });
  }
}

// ─── facade orientation slider ────────────────────────────────────────────────

function initCompass() {
  document.querySelectorAll('.compass-dir').forEach(btn => {
    btn.addEventListener('click', () => {
      currentScan.angleDeg = parseInt(btn.dataset.az, 10);
      currentScan.userAdjusted = true; // an explicit choice is never overwritten by OSM
      refreshUI();
    });
  });
  initCompassDrag();
}

/**
 * Drag the dial itself to rotate the facade, snapping to the nearest of the
 * 8 cardinal/intercardinal points as you go — grabbing and turning a dial
 * reads more naturally than hunting for one of 8 small buttons, especially
 * on touch. The buttons stay for an exact one-tap choice; dragging anywhere
 * else on the dial (needle, hub, sun, empty rim) rotates it live.
 */
function initCompassDrag() {
  const dial = document.querySelector('.compass-dial');
  if (!dial) return;

  let dragging = false;

  const bearingAt = (clientX, clientY) => {
    const r = dial.getBoundingClientRect();
    const dx = clientX - (r.left + r.width / 2);
    const dy = clientY - (r.top + r.height / 2);
    const deg = Math.atan2(dx, -dy) * 180 / Math.PI; // 0=N, clockwise
    return (deg + 360) % 360;
  };
  const snap45 = deg => Math.round(deg / 45) * 45 % 360;

  const applyBearing = (clientX, clientY) => {
    currentScan.angleDeg = snap45(bearingAt(clientX, clientY));
    currentScan.userAdjusted = true;
    refreshUI();
  };

  dial.addEventListener('pointerdown', e => {
    if (e.target.closest('.compass-dir') || !currentScan) return; // let button clicks behave normally
    dragging = true;
    dial.classList.add('dragging');
    try { dial.setPointerCapture(e.pointerId); } catch { /* e.g. a synthetic/invalid pointer id */ }
    applyBearing(e.clientX, e.clientY);
  });
  dial.addEventListener('pointermove', e => {
    if (!dragging) return;
    applyBearing(e.clientX, e.clientY);
  });
  const endDrag = e => {
    if (!dragging) return;
    dragging = false;
    dial.classList.remove('dragging');
    if (dial.hasPointerCapture?.(e.pointerId)) dial.releasePointerCapture(e.pointerId);
  };
  dial.addEventListener('pointerup', endDrag);
  dial.addEventListener('pointercancel', endDrag);
}

/**
 * Point the needle at the facade, place the sun on the rim and say, in one line,
 * whether that wall is actually being hit right now.
 * @param {number} facadeAz  facade azimuth (deg)
 * @param {number} sunAz     solar azimuth (deg)
 * @param {boolean} sunUp    sun above the horizon
 * @param {string} stateKey  i18n key of the direct-sun verdict
 */
function updateCompass(facadeAz, sunAz, sunUp, stateKey) {
  const needle = $('compass-needle');
  if (needle) needle.style.transform = `rotate(${facadeAz}deg)`;

  const sun = $('compass-sun');
  if (sun) {
    sun.style.setProperty('--sun-a', `${sunAz}deg`);
    sun.classList.toggle('hidden', !sunUp);
    sun.classList.toggle('shaded', stateKey !== 'sun-yes');
  }

  // Highlight the direction closest to the facade (OSM may report any angle).
  const nearest = (Math.round(facadeAz / 45) * 45) % 360;
  document.querySelectorAll('.compass-dir').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.az, 10) === nearest);
  });
}

// ─── property selectors (infissi / isolamento) ────────────────────────────────

function initPropertySelects() {
  document.querySelectorAll('input[name="windows"], input[name="insulation"]').forEach(radio => {
    radio.addEventListener('change', () => { if (currentScan) refreshUI(); });
  });
}

// ─── address search ───────────────────────────────────────────────────────────

function initSearchAutocomplete() {
  const input   = $('search-input');
  const preview = $('autocomplete-preview');

  // Search runs only on the "Vai" button. Enter just closes the suggestions;
  // Escape closes them and blurs the field.
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closePreview(); input.blur(); }
    if (e.key === 'Enter')  { e.preventDefault(); closePreview(); }
  });

  input.addEventListener('input', () => {
    clearTimeout(autocompleteTimeout);
    pendingSearch = null; // editing the text invalidates any previously picked suggestion
    const q = input.value.trim();

    if (q.length < 3) { closePreview(); return; }

    autocompleteTimeout = setTimeout(() => fetchSuggestions(q), NOMINATIM_DEBOUNCE_MS);
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !preview.contains(e.target)) closePreview();
  });

  $('search-btn').addEventListener('click', searchAddress);
}

function closePreview() {
  const preview = $('autocomplete-preview');
  if (preview) { preview.innerHTML = ''; preview.style.display = 'none'; }
}

async function fetchSuggestions(query) {
  const input = $('search-input');
  const preview = $('autocomplete-preview');

  input.classList.add('input-loading');
  try {
    const res = await fetch(
      `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=it&addressdetails=1`
    );
    if (!res.ok) throw new Error('Nominatim ' + res.status);
    const data = await res.json();

    preview.innerHTML = '';
    if (data && data.length > 0) {
      preview.style.display = 'block';
      data.forEach(item => {
        const div = document.createElement('div');
        div.className = 'preview-item';
        div.textContent = item.display_name;
        div.addEventListener('click', () => {
          // Picking a suggestion only fills the field; the search itself runs
          // when the user presses "Vai" (which reuses these coordinates).
          input.value = item.display_name;
          pendingSearch = { query: item.display_name, lat: parseFloat(item.lat), lng: parseFloat(item.lon) };
          closePreview();
          input.focus();
        });
        preview.appendChild(div);
      });
    } else {
      preview.style.display = 'block';
      const empty = document.createElement('div');
      empty.className = 'autocomplete-empty';
      empty.textContent = t('search-empty');
      preview.appendChild(empty);
    }
  } catch (err) {
    preview.style.display = 'block';
    const errDiv = document.createElement('div');
    errDiv.className = 'autocomplete-empty';
    errDiv.textContent = t('search-neterror');
    preview.appendChild(errDiv);
  } finally {
    input.classList.remove('input-loading');
  }
}

async function searchAddress() {
  const input = $('search-input');
  const query = input.value.trim();
  if (!query) return;

  // Reuse the coordinates of a picked suggestion when the field still matches it,
  // avoiding a redundant Nominatim lookup.
  if (pendingSearch && pendingSearch.query === query) {
    closePreview();
    map.setView([pendingSearch.lat, pendingSearch.lng], 18);
    analyzePoint(pendingSearch.lat, pendingSearch.lng, false);
    return;
  }

  input.classList.add('input-loading');
  closePreview();
  try {
    const res = await fetch(
      `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=it`
    );
    if (!res.ok) throw new Error('Rete non disponibile');
    const data = await res.json();

    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      map.setView([lat, lng], 18);
      analyzePoint(lat, lng, false);
    } else {
      showToast(t('search-notfound'), 'warn', 7000);
    }
  } catch {
    showToast(t('search-neterror-toast'), 'error', 8000);
  } finally {
    input.classList.remove('input-loading');
  }
}

// ─── geolocation ──────────────────────────────────────────────────────────────

function initGeolocation() {
  $('geo-btn').addEventListener('click', getLocation);
}

function getLocation() {
  const btn  = $('geo-btn');
  const icon = $('geo-icon');
  hideToast();

  if (!navigator.geolocation) {
    showToast(t('geoloc-unsupported'), 'error', 8000);
    return;
  }

  btn.classList.add('loading');
  icon.textContent = '⟳';

  navigator.geolocation.getCurrentPosition(
    pos => {
      btn.classList.remove('loading', 'denied');
      icon.textContent = '🎯';
      btn.setAttribute('aria-label', t('geo-aria'));

      const acc = Math.round(pos.coords.accuracy);
      if (acc > 2000) {
        showToast(t('geoloc-inaccurate', { km: (acc / 1000).toFixed(1) }), 'warn', 15000);
      }

      map.setView([pos.coords.latitude, pos.coords.longitude], 18);
      analyzePoint(pos.coords.latitude, pos.coords.longitude, false);
    },
    err => {
      btn.classList.remove('loading');
      btn.classList.add('denied');
      icon.textContent = '🚫';

      let msg = t('geoloc-failed');
      if (err.code === err.PERMISSION_DENIED) {
        msg = t('geoloc-denied');
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        msg = t('geoloc-unavailable');
      } else if (err.code === err.TIMEOUT) {
        msg = t('geoloc-timeout');
      }
      btn.setAttribute('aria-label', msg);
      showToast(msg, 'error', 15000);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
}

// ─── mobile sidebar toggle ────────────────────────────────────────────────────

function initMobileToggle() {
  const toggle  = $('sidebar-toggle');
  const sidebar = $('sidebar');
  if (!toggle || !sidebar) return;

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    toggle.textContent = sidebar.classList.contains('open') ? t('panel-close') : t('panel-open');
  });
}

// ─── language switcher (IT / EN) ──────────────────────────────────────────────

function markActiveLang() {
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === getLang());
  });
}

function changeLang(lang) {
  if (lang === getLang()) return;
  setLang(lang);
  applyTranslations();          // static text
  panelRemeasurers.forEach(fn => fn()); // IT/EN copy differs in length
  markActiveLang();
  if (currentScan) refreshUI(); // dynamic text (temps, labels, exposure…)
  if ($('kpi-modal')?.classList.contains('open')) openKPIModal(); // refresh an open modal
  const toggle = $('sidebar-toggle');
  const sidebar = $('sidebar');
  if (toggle && sidebar) {
    toggle.textContent = sidebar.classList.contains('open') ? t('panel-close') : t('panel-open');
  }
}

function initLangSwitch() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => changeLang(btn.dataset.lang));
  });
  markActiveLang();
}

// ─── collapsible mini panels (map legend / placement hint) ─────────────────────

// Re-measured after a language switch, since IT/EN copy differs in length.
const panelRemeasurers = [];

/**
 * Wire a panel that folds down to a single 42×42 icon button (the geolocation
 * button's own footprint) and back. CSS can't transition to/from `auto`, so we
 * measure the panel's real laid-out width and height once and drive the
 * animation from explicit `--panel-w`/`--panel-h` custom properties instead.
 * @param {string} panelId
 * @param {string} toggleId
 */
function initCollapsiblePanel(panelId, toggleId) {
  const panel = $(panelId);
  const toggle = $(toggleId);
  if (!panel || !toggle) return;

  const measure = () => {
    const wasCollapsed = panel.classList.contains('collapsed');
    if (wasCollapsed) panel.classList.remove('collapsed'); // measure the true expanded size
    panel.style.setProperty('--panel-w', panel.scrollWidth + 'px');
    panel.style.setProperty('--panel-h', panel.scrollHeight + 'px');
    if (wasCollapsed) panel.classList.add('collapsed');
  };
  measure();
  panelRemeasurers.push(measure);

  toggle.addEventListener('click', () => {
    const collapsed = !panel.classList.contains('collapsed');
    panel.classList.toggle('collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
  });
}

function initCollapsiblePanels() {
  initCollapsiblePanel('map-hint', 'map-hint-toggle');
  initCollapsiblePanel('map-legend', 'map-legend-toggle');
}

// ─── floor selector (building height) ─────────────────────────────────────────

function markActiveFloor() {
  document.querySelectorAll('.floor-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.floor, 10) === currentFloor);
  });
}

function initFloorBar() {
  document.querySelectorAll('.floor-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFloor = parseInt(btn.dataset.floor, 10);
      markActiveFloor();
      applyFloor(); // recompute obstruction for the chosen floor and re-render
    });
  });
  markActiveFloor();
}

// ─── app bootstrap ────────────────────────────────────────────────────────────

let appStarted = false;

// The app is desktop-only: below this width the map controls have no room.
function isSmallScreen() {
  return window.innerWidth < 768 || navigator.maxTouchPoints > 1;
}

/**
 * Show the explanation whenever the window is too small — not only at load.
 * Otherwise shrinking the window (or zooming the browser in, which narrows the
 * CSS viewport) silently hides every map control with nothing to explain why.
 */
function updateMobileBlock() {
  const warning = $('mobile-warning');
  const small = isSmallScreen();
  if (warning) warning.style.display = small ? 'flex' : 'none';
  if (small) return;
  if (!appStarted) startApp();
  else map?.invalidateSize();   // the map container just changed size
}

function startApp() {
  appStarted = true;
  initMap();
  initSliders();
  initCompass();
  initPropertySelects();
  initSearchAutocomplete();
  initGeolocation();
  initMobileToggle();
  initLangSwitch();
  initFloorBar();
  initCollapsiblePanels();

  // KPI modal wiring
  const badge = $('energy-class-field');
  if (badge) badge.addEventListener('click', openKPIModal);
  const closeBtn = $('modal-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeKPIModal);
  const overlay = $('kpi-modal');
  if (overlay) overlay.addEventListener('click', e => {
    if (e.target === overlay) closeKPIModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeKPIModal();
  });

  // Arriving from the landing page's search bar (index.html?q=...): run that
  // search right away instead of the default Rome view.
  const handoffQuery = new URLSearchParams(location.search).get('q');
  if (handoffQuery) {
    const input = $('search-input');
    if (input) input.value = handoffQuery;
    searchAddress();
  } else {
    // Initial render (Rome is a known-valid point — skip the geofence check)
    analyzePoint(ROME.lat, ROME.lng, false, true);
  }
}

/**
 * Last resort: an unexpected failure should say so rather than leave a dead page.
 * The message is deliberately literal — it is what you would paste in a report.
 */
function initErrorReporting() {
  const report = (what) => showToast(t('app-error', { detail: String(what).slice(0, 160) }), 'error', 20000);
  window.addEventListener('error', e => report(e.message || e.error));
  window.addEventListener('unhandledrejection', e => report(e.reason?.message || e.reason));
}

export function init() {
  initErrorReporting();
  setLang(getLang());  // sync <html lang> + persist the resolved language
  applyTranslations(); // fill static UI text (including the mobile overlay below)
  updateMobileBlock();
  window.addEventListener('resize', updateMobileBlock);
}
