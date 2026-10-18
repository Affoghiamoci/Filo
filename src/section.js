// Pezzi "a sezione costante" (scatole, prismi, esagoni, anche rastremati con la Cima, e forme unite che salgono dritte come una L):
// si riconoscono tagliandoli in orizzontale a più altezze. Dalla sezione si ricostruisce il pezzo con le Righe lungo il perimetro
// (un numero intero di righe per ogni faccia, così gli spigoli restano netti) e con Svuota (pareti di spessore costante, aperto in alto).
import * as THREE from 'three';

const TAU = Math.PI * 2;
const area = L => { let a = 0; for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const inside = (p, L) => { let c = false; for (let i = 0, j = L.length - 1; i < L.length; j = i++) { const a = L[i], b = L[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
function distToPoly(p, L) {
  let best = Infinity;
  for (let i = 0; i < L.length; i++) {
    const a = L[i], b = L[(i + 1) % L.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t));
  }
  return best;
}
function simplify(L) {
  let out = [];
  for (const p of L) { const l = out[out.length - 1]; if (!l || Math.hypot(p[0] - l[0], p[1] - l[1]) > 1e-4) out.push(p); }
  if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 1e-4) out.pop();
  let changed = true;
  while (changed && out.length > 3) {
    changed = false;
    for (let i = 0; i < out.length && out.length > 3; i++) {
      const a = out[(i + out.length - 1) % out.length], b = out[i], c = out[(i + 1) % out.length];
      const cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]), len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (Math.abs(cr) < 1e-4 * Math.max(len, 1e-6) && (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) >= 0) { out.splice(i, 1); changed = true; i--; }
    }
  }
  return out;
}
// sezione orizzontale dei triangoli (non indicizzati) alla quota z: contorni chiusi di punti [x, y]
function hslice(P, z) {
  const segs = [];
  for (let i = 0; i < P.length; i += 9) {
    const d = [0, 1, 2].map(k => P[i + k * 3 + 2] - z), pts = [];
    for (let k = 0; k < 3; k++) {
      const a = k, b = (k + 1) % 3;
      if ((d[a] > 0) === (d[b] > 0)) continue;
      const t = d[a] / (d[a] - d[b]);
      pts.push([P[i + a * 3] + (P[i + b * 3] - P[i + a * 3]) * t, P[i + a * 3 + 1] + (P[i + b * 3 + 1] - P[i + a * 3 + 1]) * t]);
    }
    if (pts.length === 2) segs.push(pts);
  }
  const q = v => Math.round(v * 1e4), key = p => q(p[0]) + ',' + q(p[1]);
  const at = new Map();
  segs.forEach((s, i) => { for (const e of [0, 1]) { const k = key(s[e]); (at.get(k) || at.set(k, []).get(k)).push([i, e]); } });
  const used = new Uint8Array(segs.length), loops = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const loop = [segs[i][0], segs[i][1]];
    let cur = segs[i][1], closed = false, guard = 0;
    while (guard++ < segs.length + 5) {
      const nx = (at.get(key(cur)) || []).find(([j]) => !used[j]);
      if (!nx) { closed = key(cur) === key(loop[0]); break; }
      const [j, e] = nx; used[j] = 1; cur = segs[j][1 - e];
      if (key(cur) === key(loop[0])) { closed = true; break; }
      loop.push(cur);
    }
    if (closed && loop.length >= 3) loops.push(simplify(loop));
  }
  return loops.filter(l => l.length >= 3 && Math.abs(area(l)) > 1e-4);
}
function orient(polys) {
  polys.forEach((L, i) => {
    const depth = polys.filter((M, j) => j !== i && inside(L[0], M)).length;
    if ((area(L) > 0) !== (depth % 2 === 0)) L.reverse();
  });
  return polys;
}

