// Controllo di stampa: solido chiuso, strati, pareti sottili, sbalzi e stime. Usa Manifold (le sezioni sono esatte, non una simulazione approssimata).
import { manifoldMod, toManifold } from './mcsg.js';

const RHO = 1.24;                                    // PLA, g/cm3
export function buildCheck(meshes, { layer = 0.2, minWall = 0.8 } = {}) {
  const M = manifoldMod();
  if (!M) return { err: 'Il motore non è pronto: riprova tra un attimo' };
  const R = { open: [], parts: 0 }, ms = [];
  for (const o of meshes) {
    o.updateMatrixWorld(true);
    const m = toManifold(o);
    if (m) ms.push(m); else R.open.push(o.userData.name || 'Pezzo');
  }
  if (!ms.length) return R;
  let U;
  try { U = ms.length > 1 ? M.Manifold.union(ms) : ms[0]; } catch (e) { U = ms[0]; }
  if (U !== ms[0]) ms.forEach(m => { try { m.delete(); } catch (e) {} });
  R.U = U;
  const bb = U.boundingBox(), H = bb.max[2] - Math.min(bb.min[2], 0);
  R.bb = bb; R.vol = U.volume(); R.area = U.surfaceArea();
  R.layers = Math.max(1, Math.ceil((bb.max[2]) / layer)); R.layer = layer; R.minWall = minWall;
  // parti staccate e sospese (non toccano il piatto)
  const comps = U.decompose(); R.parts = comps.length; R.floating = [];
  for (const c of comps) { const b = c.boundingBox(); if (b.min[2] > 0.05) R.floating.push({ z: b.min[2], vol: c.volume(), box: b }); try { c.delete(); } catch (e) {} }
  // sbalzi: facce rivolte in basso a meno di 45° dall'orizzontale, esclusa la base sul piatto
  const mesh = U.getMesh(), vp = mesh.vertProperties, tv = mesh.triVerts, np = mesh.numProp, bad = [];
  let oa = 0, ta = 0;
  for (let i = 0; i < tv.length; i += 3) {
    const a = tv[i] * np, b = tv[i + 1] * np, c = tv[i + 2] * np;
    const ux = vp[b] - vp[a], uy = vp[b + 1] - vp[a + 1], uz = vp[b + 2] - vp[a + 2], vx = vp[c] - vp[a], vy = vp[c + 1] - vp[a + 1], vz = vp[c + 2] - vp[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
    if (l < 1e-9) continue;
    const ar = l / 2; ta += ar;
    if (nz / l < -0.7071 && Math.max(vp[a + 2], vp[b + 2], vp[c + 2]) > 0.05) { oa += ar; bad.push(vp[a], vp[a + 1], vp[a + 2], vp[b], vp[b + 1], vp[b + 2], vp[c], vp[c + 1], vp[c + 2]); }
  }
  R.over = { area: oa, total: ta, pos: Float32Array.from(bad) };
  // pareti sottili: si campionano fino a 70 strati
  const step = Math.max(1, Math.floor(R.layers / 70)); R.thin = { layers: 0, first: null, worst: 0, scanned: 0 };
  for (let i = 0; i < R.layers; i += step) {
    const t = thinAt(R, i); R.thin.scanned++;
    if (t.area > 0.15) { R.thin.layers++; if (R.thin.first === null) R.thin.first = (i + 0.5) * layer; R.thin.worst = Math.max(R.thin.worst, t.area); }
  }
  // primo strato
  const c0 = U.slice(layer / 2); R.first = c0.area(); try { c0.delete(); } catch (e) {}
  // stime (indicative)
  const shell = Math.min(R.vol, R.area * 1.0), vf = shell + 0.15 * (R.vol - shell);
  R.grams = vf / 1000 * RHO; R.minutes = (vf / 8 + R.layers * 4) / 60;
  R.dispose = () => { try { U.delete(); } catch (e) {} };
  return R;
}
// sezione allo strato i: contorni e zone sotto lo spessore minimo
export function thinAt(R, i) {
  const z = (i + 0.5) * R.layer, cs = R.U.slice(z), out = { z, area: 0, polys: [], thin: [] };
  if (cs.isEmpty()) { try { cs.delete(); } catch (e) {} return out; }
  out.polys = cs.toPolygons();
  const w = R.minWall;
  const a = cs.offset(-w / 2, 'Round', 2, 12), b = a.offset(w / 2, 'Round', 2, 12), d = cs.subtract(b), e = d.offset(-0.03, 'Round', 2, 8);
  out.area = e.isEmpty() ? 0 : e.area();
  if (out.area > 0.15) out.thin = e.offset(0.03, 'Round', 2, 8).toPolygons();
  for (const x of [cs, a, b, d, e]) { try { x.delete(); } catch (err) {} }
  return out;
}
