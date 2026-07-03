# Parsing dei File CSV TGM

Questo documento descrive le strategie e le particolarità tecniche utilizzate per effettuare il parsing dei file CSV esportati dal sistema TGM (Track Geometry Measurement).

## 1. Natura e Criticità dei CSV TGM

I file CSV generati dall'hardware di misurazione non sono file standard tabellari. Presentano diverse peculiarità:
- **Intestazione Mista (Metadata Header)**: In tutti i tre file esportati (`超限報表.csv`, `軌道TQI報表.csv` e `軌道參數報表.csv`), le prime 3 righe non contengono dati, ma metadati della sessione di acquisizione, seguiti da 1 riga vuota. I metadati sono coppie chiave-valore.
  - **Riga 1**: `線路名稱` (Line Name), `20260226`, `線路行別` (Line Type), `下行` (Downward), `報表名稱` (Report Name), `軌道參數報表` (Track Parameter Report), `測量人員` (Surveyor), `NoName`.
  - **Riga 2**: `開始里程` (Start Mileage), `99.999748`, `結束里程` (End Mileage), `99.442237`, `里程增減` (Mileage Increase/Decrease), `里程減` (Mileage Decrease).
  - **Riga 3**: `波長` (Wavelength), `25米-3米波長` (25m - 3m Wavelength), `測量日期` (Measurement Date), `2026.02.27`, `測量時刻` (Measurement Time), `00:22:18`.

- **Estrazione Metadati della Tratta (Line Name)**: Il campo "Line Name" (es. `1150422XDLDN`) racchiude in un'unica stringa alfanumerica diverse informazioni cruciali per il database. Il Backend estrae questa riga e la scompone tramite espressione regolare in:
  - **Primi 7 numeri**: valore ad ora sconosciuto (`1150422`).
  - **Ultimi 2 caratteri**: Direzione (`DN` o `UP`).
  - **Lettere centrali**: Identificativi della Stazione (es. `XDL`), che indicano unicamente la **Stazione Partenza** (in base alla convenzione, la Stazione di Arrivo non è indicata in questa stringa).
  - *Nota Tecnica*: Il file CSV potrebbe utilizzare la virgola (`,`) o il punto e virgola (`;`) come separatore. Le routine di lettura nel backend (`split(/[,;]/)`) devono gestire entrambi i casi per evitare valori nulli.

- **Problemi di Codifica (Encoding)**: Le colonne e i metadati contengono caratteri in cinese tradizionale (codifica `Big5`). Quando questi file vengono aperti o letti via stream come UTF-8 puro, questi caratteri risultano "sporchi" o illeggibili, rendendo impossibile fare "exact matching" sulle etichette delle colonne. Per risolvere definitivamente questo problema sia in Frontend che in Backend (API di downsampling), si utilizza una robusta espressione regolare `/[^\x20-\x7E]/g` che sradica ogni carattere non standard ASCII dalle etichette.
- **Grandi Dimensioni**: Il file principale `軌道參數報表.csv` può contenere da centinaia di migliaia a milioni di punti, rendendo impraticabile caricarlo interamente in memoria RAM sul browser.

## 2. Strategia di Parsing: Backend vs Frontend

Il parsing è diviso a seconda dello scopo del file:

### Backend (Aggregati TQI ed Eccedenze)
I file corti, come `超限報表.csv` e `軌道TQI報表.csv`, vengono elaborati sul server (via `TGM/backend/utils/tgmParser.js`).
Questi file possiedono una struttura fissa: 3 righe di metadati iniziali, 1 riga vuota, alla riga 5 vi è l'intestazione delle colonne, e successivamente iniziano i dati. 
Il backend è programmato per rimuovere in blocco le prime 4 righe e dare in pasto il resto a `PapaParse` con l'opzione `{ header: true }`, memorizzando i dati elaborati nel Database SQLite per popolare la Dashboard principale.
* **Traduzione Intestazioni Eccedenze**: Durante il parsing in backend del file `超限報表.csv`, il parser sostituisce dinamicamente le prime 9 colonne corrotte (originariamente cinesi) iniettando le corrispondenti etichette inglesi: Location (km), Location (m), Type of Over-limit, Peak Value (mm), Length (m), Over-limit Class, Linearity (Straight/Gradual/Curved), Speed (km/h), Detection Standard (mm).

### Frontend (Dati Geometrici Crudi - DataVisualizer.jsx)
Il file `軌道參數報表.csv` è enorme, e pur presentando la medesima struttura iniziale (3 righe di metadati, 1 vuota e la quinta di intestazione), richiede un trattamento asincrono. Il backend si limita ad agire da "tubo" (stream raw file) verso il frontend tramite l'endpoint `/api/tgm/sessions/[id]/raw`. 
Tutta l'elaborazione avviene nel browser.

## 3. Riconoscimento Dinamico dell'Intestazione e Metadati

Poiché le etichette delle colonne contengono testo cinese sporco (es. `{(Km)`), la tradizionale ricerca `header === 'km'` fallisce. Inoltre, anziché tagliare in modo fisso le prime 4 righe, il parser del Frontend attua una cattura "dinamica":
1. Ignora la riga vuota (tramite l'opzione `skipEmptyLines: true` di PapaParse).
2. Valuta ogni riga. Fino a quando non rileva l'intestazione delle colonne, salva il testo in un array di metadati (`metadataLines`).
3. Riconosce la riga d'intestazione (la quinta) non appena rileva che ALMENO UNA cella contiene la stringa 'km':
```javascript
// La riga viene considerata l'Intestazione se ALMENO UNA cella "contiene" la stringa 'km'
const isHeaderRow = row.some(cell => cell.toLowerCase().includes('km'));
```
Una volta individuata, questa riga diventa ufficialmente l'array degli `headers`, e tutte le righe successive (e solo le successive) vengono trattate come coordinate grafiche numeriche. Tutte le righe lette *prima* dell'identificazione dell'header vengono salvate in un array secondario come `Metadata`.

Per superare i problemi di encoding senza creare lag nel browser web, il `DataVisualizer.jsx` processa i metadati con la funzione `parseMetadataLines`, separando le stringhe su entrambi i delimitatori (`;` e `,`). Inoltre, valori testuali come il "Measurement Date" subiscono una riformattazione stilistica: il parser traduce formati grezzi come `YYYY.MM.DD` in un più leggibile `Month DD, YYYY` (es. `April 23, 2026`).

## 4. Downsampling e Algoritmo a Doppio Passaggio (Two-Pass)

Per evitare il crash del rendering di Chart.js e del DOM, `DataVisualizer.jsx` applica un abbattimento spaziale intelligente del dato (Downsampling). Poiché la lettura del CSV è un flusso sequenziale (stream), viene usato l'algoritmo a due passaggi:

**Passaggio 1 (Counting & Discovery)**
- Legge l'intero file riga per riga alla massima velocità.
- Individua la riga d'intestazione.
- Conta il numero totale di righe valide (es. `totalDataRows = 2235`).

**Passaggio 2 (Ordered Sampling)**
- Se `totalDataRows` supera la dimensione target `sampleSize` (es. 2000), il sistema calcola uno *step* (es. `2235 / 2000 = 1.11`).
- Genera matematicamente gli indici ideali da campionare (`Set(0, 1, 2, 3, 4, 6, 7...)`).
- Ripassa sul file da capo: questa volta estrae, elabora e salva in memoria **SOLO** le righe il cui indice appartiene al Set calcolato in precedenza.
- In questo modo, l'array risultante finale ha una dimensione sicura (max 2000 punti) ma rappresenta omogeneamente tutta la chilometrica della misurazione.
