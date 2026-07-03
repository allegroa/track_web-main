# Specifiche del Software - Web One (RAMSYS)

Questo documento descrive le specifiche tecniche e l'architettura di sistema di **Web One** (RAMSYS), derivate dall'analisi del documento di sintesi dell'architettura.

---

## 1. Architettura di Alto Livello

L'applicazione adotta un approccio **containerizzato orientato ai servizi** (service-oriented), strutturato come un **monolito modulare backend** (modular monolith) affiancato da servizi infrastrutturali di supporto. L'intera infrastruttura è orchestrata tramite Docker Compose su una singola rete bridge dedicata (`weebone_net`).

### Servizi e Stack Tecnologico

| Servizio | Immagine / Stack | Porta/e | Ruolo |
| :--- | :--- | :--- | :--- |
| **frontend** | React 19 + Vite 6 | `5173` | Single Page Application (SPA) servita al browser. |
| **backend** | Node.js + Express 5 | `5000` | REST API, autenticazione, logica di business. |
| **ahmes_viewer** | Web App separata | `3000` | Visualizzatore di file specializzato. |
| **db** | PostgreSQL 15 | `5432` (interna) | Database relazionale per dati di dominio. |
| **minio** | MinIO (S3-compatibile) | `9000` / `9001` | Storage di oggetti e file. |
| **prisma_migrate** | Node.js (One-shot) | — | Esecuzione delle migrazioni dello schema e seed del database. |

---

## 2. Dettaglio dello Stack Tecnologico

### Frontend
- **Framework & Tooling**: React 19, Vite 6.
- **Routing**: React Router 7.
- **Gestione HTTP**: Axios con iniezione automatica del token JWT.
- **Autorizzazione**: Gestione delle rotte protette in base al ruolo dell'utente.
- **Inizializzazione API**:
  ```javascript
  const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });
  ```

### Backend
- **Runtime & Framework**: Node.js, Express 5.
- **ORM & Database**: Prisma ORM con PostgreSQL.
- **Autenticazione**: Autenticazione JWT mediante middleware per la gestione dei ruoli.
- **Gestione File**: Caricamento e gestione dei file tramite il modulo `multer`.
- **CORS**: Configurazione CORS compatibile con reti locali (LAN-aware).

### Strato Dati (Data Layer)
- Database PostgreSQL per i dati relazionali di dominio.
- Modelli definiti tramite Prisma ORM:
  - `User`
  - `Client`
  - `Product`
  - `File`
  - `Group`
  - `GroupUser`

### Strato di Storage (Storage Layer)
- Astrazione di archiviazione pluggabile con supporto per:
  - File system locale
  - Protocollo SMB
  - MinIO / S3-compatibile (utilizzato nel deployment corrente)

---

## 3. Struttura dei Moduli Backend (Rotte)

Il backend è organizzato in base ai prefissi delle rotte con i rispettivi requisiti di autenticazione:

| Prefisso Rotta | Modulo | Autenticazione / Autorizzazione |
| :--- | :--- | :--- |
| `/api/auth` | Login, Registrazione, Profilo Utente | Pubblica (Nessuna) |
| `/api/products` | Operazioni CRUD sui Prodotti | Richiesto token JWT |
| `/api/files` | Navigazione file, Caricamento, Upload parziale/resumable | Richiesto token JWT |
| `/admin` | Gestione Clienti, Utenti, Gruppi, Impostazioni, Metriche | Richiesto token JWT + Ruolo specifico |

### Mappatura delle Rotte in Express
```javascript
app.use('/admin', adminRoutes);         // Richiede JWT + ruolo idoneo
app.use('/api/auth', authRoutes);       // Rotte pubbliche
app.use('/api/products', productRoutes); // Richiede JWT
app.use('/api/files', filesRoutes);     // Richiede JWT
```

---

## 4. Flusso delle Richieste a Runtime

1. L'utente accede al **frontend** tramite browser (porta `5173`).
2. Il **frontend** effettua chiamate API al backend utilizzando l'URL composto da `VITE_API_URL` e il relativo endpoint `/api/...`.
3. Il **backend** convalida il token JWT associato e applica le regole di visibilità/scoping a livello di ruolo e di cliente (Client scoping).
4. Il **backend** esegue letture o scritture di metadati sul database **PostgreSQL** tramite l'ORM Prisma.
5. Il **backend** archivia o recupera i file fisici tramite l'adattatore di storage configurato (**MinIO**, **SMB** o **locale**).
6. Se richiesto per la visualizzazione di file specializzati, l'utente viene indirizzato ad **Ahmes Viewer** (porta `3000`).

---

## 5. Punti di Forza del Design

- **Semplicità di Deployment**: Orchestrazione completa tramite Docker Compose su un singolo host tramite un solo comando di avvio/arresto (`up` / `down`).
- **Separazione Netta delle Responsabilità**: I servizi infrastrutturali (Database, Storage, Visualizzatore) sono disaccoppiati dalle API di business principali.
- **Storage Modulare (Pluggable)**: Possibilità di scambiare il backend di storage (locale, SMB, MinIO) modificando esclusivamente la configurazione e senza toccare i controller applicativi.
- **RBAC Lineare**: Controllo degli accessi basato sui ruoli (`superadmin`, `admin`, `cliente`) applicato a livello di singola rotta.