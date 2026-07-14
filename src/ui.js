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
  obstructionLabel,
  cardinalLabel,
} from './climate.js';

import { t, monthName, getLang, setLang, applyTranslations } from './i18n.js';

// ─── constants ────────────────────────────────────────────────────────────────

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_DEBOUNCE_MS = 420;
const TIMEZONE = 'Europe/Rome';
const DEFAULT_YEAR = 2026;

// Bounding box covering Italy including islands (Sicily, Sardinia, Lampedusa)
const ITALY_BOUNDS = { latMin: 35.4, latMax: 47.1, lonMin: 6.6, lonMax: 18.6 };

// Open-Meteo climate normals (1991-2020, EC-Earth3P-HR). "monthly" aggregation
// param returns an empty payload on this API — verified against the live
// endpoint — so we pull daily means and aggregate to 12 monthly values ourselves.
const OPEN_METEO_URL = 'https://climate-api.open-meteo.com/v1/climate';
const OPEN_METEO_RANGE = 'models=EC_Earth3P_HR&start_date=1991-01-01&end_date=2020-12-31&daily=temperature_2m_mean';

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
let customBaseTemps = null; // 12 monthly means from Open-Meteo; null = fallback to climate.js Rome table
let lastAnalysis = null; // { seasonal, comfort } from the latest refreshUI(), read by openKPIModal()
// Coordinates of the last picked autocomplete suggestion, kept so the "Vai"
// button can analyse them without a second Nominatim call. Includes the exact
// query text it was picked for, to invalidate it if the user edits the field.
let pendingSearch = null; // { query, lat, lng } | null

