import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import opentype from 'opentype.js';
import ClipperLib from 'clipper-lib';
import interW from '@fontsource/inter/files/inter-latin-800-normal.woff';
import bebasW from '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff';
import loraW from '@fontsource/lora/files/lora-latin-700-normal.woff';
import vtW from '@fontsource/vt323/files/vt323-latin-400-normal.woff';

const toAB = u8 => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
const mk = (id, name, w) => { const buf = toAB(w); return { id, name, buf, font: opentype.parse(buf.slice(0)) }; };
export const FONTS = [
  mk('inter', 'Inter Black', interW),
  mk('bebas', 'Bebas Neue', bebasW),
  mk('lora', 'Lora Bold', loraW),
  mk('vt323', 'VT323', vtW),
];
export const fontById = id => FONTS.find(f => f.id === id) || FONTS[0];

// font dell'utente: TTF, OTF o WOFF (non WOFF2)
export function addUserFont(buf, fileName) {
  const font = opentype.parse(buf.slice(0));
  const nm = (font.names.fullName && (font.names.fullName.en || Object.values(font.names.fullName)[0])) || fileName.replace(/\.[^.]+$/, '');
  const id = 'u:' + nm;
  const old = FONTS.findIndex(f => f.id === id);
  const e = { id, name: nm, buf, font, user: true };
  if (old >= 0) FONTS[old] = e; else FONTS.push(e);
  return e;
}

const inside = (pt, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};
const area = poly => { let s = 0; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y); return Math.abs(s / 2); };

// comandi opentype -> forme three (y rovesciata); i contorni interni diventano fori
function shapesFromCommands(cmds, dy = 0) {
  const raw = [];
  let cur = null;
  const add = (p, c) => {
    switch (c.type) {
      case 'M': p.moveTo(c.x, -c.y + dy); break;
      case 'L': p.lineTo(c.x, -c.y + dy); break;
      case 'Q': p.quadraticCurveTo(c.x1, -c.y1 + dy, c.x, -c.y + dy); break;
      case 'C': p.bezierCurveTo(c.x1, -c.y1 + dy, c.x2, -c.y2 + dy, c.x, -c.y + dy); break;
    }
  };
  for (const c of cmds) {
    if (c.type === 'M') { cur = { cmds: [c] }; raw.push(cur); }
    else if (c.type !== 'Z' && cur) cur.cmds.push(c);
  }
  const cs = raw.filter(r => r.cmds.length > 2).map(r => {
    const path = new THREE.Path();
    r.cmds.forEach(c => add(path, c));
    const pts = path.getPoints(6);
    return { cmds: r.cmds, pts, a: area(pts) };
  });
  const depth = cs.map((c, i) => cs.reduce((n, o, j) => n + (i !== j && o.a > c.a && inside(c.pts[0], o.pts) ? 1 : 0), 0));
  const shapes = [];
  cs.forEach((c, i) => {
    if (depth[i] % 2) return;
    const sh = new THREE.Shape();
    c.cmds.forEach(k => add(sh, k));
    c.shape = sh; shapes.push(c);
  });
  cs.forEach((c, i) => {
    if (!(depth[i] % 2)) return;
    let best = null;
    shapes.forEach(o => { if (o.a > c.a && inside(c.pts[0], o.pts) && (!best || o.a < best.a)) best = o; });
    if (best) { const h = new THREE.Path(); c.cmds.forEach(k => add(h, k)); best.shape.holes.push(h); }
  });
  return shapes.map(c => c.shape);
}

function extrude(shapes, depth) {
  const g = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: 6 });
  const ng = g.toNonIndexed();
  g.dispose();
  return ng.attributes.position.array;
}

