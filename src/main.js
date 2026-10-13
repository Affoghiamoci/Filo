import { initI18n, tr } from './i18n.js';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { mergeVertices, mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { unzipSync, zipSync, strToU8 } from 'three/addons/libs/fflate.module.js';
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { analyze, nearestEdge, chainOf, cutter } from './edges.js';
import ClipperLib from 'clipper-lib';
import { FONTS, fontById, addUserFont, textPositions, svgItems } from './textgen.js';

THREE.Object3D.DEFAULT_UP.set(0, 0, 1); // Z verso l'alto, come nei programmi di stampa 3D

const $ = (s, r = document) => r.querySelector(s);
const D2R = Math.PI / 180;
const fmt = v => String(+Number(v).toFixed(2));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ------------------------------------------------------------------ stato */
const state = { tool: 'move', space: false, snap: 1, dims: false, xray: false };
const objects = [];
let selection = [];
let keyObj = null;
let nextId = 1;
const counters = { box: 0, cylinder: 0, sphere: 0, cone: 0, prism: 0, torus: 0, merged: 0 };
let dirty = true, dimsDirty = true;

/* ----------------------------------------------------------------- scena */
const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 1, 6000);
camera.up.set(0, 0, 1);

scene.add(new THREE.HemisphereLight(0xffffff, 0x9a9aa6, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 2.1);
sun.position.set(90, -140, 220);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -170, right: 170, top: 170, bottom: -170, near: 10, far: 700 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.6;
scene.add(sun);

let BEDX = 180, BEDY = 180; // piatto (default Bambu Lab A1 mini)
const bedMat = new THREE.MeshStandardMaterial({ color: 0xf7f7fa, roughness: 1 });
const bed = new THREE.Mesh(new THREE.PlaneGeometry(BEDX, BEDY), bedMat);
bed.position.z = -0.05;
bed.receiveShadow = true;
scene.add(bed);
const dotTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.beginPath(); g.arc(16, 16, 14, 0, Math.PI * 2); g.fill();
  return new THREE.CanvasTexture(c);
})();
const gridMat = new THREE.PointsMaterial({ color: 0x9d9da6, size: 1.3, sizeAttenuation: true, map: dotTex, alphaTest: 0.5, transparent: true });
const grid = new THREE.Points(new THREE.BufferGeometry(), gridMat);
scene.add(grid);
function buildBedDots(spacing) {
  const pts = [];
  for (let x = -BEDX / 2; x <= BEDX / 2 + 0.01; x += spacing) for (let y = -BEDY / 2; y <= BEDY / 2 + 0.01; y += spacing) pts.push(x, y, 0.04);
  grid.geometry.dispose();
  grid.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  dirty = true;
}
buildBedDots(10);
const outline = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x8e8e98, transparent: true, opacity: 0.8 }));
scene.add(outline);
let gridStep = 10;
function setBed(w, d, refit = true) {
  BEDX = clamp(Math.round(w) || 180, 20, 400); BEDY = clamp(Math.round(d) || 180, 20, 400);
  bed.geometry.dispose(); bed.geometry = new THREE.PlaneGeometry(BEDX, BEDY);
  outline.geometry.dispose();
  outline.geometry = new THREE.BufferGeometry().setFromPoints([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => new THREE.Vector3(x * BEDX / 2, y * BEDY / 2, 0.05)));
  const R = Math.max(BEDX, BEDY) * 0.5 + 80;
  Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R });
  sun.shadow.camera.updateProjectionMatrix();
  buildBedDots(gridStep);
  try { localStorage.setItem('forma.bed', JSON.stringify([BEDX, BEDY])); } catch (e) {}
  if (refit && typeof fitView === 'function' && !objects.length) fitView();
  dirty = true;
}

function applyTheme() {
  bedMat.color.set(css('--bed'));
  gridMat.color.set(css('--grid'));
  dirty = true;
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
applyTheme();

/* ---------------------------------------------------------------- camera */
const cam = { az: 35, el: 28, dist: 320, target: new THREE.Vector3(0, 0, 10) };
function applyCamera() {
  const az = cam.az * D2R, el = cam.el * D2R;
  camera.position.set(
    cam.target.x + cam.dist * Math.sin(az) * Math.cos(el),
    cam.target.y - cam.dist * Math.cos(az) * Math.cos(el),
    cam.target.z + cam.dist * Math.sin(el));
  camera.lookAt(cam.target);
  camera.updateMatrixWorld();
  dirty = true;
  updateViewCube();
  if (typeof hpop !== 'undefined' && hpop) closeHandlePopup();
}
/* cubo di orientamento: faccette CSS 3D che seguono la camera */
const VC = { S: 52, qi: new THREE.Quaternion(), els: null };
const vcMap = w => { const v = w.clone().applyQuaternion(VC.qi); return new THREE.Vector3(v.x, -v.y, v.z); };   // mondo (Z su) -> CSS
const vcMat = (u, d, n, t) => `matrix3d(${u.x},${u.y},${u.z},0,${d.x},${d.y},${d.z},0,${n.x},${n.y},${n.z},0,${t.x},${t.y},${t.z},1)`;
function updateViewCube() {
  if (!VC.els) {
    const root = document.getElementById('viewcube');
    if (!root) return;
    const v3 = s => new THREE.Vector3(...s.split(',').map(Number));
    root.querySelectorAll('.vca').forEach(e => { const c = e.cloneNode(); c.dataset.alt = '1'; e.after(c); });   // secondo piano a croce: la linea resta visibile anche di taglio
    VC.els = { f: [...root.querySelectorAll('.vcf')].map(e => ({ e, n: v3(e.dataset.n) })), a: [...root.querySelectorAll('.vca')].map(e => ({ e, a: v3(e.dataset.a) })), l: [...root.querySelectorAll('.vcl')].map(e => ({ e, a: v3(e.dataset.a) })) };
  }
  VC.qi.copy(camera.quaternion).invert();
  const H = VC.S / 2, Z = new THREE.Vector3(0, 0, 1), X = new THREE.Vector3(1, 0, 0);
  for (const { e, n } of VC.els.f) {
    const u = Math.abs(n.z) > 0.5 ? X.clone() : Z.clone().cross(n);
    const d = u.clone().cross(n);                         // u × d = -n: nessuna immagine speculare
    e.style.transform = vcMat(vcMap(u), vcMap(d), vcMap(n), vcMap(n).multiplyScalar(H));
  }
  const corner = new THREE.Vector3(-H, -H, -H);
  for (const { e, a } of VC.els.a) {
    const alt = e.dataset.alt === '1';
    const p = a.x ? (alt ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0)) : (alt ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0));
    if (a.z && alt) p.set(0, 1, 0);
    e.style.transform = vcMat(vcMap(a), vcMap(p), vcMap(a.clone().cross(p)), vcMap(corner));
  }
  for (const { e, a } of VC.els.l) {
    const t = vcMap(corner.clone().addScaledVector(a, VC.S + 20));
    e.style.transform = `translate3d(${t.x}px,${t.y}px,${t.z}px) translate(-50%,-50%)`;
  }
}
let tween = null;
function animateTo(to, ms = 320) {
  const from = { az: cam.az, el: cam.el, dist: cam.dist, t: cam.target.clone() };
  let daz = (to.az ?? cam.az) - cam.az;
  daz = ((daz + 540) % 360) - 180;
  tween = { t0: performance.now(), ms, from, to: { az: from.az + daz, el: to.el ?? from.el, dist: to.dist ?? from.dist, t: to.target ?? from.t } };
}
function stepTween() {
  const k = clamp((performance.now() - tween.t0) / tween.ms, 0, 1);
  const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const { from, to } = tween;
  cam.az = from.az + (to.az - from.az) * e;
  cam.el = from.el + (to.el - from.el) * e;
  cam.dist = from.dist + (to.dist - from.dist) * e;
  cam.target.lerpVectors(from.t, to.t, e);
  applyCamera();
  if (k >= 1) tween = null;
}
const zoom = f => { cam.dist = clamp(cam.dist * f, 15, 3000); applyCamera(); };
const worldPerPixel = () => 2 * cam.dist * Math.tan(camera.fov * D2R / 2) / canvas.clientHeight;
function panPixels(dx, dy) {
  const s = worldPerPixel();
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  cam.target.addScaledVector(right, -dx * s).addScaledVector(up, dy * s);
  applyCamera();
}
function orbitPixels(dx, dy) {
  cam.az -= dx * 0.3;
  cam.el = clamp(cam.el + dy * 0.3, -89.9, 89.9);
  applyCamera();
}
function fitView() {
  const box = new THREE.Box3();
  if (objects.length) objects.forEach(m => box.union(worldBox(m)));
  else box.set(new THREE.Vector3(-BEDX / 2, -BEDY / 2, 0), new THREE.Vector3(BEDX / 2, BEDY / 2, 0));
  const c = box.getCenter(new THREE.Vector3());
  const r = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 25);
  animateTo({ target: c, dist: clamp(r / Math.sin(camera.fov * D2R / 2) * 1.25, 60, 2500) });
}
const VIEWS = { front: { az: 0, el: 0 }, top: { az: 0, el: 89.9 }, right: { az: 90, el: 0 }, iso: { az: 35, el: 28 } };

let pixelRatio = 0;
function wantPixelRatio() { return objects.some(o => o.userData.heavy) ? 1 : Math.min(window.devicePixelRatio || 1, 2); }
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const pr = wantPixelRatio(); if (pr !== pixelRatio) { pixelRatio = pr; renderer.setPixelRatio(pr); }
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  dirty = true;
}
window.addEventListener('resize', resize);

/* ------------------------------------------------------------ geometrie */
function roundedRectShape(w, d, r, chamfer) {
  const x = -w / 2, y = -d / 2;
  r = Math.min(r, w / 2 - 1e-3, d / 2 - 1e-3);
  const s = new THREE.Shape();
  if (r <= 0.001) { s.moveTo(x, y); s.lineTo(x + w, y); s.lineTo(x + w, y + d); s.lineTo(x, y + d); s.closePath(); return s; }
  if (chamfer) { s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.lineTo(x + w, y + r); s.lineTo(x + w, y + d - r); s.lineTo(x + w - r, y + d); s.lineTo(x + r, y + d); s.lineTo(x, y + d - r); s.lineTo(x, y + r); s.closePath(); return s; }
  s.moveTo(x + r, y); s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false); s.lineTo(x + w, y + d - r);
  s.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false); s.lineTo(x + r, y + d);
  s.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false); s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
function clean(g) {
  g.deleteAttribute('uv');
  g.clearGroups();
  return g;
}
// Tutte le forme hanno l'origine al centro della base: Z = 0 vuol dire "appoggiato sul piatto".
// scatola con bordi alti e/o bassi raccordati o smussati: anelli sovrapposti, ognuno con il contorno ristretto di un certo ttratto
function boxLevels(p) {
  const h = p.h, lim = Math.min(p.w, p.d) / 2 - 0.05, cham = p.rm === 'chamfer';
  let ft = clamp(p.ft || 0, 0, lim), fb = clamp(p.fb || 0, 0, lim);
  if (ft + fb > h - 0.05) { const k = (h - 0.05) / (ft + fb); ft *= k; fb *= k; }
  const N = cham ? 1 : 8, L = [];
  if (fb > 0) for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI / 2; L.push([fb * (1 - Math.cos(a)), fb * (1 - Math.sin(a))]); } else L.push([0, 0]);
  if (ft > 0) for (let i = 0; i <= N; i++) { const a = Math.PI / 2 - (i / N) * Math.PI / 2; L.push([h - ft * (1 - Math.cos(a)), ft * (1 - Math.sin(a))]); } else L.push([h, 0]);
  return L.filter((q, i) => i === 0 || Math.abs(q[0] - L[i - 1][0]) > 1e-6 || Math.abs(q[1] - L[i - 1][1]) > 1e-6);
}
function boxRing(p, d) {
  const hw = p.w / 2 - d, hd = p.d / 2 - d, r = clamp(Math.max((p.r || 0) - d, 0), 0, Math.min(hw, hd) - 1e-3), cham = p.rm === 'chamfer', K = cham ? 1 : 10, pts = [];
  [[1, 1, 0], [-1, 1, 90], [-1, -1, 180], [1, -1, 270]].forEach(([sx, sy, a0]) => {
    for (let k = 0; k <= K; k++) { const a = (a0 + 90 * k / K) * D2R; pts.push([sx * (hw - r) + r * Math.cos(a), sy * (hd - r) + r * Math.sin(a)]); }
  });
  return pts;
}
function boxFilleted(p) {
  const L = boxLevels(p), rings = L.map(([z, d]) => ({ z, pts: boxRing(p, d) })), n = rings[0].pts.length, tri = [];
  const V = (r, j) => [r.pts[j % n][0], r.pts[j % n][1], r.z], same = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-6;
  const push = (a, b, c) => { if (!same(a, b) && !same(b, c) && !same(a, c)) tri.push(...a, ...b, ...c); };
  for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < n; j++) {
    const a = V(rings[i], j), b = V(rings[i], j + 1), c = V(rings[i + 1], j + 1), d = V(rings[i + 1], j);
    push(a, b, c); push(a, c, d);
  }
  const cap = (ring, up) => {
    const c = []; ring.pts.forEach(q => { const v = new THREE.Vector2(q[0], q[1]); if (!c.length || c[c.length - 1].distanceTo(v) > 1e-6) c.push(v); });
    if (c.length > 1 && c[0].distanceTo(c[c.length - 1]) < 1e-6) c.pop();
    THREE.ShapeUtils.triangulateShape(c, []).forEach(([i, j, k]) => { const A = [c[i].x, c[i].y, ring.z], B = [c[j].x, c[j].y, ring.z], C = [c[k].x, c[k].y, ring.z]; up ? push(A, B, C) : push(A, C, B); });
  };
  cap(rings[rings.length - 1], true); cap(rings[0], false);
  let g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  g = toCreasedNormals(g, 35 * D2R);
  return clean(g);
}
function buildGeometry(kind, p) {
  let g;
  if (kind === 'box') {
    if (p.ft > 0 || p.fb > 0) g = boxFilleted(p);
    else if (p.r <= 0.001) { g = new THREE.BoxGeometry(p.w, p.d, p.h); g.translate(0, 0, p.h / 2); }
    else g = mergeVertices(clean(new THREE.ExtrudeGeometry(roundedRectShape(p.w, p.d, p.r, p.rm === 'chamfer'), { depth: p.h, bevelEnabled: false, curveSegments: 12 })));
    const tt = clamp(p.t ?? 100, 1, 100) / 100;
    if (tt < 0.9999) {                                                // cima più stretta: tronco di piramide
      g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('normal');
      const a = g.attributes.position; for (let i = 0; i < a.count; i++) { const k = 1 + (tt - 1) * a.getZ(i) / p.h; a.setX(i, a.getX(i) * k); a.setY(i, a.getY(i) * k); }
      g = toCreasedNormals(g, 30 * D2R); clean(g);
    }
  } else if (kind === 'cylinder') {
    g = new THREE.CylinderGeometry(clamp(p.t ?? 100, 1, 100) / 100, 1, 1, 72, 1);
    g.rotateX(Math.PI / 2); g.scale(p.w / 2, p.d / 2, p.h); g.translate(0, 0, p.h / 2);
  } else if (kind === 'cone') {
    g = new THREE.CylinderGeometry(Math.max(p.q || 0, 1) / 100, 1, 1, 72, 1);
    g.rotateX(Math.PI / 2); g.scale(p.w / 2, p.d / 2, p.h); g.translate(0, 0, p.h / 2);
  } else if (kind === 'prism') {
    g = new THREE.CylinderGeometry(clamp(p.t ?? 100, 1, 100) / 100, 1, 1, Math.round(clamp(p.q || 6, 3, 64)), 1);
    g.rotateX(Math.PI / 2); g.rotateZ(Math.PI / 2); g.scale(p.w / 2, p.d / 2, p.h); g.translate(0, 0, p.h / 2);
  } else if (kind === 'torus') {
    const t = clamp(p.q || 25, 5, 50) / 100;
    g = mergeVertices(clean(new THREE.TorusGeometry(1 - t, t, 24, 72)));
    g.scale(p.w / 2, p.d / 2, p.h / 2 / t); g.translate(0, 0, p.h / 2);
  } else {
    g = new THREE.SphereGeometry(1, 56, 36);
    g.rotateX(Math.PI / 2); g.scale(p.w / 2, p.d / 2, p.h / 2); g.translate(0, 0, p.h / 2);
  }
  return clean(g);
}

/* ------------------------------------------------------------- materiali */
const M = {
  solid: new THREE.MeshStandardMaterial({ color: 0xd9dce3, roughness: 0.55, metalness: 0.05 }),
  solidSel: new THREE.MeshStandardMaterial({ color: 0xcfe0f7, roughness: 0.55, metalness: 0.05, emissive: 0xff6a00, emissiveIntensity: 0.1 }),
  hole: new THREE.MeshStandardMaterial({ color: 0xff7a45, transparent: true, opacity: 0.45, depthWrite: false, roughness: 0.7 }),
  holeSel: new THREE.MeshStandardMaterial({ color: 0xff7a45, transparent: true, opacity: 0.6, depthWrite: false, roughness: 0.7, emissive: 0xff7a45, emissiveIntensity: 0.2 }),
};
const EDGE = { normal: 0x5b5f6b, sel: 0xff6a00, key: 0xa855f7 };

/* --------------------------------------------------------------- oggetti */
// Spigoli "veri": solo dove due triangoli adiacenti formano un angolo netto.
// Gli spigoli senza un vicino (T-junction lasciate dalla CSG) non vengono disegnati.
function featureEdges(geo, thr = 30) {
  const pos = geo.attributes.position, idx = geo.index;
  const nTri = idx ? idx.count / 3 : pos.count / 3;
  const cos = Math.cos(thr * D2R);
  const ids = new Map(), P = [], edges = new Map();
  const q = v => Math.round(v * 2000);
  const vid = i => {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), k = q(x) + ',' + q(y) + ',' + q(z);
    let id = ids.get(k);
    if (id === undefined) { id = P.length / 3; ids.set(k, id); P.push(x, y, z); }
    return id;
  };
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let t = 0; t < nTri; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    n.subVectors(b, a).cross(c.sub(a));
    const len = n.length();
    if (len < 1e-9) continue;
    n.divideScalar(len);
    const v = [vid(i0), vid(i1), vid(i2)];
    for (let k = 0; k < 3; k++) {
      const p0 = v[k], p1 = v[(k + 1) % 3];
      if (p0 === p1) continue;
      const key = p0 < p1 ? p0 * 4294967296 + p1 : p1 * 4294967296 + p0;
      const e = edges.get(key);
      if (!e) edges.set(key, { p0, p1, n: n.clone(), c: 1, sharp: false });
      else { e.c++; e.sharp = e.c === 2 && e.n.dot(n) < cos; }
    }
  }
  const out = [];
  edges.forEach(e => { if (e.sharp) out.push(P[e.p0 * 3], P[e.p0 * 3 + 1], P[e.p0 * 3 + 2], P[e.p1 * 3], P[e.p1 * 3 + 1], P[e.p1 * 3 + 2]); });
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
}
const COLORS = [null, '#FF6A00', '#F2F2F2', '#26262B', '#E5383B', '#FFC400', '#22A45D', '#2F7BFF', '#8B5CF6'];
const colMats = new Map();
function colMat(hex, sel) {
  const k = hex + (sel ? '*' : '');
  let m = colMats.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.55, metalness: 0.05 });
    if (sel) { m.emissive = new THREE.Color(0xff6a00); m.emissiveIntensity = 0.1; }
    colMats.set(k, m);
  }
  return m;
}
function matFor(m) {
  const sel = selection.includes(m);
  if (m.userData.hole) return sel ? M.holeSel : M.hole;
  if (m.userData.color) return colMat(m.userData.color, sel);
  return sel ? M.solidSel : M.solid;
}
function refreshEdges(m) {
  if (m.userData.edges) { m.remove(m.userData.edges); m.userData.edges.geometry.dispose(); }
  const e = new THREE.LineSegments(m.userData.heavy ? new THREE.BufferGeometry() : featureEdges(m.geometry, 30),
    new THREE.LineBasicMaterial({ color: EDGE.normal, transparent: true, opacity: 0.55 }));
  e.raycast = () => {};
  m.add(e);
  m.userData.edges = e;
  // stessi spigoli, tratteggiati e disegnati solo dove la superficie li copre: la vista Raggi X delle parti nascoste
  if (m.userData.xray) { m.remove(m.userData.xray); m.userData.xray.material.dispose(); }
  const x = new THREE.LineSegments(e.geometry, new THREE.LineDashedMaterial({ color: EDGE.normal, dashSize: 1.6, gapSize: 1.2, transparent: true, opacity: 0.5, depthFunc: THREE.GreaterDepth, depthWrite: false }));
  if (e.geometry.attributes.position) x.computeLineDistances();
  x.raycast = () => {}; x.renderOrder = 2; x.visible = state.xray;
  m.add(x);
  m.userData.xray = x;
  styleObject(m);
}
function styleObject(m) {
  m.material = matFor(m);
  const e = m.userData.edges;
  if (!e) return;
  const sel = selection.includes(m), isKey = m === keyObj;
  e.material.color.setHex(isKey ? EDGE.key : sel ? EDGE.sel : EDGE.normal);
  e.material.opacity = sel ? 1 : 0.55;
  const x = m.userData.xray;
  if (x) { x.material.color.setHex(isKey ? EDGE.key : sel ? EDGE.sel : EDGE.normal); x.material.opacity = sel ? 0.8 : 0.45; x.visible = state.xray; }
}
const HEAVY = 250000;   // oltre questa soglia: niente bordi, ombre e anteprima dei lati
const triCount = g => g.index ? g.index.count / 3 : g.attributes.position.count / 3;
function heavyGuard(list) {
  const n = list.reduce((a, m) => a + triCount(m.geometry), 0);
  if (n < 400000) return false;
  return !confirm(tr('Modello molto pesante') + ` (${n.toLocaleString('it-IT')}). ` + tr('Questa operazione può bloccare il browser per diversi minuti. Conviene semplificarlo prima (in Bambu Studio: tasto destro, Semplifica modello). Continuare lo stesso?'));
}
function makeMesh(d) {
  const geo = d.kind === 'merged' ? d.geo : buildGeometry(d.kind, d.p);
  const m = new Brush(geo, d.hole ? M.hole : M.solid);
  const nt = triCount(geo), heavy = nt > HEAVY;
  if (nt > 20000 && !geo.boundsTree) { try { geo.computeBoundsTree(); } catch (e) { console.warn(e); } }
  m.castShadow = !heavy;
  m.receiveShadow = false;
  m.userData = { id: d.id ?? nextId++, name: d.name, kind: d.kind, p: { ...d.p }, hole: !!d.hole, base: d.base ? { ...d.base } : null, geo: d.kind === 'merged' ? geo : null, gid: d.gid ?? null, color: d.color ?? null, text: d.text ? { ...d.text } : null, hidden: !!d.hidden, locked: !!d.locked, heavy };
  m.visible = !d.hidden;
  if (d.pos) m.position.fromArray(d.pos);
  if (d.q) m.quaternion.fromArray(d.q); else m.rotation.z = (d.rot || 0) * D2R;
  if (d.scale) m.scale.fromArray(d.scale);
  scene.add(m);
  objects.push(m);
  refreshEdges(m);
  m.updateMatrixWorld(true);
  return m;
}
function removeMesh(m) {
  scene.remove(m);
  const i = objects.indexOf(m);
  if (i >= 0) objects.splice(i, 1);
  if (m.userData.edges) m.userData.edges.geometry.dispose();
  if (m.userData.kind !== 'merged') m.geometry.dispose();
}
function sizeOf(m) {
  const u = m.userData;
  if (u.kind !== 'merged') return { w: u.p.w, d: u.p.d, h: u.p.h };
  return { w: u.base.w * m.scale.x, d: u.base.d * m.scale.y, h: u.base.h * m.scale.z };
}
function setSize(m, key, v) {
  const u = m.userData;
  v = Math.max(0.1, v);
  if (u.kind === 'merged') {
    if (!(u.base[key] > 1e-3)) return;   // pezzo piatto: non si può scalare da zero
    const ax = { w: 'x', d: 'y', h: 'z' }[key];
    m.scale[ax] = v / u.base[key];
    u.p[key] = v;
  } else {
    u.p[key] = v;
    if (u.kind === 'box') { u.p.r = Math.min(u.p.r, Math.min(u.p.w, u.p.d) / 2); const lm = Math.min(u.p.w, u.p.d) / 2 - 0.05; if (u.p.ft > lm) u.p.ft = lm; if (u.p.fb > lm) u.p.fb = lm; }
    m.geometry.dispose();
    m.geometry = buildGeometry(u.kind, u.p);
    refreshEdges(m);
  }
  m.updateMatrixWorld(true);
}
function setBoxEdge(m, key, v) {
  const u = m.userData;
  if (u.kind !== 'box') return;
  u.p[key] = clamp(v, 0, Math.min(u.p.w, u.p.d) / 2 - 0.05);
  m.geometry.dispose(); m.geometry = buildGeometry('box', u.p); refreshEdges(m);
}
function setRadius(m, r) {
  const u = m.userData;
  u.p.r = clamp(r, 0, Math.min(u.p.w, u.p.d) / 2);
  m.geometry.dispose();
  m.geometry = buildGeometry('box', u.p);
  refreshEdges(m);
}
function setTop(m, v) {
  const u = m.userData;
  if (!['box', 'cylinder', 'prism'].includes(u.kind)) return;
  u.p.t = clamp(Math.round(v), 1, 100);
  m.geometry.dispose();
  m.geometry = buildGeometry(u.kind, u.p);
  refreshEdges(m);
}
const QSPEC = { cone: ['Cima %', 0, 100], prism: ['Lati', 3, 64], torus: ['Spessore %', 5, 50] };
function setQ(m, v) {
  const u = m.userData, sp = QSPEC[u.kind];
  if (!sp) return;
  u.p.q = u.kind === 'prism' ? Math.round(clamp(v, sp[1], sp[2])) : clamp(v, sp[1], sp[2]);
  m.geometry.dispose();
  m.geometry = buildGeometry(u.kind, u.p);
  refreshEdges(m);
}
const _v = new THREE.Vector3();
function worldBox(m) {
  m.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const pos = m.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) box.expandByPoint(_v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
  return box;
}
function defaultsFor(kind) {
  return { box: { w: 30, d: 30, h: 20, r: 0 }, cone: { w: 20, d: 20, h: 20, q: 0 }, prism: { w: 20, d: 20, h: 20, q: 6 }, torus: { w: 30, d: 30, h: 8, q: 25 } }[kind] || { w: 20, d: 20, h: 20 };
}
const NAMES = { box: 'Scatola', cylinder: 'Cilindro', sphere: 'Sfera', cone: 'Cono', prism: 'Prisma', torus: 'Toro', merged: 'Pezzo' };
function createObject(kind) {
  counters[kind]++;
  let x = 0;
  while (objects.some(o => Math.abs(o.position.x - x) < 1 && Math.abs(o.position.y) < 1)) x += 15;
  const m = makeMesh({ kind, name: `${NAMES[kind]} ${counters[kind]}`, p: defaultsFor(kind), pos: [x, 0, 0] });
  setSelection([m]);
  touch();
  commit();
  return m;
}

/* ------------------------------------------------------------- selezione */
let nextGid = 1;
let layersOn = false, layersQueued = false;
const withGroups = list => {
  const g = new Set(list.map(m => m.userData.gid).filter(v => v != null));
  return g.size ? [...new Set([...list, ...objects.filter(m => g.has(m.userData.gid))])] : list;
};
const isOneGroup = () => selection.length > 1 && selection[0].userData.gid != null && selection.every(m => m.userData.gid === selection[0].userData.gid);
function groupSelection() {
  if (isOneGroup()) return toast('È già un gruppo: ⇧⌘G per separarlo');
  const sel = withGroups(selection);
  if (sel.length < 2) return toast('Seleziona almeno due oggetti da raggruppare');
  const gid = nextGid++;
  sel.forEach(m => (m.userData.gid = gid));
  setSelection(sel);
  commit();
  toast(`Raggruppati ${sel.length} oggetti: ⇧⌘G per separarli`);
}
function ungroupSelection() {
  const sel = withGroups(selection);
  if (!sel.some(m => m.userData.gid != null)) return toast('Nessun gruppo selezionato');
  sel.forEach(m => (m.userData.gid = null));
  setSelection(sel);
  commit();
  toast('Gruppo separato');
}
function setSelection(list) {
  scheduleLayers();
  queueMicrotask(updateRotGizmo);
  selection = list.filter(m => m && m.visible && !m.userData.locked);
  if (typeof hpop !== 'undefined' && hpop) closeHandlePopup();
  if (!selection.includes(keyObj)) keyObj = null;
  if (faceSel && !selection.includes(faceSel.obj)) clearFace(false);
  objects.forEach(styleObject);
  syncPanel();
  updateHandles();
  dimsDirty = dirty = true;
}

