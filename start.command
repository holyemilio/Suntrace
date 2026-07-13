#!/bin/bash
# Avvia SunTrace su un server locale (http://localhost:8000).
# NON aprire index.html con doppio click: i moduli ES e la geolocalizzazione
# richiedono http://localhost, non funzionano su file://.
cd "$(dirname "$0")"
( sleep 1; open "http://localhost:8000" ) &
echo "SunTrace su http://localhost:8000 — premi Ctrl+C per fermare."
python3 -m http.server 8000
