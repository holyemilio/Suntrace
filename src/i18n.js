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
    'app-error': '⚠️ Si è verificato un errore imprevisto.\n{detail}',

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
    'time-month': 'Mese di analisi',
    'time-hour': 'Ora locale',
    'tip-time-month': 'Il mese scelto aggiorna la posizione del sole, le temperature stagionali e il Comfort Rate.',
    'tip-time-hour': "L'ora locale muove il sole sulla mappa e sulla bussola: mostra dove cade l'ombra e se la facciata è illuminata in quel momento.",
    'month-slider-aria': 'Seleziona mese',
    'hour-slider-aria': 'Seleziona ora',

    // Solar
    'solar-card-aria': 'Informazioni Solari',
    'solar-sunrise': 'Alba (ora locale)',
    'solar-sunset': 'Tramonto (ora locale)',
    'solar-daylength': 'Durata del giorno',
    'solar-elevation': 'Elevazione solare',
    'solar-azimuth': 'Azimut solare',
    'solar-direct': 'Sole diretto',
    'sun-yes': '☀️ In sole',
    'sun-shadow': '🌑 In ombra',
    'sun-other-side': '🧭 Sole sull\'altro lato',
    'sun-night': '— Sotto l\'orizzonte',
    'tip-direct-sun': 'Dice se in questo momento il sole colpisce davvero questa facciata. «In ombra» = un edificio vicino lo blocca (sagome e altezze reali da OpenStreetMap, viste dal piano scelto); «Sole sull\'altro lato» = nessun ostacolo, ma la parete è rivolta altrove.',
    'below-horizon': '< orizzonte',

    // Local climate
    'climate-card-aria': 'Clima del luogo',
    'climate-humidity': 'Umidità media',
    'climate-wind': 'Vento medio',
    'climate-rain': 'Pioggia del mese',
    'climate-feels': 'Percepita ora',

    // Facade
    'facade-card-aria': 'Parametri Geometrici Facciata',
    'facade-windows': 'Tipo di Infissi',
    'windows-select-aria': 'Seleziona tipo di infissi',
    'windows-single': 'Vetro Singolo',
    'windows-double': 'Doppio Vetro',
    'windows-triple': 'Triplo / Termico',
    'facade-insulation': 'Isolamento Muri',
    'insulation-select-aria': 'Seleziona isolamento pareti',
    'insulation-none': 'Muro Storico',
    'insulation-coat': 'Cappotto Termico',
    'insulation-fortress': 'Casa Passiva',
    'placement-hint': 'Poni il punto sul muro da analizzare: non dentro l\'edificio, non in strada.',
    'hint-aria': 'Suggerimento',
    'hint-toggle-aria': 'Mostra/nascondi il suggerimento',
    'mobile-info-aria': 'Legenda e suggerimenti',
    'mobile-drawer-aria': 'Impostazioni',
    'mobile-drawer-open': 'Imposta',
    'mobile-solar-aria': 'Dati solari',
    'mobile-climate-aria': 'Clima del luogo',
    'mobile-compass-aria': 'Orientamento della facciata',

    // Footer
    'footer-links-aria': 'Link utili',
    'footer-docs': 'Documentazione',
    'footer-github': 'GitHub',
    'footer-privacy': 'Privacy',
    'footer-copy': '© 2026 SunTrace. Motore Meeus/SPA — solo uso indicativo.',

    // Map / buttons
    'map-aria': 'Mappa Interattiva Microclimatica',
    'legend-title': 'Legenda',
    'legend-aria': 'Legenda',
    'legend-toggle-aria': 'Mostra/nascondi la legenda',
    'legend-point': 'Punto analizzato',
    'legend-facade': 'Orientamento facciata',
    'legend-sun': 'Direzione del sole',
    'legend-shadow': 'Ombra proiettata',
    'legend-area': 'Area di analisi',
    'geo-aria': 'Rileva la mia posizione geografica',
    'geo-title': 'Rileva posizione',
    'lang-aria': 'Lingua / Language',
    'compass-aria': 'Orientamento della facciata',
    'dir-n': 'N', 'dir-ne': 'NE', 'dir-e': 'E', 'dir-se': 'SE',
    'dir-s': 'S', 'dir-sw': 'SO', 'dir-w': 'O', 'dir-nw': 'NO',
    'floor-label': 'Piano',
    'floor-aria': 'Piano dell\'abitazione',
    'floor-ground': 'Piano terra',

    // Modal
    'modal-close-aria': 'Chiudi modale',
    'modal-title-initial': 'Dettaglio Comfort Rate',
    'modal-title': 'Analisi Comfort Rate — {label}',
    'comfort-rate': 'Comfort Rate',
    'kpi-winter': 'Comfort Inverno (mezzogiorno)',
    'kpi-summer': 'Comfort Estate (mezzogiorno)',
    'kpi-windows': 'Tipo di Infissi',
    'kpi-insulation': 'Isolamento Pareti',
    'lbl-feels-summer': 'Percepita estate',
    'lbl-humidity': 'Umidità media',
    'lbl-rain': 'Pioggia annua',
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
    'tip-humid': 'Consiglio: L\'elevata umidità estiva accentua la sensazione di caldo (afa). Favorisci la ventilazione naturale, notturna, e schermature esterne mobili.',
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

    // Landing page
    'landing-title': 'SunTrace — Conosci il sole di casa tua',
    'back-home': 'Home',
    'back-home-aria': 'Torna alla home',
    'landing-hero-eyebrow': 'Prima di scegliere casa',
    'landing-hero-title': 'Il sole non si vede in planimetria.',
    'landing-hero-sub': 'SunTrace analizza il microclima di qualsiasi indirizzo in Italia: orientamento, ombre reali e comfort termico stagionale, in pochi secondi.',
    'landing-search-aria': 'Cerca un indirizzo per iniziare',
    'landing-why-eyebrow': 'La missione',
    'landing-why-title': 'Perché SunTrace',
    'landing-f1-title': 'Il clima sta cambiando',
    'landing-f1-body': 'Il riscaldamento non è costante: accelera. In Italia la temperatura media sale di 0,10°C a decennio se guardiamo dal 1800, ma di 0,44°C a decennio se guardiamo dal 1980 — quasi 4 volte più veloce.',
    'landing-f1-caption': '*Fonte: ISPRA, tasso di riscaldamento medio per decennio in Italia (dati aggiornati al 2024).',
    'landing-f1-p1': 'dal 1800',
    'landing-f1-p2': 'dal 1900',
    'landing-f1-p3': 'dal 1950',
    'landing-f1-p4': 'dal 1980',
    'landing-f1-v1': '0,10°C',
    'landing-f1-v2': '0,16°C',
    'landing-f1-v3': '0,28°C',
    'landing-f1-v4': '0,44°C',
    'landing-f2-title': 'Bollette più leggere',
    'landing-f2-body': 'Riscaldamento, raffrescamento e acqua calda pesano da soli il 70–75% dell\'energia di una casa. Un buon orientamento non è un dettaglio estetico: è la leva più semplice su quella spesa.',
    'landing-f2-caption': '*Spesa media stagione 2025/26, abitazione 70 mq classe energetica G (fonte: ECCO Climate). **Stima indicativa: letteratura di settore ed ENEA indicano fino al 60% di riduzione del fabbisogno estivo con un buon orientamento; qui applichiamo una stima prudente del 20% sulla spesa totale, che varia per edificio e zona climatica.',
    'landing-f2-l1a': 'Spesa media',
    'landing-f2-l1b': '2025/26*',
    'landing-f2-l2a': 'Con buon',
    'landing-f2-l2b': 'orientamento**',
    'landing-f2-v1': '€ 1.079',
    'landing-f2-v2': '≈ € 863',
    'landing-f3-title': 'Meno energia, meno impatto',
    'landing-f3-body': 'Il 70–75% dell\'energia domestica se ne va in climatizzazione. Tagliarne anche solo una parte, con un buon orientamento, riduce nella stessa proporzione le emissioni di CO₂ legate al riscaldamento.',
    'landing-f3-caption': '*Fonte: ENEA, quota di energia domestica per climatizzazione e acqua calda. Il legame fra energia risparmiata e CO₂ evitata è diretto per il riscaldamento a gas (ISPRA: 1,88 kg CO₂/m³ di gas).',
    'landing-f3-stat': '70–75%',
    'landing-f3-statlbl': 'dell\'energia di casa*',
    'landing-f4-title': 'Scegli con i dati, non a occhio',
    'landing-f4-body': 'Confronta appartamenti diversi, capisci cosa stai davvero comprando o affittando, e trova una casa che lavora con il sole invece che contro.',
    'landing-cta-title': 'Pronto a scoprirlo?',
    'landing-cta-sub': 'Cerca un indirizzo in Italia: il microclima della tua prossima casa è a un clic di distanza.',
    'landing-cta-btn': 'Inizia ora',

    // Privacy page
    'privacy-title': 'Privacy — SunTrace',
    'privacy-back': '← Torna a SunTrace',
    'privacy-h1': 'Privacy',
    'privacy-lead': 'In breve: SunTrace non ha un server, non ha account, non usa cookie di profilazione e non ti traccia. Quello che segue spiega esattamente cosa succede quando usi il sito.',
    'privacy-s1-title': 'Nessun server, nessun account',
    'privacy-s1-body': 'SunTrace è un sito statico: non esiste un server che riceve o conserva i tuoi dati, non c\'è registrazione, non c\'è login. Il calcolo (posizione del sole, temperature, Comfort Rate) avviene nel tuo browser.',
    'privacy-s2-title': 'Cosa resta nel tuo browser',
    'privacy-s2-body': 'Due cose, salvate solo sul tuo dispositivo (mai su un server nostro): la lingua scelta (IT/EN), e una cache degli indirizzi e dei dati climatici già cercati, per non ripetere le stesse richieste. Puoi cancellarle in qualsiasi momento dalle impostazioni del browser ("cancella dati del sito") o navigando in una finestra privata/in incognito.',
    'privacy-s3-title': 'Servizi di terze parti',
    'privacy-s3-body': 'Per funzionare, il tuo browser contatta direttamente questi servizi esterni, ciascuno secondo la propria informativa: OpenStreetMap (mappa), Nominatim (ricerca indirizzi), Overpass (dati sugli edifici) e Open-Meteo (clima). Questi servizi vedono la richiesta e il tuo indirizzo IP, come per qualunque sito che li utilizza — SunTrace non aggiunge tracciamento oltre a questo. Caratteri e libreria della mappa (Leaflet) sono serviti direttamente dal nostro sito: nessuna richiesta parte verso Google o altri CDN.',
    'privacy-s4-title': 'Nessuna analytics, nessuna pubblicità',
    'privacy-s4-body': 'Non usiamo Google Analytics né strumenti simili, non ci sono pixel di tracciamento, non vendiamo né condividiamo dati con terzi per scopi pubblicitari — semplicemente perché non ne raccogliamo.',
  },

  en: {
    'app-title': 'SunTrace — Urban Microclimate Simulator',
    'sidebar-aria': 'SunTrace Control Panel',

    'search-card-aria': 'Address search',
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
    'app-error': '⚠️ Something went wrong.\n{detail}',

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
    'time-month': 'Analysis month',
    'time-hour': 'Local time',
    'tip-time-month': 'The selected month updates the sun position, the seasonal temperatures and the Comfort Rate.',
    'tip-time-hour': 'Local time moves the sun on the map and on the compass: it shows where the shadow falls and whether the facade is lit at that moment.',
    'month-slider-aria': 'Select month',
    'hour-slider-aria': 'Select hour',

    'solar-card-aria': 'Solar information',
    'solar-sunrise': 'Sunrise (local time)',
    'solar-sunset': 'Sunset (local time)',
    'solar-daylength': 'Day length',
    'solar-elevation': 'Solar elevation',
    'solar-azimuth': 'Solar azimuth',
    'solar-direct': 'Direct sun',
    'sun-yes': '☀️ In sun',
    'sun-shadow': '🌑 In shadow',
    'sun-other-side': '🧭 Sun on the other side',
    'sun-night': '— Below horizon',
    'tip-direct-sun': 'Tells you whether the sun actually reaches this facade right now. "In shadow" = a nearby building blocks it (real OpenStreetMap footprints and heights, seen from your floor); "Sun on the other side" = nothing blocks it, but the wall faces elsewhere.',
    'below-horizon': '< horizon',

    // Local climate
    'climate-card-aria': 'Local climate',
    'climate-humidity': 'Avg humidity',
    'climate-wind': 'Avg wind',
    'climate-rain': 'Rain this month',
    'climate-feels': 'Feels like now',

    'facade-card-aria': 'Facade parameters',
    'facade-windows': 'Window Type',
    'windows-select-aria': 'Select window type',
    'windows-single': 'Single Glazing',
    'windows-double': 'Double Glazing',
    'windows-triple': 'Triple / Thermal',
    'facade-insulation': 'Wall Insulation',
    'insulation-select-aria': 'Select wall insulation',
    'insulation-none': 'Bare Wall',
    'insulation-coat': 'External Coat',
    'insulation-fortress': 'Passive House',
    'placement-hint': 'Place the point on the wall you\'re analysing — not inside the building, not in the street.',
    'hint-aria': 'Hint',
    'hint-toggle-aria': 'Show/hide the hint',
    'mobile-info-aria': 'Legend and hints',
    'mobile-drawer-aria': 'Settings',
    'mobile-drawer-open': 'Settings',
    'mobile-solar-aria': 'Solar data',
    'mobile-climate-aria': 'Local climate',
    'mobile-compass-aria': 'Facade orientation',

    'footer-links-aria': 'Useful links',
    'footer-docs': 'Documentation',
    'footer-github': 'GitHub',
    'footer-privacy': 'Privacy',
    'footer-copy': '© 2026 SunTrace. Meeus/SPA engine — indicative use only.',

    'map-aria': 'Interactive microclimate map',
    'legend-title': 'Legend',
    'legend-aria': 'Legend',
    'legend-toggle-aria': 'Show/hide the legend',
    'legend-point': 'Analysed point',
    'legend-facade': 'Facade orientation',
    'legend-sun': 'Sun direction',
    'legend-shadow': 'Cast shadow',
    'legend-area': 'Analysis area',
    'geo-aria': 'Detect my location',
    'geo-title': 'Detect location',
    'lang-aria': 'Language / Lingua',
    'compass-aria': 'Facade orientation',
    'dir-n': 'N', 'dir-ne': 'NE', 'dir-e': 'E', 'dir-se': 'SE',
    'dir-s': 'S', 'dir-sw': 'SW', 'dir-w': 'W', 'dir-nw': 'NW',
    'floor-label': 'Floor',
    'floor-aria': 'Home floor',
    'floor-ground': 'Ground floor',

    'modal-close-aria': 'Close modal',
    'modal-title-initial': 'Comfort Rate Detail',
    'modal-title': 'Comfort Rate Analysis — {label}',
    'comfort-rate': 'Comfort Rate',
    'kpi-winter': 'Winter comfort (noon)',
    'kpi-summer': 'Summer comfort (noon)',
    'kpi-windows': 'Window Type',
    'kpi-insulation': 'Wall Insulation',
    'lbl-feels-summer': 'Summer feels-like',
    'lbl-humidity': 'Avg humidity',
    'lbl-rain': 'Annual rainfall',
    'modal-disclaimer': '*Temperatures use real local climate normals (Open-Meteo, 1991–2020); the home\'s thermal behaviour is however a heuristic estimate and is not an official energy certification (APE).',

    'comfort-5': 'Excellent',
    'comfort-4': 'Good',
    'comfort-3': 'Fair',
    'comfort-2': 'Poor',
    'comfort-1': 'Critical',
    'tip-windows': 'Tip: Install double or triple glazing to dramatically improve thermal and acoustic insulation.',
    'tip-insulation': 'Tip: The building lacks wall insulation. External insulation would cut seasonal swings by about 4°C.',
    'tip-obstruction': 'Tip: Heavy solar obstruction limits winter heat gain. Optimise interior colours and lighting.',
    'tip-humid': 'Tip: High summer humidity intensifies the feeling of heat. Favour natural, night-time ventilation and adjustable external shading.',
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

    // Landing page
    'landing-title': 'SunTrace — Know your home’s sun',
    'back-home': 'Home',
    'back-home-aria': 'Back to home',
    'landing-hero-eyebrow': 'Before you choose a home',
    'landing-hero-title': 'The sun doesn’t show up on the floor plan.',
    'landing-hero-sub': 'SunTrace analyses the microclimate of any address in Italy: orientation, real shadows and seasonal thermal comfort, in seconds.',
    'landing-search-aria': 'Search an address to begin',
    'landing-why-eyebrow': 'The mission',
    'landing-why-title': 'Why SunTrace',
    'landing-f1-title': 'The climate is changing',
    'landing-f1-body': 'The warming isn’t steady — it’s accelerating. Italy’s average temperature has risen 0.10°C per decade since 1800, but 0.44°C per decade since 1980 — nearly 4 times faster.',
    'landing-f1-caption': '*Source: ISPRA, average warming rate per decade in Italy (data through 2024).',
    'landing-f1-p1': 'since 1800',
    'landing-f1-p2': 'since 1900',
    'landing-f1-p3': 'since 1950',
    'landing-f1-p4': 'since 1980',
    'landing-f1-v1': '0.10°C',
    'landing-f1-v2': '0.16°C',
    'landing-f1-v3': '0.28°C',
    'landing-f1-v4': '0.44°C',
    'landing-f2-title': 'Lighter energy bills',
    'landing-f2-body': 'Heating, cooling and hot water alone account for 70–75% of a home’s energy use. Good orientation isn’t a cosmetic detail — it’s the simplest lever on that bill.',
    'landing-f2-caption': '*Average bill, 2025/26 season, 70 sqm home, energy class G (source: ECCO Climate). **Indicative estimate: industry literature and ENEA point to up to 60% lower summer cooling demand with good orientation; we apply a conservative 20% to the total bill here, which varies by building and climate zone.',
    'landing-f2-l1a': 'Average bill',
    'landing-f2-l1b': '2025/26*',
    'landing-f2-l2a': 'With good',
    'landing-f2-l2b': 'orientation**',
    'landing-f2-v1': '€1,079',
    'landing-f2-v2': '≈ €863',
    'landing-f3-title': 'Less energy, less impact',
    'landing-f3-body': '70–75% of home energy goes into heating and cooling. Cutting even part of that, with good orientation, lowers heating-related CO₂ emissions by roughly the same share.',
    'landing-f3-caption': '*Source: ENEA, share of home energy used for climate control and hot water. Energy saved and CO₂ avoided track directly for gas heating (ISPRA: 1.88 kg CO₂/m³ of gas).',
    'landing-f3-stat': '70–75%',
    'landing-f3-statlbl': 'of home energy*',
    'landing-f4-title': 'Choose with data, not guesswork',
    'landing-f4-body': 'Compare different apartments, understand what you’re really buying or renting, and find a home that works with the sun instead of against it.',
    'landing-cta-title': 'Ready to see it?',
    'landing-cta-sub': 'Search any address in Italy: your next home’s microclimate is one click away.',
    'landing-cta-btn': 'Start now',

    // Privacy page
    'privacy-title': 'Privacy — SunTrace',
    'privacy-back': '← Back to SunTrace',
    'privacy-h1': 'Privacy',
    'privacy-lead': 'Short version: SunTrace has no server, no accounts, no tracking cookies, and doesn’t track you. What follows explains exactly what happens when you use the site.',
    'privacy-s1-title': 'No server, no account',
    'privacy-s1-body': 'SunTrace is a static site: there is no server receiving or storing your data, no sign-up, no login. The computation (sun position, temperatures, Comfort Rate) happens in your browser.',
    'privacy-s2-title': 'What stays in your browser',
    'privacy-s2-body': 'Two things, saved only on your device (never on a server of ours): your chosen language (IT/EN), and a cache of addresses and climate data you\'ve already looked up, so the same requests aren\'t repeated. You can clear both at any time from your browser settings ("clear site data") or by browsing in a private/incognito window.',
    'privacy-s3-title': 'Third-party services',
    'privacy-s3-body': 'To work, your browser talks directly to these external services, each under its own policy: OpenStreetMap (map), Nominatim (address search), Overpass (building data) and Open-Meteo (climate). These services see the request and your IP address, as with any site that uses them — SunTrace adds no tracking beyond that. Typefaces and the map library (Leaflet) are served straight from our own site: no request ever goes to Google or other CDNs.',
    'privacy-s4-title': 'No analytics, no ads',
    'privacy-s4-body': 'We don\'t use Google Analytics or similar tools, there are no tracking pixels, and we don\'t sell or share data with third parties for advertising — simply because we don\'t collect any.',
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
