# 🚀 PROMPT DI RIAVVIO PROGETTO — WebOne / RAMSYS (P2604)

> **Versione**: 2026-06-10  
> **Repository**: https://github.com/ADTSolution/WebOne.git  
> **Fonte locale**: questa cartella su Google Drive → copia su PC locale prima di lavorare

---

## ISTRUZIONE PER L'AI AGENTE (copia e incolla questo testo alla prima apertura)

---

Sei un AI agente che deve riprendere lo sviluppo del progetto **WebOne / RAMSYS** (codice P2604).

### Contesto del Progetto

**WebOne** è un'interfaccia web per la gestione, analisi e visualizzazione di dati di geometria ferroviaria. Nome commerciale: **RAMSYS**. Il codice sorgente è su Google Drive nella cartella del progetto, ma deve essere **copiato su un path locale** (es. `D:\004_Software\WebOne\`) prima di eseguirlo, perché Node.js non funziona correttamente su percorsi Google Drive (UNC path incompatibili).

---

### Stack Tecnologico

| Componente | Tecnologia | Porta |
|---|---|---|
| **Frontend** | React 19 + Vite 6 + TailwindCSS | `http://localhost:5173/webone/` |
| **Backend** | Node.js + Express 5 + Prisma ORM | `http://localhost:5000` |
| **Database dev** | MySQL (XAMPP locale) | `mysql://root:@localhost:3306/webone` |
| **Database prod** | PostgreSQL (Docker) | — |

---

### Setup su Nuovo PC (step-by-step)