/* -------------------------------------------------- cronologia (annulla) */
const history = [];
let hIdx = -1;
const visState = new Map(); // blocca e nascondi non fanno parte della cronologia
const entryOf = m => ({
  id: m.userData.id, name: m.userData.name, kind: m.userData.kind, p: { ...m.userData.p }, hole: m.userData.hole,
  base: m.userData.base ? { ...m.userData.base } : null, geo: m.userData.geo, gid: m.userData.gid ?? null,
  pos: m.position.toArray(), q: m.quaternion.toArray(), scale: m.scale.toArray(), color: m.userData.color ?? null, text: m.userData.text ? { ...m.userData.text } : null,
});
function snapshot() {
  return { sel: selection.map(m => m.userData.id), list: objects.map(entryOf) };
}
// descrive in poche parole che cosa è cambiato rispetto al passaggio precedente
function describeChange(prev, cur) {
  if (!prev) return 'Inizio';
  const P = new Map(prev.list.map(d => [d.id, d])), C = new Map(cur.list.map(d => [d.id, d]));
  const added = cur.list.filter(d => !P.has(d.id)), removed = prev.list.filter(d => !C.has(d.id));
  if (added.length && removed.length) return removed.length > 1 ? `Combinati ${removed.length} oggetti` : 'Lato modificato';
  if (added.length) return added.length === 1 ? `Aggiunto: ${added[0].name}` : `Aggiunti ${added.length} oggetti`;
  if (removed.length) return removed.length === 1 ? `Eliminato: ${removed[0].name}` : `Eliminati ${removed.length} oggetti`;
  const near = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
  const kinds = new Set(); let n = 0, name = '';
  cur.list.forEach(d => {
    const o = P.get(d.id); if (!o) return;
    const k = [];
    if (o.gid !== d.gid) k.push(d.gid != null ? 'Raggruppato' : 'Gruppo separato');
    if (o.name !== d.name) k.push('Rinominato');
    if (o.hole !== d.hole) k.push(d.hole ? 'Foro' : 'Solido');
    if ((o.color ?? null) !== (d.color ?? null)) k.push('Colore');
    if (JSON.stringify(o.text) !== JSON.stringify(d.text)) k.push('Testo modificato');
    if (!near(o.q, d.q)) k.push('Ruotato');
    if (!near(o.scale, d.scale) || JSON.stringify(o.p) !== JSON.stringify(d.p)) k.push('Ridimensionato');
    if (!near(o.pos, d.pos)) k.push('Spostato');
    if (k.length) { n++; name = d.name; k.forEach(x => kinds.add(x)); }
  });
  if (!kinds.size) return 'Modifica';
  const first = [...kinds][0];
  return n > 1 ? `${first}: ${n} oggetti` : `${first}: ${name}`;
}
const MAX_TRIS = 3e6; // tetto di memoria: oltre questo si scartano i passaggi più vecchi
function trimHistory() {
  while (history.length > 100) { history.shift(); hIdx--; }
  const tris = () => { const seen = new Set(); let t = 0; history.forEach(h => h.list.forEach(d => { if (d.geo && !seen.has(d.geo)) { seen.add(d.geo); t += (d.geo.index ? d.geo.index.count : d.geo.attributes.position.count) / 3; } })); return t; };
  while (history.length > 10 && tris() > MAX_TRIS) { history.shift(); hIdx--; }
}
function commit() {
  history.length = hIdx + 1;
  const snap = snapshot();
  snap.label = describeChange(history[history.length - 1], snap);
  history.push(snap);
  hIdx = history.length - 1;
  trimHistory();
  scheduleHistory();
}
function jumpTo(i) {
  if (i < 0 || i >= history.length || i === hIdx) return;
  hIdx = i; restore(history[i]); scheduleHistory();
}
function restore(s) {
  [...objects].forEach(removeMesh);
  keyObj = null;
  const made = s.list.map(d => makeMesh({ ...d, ...(visState.get(d.id) || {}) }));
  setSelection(made.filter(m => s.sel.includes(m.userData.id)));
  touch();
}
const undo = () => { if (hIdx > 0) { restore(history[--hIdx]); scheduleHistory(); } };
const redo = () => { if (hIdx < history.length - 1) { restore(history[++hIdx]); scheduleHistory(); } };

/* ------------------------------------------------------------ operazioni */
let perfDismissed = false;
function updatePerfNote() {
  const heavy = objects.some(o => o.userData.heavy);
  if (!heavy) perfDismissed = false;
  $('#perf-note').classList.toggle('hidden', !heavy || perfDismissed);
}
$('#perf-x').addEventListener('click', () => { perfDismissed = true; updatePerfNote(); });
function touch() { dirty = dimsDirty = true; if (wantPixelRatio() !== pixelRatio) resize(); updatePerfNote(); $('#empty-hint').classList.toggle('hidden', objects.length > 0); scheduleLayers(); updateRotGizmo(); }
const evaluator = new Evaluator();
evaluator.attributes = ['position', 'normal'];

function bakeResult(res, name) {
  res.updateMatrixWorld(true);
  const g = res.geometry.clone();
  if (!g.attributes.position || g.attributes.position.count === 0) return null;
  g.applyMatrix4(res.matrixWorld);
  clean(g);
  g.computeBoundingBox();
  const b = g.boundingBox;
  const c = b.getCenter(new THREE.Vector3()), minZ = b.min.z;
  g.translate(-c.x, -c.y, -minZ);
  g.computeBoundingBox();
  const s = g.boundingBox.getSize(new THREE.Vector3());
  counters.merged++;
  return { geo: g, pos: [c.x, c.y, minZ], size: s, name: name || `${NAMES.merged} ${counters.merged}` };
}
function combineBrushes(solids, holes) {
  solids.forEach(m => m.updateMatrixWorld(true));
  holes.forEach(m => m.updateMatrixWorld(true));
  let acc = solids[0];
  for (let i = 1; i < solids.length; i++) acc = evaluator.evaluate(acc, solids[i], ADDITION);
  for (const h of holes) acc = evaluator.evaluate(acc, h, SUBTRACTION);
  return acc;
}
function addMerged(baked) {
  return makeMesh({
    kind: 'merged', name: baked.name, geo: baked.geo, pos: baked.pos,
    p: { w: baked.size.x, d: baked.size.y, h: baked.size.z },
    base: { w: baked.size.x, d: baked.size.y, h: baked.size.z },
  });
}
function combine() {
  const solids = selection.filter(m => !m.userData.hole);
  const holes = selection.filter(m => m.userData.hole);
  if (selection.length < 2 || !solids.length) return toast('Seleziona almeno due oggetti, di cui un solido (⇧ + clic)');
  if (heavyGuard(selection)) return;
  const first = selection.length;
  const res = combineBrushes(solids, holes);
  const baked = bakeResult(res);
  if (!baked) return toast('Il risultato è vuoto: i fori coprono tutto');
  [...selection].forEach(removeMesh);
  const merged = addMerged(baked);
  setSelection([merged]);
  touch(); commit();
  toast(`Combinati ${first} oggetti`);
}
function duplicateSelection(offset = true) {
  if (!selection.length) return [];
  const gmap = new Map();
  const copies = selection.map(m => {
    const u = m.userData;
    let gid = null;
    if (u.gid != null) { if (!gmap.has(u.gid)) gmap.set(u.gid, nextGid++); gid = gmap.get(u.gid); }
    const name = u.name.replace(/ copia( \d+)?$/, '') + ' copia';
    return makeMesh({
      kind: u.kind, name, p: { ...u.p }, hole: u.hole, base: u.base, geo: u.geo, gid, color: u.color, text: u.text,
      pos: [m.position.x + (offset ? 12 : 0), m.position.y + (offset ? 12 : 0), m.position.z],
      q: m.quaternion.toArray(), scale: m.scale.toArray(),
    });
  });
  setSelection(copies);
  touch();
  if (offset) commit();
  return copies;
}
/* copia, taglia, incolla (appunti interni: gli oggetti restano nell'app) */
let clip = null, pasteN = 0;
function copySelection(quiet) {
  if (!selection.length) return false;
  clip = selection.map(entryOf); pasteN = 0;
  if (!quiet) toast(`Copiato${clip.length > 1 ? `: ${clip.length} oggetti` : ''}`);
  return true;
}
function cutSelection() { if (copySelection(true)) { deleteSelection(); toast('Tagliato'); } }
function pasteClip() {
  if (!clip || !clip.length) return toast('Niente da incollare');
  pasteN++;
  const gmap = new Map();
  const made = clip.map(d => {
    let gid = null;
    if (d.gid != null) { if (!gmap.has(d.gid)) gmap.set(d.gid, nextGid++); gid = gmap.get(d.gid); }
    const name = d.name.replace(/ copia( \d+)?$/, '') + (d.name.endsWith(' copia') ? '' : '');
    return makeMesh({ ...d, id: undefined, gid, name, p: { ...d.p }, base: d.base ? { ...d.base } : null, text: d.text ? { ...d.text } : null,
      pos: [d.pos[0] + 12 * pasteN, d.pos[1] + 12 * pasteN, d.pos[2]], q: d.q.slice(), scale: d.scale.slice() });
  });
  setSelection(made); touch(); commit();
  toast(`Incollato${made.length > 1 ? `: ${made.length} oggetti` : ''}`);
}
// divide un pezzo unito in parti staccate (ogni gruppo di triangoli collegati diventa un oggetto)
function splitPieces() {
  const obj = selection.length === 1 ? selection[0] : null;
  if (!obj || obj.userData.kind !== 'merged') return toast('Seleziona un pezzo unito (una scalanatura, una combinazione...)');
  if (heavyGuard([obj])) return;
  const arr = worldPositions(obj), nT = arr.length / 9, q = v => Math.round(v * 2000);
  const ids = new Map(), parent = [];
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const vid = i => { const k = q(arr[i]) + ',' + q(arr[i + 1]) + ',' + q(arr[i + 2]); let id = ids.get(k); if (id === undefined) { id = parent.length; parent.push(id); ids.set(k, id); } return id; };
  const tv = [];
  for (let t = 0; t < nT; t++) { const a = vid(t * 9), b = vid(t * 9 + 3), c = vid(t * 9 + 6); tv.push(a); parent[find(b)] = find(a); parent[find(c)] = find(a); }
  const comps = new Map();
  for (let t = 0; t < nT; t++) { const r = find(tv[t]); if (!comps.has(r)) comps.set(r, []); comps.get(r).push(t); }
  if (comps.size < 2) return toast('È già un pezzo solo: niente da separare');
  if (comps.size > 400) return toast('Troppi pezzi da separare');
  const u = obj.userData, name = u.name;
  const parts = [...comps.values()].map(ts => { const a = new Float32Array(ts.length * 9); ts.forEach((t, k) => a.set(arr.subarray(t * 9, t * 9 + 9), k * 9)); return a; });
  const baked = parts.map((a, i) => bakeResult({ updateMatrixWorld() {}, matrixWorld: new THREE.Matrix4(), geometry: geometryFromPositions(a) }, `${name} ${i + 1}`)).filter(Boolean);
  if (baked.length < 2) return toast('È già un pezzo solo: niente da separare');
  const hole = u.hole, color = u.color ?? null;
  removeMesh(obj);
  const out = baked.map(bk => { const m = addMerged(bk); m.userData.hole = hole; m.userData.color = color; m.castShadow = !hole; return m; });
  setSelection(out);
  touch(); commit();
  toast(`Separati ${out.length} pezzi: clicca un pezzo e premi Elimina, oppure ⌘G per raggrupparli`);
}
function deleteSelection() {
  if (!selection.length) return;
  [...selection].forEach(removeMesh);
  setSelection([]);
  touch(); commit();
}
function toggleHole() {
  if (!selection.length) return;
  const to = !selection.every(m => m.userData.hole);
  selection.forEach(m => { m.userData.hole = to; m.castShadow = !to; styleObject(m); });
  syncPanel(); touch(); commit();
}
function nudge(dx, dy, dz) {
  if (!selection.length) return;
  const s = state.snap;
  selection.forEach(m => { m.position.x += dx * s; m.position.y += dy * s; m.position.z += dz * s; });
  selection.forEach(m => m.updateMatrixWorld(true));
  touch(); syncPanel(); updateHandles();
  clearTimeout(nudge.t); nudge.t = setTimeout(commit, 400);
}

/* ------------------------------------------------------------ allineamento */
const AXES = { x: 'x', y: 'y', z: 'z' };
function alignSelection(axis, mode) {
  if (!selection.length) return;
  // un gruppo conta come un solo elemento
  const units = [], seen = new Set();
  selection.forEach(m => {
    if (seen.has(m)) return;
    const mem = m.userData.gid != null ? selection.filter(o => o.userData.gid === m.userData.gid) : [m];
    mem.forEach(o => seen.add(o));
    const box = new THREE.Box3();
    mem.forEach(o => box.union(worldBox(o)));
    units.push({ mem, box });
  });
  const pick = b => mode === 'min' ? b.min[axis] : mode === 'max' ? b.max[axis] : (b.min[axis] + b.max[axis]) / 2;
  if (units.length === 1) {
    // un solo elemento: allinea al piatto
    const u = units[0], half = axis === 'x' ? BEDX / 2 : axis === 'y' ? BEDY / 2 : 0;
    if (axis === 'z' && mode !== 'min') return toast('In altezza il piatto è solo la base');
    const target = axis === 'z' ? 0 : mode === 'min' ? -half : mode === 'max' ? half : 0;
    const d = target - (axis === 'z' ? u.box.min.z : mode === 'min' ? u.box.min[axis] : mode === 'max' ? u.box.max[axis] : (u.box.min[axis] + u.box.max[axis]) / 2);
    u.mem.forEach(o => { o.position[AXES[axis]] += d; o.updateMatrixWorld(true); });
  } else {
    const key = keyObj && units.find(u => u.mem.includes(keyObj));
    const ref = key ? key.box : units.reduce((b, u) => b.union(u.box), new THREE.Box3());
    const target = pick(ref);
    units.forEach(u => {
      if (u === key) return;
      const d = target - pick(u.box);
      u.mem.forEach(o => { o.position[AXES[axis]] += d; o.updateMatrixWorld(true); });
    });
  }
  touch(); syncPanel(); updateHandles(); commit();
}
function alignIcon(axis, mode) {
  // linea di riferimento + due barre; per Y e Z il disegno è ruotato di 90°
  const pos = mode === 'min' ? 4 : mode === 'max' ? 20 : 12;
  const bar = (len, y) => {
    const a = mode === 'min' ? 4 : mode === 'max' ? 20 - len : 12 - len / 2;
    return `<rect x="${a}" y="${y}" width="${len}" height="3.6" rx="1.2" fill="currentColor" stroke="none"/>`;
  };
  let inner = `<path d="M${pos} 3v18"/>` + bar(11, 6.5) + bar(7, 13.5);
  if (axis !== 'x') inner = `<g transform="rotate(-90 12 12)">${inner}</g>`;
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">${inner}</svg>`;
}
function buildAlignPanel() {
  const rows = [
    ['x', 'X', [['min', 'Allinea a sinistra'], ['mid', 'Centra su X'], ['max', 'Allinea a destra']]],
    ['y', 'Y', [['max', 'Allinea dietro'], ['mid', 'Centra su Y'], ['min', 'Allinea davanti']]],
    ['z', 'Z', [['max', 'Allinea in alto'], ['mid', 'Centra in altezza'], ['min', 'Allinea alla base']]],
  ];
  $('#p-align').innerHTML = rows.map(([ax, label, btns]) =>
    `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span style="width:14px;color:var(--muted);font-weight:600;font-size:11.5px">${label}</span>` +
    btns.map(([mode, tip]) => `<button class="btn" style="flex:1;justify-content:center;background:var(--field);padding:6px 0" data-ax="${ax}" data-mode="${mode}" title="${tip}">${alignIcon(ax, mode)}</button>`).join('') + '</div>').join('');
  $('#p-align').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) alignSelection(b.dataset.ax, b.dataset.mode);
  });
}

/* ------------------------------------------------------------- maniglie */
const AXIS_COLOR = { x: '#e5383b', y: '#22a45d', z: '#2f7bff' }; // X rosso, Y verde, Z blu
function handleTexture(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 5;
  g.fillStyle = color; g.strokeStyle = '#fff'; g.lineWidth = 3;
  g.beginPath(); g.rect(22, 22, 20, 20); g.fill(); g.shadowBlur = 0; g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const handleTex = Object.fromEntries(Object.entries(AXIS_COLOR).map(([k, col]) => [k, handleTexture(col)]));
const HANDLES = [];
for (const axis of ['x', 'y', 'z']) for (const sign of [1, -1]) {
  const mat = new THREE.SpriteMaterial({ map: handleTex[axis], sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true });
  const sp = new THREE.Sprite(mat);
  sp.scale.setScalar(0.022);
  sp.renderOrder = 999;
  sp.visible = false;
  sp.userData = { axis, sign };
  scene.add(sp);
  HANDLES.push(sp);
}
// le maniglie sul lato opposto a quello che guardiamo si attenuano
const _hn = new THREE.Vector3(), _ht = new THREE.Vector3();
function updateHandleFacing() {
  HANDLES.forEach(h => {
    if (!h.visible) return;
    _hn.set(0, 0, 0); _hn[h.userData.axis] = h.userData.sign;
    _ht.copy(camera.position).sub(h.position);
    h.material.opacity = _hn.dot(_ht) > 0 ? 1 : 0.28;
  });
}
/* ridimensionare più oggetti (o un gruppo) come se fossero uno solo */
const AXK = { x: 'w', y: 'd', z: 'h' };
function selBox() {
  const box = new THREE.Box3();
  selection.forEach(m => box.union(worldBox(m)));
  return box;
}
// asse locale (0,1,2) che corrisponde a ogni asse del mondo, solo per rotazioni multiple di 90°
function localAxes(m) {
  const e = new THREE.Matrix4().makeRotationFromQuaternion(m.quaternion).elements, loc = [];
  for (let a = 0; a < 3; a++) {
    let best = 0;
    for (let k = 1; k < 3; k++) if (Math.abs(e[k * 4 + a]) > Math.abs(e[best * 4 + a])) best = k;
    loc.push(best);
  }
  return loc;
}
function axisAligned(m) {
  const e = new THREE.Matrix4().makeRotationFromQuaternion(m.quaternion).elements;
  for (let k = 0; k < 3; k++) for (let a = 0; a < 3; a++) { const v = Math.abs(e[k * 4 + a]); if (v > 1e-3 && v < 1 - 1e-3) return false; }
  return true;
}
function startScale() {
  const items = selection.map(m => { const b = worldBox(m); return { m, p0: m.position.clone(), lo: b.min.clone(), hi: b.max.clone(), s0: { ...sizeOf(m) }, loc: localAxes(m), aligned: axisAligned(m) }; });
  return { items, box: selBox() };
}
// S: fattore per asse, A: punto fisso per asse
function applyScale(st, S, A) {
  const W = ['x', 'y', 'z'], KEYS = ['w', 'd', 'h'];
  for (const it of st.items) {
    const fl = [1, 1, 1];
    W.forEach((ax, a) => { fl[it.loc[a]] = S[ax]; });
    KEYS.forEach((k, i) => { if (fl[i] !== 1) setSize(it.m, k, Math.max(0.1, it.s0[k] * fl[i])); });
    W.forEach(ax => { it.m.position[ax] = A[ax] + (it.p0[ax] - A[ax]) * S[ax]; });
    it.m.updateMatrixWorld(true);
  }
  touch(); syncPanel(); updateHandles();
}
const groupAnchors = b => ({ x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2, z: b.min.z });
// nuova lunghezza di un asse (campi del pannello e maniglie): con il lucchetto scalano tutti e tre
function scaleSelAxis(st, ax, newLen, anchor, uniform = sizeLock, center = false) {
  const b = st.box, len0 = b.max[ax] - b.min[ax];
  if (len0 < 1e-6 || newLen < 0.1) return;
  if (st.items.some(it => !it.aligned)) uniform = true;
  const f = newLen / len0;
  const S = { x: 1, y: 1, z: 1 };
  if (uniform) S.x = S.y = S.z = f; else S[ax] = f;
  const A = center ? { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2, z: (b.min.z + b.max.z) / 2 } : groupAnchors(b);
  if (!center && anchor !== undefined) A[ax] = anchor;
  applyScale(st, S, A);
}
function offsetFace(hd, mm) {
  if (hd.oriented) {
    scaleOriented(hd, Math.max(0.5, hd.s0[AXK[hd.axis]] + mm), sizeLock, false);
    touch(); syncPanel(); updateHandles(); commit();
    return;
  }
  if (hd.group) {
    const st = startScale(), b = st.box, ax = hd.axis;
    const len0 = b[ 'max'][ax] - b['min'][ax];
    scaleSelAxis(st, ax, Math.max(0.5, len0 + mm), hd.sign > 0 ? b.min[ax] : b.max[ax]);
    touch(); syncPanel(); updateHandles(); commit();
    return;
  }
  const { m, axis, sign } = hd;
  if (!objects.includes(m)) return;
  const k = { x: 'w', y: 'd', z: 'h' }[axis], sz = sizeOf(m), p = m.position;
  const lo = axis === 'z' ? p.z : p[axis] - sz[k] / 2, hi = lo + sz[k];
  let nlo = lo, nhi = hi;
  if (sign > 0) nhi = Math.max(hi + mm, lo + 0.5); else nlo = Math.min(lo - mm, hi - 0.5);
  setSize(m, k, nhi - nlo);
  if (axis === 'z') m.position.z = nlo; else m.position[axis] = (nlo + nhi) / 2;
  m.updateMatrixWorld(true);
  touch(); syncPanel(); updateHandles(); commit();
}
// clic su una maniglia: campo per allungare/accorciare di tot mm
let hpop = null;
const hpopEl = $('#hpop'), hpopIn = $('#hpop-val');
function openHandlePopup(hd, handle) {
  hpop = hd;
  const chip = $('#hpop-chip');
  chip.textContent = hd.axis.toUpperCase() + (hd.sign > 0 ? '+' : '−');
  chip.style.background = AXIS_COLOR[hd.axis];
  hpopIn.value = '';
  hpopIn.step = state.snap;
  hpopEl.classList.remove('hidden');
  const v = handle.position.clone().project(camera);
  const x = (v.x * 0.5 + 0.5) * window.innerWidth, y = (-v.y * 0.5 + 0.5) * window.innerHeight;
  hpopEl.style.left = clamp(x + 18, 8, window.innerWidth - 250) + 'px';
  hpopEl.style.top = clamp(y - 20, 8, window.innerHeight - 56) + 'px';
  hpopIn.focus();
}
function closeHandlePopup() { hpop = null; hpopEl.classList.add('hidden'); }
hpopIn.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const v = parseFloat(hpopIn.value), hd = hpop;
    closeHandlePopup(); canvas.focus();
    if (hd && Number.isFinite(v) && v !== 0) offsetFace(hd, v);
  } else if (e.key === 'Escape') { closeHandlePopup(); canvas.focus(); }
});
hpopIn.addEventListener('blur', () => setTimeout(closeHandlePopup, 120));
function handlesAvailable() {
  return selection.length >= 1 && !state.space && state.tool === 'move';
}
const orientedSingle = () => selection.length === 1 && !axisAligned(selection[0]);
function scaleOriented(hd, newLen, uniform, center) {
  const { m, k, s0, p0, q } = hd, key = AXK['xyz'[k]];
  const len0 = s0[key];
  if (!(newLen >= 0.1) || len0 < 1e-6) return;
  const f = newLen / len0, fl = uniform ? [f, f, f] : [1, 1, 1];
  if (!uniform) fl[k] = f;
  const a = new THREE.Vector3(0, 0, center ? s0.h / 2 : 0);
  if (!center) {
    const half = k === 2 ? 0 : s0[key] / 2;
    // faccia opposta a quella trascinata
    a.setComponent(k, k === 2 ? (hd.sign > 0 ? 0 : s0.h) : -hd.sign * half);
  }
  ['w', 'd', 'h'].forEach((kk, i) => { if (fl[i] !== 1) setSize(m, kk, Math.max(0.1, s0[kk] * fl[i])); });
  const R = new THREE.Matrix4().makeRotationFromQuaternion(q);
  const sh = new THREE.Vector3(a.x * (1 - fl[0]), a.y * (1 - fl[1]), a.z * (1 - fl[2])).applyMatrix4(R);
  m.position.copy(p0).add(sh);
  m.updateMatrixWorld(true);
  touch(); syncPanel(); updateHandles();
}
function updateHandles() {
  if (!handlesAvailable()) { HANDLES.forEach(h => (h.visible = false)); dirty = true; return; }
  if (orientedSingle()) {
    const m = selection[0], s = sizeOf(m), R = new THREE.Matrix4().makeRotationFromQuaternion(m.quaternion);
    HANDLES.forEach(h => {
      const { axis, sign } = h.userData, k = 'xyz'.indexOf(axis);
      const l = new THREE.Vector3(0, 0, s.h / 2);
      l[axis] = axis === 'z' ? (sign > 0 ? s.h : 0) : sign * s[AXK[axis]] / 2;
      h.position.copy(l.applyMatrix4(R).add(m.position));
      h.visible = true;
    });
    dirty = true;
    return;
  }
  let min, max;
  if (selection.length > 1 || selection[0].quaternion.angleTo(_qId) > 1e-6) { const b = selBox(); min = b.min; max = b.max; }
  else { const m = selection[0], s = sizeOf(m), p = m.position; min = { x: p.x - s.w / 2, y: p.y - s.d / 2, z: p.z }; max = { x: p.x + s.w / 2, y: p.y + s.d / 2, z: p.z + s.h }; }
  const c = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 };
  HANDLES.forEach(h => {
    const { axis, sign } = h.userData;
    h.position.set(c.x, c.y, c.z);
    h.position[axis] = sign > 0 ? max[axis] : min[axis];
    h.visible = true;
  });
  dirty = true;
}
// punto della retta-asse più vicino al raggio del mouse
function axisParam(origin, axis, ray) {
  const u = new THREE.Vector3(); if (typeof axis === 'string') u[axis] = 1; else u.copy(axis);
  const w0 = origin.clone().sub(ray.origin);
  const b = u.dot(ray.direction), d = u.dot(w0), e = ray.direction.dot(w0);
  const den = 1 - b * b;
  if (Math.abs(den) < 1e-4) return null;
  return (b * e - d) / den;
}

/* --------------------------------------------------------- interazione */
const raycaster = new THREE.Raycaster();
raycaster.firstHitOnly = true;
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;
const ndc = new THREE.Vector2();
const ground = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
function setRay(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
}
function pickObject(e) {
  setRay(e);
  const hit = raycaster.intersectObjects(objects.filter(o => o.visible && !o.userData.locked), false)[0];
  return hit ? hit.object : null;
}
function pickHit(e) {
  setRay(e);
  return raycaster.intersectObjects(objects.filter(o => o.visible && !o.userData.locked), false)[0] ?? null;
}
function pickHandle(e) {
  if (!HANDLES[0].visible) return null;
  setRay(e);
  return raycaster.intersectObjects(HANDLES, false)[0]?.object ?? null;
}
function groundPoint(e) {
  setRay(e);
  return raycaster.ray.intersectPlane(ground, new THREE.Vector3());
}
const snapV = v => Math.round(v / state.snap) * state.snap;

