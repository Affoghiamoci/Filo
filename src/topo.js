// Vista topologica di un pezzo (motore 1.0, fase 1).
// Dai triangoli "sciolti" ricostruisce vertici saldati, mezzi-spigoli con il gemello, facce piane (anche con buchi),
// spigoli tra facce (convessi o concavi), gruppi lisci (superfici curve) e i difetti (bordi aperti, spigoli e vertici "pizzicati").
// Non modifica niente: è la base su cui le fasi successive faranno lavorare Lato e Spigolo direttamente sulla struttura.
import * as THREE from 'three';

const PLANE_COS = 1 - 1e-6;          // due triangoli stanno sulla stessa faccia se le normali coincidono...
const PLANE_TOL = 1e-3;              // ...e il piano è lo stesso (mm)
const SMOOTH_COS = Math.cos(30 * Math.PI / 180);   // facce con meno di 30° tra loro: stessa superficie liscia

// saldatura: punti più vicini di tol diventano lo stesso vertice (griglia con controllo delle celle vicine)
function weld(P, tol) {
  const n = P.length / 3, ids = new Int32Array(n), grid = new Map(), out = [];
  const inv = 1 / tol, t2 = tol * tol;
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    const gx = Math.round(x * inv), gy = Math.round(y * inv), gz = Math.round(z * inv);
    let found = -1;
    for (let dx = -1; dx <= 1 && found < 0; dx++) for (let dy = -1; dy <= 1 && found < 0; dy++) for (let dz = -1; dz <= 1 && found < 0; dz++) {
      const cell = grid.get((gx + dx) + ',' + (gy + dy) + ',' + (gz + dz));
      if (!cell) continue;
      for (const v of cell) { const ex = out[v * 3] - x, ey = out[v * 3 + 1] - y, ez = out[v * 3 + 2] - z; if (ex * ex + ey * ey + ez * ez <= t2) { found = v; break; } }
    }
    if (found < 0) {
      found = out.length / 3; out.push(x, y, z);
      const k = gx + ',' + gy + ',' + gz; const c = grid.get(k); if (c) c.push(found); else grid.set(k, [found]);
    }
    ids[i] = found;
  }
  return { V: Float64Array.from(out), ids };
}

class DSU {
  constructor(n) { this.p = Int32Array.from({ length: n }, (_, i) => i); }
  find(a) { while (this.p[a] !== a) { this.p[a] = this.p[this.p[a]]; a = this.p[a]; } return a; }
  union(a, b) { a = this.find(a); b = this.find(b); if (a !== b) this.p[b] = a; }
}

