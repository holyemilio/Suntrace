#!/bin/bash
# Avvia SunTrace su un server locale (http://localhost:8000).
# NON aprire index.html con doppio click: i moduli ES e la geolocalizzazione
# richiedono http://localhost, non funzionano su file://.
cd "$(dirname "$0")"
( sleep 1; open "http://localhost:8000" ) &
echo "SunTrace su http://localhost:8000 — premi Ctrl+C per fermare."

# Il server dice al browser di non conservare nulla in cache: dopo una modifica
# basta ricaricare la pagina per vedere subito la versione nuova.
python3 - <<'PY'
import http.server, socketserver

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):   # meno rumore nel terminale
        pass

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", 8000), NoCacheHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer fermato.")
PY