let drag = null;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  canvas.focus();
  canvas.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, mode: 'orbit', shift: e.shiftKey };
  if (e.button === 1 || state.space || state.tool === 'hand') drag.mode = 'pan';
  else if (e.button === 2 || state.tool === 'orbit') drag.mode = 'orbit';
  else if (state.tool === 'rotate') {
    const ax = pickRing(e);
    if (ax) {
      const c = selBox().getCenter(new THREE.Vector3()), axis = AXV[ax];
      const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(axis, c);
      const p = raycaster.ray.intersectPlane(pl, new THREE.Vector3());
      if (p) { drag.mode = 'rotate'; drag.rot = { ax, axis, c, pl, v0: p.sub(c), items: startRot(), delta: 0 }; return; }
    }
    const hit = pickObject(e);
    if (hit && !selection.includes(hit)) setSelection(withGroups([hit]));
    drag.mode = 'orbit'; drag.emptyClick = !hit;
  }
  else if (state.tool === 'edge') {
    if (edgeHandle.visible) {
      setRay(e);
      if (raycaster.intersectObject(edgeHandle, false)[0]) { const es = startEdgeScale(); if (es) { drag.mode = 'edgescale'; drag.es = es; hideHover(); return; } }
    }
    drag.mode = 'orbit'; drag.edgeHit = pickHit(e); drag.emptyClick = !drag.edgeHit;
  }
  else if (state.tool === 'ruler') {
    drag.mode = 'orbit'; drag.rulerHit = pickHit(e);
  }
  else if (state.tool === 'face') {
    if (faceHandle.visible) {
      setRay(e);
      if (raycaster.intersectObject(faceHandle, false)[0]) { drag.mode = 'facepush'; drag.fd = startFaceDrag(e); hideHover(); return; }
    }
    const hit = pickHit(e);
    drag.mode = 'orbit';
    drag.faceHit = hit;
    drag.emptyClick = !hit;
  } else {
    const h = pickHandle(e);
    if (h) {
      const { axis, sign } = h.userData;
      drag.mode = 'handle'; drag.handle = h;
      if (orientedSingle()) {
        const m = selection[0], k = 'xyz'.indexOf(axis);
        const dir = new THREE.Vector3(); dir[axis] = 1; dir.applyQuaternion(m.quaternion);
        drag.h = { oriented: true, m, k, axis, sign, s0: { ...sizeOf(m) }, p0: m.position.clone(), q: m.quaternion.clone(), dir, origin: h.position.clone() };
        drag.t0 = axisParam(h.position, dir, raycaster.ray) ?? 0;
        return;
      }
      const st = startScale();
      drag.h = { group: true, st, axis, sign, lo: st.box.min[axis], hi: st.box.max[axis], origin: h.position.clone() };
      drag.t0 = axisParam(h.position, axis, raycaster.ray) ?? 0;
      return;
    }
    const hit = pickObject(e);
    drag.hit = hit;
    if (hit) {
      drag.ray0 = raycaster.ray.clone();
      drag.mode = 'move';
      if (e.metaKey || e.ctrlKey) {
        drag.vert = true;
        if (!selection.includes(hit)) setSelection(withGroups([hit]));
      } else if (e.shiftKey) {
        drag.toggle = true;
      } else if (!selection.includes(hit)) setSelection(withGroups([hit]));
      else drag.keyClick = selection.length > 1;
      if (e.altKey && !drag.toggle) { duplicateSelection(false); drag.hit = selection[0]; }
      const gp = groundPoint(e);
      drag.gp = gp;
      drag.start = new Map(selection.map(m => [m, m.position.clone()]));
    } else drag.emptyClick = true;
  }
  updateCursor(true);
});
canvas.addEventListener('pointermove', e => {
  if (!drag) {
    if (state.tool === 'edge' && !state.space) { updateEdgeHover(e); if (edgeHandle.visible) { setRay(e); if (raycaster.intersectObject(edgeHandle, false)[0]) canvas.style.cursor = 'pointer'; } }
    else if (state.tool === 'face' && !state.space) { updateHover(e); if (faceHandle.visible) { setRay(e); canvas.style.cursor = raycaster.intersectObject(faceHandle, false)[0] ? 'pointer' : 'crosshair'; } } else hideHover();
    if (HANDLES[0].visible && state.tool === 'move' && !state.space) canvas.style.cursor = pickHandle(e) ? 'pointer' : 'default';
    return;
  }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 3) return;
  drag.moved = true;
  drag.x = e.clientX; drag.y = e.clientY;
  if (drag.mode === 'pan') panPixels(dx, dy);
  else if (drag.mode === 'orbit') orbitPixels(dx, dy);
  else if (drag.mode === 'facepush') moveFaceDrag(e, drag.fd);
  else if (drag.mode === 'edgescale') moveEdgeScale(e, drag.es);
  else if (drag.mode === 'rotate') {
    const r = drag.rot; setRay(e);
    const p = raycaster.ray.intersectPlane(r.pl, new THREE.Vector3());
    if (!p) return;
    const v = p.sub(r.c);
    let ang = Math.atan2(r.axis.dot(new THREE.Vector3().crossVectors(r.v0, v)), r.v0.dot(v));
    if (!e.altKey) { const st = (e.shiftKey ? 5 : 15) * D2R; ang = Math.round(ang / st) * st; }
    r.delta = ang;
    applyRot(r.items, r.axis, ang, r.c);
    const sp = r.c.clone().project(camera);
    dragRead.style.display = 'block';
    dragRead.style.left = e.clientX + 18 + 'px'; dragRead.style.top = e.clientY - 12 + 'px';
    const dg = Math.round(ang / D2R * 10) / 10;
    dragRead.textContent = `${r.ax.toUpperCase()} ${dg > 0 ? '+' : ''}${fmt(dg)}°`;
  }
  else if (drag.mode === 'move' && !drag.vert) {
    if (drag.toggle && !selection.includes(drag.hit)) {
      setSelection(withGroups([drag.hit]));
      drag.start = new Map(selection.map(m => [m, m.position.clone()]));
      drag.gp = groundPoint(e);
    }
    const gp = groundPoint(e);
    if (!gp || !drag.gp) return;
    const raw = gp.clone().sub(drag.gp);
    if (raw.length() > 2000) return;
    const base = drag.start.get(drag.hit) ?? [...drag.start.values()][0];
    let dxs = snapV(base.x + raw.x) - base.x, dys = snapV(base.y + raw.y) - base.y;
    // ⇧ = blocca sull'asse X o Y (quello in cui ti sei mosso di più)
    if (e.shiftKey) { if (Math.abs(raw.x) >= Math.abs(raw.y)) dys = 0; else dxs = 0; }
    drag.start.forEach((p0, m) => { m.position.set(p0.x + dxs, p0.y + dys, p0.z); m.updateMatrixWorld(true); });
    touch(); syncPanel(); updateHandles();
  } else if (drag.mode === 'move' && drag.vert) {
    moveVertical(e);
  } else if (drag.mode === 'handle') {
    setRay(e);
    if (drag.h.oriented) {
      const hd = drag.h, t = axisParam(hd.origin, hd.dir, raycaster.ray);
      if (t === null) return;
      const len0 = hd.s0[AXK[hd.axis]];
      const newLen = Math.max(0.5, len0 * 0.03, snapV(len0 + (e.altKey ? 2 : 1) * hd.sign * (t - drag.t0)));
      scaleOriented(hd, newLen, sizeLock ? !e.shiftKey : e.shiftKey, e.altKey);
      return;
    }
    const t = axisParam(drag.h.origin, drag.h.axis, raycaster.ray);
    if (t === null) return;
    const { st, axis, sign, lo, hi } = drag.h;
    const face = snapV((sign > 0 ? hi : lo) + (t - drag.t0));
    const delta = sign * (face - (sign > 0 ? hi : lo)), len0 = hi - lo;
    // ⇧ = proporzionale su tutti gli assi (con il lucchetto attivo fa l'inverso: libero), ⌥ = dal centro
    scaleSelAxis(st, axis, Math.max(0.5, len0 * 0.03, len0 + (e.altKey ? 2 : 1) * delta), sign > 0 ? lo : hi, sizeLock ? !e.shiftKey : e.shiftKey, e.altKey);
  }
});
canvas.addEventListener('pointerup', e => {
  if (!drag) return;
  const d = drag; drag = null;
  updateCursor(false);
  if (d.mode === 'rotate') { dragRead.style.display = 'none'; if (d.moved && d.rot.delta !== 0) commit(); return; }
  if (d.mode === 'edgescale') {
    dragRead.style.display = 'none'; ringPrev.visible = false;
    if (d.moved && d.es.f !== 1) applyEdgeScale(d.es.f * 100); else updateEdgeHandle();
    return;
  }
  if (d.mode === 'facepush') {
    const dist = d.fd.dist;
    if (d.fd.fs.full && ['cylinder', 'cone'].includes(d.fd.fs.obj.userData.kind)) { d.fd.fs.obj.scale.set(1, 1, 1); selMeshes.forEach(m => { m.visible = true; }); }
    if (d.moved && Math.abs(dist) > 1e-4) applyPush(dist); else { selMeshes.forEach(m => m.position.set(0, 0, 0)); updateFaceHandle(); TF.push.focus(); }
    return;
  }
  if (state.tool === 'ruler' && d.mode === 'orbit' && !d.moved) { rulerClick(d.rulerHit); return; }
  if (state.tool === 'edge' && d.mode === 'orbit' && !d.moved) {
    if (d.edgeHit) selectEdgeAt(d.edgeHit, d.shift); else if (!d.shift) clearEdges();
    return;
  }
  if (state.tool === 'face' && d.mode === 'orbit' && !d.moved) {
    if (d.faceHit) selectFaceFromHit(d.faceHit, d.shift); else if (d.emptyClick && !d.shift) clearFace();
    return;
  }
  if (d.mode === 'move') {
    if (d.toggle && !d.moved) {
      const grp = withGroups([d.hit]);
      setSelection(selection.includes(d.hit) ? selection.filter(m => !grp.includes(m)) : [...new Set([...selection, ...grp])]);
    } else if (d.moved) commit();
    else if (d.keyClick) {
      keyObj = keyObj === d.hit ? null : d.hit;
      objects.forEach(styleObject); syncPanel(); dirty = true;
      if (keyObj) toast(`Oggetto chiave: ${keyObj.userData.name}`);
    }
  } else if (d.mode === 'handle') { if (d.moved) commit(); else openHandlePopup(d.h, d.handle); }
  else if (d.emptyClick && !d.moved && !d.shift) setSelection([]);
});
function moveVertical(e) {
  const d = drag;
  if (!d.vstart) {
    const objs = selection.includes(d.hit) ? selection : [d.hit];
    d.vstart = new Map(objs.map(m => [m, m.position.clone()]));
    const p0 = d.hit.position.clone(); p0.z += sizeOf(d.hit).h / 2;
    const dir = new THREE.Vector3(camera.position.x - p0.x, camera.position.y - p0.y, 0);
    d.vplane = dir.lengthSq() > 1 ? new THREE.Plane().setFromNormalAndCoplanarPoint(dir.normalize(), p0) : null;
    const z0 = d.vplane ? d.ray0.intersectPlane(d.vplane, new THREE.Vector3()) : null;
    d.vz0 = z0 ? z0.z : null;
    d.vy0 = d.sy;
  }
  setRay(e);
  const hit = d.vplane ? raycaster.ray.intersectPlane(d.vplane, new THREE.Vector3()) : null;
  const dz = hit && d.vz0 !== null ? hit.z - d.vz0 : -(e.clientY - d.vy0) * worldPerPixel();
  const base = d.vstart.get(d.hit) ?? [...d.vstart.values()][0];
  const ddz = snapV(base.z + dz) - base.z;
  d.vstart.forEach((p0, m) => { m.position.z = p0.z + ddz; m.updateMatrixWorld(true); });
  touch(); syncPanel(); updateHandles();
}
canvas.addEventListener('dblclick', e => {
  const hit = pickObject(e);
  if (hit) animateTo({ target: worldBox(hit).getCenter(new THREE.Vector3()) });
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const { deltaX: dx, deltaY: dy } = e;
  if (e.ctrlKey) return zoom(Math.exp(dy * 0.01)); // pizzico sul trackpad
  if (e.altKey) return zoom(Math.exp((dy || dx) * 0.006)); // ⌥ + scorrimento: zoom con qualsiasi dispositivo
  const mouseWheel = e.deltaMode === 1 || (dx === 0 && Number.isInteger(dy) && Math.abs(dy) >= 50);
  if (mouseWheel && !e.shiftKey) return zoom(Math.exp(dy * 0.0012));
  if (e.shiftKey || state.space) panPixels(-dx, -dy);
  else orbitPixels(-dx, -dy);
}, { passive: false });
let gDist = 0;
canvas.addEventListener('gesturestart', e => { e.preventDefault(); gDist = cam.dist; });
canvas.addEventListener('gesturechange', e => { e.preventDefault(); cam.dist = clamp(gDist / e.scale, 15, 3000); applyCamera(); });
function updateCursor(grabbing) {
  const pan = state.space || state.tool === 'hand';
  canvas.style.cursor = pan ? (grabbing ? 'grabbing' : 'grab') : state.tool === 'orbit' ? 'move' : state.tool === 'rotate' ? 'crosshair' : state.tool === 'face' || state.tool === 'edge' || state.tool === 'ruler' ? 'crosshair' : 'default';
}

/* ------------------------------------------------------------- pannello */
/* ---------------------------------------------------------------- rotazione */
const _qId = new THREE.Quaternion(), _eu = new THREE.Euler();
// Angoli come in Blender: prima X, poi Y, poi Z (attorno agli assi del piatto). Ordine 'ZYX' di three.
const _rm = new THREE.Matrix4();
const eulerDeg = m => {
  const e = _rm.makeRotationFromQuaternion(m.quaternion).elements; // colonne: e[0..3] = prima colonna
  const m31 = Math.max(-1, Math.min(1, e[2]));
  let x, y = Math.asin(-m31), z;
  if (Math.abs(m31) < 0.99999) { x = Math.atan2(e[6], e[10]); z = Math.atan2(e[1], e[0]); }
  else { x = Math.atan2(-e[9], e[5]); z = 0; }   // cardano bloccato: tutto sulla X, Z a zero
  const r = v => Math.round(v / D2R * 100) / 100 + 0;
  return { rx: r(x), ry: r(y), rz: r(z) };
};
function setEulerDeg(m, rx, ry, rz) {
  const b0 = worldBox(m), c0 = b0.getCenter(new THREE.Vector3()), grounded = Math.abs(b0.min.z) < 0.02;
  m.quaternion.setFromEuler(new THREE.Euler(rx * D2R, ry * D2R, rz * D2R, 'ZYX'));
  m.updateMatrixWorld(true);
  m.position.add(c0.sub(worldBox(m).getCenter(new THREE.Vector3())));
  m.updateMatrixWorld(true);
  if (grounded) { m.position.z -= worldBox(m).min.z; m.updateMatrixWorld(true); }
}
const AXV = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
// se l'oggetto era appoggiato sul piatto, resta appoggiato anche dopo la rotazione
function startRot() {
  const grounded = selection.length > 0 && Math.abs(selBox().min.z) < 0.02;
  return Object.assign(selection.map(m => ({ m, p0: m.position.clone(), q0: m.quaternion.clone() })), { grounded });
}
function applyRot(items, axis, ang, c) {
  const q = new THREE.Quaternion().setFromAxisAngle(axis, ang);
  for (const it of items) {
    it.m.quaternion.copy(q).multiply(it.q0);
    it.m.position.copy(it.p0).sub(c).applyQuaternion(q).add(c);
    it.m.updateMatrixWorld(true);
  }
  if (items.grounded) {
    const dz = -selBox().min.z;
    if (Math.abs(dz) > 1e-6) items.forEach(it => { it.m.position.z += dz; it.m.updateMatrixWorld(true); });
  }
  touch(); syncPanel(); updateHandles();
}
// dopo i quarti di giro toglie il rumore numerico: la matrice di rotazione torna fatta solo di 0, 1 e -1
function snapQuat(m) {
  const e = new THREE.Matrix4().makeRotationFromQuaternion(m.quaternion).elements;
  const R = [0, 1, 2, 4, 5, 6, 8, 9, 10];
  if (!R.every(i => Math.abs(e[i] - Math.round(e[i])) < 1e-4)) return;
  R.forEach(i => { e[i] = Math.round(e[i]); });
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().fromArray(e)); m.updateMatrixWorld(true);
}
function rotateSelection(ax, deg) {
  if (!selection.length) return;
  const c = selBox().getCenter(new THREE.Vector3());
  applyRot(startRot(), AXV[ax], deg * D2R, c);
  selection.forEach(snapQuat);
  commit();
}
// anelli di rotazione (strumento Ruota)
const rotGizmo = new THREE.Group(); rotGizmo.visible = false; scene.add(rotGizmo);
const rotRings = {}, rotPick = [];
for (const ax of ['x', 'y', 'z']) {
  const vis = new THREE.Mesh(new THREE.TorusGeometry(1, 0.013, 8, 128), new THREE.MeshBasicMaterial({ color: AXIS_COLOR[ax], transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }));
  const pick = new THREE.Mesh(new THREE.TorusGeometry(1, 0.2, 6, 48), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, depthTest: false }));
  for (const mm of [vis, pick]) { mm.renderOrder = 997; if (ax === 'x') mm.rotation.y = Math.PI / 2; else if (ax === 'y') mm.rotation.x = Math.PI / 2; }
  pick.userData.axis = ax; rotGizmo.add(vis, pick); rotPick.push(pick); rotRings[ax] = vis;
}
function updateRotGizmo() {
  const on = state.tool === 'rotate' && selection.length > 0;
  rotGizmo.visible = on;
  if (on) {
    const b = selBox(), c = b.getCenter(new THREE.Vector3());
    rotGizmo.position.copy(c);
    // dimensione costante sullo schermo: raggio ~64 px, zona cliccabile molto più larga della grafica
    const d = camera.position.distanceTo(c);
    rotGizmo.scale.setScalar(2 * d * Math.tan(camera.fov * D2R / 2) / canvas.clientHeight * 64);
  }
  dirty = true;
}
function pickRing(e) {
  if (!rotGizmo.visible) return null;
  setRay(e);
  return raycaster.intersectObjects(rotPick, false)[0]?.object.userData.axis ?? null;
}
const ids = ['x', 'y', 'z', 'w', 'd', 'h', 'r', 'ft', 'fb', 't', 'q', 'rx', 'ry', 'rz'];
const F = Object.fromEntries(ids.map(i => [i, $('#p-' + i)]));
const single = () => (selection.length === 1 ? selection[0] : null);
function syncPanel() {
  const panel = $('#props');
  panel.classList.toggle('hidden', selection.length === 0 && state.tool !== 'edge');
  if (!selection.length && state.tool === 'edge') { $('#p-edge').classList.remove('hidden'); $('#p-obj').classList.add('hidden'); $('#p-face').classList.add('hidden'); updateEdgePanel(); return; }
  if (!selection.length) return;
  $('#p-edge').classList.toggle('hidden', state.tool !== 'edge');
  if (state.tool === 'edge') { $('#p-obj').classList.add('hidden'); $('#p-face').classList.add('hidden'); updateEdgePanel(); return; }
  $('#p-obj').classList.toggle('hidden', !!faceSel);
  $('#p-face').classList.toggle('hidden', !faceSel);
  if (faceSel) { updateFacePanel(); return; }
  const m = single();
  $('#p-single').classList.toggle('hidden', !m);
  $('#p-multi').classList.toggle('hidden', !!m);
  const allHole = selection.every(o => o.userData.hole);
  document.querySelectorAll('#p-type button').forEach(b => b.classList.toggle('on', (b.dataset.v === 'hole') === allHole));
  syncColor(); syncTextPanel();
  const nameEl = $('#p-name');
  if (m) {
    if (document.activeElement !== nameEl) nameEl.value = m.userData.name;
    nameEl.disabled = false;
    const s = sizeOf(m), v = { x: m.position.x, y: m.position.y, z: m.position.z, w: s.w, d: s.d, h: s.h, r: m.userData.p.r ?? 0, ft: m.userData.p.ft ?? 0, fb: m.userData.p.fb ?? 0, t: m.userData.p.t ?? 100, q: m.userData.p.q ?? 0, ...eulerDeg(m) };
    ids.forEach(i => { if (document.activeElement !== F[i]) F[i].value = fmt(v[i]); });
    $('#p-r-wrap').classList.toggle('hidden', m.userData.kind !== 'box');
    document.querySelectorAll('#p-rm button').forEach(b => b.classList.toggle('on', (m.userData.p.rm === 'chamfer') === (b.dataset.v === 'chamfer')));
    $('#p-split').classList.toggle('hidden', m.userData.kind !== 'merged');
    $('#p-t-wrap').classList.toggle('hidden', !['box', 'cylinder', 'prism'].includes(m.userData.kind));
    const qs = QSPEC[m.userData.kind];
    $('#p-q-wrap').classList.toggle('hidden', !qs);
    if (qs) { const lab = $('#p-q-lab'); if (lab.dataset.k !== m.userData.kind) { lab.dataset.k = m.userData.kind; lab.firstChild.data = qs[0]; F.q.min = qs[1]; F.q.max = qs[2]; F.q.step = m.userData.kind === 'prism' ? 1 : 5; } }
  } else {
    const gb = selBox(), gs = gb.getSize(new THREE.Vector3());
    [['w', 'x'], ['d', 'y'], ['h', 'z']].forEach(([id, ax]) => { const el = $('#g-' + id); if (document.activeElement !== el) el.value = fmt(gs[ax]); });
    nameEl.value = isOneGroup() ? `Gruppo · ${selection.length} oggetti` : `${selection.length} oggetti`;
    nameEl.disabled = true;
  }
  const nUnits = new Set(selection.map(o => o.userData.gid ?? o)).size;
  $('#p-key').textContent = nUnits < 2 ? 'Allinea al piatto.'
    : keyObj ? `Oggetto chiave: ${keyObj.userData.name}. Clicca un altro oggetto selezionato per cambiarlo.`
    : 'Allineo alla selezione. Per scegliere un oggetto chiave, clicca uno degli oggetti selezionati.';
}
let gScale = null;
['x', 'y', 'z'].forEach(ax => {
  const el = $('#g-' + { x: 'w', y: 'd', z: 'h' }[ax]);
  el.addEventListener('input', () => {
    const v = parseFloat(el.value);
    if (!(v > 0) || selection.length < 2) return;
    const sig = () => selection.map(m => m.userData.id + m.position.toArray().join() + m.quaternion.toArray().join()).join('|');
    if (!gScale || gScale.sig !== sig()) { gScale = startScale(); gScale.sig = sig(); }
    scaleSelAxis(gScale, ax, v, undefined, sizeLock && !shiftDown);
    gScale.sig = sig();
  });
  el.addEventListener('focus', () => { gScale = null; });
  el.addEventListener('blur', () => { gScale = null; });
  el.addEventListener('change', () => { gScale = null; syncPanel(); commit(); });
  el.addEventListener('keydown', e => { if (e.key === 'Enter') el.blur(); });
});
let sizeLock = false, shiftDown = false;
window.addEventListener('keydown', e => { if (e.key === 'Shift') shiftDown = true; });
window.addEventListener('keyup', e => { if (e.key === 'Shift') shiftDown = false; });
window.addEventListener('blur', () => { shiftDown = false; });
try { sizeLock = localStorage.getItem('forma.lock') === '1'; } catch (e) {}
function syncLock() { ['#p-lock', '#g-lock'].forEach(id => { $(id).classList.toggle('on', sizeLock); $(id).setAttribute('aria-pressed', sizeLock); }); }
// con il lucchetto le tre misure cambiano in proporzione, partendo da quelle di inizio modifica
function setSizeProp(m, key, v, s0) {
  const r = v / s0[key];
  for (const k of ['w', 'd', 'h']) setSize(m, k, k === key ? v : s0[k] * r);
  const c0 = m.userData.lockC;
  if (c0) { m.position.x = c0.x; m.position.y = c0.y; }
}
function bind(id, apply) {
  const el = F[id];
  el.addEventListener('input', () => {
    const m = single(), v = parseFloat(el.value);
    if (!m || !Number.isFinite(v)) return;
    if (sizeLock && !shiftDown && 'wdh'.includes(id) && id.length === 1 && v > 0) {
      if (!m.userData.lockS) { m.userData.lockS = { ...sizeOf(m) }; m.userData.lockC = m.position.clone(); }
      setSizeProp(m, id, v, m.userData.lockS);
    } else apply(m, v);
    m.updateMatrixWorld(true);
    touch(); updateHandles(); syncPanel();
  });
  el.addEventListener('change', () => { if (single()) { delete single().userData.lockS; delete single().userData.lockC; } syncPanel(); commit(); });
  el.addEventListener('keydown', e => { if (e.key === 'Enter') el.blur(); });
}
bind('x', (m, v) => (m.position.x = v));
bind('y', (m, v) => (m.position.y = v));
bind('z', (m, v) => (m.position.z = v));
bind('w', (m, v) => setSize(m, 'w', v));
bind('d', (m, v) => setSize(m, 'd', v));
bind('h', (m, v) => setSize(m, 'h', v));
bind('r', (m, v) => setRadius(m, v));
bind('q', (m, v) => setQ(m, v));
bind('t', (m, v) => setTop(m, v));
bind('ft', (m, v) => setBoxEdge(m, 'ft', v));
bind('fb', (m, v) => setBoxEdge(m, 'fb', v));
document.querySelectorAll('#p-rm button').forEach(b => b.addEventListener('click', () => {
  const m = single(); if (!m || m.userData.kind !== 'box') return;
  m.userData.p.rm = b.dataset.v === 'chamfer' ? 'chamfer' : null;
  m.geometry.dispose(); m.geometry = buildGeometry('box', m.userData.p); refreshEdges(m); m.updateMatrixWorld(true);
  touch(); updateHandles(); syncPanel(); commit();
}));
['rx', 'ry', 'rz'].forEach(id => bind(id, m => setEulerDeg(m, +F.rx.value || 0, +F.ry.value || 0, +F.rz.value || 0)));
['#p-lock', '#g-lock'].forEach(id => $(id).addEventListener('click', () => {
  sizeLock = !sizeLock; syncLock();
  try { localStorage.setItem('forma.lock', sizeLock ? '1' : '0'); } catch (e) {}
  toast(sizeLock ? 'Proporzioni bloccate: le misure cambiano insieme' : 'Proporzioni libere');
}));
syncLock();
$('#p-split').addEventListener('click', splitPieces);
$('#p-ground').addEventListener('click', () => {
  const m = single();
  if (m) { m.position.z -= worldBox(m).min.z; m.updateMatrixWorld(true); touch(); syncPanel(); updateHandles(); commit(); }
});
$('#p-name').addEventListener('input', e => { const m = single(); if (m) m.userData.name = e.target.value; });
$('#p-name').addEventListener('change', commit);
$('#p-name').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
$('#p-type').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || !selection.length) return;
  const wantHole = b.dataset.v === 'hole';
  if (selection.every(m => m.userData.hole === wantHole)) return;
  toggleHole();
});

