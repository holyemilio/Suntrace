/**
 * solar.js — Pure astronomical engine
 * Based on Meeus "Astronomical Algorithms" 2nd ed. (1998), ch. 25–27
 * No DOM dependency; usable in Node.js for testing.
 *
 * Azimuth convention throughout: 0° = North, 90° = East, 180° = South, 270° = West (clockwise).
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

// ─── low-level helpers ────────────────────────────────────────────────────────

function toRad(d) { return d * DEG; }
function toDeg(r) { return r * RAD; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/** Julian Day Number from a UTC Date object. */
export function julianDay(date) {
  return date.valueOf() / 86400000 + 2440587.5;
}

// ─── core solar parameters (Meeus ch. 25) ────────────────────────────────────

/**
 * Compute solar declination and equation of time for a UTC Date.
 * @returns {{ decl: number, eqTime: number }}
 *   decl    — declination in degrees
 *   eqTime  — equation of time in minutes (positive = sun ahead of mean sun)
 */
function solarParameters(date) {
  const jd = julianDay(date);
  const T = (jd - 2451545.0) / 36525; // Julian centuries from J2000.0

  // Geometric mean longitude of the Sun (degrees, mod 360)
  let L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360;
  if (L0 < 0) L0 += 360;

  // Mean anomaly of the Sun (degrees)
  let M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) % 360;
  if (M < 0) M += 360;

  // Eccentricity of Earth's orbit
  const e = 0.016708634 - 0.000042037 * T;

  // Equation of center
  const Mrad = toRad(M);
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad)
    + 0.000289 * Math.sin(3 * Mrad);

  // Sun's true longitude
  const sunLon = L0 + C;

  // Apparent longitude (nutation + aberration)
  const omega = 125.04 - 1934.136 * T;
  const appLon = sunLon - 0.00569 - 0.00478 * Math.sin(toRad(omega));

  // Mean obliquity of ecliptic (Meeus eq. 22.2)
  const eps0 = 23.439291111
    - 0.013004167 * T
    - 0.00000016389 * T * T
    + 0.0000005036 * T * T * T;
  const eps = eps0 + 0.00256 * Math.cos(toRad(omega));

  // Declination
  const decl = toDeg(Math.asin(clamp(Math.sin(toRad(eps)) * Math.sin(toRad(appLon)), -1, 1)));

  // Equation of time (minutes) — Meeus eq. 28.3
  const y = Math.tan(toRad(eps / 2)) ** 2;
  const eqTime = toDeg(
    y * Math.sin(2 * toRad(L0))
    - 2 * e * Math.sin(Mrad)
    + 4 * e * y * Math.sin(Mrad) * Math.cos(2 * toRad(L0))
    - 0.5 * y * y * Math.sin(4 * toRad(L0))
    - 1.25 * e * e * Math.sin(2 * Mrad)
  ) * 4; // convert degrees → minutes

  return { decl, eqTime };
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Solar position for a UTC Date at given geographic coordinates.
 *
 * @param {Date}   date — UTC Date object
 * @param {number} lat  — latitude in degrees (−90..+90)
 * @param {number} lon  — longitude in degrees (−180..+180, east positive)
 * @returns {{ elevation: number, azimuth: number, declination: number }}
 *   elevation   — degrees above horizon (negative = below, atmospheric refraction applied)
 *   azimuth     — degrees clockwise from North
 *   declination — solar declination in degrees
 */