#### 1. Prerequisiti
- Node.js 18+ installato
- MySQL (XAMPP o standalone) in esecuzione sulla porta 3306
- Google Drive for Desktop montato (tipicamente su `G:\`)

#### 2. Copia il progetto in locale
```powershell
robocopy "G:\Il mio Drive\GESTIONE TITS\99_PROGETTI\P2604 - RAMSYS\WebOne" "D:\004_Software\WebOne" /MIR /XD node_modules .git dist /R:1 /W:1
```

#### 3. Installa le dipendenze
```powershell
# Backend
cd D:\004_Software\WebOne\backend_webbone
npm install

# Frontend
cd D:\004_Software\WebOne\frontend_webbone
npm install
```

#### 4. Configura il database
```powershell
cd D:\004_Software\WebOne\backend_webbone

# Crea il file .env (se non esiste già)
# Contenuto:
#   DATABASE_URL=mysql://root:@localhost:3306/webone
#   PORT=5000
#   JWT_SECRET=webone_secret_key_change_me
#   UPLOAD_DIR=./uploads

# Esegui le migration Prisma
npx prisma migrate dev

# Seed iniziale (superadmin + root client)
node prisma/seed.js
```

Credenziali seed:
- **Superadmin**: `super@local` / `StrongP@ssw0rd`
- **Admin**: `admin@local` / `StrongP@ssw0rd`

#### 5. Avvia i server
```powershell
# Terminal 1 — Backend
cd D:\004_Software\WebOne\backend_webbone
node server.js

# Terminal 2 — Frontend
cd D:\004_Software\WebOne\frontend_webbone
npm run dev
```

Apri: **http://localhost:5173/webone/**

---

### Struttura Chiave del Progetto

```
WebOne/
├── backend_webbone/
│   ├── server.js                    ← entry point (porta 5000)
│   ├── .env                         ← DATABASE_URL, PORT, JWT_SECRET
│   ├── prisma/schema.prisma         ← ORM schema (Client, User, Product, File, Group)
│   ├── src/
│   │   ├── app.js                   ← Express config, CORS, routes
│   │   ├── controllers/             ← auth, client, file, group, metrics, product, settings, user
│   │   ├── middlewares/             ← verifyToken, requireRole, restrictToOwnClient
│   │   └── routes/                  ← admin, auth, files, product
│   └── uploads/                     ← storage file per cliente
│       ├── Taipei Metro/
│       └── NobleRail/
│
└── frontend_webbone/
    ├── vite.config.js               ← base: /webone/, proxy /api → :5000
    ├── tailwind.config.js           ← custom blue.950: #0a1929
    └── src/
        ├── App.jsx                  ← routing table (17 route)
        ├── pages/
        │   ├── DataVizualizer.jsx   ← CORE (~1560 righe): grafico + difetti + mappa
        │   ├── ClientFolderPage.jsx ← gestione file upload/download
        │   └── Dashboard.jsx        ← KPI e metriche
        ├── components/
        │   ├── DefectTable.jsx      ← tabella difetti EN 13231-3 con export CSV/Excel/PDF
        │   └── Sidebar.jsx          ← navigazione laterale
        └── utils/
            ├── geoParser.js         ← parser binario .geo (152 byte/pacchetto)
            └── api.js               ← axios instance con interceptor JWT
```

---

### Stato Sviluppo (al 2026-06-10)

Leggi sempre il file **`.agent_specs_log.md`** nella root del progetto per il log tecnico aggiornato delle modifiche.

#### Feature implementate ✅
- Login multi-utente con JWT (roles: superadmin / admin / cliente)
- Gestione clienti/utenti/gruppi/prodotti (admin panel)
- Upload file chunked (resumable) con progress bar
- Download con progress e cancellazione
- **DataVizualizer**: grafico oscilloscopio Chart.js con zoom/pan
- **Parser .geo** binario (formato proprietario TGMAnalyzer, 152 byte/record)
- **Singolarità ferroviarie** su mappa (click su grafico → menu contestuale → salvataggio JSON)
- **Mappa Leaflet** sincronizzata con hover sul grafico (GPS lat/lon dai dati)
- **Toleranze EN 13231-3**: persistenza via API `/api/files/tolerances`
- **Tabella Difetti** (`DefectTable.jsx`):
  - Segmentazione automatica sezioni consecutive fuori-soglia
  - **Priority A** (intensità): `(maxDefect - threshold) / threshold × 100`
  - **Priority B** (estensione): `punti_out / punti_totali_sezione × 100`
  - Export CSV / Excel / PDF (stampa HTML)
  - Checkbox "Validated" e "PDF" per riga (ID stabile tra render)
  - Filtro per canale, ricerca testo, sort multi-colonna, raggruppamento

#### Feature pendenti / TODO 🔲
- Endpoint backend `POST /api/files/defects/save` per persistenza flag validated/pdf (sul modello di `/singularities/save`)
- Modulo GIS avanzato (Track Chart con mappa lineare)
- Dashboard con KPI aggregati per linea
- Integrazione SAP (export formato standard)
- Test unitari (Jest + React Testing Library)

---

### Endpoint API Principali

| Metodo | URL | Descrizione |
|---|---|---|
| POST | `/api/auth/login` | Login → JWT |
| GET | `/api/auth/me` | Profilo utente corrente |
| GET | `/api/files/:folder` | Lista file in cartella |
| GET | `/api/files/raw?folder=&file=&download=1` | Download file (CSV/GEO) |
| POST | `/api/files/singularities/save` | Salva singolarità in JSON |
| GET | `/api/files/tolerances?folder=` | Leggi tolleranze |
| POST | `/api/files/tolerances/save` | Salva tolleranze |
| GET | `/admin/metrics` | Dashboard counts |
| POST | `/admin/clients` | Crea azienda cliente |
| POST | `/admin/users` | Crea utente |

---

### Script Utili

```powershell
# Sincronizza da PC locale → Google Drive (esclude node_modules, .git, dist)
robocopy "D:\004_Software\WebOne" "G:\Il mio Drive\GESTIONE TITS\99_PROGETTI\P2604 - RAMSYS\WebOne" /MIR /XD node_modules .git dist /R:1 /W:1 /NP /MT:8

# Sincronizza da Google Drive → PC locale (nuovo PC)
robocopy "G:\Il mio Drive\GESTIONE TITS\99_PROGETTI\P2604 - RAMSYS\WebOne" "D:\004_Software\WebOne" /MIR /XD node_modules .git dist /R:1 /W:1 /NP /MT:8
```

---

### Note Importanti per l'AI Agente

1. **NON eseguire mai i server dalla cartella Google Drive** — usare sempre il path locale `D:\004_Software\WebOne\`
2. **I file `.geo`** di test sono in `backend_webbone/uploads/Taipei Metro/Track Geometry/`
3. **`DataVizualizer.jsx`** è il componente più complesso (~1560 righe): contiene grafico, mappa, singolarità, tolleranze e tabella difetti tutto inline
4. **TailwindCSS** usa il custom color `blue.950: '#0a1929'` definito in `tailwind.config.js`
5. **Formato km** in tutta la UI: `km+mmm` (es. `2+450` = 2450 m) via `formatRailwayKm()`
6. **Separatori decimali** nei CSV: formato europeo (virgola) → convertito automaticamente in punto dal parser
7. Il log tecnico delle decisioni ingegneristiche è in **`.agent_specs_log.md`** — aggiornarlo ad ogni modifica rilevante
8. Le specifiche complete sono in **`specifiche_implementative.md`** (1230 righe)
