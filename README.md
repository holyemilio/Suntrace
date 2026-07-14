<p align="center">
  <img src="docs/logo.svg" alt="SunTrace" width="260">
</p>

# SunTrace — Simulatore Microclimatico Urbano

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-23%20pass-brightgreen)]()
[![Engine](https://img.shields.io/badge/solar%20engine-Meeus%20%2F%20SPA-blue)]()

**SunTrace** è un simulatore microclimatico urbano che analizza l'esposizione solare di facciate e locali in qualsiasi punto d'Italia. Seleziona un punto sulla mappa, scegli mese e ora, e ottieni in tempo reale: posizione solare corretta (Meeus/SPA), ore di sole per ogni orientamento di facciata, stima termica stagionale e classe energetica con KPI di risparmio.

## 🌐 Live Demo

> **[suntrace.io](https://your-username.github.io/suntrace/)** ← aggiorna con il tuo URL GitHub Pages

![Screenshot placeholder](docs/screenshot.png)

---

## ✨ Features

| Feature | Dettaglio |
|---|---|
| **Motore solare Meeus/SPA** | Declinazione, Equazione del Tempo, rifrazione atmosferica (Bennet). Errore < 0.5° su elevazione e azimut rispetto a SunCalc. |
| **Alba / tramonto precisi** | Calcolo con angolo di depressione −0.833° (rifrazione + disco solare). |
| **Fuso orario + ora legale** | Usa `Intl.DateTimeFormat / Europe/Rome` — nessun offset hardcoded. |
| **Ore di sole per facciata** | 8 orientamenti (N, NE, E, SE, S, SW, W, NW). Vista "oggi" o "media annuale" (4 giorni campione). |
| **Stima termica stagionale** | Ciclo diurno sinusoidale, scalato per latitudine, con guadagno solare sulla facciata analizzata. |
| **Classe energetica + KPI modal** | Classi A–G con costo stimato, CO₂ emessa e risparmio vs classe G. |
| **Autocomplete Nominatim** | Debounce 420ms, limitato all'Italia, gestione errori di rete con feedback visivo. |
| **Geolocalizzazione** | Messaggi di errore specifici per PERMISSION_DENIED / POSITION_UNAVAILABLE / TIMEOUT. |
| **Mobile-first** | Sidebar collassabile su schermi < 768px. |
| **Zero dipendenze di runtime** | Solo Leaflet (CDN) + Nominatim API. Nessun bundler richiesto. |
| **23 unit test** | `node --test` nativo, oracle SunCalc, copertura DST + anni bisestili + edge cases. |

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

```bash
# Installa suncalc (solo devDependency per i test)
npm install

# Esegui i 23 unit test (Node 18+)
npm test
# oppure: node --test tests/solar.test.js
```

**Output atteso**: 23 pass, 0 fail.

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
│   ├── climate.js      # Modello termico diurno e KPI energetici
│   ├── ui.js           # Logica interfaccia, Leaflet, modal, chart
│   └── styles.css      # Stili (mobile-first, WCAG AA)
├── tests/
│   └── solar.test.js   # 23 unit test (node --test, oracle SunCalc)
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
- L'ombreggiatura degli edifici è **generata proceduralmente** da una funzione seed sulle coordinate — non usa dati GIS reali.
- Il modello non include: massa termica, infiltrazioni, apporti interni, ponti termici.

---

## 📄 Licenza

MIT © 2026 SunTrace. Vedi [LICENSE](LICENSE).
