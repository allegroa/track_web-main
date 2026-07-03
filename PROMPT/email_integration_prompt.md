**Obiettivo:** 
Implementare un sistema automatico nel backend di WebOne (Next.js/Node.js) per ricevere file `.csv` e `.geo` tramite email e salvarli direttamente nella directory dei dati locale in modo che siano immediatamente disponibili sull'interfaccia di DataVisualizer.

**Requisiti Tecnici:**
1. **Integrazione IMAP:** Crea uno script in background o un'API route in Next.js che si connetta a una casella di posta elettronica tramite protocollo IMAP (utilizzando librerie come `imap-simple` o `node-imap`).
2. **Lettura Allegati:** Utilizza una libreria come `mailparser` per analizzare le email non lette. Se l'email contiene allegati con estensione `.csv` o `.geo`, l'allegato deve essere scaricato.
3. **Salvataggio Dati:** Salva i file scaricati nella cartella configurata per l'operatore attivo (leggendo la directory da `configuration/config.json` tramite la variabile `dataSourcePath`). Se l'operatore non ha un path specifico, salva in una cartella di default es. `data/inbox`.
4. **Gestione dello Stato Email:** Una volta processata, segna l'email come "Letta" (Seen) in modo che non venga processata nuovamente nei cicli successivi.
5. **Sicurezza (Whitelist):** Implementa un controllo base sull'indirizzo del mittente: estrai i file solo se il mittente appartiene a un array di indirizzi email autorizzati o a uno specifico dominio aziendale.
6. **Cron Job / Polling:** Configura l'esecuzione automatica (es. tramite `node-cron` se usiamo un server custom, o un semplice timeout di polling asincrono all'avvio del server) per controllare la posta ogni 5 minuti.

**Credenziali (da usare come variabili d'ambiente in `.env`):**
- `IMAP_USER`
- `IMAP_PASSWORD`
- `IMAP_HOST`
- `IMAP_PORT` (es. 993)
- `IMAP_TLS` (true)
- `ALLOWED_EMAILS` (lista separata da virgole)

**Output Atteso:**
- Scrivi il codice del servizio che gestisce la connessione e l'estrazione.
- Spiega come e dove avviare il servizio all'interno del progetto Next.js (es. in un file server personalizzato `server.js` o come un job isolato).
- Fornisci il comando per installare i nuovi pacchetti NPM necessari (`npm install imap-simple mailparser node-cron`).
