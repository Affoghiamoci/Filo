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

Stati (fissi): verde `#2fa866` ok, ambra `#e0a100` attenzione, rosso `#e5484d` errore. Assi: X `#e5484d`, Y `#30a46c`, Z `#3e63dd`. Colore oggetti: palette del selettore colore.

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
| Voce di elenco, titolo riga | sans 600 13px |
| Testo descrittivo | sans 12px, line-height 1.45, `--muted` |
| Nota (hint) | sans 11.5 to 12px, `--muted` |

## 4. Spaziatura e misure
Scala a 4: **4, 6, 8, 10, 12, 14, 20**. Usa solo questi.
- Margine interno pannelli: **14 px** (pannello proprietà), liste compatte 8 px.
- Spazio tra campi in griglia: **6 px**. Tra gruppi in una sezione: **10 to 12 px**.
- Altezze: campo `label.f` **30 px**, icon-btn **30 px** (22 px nelle testate di lista), segmento interno **26 px** dentro un contenitore con padding 2, pulsante barra **34 px**.
- Divisori: **1 px** `--line`; fra sezioni di un pannello, bordo inferiore di ogni sezione.
- Larghezze: pannello proprietà 264, livelli e cronologia 232, finestre di dialogo 380 to 420.
- Distanza dai bordi finestra: **12 px**. Barra in basso 16 px.

## 5. Componenti
- **Pannello flottante** (`.panel`): `--panel`, bordo 1 px `--line`, raggio 2, `--shadow`. Testata con titolo mono + icon-btn chiudi. Sezioni da 14 px divise da una linea.
- **Finestra** (`dialog`): come il pannello, ombra `0 12px 0 rgba(0,0,0,.08)`, sfondo sfocato dietro se modale. Un pannello che resta aperto mentre si lavora (Controlla, Livelli) è **non modale**.
- **Finestra spostabile**: testata alta 44 px, maniglia di 5 puntini centrata in alto, cursore grab, sta sempre nello schermo.
- **Segmento** (`.seg`, `.chk-seg`): contenitore `--field`, padding 2, gap 2; voce attiva `--ink` con sottolineatura `inset 0 -2px 0 --accent`. Per scelte da 2 a 5 valori. Mai tendine native.
- **Campo** (`label.f`): `--field`, 30 px, etichetta mono a sinistra in `--muted`, valore a destra; focus anello 1.5 px `--accent`.
- **Pulsante** (`.btn`): mono 11px maiuscolo, 7×11 px; `.primary` è `--ink` con sottolineatura accento; `.ic` è solo icona 40×34 con tooltip.
- **Interruttore a casella** (`.exp-chk`): mono 11px maiuscolo, `accent-color` arancione.
- **Tessera dato**: `--field`, padding 8, etichetta mono 10px sopra, valore mono 600 12.5px sotto.
- **Indicatore di stato**: quadratino 8 px raggio 1, verde/ambra/rosso, davanti a titolo e descrizione.
- **Slider**: traccia 2 px `--line`, cursore rettangolare 10×16 arancione.
- **Tooltip**: sempre quello dell'app (`#tip`), non `title` nativo nelle barre.
- **Icone**: tratto 1.8 px, `stroke-linecap:square`, 18 px nei pulsanti, 24 px viewBox.

## 6. Movimento
Transizioni **.12 to .22 s ease**, solo su colore, larghezza e opacità. Niente rimbalzi. Quando un blocco si apre, i contenuti non devono cambiare posizione alla fine dell'animazione.

## 7. Posizioni
Sidebar sinistra 12 px dai bordi; barra in alto a destra larga quanto il pannello proprietà e allineata; livelli e cronologia a sinistra delle proprietà; barra comandi in basso al centro; cubo in alto dopo la sidebar. Niente sovrapposizioni tra pannelli di default.

## 8. Controllo prima di consegnare
1. Tutti i colori sono token? 2. Raggio 2 px? 3. Spaziature nella scala a 4? 4. Etichette mono maiuscole, frasi in sans? 5. Chiaro e scuro guardati entrambi? 6. Nessun elemento tagliato o sovrapposto a 1280 px di larghezza? 7. Testi IT e chiavi EN presenti?
