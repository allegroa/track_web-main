### Prompt di Specifica Architetturale: RailProfile Module (V2)

Genera l'architettura software e lo scheletro del codice per il nuovo sistema RailProfile, applicando un paradigma a micro-moduli (o plugin indipendente) isolato dal resto dell'applicazione core (denominata Webone).

Il modulo deve essere progettato in modo tale che la sua aggiunta, rimozione o modifica non impatti in alcun modo le funzionalità esistenti di Webone.

#### 1. Struttura delle Directory e File System

Il sistema deve prevedere la creazione di una nuova directory radice dedicata a RailProfile, posizionata allo stesso livello delle cartelle esistenti (Config, Manual, Upload).

Tutti i file necessari allo sviluppo, alla configurazione, al deployment e alla generazione del codice (inclusi i prompt di configurazione ed evoluzione) devono risiedere tassativamente ed esclusivamente all'interno di questa cartella, garantendo l'autocontenimento totale del modulo.

La struttura deve essere organizzata come segue:

```text
[Root Webone]
├── Config/
├── Manual/
├── Upload/
└── RailProfile/
    ├── prompts/          # Tutti i prompt di sviluppo, IA e documentazione generativa
    ├── backend/
    │   ├── config/       # Configurazioni esclusive di RailProfile
    │   ├── controllers/  # Logica di business del modulo
    │   ├── models/       # Strutture dati / ORM specifiche
    │   └── routes/       # Endpoint API dedicati
    └── frontend/
        ├── assets/       # Risorse statiche specifiche
        ├── components/   # Componenti UI dedicati
        └── views/        # Schermate principali del profilo

```

#### 2. Requisiti di Disaccoppiamento e Autocontenimento (Isolamento Architetturale)

* Backend Indipendente: Il backend di RailProfile deve gestire le proprie rotte e la propria logica di business. L'integrazione con l'applicazione core di Webone deve avvenire esclusivamente tramite un unico punto di aggancio (es. l'iniezione dinamica delle rotte in fase di avvio o un middleware di routing), senza hard-coding nei file principali di Webone.
* Frontend Indipendente: Il frontend deve essere autocontenuto. Eventuali viste o componenti di RailProfile devono essere caricati dinamicamente dall'interfaccia principale di Webone (es. tramite routing dinamico o micro-frontend).
* Isolamento dei File di Sviluppo: Nessun file sorgente, script di build locale, file di configurazione specifico o prompt di sviluppo legato a RailProfile deve essere posizionato al di fuori della directory /RailProfile/.
* Gestione degli Errori e Rimozione: Se la cartella RailProfile viene eliminata dal file system, Webone deve continuare a funzionare regolarmente, limitandosi a non registrare le rotte e a non mostrare i relativi punti di accesso nella UI, senza generare crash o eccezioni fatali.

#### 3. Output Richiesto

1. Configurazione del Router: Fornisci l'esempio di codice per il file di routing interno a RailProfile e il codice minimo da inserire nel router principale di Webone per l'inclusione condizionale automatica (es. scansione della directory o controllo di esistenza del modulo).
2. Protocollo di Comunicazione: Definizione degli standard di comunicazione tra il core di Webone e il modulo RailProfile (es. passaggio del contesto utente o dei token di autenticazione senza creare dipendenze circolari).
3. Linee Guida per il Deployment: Istruzioni per aggiungere o rimuovere il modulo operando esclusivamente sulla directory RailProfile.

#### 4. Specifiche Dati e Logica di Dominio (RailProfile)
* Parsing Nome File CSV: Il pattern atteso è `YYMMDD-HHMMSS_[VehicleID][MMGG][LineCode][Direction][1?]__[wear_side]_Wear.csv`. 
* Stazione di Partenza e Arrivo: La sigla della stazione di partenza coincide esclusivamente con il `LineCode` estratto dal nome del file. La stazione di arrivo è impostata a "N/A".
* Chilometrica (KM): Sia `starting_km` che `ending_km` devono essere visualizzati rigorosamente con 3 cifre decimali. Il valore `ending_km` deve essere dedotto dinamicamente leggendo il valore chilometrico dell'ultima riga di dati valida all'interno del file CSV originale.
* Deduplicazione Record (Left/Right): I file di misurazione usura lato destro (`_right_Wear.csv`) e sinistro (`_left_Wear.csv`) generano sessioni distinte nel DB ma devono essere raggruppati in un'unica entità visiva nel frontend aggregando per Data, Ora, Direzione e Linea.
* Azioni CRUD: Devono essere disponibili funzionalità di Modifica (Edit) ed Eliminazione (Delete) per ogni sessione. Tali azioni devono propagarsi univocamente su tutti i record gemelli raggruppati (left e right).
