### Prompt di Sviluppo: TGM_database_visualizzatore

Crea un componente React per la visualizzazione e la gestione del database delle sessioni del modulo **TGM (Track Geometry Measurement)**. Questa interfaccia andrà a sostituire l'attuale cartella "ServerFile" all'interno della pagina "TGM Visualizer v1.6". L'interfaccia deve replicare un design pulito, moderno e professionale.

---

#### 1. Layout e Design System (Aesthetic Premium)

* **Font e Tipografia**: Utilizza un font Sans-serif pulito (preferibilmente **Inter** o **Outfit**) con pesi differenti per definire chiaramente la gerarchia visiva.
* **Header del Modulo/Pagina**:
  * **Logo & Titolo**: Posizionato in alto a sinistra. Mostra il testo bold **TGM Database** in grigio scuro (`text-slate-800`).
  * **Sottotitolo**: Immediatamente sotto il titolo principale, visualizza il testo **TGM Visualizer v1.6** in colore grigio chiaro e stile regolare (`text-slate-400 text-sm`).
  * **Pulsante di Configurazione**: Posizionato in alto a destra. Bottone scuro (`bg-slate-900 text-white hover:bg-slate-800 px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-all`) con l'icona di un ingranaggio (cog) e l'etichetta **Tolleranze / Configurazione**.
* **Contenitore Lista/Tabella (Card)**:
  * L'elenco o tabella delle cartelle (sessioni) deve essere inserito in un contenitore bianco (`bg-white`) con angoli arrotondati (`rounded-xl`), bordo sottile chiaro (`border border-slate-100`) e un'ombra morbida (`shadow-sm`).

---

#### 2. Requisito Specifico: Identificativo di Debug
* **Nome Univoco di Debug**: *Esclusivamente in fase di debug*, in basso a destra all'interno della card o della riga di ogni cartella di sessione, deve essere posizionato un nome/identificativo univoco (corrispondente al nome della cartella sorgente o al suo ID). 
* Questo identificativo serve per il tracciamento dei file.
* **Spegnimento post-debug**: Terminata la fase di debug, tramite un flag di ambiente o una configurazione, questi identificativi dovranno sparire dall'interfaccia utente.

---

#### 3. Lingua di Default
Tutti i testi dell'interfaccia utente (colonne, pulsanti, etichette) devono essere rigorosamente in lingua inglese di default.

---

#### 4. Struttura e Colonne della Tabella

La vista visualizza le directory di sessione del TGM, che seguono il pattern `YYYY.MM.DD HH.MM.SSK[Km]+[Meter]~K[Km]+[Meter]`.

1. **SELECT**: Contiene una checkbox per la selezione della riga o cartella (`w-12 text-center`).
2. **MEASUREMENT DATE**: Data della misurazione estratta dal nome cartella. Formattata come `YYYY.MM.DD` (es. `2026.02.27`). Include icona di ordinamento.
3. **MEASUREMENT TIME**: Ora della misurazione. Formattata come `HH:MM:SS` (es. `00:22:18`). Include icona di ordinamento.
4. **STARTING KM**: Progressiva chilometrica iniziale. Formattata rigorosamente con 3 cifre decimali (es. `100.000`). Include icona di ordinamento.
5. **ENDING KM**: Progressiva chilometrica finale. Formattata rigorosamente con 3 cifre decimali (es. `100.500`). Include icona di ordinamento.
6. **LENGTH (KM)**: Lunghezza totale della tratta calcolata come differenza assoluta tra `starting_km` ed `ending_km`. Formattata con 3 cifre decimali.
7. **START STATION**: Identificativo della stazione di partenza estratto dal parametro "Line Name" del file CSV (es. `XDL`). 
   * **Validazione:** Il campo accetta esclusivamente caratteri alfabetici (nessun numero o data). In caso contrario, verrà esposto un alert visivo (⚠️) indicando che il valore non è valido.
   * **Modifica Manuale:** È presente un'icona a forma di matita (✏️) al passaggio del mouse che permette all'utente di correggere il valore manualmente; il salvataggio modificherà permanentemente il file metadati json (`_db.json`) della sessione previa richiesta di conferma.
8. **DIR.**: Direzione del treno estratta dal parametro "Line Name" del file CSV (es. `UP` o `DN`).
9. **FILES PRESENT**: Tre indicatori/badge visivi che mostrano la presenza dei 3 file CSV obbligatori:
   * **Parametri** (da `軌道參數報表.csv`)
   * **TQI** (da `軌道TQI報表.csv`)
   * **Eccedenze** (da `超限報表.csv`)
10. **ACTIONS**: Contiene due icone di azione allineate a destra:
    * Una freccia o icona di play per **Caricare/Visualizzare** i dati nel grafico.
    * Un cestino per **Eliminare** la cartella della sessione.

---

#### 5. Funzionalità e Comportamenti Utente

* **Ordinamento (Sorting)**:
  * Cliccando sulle intestazioni abilitate (Date, Time, Starting KM, ecc.) l'elenco si ordina, aggiornando la direzione dell'icona.
* **Hover ed Espansione Dati (TQI o Eccedenze)**:
  * Al passaggio del mouse su una cartella/riga (effetto hover morbido con `bg-slate-50/50`), può apparire un riquadro o una sezione espansa con la sintesi delle eccedenze o dell'indice TQI, se disponibili, estraendo rapidamente i dati dal backend.
* **Azioni CRUD**:
  * **Caricamento**: Selezionando la cartella si innesca il caricamento asincrono dei dati (tramite le API `/api/tgm/sessions/:id/data`) che popoleranno il Visualizzatore Grafico TGM 1.6.
  * **Eliminazione (Delete)**: Il click sul cestino apre un popup di conferma e poi richiama un endpoint di DELETE per rimuovere la cartella.
  * **Configurazione**: Modifica dei valori globali del file di configurazione (`tolerances_db.json`).

---

#### 6. Integrazione Backend ed Endpoint API

* **Lettura Configurazione Globale**: `GET /api/configuration` per recuperare il `dataSourcePath` dell'operatore attivo dal file `config.json`.
* **Lettura Sessioni**: `GET /api/tgm/sessions?path={dynamic_path}`
* **Dettagli/Espansione (es. TQI)**: `GET /api/tgm/sessions/:id/tqi`
* **Caricamento Dati Grafico**: `GET /api/tgm/sessions/:id/data`
* *(Aggiungere l'endpoint di DELETE se non ancora implementato nel controller TGM).*
