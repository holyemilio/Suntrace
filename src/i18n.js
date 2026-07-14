/**
 * i18n.js — Minimal bilingual (IT/EN) engine for SunTrace. No dependencies.
 *
 * - Static text: mark HTML elements with data-i18n / data-i18n-ph /
 *   data-i18n-aria / data-i18n-title; applyTranslations() fills them.
 * - Dynamic text (JS): call t(key, vars) with {var} placeholders.
 * - Language resolves from localStorage → browser language → Italian.
 */

const STRINGS = {
  it: {
    'app-title': 'SunTrace — Simulatore Microclimatico Urbano',
    'sidebar-aria': 'Pannello di Controllo SunTrace',

    // Search
    'search-card-aria': 'Ricerca Geografica',
    'search-title': '📍 Cerca Indirizzo',
    'search-hint': 'Cerca un indirizzo per iniziare, poi premi «Vai».',
    'search-ph': 'Via o città in Italia…',
    'search-input-aria': 'Campo di ricerca indirizzo',
    'search-suggestions-aria': 'Suggerimenti indirizzo',
    'search-go': 'Vai',
    'search-go-aria': 'Cerca indirizzo',
    'search-empty': 'Nessun risultato trovato',
    'search-neterror': '⚠️ Errore di rete — verifica la connessione',
    'search-notfound': '⚠️ Indirizzo non trovato. Prova con un nome diverso.',
    'search-neterror-toast': '⚠️ Errore di rete. Verifica la connessione.',

    // Output / comfort
    'output-initial': 'Stima temperatura vano',
    'comfort-estimated': 'Comfort Rate Stimato',
    'comfort-tooltip': 'Comfort Rate: indice di comfort termico stimato per l\'abitazione basato su orientamento, sole e ostruzioni.',
    'comfort-hint': 'tocca per i dettagli sul comfort',
    'comfort-open-aria': 'Apri dettaglio comfort',
    'seasonal-aria': 'Temperature Stagionali',
    'season-winter': 'Inverno',
    'season-spring': 'Primavera',
    'season-summer': 'Estate',
    'season-autumn': 'Autunno',

    // Time
    'time-card-aria': 'Configurazione Temporale',
    'time-title': '⏱ Crono-Solare',
    'time-month': 'Mese di analisi',
    'time-hour': 'Ora locale (simulatore ombra)',
    'month-slider-aria': 'Seleziona mese',
    'hour-slider-aria': 'Seleziona ora',

    // Solar
    'solar-card-aria': 'Informazioni Solari',
    'solar-title': '☀️ Dati Solari',
    'solar-sunrise': 'Alba (ora locale)',
    'solar-sunset': 'Tramonto (ora locale)',
    'solar-daylength': 'Durata del giorno',
    'solar-elevation': 'Elevazione solare',
    'solar-azimuth': 'Azimut solare',
    'below-horizon': '< orizzonte',

    // Facade
    'facade-card-aria': 'Parametri Geometrici Facciata',
    'facade-title': '🛠 Parametri Facciata',
    'facade-orientation': 'Orientamento / Cardinale',
    'facade-shading': 'Schermatura rilevata',
    'facade-rotation': 'Rotazione parete',
    'rotation-slider-aria': 'Angolo di rotazione parete',
    'facade-windows': 'Tipo di Infissi',
    'windows-select-aria': 'Seleziona tipo di infissi',
    'windows-single': 'Vetro Singolo',
    'windows-double': 'Doppio Vetro',
    'windows-triple': 'Triplo Vetro / Taglio Termico',
    'facade-insulation': 'Isolamento Muri',
    'insulation-select-aria': 'Seleziona isolamento pareti',
    'insulation-none': 'Nessuno (Muro Storico)',
    'insulation-coat': 'Cappotto Termico',

    // Footer
    'footer-links-aria': 'Link utili',
    'footer-docs': 'Documentazione',
    'footer-github': 'GitHub',
    'footer-privacy': 'Privacy',
    'footer-copy': '© 2026 SunTrace. Motore Meeus/SPA — solo uso indicativo.',

    // Map / buttons
    'map-aria': 'Mappa Interattiva Microclimatica',
    'geo-aria': 'Rileva la mia posizione geografica',
    'geo-title': 'Rileva posizione',
    'panel-open': '☰ Pannello',
    'panel-open-aria': 'Apri pannello di controllo',
    'panel-close': '✕ Chiudi',
    'lang-aria': 'Lingua / Language',

    // Modal
    'modal-close-aria': 'Chiudi modale',
    'modal-title-initial': 'Dettaglio Comfort Rate',
    'modal-title': 'Analisi Comfort Rate — {label}',
    'comfort-rate': 'Comfort Rate',
    'kpi-winter': 'Comfort Inverno (mezzogiorno)',
    'kpi-summer': 'Comfort Estate (mezzogiorno)',
    'kpi-windows': 'Tipo di Infissi',
    'kpi-insulation': 'Isolamento Pareti',
    'modal-disclaimer': '*Le temperature usano le medie climatiche reali del luogo (Open-Meteo, normali 1991–2020); il comportamento termico dell\'abitazione è però una stima euristica e non costituisce una certificazione energetica ufficiale (APE).',

    // Comfort labels (by stars) + tips
    'comfort-5': 'Eccellente',
    'comfort-4': 'Buono',
    'comfort-3': 'Discreto',
    'comfort-2': 'Scarso',
    'comfort-1': 'Critico',
    'tip-windows': 'Consiglio: Installa infissi a doppio o triplo vetro per migliorare drasticamente l\'isolamento termico e acustico.',
    'tip-insulation': 'Consiglio: L\'edificio manca di isolamento alle pareti. Realizzare un cappotto termico ridurrebbe le escursioni stagionali di circa 4°C.',
    'tip-obstruction': 'Consiglio: L\'elevata ostruzione solare limita l\'apporto termico invernale. Ottimizza i colori interni e i punti luce.',
    'tip-ok': 'Consiglio: Il comfort di questa facciata è già ottimo. Considera schermature solari esterne mobili (es. tende) per gestire al meglio il sole estivo.',

    // Obstruction + cardinal
    'obs-high': 'Elevata 🏢',
    'obs-partial': 'Parziale 🌳',
    'obs-none': 'Nessuna ☀️',
    'card-n': 'Nord ❄️',
    'card-ne': 'Nord-Est',
    'card-e': 'Est 🌅',
    'card-se': 'Sud-Est',
    'card-s': 'Sud 🔥',
    'card-sw': 'Sud-Ovest',
    'card-w': 'Ovest 🌇',
    'card-nw': 'Nord-Ovest',

    // Sun exposure note
    'exp-great': '☀️ Ottima esposizione: ~{h}h di sole diretto oggi su questa facciata.',
    'exp-ok': '🌤️ Esposizione discreta: ~{h}h di sole diretto oggi su questa facciata.',
    'exp-low': '🌥️ Poca luce: solo ~{h}h di sole diretto oggi su questa facciata.',
    'exp-none': '🌑 Nessun sole diretto oggi su questa facciata.',

    // Main title
    'main-title': 'Stima {month}, {hour}:00',

    // Geofencing
    'geo-foreign': 'Ops! Ci hai scoperto... 🕵️‍♂️\nSunTrace è attivo solo sul territorio italiano (isole comprese!). Ti abbiamo riposizionato su Roma.',
    'geo-water': '🌊 Qui c\'è solo acqua! SunTrace analizza edifici sulla terraferma, non le nostre (bellissime) acque nazionali. Ti abbiamo riportato su Roma.',

    // Geolocation
    'geoloc-unsupported': '⚠️ La geolocalizzazione non è supportata dal browser.',
    'geoloc-inaccurate': '⚠️ Posizione imprecisa (±{km} km).\nPotrebbe essere una stima via IP/VPN. Verifica i Servizi di Localizzazione.',
    'geoloc-failed': '⚠️ Geolocalizzazione non riuscita.',
    'geoloc-denied': '⚠️ Permesso negato.\nSu Mac: Impostazioni → Privacy → Servizi di Localizzazione → abilita il browser.',
    'geoloc-unavailable': '⚠️ Posizione non disponibile. Verifica che i Servizi di Localizzazione siano attivi.',
    'geoloc-timeout': '⚠️ Timeout: localizzazione troppo lenta. Riprova con una rete Wi-Fi.',

    // Mobile block
    'mobile-title': 'Ops! SunTrace ha bisogno di spazio...',
    'mobile-p1': 'Ci hai scoperto! 🕵️‍♂️ Per il momento l\'esperienza da smartphone non è disponibile.',
    'mobile-p2': 'Collegati da un computer per iniziare a scansionare al meglio ed esplorare l\'esposizione al sole!',

    'months': ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
  },

  en: {
    'app-title': 'SunTrace — Urban Microclimate Simulator',
    'sidebar-aria': 'SunTrace Control Panel',

    'search-card-aria': 'Address search',
    'search-title': '📍 Search Address',
    'search-hint': 'Search an address to begin, then press “Go”.',
    'search-ph': 'Street or city in Italy…',
    'search-input-aria': 'Address search field',
    'search-suggestions-aria': 'Address suggestions',
    'search-go': 'Go',
    'search-go-aria': 'Search address',
    'search-empty': 'No results found',
    'search-neterror': '⚠️ Network error — check your connection',
    'search-notfound': '⚠️ Address not found. Try a different name.',
    'search-neterror-toast': '⚠️ Network error. Check your connection.',

    'output-initial': 'Room temperature estimate',
    'comfort-estimated': 'Estimated Comfort Rate',
    'comfort-tooltip': 'Comfort Rate: estimated thermal comfort index for the home, based on orientation, sun and obstructions.',
    'comfort-hint': 'tap for comfort details',
    'comfort-open-aria': 'Open comfort detail',
    'seasonal-aria': 'Seasonal temperatures',
    'season-winter': 'Winter',
    'season-spring': 'Spring',
    'season-summer': 'Summer',
    'season-autumn': 'Autumn',

    'time-card-aria': 'Time configuration',
    'time-title': '⏱ Solar Clock',
    'time-month': 'Analysis month',
    'time-hour': 'Local time (shadow simulator)',
    'month-slider-aria': 'Select month',
    'hour-slider-aria': 'Select hour',

    'solar-card-aria': 'Solar information',
    'solar-title': '☀️ Solar Data',
    'solar-sunrise': 'Sunrise (local time)',
    'solar-sunset': 'Sunset (local time)',
    'solar-daylength': 'Day length',
    'solar-elevation': 'Solar elevation',
    'solar-azimuth': 'Solar azimuth',
    'below-horizon': '< horizon',

    'facade-card-aria': 'Facade parameters',
    'facade-title': '🛠 Facade Parameters',
    'facade-orientation': 'Orientation / Cardinal',
    'facade-shading': 'Detected shading',
    'facade-rotation': 'Wall rotation',
    'rotation-slider-aria': 'Wall rotation angle',
    'facade-windows': 'Window Type',
    'windows-select-aria': 'Select window type',
    'windows-single': 'Single Glazing',
    'windows-double': 'Double Glazing',
    'windows-triple': 'Triple Glazing / Thermal Break',
    'facade-insulation': 'Wall Insulation',
    'insulation-select-aria': 'Select wall insulation',
    'insulation-none': 'None (Historic Wall)',
    'insulation-coat': 'External Insulation',

    'footer-links-aria': 'Useful links',
    'footer-docs': 'Documentation',
    'footer-github': 'GitHub',
    'footer-privacy': 'Privacy',
    'footer-copy': '© 2026 SunTrace. Meeus/SPA engine — indicative use only.',

    'map-aria': 'Interactive microclimate map',
    'geo-aria': 'Detect my location',
    'geo-title': 'Detect location',
    'panel-open': '☰ Panel',
    'panel-open-aria': 'Open control panel',
    'panel-close': '✕ Close',
    'lang-aria': 'Language / Lingua',

    'modal-close-aria': 'Close modal',
    'modal-title-initial': 'Comfort Rate Detail',
    'modal-title': 'Comfort Rate Analysis — {label}',
    'comfort-rate': 'Comfort Rate',
    'kpi-winter': 'Winter comfort (noon)',
    'kpi-summer': 'Summer comfort (noon)',
    'kpi-windows': 'Window Type',
    'kpi-insulation': 'Wall Insulation',
    'modal-disclaimer': '*Temperatures use real local climate normals (Open-Meteo, 1991–2020); the home\'s thermal behaviour is however a heuristic estimate and is not an official energy certification (APE).',

    'comfort-5': 'Excellent',
    'comfort-4': 'Good',
    'comfort-3': 'Fair',
    'comfort-2': 'Poor',
    'comfort-1': 'Critical',
    'tip-windows': 'Tip: Install double or triple glazing to dramatically improve thermal and acoustic insulation.',
    'tip-insulation': 'Tip: The building lacks wall insulation. External insulation would cut seasonal swings by about 4°C.',
    'tip-obstruction': 'Tip: Heavy solar obstruction limits winter heat gain. Optimise interior colours and lighting.',
    'tip-ok': 'Tip: This facade\'s comfort is already excellent. Consider adjustable external shading (e.g. blinds) to manage summer sun.',

    'obs-high': 'High 🏢',
    'obs-partial': 'Partial 🌳',
    'obs-none': 'None ☀️',
    'card-n': 'North ❄️',
    'card-ne': 'North-East',
    'card-e': 'East 🌅',
    'card-se': 'South-East',
    'card-s': 'South 🔥',
    'card-sw': 'South-West',
    'card-w': 'West 🌇',
    'card-nw': 'North-West',

    'exp-great': '☀️ Great exposure: ~{h}h of direct sun today on this facade.',
    'exp-ok': '🌤️ Fair exposure: ~{h}h of direct sun today on this facade.',
    'exp-low': '🌥️ Low light: only ~{h}h of direct sun today on this facade.',
    'exp-none': '🌑 No direct sun today on this facade.',

    'main-title': 'Estimate {month}, {hour}:00',

    'geo-foreign': 'Oops! You found us... 🕵️‍♂️\nSunTrace only works over Italian territory (islands included!). We moved you back to Rome.',
    'geo-water': '🌊 That\'s open water! SunTrace analyses buildings on land, not our (beautiful) national waters. We moved you back to Rome.',

    'geoloc-unsupported': '⚠️ Geolocation is not supported by your browser.',
    'geoloc-inaccurate': '⚠️ Inaccurate position (±{km} km).\nIt may be an IP/VPN estimate. Check your Location Services.',
    'geoloc-failed': '⚠️ Geolocation failed.',
    'geoloc-denied': '⚠️ Permission denied.\nOn Mac: Settings → Privacy → Location Services → enable your browser.',
    'geoloc-unavailable': '⚠️ Position unavailable. Make sure Location Services are on.',
    'geoloc-timeout': '⚠️ Timeout: geolocation too slow. Try again on Wi-Fi.',

    'mobile-title': 'Oops! SunTrace needs some room...',
    'mobile-p1': 'You found us! 🕵️‍♂️ The smartphone experience isn\'t available yet.',
    'mobile-p2': 'Connect from a computer to start scanning and explore sun exposure at its best!',

    'months': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  },
};

