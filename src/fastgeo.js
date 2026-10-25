// mergeVertices di three.js, ma con chiavi numeriche invece di stringhe (stesso risultato, molto più veloce sui pezzi grandi)
import * as THREE from 'three';
export function mergeVerticesFast(geometry, tolerance = 1e-4) {
  tolerance = Math.max(tolerance, Number.EPSILON);
  const indices = geometry.getIndex(), positions = geometry.getAttribute('position');
  const count = indices ? indices.count : positions.count;
  const names = Object.keys(geometry.attributes), attrs = names.map(n => geometry.attributes[n]);
  const nc = attrs.reduce((s, a) => s + a.itemSize, 0);
  const mult = Math.pow(10, Math.log10(1 / tolerance)), add = tolerance * 0.5 * mult;
  const getters = ['getX', 'getY', 'getZ', 'getW'];
  const keys = new Float64Array((positions.count) * nc), seenKey = new Uint8Array(positions.count);   // chiavi per vertice sorgente (calcolate una volta sola)
  const keyOf = v => {
    if (seenKey[v]) return;
    seenKey[v] = 1; let o = v * nc;
    for (const a of attrs) for (let k = 0; k < a.itemSize; k++) keys[o++] = Math.trunc(a[getters[k]](v) * mult + add);
  };
  const newOf = new Int32Array(positions.count).fill(-1), grid = new Map(), src = [];   // src: vertice sorgente che rappresenta ogni nuovo vertice
  const newIndices = new Array(count);
  const same = (a, b) => { for (let k = 0, oa = a * nc, ob = b * nc; k < nc; k++) if (keys[oa + k] !== keys[ob + k]) return false; return true; };
  for (let i = 0; i < count; i++) {
    const v = indices ? indices.getX(i) : i;
    if (newOf[v] >= 0) { newIndices[i] = newOf[v]; continue; }
    keyOf(v);
    let h = 0; for (let k = 0, o = v * nc; k < nc; k++) { const x = keys[o + k]; h = Math.imul(h ^ (x | 0), 16777619) ^ Math.imul(Math.floor(x / 4294967296) | 0, 2246822519); }
    let list = grid.get(h), found = -1;
    if (list) for (const s of list) if (same(s, v)) { found = newOf[s]; break; }
    if (found < 0) { found = src.length; src.push(v); if (list) list.push(v); else grid.set(h, [v]); }
    newOf[v] = found; newIndices[i] = found;
  }
  const result = geometry.clone();
  names.forEach((n, j) => {
    const a = attrs[j], arr = new a.array.constructor(src.length * a.itemSize);
    for (let q = 0; q < src.length; q++) for (let k = 0; k < a.itemSize; k++) arr[q * a.itemSize + k] = a[getters[k]](src[q]);
    result.setAttribute(n, new a.constructor(arr, a.itemSize, a.normalized));
  });
  result.setIndex(newIndices);
  return result;
}
