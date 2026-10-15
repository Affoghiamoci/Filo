# Filo

Modellatore 3D semplice che gira offline in un solo file HTML, pensato per creare e modificare oggetti da stampare in 3D: mollette, ganci, scatoline e simili. Interfaccia in italiano e inglese, scorciatoie alla Photoshop, piatti Bambu Lab, stile industriale con accento arancione.

Versione 0.9.0 (beta). Sito: [filo.affogo.fyi](https://filo.affogo.fyi)

## Cosa fa

**Creare**
- Forme: scatola, cilindro, sfera, cono, prisma (n lati), toro, testo 3D con font a scelta (anche tuoi) e SVG
- Scatolina con coperchio su misura, con anteprima
- Ripeti in griglia, nido d'ape o cerchio, con spazio tra le copie

**Modificare**
- Sposta, ruota (con scatto a 15°), ridimensiona (anche gruppi e oggetti ruotati, con lucchetto delle proporzioni), allinea e distribuisci
- Lato: spingi e tira un lato piatto. Spigolo: arrotonda e smussa, ogni spigolo ha il suo raggio e resta modificabile
- Taglia con un piano, Allunga e accorcia una parte, Metro con larghezza, altezza e angoli sotto il mouse
- Fori e Combina (unisce i solidi e sottrae i fori) con un motore booleano che dà solidi sempre chiusi
- Gruppi, Livelli (blocca, nascondi, rinomina), Cronologia con anteprima, Annulla e Ripeti
- Scatto da 0,1 mm a libero e calamita su angoli e lati degli altri oggetti

**Controllare e stampare**
- Controlla stampa: anteprima a strati, pareti sottili, sbalzi in rosso, pezzi sospesi, stima di peso e tempo
- Piatti pronti: A1 mini, A1, P1S, X1C, P2S, H2S, H2D e fino a 40 cm
- Import di 3MF (anche di Bambu Studio e Orca), STL e SVG
- Export 3MF con le impostazioni di Bambu Studio e riparazione automatica delle crepe, oppure STL. L'export porta sempre tutto il piatto
- Riprendi l'ultimo lavoro dalla schermata iniziale, con avviso prima di ricaricare la pagina

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
| `L` | Lato | `⌘E` | Combina |
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
| `i18n.js`, `help.js`, `helpimg.js` | Traduzioni IT/EN e Guida |

Altri file utili: `DESIGN.md` (token, tipografia, spaziature e componenti da consultare prima di toccare l'interfaccia), `IDEE.md` (idee rimandate), `THIRD_PARTY_LICENSES.md` (generato dalla build).

I test in `tests/` sono script Playwright (Python) che aprono `dist/forma.html` in Chromium headless e pilotano l'app con l'API `window.forma`. Puntano a `/tmp/forma/dist/forma.html`: se il progetto sta altrove, cambia il percorso.

Stack: three.js, Manifold, three-bvh-csg, clipper-lib, opentype.js, esbuild, font Inter, Bebas Neue, Lora e VT323.

## Privacy

Sul sito ufficiale Filo conta solo le visite in forma anonima, nessun cookie. I modelli non lasciano mai il tuo dispositivo e la versione scaricata non invia nulla.

## Licenza

Da decidere. Le librerie incluse sono tutte open source (MIT, Apache-2.0, BSL-1.0, OFL-1.1), i testi sono in `THIRD_PARTY_LICENSES.md`.
