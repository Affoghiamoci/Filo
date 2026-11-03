// Worker del calcolo pesante (Combina, Interseca, Stampo): fa l'operazione booleana con Manifold e la pulizia del risultato,
// così la pagina resta libera e il calcolo si può annullare (il thread principale chiude il worker).
// Messaggi in entrata:  { t: 'init', wasm }  e  { t: 'job', id, mode, solids, holes, noSimplify }
// Messaggi in uscita:   { t: 'ready' }  e  { t: 'done', id, st: 'ok' | 'empty' | 'fallback', ... }
import * as THREE from 'three';
import { initManifold, manifoldCombineRaw, manifoldReady } from './mcsg.js';
import { bakeGeometry } from './bake.js';

const stand = d => {                                       // segnaposto di un pezzo: a toManifold servono solo la geometria e la matrice
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
  if (d.index) g.setIndex(new THREE.BufferAttribute(d.index, 1));
  return { geometry: g, matrixWorld: new THREE.Matrix4().fromArray(d.m), updateMatrixWorld() {} };
};

self.onmessage = async e => {
  const d = e.data;
  if (d.t === 'init') {
    try { await initManifold(d.wasm); self.postMessage({ t: 'ready', ok: manifoldReady() }); }
    catch (err) { self.postMessage({ t: 'ready', ok: false }); }
    return;
  }
  if (d.t !== 'job') return;
  const out = { t: 'done', id: d.id, st: 'fallback' };
  try {
    const raw = manifoldCombineRaw(d.solids.map(stand), d.holes.map(stand), d.mode);
    if (raw) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(raw, 3));
      g.computeVertexNormals();                            // come toBrush nel percorso senza worker
      const r = bakeGeometry(g, d.noSimplify);
      if (!r) out.st = 'empty';
      else {
        const attrs = {}, tr = new Set();
        for (const k of Object.keys(r.geo.attributes)) { const a = r.geo.attributes[k]; attrs[k] = { array: a.array, itemSize: a.itemSize, normalized: a.normalized }; tr.add(a.array.buffer); }
        const index = r.geo.index ? r.geo.index.array : null;
        if (index) tr.add(index.buffer);
        Object.assign(out, { st: 'ok', attrs, index, pos: r.pos, size: [r.size.x, r.size.y, r.size.z] });
        self.postMessage(out, [...tr]);
        return;
      }
    }
  } catch (err) { out.st = 'fallback'; }
  self.postMessage(out);
};