// P: posizioni xyz di triangoli non indicizzati (coordinate mondo). Restituisce la topologia.
export function buildTopo(P, { tol = 1e-3 } = {}) {
  const { V, ids } = weld(P, tol);
  const nV = V.length / 3;
  // triangoli validi (niente triangoli con due vertici uguali o area nulla)
  const T = [], tn = [], td = [];
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), nn = new THREE.Vector3();
  let degenerate = 0;
  for (let i = 0; i < ids.length; i += 3) {
    const a = ids[i], b = ids[i + 1], c = ids[i + 2];
    if (a === b || b === c || a === c) { degenerate++; continue; }
    A.fromArray(V, a * 3); B.fromArray(V, b * 3); C.fromArray(V, c * 3);
    nn.subVectors(B, A).cross(C.clone().sub(A));
    const l = nn.length(); if (l < 1e-12) { degenerate++; continue; }
    nn.divideScalar(l);
    T.push(a, b, c); tn.push(nn.x, nn.y, nn.z); td.push(nn.dot(A));
  }
  const nT = T.length / 3;
  // mezzi-spigoli: h = 3*t + j va da T[h] a T[3t + (j+1)%3]
  const nH = nT * 3, twin = new Int32Array(nH).fill(-1);
  const from = h => T[h], to = h => T[(h - h % 3) + (h % 3 + 1) % 3];
  const und = new Map();                        // spigolo non orientato -> mezzi-spigoli che lo usano
  const ek = (a, b) => a < b ? a * nV + b : b * nV + a;
  for (let h = 0; h < nH; h++) { const k = ek(from(h), to(h)); const l = und.get(k); if (l) l.push(h); else und.set(k, [h]); }
  let openEdges = 0, nonManifoldEdges = 0;
  const badEdges = [];
  for (const [k, l] of und) {
    if (l.length === 2 && from(l[0]) === to(l[1]) && to(l[0]) === from(l[1])) { twin[l[0]] = l[1]; twin[l[1]] = l[0]; }
    else if (l.length === 1) { openEdges++; badEdges.push({ kind: 'open', a: from(l[0]), b: to(l[0]) }); }
    else { nonManifoldEdges++; badEdges.push({ kind: l.length === 2 ? 'flipped' : 'nonmanifold', a: from(l[0]), b: to(l[0]), uses: l.length }); }
  }
  // vertici "pizzicati": i triangoli attorno al vertice non formano un solo ventaglio
  const vt = Array.from({ length: nV }, () => []);
  for (let t = 0; t < nT; t++) for (let j = 0; j < 3; j++) vt[T[t * 3 + j]].push(t);
  const pinched = [];
  for (let v = 0; v < nV; v++) {
    const L = vt[v]; if (L.length < 2) continue;
    const loc = new Map(L.map((t, i) => [t, i])), d = new DSU(L.length);
    for (const t of L) for (let j = 0; j < 3; j++) {
      const h = t * 3 + j; if (from(h) !== v && to(h) !== v) continue;
      const o = twin[h]; if (o < 0) continue;
      const t2 = (o - o % 3) / 3; if (loc.has(t2)) d.union(loc.get(t), loc.get(t2));
    }
    const roots = new Set(L.map((_, i) => d.find(i)));
    if (roots.size > 1) pinched.push(v);
  }
  // facce piane: triangoli vicini con la stessa normale e lo stesso piano
  const fd = new DSU(nT);
  for (let h = 0; h < nH; h++) {
    const o = twin[h]; if (o < h) continue;
    const t1 = (h - h % 3) / 3, t2 = (o - o % 3) / 3;
    const c = tn[t1 * 3] * tn[t2 * 3] + tn[t1 * 3 + 1] * tn[t2 * 3 + 1] + tn[t1 * 3 + 2] * tn[t2 * 3 + 2];
    if (c > PLANE_COS && Math.abs(td[t1] - td[t2]) < PLANE_TOL) fd.union(t1, t2);
  }
  const faceOf = new Int32Array(nT), faces = [], rootIdx = new Map();
  for (let t = 0; t < nT; t++) {
    const r = fd.find(t); let f = rootIdx.get(r);
    if (f === undefined) { f = faces.length; rootIdx.set(r, f); faces.push({ id: f, tris: [], area: 0, n: null, d: 0, loops: [], smooth: -1 }); }
    faceOf[t] = f; faces[f].tris.push(t);
  }
  // normale media pesata con l'area, piano, area
  for (const F of faces) {
    const s = new THREE.Vector3();
    for (const t of F.tris) {
      A.fromArray(V, T[t * 3] * 3); B.fromArray(V, T[t * 3 + 1] * 3); C.fromArray(V, T[t * 3 + 2] * 3);
      const c = B.clone().sub(A).cross(C.clone().sub(A)); F.area += c.length() / 2; s.add(c);
    }
    F.n = s.normalize(); F.d = F.n.dot(A.fromArray(V, T[F.tris[0] * 3] * 3));
  }
  // contorni delle facce: mezzi-spigoli il cui gemello sta su un'altra faccia (o manca), concatenati in giri
  for (const F of faces) {
    const out = new Map();                       // vertice -> mezzi-spigoli di bordo che partono da lì
    for (const t of F.tris) for (let j = 0; j < 3; j++) {
      const h = t * 3 + j, o = twin[h];
      if (o >= 0 && faceOf[(o - o % 3) / 3] === F.id) continue;
      const a = from(h); const l = out.get(a); if (l) l.push(h); else out.set(a, [h]);
    }
    const used = new Set();
    const u = new THREE.Vector3(), w = new THREE.Vector3();
    (Math.abs(F.n.z) < 0.9 ? u.set(0, 0, 1) : u.set(1, 0, 0)).cross(F.n).normalize(); w.crossVectors(F.n, u);
    for (const [, l] of out) for (const h0 of l) {
      if (used.has(h0)) continue;
      const verts = [], hs = []; let h = h0, guard = 0;
      while (h !== undefined && !used.has(h) && guard++ < 1e6) {
        used.add(h); verts.push(from(h)); hs.push(h);
        const nx = (out.get(to(h)) || []).filter(x => !used.has(x));
        h = nx.length ? nx[0] : undefined;
      }
      const closed = verts.length > 2 && h === undefined && to(hs[hs.length - 1]) === verts[0];
      // area con segno nel piano della faccia: positiva = contorno esterno, negativa = buco
      let ar = 0;
      for (let i = 0; i < verts.length; i++) {
        const p = A.fromArray(V, verts[i] * 3), q = B.fromArray(V, verts[(i + 1) % verts.length] * 3);
        ar += p.dot(u) * q.dot(w) - q.dot(u) * p.dot(w);
      }
      ar /= 2;
      // angoli veri (dove il contorno cambia direzione): i punti in mezzo a un lato dritto non contano
      const corners = verts.filter((v, i) => {
        const p0 = A.fromArray(V, verts[(i + verts.length - 1) % verts.length] * 3).clone(), p1 = B.fromArray(V, v * 3).clone(), p2 = C.fromArray(V, verts[(i + 1) % verts.length] * 3).clone();
        const d1 = p1.clone().sub(p0).normalize(), d2 = p2.clone().sub(p1).normalize();
        return d1.dot(d2) < 1 - 1e-6;
      });
      F.loops.push({ verts, hs, closed, area: ar, outer: ar > 0, corners });
    }
    F.loops.sort((a, b) => b.area - a.area);
    F.holes = F.loops.filter(l => !l.outer).length;
  }
  // spigoli tra facce: catene di mezzi-spigoli che separano la stessa coppia di facce
  const segs = [];
  for (let h = 0; h < nH; h++) {
    const o = twin[h]; if (o < 0 || o < h) continue;
    const f1 = faceOf[(h - h % 3) / 3], f2 = faceOf[(o - o % 3) / 3];
    if (f1 === f2) continue;
    const a = from(h), b = to(h);
    const dir = B.fromArray(V, b * 3).clone().sub(A.fromArray(V, a * 3));
    const n1 = faces[f1].n, n2 = faces[f2].n, cosA = n1.dot(n2);
    const convex = new THREE.Vector3().crossVectors(n1, n2).dot(dir) > 0;
    segs.push({ h, a, b, f1, f2, cos: cosA, convex });
  }
  const edges = [], pairOf = new Map();
  for (const s of segs) {
    const k = Math.min(s.f1, s.f2) + '|' + Math.max(s.f1, s.f2);
    let e = pairOf.get(k);
    if (!e) { e = { id: edges.length, faces: [s.f1, s.f2], segs: [], angle: Math.acos(Math.max(-1, Math.min(1, s.cos))) * 180 / Math.PI, convex: s.convex, sharp: s.cos < SMOOTH_COS }; pairOf.set(k, e); edges.push(e); }
    e.segs.push([s.a, s.b]);
    if (s.convex !== e.convex) e.mixed = true;
  }
  // gruppi lisci: facce unite attraverso spigoli quasi piatti (superfici curve fatte di tante faccette)
  const sd = new DSU(faces.length);
  for (const e of edges) if (!e.sharp) sd.union(e.faces[0], e.faces[1]);
  const smooth = new Map();
  for (const F of faces) { const r = sd.find(F.id); let g = smooth.get(r); if (!g) { g = { id: smooth.size, faces: [] }; smooth.set(r, g); } g.faces.push(F.id); F.smooth = g.id; }
  // pieghe: spigoli vivi raggruppati per coppia di superfici (il bordo di un cilindro è una piega sola, anche se tocca 72 faccette)
  const creaseOf = new Map(), creases = [];
  for (const e of edges) {
    if (!e.sharp) continue;
    const g1 = faces[e.faces[0]].smooth, g2 = faces[e.faces[1]].smooth;
    const k = Math.min(g1, g2) + '|' + Math.max(g1, g2);
    let c = creaseOf.get(k);
    if (!c) { c = { id: creases.length, groups: [g1, g2], edges: [], convex: e.convex }; creaseOf.set(k, c); creases.push(c); }
    c.edges.push(e.id); e.crease = c.id; if (e.convex !== c.convex) c.mixed = true;
  }
  // pezzi separati e genere (Eulero: V - E + F = 2 - 2g per ogni pezzo chiuso)
  const cd = new DSU(nV);
  for (let t = 0; t < nT; t++) { cd.union(T[t * 3], T[t * 3 + 1]); cd.union(T[t * 3], T[t * 3 + 2]); }
  const usedV = new Set(T), comps = new Set([...usedV].map(v => cd.find(v)));
  const euler = usedV.size - und.size + nT;
  const closed = openEdges === 0 && nonManifoldEdges === 0;
  return {
    V, T: Int32Array.from(T), twin, faceOf, faces, edges, creases, smoothGroups: [...smooth.values()],
    stats: {
      verts: usedV.size, tris: nT, faces: faces.length, edges: edges.length, sharpEdges: edges.filter(e => e.sharp).length, creases: creases.length,
      concaveEdges: edges.filter(e => e.sharp && !e.convex).length, holes: faces.reduce((s, f) => s + f.holes, 0),
      components: comps.size, euler, genus: closed ? (2 * comps.size - euler) / 2 : null,
      closed, openEdges, nonManifoldEdges, pinched: pinched.length, degenerate,
    },
    pinched, badEdges,
  };
}

