# Specifica Tecnica: Modulo RailProfile v1.0 (visualizeExplore)

Questo documento definisce le specifiche funzionali e architetturali per la realizzazione del modulo **RailProfile v1.0 (visualizeExplore)**. Il modulo è progettato secondo un paradigma a **micro-moduli (o plugin indipendente)**, garantendo che il suo ciclo di vita (sviluppo, configurazione, deployment ed eventuale rimozione) non impatti le funzionalità core dell'applicazione principale (**WebOne**).

---

## 1. Architettura di Isolamento e Disaccoppiamento

Il modulo deve essere auto-contenuto all'interno della directory dedicata `/RailProfile/` nella root del progetto.

```text
[Root WebOne]
├── WebOne/
│   ├── backend_webbone/
│   └── frontend_webbone/
└── RailProfile/
    ├── prompts/          # Istruzioni IA e documentazione generativa
    ├── backend/          # Codice backend di RailProfile
    │   ├── config/       # Configurazione soglie di usura (thresholds)
    │   ├── controllers/  # Logica dei controller e calcolo eccedenze
    │   ├── models/       # Schemi DB (SQLite)
    │   └── routes/       # Definizione degli endpoint API del modulo
    └── frontend/         # Codice frontend di RailProfile
        ├── components/   # Componenti UI (Grafico, Modale Configurazione)
        └── views/        # Vista principale di visualizzazione e gestione
```

### Regole di Isolamento
1. **Punto di Aggancio Backend**: L'integrazione con il backend di WebOne avviene esclusivamente registrando le rotte del modulo dinamicamente all'avvio, senza rigide dipendenze (hard-coding) nei file di avvio principali.
2. **Punto di Aggancio Frontend**: Le rotte del frontend sono caricate dinamicamente. Se la cartella `RailProfile` viene rimossa dal file system, l'applicazione principale continuerà a funzionare normalmente, omettendo semplicemente il link del modulo dalla Sidebar.

---

## 2. Struttura dei Dati e Database (SQLite)

La persistenza del modulo si basa su un database SQLite dedicato (`railprofile.db`). Lo schema è composto da due tabelle principali.

### Tabella `sessions`
Memorizza i metadati delle acquisizioni importate dai file CSV di misurazione dell'usura.

| Campo | Tipo | Descrizione |
|---|---|---|
| `session_id` | TEXT (PK) | Identificativo univoco dell'acquisizione (calcolato a partire dal nome file). |
| `filename` | TEXT | Nome del file CSV memorizzato a filesystem. |
| `wear_side` | TEXT | Lato rotaia rilievo (`left` o `right`). |
| `line_code` | TEXT | Codice della linea ferroviaria / Stazione di partenza. |
| `line_name` | TEXT | Nome esteso della linea. |
| `direction` | TEXT | Direzione del rilievo (`UP` o `DN`). |
| `starting_km` | REAL | Progressiva chilometrica iniziale (espressa con 3 decimali). |
| `ending_km` | REAL | Progressiva chilometrica finale (espressa con 3 decimali). |
| `measurement_date` | TEXT | Data del rilievo (`YYYY-MM-DD`). |
| `measurement_time` | TEXT | Ora del rilievo (`HH:MM:SS`). |

### Tabella `exceedances`
Contiene le statistiche pre-calcolate sui superamenti delle soglie impostate, per ottimizzare le prestazioni di caricamento.

| Campo | Tipo | Descrizione |
|---|---|---|
| `id` | INTEGER (PK) | Auto-incrementale. |
| `session_id` | TEXT | Riferimento alla sessione associata (FK). |
| `line_code` | TEXT | Codice linea. |
| `direction` | TEXT | Direzione. |
| `measurement_date` | TEXT | Data. |
| `measurement_time` | TEXT | Ora. |
| `wear_side` | TEXT | Lato rotaia (`left` / `right`). |
| `parameter` | TEXT | Parametro di usura analizzato (`W1`, `W2`, `W3`, `W4`). |
| `t1_count` | INTEGER | Numero di punti che superano la soglia T1. |
| `t1_percentage` | REAL | Percentuale dei superamenti T1 sul totale punti. |
| `t2_count` | INTEGER | Numero di punti che superano la soglia T2. |
| `t2_percentage` | REAL | Percentuale dei superamenti T2 sul totale punti. |
| `t3_count` | INTEGER | Numero di punti che superano la soglia T3. |
| `t3_percentage` | REAL | Percentuale dei superamenti T3 sul totale punti. |
| `t4_count` | INTEGER | Numero di punti che superano la soglia T4. |
| `t4_percentage` | REAL | Percentuale dei superamenti T4 sul totale punti. |
| `total_samples` | INTEGER | Numero totale di campioni validi analizzati nel file. |

