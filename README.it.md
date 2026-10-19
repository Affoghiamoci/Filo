# Filo

<picture><source media="(prefers-color-scheme: dark)" srcset="docs/img/eu-ai-label-white.svg"><img src="docs/img/eu-ai-label-black.svg" alt="Icona UE: AI coinvolta nel progetto" width="28" align="center"></picture>&nbsp; Realizzato con l'aiuto dell'AI (Claude)

[English](README.md) · Italiano

Modellatore 3D semplice pensato per chi viene dalla grafica e vuole stampare in 3D: mollette, ganci, scatoline e simili. Si usa direttamente dal sito, con scorciatoie che ricordano la suite Adobe. Interfaccia in italiano e inglese, piatti Bambu Lab, stile industriale con accento arancione. Volendo si può scaricare anche come singolo file HTML e usare offline.

Non vuole sostituire Fusion, Blender, FreeCAD o altri software complessi: è uno strumento semplice per piccole modifiche e modellazioni semplici. I feedback sono benvenuti, tramite [issue](https://github.com/Affoghiamoci/Filo/issues) o nei commenti del post su Reddit.

Versione 1.2.3. Sito: [filo.affogo.fyi](https://filo.affogo.fyi). Codice: [github.com/Affoghiamoci/Filo](https://github.com/Affoghiamoci/Filo)

## Cosa fa

**Creare**
- Forme: scatola, cilindro, sfera, cono, prisma (n lati), toro, testo 3D con font a scelta (anche tuoi) e SVG
- Scatolina con coperchio su misura, con anteprima
- Ripeti in griglia, nido d'ape o cerchio, con spazio tra le copie

**Modificare**
- Sposta, ruota (con scatto a 15°), ridimensiona (anche gruppi e oggetti ruotati, con lucchetto delle proporzioni), allinea e distribuisci
- Lato: spingi e tira un lato piatto. Spigolo: arrotonda e smussa, ogni spigolo ha il suo raggio e resta modificabile
- Taglia con un piano, Allunga e accorcia una parte, Metro con larghezza, altezza e angoli sotto il mouse
- Fori, Combina (unisce i solidi e sottrae i fori) e Interseca (tiene solo la parte in comune) con un motore booleano che dà solidi sempre chiusi
- Appoggia sul piatto raddrizza il pezzo sul lato piatto stabile più vicino (anche con più oggetti) e lo porta a Z = 0
- Menu con il tasto destro (clic destro senza trascinare) su oggetti e sul vuoto, breve e con le scorciatoie; trascinando col destro si orbita come prima
- Barra a sinistra con strumenti in seconda funzione (Riquadro e Lazo, Taglia e Allunga, Combina e Interseca): si aprono tenendo premuto, con il clic destro o dal triangolino
- Gruppi, Livelli (blocca, nascondi, rinomina), Cronologia con anteprima, Annulla e Ripeti
- Scatto da 0,1 mm a libero e calamita su angoli e lati degli altri oggetti

**Controllare e stampare**
- Controlla stampa: anteprima a strati, pareti sottili, sbalzi in rosso, pezzi sospesi, stima di peso e tempo
- Piatti pronti: A1 mini, A1, P1S, X1C, P2S, H2S, H2D e fino a 40 cm
- Import di 3MF (anche di Bambu Studio e Orca), STL e SVG
- Export 3MF con le impostazioni di Bambu Studio e riparazione automatica delle crepe, oppure STL. L'export porta sempre tutto il piatto
- Riprendi l'ultimo lavoro dalla schermata iniziale (scheda sotto Inizia), con avviso prima di ricaricare la pagina

**Interfaccia**
- Tema chiaro, scuro o automatico, vista Raggi X, viste senza prospettiva
- Guida integrata con immagini e GIF (tasto `?` o `F1`)
- `Esc` annulla la modifica di un campo, chiude i menu, poi deseleziona

## Scorciatoie principali

| Tasto | Azione | Tasto | Azione |
|---|---|---|---|
| `V` | Sposta | `B` `C` `S` `O` `P` | Scatola, cilindro, sfera, cono, prisma |
| `Q` `W` | Riquadro, Lazo | `T` | Testo |
| `R` | Ruota | `X` | Foro o solido |
| `L` | Lato | `⌘E` `⇧⌘E` | Combina, Interseca |
| `E` | Spigolo | `⌘G` | Raggruppa |
| `U` `K` | Allunga, Taglia | `⌘D` | Duplica |
| `D` | Metro | `⌘Z` `⇧⌘Z` | Annulla, Ripeti |
| `Tab` | Sidebar stretta | `F7` `F8` | Livelli, Cronologia |

Il resto è nella Guida dell'app.

## Uso

Apri `index.html` nel browser: nessun server, nessuna connessione, i modelli restano sul tuo dispositivo.

## Sviluppo

```
npm install
node build.mjs     # produce dist/forma.html (circa 3,3 MB, tutto incluso)
```

Il codice è in `src/`:

| File | Cosa contiene |
|---|---|
| `main.js` | Scena, strumenti, pannelli, import ed export |
| `index.template.html`, `style.css` | Struttura e stile (la build li unisce in un solo file) |
| `edges.js`, `mcsg.js`, `manifold.wasm` | Spigoli e booleane (Manifold, con three-bvh-csg come ripiego) |
| `textgen.js`, `print.js` | Testo 3D e controllo di stampa |
| `i18n.js`, `help.js`, `helpimg.js` | Traduzioni IT/EN, Guida e immagini |

Altri file utili: `DESIGN.md` (token, tipografia, spaziature e componenti da consultare prima di toccare l'interfaccia), `IDEE.md` (idee rimandate), `THIRD_PARTY_LICENSES.md` (generato dalla build), `LICENSE` (PolyForm Noncommercial).

I test in `tests/` sono script Playwright (Python) che aprono `dist/forma.html` in Chromium headless e pilotano l'app con l'API `window.forma`. Puntano a `/tmp/forma/dist/forma.html`: se il progetto sta altrove, cambia il percorso.

Stack: three.js, Manifold, three-bvh-csg, clipper-lib, opentype.js, esbuild, font Inter, Bebas Neue, Lora e VT323.

## Privacy

Sul sito ufficiale Filo conta solo le visite in forma anonima, nessun cookie. I modelli non lasciano mai il tuo dispositivo e la versione scaricata non invia nulla.

## Licenza

Filo è **source-available** con licenza [PolyForm Noncommercial 1.0.0](LICENSE). Puoi leggere il codice, usare Filo, modificarlo e condividerlo per qualsiasi scopo non commerciale (progetti personali, hobby, studio, ricerca, enti non profit). L'uso commerciale, per esempio rivenderlo, includerlo in un prodotto a pagamento o offrire una versione modificata come servizio, richiede il mio permesso: scrivimi.

- **Quello che crei è tuo.** Modelli, file 3MF/STL e stampe fatti con Filo ti appartengono e puoi stamparli e venderli. La licenza riguarda il software, non il tuo lavoro.
- **Versioni precedenti.** Le versioni fino alla 0.10.7, pubblicate prima di questo cambio, erano rilasciate con licenza MIT, e chi le ha ricevute mantiene quei termini.
- **Le librerie incluse** mantengono le loro licenze open source (MIT, Apache-2.0, BSL-1.0, OFL-1.1); i testi sono in `THIRD_PARTY_LICENSES.md`.
