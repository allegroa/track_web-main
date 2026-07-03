# Specifiche Implementative Plottaggio Grafici (visualizeExplore)

Questo documento descrive il flusso tecnico e implementativo con cui l'interfaccia utente di **RailProfile** (`RailProfilePage.jsx`) gestisce la selezione di una sessione di misurazione tramite la checkbox **SELECT** e ne effettua il plottaggio grafico.

---

## 1. Trigger Utente e Gestione dello Stato

Nella colonna **SELECT** (la prima colonna a sinistra della tabella delle sessioni) è presente una checkbox per ciascuna riga:

```jsx
<input
  type="checkbox"
  checked={selectedSessionIds === session.session_ids}
  onChange={() => handleCheckboxChange(session)}
  className="..."
/>
```

### La funzione `handleCheckboxChange`
Quando l'utente seleziona o deseleziona la checkbox, viene invocata la funzione `handleCheckboxChange(session)` che gestisce la logica di transizione dello stato:

1. **Deselezione (Toggle Off)**:
   Se la riga cliccata corrisponde a quella già selezionata (`selectedSessionIds === session.session_ids`), lo stato viene azzerato chiudendo l'area del grafico:
   ```javascript
   setSelectedSessionIds(null);
   setSelectedSessionData(null);
   setChartError(null);
   ```

2. **Selezione (Toggle On)**:
   Se viene cliccata una nuova riga:
   * Viene impostato l'ID della sessione attiva (`setSelectedSessionIds(session.session_ids)`).
   * Viene svuotato il dataset precedente per evitare rendering errati (`setSelectedSessionData(null)`).
   * Viene attivato lo stato di caricamento del grafico (`setChartLoading(true)`).
   * Viene eseguita una richiesta HTTP GET asincrona al backend per recuperare i punti di misura:
     ```javascript
     const token = localStorage.getItem('token');
     const response = await axios.get(`/api/railprofile/sessions/${session.session_ids}/data`, {
       headers: { Authorization: `Bearer ${token}` }
     });
     ```
   * All'arrivo della risposta positiva (`response.data.success`), i dati vengono salvati in `selectedSessionData`.

---

## 2. Struttura dei Dati per il Plottaggio

La risposta API del backend restituisce un oggetto strutturato con le letture della rotaia sinistra e destra aggregate:

```json
{
  "success": true,
  "metadata": {
    "line_code": "CHLZL",
    "direction": "UP",
    "measurement_date": "2026.01.23",
    "measurement_time": "02:17:46"
  },
  "left": [
    { "km": 100.290, "W1": 0.5, "W2": 1.2, "W3": 0.3, "W4": 0.1 },
    ...
  ],
  "right": [
    { "km": 100.290, "W1": 0.4, "W2": 1.1, "W3": 0.2, "W4": 0.1 },
    ...
  ]
}
```

---

## 3. Elaborazione dei Dataset (`chartData`)

I dati memorizzati in `selectedSessionData` vengono convertiti nel formato supportato da **Chart.js** tramite un hook `useMemo` che risponde ai cambiamenti del dataset, delle soglie di tolleranza (`configParams`), e dei filtri di visualizzazione rotaia (`showLeftRail` e `showRightRail`).

Per ciascuno dei 4 parametri di usura (**W1, W2, W3, W4**), vengono generati due dataset (uno per lato rotaia Sx/Dx):

```javascript
const wearParams = ['W1', 'W2', 'W3', 'W4'];
wearParams.forEach((param, idx) => {
  if (showLeftRail && leftData.length > 0) {
    datasets.push({
      label: `${param} Left`,
      data: leftData.map(d => ({ x: d.km, y: d[param] })).filter(p => p.y !== null),
      yAxisID: `y${idx}`, // Associazione all'asse verticale dedicato
      borderColor: colors[param].left,
      segment: { borderColor: getSegmentColor }, // Colorazione dinamica del tratto
      ...
    });
  }
  // Ripetuto per showRightRail con rightData
});
```

### Colorazione Dinamica dei Segmenti (`getSegmentColor`)
Per rendere immediata la visualizzazione dei superamenti di tolleranza direttamente sulla linea del grafico, viene utilizzato l'attributo `segment.borderColor` di Chart.js. La funzione confronta il valore di usura di ciascun segmento del tracciato con le soglie $T1-T4$:

* **Verde** (`val <= T1`): Stato eccellente.
* **Giallo** (`T1 < val <= T2`): Stato buono.
* **Arancione** (`T2 < val <= T3`): Stato di attenzione.
* **Arancione Scuro** (`T3 < val <= T4`): Stato di pre-allarme.
* **Rosso** (`val > T4`): Stato critico.

---

## 4. Configurazione degli Assi e Layout del Grafico (`chartOptions`)

Il grafico è configurato per comportarsi come un **oscilloscopio multitraccia impilato verticalmente**, consentendo di analizzare i 4 parametri usura contemporaneamente mantenendo lo stesso asse X (chilometrico).

### Assi Y Impilati (Stacked Y-Axes)
Ciascun parametro ha il proprio asse Y configurato con lo stesso identificativo di stack:

```javascript
scales[`y${idx}`] = {
  type: 'linear',
  display: true,
  position: 'left',
  stack: 'oscilloscope', // Identificativo per il raggruppamento verticale
  stackWeight: 1,        // Peso identico per dividere equamente l'altezza
  title: {
    display: true,
    text: `${param} (mm)`,
    font: { size: 11, weight: 'bold' }
  }
};
```

### Asse X (Chilometrico)
L'asse X rappresenta la coordinata spaziale ferroviaria ed è formattato tramite la funzione `formatRailwayKm` che trasforma i valori decimali in stringhe con il formato `KM+Metri` (es. `100.290` $\rightarrow$ `100+290`).

```javascript
x: {
  type: 'linear',
  title: { text: 'Kilometer (Railway format)' },
  ticks: {
    callback: function(val) {
      return formatRailwayKm(val);
    }
  }
}
```

### Linee di Tolleranza Orizzontali (Annotations)
Le soglie $T1-T4$ configurate per ciascun canale vengono tracciate come linee tratteggiate orizzontali di riferimento all'interno di ciascuna traccia tramite il plugin `chartjs-plugin-annotation`:

```javascript
annotations[`tol-${param}-${t}-pos`] = {
  type: 'line',
  yScaleID: `y${idx}`,
  yMin: val,
  yMax: val,
  borderColor: thresholdColors[t],
  borderDash: [5, 5],
  label: {
    content: `${param} ${t}: ${val}mm`,
    ...
  }
};
```

### Zoom & Pan
Per facilitare l'ispezione locale delle misurazioni lungo tratte molto lunghe, viene configurato il plugin `chartjs-plugin-zoom` limitatamente all'asse X:
* **Zoom**: Consentito tramite lo scrolling della rotellina del mouse (`wheel`) o selezionando un'area rettangolare tramite trascinamento (`drag`).
* **Pan**: Consentito trascinando il grafico lateralmente per scorrere la tratta.
