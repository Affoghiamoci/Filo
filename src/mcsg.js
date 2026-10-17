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

export function toManifold(brush) {
  brush.updateMatrixWorld(true);
  const g = brush.geometry, pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count;
  const v = new THREE.Vector3(), vp = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(brush.matrixWorld); vp[i * 3] = v.x; vp[i * 3 + 1] = v.y; vp[i * 3 + 2] = v.z; }
  const tv = new Uint32Array(n);
  for (let i = 0; i < n; i++) tv[i] = idx ? idx.getX(i) : i;
  const flip = brush.matrixWorld.determinant() < 0;
  if (flip) for (let i = 0; i < n; i += 3) { const t = tv[i + 1]; tv[i + 1] = tv[i + 2]; tv[i + 2] = t; }
  try {
    const mesh = new M.Mesh({ numProp: 3, vertProperties: vp, triVerts: tv });
    mesh.merge();                                                  // salda i vertici coincidenti (normali e UV duplicati)
    const m = new M.Manifold(mesh);
    if (m.status() !== 'NoError') { m.delete(); return null; }
    return m;
  } catch (e) { return null; }                                     // non è un solido chiuso
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

