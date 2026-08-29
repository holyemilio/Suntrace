# Changelog

All notable changes to SunTrace are documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) — [Semantic Versioning](https://semver.org/).

---

## [2.7.0] — 2026-08-29

UX mobile: le finestre si chiudono in modo ovvio, e un tutorial al primo avvio.

- 🖱️ **Tap sulla mappa chiude la finestra aperta** — valeva già per i due fogli (Info, Impostazioni) tramite il loro sfondo cliccabile; ora vale anche per i tre widget (☀️ 🌡️ 🧭), che non lo avevano affatto. Il tap si limita a chiudere: non conta anche come "sposta il punto analizzato".
- ✕ **L'icona diventa una X quando la finestra è aperta** — su Info, Impostazioni e i tre widget, per rendere ovvio che è lì che si chiude.
- 👇 **Swipe verso il basso per chiudere il foglio Impostazioni** (e quello Info) — non serve più per forza cliccare fuori; si può anche trascinare giù la maniglia, con un'area toccabile più larga di quella visibile.
- 🎓 **Tutorial al primo avvio** — un anello luminoso evidenzia un controllo alla volta (Impostazioni, piani, i tre widget, Info) con un piccolo popup a fianco che ne spiega la funzione. Compare una sola volta (localStorage), non blocca l'uso dell'app sotto.
- 🏚️ **Tooltip su piano terra e tetto, icona del tetto più chiara** — sostituita l'emoji 🔺 (ambigua, diversa da sistema a sistema) con un'icona a tratto coerente col resto dell'app; entrambi i pulsanti ora mostrano anche un tooltip al tocco, non solo passando il mouse.

---

## [2.6.2] — 2026-08-28

Rotazione libera della bussola, e il tetto come vera e propria superficie.

- 🎚️ **Bussola: rotazione libera, senza scatto a 45°** — il modello sotto lavora già in gradi esatti; trascinare il quadrante ora ruota grado per grado invece di agganciarsi al punto cardinale più vicino. Gli 8 pulsanti restano per chi vuole un punto esatto con un tap.
- 🏚️ **Il 5° piano è il tetto** — non più "una parete a 15m", ma una superficie orizzontale senza un lato a cui rivolgersi: il guadagno solare dipende solo da quanto è alto il sole, mai dall'orientamento. La bussola si disattiva (visivamente e all'input) quando il tetto è selezionato, la linea di facciata sparisce dalla mappa, e il pulsante cambia icona (🔺, tooltip "Tetto").

---

## [2.6.1] — 2026-08-28

Mobile: pinch-zoom libero, bussola in un widget, lingua fuori dalla fascia bassa.

- 🔍 **Pinch-zoom ovunque sulla mappa** — rimossa la gesture a due dita sul marker: intercettava qualunque pinch entro ~70px dal punto analizzato, rendendo impossibile zoomare "dentro il cerchio". Ora due dita zoomano sempre, come ci si aspetta.
- 🧭 **Bussola nel widget mobile** — la rotazione della facciata su mobile ora ha un controllo esplicito: un terzo widget (🧭, sotto ☀️ e 🌡️) apre lo stesso quadrante del desktop — tocca una delle 8 direzioni o trascina l'ago (i Pointer Events funzionano al tocco). Sostituisce la gesture nascosta, che nessuno poteva scoprire.
- ☝️ **Widget mutuamente esclusivi** — aprire uno dei tre widget (sole, clima, bussola) chiude gli altri: i pannelli espansi non si accavallano più tra loro né coprono la mappa.
- 🌐 **Selettore IT/EN in alto a sinistra** — la fascia in basso era affollata (barra temperature, pulsante Imposta, widget): il selettore lingua si sposta nella colonna in alto a sinistra, sotto i pulsanti di geolocalizzazione e Info, dove non si sovrappone a nulla.

---

## [2.6.0] — 2026-08-28

Layout mobile per il simulatore, e prima esecuzione reale della CI.

