// Motore booleano robusto (Manifold, WASM): restituisce sempre solidi chiusi. Se non è pronto o fallisce, si usa three-bvh-csg.
import * as THREE from 'three';
import { Brush } from 'three-bvh-csg';
import Module from 'manifold-3d';
import wasmB64 from './manifold.wasm.js';

let M = null;
export const manifoldReady = () => !!M;
export const manifoldMod = () => M;
export const initManifold = () => {
  const bin = Uint8Array.from(atob(wasmB64), c => c.charCodeAt(0));
  return Module({ wasmBinary: bin }).then(m => { m.setup(); M = m; return m; }).catch(e => { console.warn('Manifold KO ' + JSON.stringify(Object.getOwnPropertyNames(e || {})) + ' ' + (e && e.message) + ' ' + (e && e.code) + ' ' + String(e && e.stack).slice(0, 400)); });
};

/* Anelli "pizzicati": due superfici che si toccano lungo uno spigolo (4 triangoli su un lato). Saldando i vertici per posizione Manifold non sa quali triangoli appartengano allo stesso lato
   e può accettare la mesh con la topologia sbagliata (il volume non torna: si perde materiale). Qui si rifà la connessione: attorno a ogni spigolo i triangoli si ordinano per angolo e
   si accoppiano quelli che racchiudono davvero un settore pieno; poi ogni vertice si divide per "ventaglio". Restituisce triVerts/vertProperties indicizzati, o null se la mesh non torna. */
