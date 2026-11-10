// Pulizia e saldatura delle mesh, senza nulla che riguardi la pagina: il codice è usato sia dal thread principale sia dal worker (csgworker.js)
import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { mergeVerticesFast } from './fastgeo.js';
import { simplifyGeo } from './mcsg.js';

const D2R = Math.PI / 180;

export function clean(g) {
  g.deleteAttribute('uv');
  g.clearGroups();
  return g;
}

export function weldPoints(src, tol) {                                              // unisce i punti più vicini di tol: a catena (A vicino a B e B vicino a C unisce tutti e tre), così nessuno spigolo resta scoperto
  const n = src.length / 3, grid = new Map(), c = v => Math.floor(v / tol), par = new Int32Array(n);
  for (let i = 0; i < n; i++) par[i] = i;
  const find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  for (let i = 0; i < n; i++) {
    const x = src[i * 3], y = src[i * 3 + 1], z = src[i * 3 + 2], cx = c(x), cy = c(y), cz = c(z);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const l = grid.get(Math.imul(cx + dx, 73856093) ^ Math.imul(cy + dy, 19349663) ^ Math.imul(cz + dz, 83492791));
      if (l) for (const v of l) if (Math.abs(src[v * 3] - x) < tol && Math.abs(src[v * 3 + 1] - y) < tol && Math.abs(src[v * 3 + 2] - z) < tol) { const ra = find(v), rb = find(i); if (ra !== rb) par[rb] = ra; }
    }
    const k = Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ Math.imul(cz, 83492791); (grid.get(k) || grid.set(k, []).get(k)).push(i);
  }
  const ids = new Int32Array(n), P = [], root = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i); let id = root.get(r);
    if (id === undefined) { id = P.length / 3; root.set(r, id); P.push(src[r * 3], src[r * 3 + 1], src[r * 3 + 2]); }
    ids[i] = id;
  }
  return { P: Float32Array.from(P), ids };
}
export function triList(g, ids) {
  const idx = g.index, n = idx ? idx.count : g.attributes.position.count, tris = [];
  for (let t = 0; t < n; t += 3) {
    const a = ids[idx ? idx.getX(t) : t], b = ids[idx ? idx.getX(t + 1) : t + 1], c = ids[idx ? idx.getX(t + 2) : t + 2];
    if (a !== b && b !== c && a !== c) tris.push(a, b, c);
  }
  return tris;
}
export function healMesh(g) {
  const nT = (g.index ? g.index.count : g.attributes.position.count) / 3;
  if (nT > 300000) return g;
  const { P, ids } = weldPoints(g.attributes.position.array, 1e-3), tris = triList(g, ids);
  const fixed = fixTJunctions(P, tris);
  if (fixed.length === tris.length && tris.length === nT * 3) return g;      // niente da riparare
  const out = new Float32Array(fixed.length * 3);
  for (let i = 0; i < fixed.length; i++) { out[i * 3] = P[fixed[i] * 3]; out[i * 3 + 1] = P[fixed[i] * 3 + 1]; out[i * 3 + 2] = P[fixed[i] * 3 + 2]; }
  return geometryFromPositions(out);
}

export function openEdgeCount(g) {                                                    // lati usati da un solo triangolo: se sono 0 la superficie è chiusa
  const { ids } = weldPoints(g.attributes.position.array, 1e-3), tris = triList(g, ids), key = (a, b) => a < b ? a * 4294967296 + b : b * 4294967296 + a, use = new Map();
  for (let t = 0; t < tris.length; t += 3) for (let k = 0; k < 3; k++) { const e = key(tris[t + k], tris[t + (k + 1) % 3]); use.set(e, (use.get(e) || 0) + 1); }
  let c = 0; for (const u of use.values()) if (u === 1) c++; return c;
}

