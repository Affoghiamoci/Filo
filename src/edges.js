// Spigoli vivi di una mesh (in coordinate mondo), catene di spigoli tangenti, e lo "scalpello" per raccordi e smussi.
import * as THREE from 'three';

const Q = v => Math.round(v * 2000);
const SHARP = Math.cos(30 * Math.PI / 180);
const ekey = (a, b) => (a < b ? a * 4294967296 + b : b * 4294967296 + a);

// pos: Float32Array non indicizzato (9 numeri per triangolo), già in coordinate mondo
export function analyze(pos) {
  const nTri = pos.length / 9, ids = new Map(), P = [];
  const vid = i => {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2], k = Q(x) + ',' + Q(y) + ',' + Q(z);
    let id = ids.get(k);
    if (id === undefined) { id = P.length / 3; ids.set(k, id); P.push(x, y, z); }
    return id;
  };
  const tn = new Float32Array(nTri * 3), tv = new Int32Array(nTri * 3);
  const E = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let t = 0; t < nTri; t++) {
    const o = t * 9;
    a.set(pos[o], pos[o + 1], pos[o + 2]); b.set(pos[o + 3], pos[o + 4], pos[o + 5]); c.set(pos[o + 6], pos[o + 7], pos[o + 8]);
    n.subVectors(b, a).cross(c.clone().sub(a));
    const len = n.length();
    if (len < 1e-10) { tv[t * 3] = -1; continue; }
    n.divideScalar(len);
    tn[t * 3] = n.x; tn[t * 3 + 1] = n.y; tn[t * 3 + 2] = n.z;
    const v = [vid(o), vid(o + 3), vid(o + 6)];
    tv[t * 3] = v[0]; tv[t * 3 + 1] = v[1]; tv[t * 3 + 2] = v[2];
    for (let k = 0; k < 3; k++) {
      const p0 = v[k], p1 = v[(k + 1) % 3];
      if (p0 === p1) continue;
      const key = ekey(p0, p1);
      let e = E.get(key);
      if (!e) E.set(key, e = { a: Math.min(p0, p1), b: Math.max(p0, p1), tris: [] });
      e.tris.push(t);
    }
  }
  const vp = i => new THREE.Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  const nrm = t => new THREE.Vector3(tn[t * 3], tn[t * 3 + 1], tn[t * 3 + 2]);
  const sharp = [], at = new Map();      // vertice -> spigoli vivi
  for (const [key, e] of E) {
    if (e.tris.length !== 2) continue;
    const n1 = nrm(e.tris[0]), n2 = nrm(e.tris[1]);
    if (n1.dot(n2) > SHARP) continue;
    // vertice opposto del secondo triangolo: dietro al piano del primo = spigolo convesso
    let opp = -1;
    for (let k = 0; k < 3; k++) { const v = tv[e.tris[1] * 3 + k]; if (v !== e.a && v !== e.b) opp = v; }
    const pa = vp(e.a);
    e.convex = opp >= 0 && n1.dot(vp(opp).sub(pa)) < -1e-6;
    e.n1 = n1; e.n2 = n2; e.key = key;
    if (!e.convex) continue;
    sharp.push(e);
    for (const v of [e.a, e.b]) { if (!at.has(v)) at.set(v, []); at.get(v).push(e); }
  }
  return { P, vp, sharp, at };
}