// Ricostruisce i triangoli dalle facce (contorni + buchi): serve a verificare che la topologia descriva tutto il pezzo,
// ed è il passo che le fasi successive useranno dopo aver modificato i contorni.
export function triangulateTopo(topo) {
  const { V, faces } = topo, out = [];
  const p = new THREE.Vector3(), u = new THREE.Vector3(), w = new THREE.Vector3();
  for (const F of faces) {
    const outer = F.loops.filter(l => l.outer && l.closed), holes = F.loops.filter(l => !l.outer && l.closed);
    if (outer.length !== 1 || F.loops.some(l => !l.closed)) {          // contorno insolito: si tengono i triangoli originali
      for (const t of F.tris) for (let j = 0; j < 3; j++) { const v = topo.T[t * 3 + j]; out.push(V[v * 3], V[v * 3 + 1], V[v * 3 + 2]); }
      continue;
    }
    (Math.abs(F.n.z) < 0.9 ? u.set(0, 0, 1) : u.set(1, 0, 0)).cross(F.n).normalize(); w.crossVectors(F.n, u);
    const to2 = l => l.verts.map(v => { p.fromArray(V, v * 3); return new THREE.Vector2(p.dot(u), p.dot(w)); });
    const all = [outer[0], ...holes].flatMap(l => l.verts);
    let tris;
    try { tris = THREE.ShapeUtils.triangulateShape(to2(outer[0]), holes.map(to2)); } catch (e) { tris = null; }
    if (!tris || !tris.length) { for (const t of F.tris) for (let j = 0; j < 3; j++) { const v = topo.T[t * 3 + j]; out.push(V[v * 3], V[v * 3 + 1], V[v * 3 + 2]); } continue; }
    for (const [a, b, c] of tris) {
      const A = new THREE.Vector3().fromArray(V, all[a] * 3), B = new THREE.Vector3().fromArray(V, all[b] * 3), C = new THREE.Vector3().fromArray(V, all[c] * 3);
      const nn = B.clone().sub(A).cross(C.clone().sub(A));
      const [x, y, z] = nn.dot(F.n) >= 0 ? [A, B, C] : [A, C, B];
      out.push(x.x, x.y, x.z, y.x, y.y, y.z, z.x, z.y, z.z);
    }
  }
  return new Float32Array(out);
}