*Vincolo di unicità*: `UNIQUE(session_id, wear_side, parameter) ON CONFLICT REPLACE`

---

## 3. Logica del Backend (API & Utility)

### 3.1 Struttura delle Directory delle Sessioni e Naming dei File
Le sessioni di misura all'interno della cartella `database/` del progetto sono organizzate in directory strutturate secondo una precisa convenzione di denominazione:

`YYYY.MM.DD HH.MM.SSK[Km]+[Meter]~K[Km]+[Meter]`

#### Dettaglio della Struttura:
* **`YYYY.MM.DD`** e **`HH.MM.SS`**: Rappresentano rispettivamente la data e l'ora in cui è stato avviato il rilievo.
* **`K[Km]+[Meter]`** (es. `K100+000`): Progressiva chilometrica in formato ferroviario. Sia `Km` che `Meter` sono composti rigorosamente da 3 cifre (es. chilometro `100` e metri `000`).
* **Punto di Partenza**: Definito dalla prima coppia `Km+Meter` (precedente il carattere `~`).
* **Punto di Arrivo**: Definito dalla seconda coppia `Km+Meter` (successiva al carattere `~`).

Ogni directory di sessione contiene esattamente **3 file CSV** specifici:
1. **`YYYY.MM.DD HH.MM.SS超限報表.csv`**: Report contenente i record dei superamenti di tolleranza ed eccedenze.
2. **`YYYY.MM.DD HH.MM.SS軌道TQI報表.csv`**: Report riassuntivo con i valori TQI (Track Quality Index) di qualità geometrica della rotaia.
3. **`YYYY.MM.DD HH.MM.SS軌道參數報表.csv`**: Report contenente i dati di dettaglio e i parametri geometrici completi campionati lungo la linea.

### 3.2 Algoritmo di Parsing CSV (`railprofile.utils.js`)
* Salta le prime 4 righe del file (contenenti metadati ed intestazioni grezze).
* Identifica la colonna chilometrica tramite corrispondenza case-insensitive delle parole chiave (es. `mile`, `km`).
* Identifica le colonne dei parametri di usura (`W1`, `W2`, `W3`, `W4`) mediante corrispondenza del prefisso.
* Filtra i valori non numerici, stringhe vuote, o valori non validi come `inf` o `nan` (sostituiti con `null`).
* Ordina le righe risultanti in modo crescente in base alla progressiva chilometrica.

### 3.3 Calcolo delle Eccedenze in Background
Per evitare di bloccare il thread principale durante le richieste API:
1. Al recupero delle sessioni, viene avviato un processo asincrono (tramite `setImmediate`) per calcolare le eccedenze mancanti nel database.
2. Il calcolo confronta i valori assoluti dei parametri `W1-W4` del CSV con le soglie configurate `T1-T4` (salvate in `railprofile_thresholds.json`).
3. Quando l'utente aggiorna la configurazione delle soglie, la tabella delle eccedenze viene svuotata completamente per forzare il ricalcolo al caricamento successivo.

### 3.4 API Endpoints
* **`GET /api/railprofile/sessions`**: Restituisce la lista di sessioni aggregate per Data, Ora, Direzione e Linea.
* **`GET /api/railprofile/sessions/:id/data`**: Restituisce i punti chilometrici e di usura per la visualizzazione grafica. Applica un downsampling automatico (limite di 2000 punti per lato rotaia) per garantire fluidità di rendering nel frontend.
* **`PUT /api/railprofile/sessions/:id`**: Consente la modifica manuale dei metadati (chilometriche, date, direzioni). L'aggiornamento si propaga sui record "gemelli" (Sx e Dx) e invalida le eccedenze pre-calcolate.
* **`DELETE /api/railprofile/sessions/:id`**: Elimina i record delle sessioni sia per la rotaia sinistra che destra e rimuove le relative eccedenze pre-calcolate.
* **`GET /api/railprofile/config`** & **`POST /api/railprofile/config`**: Lettura e scrittura delle tolleranze `T1-T4` per i parametri `W1-W4`.