- 📱 **Layout mobile per `app.html`** — sotto i 768px la sidebar non è più bloccata: il suo contenuto si sposta in una barra inferiore persistente (le 4 temperature stagionali + il Comfort Rate), un drawer "Impostazioni" (ricerca, mese/ora, infissi/isolamento), un foglio "Info" unico che unisce legenda e suggerimento, e due widget a comparsa per i dati solari e il clima. Il blocco totale ora scatta solo sotto i 320px.
- 🤏 **Bussola sostituita da gesture su mobile** — un dito sul marker lo sposta (già gestito da Leaflet), due dita lo ruotano con lo stesso scatto ai punti cardinali della bussola desktop.
- 🧭 **Bussola desktop trascinabile** — oltre ai pulsanti, si può trascinare il quadrante per ruotare la facciata, con scatto automatico ogni 45°.
- 🎯 **Marker centrato correttamente** — il pallino visibile non era centrato nella propria icona: ombra, raggio solare e linea di facciata sembravano partire dal bordo invece che dal centro esatto.
- ✅ **CI verde alla prima esecuzione reale** — girata per la prima volta dopo l'introduzione della pipeline, ha trovato: uno script `npm test`/`test:e2e` con un glob non espandibile da Node 20 (va tolta la virgoletta, la espande la shell); tre test e2e rimasti agganciati a elementi rimossi in una modifica precedente (`#telemetry-cardinal`, `#val-manual-obs`, `#compass-state`); un `z-index` mancante sul pulsante di chiusura del modale Comfort Rate, che un titolo abbastanza lungo poteva coprire rendendolo non cliccabile.

---

## [2.5.0] — 2026-08-27

Infrastruttura: CI, self-hosting delle risorse esterne e cache Overpass pronta al deploy.

- ⚙️ **CI su GitHub Actions** (`.github/workflows/ci.yml`) — su ogni push e PR girano i 60 unit test, il controllo di parità i18n IT/EN (prima era un one-liner manuale) e i 22 e2e Playwright.
- 🔐 **Font e Leaflet self-hostati** (`vendor/`) — Space Grotesk, IBM Plex Mono e Leaflet 1.9.4 (hash sha256 verificato contro leafletjs.com) sono ora serviti dal sito stesso: nessuna richiesta dei visitatori raggiunge più Google Fonts o unpkg (privacy GDPR + niente rischio supply-chain da CDN). Privacy policy aggiornata in entrambe le lingue.
- 🚀 **Edge cache Overpass pronta al deploy** (`server/overpass-cache/`) — Cloudflare Worker con cache KV a 30 giorni davanti ai tre mirror Overpass; disattivata finché `OVERPASS_PROXY_URL` in `ui.js` resta vuota, e anche da attiva i mirror diretti restano come fallback. Istruzioni di deploy nel README della cartella.
- 📐 **Query Overpass canoniche** — le coordinate nella query sono arrotondate a 4 decimali (~11 m, stessa tolleranza della cache in localStorage), così click vicini producono query identiche e condivisibili dalla cache.

---

## [2.4.0] — 2026-08-27

Landing page, deploy live e pulizia dei pannelli sulla mappa.

- 🏠 **Landing page** (`index.html`) — nuova pagina di missione/vision con hero animato (cielo stellato, sole pulsante, arco solare), 4 sezioni "Perché SunTrace" con mini-grafici SVG che si disegnano allo scroll, e una CTA finale. Il simulatore vero e proprio è ora su `app.html`, raggiungibile dalla ricerca in home (che porta con sé l'indirizzo cercato) o dal pulsante "Inizia ora"; un link «← Home» in `app.html` torna alla landing.
- 🌍 **Deploy live** — pubblicato su GitHub Pages: <https://holyemilio.github.io/Suntrace/>.
- 🗺️ **Legenda e suggerimento comprimibili** — sulla mappa, entrambi ora collassano in un bottone 42×42 (stessa misura del pulsante di geolocalizzazione) con un'animazione fluida, invece di restare sempre aperti a occupare spazio.
- ✂️ **Suggerimento più corto e leggibile** — il testo copriva troppo spazio sulla mappa; ora è più breve, con caratteri più grandi e più chiari.
- 🧭 **Bussola pulita** — rimosso il testo di stato sotto la bussola, che ripeteva l'informazione già presente in sidebar ("Sole diretto").
- 🐛 **Corretto** — il box "Temperature" si comprimeva a una striscia di pochi pixel quando il contenuto della sidebar superava l'altezza della finestra (era l'unica card con `overflow: hidden`, su cui il flexbox scaricava tutto il ridimensionamento).
- 🧱 **Riordino sidebar** — Ricerca → Temperature → Crono-Solare → Facciata → Dati Solari, con i titoli dei box rimossi e i parametri di orientamento/schermatura (calcolati ma non editabili) tolti dalla vista.

