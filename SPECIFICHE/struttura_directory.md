# Struttura delle Directory e dei Moduli - RAMSYS / WebOne

Questo documento descrive l'organizzazione delle cartelle del progetto RAMSYS / WebOne, con particolare attenzione alla struttura modulare multi-tenant per l'archiviazione dei file.

---

## 1. Struttura Generale del Workspace

Il workspace principale del progetto è organizzato nelle seguenti macro-aree:

- **`WebOne/`**: Root principale dell'applicazione WebOne.
  - **`backend_webbone/`**: Backend sviluppato in Node.js ed Express 5. Gestisce l'API REST, l'autenticazione JWT e l'accesso al database tramite Prisma.
  - **`frontend_webbone/`**: Frontend Single Page Application (SPA) in React 19 + Vite 6.
- **`TaipeiScaffold/`**: Modulo o ambiente separato per il caricamento/visualizzazione locale dei dati relativi alla metropolitana di Taipei.
- **`Specifiche/`**: Documenti di specifica tecnica (es. specifiche software, specifiche di sviluppo, log delle modifiche).
- **`docs/`**: Documentazione di supporto, file PDF normativi (EN 13231-3) e contratti.
- **`DATABASE/`**: Risorse e script relativi alla persistenza dei dati.

---

## 2. Struttura dei Moduli (Filesystem Speculare al Database)

Per garantire la multi-tenancy e l'isolamento completo dei dati tra clienti, progetti e sistemi, la struttura dei file caricati a filesystem sotto la cartella di upload del backend (`uploads/`) deve seguire in modo rigido e speculare la gerarchia definita a livello di database:

```
/uploads/{clientFolder}/{projectSlug}/{systemSlug}/{moduleCode}/
  ├── config/
  ├── manuals/
  └── upload/
```

### Parametri del Path
1. **`{clientFolder}`**: Il nome della cartella dedicata al Cliente, derivato dal campo `folderName` del modello `Client` a database.
2. **`{projectSlug}`**: Lo slug univoco del Progetto, normalizzato in caratteri URL-safe a partire dal nome del progetto, associato al modello `Project`.
3. **`{systemSlug}`**: Lo slug univoco del Sistema (linea ferroviaria/impianto), normalizzato a partire dal nome del sistema, associato al modello `System`.
4. **`{moduleCode}`**: Il codice identificativo del modulo abilitato (es. `TRACK_GEOMETRY`, `CORRUGATION`, `TUNNEL_SCAN`), associato al modello `ModuleDefinition`.

### Sottocartelle per Modulo
Ogni modulo abilitato all'interno di un sistema possiede tre sotto-directory standard:
- **`config/`**: Contiene i file di configurazione specifici del modulo, come tolleranze personalizzate o parametri di calcolo.
- **`manuals/`**: Contiene la documentazione, i manuali d'uso o le linee guida operative specifiche del modulo per quel sistema.
- **`upload/`**: Destinazione in cui vengono salvati i file di dati effettivi caricati dagli utenti (es. file CSV di rilievo, file `.geo` di geometria).

> [!IMPORTANT]
> Il percorso di archiviazione dei file **non viene mai accettato dal client** come parametro arbitrario del corpo della richiesta (body). Il percorso viene calcolato dinamicamente e in modo sicuro **esclusivamente lato server**, interrogando il database per risolvere le relazioni a partire dal `systemId` e dal `moduleCode` forniti durante l'upload.

---

## 3. Struttura del Codice dei Moduli (Backend e Frontend)

L'aggiunta o gestione di un modulo software all'interno del codice deve seguire una struttura standardizzata e disaccoppiata per facilitare la manutenzione.

### Backend (`WebOne/backend_webbone/`)
I moduli backend sono definiti a livello logico (non fisico) integrando:
- **Prisma Schema**: La junction `SystemModule` che associa `System` a `ModuleDefinition` con flag `enabled` e configurazione JSON `configJson`.
- **Routes (`src/routes/`)**: Definizione degli endpoint specifici protetti da middleware:
  - `requireSystemAccess(systemId)`: verifica che il sistema appartenga al client dell'utente.
  - `requireModule(moduleCode)`: verifica che il modulo sia abilitato per quel sistema specifico.
- **Controllers (`src/controllers/`)**: Logica di elaborazione dati e interfacciamento con lo strato di storage (adattatore pluggabile: locale, SMB, MinIO).

### Frontend (`WebOne/frontend_webbone/`)
I moduli lato client si integrano in modo dinamico:
- **Rotte Parametriche (`src/App.jsx`)**: Le pagine dei moduli caricano i dati dinamicamente in base a `systemId` e `moduleCode`.
- **Sidebar Dinamica (`src/components/Sidebar.jsx`)**: Voci del menu generate a runtime in base alla risposta dell'endpoint `GET /api/me/context`. Vengono mostrati e resi accessibili solo i moduli abilitati sul sistema correntemente selezionato.
- **Pagine Operative (`src/pages/`)**: Componenti dedicati (es. `DataVizualizer.jsx`, `RailProfilePage.jsx`) che consumano le API del backend inserendo i parametri del contesto attivo.
