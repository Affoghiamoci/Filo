# Filo · Design system

Da consultare prima di creare o cambiare qualsiasi interfaccia. Ricavato dal CSS reale dell'app (`src/style.css`). Se una regola qui non basta, copia il componente esistente più simile invece di inventarne uno nuovo.

## 1. Principi
- **Industriale, Apple, Nothing**: squadrato, preciso, poche cose ma curate.
- **Raggio 2 px ovunque**. Mai angoli tondi, tranne pallini colore e badge versione.
- **Un solo accento**, arancione `#ff6a00`, usato per: selezione, focus, indicatore "attivo" (sottolineatura), valori in primo piano. Mai come sfondo grande.
- **Niente ombre morbide**: solo ombra dura a gradino (`--shadow`).
- **Testo del sito**: italiano naturale e diretto, maiuscola solo all'inizio, niente trattini lunghi (em dash), mai la parola "Filo" decorata.
- Ogni cosa che c'è in un pannello esiste già altrove nell'app: riusa, non reinventare.

## 2. Colori (token, mai valori fissi)
| Token | Chiaro | Scuro | Uso |
|---|---|---|---|
| `--panel` | #f6f6f6 | #1d1d20 | sfondo pannelli e finestre |
| `--scene-bg` | #dcdcdf | #141416 | sfondo scena |
| `--text` | #161618 | #f2f2f3 | testo principale |
| `--muted` | #76767c | #92929a | etichette, testo secondario |
| `--line` | nero 22% | bianco 20% | bordi e divisori da 1 px |
| `--field` | nero 5% | bianco 8% | sfondo di campi, segmenti, kbd, tessere |
| `--hover` | nero 5% | bianco 7% | hover righe |
| `--ink` / `--on-ink` | #111113 / #f5f5f5 | invertiti | elemento selezionato, pulsante primario |
| `--accent` | #ff6a00 | #ff6a00 | accento |
| `--accent-weak` | 14% | 22% | selezione morbida |

Stati e assi hanno un token fisso, uguale nei due temi: `--ok` verde `#2fa866`, `--warn` ambra `#e0a100`, `--err` rosso `#e5484d`; assi `--ax-x` `#e5484d`, `--ax-y` `#30a46c`, `--ax-z` `#3e63dd`. Altri token fissi: `--on-accent` (testo bianco sull'accento), `--key` (viola dell'oggetto chiave), `--swatch` (grigio del colore predefinito). Nel CSS non vanno scritti colori a mano, solo token (`color-mix` con `--accent` per sfumature intermedie). Colore oggetti: palette del selettore colore.

## 3. Tipografia
- **Mono** (`--mono`, SF Mono): titoli, etichette, valori numerici, tasti, pulsanti. Sempre maiuscolo con tracking.
- **Sans** (`--font`, SF Pro): frasi e descrizioni. **VT323**: solo logo "Filo" e titoli grandi di benvenuto/avvisi.

| Ruolo | Stile |
|---|---|
| Titolo finestra / pannello | mono 600 12px, tracking .1em, maiuscolo |
| Nome oggetto | mono 600 14px, tracking .04em, maiuscolo |
| Etichetta sezione / campo | mono 500 10.5px, tracking .08em, maiuscolo, `--muted` |
| Pulsante, segmento | mono 500 11px, tracking .05em, maiuscolo |
| Valore in campo | mono 500 12.5px |
| Tasto (kbd) | mono 500 10.5px su `--field` |
| Micro: didascalie della barra, titoli dei menu, tasti sulle righe, badge | mono 500 9.5px, tracking .04 to .1em, maiuscolo |
| Glifi piccoli: "?" dei suggerimenti 8px, etichette del cubo 7.5px | mono 500, sono simboli più che testo da leggere |
| Badge versione (sidebar e Info) | pillola tonda, bordo 1px accento, fondo accento 12%, mono 500 9.5px |
| Voce di elenco, titolo riga | sans 600 13px |
| Testo descrittivo | sans 12px, line-height 1.45, `--muted` |
| Nota (hint) | sans 11.5 to 12px, `--muted` |