/* ---------------------------------------------------- misure reali (M) */
const labelsEl = $('#labels');
const dimLabels = [0, 1, 2].map(() => { const d = document.createElement('div'); d.className = 'dim-label'; labelsEl.appendChild(d); return d; });
const dimBox = new THREE.Box3();
const wireGeo = new THREE.BufferGeometry();
wireGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
const dimWire = new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: 0xff6a00, transparent: true, opacity: 0.55, depthTest: false }));
const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 3), 3));
const dimLines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0xff6a00, depthTest: false }));
dimWire.renderOrder = dimLines.renderOrder = 900;
dimWire.visible = dimLines.visible = false;
scene.add(dimWire, dimLines);
function updateDims() {
  const show = state.dims && objects.length > 0;
  dimWire.visible = dimLines.visible = show;
  if (!show) { dimLabels.forEach(l => (l.style.display = 'none')); return; }
  if (dimsDirty) {
    dimBox.makeEmpty();
    (selection.length ? selection : objects).forEach(m => dimBox.union(worldBox(m)));
    const { min: a, max: b } = dimBox;
    const P = [[a.x, a.y, a.z], [b.x, a.y, a.z], [b.x, b.y, a.z], [a.x, b.y, a.z], [a.x, a.y, b.z], [b.x, a.y, b.z], [b.x, b.y, b.z], [a.x, b.y, b.z]];
    const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    const arr = wireGeo.attributes.position.array;
    E.forEach(([i, j], n) => arr.set([...P[i], ...P[j]], n * 6));
    wireGeo.attributes.position.needsUpdate = true;
    dimsDirty = false;
  }
  const { min: a, max: b } = dimBox;
  const c = dimBox.getCenter(new THREE.Vector3()), s = dimBox.getSize(new THREE.Vector3());
  const nx = camera.position.x > c.x ? b.x : a.x, ny = camera.position.y > c.y ? b.y : a.y;
  const ox = nx === b.x ? 1 : -1, oy = ny === b.y ? 1 : -1;
  const segs = [
    [[a.x, ny, a.z], [b.x, ny, a.z], [c.x, ny + oy * 5, a.z], s.x],
    [[nx, a.y, a.z], [nx, b.y, a.z], [nx + ox * 5, c.y, a.z], s.y],
    [[nx, ny, a.z], [nx, ny, b.z], [nx + ox * 4, ny + oy * 4, c.z], s.z],
  ];
  const la = lineGeo.attributes.position.array;
  const w = window.innerWidth, h = window.innerHeight;
  segs.forEach(([p, q, lab, val], i) => {
    la.set([...p, ...q], i * 6);
    const v = new THREE.Vector3(...lab).project(camera);
    const el = dimLabels[i];
    if (v.z > 1 || v.z < -1) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.textContent = `${fmt(val)} mm`;
    el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%,-50%)`;
  });
  lineGeo.attributes.position.needsUpdate = true;
}
function setDims(on) {
  state.dims = on ?? !state.dims;
  $('#b-dims').classList.toggle('on', state.dims);
  dimsDirty = dirty = true;
  if (state.dims && !objects.length) toast('Aggiungi una forma per vedere le misure');
}

/* ---------------------------------------------------------------- export */
function exportList() {
  const sel = selection.filter(m => !m.userData.hole);
  return sel.length ? sel : objects.filter(m => !m.userData.hole && !m.userData.hidden);
}
const exportName = list => (list.length === 1 ? list[0].userData.name : 'filo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'filo';
function download(data, type, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function exportSTL(nameArg) {
  const list = exportList();
  if (!list.length) return toast('Niente da esportare: aggiungi almeno un solido');
  const g = new THREE.Group();
  list.forEach(m => {
    const c = new THREE.Mesh(m.geometry, M.solid);
    c.position.copy(m.position); c.quaternion.copy(m.quaternion); c.scale.copy(m.scale);
    g.add(c);
  });
  g.updateMatrixWorld(true);
  const data = new STLExporter().parse(g, { binary: true });
  const name = nameArg || exportName(list);
  download(data, 'model/stl', `${name}.stl`);
  toast(`Esportato ${name}.stl (${list.length} ${list.length === 1 ? 'pezzo' : 'pezzi'})`);
  return data;
}
// 3MF: archivio zip con un oggetto per pezzo, in millimetri (Z verso l'alto, come nello slicer)
function build3MF(list) {
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const v = new THREE.Vector3();
  let objs = '', items = '', mats = '';
  const cols = [...new Set(list.map(m => m.userData.color).filter(Boolean))];
  if (cols.length) mats = `<basematerials id="${list.length + 1}">${cols.map((c, i) => `<base name="Colore ${i + 1}" displaycolor="${c.toUpperCase()}FF"/>`).join('')}</basematerials>`;
  list.forEach((m, i) => {
    m.updateMatrixWorld(true);
    let g = m.geometry.clone();
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = mergeVertices(g, 1e-4);
    const pos = g.attributes.position, idx = g.index;
    let vs = '', ts = '';
    for (let k = 0; k < pos.count; k++) { v.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld); vs += `<vertex x="${+v.x.toFixed(4)}" y="${+v.y.toFixed(4)}" z="${+v.z.toFixed(4)}"/>`; }
    const n = idx ? idx.count : pos.count;
    for (let k = 0; k < n; k += 3) ts += idx ? `<triangle v1="${idx.getX(k)}" v2="${idx.getX(k + 1)}" v3="${idx.getX(k + 2)}"/>` : `<triangle v1="${k}" v2="${k + 1}" v3="${k + 2}"/>`;
    g.dispose();
    const id = i + 1;
    const ci = m.userData.color ? cols.indexOf(m.userData.color) : -1;
    objs += `<object id="${id}" name="${esc(m.userData.name)}" type="model"${ci >= 0 ? ` pid="${list.length + 1}" pindex="${ci}"` : ''}><mesh><vertices>${vs}</vertices><triangles>${ts}</triangles></mesh></object>`;
    items += `<item objectid="${id}"/>`;
  });
  const model = `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Application">Forma</metadata><resources>${mats}${objs}</resources><build>${items}</build></model>`;
  const types = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';
  return zipSync({ '[Content_Types].xml': strToU8(types), '_rels/.rels': strToU8(rels), '3D/3dmodel.model': strToU8(model) });
}
function export3MF(nameArg) {
  const list = exportList();
  if (!list.length) return toast('Niente da esportare: aggiungi almeno un solido');
  const data = build3MF(list), name = nameArg || exportName(list);
  download(data, 'model/3mf', `${name}.3mf`);
  toast(`Esportato ${name}.3mf (${list.length} ${list.length === 1 ? 'pezzo' : 'pezzi'})`);
  return data;
}

/* ------------------------------------------------- modello: scatolina */
function buildBoxModel({ w, d, h, t, g, r }) {
  const mk = (kind, p, x, y, z) => { const m = makeMesh({ kind, name: 'tmp', p, pos: [x, y, z] }); m.updateMatrixWorld(true); return m; };
  const tmp = [];
  const T = (...a) => { const m = mk(...a); tmp.push(m); return m; };
  const lidT = 2, lip = 3;
  const outer = T('box', { w, d, h, r }, 0, 0, 0);
  const inner = T('box', { w: w - 2 * t, d: d - 2 * t, h, r: Math.max(r - t, 0) }, 0, 0, t);
  const body = bakeResult(evaluator.evaluate(outer, inner, SUBTRACTION), 'Scatolina');
  const plate = T('box', { w, d, h: lidT, r }, 0, 0, 0);
  const lipM = T('box', { w: w - 2 * t - 2 * g, d: d - 2 * t - 2 * g, h: lip, r: Math.max(r - t - g, 0) }, 0, 0, lidT);
  const lid = bakeResult(evaluator.evaluate(plate, lipM, ADDITION), 'Coperchio');
  tmp.forEach(removeMesh);
  const gap = 8;
  body.pos[0] = -(w / 2 + gap / 2);
  lid.pos[0] = w / 2 + gap / 2;
  const a = addMerged(body), b = addMerged(lid);
  setSelection([a, b]);
  touch(); commit();
  fitView();
  if (w * 2 + gap > BEDX || d > BEDY) toast(`Attenzione: i pezzi superano il piatto da ${BEDX}×${BEDY} mm`);
}
const dlg = $('#dlg-box');
$('#box-cancel').addEventListener('click', () => dlg.close());
$('#box-form').addEventListener('submit', () => {
  const f = Object.fromEntries(new FormData($('#box-form')).entries());
  const n = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, parseFloat(v)]));
  if (![n.w, n.d, n.h, n.t, n.g, n.r].every(Number.isFinite) || n.t * 2 >= Math.min(n.w, n.d) || n.h <= n.t + 2) return toast('Misure non valide');
  buildBoxModel(n);
});

/* -------------------------------------------------- barra laterale */
const I = {
  move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V11m0-5.5a1.5 1.5 0 0 1 3 0V11m0-3.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-.5a6 6 0 0 1-5-2.7L4.6 14.6a1.5 1.5 0 0 1 2.5-1.6L8 14"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/><circle cx="12" cy="12" r="1.6"/>',
  orbit: '<path d="M20 12a8 8 0 1 1-3-6.2M20 4v4.2h-4.2"/>',
  box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  cylinder: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/>',
  text: '<path d="M5 7V5h14v2M12 5v14M9.5 19h5"/>',
  cone: '<path d="M12 3L4.5 17c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3z"/><path d="M4.5 17c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" opacity=".4"/>',
  prism: '<path d="M8 4h8l5 8-5 8H8l-5-8z"/><path d="M8 4l-5 8M16 4l5 8" opacity=".35"/>',
  torus: '<ellipse cx="12" cy="12" rx="9" ry="6"/><ellipse cx="12" cy="12" rx="4" ry="2" opacity=".6"/>',
  sphere: '<circle cx="12" cy="12" r="8.5"/><ellipse cx="12" cy="12" rx="8.5" ry="3.4"/>',
  hole: '<circle cx="12" cy="12" r="7.5" stroke-dasharray="3 3"/>',
  combine: '<rect x="3.5" y="3.5" width="11" height="11" rx="2.5"/><rect x="9.5" y="9.5" width="11" height="11" rx="2.5"/>',
  group: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><rect x="8" y="8" width="8" height="8" rx="1.5"/>',
  dup: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>',
  dist: '<path d="M3.5 16.5l13-13 4 4-13 13z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  edge: '<path d="M4 20V9a5 5 0 0 1 5-5h11"/><path d="M4 20h16" opacity=".35"/><path d="M20 4v16" opacity=".35"/>',
  face: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" opacity=".4"/><path d="M12 12l8-4.5v9L12 21z" fill="currentColor" stroke="none" opacity=".4"/>',
  ruler: '<rect x="3" y="8" width="18" height="8" rx="1.5"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/>',
  model: '<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M3 7h18v4H3zM12 7v13"/>',
};
const TOOLS = [
  ['Strumenti', [
    { id: 'move', icon: 'move', name: 'Sposta', key: 'V', desc: 'Seleziona e muovi gli oggetti', run: () => setTool('move') },
    { id: 'rotate', icon: 'rotate', name: 'Ruota', key: 'R', desc: 'Ruota con scatto a 15°', run: () => setTool('rotate') },
    { id: 'face', icon: 'face', name: 'Lato', key: 'L', desc: 'Spingi o tira un lato piatto', run: () => setTool('face') },
    { id: 'edge', icon: 'edge', name: 'Spigolo', key: 'E', desc: 'Raccorda o smussa uno spigolo', run: () => setTool('edge') },
    { id: 'ruler', icon: 'dist', name: 'Distanza', key: 'D', desc: 'Misura tra due punti o lati', run: () => setTool('ruler') },
  ]],
  ['Forme', [
    { icon: 'box', name: 'Scatola', key: 'B', desc: 'Aggiunge un blocco', run: () => createObject('box') },
    { icon: 'cylinder', name: 'Cilindro', key: 'C', desc: 'Aggiunge un cilindro', run: () => createObject('cylinder') },
    { icon: 'text', name: 'Testo', key: 'T', desc: 'Scrive testo 3D con font a scelta', run: () => addText() },
    { icon: 'sphere', name: 'Sfera', key: 'S', desc: 'Aggiunge una sfera', run: () => createObject('sphere') },
    { icon: 'cone', name: 'Cono', key: 'O', desc: 'Cono o tronco di cono', run: () => createObject('cone') },
    { icon: 'prism', name: 'Prisma', key: 'P', desc: 'Esagono, ottagono e altri poligoni', run: () => createObject('prism') },
    { icon: 'torus', name: 'Toro', key: '', desc: 'Anello per guarnizioni e maniglie', run: () => createObject('torus') },
  ]],
  ['Modifica', [
    { icon: 'hole', name: 'Foro / Solido', key: 'X', desc: 'Trasforma in foro per scavare', run: toggleHole },
    { icon: 'combine', name: 'Combina', key: '⌘E', desc: 'Unisce i solidi, sottrae i fori', run: combine },
    { icon: 'group', name: 'Raggruppa', key: '⌘G', desc: 'Muove più oggetti come uno', run: groupSelection },
    { icon: 'group', name: 'Separa pezzi', key: '', desc: 'Divide un pezzo in parti staccate', run: splitPieces },
    { icon: 'dup', name: 'Duplica', key: '⌘D', desc: 'Copia l’oggetto selezionato', run: () => duplicateSelection(true) },
    { icon: 'trash', name: 'Elimina', key: '⌫', desc: 'Rimuove la selezione', run: deleteSelection },
  ]],
  ['Modelli', [
    { icon: 'model', name: 'Scatolina con coperchio', key: '', desc: 'Corpo e coperchio su misura', run: () => dlg.showModal() },
  ]],
];
const toolEls = {};
$('#tools').innerHTML = TOOLS.map(([title, items], si) =>
  `<h3>[${si + 1}] ${title}</h3>` + items.map((t, ii) =>
    `<button class="tool" data-s="${si}" data-i="${ii}"><span class="ico"><svg viewBox="0 0 24 24">${I[t.icon]}</svg></span><span class="t"><b>${t.name}</b><small>${t.desc}</small></span>${t.key ? `<kbd>${t.key}</kbd>` : ''}</button>`).join('')).join('');
$('#tools').addEventListener('click', e => {
  const b = e.target.closest('.tool');
  if (!b) return;
  TOOLS[b.dataset.s][1][b.dataset.i].run();
  canvas.focus();
});
document.querySelectorAll('.tool').forEach(b => { const t = TOOLS[b.dataset.s][1][b.dataset.i]; if (t.id) toolEls[t.id] = b; });
function setTool(t) {
  state.tool = t;
  updateRotGizmo();
  if (t !== 'face') { clearFace(false); hideHover(); }
  if (t !== 'edge') clearEdges();
  if (t === 'ruler' || state.tool !== 'ruler') clearRuler();
  syncPanel();
  Object.entries(toolEls).forEach(([id, el]) => el.classList.toggle('active', id === t));
  updateCursor(false);
  updateHandles();
  updateFaceHandle();
}

/* ------------------------------------------- barra ridotta e suggerimenti */
const sideEl = $('#side'), tipEl = $('#tip');
function setMini(on, save = true) {
  sideEl.classList.toggle('mini', on);
  document.documentElement.style.setProperty('--sw', on ? '72px' : '312px');
  hideTip();
  if (save) { try { localStorage.setItem('forma.mini', on ? '1' : '0'); } catch (_) {} }
}
$('#side-toggle').addEventListener('click', () => { setMini(!sideEl.classList.contains('mini')); canvas.focus(); });
let tipTimer = null, tipOn = false;
function hideTip() { clearTimeout(tipTimer); tipOn = false; tipEl.classList.remove('show'); }
function showTip(b) {
  const t = TOOLS[b.dataset.s][1][b.dataset.i];
  tipEl.innerHTML = `<b>${t.name}</b>${t.key ? `<kbd>${t.key}</kbd>` : ''}<small>${t.desc}</small>`;
  const r = b.getBoundingClientRect();
  tipEl.style.left = r.right + 10 + 'px';
  tipEl.style.top = r.top + r.height / 2 + 'px';
  tipEl.classList.add('show');
  tipOn = true;
}
$('#tools').addEventListener('pointerover', e => {
  const b = e.target.closest('.tool');
  if (!b || !sideEl.classList.contains('mini')) return;
  clearTimeout(tipTimer);
  if (tipOn) showTip(b); else tipTimer = setTimeout(() => showTip(b), 550);
});
$('#tools').addEventListener('pointerleave', hideTip);
$('#tools').addEventListener('pointerdown', hideTip);
$('#tools').addEventListener('scroll', hideTip);
try { if (localStorage.getItem('forma.mini') === '1') setMini(true, false); } catch (_) {}

/* ----------------------------------------------------------- barra bassa */
$('#viewcube').addEventListener('click', e => {
  const b = e.target.closest('[data-vc]'); if (!b) return;
  const V = { front: { az: 0, el: 0 }, back: { az: 180, el: 0 }, right: { az: 90, el: 0 }, left: { az: -90, el: 0 }, top: { az: cam.az, el: 89.9 }, bottom: { az: cam.az, el: -89.9 } };
  animateTo(V[b.dataset.vc]);
});
$('#views').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) animateTo(VIEWS[b.dataset.view]); });
$('#b-dims').addEventListener('click', () => setDims());
function setXray(on) {   // contorni delle parti coperte, attivabile e disattivabile
  state.xray = on ?? !state.xray;
  $('#b-xray').classList.toggle('on', state.xray);
  objects.forEach(styleObject);
  dirty = true;
  try { localStorage.setItem('forma.xray', state.xray ? '1' : '0'); } catch (e) {}
}
$('#b-xray').addEventListener('click', () => setXray());
try { if (localStorage.getItem('forma.xray') === '1') setXray(true); } catch (e) {}
$('#b-fit').addEventListener('click', fitView);
function setSnap(v, announce = true) {
  state.snap = v;
  document.querySelectorAll('#snaps [data-snap]').forEach(b => b.classList.toggle('on', parseFloat(b.dataset.snap) === v));
  gridStep = clamp(v * 10, 5, 20); buildBedDots(gridStep);
  if (announce) toast(`Griglia: ${String(v).replace('.', ',')} mm`);
}
$('#snaps').addEventListener('click', e => {
  const b = e.target.closest('[data-snap]');
  if (b) { setSnap(parseFloat(b.dataset.snap)); canvas.focus(); }
});
setSnap(1, false);
/* piatto di stampa */
const BEDS = [
  ['A1 mini', 180, 180], ['A1 · P1S · X1C · P2S', 256, 256], ['H2S', 340, 320], ['H2D', 350, 320], ['Max (40 cm)', 400, 400]
];
const bedMenu = $('#bedmenu');
bedMenu.innerHTML = BEDS.map(([n, w, d], i) => `<button class="btn" data-bed="${i}"><span>${n}</span><em>${w}×${d}</em></button>`).join('') +
  `<div class="cust"><label class="f">L<input id="bed-w" type="number" min="20" max="400" step="1"></label><label class="f">P<input id="bed-d" type="number" min="20" max="400" step="1"></label><button class="btn primary" id="bed-go">OK</button></div>`;
function syncBedUI() {
  $('#b-bed').firstChild.textContent = 'Piatto ';
  $('#b-bed em').textContent = `${BEDX}×${BEDY}`;
  $('#bed-w').value = BEDX; $('#bed-d').value = BEDY;
  bedMenu.querySelectorAll('[data-bed]').forEach(b => { const p = BEDS[b.dataset.bed]; b.classList.toggle('on', p[1] === BEDX && p[2] === BEDY); });
}
$('#b-bed').addEventListener('click', e => { e.stopPropagation(); bedMenu.classList.toggle('hidden'); });
document.addEventListener('pointerdown', e => { if (!e.target.closest('#bedmenu,#b-bed')) bedMenu.classList.add('hidden'); });
bedMenu.addEventListener('click', e => {
  const b = e.target.closest('[data-bed]');
  if (b) { const p = BEDS[b.dataset.bed]; setBed(p[1], p[2]); syncBedUI(); toast(`Piatto: ${p[0]} ${p[1]}×${p[2]} mm`); bedMenu.classList.add('hidden'); }
  if (e.target.closest('#bed-go')) { setBed(+$('#bed-w').value, +$('#bed-d').value); syncBedUI(); toast(`Piatto: ${BEDX}×${BEDY} mm`); bedMenu.classList.add('hidden'); }
});
try { const sv = JSON.parse(localStorage.getItem('forma.bed')); if (Array.isArray(sv)) setBed(sv[0], sv[1], false); } catch (e) {}
syncBedUI();
$('#b-import').addEventListener('click', () => $('#file-in').click());
$('#file-in').addEventListener('change', e => { importFiles([...e.target.files]); e.target.value = ''; });
const dropEl = $('#dropin');
let dragN = 0;
const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
window.addEventListener('dragenter', e => { if (hasFiles(e)) { dragN++; dropEl.classList.add('show'); } });
window.addEventListener('dragleave', e => { if (hasFiles(e) && --dragN <= 0) { dragN = 0; dropEl.classList.remove('show'); } });
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => { dragN = 0; dropEl.classList.remove('show'); e.preventDefault(); if (e.dataTransfer?.files?.length) importFiles([...e.dataTransfer.files]); });
$('#b-export').addEventListener('click', () => askExport(expFmt));
const dlgExp = $('#dlg-exp'), expName = $('#exp-name');
let expFmt = '3mf';
const EXP_HINT = { '3mf': 'Millimetri, più pezzi in un file. Apre Bambu Studio senza sorprese.', stl: 'Solo la forma, compatibile con qualsiasi programma.' };
function setExpFmt(f) { expFmt = f; document.querySelectorAll('#exp-fmt button').forEach(b => b.classList.toggle('on', b.dataset.v === f)); $('#exp-ext').textContent = '.' + f; $('#exp-hint').textContent = EXP_HINT[f]; }
function askExport(fmt = '3mf') {
  const list = exportList();
  if (!list.length) return toast('Niente da esportare: aggiungi almeno un solido');
  setExpFmt(fmt);
  const sel = selection.length === 1 ? selection[0].userData.name : '';
  expName.value = exportName(list);
  if (!dlgExp.open) dlgExp.showModal();
  expName.focus(); expName.select();
}
$('#exp-fmt').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setExpFmt(b.dataset.v); });
$('#exp-cancel').addEventListener('click', () => dlgExp.close());
$('#exp-form').addEventListener('submit', e => {
  e.preventDefault();
  const n = expName.value.replace(/\.(3mf|stl)$/i, '').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'filo';
  dlgExp.close();
  expFmt === '3mf' ? export3MF(n) : exportSTL(n);
});
let toastT;
function toast(msg, ms = 2400) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), ms);
}

/* ------------------------------------------------------------ tastiera */
window.addEventListener('keydown', e => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || dlg.open || document.querySelector('dialog[open]')) return;
  const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
  if (k === 'f7') { e.preventDefault(); setLayers(!layersOn); return; }
  if (k === 'f8') { e.preventDefault(); setHistory(!histOn); return; }
  if (e.code === 'Space') {
    e.preventDefault();
    if (!state.space) { state.space = true; updateCursor(false); updateHandles(); }
    return;
  }
  if (mod) {
    const stop = () => e.preventDefault();
    if (k === 'z') { stop(); e.shiftKey ? redo() : undo(); }
    else if (k === 'y') { stop(); redo(); }
    else if (k === 'd') { stop(); duplicateSelection(true); }
    else if (k === 'c') { stop(); copySelection(); }
    else if (k === 'x') { stop(); cutSelection(); }
    else if (k === 'v') { stop(); pasteClip(); }
    else if (k === 'a') { stop(); setSelection([...objects]); }
    else if (k === 'e') { stop(); combine(); }
    else if (k === 'g') { stop(); e.shiftKey ? ungroupSelection() : groupSelection(); }
    else if (k === '0') { stop(); fitView(); }
    else if (k === 's') { stop(); askExport(expFmt); }
    else if (k === 'o') { stop(); $('#file-in').click(); }
    else if (k === '=' || k === '+') { stop(); zoom(1 / 1.2); }
    else if (k === '-') { stop(); zoom(1.2); }
    return;
  }
  const arrows = { arrowleft: [-1, 0, 0], arrowright: [1, 0, 0], arrowup: [0, 1, 0], arrowdown: [0, -1, 0], ']': [0, 0, 1], '[': [0, 0, -1] };
  if (arrows[k]) { e.preventDefault(); const m = e.shiftKey ? 10 : 1; nudge(...arrows[k].map(v => v * m)); return; }
  if (k === 'tab') { e.preventDefault(); setMini(!sideEl.classList.contains('mini')); return; }
  if (k === 'v') setTool('move');
  else if (k === 'l') setTool('face');
  else if (k === 'e') setTool('edge');
  else if (k === 'd') setTool('ruler');
  else if (k === 'r') setTool('rotate');
  else if (k === 'b') createObject('box');
  else if (k === 'c') createObject('cylinder');
  else if (k === 's') createObject('sphere');
  else if (k === 'o') createObject('cone');
  else if (k === 'p') createObject('prism');
  else if (k === 't') { e.preventDefault(); addText(); }
  else if (k === 'x') toggleHole();
  else if (k === 'm') setDims();
  else if (k === 'z') setXray();
  else if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSelection(); }
  else if (k === 'escape') { if (state.tool === 'ruler' && ruler.a) clearRuler(); else if (faceSel) clearFace(); else setSelection([]); }
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space') { state.space = false; updateCursor(false); updateHandles(); }
});
window.addEventListener('blur', () => { state.space = false; updateCursor(false); });