/* difetti di chiusura: lati senza il "gemello" opposto o usati più di una volta (0 = la mesh è chiusa, coordinate identiche tra triangoli vicini) */
export function edgeDefects(I) {
  const use = new Map(); let bad = 0;
  for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) { const a = I[t + k], b = I[t + (k + 1) % 3]; if (a === b) continue; const key = a * 4294967296 + b; use.set(key, (use.get(key) || 0) + 1); }
  for (const [key, c] of use) { const a = Math.floor(key / 4294967296), b = key - a * 4294967296; if (c > 1 || use.get(b * 4294967296 + a) !== c) bad++; }
  return bad;
}
// numero identico per vertici con la stessa posizione esatta (confronto sui bit, chiave numerica)
export function exactVertexIds(p) {
  const n = p.count, ids = new Int32Array(n), grid = new Map(), arr = p.array, ok = arr instanceof Float32Array && p.itemSize === 3 && !p.isInterleavedBufferAttribute;
  const X = ok ? arr : null, f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
  const bits = v => { f32[0] = v === 0 ? 0 : v; return u32[0]; };
  const px = new Uint32Array(n * 3);
  for (let i = 0; i < n; i++) { px[i * 3] = bits(ok ? X[i * 3] : p.getX(i)); px[i * 3 + 1] = bits(ok ? X[i * 3 + 1] : p.getY(i)); px[i * 3 + 2] = bits(ok ? X[i * 3 + 2] : p.getZ(i)); }
  let next = 0;
  for (let i = 0; i < n; i++) {
    const a = px[i * 3], b = px[i * 3 + 1], c = px[i * 3 + 2], h = Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791);
    let l = grid.get(h), id = -1;
    if (l) for (const j of l) if (px[j * 3] === a && px[j * 3 + 1] === b && px[j * 3 + 2] === c) { id = ids[j]; break; }
    if (id < 0) { id = next++; if (l) l.push(i); else grid.set(h, [i]); }
    ids[i] = id;
  }
  return ids;
}
export function geoDefects(g) {
  const p = g.attributes.position, idx = g.index, n = idx ? idx.count : p.count, vid = exactVertexIds(p), I = new Uint32Array(n);
  for (let i = 0; i < n; i++) I[i] = vid[idx ? idx.getX(i) : i];
  return edgeDefects(I);
}

/* T-giunzioni (un vertice che cade in mezzo a uno spigolo del vicino): lo spigolo lungo viene spezzato, così la superficie risulta chiusa. */
export function fixTJunctions(P, tris) {
  const key = (a, b) => a < b ? a * 4294967296 + b : b * 4294967296 + a;
  let T = Array.from(tris);
  for (let pass = 0; pass < 4; pass++) {
    const use = new Map(), nT = T.length / 3;
    for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) { const e = key(T[t * 3 + k], T[t * 3 + (k + 1) % 3]); use.set(e, (use.get(e) || 0) + 1); }
    const openV = new Set();
    for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) if (use.get(key(T[t * 3 + k], T[t * 3 + (k + 1) % 3])) === 1) { openV.add(T[t * 3 + k]); openV.add(T[t * 3 + (k + 1) % 3]); }
    if (!openV.size || openV.size > 60000) break;
    const CELL = 2, grid = new Map(), ck = (x, y, z) => Math.floor(x / CELL) + ',' + Math.floor(y / CELL) + ',' + Math.floor(z / CELL);
    for (const v of openV) { const k = ck(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); (grid.get(k) || grid.set(k, []).get(k)).push(v); }
    const out = []; let changed = false;
    for (let t = 0; t < nT; t++) {
      const tri = [T[t * 3], T[t * 3 + 1], T[t * 3 + 2]];
      let done = false;
      for (let k = 0; k < 3 && !done; k++) {
        const a = tri[k], b = tri[(k + 1) % 3], c = tri[(k + 2) % 3];
        if (use.get(key(a, b)) !== 1) continue;
        const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2], dx = P[b * 3] - ax, dy = P[b * 3 + 1] - ay, dz = P[b * 3 + 2] - az, L2 = dx * dx + dy * dy + dz * dz;
        if (L2 < 1e-12) continue;
        const cand = [], x0 = Math.min(ax, ax + dx) - 0.01, x1 = Math.max(ax, ax + dx) + 0.01, y0 = Math.min(ay, ay + dy) - 0.01, y1 = Math.max(ay, ay + dy) + 0.01, z0 = Math.min(az, az + dz) - 0.01, z1 = Math.max(az, az + dz) + 0.01;
        for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++) for (let gy = Math.floor(y0 / CELL); gy <= Math.floor(y1 / CELL); gy++) for (let gz = Math.floor(z0 / CELL); gz <= Math.floor(z1 / CELL); gz++) {
          for (const v of grid.get(gx + ',' + gy + ',' + gz) || []) {
            if (v === a || v === b) continue;
            const wx = P[v * 3] - ax, wy = P[v * 3 + 1] - ay, wz = P[v * 3 + 2] - az, s = (wx * dx + wy * dy + wz * dz) / L2;
            if (s <= 1e-4 || s >= 1 - 1e-4) continue;
            const ex = wx - s * dx, ey = wy - s * dy, ez = wz - s * dz;
            if (ex * ex + ey * ey + ez * ez < 1e-6) cand.push([s, v]);
          }
        }
        if (!cand.length) continue;
        cand.sort((p, q) => p[0] - q[0]);
        const chain = [a, ...cand.map(x => x[1]), b];
        for (let i = 0; i < chain.length - 1; i++) out.push(chain[i], chain[i + 1], c);
        done = true; changed = true;
      }
      if (!done) out.push(tri[0], tri[1], tri[2]);
    }
    T = out;
    if (!changed) break;
  }
  return Uint32Array.from(T);
}

