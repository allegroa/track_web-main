# Processamento e Trasformazione dei File CSV (RailProfile)

Questo documento descrive il flusso di ingestione, trasformazione e memorizzazione dei file CSV all'interno del modulo **RailProfile** (esposto sulla rotta frontend `http://localhost:5173/webone/railprofile`).

## 1. Struttura del Database Interno

A differenza dell'applicazione principale che utilizza MySQL, il modulo RailProfile si appoggia a un database **SQLite locale** (`railprofile.db` posizionato in `E:/Software/RailPulse/DATABASE/RP/`). 
Questo database funge da indice e da cache per le aggregazioni e contiene due tabelle principali:
- **`sessions`**: Mantiene i metadati dei file (es. `session_id`, `filename`, `line_code`, `direction`, data e ora di misurazione, km iniziali e finali, lato d'usura).
- **`exceedances`**: Memorizza i conteggi e le percentuali pre-calcolate dei superamenti delle soglie (T1, T2, T3, T4) per ogni parametro di usura (W1, W2, W3, W4).

I file CSV originali non vengono riversati riga per riga nel database relazionale: rimangono fisicamente nel file system e fungono da sorgente dati *raw*.

## 2. Ingestione e Parsing dei CSV

La logica di lettura dei file è centralizzata in `backend_webbone/src/utils/railprofile.utils.js` (tramite la funzione `parseCSVFile` e la libreria *PapaParse*):
1. **Lettura file**: Il backend cerca il file associato a una sessione nella directory `DATABASE/RP`.
2. **Rimozione Header**: Le prime 4 righe del CSV, contenenti metadati proprietari, vengono saltate.
3. **Mappatura Colonne**: Tramite prefissi *case-insensitive*, vengono identificate automaticamente la colonna della chilometrica (`km` o `mile`) e le colonne di usura (`W1`, `W2`, `W3`, `W4`). Valori invalidi (`inf`, `nan`) vengono scartati.
4. **Ordinamento**: Le righe valide estratte vengono ordinate in modo crescente rispetto alla chilometrica.

## 3. Calcolo Asincrono delle Eccedenze (Exceedances)

Per mantenere alte le performance del frontend, il backend esegue un calcolo aggregato asincrono delle eccedenze (funzione `runExceedanceCalculation` in `railprofile.controller.js`):
- Il processo si attiva in background in risposta alle chiamate API (come la richiesta della lista sessioni o l'aggiornamento della configurazione).
- Recupera le tolleranze di soglia (`T1`...`T4`) configurate nel file `railprofile_thresholds.json`.
- Per ogni sessione priva di dati in `exceedances`, legge l'intero CSV.
- Per ogni riga e per ogni parametro (W1-W4), verifica se il valore assoluto eccede T1, T2, T3 o T4.
- Salva nella tabella SQLite `exceedances` il conteggio totale e le percentuali di superamento. 

Questo permette alla tabella frontend in React (`RailProfilePage.jsx`) di mostrare immediatamente i risultati aggregati (il pop-over visibile all'hover) e calcolare il **Quality Index** senza dover scaricare decine di megabyte di punti.

## 4. Visualizzazione e Downsampling sul Frontend

Quando l'utente seleziona una sessione per visualizzarne il grafico su `RailProfilePage.jsx`:
1. Il frontend chiama l'endpoint `GET /api/railprofile/sessions/:id/data`.
2. Il backend legge nuovamente il CSV originale.
3. **Downsampling**: Se il file contiene più di 2000 punti, viene applicato un campionamento uniforme (estraendo un punto ogni N righe) per abbattere i dati a un massimo di 2000 campioni per rotaia.
4. I dati campionati vengono inviati al frontend, riducendo drasticamente il payload di rete e garantendo reattività alla libreria *Chart.js*.
5. Il frontend elabora questi dati tracciandoli nel grafico, sovrapponendo dinamicamente le soglie (`configParams`) lette dal backend.

## Riassunto del Flusso
1. **CSV in directory** -> 2. **Lettura e Parsing (Skip header, PapaParse)** -> 3. **Calcolo asincrono eccedenze (SQLite cache)** -> 4. **Invio aggregati a Frontend** -> 5. **Richiesta grafico** -> 6. **Downsampling (<2000 pt)** -> 7. **Render grafico (Chart.js)**.