---

## 4. Logica del Frontend (React & Chart.js)

### 4.1 Aggregazione Visiva Sinistra/Destra (Pairing)
I dati di misurazione dell'usura sinistra (`_left_Wear.csv`) e destra (`_right_Wear.csv`) generano sessioni distinte nel DB ma vengono aggregate in un'unica riga visiva nella tabella del frontend, raggruppandole per:
* Data di acquisizione (`measurement_date`)
* Ora di acquisizione (`measurement_time`)
* Direzione (`direction`)
* Linea (`line_code`)

### 4.2 Quality Index (Indice di Qualità)
Il frontend calcola un indice percentuale di qualità per ciascuna sessione. È basato sulla media pesata delle percentuali di superamento delle soglie `T1-T4` presenti nella tabella delle eccedenze:

$$QualityIndex = \max\left(0, 100 - \frac{\sum (t_1\% \cdot 0.1 + t_2\% \cdot 0.2 + t_3\% \cdot 0.3 + t_4\% \cdot 0.4)}{\text{Numero Parametri}}\right)$$

L'indice viene visualizzato con badge colorati in base al punteggio:
* **`> 95%`**: Verde (Eccellente)
* **`85% - 95%`**: Giallo (Buono)
* **`70% - 85%`**: Arancione (Attenzione)
* **`< 70%`**: Rosso (Critico)

### 4.3 Visualizzazione Profilo Usura (Grafico Multi-Asse)
Il componente grafico si basa su **Chart.js** (utilizzando i plugin di zoom, pan e annotazioni):
* **Asse X**: Visualizza la chilometrica formattata nel formato ferroviario standard (es. `KM + Metri`, es. `10+120`).
* **Assi Y Stacked (Oscilloscopio)**: Presenta 4 assi Y impilati verticalmente, uno per ciascun parametro di usura (`W1`, `W2`, `W3`, `W4`), permettendo un confronto diretto sullo stesso allineamento chilometrico.
* **Segmentazione Dinamica del Colore**: Ciascun segmento del grafico cambia colore a runtime in base alla soglia superata dal valore locale:
  * Entro `T1`: Verde
  * Tra `T1` e `T2`: Giallo
  * Tra `T2` e `T3`: Arancione
  * Tra `T3` e `T4`: Arancione scuro
  * Oltre `T4`: Rosso
* **Linee di Soglia**: Linee tratteggiate orizzontali (`T1-T4`) inserite come annotazioni statiche sul rispettivo asse parametrico per facilitare il riscontro visivo.
* **Filtro Rotaia**: Due checkbox nel pannello di controllo consentono di abilitare/disabilitare dinamicamente il tracciato della **Rotaia Sx** (Sinistra) e **Rotaia Dx** (Destra).

---

## 5. Linee Guida per il Riuso e Deployment del Modulo

Per riutilizzare questo modulo in una qualsiasi istanza del progetto WebOne:

1. **Copia della Cartella**: Copiare l'intera cartella `/RailProfile/` nella directory di destinazione dell'host.
2. **Iniezione del Router Backend**:
   Nel file di configurazione delle rotte dell'applicazione core, registrare dinamicamente il modulo se presente:
   ```javascript
   const fs = require('fs');
   const path = require('path');

   // Auto-caricamento del modulo RailProfile se presente nel file system
   const railProfileRoutesPath = path.resolve(__dirname, '../../RailProfile/backend/routes/railprofile.routes.js');
   if (fs.existsSync(railProfileRoutesPath)) {
       app.use('/api/railprofile', require(railProfileRoutesPath));
       console.log('✓ Modulo RailProfile caricato con successo.');
   }
   ```
3. **Iniezione Dinamica della Sidebar Frontend**:
   Il menu laterale dell'applicazione principale scansiona la disponibilità dei moduli. La Sidebar deve includere la voce "RailProfile" solo se il modulo risponde con successo all'endpoint di verifica del contesto o se abilitato dal tenant loggato.
