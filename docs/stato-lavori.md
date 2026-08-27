# Stato dei lavori — SunTrace

Ultimo aggiornamento: **26 agosto 2026** · versione **2.2.0** · repo: <https://github.com/holyemilio/Suntrace>

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
| `src/ui.js` | Tutto il resto: Leaflet, geofencing, chiamate API, modale, bussola, piani. |
| `src/i18n.js` | Dizionario IT/EN + motore di traduzione. **Ogni testo visibile passa da qui.** |
| `src/styles.css` | Tema scuro "strumento". Token in `:root`. |

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
| OpenStreetMap tiles | mappa | **Non usare CARTO**: marchia ogni stile con "API KEY REQUIRED" senza chiave. Zoom max 19. |
| Nominatim | ricerca indirizzi + confini | Accetta `it`, `va`, `sm` (Vaticano e San Marino sono enclavi italiane). |
| Overpass | edifici per orientamento e ombre | Il più fragile: rate-limita spesso. C'è un fallback su due mirror, **mai verificato end-to-end**. |
| Open-Meteo | clima (temperatura, umidità, vento, pioggia) | Il parametro `monthly` restituisce vuoto: si usa `daily` e si aggrega a mano. |

---

## In sospeso

1. **Restyling UI su riferimento visivo** — richiesto dall'utente, con immagini
   di riferimento (Pinterest) che nella chat precedente non si sono potute
   caricare. **Serve riguardare quelle immagini prima di procedere.**
2. **Bussola** — attualmente 122 px in basso a destra sulla mappa. L'utente
   valuterà se ridurla ancora o toglierle la cornice.
3. **Fallback mirror Overpass** — codice in `overpassQuery()`, mai provato per
   irraggiungibilità del servizio. Se orientamento e schermatura restano fermi
   su "Sud / Nessuna", è quasi certamente Overpass che non risponde.
4. **Segnalazione "pagina bianca"** — l'utente ha riferito un errore cliccando
   sulla mappa, mai riprodotto: click, doppio click, trascinamento, rete reale e
   payload OSM malformati non producono crash. Ora un errore imprevisto compare
   come avviso: **serve il testo di quell'avviso** per andare avanti.

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
