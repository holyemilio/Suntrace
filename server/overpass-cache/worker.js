/**
 * SunTrace — Overpass edge cache (Cloudflare Worker).
 *
 * Stessa interfaccia di un endpoint Overpass (POST, body `data=<query>`): il
 * client non cambia protocollo, solo URL. Su cache miss inoltra ai mirror
 * pubblici in ordine e salva la risposta in KV per 30 giorni — gli edifici OSM
 * cambiano raramente, e una risposta di un mese fa resta valida per le ombre.
 *
 * Deploy: vedi README.md in questa cartella. Se il binding KV manca, il worker
 * degrada a puro proxy pass-through (nessuna cache, ma funziona comunque).
 */

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const CACHE_TTL = 60 * 60 * 24 * 30; // 30 giorni, in secondi

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST') {
      return new Response('POST only', { status: 405, headers: CORS });
    }

    const body = await request.text();
    const key = await sha256(body);

    // 1) cache hit → risposta immediata
    if (env.OSM_CACHE) {
      const hit = await env.OSM_CACHE.get(key);
      if (hit !== null) {
        return json(hit, { 'X-Suntrace-Cache': 'hit' });
      }
    }

    // 2) miss → primo mirror che risponde
    let lastStatus = 502;
    for (const mirror of MIRRORS) {
      let res;
      try {
        res = await fetch(mirror, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
          body,
        });
      } catch { continue; /* mirror irraggiungibile — prova il prossimo */ }
      if (!res.ok) { lastStatus = res.status; continue; }

      const text = await res.text();
      if (env.OSM_CACHE) {
        // best-effort: se la scrittura KV fallisce (quota), la risposta parte lo stesso
        try { await env.OSM_CACHE.put(key, text, { expirationTtl: CACHE_TTL }); } catch {}
      }
      return json(text, { 'X-Suntrace-Cache': 'miss' });
    }

    return new Response('All Overpass mirrors failed', { status: lastStatus, headers: CORS });
  },
};

function json(text, extra = {}) {
  return new Response(text, {
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  });
}

async function sha256(s) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