export function depinch(vp, tv) {
  const nT = tv.length / 3, wid = new Int32Array(vp.length / 3), kmap = new Map(), pts = [];
  for (let i = 0; i < wid.length; i++) {
    const k = Math.round(vp[i * 3] * 1e4) + ',' + Math.round(vp[i * 3 + 1] * 1e4) + ',' + Math.round(vp[i * 3 + 2] * 1e4);
    let w = kmap.get(k); if (w === undefined) { w = pts.length; kmap.set(k, w); pts.push(i); } wid[i] = w;
  }
  const W = new Int32Array(tv.length); for (let i = 0; i < tv.length; i++) W[i] = wid[tv[i]];
  const edges = new Map();                                          // chiave spigolo -> [triangolo*3+lato]
  for (let t = 0; t < nT; t++) {
    if (W[t * 3] === W[t * 3 + 1] || W[t * 3 + 1] === W[t * 3 + 2] || W[t * 3] === W[t * 3 + 2]) continue;   // degenere
    for (let k = 0; k < 3; k++) {
      const a = W[t * 3 + k], b = W[t * 3 + (k + 1) % 3], key = a < b ? a * 4194304 + b : b * 4194304 + a;
      let l = edges.get(key); if (!l) edges.set(key, l = []); l.push(t * 3 + k);
    }
  }
  const par = new Int32Array(tv.length); for (let i = 0; i < par.length; i++) par[i] = i;
  const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const uni = (x, y) => { x = find(x); y = find(y); if (x !== y) par[x] = y; };
  const P = i => [vp[pts[i] * 3], vp[pts[i] * 3 + 1], vp[pts[i] * 3 + 2]];
  const pair = (e1, e2) => {                                        // due lati di triangoli diversi sullo stesso spigolo: si saldano i due vertici
    const t1 = (e1 / 3) | 0, k1 = e1 % 3, t2 = (e2 / 3) | 0, k2 = e2 % 3;
    const a1 = W[t1 * 3 + k1], b1 = W[t1 * 3 + (k1 + 1) % 3];
    for (const [c1, v1] of [[t1 * 3 + k1, a1], [t1 * 3 + (k1 + 1) % 3, b1]]) {
      const c2 = W[t2 * 3 + k2] === v1 ? t2 * 3 + k2 : t2 * 3 + (k2 + 1) % 3;
      uni(c1, c2);
    }
  };
  for (const [, l] of edges) {
    if (l.length === 1) continue;
    if (l.length === 2) { pair(l[0], l[1]); continue; }
    if (l.length % 2) return null;
    const e0 = l[0], ta = (e0 / 3) | 0, ka = e0 % 3, a = W[ta * 3 + ka], b = W[ta * 3 + (ka + 1) % 3];
    const A = P(a), B = P(b), ex = B[0] - A[0], ey = B[1] - A[1], ez = B[2] - A[2], el = Math.hypot(ex, ey, ez);
    const e = [ex / el, ey / el, ez / el];
    const h = Math.abs(e[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    let u = [e[1] * h[2] - e[2] * h[1], e[2] * h[0] - e[0] * h[2], e[0] * h[1] - e[1] * h[0]]; const ul = Math.hypot(...u); u = u.map(x => x / ul);
    const v = [e[1] * u[2] - e[2] * u[1], e[2] * u[0] - e[0] * u[2], e[0] * u[1] - e[1] * u[0]];
    const items = l.map(x => {
      const t = (x / 3) | 0, k = x % 3, c = W[t * 3 + (k + 2) % 3], C = P(c), w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const d = w[0] * e[0] + w[1] * e[1] + w[2] * e[2], pw = [w[0] - d * e[0], w[1] - d * e[1], w[2] - d * e[2]];
      return { x, th: Math.atan2(pw[0] * v[0] + pw[1] * v[1] + pw[2] * v[2], pw[0] * u[0] + pw[1] * u[1] + pw[2] * u[2]), fwd: W[t * 3 + k] === a };
    }).sort((p, q) => Math.abs(p.th - q.th) < 1e-5 ? (q.fwd - p.fwd) : p.th - q.th);   // a pari angolo (facce sovrapposte) prima "avanti": si accoppiano i settori veri, non quelli di spessore zero
    const n = items.length;
    for (let i = 0; i < n; i++) {                                   // un lato "indietro" seguito (in angolo) da uno "avanti" racchiude un settore pieno
      const p = items[i], q = items[(i + 1) % n];
      if (!p.fwd && q.fwd) pair(p.x, q.x);
      else if (p.fwd === q.fwd) return null;                        // orientamenti incoerenti
    }
  }
  const rep = new Map(), nv = [], nt = new Uint32Array(tv.length);
  for (let i = 0; i < tv.length; i++) {
    const r = find(i); let id = rep.get(r);
    if (id === undefined) { id = nv.length / 3; rep.set(r, id); const q = tv[(i / 3 | 0) * 3 + i % 3]; nv.push(vp[q * 3], vp[q * 3 + 1], vp[q * 3 + 2]); }
    nt[i] = id;
  }
  return { vp: Float32Array.from(nv), tv: nt };
}
const soupVol = (vp, tv) => { let s = 0; for (let t = 0; t < tv.length; t += 3) { const a = tv[t] * 3, b = tv[t + 1] * 3, c = tv[t + 2] * 3; s += vp[a] * (vp[b + 1] * vp[c + 2] - vp[b + 2] * vp[c + 1]) - vp[a + 1] * (vp[b] * vp[c + 2] - vp[b + 2] * vp[c]) + vp[a + 2] * (vp[b] * vp[c + 1] - vp[b + 1] * vp[c]); } return s / 6; };

export function toManifold(brush) {
  brush.updateMatrixWorld(true);
  const g = brush.geometry, pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count;
  const v = new THREE.Vector3(), vp = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(brush.matrixWorld); vp[i * 3] = v.x; vp[i * 3 + 1] = v.y; vp[i * 3 + 2] = v.z; }
  const tv = new Uint32Array(n);
  for (let i = 0; i < n; i++) tv[i] = idx ? idx.getX(i) : i;
  const flip = brush.matrixWorld.determinant() < 0;
  if (flip) for (let i = 0; i < n; i += 3) { const t = tv[i + 1]; tv[i + 1] = tv[i + 2]; tv[i + 2] = t; }
  let m = null;
  try {
    const mesh = new M.Mesh({ numProp: 3, vertProperties: vp, triVerts: tv });
    mesh.merge();                                                  // salda i vertici coincidenti (normali e UV duplicati)
    m = new M.Manifold(mesh);
    if (m.status() !== 'NoError') { m.delete(); m = null; }
  } catch (e) { m = null; }                                        // non è un solido chiuso
  // controllo: il volume di Manifold deve coincidere con quello dei triangoli (non dipende dalla connessione). Se non torna, ci sono anelli "pizzicati": si rifà la connessione
  const sv = soupVol(vp, tv);
  if (!m || Math.abs(m.volume() - sv) > Math.max(0.2, Math.abs(sv) * 2e-4)) {
    try {
      const d = depinch(vp, tv);
      if (d) {
        const m2 = new M.Manifold(new M.Mesh({ numProp: 3, vertProperties: d.vp, triVerts: d.tv }));
        if (m2.status() === 'NoError' && Math.abs(m2.volume() - sv) <= Math.max(0.2, Math.abs(sv) * 2e-4)) { if (m) m.delete(); return m2; }
        m2.delete();
      }
    } catch (e) { /* si tiene il risultato di prima */ }
  }
  return m;
}

// vero se Manifold accetta la mesh come solido chiuso (null se il motore non è pronto). P: posizioni xyz, I: indici dei triangoli (o null se la mesh non è indicizzata)
export function meshIsClosed(P, I) {
  if (!M) return null;
  let m = null;
  try {
    const tv = I ? Uint32Array.from(I) : Uint32Array.from({ length: P.length / 3 }, (_, k) => k);
    const mesh = new M.Mesh({ numProp: 3, vertProperties: Float32Array.from(P), triVerts: tv });
    mesh.merge();
    m = new M.Manifold(mesh);
    return m.status() === 'NoError';
  } catch (e) { return false; }
  finally { try { m && m.delete(); } catch (e) {} }
}
export const geoIsClosed = g => meshIsClosed(g.attributes.position.array, g.index ? g.index.array : null);

// Pulizia: Manifold fonde i triangoli quasi complanari e toglie i vertici inutili (a 2 µm di tolleranza). Il risultato si accetta solo se il pezzo resta chiuso e con lo stesso volume.
// Restituisce { pos, tris } (triangoli non indicizzati) oppure null: in quel caso si tiene la mesh com'era.
export function simplifyGeo(g, tol = 0.002) {
  if (!M || !M.Manifold.prototype.simplify) return null;
  let m = null, s = null;
  try {
    const P = g.attributes.position.array, I = g.index ? g.index.array : null;
    const tv = I ? Uint32Array.from(I) : Uint32Array.from({ length: P.length / 3 }, (_, k) => k);
    const mesh = new M.Mesh({ numProp: 3, vertProperties: Float32Array.from(P), triVerts: tv });
    mesh.merge();
    m = new M.Manifold(mesh);
    if (m.status() !== 'NoError') return null;
    s = m.simplify(tol);
    if (!s || s.status() !== 'NoError') return null;
    const v0 = m.volume(), v1 = s.volume();
    if (!(v0 > 0) || Math.abs(v1 - v0) > 2e-5 * v0) return null;
    const out = s.getMesh(), vp = out.vertProperties, t2 = out.triVerts, nP = out.numProp;
    if (t2.length / 3 >= tv.length / 3) return null;               // niente da semplificare
    const pos = new Float32Array(t2.length * 3);
    for (let i = 0; i < t2.length; i++) { const k = t2[i] * nP; pos[i * 3] = vp[k]; pos[i * 3 + 1] = vp[k + 1]; pos[i * 3 + 2] = vp[k + 2]; }
    return { pos, tris: t2.length / 3 };
  } catch (e) { return null; }
  finally { for (const x of [m, s]) { try { x && x.delete(); } catch (e) {} } }
}

function toBrush(m, material) {
  const mesh = m.getMesh(), vp = mesh.vertProperties, tv = mesh.triVerts, nP = mesh.numProp;
  const pos = new Float32Array(tv.length * 3);
  for (let i = 0; i < tv.length; i++) { const k = tv[i] * nP; pos[i * 3] = vp[k]; pos[i * 3 + 1] = vp[k + 1]; pos[i * 3 + 2] = vp[k + 2]; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const b = new Brush(g, material);
  b.updateMatrixWorld(true);
  return b;
}

// op: 0 somma, 1 sottrazione, 3 intersezione (0, 1, 3 come three-bvh-csg)
export function manifoldEvaluate(a, b, op, material) {
  if (!M) return null;
  let ma = null, mb = null, r = null;
  try {
    ma = toManifold(a); mb = toManifold(b);
    if (!ma || !mb) return null;
    r = op === 0 ? ma.add(mb) : op === 1 ? ma.subtract(mb) : op === 3 ? ma.intersect(mb) : null;
    if (!r || r.status() !== "NoError") return null;
    return toBrush(r, material || a.material);
  } catch (e) { console.warn('Manifold op ' + (e && (e.message || e.code || e.name)) + ' ' + String(e && e.stack).slice(0, 300)); return null; }
  finally { for (const x of [ma, mb, r]) { try { x && x.delete(); } catch (e) {} } }
}

// Combina in un colpo solo: tutti i solidi si uniscono (o si intersecano) e tutti i fori si tolgono insieme. Manifold unisce molti pezzi con un solo calcolo,
// invece di rifare l'intera mesh a ogni coppia. Restituisce un Brush in coordinate mondo, o null (pezzo non chiuso, risultato vuoto): allora si usa il percorso a coppie.
export function manifoldCombine(solids, holes, mode, material) {
  if (!M || !solids.length) return null;
  const objs = [], keep = o => { objs.push(o); return o; };
  const conv = list => list.map(b => { const m = toManifold(b); if (!m) throw new Error('non chiuso'); return keep(m); });
  try {
    const ms = conv(solids);
    let acc = ms.length === 1 ? ms[0] : mode === 'intersect' ? ms.slice(1).reduce((a, m) => keep(a.intersect(m)), ms[0]) : keep(M.Manifold.union(ms));
    if (holes.length) { const hs = conv(holes); acc = keep(acc.subtract(hs.length === 1 ? hs[0] : keep(M.Manifold.union(hs)))); }
    if (acc.status() !== 'NoError' || acc.isEmpty()) return null;
    return toBrush(acc, material || solids[0].material);
  } catch (e) { return null; }
  finally { for (const x of objs) { try { x.delete(); } catch (e) {} } }
}

// Allunga/accorcia: taglia il pezzo sul piano, sposta la parte oltre il piano e riempie lo spazio con la sezione estrusa (delta > 0)
// o lascia combaciare le due parti (delta < 0). Restituisce un Brush in coordinate mondo, o null.
const TO_Z = { x: [0, -90, 0], y: [90, 0, 0], z: [0, 0, 0] }, FROM_Z = { x: [0, 90, 0], y: [-90, 0, 0], z: [0, 0, 0] };
export function manifoldStretch(brush, ax, pos, delta, material) {
  if (!M) return null;
  let objs = [];
  const keep = o => { objs.push(o); return o; };
  try {
    const m0 = toManifold(brush); if (!m0) return null; keep(m0);
    const m = keep(m0.rotate(TO_Z[ax]));
    let parts;
    if (delta > 0) {
      let cs = keep(m.slice(pos));
      if (cs.isEmpty()) { cs = keep(m.slice(pos + 0.002)); }
      if (cs.isEmpty()) return null;
      const slab = keep(keep(M.Manifold.extrude(cs, delta)).translate([0, 0, pos]));
      parts = [keep(m.trimByPlane([0, 0, -1], -pos)), slab, keep(keep(m.trimByPlane([0, 0, 1], pos)).translate([0, 0, delta]))];
    } else {
      const L = pos + delta;
      parts = [keep(m.trimByPlane([0, 0, -1], -L)), keep(keep(m.trimByPlane([0, 0, 1], pos)).translate([0, 0, delta]))];
    }
    const u = keep(M.Manifold.union(parts));
    const r = keep(u.rotate(FROM_Z[ax]));
    if (r.status() !== 'NoError' || r.isEmpty()) return null;
    return toBrush(r, material || brush.material);
  } catch (e) { console.warn('Manifold stretch ' + (e && e.message)); return null; }
  finally { for (const x of objs) { try { x.delete(); } catch (e) {} } }
}

// tiene la metà del pezzo dalla parte 'side' (-1 sotto il piano, +1 sopra): taglio esatto, chiuso e veloce
export function manifoldHalf(brush, ax, pos, side, material) {
  if (!M) return null;
  const objs = [], keep = o => { objs.push(o); return o; }, n = [0, 0, 0]; n['xyz'.indexOf(ax)] = side;
  try {
    const m = toManifold(brush); if (!m) return null; keep(m);
    const r = keep(m.trimByPlane(n, side * pos));
    if (r.status() !== 'NoError' || r.isEmpty()) return null;
    return toBrush(r, material || brush.material);
  } catch (e) { console.warn('Manifold half ' + (e && e.message)); return null; }
  finally { for (const x of objs) { try { x.delete(); } catch (e) {} } }
}

