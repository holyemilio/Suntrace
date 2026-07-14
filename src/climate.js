/**
 * climate.js — Empirical thermal model for urban microclimate simulation.
 * All temperature estimates are heuristic approximations calibrated on Italian climate data.
 * No DOM dependency.
 */

// ─── climate data tables ─────────────────────────────────────────────────────

// Monthly mean temperatures for Rome (41.9°N), degrees Celsius
const BASE_TEMPS_ROME = [7.5, 8.5, 11.5, 15.0, 19.5, 24.0, 26.5, 26.5, 22.5, 17.0, 12.0, 8.0];

// Daily temperature range (max−min) per month, Rome
const DIURNAL_RANGE_ROME = [6.0, 7.0, 8.5, 10.0, 11.0, 11.5, 11.5, 11.5, 9.5, 8.5, 6.5, 5.5];

// Clear-sky solar irradiance proxy (0–10 scale) per month, calibrated on Italian insolation
const SOLAR_POWER = [1.2, 2.0, 4.2, 6.5, 8.5, 9.8, 10.0, 8.8, 6.5, 4.0, 2.0, 1.0];

// Reference latitude for the tables above
const LAT_ROME = 41.9;

// ─── Comfort Rate colors keyed by star count (5 best → 1 worst) ───────────────
const STAR_COLORS = { 5: '#15803d', 4: '#16a34a', 3: '#ca8a04', 2: '#ea580c', 1: '#dc2626' };

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Estimated outdoor air temperature.
 * Sinusoidal diurnal cycle: minimum near 06:00 local, maximum near 14:00 local.
 *
 * @param {number} month      — 0-based month index
 * @param {number} localHour  — decimal hour in local time (0–23)
 * @param {number} lat        — latitude (scales mean temperature)
 * @returns {number} °C
 */
export function airTemperature(month, localHour, lat, customBaseTemps = null) {
  const baseTemps = customBaseTemps || BASE_TEMPS_ROME;
  const latAdj = customBaseTemps ? 0 : (LAT_ROME - lat) * 0.5;
  const mean = baseTemps[month] + latAdj;
  const range = DIURNAL_RANGE_ROME[month];
  // cos with max at 14:00, min at 02:00 (half-period = 12 h)
  const diurnal = (range / 2) * Math.cos(((localHour - 14) * Math.PI) / 12);
  return mean + diurnal;
}

/**
 * Solar thermal gain added to air temperature for a wall receiving direct sun.
 *
 * @param {number} month          — 0-based
 * @param {number} irradianceCoeff — facade irradiance coefficient 0..1 (from solar.facadeIrradiance)
 * @param {number} obstructionK   — obstruction factor 0..1 (1 = fully exposed, 0.22 = heavy shade)
 * @returns {number} °C delta
 */
export function solarThermalGain(month, irradianceCoeff, obstructionK) {
  return SOLAR_POWER[month] * 0.7 * irradianceCoeff * obstructionK;
}

/**
 * Seasonal (representative month, solar noon) analysis for the current facade orientation.
 * Returns temperature estimate for each season.
 *
 * @param {Function} getSolarPos — (month) => { elevation, azimuth }
 * @param {number}   facadeAz   — facade azimuth (degrees)
 * @param {number}   lat        — latitude
 * @param {number}   obstrK     — obstruction factor
 * @returns {{ winter: number, spring: number, summer: number, autumn: number }}
 */
export function seasonalTemperatures(getSolarPos, facadeAz, lat, obstrK, customBaseTemps = null, windowsType = 'double', insulationType = 'none') {
  const SEASONS = [
    { key: 'winter', month: 0,  noonHour: 12 },  // January (worst winter)
    { key: 'spring', month: 3,  noonHour: 12 },  // April
    { key: 'summer', month: 6,  noonHour: 12 },  // July (worst summer)
    { key: 'autumn', month: 9,  noonHour: 12 },  // October
  ];

  const result = {};
  for (const s of SEASONS) {
    const { elevation, azimuth } = getSolarPos(s.month);
    const elev = Math.max(0, elevation);
    const irr = elev > 0
      ? Math.max(0, Math.cos(elev * Math.PI / 180) * Math.cos((azimuth - facadeAz) * Math.PI / 180))
      : 0;
    
    let temp = airTemperature(s.month, s.noonHour, lat, customBaseTemps);
    let gain = solarThermalGain(s.month, irr, obstrK);
    
    // Windows modifier
    if (windowsType === 'single') {
      gain *= 1.4;
    } else if (windowsType === 'triple') {
      gain *= 0.6;
    }
    
    temp += gain;
    
    // Insulation modifier
    if (insulationType === 'coat') {
      if (s.key === 'winter') temp += 2.5;
      else if (s.key === 'summer') temp -= 2.0;
    } else {
      if (s.key === 'winter') temp -= 1.0;
      else if (s.key === 'summer') temp += 1.0;
    }
    
    result[s.key] = temp;
  }
  return result;
}

/**
 * Derive Comfort Rate rating from seasonal performance metrics and building parameters.
 * Clamps result between 1 and 5 stars.
 *
 * @param {number} winterTemp
 * @param {number} summerTemp
 * @param {number} obstrK
 * @param {string} windowsType
 * @param {string} insulationType
 * @returns {{ stars: number, color: string, tipKey: string }} — label/tip are
 *   i18n keys resolved by the UI layer (comfort-<stars>, tipKey).
 */
export function cozynessScore(winterTemp, summerTemp, obstrK, windowsType = 'double', insulationType = 'none') {
  let score = 5;

  // Winter comfort penalties
  if (winterTemp < 12.0) score -= 2;
  else if (winterTemp < 14.5) score -= 1;

  // Summer comfort penalties
  if (summerTemp >= 30.0) score -= 2;
  else if (summerTemp >= 27.0) score -= 1;

  // Shading / Obstruction penalty
  if (obstrK < 0.3) {
    score -= 1;
  }

  // Windows penalty (vetro singolo is bad)
  if (windowsType === 'single') {
    score -= 1;
  }

  const stars = Math.min(5, Math.max(1, score));
  const color = STAR_COLORS[stars];

  // Dynamic tip (i18n key) based on the weakest link
  let tipKey;
  if (windowsType === 'single') tipKey = 'tip-windows';
  else if (insulationType === 'none') tipKey = 'tip-insulation';
  else if (obstrK < 0.4) tipKey = 'tip-obstruction';
  else tipKey = 'tip-ok';

  return { stars, color, tipKey };
}

/**
 * Obstruction level as an i18n key.
 * @param {number} k
 * @returns {string} 'obs-high' | 'obs-partial' | 'obs-none'
 */
export function obstructionLabel(k) {
  if (k <= 0.25) return 'obs-high';
  if (k <= 0.65) return 'obs-partial';
  return 'obs-none';
}

/**
 * Cardinal direction for a facade azimuth as an i18n key.
 * @param {number} az — degrees 0–359
 * @returns {string} 'card-n' | 'card-ne' | … | 'card-nw'
 */
export function cardinalLabel(az) {
  const norm = ((az % 360) + 360) % 360;
  if (norm < 22.5 || norm >= 337.5) return 'card-n';
  if (norm < 67.5)  return 'card-ne';
  if (norm < 112.5) return 'card-e';
  if (norm < 157.5) return 'card-se';
  if (norm < 202.5) return 'card-s';
  if (norm < 247.5) return 'card-sw';
  if (norm < 292.5) return 'card-w';
  return 'card-nw';
}