// volume racchiuso da triangoli non indicizzati (per i controlli)
export function soupVolume(P) {
  let v = 0;
  for (let i = 0; i < P.length; i += 9) {
    const ax = P[i], ay = P[i + 1], az = P[i + 2], bx = P[i + 3], by = P[i + 4], bz = P[i + 5], cx = P[i + 6], cy = P[i + 7], cz = P[i + 8];
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return v;
}

/* ------------------------------------------------------------ fase 2: operazioni sulle facce */

function vertFaces(topo) {
  if (topo._vf) return topo._vf;
  const nV = topo.V.length / 3, vf = Array.from({ length: nV }, () => new Set());
  for (let t = 0; t < topo.T.length / 3; t++) for (let j = 0; j < 3; j++) vf[topo.T[t * 3 + j]].add(topo.faceOf[t]);
  return (topo._vf = vf);
}
const vec = (V, i) => new THREE.Vector3(V[i * 3], V[i * 3 + 1], V[i * 3 + 2]);
function planeBasis(n) {
  const u = new THREE.Vector3(); (Math.abs(n.z) < 0.9 ? u.set(0, 0, 1) : u.set(1, 0, 0)).cross(n).normalize();
  return [u, new THREE.Vector3().crossVectors(n, u)];
}
// i contorni di una faccia, nelle nuove posizioni, sono ancora sensati? (area con lo stesso segno, niente lati che si incrociano)
function loopsOk(F, V0, V1) {
  const [u, w] = planeBasis(F.n);
  const to2 = (V, v) => { const p = vec(V, v); return [p.dot(u), p.dot(w)]; };
  const segs = [];
  for (const l of F.loops) {
    const area = V => { let a = 0; for (let i = 0; i < l.verts.length; i++) { const p = to2(V, l.verts[i]), q = to2(V, l.verts[(i + 1) % l.verts.length]); a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
    const a0 = area(V0), a1 = area(V1);
    if (Math.sign(a0) !== Math.sign(a1) || Math.abs(a1) < 1e-4) return false;
    for (let i = 0; i < l.verts.length; i++) segs.push([to2(V1, l.verts[i]), to2(V1, l.verts[(i + 1) % l.verts.length])]);
  }
  if (segs.length > 400) return true;                      // contorni lunghi (curve): basta il controllo dell'area
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const [p, q] = segs[i], [r, s] = segs[j];
    const share = [p, q].some(x => [r, s].some(y => Math.abs(x[0] - y[0]) < 1e-6 && Math.abs(x[1] - y[1]) < 1e-6));
    if (share) continue;
    const d1 = cross(p, q, r), d2 = cross(p, q, s), d3 = cross(r, s, p), d4 = cross(r, s, q);
    if (((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9))) return false;
  }
  return true;
}

// Sposta una faccia piana di "dist" lungo la sua normale. Ogni vertice del contorno scorre sui piani delle facce vicine,
// così tutte le facce restano piane e i vicini cambiano solo forma. Restituisce i triangoli nuovi, o null se il caso
// non è sicuro (vertice con troppi vicini, una faccia che si ribalta, qualcos'altro del pezzo sul percorso): allora si usa il metodo di prima.
export function moveFace(topo, fid, dist) {
  const F = topo.faces[fid], V = topo.V, vf = vertFaces(topo);
  if (!F || F.loops.some(l => !l.closed)) return null;
  const nf = F.n, dF = F.d, S = new Set(F.loops.flatMap(l => l.verts));
  const V1 = Float64Array.from(V), touched = new Set([fid]);
  for (const v of S) {
    const planes = [];
    for (const g of vf[v]) {
      if (g === fid) continue;
      touched.add(g);
      const G = topo.faces[g];
      if (!planes.some(p => p.n.dot(G.n) > 1 - 1e-9 && Math.abs(p.d - G.d) < 1e-6)) planes.push({ n: G.n, d: G.d });
    }
    const p = vec(V, v); let q = null;
    if (planes.length === 2) {
      const m = new THREE.Matrix3().set(nf.x, nf.y, nf.z, planes[0].n.x, planes[0].n.y, planes[0].n.z, planes[1].n.x, planes[1].n.y, planes[1].n.z);
      if (Math.abs(m.determinant()) < 0.02) return null;
      q = new THREE.Vector3(dF + dist, planes[0].d, planes[1].d).applyMatrix3(m.invert());
    } else if (planes.length === 1) {
      const uu = new THREE.Vector3().crossVectors(nf, planes[0].n);
      if (uu.length() < 0.02) return null;
      const w = new THREE.Vector3().crossVectors(planes[0].n, uu).normalize(), den = w.dot(nf);
      if (Math.abs(den) < 0.05) return null;
      q = p.clone().addScaledVector(w, dist / den);
    } else if (planes.length === 0) q = p.clone().addScaledVector(nf, dist);
    else return null;                                         // vertice condiviso da troppe facce: servirebbe dividerlo
    if (q.distanceTo(p) > 20 * Math.abs(dist) + 1e-6) return null;
    V1[v * 3] = q.x; V1[v * 3 + 1] = q.y; V1[v * 3 + 2] = q.z;
  }
  for (const g of touched) if (!loopsOk(topo.faces[g], V, V1)) return null;
  // nient'altro del pezzo sul percorso della faccia (escluse le facce vicine, controllate sopra)
  const near = new Set(); for (const g of touched) for (const l of topo.faces[g].loops) for (const v of l.verts) near.add(v);
  const lo = Math.min(0, dist) - 1e-4, hi = Math.max(0, dist) + 1e-4;
  for (const v of new Set(topo.T)) {
    if (near.has(v)) continue;
    const s = nf.dot(vec(V, v)) - dF;
    if (s > lo && s < hi) return null;
  }
  return triangulateTopo({ ...topo, V: V1 });
}

// Estrude una faccia piana verso l'esterno: pareti nuove lungo tutto il contorno (anche attorno ai buchi) e la faccia in cima,
// che con taper ≠ 1 si restringe o si allarga attorno al centro del contorno. Solo se nient'altro del pezzo sta oltre il piano della
// faccia (altrimenti il prisma potrebbe attraversarlo: in quel caso si usa l'unione booleana di prima).
export function extrudeFace(topo, fid, dist, taper = 1) {
  const F = topo.faces[fid], V = topo.V;
  if (!F || !(dist > 0) || !(taper > 0) || F.loops.some(l => !l.closed) || F.loops.filter(l => l.outer).length !== 1) return null;
  const nf = F.n, dF = F.d, S = new Set(F.loops.flatMap(l => l.verts));
  for (const v of new Set(topo.T)) if (!S.has(v) && nf.dot(vec(V, v)) - dF > 1e-4) return null;
  const c = new THREE.Vector3(); S.forEach(v => c.add(vec(V, v))); c.divideScalar(S.size);
  const up = v => { const p = vec(V, v); return c.clone().addScaledVector(p.sub(c), taper).addScaledVector(nf, dist); };
  // tutte le facce tranne quella estrusa
  const rest = triangulateTopo({ ...topo, faces: topo.faces.filter(f => f.id !== fid) });
  const cap = triangulateTopo({ ...topo, faces: [F] });
  const out = Array.from(rest);
  for (const l of F.loops) for (let i = 0; i < l.verts.length; i++) {
    const a = l.verts[i], b = l.verts[(i + 1) % l.verts.length], A = vec(V, a), B = vec(V, b), A2 = up(a), B2 = up(b);
    out.push(A.x, A.y, A.z, B.x, B.y, B.z, B2.x, B2.y, B2.z, A.x, A.y, A.z, B2.x, B2.y, B2.z, A2.x, A2.y, A2.z);
  }
  const p = new THREE.Vector3();
  for (let i = 0; i < cap.length; i += 3) {
    p.set(cap[i], cap[i + 1], cap[i + 2]);
    const q = c.clone().addScaledVector(p.sub(c), taper).addScaledVector(nf, dist);
    out.push(q.x, q.y, q.z);
  }
  return new Float32Array(out);
}

// la faccia della topologia che corrisponde a un lato scelto in Filo (stesso piano, stessi triangoli, stessa area)
export function topoFaceFor(topo, n, world) {
  const p = new THREE.Vector3(world[0], world[1], world[2]), d = n.dot(p);
  let area = 0; const cents = [];
  for (let i = 0; i < world.length; i += 9) {
    const A = new THREE.Vector3(world[i], world[i + 1], world[i + 2]), B = new THREE.Vector3(world[i + 3], world[i + 4], world[i + 5]), C = new THREE.Vector3(world[i + 6], world[i + 7], world[i + 8]);
    area += B.clone().sub(A).cross(C.clone().sub(A)).length() / 2;
    if (cents.length < 8) cents.push(A.add(B).add(C).divideScalar(3));
  }
  for (const F of topo.faces) {
    if (F.n.dot(n) < 1 - 1e-5 || Math.abs(F.d - d) > 1e-3) continue;
    if (Math.abs(F.area - area) > 0.01 * Math.max(area, 1)) continue;
    const cs = F.tris.map(t => vec(topo.V, topo.T[t * 3]).add(vec(topo.V, topo.T[t * 3 + 1])).add(vec(topo.V, topo.T[t * 3 + 2])).divideScalar(3));
    // il baricentro di ogni triangolo scelto deve cadere su un triangolo di F (controllo semplice: vicino a uno dei suoi vertici o baricentri)
    const inside = q => F.tris.some(t => {
      const A = vec(topo.V, topo.T[t * 3]), B = vec(topo.V, topo.T[t * 3 + 1]), C = vec(topo.V, topo.T[t * 3 + 2]);
      const tri = new THREE.Triangle(A, B, C), bc = new THREE.Vector3(); tri.getBarycoord(q, bc);
      return bc.x >= -1e-4 && bc.y >= -1e-4 && bc.z >= -1e-4;
    });
    if (cents.every(inside) && cs.length) return F.id;
  }
  return -1;
}

/* ------------------------------------------------------------ fase 3: raccordo e smusso di uno spigolo */

// triangoli di una faccia piana data come contorni di punti (il primo è l'esterno), girati come la normale n
function triPolys(n, outer, holes, out) {
  const [u, w] = planeBasis(n);
  const to2 = l => l.map(p => new THREE.Vector2(p.dot(u), p.dot(w)));
  let tris;
  try { tris = THREE.ShapeUtils.triangulateShape(to2(outer), holes.map(to2)); } catch (e) { return false; }
  if (!tris || !tris.length) return false;
  const all = [outer, ...holes].flat();
  for (const [a, b, c] of tris) {
    const A = all[a], B = all[b], C = all[c];
    const [x, y, z] = B.clone().sub(A).cross(C.clone().sub(A)).dot(n) >= 0 ? [A, B, C] : [A, C, B];
    out.push(x.x, x.y, x.z, y.x, y.y, y.z, z.x, z.y, z.z);
  }
  return true;
}
// contorni piani validi: area non nulla e nessun lato che ne incrocia un altro
function polysOk(n, loops) {
  const [u, w] = planeBasis(n);
  const segs = [];
  for (const l of loops) {
    const P = l.map(p => [p.dot(u), p.dot(w)]);
    let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; }
    if (Math.abs(a / 2) < 1e-4) return false;
    for (let i = 0; i < P.length; i++) segs.push([P[i], P[(i + 1) % P.length]]);
  }
  if (segs.length > 600) return true;
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const same = (x, y) => Math.abs(x[0] - y[0]) < 1e-6 && Math.abs(x[1] - y[1]) < 1e-6;
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const [p, q] = segs[i], [r, s] = segs[j];
    if (same(p, r) || same(p, s) || same(q, r) || same(q, s)) continue;
    const d1 = cr(p, q, r), d2 = cr(p, q, s), d3 = cr(r, s, p), d4 = cr(r, s, q);
    if (d1 * d2 < -1e-12 && d3 * d4 < -1e-12) return false;
  }
  return true;
}