// spigolo vivo più vicino a un punto (distanza massima tol)
export function nearestEdge(an, pt, tol) {
  let best = null, bd = tol;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), AB = new THREE.Vector3(), AP = new THREE.Vector3();
  for (const e of an.sharp) {
    A.set(an.P[e.a * 3], an.P[e.a * 3 + 1], an.P[e.a * 3 + 2]); B.set(an.P[e.b * 3], an.P[e.b * 3 + 1], an.P[e.b * 3 + 2]);
    AB.subVectors(B, A); AP.subVectors(pt, A);
    const l2 = AB.lengthSq();
    const s = l2 > 0 ? Math.max(0, Math.min(1, AP.dot(AB) / l2)) : 0;
    const d = AP.sub(AB.multiplyScalar(s)).length();
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// catena di spigoli tangenti a partire da uno: si ferma agli angoli (dove ne arrivano più di due o la curva gira troppo)
export function chainOf(an, e0) {
  const used = new Set([e0.key]);
  const dir = (from, to) => an.vp(to).sub(an.vp(from)).normalize();
  const aligned = (e, nA, nB) => (e.n1.dot(nA) + e.n2.dot(nB) >= e.n1.dot(nB) + e.n2.dot(nA)) ? [e.n1, e.n2] : [e.n2, e.n1];
  const [nA0, nB0] = [e0.n1, e0.n2];
  const grow = (start, prevV) => {
    // start: vertice da cui proseguire; prevV: vertice precedente; restituisce lista di {v, nA, nB}
    const out = []; let cur = start, prev = prevV, nA = nA0, nB = nB0;
    for (let guard = 0; guard < 20000; guard++) {
      const cand = (an.at.get(cur) || []).filter(e => !used.has(e.key));
      if ((an.at.get(cur) || []).length !== 2 || cand.length !== 1) break;
      const e = cand[0], nxt = e.a === cur ? e.b : e.a;
      const d1 = dir(prev, cur), d2 = dir(cur, nxt);
      if (d1.dot(d2) < Math.cos(35 * Math.PI / 180)) break;
      const [a2, b2] = aligned(e, nA, nB);
      if (a2.dot(nA) < 0.7 || b2.dot(nB) < 0.7) break;
      used.add(e.key); nA = a2; nB = b2;
      out.push({ v: nxt, nA, nB, prev: cur });
      prev = cur; cur = nxt;
      if (nxt === start) break;
    }
    return out;
  };
  const fwd = grow(e0.b, e0.a);
  let closed = false, back = [];
  if (fwd.length && fwd[fwd.length - 1].v === e0.a) closed = true;
  else back = grow(e0.a, e0.b);
  const verts = [e0.a, e0.b], segN = [[nA0, nB0]];
  for (const f of fwd) { verts.push(f.v); segN.push([f.nA, f.nB]); }
  for (const f of back) { verts.unshift(f.v); segN.unshift([f.nA, f.nB]); }
  if (closed) verts.pop();                      // l'ultimo vertice coincide col primo
  return { verts, segN, closed, pts: verts.map(v => an.vp(v)) };
}

// Scalpello: tubo lungo la catena con sezione = zona di materiale da togliere. mode 'fillet' o 'chamfer'.
export function cutter(chain, mode, size) {
  const { pts, closed, segN } = chain, n = pts.length;
  if (n < 2) return null;
  const EPS = 0.05, ARC = 10;
  const rings = [];
  const ns = closed ? n : n; // numero di anelli
  for (let i = 0; i < n; i++) {
    const E = pts[i];
    const iPrev = closed ? (i + n - 1) % n : Math.max(i - 1, 0), iNext = closed ? (i + 1) % n : Math.min(i + 1, n - 1);
    const t = pts[iNext].clone().sub(pts[iPrev]).normalize();
    // tratti adiacenti: tratto i-1 (prev→i) e tratto i (i→next)
    const sA = segN[closed ? (i + n - 1) % n : Math.max(i - 1, 0)], sB = segN[Math.min(i, segN.length - 1)];
    const nA = sA[0].clone().add(sB[0]).normalize(), nB = sA[1].clone().add(sB[1]).normalize();
    let u1 = nA.clone().cross(t).normalize(); if (u1.dot(nB) > 0) u1.negate();
    let u2 = nB.clone().cross(t).normalize(); if (u2.dot(nA) > 0) u2.negate();
    const cosT = Math.max(-1, Math.min(1, u1.dot(u2))), th = Math.acos(cosT);
    if (!(th > 0.3 && th < 3.0)) return null;
    const pend = (!closed && (i === 0 || i === n - 1));
    const Ee = E.clone(); if (pend) Ee.addScaledVector(t, i === 0 ? -EPS : EPS);
    const den = Math.max(0.25, 1 + nA.dot(nB));
    const Eo = Ee.clone().addScaledVector(nA.clone().add(nB), EPS / den);
    const poly = [Eo];
    let tl, T1, T2;
    if (mode === 'chamfer') { tl = size; T1 = Ee.clone().addScaledVector(u1, tl); T2 = Ee.clone().addScaledVector(u2, tl); poly.push(T1.clone().addScaledVector(nA, EPS), T1, T2, T2.clone().addScaledVector(nB, EPS)); }
    else {
      tl = size / Math.tan(th / 2);
      T1 = Ee.clone().addScaledVector(u1, tl); T2 = Ee.clone().addScaledVector(u2, tl);
      const C = Ee.clone().addScaledVector(u1.clone().add(u2).normalize(), size / Math.sin(th / 2));
      const a = T1.clone().sub(C).normalize(), b = T2.clone().sub(C).normalize(), ang = Math.acos(Math.max(-1, Math.min(1, a.dot(b))));
      const axis = a.clone().cross(b).normalize();
      poly.push(T1.clone().addScaledVector(nA, EPS));
      for (let k = 0; k <= ARC; k++) poly.push(a.clone().applyAxisAngle(axis, ang * k / ARC).multiplyScalar(size).add(C));
      poly.push(T2.clone().addScaledVector(nB, EPS));
    }
    rings.push({ poly, E: Ee, t });
  }
  const K = rings[0].poly.length, pos = [];
  const push = p => pos.push(p.x, p.y, p.z);
  const tube = [];
  const R = closed ? n : n - 1;
  for (let i = 0; i < R; i++) {
    const r0 = rings[i].poly, r1 = rings[(i + 1) % n].poly;
    for (let j = 0; j < K; j++) {
      const j2 = (j + 1) % K;
      tube.push([r0[j], r0[j2], r1[j2]], [r0[j], r1[j2], r1[j]]);
    }
  }
  // verso: il primo quadrato (lato Eo→T1o) deve guardare fuori dal centro della sezione
  const cen = new THREE.Vector3(); rings[0].poly.forEach(p => cen.add(p)); cen.divideScalar(K);
  const tri0 = tube[0], nn = tri0[1].clone().sub(tri0[0]).cross(tri0[2].clone().sub(tri0[0]));
  const mid = tri0[0].clone().add(tri0[1]).multiplyScalar(0.5).sub(cen);
  const flip = nn.dot(mid) < 0;
  for (const t of tube) { if (flip) { push(t[0]); push(t[2]); push(t[1]); } else { push(t[0]); push(t[1]); push(t[2]); } }
  if (!closed) {
    for (const [ri, sgn] of [[0, -1], [n - 1, 1]]) {
      const r = rings[ri], P = r.poly;
      const ex = P[1].clone().sub(P[0]).normalize(), ey = r.t.clone().cross(ex).normalize();
      const c2 = P.map(p => new THREE.Vector2(p.clone().sub(P[0]).dot(ex), p.clone().sub(P[0]).dot(ey)));
      let tris;
      try { tris = THREE.ShapeUtils.triangulateShape(c2.map(v => v.clone()), []); } catch (e) { return null; }
      for (const [a, b, c] of tris) {
        const nm = P[b].clone().sub(P[a]).cross(P[c].clone().sub(P[a]));
        if (nm.dot(r.t) * sgn >= 0) { push(P[a]); push(P[b]); push(P[c]); } else { push(P[a]); push(P[c]); push(P[b]); }
      }
    }
  }
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