/* ------------------------------------------------- lati: selezione e texture */
const ACCENT_HEX = 0xff6a00;
const adjCache = new WeakMap();
function meshInfo(geo) {
  let info = adjCache.get(geo);
  if (info) return info;
  const pos = geo.attributes.position, idx = geo.index;
  const nTri = idx ? idx.count / 3 : pos.count / 3;
  const ids = new Int32Array(nTri * 3), nrm = new Float32Array(nTri * 3), off = new Float32Array(nTri), ok = new Uint8Array(nTri);
  const map = new Map();
  let next = 0;
  const q = v => Math.round(v * 2000);
  const vid = i => {
    const k = q(pos.getX(i)) + ',' + q(pos.getY(i)) + ',' + q(pos.getZ(i));
    let id = map.get(k);
    if (id === undefined) { id = next++; map.set(k, id); }
    return id;
  };
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let t = 0; t < nTri; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    ids[t * 3] = vid(i0); ids[t * 3 + 1] = vid(i1); ids[t * 3 + 2] = vid(i2);
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    n.subVectors(b, a).cross(c.clone().sub(a));
    const len = n.length();
    if (len < 1e-9) continue;
    n.divideScalar(len);
    nrm[t * 3] = n.x; nrm[t * 3 + 1] = n.y; nrm[t * 3 + 2] = n.z;
    off[t] = n.dot(a);
    ok[t] = 1;
  }
  info = { nTri, ids, nrm, off, ok, nVerts: next };
  adjCache.set(geo, info);
  return info;
}
// adiacenza per spigolo e gruppi di triangoli complanari (per riconoscere le superfici curve)
const NARROW = 6; // mm: una faccetta più stretta di così, accanto a una inclinata di poco, fa parte di una curva
function ensureGroups(geo) {
  const info = meshInfo(geo);
  if (info.group) return info;
  const { nTri, ids, nrm, ok, nVerts } = info;
  const edges = new Map(), adj = Array.from({ length: nTri }, () => []);
  for (let t = 0; t < nTri; t++) for (let j = 0; j < 3; j++) {
    const a = ids[t * 3 + j], b = ids[t * 3 + (j + 1) % 3], k = a < b ? a * nVerts + b : b * nVerts + a;
    const e = edges.get(k);
    if (e === undefined) edges.set(k, t); else if (e >= 0) { adj[t].push(e); adj[e].push(t); edges.set(k, -1); }
  }
  const group = new Int32Array(nTri).fill(-1), gMin = [];
  const pos = geo.attributes.position, idx = geo.index, v = new THREE.Vector3();
  let G = 0;
  for (let t0 = 0; t0 < nTri; t0++) {
    if (group[t0] >= 0 || !ok[t0]) continue;
    const list = [t0]; group[t0] = G;
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      for (const nt of adj[t]) if (group[nt] < 0 && ok[nt] && nrm[t * 3] * nrm[nt * 3] + nrm[t * 3 + 1] * nrm[nt * 3 + 1] + nrm[t * 3 + 2] * nrm[nt * 3 + 2] >= 0.99995) { group[nt] = G; list.push(nt); }
    }
    const n = new THREE.Vector3(nrm[t0 * 3], nrm[t0 * 3 + 1], nrm[t0 * 3 + 2]);
    const vA = Math.abs(n.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    vA.addScaledVector(n, -vA.dot(n)).normalize();
    const uA = new THREE.Vector3().crossVectors(vA, n);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const t of list) for (let j = 0; j < 3; j++) {
      v.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + j) : t * 3 + j);
      const uu = v.dot(uA), vv = v.dot(vA);
      if (uu < u0) u0 = uu; if (uu > u1) u1 = uu; if (vv < v0) v0 = vv; if (vv > v1) v1 = vv;
    }
    gMin.push(Math.min(u1 - u0, v1 - v0));
    G++;
  }
  info.adj = adj; info.group = group; info.gMin = gMin;
  return info;
}
// triangoli di una superficie curva (faccette strette e poco inclinate l'una sull'altra), oppure null se il lato è piatto
function curvedTris(geo, t0) {
  const info = ensureGroups(geo), { nrm, group, gMin, adj } = info;
  if (gMin[group[t0]] >= NARROW) return null;
  const dotn = (a, b) => nrm[a * 3] * nrm[b * 3] + nrm[a * 3 + 1] * nrm[b * 3 + 1] + nrm[a * 3 + 2] * nrm[b * 3 + 2];
  const seen = new Set([group[t0]]), list = [], queue = [t0];
  const members = new Map(); // gruppo -> triangoli (solo quelli raggiunti)
  let curved = false;
  const all = [];
  // raccoglie tutti i triangoli di un gruppo partendo da un suo triangolo
  const gather = t => { const g = group[t], out = [t], s2 = new Set([t]); for (let i = 0; i < out.length; i++) for (const nt of adj[out[i]]) if (group[nt] === g && !s2.has(nt)) { s2.add(nt); out.push(nt); } return out; };
  const stack = [t0];
  while (stack.length) {
    const t = stack.pop();
    const tris = gather(t);
    tris.forEach(x => all.push(x));
    for (const x of tris) for (const nt of adj[x]) {
      const g = group[nt];
      if (g === group[x] || seen.has(g) || g < 0) continue;
      const d = dotn(x, nt);
      if (d < 0.906 || d > 0.99999) continue;
      if (gMin[g] >= NARROW) continue;
      if (dotn(t0, nt) < -0.17) continue;
      seen.add(g); curved = true; stack.push(nt);
    }
  }
  return curved ? all : null;
}
// Un "lato" è l'insieme dei triangoli complanari e collegati (anche dopo una CSG).
function computeFace(m, t0) {
  const geo = m.geometry, info = meshInfo(geo), { nTri, ids, nrm, off, ok, nVerts } = info;
  if (t0 === undefined || !ok[t0]) return null;
  const nx = nrm[t0 * 3], ny = nrm[t0 * 3 + 1], nz = nrm[t0 * 3 + 2], d0 = off[t0];
  const parent = new Int32Array(nVerts);
  for (let i = 0; i < nVerts; i++) parent[i] = i;
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const cand = [];
  for (let t = 0; t < nTri; t++) {
    if (!ok[t]) continue;
    if (nrm[t * 3] * nx + nrm[t * 3 + 1] * ny + nrm[t * 3 + 2] * nz < 0.99995) continue;
    if (Math.abs(off[t] - d0) > 0.02) continue;
    cand.push(t);
    const ra = find(ids[t * 3]);
    parent[find(ids[t * 3 + 1])] = ra;
    parent[find(ids[t * 3 + 2])] = find(ra);
  }
  const root = find(ids[t0 * 3]);
  let curvedList = curvedTris(geo, t0), full = false;
  m.updateMatrixWorld(true);
  // cilindro o cono parametrico: tutto il lato (senza i coperchi) è un pezzo unico
  if (curvedList && ['cylinder', 'cone'].includes(m.userData.kind) && Math.abs(m.userData.p.w - m.userData.p.d) < 0.01 && Math.abs(Math.abs(nz) - 1) > 0.02) {
    const side = []; for (let t = 0; t < nTri; t++) if (ok[t] && Math.abs(Math.abs(nrm[t * 3 + 2]) - 1) > 0.02) side.push(t);
    if (side.length) { curvedList = side; full = true; }
  }
  // lato curvo verticale che gira tutto intorno (cilindro, anche già modificato): un pezzo unico
  if (curvedList && !full && Math.abs(nz) < 0.02) {
    const P = geo.attributes.position, I = geo.index, V = new THREE.Vector3(), tv = t => [0, 1, 2].map(j => V.clone().fromBufferAttribute(P, I ? I.getX(t * 3 + j) : t * 3 + j).applyMatrix4(m.matrixWorld));
    const xy = [], seenK = new Set(); let zA = Infinity, zB = -Infinity;
    for (const t of curvedList) for (const v of tv(t)) { zA = Math.min(zA, v.z); zB = Math.max(zB, v.z); const k = Math.round(v.x * 500) + ',' + Math.round(v.y * 500); if (!seenK.has(k)) { seenK.add(k); xy.push([v.x, v.y]); } }
    const c = fitRing(xy);
    if (c) {
      const side = [], all = [];
      for (let t = 0; t < nTri; t++) {
        if (!ok[t]) continue;
        const vs = tv(t);
        if (vs.some(v => Math.abs(Math.hypot(v.x - c.cx, v.y - c.cy) - c.R) > 0.02 + 0.002 * c.R || v.z < zA - 0.01 || v.z > zB + 0.01)) continue;
        const nn = vs[1].clone().sub(vs[0]).cross(vs[2].clone().sub(vs[0])).normalize();
        if (Math.abs(nn.z) > 0.02) continue;
        side.push(t); vs.forEach(v => all.push([v.x, v.y]));
      }
      if (side.length && ringGaps(all, c).gap < 25 * D2R) { curvedList = side; full = true; }
    }
  }
  const tris = curvedList || cand.filter(t => find(ids[t * 3]) === root);
  m.updateMatrixWorld(true);
  const pos = geo.attributes.position, idx = geo.index;
  const world = new Float32Array(tris.length * 9), v = new THREE.Vector3();
  tris.forEach((t, k) => {
    for (let j = 0; j < 3; j++) {
      v.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + j) : t * 3 + j).applyMatrix4(m.matrixWorld);
      world.set([v.x, v.y, v.z], k * 9 + j * 3);
    }
  });
  const nMat = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
  const n = new THREE.Vector3(nx, ny, nz).applyNormalMatrix(nMat).normalize();
  // normali per vertice (mondo): sul lato piatto sono tutte uguali, sulla curva seguono la superficie
  const vn = new Float32Array(tris.length * 9), accum = new Map(), kq = x => Math.round(x * 2000);
  const tn = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), avg = new THREE.Vector3();
  tris.forEach((t, k) => {
    tn.set(nrm[t * 3], nrm[t * 3 + 1], nrm[t * 3 + 2]).applyNormalMatrix(nMat).normalize();
    e1.set(world[k * 9 + 3] - world[k * 9], world[k * 9 + 4] - world[k * 9 + 1], world[k * 9 + 5] - world[k * 9 + 2]);
    e2.set(world[k * 9 + 6] - world[k * 9], world[k * 9 + 7] - world[k * 9 + 1], world[k * 9 + 8] - world[k * 9 + 2]);
    const area = e1.cross(e2).length() / 2;
    avg.addScaledVector(tn, area);
    for (let j = 0; j < 3; j++) {
      const key = kq(world[k * 9 + j * 3]) + ',' + kq(world[k * 9 + j * 3 + 1]) + ',' + kq(world[k * 9 + j * 3 + 2]);
      const a = accum.get(key) || [0, 0, 0];
      a[0] += tn.x * area; a[1] += tn.y * area; a[2] += tn.z * area; accum.set(key, a);
    }
  });
  if (curvedList) { // un lato curvo si muove rigido lungo l'asse del mondo più vicino (su/giù, avanti/indietro), non in diagonale
    if (full) avg.set(n.x, n.y, 0).normalize(); avg.normalize();
    const ax = Math.abs(avg.x) >= Math.abs(avg.y) && Math.abs(avg.x) >= Math.abs(avg.z) ? 'x' : Math.abs(avg.y) >= Math.abs(avg.z) ? 'y' : 'z';
    n.set(0, 0, 0); n[ax] = Math.sign(avg[ax]) || 1;
  }
  tris.forEach((t, k) => {
    if (curvedList) { for (let j = 0; j < 3; j++) { vn[k * 9 + j * 3] = n.x; vn[k * 9 + j * 3 + 1] = n.y; vn[k * 9 + j * 3 + 2] = n.z; } return; }
    for (let j = 0; j < 3; j++) {
      const key = kq(world[k * 9 + j * 3]) + ',' + kq(world[k * 9 + j * 3 + 1]) + ',' + kq(world[k * 9 + j * 3 + 2]);
      const a = accum.get(key), l = Math.hypot(a[0], a[1], a[2]) || 1;
      vn[k * 9 + j * 3] = a[0] / l; vn[k * 9 + j * 3 + 1] = a[1] / l; vn[k * 9 + j * 3 + 2] = a[2] / l;
    }
  });
  const org = new THREE.Vector3(world[0], world[1], world[2]);
  const vAx = Math.abs(n.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  vAx.addScaledVector(n, -vAx.dot(n)).normalize();
  const uAx = new THREE.Vector3().crossVectors(vAx, n).normalize();
  const tri2d = new Float32Array(tris.length * 6);
  const b = { umin: Infinity, umax: -Infinity, vmin: Infinity, vmax: -Infinity };
  let area = 0;
  for (let k = 0; k < tris.length; k++) {
    for (let j = 0; j < 3; j++) {
      v.set(world[k * 9 + j * 3], world[k * 9 + j * 3 + 1], world[k * 9 + j * 3 + 2]).sub(org);
      const uu = v.dot(uAx), vv = v.dot(vAx);
      tri2d[k * 6 + j * 2] = uu; tri2d[k * 6 + j * 2 + 1] = vv;
      b.umin = Math.min(b.umin, uu); b.umax = Math.max(b.umax, uu); b.vmin = Math.min(b.vmin, vv); b.vmax = Math.max(b.vmax, vv);
    }
    const T = tri2d, o = k * 6;
    area += Math.abs((T[o + 2] - T[o]) * (T[o + 5] - T[o + 1]) - (T[o + 4] - T[o]) * (T[o + 3] - T[o + 1])) / 2;
  }
  const W = b.umax - b.umin, H = b.vmax - b.vmin;
  return { obj: m, n, u: uAx, v: vAx, o: org, world, vn, tri2d, b, W, H, area, curved: !!curvedList, full, rect: !curvedList && area >= W * H * 0.995, triSet: new Set(tris) };
}
function inRegion(fs, x, y) {
  const T = fs.tri2d;
  for (let i = 0; i < T.length; i += 6) {
    const ax = T[i], ay = T[i + 1], bx = T[i + 2], by = T[i + 3], cx = T[i + 4], cy = T[i + 5];
    const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by);
    const d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy);
    const d3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay);
    const neg = d1 < -1e-6 || d2 < -1e-6 || d3 < -1e-6, pos = d1 > 1e-6 || d2 > 1e-6 || d3 > 1e-6;
    if (!(neg && pos)) return true;
  }
  return false;
}
function makeOverlay(fs, opacity) {
  const g = new THREE.BufferGeometry();
  const arr = Float32Array.from(fs.world);
  for (let i = 0; i < arr.length; i += 3) { arr[i] += fs.vn[i] * 0.08; arr[i + 1] += fs.vn[i + 1] * 0.08; arr[i + 2] += fs.vn[i + 2] * 0.08; }
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: ACCENT_HEX, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  mesh.renderOrder = 3;
  mesh.raycast = () => {};
  return mesh;
}
let faceSel = null, faceSet = [], selMeshes = [], hoverMesh = null, hoverFs = null;
function dropMesh(m) { if (m) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); } }
function clearFace(sync = true) {
  selMeshes.forEach(dropMesh); selMeshes = []; faceSel = null; faceSet = [];
  updateFaceHandle();
  if (sync) syncPanel();
  dirty = true;
}
function hideHover() { if (hoverMesh) { dropMesh(hoverMesh); hoverMesh = null; hoverFs = null; dirty = true; } }
function updateHover(e) {
  const hit = pickHit(e);
  if (!hit || hit.object.userData.heavy) return hideHover();
  if (hoverFs && hoverFs.obj === hit.object && hoverFs.triSet.has(hit.faceIndex)) return;
  hideHover();
  const fs = computeFace(hit.object, hit.faceIndex);
  if (!fs) return;
  hoverFs = fs; hoverMesh = makeOverlay(fs, 0.22);
  scene.add(hoverMesh); dirty = true;
}
// lati complanari (stessa normale e stesso piano) degli altri oggetti dello stesso gruppo
function coplanarInGroup(m, fs) {
  const out = [];
  if (m.userData.gid == null) return out;
  const nW = new THREE.Vector3(), v = new THREE.Vector3(), nMat = new THREE.Matrix3(), plane = fs.n.dot(fs.world.length ? new THREE.Vector3(fs.world[0], fs.world[1], fs.world[2]) : new THREE.Vector3());
  for (const o of objects) {
    if (o === m || o.userData.gid !== m.userData.gid || o.userData.hole) continue;
    o.updateMatrixWorld(true);
    const info = meshInfo(o.geometry), pos = o.geometry.attributes.position, idx = o.geometry.index;
    nMat.getNormalMatrix(o.matrixWorld);
    const covered = new Set();
    for (let t = 0; t < info.nTri && out.length < 24; t++) {
      if (!info.ok[t] || covered.has(t)) continue;
      nW.set(info.nrm[t * 3], info.nrm[t * 3 + 1], info.nrm[t * 3 + 2]).applyNormalMatrix(nMat).normalize();
      if (nW.dot(fs.n) < 0.9995) continue;
      v.fromBufferAttribute(pos, idx ? idx.getX(t * 3) : t * 3).applyMatrix4(o.matrixWorld);
      if (Math.abs(fs.n.dot(v) - plane) > 0.05) continue;
      const f2 = computeFace(o, t);
      if (!f2) continue;
      f2.triSet.forEach(x => covered.add(x));
      out.push(f2);
    }
  }
  return out;
}
function selectFaceFromHit(hit, add = false) {
  const m = hit.object;
  const grp = withGroups([m]);
  if (selection.length !== grp.length || !grp.every(g => selection.includes(g))) setSelection(grp);
  const fs = computeFace(m, hit.faceIndex);
  if (!fs) return toast('Questo lato non è piatto');
  hideHover();
  const extra = coplanarInGroup(m, fs);
  const keep = add && faceSet.length;
  if (keep) {
    const i = faceSet.findIndex(f => f.obj === m && f.triSet.has(hit.faceIndex));
    if (i >= 0) {
      const gone = faceSet.filter(f => f === faceSet[i] || (extra.length && f.obj !== m && extra.some(e => e.obj === f.obj && f.triSet.has([...e.triSet][0]))));
      gone.forEach(f => { const k = faceSet.indexOf(f); faceSet.splice(k, 1); dropMesh(selMeshes.splice(k, 1)[0]); });
    } else [fs, ...extra].forEach(f => { faceSet.push(f); const sm = makeOverlay(f, 0.5); selMeshes.push(sm); scene.add(sm); });
    faceSel = faceSet[faceSet.length - 1] || null;
    if (!faceSel) return clearFace();
  } else {
    clearFace(false);
    faceSet = [fs, ...extra]; faceSel = fs;
    selMeshes = faceSet.map(f => { const sm = makeOverlay(f, 0.5); scene.add(sm); return sm; });
  }
  updateFaceHandle();
  syncPanel(); dirty = true;
}

/* -------- texture */
const texUI = { type: 'tubes', orient: 'v', mode: 'raise' };
const TF = { k: { value: '1.5' }, depth: { value: '1' }, margin: { value: '1.5' }, push: $('#f-push') };
const texOpts = () => ({ ...texUI, k: clamp(parseFloat(TF.k.value) || 1.5, 0.2, 5), depth: clamp(parseFloat(TF.depth.value) || 1, 0.2, 5), margin: Math.max(0, parseFloat(TF.margin.value) || 0) });
function layout(fs, o) {
  const p = 10 / o.k, { umin, umax, vmin, vmax } = fs.b, mg = o.margin;
  const ub0 = umin + mg, ub1 = umax - mg, vb0 = vmin + mg, vb1 = vmax - mg;
  const out = [];
  if (ub1 - ub0 < 1 || vb1 - vb0 < 1) return out;
  if ((ub1 - ub0) * (vb1 - vb0) / (p * p * 0.8) > 3000) { out.tooMany = true; return out; }
  if (o.type === 'tubes') {
    const R = 0.47 * p, alongV = o.orient === 'v';
    const [a0, a1, b0, b1] = alongV ? [ub0, ub1, vb0, vb1] : [vb0, vb1, ub0, ub1];
    const nA = Math.floor((a1 - a0) / p + 1e-6);
    const samples = [];
    for (let s = b0; s < b1; s += 0.5) samples.push(s);
    samples.push(b1);
    for (let i = 0; i < nA; i++) {
      const ac = (a0 + a1) / 2 + (i - (nA - 1) / 2) * p;
      let run = null;
      for (let j = 0; j < samples.length; j++) {
        const s = samples[j];
        const ok = alongV ? inRegion(fs, ac, s) && inRegion(fs, ac - R, s) && inRegion(fs, ac + R, s)
          : inRegion(fs, s, ac) && inRegion(fs, s, ac - R) && inRegion(fs, s, ac + R);
        if (ok) { if (!run) run = [s, s]; else run[1] = s; }
        if ((!ok || j === samples.length - 1) && run) {
          if (run[1] - run[0] >= 2) out.push({ t: 'tube', alongV, ac, a: run[0], b: run[1], R });
          run = null;
        }
      }
    }
    return out;
  }
  const hex = o.type === 'hex';
  const half = hex ? 0.45 * p : 0.3 * p;
  const Rh = half / (Math.sqrt(3) / 2);
  const rowStep = p * Math.sqrt(3) / 2, vr = hex ? Rh : half;
  const pts = [];
  for (let j = 0, vc = vb0 + vr; vc + vr <= vb1 + 1e-6; j++, vc += rowStep) {
    const offs = (j % 2) * p / 2;
    for (let uc = ub0 + half + offs; uc + half <= ub1 + 1e-6; uc += p) pts.push([uc, vc]);
  }
  if (!pts.length) return out;
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  pts.forEach(([uc, vc]) => { minU = Math.min(minU, uc - half); maxU = Math.max(maxU, uc + half); minV = Math.min(minV, vc - vr); maxV = Math.max(maxV, vc + vr); });
  const du = (ub0 + ub1) / 2 - (minU + maxU) / 2, dv = (vb0 + vb1) / 2 - (minV + maxV) / 2;
  for (const [u0, v0] of pts) {
    const uc = u0 + du, vc = v0 + dv;
    let ok = true;
    if (hex) for (let k = 0; k < 6 && ok; k++) ok = inRegion(fs, uc + Rh * Math.cos(Math.PI / 2 + k * Math.PI / 3), vc + Rh * Math.sin(Math.PI / 2 + k * Math.PI / 3));
    else for (let k = 0; k < 8 && ok; k++) ok = inRegion(fs, uc + half * Math.cos(k * Math.PI / 4), vc + half * Math.sin(k * Math.PI / 4));
    if (ok && inRegion(fs, uc, vc)) out.push({ t: o.type, uc, vc, half, Rh });
  }
  return out;
}
function basisMatrix(X, Y, Z, pos) {
  const z = Z.clone();
  if (X.clone().cross(Y).dot(z) < 0) z.negate();
  return new THREE.Matrix4().makeBasis(X, Y, z).setPosition(pos);
}
function buildPattern(fs, o, els) {
  const { n, u, v, o: org } = fs, d = o.depth, raise = o.mode === 'raise', under = o.under ?? 0.4;
  const at = (uc, vc) => org.clone().addScaledVector(u, uc).addScaledVector(v, vc);
  const geos = [];
  for (const e of els) {
    let g, M4;
    if (e.t === 'tube') {
      const R = e.R, dd = Math.min(d, R), w = Math.sqrt(Math.max(2 * R * dd - dd * dd, 1e-4));
      const sgn = raise ? 1 : -1, c = dd - R, th0 = Math.asin(clamp((R - dd) / R, -1, 1)), pts = [];
      for (let i = 0; i <= 14; i++) {
        const th = (Math.PI - th0) + (th0 - (Math.PI - th0)) * i / 14;
        pts.push([R * Math.cos(th), sgn * (c + R * Math.sin(th))]);
      }
      pts.push([w, -sgn * (under - 0.05)], [-w, -sgn * (under - 0.05)]);
      const sh = new THREE.Shape();
      sh.moveTo(pts[0][0], pts[0][1]);
      pts.slice(1).forEach(q => sh.lineTo(q[0], q[1]));
      sh.closePath();
      const L = e.b - e.a;
      g = new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: false });
      g.translate(0, 0, -L / 2);
      M4 = e.alongV ? basisMatrix(u, n, v, at(e.ac, (e.a + e.b) / 2)) : basisMatrix(v, n, u, at((e.a + e.b) / 2, e.ac));
    } else {
      const sh = new THREE.Shape();
      if (e.t === 'hex') for (let k = 0; k < 6; k++) { const a = Math.PI / 2 + k * Math.PI / 3; k ? sh.lineTo(e.Rh * Math.cos(a), e.Rh * Math.sin(a)) : sh.moveTo(e.Rh * Math.cos(a), e.Rh * Math.sin(a)); }
      else sh.absarc(0, 0, e.half, 0, Math.PI * 2, false);
      g = new THREE.ExtrudeGeometry(sh, { depth: d + under, bevelEnabled: false, curveSegments: 16 });
      g.translate(0, 0, raise ? -under : -d);
      M4 = basisMatrix(u, v, n, at(e.uc, e.vc));
    }
    g.applyMatrix4(M4);
    geos.push(mergeVertices(clean(g)));
  }
  return geos.length ? mergeGeometries(geos, false) : null;
}
function replaceWithMerged(old, baked, quiet = false) {
  const hole = old.userData.hole;
  removeMesh(old);
  const nm = addMerged(baked);
  nm.userData.hole = hole;
  nm.userData.color = old.userData.color ?? null;
  nm.userData.gid = old.userData.gid ?? null;
  nm.userData.text = null;
  nm.castShadow = !hole;
  if (quiet) return nm;
  clearFace(false);
  setSelection([nm]);
  touch(); commit();
  return nm;
}
function applyTexture() {
  if (!faceSel) return;
  const o = texOpts(), obj = faceSel.obj, faces = faceSet.slice();
  if (faceSet.some(f => f.curved)) return toast('Le texture funzionano sui lati piatti');
  if (heavyGuard([obj])) return;
  let acc = obj, total = 0;
  obj.updateMatrixWorld(true);
  for (const fs of faces) {
    const els = layout(fs, o);
    if (els.tooMany || els.length > 1500) return toast('Troppi elementi: riduci gli elementi per cm');
    if (!els.length) continue;
    const geo = buildPattern(fs, o, els);
    if (!geo) continue;
    const brushE = new Brush(geo, M.solid);
    brushE.updateMatrixWorld(true);
    acc = evaluator.evaluate(acc, brushE, o.mode === 'raise' ? ADDITION : SUBTRACTION);
    total += els.length;
  }
  if (!total) return toast('Nessun elemento: riduci margine o elementi per cm');
  const baked = bakeResult(acc, obj.userData.name);
  if (!baked) return toast('Il risultato è vuoto');
  replaceWithMerged(obj, baked);
  toast(`Texture applicata: ${total} elementi${faces.length > 1 ? ` su ${faces.length} lati` : ''}`);
}

