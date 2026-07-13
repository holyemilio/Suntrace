# SunTrace — La Storia del Progetto

Il percorso di sviluppo di **SunTrace** racconta l'evoluzione di uno strumento da semplice prototipo a simulatore microclimatico evoluto per la valutazione degli immobili. Di seguito sono descritte le tappe principali di questo viaggio tecnologico.

---

## 📍 v0.3.3 — Il Prototipo (Maggio 2026)
*L'inizio del progetto come esperimento a file singolo.*

*   **Tecnologia**: Tutto contenuto all'interno di un unico file HTML (`suntrace-old.html`).
*   **Algoritmo**: Utilizzava il modello semplificato di Cooper per stimare la posizione solare.
*   **Limiti**: 
    *   Nessun calcolo di alba o tramonto.
    *   La formula dell'azimut era invertita, portando a stime errate sulla direzione del sole.
    *   Nessuna gestione dei fusi orari o dell'ora legale (le simulazioni estive sballavano fino a 80 minuti).
    *   Nessuna mappa interattiva complessa.

---

## 🚀 v1.0.0 — La Svolta Modulare (Giugno 2026)
*Ristrutturazione completa e introduzione dell'accuratezza astronomica.*

*   **Architettura**: Transizione ad un'architettura modulare moderna basata su **Moduli ES nativi** (suddivisa in `solar.js`, `climate.js` e `ui.js`).
*   **Motore Astronomico**: Integrazione degli algoritmi di Jean Meeus (*Astronomical Algorithms*, 2ª ed.), con precisione millimetrica (< 0.5° di errore) per altezza, direzione del sole, alba, tramonto e durata del giorno.
*   **Gestione DST**: Correzione automatica del fuso orario e dell'ora legale in Italia tramite l'API `Intl.DateTimeFormat`.
*   **Visualizzazione**: Introduzione della mappa interattiva Leaflet e di un grafico in CSS che mostra l'esposizione solare su 8 facciate diverse per il giorno selezionato o come media annuale.
*   **Qualità del Codice**: Introduzione di **23 test automatici** nativi in Node.js per convalidare i calcoli contro la libreria di riferimento *SunCalc*.

---

## 🏡 v2.0.0 — Lo Strumento per la Casa (Versione Corrente, Luglio 2026)
*Evoluzione dell'app in uno strumento mirato alla valutazione degli appartamenti.*

*   **Addio Classe Energetica, Benvenuto Comfort Rate**: La classe energetica (A-G), ritenuta confondibile con quella degli elettrodomestici, viene sostituita dall'indice **Comfort Rate** (Comfort Abitativo Stimato), rappresentato graficamente da una valutazione a **5 stelle** e arricchito da un tooltip fluttuante in stile GitHub.
*   **Temperature Reali con Open-Meteo**: Ora, quando l'utente clicca sulla mappa, l'app interroga in tempo reale l'**API Open-Meteo** scaricando le medie climatiche reali del punto esatto (dalle Alpi a Lampedusa), con fallback silenzioso sulle tabelle climatiche statiche di Roma in caso di errore di rete.
*   **Personalizzazione dell'Immobile**: Aggiunta di controlli interattivi nella barra laterale per impostare il tipo di finestre (*vetro singolo, doppio o triplo*) e l'isolamento delle pareti (*cappotto termico*). Questi parametri modificano attivamente le temperature stimate in inverno ed estate, influenzando il Comfort Rate.
*   **Geofencing & Limitazione Italia**: L'applicazione viene ristretta al territorio italiano. Se l'utente clicca all'estero, appare un popup divertente: *"Ops! Ci hai scoperto... 🕵️‍♂️"*.
*   **Esperienza Desktop Ottimizzata**: Per evitare problemi di clic e precisione sui piccoli schermi, viene introdotto un blocco che rileva l'uso da smartphone e invita l'utente a connettersi da computer.
