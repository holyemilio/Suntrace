# Stato dei lavori — SunTrace

Ultimo aggiornamento: **29 agosto 2026** · versione **2.7.0** · repo: <https://github.com/holyemilio/Suntrace>
Live: <https://holyemilio.github.io/Suntrace/> · CI: verde (unit + parità i18n + 25 e2e)

Documento di passaggio di consegne: cosa è fatto, cosa è in sospeso e cosa
sapere prima di rimettere le mani al progetto.

---

## Come far girare tutto

```bash
# app (server locale, niente cache)
./start.command                      # poi http://localhost:8000 (landing page)

# test
npm test                             # 64 unit  — motore solare, clima, geometria ombre
npm run test:e2e                     # 25 e2e   — Playwright guida app.html in un browser vero
```

**Aggiornamento**: Node è ora installato su questo Mac (dal 28/08/2026), i
comandi sopra girano in locale — non serve più aspettare la CI per sapere se
qualcosa si è rotto, anche se resta comunque il gate di ogni push
(`.github/workflows/ci.yml`: unit, parità i18n, e2e).

Serve **Node 18+**. Per gli e2e, una volta sola: `npx playwright install chromium`.

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
| `src/solar.js` | Motore astronomico Meeus/SPA. **Puro, non toccare senza motivo**: 26 test lo confrontano con SunCalc. |
| `src/climate.js` | Modello termico stagionale, temperatura percepita, Comfort Rate. Puro. |
| `src/shadow.js` | Geometria: orientamento della facciata e ombre reali (ray-cast verso il sole). Puro. |
| `src/ui.js` | Il simulatore: Leaflet, geofencing, chiamate API, modale, bussola (click + drag-to-rotate, condivisa dai due layout: sulla mappa su desktop, dentro il widget 🧭 su mobile), piani, arco solare, pannelli comprimibili (legenda/suggerimento), **layout mobile** (`initMobileLayout`, `initMobileSheet`, reparenting DOM verso barra inferiore/drawer/foglio Info/widget, widget mutuamente esclusivi). Legge `?q=` dall'URL per la ricerca in arrivo dalla landing. |
| `src/i18n.js` | Dizionario IT/EN + motore di traduzione, **condiviso da entrambe le pagine**. Ogni testo visibile passa da qui. |
| `src/styles.css` | Stili del simulatore: tema scuro "strumento", glassmorphism, widget solare bento, mappa chiara, blocco `@media (max-width:768px)` per il layout mobile (barra inferiore, drawer, foglio Info, widget solare/clima). Importa `tokens.css`. |
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

0. ~~**CI + self-hosting risorse esterne**~~ — **completato** il 27/08/2026,
   **prima esecuzione reale (ed effettivamente verde) il 28/08/2026**:
   `.github/workflows/ci.yml` esegue unit, parità i18n ed e2e su ogni push
   (allora l'unica rete di sicurezza: questa macchina non aveva Node — non è
   più così dal 28/08/2026, vedi sopra). Al primo giro reale ha trovato tre
   problemi, tutti sistemati nello stesso push: script `test`/`test:e2e` in
   `package.json` con un glob tra virgolette che Node 20 non espande da solo
   (va tolta la virgoletta, lo espande la shell); tre e2e rimasti agganciati a
   elementi rimossi in una modifica precedente (`#telemetry-cardinal`,
   `#val-manual-obs`, `#compass-state`); uno `z-index` mancante sul pulsante
   di chiusura del modale Comfort Rate, che un titolo abbastanza lungo poteva
   coprire rendendolo non cliccabile (vedi trappole sotto). Font e Leaflet ora
   in `vendor/`, zero CDN; privacy policy aggiornata di conseguenza (IT+EN).
   In `server/overpass-cache/` c'è un Cloudflare Worker con cache KV pronto al
   deploy (istruzioni nel suo README): finché `OVERPASS_PROXY_URL` in `ui.js`
   resta vuota il comportamento è identico a prima. **Il deploy del worker
   richiede un account Cloudflare: azione manuale.**
