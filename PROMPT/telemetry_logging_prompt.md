**Obiettivo:**
Integrare un sistema di telemetria e monitoraggio degli errori all'interno di WebOne (Next.js) per tracciare in tempo reale i bug, i messaggi di errore e capire il comportamento degli utenti (chi fa cosa) senza dipendere da log sulla rete locale.

**Requisiti Tecnici:**
1. **Error Tracking (Sentry):**
   - Installa e configura `@sentry/nextjs`.
   - Configura il file `sentry.client.config.js`, `sentry.server.config.js` e `sentry.edge.config.js` in modo da catturare automaticamente tutte le eccezioni frontend e backend.
   - Avvolgi i componenti critici (es. `DataVisualizer.jsx`) in un `ErrorBoundary` customizzato di Sentry per mostrare un messaggio amichevole all'utente in caso di crash grafico, inoltrando contestualmente lo stack trace al server Sentry.

2. **Product Analytics & Session Replay (PostHog):**
   - Installa il pacchetto `posthog-js`.
   - Inizializza PostHog nel `layout.js` (o `_app.js` a seconda del router Next.js) per tracciare automaticamente la navigazione delle pagine.
   - Crea un hook o una funzione di utilità (es. `trackEvent`) per inviare eventi personalizzati (es. "Importazione CSV avviata", "Soglia Tolleranza Modificata", "Export PDF cliccato").
   - Assicurati di inviare a PostHog e a Sentry l'identificativo dell'utente attivo (es. il nome dell'Operatore salvato nella configurazione) per poter legare gli errori a uno specifico operatore (es. identificatore: `activeOperator`).

3. **Fallback Webhook (Opzionale / Slack / Teams):**
   - Crea un endpoint `/api/log-error` interno. Se impostata una variabile d'ambiente `WEBHOOK_URL`, questo endpoint riceve un JSON con il log dell'errore (dal frontend) e fa una semplice richiesta POST verso la chat aziendale per notificare immediatamente il team tecnico.

**Credenziali (da usare come variabili d'ambiente in `.env`):**
- `NEXT_PUBLIC_SENTRY_DSN` (chiave del progetto Sentry)
- `NEXT_PUBLIC_POSTHOG_KEY` (chiave del progetto PostHog)
- `NEXT_PUBLIC_POSTHOG_HOST` (es. `https://eu.posthog.com`)
- `ERROR_WEBHOOK_URL` (URL del webhook di Slack/Teams)

**Output Atteso:**
- Codice di configurazione per Sentry e PostHog nel progetto Next.js.
- Comandi per installare le librerie necessarie (`npx @sentry/wizard@latest -i nextjs`, `npm install posthog-js`).
- Esempi di implementazione nel componente `DataVisualizer.jsx` per tracciare gli errori di parsing dei file e gli eventi di interazione (es. modifiche delle tolleranze).