export function solarPosition(date, lat, lon) {
  const { decl, eqTime } = solarParameters(date);

  // UTC decimal hours
  const utcH = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

  // True Solar Time (hours) = UTC + lon/15 + EqT/60
  const tst = utcH + lon / 15 + eqTime / 60;

  // Hour angle (degrees): 0 at solar noon, negative morning, positive afternoon
  const ha = 15 * (tst - 12);

  const latRad = toRad(lat);
  const declRad = toRad(decl);
  const haRad = toRad(ha);

  // Elevation (altitude)
  const sinElev = Math.sin(declRad) * Math.sin(latRad)
    + Math.cos(declRad) * Math.cos(latRad) * Math.cos(haRad);
  let elev = toDeg(Math.asin(clamp(sinElev, -1, 1)));

  // Atmospheric refraction correction (Bennet formula, accurate to 0.07')
  // Applied only when sun is above −0.575° to avoid singularities
  if (elev > -0.575) {
    const R = 1.02 / (60 * Math.tan(toRad(elev + 10.3 / (elev + 5.11))));
    elev += R;
  }

  // Azimuth (clockwise from North, 0–360°)
  const elevRad = toRad(elev);
  const cosAz = (Math.sin(declRad) - Math.sin(elevRad) * Math.sin(latRad))
    / (Math.cos(elevRad) * Math.cos(latRad));
  let az = toDeg(Math.acos(clamp(cosAz, -1, 1)));
  // ha > 0 → afternoon → sun west of south → az > 180
  if (ha > 0) az = 360 - az;

  return { elevation: elev, azimuth: az, declination: decl };
}

/**
 * Sunrise and sunset times for a given UTC date and location.
 * Uses standard solar depression of −0.833° (accounts for refraction + solar disc).
 *
 * @param {Date}   date — any UTC Date within the desired calendar day
 * @param {number} lat
 * @param {number} lon
 * @returns {{ sunrise: Date|null, sunset: Date|null, dayLength: number }}
 *   sunrise/sunset are UTC Date objects; null during polar day/night.
 *   dayLength is in decimal hours.
 */
export function sunriseSunset(date, lat, lon) {
  const { decl, eqTime } = solarParameters(date);

  const cosHa = (Math.sin(toRad(-0.833)) - Math.sin(toRad(lat)) * Math.sin(toRad(decl)))
    / (Math.cos(toRad(lat)) * Math.cos(toRad(decl)));

  if (cosHa < -1) {
    // Polar day: sun never sets
    return { sunrise: null, sunset: null, dayLength: 24 };
  }
  if (cosHa > 1) {
    // Polar night: sun never rises
    return { sunrise: null, sunset: null, dayLength: 0 };
  }

  const haDeg = toDeg(Math.acos(cosHa)); // sunrise hour angle (degrees)

  // UTC of solar noon for this date
  const solarNoonUTC = 12 - lon / 15 - eqTime / 60; // hours

  const sunriseUTC = solarNoonUTC - haDeg / 15;
  const sunsetUTC  = solarNoonUTC + haDeg / 15;

  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const sunrise  = new Date(midnight + sunriseUTC * 3600000);
  const sunset   = new Date(midnight + sunsetUTC  * 3600000);

  return { sunrise, sunset, dayLength: haDeg / 7.5 }; // 2*haDeg/15
}

/**
 * Irradiance coefficient (0–1) on a vertical facade.
 * Returns the fraction of direct normal irradiance hitting the facade surface.
 *
 * Derivation: sun unit vector · facade normal = cos(elev)*cos(sunAz − facadeAz).
 *
 * @param {number} elevation      — solar elevation in degrees
 * @param {number} solarAzimuth   — solar azimuth in degrees (0=N, 90=E, 180=S, 270=W)
 * @param {number} facadeAzimuth  — direction facade faces, same convention
 * @returns {number} 0..1
 */
export function facadeIrradiance(elevation, solarAzimuth, facadeAzimuth) {
  if (elevation <= 0) return 0;
  return Math.max(0,
    Math.cos(toRad(elevation)) * Math.cos(toRad(solarAzimuth - facadeAzimuth))
  );
}

/**
 * Hours of direct sun received by a vertical facade on a given day.
 * Samples every 10 minutes; threshold 0.01 to exclude grazing rays.
 *
 * @param {Date}   date
 * @param {number} lat
 * @param {number} lon
 * @param {number} facadeAzimuth
 * @returns {number} hours of direct sun (0..~14)
 */
