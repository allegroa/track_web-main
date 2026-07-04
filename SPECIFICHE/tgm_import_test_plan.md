# Piano di Test - Importazione File TGM

Questo documento elenca in modo sistematico i test funzionali, di integrazione e di UI necessari per validare il modulo di importazione TGM, come descritto nelle specifiche di progetto.

## 1. Test di Flusso Normale (Happy Path)

| ID Test | Descrizione | Azione Utente | Risultato Atteso |
| :--- | :--- | :--- | :--- |
| **HP-01** | Importazione Cartella (Drag & Drop) | Trascinare una cartella (es. `2026.02.27 00.22.18K100+000~K102+500`) con i 3 CSV sulla UI. | L'overlay mostra tutti gli step per almeno 1s e la sessione appare nel database senza errori. |
| **HP-02** | Importazione Archivio ZIP | Cliccare Import File -> Archivio e selezionare un `.zip` valido. | Estrazione server completata, file letti, e sessione registrata con successo. |
| **HP-03** | Importazione Archivio RAR | Cliccare Import File -> Archivio e selezionare un `.rar` valido. | L'archivio viene recompresso o decompresso correttamente tramite il modulo extractor. |
| **HP-04** | Importazione Multi-Cartella | Trascinare due o più cartelle valide contemporaneamente sulla UI. | Il sistema processa le cartelle in parallelo o sequenzialmente aggiornando lo stato per ciascuna, aggiungendole tutte al database con successo, oppure avverte l'utente se l'azione multipla non è consentita. |

## 2. Test di Formato e Validazione

| ID Test | Descrizione | Azione Utente | Risultato Atteso |
| :--- | :--- | :--- | :--- |
| **FV-01** | Formato Nome Errato | Caricare cartella chiamata `Misurazioni_Gennaio`. | Errore rigetto: "Formato cartella non standard". Nessun residuo nel server. |
| **FV-02** | File CSV Mancante | Caricare una cartella valida ma priva del file `*超限報表.csv`. | Errore rigetto: "File obbligatori mancanti". |
| **FV-03** | Contenuto Corrotto | Caricare CSV con header errati o coordinate alfabetiche al posto di numeri. | Errore parser durante lo step "Parsing Contenuto". Annullamento dell'operazione. |

## 3. Test di Conflitto e Duplicazione

| ID Test | Descrizione | Azione Utente | Risultato Atteso |
| :--- | :--- | :--- | :--- |
| **CD-01** | Duplicato Esistente (Annulla) | Caricare una sessione già presente. Al prompt "Duplicato", cliccare "Annulla". | Il processo si interrompe, l'interfaccia si sblocca, il DB non viene alterato. |
| **CD-02** | Duplicato Esistente (Sovrascrivi) | Come sopra, ma cliccare "Sovrascrivi". | La sessione preesistente viene cancellata fisicamente e rimpiazzata dalla nuova, incluso il file JSON di annotazioni. |

## 4. Test di Resilienza, Abort e Rollback

| ID Test | Descrizione | Azione Utente | Risultato Atteso |
| :--- | :--- | :--- | :--- |
| **RB-01** | Abort Manuale Utente | Cliccare "X" (Annulla) mentre l'upload/estrazione della barra di progresso è in corso. | L'AbortController del frontend annulla la chiamata. Il backend cancella i file parzialmente trasferiti. |
| **RB-02** | Rollback Automatico | Forzare un errore lato server a metà del parsing dei CSV. | La directory temporanea viene distrutta, il database principale rimane intatto senza dati corrotti. |
| **RB-03** | Protezione Limite File | Caricare un file compresso di grandi dimensioni (> 150MB). | Il frontend blocca immediatamente l'azione o il backend rifiuta l'upload HTTP 413. |

## 5. UI e Feedback Visivo

| ID Test | Descrizione | Azione Utente | Risultato Atteso |
| :--- | :--- | :--- | :--- |
| **UI-01** | Timing Minimo Overlay | Importare file di piccole dimensioni (frazioni di millisecondo di analisi). | Gli step (Caricamento, Validazione, etc.) rimangono a video per almeno 1 secondo per consentire la lettura (anti-flicker). |
| **UI-02** | Barra di Progresso | Importare file grosso a banda limitata. | La percentuale si aggiorna fluidamente. |
| **UI-03** | Localizzazione | Cambiare lingua in inglese/tedesco e avviare l'importazione. | I testi degli stati (`Rilevamento tipo in corso...`) e gli alert si traducono automaticamente. |