---

## [2.3.0] — 2026-08-27

Nuovo Brand Icon, Arco Solare Dinamico e Restyling UI Bento.

- 🎨 **Nuovo Brand Icon SunTrace** — icona vettoriale ad alta definizione con sole dorato, arco di traiettoria, facciata architettonica con finestra illuminata e cuneo d'ombra (`docs/app-icon.svg`, `docs/logo.svg`, favicon e logo header).
- ☀️ **Widget "Dati Solari" con Arco Traiettoria (Sky Dome)** — sostituita la barra lineare con un arco parabolico dinamico in SVG: un globo solare luminoso si muove in tempo reale lungo la traiettoria celeste tra alba (🌅) e tramonto (🌇).
- 📊 **Griglia Telemetrica Bento** — per elevazione solare, azimut e stato del sole diretto con pillole glassmorphism ad alto contrasto.
- 📐 **Allineamento Verticale Hero** — centratura verticale del box Estimate / Coordinate (`.hero-top`) per una migliore pulizia visiva.
- 🗺️ **Mappa Chiara ad Alto Contrasto** — tiles chiare e nitide per la massima leggibilità geometrica di ombre e orientamenti.

---

## [2.2.0] — 2026-08-26

Interfaccia rinnovata, mappa leggibile e dati climatici in evidenza.

- 🗺️ **Mappa gratuita e leggibile** — passaggio a OpenStreetMap: CARTO ha iniziato a marchiare ogni stile con "API KEY REQUIRED".
- 🧭 **Bussola sulla mappa** — scegli la parete fra le 8 direzioni; l'ago indica la facciata, il ☀ dove sta il sole, e sotto leggi se lo riceve. Sostituisce il cursore "Rotazione parete".
- 🌡️ **Clima del luogo nella sidebar** — umidità, vento, pioggia e temperatura percepita del mese scelto, dai dati reali del punto.
- 🏠 **Selettori più compatti** — infissi e muri come tre icone su una riga, col nome che appare passandoci sopra. Il terzo livello del muro ora si chiama "Casa Passiva".
- ✍️ **Tipografia** — Space Grotesk per il testo, IBM Plex Mono per i numeri.
- 💡 **Promemoria sul posizionamento** — sulla mappa: il punto va messo in linea con il muro, né dentro né fuori.
- 🐛 **Corretto** — con la finestra stretta (o con lo zoom del browser) sparivano tutti i controlli senza spiegazione.
- 🐛 **Corretto** — Città del Vaticano e San Marino venivano respinti come "estero".
- 🛟 **Errori visibili** — un guasto imprevisto ora compare come avviso invece di lasciare la pagina muta; `start.command` non fa più cachare il browser.
- ✅ **Test** — da 23 a **60 unit + 22 end-to-end** eseguiti in un browser vero.

---

## [2.1.0] — 2026-07-15

Grande aggiornamento: dati reali, nuova interfaccia e app bilingue.

- 🌍 **Dati reali per ogni luogo** — temperatura, umidità, vento e pioggia veri del punto scelto (non più solo Roma).
- 🌡️ **Temperatura percepita** — l'afa d'estate e il freddo ventoso d'inverno ora influenzano il giudizio di comfort.
- 🏢 **Orientamento e ombreggiamento veri** — presi dagli edifici reali della zona: basta valori casuali.
- 🇮🇹 **Solo territorio italiano** — se clicchi all'estero o in mare, l'app te lo dice e ti riporta a Roma.
- 🔎 **Ricerca indirizzo in cima** — con suggerimenti mentre scrivi; la ricerca parte col tasto «Vai».
- 🌐 **App bilingue Italiano / English** — con selettore sulla mappa; rileva da sola la lingua del browser.
- 🖤 **Nuova interfaccia scura** in stile "strumento" — più moderna e leggibile.
- 🗺️ **Mappa migliore** — puntatore più pulito, legenda che spiega i simboli, uno zoom in più.
- 💬 **Spiegazioni al passaggio del mouse** su dati solari, orientamento e schermatura.
- 🧹 **Rimosso** il grafico "Ore di sole" (poco chiaro): l'informazione è ora dentro il Comfort Rate.
- 🚀 **Avvio più semplice** con `start.command` (l'app va aperta da server locale, non col doppio click).

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
