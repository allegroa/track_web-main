# Specifiche Implementative Plottaggio Grafici TGM (DataVisualizer)

Questo documento descrive il flusso tecnico e implementativo con cui l'interfaccia utente del modulo **TGM** (`DataVisualizer.jsx` abbinato a `TGMDatabaseContainer.jsx`) gestisce la selezione di una sessione di misurazione tramite il pulsante **Play** e ne effettua il plottaggio grafico.

---

## 1. Trigger Utente e Gestione dello Stato

Nella colonna **AZIONI** della tabella delle sessioni TGM (`TGMDatabaseVisualizer.jsx`) è presente un pulsante di "Play" per ciascuna riga:

```jsx
<button 
  title="Visualizza Grafico (Play)"
  onClick={() => onPlaySession(session)}
  className="..."
>
  <svg>...</svg>
</button>
```

### La funzione `onPlaySession` e il Bridge
A differenza del RailProfile, dove il click scatenava un fetch locale di un JSON, qui il TGMDatabaseContainer intercetta il click e inietta il parametro fondamentale `dbPath` (la cartella esatta in cui si trova il rilievo).
Questa chiamata viene passata in cima fino a `DataVisualizer.jsx`, il quale invoca la funzione principale `loadServerCsv`:

```javascript
// Esempio dell'invocazione scatenata dal pulsante Play
<TGMDatabaseContainer 
  onPlaySession={(session, dbPath) => 
    loadServerCsv('軌道參數報表.csv', session.id, sampleSize, false, 'tgm', dbPath)
  } 
/>
```

---

## 2. Recupero del Flusso Dati (Raw CSV)

Poiché il file dei parametri `軌道參數報表.csv` è tipicamente dell'ordine dei Megabyte e contiene milioni di punti, il backend TGM non invia un file JSON pre-elaborato, ma apre uno stream binario direttamente verso il frontend.

```javascript
// All'interno di loadServerCsv in DataVisualizer.jsx
if (source === 'tgm') {
  const url = `/api/tgm/sessions/${folderName}/raw?path=${dbPath}&file=${fileName}`;
  const fetchResp = await fetch(url);
  blob = await fetchResp.blob();
}
```

All'arrivo del `blob`, entra in gioco il **Parser Web Worker** (PapaParse) che, asincronamente:
1. **Scarta le prime 4 righe** (metadati TGM e riga vuota).
2. **Cattura l'intestazione** non appena trova una cella contenente il testo `km` (riconoscimento dinamico `includes('km')`).
3. **Applica il Downsampling** estraendo uniformemente un massimo di 2000 punti.

---

## 3. Struttura dei Dati per il Plottaggio

Il parser restituisce al grafico un singolo array flat (non più diviso in `left` e `right` come nel RailProfile, ma direttamente basato sulle colonne del file):

```json
[
  { "{(Km)": 100.290, "W(mm)": 6.23, "yZ(mm)": 0.70, ... },
  { "{(Km)": 100.291, "W(mm)": 6.40, "yZ(mm)": 0.90, ... },
  ...
]
```

---

## 4. Elaborazione dei Dataset (`chartData`)

I dati memorizzati in `sampledRows` o `csvData` vengono convertiti nel formato supportato da **Chart.js** tramite un hook `useMemo` che risponde ai cambiamenti del dataset e alle colonne selezionate dall'utente tramite le checkbox in UI (`selectedYs`).

Per ciascun parametro selezionato dall'utente (es. `W(mm)`, `yZ(mm)`), viene generato un dataset:

```javascript
const datasets = selectedYs.map((col, idx) => {
  const color = ['#0EA5E9', '#7C3AED', '#F97316', '#059669', '#EF4444'][idx % 5];
  
  return {
    label: col,
    data: sourceData.map(d => ({
      x: parseNumberCell(d[selectedX]), 
      y: parseNumberCell(d[col])
    })).filter(p => !isNaN(p.x) && !isNaN(p.y)),
    borderColor: color,
    yAxisID: overlayMode ? 'y0' : `y${idx}`, // Gestione dell'Overlay o Assi Separati
    ...
  };
});
```

---

## 5. Configurazione degli Assi e Layout del Grafico (`chartOptions`)

Il grafico TGM è configurato per supportare due modalità di visualizzazione: **Separata (Stacked Oscilloscope)** o **Sovrapposta (Overlay)**, governata dal toggle `overlayMode`.

### Assi Y
Se l'Overlay è disattivo, ciascun canale/parametro ha il proprio asse Y separato per analizzare i segnali senza sovrapposizioni:

```javascript
scales[`y${idx}`] = {
  type: 'linear',
  position: 'left',
  stack: overlayMode ? undefined : 'oscilloscope', // Oscilloscopio se !overlayMode
  stackWeight: 1,
  title: { text: col, display: true }
};
```

### Asse X (Chilometrico) e Tolleranze
L'asse X rappresenta la chilometrica e usa il formato `formatRailwayKm`.
Eventuali tolleranze (per i segnali TGM) vengono disegnate come **Annotations** (linee tratteggiate) calcolate dinamicamente dall'oggetto `tolerances[col]`:

```javascript
annotations[`tol-${idx}-pos`] = {
  type: 'line',
  yScaleID: `y${idx}`,
  yMin: toll,
  yMax: toll,
  borderColor: 'rgba(148, 163, 184, 0.6)',
  borderDash: [4, 4]
};
```

### Zoom & Interattività (Hovering)
* **Hover (Crosshair)**: Il grafico utilizza una funzione custom `onHover` ottimizzata a ~30fps che intercetta la posizione del cursore sull'asse X, calcola il punto dati più vicino e, nel caso in cui il CSV contenga coordinate `Lat`/`Lon`, aggiorna istantaneamente lo stato mappa per posizionare un marker sulla mappa interattiva.
* **Zoom/Pan**: Pienamente supportati tramite rotellina o trascinamento per ispezionare sezioni dettagliate del tracciato TGM.
