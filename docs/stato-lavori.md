# Stato dei lavori — SunTrace

Ultimo aggiornamento: **28 agosto 2026** · versione **2.6.0** · repo: <https://github.com/holyemilio/Suntrace>
Live: <https://holyemilio.github.io/Suntrace/> · CI: verde (unit + parità i18n + 23 e2e)

Documento di passaggio di consegne: cosa è fatto, cosa è in sospeso e cosa
sapere prima di rimettere le mani al progetto.

---

## Come far girare tutto

```bash
# app (server locale, niente cache)
./start.command                      # poi http://localhost:8000 (landing page)

# test
npm test                             # 60 unit  — motore solare, clima, geometria ombre
npm run test:e2e                     # 23 e2e   — Playwright guida app.html in un browser vero
```

Su questo Mac **Node non è installato**: i comandi sopra non girano qui. La CI
(`.github/workflows/ci.yml`) li esegue a ogni push — è l'unica rete di
sicurezza reale, non dichiarare "verificato" senza CI verde o uno screenshot
Chrome headless equivalente.

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
| `src/ui.js` | Il simulatore: Leaflet, geofencing, chiamate API, modale, bussola (click + drag-to-rotate desktop), piani, arco solare, pannelli comprimibili (legenda/suggerimento), **layout mobile** (`initMobileLayout`, `initMobileSheet`, reparenting DOM verso barra inferiore/drawer/foglio Info/widget) e gesture pinch-to-rotate sul marker (`initFacadeRotateGesture`). Legge `?q=` dall'URL per la ricerca in arrivo dalla landing. |
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
   (i test NON possono girare su questa macchina, Node non è installato — la
   CI è l'unica rete di sicurezza attiva). Al primo giro reale ha trovato tre
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
2. ~~**Gesture pinch-to-rotate + bussola desktop trascinabile**~~ —
   **completato** il 28/08/2026: su mobile un dito sul marker lo sposta (già
   gestito da Leaflet), due dita lo ruotano con lo stesso scatto ai punti
   cardinali della bussola desktop. Su desktop la bussola resta cliccabile ma
   ora si può anche trascinare (Pointer Events, `initCompassDrag`), con
   scatto automatico ogni 45°. **Attenzione se si ritocca**: l'aggiornamento
   UI durante il trascinamento deve essere una chiamata diretta a
   `refreshUI()`, non un `requestAnimationFrame` — rAF può restare silenzioso
   in tab in background o in headless, ed è così che il bug è stato trovato.
3. ~~**Marker non centrato nel cerchio**~~ — **completato** il 28/08/2026: il
   pallino visibile non era centrato nella propria icona Leaflet (`divIcon`),
   quindi ombra, raggio solare e linea di facciata sembravano partire dal
   bordo invece che dal centro esatto. Fix: `.suntrace-marker` centrato con
   flexbox.
4. ~~**Landing page + separazione app**~~ — **completato** il 27/08/2026:
   `index.html` è ora la landing (mission/vision, 4 sezioni con grafici SVG
   animati, CTA), `app.html` è il simulatore. Ricerca sulla landing → redirect
   ad `app.html?q=...` che avvia la ricerca in automatico; link «← Home» nel
   simulatore per tornare indietro. **Non ancora testata con Playwright**
   (nessun e2e sulla landing: solo verificata a occhio via screenshot
   headless).
5. ~~**Deploy live**~~ — **completato**: <https://holyemilio.github.io/Suntrace/>.
   Essendo `index.html` la landing, il dominio radice mostra quella.
6. ~~**Pannelli comprimibili mappa (legenda + suggerimento)**~~ — **completato**
   il 27/08/2026: entrambi collassano in un bottone 42×42 (stessa misura del
   pulsante di geolocalizzazione) con animazione fluida; il testo del
   suggerimento è stato accorciato e reso più leggibile (font più grande,
   colore più chiaro) perché copriva troppo spazio sulla mappa. Su mobile
   (v2.6.0) legenda e suggerimento confluiscono in un unico foglio "Info"
   (vedi punto 1).
7. ~~**Bussola: testo duplicato**~~ — **completato**: rimosso il paragrafo di
   stato sotto la bussola (`#compass-state`) perché ripeteva l'informazione
   già in sidebar ("Sole diretto"). Resta solo l'indicatore visivo (ago + sole).
8. ~~**Regressione box Temperature**~~ — **completato**: il box si comprimeva a
   36px di altezza perché era l'unico elemento della sidebar con `overflow:
   hidden` mentre il flex-column della sidebar si restringeva per contenuto
   in eccesso. Fix: `flex-shrink: 0` su tutte le card della sidebar.
9. **Fallback mirror Overpass** — codice in `overpassQuery()`, mai provato per
   irraggiungibilità del servizio. Se orientamento e schermatura restano fermi
   su "Sud / Nessuna", è quasi certamente Overpass che non risponde.
10. **Landing page senza test automatici** — `landing.js`/`landing.css` sono
    stati verificati solo visivamente (screenshot Chrome headless, questa
    macchina non ha Node installato). Prima di fidarsene in produzione
    varrebbe la pena aggiungere qualche caso a `tests/e2e/` (submit ricerca →
    redirect corretto, `?q=` raccolto da `app.html`, cambio lingua, reveal on
    scroll). Stesso discorso per il nuovo layout mobile: niente e2e ancora,
    solo screenshot headless.
11. **Documentazione utente non aggiornata** — `docs/manuale-utente.html`,
    `docs/testbook.html` e `docs/testbook.csv` parlano ancora della vecchia
    struttura a pagina singola su desktop-only. Non ancora rivisti per
    riflettere la landing page, la navigazione a due pagine e il layout
    mobile.
12. **Audit accessibilità WCAG 2.2** — deliberatamente rimandato a una fase
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