// Persists between map clicks; angle survives unless user clicks map again
let currentScan = {
  lat: 41.9028,
  lng: 12.4964,
  angleDeg: 180,   // facade azimuth 0=N, 90=E, 180=S, 270=W
  kOmbra: 1.0,     // obstruction factor 0..1
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
  map = L.map('map', { zoomControl: false, maxZoom: 20 }).setView([41.9028, 12.4964], 17);
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    {
      attribution: '©<a href="https://openstreetmap.org">OSM</a> ©<a href="https://carto.com">CARTO</a>',
      maxZoom: 20,          // CARTO voyager serves tiles up to z20 — one extra step of zoom
      maxNativeZoom: 20,
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
    color: '#059669',
    fillColor: '#059669',
    fillOpacity: 0.04,
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
      color: 'transparent',
      fillColor: '#0f172a',
      fillOpacity: opacity,
      weight: 0,
    }).addTo(map);

    // Sun ray
    const sunPt = offsetByAzimuth(lat, lng, azimuth, 0.00028);
    sunRay = L.polyline([sunPt, [lat, lng]], {
      color: '#ca8a04',
      weight: 2,
      dashArray: '6 5',
      opacity: 0.9,
    }).addTo(map);
  }

  // Facade orientation line
  const facadeTip = offsetByAzimuth(lat, lng, facadeAz, 0.00014);
  facadeLine = L.polyline([[lat, lng], facadeTip], {
    color: '#059669',
    weight: 6,
    opacity: 0.9,
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
  if (cc === 'it') return 'it-land';
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
    .then(monthly => {
      if (currentScan.lat === lat && currentScan.lng === lng) {
        customBaseTemps = monthly;
        refreshUI();
      }
    })
    .catch(() => { /* silent fallback — Rome table already in effect */ });
}

// ─── OSM building context (real facade orientation + obstruction) ─────────────

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

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
async function detectBuildingContext(lat, lng) {
  let ctx;
  try { ctx = await fetchBuildingContext(lat, lng); }
  catch { return; }
  if (!ctx) return;                                              // no building nearby
  if (currentScan.lat !== lat || currentScan.lng !== lng) return; // superseded by a newer point
  currentScan.kOmbra = ctx.kOmbra;
  if (!currentScan.userAdjusted) {
    currentScan.angleDeg = ctx.facadeAz;
    const slider = $('manual-angle-slider');
    if (slider) slider.value = ctx.facadeAz;
  }
  refreshUI();
}

async function fetchBuildingContext(lat, lng) {
  const cacheKey = `osm_${lat.toFixed(4)}_${lng.toFixed(4)}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* corrupted cache — refetch */ }

  const q = `[out:json][timeout:20];(way["building"](around:70,${lat},${lng});relation["building"](around:70,${lat},${lng}););out geom;`;
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: 'data=' + encodeURIComponent(q),
  });
  if (!res.ok) throw new Error('Overpass ' + res.status);
  const data = await res.json();

  const buildings = (data.elements || []).filter(e => Array.isArray(e.geometry) && e.geometry.length >= 3);
  const ctx = buildings.length
    ? { facadeAz: nearestFacadeAzimuth(lat, lng, buildings), kOmbra: obstructionFromDensity(buildings) }
    : null;
  try { localStorage.setItem(cacheKey, JSON.stringify(ctx)); } catch { /* storage unavailable */ }
  return ctx;
}

// Facade azimuth = outward normal (facing the click) of the nearest building edge.
function nearestFacadeAzimuth(clat, clng, buildings) {
  const mLat = 111320;
  const mLng = 111320 * Math.cos(clat * Math.PI / 180);
  const xy = (la, lo) => ({ x: (lo - clng) * mLng, y: (la - clat) * mLat });
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

function pointSegDist(p, a, c) {
  const abx = c.x - a.x, aby = c.y - a.y;
  const ab2 = abx * abx + aby * aby || 1e-9;
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

// Outward normal of edge a→c on the side of the click, as an azimuth (0=N, 90=E).
function outwardNormalAz(a, c, click) {
  let nx = -(c.y - a.y);
  let ny = (c.x - a.x);
  const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
  if (nx * (click.x - mx) + ny * (click.y - my) < 0) { nx = -nx; ny = -ny; }
  return Math.atan2(nx, ny) * 180 / Math.PI;
}

// Obstruction factor from local building density/height (1 = open, 0.2 = dense).
function obstructionFromDensity(buildings) {
  const n = buildings.length;
  let sumLevels = 0, counted = 0;
  for (const b of buildings) {
    const lv = parseFloat(b.tags && b.tags['building:levels']);
    if (!isNaN(lv)) { sumLevels += lv; counted++; }
  }
  const avgLevels = counted ? sumLevels / counted : 3;
  let k = 1.0;
  if (n >= 8) k = 0.35; else if (n >= 4) k = 0.6; else if (n >= 2) k = 0.8;
  if (avgLevels >= 6) k -= 0.15;
  return Math.max(0.2, Math.min(1.0, k));
}

// ─── Open-Meteo climate normals ───────────────────────────────────────────────

/**
 * Real monthly mean temperatures (1991-2020 normals) for a coordinate, cached
 * in localStorage. Throws on any network/shape problem; callers fall back
 * silently to the static Rome table (climate.js default) on rejection.
 */
async function fetchClimateNormals(lat, lon) {
  const cacheKey = `om_${lat.toFixed(2)}_${lon.toFixed(2)}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* corrupted cache entry — refetch */ }

  const url = `${OPEN_METEO_URL}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&${OPEN_METEO_RANGE}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Open-Meteo ' + res.status);
  const data = await res.json();

  const time = data?.daily?.time;
  const temps = data?.daily?.temperature_2m_mean;
  if (!Array.isArray(time) || !Array.isArray(temps) || time.length === 0 || time.length !== temps.length) {
    throw new Error('Open-Meteo: risposta inattesa');
  }

  const sums = new Array(12).fill(0);
  const counts = new Array(12).fill(0);
  for (let i = 0; i < time.length; i++) {
    const t = temps[i];
    if (t === null || t === undefined) continue;
    const month = parseInt(time[i].slice(5, 7), 10) - 1;
    sums[month] += t;
    counts[month] += 1;
  }
  if (counts.some(c => c === 0)) throw new Error('Open-Meteo: dati mensili incompleti');

  const monthly = sums.map((s, i) => s / counts[i]);
  try { localStorage.setItem(cacheKey, JSON.stringify(monthly)); } catch { /* storage full/unavailable — non-fatal */ }
  return monthly;
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
  // asynchronously in onValidLand(). Until that resolves, keep a manually-set
  // angle across drags, otherwise start neutral (South-facing, no shading).
  const keepManual = isDrag && currentScan.userAdjusted;
  const angleDeg = keepManual ? currentScan.angleDeg : 180;

  currentScan = { lat, lng, angleDeg, kOmbra: 1.0, userAdjusted: keepManual };
  customBaseTemps = null; // reset to Rome fallback; upgraded async below if the fetch succeeds

  if (!isDrag) {
    $('manual-angle-slider').value = angleDeg;
  }

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
  const { lat, lng, angleDeg, kOmbra } = currentScan;
  const month = getSelectedMonth();
  const localHour = getSelectedLocalHour();
  const utcDate = getSelectedUTCDate();

  // Solar position
  const { elevation, azimuth } = solarPosition(utcDate, lat, lng);
  const elevClamped = Math.max(0, elevation);

  // Property parameters
  const windowsType = $('windows-select')?.value ?? 'double';
  const insulationType = $('insulation-select')?.value ?? 'none';

  // Facade irradiance and room temperature
  const irr = facadeIrradiance(elevClamped, azimuth, angleDeg);
  const airTemp = airTemperature(month, localHour, lat, customBaseTemps);
  const gain = solarThermalGain(month, irr, kOmbra);
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
    angleDeg, lat, kOmbra, customBaseTemps, windowsType, insulationType
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
    card.style.backgroundColor = color;
  }

  // Comfort Rate
  const comfort = cozynessScore(seasonal.winter, seasonal.summer, kOmbra, windowsType, insulationType);
  const comfortLabel = t('comfort-' + comfort.stars);
  setText('comfort-rate-stars', '⭐'.repeat(comfort.stars));
  setText('comfort-rate-label', comfortLabel);
  const badge = $('energy-class-field');
  if (badge) {
    badge.style.backgroundColor = comfort.color;
    badge.dataset.stars = String(comfort.stars);
    badge.dataset.label = comfortLabel;
  }
  // Direct sun hours today on the selected facade (folded into the Comfort Rate detail)
  const sunHoursToday = dailySunHours(utcDate, lat, lng, angleDeg);
  lastAnalysis = { seasonal, comfort, sunHoursToday };

  // Solar info
  setText('val-sunrise', fmt(sunrise));
  setText('val-sunset', fmt(sunset));
  setText('val-day-length', dayLength > 0 ? `${dayLength.toFixed(1)}h` : '--');
  setText('val-sun-elevation', elevClamped > 0 ? `${elevation.toFixed(1)}°` : t('below-horizon'));
  setText('val-sun-azimuth', `${azimuth.toFixed(0)}°`);

  // Facade info
  setText('val-manual-angle', `${angleDeg}°`);
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

function selectedOptionLabel(selectId, fallback) {
  return $(selectId)?.selectedOptions?.[0]?.textContent ?? fallback;
}

function openKPIModal() {
  if (!lastAnalysis) return;
  const { seasonal, comfort, sunHoursToday } = lastAnalysis;

  const comfortLabel = t('comfort-' + comfort.stars);
  setText('modal-class-title', t('modal-title', { label: comfortLabel }));
  const classBadge = $('modal-class-badge');
  if (classBadge) {
    classBadge.textContent = `${t('comfort-rate')} ${'⭐'.repeat(comfort.stars)}`;
    classBadge.style.backgroundColor = comfort.color;
  }

  setText('kpi-winter-temp', seasonal.winter.toFixed(1) + '°C');
  setText('kpi-summer-temp', seasonal.summer.toFixed(1) + '°C');
  setText('kpi-infissi-selected', selectedOptionLabel('windows-select', '--'));
  setText('kpi-isolamento-selected', selectedOptionLabel('insulation-select', '--'));

  setText('kpi-exposure', sunExposureNote(sunHoursToday));
  setText('kpi-tip', t(comfort.tipKey));
  $('kpi-modal').classList.add('open');
}

function closeKPIModal() {
  $('kpi-modal').classList.remove('open');
}

// ─── time sliders ─────────────────────────────────────────────────────────────

function initSliders() {
  $('month-slider').addEventListener('input', () => {
    if (currentScan) refreshUI(); // refreshUI updates the month/hour labels
  });

  $('hour-slider').addEventListener('input', () => {
    if (currentScan) refreshUI(); // refreshUI updates the month/hour labels
  });
}

// ─── facade orientation slider ────────────────────────────────────────────────

function initFacadeSlider() {
  $('manual-angle-slider').addEventListener('input', () => {
    const az = parseInt($('manual-angle-slider').value);
    currentScan.angleDeg = az;
    currentScan.userAdjusted = true;
    refreshUI();
  });
}

// ─── property selectors (infissi / isolamento) ────────────────────────────────

function initPropertySelects() {
  $('windows-select')?.addEventListener('change', () => { if (currentScan) refreshUI(); });
  $('insulation-select')?.addEventListener('change', () => { if (currentScan) refreshUI(); });
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

// ─── app bootstrap ────────────────────────────────────────────────────────────

export function init() {
  setLang(getLang());  // sync <html lang> + persist the resolved language
  applyTranslations(); // fill static UI text (including the mobile overlay below)

  const isMobile = window.innerWidth < 768 || navigator.maxTouchPoints > 1;
  if (isMobile) {
    const warning = $('mobile-warning');
    if (warning) warning.style.display = 'flex';
    return;
  }

  initMap();
  initSliders();
  initFacadeSlider();
  initPropertySelects();
  initSearchAutocomplete();
  initGeolocation();
  initMobileToggle();
  initLangSwitch();

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

  // Initial render (Rome is a known-valid point — skip the geofence check)
  analyzePoint(ROME.lat, ROME.lng, false, true);
}