/* ------------------------------------------------------------ scanalature (piani e cilindri) */
const gUI = { dir: 'v', prof: 'round', mode: 'cut' };
// profilo di una cella (passo p) lungo il senso di scorrimento: punti [a, y] con y>0 fuori dal materiale. cut: solchi, raise: coste
function grooveCell(o, c, p) {
  const s = o.mode === 'cut' ? -1 : 1, d = o.depth, pts = [], LAND = 0.2;
  if (o.prof === 'wave') {
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const x = -p / 2 + p * i / n, h = (1 + Math.cos(2 * Math.PI * x / p)) / 2;   // 1 al centro
      pts.push([c + x, s * d * h]);
    }
    // le creste restano appena sotto/sopra il piano per evitare superfici coincidenti
    return pts.map(([a, y]) => [a, o.mode === 'cut' ? Math.min(y, -0.03) : y - 0.03]);
  }
  const w = { round: 0.8, v: 0.9, square: 0.5 }[o.prof] * p, hw = w / 2;
  pts.push([c - hw, -s * LAND], [c - hw, 0]);
  const n = o.prof === 'round' ? 14 : 1;
  if (o.prof === 'round') for (let i = 1; i < n; i++) { const x = -hw + w * i / n; pts.push([c + x, s * d * Math.sqrt(Math.max(0, 1 - (2 * x / w) ** 2))]); }
  else if (o.prof === 'v') pts.push([c, s * d]);
  else pts.push([c - hw, s * d], [c + hw, s * d]);
  pts.push([c + hw, 0], [c + hw, -s * LAND]);
  return pts;
}
function grooveBoundary(o, N, p) {
  const out = [];
  for (let i = 0; i < N; i++) out.push(...grooveCell(o, (i + 0.5) * p, p));
  return out;
}
function cleanBrush(g, m4) {
  const pos = (g.index ? g.toNonIndexed() : g).attributes.position;
  let g0 = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from(pos.array), 3));
  g0 = toCreasedNormals(g0, 35 * D2R);
  const br = new Brush(g0, M.solid);
  if (m4) { br.matrix.copy(m4); br.matrix.decompose(br.position, br.quaternion, br.scale); }
  br.updateMatrixWorld(true);
  return br;
}
function signedVolume(g) {
  const p = (g.index ? g.toNonIndexed() : g).attributes.position.array; let v = 0;
  for (let i = 0; i < p.length; i += 9) v += (p[i] * (p[i + 4] * p[i + 8] - p[i + 5] * p[i + 7]) - p[i + 1] * (p[i + 3] * p[i + 8] - p[i + 5] * p[i + 6]) + p[i + 2] * (p[i + 3] * p[i + 7] - p[i + 4] * p[i + 6])) / 6;
  return v;
}
// sagoma del lato rimpicciolita di 'inset' mm (poligoni Clipper in micron): tiene le righe lontane dal bordo
function insetPaths(fs, inset) {
  const K = 1000, T = fs.tri2d, C = ClipperLib, cl = new C.Clipper();
  for (let i = 0; i < T.length; i += 6) {
    const tri = [0, 2, 4].map(j => ({ X: Math.round(T[i + j] * K), Y: Math.round(T[i + j + 1] * K) }));
    const ar = (tri[1].X - tri[0].X) * (tri[2].Y - tri[0].Y) - (tri[2].X - tri[0].X) * (tri[1].Y - tri[0].Y);
    if (ar === 0) continue;
    cl.AddPath(ar > 0 ? tri : tri.reverse(), C.PolyType.ptSubject, true);
  }
  const uni = new C.Paths(); cl.Execute(C.ClipType.ctUnion, uni, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
  const off = new C.ClipperOffset(2, 0.05 * K), res = new C.Paths();
  off.AddPaths(uni, C.JoinType.jtMiter, C.EndType.etClosedPolygon); off.Execute(res, -inset * K);
  return res;
}
const insideInset = (paths, u, v) => { let n = 0; for (const p of paths) if (ClipperLib.Clipper.PointInPolygon({ X: Math.round(u * 1000), Y: Math.round(v * 1000) }, p)) n++; return n % 2 === 1; };
function groovesIrregular(fs, o) {   // lato non rettangolare: ogni scanalatura è un pezzo a sé, lungo quanto entra nella sagoma
  const along = o.dir === 'v', mg = Math.max(o.margin, 0.05), p = o.pitch;
  const paths = insetPaths(fs, mg);
  const [a0, a1, b0, b1] = along ? [fs.b.umin, fs.b.umax, fs.b.vmin, fs.b.vmax] : [fs.b.vmin, fs.b.vmax, fs.b.umin, fs.b.umax];
  const N = Math.floor((a1 - a0 - 2 * mg) / p + 1e-6);
  if (N < 1) return { err: 'Il lato è troppo piccolo per questo passo o margine' };
  if (N > 600) return { err: 'Troppe scanalature: aumenta il passo' };
  const aS = a0 + (a1 - a0 - N * p) / 2, w = (o.prof === 'wave' ? p - 0.04 : { round: 0.8, v: 0.9, square: 0.5 }[o.prof] * p), cy = o.mode === 'cut' ? 0.5 : -0.5;
  const chunks = []; let count = 0;
  const inside = (a, b) => along ? insideInset(paths, a, b) : insideInset(paths, b, a);
  for (let i = 0; i < N; i++) {
    const c = aS + (i + 0.5) * p;
    const runs = []; let run = null;
    for (let s = b0; s <= b1 + 1e-6; s += 0.25) {
      const ok = inside(c, s) && inside(c - w / 2, s) && inside(c + w / 2, s);
      if (ok) { if (!run) run = [s, s]; else run[1] = s; } else if (run) { runs.push(run); run = null; }
    }
    if (run) runs.push(run);
    for (const [r0, r1] of runs) {
      if (r1 - r0 < 1) continue;
      const cell = grooveCell(o.prof === 'wave' ? { ...o } : o, 0, o.prof === 'wave' ? w : p);
      const shape = new THREE.Shape(); shape.moveTo(cell[0][0], cy);
      cell.forEach(([x, y]) => shape.lineTo(x, y));
      shape.lineTo(cell[cell.length - 1][0], cy); shape.closePath();
      const L = r1 - r0, g = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false, curveSegments: 1 });
      g.translate(0, 0, -L / 2);
      const pos = fs.o.clone().addScaledVector(along ? fs.u : fs.v, c).addScaledVector(along ? fs.v : fs.u, (r0 + r1) / 2);
      g.applyMatrix4(along ? basisMatrix(fs.u, fs.n, fs.v, pos) : basisMatrix(fs.v, fs.n, fs.u, pos));
      chunks.push((g.index ? g.toNonIndexed() : g).attributes.position.array); count++;
    }
  }
  if (!count) return { err: 'Nessuna scanalatura dentro la sagoma del lato' };
  const all = new Float32Array(chunks.reduce((n, c) => n + c.length, 0)); let off = 0;
  chunks.forEach(c => { all.set(c, off); off += c.length; });
  return { N: count, brush: cleanBrush(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(all, 3))) };
}
// il lato è un rettangolo con i bordi paralleli agli assi u e v? (altrimenti le righe vanno ritagliate sulla sagoma)
function rectAligned(fs) {
  const T = fs.tri2d, e = 1e-3, b = fs.b;
  for (let i = 0; i < T.length; i += 2) {
    const onU = Math.abs(T[i] - b.umin) < e || Math.abs(T[i] - b.umax) < e, onV = Math.abs(T[i + 1] - b.vmin) < e || Math.abs(T[i + 1] - b.vmax) < e;
    if (!(onU && onV)) return false;
  }
  return true;
}
function groovePlane(fs, o) {
  const mg = o.margin, along = o.dir === 'v';            // 'v': righe lungo v, quindi si ripetono lungo u
  const [a0, a1, b0, b1] = along ? [fs.b.umin + mg, fs.b.umax - mg, fs.b.vmin + mg, fs.b.vmax - mg] : [fs.b.vmin + mg, fs.b.vmax - mg, fs.b.umin + mg, fs.b.umax - mg];
  const p = o.pitch, N = Math.floor((a1 - a0) / p + 1e-6);
  if (N < 1 || b1 - b0 < 0.5) return { err: 'Il lato è troppo piccolo per questo passo o margine' };
  if (N > 600) return { err: 'Troppe scanalature: aumenta il passo' };
  const bd = grooveBoundary(o, N, p), W = N * p;
  const ext = o.margin > 0 ? 0 : 0.3, L = (b1 - b0) + 2 * ext;
  const shape = new THREE.Shape(), cy = o.mode === 'cut' ? 0.5 : -0.5;   // chiusura del solido lontano dalla superficie
  shape.moveTo(-W / 2, cy);
  bd.forEach(([a, y]) => shape.lineTo(a - W / 2, y));
  shape.lineTo(W / 2, cy); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -L / 2);
  const ac = (a0 + a1) / 2, bc = (b0 + b1) / 2;
  const pos = fs.o.clone().addScaledVector(along ? fs.u : fs.v, ac).addScaledVector(along ? fs.v : fs.u, bc);
  const M4 = along ? basisMatrix(fs.u, fs.n, fs.v, pos) : basisMatrix(fs.v, fs.n, fs.u, pos);
  g.applyMatrix4(M4);
  return { N, brush: cleanBrush(g) };
}
// adatta un cerchio ai vertici di un lato curvo verticale: centro, raggio, quota, e se gira tutto intorno
function fitRing(xy) {
  let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0, sz = 0, sxz = 0, syz = 0; const n = xy.length;
  for (const [x, y] of xy) { const r2 = x * x + y * y; sx += x; sy += y; sxx += x * x; sxy += x * y; syy += y * y; sz += r2; sxz += x * r2; syz += y * r2; }
  const m = new THREE.Matrix3().set(sxx, sxy, sx, sxy, syy, sy, sx, sy, n);
  if (Math.abs(m.determinant()) < 1e-9) return null;
  const inv = m.clone().invert(), v = new THREE.Vector3(sxz, syz, sz).applyMatrix3(inv);
  const cx = v.x / 2, cy = v.y / 2, R = Math.sqrt(Math.max(v.z + cx * cx + cy * cy, 0));
  if (!(R > 0.05)) return null;
  let err = 0; for (const [x, y] of xy) err = Math.max(err, Math.abs(Math.hypot(x - cx, y - cy) - R));
  return err < 0.01 + 0.004 * R ? { cx, cy, R, err } : null;
}
function ringGaps(xy, c) {
  const ang = xy.map(([x, y]) => Math.atan2(y - c.cy, x - c.cx)).sort((a, b) => a - b);
  let gap = 0, k = 0;
  for (let i = 0; i < ang.length; i++) { const g = (i + 1 < ang.length ? ang[i + 1] : ang[0] + 2 * Math.PI) - ang[i]; if (g > gap) { gap = g; k = i; } }
  return { gap, start: ang[(k + 1) % ang.length] };
}
function ringParams(fs) {
  const w = fs.world, xy = [], seen = new Set(); let zA = Infinity, zB = -Infinity;
  for (let i = 0; i < w.length; i += 3) {
    zA = Math.min(zA, w[i + 2]); zB = Math.max(zB, w[i + 2]);
    const k = Math.round(w[i] * 500) + ',' + Math.round(w[i + 1] * 500);
    if (!seen.has(k)) { seen.add(k); xy.push([w[i], w[i + 1]]); }
  }
  const c = fitRing(xy);
  if (!c) return null;
  const { gap } = ringGaps(xy, c);
  return { ...c, zA, zB, full: gap < 25 * D2R };
}
// spessore del materiale sotto il lato: dal punto sul lato verso l'interno fino alla prima uscita (per "Fora")
function exitDepth(obj, fs) {
  const w = fs.world, nT = w.length / 9, step = Math.max(1, Math.floor(nT / 14)), rc = new THREE.Raycaster();
  const tmp = new THREE.Mesh(obj.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  tmp.matrixWorld.copy(obj.matrixWorld); tmp.matrixAutoUpdate = false;
  const ring = fs.curved ? ringParams(fs) : null;
  let best = 0;
  for (let t = 0; t < nT; t += step) {
    const p = new THREE.Vector3((w[t * 9] + w[t * 9 + 3] + w[t * 9 + 6]) / 3, (w[t * 9 + 1] + w[t * 9 + 4] + w[t * 9 + 7]) / 3, (w[t * 9 + 2] + w[t * 9 + 5] + w[t * 9 + 8]) / 3);
    const n = ring ? new THREE.Vector3(p.x - ring.cx, p.y - ring.cy, 0).normalize() : fs.n;
    rc.set(p.clone().addScaledVector(n, 0.01), n.clone().negate());
    const hits = rc.intersectObject(tmp, false).filter(h => h.distance > 0.02);
    if (hits.length) best = Math.max(best, hits[0].distance - 0.01);
  }
  tmp.material.dispose();
  return best;
}
function grooveCylinder(obj, o, fs) {
  const rp = ringParams(fs);
  if (!rp) return { err: 'Le scanalature funzionano solo su lati piatti e su cilindri circolari, non su coni, sfere e tori' };
  if (!rp.full) return { err: 'Il lato curvo deve girare tutto intorno (cilindro circolare)' };
  const R = rp.R, H = rp.zB - rp.zA, mg = o.margin, p0 = o.pitch;
  let g, N;
  if (o.dir === 'v') {                                    // righe lungo l'asse
    N = Math.max(3, Math.round(2 * Math.PI * R / p0));
    if (N > 600) return { err: 'Troppe scanalature: aumenta il passo' };
    const p = 2 * Math.PI * R / N, bd = grooveBoundary(o, N, p), pts = bd.map(([a, y]) => { const th = a / R; return new THREE.Vector2((R + y) * Math.cos(th), (R + y) * Math.sin(th)); });
    const shape = new THREE.Shape(); let hole;
    if (o.mode === 'cut') { shape.absarc(0, 0, R + 0.5, 0, Math.PI * 2, false); hole = new THREE.Path(pts.slice().reverse()); }
    else { shape.setFromPoints(pts); hole = new THREE.Path(); hole.absarc(0, 0, R - 0.5, 0, Math.PI * 2, true); }
    shape.holes.push(hole);
    const z0 = mg > 0 ? mg : -0.3, z1 = mg > 0 ? H - mg : H + 0.3;
    if (z1 - z0 < 0.5) return { err: 'Il cilindro è troppo basso per questo margine' };
    g = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false, curveSegments: 1 });
    g.translate(0, 0, z0);
  } else {                                                // anelli attorno
    const L = H - 2 * mg; N = Math.floor(L / p0 + 1e-6);
    if (N < 1) return { err: 'Il cilindro è troppo basso per questo passo o margine' };
    if (N > 600) return { err: 'Troppe scanalature: aumenta il passo' };
    const z0 = mg + (L - N * p0) / 2, bd = grooveBoundary(o, N, p0);
    const rc = R - (o.mode === 'cut' ? -0.5 : 0.5);
    const pts = [new THREE.Vector2(rc, z0)];
    bd.forEach(([a, y]) => pts.push(new THREE.Vector2(R + y, z0 + a)));
    pts.push(new THREE.Vector2(rc, z0 + N * p0), new THREE.Vector2(rc, z0));
    g = new THREE.LatheGeometry(pts, 96); g.rotateX(Math.PI / 2);
    if (signedVolume(g) < 0) { const ng = g.index ? g.toNonIndexed() : g; const a = ng.attributes.position.array; for (let i = 0; i < a.length; i += 9) for (let k = 0; k < 3; k++) { const t = a[i + 3 + k]; a[i + 3 + k] = a[i + 6 + k]; a[i + 6 + k] = t; } g = ng; }
  }
  g.translate(rp.cx, rp.cy, rp.zA);
  return { N, brush: cleanBrush(g) };
}
function applyGrooves() {
  if (!faceSel) return;
  const o0 = { dir: gUI.dir, prof: gUI.prof, mode: gUI.mode, pitch: clamp(parseFloat($('#g-pitch').value) || 2, 0.4, 20), depth: clamp(parseFloat($('#g-depth').value) || 0.6, 0.1, 10), margin: Math.max(0, parseFloat($('#g-margin').value) || 0) };
  const obj = faceSel.obj, faces = faceSet.slice();
  if (heavyGuard([obj])) return;
  obj.updateMatrixWorld(true);
  let acc = obj, total = 0;
  for (const fs of faces) {
    const o = { ...o0 };
    if (o0.mode === 'through') {                                      // fora a filo: scanalature quadre profonde quanto il materiale
      const d = exitDepth(obj, fs);
      if (!(d > 0.2)) return toast('Non trovo il retro del pezzo: usa Incidi');
      if (fs.curved) { const rp = ringParams(fs); if (rp && d > rp.R * 1.9) return toast('Un cilindro pieno non si può forare: usa Incidi'); }
      o.mode = 'cut'; o.prof = 'square'; o.depth = d + 0.3;
    }
    let r;
    if (fs.curved) {
      r = grooveCylinder(obj, o, fs);
    } else {
      r = fs.rect && Math.abs(fs.u.dot(fs.v)) < 1e-6 && rectAligned(fs) ? groovePlane(fs, o) : groovesIrregular(fs, o);
    }
    if (r.err) return toast(r.err);
    acc = evaluator.evaluate(acc, r.brush, o.mode === 'cut' ? SUBTRACTION : ADDITION);
    total += r.N;
    if (fs.curved) break;
  }
  const baked = bakeResult(acc, obj.userData.name);
  if (!baked) return toast('Il risultato è vuoto');
  replaceWithMerged(obj, baked);
  toast(`Scanalature applicate: ${total}`);
}
document.querySelectorAll('#g-dir button, #g-prof button, #g-mode button').forEach(b => b.addEventListener('click', () => {
  const grp = b.parentElement.id.slice(2); gUI[grp] = b.dataset.v;
  b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
}));
$('#g-go').addEventListener('click', applyGrooves);
['#g-pitch', '#g-depth', '#g-margin'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') applyGrooves(); }));
// Estrusione per CSG: prisma sotto/sopra il lato, unito o sottratto. Non deforma i lati vicini (niente spuntoni).
function prismGeometry(f, dist) {
  const w = f.world, k = w.length / 9, q = x => Math.round(x * 2000);
  const key = (i) => q(w[i]) + ',' + q(w[i + 1]) + ',' + q(w[i + 2]);
  const dirEdges = new Map();
  for (let t = 0; t < k; t++) for (let j = 0; j < 3; j++) {
    const a = t * 9 + j * 3, b = t * 9 + ((j + 1) % 3) * 3;
    dirEdges.set(key(a) + '>' + key(b), [a, b]);
  }
  const bnd = [];
  for (const [kk, [a, b]] of dirEdges) { const [ka, kb] = kk.split('>'); if (!dirEdges.has(kb + '>' + ka)) bnd.push([a, b]); }
  const ov = 0.3, n = f.n, pos = [];
  const P = (i, off) => [w[i] + n.x * off, w[i + 1] + n.y * off, w[i + 2] + n.z * off];
  const up = dist > 0;
  const lo = up ? -ov : dist, hi = up ? dist : ov; // il prisma va da lo a hi lungo n
  for (let t = 0; t < k; t++) {
    const i0 = t * 9, i1 = t * 9 + 3, i2 = t * 9 + 6;
    pos.push(...P(i0, hi), ...P(i1, hi), ...P(i2, hi));   // faccia alta, verso +n
    pos.push(...P(i0, lo), ...P(i2, lo), ...P(i1, lo));   // faccia bassa, verso -n
  }
  for (const [a, b] of bnd) {
    const A = P(a, lo), B = P(b, lo), A2 = P(a, hi), B2 = P(b, hi);
    pos.push(...A, ...B, ...B2, ...A, ...B2, ...A2);
  }
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
function prismPush(obj, faces, dist) {
  let acc = obj;
  obj.updateMatrixWorld(true);
  for (const f of faces) {
    const br = new Brush(prismGeometry(f, dist), M.solid);
    br.updateMatrixWorld(true);
    acc = evaluator.evaluate(acc, br, dist > 0 ? ADDITION : SUBTRACTION);
  }
  return bakeResult(acc, obj.userData.name);
}
// Sposta i vertici del lato lungo la sua normale: i lati attorno si allungano o si accorciano. Funziona su qualsiasi lato piatto.
function applyPush(distArg) {
  const fs = faceSel, dist = typeof distArg === 'number' ? distArg : parseFloat(TF.push.value);
  if (!fs || !Number.isFinite(dist) || Math.abs(dist) < 1e-4) return;
  const nFaces = faceSet.length, objs = [...new Set(faceSet.map(f => f.obj))], out = [];
  let fail = null, ext = false;
  for (const obj of objs) {
    const r = pushOne(obj, faceSet.filter(f => f.obj === obj), dist);
    if (r.err) { fail = r.err; break; }
    out.push(r.mesh); ext = ext || r.ext;
  }
  if (out.length) {
    TF.push.value = '';
    clearFace(false);
    setSelection([...out, ...(fail ? [] : [])]);
    touch(); commit();
  }
  if (fail) return toast(fail);
  if (ext) return toast(`${nFaces > 1 ? nFaces + ' lati' : 'Lato'} estruso di ${fmt(Math.abs(dist))} mm (sagoma del lato, senza deformare i vicini)`);
  toast((nFaces > 1 ? `${nFaces} lati ` : 'Lato ') + (dist > 0 ? `tirato di ${fmt(dist)} mm` : `spinto di ${fmt(Math.abs(dist))} mm`));
}

// Lato curvo di un solido "estruso in verticale" (cilindro, prisma, scatola arrotondata...): si sposta il profilo visto dall'alto, senza passare dal CSG.
// Così i bordi restano netti e il piano superiore e inferiore non hanno fessure.
function pushVertical(obj, fs, dist) {
  if (Math.abs(fs.n.z) > 1e-3) return null;
  obj.updateMatrixWorld(true);
  const g = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
  g.applyMatrix4(obj.matrixWorld);
  const A = g.attributes.position.array, nT = A.length / 9, q = x => Math.round(x * 2000);
  const kxy = (x, y) => q(x) + ',' + q(y);
  let zmin = Infinity, zmax = -Infinity;
  for (let i = 2; i < A.length; i += 3) { zmin = Math.min(zmin, A[i]); zmax = Math.max(zmax, A[i]); }
  const dir = new Map(), P = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let t = 0; t < nT; t++) {
    const o = t * 9;
    a.set(A[o], A[o + 1], A[o + 2]); b.set(A[o + 3], A[o + 4], A[o + 5]); c.set(A[o + 6], A[o + 7], A[o + 8]);
    nn.subVectors(b, a).cross(c.clone().sub(a)); const l = nn.length(); if (l < 1e-9) continue; nn.divideScalar(l);
    if (Math.abs(nn.z) < 1e-3) continue;                                  // parete verticale
    if (Math.abs(nn.z) < 0.9999) return null;                             // inclinata: non è un'estrusione
    if (nn.z < 0) continue;
    if (Math.abs(a.z - zmax) > 1e-3) { if (Math.abs(a.z - zmin) < 1e-3) return null; return null; }
    const v = [a, b, c].map(p => { const k = kxy(p.x, p.y); if (!P.has(k)) P.set(k, [p.x, p.y]); return k; });
    for (let k = 0; k < 3; k++) { const e = v[k] + '>' + v[(k + 1) % 3]; dir.set(e, [v[k], v[(k + 1) % 3]]); }
  }
  // spigoli di bordo del piano superiore, concatenati in anelli
  const next = new Map();
  for (const [e, [u, w]] of dir) if (!dir.has(w + '>' + u)) { if (next.has(u)) return null; next.set(u, w); }
  if (!next.size) return null;
  const loops = [], seen = new Set();
  for (const st of next.keys()) {
    if (seen.has(st)) continue;
    const loop = []; let cur = st;
    while (cur !== undefined && !seen.has(cur)) { seen.add(cur); loop.push(cur); cur = next.get(cur); }
    if (cur !== st) return null;
    loops.push(loop);
  }
  // spigoli del lato scelto, visti dall'alto
  const sel = new Set();
  const w = fs.world;
  for (let t = 0; t < w.length / 9; t++) {
    // solo la metà rivolta verso la direzione di spinta: il profilo si stacca dove la curva è tangente, senza pieghe
    const ex = w[t * 9 + 3] - w[t * 9], ey = w[t * 9 + 4] - w[t * 9 + 1], fx = w[t * 9 + 6] - w[t * 9], fy = w[t * 9 + 7] - w[t * 9 + 1], fz = w[t * 9 + 8] - w[t * 9 + 2], ez = w[t * 9 + 5] - w[t * 9 + 2];
    const nx = ey * fz - ez * fy, ny = ez * fx - ex * fz, nl = Math.hypot(nx, ny) || 1;
    if ((nx * fs.n.x + ny * fs.n.y) / nl < 0.02) continue;
    const ks = [0, 1, 2].map(j => kxy(w[t * 9 + j * 3], w[t * 9 + j * 3 + 1]));
    for (let j = 0; j < 3; j++) { const u = ks[j], v = ks[(j + 1) % 3]; if (u !== v) { sel.add(u + '|' + v); sel.add(v + '|' + u); } }
  }
  const dx = fs.n.x * dist, dy = fs.n.y * dist, out = [];
  let moved = 0;
  for (const loop of loops) {
    const n = loop.length, isSel = i => sel.has(loop[i] + '|' + loop[(i + 1) % n]);
    const ed = i => { const [x0, y0] = P.get(loop[i]), [x1, y1] = P.get(loop[(i + 1) % n]), l = Math.hypot(x1 - x0, y1 - y0) || 1; return [(x1 - x0) / l, (y1 - y0) / l]; };
    const dd = Array.from({ length: n }, (_, i) => ed(i));
    const facing = i => dd[i][1] * fs.n.x - dd[i][0] * fs.n.y;          // normale uscente del muro · direzione di spinta
    const flags = Array.from({ length: n }, (_, i) => isSel(i) && facing(i) >= 0.02);
    // la curva liscia si estende fino al punto in cui smette di guardare nella direzione di spinta, qualunque sia il punto cliccato
    for (let ch = true, guard = 0; ch && guard < n; guard++) {
      ch = false;
      for (let i = 0; i < n; i++) {
        if (!flags[i]) continue;
        for (const j of [(i + 1) % n, (i + n - 1) % n]) {
          if (flags[j] || facing(j) < 0.02) continue;
          if (dd[i][0] * dd[j][0] + dd[i][1] * dd[j][1] < 0.94) continue;
          flags[j] = true; ch = true;
        }
      }
    }
    if (!flags.some(Boolean)) { out.push(loop.map(k => P.get(k))); continue; }
    let s0 = 0; while (flags[(s0 + n - 1) % n]) { s0 = (s0 + 1) % n; if (s0 === 0) break; }
    const pts = [];
    for (let m = 0; m < n; m++) {
      const i = (s0 + m) % n, prevSel = flags[(i + n - 1) % n], curSel = flags[i], [x, y] = P.get(loop[i]);
      if (!prevSel && !curSel) pts.push([x, y]);
      else if (!prevSel && curSel) { pts.push([x, y], [x + dx, y + dy]); moved++; }
      else if (prevSel && curSel) { pts.push([x + dx, y + dy]); moved++; }
      else { pts.push([x + dx, y + dy], [x, y]); moved++; }
    }
    out.push(pts);
  }
  if (!moved) return null;
  const K = 1000, C = ClipperLib;
  const paths = out.map(pl => pl.map(([x, y]) => ({ X: Math.round(x * K), Y: Math.round(y * K) })));
  const simp = C.Clipper.SimplifyPolygons(paths, C.PolyFillType.pftNonZero);
  if (!simp.length) return { err: 'Il risultato è vuoto' };
  const shapes = []; let cur = null;
  const area = p => { let a2 = 0; for (let i = 0; i < p.length; i++) { const u = p[i], v = p[(i + 1) % p.length]; a2 += u.X * v.Y - v.X * u.Y; } return a2; };
  for (const p of simp.sort((u, v) => Math.abs(area(v)) - Math.abs(area(u)))) {
    const pts = p.map(t => new THREE.Vector2(t.X / K, t.Y / K));
    if (area(p) > 0) { cur = new THREE.Shape(pts); shapes.push(cur); } else if (cur) cur.holes.push(new THREE.Path(pts));
  }
  const ex = new THREE.ExtrudeGeometry(shapes, { depth: zmax - zmin, bevelEnabled: false, curveSegments: 1 });
  ex.translate(0, 0, zmin);
  const pos = (ex.index ? ex.toNonIndexed() : ex).attributes.position.array;
  const baked = bakeResult({ updateMatrixWorld() {}, matrixWorld: new THREE.Matrix4(), geometry: geometryFromPositions(Float32Array.from(pos)) }, obj.userData.name);
  return baked ? { baked } : { err: 'Il risultato è vuoto' };
}
const FLAT_MSG = 'Il lato arriverebbe a spessore zero: il pezzo sparirebbe. Usa una distanza minore';
function isFlat(b) { return Math.min(b.size.x, b.size.y, b.size.z) < 0.1; }   // un pezzo senza spessore sparisce e non si può più modificare
function pushOne(obj, faces, dist) {
  if (faces.length === 1 && faces[0].full && ['cylinder', 'cone'].includes(obj.userData.kind)) {   // lato intero di un cilindro: allarga o stringe il raggio
    const u = obj.userData, nd = u.p.w + 2 * dist;
    if (nd < 0.2) return { err: FLAT_MSG };
    setSize(obj, 'w', nd); setSize(obj, 'd', nd);
    return { mesh: obj, ext: false };
  }
  if (faces.length === 1 && faces[0].curved) {
    let pv = null; try { pv = pushVertical(obj, faces[0], dist); } catch (e) { pv = null; }
    if (pv && pv.err) return { err: pv.err };
    if (pv && pv.baked) { if (isFlat(pv.baked)) return { err: FLAT_MSG }; return { mesh: replaceWithMerged(obj, pv.baked, true), ext: true }; }
  }
  obj.updateMatrixWorld(true);
  let g = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
  g.applyMatrix4(obj.matrixWorld);
  const pos = g.attributes.position, arr = new Float32Array(pos.array);
  const q = v => Math.round(v * 2000);
  const key = (x, y, z) => q(x) + ',' + q(y) + ',' + q(z);
  const disp = new Map();
  for (const f of faces) {
    const seen = new Set();
    for (let i = 0; i < f.world.length; i += 3) {
      const k = key(f.world[i], f.world[i + 1], f.world[i + 2]);
      if (seen.has(k)) continue;
      seen.add(k);
      const d = disp.get(k) || [0, 0, 0];
      d[0] += f.vn[i] * dist; d[1] += f.vn[i + 1] * dist; d[2] += f.vn[i + 2] * dist;
      disp.set(k, d);
    }
  }
  let moved = 0;
  for (let i = 0; i < arr.length; i += 3) {
    const d = disp.get(key(arr[i], arr[i + 1], arr[i + 2]));
    if (!d) continue;
    arr[i] += d[0]; arr[i + 1] += d[1]; arr[i + 2] += d[2]; moved++;
  }
  // se lo spostamento stira troppo i triangoli vicini (spuntoni), si passa all'estrusione per CSG
  let spiky = false;
  const orig = pos.array, maxEdge = (A, t) => { let m = 0; for (let j = 0; j < 3; j++) { const a = t * 9 + j * 3, b = t * 9 + ((j + 1) % 3) * 3; m = Math.max(m, Math.hypot(A[a] - A[b], A[a + 1] - A[b + 1], A[a + 2] - A[b + 2])); } return m; };
  for (let t = 0; t < arr.length / 9 && !spiky; t++) {
    let touched = false;
    for (let j = 0; j < 9 && !touched; j++) touched = arr[t * 9 + j] !== orig[t * 9 + j];
    if (!touched) continue;
    const o = maxEdge(orig, t), nw = maxEdge(arr, t);
    if (nw > o * 2.5 && nw - o > 2) spiky = true;
  }
  g.dispose();
  if (!moved) return { err: 'Impossibile spostare questo lato' };
  if (spiky) {
    let b2 = null;
    try { b2 = prismPush(obj, faces.slice(), dist); } catch (e) { b2 = null; }
    if (b2 && isFlat(b2)) return { err: FLAT_MSG };
    if (b2) return { mesh: replaceWithMerged(obj, b2, true), ext: true };
  }
  const baked = bakeResult({ updateMatrixWorld() {}, matrixWorld: new THREE.Matrix4(), geometry: geometryFromPositions(arr) }, obj.userData.name);
  if (!baked) return { err: 'Il risultato è vuoto' };
  if (isFlat(baked)) return { err: FLAT_MSG };
  return { mesh: replaceWithMerged(obj, baked, true) };
}
/* maniglia del lato: trascina lungo la normale, con calamita sui piani vicini */
const faceHandle = (() => {
  const mat = new THREE.SpriteMaterial({ map: handleTexture('#ff6a00'), sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true });
  const sp = new THREE.Sprite(mat); sp.scale.setScalar(0.024); sp.renderOrder = 999; sp.visible = false; scene.add(sp); return sp;
})();
const guideMat = new THREE.ShaderMaterial({
  uniforms: { uSize: { value: new THREE.Vector2(50, 50) }, uCell: { value: 2.5 }, uCol: { value: new THREE.Color(ACCENT_HEX) } },
  transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    varying vec2 vUv; uniform vec2 uSize; uniform float uCell; uniform vec3 uCol;
    float line(vec2 p, float w){ vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p); return 1.0 - min(min(g.x, g.y) / w, 1.0); }
    void main(){
      vec2 p = vUv * uSize / uCell;
      float minor = line(p, 0.9) * 0.55;
      float major = line(p / 4.0, 1.1) * 0.9;
      vec2 e = min(vUv, 1.0 - vUv) * uSize;
      float edge = smoothstep(0.0, min(min(uSize.x, uSize.y) * 0.45, 14.0), min(e.x, e.y));
      float vig = 1.0 - smoothstep(0.55, 1.05, length((vUv - 0.5) * 2.0));
      float fade = edge * mix(0.35, 1.0, vig);
      float glow = (1.0 - smoothstep(0.0, 0.8, length((vUv - 0.5) * 2.0))) * 0.10;
      float a = (max(minor, major) * 0.8 + glow) * fade;
      gl_FragColor = vec4(uCol, a);
    }`,
});
guideMat.extensions = { derivatives: true };
const guide = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), guideMat);
guide.visible = false; guide.renderOrder = 2; guide.raycast = () => {}; scene.add(guide);
const dragRead = document.createElement('div'); dragRead.id = 'dragread'; document.body.appendChild(dragRead);
function faceCenter(fs) {
  const { umin, umax, vmin, vmax } = fs.b;
  return fs.o.clone().addScaledVector(fs.u, (umin + umax) / 2).addScaledVector(fs.v, (vmin + vmax) / 2);
}
// punto medio di tutti i lati selezionati, e ingombro nel piano del lato principale
function groupCenter() {
  const c = new THREE.Vector3();
  faceSet.forEach(f => c.add(faceCenter(f)));
  return c.divideScalar(faceSet.length || 1);
}
function groupBounds(fs) {
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  const p = new THREE.Vector3();
  for (const f of faceSet) for (let i = 0; i < f.world.length; i += 3) {
    p.set(f.world[i], f.world[i + 1], f.world[i + 2]).sub(fs.o);
    const uu = p.dot(fs.u), vv = p.dot(fs.v);
    if (uu < u0) u0 = uu; if (uu > u1) u1 = uu; if (vv < v0) v0 = vv; if (vv > v1) v1 = vv;
  }
  return { u0, u1, v0, v1 };
}
function updateFaceHandle() {
  const on = faceSel && state.tool === 'face';
  faceHandle.visible = !!on;
  if (on) faceHandle.position.copy(groupCenter());
  guide.visible = false; dragRead.style.display = 'none'; dirty = true;
}
// piani paralleli (normale uguale o opposta) di tutti gli oggetti, come distanza lungo n dal lato
function collectPlanes(fs) {
  const base = fs.n.dot(faceCenter(fs)), set = new Set(), v = new THREE.Vector3(), wn = new THREE.Vector3();
  for (const m of objects) {
    m.updateMatrixWorld(true);
    const info = meshInfo(m.geometry), geo = m.geometry, pos = geo.attributes.position, idx = geo.index;
    const nm = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
    for (let t = 0; t < info.nTri; t++) {
      if (!info.ok[t]) continue;
      wn.set(info.nrm[t * 3], info.nrm[t * 3 + 1], info.nrm[t * 3 + 2]).applyMatrix3(nm).normalize();
      if (Math.abs(wn.dot(fs.n)) < 0.9999) continue;
      v.fromBufferAttribute(pos, idx ? idx.getX(t * 3) : t * 3).applyMatrix4(m.matrixWorld);
      set.add(Math.round((fs.n.dot(v) - base) * 50) / 50);
    }
  }
  return [...set];
}
function faceDragAxis(fs, ray) { // parametro lungo la normale più vicino al raggio
  const w0 = groupCenter().sub(ray.origin), b = fs.n.dot(ray.direction), d = fs.n.dot(w0), e = ray.direction.dot(w0);
  const den = 1 - b * b;
  return Math.abs(den) < 1e-4 ? null : (b * e - d) / den;
}
function startFaceDrag(e) {
  const fs = faceSel;
  setRay(e);
  const t0 = faceDragAxis(fs, raycaster.ray);
  return { fs, bounds: groupBounds(fs), t0: t0 ?? 0, planes: collectPlanes(fs), dist: 0, snapped: false };
}
function moveFaceDrag(e, fd) {
  const fs = fd.fs;
  setRay(e);
  const t = faceDragAxis(fs, raycaster.ray);
  if (t === null) return;
  let dist = t - fd.t0, snapped = false;
  const tol = worldPerPixel() * 9;
  let best = null;
  for (const p of fd.planes) if (Math.abs(p) > 0.01 && Math.abs(p - dist) < tol && (best === null || Math.abs(p - dist) < Math.abs(best - dist))) best = p;
  const par = fs.full && ['cylinder', 'cone'].includes(fs.obj.userData.kind);
  if (par) { best = null; snapped = false; }
  if (best !== null) { dist = best; snapped = true; } else dist = snapV(dist);
  if (par) dist = Math.max(dist, -(fs.obj.userData.p.w / 2 - 0.2));      // il raggio non scende sotto 0,2 mm
  fd.dist = dist; fd.snapped = snapped;
  const c = groupCenter().addScaledVector(fs.n, dist);
  faceHandle.position.copy(c);
  if (par) {                                                              // lato intero di un cilindro: anteprima del cilindro che si allarga o si stringe
    const R = fs.obj.userData.p.w / 2, k = (R + dist) / R;
    fs.obj.scale.set(k, k, 1); selMeshes.forEach(m => { m.visible = false; });
  } else faceSet.forEach((f, i) => selMeshes[i] && selMeshes[i].position.copy(f.n).multiplyScalar(dist));
  guide.visible = snapped;
  if (snapped) {
    const B = fd.bounds, mg = 4, gw = B.u1 - B.u0 + mg * 2, gh = B.v1 - B.v0 + mg * 2;
    guide.scale.set(gw, gh, 1);
    guideMat.uniforms.uSize.value.set(gw, gh);
    guide.position.copy(fs.o).addScaledVector(fs.u, (B.u0 + B.u1) / 2).addScaledVector(fs.v, (B.v0 + B.v1) / 2).addScaledVector(fs.n, dist);
    guide.quaternion.setFromRotationMatrix(basisMatrix(fs.u, fs.v, fs.n, new THREE.Vector3()));
  }
  const v = c.clone().project(camera);
  dragRead.style.display = 'block';
  dragRead.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth + 18) + 'px';
  dragRead.style.top = ((-v.y * 0.5 + 0.5) * window.innerHeight - 12) + 'px';
  dragRead.textContent = par ? `Ø ${fmt((fs.obj.userData.p.w / 2 + dist) * 2)} mm` : `${dist > 0 ? '+' : ''}${fmt(dist)} mm${snapped ? ' · allineato' : ''}`;
  dirty = true;
}
function updateFacePanel() {
  const fs = faceSel;
  $('#f-info').textContent = faceSet.length > 1 ? `· ${faceSet.length} lati selezionati` : `${fmt(fs.W)} × ${fmt(fs.H)} mm${fs.curved ? ' · curvo' : fs.rect ? '' : ' · irregolare'}`;
  $('#f-push-hint').textContent = 'Trascina il quadratino arancione sul lato (si aggancia ai piani vicini) o scrivi i mm. Positivo: tira fuori. Negativo: spingi dentro.';
}
$('#f-push-go').addEventListener('click', () => applyPush());
TF.push.addEventListener('keydown', e => { if (e.key === 'Enter') applyPush(); });

/* ------------------------------------------------------------ importa 3MF / STL */
function geometryFromPositions(arr) {
  let g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(arr, 3));
  g = mergeVertices(g, 1e-4);
  g = toCreasedNormals(g, 30 * D2R);
  return mergeVertices(clean(g), 1e-4);
}
function parse3MF(buf) {
  const files = unzipSync(new Uint8Array(buf)), dec = new TextDecoder();
  const text = n => { if (!files[n]) throw new Error('Manca ' + n); return dec.decode(files[n]); };
  let root = '3D/3dmodel.model';
  if (files['_rels/.rels']) { const mm = /Target="\/?([^"]*\.model)"/i.exec(text('_rels/.rels')); if (mm) root = mm[1]; }
  const cache = {};
  const load = path => {
    path = path.replace(/^\//, '');
    if (cache[path]) return cache[path];
    const doc = new DOMParser().parseFromString(text(path), 'application/xml');
    const objs = {};
    for (const o of doc.getElementsByTagName('object')) {
      const rec = { type: o.getAttribute('type') || 'model', comps: [...o.getElementsByTagName('component')].map(c => ({ id: c.getAttribute('objectid'), path: c.getAttribute('p:path'), tf: c.getAttribute('transform') })) };
      const mesh = o.getElementsByTagName('mesh')[0];
      if (mesh) {
        const vs = mesh.getElementsByTagName('vertex'), ts = mesh.getElementsByTagName('triangle');
        rec.v = new Float32Array(vs.length * 3); rec.t = new Uint32Array(ts.length * 3);
        for (let i = 0; i < vs.length; i++) rec.v.set([+vs[i].getAttribute('x'), +vs[i].getAttribute('y'), +vs[i].getAttribute('z')], i * 3);
        for (let i = 0; i < ts.length; i++) rec.t.set([+ts[i].getAttribute('v1'), +ts[i].getAttribute('v2'), +ts[i].getAttribute('v3')], i * 3);
      }
      objs[o.getAttribute('id')] = rec;
    }
    const items = [...doc.getElementsByTagName('item')].map(i => ({ id: i.getAttribute('objectid'), path: i.getAttribute('p:path'), tf: i.getAttribute('transform') }));
    return (cache[path] = { unit: doc.documentElement.getAttribute('unit') || 'millimeter', objs, items });
  };
  const mat = s => {
    const m = new THREE.Matrix4();
    if (s) { const a = s.trim().split(/\s+/).map(Number); if (a.length === 12) m.set(a[0], a[3], a[6], a[9], a[1], a[4], a[7], a[10], a[2], a[5], a[8], a[11], 0, 0, 0, 1); }
    return m;
  };
  const rootModel = load(root);
  const scale = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 }[rootModel.unit] ?? 1;
  const emit = (path, id, M4, out, depth = 0) => {
    const o = load(path).objs[id];
    if (!o || depth > 8) return;
    if (['other', 'support', 'surface'].includes(o.type)) return;   // volumi modificatori e supporti (Bambu/Orca): non sono geometria
    if (o.v) {
      const P = new THREE.Vector3();
      for (let i = 0; i < o.t.length; i++) { P.set(o.v[o.t[i] * 3], o.v[o.t[i] * 3 + 1], o.v[o.t[i] * 3 + 2]).applyMatrix4(M4).multiplyScalar(scale); out.push(P.x, P.y, P.z); }
    }
    for (const c of o.comps) emit(c.path || path, c.id, M4.clone().multiply(mat(c.tf)), out, depth + 1);
  };
  let list = rootModel.items;
  if (!list.length) list = Object.keys(rootModel.objs).filter(k => rootModel.objs[k].v).map(k => ({ id: k, path: null, tf: null }));
  return list.map(it => { const out = []; emit(it.path || root, it.id, mat(it.tf), out); return { pos: Float32Array.from(out) }; }).filter(it => it.pos.length >= 9);
}
function addImportedItems(items, baseName) {
  const boxes = items.map(it => { const b = new THREE.Box3(), p = new THREE.Vector3(); for (let i = 0; i < it.pos.length; i += 3) b.expandByPoint(p.set(it.pos[i], it.pos[i + 1], it.pos[i + 2])); return b; });
  const all = new THREE.Box3();
  boxes.forEach(b => all.union(b));
  const ac = all.getCenter(new THREE.Vector3());
  return items.map((it, i) => {
    const b = boxes[i], c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
    const g = geometryFromPositions(it.pos);
    g.translate(-c.x, -c.y, -b.min.z);
    counters.merged++;
    return makeMesh({ kind: 'merged', name: items.length > 1 ? `${baseName} ${i + 1}` : baseName, geo: g, pos: [c.x - ac.x, c.y - ac.y, b.min.z - all.min.z], p: { w: s.x, d: s.y, h: s.z }, base: { w: s.x, d: s.y, h: s.z } });
  });
}
async function importFiles(files) {
  for (const f of files) {
    const ext = f.name.split('.').pop().toLowerCase();
    try {
      const buf = await f.arrayBuffer();
      let items;
      if (ext === '3mf') items = parse3MF(buf);
      else if (ext === 'stl') items = [{ pos: Float32Array.from(new STLLoader().parse(buf).attributes.position.array) }];
      else if (ext === 'svg') {
        const items = svgItems(new TextDecoder().decode(buf));
        if (!items) { toast('Nessun riempimento trovato nell\'SVG (i soli contorni non sono supportati)'); continue; }
        const made = addImportedItems(items, f.name.replace(/\.[^.]+$/, ''));
        made.forEach((m, i) => { m.userData.color = items[i].color; });
        if (made.length > 1) { const gid = nextGid++; made.forEach(m => { m.userData.gid = gid; }); }
        setSelection(made); touch(); commit(); fitView();
        toast(`Importato ${f.name}: spessore 1 mm, lato maggiore 60 mm${made.length > 1 ? ` · ${made.length} pezzi raggruppati` : ''}`);
        continue;
      }
      else if (['ttf', 'otf', 'woff'].includes(ext)) { const e = addUserFont(buf, f.name); saveFonts(f.name, buf); fillFonts(); toast(`Font aggiunto: ${e.name}`); continue; }
      else if (ext === 'woff2') { toast('WOFF2 non è supportato: usa TTF, OTF o WOFF'); continue; }
      else { toast(`Formato non supportato: .${ext}`); continue; }
      if (!items.length) { toast('Nessuna forma trovata nel file'); continue; }
      if (items.length > 12) {
        const total = items.reduce((s, it) => s + it.pos.length, 0), all = new Float32Array(total);
        let o = 0;
        items.forEach(it => { all.set(it.pos, o); o += it.pos.length; });
        items = [{ pos: all }];
      }
      const made = addImportedItems(items, f.name.replace(/\.[^.]+$/, ''));
      setSelection(made); touch(); commit(); fitView();
      const tris = made.reduce((s, m) => s + m.geometry.index.count / 3, 0);
      toast(`Importato ${f.name}: ${made.length} ${made.length === 1 ? 'oggetto' : 'oggetti'}, ${tris.toLocaleString('it-IT')} triangoli`);
      if (made.some(m => m.userData.heavy)) setTimeout(() => toast(`Modello molto pesante (${tris.toLocaleString('it-IT')} triangoli): ho spento bordi, ombre e anteprima dei lati per tenerlo fluido. Per modificarlo conviene semplificarlo prima (in Bambu Studio: tasto destro, Semplifica modello).`, 9000), 2600);
    } catch (err) { console.error(err); toast(`Impossibile leggere ${f.name}`); }
  }
}

/* ------------------------------------------------------------- avvio */

/* ------------------------------------------------------------ distanza (righello) */
const ruler = { a: null, b: null, foot: null };
const rulerPts = [0, 1].map(() => { const d = document.createElement('div'); d.className = 'ruler-pt'; labelsEl.appendChild(d); return d; });
const rulerLabel = document.createElement('div'); rulerLabel.className = 'dim-label'; labelsEl.appendChild(rulerLabel);
const rulerGeo = new THREE.BufferGeometry(); rulerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
const rulerLine = new THREE.Line(rulerGeo, new THREE.LineBasicMaterial({ color: 0xff6a00, depthTest: false }));
rulerLine.renderOrder = 901; rulerLine.visible = false; rulerLine.frustumCulled = false; scene.add(rulerLine);
const rulerCard = $('#ruler-card');
function rulerCardText(lines) { rulerCard.innerHTML = lines.map((l, i) => `<div class="${i ? 'rc-sub' : 'rc-main'}"></div>`).join(''); [...rulerCard.children].forEach((el, i) => { el.textContent = lines[i]; }); rulerCard.classList.remove('hidden'); }
function clearRuler() {
  ruler.a = ruler.b = ruler.foot = null; rulerLine.visible = false;
  rulerPts.forEach(e => (e.style.display = 'none')); rulerLabel.style.display = 'none'; dirty = true;
  if (state.tool === 'ruler') rulerCardText([tr('Distanza'), tr('Clicca un punto o un lato, poi un secondo. Su due lati paralleli misura la distanza tra i piani.')]); else rulerCard.classList.add('hidden');
}
// punto cliccato sulla superficie; si aggancia a un vertice o a uno spigolo vicino
function rulerPick(hit) {
  const obj = hit.object, p = hit.point.clone();
  const n = hit.face ? hit.face.normal.clone().transformDirection(obj.matrixWorld).normalize() : null;
  const wpp = 2 * Math.tan(camera.fov * D2R / 2) * camera.position.distanceTo(p) / canvas.clientHeight, thr = 12 * wpp;
  const eg = obj.userData.edges?.geometry, pos = eg?.attributes.position;
  let snap = null, bv = thr, be = thr * 0.7, pv = null, pe = null;
  if (pos) {
    const A = new THREE.Vector3(), B = new THREE.Vector3(), AB = new THREE.Vector3(), tmp = new THREE.Vector3();
    obj.updateMatrixWorld(true);
    for (let i = 0; i + 1 < pos.count; i += 2) {
      A.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld); B.fromBufferAttribute(pos, i + 1).applyMatrix4(obj.matrixWorld);
      for (const V of [A, B]) { const d = V.distanceTo(p); if (d < bv) { bv = d; pv = V.clone(); } }
      AB.subVectors(B, A); const l2 = AB.lengthSq(); if (l2 < 1e-12) continue;
      const t = clamp(tmp.subVectors(p, A).dot(AB) / l2, 0, 1), q = A.clone().addScaledVector(AB, t), d = q.distanceTo(p);
      if (d < be) { be = d; pe = q; }
    }
  }
  if (pv) { p.copy(pv); snap = 'v'; } else if (pe) { p.copy(pe); snap = 'e'; }
  return { p, n, snap };
}
function rulerClick(hit) {
  if (!hit) { clearRuler(); return; }
  const pt = rulerPick(hit);
  if (!ruler.a || ruler.b) { clearRuler(); ruler.a = pt; rulerCardText([tr('Distanza'), tr('Ora clicca il secondo punto o lato.')]); dirty = true; return; }
  ruler.b = pt;
  const d = pt.p.clone().sub(ruler.a.p), a = ruler.a;
  const parallel = a.n && pt.n && !a.snap && !pt.snap && Math.abs(a.n.dot(pt.n)) > 0.9995;
  if (parallel) {
    const off = d.dot(a.n);
    ruler.foot = a.p.clone().addScaledVector(a.n, off);
    rulerCardText([`${fmt(Math.abs(off))} mm`, tr('Distanza tra i due lati paralleli')]);
  } else {
    ruler.foot = pt.p.clone();
    rulerCardText([`${fmt(d.length())} mm`, `${tr('Linea retta')} · ΔX ${fmt(Math.abs(d.x))} · ΔY ${fmt(Math.abs(d.y))} · ΔZ ${fmt(Math.abs(d.z))}`]);
  }
  const arr = rulerGeo.attributes.position.array; arr.set([a.p.x, a.p.y, a.p.z, ruler.foot.x, ruler.foot.y, ruler.foot.z]); rulerGeo.attributes.position.needsUpdate = true;
  rulerGeo.computeBoundingSphere();
  rulerLine.visible = true; dirty = true;
}
function updateRuler() {
  const w = window.innerWidth, h = window.innerHeight;
  const place = (el, P) => { const v = P.clone().project(camera); if (v.z > 1 || v.z < -1) { el.style.display = 'none'; return; } el.style.display = 'block'; el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%,-50%)`; };
  if (!ruler.a) { rulerPts.forEach(e => (e.style.display = 'none')); rulerLabel.style.display = 'none'; return; }
  place(rulerPts[0], ruler.a.p);
  if (!ruler.b) { rulerPts[1].style.display = 'none'; rulerLabel.style.display = 'none'; return; }
  place(rulerPts[1], ruler.foot);
  const mid = ruler.a.p.clone().add(ruler.foot).multiplyScalar(0.5);
  place(rulerLabel, mid);
  rulerLabel.textContent = rulerCard.firstChild.textContent;
}
function render() {
  edgeMat.resolution.set(canvas.clientWidth, canvas.clientHeight); edgeHoverMat.resolution.copy(edgeMat.resolution);
  if (rotGizmo.visible) updateRotGizmo();
  updateHandleFacing();
  updateDims();   // prima del disegno: la scatola e le linee delle misure compaiono subito, non al movimento successivo
  updateRuler();
  renderer.render(scene, camera);
  // le maniglie hanno dimensione costante sullo schermo: nulla da aggiornare
}
function frame() {
  requestAnimationFrame(frame);
  if (tween) stepTween();
  if (dirty) { dirty = false; render(); }
}