1. ~~**Layout mobile del simulatore**~~ — **completato** il 28/08/2026: sotto i
   768px la sidebar non è più bloccata. Il suo contenuto si sposta in una
   barra inferiore persistente (le 4 temperature stagionali + il Comfort
   Rate), un drawer "Impostazioni" (ricerca, mese/ora, infissi/isolamento), un
   foglio "Info" unico che unisce legenda e suggerimento, e due widget a
   comparsa per i dati solari e il clima. Il blocco totale (schermo troppo
   piccolo per qualunque adattamento) scatta ora solo sotto i 320px, non più
   sotto i 768px.
2. ~~**Rotazione facciata su mobile**~~ — rivista in **v2.6.1** (28/08/2026):
   la gesture pinch-to-rotate sul marker introdotta in v2.6.0 è stata
   **rimossa** — intercettava qualunque pinch entro ~70px dal punto analizzato
   (impossibile zoomare "dentro il cerchio") ed era comunque non scopribile.
   Al suo posto un terzo widget mobile (🧭) contiene la **stessa bussola del
   desktop**, reparentata in `initMobileLayout`: tocca una direzione o
   trascina l'ago. `initCompass()` ora gira su entrambi i layout. I tre
   widget (☀️ 🌡️ 🧭) sono mutuamente esclusivi: aprirne uno chiude gli altri.
   Su desktop la bussola resta cliccabile e trascinabile (Pointer Events,
   `initCompassDrag`); il trascinamento ruota **liberamente, grado per
   grado, senza scatto** — le facciate reali raramente guardano esattamente
   N/E/S/O, e il modello sotto lavora già in gradi esatti, quindi vincolare
   il drag a 45° serviva solo a complicare senza motivo. Chi vuole un punto
   cardinale esatto usa uno degli 8 pulsanti, che restano invariati.
   **Attenzione se si ritocca**: l'aggiornamento UI durante il trascinamento
   deve essere una
   chiamata diretta a `refreshUI()`, non un `requestAnimationFrame` — rAF può
   restare silenzioso in tab in background o in headless, ed è così che il
   bug è stato trovato. Il selettore IT/EN su mobile sta in **alto a
   sinistra** (top:118, sotto geolocalizzazione e Info): la fascia in basso
   (barra, Imposta, widget) è affollata — non rimettercelo.
3. ~~**Marker non centrato nel cerchio**~~ — **completato** il 28/08/2026: il
   pallino visibile non era centrato nella propria icona Leaflet (`divIcon`),
   quindi ombra, raggio solare e linea di facciata sembravano partire dal
   bordo invece che dal centro esatto. Fix: `.suntrace-marker` centrato con
   flexbox.
4. ~~**Il 5° piano è il tetto**~~ — **completato** il 28/08/2026: non più una
   parete verticale a 15m, ma una superficie orizzontale. `solar.js` guadagna
   `roofIrradiance(elevation)` (= sin(elevazione), niente azimut — un tetto non
   ha un lato a cui rivolgersi) e `dailyRoofSunHours()`; `seasonalTemperatures()`
   in `climate.js` prende un flag `isRoof` che sceglie quale formula usare.
   In `ui.js`, `ROOF_FLOOR = 5`: quando selezionato, la bussola si disattiva
   (classe `.roof-disabled`, `pointer-events:none`, `aria-disabled`) e la linea
   verde di facciata sparisce dalla mappa (`renderMapOverlays(..., isRoof)`) —
   entrambe cose che altrimenti resterebbero visibili/interagibili senza avere
   più alcun effetto sul calcolo, un'incoerenza peggiore di non implementarlo.
   Il pulsante piano 5 mostra un'icona a tratto (una falda di tetto, non più
   l'emoji 🔺 iniziale — poco chiara, sistemata il 29/08/2026 insieme al
   tooltip, vedi punto 5) con tooltip "Tetto"/"Roof" (`floor-roof` in i18n).
   **Non tocca** `sunBlocked`/`monthlySunAccess`: il ray-cast verso il sole
   attraverso gli edifici OSM vicini resta identico, un tetto può comunque
   essere in ombra di un vicino più alto.
