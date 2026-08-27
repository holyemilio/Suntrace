# Stato dei lavori — SunTrace

Ultimo aggiornamento: **27 agosto 2026** · versione **2.3.0** · repo: <https://github.com/holyemilio/Suntrace>

Documento di passaggio di consegne: cosa è fatto, cosa è in sospeso e cosa
sapere prima di rimettere le mani al progetto.

---

## Come far girare tutto

```bash
# app (server locale, niente cache)
./start.command                      # poi http://localhost:8000

# test
npm test                             # 60 unit  — motore solare, clima, geometria ombre
npm run test:e2e                     # 22 e2e   — Playwright guida l'app in un browser vero
```

Serve **Node 18+**. Se manca: `brew install node`. Per gli e2e, una volta sola:
`npx playwright install chromium`.

> Il progetto è **zero-dependency a runtime**: nessun bundler, moduli ES nativi.
> Playwright e suncalc sono solo per i test.

---

## Com'è fatto

| File | Responsabilità |
|---|---|
| `src/solar.js` | Motore astronomico Meeus/SPA. **Puro, non toccare senza motivo**: 23 test lo confrontano con SunCalc. |
| `src/climate.js` | Modello termico stagionale, temperatura percepita, Comfort Rate. Puro. |
| `src/shadow.js` | Geometria: orientamento della facciata e ombre reali (ray-cast verso il sole). Puro. |
| `src/ui.js` | Tutto il resto: Leaflet, geofencing, chiamate API, modale, bussola, piani, arco solare. |
| `src/i18n.js` | Dizionario IT/EN + motore di traduzione. **Ogni testo visibile passa da qui.** |
| `src/styles.css` | Tema scuro "strumento" con glassmorphism, widget solare bento e mappa chiara. Token in `:root`. |
| `docs/app-icon.svg` | Nuovo brand icon vettoriale (sole, facciata architettonica, finestra calda, cuneo d'ombra). |

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
| OpenStreetMap tiles | mappa | **Non usare CARTO**: marchia ogni stile con "API KEY REQUIRED" senza chiave. Zoom max 19. Mappa chiara ad alto contrasto. |
| Nominatim | ricerca indirizzi + confini | Accetta `it`, `va`, `sm` (Vaticano e San Marino sono enclavi italiane). |
| Overpass | edifici per orientamento e ombre | Il più fragile: rate-limita spesso. C'è un fallback su due mirror, **mai verificato end-to-end**. |
| Open-Meteo | clima (temperatura, umidità, vento, pioggia) | Il parametro `monthly` restituisce vuoto: si usa `daily` e si aggrega a mano. |

---

## In sospeso / Completati di recente

1. ~~**Restyling UI su riferimento visivo & Nuova Icona**~~ — **completato** il 27/08/2026:
   - Integrazione nuova icona vettoriale (`docs/app-icon.svg`, `docs/logo.svg`, favicon e brand header).
   - Riprogettazione card **Dati Solari** con arco parabolico dinamico (Sky Dome) in SVG, sole viaggiante in tempo reale, orari alba/tramonto e griglia telemetrica bento.
   - Allineamento verticale della sezione Estimate / Coordinate nel box principale.
   - Mantenuta la mappa chiara per garantire massimo contrasto con ombre ed elementi geometrici.
2. **Bussola** — attualmente 122 px in basso a destra sulla mappa. L'utente
   valuterà se ridurla ancora o toglierle la cornice.
3. **Fallback mirror Overpass** — codice in `overpassQuery()`, mai provato per
   irraggiungibilità del servizio. Se orientamento e schermatura restano fermi
   su "Sud / Nessuna", è quasi certamente Overpass che non risponde.
4. ~~Segnalazione "pagina bianca"~~ — **chiusa** il 26/08/2026: l'utente conferma
   che non si presenta più. Non era mai stata riprodotta ed è
   compatibile con la versione vecchia servita dalla cache del browser, ora
   impedita da `Cache-Control: no-store`.

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