/* ------------------------------------------- spigoli: raccordi e smussi */
const edgeMat = new LineMaterial({ color: 0xff6a00, linewidth: 4, depthTest: false, transparent: true });
const edgeHoverMat = new LineMaterial({ color: 0xff6a00, linewidth: 3, depthTest: false, transparent: true, opacity: 0.45 });
let edgeSel = [];            // [{obj, chain}]
let edgeLines = null, edgeHoverLine = null, edgeHoverKey = null;
const edgeCache = new WeakMap();
const edgeMode = { v: 'fillet' };
function worldPositions(obj) {
  obj.updateMatrixWorld(true);
  const g = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
  g.applyMatrix4(obj.matrixWorld);
  const arr = new Float32Array(g.attributes.position.array); g.dispose();
  return arr;
}
function edgeAnalysis(obj) {
  const key = obj.geometry.uuid + '|' + obj.matrixWorld.elements.map(v => v.toFixed(4)).join();
  let c = edgeCache.get(obj);
  if (!c || c.key !== key) { c = { key, an: analyze(worldPositions(obj)) }; edgeCache.set(obj, c); }
  return c.an;
}
function chainSegments(chain) {
  const out = [], p = chain.pts, n = p.length;
  for (let i = 0; i < (chain.closed ? n : n - 1); i++) { const a = p[i], b = p[(i + 1) % n]; out.push(a.x, a.y, a.z, b.x, b.y, b.z); }
  return out;
}
function makeLines(chains, mat) {
  const seg = []; chains.forEach(c => seg.push(...chainSegments(c)));
  const g = new LineSegmentsGeometry(); g.setPositions(seg);
  const l = new LineSegments2(g, mat); l.renderOrder = 999; l.frustumCulled = false;
  scene.add(l); return l;
}
function dropLines(l) { if (l) { scene.remove(l); l.geometry.dispose(); } }
function edgeAtPointer(e, hit) {
  if (!hit) return null;
  const obj = hit.object, an = edgeAnalysis(obj);
  const wpp = 2 * camera.position.distanceTo(hit.point) * Math.tan(camera.fov * D2R / 2) / canvas.clientHeight;
  const ed = nearestEdge(an, hit.point, Math.max(0.8, 14 * wpp));
  if (!ed) return null;
  return { obj, an, ed };
}
function updateEdgeHover(e) {
  const r = edgeAtPointer(e, pickHit(e));
  const key = r ? r.obj.userData.id + ':' + r.ed.key : null;
  canvas.style.cursor = r ? 'pointer' : 'crosshair';
  if (key === edgeHoverKey) return;
  edgeHoverKey = key; dropLines(edgeHoverLine); edgeHoverLine = null;
  if (r) edgeHoverLine = makeLines([chainOf(r.an, r.ed)], edgeHoverMat);
  dirty = true;
}
function sameChain(a, b) { return a.obj === b.obj && a.chain.verts.length === b.chain.verts.length && new Set(a.chain.verts).size === new Set(b.chain.verts).size && b.chain.verts.every(v => a.chain.verts.includes(v)); }
function selectEdgeAt(hit, add) {
  const r = edgeAtPointer(null, hit);
  if (!r) { if (!add) clearEdges(); return; }
  const item = { obj: r.obj, chain: chainOf(r.an, r.ed) };
  const i = edgeSel.findIndex(x => sameChain(x, item));
  if (i >= 0) edgeSel.splice(i, 1);
  else if (add && edgeSel.every(x => x.obj === item.obj)) edgeSel.push(item);
  else edgeSel = [item];
  if (!selection.includes(item.obj)) setSelection([item.obj]);
  refreshEdgeLines(); updateEdgePanel(); updateEdgeHandle();
}
function refreshEdgeLines() {
  dropLines(edgeLines); edgeLines = edgeSel.length ? makeLines(edgeSel.map(x => x.chain), edgeMat) : null;
  dirty = true;
}
function clearEdges() {
  edgeSel = []; refreshEdgeLines(); updateEdgeHandle(); dragRead.style.display = 'none';
  dropLines(edgeHoverLine); edgeHoverLine = null; edgeHoverKey = null;
}
const EF = { size: $('#e-size'), go: $('#e-go'), info: $('#e-info'), hint: $('#e-hint') };
function updateEdgePanel() {
  const n = edgeSel.length;
  EF.info.textContent = n ? `· ${n} ${n === 1 ? 'spigolo' : 'spigoli'}` : tr('· nessuno selezionato');
  EF.hint.textContent = n ? 'Scegli il tipo e la misura, poi Applica.' : 'Clicca uno spigolo del pezzo. Maiusc + clic: aggiungi o togli spigoli.';
  EF.go.disabled = !n;
  const lp = !!selectedLoop();
  $('#e-fillet-box').classList.toggle('dim', !n); $('#e-scale-box').classList.toggle('dim', !lp);
  $('#e-size').disabled = !n; $('#e-scale').disabled = !lp; $('#e-scale-go').disabled = !lp;
  document.querySelectorAll('#e-type button').forEach(b => b.classList.toggle('on', b.dataset.v === edgeMode.v));
}
document.querySelectorAll('#e-type button').forEach(b => b.addEventListener('click', () => { edgeMode.v = b.dataset.v; updateEdgePanel(); }));
// ridimensiona un anello chiuso (es. il bordo superiore di un cilindro): i vertici si spostano radialmente, il pezzo diventa un tronco di cono
function scaleEdge(obj, chain, f) {
  const P = chain.pts, c = new THREE.Vector3();
  P.forEach(p => c.add(p)); c.divideScalar(P.length);
  const nrm = new THREE.Vector3();
  for (let i = 0; i < P.length; i++) { const a = P[i].clone().sub(c), b = P[(i + 1) % P.length].clone().sub(c); nrm.add(a.cross(b)); }
  if (nrm.lengthSq() < 1e-9) return { err: 'Questi spigoli non formano un anello piano' };
  nrm.normalize();
  const u = obj.userData;
  // cilindro o cono dritto: resta parametrico (Cima %)
  if ((u.kind === 'cylinder' || u.kind === 'cone') && Math.abs(u.p.w - u.p.d) < 0.01 && P.length >= 24 && Math.abs(Math.abs(nrm.z) - 1) < 1e-3 && Math.abs(obj.rotation.x) < 1e-6 && Math.abs(obj.rotation.y) < 1e-6) {
    const kk = u.kind === 'cone' ? 'q' : 't', zBase = obj.position.z, top = Math.abs(c.z - (zBase + u.p.h)) < 0.02, bottom = Math.abs(c.z - zBase) < 0.02;
    const rad = P.reduce((m, p) => m + Math.hypot(p.x - c.x, p.y - c.y), 0) / P.length;
    const q0 = u.p[kk] ?? (kk === 't' ? 100 : 0);
    const rebuild = () => { obj.geometry.dispose(); obj.geometry = buildGeometry(u.kind, u.p); refreshEdges(obj); obj.updateMatrixWorld(true); return { mesh: obj }; };
    if (top && Math.abs(rad - u.p.w / 2 * Math.max(q0, 1) / 100) < 0.05) {
      const q = Math.max(q0, 1) * f;
      if (q >= 1 && q <= 100) { u.p[kk] = q; return rebuild(); }
    } else if (bottom && Math.abs(rad - u.p.w / 2) < 0.05) {
      const q = Math.max(q0, 1) / f, w = u.p.w * f;
      if (q >= 1 && q <= 100 && w >= 0.2) { u.p.w = w; u.p.d = w; u.p[kk] = q; return rebuild(); }
    }
  }
  const arr = worldPositions(obj), key = (x, y, z) => Math.round(x * 2000) + ',' + Math.round(y * 2000) + ',' + Math.round(z * 2000);
  const set = new Set(P.map(p => key(p.x, p.y, p.z))), d = new THREE.Vector3();
  for (let i = 0; i < arr.length; i += 3) {
    if (!set.has(key(arr[i], arr[i + 1], arr[i + 2]))) continue;
    d.set(arr[i] - c.x, arr[i + 1] - c.y, arr[i + 2] - c.z);
    d.addScaledVector(nrm, -d.dot(nrm)).multiplyScalar(f - 1);
    arr[i] += d.x; arr[i + 1] += d.y; arr[i + 2] += d.z;
  }
  const g = geometryFromPositions(arr), tmp = new THREE.Mesh(g);
  const baked = bakeResult(tmp, obj.userData.name);
  if (!baked) return { err: 'Il risultato è vuoto' };
  const nm = replaceWithMerged(obj, baked, true);
  nm.userData.color = obj.userData.color ?? null;
  return { mesh: nm };
}
const edgeHandle = (() => {
  const mat = new THREE.SpriteMaterial({ map: handleTexture('#ff6a00'), sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true });
  const sp = new THREE.Sprite(mat); sp.scale.setScalar(0.024); sp.renderOrder = 1000; sp.visible = false; scene.add(sp); return sp;
})();
const ringPrev = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xff6a00, depthTest: false, transparent: true }));
ringPrev.renderOrder = 998; ringPrev.visible = false; ringPrev.frustumCulled = false; ringPrev.raycast = () => {}; scene.add(ringPrev);
// geometria dell'anello selezionato: centro, normale del piano, raggio medio
// anello selezionato: una catena chiusa (cerchio) oppure più catene unite in un giro chiuso (i 4 spigoli di una faccia)
function selectedLoop() {
  if (!edgeSel.length || edgeSel.some(x => x.obj !== edgeSel[0].obj)) return null;
  if (edgeSel.length === 1) return edgeSel[0].chain.closed ? edgeSel[0].chain.pts.slice() : null;
  const key = p => Math.round(p.x * 500) + ',' + Math.round(p.y * 500) + ',' + Math.round(p.z * 500);
  const ch = edgeSel.map(x => x.chain);
  if (ch.some(c => c.closed || c.pts.length < 2)) return null;
  const left = ch.slice(1); let out = ch[0].pts.slice();
  while (left.length) {
    const end = key(out[out.length - 1]);
    const i = left.findIndex(c => key(c.pts[0]) === end || key(c.pts[c.pts.length - 1]) === end);
    if (i < 0) return null;
    const c = left.splice(i, 1)[0], pts = key(c.pts[0]) === end ? c.pts : c.pts.slice().reverse();
    out = out.concat(pts.slice(1));
  }
  return key(out[out.length - 1]) === key(out[0]) ? out.slice(0, -1) : null;
}
function ringInfo() {
  const P = selectedLoop();
  if (!P || P.length < 3) return null;
  const c = new THREE.Vector3();
  P.forEach(p => c.add(p)); c.divideScalar(P.length);
  const nrm = new THREE.Vector3();
  for (let i = 0; i < P.length; i++) nrm.add(P[i].clone().sub(c).cross(P[(i + 1) % P.length].clone().sub(c)));
  if (nrm.lengthSq() < 1e-9) return null;
  nrm.normalize();
  const r0 = P.reduce((m, p) => m + p.clone().sub(c).addScaledVector(nrm, -p.clone().sub(c).dot(nrm)).length(), 0) / P.length;
  if (r0 < 0.05) return null;
  // punto della maniglia: il vertice più a destra sullo schermo
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  let best = P[0], bd = -Infinity; for (const p of P) { const d = p.clone().sub(c).dot(right); if (d > bd) { bd = d; best = p; } }
  return { c, nrm, r0, P, handle: best.clone(), obj: edgeSel[0].obj };
}
function updateEdgeHandle() {
  const ri = state.tool === 'edge' ? ringInfo() : null;
  edgeHandle.visible = !!ri; ringPrev.visible = false;
  if (ri) edgeHandle.position.copy(ri.handle);
  dirty = true;
}
function startEdgeScale() { const ri = ringInfo(); return ri ? { ri, f: 1 } : null; }
function moveEdgeScale(e, es) {
  const { ri } = es;
  setRay(e);
  const p = raycaster.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(ri.nrm, ri.c), new THREE.Vector3());
  if (!p) return;
  let f = p.distanceTo(ri.c) / ri.r0;
  f = Math.round(clamp(f, 0.01, 10) * 100) / 100;
  if (Math.abs(f - 1) < 0.03) f = 1;
  es.f = f;
  const arr = []; ri.P.forEach(q => { const v = ri.c.clone().add(q.clone().sub(ri.c).multiplyScalar(f)); arr.push(v.x, v.y, v.z); });
  ringPrev.geometry.dispose(); ringPrev.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  ringPrev.visible = true;
  const hp = ri.c.clone().add(ri.handle.clone().sub(ri.c).multiplyScalar(f));
  edgeHandle.position.copy(hp);
  const v = hp.clone().project(camera);
  dragRead.style.display = 'block';
  dragRead.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth + 18) + 'px';
  dragRead.style.top = ((-v.y * 0.5 + 0.5) * window.innerHeight - 12) + 'px';
  dragRead.textContent = `${Math.round(f * 100)} %`;
  dirty = true;
}
function applyEdgeScale(pctArg) {
  const pct = typeof pctArg === 'number' ? pctArg : parseFloat($('#e-scale').value);
  const loop = selectedLoop();
  if (!loop) return;
  if (!(pct >= 1 && pct <= 1000)) return toast('Scrivi una scala in % (da 1 a 1000)');
  const obj = edgeSel[0].obj;
  if (heavyGuard([obj])) return;
  const r = scaleEdge(obj, { pts: loop }, pct / 100);
  if (r.err) return toast(r.err);
  clearEdges(); setSelection([r.mesh]); touch(); commit();
  $('#e-scale').value = '';
  toast('Spigolo ridimensionato');
}
$('#e-scale-go').addEventListener('click', applyEdgeScale);
$('#e-scale').addEventListener('keydown', e => { if (e.key === 'Enter') applyEdgeScale(); });
function applyEdges() {
  const size = parseFloat(EF.size.value);
  if (!edgeSel.length) return;
  if (!(size > 0)) return toast('Scrivi una misura in mm');
  const obj = edgeSel[0].obj;
  if (heavyGuard([obj])) return;
  // i 4 spigoli verticali di una scatola: raccordo o smusso restano parametrici (stesso campo Raggio)
  if (obj.userData.kind === 'box' && edgeSel.length === 4 && Math.abs(obj.rotation.x) < 1e-6 && Math.abs(obj.rotation.y) < 1e-6 && (obj.userData.p.t ?? 100) >= 99.9 && !(obj.userData.p.r > 0.001)) {
    const u = obj.userData, corners = new Set(); obj.updateMatrixWorld(true);
    const ok = edgeSel.every(x => {
      const P = x.chain.pts; if (P.length !== 2) return false;
      const L = P.map(p => obj.worldToLocal(p.clone()));
      const cx = Math.sign(L[0].x), cy = Math.sign(L[0].y);
      if (!(Math.abs(Math.abs(L[0].x) - u.p.w / 2) < 0.01 && Math.abs(Math.abs(L[0].y) - u.p.d / 2) < 0.01 && Math.abs(L[1].x - L[0].x) < 0.01 && Math.abs(L[1].y - L[0].y) < 0.01)) return false;
      if (Math.abs(Math.abs(L[0].z - L[1].z) - u.p.h) > 0.01) return false;
      corners.add(cx + ',' + cy); return true;
    });
    if (ok && corners.size === 4) {
      if (size >= Math.min(u.p.w, u.p.d) / 2) return toast('La misura è troppo grande per questa scatola');
      u.p.r = size; u.p.rm = edgeMode.v === 'chamfer' ? 'chamfer' : null;
      obj.geometry.dispose(); obj.geometry = buildGeometry('box', u.p); refreshEdges(obj); obj.updateMatrixWorld(true);
      clearEdges(); setSelection([obj]); touch(); commit(); EF.size.value = '';
      return toast(edgeMode.v === 'fillet' ? 'Raccordo applicato: resta modificabile dal pannello' : 'Smusso applicato: resta modificabile dal pannello');
    }
  }
  // bordo alto o basso di una scatola (anello chiuso a Z = altezza o Z = 0): resta parametrico
  if (obj.userData.kind === 'box' && Math.abs(obj.rotation.x) < 1e-6 && Math.abs(obj.rotation.y) < 1e-6 && (obj.userData.p.t ?? 100) >= 99.9) {
    const loop = selectedLoop(), u = obj.userData;
    if (loop && loop.length >= 4) {
      obj.updateMatrixWorld(true);
      const L = loop.map(p => obj.worldToLocal(p.clone()));
      const top = L.every(v => Math.abs(v.z - u.p.h) < 0.01), bot = L.every(v => Math.abs(v.z) < 0.01);
      const ex = Math.max(...L.map(v => Math.abs(v.x))), ey = Math.max(...L.map(v => Math.abs(v.y)));
      if ((top || bot) && Math.abs(ex - u.p.w / 2) < 0.01 && Math.abs(ey - u.p.d / 2) < 0.01) {
        if (size >= Math.min(u.p.w, u.p.d) / 2 || size >= u.p.h) return toast('La misura è troppo grande per questa scatola');
        u.p[top ? 'ft' : 'fb'] = size; u.p.rm = edgeMode.v === 'chamfer' ? 'chamfer' : null;
        obj.geometry.dispose(); obj.geometry = buildGeometry('box', u.p); refreshEdges(obj); obj.updateMatrixWorld(true);
        clearEdges(); setSelection([obj]); touch(); commit(); EF.size.value = '';
        return toast(edgeMode.v === 'fillet' ? 'Raccordo applicato: resta modificabile dal pannello' : 'Smusso applicato: resta modificabile dal pannello');
      }
    }
  }
  const cutters = edgeSel.map(x => cutter(x.chain, edgeMode.v, size));
  if (cutters.some(g => !g)) return toast('Questo spigolo è troppo particolare per un raccordo');
  obj.updateMatrixWorld(true);
  let g0 = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
  g0.applyMatrix4(obj.matrixWorld);
  g0.computeVertexNormals();
  let acc = new Brush(g0, M.solid); acc.updateMatrixWorld(true);
  for (const cg of cutters) {
    const br = new Brush(cg, M.solid); br.updateMatrixWorld(true);
    acc = evaluator.evaluate(acc, br, SUBTRACTION);
  }
  const baked = bakeResult(acc, obj.userData.name);
  if (!baked) return toast('Il risultato è vuoto: la misura è troppo grande');
  const n = edgeSel.length;
  clearEdges();
  const nm = replaceWithMerged(obj, baked);
  nm.userData.color = obj.userData.color ?? null;
  EF.size.value = '';
  toast(`${edgeMode.v === 'fillet' ? 'Raccordo' : 'Smusso'} di ${fmt(size)} mm su ${n} ${n === 1 ? 'spigolo' : 'spigoli'}`);
}
EF.go.addEventListener('click', applyEdges);
EF.size.addEventListener('keydown', e => { if (e.key === 'Enter') applyEdges(); });

