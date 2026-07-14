<p align="center">
  <img src="docs/logo.svg" alt="SunTrace" width="260">
</p>

<p align="center"><a href="README.md">Italiano</a> · <strong>English</strong></p>

# SunTrace — Urban Microclimate Simulator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-23%20pass-brightgreen)]()
[![Engine](https://img.shields.io/badge/solar%20engine-Meeus%20%2F%20SPA-blue)]()

**SunTrace** is an urban microclimate simulator that analyses the solar exposure of facades and rooms anywhere in Italy. Pick a point on the map, choose a month and hour, and get in real time: an accurate solar position (Meeus/SPA), real local climate normals (Open-Meteo), a seasonal thermal estimate and a star-based **Comfort Rate** with tips. Bilingual **IT/EN** interface.

## 🌐 Live Demo

> **[suntrace.io](https://your-username.github.io/suntrace/)** ← update with your GitHub Pages URL

![Screenshot placeholder](docs/screenshot.png)

---

## ✨ Features

| Feature | Detail |
|---|---|
| **Meeus/SPA solar engine** | Declination, Equation of Time, atmospheric refraction (Bennet). Error < 0.5° on elevation and azimuth vs SunCalc. |
| **Accurate sunrise / sunset** | Computed with the −0.833° depression angle (refraction + solar disc). |
| **Time zone + DST** | Uses `Intl.DateTimeFormat / Europe/Rome` — no hardcoded offset. |
| **Real climate data (Open-Meteo)** | 1991–2020 monthly normals for the clicked point, cached in `localStorage`, with a Rome fallback. |
| **Atmospheric factors** | Real humidity and wind → a *feels-like* temperature in the Comfort Rate; humidity and annual rainfall in the detail. |
| **Comfort Rate** | 5-star index (orientation, sun, obstructions, glazing, insulation) with a detail view, sun exposure and tips. |
| **Seasonal thermal estimate** | Sinusoidal diurnal cycle with solar gain on the facade; modifiers for glazing and insulation. |
| **Italy geofencing** | Reverse geocoding distinguishes Italian land, national waters and abroad, each with its own message. |
| **Real orientation (OSM)** | Facade and obstruction derived from nearby OpenStreetMap buildings (Overpass), cached, with a neutral fallback. |
| **Bilingual IT/EN** | In-app switcher, automatic browser-language detection, remembered choice. |
| **Nominatim autocomplete** | 420 ms debounce, restricted to Italy; search runs only via the “Go” button. |
| **Geolocation** | Specific error messages for PERMISSION_DENIED / POSITION_UNAVAILABLE / TIMEOUT. |
| **Zero runtime dependencies** | Only Leaflet (CDN) + public APIs (Nominatim, Open-Meteo). No bundler. |
| **23 unit tests** | Native `node --test`, SunCalc oracle, DST + leap-year + edge-case coverage. |

---

## 🔬 Algorithms

### Solar engine (`src/solar.js`)

Based on **Meeus, "Astronomical Algorithms" 2nd ed. (1998), ch. 25–27**:

1. **Sun's mean longitude** `L₀ = 280.46646 + 36000.76983·T`
2. **Mean anomaly** `M` and **equation of the centre** `C`
3. **Apparent longitude** with nutation correction (`ω = 125.04 − 1934.136·T`)
4. **Obliquity of the ecliptic** `ε` → **declination** `δ = arcsin(sin ε · sin λ_app)`
5. **Equation of time** `E` (5-term formula, ~0.5" precision)
6. **Hour angle** `HA = 15·(TST − 12)`, where `TST = UTC + lon/15 + E/60`
7. **Elevation** with **atmospheric refraction** (Bennet formula)
8. **Azimuth** with the correct formula `cos Az = (sin δ − sin elev·sin lat)/(cos elev·cos lat)`

**Accuracy target**: < 0.5° on elevation, < 1° on azimuth — verified against SunCalc across 23 test cases.

---

## 🚀 How to run

> ⚠️ **Do not open `index.html` by double-clicking it.** The app uses ES modules
> (`<script type="module">`), geolocation and calls to external APIs — all of
> which the browser **blocks** under `file://`. Opened directly, the app looks
> "dead" (buttons and search don't respond). You need a local server on
> `http://localhost`.

**Easiest way (macOS):** double-click **`start.command`**. It starts a local
server and opens the browser on the right page. To stop it, press `Ctrl+C` in
the Terminal window that opens.

**In VSCode:** install the *Live Server* extension, then right-click
`index.html` → **"Open with Live Server"**.

**From a terminal:**

```bash
cd "SunTrace"
python3 -m http.server 8000
# then open http://localhost:8000
```

---

## 🧪 Tests

```bash
# Install suncalc (test-only devDependency)
npm install

# Run the 23 unit tests (Node 18+)
npm test
# or: node --test tests/solar.test.js
```

**Expected output**: 23 pass, 0 fail.

---

## 🌍 Deploy to GitHub Pages

1. Go to **Settings → Pages** in your repository
2. Source: **Deploy from a branch** → `main` → `/` (root)
3. Save and wait ~60 seconds
4. Update the "Live Demo" link in this README with your `https://username.github.io/suntrace/` URL

---

## 📁 Structure

```
SunTrace/
├── index.html          # Full app (entry point)
├── src/
│   ├── solar.js        # Pure astronomical engine (Meeus/SPA) — no DOM
│   ├── climate.js      # Seasonal thermal model and Comfort Rate
│   ├── ui.js           # UI logic, Leaflet, modal, geofencing
│   ├── i18n.js         # IT/EN dictionary and translation engine
│   └── styles.css      # Styles (mobile-first, WCAG AA)
├── tests/
│   └── solar.test.js   # 23 unit tests (node --test, SunCalc oracle)
├── docs/
│   └── case-study.md   # Technical case study
├── README.md           # Italian
├── README.en.md        # English
├── CHANGELOG.md
├── LICENSE             # MIT
├── .gitignore
└── package.json
```

---

## 🏗 How it was built

SunTrace is designed to be **zero-dependency** and **deployable with no build step**. The code is split into native ES modules (`type="module"`) imported directly from the HTML.

The astronomical engine (`solar.js`) is entirely **pure** (no DOM access, no globals), which makes it:
- Testable with `node --test`, no browser required
- Reusable in other contexts (workers, server-side)

The interface uses Leaflet (CDN) for the map and the public Nominatim API for geocoding, honouring its [usage policy](https://operations.osmfoundation.org/policies/nominatim/) with a ≥ 420 ms debounce and `countrycodes=it`.

---

## ⚠️ Limitations

- Temperatures use the **real climate normals** of the selected point (Open-Meteo, 1991–2020), with the Rome table only as an offline *fallback* on network errors. The building's thermal model is however **heuristic** and is not a certified energy performance assessment (APE).
- Facade orientation and solar obstruction are **derived from real OpenStreetMap buildings** (via Overpass): orientation from the nearest wall, obstruction from the density/height of surrounding buildings. With no OSM data or network, a neutral default is used (South, no obstruction).
- The model does not include: thermal mass, infiltration, internal gains, thermal bridges.

---

## 📄 License

MIT © 2026 SunTrace. See [LICENSE](LICENSE).