export function dailySunHours(date, lat, lon, facadeAzimuth) {
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const STEP_MIN = 10;
  let count = 0;
  for (let m = 0; m < 1440; m += STEP_MIN) {
    const t = new Date(midnight + m * 60000);
    const { elevation, azimuth } = solarPosition(t, lat, lon);
    if (facadeIrradiance(elevation, azimuth, facadeAzimuth) > 0.01) count++;
  }
  return count * STEP_MIN / 60;
}

/**
 * Sun hours for all 8 cardinal/intercardinal facades on four sample days
 * (spring equinox, summer solstice, autumn equinox, winter solstice).
 *
 * @param {number} year
 * @param {number} lat
 * @param {number} lon
 * @returns {Array<{ label: string, azimuth: number, hours: { spring, summer, autumn, winter, avg } }>}
 */
export function annualFacadeSunHours(year, lat, lon) {
  const days = {
    spring: new Date(Date.UTC(year, 2, 20)),   // ~spring equinox
    summer: new Date(Date.UTC(year, 5, 21)),   // summer solstice
    autumn: new Date(Date.UTC(year, 8, 22)),   // ~autumn equinox
    winter: new Date(Date.UTC(year, 11, 21)),  // winter solstice
  };

  const facades = [
    { label: 'N',  azimuth: 0   },
    { label: 'NE', azimuth: 45  },
    { label: 'E',  azimuth: 90  },
    { label: 'SE', azimuth: 135 },
    { label: 'S',  azimuth: 180 },
    { label: 'SW', azimuth: 225 },
    { label: 'W',  azimuth: 270 },
    { label: 'NW', azimuth: 315 },
  ];

  return facades.map(f => {
    const h = {};
    for (const [season, d] of Object.entries(days)) {
      h[season] = dailySunHours(d, lat, lon, f.azimuth);
    }
    h.avg = (h.spring + h.summer + h.autumn + h.winter) / 4;
    return { ...f, hours: h };
  });
}

/**
 * Convert a local wall-clock time (as used in the UI) to a UTC Date.
 * Uses Intl.DateTimeFormat to determine the real UTC offset (handles DST correctly).
 *
 * @param {number} year
 * @param {number} month      — 0-based (JS convention)
 * @param {number} day
 * @param {number} localHour  — integer 0–23 in the given timezone
 * @param {string} timeZone   — IANA timezone name, e.g. 'Europe/Rome'
 * @returns {Date}
 */
export function localToUTC(year, month, day, localHour, timeZone = 'Europe/Rome') {
  // Sample at noon UTC to find the offset for this calendar day
  // (avoids DST-boundary edge cases that occur in the early hours)
  const noonUTC = new Date(Date.UTC(year, month, day, 12, 0, 0));
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(noonUTC);

  const localNoonH = Number(parts.find(p => p.type === 'hour').value);
  const localNoonM = Number(parts.find(p => p.type === 'minute').value);
  // Offset in hours: local_noon - UTC_noon (12)
  const offsetH = (localNoonH - 12) + localNoonM / 60;

  const utcH = localHour - offsetH;
  return new Date(Date.UTC(year, month, day, utcH, 0, 0));
}

/**
 * Azimuth-to-map displacement helper: converts an azimuth direction and a
 * "degree-scale" distance into a [lat, lng] offset suitable for Leaflet.
 * Corrects for longitude shrinkage at higher latitudes.
 *
 * @param {number} baseLat
 * @param {number} baseLng
 * @param {number} azimuthDeg  — direction (0=N, 90=E, …)
 * @param {number} distDeg     — angular distance (in degrees of latitude)
 * @returns {[number, number]} [lat, lng]
 */
export function offsetByAzimuth(baseLat, baseLng, azimuthDeg, distDeg) {
  const az = toRad(azimuthDeg);
  const dLat = distDeg * Math.cos(az);
  const dLng = distDeg * Math.sin(az) / Math.cos(toRad(baseLat));
  return [baseLat + dLat, baseLng + dLng];
}