buildAlignPanel();
setTool('move');
resize();
applyCamera();
commit();
frame();

/* info e aggiornamenti */
const APP_VERSION = '0.7.9';
const infoDlg = $('#dlg-info');
$('#ver-num').textContent = APP_VERSION;
$('#b-info').addEventListener('click', () => infoDlg.showModal());
$('#info-close').addEventListener('click', () => infoDlg.close());
infoDlg.addEventListener('click', e => { if (e.target === infoDlg) infoDlg.close(); });
initI18n();
// contatore visite anonimo: solo sul sito ufficiale, rispetta Do Not Track
try {
  if (location.hostname === 'filo.affogo.fyi' && navigator.doNotTrack !== '1') {
    let vid = localStorage.getItem('forma.vid');
    if (!vid) { vid = crypto.randomUUID(); localStorage.setItem('forma.vid', vid); }
    fetch('https://dash.affogo.fyi/api/hit', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ id: vid }) }).catch(() => {});
  }
} catch (e) { /* ignora */ }
// avviso mobile: una volta per sessione
(function () {
  const mobile = (window.matchMedia && matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 900) || /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent);
  let seen = false; try { seen = sessionStorage.getItem('forma.mobile') === '1'; } catch (e) {}
  if (!mobile || seen) return;
  const d = $('#dlg-mobile');
  const close = () => { try { sessionStorage.setItem('forma.mobile', '1'); } catch (e) {} d.close(); };
  $('#mob-ok').addEventListener('click', close);
  d.addEventListener('cancel', () => { try { sessionStorage.setItem('forma.mobile', '1'); } catch (e) {} });
  setTimeout(() => { try { d.showModal(); } catch (e) {} }, 400);
})();
window.forma = { splitPieces, applyEdgeScale, updateEdgeHandle, edgeHandle, edgeSel: () => edgeSel, selectEdgeAt, applyEdges, edgeMode, edgeAnalysis, chainOf, cutter, nearestEdge, askExport, importFiles, parse3MF, computeFace, applyTexture, applyGrooves, gUI, applyPush, selectFaceFromHit, texUI, layout, get faceSel() { return faceSel; }, get faceSet() { return faceSet; }, setTool, setSnap, objects, state, cam, createObject, combine, setSelection, exportSTL, alignSelection, buildBoxModel, undo, redo, setDims, worldBox, sizeOf, get selection() { return selection; }, get keyObj() { return keyObj; }, set keyObj(v) { keyObj = v; }, HANDLES, camera, canvas, fitView, export3MF, build3MF, rotateSelection, setEulerDeg, startRot, groupSelection, ungroupSelection, updateFaceHandle, prismPush, replaceWithMerged, setBed, get bed() { return [BEDX, BEDY]; }, duplicateSelection, toggleHole };


/* ------------------------------------------------------------------ livelli */
const layersEl = $('#layers'), layersList = $('#layers-list');
const collapsed = new Set();
try { layersOn = localStorage.getItem('forma.layers') === '1'; } catch (e) {}
function setLayers(on) {
  layersOn = on;
  layersEl.classList.toggle('hidden', !on);
  $('#b-layers').classList.toggle('on', on);
  try { localStorage.setItem('forma.layers', on ? '1' : '0'); } catch (e) {}
  if (on) renderLayers();
}
function scheduleLayers() {
  if (!layersOn || layersQueued) return;
  layersQueued = true;
  requestAnimationFrame(() => { layersQueued = false; renderLayers(); });
}
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kindIcon = m => m.userData.hole ? 'hole' : ({ box: 'box', cylinder: 'cylinder', sphere: 'sphere', cone: 'cone', prism: 'prism', torus: 'torus', merged: 'combine' }[m.userData.kind] || 'box');
function renderLayers() {
  if (!layersOn || document.activeElement?.classList?.contains('lren')) return;
  const LK = on => `<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9"/><path d="${on ? 'M8 11V8a4 4 0 0 1 8 0v3' : 'M8 11V8a4 4 0 0 1 7.6-1.7'}"/></svg>`;
  const EY = off => `<svg viewBox="0 0 24 24"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>${off ? '<path d="M4 4l16 16"/>' : ''}</svg>`;
  const btns = (attr, id, lk, hd) => `<button class="lbt${lk ? ' on' : ''}" data-l${attr}="${id}" title="Blocca" aria-label="Blocca">${LK(lk)}</button><button class="lbt${hd ? ' on' : ''}" data-v${attr}="${id}" title="Nascondi" aria-label="Nascondi">${EY(hd)}</button>`;
  const row = (m, indent) => `<div class="lrow${selection.includes(m) ? ' sel' : ''}${indent ? ' in' : ''}${m.userData.hole ? ' hole' : ''}${m.userData.hidden ? ' off' : ''}${m.userData.locked ? ' lck' : ''}" data-id="${m.userData.id}"><svg viewBox="0 0 24 24">${I[kindIcon(m)]}</svg><span class="ln">${esc(m.userData.name)}</span>${keyObj === m ? '<i class="key">chiave</i>' : ''}${btns('o', m.userData.id, m.userData.locked, m.userData.hidden)}</div>`;
  let html = '';
  const done = new Set();
  for (const m of objects) {
    const g = m.userData.gid;
    if (g == null) { html += row(m, false); continue; }
    if (done.has(g)) continue;
    done.add(g);
    const mem = objects.filter(o => o.userData.gid === g), all = mem.every(o => selection.includes(o)), open = !collapsed.has(g);
    html += `<div class="lrow grp${all ? ' sel' : ''}" data-g="${g}"><button class="car${open ? ' open' : ''}" data-car="${g}" aria-label="Apri o chiudi">▸</button><svg viewBox="0 0 24 24">${I.group}</svg><span class="ln">Gruppo · ${mem.length}</span><button class="ung" data-ung="${g}" title="Separa il gruppo (⇧⌘G)">⇧⌘G</button>${btns('g', g, mem.every(o => o.userData.locked), mem.every(o => o.userData.hidden))}</div>`;
    if (open) html += mem.map(o => row(o, true)).join('');
  }
  layersList.innerHTML = html || '<p class="hint">Nessun oggetto. Aggiungine uno dalla barra a sinistra.</p>';
}
layersList.addEventListener('click', e => {
  const tb = e.target.closest('.lbt');
  if (tb) {
    const d = tb.dataset, list = (d.lg || d.vg) ? objects.filter(o => o.userData.gid === +(d.lg || d.vg)) : objects.filter(o => o.userData.id === +(d.lo || d.vo));
    const key = (d.lg || d.lo) ? 'locked' : 'hidden', val = !list.every(o => o.userData[key]);
    list.forEach(o => { o.userData[key] = val; o.visible = !o.userData.hidden; });
    setSelection(selection.filter(o => o.visible && !o.userData.locked));
    list.forEach(o => visState.set(o.userData.id, { hidden: !!o.userData.hidden, locked: !!o.userData.locked }));
    touch(); renderLayers(); dirty = true;
    return;
  }
  const car = e.target.closest('[data-car]');
  if (car) { const g = +car.dataset.car; collapsed.has(g) ? collapsed.delete(g) : collapsed.add(g); return renderLayers(); }
  const ung = e.target.closest('[data-ung]');
  if (ung) { const g = +ung.dataset.ung; setSelection(objects.filter(o => o.userData.gid === g)); return ungroupSelection(); }
  const r = e.target.closest('.lrow');
  if (!r) return;
  let list;
  if (r.dataset.g) list = objects.filter(o => o.userData.gid === +r.dataset.g);
  else { const m = objects.find(o => o.userData.id === +r.dataset.id); list = m ? [m] : []; }
  if (e.shiftKey) {
    const all = list.every(m => selection.includes(m));
    setSelection(all ? selection.filter(m => !list.includes(m)) : [...new Set([...selection, ...list])]);
  } else setSelection(r.dataset.id ? list : list);
});
layersList.addEventListener('dblclick', e => {
  const r = e.target.closest('.lrow[data-id]');
  if (!r) return;
  const m = objects.find(o => o.userData.id === +r.dataset.id);
  if (!m) return;
  const span = r.querySelector('.ln'), inp = document.createElement('input');
  inp.value = m.userData.name; inp.className = 'lren'; inp.spellcheck = false;
  span.replaceWith(inp); inp.focus(); inp.select();
  let fin = false;
  const done = ok => { if (fin) return; fin = true; if (ok && inp.value.trim()) { m.userData.name = inp.value.trim(); commit(); } inp.removeEventListener('blur', onBlur); if (inp.isConnected) inp.remove(); renderLayers(); syncPanel(); };
  const onBlur = () => done(true);
  inp.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') done(true); else if (ev.key === 'Escape') done(false); });
  inp.addEventListener('blur', onBlur);
});
$('#p-rotq').addEventListener('click', e => { const b = e.target.closest('[data-rq]'); if (b) { rotateSelection(b.dataset.rq, e.shiftKey ? -90 : 90); canvas.focus(); } });
$('#b-layers').addEventListener('click', () => setLayers(!layersOn));
$('#layers-close').addEventListener('click', () => setLayers(false));
setLayers(layersOn);


/* ------------------------------------------------------------------ colore */
const colSec = $('#p-color'), colSw = $('#p-color-sw');
colSw.innerHTML = COLORS.map(c => `<button class="sw${c ? '' : ' def'}" data-c="${c || ''}" ${c ? `style="background:${c}"` : ''} title="${c ? c : 'Predefinito'}" aria-label="${c ? c : 'Predefinito'}"></button>`).join('');
function syncColor() {
  const solids = selection.filter(o => !o.userData.hole);
  colSec.classList.toggle('hidden', !solids.length);
  if (!solids.length) return;
  const cs = new Set(solids.map(o => o.userData.color ?? ''));
  const cur = cs.size === 1 ? [...cs][0] : null;
  colSw.querySelectorAll('.sw').forEach(b => b.classList.toggle('on', cur !== null && b.dataset.c === cur));
}
colSw.addEventListener('click', e => {
  const b = e.target.closest('.sw');
  if (!b) return;
  const c = b.dataset.c || null;
  selection.forEach(o => { if (!o.userData.hole) o.userData.color = c; });
  objects.forEach(styleObject); syncColor(); dirty = true; commit();
});
syncColor();


/* ------------------------------------------------------------------- testo */
const FKEY = 'forma.fonts';
const b64 = buf => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
function saveFonts(name, buf) {
  try {
    const all = JSON.parse(localStorage.getItem(FKEY) || '[]').filter(f => f.file !== name);
    all.push({ file: name, data: b64(buf) });
    localStorage.setItem(FKEY, JSON.stringify(all));
  } catch (e) {}
}
try {
  JSON.parse(localStorage.getItem(FKEY) || '[]').forEach(f => {
    try { const bin = atob(f.data), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); addUserFont(u.buffer, f.file); } catch (e) {}
  });
} catch (e) {}
const tFontEl = $('#t-font'), tFontBtn = $('#t-font-b'), tFontList = $('#t-font-l');
const tFont = { value: 'inter' };
const tText = $('#t-text'), tSize = $('#t-size'), tDepth = $('#t-depth'), tSpace = $('#t-space'), tFile = $('#font-in');
const loadedFaces = new Set();
function faceFamily(f) {
  const fam = 'forma-' + f.id.replace(/[^a-z0-9]/gi, '_');
  if (!loadedFaces.has(fam) && f.buf) {
    loadedFaces.add(fam);
    try { const ff = new FontFace(fam, f.buf.slice(0)); ff.load().then(x => document.fonts.add(x)).catch(() => {}); } catch (e) {}
  }
  return fam;
}
function fillFonts(sel) {
  if (sel) tFont.value = sel;
  const cur = fontById(tFont.value);
  tFontBtn.firstElementChild.textContent = cur.name;
  tFontBtn.firstElementChild.style.fontFamily = `'${faceFamily(cur)}', system-ui, sans-serif`;
  tFontList.innerHTML = FONTS.map(f => `<button type="button" class="fo${f.id === cur.id ? ' on' : ''}" data-f="${esc(f.id)}" style="font-family:'${faceFamily(f)}',system-ui,sans-serif">${esc(f.name)}</button>`).join('') + '<button type="button" class="fo load" data-f="__load">+ Carica font…</button>';
}
const closeFontList = () => tFontList.classList.add('hidden');
tFontBtn.addEventListener('click', e => { e.stopPropagation(); tFontList.classList.toggle('hidden'); });
document.addEventListener('pointerdown', e => { if (!e.target.closest('#t-font')) closeFontList(); });
tFontList.addEventListener('click', e => {
  const b = e.target.closest('.fo'); if (!b) return;
  closeFontList();
  if (b.dataset.f === '__load') { tFile.click(); return; }
  tFont.value = b.dataset.f; fillFonts();
  regenText(); commit();
});
fillFonts('inter');
function textGeo(sp) {
  const pos = textPositions(sp);
  if (!pos) return null;
  const arr = Float32Array.from(pos), b = new THREE.Box3(), p = new THREE.Vector3();
  for (let i = 0; i < arr.length; i += 3) b.expandByPoint(p.set(arr[i], arr[i + 1], arr[i + 2]));
  const c = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3());
  const g = geometryFromPositions(arr);
  g.translate(-c.x, -c.y, -b.min.z);
  return { g, size };
}
function addText() {
  const sp = { text: 'Filo', font: 'inter', size: 14, depth: 2, spacing: 0 };
  const r = textGeo(sp);
  if (!r) return;
  counters.merged++;
  const m = makeMesh({ kind: 'merged', name: 'Testo', geo: r.g, pos: [0, 0, 0], p: { w: r.size.x, d: r.size.y, h: r.size.z }, base: { w: r.size.x, d: r.size.y, h: r.size.z }, text: sp });
  setSelection([m]); touch(); commit();
  setTool('move');
  tText.focus(); tText.select();
}
function readText() {
  return { text: tText.value, font: tFont.value, size: clamp(parseFloat(tSize.value) || 14, 1, 300), depth: clamp(parseFloat(tDepth.value) || 2, 0.2, 100), spacing: clamp(parseFloat(tSpace.value) || 0, -20, 100) };
}
function regenText() {
  const m = selection.length === 1 ? selection[0] : null;
  if (!m || !m.userData.text) return;
  const sp = readText();
  const r = textGeo(sp);
  if (!r) return;
  const u = m.userData;
  m.geometry.dispose();
  m.geometry = r.g; u.geo = r.g;
  u.base = { w: r.size.x, d: r.size.y, h: r.size.z }; u.p = { ...u.base };
  m.scale.set(1, 1, 1);
  u.text = sp;
  refreshEdges(m); m.updateMatrixWorld(true);
  touch(); updateHandles(); syncPanel();
}
let tTimer = 0;
[tText, tSize, tDepth, tSpace].forEach(el => {
  el.addEventListener('input', () => { clearTimeout(tTimer); tTimer = setTimeout(regenText, 140); });
  el.addEventListener('change', () => { clearTimeout(tTimer); regenText(); commit(); });
});
tFile.addEventListener('change', async () => {
  for (const f of tFile.files) {
    try {
      const buf = await f.arrayBuffer();
      if (f.name.toLowerCase().endsWith('.woff2')) { toast('WOFF2 non è supportato: usa TTF, OTF o WOFF'); continue; }
      const e = addUserFont(buf, f.name); saveFonts(f.name, buf); fillFonts(e.id); regenText(); commit();
      toast(`Font aggiunto: ${e.name}`);
    } catch (err) { toast(`Impossibile leggere il font ${f.name}`); }
  }
  tFile.value = '';
});
function syncTextPanel() {
  const m = selection.length === 1 ? selection[0] : null, t = m && m.userData.text;
  $('#p-text').classList.toggle('hidden', !t);
  if (!t) return;
  if (tFont.value !== t.font || !tFontList.children.length) fillFonts(t.font);
  const set = (el, v) => { if (document.activeElement !== el) el.value = v; };
  set(tText, t.text); set(tSize, t.size); set(tDepth, t.depth); set(tSpace, t.spacing);
}


/* ------------------------------------------------------------------- aiuto */
(function () {
  const side = $('#side'), tg = $('#nav-toggle');
  let off = window.innerHeight < 980;
  try { const v = localStorage.getItem('forma.help'); if (v !== null) off = v === '0'; } catch (e) {}
  const apply = () => { side.classList.toggle('help-off', off); tg.setAttribute('aria-expanded', String(!off)); };
  apply();
  tg.addEventListener('click', () => { off = !off; apply(); try { localStorage.setItem('forma.help', off ? '0' : '1'); } catch (e) {} });
})();


/* -------------------------------------------------------------- benvenuto */
I.import = '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M4 19h16"/>';
document.querySelectorAll('#empty-hint [data-ic]').forEach(el => el.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 24 24">${I[el.dataset.ic] || ''}</svg>`));
$('#empty-hint').addEventListener('click', e => {
  const b = e.target.closest('[data-eh]');
  if (!b) return;
  const a = b.dataset.eh;
  if (a === 'text') addText();
  else if (a === 'import') $('#file-in').click();
  else if (a === 'box-model') dlg.showModal();
  else createObject(a);
});


/* ---------------------------------------------------------------- cronologia */
const histEl = $('#history'), histList = $('#history-list');
let histOn = false, histTimer = 0;
try { histOn = localStorage.getItem('forma.history') === '1'; } catch (e) {}
function scheduleHistory() { if (histOn) { clearTimeout(histTimer); histTimer = setTimeout(renderHistory, 30); } }
function renderHistory() {
  if (!histOn) return;
  histList.innerHTML = history.map((h, i) => `<div class="hrow${i === hIdx ? ' cur' : ''}${i > hIdx ? ' fut' : ''}" data-i="${i}"><b>${i + 1}</b><span class="ln">${esc(h.label || 'Modifica')}</span></div>`).join('');
  const cur = histList.querySelector('.cur');
  if (cur) cur.scrollIntoView({ block: 'nearest' });
}
function setHistory(on) {
  histOn = on;
  histEl.classList.toggle('hidden', !on);
  $('#b-history').classList.toggle('on', on);
  try { localStorage.setItem('forma.history', on ? '1' : '0'); } catch (e) {}
  if (on) renderHistory();
}
histList.addEventListener('click', e => { const r = e.target.closest('.hrow'); if (r) jumpTo(+r.dataset.i); });
$('#b-history').addEventListener('click', () => setHistory(!histOn));
$('#history-close').addEventListener('click', () => setHistory(false));
setHistory(histOn);


/* -------------------------------------------------------------------- tema */
(function () {
  let mode = 'auto';
  try { mode = localStorage.getItem('forma.theme') || 'auto'; } catch (e) {}
  const root = document.documentElement, btns = document.querySelectorAll('#theme button');
  const apply = () => {
    if (mode === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', mode);
    btns.forEach(b => b.classList.toggle('on', b.dataset.theme === mode));
    applyTheme();
  };
  btns.forEach(b => b.addEventListener('click', () => { mode = b.dataset.theme; try { localStorage.setItem('forma.theme', mode); } catch (e) {} apply(); }));
  apply();
})();
