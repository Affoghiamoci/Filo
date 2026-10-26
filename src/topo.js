// Vista topologica di un pezzo (motore 1.0, fase 1).
// Dai triangoli "sciolti" ricostruisce vertici saldati, mezzi-spigoli con il gemello, facce piane (anche con buchi),
// spigoli tra facce (convessi o concavi), gruppi lisci (superfici curve) e i difetti (bordi aperti, spigoli e vertici "pizzicati").
// Non modifica niente: è la base su cui le fasi successive faranno lavorare Lato e Spigolo direttamente sulla struttura.
import * as THREE from 'three';

const PLANE_COS = 1 - 1e-6;          // due triangoli stanno sulla stessa faccia se le normali coincidono...
const PLANE_TOL = 1e-3;              // ...e il piano è lo stesso (mm)
const SMOOTH_COS = Math.cos(30 * Math.PI / 180);   // facce con meno di 30° tra loro: stessa superficie liscia

// saldatura: punti più vicini di tol diventano lo stesso vertice (griglia con controllo delle celle vicine)
// chiave numerica di cella (le collisioni sono innocue: ogni candidato viene poi controllato per distanza)
const cellKey = (x, y, z) => (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) | 0;
function weld(P, tol) {
  const n = P.length / 3, ids = new Int32Array(n), grid = new Map(), out = [];
  const inv = 1 / tol, t2 = tol * tol;
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    const gx = Math.round(x * inv), gy = Math.round(y * inv), gz = Math.round(z * inv);
    let found = -1;
    for (let dx = -1; dx <= 1 && found < 0; dx++) for (let dy = -1; dy <= 1 && found < 0; dy++) for (let dz = -1; dz <= 1 && found < 0; dz++) {
      const cell = grid.get(cellKey(gx + dx, gy + dy, gz + dz));
      if (!cell) continue;
      for (const v of cell) { const ex = out[v * 3] - x, ey = out[v * 3 + 1] - y, ez = out[v * 3 + 2] - z; if (ex * ex + ey * ey + ez * ez <= t2) { found = v; break; } }
    }
    if (found < 0) {
      found = out.length / 3; out.push(x, y, z);
      const k = cellKey(gx, gy, gz); const c = grid.get(k); if (c) c.push(found); else grid.set(k, [found]);
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
// punti sul bordo di una cucitura: segmenti [x0,y0,z0,x1,y1,z1,...] tra facce complanari che devono restare separate (dopo un rientro)
export function seamTester(V, seams, tol = 2e-3) {
  const nS = seams ? seams.length / 6 : 0;
  if (!nS) return null;
  const on = (x, y, z, k) => {
    const ax = seams[k * 6], ay = seams[k * 6 + 1], az = seams[k * 6 + 2], bx = seams[k * 6 + 3] - ax, by = seams[k * 6 + 4] - ay, bz = seams[k * 6 + 5] - az;
    const l2 = bx * bx + by * by + bz * bz; if (l2 < 1e-12) return false;
    const t = ((x - ax) * bx + (y - ay) * by + (z - az) * bz) / l2; if (t < -1e-6 || t > 1 + 1e-6) return false;
    const dx = ax + t * bx - x, dy = ay + t * by - y, dz = az + t * bz - z;
    return dx * dx + dy * dy + dz * dz < tol * tol;
  };
  const nV = V.length / 3, flag = new Uint8Array(nV);
  for (let v = 0; v < nV; v++) for (let k = 0; k < nS; k++) if (on(V[v * 3], V[v * 3 + 1], V[v * 3 + 2], k)) { flag[v] = 1; break; }
  return (a, b) => {
    if (!flag[a] || !flag[b]) return false;
    const mx = (V[a * 3] + V[b * 3]) / 2, my = (V[a * 3 + 1] + V[b * 3 + 1]) / 2, mz = (V[a * 3 + 2] + V[b * 3 + 2]) / 2;
    for (let k = 0; k < nS; k++) if (on(mx, my, mz, k)) return true;
    return false;
  };
}
export function buildTopo(P, { tol = 1e-3, seams = null } = {}) {
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
  const fd = new DSU(nT), onSeam = seamTester(V, seams);
  for (let h = 0; h < nH; h++) {
    const o = twin[h]; if (o < h) continue;
    if (onSeam && onSeam(from(h), to(h))) continue;
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

// i triangoli originali di alcune facce, con le posizioni prese da V (le facce non toccate non si ritriangolano mai:
// su superfici importate fatte di faccette sottilissime la ritriangolazione può creare triangoli rovesciati, cioè righe scure)
function trisOf(topo, faces, V, out = []) {
  for (const F of faces) for (const t of F.tris) for (let j = 0; j < 3; j++) { const v = topo.T[t * 3 + j]; out.push(V[v * 3], V[v * 3 + 1], V[v * 3 + 2]); }
  return out;
}


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
  const out = [];
  out.moved = { S, V1 };
  for (const F of topo.faces) {
    let ok = true;
    if (touched.has(F.id)) for (const t of F.tris) {
      const A = vec(V1, topo.T[t * 3]), B = vec(V1, topo.T[t * 3 + 1]), C = vec(V1, topo.T[t * 3 + 2]);
      if (B.clone().sub(A).cross(C.clone().sub(A)).dot(F.n) <= 1e-9) { ok = false; break; }
    }
    if (ok) trisOf(topo, [F], V1, out);
    else out.push(...triangulateTopo({ ...topo, V: V1, faces: [F] }));
  }
  const res = new Float32Array(out); res.moved = out.moved; return res;
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
  const rest = trisOf(topo, topo.faces.filter(f => f.id !== fid), V);
  const cap = trisOf(topo, [F], V);
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

// Rientro ("inset"): il contorno della faccia si sposta verso l'interno di dist e nasce una cornice nello stesso piano.
// La faccia interna resta una faccia a sé (la "cucitura" è il suo contorno). Solo facce con un contorno esterno e anche buchi; null se il rientro
// è troppo grande per la forma (contorni che si toccano o si ribaltano) o ha angoli troppo acuti.
export function insetFace(topo, fid, dist) {
  const F = topo.faces[fid], V = topo.V;
  if (!F || !(dist > 0) || F.loops.some(l => !l.closed) || F.loops.filter(l => l.outer).length !== 1) return null;
  const n = F.n, [u, w] = planeBasis(n), dF = F.d;
  const off = (verts) => {
    const P = verts.map(v => { const p = vec(V, v); return [p.dot(u), p.dot(w)]; }), m = P.length, Q = [];
    for (let i = 0; i < m; i++) {
      const a = P[(i + m - 1) % m], b = P[i], c = P[(i + 1) % m];
      let e1x = b[0] - a[0], e1y = b[1] - a[1], e2x = c[0] - b[0], e2y = c[1] - b[1];
      const l1 = Math.hypot(e1x, e1y), l2 = Math.hypot(e2x, e2y); if (l1 < 1e-9 || l2 < 1e-9) return null;
      e1x /= l1; e1y /= l1; e2x /= l2; e2y /= l2;
      const n1x = -e1y, n1y = e1x, n2x = -e2y, n2y = e2x, k = 1 + n1x * n2x + n1y * n2y;
      if (k < 0.15) return null;
      const dx = (n1x + n2x) * dist / k, dy = (n1y + n2y) * dist / k;
      if (Math.hypot(dx, dy) > 6 * dist) return null;
      Q.push([b[0] + dx, b[1] + dy]);
    }
    for (let i = 0; i < m; i++) { const a = P[i], b = P[(i + 1) % m], a2 = Q[i], b2 = Q[(i + 1) % m]; if ((b2[0] - a2[0]) * (b[0] - a[0]) + (b2[1] - a2[1]) * (b[1] - a[1]) <= 1e-12) return null; }
    return Q.map(q => u.clone().multiplyScalar(q[0]).addScaledVector(w, q[1]).addScaledVector(n, dF));
  };
  const outer = F.loops.find(l => l.outer), holes = F.loops.filter(l => !l.outer);
  const io = off(outer.verts); if (!io) return null;
  const ih = holes.map(h => off(h.verts)); if (ih.some(x => !x)) return null;
  const orig = l => l.verts.map(v => vec(V, v));
  if (!polysOk(n, [io, ...ih])) return null;
  // il contorno interno deve stare dentro quello esterno, e i buchi ingranditi non devono toccarlo
  const area2 = L => { let a = 0; for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length]; a += p.dot(u) * q.dot(w) - q.dot(u) * p.dot(w); } return a / 2; };
  if (area2(io) <= 1e-6 || area2(io) >= outer.area) return null;
  const out = Array.from(trisOf(topo, topo.faces.filter(f => f.id !== fid), V));
  const n0 = out.length;
  if (!triPolys(n, io, ih, out)) return null;
  const inner = Float32Array.from(out.slice(n0));                 // i triangoli del lato interno (servono all'anteprima della cornice)
  const pick = [(out[n0] + out[n0 + 3] + out[n0 + 6]) / 3, (out[n0 + 1] + out[n0 + 4] + out[n0 + 7]) / 3, (out[n0 + 2] + out[n0 + 5] + out[n0 + 8]) / 3];
  if (!triPolys(n, orig(outer), [io], out)) return null;
  holes.forEach((h, i) => { if (!triPolys(n, ih[i], [orig(h)], out)) throw new Error('inset'); });
  const seams = [];
  for (const L of [io, ...ih]) for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length]; seams.push(a.x, a.y, a.z, b.x, b.y, b.z); }
  const res = new Float32Array(out); res.seams = Float64Array.from(seams); res.pick = pick; res.inner = inner;
  return res;
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

// Raccordo ("fillet") o smusso ("chamfer") di uno o più spigoli dritti tra facce piane, fatto sulla struttura:
// le facce si accorciano, le facce di testa prendono il profilo e nascono le strisce del raccordo (spigoli esterni e interni).
// Dove tre spigoli raccordati dello stesso raggio arrivano nello stesso angolo nasce un pezzo di sfera ("angolo a pallina").
// null se il caso non è semplice (due spigoli scelti su tre in un angolo, vertici con più di tre facce, misura troppo grande...).
export function filletEdges(topo, eids, mode, size, ARC = 18) {
  const V = topo.V, vf = vertFaces(topo), pos = v => vec(V, v);
  if (!(size > 0) || !eids.length || new Set(eids).size !== eids.length) return null;
  const E = [];
  for (const eid of eids) {
    const e = topo.edges[eid];
    if (!e || !e.sharp || e.mixed) return null;
    const adj = new Map();
    for (const [a, b] of e.segs) { (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); }
    const ends = [...adj].filter(([, l]) => l.length === 1).map(([v]) => v);
    if (ends.length !== 2 || [...adj.values()].some(l => l.length > 2)) return null;
    const path = [ends[0]]; for (let prev = -1, cur = ends[0]; path.length <= adj.size;) { const nx = adj.get(cur).find(x => x !== prev); if (nx === undefined) break; path.push(nx); prev = cur; cur = nx; if (nx === ends[1]) break; }
    if (path[path.length - 1] !== ends[1]) return null;
    const a = path[0], b = path[path.length - 1], A = pos(a), B = pos(b), dir = B.clone().sub(A).normalize();
    for (const v of path.slice(1, -1)) {
      const q = pos(v), t = q.clone().sub(A).dot(dir);
      if (q.distanceTo(A.clone().addScaledVector(dir, t)) > 1e-4 || vf[v].size !== 2) return null;
    }
    const [f1, f2] = e.faces, n1 = topo.faces[f1].n, n2 = topo.faces[f2].n, cv = e.convex;
    const u1 = new THREE.Vector3().crossVectors(n1, dir).normalize(); if (cv ? u1.dot(n2) > 0 : u1.dot(n2) < 0) u1.negate();
    const u2 = new THREE.Vector3().crossVectors(n2, dir).normalize(); if (cv ? u2.dot(n1) > 0 : u2.dot(n1) < 0) u2.negate();
    const th = Math.acos(Math.max(-1, Math.min(1, u1.dot(u2))));
    if (!(th > 0.3 && th < 3.0)) return null;
    // profilo come funzione di t (0 = lato di F1, 1 = lato di F2): così si possono aggiungere punti dove serve
    let prm, ts, Cc = null;
    if (mode === 'chamfer') { const T1 = u1.clone().multiplyScalar(size), T2 = u2.clone().multiplyScalar(size); prm = t => T1.clone().lerp(T2, t); ts = [0, 1]; }
    else {
      const t0 = size / Math.tan(th / 2), T1 = u1.clone().multiplyScalar(t0), T2 = u2.clone().multiplyScalar(t0);
      Cc = u1.clone().add(u2).normalize().multiplyScalar(size / Math.sin(th / 2));
      const a0 = T1.clone().sub(Cc), b0 = T2.clone().sub(Cc), ang = Math.acos(Math.max(-1, Math.min(1, a0.dot(b0) / (a0.length() * b0.length())))), ax = a0.clone().cross(b0).normalize();
      prm = t => a0.clone().applyAxisAngle(ax, ang * t).add(Cc);
      ts = []; for (let k = 0; k <= ARC; k++) ts.push(k / ARC);
    }
    // il raccordo (o lo smusso) tocca ciascuna delle due facce a una certa distanza dallo spigolo: se una faccia è più stretta,
    // il raccordo uscirebbe dal pezzo (una "pinna" sottile). Si misura quanto è larga ogni faccia vista dallo spigolo e si dice il massimo.
    const reach = mode === 'chamfer' ? size : size / Math.tan(th / 2), k = mode === 'chamfer' ? 1 : Math.tan(th / 2);
    const len = A.distanceTo(B);
    const width = (f, u) => {                      // da alcuni punti dello spigolo si va dentro la faccia (lungo u) fino al suo bordo
      let w = Infinity;
      for (const fr of [0.15, 0.5, 0.85]) {
        const S = A.clone().addScaledVector(dir, len * fr);
        let best = Infinity;
        for (const L of topo.faces[f].loops) for (let i = 0; i < L.verts.length; i++) {
          const P = pos(L.verts[i]).sub(S), Q = pos(L.verts[(i + 1) % L.verts.length]).sub(S);
          const px = P.dot(u), py = P.dot(dir), qx = Q.dot(u), qy = Q.dot(dir);
          if ((py > 1e-7) === (qy > 1e-7) || Math.abs(qy - py) < 1e-9) continue;
          const x = px + (qx - px) * (-py) / (qy - py);
          if (x > 1e-4 && x < best) best = x;
        }
        w = Math.min(w, best);
      }
      return w;
    };
    const wmin = Math.min(width(f1, u1), width(f2, u2));
    if (reach > wmin + 1e-3) return { err: 'big', max: Math.max(0, wmin * k - 0.01) };
    E.push({ e, path, a, b, A, B, dir, f1, f2, n1, n2, u1, u2, cv, prm, ts, Cc });
  }
  // estremi: liberi (un solo spigolo scelto, anche dove si incontrano più facce, es. le falde di un tetto) o angoli a pallina (tre spigoli scelti)
  const at = new Map();
  for (const x of E) for (const v of [x.a, x.b]) (at.get(v) || at.set(v, []).get(v)).push(x);
  const corner = new Map();                        // vertice -> centro della sfera
  for (const [v, xs] of at) {
    if (vf[v].size < 3) return null;
    if (xs.length === 1) continue;
    if (vf[v].size !== 3 || xs.length !== 3 || mode !== 'fillet' || xs.some(x => !x.cv)) return null;
    const Fs = [...vf[v]].map(g => topo.faces[g]);
    const m = new THREE.Matrix3().set(...Fs.flatMap(F => [F.n.x, F.n.y, F.n.z]));
    if (Math.abs(m.determinant()) < 0.05) return null;
    corner.set(v, { c: new THREE.Vector3(Fs[0].d - size, Fs[1].d - size, Fs[2].d - size).applyMatrix3(m.invert()), Fs });
  }
  // profilo di ogni estremo: tagliato dalle facce di testa (la prima che il raccordo incontra uscendo) o dal piano che passa per il centro della sfera
  const subs = new Map();                          // faccia -> (vertice -> punti che lo sostituiscono)
  const sub = (f, v, val) => { let m = subs.get(f); if (!m) subs.set(f, m = new Map()); if (m.has(v)) return false; m.set(v, val); return true; };
  for (const x of E) {
    const ends = [];
    for (const [v, P0, o] of [[x.a, x.A, x.dir.clone().negate()], [x.b, x.B, x.dir.clone()]]) {
      const cn = corner.get(v);
      const planes = cn ? [{ id: -1, n: o, d: o.dot(cn.c) }] : [...vf[v]].filter(g => g !== x.f1 && g !== x.f2).map(g => ({ id: g, n: topo.faces[g].n, d: topo.faces[g].d }));
      if (!planes.length || planes.some(pl => pl.n.dot(o) < 0.05)) return null;
      const hit = t => { const q = P0.clone().add(x.prm(t)); let bi = 0, bs = Infinity; planes.forEach((pl, i) => { const s2 = (pl.d - pl.n.dot(q)) / pl.n.dot(o); if (s2 < bs) { bs = s2; bi = i; } }); return { i: bi, s: bs, q }; };
      ends.push({ v, P0, o, planes, hit, cn });
    }
    // dove il profilo passa da una faccia di testa all'altra si aggiunge un punto esatto (sullo spigolo tra le due facce)
    const extra = [];
    for (const en of ends) if (en.planes.length > 1) for (let k = 0; k < x.ts.length - 1; k++) {
      let lo = x.ts[k], hi = x.ts[k + 1]; const i0 = en.hit(lo).i, i1 = en.hit(hi).i;
      if (i0 === i1) continue;
      const P = en.planes, f = t => { const q = en.P0.clone().add(x.prm(t)); return (P[i0].d - P[i0].n.dot(q)) / P[i0].n.dot(en.o) - (P[i1].d - P[i1].n.dot(q)) / P[i1].n.dot(en.o); };
      const flo = f(lo);
      for (let it = 0; it < 60; it++) { const mid = (lo + hi) / 2, fm = f(mid); if ((fm < 0) === (flo < 0)) lo = mid; else hi = mid; }
      extra.push((lo + hi) / 2);
    }
    x.ts = [...x.ts, ...extra].sort((p, q) => p - q).filter((t, i, arr) => i === 0 || t - arr[i - 1] > 1e-9);
    for (const en of ends) {
      en.pts = []; en.memb = [];
      for (const t of x.ts) {
        const h = en.hit(t), q = h.q.clone().addScaledVector(en.o, h.s);
        en.pts.push(q);
        en.memb.push(new Set(en.planes.filter(pl => Math.abs(pl.n.dot(q) - pl.d) < 1e-5).map(pl => pl.id)));
      }
    }
    x.PA = ends[0].pts; x.PB = ends[1].pts;
    for (const v of x.path.slice(1, -1)) { if (!sub(x.f1, v, []) || !sub(x.f2, v, [])) return null; }
    for (const en of ends) {
      if (en.cn) continue;
      const P = en.pts, v = en.v;
      if (!sub(x.f1, v, [P[0]]) || !sub(x.f2, v, [P[P.length - 1]])) return null;
      for (const pl of en.planes) {
        const idx = en.memb.map((m, i) => m.has(pl.id) ? i : -1).filter(i => i >= 0);
        if (!idx.length || idx[idx.length - 1] - idx[0] !== idx.length - 1) return null;      // ogni faccia di testa prende un tratto unico del profilo
        const run = P.slice(idx[0], idx[idx.length - 1] + 1);
        if (!sub(pl.id, v, (prev, next) => {
          const pp = pos(prev), nq = pos(next), r = run[0], s2 = run[run.length - 1];
          return pp.distanceTo(r) + nq.distanceTo(s2) <= pp.distanceTo(s2) + nq.distanceTo(r) ? run : run.slice().reverse();
        })) return null;
      }
    }
  }
  for (const [v, cn] of corner) for (const F of cn.Fs) if (!sub(F.id, v, [cn.c.clone().addScaledVector(F.n, size)])) return null;
  // contorni nuovi delle facce toccate, controllati
  const rebuilt = [];
  for (const [fid, m] of subs) {
    const F = topo.faces[fid];
    const L = F.loops.map(l => l.verts.flatMap((v, i) => {
      if (!m.has(v)) return [pos(v)];
      const r = m.get(v); return typeof r === 'function' ? r(l.verts[(i + l.verts.length - 1) % l.verts.length], l.verts[(i + 1) % l.verts.length]) : r;
    }));
    if (!polysOk(F.n, L)) return null;
    rebuilt.push([F, L]);
  }
  const out = trisOf(topo, topo.faces.filter(f => !subs.has(f.id)), V);
  for (const [F, L] of rebuilt) {
    const outer = L[F.loops.findIndex(l => l.outer)], holes = L.filter((_, i) => !F.loops[i].outer);
    if (!outer || !triPolys(F.n, outer, holes, out)) return null;
  }
  const tri = (x, y, z, outw) => {
    const nn = y.clone().sub(x).cross(z.clone().sub(x));
    if (nn.lengthSq() < 1e-16) return;
    const [p0, p1, p2] = nn.dot(outw) >= 0 ? [x, y, z] : [x, z, y];
    out.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
  };
  // strisce dei raccordi (o facce degli smussi)
  for (const x of E) for (let k = 0; k < x.PA.length - 1; k++) {
    const q = [x.PA[k], x.PA[k + 1], x.PB[k + 1], x.PB[k]], M = q.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(0.25);
    let outw;
    if (x.Cc) { const cpt = x.A.clone().add(x.Cc).addScaledVector(x.dir, M.clone().sub(x.A).dot(x.dir)); outw = x.cv ? M.clone().sub(cpt) : cpt.sub(M); }
    else outw = x.u1.clone().add(x.u2).multiplyScalar(x.cv ? -1 : 1);
    tri(q[0], q[1], q[2], outw); tri(q[0], q[2], q[3], outw);
  }
  // angoli a pallina: triangolo sferico tra i tre punti di contatto, con i bordi uguali ai profili delle strisce
  for (const [, cn] of corner) {
    const c = cn.c, T = cn.Fs.map(F => F.n.clone());          // direzioni dal centro ai punti di contatto
    const slerp = (p, q, t) => { const ang = Math.acos(Math.max(-1, Math.min(1, p.dot(q)))); if (ang < 1e-9) return p.clone(); const ax = p.clone().cross(q).normalize(); return p.clone().applyAxisAngle(ax, ang * t); };
    const N = ARC, rows = [];
    for (let j = 0; j <= N; j++) {
      const L = slerp(T[0], T[2], j / N), R = slerp(T[1], T[2], j / N), row = [], m = N - j;
      for (let i = 0; i <= m; i++) row.push(c.clone().addScaledVector(m ? slerp(L, R, i / m) : L, size));
      rows.push(row);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < rows[j].length - 1; i++) {
      const p = rows[j][i], q = rows[j][i + 1], r0 = rows[j + 1][i];
      tri(p, q, r0, p.clone().add(q).add(r0).divideScalar(3).sub(c));
      if (i + 1 < rows[j + 1].length) { const s2 = rows[j + 1][i + 1]; tri(q, s2, r0, q.clone().add(s2).add(r0).divideScalar(3).sub(c)); }
    }
  }
  return new Float32Array(out);
}

// Raccordo o smusso di uno spigolo DRITTO tra una faccia piana e una superficie curva fatta di tante faccette (cilindro, tubo...).
// Il pezzo, lungo lo spigolo, ha sempre la stessa sezione: si calcola il raccordo sulla sezione 2D (palla che rotola tra le due linee)
// e se ne fa un prisma lungo come lo spigolo, che il chiamante unisce (spigolo interno) o toglie (spigolo esterno).
// Ritorna { prisms: [Float32Array], concave }, { err: 'big', max } o null se il caso non è di questo tipo.
export function sweepFillets(topo, eids, mode, size, ARC = 24) {
  if (!(size > 0) || !eids.length || (mode !== 'fillet' && mode !== 'chamfer')) return null;
  const V = topo.V, nV = V.length / 3, pos = v => vec(V, v);
  if (!topo._segEdge) { const m = new Map(); for (const e of topo.edges) for (const [a, b] of e.segs) m.set(a < b ? a * nV + b : b * nV + a, e); topo._segEdge = m; }
  const edgeOf = (a, b) => topo._segEdge.get(a < b ? a * nV + b : b * nV + a);
  const prisms = []; let concave = null, bigMax = null;
  for (const eid of eids) {
    const r = oneSweep(eid);
    if (!r) return null;
    if (r.err) { bigMax = bigMax === null ? r.max : Math.min(bigMax, r.max); continue; }
    if (concave === null) concave = r.concave; else if (concave !== r.concave) return null;
    prisms.push(r.prism);
  }
  if (bigMax !== null) return { err: 'big', max: bigMax };
  return { prisms, concave };

  function oneSweep(eid) {
    const e = topo.edges[eid];
    if (!e || !e.sharp || e.mixed) return null;
    const adj = new Map();
    for (const [a, b] of e.segs) { (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); }
    const ends = [...adj].filter(([, l]) => l.length === 1).map(([v]) => v);
    if (ends.length !== 2 || [...adj.values()].some(l => l.length > 2)) return null;
    const A = pos(ends[0]), B = pos(ends[1]), len = A.distanceTo(B); if (len < 1e-4) return null;
    const dir = B.clone().sub(A).normalize();
    for (const v of adj.keys()) if (pos(v).sub(A).cross(dir).length() > 1e-4) return null;     // solo spigoli dritti
    const [f1, f2] = e.faces, cv = e.convex;
    const n1 = topo.faces[f1].n, n2 = topo.faces[f2].n;
    const u1 = new THREE.Vector3().crossVectors(n1, dir).normalize(); if (cv ? u1.dot(n2) > 0 : u1.dot(n2) < 0) u1.negate();
    const u2 = new THREE.Vector3().crossVectors(n2, dir).normalize(); if (cv ? u2.dot(n1) > 0 : u2.dot(n1) < 0) u2.negate();
    const th = Math.acos(Math.max(-1, Math.min(1, u1.dot(u2))));
    if (!(th > 0.3 && th < 3.0)) return null;
    const pv = u1.clone(), qv = new THREE.Vector3().crossVectors(dir, pv); if (qv.dot(u2) < 0) qv.negate();
    const to2 = P => { const d = P.clone().sub(A); return [d.dot(pv), d.dot(qv)]; };
    const to3 = (x, y) => A.clone().addScaledVector(pv, x).addScaledVector(qv, y);
    // linea della sezione: dallo spigolo, faccia dopo faccia, finché non c'è uno spigolo vivo
    const chain = f0 => {
      const pts = [[0, 0]], faces = [f0]; let cur = f0, prev = [0, 0];
      for (let step = 0; step < 400; step++) {
        const F = topo.faces[cur], L = F.loops.find(l => l.outer) || F.loops[0], vs = L.verts, n = vs.length, ex = [];
        for (let i = 0; i < n; i++) {
          const a = vs[i], b = vs[(i + 1) % n], P = pos(a), d = pos(b).sub(P), l = d.length();
          if (l < 1e-7 || d.clone().cross(dir).length() / l > 1e-4) continue;
          const x = to2(P); if (Math.hypot(x[0] - prev[0], x[1] - prev[1]) > 1e-5) ex.push([a, b, x]);
        }
        if (!ex.length) return null;
        const X = ex[0][2]; if (ex.some(q => Math.hypot(q[2][0] - X[0], q[2][1] - X[1]) > 1e-5)) return null;
        pts.push(X);
        const eo = edgeOf(ex[0][0], ex[0][1]); if (!eo) return null;
        if (eo.sharp) return pts;
        cur = eo.faces[0] === cur ? eo.faces[1] : eo.faces[0];
        if (faces.includes(cur) || cur === f1 || cur === f2) return null;
        faces.push(cur); prev = X;
      }
      return null;
    };
    const P1 = chain(f1), P2 = chain(f2);
    if (!P1 || !P2) return null;
    const unit = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [dx / l, dy / l, l]; };
    const t1v = unit(P1[0], P1[1]), t2v = unit(P2[0], P2[1]);
    if (Math.abs(t1v[0] - 1) > 1e-3 || Math.abs(t1v[1]) > 1e-3 || Math.abs(t2v[0] - Math.cos(th)) > 1e-3 || Math.abs(t2v[1] - Math.sin(th)) > 1e-3) return null;
    const cum = P => { const c = [0]; for (let i = 1; i < P.length; i++) c.push(c[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return c; };
    const C1 = cum(P1), C2 = cum(P2), L1 = C1[C1.length - 1], L2 = C2[C2.length - 1];
    const at = (P, C, s) => { let k = 0; while (k < P.length - 2 && C[k + 1] < s) k++; const l = C[k + 1] - C[k], t = l > 0 ? (s - C[k]) / l : 0; return { k, p: [P[k][0] + (P[k + 1][0] - P[k][0]) * t, P[k][1] + (P[k + 1][1] - P[k][1]) * t] }; };
    const pd = (c, P) => {
      let best = { d: Infinity };
      for (let k = 0; k < P.length - 1; k++) {
        const a = P[k], b = P[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
        const t = Math.max(0, Math.min(1, ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / l2)), x = a[0] + dx * t, y = a[1] + dy * t, d = Math.hypot(c[0] - x, c[1] - y);
        if (d < best.d) best = { d, k, t, p: [x, y] };
      }
      return best;
    };
    // quanto si può arrivare: misura di ogni lato → punti di contatto (T1 sulla faccia piana, T2 sulla linea curva) o null
    const contacts = r => {
      if (mode === 'chamfer') {
        if (r > L1 - 0.02 || r > L2 - 0.02) return null;
        return { t1: at(P1, C1, r).p, t2: at(P2, C2, r), s1: r, c: null };
      }
      // palla di raggio r che rotola lungo la faccia piana, da lontano verso lo spigolo, fino a toccare l'altra linea
      const n1v = [0, 1], cen = s => [s, r], N = 500;
      let prevS = L1, prevG = pd(cen(L1), P2).d - r;
      if (prevG <= 0) return null;
      for (let i = 1; i <= N; i++) {
        const s = L1 * (1 - i / N), g = pd(cen(s), P2).d - r;
        if (g <= 0) {
          let hi = prevS, lo = s;
          for (let it = 0; it < 50; it++) { const m = (hi + lo) / 2; if (pd(cen(m), P2).d - r > 0) hi = m; else lo = m; }
          const sc = (hi + lo) / 2, c = cen(sc), q = pd(c, P2);
          if (sc > L1 - 0.02 || (q.k === P2.length - 2 && q.t > 0.995) || sc < 1e-6) return null;
          const tp = { k: q.k, p: q.p };
          return { t1: [sc, 0], t2: tp, s1: sc, c, r };
        }
        prevS = s; prevG = g;
      }
      return null;
    };
    // la faccia piana è la prima: P1 è dritta (1 segmento) solo se la linea dal primo lato è una sola faccia; altrimenti la palla rotola solo sul primo tratto
    if (mode === 'fillet' && P1.length > 2 && Math.abs(P1[2][1]) > 1e-6) return null;
    let k = contacts(size);
    if (!k) {
      let lo = 0, hi = Math.min(L1, L2, 60);
      if (!contacts(0.02)) return { err: 'big', max: 0 };
      for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (contacts(Math.max(m, 0.02))) lo = m; else hi = m; }
      return { err: 'big', max: Math.max(0, lo * 0.98) };
    }
    // contorno 2D della parte da aggiungere o togliere: spigolo → faccia piana → arco → linea curva → spigolo
    const R = [[0, 0]];
    for (let i = 1; i < P1.length; i++) if (C1[i] < k.s1 - 1e-6) R.push(P1[i]);
    R.push(k.t1);
    if (mode === 'fillet') {
      const c = k.c, r = k.r, a1 = Math.atan2(k.t1[1] - c[1], k.t1[0] - c[0]), a2 = Math.atan2(k.t2.p[1] - c[1], k.t2.p[0] - c[0]);
      let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d <= -Math.PI) d += 2 * Math.PI;
      const mid = a1 + d / 2, ox = -c[0], oy = -c[1];
      if (Math.cos(mid) * ox + Math.sin(mid) * oy < 0) d = d > 0 ? d - 2 * Math.PI : d + 2 * Math.PI;
      for (let i = 1; i < ARC; i++) R.push([c[0] + r * Math.cos(a1 + d * i / ARC), c[1] + r * Math.sin(a1 + d * i / ARC)]);
    }
    R.push(k.t2.p);
    for (let i = k.t2.k; i >= 1; i--) R.push(P2[i]);
    const Q = R.filter((p, i) => i === 0 || Math.hypot(p[0] - R[i - 1][0], p[1] - R[i - 1][1]) > 1e-6);
    while (Q.length > 2 && Math.hypot(Q[0][0] - Q[Q.length - 1][0], Q[0][1] - Q[Q.length - 1][1]) < 1e-6) Q.pop();
    let area = 0; for (let i = 0; i < Q.length; i++) { const a = Q[i], b = Q[(i + 1) % Q.length]; area += a[0] * b[1] - b[0] * a[1]; }
    if (Math.abs(area) < 1e-6) return null;
    if (area < 0) Q.reverse();
    const A3 = Q.map(p => to3(p[0], p[1])), B3 = A3.map(p => p.clone().addScaledVector(dir, len));
    if (!polysOk(dir, [A3])) return null;
    const out = [];
    const tri = (x, y, z, outw) => {
      const nn = y.clone().sub(x).cross(z.clone().sub(x));
      if (nn.lengthSq() < 1e-16) return;
      const [p0, p1, p2] = nn.dot(outw) >= 0 ? [x, y, z] : [x, z, y];
      out.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
    };
    if (!triPolys(dir.clone().negate(), A3, [], out) || !triPolys(dir, B3, [], out)) return null;
    for (let i = 0; i < Q.length; i++) {
      const j = (i + 1) % Q.length, dx = Q[j][0] - Q[i][0], dy = Q[j][1] - Q[i][1];
      const ow = pv.clone().multiplyScalar(dy).addScaledVector(qv, -dx);
      tri(A3[i], A3[j], B3[j], ow); tri(A3[i], B3[j], B3[i], ow);
    }
    return { prism: new Float32Array(out), concave: !cv };
  }
}

export const filletEdge = (topo, eid, mode, size, ARC = 18) => filletEdges(topo, [eid], mode, size, ARC);

// lo spigolo della topologia che corrisponde a una catena di Filo (stessi estremi)
// Quanto spazio c'è attorno a una catena di spigoli (anche chiusa, anche curva) per un raccordo o uno smusso: massimo possibile, o Infinity se non si sa.
// Ogni tratto della catena è un lato di due facce piane: si misura quanto sono larghe viste dal tratto (come in filletEdges) e si prende il minimo.
export function edgeRoom(topo, pts, mode, closed) {
  const V = topo.V, C = 0.01, cell = (x, y, z) => Math.floor(x / C) + ',' + Math.floor(y / C) + ',' + Math.floor(z / C);
  const grid = new Map(); for (let i = 0; i < V.length / 3; i++) { const k = cell(V[i * 3], V[i * 3 + 1], V[i * 3 + 2]); (grid.get(k) || grid.set(k, []).get(k)).push(i); }
  const find = p => {                              // vertice del solido nello stesso punto (tolleranza 0,001 mm)
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const l = grid.get(cell(p.x + dx * C, p.y + dy * C, p.z + dz * C)); if (!l) continue;
      for (const i of l) if (Math.abs(V[i * 3] - p.x) < 1e-3 && Math.abs(V[i * 3 + 1] - p.y) < 1e-3 && Math.abs(V[i * 3 + 2] - p.z) < 1e-3) return i;
    }
    return undefined;
  };
  const eOf = new Map(); for (const e of topo.edges) for (const [a, b] of e.segs) eOf.set(a < b ? a + '_' + b : b + '_' + a, e);
  const pos = v => vec(V, v), n = pts.length;
  let lim = Infinity;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = find(pts[i]), b = find(pts[(i + 1) % n]);
    if (a === undefined || b === undefined) continue;
    const e = eOf.get(a < b ? a + '_' + b : b + '_' + a);
    if (!e || !e.sharp || e.mixed || e.faces.length !== 2) continue;
    const A = pos(a), B = pos(b), len = A.distanceTo(B); if (len < 1e-6) continue;
    const dir = B.clone().sub(A).normalize(), [f1, f2] = e.faces, n1 = topo.faces[f1].n, n2 = topo.faces[f2].n, cv = e.convex;
    const u1 = new THREE.Vector3().crossVectors(n1, dir).normalize(); if (cv ? u1.dot(n2) > 0 : u1.dot(n2) < 0) u1.negate();
    const u2 = new THREE.Vector3().crossVectors(n2, dir).normalize(); if (cv ? u2.dot(n1) > 0 : u2.dot(n1) < 0) u2.negate();
    const th = Math.acos(Math.max(-1, Math.min(1, u1.dot(u2))));
    if (!(th > 0.3 && th < 3.0)) continue;
    const k = mode === 'chamfer' ? 1 : Math.tan(th / 2);
    const width = (f, u) => {
      let w = Infinity;
      for (const fr of [0.2, 0.5, 0.8]) {
        const S = A.clone().addScaledVector(dir, len * fr);
        let best = Infinity;
        for (const L of topo.faces[f].loops) for (let j = 0; j < L.verts.length; j++) {
          const P = pos(L.verts[j]).sub(S), Q = pos(L.verts[(j + 1) % L.verts.length]).sub(S);
          const px = P.dot(u), py = P.dot(dir), qx = Q.dot(u), qy = Q.dot(dir);
          if ((py > 1e-7) === (qy > 1e-7) || Math.abs(qy - py) < 1e-9) continue;
          const x = px + (qx - px) * (-py) / (qy - py);
          if (x > 1e-4 && x < best) best = x;
        }
        w = Math.min(w, best);
      }
      return w;
    };
    const wmin = Math.min(width(f1, u1), width(f2, u2));
    if (isFinite(wmin)) lim = Math.min(lim, Math.max(0, wmin * k - 0.01));
  }
  return lim;
}

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