// Il pezzo sale dritto (o rastremato in modo uniforme) con la stessa sezione? Restituisce { polys (centrati), k (cima/base), w0, d0, h, cx, cy, z0 } o { err }.
export function sectionProfile(P) {
  if (!P || P.length < 27) return { err: 'vuoto' };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < P.length; i += 3) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); y0 = Math.min(y0, P[i + 1]); y1 = Math.max(y1, P[i + 1]); z0 = Math.min(z0, P[i + 2]); z1 = Math.max(z1, P[i + 2]); }
  const H = z1 - z0; if (!(H > 0.2)) return { err: 'troppo basso' };
  const fr = [0.013, 0.26, 0.5, 0.74, 0.987], S = fr.map(f => hslice(P, z0 + f * H));
  if (S.some(s => !s.length) || S.some(s => s.length !== S[0].length)) return { err: 'non è a sezione costante' };
  // centro della rastrematura: centro dell'ingombro della sezione in basso
  const bb = L => { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (const s of L) for (const [x, y] of s) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, y); d = Math.max(d, y); } return [a, b, c, d]; };
  const b0 = bb(S[0]), cx = (b0[0] + b0[1]) / 2, cy = (b0[2] + b0[3]) / 2;
  const A = s => s.reduce((t, L) => t + Math.abs(area(L)), 0);
  const sTop = Math.sqrt(A(S[4]) / A(S[0])), zA = fr[0] * H, zB = fr[4] * H, m = (sTop - 1) / (zB - zA);
  const rel = z => 1 + m * (z - zA);
  const base = S[0].map(L => L.map(([x, y]) => [x - cx, y - cy]));
  const tol = 0.03 + 0.004 * Math.max(b0[1] - b0[0], b0[3] - b0[2]);
  for (let i = 1; i < S.length; i++) {
    const k = rel(fr[i] * H), sc = S[i].map(L => L.map(([x, y]) => [(x - cx) / k, (y - cy) / k]));
    for (const L of sc) for (const p of L) if (Math.min(...base.map(M => distToPoly(p, M))) > tol) return { err: 'non è a sezione costante' };
    for (const L of base) for (const p of L) if (Math.min(...sc.map(M => distToPoly(p, M))) > tol) return { err: 'non è a sezione costante' };
  }
  const k0 = rel(0), k1 = rel(H);
  if (!(k0 > 0.01 && k1 > 0.01)) return { err: 'rastrematura troppo forte' };
  const polys = orient(base.map(L => L.map(([x, y]) => [x * k0, y * k0])));
  const bw = bb(polys), big = Math.max(1, k1 / k0);
  return { polys, k: k1 / k0, w0: (bw[1] - bw[0]) * big, d0: (bw[3] - bw[2]) * big, h: H, cx, cy, z0 };
}

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const SHAPES = {                       // valore 0 negli spigoli (fase intera), 1 in cima alla riga
  round: s => 0.5 - 0.5 * Math.cos(TAU * s),
  point: s => 1 - Math.abs(2 * s - 1),
  square: s => 0.5 - 0.5 * Math.tanh(5 * Math.cos(TAU * s)) / Math.tanh(5),
};
// contorno infittito per le righe: tratti tra spigoli vivi (svolte oltre 20°), con un numero intero di righe per tratto
function ribbed(L, pitch, perPt) {
  const n = L.length, turn = i => {
    const a = L[(i + n - 1) % n], b = L[i], c = L[(i + 1) % n];
    const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]];
    return Math.abs(Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]));
  };
  let corners = L.map((_, i) => i).filter(i => turn(i) > 20 * Math.PI / 180);
  if (!corners.length) corners = [0];                                      // contorno tutto curvo: un tratto solo
  const out = [];
  for (let c = 0; c < corners.length; c++) {
    const i0 = corners[c], i1 = corners[(c + 1) % corners.length];
    const run = []; for (let i = i0; ; i = (i + 1) % n) { run.push(L[i]); if (i === i1 && run.length > 1) break; if (run.length > n + 1) break; }
    if (corners.length === 1) run.push(L[i0]);
    const seg = []; let len = 0; for (let i = 0; i < run.length - 1; i++) { const l = Math.hypot(run[i + 1][0] - run[i][0], run[i + 1][1] - run[i][1]); seg.push(l); len += l; }
    const nr = Math.max(1, Math.round(len / pitch)), steps = nr * perPt;
    let si = 0, acc = 0;
    for (let s = 0; s < steps; s++) {                                       // punti equidistanti lungo il tratto (l'ultimo è lo spigolo dopo, che apre il tratto successivo)
      const d = len * s / steps;
      while (si < seg.length - 1 && acc + seg[si] < d - 1e-12) { acc += seg[si]; si++; }
      const t = seg[si] > 0 ? (d - acc) / seg[si] : 0, a = run[si], b = run[si + 1];
      out.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], ph: nr * d / len, pitch: len / nr });
    }
  }
  return out;
}
function normals2(L) {                                                     // normali verso l'esterno di un contorno antiorario
  return L.map((p, i) => {
    const a = L[(i + L.length - 1) % L.length], b = L[(i + 1) % L.length];
    const n1 = [p[1] - a[1], -(p[0] - a[0])], n2 = [b[1] - p[1], -(b[0] - p[0])];
    const l1 = Math.hypot(...n1) || 1, l2 = Math.hypot(...n2) || 1, n = [n1[0] / l1 + n2[0] / l2, n1[1] / l1 + n2[1] / l2], l = Math.hypot(...n) || 1;
    return [n[0] / l, n[1] / l];
  });
}
function triangulate(contours, z, up, out) {                              // contorni (esterni antiorari, buchi orari) → triangoli piani a quota z
  const outers = contours.filter(c => area(c) > 0), holes = contours.filter(c => area(c) < 0);
  for (const o of outers) {
    const hs = holes.filter(h => inside(h[0], o) && !outers.some(o2 => o2 !== o && inside(h[0], o2) && inside(o2[0], o)));
    let tris; try { tris = THREE.ShapeUtils.triangulateShape(o.map(p => new THREE.Vector2(p[0], p[1])), hs.map(h => h.map(p => new THREE.Vector2(p[0], p[1])))); } catch (e) { tris = []; }
    const all = [o, ...hs].flat(), cr = t => { const A = all[t[0]], B = all[t[1]], C = all[t[2]]; return (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]); };
    let big = 0; for (const t of tris) { const c = cr(t); if (Math.abs(c) > Math.abs(big)) big = c; }   // verso dato dal triangolo più grande: quelli schiacciati (punti in fila) hanno un segno a caso
    const keep = (big > 0) === up;
    for (const [a, b, c] of tris) {
      const A = all[a], B = all[b], C = all[c];
      const [x, y, w] = keep ? [A, B, C] : [A, C, B];
      out.push(x[0], x[1], z, y[0], y[1], z, w[0], w[1], z);
    }
  }
}