## 4. Spaziatura e misure
Scala: **2, 4, 6, 8, 10, 12, 14, 16, 20, 24** (il 2 solo per il padding interno dei segmenti, 16 e 24 per margini grandi). Per padding, margini e gap usa solo questi. Misure di layout grandi (benvenuto, anteprime) sono fuori scala.
- Margine interno pannelli: **14 px** (pannello proprietà), liste compatte 8 px.
- Spazio tra campi in griglia: **6 px**. Tra gruppi in una sezione: **10 to 12 px**.
- Altezze: campo `label.f` **30 px**, icon-btn **30 px** (22 px nelle testate di lista), segmento interno **26 px** dentro un contenitore con padding 2, pulsante barra **34 px**.
- Divisori: **1 px** `--line`; fra sezioni di un pannello, bordo inferiore di ogni sezione.
- Larghezze: pannello proprietà 264, livelli e cronologia 232, finestre di dialogo 380 to 420 (Guida e Info fanno eccezione).
- **Finestra Info**: orizzontale, 880 px al massimo. A sinistra le Novità (colonna di 290 px con filetto), a destra logo e versione, descrizione, Privacy, Codice (link al repository GitHub, licenza MIT), Licenze e Ko-fi. Sotto i 760 px diventa una colonna sola con le Novità in fondo.
- Distanza dai bordi finestra: **12 px**. Barra in basso 16 px.

## 5. Componenti
- **Pannello flottante** (`.panel`): `--panel`, bordo 1 px `--line`, raggio 2, `--shadow`. Testata con titolo mono + icon-btn chiudi. Sezioni da 14 px divise da una linea.
- **Finestra** (`dialog`): come il pannello, ombra `0 12px 0 rgba(0,0,0,.08)`, sfondo sfocato dietro se modale. Contenuto in `.exp-card` (padding 20×22), titolo `.exp-title` (mono 600 12px, mai h2 più grandi), azioni `.exp-actions` a destra. Chiusura con icon-btn con la X in svg (come Controlla), mai il carattere ×. Un pannello che resta aperto mentre si lavora (Controlla, Livelli) è **non modale**.
- **Finestra spostabile**: testata alta 44 px, maniglia di 5 puntini centrata in alto, cursore grab, sta sempre nello schermo.
- **Segmento** (`.seg`, `.chk-seg`): contenitore `--field`, padding 2, gap 2; voce attiva `--ink` con sottolineatura `inset 0 -2px 0 --accent`. Per scelte da 2 a 5 valori. Mai tendine native.
- **Campo** (`label.f`): `--field`, 30 px, etichetta mono a sinistra in `--muted`, valore a destra; focus anello 1.5 px `--accent`.
- **Pulsante** (`.btn`): mono 11px maiuscolo, 7×11 px; `.primary` è `--ink` con sottolineatura accento; `.ic` è solo icona 40×34 con tooltip.
- **Interruttore a casella** (`.exp-chk`): mono 11px maiuscolo, `accent-color` arancione.
- **Tessera dato**: `--field`, padding 8, etichetta mono 10px sopra, valore mono 600 12.5px sotto.
- **Indicatore di stato**: quadratino 8 px raggio 1, verde/ambra/rosso, davanti a titolo e descrizione.
- **Slider**: traccia 2 px `--line`, cursore rettangolare 10×16 arancione.
- **Tooltip**: sempre quello dell'app (`#tip`), non `title` nativo nelle barre.
- **Icone**: tratto 1.6 px, estremità tonde, 18 px nei pulsanti (14 px nelle testate compatte di Livelli e Cronologia), 24 px viewBox.
- **Strumenti in seconda funzione** (sidebar): un solo pulsante `.tool.grp` con un triangolino (6 px, `currentColor`, 50%) nell'angolo in basso a destra dell'icona. Le varianti si aprono in un menu `#flyout` (`.panel`, 256 px, padding 6) a destra della sidebar, con dissolvenza di sola opacità (.14 s); si apre con pressione lunga (380 ms), clic destro, clic sul triangolino o freccia destra da tastiera. Si chiude con Esc (stesso passo dei menu aperti), clic fuori, scorrimento, cambio di sidebar. Le scorciatoie restano dirette e non aprono il menu. I gruppi `sticky` (Riquadro/Lazo, Taglia/Allunga) mostrano l'ultima variante usata e la ricordano in `localStorage`; Combina/Interseca no, il pulsante resta Combina. Nel menu non si aggiungono voci diverse dalle varianti dello stesso gesto. Nuovi gruppi si dichiarano in `TGROUPS` (`src/main.js`) con il campo `grp` sugli strumenti.
- **Menu del tasto destro** (`#ctx`, `.panel`, minimo 216, padding 6): compare con un clic destro che non trascina (sotto i 3 px di movimento; trascinando si orbita). Voci `sans 600 12.5px` con la scorciatoia in `kbd` a destra, separatori da 1 px `--line`, voce spenta in `--muted` al 55%, voce attiva (Raggi X, Misure) con quadratino di 6 px `--accent` a sinistra. Sbuca vicino al cursore e resta dentro lo schermo (12 px dai bordi), dissolvenza .14 s. Breve per scelta: solo azioni frequenti che hanno già una scorciatoia; contesti Oggetto, Più oggetti, Vuoto. Si chiude con Esc (stesso passo dei menu aperti), clic fuori, rotella, scorrere o ridimensionare, o con un altro tasto; frecce su e giù scorrono le voci. Appoggia sul piatto è la stessa funzione del pulsante nel pannello (un solo nome, un solo comportamento: raddrizza e porta a Z = 0). Blocca e Nascondi (anche dai Livelli) entrano nella cronologia: `⌘Z` li annulla. Nuove voci si aggiungono in `ctxObjectItems` o `ctxEmptyItems` (`src/main.js`).
- **Scheda di benvenuto** (`#empty-hint`): la scheda "Inizia" (`.ew`) resta centrata; quando c'è un lavoro da riprendere compare sotto, come seconda scheda `.ew` separata (`#ew-resume`, a colori invertiti come Esporta: fondo `--ink`, testo `--on-ink`, sottolineatura `--accent`, senza barra arancione in cima), a **24 px** di distanza (l'ombra a gradino di 12 px della scheda sopra non deve toccarla), con la stessa larghezza. Sotto gli 800 px di altezza lo stack si ancora a 12 px dal bordo alto. Mai righe d'avviso aggiunte dentro la scheda principale: ogni novità temporanea è una scheda a parte.
- **Ricerca nella Guida** (`#hp-q`, in cima al menu a sinistra): campo `--field` da 30 px con lente, anello 1.5 px `--accent` al focus. Si filtra a ogni lettera: il menu diventa l'elenco delle pagine che citano la parola (titolo, numero di occorrenze, fino a 3 estratti), la pagina si apre sul primo punto e le parole sono evidenziate con `mark.hp-hit` (`--accent-weak` e sottolineatura `--accent`). Maiuscole e accenti non contano; più parole vanno trovate tutte nella stessa pagina. `/` (o ⌘F con la Guida aperta) porta il cursore nel campo; Esc prima cancella la ricerca, poi chiude la Guida (regola dei campi, sezione 8).
- **Anteprima di Ripeti**: mentre si cambiano i numeri le copie compaiono come sagome (`--accent` al 20 % con contorno), sopra il pulsante la riga `#rp-info` dice quante copie nuove e l'ingombro. Le sagome non sono oggetti: spariscono uscendo dal pannello o col pulsante. Oltre 40.000 triangoli totali diventano riquadri. Regola generale: ciò che un comando sta per fare si mostra prima, senza indovinare.
- **Pannello che scorre** (sidebar, proprietà): il riquadro resta intero (bordo, angoli, ombra) e scorre solo il contenuto interno, con sfumatura in fondo (e in alto se si è scesi) che segnala il resto. Mai far scorrere o sfumare il bordo.

