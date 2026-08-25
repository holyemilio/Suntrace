# Changelog

All notable changes to SunTrace are documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) — [Semantic Versioning](https://semver.org/).

---

## [2.1.0] — 2026-07-15

### Added
- **`start.command` launcher** + "Come avviare" docs: the app must be served over `http://localhost` (ES modules, geolocation and external APIs are blocked under `file://`).
- **Precise Italy geofencing** via Nominatim reverse geocoding: distinguishes Italian land (proceed), national waters (dedicated 🌊 message) and abroad ("Ops!" message), each returning to Rome. Replaces the coarse bounding box (kept only as a fast pre-filter).
- **Bilingual IT/EN**: `src/i18n.js` dictionary + engine, in-app language switcher (bottom-left of the map), browser-language auto-detect, choice remembered in `localStorage`; bilingual README (`README.en.md`).
- **OSM building detection** (Overpass): real facade orientation from the nearest building wall's outward normal, and obstruction from local building density/levels; cached in `localStorage`, with a loading pulse and a neutral fallback.
- **Atmospheric factors**: humidity, wind and precipitation normals from Open-Meteo. `apparentTemperature()` (feels-like) feeds winter/summer perceived temperatures into the Comfort Rate (bounded humid-heat / windy-cold penalties, humidity tip). Modal gains a real-climate strip (summer feels-like, average humidity, annual rainfall).
- **Info tooltips** (hover/focus) for Solar data, Orientation and Shading.
- **Map legend** + custom green-dot marker (replacing Leaflet's default pin); max zoom raised 18 → 20.
- **`docs/logo.svg`** shown atop the README.

### Changed
- Address search moved to the top of the sidebar; picking a suggestion only fills the field; search runs solely via the "Vai" button.
- Sun-hours chart removed; sun exposure folded into the Comfort Rate detail as a "good/bad news" line.
- Facade orientation/obstruction now come from real OSM data instead of a pseudo-random coordinate seed; the last known values are kept as provisional while OSM loads (no jump to South).
- `climate.js` returns i18n keys (comfort labels, tips, obstruction, cardinal); `CLASS_COLORS` → `STAR_COLORS` keyed by star count.
- Temperature disclaimer corrected (real per-location normals; Rome only as offline fallback). Climate cache key bumped to `omc_` for the richer normals shape.

### Fixed
- App appeared "dead" when opened via `file://` — documented and solved with the local-server launcher.
- KPI cell text overflowing its rounded border.
- Off-centre emoji on the floating geolocation button; stale footer GitHub link.

### Removed
- "Ore di sole per facciata" chart and its dead JS/CSS.
- Broken "Live Demo" placeholder link and screenshot reference from the README.

---

## [2.0.0] — 2026-07-14

### Added
- **Comfort Rate** replaces "Classe Energetica": 5-star comfort rating with GitHub-style hover tooltip explaining the index meaning. Labels: Eccellente / Buono / Discreto / Scarso / Critico.
- **Property parameters** in sidebar: dropdown selectors for window type (Vetro Singolo, Doppio Vetro, Triplo Vetro) and wall insulation (Nessuno, Cappotto Termico). Both affect seasonal temperature estimates and the Comfort Rate score.
- **Open-Meteo API integration**: real monthly climate normals (1991–2020, EC-Earth3P-HR model) fetched on each map click and cached in `localStorage`. Automatic silent fallback to Rome table on network failure.
- **Italy geofencing**: coordinates outside the Italian bounding box (lat 35.4–47.1 N, lon 6.6–18.6 E, islands included) trigger a friendly toast and redirect to Rome.
- **Mobile block overlay**: on screen width < 768 px or touch device, a full-screen overlay blocks the app and invites the user to switch to a desktop browser.
- **`docs/storyline.md`**: project development narrative (v0.3.3 → v1.0.0 → v2.0.0).
- **`CLAUDE.md` Phase -1 and Phase 0**: critical-stance and model-tier classification rules added upstream.

### Changed
- `energyClass()` in `climate.js` replaced by `cozynessScore()` (name kept in JS; visible label is "Comfort Rate").
- `seasonalTemperatures()` accepts `customBaseTemps`, `windowsType`, and `insulationType` parameters.
- `airTemperature()` accepts optional `customBaseTemps` array (bypasses Rome static table when provided).
- KPI modal redesigned: shows winter/summer comfort temperatures, selected infissi/isolamento type, and dynamic improvement tip. Energy consumption and CO₂ fields removed.
- `CLASS_COLORS` simplified to 5 comfort labels (`Eccellente` → `Critico`).

### Removed
- `KPI_BY_CLASS` table (heating kWh, cooling kWh, cost estimates, CO₂, savingsVsG) — no longer relevant after removing energy-class model.
- Inline `title` attribute on the Comfort Rate badge (replaced by custom CSS tooltip).

---

## [1.0.0] — 2026-07-02

### Added
- **Motore solare Meeus/SPA** (`src/solar.js`): declinazione, equazione del tempo (formula a 5 termini), angolo orario con correzione di longitudine, elevazione, azimut, rifrazione atmosferica Bennet.
- **Calcolo alba/tramonto** con angolo di depressione standard (−0.833°).
- **Fuso orario + ora legale automatici**: `Intl.DateTimeFormat / Europe/Rome` via `localToUTC()` — nessun offset hardcoded.
- **Sezione "Ore di sole per facciata"**: 8 orientamenti (N/NE/E/SE/S/SW/W/NW), con togglee "Oggi" / "Media annuale" (solstizi + equinozi come giorni campione).
- **Modal KPI energetico**: consumo in kWh/m²/anno, costo stimato, CO₂ emessa, risparmio vs classe G, consigli per miglioramento classe.
- **Indicatore coordinate** lat/lon del punto selezionato nel pannello di output.
- **Sezione "Dati Solari"** in sidebar: alba, tramonto, durata del giorno, elevazione, azimut in tempo reale.
- **Layout mobile-first** con sidebar collassabile su schermi < 768px.
- **23 unit test** astronomici (`node --test`, oracle SunCalc): 8 casi Roma, 2 casi Milano, DST, anno bisestile, edge cases.
- **offsetByAzimuth()** con correzione longitudine per proiezione mappa geograficamente corretta.
- **Architettura modulare**: `solar.js` + `climate.js` + `ui.js` + `styles.css` separati.

### Fixed
- **Bug critico**: formula azimut invertita (`sin(elev)·sin(lat) − sin(decl)` → corretto `sin(decl) − sin(elev)·sin(lat)`).
- **Bug critico**: angolo orario senza correzione fuso orario / ora legale (errore fino a ~80 min in estate su Roma).
- **Bug**: `radarCircle` non nullificato dopo `removeLayer` → potenziale crash Leaflet.
- **Bug**: `facadeLine` non nullificata dopo rimozione.
- **Bug**: slider angolo sovrascrive sempre le modifiche manuali dell'utente ad ogni click mappa.
- **Bug**: debounce autocomplete a 350ms (sotto la soglia minima di 400ms) → portato a 420ms.
- **Bug**: `searchAddress` senza feedback UI su errore rete o indirizzo non trovato.
- **Bug**: tasto "Vai" non risponde a Enter nel campo di ricerca.
- **Bug**: ombra mappa con distorsione geometrica (mancava correzione `cos(lat)` per longitudine).

### Changed
- Refactoring da single-file HTML a struttura multi-modulo ES (`src/`).
- `solarPowerFactor` hardcoded → `SOLAR_POWER` in `climate.js`, temperatura base scalata per latitudine.
- Giorno rappresentativo fisso al 15 del mese → date reali per solstizi/equinozi.
- Debounce autocomplete: 350ms → 420ms.
- Limit risultati Nominatim: 4 → 5.
- Sidebar width: 460px → variabile CSS `--sidebar-width: 460px` (overridabile via media query).

### Removed
- Inline `<style>` dall'HTML → tutto in `src/styles.css`.
- Inline `<script>` dall'HTML → tutto in `src/ui.js`.

---

## [0.3.3] — 2026-06-01 (suntrace-old.html)

- Versione precedente single-file con motore Cooper semplificato.
- Nessun calcolo di alba/tramonto.
- Azimut con formula invertita.
- Nessuna gestione fuso orario / ora legale.
