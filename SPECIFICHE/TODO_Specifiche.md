# TODO - Specifiche Software RAMSYS (TGMS / RP)

> Scaletta delle funzionalità da implementare, derivata dai documenti:
> - [Specifiche.docx](file:///d:/004_Software/WebOne/trackg_web-main/SPECIFICHE/Specifiche.docx)
> - [Rapporto_TQI_IT.docx](file:///d:/004_Software/WebOne/trackg_web-main/SPECIFICHE/Rapporto_TQI_IT.docx)
>
> Legenda stati: `[ ]` da fare · `[/]` in corso · `[x]` completato · `[?]` richiede chiarimento

---

## A. Calcolo TQI (Track Quality Index)

*Fonte: Specifiche.docx + Rapporto_TQI_IT.docx*

Il TQI quantifica la qualità geometrica del binario. Il valore è la somma delle deviazioni standard (σ) di 7 parametri geometrici:
`TQI = σ_scartamento + σ_sopraelevazione + σ_allineamento_sx + σ_allineamento_dx + σ_livello_sx + σ_livello_dx + σ_planarità`

- [ ] **A1 – Formula TQI configurabile**: L'operatore deve poter definire e modificare la formula di calcolo del TQI.
  - [ ] A1.1 – Implementare la formula standard: `σ = √[ (1/n) · (1/(n−1)) · ( Σxi² − (Σxi)² ) ]`
  - [ ] A1.2 – UI per inserimento/modifica della formula
  - [?] **A1.3 – CHIARIMENTO NECESSARIO**: La formula deve essere completamente personalizzabile dall'operatore (es. editor di formula) oppure è sufficiente una selezione tra formule predefinite?

- [ ] **A2 – Valori base configurabili**: L'operatore deve poter definire i valori di riferimento (basic values).
  - [ ] A2.1 – Valore di sforamento tratto rettilineo/curva: 10,75 (default, da 9,77 + 10%)
  - [ ] A2.2 – Valore di sforamento tratto di transizione: soglia a +20% rispetto al mese precedente, oppure +10% per due mesi consecutivi
  - [ ] A2.3 – UI per configurazione dei valori base per ogni linea

- [ ] **A3 – Segmentazione TQI**: Il calcolo deve essere suddiviso per tipologia di tratto:
  - [ ] A3.1 – Tratto rettilineo (Tangent Line)
  - [ ] A3.2 – Tratto in curva (Curve)
  - [ ] A3.3 – Tratto di transizione (Transition Curves)

- [ ] **A4 – Calcolo sforamento tratti suddivisi**: Per l'intera linea, calcolare `x̄i + 3σ` come soglia di sforamento.
  - [ ] A4.1 – Calcolo statistico per tratto rettilineo
  - [ ] A4.2 – Calcolo statistico per tratto in curva
  - [ ] A4.3 – Calcolo statistico per tratto di transizione

---

## B. Database GIS

*Fonte: Specifiche.docx*

L'operatore deve poter creare un database GIS basato su km iniziale / km finale.

- [ ] **B1 – Creazione database GIS**: Permettere la definizione di segmenti per chilometraggio (da km a km).
- [ ] **B2 – Caratteristiche/Parametri GIS**: Definizione con simboli e colori classificati:
  - [ ] B2.1 – Tipologia traverse (Sleeper Types)
  - [ ] B2.2 – Piastra (Slab)
  - [ ] B2.3 – Massicciata (Ballast)
  - [ ] B2.4 – Curvature (Curvatures)
  - [ ] B2.5 – Tonnellaggio (Tonnage)
  - [ ] B2.6 – Scambi (Switches)
  - [?] **B2.7 – CHIARIMENTO NECESSARIO**: I "simboli e colori classificati" devono essere predefiniti nel software oppure completamente configurabili dall'operatore? Esiste uno standard di riferimento per la simbologia?

---

## C. Segmentazione del Binario (Track Segmentation)

*Fonte: Specifiche.docx*

- [ ] **C1 – Segmentazione per caratteristiche GIS**: Segmentare in base alle proprietà definite in B2. Es: tutti i tratti con curvatura di 200 m.
- [ ] **C2 – Segmentazione per km**: Segmentare in base a km iniziale / km finale definiti dall'operatore.
- [ ] **C3 – Segmentazione per lunghezza fissa**: Segmentare per lunghezza definita dall'operatore (es. ogni 5 km).
- [?] **C4 – CHIARIMENTO NECESSARIO**: La segmentazione deve supportare criteri combinati (es. curvatura = 200m E tipo traversa = Slab) oppure solo un criterio alla volta?

---

## D. Gestione Manutenzione (Maintenance Management)

*Fonte: Specifiche.docx*

- [ ] **D1 – Soglie di manutenzione configurabili**: L'operatore deve poter definire 3 livelli:
  - [ ] D1.1 – Livello di Sicurezza T3 (Safety Level)
  - [ ] D1.2 – Livello di Manutenzione T2 (Maintenance Level)
  - [ ] D1.3 – Livello di Gestione T1 (Management Level)
  - [?] **D1.4 – CHIARIMENTO NECESSARIO**: I livelli T1/T2/T3 si applicano a ciascun parametro di misura individualmente (scartamento, allineamento, ecc.) oppure al valore TQI complessivo?

- [ ] **D2 – Visualizzazione percentuale superamento T2**: Mostrare la % di km che supera la soglia T2 per un singolo parametro in un grafico (plot).

- [ ] **D3 – Visualizzazione percentuale per tratta selezionata**: Mostrare la % di superamento per una sezione/segmento selezionato dall'operatore, con dati multi-diagnostica su un periodo (es. 3 mesi).

- [ ] **D4 – Regole di manutenzione configurabili**: L'operatore deve poter definire regole basate su soglie e segmentazioni. Esempi dal documento:
  - [ ] D4.1 – `Politica = "Cambio Rotaia"` se `Scartamento > T3` E `W4 > T3`
  - [ ] D4.2 – `Politica = "Rettifica" (Grinding)` se `W2 > T2`
  - [?] **D4.3 – CHIARIMENTO NECESSARIO**: Cosa sono i parametri "W4" e "W2"? Sono parametri di usura ondulata (wave wear)? A quali indici specifici corrispondono nei dati CSV del carro di ispezione?
  - [?] **D4.4 – CHIARIMENTO NECESSARIO**: Le regole devono supportare solo condizioni AND oppure anche OR e operatori più complessi? È necessario un motore di regole (rule engine)?

---

## E. Archivio Interventi di Manutenzione (Maintenance Records Database)

*Fonte: Specifiche.docx*

- [ ] **E1 – Creazione archivio interventi**: Il software deve consentire la registrazione degli interventi di manutenzione nel database.
- [ ] **E2 – Ricerca interventi per periodo**: Ricerca di interventi per tipo (es. "cambio rotaia", "rettifica") in un intervallo temporale.
- [ ] **E3 – Visualizzazione interventi su grafico**: Mostrare gli interventi come simboli sovrapposti al plot dei parametri di misura / statistiche.
- [?] **E4 – CHIARIMENTO NECESSARIO**: Quali campi deve contenere un record di manutenzione? (Es: data, tipo intervento, km iniziale/finale, operatore, note, foto?)

---

## F. Validazione Dati (Data Validation)

*Fonte: Specifiche.docx*

- [ ] **F1 – Allineamento km di acquisizioni multiple**: Allineare i grafici dei parametri di diverse acquisizioni in base al chilometraggio.
- [ ] **F2 – Eliminazione manuale dati CSV**: Consentire la cancellazione manuale di dati CSV per un intervallo km iniziale / km finale in caso di dati errati.
- [?] **F3 – CHIARIMENTO NECESSARIO**: L'eliminazione dei dati (F2) è distruttiva (cancella dal database originale) oppure si tratta di un flag "escludi dal calcolo" mantenendo i dati originali?

---

## G. Reportistica / PDF

*Fonte: Specifiche.docx + Rapporto_TQI_IT.docx*

- [ ] **G1 – Generazione report PDF**: Il sistema deve generare report per tutte le analisi effettuate.
- [ ] **G2 – Database delle analisi**: Creare un archivio di tutte le analisi effettuate dall'operatore.
- [ ] **G3 – Report TQI stile Taipei Metro**: Basandosi sulla struttura del Rapporto_TQI_IT.docx, il report deve contenere:
  - [ ] G3.1 – Sezione I: Condizioni di analisi (formula, lunghezza calcolo, condizioni rilevamento, dati utilizzati, apparecchiatura)
  - [ ] G3.2 – Sezione II: Grafici di tendenza TQI per linea (rettilineo, curva, transizione)
  - [ ] G3.3 – Sezione III: Analisi dell'indice di qualità del binario (riepilogo per tipo tratto)
  - [ ] G3.4 – Sezione IV: Risultati calcolo condizioni di sforamento (statistiche x̄i + 3σ)
  - [ ] G3.5 – Sezione V: Analisi per tratta (oscillazione, carro ispezione, reclami pubblico)
- [?] **G4 – CHIARIMENTO NECESSARIO**: Il formato del report deve replicare esattamente la struttura del Rapporto_TQI_IT.docx (modello Taipei Metro), oppure è sufficiente un report con contenuto equivalente ma layout differente?

---

## H. Interfaccia con Sistema ERP

*Fonte: Specifiche.docx*

- [ ] **H1 – Interfaccia ERP del cliente**: Il software deve poter interfacciarsi con il sistema ERP del cliente.
- [?] **H1.1 – CHIARIMENTO NECESSARIO**: Quale sistema ERP è utilizzato dal cliente? (SAP, Oracle, altro?)
- [?] **H1.2 – CHIARIMENTO NECESSARIO**: Quale tipo di integrazione è richiesta? (Export dati, API REST, file exchange, database link?)
- [?] **H1.3 – CHIARIMENTO NECESSARIO**: Quali dati devono essere scambiati con l'ERP? (Solo interventi di manutenzione? Anche risultati TQI? Dati GIS?)

---

## I. Analisi Specifiche da Rapporto TQI (Rapporto_TQI_IT.docx)

*Fonte: Rapporto_TQI_IT.docx – funzionalità derivate dall'analisi del report di esempio*

- [ ] **I1 – Confronto con test oscillazione**: Comparazione dati TQI con rapporti di test oscillazione del treno (sway/vibration test), con soglia 0,13 g.
- [ ] **I2 – Confronto con carro ispezione**: Comparazione dati TQI con rapporti del carro di ispezione del binario.
- [ ] **I3 – Gestione reclami pubblico**: Associazione dei reclami del pubblico ai tratti TQI, con tabella riepilogativa.
  - [?] **I3.1 – CHIARIMENTO NECESSARIO**: La gestione reclami è una funzionalità del software (con inserimento e tracciamento) oppure sono solo dati importati da fonti esterne?
- [ ] **I4 – Monitoraggio bimestrale**: Il report TQI viene generato ogni 2 mesi. Il software deve supportare analisi periodiche configurabili.
- [ ] **I5 – Esclusione tratte dal calcolo**: Possibilità di escludere specifiche tratte dal calcolo (es. diramazioni Xinbeitou e Xiaobitan nel caso Taipei Metro).

---

## Riepilogo Chiarimenti Richiesti

| ID | Argomento | Domanda |
|:---|:---------|:--------|
| A1.3 | Formula TQI | Editor formula libera o selezione tra predefinite? |
| B2.7 | Simbologia GIS | Simboli predefiniti o configurabili? Standard di riferimento? |
| C4 | Segmentazione | Supporto criteri combinati (AND/OR)? |
| D1.4 | Soglie T1/T2/T3 | Si applicano per parametro singolo o TQI complessivo? |
| D4.3 | Parametri W4/W2 | Cosa rappresentano? Quali dati CSV corrispondono? |
| D4.4 | Regole manutenzione | Solo AND o anche OR e operatori complessi? |
| E4 | Record manutenzione | Quali campi deve contenere? |
| F3 | Eliminazione dati | Distruttiva o con flag di esclusione? |
| G4 | Formato report | Replica esatta modello Taipei o layout libero? |
| H1.1 | Sistema ERP | Quale sistema ERP è in uso? |
| H1.2 | Integrazione ERP | Tipo: API, file, DB link? |
| H1.3 | Dati ERP | Quali dati scambiare? |
| I3.1 | Reclami pubblico | Funzionalità interna o dati importati? |

---

*Documento generato il 2026-07-03 sulla base di Specifiche.docx e Rapporto_TQI_IT.docx*
