// Motore booleano robusto (Manifold, WASM): restituisce sempre solidi chiusi. Se non è pronto o fallisce, si usa three-bvh-csg.
import * as THREE from 'three';
import { Brush } from 'three-bvh-csg';
import Module from 'manifold-3d';
import wasmB64 from './manifold.wasm.js';

let M = null;
export const manifoldReady = () => !!M;
export const initManifold = () => {
  const bin = Uint8Array.from(atob(wasmB64), c => c.charCodeAt(0));
  return Module({ wasmBinary: bin }).then(m => { m.setup(); M = m; return m; }).catch(e => { console.warn('Manifold KO ' + JSON.stringify(Object.getOwnPropertyNames(e || {})) + ' ' + (e && e.message) + ' ' + (e && e.code) + ' ' + String(e && e.stack).slice(0, 400)); });
};

function toManifold(brush) {
  brush.updateMatrixWorld(true);
  const g = brush.geometry, pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count;
  const v = new THREE.Vector3(), vp = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(brush.matrixWorld); vp[i * 3] = v.x; vp[i * 3 + 1] = v.y; vp[i * 3 + 2] = v.z; }
  const tv = new Uint32Array(n);
  for (let i = 0; i < n; i++) tv[i] = idx ? idx.getX(i) : i;
  const flip = brush.matrixWorld.determinant() < 0;
  if (flip) for (let i = 0; i < n; i += 3) { const t = tv[i + 1]; tv[i + 1] = tv[i + 2]; tv[i + 2] = t; }
  const mesh = new M.Mesh({ numProp: 3, vertProperties: vp, triVerts: tv });
  mesh.merge();                                                    // salda i vertici coincidenti (normali e UV duplicati)
  const m = new M.Manifold(mesh);
  if (m.status() !== 'NoError') { m.delete(); return null; }
  return m;
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