const LANG_KEY = 'suntrace_lang';

function resolveInitialLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'it' || saved === 'en') return saved;
  } catch { /* localStorage unavailable */ }
  const nav = (navigator.language || 'it').toLowerCase();
  return nav.startsWith('en') ? 'en' : 'it';
}

let currentLang = resolveInitialLang();

export function getLang() { return currentLang; }

export function setLang(lang) {
  currentLang = (lang === 'en') ? 'en' : 'it';
  try { localStorage.setItem(LANG_KEY, currentLang); } catch { /* non-fatal */ }
  document.documentElement.lang = currentLang;
}

/** Translate a key, replacing {name} placeholders from vars. Falls back to IT, then the key. */
export function t(key, vars) {
  const dict = STRINGS[currentLang] || STRINGS.it;
  let s = dict[key];
  if (s == null) s = STRINGS.it[key];
  if (s == null) return key;
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(vars[k]);
  return s;
}

/** Localised month name (0-based). */
export function monthName(i) {
  return (STRINGS[currentLang].months || STRINGS.it.months)[i];
}

/** Fill all static-text elements marked with data-i18n* attributes. */
export function applyTranslations(root = document) {
  document.title = t('app-title');
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
  root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
  root.querySelectorAll('[data-i18n-title]').forEach(el => { el.setAttribute('title', t(el.getAttribute('data-i18n-title'))); });
}
