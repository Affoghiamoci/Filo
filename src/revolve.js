// Pezzi "a rotazione" (cilindri, coni, sfere, vasi fatti unendo coni e raccordi, pezzi torniti importati):
// si riconoscono tagliandoli con alcuni semipiani attorno all'asse verticale e confrontando i profili.
// Dal profilo si ricostruisce il pezzo, con le Righe (texture parametrica) e con Svuota (pareti di spessore costante).

const TAU = Math.PI * 2;

// sezione dei triangoli (coordinate mondo, non indicizzati) con il semipiano che parte dall'asse (cx, cy) nella direzione phi.
// Restituisce i contorni chiusi del profilo come liste di [r, z].
function slice(P, cx, cy, phi) {
  const ux = Math.cos(phi), uy = Math.sin(phi), nx = -uy, ny = ux;
  const segs = [];
  for (let i = 0; i < P.length; i += 9) {
    const d = [0, 1, 2].map(k => nx * (P[i + k * 3] - cx) + ny * (P[i + k * 3 + 1] - cy));
    const pts = [];
    for (let k = 0; k < 3; k++) {
      const a = k, b = (k + 1) % 3;
      if ((d[a] > 0) === (d[b] > 0)) continue;
      const t = d[a] / (d[a] - d[b]);
      const x = P[i + a * 3] + (P[i + b * 3] - P[i + a * 3]) * t, y = P[i + a * 3 + 1] + (P[i + b * 3 + 1] - P[i + a * 3 + 1]) * t, z = P[i + a * 3 + 2] + (P[i + b * 3 + 2] - P[i + a * 3 + 2]) * t;
      pts.push([ux * (x - cx) + uy * (y - cy), z]);
    }
    if (pts.length !== 2) continue;
    const [A, B] = pts;
    if (A[0] < 1e-9 && B[0] < 1e-9) continue;                      // tutto dall'altra parte dell'asse
    if (A[0] < 0 || B[0] < 0) {                                    // attraversa l'asse (fondo o cima): si tiene solo la parte buona
      const t = A[0] / (A[0] - B[0]), z = A[1] + (B[1] - A[1]) * t;
      if (A[0] < 0) pts[0] = [0, z]; else pts[1] = [0, z];
    }
    segs.push(pts);
  }
  // concatena i segmenti in contorni chiusi
  const q = v => Math.round(v * 1e4), key = p => q(p[0]) + ',' + q(p[1]);
  const at = new Map();
  segs.forEach((s, i) => { for (const e of [0, 1]) { const k = key(s[e]); (at.get(k) || at.set(k, []).get(k)).push([i, e]); } });
  const used = new Uint8Array(segs.length), loops = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const loop = [segs[i][0], segs[i][1]];
    let cur = segs[i][1], guard = 0, closed = false;
    while (guard++ < segs.length + 5) {
      const nx2 = (at.get(key(cur)) || []).find(([j]) => !used[j]);
      if (!nx2) { closed = key(cur) === key(loop[0]); break; }
      const [j, e] = nx2; used[j] = 1;
      cur = segs[j][1 - e];
      if (key(cur) === key(loop[0])) { closed = true; break; }
      loop.push(cur);
    }
    if (!closed) {                                                 // si continua anche all'indietro, dal primo punto
      let back = loop[0], g2 = 0;
      while (g2++ < segs.length + 5) {
        const pv = (at.get(key(back)) || []).find(([j]) => !used[j]);
        if (!pv) break;
        const [j, e] = pv; used[j] = 1;
        back = segs[j][1 - e];
        if (key(back) === key(loop[loop.length - 1])) { closed = true; break; }
        loop.unshift(back);
      }
    }
    // i contorni che toccano l'asse si chiudono lungo l'asse (lì la sezione non ha segmenti)
    if (!closed) {
      const a = loop[0], b = loop[loop.length - 1];
      if (Math.abs(a[0]) < 1e-3 && Math.abs(b[0]) < 1e-3) closed = true; else continue;
    }
    if (loop.length >= 3) loops.push(simplify(loop));
  }
  return loops.filter(l => l.length >= 3);
}
// toglie i punti doppi e quelli in mezzo a un tratto dritto
function simplify(L) {
  let out = [];
  for (const p of L) { const l = out[out.length - 1]; if (!l || Math.hypot(p[0] - l[0], p[1] - l[1]) > 1e-4) out.push([Math.abs(p[0]) < 2e-3 ? 0 : p[0], p[1]]); }
  if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 1e-4) out.pop();
  let changed = true;
  while (changed && out.length > 3) {
    changed = false;
    for (let i = 0; i < out.length && out.length > 3; i++) {
      const a = out[(i + out.length - 1) % out.length], b = out[i], c = out[(i + 1) % out.length];
      const cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]), len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (Math.abs(cr) < 1e-7 * Math.max(len, 1e-6) * 1e3 && (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) >= 0) { out.splice(i, 1); changed = true; i--; }
    }
  }
  return out;
}
const area = L => { let a = 0; for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
function distToPoly(p, L) {
  let best = Infinity;
  for (let i = 0; i < L.length; i++) {
    const a = L[i], b = L[(i + 1) % L.length], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
    best = Math.min(best, Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t));
  }
  return best;
}
const inside = (p, L) => { let c = false; for (let i = 0, j = L.length - 1; i < L.length; j = i++) { const a = L[i], b = L[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };

// Il pezzo è a rotazione attorno all'asse verticale che passa per il centro del suo ingombro?
// Restituisce { polys (profilo, z da 0), rmax, h, cx, cy, z0 } oppure { err }.
export function revolutionProfile(P) {
  if (!P || P.length < 27) return { err: 'vuoto' };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < P.length; i += 3) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); y0 = Math.min(y0, P[i + 1]); y1 = Math.max(y1, P[i + 1]); z0 = Math.min(z0, P[i + 2]); z1 = Math.max(z1, P[i + 2]); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
  if (Math.abs(rx - ry) > 0.01 * Math.max(rx, ry) + 0.05) return { err: 'non è rotondo' };
  const angles = [0.0123, 0.0123 + TAU * 2 / 7, 0.0123 + TAU * 3 / 7, 0.0123 + TAU * 5 / 7, 0.0123 + TAU * 6 / 7];
  const profs = angles.map(a => slice(P, cx, cy, a));
  const base = profs[0];
  if (!base.length) return { err: 'nessun profilo' };
  const rmax = Math.max(rx, ry), tol = 0.03 + 0.004 * rmax;
  for (const pr of profs.slice(1)) {
    if (pr.length !== base.length) return { err: 'non è a rotazione' };
    for (const L of base) for (const p of L) if (Math.min(...pr.map(M => distToPoly(p, M))) > tol) return { err: 'non è a rotazione' };
    for (const L of pr) for (const p of L) if (Math.min(...base.map(M => distToPoly(p, M))) > tol) return { err: 'non è a rotazione' };
  }
  // profilo: z da 0, contorni esterni in senso antiorario (r come x, z come y), i buchi della sezione in senso orario
  const polys = base.map(L => L.map(([r, z]) => [r, z - z0]));
  polys.forEach((L, i) => {
    const depth = polys.filter((M, j) => j !== i && inside(L[0], M)).length;
    if ((area(L) > 0) !== (depth % 2 === 0)) L.reverse();
  });
  return { polys, rmax, h: z1 - z0, cx, cy, z0 };
}

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const SHAPES = {
  round: s => 0.5 - 0.5 * Math.cos(TAU * s),
  point: s => 1 - Math.abs(2 * s - 1),
  square: s => 0.5 + 0.5 * Math.tanh(5 * Math.cos(TAU * s)) / Math.tanh(5),
};
// normale verso l'esterno di un vertice del profilo (contorni antiorari: l'esterno sta a destra del verso di percorrenza)
function vNormals(L) {
  return L.map((p, i) => {
    const a = L[(i + L.length - 1) % L.length], b = L[(i + 1) % L.length];
    const n1 = [p[1] - a[1], -(p[0] - a[0])], n2 = [b[1] - p[1], -(b[0] - p[0])];
    const l1 = Math.hypot(...n1) || 1, l2 = Math.hypot(...n2) || 1;
    const n = [n1[0] / l1 + n2[0] / l2, n1[1] / l1 + n2[1] / l2], l = Math.hypot(...n) || 1;
    return [n[0] / l, n[1] / l];
  });
}

