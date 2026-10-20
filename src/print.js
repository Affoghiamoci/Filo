// Controllo di stampa: solido chiuso, strati, pareti sottili, sbalzi e stime. Usa Manifold (le sezioni sono esatte, non una simulazione approssimata).
import { manifoldMod, toManifold } from './mcsg.js';

const RHO = 1.24;                                    // PLA, g/cm3
// Ugelli standard e impostazioni consigliate (PLA): larghezza della linea, strati (25-75 % dell'ugello), pareti, gusci, dettaglio minimo
export const NOZZLES = {
  0.2: { lw: 0.22, layers: [0.06, 0.08, 0.1, 0.14], best: 0.1, walls: 4, top: 7, bottom: 6, speed: 60, flow: 2.5, infill: 15 },
  0.4: { lw: 0.42, layers: [0.12, 0.16, 0.2, 0.28], best: 0.2, walls: 2, top: 5, bottom: 4, speed: 100, flow: 7, infill: 15 },
  0.6: { lw: 0.62, layers: [0.2, 0.28, 0.36, 0.42], best: 0.3, walls: 2, top: 4, bottom: 3, speed: 120, flow: 13, infill: 15 },
  0.8: { lw: 0.82, layers: [0.3, 0.4, 0.5, 0.6], best: 0.4, walls: 2, top: 3, bottom: 3, speed: 120, flow: 20, infill: 12 }
};
export const nozzleOf = n => NOZZLES[n] ? NOZZLES[n] : NOZZLES[0.4];
const tick = () => new Promise(r => setTimeout(r, 0));
// async: le sezioni sono tante, quindi ogni tanto si cede il passo al browser (interfaccia viva, avanzamento, annullabile). hooks: { progress(0..1), cancelled() }
export async function buildCheck(meshes, { layer = 0.2, minWall = 0.8, nozzle = 0.4, bed = null } = {}, hooks = {}) {
  const NZ = nozzleOf(nozzle), lw = NZ.lw;
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
  R.U = U; R.memo = new Map(); R.sig = new Map();
  const stop = () => hooks.cancelled && hooks.cancelled();
  const bb = U.boundingBox(), H = bb.max[2] - Math.min(bb.min[2], 0);
  R.bb = bb; R.vol = U.volume(); R.area = U.surfaceArea();
  R.layers = Math.max(1, Math.ceil((bb.max[2]) / layer)); R.layer = layer; R.minWall = minWall; R.nozzle = nozzle; R.lw = lw;
  R.size = [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2]];
  R.fit = bed ? { bed, over: R.size[0] > bed[0] + 0.01 || R.size[1] > bed[1] + 0.01 || (bed[2] && R.size[2] > bed[2] + 0.01) } : null;
  { const lo = Math.min(R.size[0], R.size[1]); R.slender = lo > 0 ? R.size[2] / lo : 0; }
  await tick(); if (stop()) { try { U.delete(); } catch (e) {} return null; }
  // parti staccate e sospese (non toccano il piatto)
  const comps = U.decompose(); R.parts = comps.length; R.floating = [];
  for (const c of comps) { const b = c.boundingBox(); if (b.min[2] > 0.05) R.floating.push({ z: b.min[2], vol: c.volume(), box: b }); try { c.delete(); } catch (e) {} }
  await tick(); if (stop()) { try { U.delete(); } catch (e) {} return null; }
  // sbalzi: facce rivolte in basso a meno di 45° dall'orizzontale, esclusa la base sul piatto
  const mesh = U.getMesh(), vp = mesh.vertProperties, tv = mesh.triVerts, np = mesh.numProp, bad = [];
  let oa = 0, ta = 0, fa = 0; const roofs = new Map(), zs = new Set();
  for (let i = 0; i < tv.length; i += 3) {
    const a = tv[i] * np, b = tv[i + 1] * np, c = tv[i + 2] * np;
    const ux = vp[b] - vp[a], uy = vp[b + 1] - vp[a + 1], uz = vp[b + 2] - vp[a + 2], vx = vp[c] - vp[a], vy = vp[c + 1] - vp[a + 1], vz = vp[c + 2] - vp[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
    if (l < 1e-9) continue;
    const ar = l / 2; ta += ar;
    if (Math.abs(nz / l) > 0.9) fa += ar;
    for (const q of [a, b, c]) zs.add(Math.round(vp[q + 2] * 100));
    if (nz / l < -0.98 && vp[a + 2] > 0.05) { const k = Math.round(vp[a + 2] * 100); roofs.set(k, (roofs.get(k) || 0) + ar); }
    if (nz / l < -0.7071 && Math.max(vp[a + 2], vp[b + 2], vp[c + 2]) > 0.05) { oa += ar; bad.push(vp[a], vp[a + 1], vp[a + 2], vp[b], vp[b + 1], vp[b + 2], vp[c], vp[c + 1], vp[c + 2]); }
  }
  R.over = { area: oa, total: ta, pos: Float32Array.from(bad) }; R.flatArea = fa;
  // ponti: tetti piatti che poggiano sull'aria. Si guarda quanto è larga la zona senza appoggio sotto (apertura morfologica con raggio crescente)
  R.bridge = { span: 0, z: null, n: 0 };
  { const lv = [...roofs].filter(([, a]) => a > 4).sort((x, y) => y[1] - x[1]).slice(0, 24).map(([k]) => k / 100);
    for (const z of lv) {
      const up = U.slice(z + 0.05), dn = U.slice(Math.max(0, z - 0.05));
      const un = up.subtract(dn); let sp = 0;
      for (const w of [6, 10, 15, 20, 30, 40, 60]) { const t = un.offset(-w / 2 * 0.98, 'Round', 2, 8); const em = t.isEmpty(); try { t.delete(); } catch (e) {} if (em) break; sp = w; }
      if (sp) { R.bridge.n++; if (sp > R.bridge.span) { R.bridge.span = sp; R.bridge.z = z; } }
      for (const x of [up, dn, un]) { try { x.delete(); } catch (e) {} }
    }
  }
  await tick(); if (stop()) { try { U.delete(); } catch (e) {} return null; }
  // pareti sottili e fessure: strati campionati in modo uniforme (circa 70) e, dove il pezzo ha gradini, anche a metà tra un livello e l'altro
  // (altrimenti un gradino sottile tra due campioni sfuggirebbe)
  const step = Math.max(1, Math.floor(R.layers / 70)), pick = new Set(); R.thin = { layers: 0, unprint: 0, first: null, worst: 0, scanned: 0 }; R.gap = { layers: 0, first: null, worst: 0 };
  for (let i = 0; i < R.layers; i += step) pick.add(i);
  { const zl = [...zs].sort((p, q) => p - q).map(v => v / 100); if (zl.length <= 160) for (let k = 0; k + 1 < zl.length; k++) if (zl[k + 1] - zl[k] > 0.02) { const i = Math.floor((zl[k] + zl[k + 1]) / 2 / layer); if (i >= 0 && i < R.layers) pick.add(i); } }
  const order = [...pick].sort((p, q) => p - q); let last = performance.now(), done = 0;
  for (const i of order) {
    const t = thinAt(R, i); R.thin.scanned++;
    if (t.area > 0.15) { R.thin.layers++; if (R.thin.first === null) R.thin.first = (i + 0.5) * layer; R.thin.worst = Math.max(R.thin.worst, t.area); }
    if (t.area1 > 0.1) R.thin.unprint++;
    if (t.gap > 0.1) { R.gap.layers++; if (R.gap.first === null) R.gap.first = (i + 0.5) * layer; R.gap.worst = Math.max(R.gap.worst, t.gap); }
    if (performance.now() - last > 50) {
      if (hooks.progress) hooks.progress(done / order.length);
      await tick(); last = performance.now();
      if (stop()) { try { U.delete(); } catch (e) {} return null; }
    }
    done++;
  }
  // primo strato
  const c0 = U.slice(layer / 2); R.first = c0.area(); try { c0.delete(); } catch (e) {}
  // stime (indicative): pareti (n. pareti x larghezza linea) sulle facce laterali, gusci sopra e sotto sulle facce orizzontali, riempimento sul resto
  { const wallsV = Math.max(0, R.over.total - R.flatArea) * NZ.walls * lw, skinV = R.flatArea * (NZ.top + NZ.bottom) / 2 * layer;
    const solid = Math.min(R.vol, wallsV + skinV), vf = solid + NZ.infill / 100 * (R.vol - solid);
    R.grams = vf / 1000 * RHO; R.minutes = (vf / NZ.flow + R.layers * 3.5) / 60; R.vf = vf; }
  R.dispose = () => { try { U.delete(); } catch (e) {} };
  return R;
}
// sezione allo strato i: contorni e zone sotto lo spessore minimo
export function thinAt(R, i) {
  const hit = R.memo && R.memo.get(i); if (hit) return hit;
  const z = (i + 0.5) * R.layer, cs = R.U.slice(z), out = { z, area: 0, polys: [], thin: [] };
  if (cs.isEmpty()) { try { cs.delete(); } catch (e) {} return out; }
  out.polys = cs.toPolygons();
  // strati con la stessa sezione (pareti dritte, fori passanti) danno lo stesso risultato: si calcola una volta sola
  let h1 = 2166136261 >>> 0, h2 = 5381, n = 0;
  for (const poly of out.polys) { for (const q of poly) { const a = Math.round(q[0] * 1e4) | 0, b = Math.round(q[1] * 1e4) | 0; h1 = Math.imul(h1 ^ a, 16777619) >>> 0; h1 = Math.imul(h1 ^ b, 16777619) >>> 0; h2 = (h2 * 33 + a * 7 + b) | 0; n++; } h1 = Math.imul(h1 ^ 0x9e37, 16777619) >>> 0; }
  const key = h1 + ':' + h2 + ':' + n + ':' + out.polys.length;
  const same = R.sig && R.sig.get(key);
  if (same) { try { cs.delete(); } catch (e) {} const o = { ...same, z }; R.memo.set(i, o); return o; }
  const w = R.minWall;
  const a = cs.offset(-w / 2, 'Round', 2, 12), b = a.offset(w / 2, 'Round', 2, 12), d = cs.subtract(b), e = d.offset(-0.03, 'Round', 2, 8);
  out.area = e.isEmpty() ? 0 : e.area(); out.area1 = 0; out.thin1 = [];
  if (out.area > 0.15) {
    out.thin = e.offset(0.03, 'Round', 2, 8).toPolygons();
    const w1 = Math.min(R.lw * 0.92, w), a1 = cs.offset(-w1 / 2, 'Round', 2, 12), b1 = a1.offset(w1 / 2, 'Round', 2, 12), d1 = cs.subtract(b1), e1 = d1.offset(-0.03, 'Round', 2, 8);
    out.area1 = e1.isEmpty() ? 0 : e1.area(); if (out.area1 > 0.1) out.thin1 = e1.offset(0.03, 'Round', 2, 8).toPolygons();
    for (const x of [a1, b1, d1, e1]) { try { x.delete(); } catch (err) {} }
  }
  // fessure e fori più stretti di una linea si richiudono da soli: si guarda il vuoto attorno al pezzo e si cerca dove è più stretto di una linea
  out.gap = 0;
  { const M = manifoldMod(), bx = R.bb, g = R.lw * 0.92;
    const sp0 = new M.CrossSection([[[bx.min[0] - 3, bx.min[1] - 3], [bx.max[0] + 3, bx.min[1] - 3], [bx.max[0] + 3, bx.max[1] + 3], [bx.min[0] - 3, bx.max[1] + 3]]]);
    const sp = sp0.subtract(cs), o1 = sp.offset(-g / 2, 'Round', 2, 12), o2 = o1.offset(g / 2, 'Round', 2, 12), f = sp.subtract(o2), f2 = f.offset(-0.03, 'Round', 2, 8);
    out.gap = f2.isEmpty() ? 0 : f2.area(); if (out.gap > 0.1) out.gaps = f2.offset(0.03, 'Round', 2, 8).toPolygons();
    for (const x of [sp0, sp, o1, o2, f, f2]) { try { x.delete(); } catch (err) {} } }
  for (const x of [cs, a, b, d, e]) { try { x.delete(); } catch (err) {} }
  if (R.sig) { R.sig.set(key, out); R.memo.set(i, out); }
  return out;
}
