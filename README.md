<div align="center">

<img src="docs/img/banner.png" alt="Filo, a tiny 3D modeler for things you're going to print" width="100%">

<br>

**A small 3D modeler for the things you actually print: boxes, holders, hooks, brackets.**<br>
One HTML file. No install, no account, works offline.

[**Open Filo → filo.affogo.fyi**](https://filo.affogo.fyi)

![version](https://img.shields.io/badge/version-0.10.7_beta-ff6a00?style=flat-square)
![offline](https://img.shields.io/badge/works-offline-1a1a1a?style=flat-square)
![license](https://img.shields.io/badge/license-MIT-1a1a1a?style=flat-square)
![formats](https://img.shields.io/badge/3MF_·_STL_·_SVG-1a1a1a?style=flat-square)

[English](README.md) · [Italiano](README.it.md)

</div>

---

## Why Filo

I wanted something between "drag a few boxes around" and a full CAD package. Most of what I print is simple: a holder, a lid, a clip, a bracket. Filo is built for that. You push shapes together, cut holes, round the edges, check the print and send it to the slicer.

- **One file.** Open `index.html` and that's it. Models never leave your device.
- **Made for printing.** Bambu Lab plates, a print check, and a 3MF export that opens ready in Bambu Studio.
- **Always-closed solids.** Booleans run on Manifold, so combined parts come out watertight.
- **Photoshop-style shortcuts.** One key per tool, shown next to each tool in the sidebar.

<p align="center">
  <img src="docs/img/hero.png" alt="Filo main window with an orange box with three round holes and a slot" width="100%">
</p>

## What it does

### Build

- Shapes: box, cylinder, sphere, cone, n-sided prism, torus, 3D text (any font, including your own) and SVG import
- "Box with lid" template, sized to your measurements, with preview
- Repeat in a grid, honeycomb or circle, with spacing between copies

<p align="center">
  <img src="docs/img/holes.png" alt="Holes subtracted from a solid with Combine, with Layers panel open" width="49%">
  <img src="docs/img/edges.png" alt="Rounded and chamfered edges, each edge with its own radius" width="49%">
</p>

### Edit

- Move, rotate (15° snap), resize (also groups and rotated objects, with proportion lock), align and distribute
- **Face:** push or pull a flat face. **Edge:** round or chamfer, each edge with its own editable radius
- **Cut** with a plane, **Stretch** a part, **Tape measure** for widths, heights and angles under the cursor
- **Hole / Solid**, **Combine** (union, minus holes) and **Intersect**
- **Drop to plate** finds the nearest stable flat face and puts the part on Z = 0
- Groups, Layers (lock, hide, rename), History with previews, Undo / Redo
- Snap from 0.1 mm to free, with magnet to corners and edges of other objects

<p align="center">
  <img src="docs/img/text.png" alt="3D text with font, size and depth controls" width="49%">
  <img src="docs/img/knob.png" alt="Knurled knob made by repeating a shape in a circle" width="49%">
</p>

### Check and print

- **Print check:** layer preview, thin walls, overhangs in red, floating parts, weight and time estimate
- Plates ready to go: A1 mini, A1, P1S, X1C, P2S, H2S, H2D, and custom sizes up to 40 cm
- Import 3MF (including from Bambu Studio and Orca), STL and SVG
- Export 3MF with Bambu Studio settings and automatic crack repair, or STL. Export always carries the whole plate

<p align="center">
  <img src="docs/img/print-check.png" alt="Print check with overhangs highlighted and layer slider" width="49%">
  <img src="docs/img/dimensions.png" alt="Dimension labels shown on an object" width="49%">
</p>

### Interface

- Light, dark or automatic theme, X-ray view, true isometric and orthographic views
- Italian and English UI
- Built-in guide with images and GIFs (`?` or `F1`)

<p align="center">
  <img src="docs/img/dark.png" alt="Filo in the dark theme" width="49%">
  <img src="docs/img/box-with-lid.png" alt="Box with lid template" width="49%">
</p>

## Shortcuts

`⌘` is `Ctrl` on Windows and Linux.

| Key | Action | Key | Action |
|---|---|---|---|
| `V` | Move | `B` `C` `S` `O` `P` | Box, cylinder, sphere, cone, prism |
| `Q` `W` | Marquee, Lasso | `T` | Text |
| `R` | Rotate | `X` | Hole / Solid |
| `L` | Face | `⌘E` `⇧⌘E` | Combine, Intersect |
| `E` | Edge | `⌘G` | Group |
| `U` `K` | Stretch, Cut | `⌘D` | Duplicate |
| `D` | Tape measure | `⌘Z` `⇧⌘Z` | Undo, Redo |
| `Tab` | Narrow sidebar | `F7` `F8` | Layers, History |

Everything else is in the in-app Guide.

## Use it

- **Online:** [filo.affogo.fyi](https://filo.affogo.fyi)
- **Offline:** download `index.html` from this repo and open it in your browser. No server, no connection needed.

## Build from source

```bash
npm install
node build.mjs     # outputs dist/forma.html (about 3.3 MB, everything inlined)
```

| File | What's in it |
|---|---|
| `src/main.js` | Scene, tools, panels, import and export |
| `src/index.template.html`, `src/style.css` | Structure and style (the build inlines them) |
| `src/edges.js`, `src/mcsg.js`, `src/manifold.wasm.js` | Edges and booleans (Manifold, three-bvh-csg as fallback) |
| `src/textgen.js`, `src/print.js` | 3D text and print check |
| `src/i18n.js`, `src/help.js`, `src/helpimg.js` | IT/EN strings, Guide and its images |

Also in the repo: `DESIGN.md` (tokens, type, spacing and components, read it before touching the UI), `IDEE.md` (parked ideas, in Italian), `THIRD_PARTY_LICENSES.md` (generated by the build).

The tests in `tests/` are Playwright (Python) scripts that open `dist/forma.html` in headless Chromium and drive the app through `window.forma`. They point at `/tmp/forma/dist/forma.html`, so change the path if the project lives elsewhere.

**Stack:** three.js, Manifold, three-bvh-csg, clipper-lib, opentype.js, esbuild. Fonts: Inter, Bebas Neue, Lora, VT323.

## Status

Filo is in beta. It's a one-person project, so expect rough edges. If something breaks or a feature would help your prints, [open an issue](https://github.com/Affoghiamoci/Filo/issues).

## Privacy

The official site only counts visits anonymously, no cookies. Your models never leave your device, and the downloaded file sends nothing.

## License

MIT, see [`LICENSE`](LICENSE). Bundled libraries are all open source (MIT, Apache-2.0, BSL-1.0, OFL-1.1); their texts are in [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md).