// Svuota: dal profilo pieno (un solo contorno che tocca l'asse sotto e sopra, cima piatta) fa un vaso aperto in alto,
// con pareti di spessore t (misurato perpendicolare alla parete) e fondo b. Restituisce il nuovo contorno o { err }.
export function shellProfile(polys, t, b) {
  if (polys.length !== 1) return { err: 'Svuota funziona su un pezzo pieno, senza cavità' };
  const L = polys[0], H = Math.max(...L.map(p => p[1]));
  const onAxis = L.map((p, i) => i).filter(i => L[i][0] === 0);
  if (onAxis.length < 2) return { err: 'Svuota funziona su un pezzo pieno, senza cavità' };
  // il contorno antiorario va: asse in basso → fondo → parete esterna → cima → asse in alto. Ruota in modo da partire dall'asse in basso.
  let start = onAxis.reduce((a, i) => (L[i][1] < L[a][1] ? i : a), onAxis[0]);
  let R = L.slice(start).concat(L.slice(0, start));
  if (R[R.length - 1][0] === 0 && R[R.length - 1][1] < R[0][1] + 1e-6) R = [R[R.length - 1], ...R.slice(0, -1)];
  const topIdx = R.findIndex((p, i) => i > 0 && p[0] === 0);
  if (topIdx < 0 || Math.abs(R[topIdx][1] - H) > 1e-3) return { err: 'Svuota funziona su un pezzo con la cima piatta' };
  // la cima piatta: dall'ultimo punto della parete a quota H fino all'asse
  let wallEnd = topIdx - 1; while (wallEnd > 0 && Math.abs(R[wallEnd - 1][1] - H) < 1e-4) wallEnd--;
  let wallStart = 1; while (wallStart < wallEnd && Math.abs(R[wallStart][1] - R[0][1]) < 1e-4) wallStart++;
  wallStart = Math.max(1, wallStart - 1);                     // l'angolo in basso fuori
  if (wallEnd - wallStart < 1) return { err: 'profilo troppo semplice' };
  const outer = R.slice(0, wallEnd + 1);                       // asse in basso … angolo in alto fuori (a quota H)
  const N = vNormals(R);
  const zb = R[0][1] + b;
  // parete interna: ogni tratto della parete spostato di t verso dentro, negli angoli l'incrocio dei due tratti (così lo spessore è t ovunque,
  // anche sugli angoli vivi: con la sola normale media una parete dritta veniva t/√2 vicino agli spigoli)
  const segN = i => {                                          // normale verso fuori del tratto R[i] → R[i+1]
    const a = R[i], b = R[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    let n = [dy / l, -dx / l]; const m = [N[i][0] + N[i + 1][0], N[i][1] + N[i + 1][1]];
    if (n[0] * m[0] + n[1] * m[1] < 0) n = [-n[0], -n[1]];
    return n;
  };
  const segs = []; for (let i = wallStart; i < wallEnd; i++) if (Math.hypot(R[i + 1][0] - R[i][0], R[i + 1][1] - R[i][1]) > 1e-6) segs.push(i);
  const inner = [];
  for (let k = segs.length - 1; k >= -1; k--) {               // dall'alto in basso: estremi dei tratti spostati, incrociati negli angoli
    const up = k >= 0 ? segs[k] : null, dn = k - 1 >= 0 ? segs[k - 1] : null;
    if (k === segs.length - 1) { const n = segN(up); inner.push([R[up + 1][0] - n[0] * t, R[up + 1][1] - n[1] * t]); }
    if (k < 0) { const n = segN(segs[0]); inner.push([R[segs[0]][0] - n[0] * t, R[segs[0]][1] - n[1] * t]); break; }
    if (dn == null) continue;
    const n1 = segN(up), n2 = segN(dn), p = R[up], c = n1[0] * n2[0] + n1[1] * n2[1];
    if (c > 0.9999) { inner.push([p[0] - n1[0] * t, p[1] - n1[1] * t]); continue; }
    const m = [n1[0] + n2[0], n1[1] + n2[1]], ml = Math.hypot(...m) || 1, len = Math.min(t / Math.sqrt(Math.max((1 + c) / 2, 1e-6)), 4 * t);
    inner.push([p[0] - m[0] / ml * len, p[1] - m[1] / ml * len]);
  }
  inner[0] = [inner[0][0], H];                                 // in cima la parete interna arriva al bordo
  // si taglia all'altezza del fondo
  const cut = [];
  for (let i = 0; i < inner.length; i++) {
    const p = inner[i];
    if (p[1] >= zb) { cut.push(p); continue; }
    const q = inner[i - 1];
    if (q && q[1] > zb) { const k = (q[1] - zb) / (q[1] - p[1]); cut.push([q[0] + (p[0] - q[0]) * k, zb]); }
    break;
  }
  if (cut.length < 2 || cut[cut.length - 1][1] > zb + 1e-6) { const l = cut[cut.length - 1]; if (!l) return { err: 'pareti troppo spesse' }; cut.push([l[0], zb]); }
  if (cut.some(p => p[0] <= 0.05)) return { err: 'Pareti troppo spesse per questo pezzo' };
  const out = [...outer, ...cut, [0, zb]];
  if (zb >= H - 0.2) return { err: 'Fondo troppo spesso per questo pezzo' };
  return { polys: [simplify(out)] };
}

// Ricostruisce il pezzo girando il profilo attorno all'asse. ribs: { n, depth, shape, twist (gradi), margin (mm) }.
// Restituisce le posizioni dei triangoli (non indicizzati), con l'origine al centro della base.
// Margine: per tutta la sua altezza la parete resta liscia, poi le righe crescono in un tratto breve (non per tutto il margine, che faceva il pezzo a botte)
export const mgT = R => Math.min(3, Math.max(1, 1.5 * (R.depth || 0)));
export function revolve(polys, ribs) {
  const R = ribs && ribs.n > 0 && ribs.depth > 0 ? ribs : null;
  const N = R ? Math.min(2880, Math.max(96, Math.round(R.n) * (R.shape === 'point' ? 6 : 8))) : 128;
  const out = [];
  for (const L0 of polys) {
    // sulle pareti che guardano fuori si infittisce il profilo, così le righe (e la torsione) restano morbide
    let L = L0;
    if (R) {
      const step = R.twist || R.margin > 0 ? 0.5 : 1, nn = vNormals(L0); L = [];
      for (let i = 0; i < L0.length; i++) {
        const a = L0[i], b = L0[(i + 1) % L0.length]; L.push(a);
        if (nn[i][0] > 0.3 && nn[(i + 1) % L0.length][0] > 0.3) {
          const k = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step);
          for (let j = 1; j < k; j++) L.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]);
        }
      }
    }
    const nrm = vNormals(L);
    const wt = nrm.map((n, i) => (L[i][0] > 1e-6 ? smooth(0.3, 0.7, n[0]) : 0));
    const tz = L.filter((p, i) => wt[i] > 0).map(p => p[1]), zA = tz.length ? Math.min(...tz) : 0, zB = tz.length ? Math.max(...tz) : 1, HT = Math.max(zB - zA, 1e-6);
    const S = R ? (SHAPES[R.shape] || SHAPES.round) : null, tw = R ? (R.twist || 0) * Math.PI / 180 : 0, mg = R ? Math.max(0, R.margin || 0) : 0;
    const P = (i, j) => {
      let [r, z] = L[i]; const th = TAU * j / N;
      if (S && wt[i] > 0) {
        const fade = mg > 0 ? smooth(mg, mg + mgT(R), z - zA) * smooth(mg, mg + mgT(R), zB - z) : 1;   // margine: fascia liscia alta mg, poi le righe salgono in poco spazio
        const ph = R.n * (th + tw * (z - zA) / HT) / TAU;
        const a = R.depth * S(ph - Math.floor(ph)) * fade * wt[i];
        r += a * nrm[i][0]; z += a * nrm[i][1];
      }
      return [r * Math.cos(th), r * Math.sin(th), z];
    };
    const grid = L.map((_, i) => Array.from({ length: N }, (_, j) => P(i, j)));
    for (let i = 0; i < L.length; i++) {
      const i2 = (i + 1) % L.length, axisA = L[i][0] <= 1e-9, axisB = L[i2][0] <= 1e-9;
      if (axisA && axisB) continue;                             // tratto lungo l'asse: non disegna niente
      for (let j = 0; j < N; j++) {
        const j2 = (j + 1) % N, a = grid[i][j], b = grid[i2][j], c = grid[i2][j2], d = grid[i][j2];
        // il contorno antiorario in (r, z), girato in senso antiorario attorno a z, dà le normali verso fuori con l'ordine a, d, c / a, c, b
        if (!axisA && !axisB) out.push(...a, ...d, ...c, ...a, ...c, ...b);
        else if (axisA) out.push(...a, ...c, ...b);
        else out.push(...a, ...d, ...b);
      }
    }
  }
  return new Float32Array(out);
}
