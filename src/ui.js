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
  annualFacadeSunHours,
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

// ─── constants ────────────────────────────────────────────────────────────────

const MONTHS_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

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

// ─── state ────────────────────────────────────────────────────────────────────

let map = null;
let targetMarker = null;
let radarCircle = null;
let facadeLine = null;
let shadowPolygon = null;
let sunRay = null;
let errorTimeout = null;
let autocompleteTimeout = null;
let facadeChartMode = 'today'; // 'today' | 'annual'
let customBaseTemps = null; // 12 monthly means from Open-Meteo; null = fallback to climate.js Rome table
let lastAnalysis = null; // { seasonal, comfort } from the latest refreshUI(), read by openKPIModal()

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
  map = L.map('map', { zoomControl: false }).setView([41.9028, 12.4964], 17);
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    { attribution: '©<a href="https://openstreetmap.org">OSM</a> ©<a href="https://carto.com">CARTO</a>' }
  ).addTo(map);

  map.on('click', e => analyzePoint(e.latlng.lat, e.latlng.lng, false));
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

function isOutsideItaly(lat, lng) {
  return lat < ITALY_BOUNDS.latMin || lat > ITALY_BOUNDS.latMax
      || lng < ITALY_BOUNDS.lonMin || lng > ITALY_BOUNDS.lonMax;
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
function analyzePoint(lat, lng, isDrag = false) {
  // Update coordinates display
  setText('coord-lat', lat.toFixed(5) + '°N');
  setText('coord-lng', lng.toFixed(5) + '°E');

  // Place or move marker
  if (!targetMarker) {
    targetMarker = L.marker([lat, lng], { draggable: true }).addTo(map);
    targetMarker.on('dragend', e => {
      const p = e.target.getLatLng();
      analyzePoint(p.lat, p.lng, true);
    });
  } else if (!isDrag) {
    targetMarker.setLatLng([lat, lng]);
  }

  // Derive obstruction and default angle from coordinate seed (heuristic — no real GIS data)
  const seed = Math.abs(Math.sin(lat * 1000) * Math.cos(lng * 1000));
  const seedAngle = Math.round((seed * 360) % 360);
  const seedDensity = (seed * 10) % 3;
  let kOmbra = 1.0;
  if (seedDensity > 2.0) kOmbra = 0.22;
  else if (seedDensity > 1.0) kOmbra = 0.60;

  // Preserve manual angle adjustment when user drags marker; reset on fresh click
  const angleDeg = (isDrag && currentScan.userAdjusted)
    ? currentScan.angleDeg
    : seedAngle;

  currentScan = { lat, lng, angleDeg, kOmbra, userAdjusted: false };
  customBaseTemps = null; // reset to Rome fallback; upgraded async below if the fetch succeeds

  if (!isDrag) {
    $('manual-angle-slider').value = angleDeg;
  }

  refreshUI();

  if (isOutsideItaly(lat, lng)) {
    showToast(
      'Ops! Ci hai scoperto... 🕵️‍♂️\nSunTrace è attivo solo sul territorio italiano (isole comprese!). Ti abbiamo riposizionato su Roma.',
      'warn', 10000
    );
    analyzePoint(41.9028, 12.4964, false);
    return;
  }

  fetchClimateNormals(lat, lng)
    .then(monthly => {
      if (currentScan.lat === lat && currentScan.lng === lng) {
        customBaseTemps = monthly;
        refreshUI();
      }
    })
    .catch(() => { /* silent fallback — Rome table already in effect */ });
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
  setText('main-output-title', `Stima ${MONTHS_IT[month]}, ${localHour}:00`);

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
  setText('comfort-rate-stars', '⭐'.repeat(comfort.stars));
  setText('comfort-rate-label', comfort.label);
  const badge = $('energy-class-field');
  if (badge) {
    badge.style.backgroundColor = comfort.color;
    badge.dataset.stars = String(comfort.stars);
    badge.dataset.label = comfort.label;
  }
  lastAnalysis = { seasonal, comfort };

  // Solar info
  setText('val-sunrise', fmt(sunrise));
  setText('val-sunset', fmt(sunset));
  setText('val-day-length', dayLength > 0 ? `${dayLength.toFixed(1)}h` : '--');
  setText('val-sun-elevation', elevClamped > 0 ? `${elevation.toFixed(1)}°` : '< orizzonte');
  setText('val-sun-azimuth', `${azimuth.toFixed(0)}°`);

  // Facade info
  setText('val-manual-angle', `${angleDeg}°`);
  setText('val-manual-obs', obstructionLabel(kOmbra));
  setText('telemetry-cardinal', `${angleDeg}° (${cardinalLabel(angleDeg)})`);

  // Sun hours chart
  updateFacadeChart(lat, lng, utcDate, angleDeg);

  // Map overlays
  renderMapOverlays(lat, lng, elevation, azimuth, angleDeg);
}

// ─── facade sun-hours chart ───────────────────────────────────────────────────

let lastChartData = null;

function updateFacadeChart(lat, lng, utcDate, highlightAz) {
  const year = utcDate.getUTCFullYear();

  if (facadeChartMode === 'today') {
    const facades = [0, 45, 90, 135, 180, 225, 270, 315].map(az => ({
      label: ['N','NE','E','SE','S','SW','W','NW'][[0,45,90,135,180,225,270,315].indexOf(az)],
      azimuth: az,
      hours: dailySunHours(utcDate, lat, lng, az),
    }));
    lastChartData = { facades, maxH: Math.max(...facades.map(f => f.hours), 1) };
  } else {
    // Annual: compute for 4 sample days and average
    const annual = annualFacadeSunHours(year, lat, lng);
    const facades = annual.map(f => ({ label: f.label, azimuth: f.azimuth, hours: f.hours.avg }));
    lastChartData = { facades, maxH: Math.max(...facades.map(f => f.hours), 1) };
  }

  renderFacadeChart(lastChartData, highlightAz);
}

function renderFacadeChart({ facades, maxH }, highlightAz) {
  const container = $('facade-chart');
  if (!container) return;

  container.innerHTML = '';
  for (const f of facades) {
    const isHighlighted = Math.abs(((f.azimuth - highlightAz + 360) % 360)) < 23;
    const row = document.createElement('div');
    row.className = 'facade-row';
    row.innerHTML = `
      <span class="facade-dir" style="${isHighlighted ? 'color:var(--primary)' : ''}">${f.label}</span>
      <div class="facade-bar-bg">
        <div class="facade-bar-fill" style="width:${(f.hours / maxH * 100).toFixed(1)}%;${isHighlighted ? 'background:var(--orange)' : ''}"></div>
      </div>
      <span class="facade-hours">${f.hours.toFixed(1)}h</span>`;
    container.appendChild(row);
  }
}

// ─── KPI modal ────────────────────────────────────────────────────────────────

function selectedOptionLabel(selectId, fallback) {
  return $(selectId)?.selectedOptions?.[0]?.textContent ?? fallback;
}

function openKPIModal() {
  if (!lastAnalysis) return;
  const { seasonal, comfort } = lastAnalysis;

  setText('modal-class-title', `Analisi Comfort Rate — ${comfort.label}`);
  const classBadge = $('modal-class-badge');
  if (classBadge) {
    classBadge.textContent = `Comfort Rate ${'⭐'.repeat(comfort.stars)}`;
    classBadge.style.backgroundColor = comfort.color;
  }

  setText('kpi-winter-temp', seasonal.winter.toFixed(1) + '°C');
  setText('kpi-summer-temp', seasonal.summer.toFixed(1) + '°C');
  setText('kpi-infissi-selected', selectedOptionLabel('windows-select', '--'));
  setText('kpi-isolamento-selected', selectedOptionLabel('insulation-select', '--'));

  setText('kpi-tip', comfort.tip);
  $('kpi-modal').classList.add('open');
}

function closeKPIModal() {
  $('kpi-modal').classList.remove('open');
}

// ─── time sliders ─────────────────────────────────────────────────────────────

function initSliders() {
  $('month-slider').addEventListener('input', () => {
    setText('month-label', MONTHS_IT[$('month-slider').value]);
    if (currentScan) refreshUI();
  });

  $('hour-slider').addEventListener('input', () => {
    const h = $('hour-slider').value;
    setText('hour-label', `${String(h).padStart(2,'0')}:00`);
    if (currentScan) refreshUI();
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

// ─── chart tab buttons ────────────────────────────────────────────────────────

function initChartTabs() {
  document.querySelectorAll('.chart-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chart-tab').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      facadeChartMode = btn.dataset.mode;
      if (currentScan) refreshUI();
    });
  });
}

