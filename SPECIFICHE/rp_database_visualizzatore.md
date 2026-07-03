### Prompt di Sviluppo: RP_database_visualizzatore

Crea una pagina React per la visualizzazione e la gestione del database delle sessioni del modulo **RailProfile v1.0 (visualizeExplore)**. L'interfaccia deve replicare esattamente il design pulito, moderno e professionale mostrato nell'immagine allegata, seguendo le specifiche e i requisiti di seguito dettagliati.

---

#### 1. Layout e Design System (Aesthetic Premium)

* **Font e Tipografia**: Utilizza un font Sans-serif pulito (preferibilmente **Inter** o **Outfit**) con pesi differenti per definire chiaramente la gerarchia visiva.
* **Header della Pagina**:
  * **Logo & Titolo**: Posizionato in alto a sinistra. Mostra l'icona del logo "RailProfile" (due anelli blu intrecciati/infinito stilizzato o icona simile) affiancato dal testo bold **RailProfile** in grigio scuro (`text-slate-800`) e da un badge ad angoli arrotondati con il testo **v1.0** in azzurro (`bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded`).
  * **Sottotitolo**: Immediatamente sotto il titolo principale, visualizza il testo **visualizeExplore** in colore grigio chiaro e stile regolare (`text-slate-400 text-sm`).
  * **Pulsante di Configurazione**: Posizionato in alto a destra. Deve essere un bottone scuro (`bg-slate-900 text-white hover:bg-slate-800 px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-all`) con l'icona di un ingranaggio (cog) a sinistra e l'etichetta **Configuration**.
* **Contenitore Tabella (Card)**:
  * La tabella deve essere inserita in un contenitore bianco (`bg-white`) con angoli arrotondati (`rounded-xl`), bordo sottile chiaro (`border border-slate-100`) e un'ombra morbida (`shadow-sm`).

---

#### 2. Struttura e Colonne della Tabella

La tabella visualizza le sessioni di rilievo aggregate per Data, Ora, Direzione e Linea (pairing sinistra/destra). Implementa le seguenti colonne:

1. **SELECT**: Contiene una checkbox per la selezione della riga (`w-12 text-center`).
2. **MEASUREMENT DATE**: Data della misurazione. Deve includere l'icona di ordinamento ed essere formattata come `YYYY.MM.DD` (es. `2026.01.23`).
3. **MEASUREMENT TIME**: Ora della misurazione. Deve includere l'icona di ordinamento ed essere formattata come `HH:MM:SS` (es. `02:17:46`).
4. **STARTING KM**: Progressiva chilometrica iniziale. Deve includere l'icona di ordinamento ed essere formattata rigorosamente con 3 cifre decimali (es. `100.290`).
5. **ENDING KM**: Progressiva chilometrica finale. Deve includere l'icona di ordinamento ed essere formattata rigorosamente con 3 cifre decimali (es. `92.205`).
6. **LENGTH (KM)**: Lunghezza totale della tratta calcolata come differenza assoluta tra `starting_km` ed `ending_km`. Deve includere l'icona di ordinamento ed essere formattata con 3 cifre decimali (es. `8.085`).
7. **STAZIONE PARTENZA**: Codice della stazione di partenza (es. `CHLZL`, `XYL`, `NKL`).
8. **STAZIONE ARRIVO**: Impostato di default a `N/A`.
9. **DIRECTION**: Direzione della tratta. Visualizzato in grassetto blu (`text-blue-800 font-bold`), assumendo i valori **UP** o **DN**.
10. **QUALITY INDEX**: Indice di qualità calcolato in percentuale. Deve includere l'icona di ordinamento ed essere formattato come badge/pill a sfondo chiaro e testo colorato a seconda del valore (vedi logica sotto).
11. **AZIONI**: Contiene due icone di azione allineate a destra: una matita (Modifica) e un cestino (Elimina).

---

#### 3. Formattazione e Logica dei Badge di Qualità (Quality Index)

L'indice di qualità viene calcolato dinamicamente tramite la media pesata dei superamenti delle soglie $T1-T4$ per i parametri $W1-W4$. Il valore risultante deve essere formattato con una cifra decimale (es. `78.2%`) e visualizzato con i seguenti stili grafici a seconda della soglia:

* **Eccellente (`> 95%`)**: Badge verde chiaro (`bg-green-50 text-green-700 border border-green-100 font-semibold px-2.5 py-1 rounded-full text-xs`).
* **Buono (`85% - 95%`)**: Badge giallo/ocra chiaro (`bg-yellow-50 text-yellow-700 border border-yellow-100 font-semibold px-2.5 py-1 rounded-full text-xs`).
* **Attenzione (`70% - 85%`)**: Badge arancione chiaro (`bg-orange-50 text-orange-700 border border-orange-100 font-semibold px-2.5 py-1 rounded-full text-xs`).
* **Critico (`< 70%`)**: Badge rosso chiaro (`bg-red-50 text-red-700 border border-red-100 font-semibold px-2.5 py-1 rounded-full text-xs`).

---

#### 4. Funzionalità e Comportamenti Utente

* **Ordinamento (Sorting)**:
  * Permetti all'utente di ordinare i record cliccando sulle intestazioni delle colonne abilitate (Date, Time, Starting KM, Ending KM, Length, Quality Index).
  * L'icona di ordinamento deve cambiare per indicare la direzione attiva (crescente/decrescente).
* **Hover ed Espansione Dati (Sintesi Eccedenze)**:
  * Al passaggio del mouse su una riga della tabella (effetto hover morbido con `bg-slate-50/50`), deve comparire in modo fluido una riga di dettaglio o un tooltip espanso immediatamente sotto la riga stessa (come mostrato nel codice di riferimento `renderHoverSummary`).
  * Questa sezione deve mostrare la sintesi dei punti analizzati e le relative percentuali di eccedenza per ciascuno dei quattro parametri di usura (**W1, W2, W3, W4**) suddivisi per le soglie configurate (**T1, T2, T3, T4**).
* **Azioni CRUD**:
  * **Modifica (Edit)**: Il click sul pulsante matita deve abilitare la modifica in-line dei metadati (Data, Ora, Progressiva Chilometrica, Direzione) o aprire un box di editing modale. La modifica deve inviare una richiesta `PUT /api/railprofile/sessions/:id` propagando le modifiche su entrambe le rotaie associate.
  * **Eliminazione (Delete)**: Il click sul cestino deve mostrare un popup di conferma e, in caso di assenso, richiamare l'endpoint `DELETE /api/railprofile/sessions/:id` per cancellare in modo definitivo entrambi i file (sinistro e destro) e le relative statistiche.
  * **Configurazione**: Il click sul pulsante "Configuration" in alto a destra deve aprire una modale per aggiornare globalmente i valori delle soglie $T1-T4$ per i parametri $W1-W4$, salvandoli tramite `POST /api/railprofile/config`.

---

#### 5. Integrazione Backend ed Endpoint API

L'interfaccia deve interfacciarsi con i seguenti endpoint del backend:
* **Lettura Sessioni**: `GET /api/railprofile/sessions` per popolare la tabella.
* **Salvataggio Configurazione Soglie**: `POST /api/railprofile/config` per aggiornare le soglie di tolleranza.
* **Aggiornamento Sessione**: `PUT /api/railprofile/sessions/:id` per aggiornare i metadati modificati.
* **Cancellazione Sessione**: `DELETE /api/railprofile/sessions/:id` per rimuovere i record fisici ed a DB delle misurazioni.
