# Changelog

All notable changes to SunTrace are documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) — [Semantic Versioning](https://semver.org/).

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
