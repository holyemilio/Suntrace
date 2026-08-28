# Stato dei lavori — SunTrace

Ultimo aggiornamento: **27 agosto 2026** · versione **2.5.0** · repo: <https://github.com/holyemilio/Suntrace>
Live: <https://holyemilio.github.io/Suntrace/>

Documento di passaggio di consegne: cosa è fatto, cosa è in sospeso e cosa
sapere prima di rimettere le mani al progetto.

---

## Come far girare tutto

```bash
# app (server locale, niente cache)
./start.command                      # poi http://localhost:8000 (landing page)

# test
npm test                             # 60 unit  — motore solare, clima, geometria ombre
npm run test:e2e                     # 22 e2e   — Playwright guida app.html in un browser vero
```

Serve **Node 18+**. Se manca: `brew install node`. Per gli e2e, una volta sola:
`npx playwright install chromium`.

> Il progetto è **zero-dependency a runtime**: nessun bundler, moduli ES nativi.
> Playwright e suncalc sono solo per i test.

---

## Com'è fatto

Da questa sessione l'app è **due pagine separate**, non più una sola:

| File | Responsabilità |
|---|---|
| `index.html` | **Landing page**: missione/vision del prodotto, 4 blocchi "Perché SunTrace" con mini-grafici SVG animati allo scroll, barra di ricerca che porta a `app.html?q=<indirizzo>`. |
| `app.html` | Il simulatore vero e proprio (ex `index.html`). Ha un link «← Home» in cima alla sidebar per tornare alla landing. |
| `src/landing.js` | Logica della landing: cambio lingua, submit ricerca → redirect ad `app.html`, scroll-reveal via `IntersectionObserver`. Indipendente da `ui.js`. |
| `src/landing.css` | Stili della landing. Non importa `styles.css` (che fissa `body{overflow:hidden}` per il layout a mappa fissa) — importa solo `tokens.css`. |
| `src/tokens.css` | I design token (`:root { --bg, --accent, --radius-*, ... }`), estratti da `styles.css` perché condivisi da entrambe le pagine. |
| `src/solar.js` | Motore astronomico Meeus/SPA. **Puro, non toccare senza motivo**: 23 test lo confrontano con SunCalc. |
| `src/climate.js` | Modello termico stagionale, temperatura percepita, Comfort Rate. Puro. |
| `src/shadow.js` | Geometria: orientamento della facciata e ombre reali (ray-cast verso il sole). Puro. |
| `src/ui.js` | Il simulatore: Leaflet, geofencing, chiamate API, modale, bussola, piani, arco solare, pannelli comprimibili (legenda/suggerimento). Legge `?q=` dall'URL per la ricerca in arrivo dalla landing. |
| `src/i18n.js` | Dizionario IT/EN + motore di traduzione, **condiviso da entrambe le pagine**. Ogni testo visibile passa da qui. |
| `src/styles.css` | Stili del simulatore: tema scuro "strumento", glassmorphism, widget solare bento, mappa chiara. Importa `tokens.css`. |
| `docs/app-icon.svg` | Brand icon vettoriale (sole, facciata architettonica, finestra calda, cuneo d'ombra) — favicon di entrambe le pagine. |

**Regola pratica:** ogni nuova stringa va aggiunta in **entrambe** le lingue di
`i18n.js`, e nell'HTML si marca l'elemento con `data-i18n` (o `-ph`, `-aria`,
`-title`). Un controllo veloce della parità:

```bash
python3 -c "
import re; s=open('src/i18n.js').read()
it=s[s.index('  it: {'):s.index('  en: {')]; en=s[s.index('  en: {'):]
ki=set(re.findall(r\"'([a-z0-9-]+)':\",it)); ke=set(re.findall(r\"'([a-z0-9-]+)':\",en))
print('ok' if ki==ke else sorted(ki^ke))"
```

---

## Servizi esterni (tutti gratuiti, senza chiave)

| Servizio | Uso | Note |
|---|---|---|
| OpenStreetMap tiles | mappa (solo `app.html`) | **Non usare CARTO**: marchia ogni stile con "API KEY REQUIRED" senza chiave. Zoom max 19. Mappa chiara ad alto contrasto. |
| Nominatim | ricerca indirizzi + confini | Accetta `it`, `va`, `sm` (Vaticano e San Marino sono enclavi italiane). |
| Overpass | edifici per orientamento e ombre | Il più fragile: rate-limita spesso. C'è un fallback su due mirror, **mai verificato end-to-end**. |
| Open-Meteo | clima (temperatura, umidità, vento, pioggia) | Il parametro `monthly` restituisce vuoto: si usa `daily` e si aggrega a mano. |

---

## In sospeso / Completati di recente

0. ~~**CI + self-hosting risorse esterne**~~ — **completato** il 27/08/2026:
   `.github/workflows/ci.yml` esegue unit, parità i18n ed e2e su ogni push
   (nota: i test NON possono girare su questa macchina, Node non è installato —
   la CI è l'unica rete di sicurezza attiva). Font e Leaflet ora in `vendor/`,
   zero CDN; privacy policy aggiornata di conseguenza (IT+EN). In
   `server/overpass-cache/` c'è un Cloudflare Worker con cache KV pronto al
   deploy (istruzioni nel suo README): finché `OVERPASS_PROXY_URL` in `ui.js`
   resta vuota il comportamento è identico a prima. **Il deploy del worker
   richiede un account Cloudflare: azione manuale.**
1. ~~**Landing page + separazione app**~~ — **completato** il 27/08/2026:
   `index.html` è ora la landing (mission/vision, 4 sezioni con grafici SVG
   animati, CTA), `app.html` è il simulatore. Ricerca sulla landing → redirect
   ad `app.html?q=...` che avvia la ricerca in automatico; link «← Home» nel
   simulatore per tornare indietro. **Non ancora testata con Playwright**
   (nessun e2e sulla landing: solo verificata a occhio via screenshot
   headless).
2. ~~**Deploy live**~~ — **completato**: <https://holyemilio.github.io/Suntrace/>.
   Essendo `index.html` la landing, il dominio radice mostra quella.
3. ~~**Pannelli comprimibili mappa (legenda + suggerimento)**~~ — **completato**
   il 27/08/2026: entrambi collassano in un bottone 42×42 (stessa misura del
   pulsante di geolocalizzazione) con animazione fluida; il testo del
   suggerimento è stato accorciato e reso più leggibile (font più grande,
   colore più chiaro) perché copriva troppo spazio sulla mappa.
4. ~~**Bussola: testo duplicato**~~ — **completato**: rimosso il paragrafo di
   stato sotto la bussola (`#compass-state`) perché ripeteva l'informazione
   già in sidebar ("Sole diretto"). Resta solo l'indicatore visivo (ago + sole).
5. ~~**Regressione box Temperature**~~ — **completato**: il box si comprimeva a
   36px di altezza perché era l'unico elemento della sidebar con `overflow:
   hidden` mentre il flex-column della sidebar si restringeva per contenuto
   in eccesso. Fix: `flex-shrink: 0` su tutte le card della sidebar.
6. **Fallback mirror Overpass** — codice in `overpassQuery()`, mai provato per
   irraggiungibilità del servizio. Se orientamento e schermatura restano fermi
   su "Sud / Nessuna", è quasi certamente Overpass che non risponde.
7. **Landing page senza test automatici** — `landing.js`/`landing.css` sono
   stati verificati solo visivamente (screenshot Chrome headless, questa
   macchina non ha Node installato). Prima di fidarsene in produzione varrebbe
   la pena aggiungere qualche caso a `tests/e2e/` (submit ricerca → redirect
   corretto, `?q=` raccolto da `app.html`, cambio lingua, reveal on scroll).
8. **Documentazione utente non aggiornata** — `docs/manuale-utente.html`,
   `docs/testbook.html` e `docs/testbook.csv` parlano ancora della vecchia
   struttura a pagina singola. Non ancora rivisti per riflettere la landing
   page e la navigazione a due pagine.

---

## Trappole già pagate

- **Cache del browser**: `start.command` ora invia `Cache-Control: no-store`. Se
  le modifiche "non si vedono", è quasi sempre un server vecchio ancora attivo.
- **Finestra < 768 px** (anche per zoom del browser): nasconde i controlli della
  mappa. Ora compare l'avviso che lo spiega, e l'app riparte allargando.
- **Space Grotesk arriva a 700**: chiedere `font-weight: 800` produce un
  grassetto sintetico.
- **`transform` CSS + `backdrop-filter`**: Chromium non risolve il click sugli
  elementi trasformati dentro un pannello sfocato. I pulsanti della bussola sono
  posizionati con `left`/`top` espliciti proprio per questo.
- **L'indicatore "Sole diretto"** distingue tre casi: in sole, in ombra per un
  edificio, e sole sull'altro lato (parete rivolta altrove). Non fonderli.
- **Flex-column + `overflow: hidden`**: un elemento con `overflow` diverso da
  `visible` dentro un flex container ha "automatic minimum size" pari a 0. Se
  il contenuto totale della sidebar supera l'altezza disponibile, il flexbox
  scarica TUTTO il ridimensionamento su quell'elemento (lo schiaccia), mentre
  gli altri (dimensione minima = contenuto) restano intatti. `#sidebar > *`
  ha ora `flex-shrink: 0` proprio per questo — se serve `overflow: hidden` su
  una nuova card (es. per ritagliare un elemento decorativo), non toglierlo.
- **`landing.css` non importa `styles.css`**: quest'ultimo fissa
  `body { overflow: hidden; height: 100vh }` per il layout fisso del
  simulatore, che romperebbe lo scroll normale della landing. Le due pagine
  condividono solo `tokens.css` (i design token in `:root`).
