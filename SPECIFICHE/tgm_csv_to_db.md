# Processamento e Trasformazione dei File CSV (TGM)

Questo documento descrive il flusso di ingestione, trasformazione e visualizzazione dei file CSV all'interno del modulo **TGM (Track Geometry Measurement)**. 
L'architettura utilizza un approccio **Ibrido**, combinando un database relazionale (SQLite) per l'indicizzazione rapida e un File-System per lo storage dei dati grezzi.

## 1. Architettura Ibrida (SQLite + File System)

Per garantire massime prestazioni anche in presenza di migliaia di rilievi, il modulo TGM adotta una struttura a doppio livello:
- **SQLite (`tgm.db`)**: Un database relazionale locale che funge da "Indice ad alte prestazioni". Memorizza i metadati delle sessioni (data, km, linea) e le statistiche aggregate (conteggi delle eccedenze e medie TQI) per permettere ricerche, ordinamenti e caricamenti istantanei della dashboard.
- **File System (Directory CSV)**: Le cartelle contenenti i file raw originali. Il file contenente milioni di punti (`軌道參數報表.csv`) rimane su disco e viene letto solo "su richiesta" per non sovraccaricare il DB.

All'interno di ogni cartella su File System, i dati sono prodotti dall'hardware di misurazione in tre file:
- `超限報表.csv`: Report delle eccedenze (Tolleranze violate).
- `軌道TQI報表.csv`: Report dell'indice TQI.
- `軌道參數報表.csv`: Report completo dei parametri geometrici.

## 2. Ingestione e Sincronizzazione (Database Build)

L'inserimento delle sessioni non avviene con una semplice lettura on-the-fly, ma tramite una procedura di "Sincronizzazione":
1. **Scansione e Parsing Nuove Cartelle**: Un processo (attivato dall'utente o da un watcher) analizza la cartella radice `database/` cercando nuove acquisizioni.
2. **Estrazione Metadati**: Dal nome di ogni cartella vengono estratti data, ora, e chilometriche.
3. **Estrazione Aggregati**: Il processo apre i file `超限報表.csv` e `軌道TQI報表.csv` per estrapolare i conteggi delle eccedenze e il valore medio del TQI.
4. **Scrittura in SQLite**: Tutte queste informazioni vengono salvate nelle tabelle `sessions`, `tqi_summary` e `exceedances_summary` del database `tgm.db`.

In questo modo, al caricamento della pagina, il backend risponde interrogando solamente SQLite in millisecondi.

## 3. Parsing e Downsampling dei Parametri Geometrici

Quando l'utente seleziona un rilievo dalla UI per visualizzarne il grafico dei parametri, il flusso torna al file system:

1. **Chiamata API Dettaglio**: Il frontend richiede il file `軌道參數報表.csv` della sessione selezionata.
2. **Parsing (PapaParse)**: Il parser estrae le serie temporali o spaziali (es. Sopraelevazione, Allineamento, Scartamento).
3. **Downsampling Dinamico**: Poiché i file possono contenere centinaia di megabyte di punti, viene applicato un campionamento spaziale (es. 1 punto ogni N metri o se il dataset supera i 2000 punti) per garantire reattività al canvas rendering (Chart.js) lato browser.

## 4. Tolleranze Dinamiche e Annotazioni (JSON)

Le soglie di tolleranza, utilizzate per disegnare le linee limite (Warning/Danger) sui grafici, provengono dal file di configurazione centrale `tolerances_db.json` o da tabelle SQLite dedicate.
Le annotazioni puntuali (singolarità, appunti presi sul campo, P.L.) sono memorizzate in `[Nome_Sessione]_db.json`.
Tutte queste informazioni vengono inviate dinamicamente a `DataVisualizer.jsx` per essere sovrapposte ai dati grezzi.

## Riassunto del Flusso
1. **Nuova Acquisizione in Cartella** -> 2. **Sincronizzazione Backend** -> 3. **Parsing TQI/Eccedenze e salvataggio su SQLite** -> 4. **Apertura App: Query SQLite istantanea per Lista Sessioni** -> 5. **Selezione Sessione** -> 6. **Lettura file CSV grezzo `軌道參數報表.csv`** -> 7. **Downsampling** -> 8. **Render su Chart.js con Tolleranze**.