## 6. Movimento
Transizioni **.12 to .22 s ease**, solo su colore, larghezza e opacità. Niente rimbalzi. Quando un blocco si apre, i contenuti non devono cambiare posizione alla fine dell'animazione.
- **Hover e stato attivo**: pulsanti, strumenti, righe e segmenti cambiano colore in .12 s.
- **Menu, pannelli e finestre** compaiono con dissolvenza di sola opacità (.14 s, .16 s per le finestre e il fondo). Alla chiusura spariscono subito.
- **Sidebar**: larghezza .22 s. La variabile `--sw` (larghezza della sidebar) è registrata e anima con lo stesso tempo, così barra in basso, avvisi, cubo, righello e Taglia scorrono insieme (unica eccezione, `left`, per seguire la sidebar). In versione stretta le icone restano ancorate a sinistra e non saltano; solo logo, pulsante e piede compaiono con una breve dissolvenza a fine chiusura.
- Nessun adattamento per `prefers-reduced-motion` per ora.

## 7. Posizioni
Sidebar sinistra 12 px dai bordi; barra in alto a destra larga quanto il pannello proprietà e allineata; livelli e cronologia a sinistra delle proprietà; barra comandi in basso al centro; cubo in alto dopo la sidebar. Niente sovrapposizioni tra pannelli di default.

## 8. Tastiera: Esc
Esc fa una cosa alla volta, nell'ordine: 1) in un campo numerico o nel nome annulla la modifica (torna al valore di partenza) ed esce dal campo; 2) chiude i menu aperti (varianti degli strumenti, menu del tasto destro, piatto, scatto, punti, elenco font); 3) interrompe il righello o la selezione di un lato; 4) deseleziona. Tab (sidebar) e Spazio (trascinare la vista) restano riservati alla scena, come in Photoshop.

## 9. Controllo prima di consegnare
1. Tutti i colori sono token? 2. Raggio 2 px? 3. Spaziature nella scala a 4? 4. Etichette mono maiuscole, frasi in sans? 5. Chiaro e scuro guardati entrambi? 6. Nessun elemento tagliato o sovrapposto a 1280 px di larghezza? 7. Testi IT e chiavi EN presenti?
