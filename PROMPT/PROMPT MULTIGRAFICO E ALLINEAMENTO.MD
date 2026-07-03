# PROMPT MULTIGRAFICO E ALLINEAMENTO

## Requisiti Iniziali
Nella card dei grafici deve essere possibile sovrapporre più file .geo. Ogni file deve essere visualizzato con la propria progressiva. 
Da un pulsante sull'area del grafico si deve aprire una finestra dove deve esserci la lista dei file geo visualizzati sul grafico. Tale pulsante "Gestione Acquisizioni" deve apparire **solamente** se ci sono almeno 2 grafici attivi caricati. Non deve essere possibile caricare due volte lo stesso file (evitare i duplicati basati sul nome del file e generare ID univoci).
Nella finestra dei file, di fianco al nome del file, ci deve essere la possibilità attraverso una casella dove si inserice un numero ( offset ) deve essere possibile spotare il grafico a destra o a sinistra aggiungendo un offset alla posizione. 
Per ogni file ci deve anche essere un pulsante per fare l'auto allineamento con il primo file in cima. L'autoallineamento consiste nello spostare il grafico a destra o a sinistra in modo che i due grafici si sovrappongano nel migliore dei modi.

## Tasks per l'Implementazione

### 1. Gestione dello Stato per Grafici Multipli
- Modificare lo store/stato del grafico per supportare un array di acquisizioni (es. `datasets: [{ id, filename, data, offset, isVisible, color }]`).
- Assicurarsi che l'aggiunta di un nuovo file non sovrascriva i precedenti ma si aggiunga all'array.
- Assegnare colori distinti in automatico per ogni nuovo file caricato.

### 2. Aggiornamento Rendering del Grafico
- Modificare il componente del grafico (es. ECharts, Chart.js o D3) in modo che renderizzi una serie per ogni dataset presente nello stato.
- Applicare dinamicamente l'`offset` ai valori dell'asse X (progressiva) prima del render della serie.
- Aggiungere una legenda per distinguere i vari file `.geo`.

### 3. Interfaccia Utente: Modale di Gestione File
- Aggiungere un pulsante "Gestione Acquisizioni" o icona nell'area del grafico.
- Creare una modale/dialog che mostri la lista dei file attualmente caricati.
- Per ogni elemento della lista:
  - Mostrare il nome del file.
  - Inserire un input di tipo numerico per l' `offset` (con step definiti e possibilità di numeri negativi).
  - Collegare l'input di offset allo stato in modo che il grafico si aggiorni in tempo reale al variare del valore.
  - Aggiungere un pulsante "Auto-Allinea" (disabilitato per il primo file in lista).
  - Aggiungere un pulsante per rimuovere il file o nasconderlo dal grafico.

### 4. Algoritmo di Auto-Allineamento
- Creare una funzione di utilità per calcolare il miglior offset tra due serie di dati.
- Utilizzare la prima acquisizione in lista come *Reference*.
- Implementare l'algoritmo (es. calcolo della cross-correlazione o minimizzazione dell'errore quadratico medio scorrendo i due segnali) per trovare il ritardo/offset ottimale.
- Associare la funzione al pulsante "Auto-Allinea" della modale, aggiornando l'offset del file calcolato nello stato.

### 5. Ottimizzazione e Test
- Gestire il caso in cui i file abbiano lunghezze e campionamenti differenti (interpolazione o allineamento basato su punti chiave).
- Verificare le performance del rendering con molteplici file caricati contemporaneamente.