5. ~~**UX mobile: finestre e primo avvio**~~ — **completato** il 29/08/2026:
   - **Tooltip su piano terra e tetto** — entrambi erano solo un'icona; un
     tooltip custom (stesso stile scuro di `.info-tip-box`) appare su
     hover/focus del pulsante stesso, quindi anche al tap su mobile (che porta
     il focus sul bottone). L'icona del tetto è passata da 🔺 (emoji, resa
     ambigua/diversa tra sistemi) a un'icona SVG a tratto coerente con le
     altre dell'app.
   - **Tap sulla mappa chiude la finestra aperta** — i due fogli (Info,
     Impostazioni) lo facevano già tramite il loro overlay; i tre widget
     (☀️ 🌡️ 🧭) no, perché riusano il pattern desktop dei pannelli
     comprimibili, mai pensato con uno sfondo cliccabile. Ora `map.on('click',
     ...)` chiama `closeAllMobilePanels()` prima di analizzare un nuovo punto:
     se qualcosa era aperto lo chiude e basta, il tap non conta anche come
     "sposta il punto". Il registro `mobilePanelClosers` è alimentato sia da
     `initMobileSheet()` che da `initCollapsiblePanel(..., {closeOnMapTap:
     true})` (il flag lascia invariato il comportamento delle stesse funzioni
     su desktop — map-hint/map-legend non lo passano).
   - **Icona ⇄ ✕ quando la finestra è aperta** — Info, Impostazioni e i tre
     widget mostrano una ✕ al posto della propria icona mentre sono aperti,
     per rendere ovvio che è lì che si chiudono. La mutua esclusione dei tre
     widget (aprirne uno chiude gli altri) ora passa per lo stesso `close()`
     di ciascun pannello (non più manipolazione diretta di `classList`),
     altrimenti l'icona di un widget chiuso "dall'esterno" restava bloccata su
     ✕.
   - **Swipe-down per chiudere il foglio Impostazioni** — trascinare la
     maniglia (`.mobile-sheet-handle`) verso il basso oltre 80px lo chiude;
     sotto soglia torna su. Implementato in `initSheetSwipeToDismiss()`,
     condiviso da entrambi i fogli (Info compreso, stesso componente). L'area
     toccabile della maniglia è più grande di quella visibile (`padding` +
     `background-clip: content-box`) — un target di 40×4px reale sarebbe
     troppo piccolo per un dito.
   - **Tutorial al primo avvio** — un anello luminoso (accent + un box-shadow
     con spread enorme che scurisce il resto, un solo elemento fa entrambe le
     cose) evidenzia un controllo alla volta — Impostazioni, piani, i tre
     widget, Info — con un piccolo popup a fianco che spiega a cosa serve.
     `localStorage` (`suntrace_mobile_tour_seen_v1`) lo mostra una sola volta;
     non c'è ancora un modo per rivederlo a comando. Il tour non blocca
     l'interazione con l'app sotto (`pointer-events:none`): è pensato solo per
     spiegare, non per obbligare a seguirlo in ordine. **Nei test e2e**:
     `openApp()` lo pre-marca come già visto di default
     (`seedTourSeen: true`), altrimenti coprirebbe/intercetterebbe i click di
     qualunque test scritto per un viewport stretto; T40 è l'unico che lo
     disattiva per testare il tour stesso.
6. ~~**Landing page + separazione app**~~ — **completato** il 27/08/2026:
   `index.html` è ora la landing (mission/vision, 4 sezioni con grafici SVG
   animati, CTA), `app.html` è il simulatore. Ricerca sulla landing → redirect
   ad `app.html?q=...` che avvia la ricerca in automatico; link «← Home» nel
   simulatore per tornare indietro. **Non ancora testata con Playwright**
   (nessun e2e sulla landing: solo verificata a occhio via screenshot
   headless).
7. ~~**Deploy live**~~ — **completato**: <https://holyemilio.github.io/Suntrace/>.
   Essendo `index.html` la landing, il dominio radice mostra quella.
8. ~~**Pannelli comprimibili mappa (legenda + suggerimento)**~~ — **completato**
   il 27/08/2026: entrambi collassano in un bottone 42×42 (stessa misura del
   pulsante di geolocalizzazione) con animazione fluida; il testo del
   suggerimento è stato accorciato e reso più leggibile (font più grande,
   colore più chiaro) perché copriva troppo spazio sulla mappa. Su mobile
   (v2.6.0) legenda e suggerimento confluiscono in un unico foglio "Info"
   (vedi punto 1).
