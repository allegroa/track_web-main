# Specifiche di Configurazione e Importazione via Email TGM

Questo documento definisce le specifiche tecniche per il canale di importazione automatica via email delle acquisizioni TGM, estendendo e integrando la macchina a stati e le logiche descritte nel documento `tgm_import_file.md`.

---

## 1. Configurazione del Canale Email (UI)

Le impostazioni per l'importazione automatizzata tramite casella di posta elettronica devono essere accessibili in una sezione dedicata del sistema.

- **Percorso (Route)**: L'interfaccia di configurazione si trova all'interno della rotta `/configuration`.
- **Tab Dedicato**: All'interno della pagina delle configurazioni, deve essere implementato un tab specifico denominato **"Email"**.

### 1.1 Credenziali e Sicurezza

Nel tab **Email**, l'utente deve poter inserire e gestire i parametri di connessione per la ricezione (IMAP) e l'invio (SMTP) alla casella postale:

- **Indirizzo Email**: Il campo conterrà l'indirizzo della casella (Default: `railpulse@adts.it`).
- **Password**: 
  - Il campo per la password conterrà le credenziali di accesso (Default: `RaIlpul1!26`).
  - **Mascheramento**: Per questioni di sicurezza, il testo all'interno di questo campo **non deve essere visibile** di default (visualizzato con pallini o asterischi, es. `••••••••••`).
  - **Funzione "Rivela Password"**: Alla destra dell'input della password deve essere presente un'icona interattiva a forma di occhiolino. Cliccando l'icona, la password diventa temporaneamente in chiaro (leggibile). Un secondo click o il cambio di focus ripristina il mascheramento del testo.
- **Parametri IMAP (Ricezione)**:
  - **Host IMAP**: L'indirizzo del server di posta in arrivo (es. `imap.tuoserver.it`).
  - **Porta IMAP**: La porta utilizzata per la connessione (es. `993`).
  - **Sicurezza SSL/TLS**: Opzione per abilitare la connessione sicura crittografata.
- **Parametri SMTP (Invio)**:
  - **Host SMTP**: L'indirizzo del server di posta in uscita (es. `smtp.tuoserver.it`), necessario per inviare notifiche di errore al mittente.
  - **Porta SMTP**: La porta utilizzata per la connessione in uscita (es. `465` o `587`).
  - **Sicurezza SSL/TLS**: Opzione per abilitare la connessione sicura crittografata.
- **Test Connessione**:
  - Deve essere presente un pulsante **"Test Connessione Email"** che, senza scaricare nulla, tenta il collegamento al server IMAP con le credenziali inserite e restituisce un feedback visivo di successo o fallimento (es. un badge verde o rosso).

### 1.2 Temporizzazione del Controllo (Polling)

Il sistema deve verificare ciclicamente la presenza di nuove acquisizioni.

- **Intervallo Configurabile (X minuti)**: Nel tab **Email** deve essere presente un campo di input numerico che permette di impostare l'intervallo di polling in minuti (es. ogni 10, 15, 60 minuti).
- Il servizio in background utilizzerà questo valore per schedulare le richieste al server di posta.

---

## 2. Flusso di Ricezione e Importazione (Semi-Automatico)

Il processo di gestione delle email non esegue un'importazione completamente automatica nel database, ma si divide in due fasi: il download autonomo e l'importazione manuale controllata dall'operatore.

### 2.1 Controllo e Download in Background
- Allo scadere dei minuti configurati, il backend si collega al server di posta (via IMAP/POP3) utilizzando le credenziali salvate.
- Il sistema filtra e analizza tutte le email presenti che contengono allegati di tipo archivio compresso (`.zip`, `.rar`). Non è richiesto che l'email sia "Non Letta".
- Se presenti, gli allegati vengono scaricati automaticamente all'interno di una **directory temporanea** sul server e la mail viene **eliminata definitivamente** dal server di posta per non essere processata nuovamente nei cicli successivi.
- **Sistema di Logging**: Ogni volta che viene elaborata un'email con allegati validi, il sistema deve estrarre il mittente dagli header e scrivere una voce nel file persistente `configuration/email_receipts.log` (formato: Data/Ora, Mittente, File scaricati).

### 2.2 Notifica all'Interfaccia Utente (Warning)
- Tramite un meccanismo di polling (o WebSocket) il frontend verifica periodicamente la presenza di file nella directory temporanea.
- L'interfaccia grafica mostrerà un **banner persistente color ambra** in alto sulla dashboard, contenente il testo tradotto (es. "Ci sono N file ricevuti via email pronti per l'importazione") e un pulsante **"Importa Ora"**.

### 2.3 Importazione Manuale da parte dell'Operatore
- Cliccando su **"Importa Ora"**, il banner scompare istantaneamente e il sistema richiama la normale **macchina a stati interattiva** (descritta in `tgm_import_file.md`).
- A differenza del caricamento dal PC dell'operatore (Drag & Drop), l'API di importazione recupera i file direttamente dalla cartella `tmp_uploads/email_queue/` del server, saltando la fase di upload dal browser all'applicazione.
- Essendo l'operatore presente, il processo usufruirà di tutta la gestione interattiva standard (barre di progresso, sovrascrittura di sessioni duplicate, estrazione, validazione CSV).
- Al termine dell'importazione avvenuta con successo, il file originale estratto dall'email viene cancellato automaticamente.

---

## 3. Gestione Errori e Risposta al Mittente

Nel caso in cui, durante l'elaborazione (sia in fase di analisi preliminare in background, sia durante la validazione dell'importazione manuale), il sistema rilevi che il/i file ricevuti **non sono conformi** agli standard previsti (es. archivio corrotto, file CSV mancanti, formato cartella errato, o dati non validi):

1. **Rilevamento Mittente**: Il sistema deve tracciare e conservare l'indirizzo email del mittente originale da cui è stato scaricato l'allegato.
2. **Risposta Automatica**: Il sistema deve inviare automaticamente un'email di risposta (Reply) allo stesso indirizzo mittente.
3. **Contenuto del Messaggio**: 
   - L'email dovrà notificare il fallimento dell'importazione.
   - Dovrà includere il dettaglio specifico del **problema riscontrato** (es. "File *X* mancante", "Formato nome cartella non valido").
   - Il messaggio dovrà essere redatto nella **lingua di default** impostata nelle configurazioni globali del sistema.
4. **Pulizia**: I file temporanei non conformi verranno scartati/cancellati per mantenere pulita la cartella di ricezione.