// testo -> posizioni dei triangoli (mm), base su z=0
// contorni (punti) di un glifo, y rovesciata
function contours(cmds) {
  const out = [];
  let cur = null;
  for (const c of cmds) {
    if (c.type === 'M') { cur = new THREE.Path(); cur.moveTo(c.x, -c.y); out.push(cur); }
    else if (!cur) continue;
    else if (c.type === 'L') cur.lineTo(c.x, -c.y);
    else if (c.type === 'Q') cur.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
    else if (c.type === 'C') cur.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
  }
  return out.map(p => p.getPoints(5)).filter(p => p.length > 2);
}
// unisce i contorni che si sovrappongono (molti font hanno glifi fatti di parti sovrapposte)
// e restituisce forme con i fori giusti: serve per avere solidi chiusi e puliti per la CSG
function unionShapes(polys) {
  const K = 1000, clip = new ClipperLib.Clipper();
  polys.forEach(pts => {
    const path = pts.map(p => ({ X: Math.round(p.x * K), Y: Math.round(p.y * K) }));
    clip.AddPath(path, ClipperLib.PolyType.ptSubject, true);
  });
  const tree = new ClipperLib.PolyTree();
  clip.StrictlySimple = true;
  clip.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const toV = path => { const c = ClipperLib.Clipper.CleanPolygon(path, 0.03 * K); return (c.length > 2 ? c : path).map(p => new THREE.Vector2(p.X / K, p.Y / K)); };
  const shapes = [];
  const walk = (node, isHole) => {
    node.Childs().forEach(ch => {
      if (!isHole) {
        const sh = new THREE.Shape(toV(ch.Contour()));
        ch.Childs().forEach(h => { sh.holes.push(new THREE.Path(toV(h.Contour()))); });
        shapes.push(sh);
        ch.Childs().forEach(h => walk(h, false));
      }
    });
  };
  walk(tree, false);
  return shapes;
}

export function textPositions({ text, font, size, depth, spacing = 0 }) {
  const f = fontById(font).font;
  const lines = String(text || ' ').split('\n');
  const lh = size * 1.2, k = size / f.unitsPerEm, sp = spacing / 100 * size;
  const polys = [];
  lines.forEach((line, n) => {
    let x = 0, prev = null;
    for (const ch of line) {
      const g = f.charToGlyph(ch);
      if (prev) { try { x += f.getKerningValue(prev, g) * k; } catch (e) {} }
      const cmds = g.getPath(x, n * lh, size).commands;
      if (cmds.length) contours(cmds).forEach(c => polys.push(c));
      x += (g.advanceWidth || 0) * k + sp;
      prev = g;
    }
  });
  if (!polys.length) return null;
  const shapes = unionShapes(polys);
  if (!shapes.length) return null;
  return extrude(shapes, depth);
}

// SVG -> elementi per colore (mm), spessore e larghezza massima in mm
export function svgItems(svgText, { depth = 1, maxSize = 60 } = {}) {
  const data = new SVGLoader().parse(svgText);
  const all = [];
  for (const path of data.paths) {
    const st = path.userData.style || {};
    if (!st.fill || st.fill === 'none' || st.fillOpacity === 0) continue;
    const col = '#' + new THREE.Color(st.fill).getHexString();
    SVGLoader.createShapes(path).forEach(sh => all.push({ color: col, shape: sh }));
  }
  if (!all.length) return null;
  // ogni pezzo separato è un oggetto (poi raggruppati); con troppi pezzi, uno per colore
  let items;
  if (all.length <= 60) items = all.map(a => ({ color: a.color, pos: Float32Array.from(extrude([a.shape], depth)) }));
  else {
    const byCol = new Map();
    all.forEach(a => { if (!byCol.has(a.color)) byCol.set(a.color, []); byCol.get(a.color).push(a.shape); });
    items = [...byCol.entries()].map(([color, shapes]) => ({ color, pos: Float32Array.from(extrude(shapes, depth)) }));
  }
  // SVG ha la y verso il basso: ribalta e inverti i triangoli
  const box = new THREE.Box3(), v = new THREE.Vector3();
  items.forEach(it => { for (let i = 0; i < it.pos.length; i += 3) box.expandByPoint(v.set(it.pos[i], it.pos[i + 1], 0)); });
  const sz = box.getSize(v), k = maxSize / Math.max(sz.x, sz.y, 1e-6);
  const cx = (box.min.x + box.max.x) / 2, cy = (box.min.y + box.max.y) / 2;
  items.forEach(it => {
    const a = it.pos;
    for (let i = 0; i < a.length; i += 3) { a[i] = (a[i] - cx) * k; a[i + 1] = -(a[i + 1] - cy) * k; a[i + 2] = a[i + 2]; }
    for (let t = 0; t < a.length; t += 9) for (let j = 0; j < 3; j++) { const x = a[t + 3 + j]; a[t + 3 + j] = a[t + 6 + j]; a[t + 6 + j] = x; }
  });
  return items;
}