9. ~~**Bussola: testo duplicato**~~ — **completato**: rimosso il paragrafo di
   stato sotto la bussola (`#compass-state`) perché ripeteva l'informazione
   già in sidebar ("Sole diretto"). Resta solo l'indicatore visivo (ago + sole).
10. ~~**Regressione box Temperature**~~ — **completato**: il box si comprimeva a
   36px di altezza perché era l'unico elemento della sidebar con `overflow:
   hidden` mentre il flex-column della sidebar si restringeva per contenuto
   in eccesso. Fix: `flex-shrink: 0` su tutte le card della sidebar.
11. **Fallback mirror Overpass** — codice in `overpassQuery()`, mai provato per
   irraggiungibilità del servizio. Se orientamento e schermatura restano fermi
   su "Sud / Nessuna", è quasi certamente Overpass che non risponde.
12. **Landing page senza test automatici** — `landing.js`/`landing.css` sono
    stati verificati solo visivamente (screenshot Chrome headless, questa
    macchina non ha Node installato). Prima di fidarsene in produzione
    varrebbe la pena aggiungere qualche caso a `tests/e2e/` (submit ricerca →
    redirect corretto, `?q=` raccolto da `app.html`, cambio lingua, reveal on
    scroll). Stesso discorso per il nuovo layout mobile: niente e2e ancora,
    solo screenshot headless.
13. **Documentazione utente non aggiornata** — `docs/manuale-utente.html`,
    `docs/testbook.html` e `docs/testbook.csv` parlano ancora della vecchia
    struttura a pagina singola su desktop-only. Non ancora rivisti per
    riflettere la landing page, la navigazione a due pagine e il layout
    mobile.
14. **Audit accessibilità WCAG 2.2** — deliberatamente rimandato a una fase
    separata futura (concordato con l'utente). Il lavoro mobile di questa
    sessione è stato costruito con attenzione ad aria-label/ruoli/focus, ma
    non è un audit completo.

---

## Trappole già pagate

- **Cache del browser**: `start.command` ora invia `Cache-Control: no-store`. Se
  le modifiche "non si vedono", è quasi sempre un server vecchio ancora attivo.
- **Finestra < 768 px** (anche per zoom del browser): da v2.6.0 NON blocca più
  l'app. Attiva il layout mobile (barra inferiore, drawer, foglio Info,
  widget). Solo sotto i **320 px** (`MIN_USABLE_WIDTH` in `ui.js`) compare
  ancora l'avviso di blocco totale — non c'è più spazio per adattarsi.
- **`requestAnimationFrame` non è affidabile per aggiornare la UI**: può
  restare silenzioso in una tab in background o in un browser headless (così
  è stato scoperto, debuggando la bussola trascinabile). Per aggiornamenti
  che DEVONO succedere subito (drag, slider), chiamare `refreshUI()`
  direttamente e in modo sincrono, non dentro un rAF.
- **`[hidden]` vs classi per aprire/chiudere un pannello**: l'attributo
  `hidden` ha una specificità bassissima nella cascata UA — una regola autore
  con `display: block` (anche generica, tipo `.mobile-sheet { display:
  flex }`) lo sovrascrive sempre, e il pannello resta visibile. Per il foglio
  Info e il drawer mobile si usa una classe `.open` esplicita, non l'attributo
  `hidden`.
- **`.selector > * { position: relative }` sui contenitori di modali/pannelli**:
  promuove OGNI figlio (anche un titolo `<h2>` che segue nel DOM) a elemento
  posizionato con `z-index: auto`. Se nello stesso contenitore c'è un
  pulsante `position: absolute` senza `z-index` esplicito (es. il tasto di
  chiusura di un modale), un figlio successivo nel DOM può finirci sopra e
  intercettarne i click — è quello che ha trovato la CI sul modale Comfort
  Rate. Dare sempre uno `z-index` esplicito ai pulsanti di chiusura assoluti.
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
