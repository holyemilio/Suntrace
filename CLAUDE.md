# CLAUDE.md — SunTrace

Contesto di progetto per le sessioni Claude Code. Il dettaglio completo (storia,
trappole, pendenze) è in `docs/stato-lavori.md` — leggerlo prima di lavori grossi.

## Cos'è

Simulatore microclimatico urbano (esposizione solare di facciate in Italia).
Vanilla JS, moduli ES nativi, **nessun build step, zero dipendenze di runtime**.
Due pagine: `index.html` (landing) e `app.html` (simulatore, con layout mobile
dedicato sotto i 768px). Live su GitHub Pages:
<https://holyemilio.github.io/Suntrace/> · versione **2.6.1**.

## Comandi

```bash
./start.command      # server locale su :8000 (Cache-Control: no-store)
npm test             # 60 unit test (motore solare, clima, ombre)
npm run test:e2e     # 23 e2e Playwright (API esterne mockate)
```

⚠️ **Su questo Mac Node NON è installato**: i test non girano localmente.
La CI (`.github/workflows/ci.yml`) li esegue tutti a ogni push — unit, parità
i18n IT/EN, e2e. È l'unica rete di sicurezza: non dichiarare "verificato" senza
CI verde o prova equivalente (es. screenshot con Chrome headless, che c'è).

## Mappa dei file

| Percorso | Ruolo |
|---|---|
| `src/solar.js` | Motore astronomico Meeus/SPA. **Puro, non toccare senza motivo** (23 test vs SunCalc). |
| `src/climate.js` · `src/shadow.js` | Modello termico / geometria ombre. Puri, testati. |
| `src/ui.js` | Tutto il simulatore (Leaflet, API, bussola click+drag condivisa dai due layout — sulla mappa su desktop, nel widget 🧭 su mobile —, pannelli, layout mobile con reparenting DOM e widget mutuamente esclusivi). Monolite ~47 KB. |
| `src/landing.js` · `landing.css` | Landing. **Non importano `styles.css`** (che blocca lo scroll). |
| `src/i18n.js` | Dizionario IT/EN. **Ogni stringa nuova va in ENTRAMBE le lingue** — la CI lo verifica. |
| `src/tokens.css` | Design token condivisi dalle due pagine. |
| `vendor/fonts/` · `vendor/leaflet/` | Font e Leaflet 1.9.4 **self-hostati** (v2.5.0): niente CDN, mai reintrodurre link a Google Fonts/unpkg. |
| `server/overpass-cache/` | Cloudflare Worker (cache KV 30gg davanti ai mirror Overpass). **Non ancora deployato**: si attiva incollando l'URL in `OVERPASS_PROXY_URL` (`src/ui.js`). |

## Servizi esterni (gratuiti, senza chiave)

OpenStreetMap (tiles) · Nominatim (geocoding, debounce ≥420ms, accetta it/va/sm)
· Overpass (edifici — il più fragile: 3 mirror in fallback in `ui.js`)
· Open-Meteo (normali climatiche 1991–2020, param `daily` aggregato a mano).
Font e Leaflet **non** sono più esterni (self-hostati da v2.5.0); la privacy
policy (`privacy.html` + chiavi `privacy-*` in i18n) riflette esattamente questo
elenco — se cambi i servizi contattati, aggiorna anche lei, in entrambe le lingue.

## Regole di progetto

- Stringhe UI: sempre via `data-i18n` (o `-ph`/`-aria`/`-title`) + chiave in
  entrambe le lingue di `i18n.js`.
- Niente CDN, niente nuove dipendenze di runtime, niente bundler.
- Le coordinate nelle query Overpass sono arrotondate a 4 decimali (stessa
  tolleranza della cache localStorage): non "correggerlo".
- Trappole già pagate (flexbox sidebar, `transform`+`backdrop-filter`,
  cache del browser, finestra <768px): elenco completo in `docs/stato-lavori.md`
  — consultarlo prima di toccare layout o mappa.
- A fine release: aggiornare `CHANGELOG.md`, `docs/stato-lavori.md` e la
  versione in `package.json`, poi commit + push sul repo del progetto
  (holyemilio/Suntrace).

## Pendenze note (agosto 2026)

1. Deploy del worker Overpass (azione manuale utente — README in `server/overpass-cache/`).
2. Nessun e2e sulla landing (`landing.js` verificata solo via screenshot).
3. Fallback mirror Overpass mai provato end-to-end.
4. `docs/manuale-utente.html` + testbook descrivono ancora la vecchia app a pagina singola.