// Costruisce il pezzo. p = { polys, k, h, ribs, shell }, con i contorni già alla misura voluta. M = modulo Manifold (per lo spessore delle pareti).
export function sectionSolid(p, M) {
  const R = p.ribs && p.ribs.n > 0 && p.ribs.depth > 0 ? p.ribs : null, H = p.h, k = p.k || 1;
  const outerC = p.polys;
  const scaleAt = z => 1 + (k - 1) * z / H;
  // quote dei piani di costruzione: con torsione o margine servono più piani per tenere le righe morbide
  const step = R ? (R.twist ? 0.5 : (R.margin > 0 ? 1 : 0)) : 0;
  const zs = [0]; if (step) for (let z = step; z < H - 1e-6; z += step) zs.push(z); zs.push(H);
  const mg = R ? Math.max(0, R.margin || 0) : 0, S = R ? (SHAPES[R.shape] || SHAPES.round) : null;
  const perim = outerC.filter(c => area(c) > 0).reduce((t, c) => t + c.reduce((s, q, i) => s + Math.hypot(c[(i + 1) % c.length][0] - q[0], c[(i + 1) % c.length][1] - q[1]), 0), 0);
  const pitch = R ? perim / Math.max(1, R.n) : 0, perPt = R && R.shape === 'square' ? 8 : 6;
  // anelli del contorno per ogni piano (le righe solo sui contorni esterni, cioè quelli che guardano fuori)
  const rings = outerC.map(c => {
    const outer = area(c) > 0;
    if (!R || !outer) { const nn = normals2(c); return { outer, pts: c.map((q, i) => ({ p: q, ph: 0, n: nn[i], tex: false })) }; }
    const rb = ribbed(c, pitch, perPt), nn = normals2(rb.map(r => r.p));
    return { outer, pts: rb.map((r, i) => ({ p: r.p, ph: r.ph, pitch: r.pitch, n: nn[i], tex: true })) };
  });
  const at = (pt, z) => {
    const s = scaleAt(z); let x = pt.p[0] * s, y = pt.p[1] * s;
    if (pt.tex) {
      const fade = mg > 0 ? smooth(0, mg, z) * smooth(0, mg, H - z) : 1;
      const ph = pt.ph + (R.twist || 0) / 360 * perim / pt.pitch * (z / H);
      const a = R.depth * S(ph - Math.floor(ph)) * fade;
      x += a * pt.n[0]; y += a * pt.n[1];
    }
    return [x, y];
  };
  const out = [];
  const wall = (pts, zlist, inward) => {
    const n = pts.length;
    for (let j = 0; j < zlist.length - 1; j++) {
      const za = zlist[j], zb = zlist[j + 1];
      for (let i = 0; i < n; i++) {
        const a = at(pts[i], za), b = at(pts[(i + 1) % n], za), c = at(pts[(i + 1) % n], zb), d = at(pts[i], zb);
        const A = [a[0], a[1], za], B = [b[0], b[1], za], C = [c[0], c[1], zb], D = [d[0], d[1], zb];
        if (!inward) out.push(...A, ...B, ...C, ...A, ...C, ...D); else out.push(...A, ...C, ...B, ...A, ...D, ...C);
      }
    }
  };
  for (const r of rings) wall(r.pts, zs, false);                         // i buchi della sezione girano al contrario: le loro pareti guardano già nel buco
  const ringAt = z => rings.map(r => r.pts.map(pt => at(pt, z)));
  triangulate(ringAt(0), 0, false, out);                                  // fondo
  const sh = p.shell && p.shell.t > 0 ? p.shell : null;
  if (!sh) { triangulate(ringAt(H), H, true, out); return { pos: new Float32Array(out) }; }
  if (!M) return { err: 'motore non pronto' };
  // Svuota: contorno interno = sezione ristretta dello spessore (offset robusto di Manifold, anche su forme concave)
  let inner;
  try {
    const cs = new M.CrossSection(outerC.map(c => c.map(q => [q[0], q[1]])), 'NonZero');
    const off = cs.offset(-sh.t, 'Miter', 2);
    inner = off.toPolygons().map(c => c.map(q => [q[0], q[1]]));
    cs.delete(); off.delete();
  } catch (e) { return { err: 'Non riesco a calcolare le pareti' }; }
  inner = inner.filter(c => Math.abs(area(c)) > 0.05);
  if (!inner.length) return { err: 'Pareti troppo spesse per questo pezzo' };
  const zb = Math.max(0, sh.b ?? 2); if (zb >= H - 0.2) return { err: 'Fondo troppo spesso per questo pezzo' };
  const zi = zs.filter(z => z > zb + 1e-6 && z < H - 1e-6), zlist = [zb, ...zi, H];
  const sAt = (q, z) => { const s = scaleAt(z); return [q[0] * s, q[1] * s]; };
  for (const c of inner) {                                                // pareti interne: guardano dentro la cavità
    const n = c.length;
    for (let j = 0; j < zlist.length - 1; j++) {
      const za = zlist[j], zb2 = zlist[j + 1];
      for (let i = 0; i < n; i++) {
        const a = sAt(c[i], za), b = sAt(c[(i + 1) % n], za), cc = sAt(c[(i + 1) % n], zb2), d = sAt(c[i], zb2);
        out.push(a[0], a[1], za, cc[0], cc[1], zb2, b[0], b[1], za, a[0], a[1], za, d[0], d[1], zb2, cc[0], cc[1], zb2);
      }
    }
  }
  triangulate(inner.map(c => c.map(q => sAt(q, zb))), zb, true, out);      // fondo della cavità
  // bordo in cima: anello tra il contorno esterno (con le righe) e quello interno
  const top = ringAt(H), innerTop = inner.map(c => c.map(q => sAt(q, H)).reverse());
  triangulate([...top, ...innerTop], H, true, out);
  return { pos: new Float32Array(out) };
}
