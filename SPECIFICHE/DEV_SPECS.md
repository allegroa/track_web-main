# Specifiche di Sviluppo RAMSYS (DEV_SPECS)

Questo file contiene le specifiche tecniche, gli appunti di sviluppo e le decisioni architetturali del progetto RAMSYS, in modo da non perdere il contesto.

## Modulo Data Visualizer e Mappa
- **Mappa Interattiva**: Utilizza un `iframe` incorporato di Google Maps (`https://maps.google.com/maps?q={lat},{lon}&output=embed`). Questo garantisce l'uso gratuito e immediato senza necessità di API Key o librerie aggiuntive (come Leaflet o Google Maps API).
- **Layout**: La schermata `DataVisualizer` è divisa a metà (50/50). A sinistra i pannelli di Info e Configurazione Dati. A destra la Google Map.

## File .GEO
- I file `.geo` contengono dati di geometria del binario e presentano un formato proprietario/binario, diverso dal classico CSV.
- Vengono gestiti dall'applicativo per estrarre informazioni specifiche come Latitudine e Longitudine.
- *Nota*: La logica di parsing dei file `.geo` deve tener conto della loro natura non testuale standard.

## Internazionalizzazione (i18n)
- L'applicazione supporta **3 lingue**: Italiano (`it`), Inglese (`en`), Cinese (`zh`).
- Il file principale delle traduzioni si trova in `frontend_webbone/src/i18n.js`.
- Ogni nuova label UI deve utilizzare la funzione `t('chiave')` di `react-i18next`.

## Ambiente di Sviluppo
- **Sorgente Principale**: L'ambiente locale `D:\004_Software\WebOne` (o XAMPP locale) è il master.
- **Sincronizzazione**: Eseguire `sync_to_gdrive.bat` a fine sessione per inviare il backup completo sulla directory cloud `P2604 - RAMSYS\WebOne_Backup`, ignorando le dipendenze pesanti (`node_modules`).