// ─── address search ───────────────────────────────────────────────────────────

function initSearchAutocomplete() {
  const input   = $('search-input');
  const preview = $('autocomplete-preview');

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closePreview(); input.blur(); }
    if (e.key === 'Enter')  { e.preventDefault(); searchAddress(); }
  });

  input.addEventListener('input', () => {
    clearTimeout(autocompleteTimeout);
    const q = input.value.trim();

    if (q.length < 3) { closePreview(); return; }

    autocompleteTimeout = setTimeout(() => fetchSuggestions(q), NOMINATIM_DEBOUNCE_MS);
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !preview.contains(e.target)) closePreview();
  });
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
          input.value = item.display_name;
          closePreview();
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          map.setView([lat, lng], 18);
          analyzePoint(lat, lng, false);
        });
        preview.appendChild(div);
      });
    } else {
      preview.style.display = 'block';
      const empty = document.createElement('div');
      empty.className = 'autocomplete-empty';
      empty.textContent = 'Nessun risultato trovato';
      preview.appendChild(empty);
    }
  } catch (err) {
    preview.style.display = 'block';
    const errDiv = document.createElement('div');
    errDiv.className = 'autocomplete-empty';
    errDiv.textContent = '⚠️ Errore di rete — verifica la connessione';
    preview.appendChild(errDiv);
  } finally {
    input.classList.remove('input-loading');
  }
}

