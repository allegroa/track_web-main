# Regole di Layout, Stile e Colori (Design System RAMSYS)

Questo documento raccoglie in modo centralizzato e strutturato le specifiche del design system, dello stile, dei colori e delle regole di layout utilizzate nei moduli di **RAMSYS** (WebOne), come *TGM* e *RailProfile*.

---

## 1. Principi di Layout e Tipografia

* **Font e Tipografia**: Utilizzo di un font Sans-serif moderno ed elegante. I font di riferimento sono **Inter** o **Outfit**. Vengono impiegati pesi differenti (regular, medium, semibold, bold, extrabold) per stabilire una chiara gerarchia visiva delle informazioni.
* **Layout Principale della Pagina**:
  * **Layout Split 50/50 (Data Visualizer)**: La schermata principale del visualizzatore dati è divisa a metà. La parte sinistra contiene i pannelli informativi, i filtri e le configurazioni di tolleranza. La parte destra ospita la visualizzazione cartografica (Google Maps iframe o Leaflet).
  * **Card e Contenitori**: Tutte le tabelle, i dettagli e le sezioni principali sono racchiusi all'interno di card bianche con stili standardizzati:
    * Background: `bg-white`
    * Angoli arrotondati: `rounded-xl` (o `rounded-lg`)
    * Bordo sottile chiaro: `border border-slate-100` (o `border-slate-200`)
    * Ombra morbida: `shadow-sm`

---

## 2. Elementi di Navigazione e Pulsanti

* **Header del Modulo/Pagina**:
  * **Logo & Titolo**: Posizionato in alto a sinistra. Mostra l'icona del logo o il testo bold in grigio scuro (`text-slate-800`). È solitamente presente una dicitura del modulo con un badge ad angoli arrotondati (es. `v1.0` o `v1.6`) con sfondo azzurro chiaro (`bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded`).
  * **Sottotitolo**: Posto subito sotto il titolo principale in colore grigio chiaro e stile regolare (`text-slate-400 text-sm`).
* **Pulsanti di Configurazione e Azioni Primarie**:
  * Pulsante scuro standard: `bg-slate-900 text-white hover:bg-slate-800 px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-all`.
  * Allineamento: Tipicamente posizionato in alto a destra della sezione o dell'header.
* **Effetti Hover e Transizioni**:
  * Hover sulle righe delle tabelle: effetto morbido con `hover:bg-slate-50 transition-colors`.
  * Sezioni espanse o dettagli aggiuntivi: sfondo grigio/azzurro ultraleggero con bordo chiaro (`bg-slate-50/50 border border-slate-100 shadow-sm`).

---

## 3. Codifica dei Colori per Indici e Badge

### 3.1 Badge Indice di Qualità (Quality Index)
L'indice di qualità (da 0% a 100%) viene mostrato tramite badge colorati con angoli arrotondati e caratteri in grassetto semi-bold:
* **Eccellente (`> 95%`)**: Sfondo verde chiaro, testo verde scuro.
  * *Tailwind*: `bg-green-50 text-green-700 border border-green-100 font-semibold px-2.5 py-1 rounded-full text-xs` (o variante `bg-green-100 text-green-700 border border-green-200`).
* **Buono (`85% - 95%`)**: Sfondo giallo/ocra chiaro, testo giallo scuro.
  * *Tailwind*: `bg-yellow-50 text-yellow-700 border border-yellow-100 font-semibold px-2.5 py-1 rounded-full text-xs` (o variante `bg-yellow-100 text-yellow-700 border border-yellow-200`).
* **Attenzione (`70% - 85%`)**: Sfondo arancione chiaro, testo arancione scuro.
  * *Tailwind*: `bg-orange-50 text-orange-700 border border-orange-100 font-semibold px-2.5 py-1 rounded-full text-xs` (o variante `bg-orange-100 text-orange-700 border border-orange-200`).
* **Critico (`< 70%`)**: Sfondo rosso chiaro, testo rosso scuro.
  * *Tailwind*: `bg-red-50 text-red-700 border border-red-100 font-semibold px-2.5 py-1 rounded-full text-xs` (o variante `bg-red-100 text-red-700 border border-red-200`).

---

## 4. Specifiche del Grafico Multi-Asse (Chart.js / Oscilloscope Stack)

La visualizzazione dei parametri di usura o geometria (es. `W1-W4`) sul grafico lineare deve seguire una struttura ad **oscilloscopio impilato verticalmente**:
* **Assi Y Stacked**: I parametri sono distribuiti verticalmente assegnando lo stesso identificativo di stack (`stack: 'oscilloscope'`) e un peso uniforme (`stackWeight: 1`).
* **Asse X Chilometrico**: L'asse orizzontale rappresenta lo spazio ferroviario in chilometri e deve essere formattato rigorosamente nel formato `KM+Metri` (es. `100.290` espresso come `100+290`).
* **Linee di Soglia Orizzontali (Annotations)**: Le soglie configurate per ciascun canale (es. $T1-T4$) sono disegnate come linee tratteggiate orizzontali all'interno della rispettiva traccia (`borderDash: [5, 5]` o `[4, 4]`).
* **Segmentazione Dinamica del Colore dei Tracciati**:
  Ciascun segmento del tracciato sul grafico cambia colore dinamicamente in base al confronto locale con le soglie di tolleranza impostate:
  * **Verde** (`valore <= T1`): Condizione ottimale / eccellente.
  * **Giallo** (`T1 < valore <= T2`): Condizione buona / avviso di manutenzione.
  * **Arancione** (`T2 < valore <= T3`): Stato di attenzione.
  * **Arancione Scuro** (`T3 < valore <= T4`): Stato di pre-allarme.
  * **Rosso** (`valore > T4`): Stato critico / allarme di sicurezza.
* **Controllo Mappa Integrato**: Il passaggio del cursore sull'asse chilometrico del grafico (hover) deve aggiornare a circa ~30fps il marker della mappa interattiva associando le coordinate GPS corrispondenti.