// Raccordo ("fillet") o smusso ("chamfer") di uno spigolo dritto tra due facce piane, fatto sulla struttura:
// le due facce si accorciano, le facce di testa prendono il profilo e nasce la striscia del raccordo. Funziona anche sugli
// spigoli interni (aggiunge materiale). null se il caso non è semplice (estremi condivisi da più di tre facce, misura troppo grande...).
export function filletEdge(topo, eid, mode, size, ARC = 18) {
  const e = topo.edges[eid], V = topo.V, vf = vertFaces(topo);
  if (!e || !e.sharp || e.mixed || !(size > 0)) return null;
  const [f1, f2] = e.faces, F1 = topo.faces[f1], F2 = topo.faces[f2];
  // catena ordinata dei vertici dello spigolo
  const adj = new Map();
  for (const [a, b] of e.segs) { (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); }
  const ends = [...adj].filter(([, l]) => l.length === 1).map(([v]) => v);
  if (ends.length !== 2 || [...adj.values()].some(l => l.length > 2)) return null;
  const path = [ends[0]]; for (let prev = -1, cur = ends[0]; path.length <= adj.size;) { const nx = adj.get(cur).find(x => x !== prev); if (nx === undefined) break; path.push(nx); prev = cur; cur = nx; if (nx === ends[1]) break; }
  if (path[path.length - 1] !== ends[1]) return null;
  const a = path[0], b = path[path.length - 1], A = vec(V, a), B = vec(V, b), dir = B.clone().sub(A).normalize();
  for (const v of path.slice(1, -1)) {
    const p = vec(V, v), t = p.clone().sub(A).dot(dir);
    if (p.distanceTo(A.clone().addScaledVector(dir, t)) > 1e-4) return null;
    if (vf[v].size !== 2) return null;
  }
  const endFace = v => { const s = [...vf[v]].filter(g => g !== f1 && g !== f2); return vf[v].size === 3 && s.length === 1 ? topo.faces[s[0]] : null; };
  const Ea = endFace(a), Eb = endFace(b);
  if (!Ea || !Eb || Math.abs(Ea.n.dot(dir)) < 0.05 || Math.abs(Eb.n.dot(dir)) < 0.05) return null;
  const n1 = F1.n, n2 = F2.n, cv = e.convex;
  const u1 = new THREE.Vector3().crossVectors(n1, dir).normalize(); if (cv ? u1.dot(n2) > 0 : u1.dot(n2) < 0) u1.negate();
  const u2 = new THREE.Vector3().crossVectors(n2, dir).normalize(); if (cv ? u2.dot(n1) > 0 : u2.dot(n1) < 0) u2.negate();
  const th = Math.acos(Math.max(-1, Math.min(1, u1.dot(u2))));
  if (!(th > 0.3 && th < 3.0)) return null;
  // profilo nella sezione (spostamenti dallo spigolo): dal lato di F1 al lato di F2
  let prof, Cc = null;
  if (mode === 'chamfer') prof = [u1.clone().multiplyScalar(size), u2.clone().multiplyScalar(size)];
  else {
    const t = size / Math.tan(th / 2), T1 = u1.clone().multiplyScalar(t), T2 = u2.clone().multiplyScalar(t);
    Cc = u1.clone().add(u2).normalize().multiplyScalar(size / Math.sin(th / 2));
    const a0 = T1.clone().sub(Cc), b0 = T2.clone().sub(Cc), ang = Math.acos(Math.max(-1, Math.min(1, a0.dot(b0) / (a0.length() * b0.length())))), ax = a0.clone().cross(b0).normalize();
    prof = []; for (let k = 0; k <= ARC; k++) prof.push(a0.clone().applyAxisAngle(ax, ang * k / ARC).add(Cc));
  }
  const onPlane = (P0, E) => prof.map(o => { const q = P0.clone().add(o), s = (E.d - E.n.dot(q)) / E.n.dot(dir); return q.addScaledVector(dir, s); });
  const PA = onPlane(A, Ea), PB = onPlane(B, Eb);
  // contorni nuovi delle quattro facce toccate
  const pos = v => vec(V, v);
  const rebuild = (F, sub) => F.loops.map(l => l.verts.flatMap((v, i) => {
    if (!sub.has(v)) return [pos(v)];
    const r = sub.get(v); if (typeof r !== 'function') return r;
    return r(l.verts[(i + l.verts.length - 1) % l.verts.length]);
  }));
  const inner = new Map(path.slice(1, -1).map(v => [v, []]));
  const L1 = rebuild(F1, new Map([...inner, [a, [PA[0]]], [b, [PB[0]]]]));
  const L2 = rebuild(F2, new Map([...inner, [a, [PA[PA.length - 1]]], [b, [PB[PB.length - 1]]]]));
  const order = (P, prev) => Math.abs(n1.dot(pos(prev)) - F1.d) < 1e-4 ? P : P.slice().reverse();     // dal lato che arriva dal contorno
  const LA = rebuild(Ea, new Map([[a, prev => order(PA, prev)]]));
  const LB = rebuild(Eb, new Map([[b, prev => order(PB, prev)]]));
  for (const [F, L] of [[F1, L1], [F2, L2], [Ea, LA], [Eb, LB]]) if (!polysOk(F.n, L)) return null;
  // tutto il resto com'era, più le quattro facce rifatte e la striscia
  const keep = new Set([f1, f2, Ea.id, Eb.id]);
  const out = Array.from(triangulateTopo({ ...topo, faces: topo.faces.filter(f => !keep.has(f.id)) }));
  for (const [F, L] of [[F1, L1], [F2, L2], [Ea, LA], [Eb, LB]]) {
    const outer = L[F.loops.findIndex(l => l.outer)], holes = L.filter((_, i) => !F.loops[i].outer);
    if (!outer || !triPolys(F.n, outer, holes, out)) return null;
  }
  for (let k = 0; k < PA.length - 1; k++) {
    const q = [PA[k], PA[k + 1], PB[k + 1], PB[k]], M = q.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(0.25);
    let outw;
    if (Cc) { const cpt = A.clone().add(Cc).addScaledVector(dir, M.clone().sub(A).dot(dir)); outw = cv ? M.clone().sub(cpt) : cpt.sub(M); }
    else outw = u1.clone().add(u2).multiplyScalar(cv ? -1 : 1);
    for (const [x, y, z] of [[q[0], q[1], q[2]], [q[0], q[2], q[3]]]) {
      const nn = y.clone().sub(x).cross(z.clone().sub(x));
      if (nn.lengthSq() < 1e-16) continue;
      const [p0, p1, p2] = nn.dot(outw) >= 0 ? [x, y, z] : [x, z, y];
      out.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
    }
  }
  return new Float32Array(out);
}

// lo spigolo della topologia che corrisponde a una catena di Filo (stessi estremi)
export function topoEdgeFor(topo, pts) {
  if (!pts || pts.length < 2) return -1;
  const A = pts[0], B = pts[pts.length - 1];
  for (const e of topo.edges) {
    const deg = new Map(); for (const [a, b] of e.segs) { deg.set(a, (deg.get(a) || 0) + 1); deg.set(b, (deg.get(b) || 0) + 1); }
    const ends = [...deg].filter(([, d]) => d === 1).map(([v]) => vec(topo.V, v));
    if (ends.length !== 2) continue;
    if ((ends[0].distanceTo(A) < 1e-3 && ends[1].distanceTo(B) < 1e-3) || (ends[0].distanceTo(B) < 1e-3 && ends[1].distanceTo(A) < 1e-3)) return e.id;
  }
  return -1;
}