export function geometryFromPositions(arr) {
  let g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(arr, 3));
  g = mergeVerticesFast(g, 1e-4);
  g = toCreasedNormals(g, 30 * D2R);
  return mergeVerticesFast(clean(g), 1e-4);
}

/* Ultimo passo di ogni Combina/Stampo: dal risultato in coordinate mondo si arriva al pezzo pronto (saldato, pulito, centrato sul piatto).
   Restituisce { geo, pos, size } oppure null se il risultato è vuoto. dbg: funzione facoltativa per i messaggi di misura. */
export function bakeGeometry(g, noSimplify = false, dbg = null) {
  if (!g.attributes.position || g.attributes.position.count === 0) return null;
  clean(g);
  if (dbg) dbg('PROF open prima', openEdgeCount(g), 'tri', g.attributes.position.count / 3);
  { const d0 = geoDefects(g), h = healMesh(g);                                  // la riparazione (saldatura a 1 µm) non deve mai peggiorare: se rompe un pezzo già chiuso si tiene l'originale
    if (h !== g && geoDefects(h) <= d0) g = h; }
  if (!noSimplify && (g.index ? g.index.count : g.attributes.position.count) / 3 < 150000) {   // pulizia: facce quasi complanari fuse, vertici inutili tolti (solo se il pezzo resta identico e chiuso)
    const sm = simplifyGeo(g);
    if (sm) { const g2 = geometryFromPositions(sm.pos); if (geoDefects(g2) <= geoDefects(g)) { g.dispose(); g = g2; } else g2.dispose(); }
  }
  if (!g.index) g = geometryFromPositions(g.attributes.position.array);       // il risultato di Manifold arriva con normali piatte: si ricalcolano morbide (30°), così le pareti curve non fanno le fasce
  if (dbg) dbg('PROF open dopo', openEdgeCount(g));
  g.computeBoundingBox();
  const b = g.boundingBox;
  const c = b.getCenter(new THREE.Vector3()), minZ = b.min.z;
  g.translate(-c.x, -c.y, -minZ);
  g.computeBoundingBox();
  const s = g.boundingBox.getSize(new THREE.Vector3());
  return { geo: g, pos: [c.x, c.y, minZ], size: s };
}
