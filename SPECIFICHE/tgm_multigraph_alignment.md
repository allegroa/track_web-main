# Specifica Tecnica: Multigrafo e Allineamento Acquisizioni TGM

## 1. Obiettivo
Introdurre nel modulo TGM la funzionalità di **Multigrafo**, che permette all'utente di sovrapporre i dati (parametri geometrici) provenienti da più sessioni/acquisizioni differenti sullo stesso grafico. A questa si aggiunge la funzione di **Allineamento Spaziale** (manuale e automatico) per correggere piccoli sfasamenti chilometrici tra diverse acquisizioni della stessa tratta.

## 2. Requisiti di Interfaccia (UI/UX)

### 2.1. Selezione e Caricamento Multiplo
- Nella tabella "TGM Database", l'utente deve poter selezionare più di una sessione contemporaneamente tramite i checkbox.
- Cliccando su un nuovo pulsante "Visualizza Grafici Comparativi" (o simile), il sistema caricherà i dati di tutte le sessioni selezionate.
- **Prevenzione Duplicati**: Il sistema deve ignorare i tentativi di caricare due volte la stessa sessione (basandosi sull'ID univoco).
- **Colorazione**: Ogni sessione caricata sul grafico riceverà un set di colori distintivo o un colore base coerente per tutti i suoi parametri, per poterla distinguere dalle altre.

### 2.2. Modale "Gestione Acquisizioni"
- All'interno della visualizzazione grafico, se sono presenti almeno 2 acquisizioni attive, comparirà un pulsante **"Gestione Acquisizioni"**.
- Cliccando il pulsante, si aprirà una finestra/modale contenente la lista delle sessioni attualmente caricate sul grafico.
- **Reference**: La prima sessione della lista funge da "Master" o "Reference".
- Per ogni sessione (riga) nella modale saranno presenti:
  - **Nome/Label della sessione**.
  - **Offset (metri)**: Un input numerico (con step definiti, es. 1m o 0.1m, e possibilità di valori negativi) che trasla spazialmente il grafico lungo l'asse X (chilometrica).
  - **Real-time update**: Modificando l'offset, il grafico deve aggiornarsi istantaneamente.
  - **Pulsante "Auto-Allinea"**: Disponibile per tutte le sessioni tranne la Reference. Calcola e applica l'offset ideale rispetto alla Reference.
  - **Visibilità/Rimozione**: Un pulsante/toggle per nascondere temporaneamente la sessione dal grafico o rimuoverla del tutto.

## 3. Implementazione Tecnica

### 3.1. Gestione dello Stato (Frontend)
- Modificare lo stato di `TGMView` o creare un context per supportare un array di acquisizioni: 
  `activeSessions: [{ id, label, data, offset, color, isVisible }]`
- L'asse X del grafico (Chilometrica) dovrà mappare i valori originari più l'`offset` specificato per quella sessione.

### 3.2. Rendering del Grafico (Chart.js)
- Adattare `TGMChart.jsx` per processare l'array di `activeSessions`.
- I `datasets` generati non apparterranno più a una singola sessione, ma moltiplicheranno il numero di parametri scelti per il numero di sessioni visibili.
- La `legend` del grafico includerà sia il nome del parametro sia l'etichetta della sessione (es. "L. Profile - 2026.02.27").

### 3.3. Algoritmo di Auto-Allineamento (Cross-Correlazione)
L'auto-allineamento è l'operazione matematica che trova lo sfasamento spaziale ottimale tra due segnali (es. la traccia del "Profilo" dell'Acquisizione A e quella dell'Acquisizione B).

1. **Estrazione Segnali**: Si seleziona un parametro chiave (solitamente uno con molta variazione come il Profilo o l'Allineamento) presente in entrambe le sessioni.
2. **Campionamento Uniforme**: I dati di TGM hanno un passo tipico (es. 0.25m). Se il passo differisce o mancano punti, i segnali vengono interpolati linearmente per avere una griglia spaziale comune.
3. **Cross-Correlazione (XCORR)**: 
   - Si scorre un segnale rispetto all'altro all'interno di una finestra massima di offset ragionevole (es. ±50 metri).
   - Per ogni step di offset, si calcola l'Errore Quadratico Medio (MSE) o il coefficiente di correlazione di Pearson.
4. **Scelta Ottimale**: L'offset che restituisce il massimo coefficiente di correlazione (o il minimo errore) viene impostato come nuovo valore nell'input dell'utente.

## 4. Edge Cases e Limitazioni
- **Sessioni Disgiunte**: Se due sessioni non hanno sovrapposizione chilometrica (es. una va dal km 10 al 20, l'altra dal km 50 al 60), l'auto-allineamento verrà inibito o mostrerà un errore di "Nessuna sovrapposizione spaziale".
- **Performance**: Il rendering simultaneo di molte sessioni (> 4-5) con milioni di punti può impattare drasticamente sulle prestazioni. Sarà implementato un meccanismo di downsampling adattivo nel grafico per fluidificare lo zoom e il panning.
