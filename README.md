# Filo 3D

Modellatore 3D che gira offline in un singolo file HTML, pensato per oggetti semplici da stampare in 3D (mollette, ganci, scatoline). Interfaccia in italiano e inglese, scorciatoie alla Photoshop, piatti Bambu Lab.

## Cosa fa
- Forme: scatola, cilindro, sfera, cono, prisma (n lati), toro, testo 3D e SVG
- Strumento Lato (spingi/tira facce), strumento Spigolo (raccordi e smussi), rotazione, gruppi, livelli, colori, fori e combinazione (CSG)
- Cronologia, import 3MF/STL/SVG, export 3MF (con colori) e STL
- Tema chiaro, scuro o automatico

## Uso
Apri `Filo3D.html` nel browser: nessun server, nessuna connessione.

## Sviluppo
```
npm install
node build.mjs     # produce dist/forma.html
```
Il codice è in `src/`. Le idee rimandate sono in `IDEE.md`, le licenze delle librerie in `THIRD_PARTY_LICENSES.md`.

## Licenza
Da decidere. Le librerie incluse sono tutte open source (MIT, BSL-1.0, OFL-1.1).
