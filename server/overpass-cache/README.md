# Overpass edge cache

Piccolo proxy con cache davanti ai mirror Overpass. Risolve il punto più
fragile dell'app: Overpass è gratuito, sovraccarico e rate-limita spesso.
Con la cache, le zone già viste rispondono in ~50 ms senza toccare Overpass.

**L'app funziona anche senza**: finché `OVERPASS_PROXY_URL` in `src/ui.js`
resta vuota, il client parla coi mirror pubblici come ha sempre fatto. E anche
a proxy attivo, se il worker è giù il client scala sui mirror diretti — nessun
nuovo single point of failure.

## Deploy (una tantum, ~10 minuti, piano gratuito)

Serve un account [Cloudflare](https://dash.cloudflare.com/sign-up) (free).

```bash
cd server/overpass-cache

# 1. login (apre il browser)
npx wrangler login

# 2. crea lo spazio di cache e copia l'id stampato
npx wrangler kv namespace create OSM_CACHE

# 3. in wrangler.toml, scommenta il blocco [[kv_namespaces]] e incolla l'id

# 4. pubblica
npx wrangler deploy
# → stampa l'URL, tipo https://suntrace-overpass.<account>.workers.dev
```

Poi in `src/ui.js` incolla quell'URL in `OVERPASS_PROXY_URL`:

```js
const OVERPASS_PROXY_URL = 'https://suntrace-overpass.<account>.workers.dev';
```

## Verifica

```bash
curl -sS -X POST 'https://suntrace-overpass.<account>.workers.dev' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data 'data=[out:json][timeout:20];(way["building"](around:90,41.9028,12.4964););out geom;' \
  -D - -o /dev/null | grep -i x-suntrace-cache
# prima chiamata:  X-Suntrace-Cache: miss
# seconda chiamata: X-Suntrace-Cache: hit   ← la cache funziona
```

## Limiti del piano gratuito (abbondanti per questa scala)

| Risorsa | Limite free | Uso stimato |
|---|---|---|
| Richieste worker | 100.000/giorno | qualche centinaio |
| Letture KV | 100.000/giorno | idem |
| Scritture KV | 1.000/giorno | solo sui cache miss |

## Nota privacy

Con il proxy attivo, le bbox richieste passano dal tuo worker (Cloudflare ne
vede i log). Va riflesso in `privacy.html` il giorno in cui lo attivi:
la sezione "Servizi di terze parti" deve citare il proxy al posto del
contatto diretto con Overpass.