async function searchAddress() {
  const input = $('search-input');
  const query = input.value.trim();
  if (!query) return;

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
      showToast('⚠️ Indirizzo non trovato. Prova con un nome diverso.', 'warn', 7000);
    }
  } catch {
    showToast('⚠️ Errore di rete. Verifica la connessione.', 'error', 8000);
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
    showToast('⚠️ La geolocalizzazione non è supportata dal browser.', 'error', 8000);
    return;
  }

  btn.classList.add('loading');
  icon.textContent = '⟳';

  navigator.geolocation.getCurrentPosition(
    pos => {
      btn.classList.remove('loading', 'denied');
      icon.textContent = '🎯';
      btn.setAttribute('aria-label', 'Rileva la mia posizione geografica');

      const acc = Math.round(pos.coords.accuracy);
      if (acc > 2000) {
        showToast(
          `⚠️ Posizione imprecisa (±${(acc / 1000).toFixed(1)} km).\nPotrebbe essere una stima via IP/VPN. Verifica i Servizi di Localizzazione.`,
          'warn', 15000
        );
      }

      map.setView([pos.coords.latitude, pos.coords.longitude], 18);
      analyzePoint(pos.coords.latitude, pos.coords.longitude, false);
    },
    err => {
      btn.classList.remove('loading');
      btn.classList.add('denied');
      icon.textContent = '🚫';

      let msg = '⚠️ Geolocalizzazione non riuscita.';
      if (err.code === err.PERMISSION_DENIED) {
        msg = '⚠️ Permesso negato.\nSu Mac: Impostazioni → Privacy → Servizi di Localizzazione → abilita il browser.';
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        msg = '⚠️ Posizione non disponibile. Verifica che i Servizi di Localizzazione siano attivi.';
      } else if (err.code === err.TIMEOUT) {
        msg = '⚠️ Timeout: localizzazione troppo lenta. Riprova con una rete Wi-Fi.';
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
    toggle.textContent = sidebar.classList.contains('open') ? '✕ Chiudi' : '☰ Pannello';
  });
}

// ─── app bootstrap ────────────────────────────────────────────────────────────

export function init() {
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
  initChartTabs();
  initSearchAutocomplete();
  initGeolocation();
  initMobileToggle();

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

  // Initial render
  analyzePoint(41.9028, 12.4964, false);
}
