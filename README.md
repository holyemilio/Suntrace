<p align="center">
  <img src="docs/logo.svg" alt="SunTrace" width="260">
</p>

<p align="center"><strong>Italiano</strong> · <a href="README.en.md">English</a></p>

# SunTrace — Simulatore Microclimatico Urbano

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-59%20pass-brightgreen)]()
[![Engine](https://img.shields.io/badge/solar%20engine-Meeus%20%2F%20SPA-blue)]()

**SunTrace** è un simulatore microclimatico urbano che analizza l'esposizione solare di facciate e locali in qualsiasi punto d'Italia. Seleziona un punto sulla mappa, scegli mese e ora, e ottieni in tempo reale: posizione solare corretta (Meeus/SPA), medie climatiche reali del luogo (Open-Meteo), stima termica stagionale e un **Comfort Rate** a stelle con consigli. Interfaccia bilingue **IT/EN**.

---

## ✨ Features

| Feature | Dettaglio |
|---|---|
| **Motore solare Meeus/SPA** | Declinazione, Equazione del Tempo, rifrazione atmosferica (Bennet). Errore < 0.5° su elevazione e azimut rispetto a SunCalc. |
| **Alba / tramonto precisi** | Calcolo con angolo di depressione −0.833° (rifrazione + disco solare). |
| **Fuso orario + ora legale** | Usa `Intl.DateTimeFormat / Europe/Rome` — nessun offset hardcoded. |
| **Dati climatici reali (Open-Meteo)** | Medie mensili 1991–2020 del punto cliccato, cache in `localStorage`, fallback su Roma. |
| **Fattori atmosferici** | Umidità e vento reali → temperatura percepita (*feels-like*) integrata nel Comfort Rate; umidità e pioggia annua nel dettaglio. |
| **Comfort Rate** | Indice a 5 stelle (orientamento, sole, ostruzioni, infissi, isolamento) con dettaglio, esposizione solare e consigli. |
| **Bussola facciata** | Selettore circolare sulla mappa con le 8 direzioni: mostra l'ago della facciata, la posizione del sole e se lo riceve davvero. |
| **Stima termica stagionale** | Ciclo diurno sinusoidale con guadagno solare sulla facciata; modificatori per infissi e isolamento. |
| **Geofencing Italia** | Reverse-geocoding: distingue terraferma IT, acque nazionali ed estero, con messaggi dedicati. |
| **Ombre reali (OSM)** | Facciata dal muro più vicino e ombre calcolate tracciando un raggio verso il sole attraverso gli edifici vicini, dall'altezza del piano scelto. |
| **Bilingue IT/EN** | Selettore in-app, rilevamento automatico della lingua del browser, scelta memorizzata. |
| **Autocomplete Nominatim** | Debounce 420ms, limitato all'Italia; la ricerca parte solo col pulsante «Vai». |
| **Geolocalizzazione** | Messaggi di errore specifici per PERMISSION_DENIED / POSITION_UNAVAILABLE / TIMEOUT. |
| **Zero dipendenze di runtime** | Solo Leaflet (CDN) + API pubbliche e senza chiave: OpenStreetMap (mappa e edifici), Nominatim, Open-Meteo. Nessun bundler. |
| **59 unit test** | `node --test` nativo: motore solare (oracle SunCalc, DST, bisestili), modello termico/Comfort Rate e geometria delle ombre. |

---

## 📖 Documentazione

- **[Manuale Utente](docs/manuale-utente.html)** — come si usa l'app, cosa fa, pulsanti e notifiche (apribile nel browser, stampabile in PDF).
- **[Testbook](docs/testbook.html)** — piano di test in tabella, con esito da compilare, per verificare tutte le funzioni.
- **[Testbook (CSV)](docs/testbook.csv)** — la stessa checklist, scaricabile e apribile in Excel (separatore `;`, UTF-8).

---

## 🔬 Algoritmi

### Motore solare (`src/solar.js`)

Basato su **Meeus, "Astronomical Algorithms" 2nd ed. (1998), cap. 25–27**:

1. **Longitudine media del Sole** `L₀ = 280.46646 + 36000.76983·T`
2. **Anomalia media** `M` ed **equazione del centro** `C`
3. **Longitudine apparente** con correzione di nutazione (`ω = 125.04 − 1934.136·T`)
4. **Obliquità eclittica** `ε` → **declinazione** `δ = arcsin(sin ε · sin λ_app)`
5. **Equazione del tempo** `E` (formula a 5 termini, precisione ~0.5")
6. **Angolo orario** `HA = 15·(TST − 12)`, dove `TST = UTC + lon/15 + E/60`
7. **Elevazione** con **rifrazione atmosferica** (formula di Bennet)
8. **Azimut** con la formula corretta `cos Az = (sin δ − sin elev·sin lat)/(cos elev·cos lat)`

**Target di accuratezza**: < 0.5° su elevazione, < 1° su azimut — verificato contro SunCalc su 23 casi di test.

---

## 🚀 Come avviare

> ⚠️ **Non aprire `index.html` con doppio click.** L'app usa moduli ES
> (`<script type="module">`), la geolocalizzazione e chiamate a API esterne:
> tutte cose che il browser **blocca** in modalità `file://`. Se apri il file
> direttamente, l'app risulta "morta" (pulsanti e ricerca non rispondono).
> Serve un server locale su `http://localhost`.

**Metodo più semplice (macOS):** doppio click su **`start.command`**.
Avvia un server locale e apre il browser sulla pagina giusta. Per fermarlo,
premi `Ctrl+C` nella finestra del Terminale che si apre.

> Il server invia `Cache-Control: no-store`, così dopo una modifica basta
> ricaricare la pagina per vedere subito la versione nuova. Se avessi lasciato
> aperto un server avviato prima, chiudilo e rilancia `start.command`.

**In VSCode:** installa l'estensione *Live Server*, poi tasto destro su
`index.html` → **"Open with Live Server"**.

**Da terminale:**

```bash
cd "SunTrace"
python3 -m http.server 8000
# poi apri http://localhost:8000
```

---

## 🧪 Test

> Serve **Node.js 18+**. Se non ce l'hai, il modo più semplice è `brew install node`,
> oppure scarica il pacchetto ufficiale da [nodejs.org](https://nodejs.org).

```bash
# Installa suncalc (solo devDependency per i test)
npm install

# Esegui i 59 unit test (Node 18+)
npm test
# oppure: node --test tests/solar.test.js
```

**Output atteso**: 59 pass, 0 fail.

### Test end-to-end (browser reale)

Guidano l'app in un browser headless, con le API esterne simulate per risultati
deterministici. Coprono i casi del testbook T01, T03–T06, T11, T14–T15, T17–T18,
T22, T24–T25, T27–T29.

```bash
npx playwright install chromium   # una sola volta (~95 MB)
npm run test:e2e
```

**Output atteso**: 13 pass, 0 fail.

---

## 🌍 Deploy su GitHub Pages

1. Vai su **Settings → Pages** nel tuo repository
2. Source: **Deploy from a branch** → `main` → `/` (root)
3. Salva e attendi ~60 secondi
4. Aggiorna il link "Live Demo" in questo README con il tuo URL `https://username.github.io/suntrace/`

---

## 📁 Struttura

```
SunTrace/
├── index.html          # App completa (entry point)
├── src/
│   ├── solar.js        # Motore astronomico puro (Meeus/SPA) — senza DOM
│   ├── climate.js      # Modello termico stagionale e Comfort Rate
│   ├── shadow.js       # Geometria: orientamento facciata e ombre (line-of-sight)
│   ├── ui.js           # Logica interfaccia, Leaflet, modal, geofencing
│   ├── i18n.js         # Dizionario IT/EN e motore di traduzione
│   └── styles.css      # Stili (mobile-first, WCAG AA)
├── tests/
│   ├── solar.test.js   # 23 test — motore astronomico (oracle SunCalc)
│   ├── climate.test.js # 20 test — modello termico e Comfort Rate
│   ├── shadow.test.js  # 16 test — geometria facciate e ombre
│   └── e2e/app.e2e.js  # 13 test end-to-end (Playwright, browser headless)
├── docs/
│   └── case-study.md   # Case study tecnico
├── README.md
├── CHANGELOG.md
├── LICENSE             # MIT
├── .gitignore
└── package.json
```

---

## 🏗 How it was built

SunTrace è stato progettato per essere **zero-dependency** e **deployabile senza build step**. Il codice è suddiviso in moduli ES nativi (`type="module"`) importati direttamente dall'HTML.

Il motore astronomico (`solar.js`) è interamente **puro** (nessun accesso al DOM, nessuna variabile globale), il che lo rende:
- Testabile con `node --test` senza browser
- Riutilizzabile in altri contesti (worker, server-side)

L'interfaccia usa Leaflet (CDN) per la mappa e l'API pubblica Nominatim per il geocoding, rispettando i [termini di utilizzo](https://operations.osmfoundation.org/policies/nominatim/) con debounce ≥ 420ms e `countrycodes=it`.

---

## ⚠️ Limitazioni

- Le temperature usano le **medie climatiche reali** del punto selezionato (Open-Meteo, normali 1991–2020), con la tabella di Roma solo come *fallback* offline in caso di errore di rete. Il modello termico dell'edificio resta però **euristico** e non sostituisce un APE (Attestato di Prestazione Energetica) certificato.
- Orientamento e ombre sono **calcolati sugli edifici reali di OpenStreetMap** (via Overpass): l'orientamento dal muro più vicino, l'ombra tracciando un raggio verso il sole e verificando se un tetto lo intercetta, all'altezza del piano scelto. Le altezze OSM spesso mancano: in tal caso si assumono 3 piani (9 m), e si considerano solo gli edifici entro 90 m.
- Il modello non include: massa termica, infiltrazioni, apporti interni, ponti termici.

---

## 📄 Licenza

MIT © 2026 SunTrace. Vedi [LICENSE](LICENSE).
