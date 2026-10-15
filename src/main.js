import { initI18n, tr, plat, getLang } from './i18n.js';
import { GROUPS, HELP } from './help.js';
import IMG from './helpimg.js';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { mergeVertices, mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { unzipSync, zipSync, strToU8 } from 'three/addons/libs/fflate.module.js';
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';
import { initManifold, manifoldEvaluate, manifoldStretch, manifoldHalf, manifoldMod } from './mcsg.js';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { analyze, nearestEdge, chainOf, cutter } from './edges.js';
import ClipperLib from 'clipper-lib';
import { buildCheck, thinAt } from './print.js';
import { FONTS, fontById, addUserFont, textPositions, svgItems } from './textgen.js';

THREE.Object3D.DEFAULT_UP.set(0, 0, 1); // Z verso l'alto, come nei programmi di stampa 3D

const $ = (s, r = document) => r.querySelector(s);
const D2R = Math.PI / 180;
const fmt = v => String(+Number(v).toFixed(2));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ------------------------------------------------------------------ stato */
const state = { tool: 'move', space: false, snap: 1, dims: false, xray: false, magnet: true };
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
let dotBase = 1.3, camK = 1;   // camK: nelle viste senza prospettiva la camera è lontanissima e i punti, che sono in mm, andrebbero sotto il pixel
const grid = new THREE.Points(new THREE.BufferGeometry(), gridMat);
scene.add(grid);
function buildBedDots(spacing) {
  const pts = [];
  // i punti stanno sui multipli del passo a partire dall'origine (0,0), come lo scatto: con un piatto dispari non si sfalsano di mezzo mm
  const x0 = Math.ceil(-BEDX / 2 / spacing - 1e-6), x1 = Math.floor(BEDX / 2 / spacing + 1e-6), y0 = Math.ceil(-BEDY / 2 / spacing - 1e-6), y1 = Math.floor(BEDY / 2 / spacing + 1e-6);
  for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) pts.push(i * spacing, j * spacing, 0.04);
  dotBase = Math.min(1.3, spacing * 0.2); gridMat.size = dotBase * camK;
  grid.geometry.dispose();
  grid.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  dirty = true;
}
buildBedDots(10);
const outline = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x8e8e98, transparent: true, opacity: 0.8 }));
scene.add(outline);
let gridStep = 10;
let dotStep = 10;
function setBed(w, d, refit = true) {
  BEDX = clamp(Math.round(w) || 180, 20, 400); BEDY = clamp(Math.round(d) || 180, 20, 400);
  bed.geometry.dispose(); bed.geometry = new THREE.PlaneGeometry(BEDX, BEDY);
  outline.geometry.dispose();
  outline.geometry = new THREE.BufferGeometry().setFromPoints([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => new THREE.Vector3(x * BEDX / 2, y * BEDY / 2, 0.05)));
  const R = Math.max(BEDX, BEDY) * 0.5 + 80;
  Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R });
  sun.shadow.camera.updateProjectionMatrix();
  buildBedDots(dotStep);
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
// Viste Davanti/Sopra/Destra: prospettiva quasi nulla (FOV minuscolo, camera lontana), quindi misure e allineamenti si leggono senza deformazioni.
// cam.dist resta la distanza "equivalente" a FOV 35: l'inquadratura non cambia.
const BASE_FOV = 35, ORTHO_FOV = 2, fovSprites = [];
const cam = { az: 35, el: 28, dist: 320, fov: BASE_FOV, target: new THREE.Vector3(0, 0, 10) };
function applyCamera() {
  const az = cam.az * D2R, el = cam.el * D2R;
  const k = Math.tan(BASE_FOV * D2R / 2) / Math.tan(cam.fov * D2R / 2), D = cam.dist * k;
  camK = k; gridMat.size = dotBase * k;
  if (camera.fov !== cam.fov) { camera.fov = cam.fov; camera.near = Math.max(1, k); camera.far = 6000 * k; camera.updateProjectionMatrix(); }
  { const r = Math.tan(cam.fov * D2R / 2) / Math.tan(BASE_FOV * D2R / 2); for (const [sp, s0] of fovSprites) sp.scale.setScalar(s0 * r); }
  camera.position.set(
    cam.target.x + D * Math.sin(az) * Math.cos(el),
    cam.target.y - D * Math.cos(az) * Math.cos(el),
    cam.target.z + D * Math.sin(el));
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
function viewOn(k) { document.querySelectorAll('#views [data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === k)); }
function animateTo(to, ms = 320, keep = false) {
  if (!keep) viewOn(null);
  const from = { az: cam.az, el: cam.el, dist: cam.dist, fov: cam.fov, t: cam.target.clone() };
  let daz = (to.az ?? cam.az) - cam.az;
  daz = ((daz + 540) % 360) - 180;
  tween = { t0: performance.now(), ms, from, to: { az: from.az + daz, el: to.el ?? from.el, dist: to.dist ?? from.dist, fov: to.fov ?? from.fov, t: to.target ?? from.t } };
}
function stepTween() {
  const k = clamp((performance.now() - tween.t0) / tween.ms, 0, 1);
  const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const { from, to } = tween;
  cam.az = from.az + (to.az - from.az) * e;
  cam.el = from.el + (to.el - from.el) * e;
  cam.dist = from.dist + (to.dist - from.dist) * e;
  cam.fov = from.fov + (to.fov - from.fov) * e;
  cam.target.lerpVectors(from.t, to.t, e);
  applyCamera();
  if (k >= 1) tween = null;
}
const zoom = f => { cam.dist = clamp(cam.dist * f, 4, 3000); applyCamera(); };
const worldPerPixel = () => 2 * cam.dist * Math.tan(BASE_FOV * D2R / 2) / canvas.clientHeight;
function panPixels(dx, dy) {
  const s = worldPerPixel();
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  cam.target.addScaledVector(right, -dx * s).addScaledVector(up, dy * s);
  applyCamera();
}
function orbitPixels(dx, dy) {
  cam.fov = BASE_FOV; tween = null; viewOn(null);
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
  animateTo({ target: c, dist: clamp(r / Math.sin(BASE_FOV * D2R / 2) * 1.25, 60, 2500) }, 320, true);
}
const VIEWS = { front: { az: 0, el: 0, fov: ORTHO_FOV }, top: { az: 0, el: 89.9, fov: ORTHO_FOV }, right: { az: 90, el: 0, fov: ORTHO_FOV }, iso: { az: 35, el: 28, fov: BASE_FOV } };

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
function boxLevels(p, lim = Math.min(p.w, p.d) / 2 - 0.05) {
  const h = p.h, cham = p.rm === 'chamfer';
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
function boxFilleted(p, ringFn = boxRing, lim) {
  const L = boxLevels(p, lim), rings = L.map(([z, d]) => ({ z, pts: ringFn(p, d) })), n = rings[0].pts.length, tri = [];
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
/* cilindro, cono e prisma con bordi alto e basso (e angoli verticali per il prisma): stessi anelli sovrapposti della scatola */
const ROUND_KINDS = ['box', 'cylinder', 'cone', 'prism'];
function prismSides(p) { return Math.round(clamp(p.q || 6, 3, 64)); }
function edgeLimit(kind, p) {                          // il bordo non può superare il raggio interno della forma
  const base = Math.min(p.w, p.d) / 2;
  return (kind === 'prism' ? base * Math.cos(Math.PI / prismSides(p)) : base) - 0.05;
}
function roundRing(kind, p, d) {
  if (kind === 'prism') {
    const n = prismSides(p), al = Math.PI / n, ca = Math.cos(al), cham = p.rm === 'chamfer', M = cham ? 1 : 4, k = p.d / p.w;
    const ad = Math.max(p.w / 2 * ca - d, 0.05), rd = clamp((p.r || 0) - d, 0, ad - 1e-3), Rc = (ad - rd) / ca, pts = [];
    for (let i = 0; i < n; i++) {
      const th = 2 * Math.PI * i / n;
      for (let j = 0; j <= M; j++) {
        if (rd > 0.001) { const ph = th - al + 2 * al * j / M; pts.push([Rc * Math.cos(th) + rd * Math.cos(ph), (Rc * Math.sin(th) + rd * Math.sin(ph)) * k]); }
        else pts.push([ad / ca * Math.cos(th), ad / ca * Math.sin(th) * k]);
      }
    }
    return pts;
  }
  const rx = Math.max(p.w / 2 - d, 0.05), ry = Math.max(p.d / 2 - d, 0.05), pts = [];
  for (let j = 0; j < 72; j++) { const th = 2 * Math.PI * j / 72; pts.push([rx * Math.cos(th), ry * Math.sin(th)]); }
  return pts;
}
function roundedSolid(kind, p) {
  let g = boxFilleted(p, (pp, d) => roundRing(kind, pp, d), edgeLimit(kind, p));
  const tt = kind === 'cone' ? Math.max(p.q || 0, 1) / 100 : clamp(p.t ?? 100, 1, 100) / 100;
  if (tt < 0.9999) {
    g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('normal');
    const a = g.attributes.position; for (let i = 0; i < a.count; i++) { const k = 1 + (tt - 1) * a.getZ(i) / p.h; a.setX(i, a.getX(i) * k); a.setY(i, a.getY(i) * k); }
    g = toCreasedNormals(g, 30 * D2R); clean(g);
  }
  return g;
}
/* ------------------------------------------- spigoli singoli (scatola e prisma), non distruttivi
   p.ed = { chiave: { r, t:'f'|'c' } }
   scatola: 'asse:s1:s2' = direzione dello spigolo e lato (±1) sugli altri due assi; prisma: 'pt:i' / 'pb:i' = bordo alto / basso del lato i.
   Il pezzo si ricalcola sempre dalla forma intera togliendo un "tagliente" per spigolo. */
const BOX_AX = { x: ['y', 'z'], y: ['x', 'z'], z: ['x', 'y'] };
const edgeShape = (kind, p) => (kind === 'box' || (kind === 'prism' && !(p.r > 0))) && (p.t ?? 100) >= 99.99;   // forme che accettano spigoli singoli
function edgeKeysOf(kind, p) {
  const L = [];
  if (kind === 'box') { for (const a of 'xyz') for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) L.push(`${a}:${s1}:${s2}`); }
  else { const n = prismSides(p); for (let i = 0; i < n; i++) L.push('pt:' + i, 'pb:' + i); }
  return L;
}
function edgeMapOf(kind, p) {                          // valori effettivi: parametri globali + spigoli singoli che li sostituiscono
  const m = {}, ch = p.rm === 'chamfer' ? 'c' : 'f';
  if (kind === 'box') {
    if (p.r > 0) for (const sx of [-1, 1]) for (const sy of [-1, 1]) m[`z:${sx}:${sy}`] = { r: p.r, t: ch };
    for (const [sz, v] of [[1, p.ft], [-1, p.fb]]) if (v > 0) for (const s of [-1, 1]) { m[`x:${s}:${sz}`] = { r: v, t: ch }; m[`y:${s}:${sz}`] = { r: v, t: ch }; }
  } else {
    const n = prismSides(p);
    for (let i = 0; i < n; i++) { if (p.ft > 0) m['pt:' + i] = { r: p.ft, t: ch }; if (p.fb > 0) m['pb:' + i] = { r: p.fb, t: ch }; }
  }
  for (const [k, v] of Object.entries(p.ed || {})) { if (v && v.r > 0) m[k] = v; else delete m[k]; }
  return m;
}
function edgeFrame(kind, p, key) {                     // spigolo: estremi A,B (locali), direzione verso l'interno nel piano orizzontale o sugli assi
  if (kind === 'box') {
    const [a, s1, s2] = key.split(':'), [b, c] = BOX_AX[a], s = { [b]: +s1, [c]: +s2 };
    const H = { x: p.w / 2, y: p.d / 2, z: p.h / 2 }, C = { x: 0, y: 0, z: p.h / 2 };
    const at = v => { const o = {}; o[b] = C[b] + s[b] * H[b]; o[c] = C[c] + s[c] * H[c]; o[a] = v; return new THREE.Vector3(o.x, o.y, o.z); };
    const es = new THREE.Vector3(), et = new THREE.Vector3(); es[b] = -s[b]; et[c] = -s[c];
    return { A: at(C[a] - H[a]), B: at(C[a] + H[a]), es, et };
  }
  const [pt, i] = key.split(':'), n = prismSides(p), top = pt === 'pt', z = top ? p.h : 0;
  const V = k => { const th = 2 * Math.PI * (k % n) / n; return new THREE.Vector3(Math.cos(th) * p.w / 2, Math.sin(th) * p.d / 2, z); };
  const A = V(+i), B = V(+i + 1), dir = B.clone().sub(A).normalize();
  let nOut = new THREE.Vector3(dir.y, -dir.x, 0); const mid = A.clone().add(B).multiplyScalar(0.5);
  if (nOut.dot(new THREE.Vector3(mid.x, mid.y, 0)) < 0) nOut.negate();
  const dirP = A.clone().sub(V(+i - 1 + n)).normalize(), dirN = V(+i + 2).sub(B).normalize();   // lati vicini: gli estremi del tagliente si chiudono a sbieco sulla bisettrice
  return { A, B, es: nOut.clone().negate(), et: new THREE.Vector3(0, 0, top ? -1 : 1), dirP, dirN };
}
function edgeCutter(kind, p, key, r, t) {
  const { A, B, es, et, dirP, dirN } = edgeFrame(kind, p, key), e = 0.6, len = A.distanceTo(B) + 2 * e, ex = B.clone().sub(A).normalize();
  const pts = [[-e, -e], [r, -e], [r, 0]];
  if (t === 'c') pts.push([0, r]); else for (let i = 1; i <= 12; i++) { const th = (-90 - 90 * i / 12) * D2R; pts.push([r + r * Math.cos(th), r + r * Math.sin(th)]); }
  pts.push([-e, r]);
  let g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(q => new THREE.Vector2(q[0], q[1]))), { depth: len, bevelEnabled: false, curveSegments: 1 });
  g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); g.deleteAttribute('normal');
  const det = es.dot(new THREE.Vector3().crossVectors(et, ex));
  const pos = g.attributes.position, q = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const S = pos.getX(i), T = pos.getY(i), U = pos.getZ(i);
    let u = U - e;
    if (dirP) {                                          // prisma: chiusura sulla bisettrice del vertice (niente tacche sui lati vicini)
      if (U < len / 2) { const m = ex.clone().add(dirP); u = -m.dot(es) * S / m.dot(ex); }
      else { const m = ex.clone().add(dirN); u = A.distanceTo(B) - m.dot(es) * S / m.dot(ex); }
    }
    q.copy(A).addScaledVector(es, S).addScaledVector(et, T).addScaledVector(ex, u);
    pos.setXYZ(i, q.x, q.y, q.z);
  }
  if (det < 0) for (let i = 0; i < pos.count; i += 3) { const x = pos.getX(i + 1), y = pos.getY(i + 1), z = pos.getZ(i + 1); pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2)); pos.setXYZ(i + 2, x, y, z); }
  g.computeVertexNormals();
  return g;
}
function edgeLimitOf(kind, p) { return kind === 'box' ? Math.min(p.w, p.d, p.h) / 2 - 0.05 : Math.min(p.h / 2, 0.45 * Math.min(p.w, p.d) * Math.cos(Math.PI / prismSides(p))) - 0.05; }
function edgesGeometry(kind, p) {
  const lim = edgeLimitOf(kind, p);
  let base = kind === 'box' ? new THREE.BoxGeometry(p.w, p.d, p.h) : buildGeometry('prism', { ...p, ed: null, ft: 0, fb: 0 });
  if (kind === 'box') base.translate(0, 0, p.h / 2);
  base = base.index ? base.toNonIndexed() : base.clone(); base.computeVertexNormals();
  let acc = new Brush(base, M.solid); acc.updateMatrixWorld(true);
  for (const [k, v] of Object.entries(edgeMapOf(kind, p))) {
    const r = clamp(v.r, 0, lim); if (!(r > 0.01)) continue;
    const br = new Brush(edgeCutter(kind, p, k, r, v.t), M.solid); br.updateMatrixWorld(true);
    acc = evaluator.evaluate(acc, br, SUBTRACTION);
  }
  let g = acc.geometry.clone(); clean(g); g = healMesh(g);
  g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('normal'); g = toCreasedNormals(g, 30 * D2R);
  return clean(g);
}
const hasEdgeList = (kind, p) => p.ed && Object.keys(p.ed).length && edgeShape(kind, p);

function buildGeometry(kind, p) {
  if (hasEdgeList(kind, p)) return edgesGeometry(kind, p);
  if ((kind === 'cylinder' || kind === 'cone') && (p.ft > 0 || p.fb > 0)) return clean(roundedSolid(kind, p));
  if (kind === 'prism' && (p.ft > 0 || p.fb > 0 || p.r > 0)) return clean(roundedSolid(kind, p));
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
  if (m.userData.xray) { m.remove(m.userData.xray); m.userData.xray.material.dispose(); if (m.userData.xray.geometry !== e.geometry && m.userData.xray.geometry !== m.userData.edges?.geometry) m.userData.xray.geometry.dispose(); }
  let xg = e.geometry;
  const u = m.userData;
  if ((u.kind === 'cylinder' || u.kind === 'cone') && u.p && !u.heavy && xg.attributes.position) {      // le pareti curve non hanno spigoli: in Raggi X si disegnano 4 linee lungo la parete (dritte o oblique)
    const p = u.p, rt = u.kind === 'cone' ? Math.max(p.q || 0, 1) / 100 : clamp(p.t ?? 100, 1, 100) / 100, z0 = Math.min(p.fb || 0, p.h / 2), z1 = p.h - Math.min(p.ft || 0, p.h / 2), extra = [];
    const at = (th, z) => { const k = 1 + (rt - 1) * z / p.h; return [Math.cos(th) * p.w / 2 * k, Math.sin(th) * p.d / 2 * k, z]; };
    for (let i = 0; i < 4; i++) { const th = i * Math.PI / 2; extra.push(...at(th, z0), ...at(th, z1)); }
    const base = xg.attributes.position.array, all = new Float32Array(base.length + extra.length); all.set(base); all.set(extra, base.length);
    xg = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(all, 3));
  }
  const x = new THREE.LineSegments(xg, new THREE.LineDashedMaterial({ color: EDGE.normal, dashSize: 1.6, gapSize: 1.2, transparent: true, opacity: 0.5, depthFunc: THREE.GreaterDepth, depthWrite: false }));
  if (e.geometry.attributes.position) x.computeLineDistances();
  x.raycast = () => {}; x.renderOrder = 2; x.visible = state.xray;
  m.add(x);
  m.userData.xray = x;
  if (m.userData.silX) { m.remove(m.userData.silX); m.userData.silX.geometry.dispose(); m.userData.silX.material.dispose(); m.userData.silX = null; }
  if ((u.kind === 'cylinder' || u.kind === 'cone') && u.p && !u.heavy) {      // contorno della parete curva: segue la vista, quindi si calcola a ogni disegno
    const sg = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    const sx = new THREE.LineSegments(sg, new THREE.LineDashedMaterial({ color: EDGE.normal, dashSize: 1.6, gapSize: 1.2, transparent: true, opacity: 0.5, depthFunc: THREE.GreaterDepth, depthWrite: false }));
    sx.raycast = () => {}; sx.renderOrder = 2; sx.visible = false; sx.frustumCulled = false; m.add(sx); u.silX = sx;
  }
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
  if (n < (window.__noManifold ? 400000 : 1500000)) return false;
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
    if (u.kind === 'box') u.p.r = Math.min(u.p.r, Math.min(u.p.w, u.p.d) / 2);
    if (ROUND_KINDS.includes(u.kind)) { const lm = edgeLimit(u.kind, u.p); if (u.p.ft > lm) u.p.ft = lm; if (u.p.fb > lm) u.p.fb = lm; if (u.kind === 'prism' && u.p.r > lm) u.p.r = lm; }
    m.geometry.dispose();
    m.geometry = buildGeometry(u.kind, u.p);
    refreshEdges(m);
  }
  m.updateMatrixWorld(true);
}
function setBoxEdge(m, key, v) {
  const u = m.userData;
  if (!ROUND_KINDS.includes(u.kind)) return;
  u.p[key] = clamp(v, 0, edgeLimit(u.kind, u.p));
  m.geometry.dispose(); m.geometry = buildGeometry(u.kind, u.p); refreshEdges(m);
}
function setRadius(m, r) {
  const u = m.userData;
  if (u.kind !== 'box' && u.kind !== 'prism') return;
  u.p.r = clamp(r, 0, u.kind === 'prism' ? edgeLimit('prism', u.p) : Math.min(u.p.w, u.p.d) / 2);
  m.geometry.dispose();
  m.geometry = buildGeometry(u.kind, u.p);
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
let nextGid = 1, unsaved = false;
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
  if (selection.length && typeof repeatDefaults === 'function') repeatDefaults();
  updateHandles();
  dimsDirty = dirty = true;
  if (planeTool()) cutReset();
}

/* -------------------------------------------------- cronologia (annulla) */
const history = [];
let hIdx = -1;
const entryOf = m => ({
  id: m.userData.id, name: m.userData.name, kind: m.userData.kind, p: { ...m.userData.p }, hole: m.userData.hole,
  base: m.userData.base ? { ...m.userData.base } : null, geo: m.userData.geo, gid: m.userData.gid ?? null,
  pos: m.position.toArray(), q: m.quaternion.toArray(), scale: m.scale.toArray(), color: m.userData.color ?? null, text: m.userData.text ? { ...m.userData.text } : null,
  hidden: !!m.userData.hidden, locked: !!m.userData.locked,       // blocca e nascondi sono nella cronologia: Annulla li riporta com'erano
});
function snapshot() {
  return { sel: selection.map(m => m.userData.id), list: objects.map(entryOf) };
}
let opHint = null;                                   // 'Intersecati' mentre Interseca registra il passaggio, così la cronologia non scrive "Combinati"
// descrive in poche parole che cosa è cambiato rispetto al passaggio precedente
function describeChange(prev, cur) {
  if (!prev) return 'Inizio';
  const P = new Map(prev.list.map(d => [d.id, d])), C = new Map(cur.list.map(d => [d.id, d]));
  const added = cur.list.filter(d => !P.has(d.id)), removed = prev.list.filter(d => !C.has(d.id));
  if (added.length && removed.length) return removed.length > 1 ? `${opHint || 'Combinati'} ${removed.length} oggetti` : 'Lato modificato';
  if (added.length) return added.length === 1 ? `Aggiunto: ${added[0].name}` : `Aggiunti ${added.length} oggetti`;
  if (removed.length) return removed.length === 1 ? `Eliminato: ${removed[0].name}` : `Eliminati ${removed.length} oggetti`;
  const near = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
  const kinds = new Set(); let n = 0, name = '';
  cur.list.forEach(d => {
    const o = P.get(d.id); if (!o) return;
    const k = [];
    if (!!o.hidden !== !!d.hidden) k.push(d.hidden ? 'Nascosto' : 'Mostrato');
    if (!!o.locked !== !!d.locked) k.push(d.locked ? 'Bloccato' : 'Sbloccato');
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
/* contesto di selezione (spigoli e lati scelti): con Annulla si torna allo stato prima dell'operazione, con la stessa selezione */
let pendCtx = null, noStash = false;
function ctxNow() {
  const edges = edgeSel.map(x => { const p = x.chain.pts; const q = p.length > 1 ? p[0].clone().add(p[1]).multiplyScalar(0.5) : p[0].clone(); return { id: x.obj.userData.id, pt: [q.x, q.y, q.z] }; });
  const faces = faceSet.map(f => ({ id: f.obj.userData.id, tri: [...f.triSet][0] }));
  return edges.length || faces.length ? { tool: state.tool, edges, faces } : null;
}
function stashCtx() { if (noStash) return; const c = ctxNow(); pendCtx = c ? { c, t: Date.now() } : null; }
function applyCtx(c) {
  if (!c) return;
  if (state.tool !== c.tool) setTool(c.tool);
  c.faces.forEach((f, i) => { const o = objects.find(x => x.userData.id === f.id); if (o) selectFaceFromHit({ object: o, faceIndex: f.tri }, i > 0); });
  c.edges.forEach(e => { const o = objects.find(x => x.userData.id === e.id); if (o) selectEdgeAt({ object: o, point: new THREE.Vector3(...e.pt) }, true); });
}
function commit() {
  unsaved = objects.length > 0; scheduleSave();
  if (pendCtx && Date.now() - pendCtx.t < 8000 && history[hIdx]) history[hIdx].ctx = pendCtx.c;
  pendCtx = null;
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
  const made = s.list.map(d => makeMesh({ ...d }));
  setSelection(made.filter(m => s.sel.includes(m.userData.id)));
  touch();
  applyCtx(s.ctx);
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
function touch() { dirty = dimsDirty = true; if (window.__chkStale) window.__chkStale(); if (wantPixelRatio() !== pixelRatio) resize(); updatePerfNote(); $('#empty-hint').classList.toggle('hidden', objects.length > 0); scheduleLayers(); updateRotGizmo(); }
const bvhEval = new Evaluator();
bvhEval.attributes = ['position', 'normal'];
let useManifold = true;                                  // window.__noManifold = true per confrontare con il vecchio motore
initManifold();
const evaluator = {
  evaluate(a, b, op) {
    if (useManifold && !window.__noManifold) { const r = manifoldEvaluate(a, b, op, a.material); if (r) { evaluator.last = 'manifold'; return r; } }
    evaluator.last = 'bvh';
    return bvhEval.evaluate(a, b, op);
  },
  last: ''
};

// ripara le "crepe" lasciate dalla CSG: vertici che cadono in mezzo a un lato vicino (giunzioni a T) vengono collegati ai triangoli accanto
function weldPoints(src, tol) {                                              // unisce i punti più vicini di tol (controlla anche le celle accanto, senza spigoli di griglia)
  const n = src.length / 3, ids = new Int32Array(n), P = [], grid = new Map(), c = v => Math.floor(v / tol);
  for (let i = 0; i < n; i++) {
    const x = src[i * 3], y = src[i * 3 + 1], z = src[i * 3 + 2], cx = c(x), cy = c(y), cz = c(z);
    let found = -1;
    for (let dx = -1; dx <= 1 && found < 0; dx++) for (let dy = -1; dy <= 1 && found < 0; dy++) for (let dz = -1; dz <= 1 && found < 0; dz++) {
      const l = grid.get((cx + dx) + ',' + (cy + dy) + ',' + (cz + dz));
      if (l) for (const v of l) if (Math.abs(P[v * 3] - x) < tol && Math.abs(P[v * 3 + 1] - y) < tol && Math.abs(P[v * 3 + 2] - z) < tol) { found = v; break; }
    }
    if (found < 0) { found = P.length / 3; P.push(x, y, z); const k = cx + ',' + cy + ',' + cz; (grid.get(k) || grid.set(k, []).get(k)).push(found); }
    ids[i] = found;
  }
  return { P: Float32Array.from(P), ids };
}
function triList(g, ids) {
  const idx = g.index, n = idx ? idx.count : g.attributes.position.count, tris = [];
  for (let t = 0; t < n; t += 3) {
    const a = ids[idx ? idx.getX(t) : t], b = ids[idx ? idx.getX(t + 1) : t + 1], c = ids[idx ? idx.getX(t + 2) : t + 2];
    if (a !== b && b !== c && a !== c) tris.push(a, b, c);
  }
  return tris;
}
function healMesh(g) {
  const nT = (g.index ? g.index.count : g.attributes.position.count) / 3;
  if (nT > 300000) return g;
  const { P, ids } = weldPoints(g.attributes.position.array, 1e-3), tris = triList(g, ids);
  const fixed = fixTJunctions(P, tris);
  if (fixed.length === tris.length && tris.length === nT * 3) return g;      // niente da riparare
  const out = new Float32Array(fixed.length * 3);
  for (let i = 0; i < fixed.length; i++) { out[i * 3] = P[fixed[i] * 3]; out[i * 3 + 1] = P[fixed[i] * 3 + 1]; out[i * 3 + 2] = P[fixed[i] * 3 + 2]; }
  return geometryFromPositions(out);
}

function openEdgeCount(g) {                                                    // lati usati da un solo triangolo: se sono 0 la superficie è chiusa
  const { ids } = weldPoints(g.attributes.position.array, 1e-3), tris = triList(g, ids), key = (a, b) => a < b ? a * 4294967296 + b : b * 4294967296 + a, use = new Map();
  for (let t = 0; t < tris.length; t += 3) for (let k = 0; k < 3; k++) { const e = key(tris[t + k], tris[t + (k + 1) % 3]); use.set(e, (use.get(e) || 0) + 1); }
  let c = 0; for (const u of use.values()) if (u === 1) c++; return c;
}
function bakeResult(res, name) {
  res.updateMatrixWorld(true);
  let g = res.geometry.clone();
  if (!g.attributes.position || g.attributes.position.count === 0) return null;
  g.applyMatrix4(res.matrixWorld);
  clean(g);
  if (window.__prof) console.log('PROF open prima', openEdgeCount(g), 'tri', g.attributes.position.count / 3);
  g = healMesh(g);
  if (!g.index) g = geometryFromPositions(g.attributes.position.array);       // il risultato di Manifold arriva con normali piatte: si ricalcolano morbide (30°), così le pareti curve non fanno le fasce
  if (window.__prof) console.log('PROF open dopo', openEdgeCount(g));
  g.computeBoundingBox();
  const b = g.boundingBox;
  const c = b.getCenter(new THREE.Vector3()), minZ = b.min.z;
  g.translate(-c.x, -c.y, -minZ);
  g.computeBoundingBox();
  const s = g.boundingBox.getSize(new THREE.Vector3());
  counters.merged++;
  return { geo: g, pos: [c.x, c.y, minZ], size: s, name: name || `${NAMES.merged} ${counters.merged}` };
}
function combineBrushes(solids, holes, mode = 'union') {
  solids.forEach(m => m.updateMatrixWorld(true));
  holes.forEach(m => m.updateMatrixWorld(true));
  let acc = solids[0];
  const OP = mode === 'intersect' ? INTERSECTION : ADDITION;      // Interseca: resta solo la parte comune a tutti i solidi, poi i fori scavano
  for (let i = 1; i < solids.length; i++) acc = evaluator.evaluate(acc, solids[i], OP);
  if (holes.length > 1) {                              // prima i fori tra loro (pezzi piccoli e veloci), poi un solo taglio sul solido grande
    let hs = holes.slice();
    while (hs.length > 1) { const nx = []; for (let i = 0; i < hs.length; i += 2) nx.push(i + 1 < hs.length ? evaluator.evaluate(hs[i], hs[i + 1], ADDITION) : hs[i]); hs = nx; }
    acc = evaluator.evaluate(acc, hs[0], SUBTRACTION);
  } else for (const h of holes) acc = evaluator.evaluate(acc, h, SUBTRACTION);
  return acc;
}
function addMerged(baked) {
  return makeMesh({
    kind: 'merged', name: baked.name, geo: baked.geo, pos: baked.pos,
    p: { w: baked.size.x, d: baked.size.y, h: baked.size.z },
    base: { w: baked.size.x, d: baked.size.y, h: baked.size.z },
  });
}
function separateSelection(auto) {                       // divide in livelli distinti le parti non collegate di un oggetto
  const done = [], keep = [];
  for (const m of selection.slice()) {
    const baked = bakeResult(m, m.userData.name);
    const pg = baked && pieceGroups(baked.geo);
    if (!pg || pg.parts.length < 2) { keep.push(m); continue; }
    replaceWithMerged(m, baked, true);              // quiet: ci pensiamo noi alla selezione
    done.push(...lastPieces);
  }
  if (!done.length) return auto ? false : toast('È già un pezzo unico: non ci sono parti da separare');
  setSelection([...done, ...keep]);
  if (auto) return done.length;
  touch(); commit();
  toast('Parti separate: le trovi nei Livelli (F7)');
}
const nextPaint = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
let busyN = 0;
async function busyRun(label, fn) {                    // mostra la barra di lavoro, la fa dipingere, poi esegue il calcolo pesante
  const el = $('#busy'); $('#busy .b-t').textContent = tr(label); el.classList.remove('hidden'); busyN++;
  await nextPaint(); await nextPaint();
  try { return await fn(); } finally { if (--busyN <= 0) { busyN = 0; el.classList.add('hidden'); } }
}
const trisOf = list => list.reduce((a, m) => a + triCount(m.geometry), 0);
async function combine(mode = 'union') {
  const heavy = selection.length > 12 || trisOf(selection) > 20000;
  const run = () => combineNow(mode);
  return heavy ? busyRun(mode === 'intersect' ? 'Interseco gli oggetti…' : 'Combino gli oggetti…', run) : run();
}
const intersect = () => combine('intersect');
function combineNow(mode = 'union') {
  const isect = mode === 'intersect';
  const solids = selection.filter(m => !m.userData.hole);
  const holes = selection.filter(m => m.userData.hole);
  if (isect ? solids.length < 2 : (selection.length < 2 || !solids.length)) return toast(isect ? 'Seleziona almeno due solidi da intersecare (⇧ + clic)' : 'Seleziona almeno due oggetti, di cui un solido (⇧ + clic)');
  if (heavyGuard(selection)) return;
  const first = selection.length, P0 = performance.now(), lg = (n) => { if (window.__prof) console.log('PROF', n, Math.round(performance.now() - P0)); };
  const res = combineBrushes(solids, holes, mode); lg('csg');
  const baked = bakeResult(res); lg('bake');
  if (!baked) return toast(isect ? 'Gli oggetti non si sovrappongono: non c’è niente in comune' : 'Il risultato è vuoto: i fori coprono tutto');
  [...selection].forEach(removeMesh);
  const merged = addMerged(baked); lg('add');
  setSelection([merged]); lg('sel');
  const parts = separateSelection(true); lg('sep');              // se il risultato è fatto di parti staccate, ognuna diventa un livello
  touch(); opHint = isect ? 'Intersecati' : null; try { commit(); } finally { opHint = null; }
  toast(isect
    ? (parts > 1 ? `Intersecati ${first} oggetti: il risultato è in ${parts} pezzi separati` : `Intersecati ${first} oggetti`)
    : (parts > 1 ? `Combinati ${first} oggetti: il risultato è in ${parts} pezzi separati` : `Combinati ${first} oggetti`));
}
/* ------------------------------------------------------------ frecce su/giù nei campi numerici */
function addSteppers() {
  document.querySelectorAll('label.f > input[type=number]').forEach(inp => {
    const lab = inp.parentElement;
    if (lab.querySelector('.stp')) return;
    const short = (lab.firstChild?.textContent || '').trim().length <= 2;
    lab.classList.add('has-stp', short ? 'stp-l' : 'stp-r');
    const box = document.createElement('span'); box.className = 'stp';
    box.innerHTML = '<button type="button" tabindex="-1" aria-label="Aumenta" data-d="1"></button><button type="button" tabindex="-1" aria-label="Diminuisci" data-d="-1"></button>';
    lab.appendChild(box);
    let timer = null, rep = null;
    const bump = (d, big) => {
      const st = parseFloat(inp.step) || 0.5, mn = inp.min !== '' ? parseFloat(inp.min) : -Infinity, mx = inp.max !== '' ? parseFloat(inp.max) : Infinity;
      const cur = parseFloat(String(inp.value).replace(',', '.')) || 0, k = big ? 10 : 1;
      let v = Math.round((cur + d * st * k) / st * 1000) / 1000 * st;
      v = Math.min(mx, Math.max(mn, +v.toFixed(3)));
      inp.value = String(v);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const stop = () => { clearTimeout(timer); clearInterval(rep); };
    box.addEventListener('pointerdown', e => {
      const b = e.target.closest('button'); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      const d = +b.dataset.d; bump(d, e.shiftKey);
      timer = setTimeout(() => { rep = setInterval(() => bump(d, e.shiftKey), 70); }, 420);
      window.addEventListener('pointerup', stop, { once: true });
    });
  });
}
addSteppers();

/* ------------------------------------------------------------ ripeti: griglia, nido d'ape, cerchio */
const RP = { mode: 'grid', ex: 10, ey: 10 };
function honeyGapY() { const gx = parseFloat($('#rp-px').value) || 0; $('#rp-py').value = fmt(+(0.866 * (RP.ex + gx) - RP.ey).toFixed(2)); }
async function repeatSelection(o) {
  const n = o.mode === 'polar' ? o.n : (o.nx || 1) * (o.ny || 1);
  if (n * selection.length > 40 || trisOf(selection) * n > 40000) return busyRun('Creo le copie…', () => repeatNow(o));
  return repeatNow(o);
}
function repeatNow(o) {
  const src = selection.slice();
  if (!src.length) return toast('Seleziona prima un oggetto');
  const spots = [];                                   // per ogni copia: traslazione e rotazione attorno a Z
  if (o.mode === 'polar') {
    const n = clamp(Math.round(o.n), 2, 200), arc = clamp(o.arc, 1, 360), step = arc >= 360 ? 360 / n : arc / (n - 1);
    for (let k = 1; k < n; k++) spots.push({ th: k * step * D2R });
  } else {
    const nx = clamp(Math.round(o.nx), 1, 60), ny = clamp(Math.round(o.ny), 1, 60), honey = o.mode === 'honey';
    const py = o.py;                                    // spazio tra le copie; in nido d'ape lo spazio Y parte dal valore che dà righe a 0,866 × passo
    const bb = new THREE.Box3(); src.forEach(m => bb.union(worldBox(m)));
    const ex = bb.max.x - bb.min.x, ey = bb.max.y - bb.min.y;   // passo = ingombro reale + spazio
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (!i && !j) continue;
      spots.push({ dx: i * (ex + o.px) + (honey && j % 2 ? (ex + o.px) / 2 : 0), dy: j * (ey + py) });
    }
  }
  if (!spots.length) return toast('Con questi numeri non c\'è nulla da copiare');
  if (spots.length * src.length > 600) return toast('Troppe copie: il massimo è 600');
  const all = src.slice(), qz = new THREE.Quaternion(), p = new THREE.Vector3();
  for (const sp of spots) {
    const gmap = new Map();
    if (sp.th !== undefined) qz.setFromAxisAngle(new THREE.Vector3(0, 0, 1), sp.th);
    for (const m of src) {
      const u = m.userData;
      let gid = null;
      if (u.gid != null) { if (!gmap.has(u.gid)) gmap.set(u.gid, nextGid++); gid = gmap.get(u.gid); }
      const q = m.quaternion.clone();
      if (sp.th !== undefined) {
        p.set(m.position.x - o.cx, m.position.y - o.cy, 0).applyQuaternion(qz);
        p.set(p.x + o.cx, p.y + o.cy, m.position.z); q.premultiply(qz);
      } else p.set(m.position.x + sp.dx, m.position.y + sp.dy, m.position.z);
      all.push(makeMesh({ kind: u.kind, name: u.name.replace(/ copia( \d+)?$/, ''), p: { ...u.p }, hole: u.hole, base: u.base, geo: u.geo, gid, color: u.color, text: u.text, pos: p.toArray(), q: q.toArray(), scale: m.scale.toArray() }));
    }
  }
  setSelection(all); touch(); commit();
  { const n = spots.length * src.length; toast(n === 1 ? 'Creata 1 copia' : `Create ${n} copie`); }
}
function repeatDefaults() {                           // passo iniziale = ingombro della selezione + 2 mm
  if (!selection.length) return;
  const box = new THREE.Box3(); selection.forEach(m => box.union(worldBox(m)));
  const sz = box.getSize(new THREE.Vector3());
  RP.ex = sz.x; RP.ey = sz.y;
  $('#rp-px').value = fmt(2); $('#rp-py').value = fmt(2);
  if (RP.mode === 'honey') honeyGapY();
  const c = box.getCenter(new THREE.Vector3());
  if (RP.mode !== 'polar') { $('#rp-cx').value = fmt(c.x); $('#rp-cy').value = fmt(c.y); }
}
document.querySelectorAll('#rp-mode button').forEach(b => b.addEventListener('click', () => {
  RP.mode = b.dataset.v;
  b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  if (RP.mode === 'honey') honeyGapY();
  $('#rp-grid').classList.toggle('hidden', RP.mode === 'polar'); $('#rp-polar').classList.toggle('hidden', RP.mode !== 'polar');
}));
$('#rp-go').addEventListener('click', () => {
  const v = id => parseFloat($('#' + id).value);
  repeatSelection({ mode: RP.mode, nx: v('rp-nx') || 1, ny: v('rp-ny') || 1, px: isNaN(v('rp-px')) ? 2 : v('rp-px'), py: isNaN(v('rp-py')) ? 2 : v('rp-py'), n: v('rp-n') || 6, arc: v('rp-arc') || 360, cx: v('rp-cx') || 0, cy: v('rp-cy') || 0 });
});
$('#rp-px').addEventListener('input', () => { if (RP.mode === 'honey') honeyGapY(); });
// i campi non superano mai i limiti: ogni campo resta nel suo min/max e il totale delle copie nuove non va oltre 600
function limitRepeatField(el) {
  let v = Math.round(parseFloat(el.value));
  if (!Number.isFinite(v)) return;
  const k = Math.max(1, selection.length), room = Math.floor(600 / k) + 1;   // copie totali per oggetto, originale compreso
  let top = +el.max, why = '';
  if (el.id === 'rp-nx' || el.id === 'rp-ny') {
    const other = Math.max(1, Math.round(parseFloat($(el.id === 'rp-nx' ? '#rp-ny' : '#rp-nx').value)) || 1);
    if (Math.floor(room / other) < top) { top = Math.max(1, Math.floor(room / other)); why = 'total'; }
  } else if (el.id === 'rp-n' && room < top) { top = room; why = 'total'; }
  const nv = clamp(v, +el.min || 1, top);
  if (nv !== v || String(nv) !== el.value) el.value = nv;
  if (nv !== v && v > top) toast(why ? 'Massimo 600 copie in tutto' : `Massimo ${top}`);
}
['rp-nx', 'rp-ny', 'rp-n', 'rp-arc'].forEach(id => $('#' + id).addEventListener('change', e => limitRepeatField(e.target)));
$('#p-repeat').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('#rp-go').click(); });

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
function pasteClip(inPlace = false) {
  if (!clip || !clip.length) return toast('Niente da incollare');
  const off = inPlace ? 0 : 12 * ++pasteN;
  const gmap = new Map();
  const made = clip.map(d => {
    let gid = null;
    if (d.gid != null) { if (!gmap.has(d.gid)) gmap.set(d.gid, nextGid++); gid = gmap.get(d.gid); }
    const name = d.name.replace(/ copia( \d+)?$/, '') + (d.name.endsWith(' copia') ? '' : '');
    return makeMesh({ ...d, id: undefined, gid, name, p: { ...d.p }, base: d.base ? { ...d.base } : null, text: d.text ? { ...d.text } : null,
      pos: [d.pos[0] + off, d.pos[1] + off, d.pos[2]], q: d.q.slice(), scale: d.scale.slice() });
  });
  setSelection(made); touch(); commit();
  toast(`Incollato${made.length > 1 ? `: ${made.length} oggetti` : ''}`);
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
  const s = state.snap || 0.1;
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
function distributeSelection(axis) {
  const units = [], seen = new Set();
  selection.forEach(m => {
    if (seen.has(m)) return;
    const mem = m.userData.gid != null ? selection.filter(o => o.userData.gid === m.userData.gid) : [m];
    mem.forEach(o => seen.add(o));
    const box = new THREE.Box3(); mem.forEach(o => box.union(worldBox(o)));
    units.push({ mem, box });
  });
  if (units.length < 3) return toast('Per distribuire servono almeno 3 oggetti');
  units.sort((a, b) => (a.box.min[axis] + a.box.max[axis]) - (b.box.min[axis] + b.box.max[axis]));
  const lo = units[0].box.min[axis], hi = Math.max(...units.map(u => u.box.max[axis]));
  const sum = units.reduce((t, u) => t + (u.box.max[axis] - u.box.min[axis]), 0);
  const gap = (hi - lo - sum) / (units.length - 1);
  let cur = lo;
  units.forEach(u => {
    const d = cur - u.box.min[axis];
    if (Math.abs(d) > 1e-9) u.mem.forEach(o => { o.position[AXES[axis]] += d; o.updateMatrixWorld(true); });
    cur += (u.box.max[axis] - u.box.min[axis]) + gap;
  });
  touch(); syncPanel(); updateHandles(); commit();
  toast(gap < 0 ? `Distribuiti, ma si sovrappongono di ${fmt(-gap)} mm` : `Distribuiti con ${fmt(gap)} mm tra uno e l'altro`);
}
function distIcon(axis) {
  let inner = '<path d="M4 3v18M20 3v18"/><rect x="10.2" y="6.5" width="3.6" height="11" rx="1.2" fill="currentColor" stroke="none"/>';
  if (axis !== 'x') inner = `<g transform="rotate(-90 12 12)">${inner}</g>`;
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">${inner}</svg>`;
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
    btns.map(([mode, tip]) => `<button class="btn" style="flex:1;justify-content:center;background:var(--field);padding:6px 0" data-ax="${ax}" data-mode="${mode}" data-tip="${tip}" title="${tip}">${alignIcon(ax, mode)}</button>`).join('') + '</div>').join('')
    + '<h4 style="margin-top:10px">Distribuisci</h4><div style="display:flex;align-items:center;gap:6px">' + ['x', 'y', 'z'].map(ax =>
      `<button class="btn" style="flex:1;justify-content:center;background:var(--field);padding:6px 0;gap:4px" data-dist="${ax}" data-tip="Spazi uguali tra gli oggetti su ${ax.toUpperCase()}, tenendo fermi i due agli estremi" title="Spazi uguali tra gli oggetti su ${ax.toUpperCase()}, tenendo fermi i due agli estremi">${distIcon(ax)}<span style="font-size:11px;color:var(--muted)">${ax.toUpperCase()}</span></button>`).join('') + '</div>';
  $('#p-align').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.dist) distributeSelection(b.dataset.dist); else alignSelection(b.dataset.ax, b.dataset.mode);
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
  sp.scale.setScalar(0.022); fovSprites.push([sp, 0.022]);
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
    KEYS.forEach((k, i) => { if (fl[i] !== 1 || Math.abs(sizeOf(it.m)[k] - it.s0[k]) > 1e-6) setSize(it.m, k, Math.max(0.1, it.s0[k] * fl[i])); });   // con fattore 1 va comunque riportata la misura se prima era cambiata
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
  hpopIn.step = state.snap || 0.1;
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
const snapV = v => state.snap ? Math.round(v / state.snap) * state.snap : v;   // snap 0 = Libero

let drag = null;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  canvas.focus();
  canvas.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, mode: 'orbit', shift: e.shiftKey, btn: e.button };
  if (e.button === 1 || state.space || state.tool === 'hand') drag.mode = 'pan';
  else if (e.button === 2 || state.tool === 'orbit') drag.mode = 'orbit';
  else if (state.tool === 'marquee' || state.tool === 'lasso') { drag.mode = 'marquee'; drag.pts = [[e.clientX, e.clientY]]; mqShow(drag, e); }
  else if (state.tool === 'rotate') {
    const ax = pickRing(e);
    if (ax) {
      const c = selBox().getCenter(new THREE.Vector3()), axis = AXV[ax];
      const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(axis, c);
      const p = raycaster.ray.intersectPlane(pl, new THREE.Vector3());
      if (p) { drag.mode = 'rotate'; drag.rot = { ax, axis, c, pl, v0: p.sub(c), items: startRot(), delta: 0 }; rotAct = ax; rotLook(); return; }
    }
    const hit = pickObject(e);
    if (hit && !selection.includes(hit)) setSelection(withGroups([hit]));
    drag.mode = 'orbit'; drag.emptyClick = !hit;
  }
  else if (state.tool === 'edge') {
    if (moveHandle.visible) {
      setRay(e);
      if (raycaster.intersectObject(moveHandle, false)[0]) { const em = startEdgeMove(e); if (em) { drag.mode = 'edgemove'; drag.em = em; hideHover(); return; } }
    }
    if (edgeHandle.visible) {
      setRay(e);
      if (raycaster.intersectObject(edgeHandle, false)[0]) { const es = startEdgeScale(); if (es) { drag.mode = 'edgescale'; drag.es = es; hideHover(); return; } }
    }
    drag.mode = 'orbit'; drag.edgeHit = pickHit(e); drag.emptyClick = !drag.edgeHit;
  }
  else if (state.tool === 'ruler') {
    drag.mode = 'orbit'; drag.rulerHit = pickHit(e);
  }
  else if (planeTool()) {
    if (cutPlaneHit(e)) { const cm = startCutMove(e); if (cm) { drag.mode = 'cutmove'; drag.cm = cm; canvas.style.cursor = 'grabbing'; return; } }
    drag.mode = 'orbit'; drag.cutHit = pickHit(e);
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
    if (state.tool === 'edge' && !state.space) { updateEdgeHover(e); if (moveHandle.visible) { setRay(e); if (raycaster.intersectObject(moveHandle, false)[0]) canvas.style.cursor = 'pointer'; } if (edgeHandle.visible) { setRay(e); if (raycaster.intersectObject(edgeHandle, false)[0]) canvas.style.cursor = 'pointer'; } }
    else if (state.tool === 'face' && !state.space) { updateHover(e); if (faceHandle.visible) { setRay(e); canvas.style.cursor = raycaster.intersectObject(faceHandle, false)[0] ? 'pointer' : 'crosshair'; } } else hideHover();
    if (HANDLES[0].visible && state.tool === 'move' && !state.space) canvas.style.cursor = pickHandle(e) ? 'pointer' : 'default';
    if (planeTool() && !state.space) canvas.style.cursor = cutPlaneHit(e) ? 'grab' : 'default';
    if (state.tool === 'rotate' && !state.space) { const h = pickRing(e); if (h !== rotHot) { rotHot = h; rotLook(); } canvas.style.cursor = h ? 'pointer' : 'crosshair'; } else if (rotHot) { rotHot = null; rotLook(); }
    if (state.tool === 'ruler') rulerHover(e); else { if (rulerHov.style.display !== 'none') rulerHov.style.display = 'none'; if (faceDim.style.display !== 'none') faceDim.style.display = 'none'; }
    return;
  }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 3) return;
  drag.moved = true;
  drag.x = e.clientX; drag.y = e.clientY;
  if (drag.mode === 'pan') panPixels(dx, dy);
  else if (drag.mode === 'orbit') orbitPixels(dx, dy);
  else if (drag.mode === 'marquee') mqUpdate(drag, e);
  else if (drag.mode === 'facepush') moveFaceDrag(e, drag.fd);
  else if (drag.mode === 'edgescale') moveEdgeScale(e, drag.es);
  else if (drag.mode === 'edgemove') moveEdgeMove(e, drag.em);
  else if (drag.mode === 'cutmove') moveCutMove(e, drag.cm);
  else if (drag.mode === 'rotate') {
    const r = drag.rot; setRay(e);
    const p = raycaster.ray.intersectPlane(r.pl, new THREE.Vector3());
    if (!p) return;
    const v = p.sub(r.c);
    let ang = Math.atan2(r.axis.dot(new THREE.Vector3().crossVectors(r.v0, v)), r.v0.dot(v));
    if (!e.altKey) { const st = (e.shiftKey ? 5 : 15) * D2R; ang = Math.round(ang / st) * st; }
    r.delta = ang;
    applyRot(r.items, r.axis, ang, r.c); rotWedgeSet(r, ang);
    const sp = r.c.clone().project(camera);
    dragRead.style.display = 'block';
    dragRead.style.left = e.clientX + 18 + 'px'; dragRead.style.top = e.clientY - 12 + 'px';
    const dg = Math.round(ang / D2R * 10) / 10;
    dragRead.textContent = `${r.ax.toUpperCase()} ${dg > 0 ? '+' : ''}${fmt(dg)}°`;
  }
  else if (drag.mode === 'move' && !drag.vert) {
    if (drag.toggle && !selection.includes(drag.hit)) {
      setSelection(withGroups([drag.hit]));
      drag.start = new Map(selection.map(m => [m, m.position.clone()])); drag.snap = null;
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
    const mag = state.magnet && !e.metaKey && !e.ctrlKey;     // ⌘ premuto = calamita spenta solo per questo trascinamento
    const sh = new THREE.Vector3(dxs, dys, 0), SI = e.shiftKey || !mag ? null : ensureSnap(drag, 'snap', drag.start);
    const sv = SI ? snapVerts(SI, sh) : null, sn = SI && !sv ? snapFaces(SI, sh, 'xy') : null;
    if (sv) { dxs += sv.c.x; dys += sv.c.y; } else if (sn) { dxs += sn.c.x; dys += sn.c.y; }
    showSnap(sn, sh, e); if (sv || vtxMark.visible) showVertex(sv, e);
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
  if (d.btn === 2 && d.mode === 'orbit' && !d.moved) { openCtx(e); return; }     // tasto destro senza trascinare: menu; trascinando si orbita come sempre
  if (d.mode === 'move') { vtxMark.visible = false; guide.visible = false; dragRead.style.display = 'none'; dirty = true; }
  if (d.mode === 'rotate') { rotEnd(); dragRead.style.display = 'none'; if (d.moved && d.rot.delta !== 0) commit(); return; }
  if (d.mode === 'edgemove') { endEdgeMove(d.em, d.moved); return; }
  if (d.mode === 'cutmove') { dragRead.style.display = 'none'; canvas.style.cursor = 'grab'; return; }
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
  if (d.mode === 'marquee') { mqFinish(d, e); return; }
  if (planeTool() && d.mode === 'orbit' && !d.moved) { cutClick(d.cutHit); return; }
  if (state.tool === 'ruler' && d.mode === 'orbit' && !d.moved) { if (!e.altKey) rulerClick(d.rulerHit); return; }
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
/* selezione a riquadro e lazo */
const mqMode = () => state.tool === 'lasso' ? 'lasso' : 'rect';
const mqEl = $('#mq'), mqR = $('#mq-r'), mqP = $('#mq-p');
function mqShow(d, e) {
  mqEl.classList.remove('hidden', 'touch'); mqR.style.display = mqMode() === 'rect' ? '' : 'none'; mqP.style.display = mqMode() === 'lasso' ? '' : 'none';
  mqUpdate(d, e);
}
function mqUpdate(d, e) {
  if (mqMode() === 'rect') {
    const [x0, y0] = d.pts[0], x = Math.min(x0, e.clientX), y = Math.min(y0, e.clientY);
    mqR.setAttribute('x', x); mqR.setAttribute('y', y); mqR.setAttribute('width', Math.abs(e.clientX - x0)); mqR.setAttribute('height', Math.abs(e.clientY - y0));
  } else {
    const l = d.pts[d.pts.length - 1];
    if (Math.hypot(e.clientX - l[0], e.clientY - l[1]) > 3) d.pts.push([e.clientX, e.clientY]);
    mqP.setAttribute('points', d.pts.map(p => p.join(',')).join(' '));
  }
}
function inPoly(x, y, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// gli oggetti toccati dall'area: si lanciano raggi su una griglia di punti dentro l'area, quindi conta la forma vera e non l'ingombro.
// Si prendono solo quelli visibili; con Raggi X acceso anche quelli coperti.
function pickInArea(inside, x0, y0, x1, y1) {
  const cand = objects.filter(o => o.visible && !o.userData.locked), found = new Set();
  const step = Math.max(5, Math.sqrt(Math.max(1, (x1 - x0) * (y1 - y0)) / 2500));
  const test = (x, y) => {
    if (!inside(x, y)) return;
    setRay({ clientX: x, clientY: y });
    const hits = raycaster.intersectObjects(cand, false);
    if (state.xray) hits.forEach(h => found.add(h.object)); else if (hits[0]) found.add(hits[0].object);
  };
  for (let y = y0; y <= y1; y += step) for (let x = x0; x <= x1; x += step) test(x, y);
  test(x1, y1); test((x0 + x1) / 2, (y0 + y1) / 2);
  return [...found];
}
function mqFinish(d, e) {
  mqEl.classList.add('hidden');
  if (!d.moved) { if (!d.shift) setSelection([]); return; }
  let found;
  if (mqMode() === 'rect') {
    const [sx, sy] = d.pts[0], x0 = Math.min(sx, e.clientX), x1 = Math.max(sx, e.clientX), y0 = Math.min(sy, e.clientY), y1 = Math.max(sy, e.clientY);
    found = pickInArea(() => true, x0, y0, x1, y1);
  } else if (d.pts.length > 2) {
    const xs = d.pts.map(p => p[0]), ys = d.pts.map(p => p[1]);
    found = pickInArea((x, y) => inPoly(x, y, d.pts), Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
  } else found = [];
  const sel = withGroups(found);
  setSelection(d.shift ? [...new Set([...selection, ...sel])] : sel);
  if (sel.length) toast(sel.length === 1 ? 'Selezionato 1 oggetto' : `Selezionati ${sel.length} oggetti`);
}
/* calamita tra lati: facce parallele e opposte vicine si agganciano a contatto (0 mm) */
function worldPlanes(m) {
  const info = meshInfo(m.geometry);
  if (info.nTri > 80000) return [];
  m.updateMatrixWorld(true);
  const geo = m.geometry, pos = geo.attributes.position, idx = geo.index, mw = m.matrixWorld;
  const nm = new THREE.Matrix3().getNormalMatrix(mw);
  const groups = new Map(), wn = new THREE.Vector3(), V = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (let t = 0; t < info.nTri; t++) {
    if (!info.ok[t]) continue;
    wn.set(info.nrm[t * 3], info.nrm[t * 3 + 1], info.nrm[t * 3 + 2]).applyMatrix3(nm).normalize();
    for (let k = 0; k < 3; k++) V[k].fromBufferAttribute(pos, idx ? idx.getX(t * 3 + k) : t * 3 + k).applyMatrix4(mw);
    const d = wn.dot(V[0]);
    const key = Math.round(wn.x * 200) + ',' + Math.round(wn.y * 200) + ',' + Math.round(wn.z * 200) + ',' + Math.round(d * 20);
    let g = groups.get(key);
    if (!g) { g = { n: wn.clone(), d, min: new THREE.Vector3(Infinity, Infinity, Infinity), max: new THREE.Vector3(-Infinity, -Infinity, -Infinity), area: 0 }; groups.set(key, g); }
    for (let k = 0; k < 3; k++) { g.min.min(V[k]); g.max.max(V[k]); }
    g.area += e1.subVectors(V[1], V[0]).cross(e2.subVectors(V[2], V[0])).length() / 2;
  }
  return [...groups.values()].filter(g => g.area > 4).sort((a, b) => b.area - a.area).slice(0, 60);
}
function ensureSnap(d, key, map) {
  if (d[key]) return d[key];
  const mov = [], stat = [];
  for (const m of objects) { if (!m.visible) continue; (map.has(m) ? mov : stat).push(...worldPlanes(m)); }
  const movC = [], statC = [];
  for (const m of objects) { if (!m.visible) continue; (map.has(m) ? movC : statC).push(...worldCorners(m)); }
  stat.sort((a, b) => b.area - a.area);            // i lati più grandi per primi: con tanti oggetti non si perdono quelli importanti
  return (d[key] = { mov: mov.slice(0, 120), stat: stat.slice(0, 600), movC: movC.slice(0, 400), statC: statC.slice(0, 20000) });
}
// s = spostamento dall'inizio; mode 'xy' per i lati verticali, 'z' per quelli orizzontali. Restituisce la correzione.
function snapFaces(info, s, mode) {
  const tol = Math.min(6, worldPerPixel() * 8), pad = tol + 0.05;
  let best = null;
  for (const M of info.mov) for (const S of info.stat) {
    const dn = M.n.dot(S.n);
    if (dn > -0.998 && dn < 0.998) continue;                  // lati opposti = contatto; lati con la stessa direzione = a filo
    const flush = dn > 0;
    const mask = mode === 'z' ? S.n.z * S.n.z : S.n.x * S.n.x + S.n.y * S.n.y;
    if (mask < 0.6 || (mode === 'z' && Math.abs(S.n.z) < 0.8)) continue;
    const g = ((flush ? M.d : -M.d) + S.n.dot(s)) - S.d;
    if (Math.abs(g) > tol || (best && Math.abs(g) >= Math.abs(best.g))) continue;
    let ok = true;
    for (const ax of ['x', 'y', 'z']) if (M.min[ax] + s[ax] > S.max[ax] + pad || M.max[ax] + s[ax] < S.min[ax] - pad) { ok = false; break; }
    if (!ok) continue;
    const c = mode === 'z' ? new THREE.Vector3(0, 0, -g / S.n.z) : new THREE.Vector3(-g * S.n.x / mask, -g * S.n.y / mask, 0);
    best = { g, c, M, S };
  }
  return best;
}
function showSnap(sn, s, e) {
  if (!sn) { if (guide.visible || dragRead.style.display !== 'none') { guide.visible = false; dragRead.style.display = 'none'; dirty = true; } return; }
  const { S, M } = sn, sh = s.clone().add(sn.c);
  const lo = new THREE.Vector3(Math.max(S.min.x, M.min.x + sh.x), Math.max(S.min.y, M.min.y + sh.y), Math.max(S.min.z, M.min.z + sh.z));
  const hi = new THREE.Vector3(Math.min(S.max.x, M.max.x + sh.x), Math.min(S.max.y, M.max.y + sh.y), Math.min(S.max.z, M.max.z + sh.z));
  const n = S.n.clone(), u = Math.abs(n.z) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1).cross(n).normalize(), v = n.clone().cross(u);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  const c = new THREE.Vector3(), ctr = lo.clone().add(hi).multiplyScalar(0.5);
  for (const x of [lo.x, hi.x]) for (const y of [lo.y, hi.y]) for (const z of [lo.z, hi.z]) {
    c.set(x, y, z).sub(ctr); const a = c.dot(u), b = c.dot(v);
    u0 = Math.min(u0, a); u1 = Math.max(u1, a); v0 = Math.min(v0, b); v1 = Math.max(v1, b);
  }
  const mg = 4, gw = Math.max(u1 - u0, 1) + mg * 2, gh = Math.max(v1 - v0, 1) + mg * 2;
  guide.scale.set(gw, gh, 1); guideMat.uniforms.uSize.value.set(gw, gh);
  guide.position.copy(ctr).addScaledVector(n, S.d - n.dot(ctr));
  guide.quaternion.setFromRotationMatrix(basisMatrix(u, v, n, new THREE.Vector3()));
  guide.visible = true;
  dragRead.style.display = 'block';
  dragRead.style.left = e.clientX + 18 + 'px'; dragRead.style.top = e.clientY - 12 + 'px';
  dragRead.textContent = tr('a contatto');
  dirty = true;
}
/* calamita tra angoli (apici): un vertice del pezzo si aggancia a un vertice di un altro */
function worldCorners(m) {
  const geo = m.geometry, info = meshInfo(geo), pos = geo.attributes.position, idx = geo.index;
  m.updateMatrixWorld(true);
  const out = [], v = new THREE.Vector3();
  if (info.nTri > 60000) {                                  // modelli pesanti: solo gli otto angoli dell'ingombro
    const bb = new THREE.Box3().setFromObject(m);
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) out.push(new THREE.Vector3(x, y, z));
    return out;
  }
  const first = new Int32Array(info.nVerts).fill(-1), sharp = new Uint8Array(info.nVerts), seen = new Int32Array(info.nVerts).fill(-1);
  for (let t = 0; t < info.nTri; t++) {
    if (!info.ok[t]) continue;
    for (let k = 0; k < 3; k++) {
      const id = info.ids[t * 3 + k];
      if (first[id] < 0) { first[id] = t; seen[id] = idx ? idx.getX(t * 3 + k) : t * 3 + k; continue; }
      const a = first[id] * 3, b = t * 3;
      if (info.nrm[a] * info.nrm[b] + info.nrm[a + 1] * info.nrm[b + 1] + info.nrm[a + 2] * info.nrm[b + 2] < 0.92) sharp[id] = 1;
    }
  }
  for (let id = 0; id < info.nVerts; id++) if (sharp[id] && seen[id] >= 0) out.push(v.fromBufferAttribute(pos, seen[id]).clone().applyMatrix4(m.matrixWorld));
  if (out.length > 4000) { const step = out.length / 4000, r = []; for (let i = 0; i < 4000; i++) r.push(out[Math.floor(i * step)]); return r; }
  return out;
}
function snapVerts(info, s) {
  const tol = Math.min(8, worldPerPixel() * 10);
  if (!info.box) {                                            // ingombro in pianta dei punti che si muovono: scarta subito i punti lontani
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const a of info.movC) { x0 = Math.min(x0, a.x); y0 = Math.min(y0, a.y); x1 = Math.max(x1, a.x); y1 = Math.max(y1, a.y); }
    info.box = [x0, y0, x1, y1];
  }
  const [x0, y0, x1, y1] = info.box, lx = x0 + s.x - tol, hx = x1 + s.x + tol, ly = y0 + s.y - tol, hy = y1 + s.y + tol;
  let best = null, bd = tol;
  for (const b of info.statC) {
    if (b.x < lx || b.x > hx || b.y < ly || b.y > hy) continue;
    for (const a of info.movC) {
      const dx = b.x - (a.x + s.x), dy = b.y - (a.y + s.y), d = Math.hypot(dx, dy) + Math.abs(b.z - a.z) * 0.15;
      if (d < bd) { bd = d; best = { c: new THREE.Vector3(dx, dy, 0), at: b }; }
    }
  }
  return best;
}
const vtxMark = (() => {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: handleTexture('#ff6a00'), sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true }));
  sp.scale.setScalar(0.022); fovSprites.push([sp, 0.022]); sp.renderOrder = 999; sp.visible = false; scene.add(sp); return sp;
})();
function showVertex(sv, e) {
  vtxMark.visible = !!sv;
  if (sv) {
    vtxMark.position.copy(sv.at);
    dragRead.style.display = 'block'; dragRead.style.left = e.clientX + 18 + 'px'; dragRead.style.top = e.clientY - 12 + 'px';
    dragRead.textContent = tr('angolo su angolo'); guide.visible = false;
  }
  dirty = true;
}
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
  let ddz = snapV(base.z + dz) - base.z;
  const shz = new THREE.Vector3(0, 0, ddz), snz = state.magnet ? snapFaces(ensureSnap(d, 'snapz', d.vstart), shz, 'z') : null;
  if (snz) ddz += snz.c.z;
  showSnap(snz, shz, e);
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
canvas.addEventListener('gesturechange', e => { e.preventDefault(); cam.dist = clamp(gDist / e.scale, 4, 3000); applyCamera(); });
function updateCursor(grabbing) {
  const pan = state.space || state.tool === 'hand';
  canvas.style.cursor = pan ? (grabbing ? 'grabbing' : 'grab') : state.tool === 'orbit' ? 'move' : state.tool === 'rotate' ? 'crosshair' : state.tool === 'face' || state.tool === 'edge' || state.tool === 'ruler' || state.tool === 'marquee' || state.tool === 'lasso' || planeTool() ? 'crosshair' : 'default';
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
/* grafica dell'anello: tacche ogni 15° (più lunghe ogni 90°), alone al passaggio del mouse e spicchio con braccia mentre si ruota */
const rotHalo = {}, rotMat = {}, rotTick = {};
for (const ax of ['x', 'y', 'z']) {
  const ring = rotRings[ax]; rotMat[ax] = ring.material;
  const tk = [];
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12, r0 = i % 6 === 0 ? 0.86 : 0.94, c = Math.cos(a), s = Math.sin(a);
    tk.push(c * r0, s * r0, 0, c * 1.0, s * 1.0, 0);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tk, 3));
  const ticks = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: AXIS_COLOR[ax], transparent: true, opacity: 0.7, depthTest: false, depthWrite: false }));
  ticks.renderOrder = 997; ring.add(ticks); rotTick[ax] = ticks;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 8, 128), new THREE.MeshBasicMaterial({ color: AXIS_COLOR[ax], transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
  halo.renderOrder = 996; ring.add(halo); rotHalo[ax] = halo;
}
const rotWedge = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xff6a00, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthTest: false, depthWrite: false }));
rotWedge.renderOrder = 995; rotWedge.visible = false; rotWedge.frustumCulled = false; rotGizmo.add(rotWedge);
const rotArm = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xff6a00, depthTest: false, depthWrite: false }));
rotArm.renderOrder = 998; rotArm.visible = false; rotArm.frustumCulled = false; rotGizmo.add(rotArm);
let rotHot = null, rotAct = null;
function rotLook() {                                          // anello sotto il mouse o in uso: pieno e con alone; gli altri sbiaditi
  const on = rotAct || rotHot;
  for (const ax of ['x', 'y', 'z']) {
    rotMat[ax].opacity = !on ? 0.9 : on === ax ? 1 : 0.3;
    rotHalo[ax].material.opacity = on === ax ? (rotAct ? 0.22 : 0.3) : 0;
    rotTick[ax].material.opacity = !on ? 0.7 : on === ax ? 0.9 : 0.2;
  }
  dirty = true;
}
function rotWedgeSet(r, ang) {                                // spicchio dal punto di partenza all'angolo attuale (coordinate del gruppo: raggio 1)
  const u = r.v0.clone().normalize(), w = r.axis.clone().cross(u), n = Math.max(2, Math.ceil(Math.abs(ang) / (3 * D2R)));
  const P = [0, 0, 0], at = f => u.clone().multiplyScalar(Math.cos(f)).addScaledVector(w, Math.sin(f));
  for (let i = 0; i <= n; i++) { const q = at(ang * i / n); P.push(q.x, q.y, q.z); }
  const idx = []; for (let i = 1; i <= n; i++) idx.push(0, i, i + 1);
  const g = rotWedge.geometry; g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(idx); g.computeBoundingSphere();
  const a0 = at(0), a1 = at(ang);
  rotArm.geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, a0.x * 1.12, a0.y * 1.12, a0.z * 1.12, 0, 0, 0, a1.x * 1.12, a1.y * 1.12, a1.z * 1.12], 3));
  rotWedge.visible = rotArm.visible = Math.abs(ang) > 1e-4; dirty = true;
}
function rotEnd() { rotAct = null; rotWedge.visible = rotArm.visible = false; rotLook(); }
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
  $('#p-single').classList.toggle('hidden', !m); $('#p-single2').classList.toggle('hidden', !m); if (m) $('#p-single2').before($('#p-rotq')); else $('#p-multi').after($('#p-rotq'));
  $('#p-multi').classList.toggle('hidden', !!m);
  const allHole = selection.every(o => o.userData.hole);
  document.querySelectorAll('#p-type button').forEach(b => b.classList.toggle('on', (b.dataset.v === 'hole') === allHole));
  syncColor(); syncTextPanel();
  const nameEl = $('#p-name');
  if (m) {
    if (document.activeElement !== nameEl) nameEl.value = tr(m.userData.name);
    nameEl.disabled = false;
    const s = sizeOf(m), v = { x: m.position.x, y: m.position.y, z: m.position.z, w: s.w, d: s.d, h: s.h, r: m.userData.p.r ?? 0, ft: m.userData.p.ft ?? 0, fb: m.userData.p.fb ?? 0, t: m.userData.p.t ?? 100, q: m.userData.p.q ?? 0, ...eulerDeg(m) };
    ids.forEach(i => { if (document.activeElement !== F[i]) F[i].value = fmt(v[i]); });
    $('#p-r-wrap').classList.toggle('hidden', !ROUND_KINDS.includes(m.userData.kind));
    $('#p-r').parentElement.classList.toggle('hidden', !['box', 'prism'].includes(m.userData.kind));
    document.querySelectorAll('#p-rm button').forEach(b => b.classList.toggle('on', (m.userData.p.rm === 'chamfer') === (b.dataset.v === 'chamfer')));
    $('#p-t-wrap').classList.toggle('hidden', !['box', 'cylinder', 'prism'].includes(m.userData.kind));
    const qs = QSPEC[m.userData.kind];
    $('#p-q-wrap').classList.toggle('hidden', !qs);
    if (qs) { const lab = $('#p-q-lab'); if (lab.dataset.k !== m.userData.kind) { lab.dataset.k = m.userData.kind; lab.firstChild.data = qs[0]; F.q.min = qs[1]; F.q.max = qs[2]; F.q.step = m.userData.kind === 'prism' ? 1 : 5; } }
  } else {
    const gb = selBox(), gs = gb.getSize(new THREE.Vector3());
    [['w', 'x'], ['d', 'y'], ['h', 'z']].forEach(([id, ax]) => { const el = $('#g-' + id); if (document.activeElement !== el) el.value = fmt(gs[ax]); });
    const gc = gb.getCenter(new THREE.Vector3());
    [['x', gc.x], ['y', gc.y], ['z', gb.min.z]].forEach(([ax, v]) => { const el = $('#g-' + ax); if (document.activeElement !== el) el.value = fmt(v); });
    nameEl.value = tr(isOneGroup() ? `Gruppo · ${selection.length} oggetti` : `${selection.length} oggetti`);
    nameEl.disabled = true;
  }
  const nUnits = new Set(selection.map(o => o.userData.gid ?? o)).size;
  document.querySelectorAll('#p-align button').forEach(b => {          // pulsanti che con questa selezione non servono: attenuati, con il motivo nel tooltip
    let off = false, why = '';
    if (b.dataset.dist) { off = nUnits < 3; why = 'Servono almeno 3 oggetti'; }
    else if (nUnits < 2 && b.dataset.ax === 'z' && b.dataset.mode !== 'min') { off = true; why = 'Con un solo oggetto in altezza si può solo appoggiare al piatto'; }
    b.style.opacity = off ? '.38' : ''; b.title = off ? why : b.dataset.tip;
  });
  $('#p-key').textContent = nUnits < 2 ? 'Allinea al piatto.'
    : keyObj ? `Oggetto chiave: ${keyObj.userData.name}. Clicca un altro oggetto selezionato per cambiarlo.`
    : 'Allineo alla selezione. Per scegliere un oggetto chiave, clicca uno degli oggetti selezionati.';
}
// posizione di un gruppo o di più oggetti: X e Y sono il centro dell'ingombro, Z la base
['x', 'y', 'z'].forEach(ax => {
  const el = $('#g-' + ax);
  el.addEventListener('input', () => {
    const v = parseFloat(el.value);
    if (!isFinite(v) || selection.length < 2) return;
    const b = selBox(), cur = ax === 'z' ? b.min.z : b.getCenter(new THREE.Vector3())[ax], d = v - cur;
    if (!d) return;
    selection.forEach(m => { m.position[ax] += d; m.updateMatrixWorld(true); });
    touch(); updateHandles(); dirty = true;
  });
  el.addEventListener('change', () => { syncPanel(); commit(); });
  el.addEventListener('keydown', e => { if (e.key === 'Enter') el.blur(); });
});
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
  const m = single(); if (!m || !ROUND_KINDS.includes(m.userData.kind)) return;
  m.userData.p.rm = b.dataset.v === 'chamfer' ? 'chamfer' : null;
  m.geometry.dispose(); m.geometry = buildGeometry(m.userData.kind, m.userData.p); refreshEdges(m); m.updateMatrixWorld(true);
  touch(); updateHandles(); syncPanel(); commit();
}));
['rx', 'ry', 'rz'].forEach(id => bind(id, m => setEulerDeg(m, +F.rx.value || 0, +F.ry.value || 0, +F.rz.value || 0)));
['#p-lock', '#g-lock'].forEach(id => $(id).addEventListener('click', () => {
  sizeLock = !sizeLock; syncLock();
  try { localStorage.setItem('forma.lock', sizeLock ? '1' : '0'); } catch (e) {}
  toast(sizeLock ? 'Proporzioni bloccate: le misure cambiano insieme' : 'Proporzioni libere');
}));
syncLock();
['#p-ground', '#g-ground'].forEach(id => $(id).addEventListener('click', () => { layOnPlate(); canvas.focus(); }));
$('#p-name').addEventListener('input', e => { const m = single(); if (m) { m.userData.name = e.target.value; scheduleLayers(); } });
$('#p-name').addEventListener('change', commit);
document.addEventListener('click', e => { if (e.target.closest('[data-lang]')) setTimeout(syncPanel, 0); });   // il nome nel pannello segue la lingua
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
// l'export porta sempre tutto il piatto (solidi visibili); Controlla invece guarda la selezione se c'è
function exportList() { return objects.filter(m => !m.userData.hole && !m.userData.hidden); }
function checkList() {
  const sel = selection.filter(m => !m.userData.hole);
  return sel.length ? sel : exportList();
}
const exportName = list => (list.length === 1 ? tr(list[0].userData.name) : 'filo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'filo';
function download(data, type, filename) {
  unsaved = false;
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
  const v = new THREE.Vector3();
  list.forEach(m => {                                  // come il 3MF: vertici uniti e giunzioni a T riparate, così non restano crepe
    m.updateMatrixWorld(true);
    let h = m.geometry.clone(); h.deleteAttribute('normal'); h.deleteAttribute('uv');
    h = mergeVertices(h, 1e-4);
    const pos = h.attributes.position, idx = h.index, W = new Float32Array(pos.count * 3);
    for (let k = 0; k < pos.count; k++) { v.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld); W.set([v.x, v.y, v.z], k * 3); }
    const R = repairForExport(W, idx ? Uint32Array.from(idx.array) : Uint32Array.from({ length: pos.count }, (_, k) => k));
    const out = new Float32Array(R.I.length * 3);
    for (let k = 0; k < R.I.length; k++) { out[k * 3] = R.P[R.I[k] * 3]; out[k * 3 + 1] = R.P[R.I[k] * 3 + 1]; out[k * 3 + 2] = R.P[R.I[k] * 3 + 2]; }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(out, 3));
    g.add(new THREE.Mesh(bg, M.solid)); h.dispose();
  });
  g.updateMatrixWorld(true);
  const data = new STLExporter().parse(g, { binary: true });
  const name = nameArg || exportName(list);
  download(data, 'model/stl', `${name}.stl`);
  toast(`Esportato ${name}.stl (${list.length} ${list.length === 1 ? 'pezzo' : 'pezzi'})`);
  return data;
}
// 3MF: archivio zip con un oggetto per pezzo, in millimetri (Z verso l'alto, come nello slicer)
/* Rimuove triangoli collassati e, dove due pezzi si toccano lungo uno spigolo (spigolo usato da 4 triangoli), separa i vertici: ogni pezzo resta una superficie chiusa. */
/* T-giunzioni (un vertice che cade in mezzo a uno spigolo del vicino): lo spigolo lungo viene spezzato, così la superficie risulta chiusa. */
function fixTJunctions(P, tris) {
  const key = (a, b) => a < b ? a * 4294967296 + b : b * 4294967296 + a;
  let T = Array.from(tris);
  for (let pass = 0; pass < 4; pass++) {
    const use = new Map(), nT = T.length / 3;
    for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) { const e = key(T[t * 3 + k], T[t * 3 + (k + 1) % 3]); use.set(e, (use.get(e) || 0) + 1); }
    const openV = new Set();
    for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) if (use.get(key(T[t * 3 + k], T[t * 3 + (k + 1) % 3])) === 1) { openV.add(T[t * 3 + k]); openV.add(T[t * 3 + (k + 1) % 3]); }
    if (!openV.size || openV.size > 60000) break;
    const CELL = 2, grid = new Map(), ck = (x, y, z) => Math.floor(x / CELL) + ',' + Math.floor(y / CELL) + ',' + Math.floor(z / CELL);
    for (const v of openV) { const k = ck(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); (grid.get(k) || grid.set(k, []).get(k)).push(v); }
    const out = []; let changed = false;
    for (let t = 0; t < nT; t++) {
      const tri = [T[t * 3], T[t * 3 + 1], T[t * 3 + 2]];
      let done = false;
      for (let k = 0; k < 3 && !done; k++) {
        const a = tri[k], b = tri[(k + 1) % 3], c = tri[(k + 2) % 3];
        if (use.get(key(a, b)) !== 1) continue;
        const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2], dx = P[b * 3] - ax, dy = P[b * 3 + 1] - ay, dz = P[b * 3 + 2] - az, L2 = dx * dx + dy * dy + dz * dz;
        if (L2 < 1e-12) continue;
        const cand = [], x0 = Math.min(ax, ax + dx) - 0.01, x1 = Math.max(ax, ax + dx) + 0.01, y0 = Math.min(ay, ay + dy) - 0.01, y1 = Math.max(ay, ay + dy) + 0.01, z0 = Math.min(az, az + dz) - 0.01, z1 = Math.max(az, az + dz) + 0.01;
        for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++) for (let gy = Math.floor(y0 / CELL); gy <= Math.floor(y1 / CELL); gy++) for (let gz = Math.floor(z0 / CELL); gz <= Math.floor(z1 / CELL); gz++) {
          for (const v of grid.get(gx + ',' + gy + ',' + gz) || []) {
            if (v === a || v === b) continue;
            const wx = P[v * 3] - ax, wy = P[v * 3 + 1] - ay, wz = P[v * 3 + 2] - az, s = (wx * dx + wy * dy + wz * dz) / L2;
            if (s <= 1e-4 || s >= 1 - 1e-4) continue;
            const ex = wx - s * dx, ey = wy - s * dy, ez = wz - s * dz;
            if (ex * ex + ey * ey + ez * ez < 1e-6) cand.push([s, v]);
          }
        }
        if (!cand.length) continue;
        cand.sort((p, q) => p[0] - q[0]);
        const chain = [a, ...cand.map(x => x[1]), b];
        for (let i = 0; i < chain.length - 1; i++) out.push(chain[i], chain[i + 1], c);
        done = true; changed = true;
      }
      if (!done) out.push(tri[0], tri[1], tri[2]);
    }
    T = out;
    if (!changed) break;
  }
  return Uint32Array.from(T);
}
function repairForExport(P, I) {
  const key = (a, b) => a < b ? a * 4294967296 + b : b * 4294967296 + a;
  let tris = [];
  for (let t = 0; t < I.length; t += 3) if (I[t] !== I[t + 1] && I[t + 1] !== I[t + 2] && I[t] !== I[t + 2]) tris.push(I[t], I[t + 1], I[t + 2]);
  tris = Array.from(fixTJunctions(P, tris));
  const nT = tris.length / 3, use = new Map();
  for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) { const e = key(tris[t * 3 + k], tris[t * 3 + (k + 1) % 3]); use.set(e, (use.get(e) || 0) + 1); }
  let bad = 0; for (const n of use.values()) if (n > 2) bad++;
  if (!bad) return { P, I: Uint32Array.from(tris), bad: 0 };
  const parent = Int32Array.from({ length: nT }, (_, i) => i), find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const first = new Map();
  for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) {
    const e = key(tris[t * 3 + k], tris[t * 3 + (k + 1) % 3]);
    if (use.get(e) !== 2) continue;
    const o = first.get(e);
    if (o === undefined) first.set(e, t); else parent[find(t)] = find(o);
  }
  const vmap = new Map(), outP = [], outI = new Uint32Array(tris.length);
  for (let t = 0; t < nT; t++) {
    const c = find(t);
    for (let k = 0; k < 3; k++) {
      const v = tris[t * 3 + k], kk = c * 4294967296 + v;
      let id = vmap.get(kk);
      if (id === undefined) { id = outP.length / 3; vmap.set(kk, id); outP.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); }
      outI[t * 3 + k] = id;
    }
  }
  return { P: Float32Array.from(outP), I: outI, bad };
}
/* impostazioni di stampa (Bambu Studio / Orca): si leggono dal 3MF importato e si rimettono nel 3MF esportato */
let printCfg = null, keepPrint = true;
try { const s = JSON.parse(localStorage.getItem('forma.print')); if (s && s.cfg) printCfg = s; keepPrint = localStorage.getItem('forma.keepPrint') !== '0'; } catch (e) {}
function printSummary(cfg) {
  try {
    const d = JSON.parse(cfg), one = v => Array.isArray(v) ? v[0] : v;
    const pa = (d.printable_area || []).map(s => String(s).split('x').map(Number)).filter(a => a.length === 2 && isFinite(a[0] + a[1]));
    const cx = pa.length ? (Math.min(...pa.map(a => a[0])) + Math.max(...pa.map(a => a[0]))) / 2 : null;
    const cy = pa.length ? (Math.min(...pa.map(a => a[1])) + Math.max(...pa.map(a => a[1]))) / 2 : null;
    return { printer: d.printer_settings_id || d.printer_model || '', process: d.print_settings_id || '', filament: one(d.filament_settings_id) || '', center: cx === null ? null : [cx, cy] };
  } catch (e) { return null; }
}
function savePrintCfg() { try { printCfg ? localStorage.setItem('forma.print', JSON.stringify(printCfg)) : localStorage.removeItem('forma.print'); } catch (e) {} }
function build3MF(list, opt = {}) {
  const pr = opt.print || null, off = pr && pr.sum && pr.sum.center ? pr.sum.center : [0, 0];
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
    const W = new Float32Array(pos.count * 3);
    for (let k = 0; k < pos.count; k++) { v.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld); W.set([+(v.x + off[0]).toFixed(4), +(v.y + off[1]).toFixed(4), +v.z.toFixed(4)], k * 3); }
    const I0 = idx ? Uint32Array.from(idx.array) : Uint32Array.from({ length: pos.count }, (_, k) => k);
    const R = repairForExport(W, I0);
    { let vol = 0; for (let k = 0; k < R.I.length; k += 3) { const a = R.I[k] * 3, b = R.I[k + 1] * 3, c = R.I[k + 2] * 3, P = R.P; vol += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6; } if (Math.abs(vol) < 0.01 && list.length > 1) { if (opt.stat) opt.stat.dropped++; g.dispose(); return; } }
    let vs = '', ts = '';
    for (let k = 0; k < R.P.length; k += 3) vs += `<vertex x="${R.P[k]}" y="${R.P[k + 1]}" z="${R.P[k + 2]}"/>`;
    for (let k = 0; k < R.I.length; k += 3) ts += `<triangle v1="${R.I[k]}" v2="${R.I[k + 1]}" v3="${R.I[k + 2]}"/>`;
    g.dispose();
    const id = i + 1;
    const ci = m.userData.color ? cols.indexOf(m.userData.color) : -1;
    objs += `<object id="${id}" name="${esc(m.userData.name)}" type="model"${ci >= 0 ? ` pid="${list.length + 1}" pindex="${ci}"` : ''}><mesh><vertices>${vs}</vertices><triangles>${ts}</triangles></mesh></object>`;
    items += `<item objectid="${id}"/>`;
  });
  const model = `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"${pr ? ' xmlns:BambuStudio="http://schemas.bambulab.com/package/2021"' : ''}><metadata name="Application">${pr ? esc(pr.app || 'BambuStudio-02.00.00.00') : 'Filo'}</metadata>${pr ? '<metadata name="BambuStudio:3mfVersion">1</metadata><metadata name="ModifiedBy">Filo</metadata>' : ''}<resources>${mats}${objs}</resources><build>${items}</build></model>`;
  const types = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';
  const files = { '[Content_Types].xml': strToU8(types), '_rels/.rels': strToU8(rels), '3D/3dmodel.model': strToU8(model) };
  if (pr) files['Metadata/project_settings.config'] = strToU8(pr.cfg);
  return zipSync(files);
}
function export3MF(nameArg) {
  const list = exportList();
  if (!list.length) return toast('Niente da esportare: aggiungi almeno un solido');
  const usePrint = printCfg && keepPrint, stat = { dropped: 0 };
  const data = build3MF(list, { print: usePrint ? printCfg : null, stat }), name = nameArg || exportName(list);
  download(data, 'model/3mf', `${name}.3mf`);
  toast(`Esportato ${name}.3mf (${list.length} ${list.length === 1 ? 'pezzo' : 'pezzi'})${usePrint ? ' con le impostazioni di stampa' : ''}${stat.dropped ? `, senza ${stat.dropped} frammenti vuoti` : ''}`);
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
/* Scatolina: solo valori possibili (pareti a passi di 0,4 mm, angoli entro la metà del lato) e anteprima dal vivo */
const bxF = $('#box-form'), bxIn = n => bxF.elements[n];
const BXLIP = 3, BXLID = 2;
function bxLimits(v) {
  const m = Math.min(v.w, v.d);
  const tMax = Math.max(0.8, Math.floor(Math.min(4, (m / 2 - 3)) / 0.4 + 1e-9) * 0.4);
  return { tMax, rMax: Math.floor(m / 2), hMin: Math.ceil(v.t + BXLIP + 3) };
}
function bxFix(final) {
  const num = n => parseFloat(bxIn(n).value);
  const v = { w: num('w'), d: num('d'), h: num('h'), t: num('t'), g: num('g'), r: num('r') };
  const cl = (x, a, b, d) => Number.isFinite(x) ? Math.min(b, Math.max(a, x)) : d;
  const set = (n, x) => { const s = String(+x.toFixed(2)); if (bxIn(n).value !== s) bxIn(n).value = s; };
  if (final) {
    v.w = Math.round(cl(v.w, 20, 300, 60)); v.d = Math.round(cl(v.d, 20, 300, 40));
    v.t = Math.round(cl(v.t, 0.8, 4, 2) / 0.4) * 0.4; v.g = Math.round(cl(v.g, 0.1, 0.6, 0.3) / 0.05) * 0.05;
    const L = bxLimits({ ...v, t: Math.min(v.t, bxLimits({ ...v, t: 0.8 }).tMax) });
    v.t = Math.min(v.t, L.tMax);
    const L2 = bxLimits(v);
    v.r = Math.round(cl(v.r, 0, L2.rMax, 4)); v.h = Math.round(cl(v.h, L2.hMin, 200, 30));
    for (const k of ['w', 'd', 'h', 't', 'g', 'r']) set(k, v[k]);
  }
  const L = bxLimits(v);
  bxIn('t').max = L.tMax; bxIn('r').max = L.rMax; bxIn('h').min = L.hMin; bxIn('w').min = 20; bxIn('d').min = 20;
  return v;
}
function bxPreview() {
  const v = bxFix(false), ok = [v.w, v.d, v.h, v.t, v.g, v.r].every(Number.isFinite);
  if (!ok) return;
  const S = 150, rr = Math.min(v.r, Math.min(v.w, v.d) / 2), s1 = Math.min(S / v.w, 96 / v.d);
  const W = v.w * s1, D = v.d * s1, T = v.t * s1, G = (v.t + v.g) * s1, R = rr * s1, ri = Math.max(rr - v.t, 0) * s1, rl = Math.max(rr - v.t - v.g, 0) * s1;
  const x0 = (S - W) / 2 + 4, y0 = (104 - D) / 2;
  const top = `<svg viewBox="0 0 ${S + 8} 104" aria-hidden="true"><rect x="${x0}" y="${y0}" width="${W}" height="${D}" rx="${R}" class="o"/><rect x="${x0 + T}" y="${y0 + T}" width="${Math.max(W - 2 * T, 0)}" height="${Math.max(D - 2 * T, 0)}" rx="${ri}" class="i"/><rect x="${x0 + G}" y="${y0 + G}" width="${Math.max(W - 2 * G, 0)}" height="${Math.max(D - 2 * G, 0)}" rx="${rl}" class="l"/></svg>`;
  const lift = 7, H = v.h + lift + BXLID + BXLIP, s2 = Math.min(S / v.w, 96 / H), w = v.w * s2, t = v.t * s2, g = v.g * s2, ox = (S - w) / 2 + 4, bot = 100;
  const hh = v.h * s2, bodyP = `M${ox} ${bot}h${w}v${-hh}h${-t}v${hh - t}h${-(w - 2 * t)}v${-(hh - t)}h${-t}z`;
  const lt = BXLID * s2, ll = BXLIP * s2, ly = bot - hh - lift * s2, lx = ox + t + g, lw = w - 2 * (t + g);
  const lidP = `M${ox} ${ly - lt}h${w}v${lt}h${-(t + g)}v${ll}h${-lw}v${-ll}h${-(t + g)}z`;
  const side = `<svg viewBox="0 0 ${S + 8} 104" aria-hidden="true"><path d="${bodyP}" class="o"/><path d="${lidP}" class="l2"/></svg>`;
  $('#bx-prev').innerHTML = `<figure>${top}<figcaption>Dall'alto</figcaption></figure><figure>${side}<figcaption>Sezione: corpo e coperchio</figcaption></figure>`;
}
bxF.addEventListener('input', bxPreview);
bxF.addEventListener('change', () => { bxFix(true); bxPreview(); });
{ const _show = dlg.showModal.bind(dlg); dlg.showModal = () => { _show(); bxFix(true); bxPreview(); }; }
$('#box-cancel').addEventListener('click', () => dlg.close());
$('#box-form').addEventListener('submit', () => {
  bxFix(true);
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
  intersect: '<rect x="3.5" y="3.5" width="11" height="11" rx="2.5"/><rect x="9.5" y="9.5" width="11" height="11" rx="2.5"/><path d="M12 9.5H14.5V12A2.5 2.5 0 0 1 12 14.5H9.5V12A2.5 2.5 0 0 1 12 9.5Z" fill="currentColor" stroke="none"/>',
  group: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><rect x="8" y="8" width="8" height="8" rx="1.5"/>',
  dup: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>',
  dist: '<path d="M3.5 16.5l13-13 4 4-13 13z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  edge: '<path d="M4 20V9a5 5 0 0 1 5-5h11"/><path d="M4 20h16" opacity=".35"/><path d="M20 4v16" opacity=".35"/>',
  face: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" opacity=".4"/><path d="M12 12l8-4.5v9L12 21z" fill="currentColor" stroke="none" opacity=".4"/>',
  lasso: '<ellipse cx="12" cy="9" rx="8" ry="5"/><path d="M9 13.6c-1.2 1.9-.4 3.6 1.2 4.5 1.4.8 1.2 2.1-.4 2.6"/>',
  stretch: '<rect x="4" y="4" width="9" height="6"/><rect x="4" y="14" width="9" height="6"/><path d="M17 6v12M14.5 8.5L17 6l2.5 2.5M14.5 15.5L17 18l2.5-2.5"/>',
  cut: '<rect x="5" y="4" width="14" height="6"/><rect x="5" y="14" width="14" height="6"/><path d="M2.5 12h19" stroke-dasharray="2.5 2"/>',
  marquee: '<rect x="4" y="5" width="16" height="14" stroke-dasharray="3 2.5"/><path d="M10 10l5 2.5-2 .8 1.4 2.6-1.2.6-1.4-2.6-1.8 1.4z" fill="currentColor" stroke="none"/>',
  ruler: '<rect x="3" y="8" width="18" height="8" rx="1.5"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/>',
  model: '<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M3 7h18v4H3zM12 7v13"/>',
};
const TOOLS = [
  ['Strumenti', [
    { id: 'move', icon: 'move', name: 'Sposta', key: 'V', desc: 'Seleziona e muovi gli oggetti', run: () => setTool('move') },
    { id: 'marquee', grp: 'sel', icon: 'marquee', name: 'Riquadro', key: 'Q', desc: 'Seleziona trascinando un riquadro', run: () => setTool('marquee') },
    { id: 'lasso', grp: 'sel', icon: 'lasso', name: 'Lazo', key: 'W', desc: 'Seleziona disegnando una linea libera', run: () => setTool('lasso') },
    { id: 'rotate', icon: 'rotate', name: 'Ruota', key: 'R', desc: 'Ruota con scatto a 15°', run: () => setTool('rotate') },
    { id: 'face', icon: 'face', name: 'Lato', key: 'L', desc: 'Spingi o tira un lato piatto', run: () => setTool('face') },
    { id: 'edge', icon: 'edge', name: 'Spigolo', key: 'E', desc: 'Arrotonda o smussa uno spigolo', run: () => setTool('edge') },
    { id: 'cut', grp: 'plane', icon: 'cut', name: 'Taglia', key: 'K', desc: 'Taglia un oggetto con un piano', run: () => setTool('cut') },
    { id: 'stretch', grp: 'plane', icon: 'stretch', name: 'Allunga', key: 'U', desc: 'Allunga o accorcia una parte, da un piano in poi', run: () => setTool('stretch') },
    { id: 'ruler', icon: 'dist', name: 'Metro', key: 'D', desc: 'Misura tra due punti o lati', run: () => setTool('ruler') },
  ]],
  ['Forme', [
    { icon: 'box', name: 'Scatola', key: 'B', desc: 'Aggiunge un blocco', run: () => createObject('box') },
    { icon: 'cylinder', name: 'Cilindro', key: 'C', desc: 'Aggiunge un cilindro', run: () => createObject('cylinder') },
    { icon: 'sphere', name: 'Sfera', key: 'S', desc: 'Aggiunge una sfera', run: () => createObject('sphere') },
    { icon: 'cone', name: 'Cono', key: 'O', desc: 'Cono o tronco di cono', run: () => createObject('cone') },
    { icon: 'prism', name: 'Prisma', key: 'P', desc: 'Esagono, ottagono e altri poligoni', run: () => createObject('prism') },
    { icon: 'torus', name: 'Toro', key: '', desc: 'Anello per guarnizioni e maniglie', run: () => createObject('torus') },
    { icon: 'text', name: 'Testo', key: 'T', desc: 'Scrive testo 3D con font a scelta', run: () => addText() },
  ]],
  ['Modifica', [
    { icon: 'hole', name: 'Foro / Solido', key: 'X', desc: 'Trasforma in foro per scavare', run: toggleHole },
    { id: 'combine', grp: 'comb', icon: 'combine', name: 'Combina', key: '⌘E', desc: 'Unisce i solidi, sottrae i fori', run: () => combine() },
    { id: 'intersect', grp: 'comb', icon: 'intersect', name: 'Interseca', key: '⇧⌘E', desc: 'Tiene solo la parte in comune tra i solidi', run: () => intersect() },
    { icon: 'group', name: 'Raggruppa', key: '⌘G', desc: 'Muove più oggetti come uno', run: groupSelection },
    { icon: 'dup', name: 'Duplica', key: '⌘D', desc: 'Copia l’oggetto selezionato', run: () => duplicateSelection(true) },
    { icon: 'trash', name: 'Elimina', key: '⌫', desc: 'Rimuove la selezione', run: deleteSelection },
  ]],
  ['Modelli', [
    { icon: 'model', name: 'Scatolina con coperchio', key: '', desc: 'Corpo e coperchio su misura', run: () => dlg.showModal() },
  ]],
];
const toolEls = {};
/* Strumenti in seconda funzione (come Photoshop): un solo pulsante in barra, le varianti si aprono di lato.
   sticky = il pulsante mostra l'ultima variante usata; Combina/Interseca no, il pulsante resta sempre Combina. */
const TGROUPS = {
  sel: { items: ['marquee', 'lasso'], sticky: true },
  plane: { items: ['cut', 'stretch'], sticky: true },
  comb: { items: ['combine', 'intersect'], sticky: false },
};
const TOOL_AT = {};                                             // id → [sezione, posizione] dentro TOOLS
TOOLS.forEach(([, items], si) => items.forEach((t, ii) => { if (t.id) TOOL_AT[t.id] = [si, ii]; }));
const toolOf = id => TOOLS[TOOL_AT[id][0]][1][TOOL_AT[id][1]];
const groupOf = id => { const t = id && TOOL_AT[id] && toolOf(id); return t && t.grp || null; };
const grpCur = {};                                              // gruppo → id della variante mostrata
Object.entries(TGROUPS).forEach(([g, d]) => { grpCur[g] = d.items[0]; });
try { const sv = JSON.parse(localStorage.getItem('forma.grp') || '{}'); Object.entries(sv).forEach(([g, id]) => { if (TGROUPS[g] && TGROUPS[g].sticky && TGROUPS[g].items.includes(id)) grpCur[g] = id; }); } catch (_) {}
const toolInner = (t, grp) => `<span class="ico"><svg viewBox="0 0 24 24">${I[t.icon]}</svg>${grp ? '<i class="gtri"></i>' : ''}</span><span class="t"><b>${t.name}</b><small>${t.desc}</small></span>${t.key ? `<kbd>${t.key}</kbd>` : ''}`;
$('#tools').innerHTML = TOOLS.map(([title, items], si) =>
  `<h3>[${si + 1}] ${title}</h3>` + items.map((t, ii) => {
    if (t.grp) {
      if (TGROUPS[t.grp].items[0] !== t.id) return '';            // le altre varianti vivono solo nel menu laterale
      const c = toolOf(grpCur[t.grp]), [cs, ci] = TOOL_AT[c.id];
      return `<button class="tool grp" data-g="${t.grp}" data-s="${cs}" data-i="${ci}" aria-label="${c.name}" aria-haspopup="menu" aria-expanded="false">${toolInner(c, true)}</button>`;
    }
    return `<button class="tool" data-s="${si}" data-i="${ii}" aria-label="${t.name}">${toolInner(t)}</button>`;
  }).join('')).join('');
function paintGroup(g) {
  const b = $(`#tools .grp[data-g="${g}"]`); if (!b) return;
  const c = toolOf(grpCur[g]), [cs, ci] = TOOL_AT[c.id];
  b.dataset.s = cs; b.dataset.i = ci; b.setAttribute('aria-label', c.name); b.innerHTML = toolInner(c, true);
}
function showMember(id) {                                       // uno strumento del gruppo è stato scelto: il pulsante lo mostra da ora in poi
  const g = groupOf(id); if (!g || !TGROUPS[g].sticky || grpCur[g] === id) return;
  grpCur[g] = id; paintGroup(g);
  try { const sv = {}; Object.entries(TGROUPS).forEach(([k, d]) => { if (d.sticky) sv[k] = grpCur[k]; }); localStorage.setItem('forma.grp', JSON.stringify(sv)); } catch (_) {}
}
Object.keys(TGROUPS).forEach(g => TGROUPS[g].items.forEach(id => { toolEls[id] = $(`#tools .grp[data-g="${g}"]`); }));
document.querySelectorAll('#tools .tool:not(.grp)').forEach(b => { const t = TOOLS[b.dataset.s][1][b.dataset.i]; if (t.id) toolEls[t.id] = b; });

/* menu laterale delle varianti */
const flyEl = document.createElement('div');
flyEl.id = 'flyout'; flyEl.className = 'panel hidden'; flyEl.setAttribute('role', 'menu');
document.body.appendChild(flyEl);
let flyGrp = null;
const flyOpen = () => !flyEl.classList.contains('hidden');
function closeFlyout(back = false) {
  if (!flyOpen()) return false;
  flyEl.classList.add('hidden'); flyEl.innerHTML = '';
  const b = flyGrp && $(`#tools .grp[data-g="${flyGrp}"]`); if (b) b.setAttribute('aria-expanded', 'false');
  flyGrp = null; if (back) canvas.focus();
  return true;
}
function openFlyout(b, focusFirst = false) {
  const g = b.dataset.g; if (!g) return;
  if (flyOpen() && flyGrp === g) return;
  closeFlyout(); hideTip();
  flyGrp = g;
  flyEl.innerHTML = TGROUPS[g].items.map(id => {
    const t = toolOf(id), [s, i] = TOOL_AT[id];
    return `<button class="tool fly${id === state.tool ? ' active' : ''}" role="menuitem" data-s="${s}" data-i="${i}">${toolInner(t)}</button>`;
  }).join('');
  b.setAttribute('aria-expanded', 'true');
  const sr = sideEl.getBoundingClientRect(), r = b.getBoundingClientRect();
  flyEl.classList.remove('hidden');
  const h = flyEl.offsetHeight;
  flyEl.style.left = sr.right + 8 + 'px';
  flyEl.style.top = Math.max(12, Math.min(r.top - 6, window.innerHeight - h - 12)) + 'px';
  if (focusFirst) flyEl.querySelector('.tool').focus();
}
flyEl.addEventListener('click', e => {
  const b = e.target.closest('.tool'); if (!b) return;
  closeFlyout(true);
  TOOLS[b.dataset.s][1][b.dataset.i].run();
});
flyEl.addEventListener('keydown', e => {
  const items = [...flyEl.querySelectorAll('.tool')], i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); const g = flyGrp; closeFlyout(); const gb = $(`#tools .grp[data-g="${g}"]`); if (gb) gb.focus(); }
});
document.addEventListener('pointerdown', e => { if (flyOpen() && !e.target.closest('#flyout, #tools .grp')) closeFlyout(); });
window.addEventListener('resize', () => closeFlyout());
$('#tools').addEventListener('scroll', () => closeFlyout());
let lpTimer = null, lpFired = false;
$('#tools').addEventListener('pointerdown', e => {
  const b = e.target.closest('.grp'); lpFired = false; clearTimeout(lpTimer);
  if (!b || e.button !== 0 || e.target.closest('.gtri')) return;
  lpTimer = setTimeout(() => { lpFired = true; openFlyout(b); }, 380);       // pressione lunga: apre le varianti
});
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => $('#tools').addEventListener(ev, () => clearTimeout(lpTimer)));
$('#tools').addEventListener('contextmenu', e => { const b = e.target.closest('.grp'); if (b) { e.preventDefault(); openFlyout(b); } });
$('#tools').addEventListener('keydown', e => {
  const b = e.target.closest && e.target.closest('.grp');
  if (b && e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); openFlyout(b, true); }
});
$('#tools').addEventListener('click', e => {
  const b = e.target.closest('.tool');
  if (!b) return;
  if (lpFired) { lpFired = false; return; }
  const was = flyOpen() ? flyGrp : null; closeFlyout();
  if (b.classList.contains('grp') && e.target.closest('.gtri')) { if (was !== b.dataset.g) openFlyout(b); return; }
  TOOLS[b.dataset.s][1][b.dataset.i].run();
  canvas.focus();
});
/* ---------------------------------------------------------------- menu del tasto destro
   Compare con un clic destro che non trascina (trascinando si orbita). Breve: solo le azioni più frequenti, ognuna con la sua scorciatoia. */
const ctxEl = document.createElement('div');
ctxEl.id = 'ctx'; ctxEl.className = 'panel hidden'; ctxEl.setAttribute('role', 'menu');
document.body.appendChild(ctxEl);
let ctxActs = [];
const ctxOpen = () => !ctxEl.classList.contains('hidden');
function closeCtx(back = false) {
  if (!ctxOpen()) return false;
  ctxEl.classList.add('hidden'); ctxEl.innerHTML = ''; ctxActs = [];
  if (back) canvas.focus();
  return true;
}
/* Appoggia sul piatto: raddrizza la selezione (un blocco unico) sul lato piatto stabile che richiede meno rotazione, poi la porta a Z = 0.
   Lati piatti = facce del guscio convesso su cui il pezzo sta in piedi (il baricentro cade dentro la faccia). Senza lati adatti (forme tonde) si limita ad appoggiare. */
function plateCandidates(list) {
  const V = [], seen = new Set(), tri = [];
  const v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let vol = 0; const cm = new THREE.Vector3();
  for (const m of list) {
    m.updateMatrixWorld(true);
    const pos = m.geometry.attributes.position, idx = m.geometry.index, n = idx ? idx.count : pos.count;
    const W = i => v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      W(i); const k = Math.round(v.x * 100) + ',' + Math.round(v.y * 100) + ',' + Math.round(v.z * 100);
      if (!seen.has(k)) { seen.add(k); V.push(v.clone()); }
    }
    for (let t = 0; t < n; t += 3) {                      // volume e baricentro dai tetraedri con segno
      const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
      a.copy(W(i0)); b.copy(W(i1)); c.copy(W(i2));
      const d = a.dot(b.clone().cross(c)) / 6; vol += d; cm.addScaledVector(a.clone().add(b).add(c), d / 4);
    }
  }
  if (V.length < 4) return null;
  const centroid = Math.abs(vol) > 1e-6 ? cm.divideScalar(vol) : V.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(V.length);
  let hull; try { hull = new ConvexHull().setFromPoints(V); } catch (e) { return null; }
  const cl = [];
  for (const f of hull.faces) {
    const pts = []; let e = f.edge; do { pts.push(e.head().point); e = e.next; } while (e !== f.edge);
    let area = 0; for (let i = 1; i < pts.length - 1; i++) area += new THREE.Vector3().subVectors(pts[i], pts[0]).cross(new THREE.Vector3().subVectors(pts[i + 1], pts[0])).length() / 2;
    const n = f.normal.clone();
    const hit = cl.find(q => q.n.dot(n) > Math.cos(2 * D2R));      // facce quasi parallele: stesso lato
    if (hit) { hit.area += area; pts.forEach(p => hit.pts.push(p)); } else cl.push({ n, area, pts: [...pts] });
  }
  return { cl, centroid };
}
function plateStable(q, centroid) {                       // il baricentro, proiettato sul piano della faccia, cade dentro il suo contorno
  const n = q.n, u = new THREE.Vector3().crossVectors(n, Math.abs(n.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize(), w = new THREE.Vector3().crossVectors(n, u);
  const P = q.pts.map(p => [p.dot(u), p.dot(w)]), o = [centroid.dot(u), centroid.dot(w)];
  P.sort((p, r) => p[0] - r[0] || p[1] - r[1]);           // guscio 2D (catena monotona)
  const cross = (O, A, B) => (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.slice().reverse()) { while (up.length > 1 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const poly = lo.slice(0, -1).concat(up.slice(0, -1));
  if (poly.length < 3) return false;
  return poly.every((p, i) => cross(p, poly[(i + 1) % poly.length], o) >= -0.25);   // 0,25 mm di tolleranza
}
function layOnPlateNow() {
  if (!selection.length) return;
  const info = plateCandidates(selection);
  let rot = 0;
  if (info) {
    const big = Math.max(...info.cl.map(q => q.area));
    const ok = info.cl.filter(q => q.area >= 1 && q.area >= big * 0.02 && plateStable(q, info.centroid));
    const down = new THREE.Vector3(0, 0, -1);
    ok.sort((p, r) => r.n.dot(down) - p.n.dot(down));      // la faccia più vicina al basso: rotazione minima
    const best = ok[0];
    if (best) {
      const ang = Math.acos(Math.min(1, best.n.dot(down))) / D2R;
      if (ang > 0.01) {
        const R = new THREE.Quaternion().setFromUnitVectors(best.n, down), box = selBox(), ctr = box.getCenter(new THREE.Vector3());
        selection.forEach(m => { m.position.sub(ctr).applyQuaternion(R).add(ctr); m.quaternion.premultiply(R); m.updateMatrixWorld(true); });
        rot = ang;
      }
    } else rot = -1;
  }
  const dz = -selBox().min.z;
  if (rot <= 0 && Math.abs(dz) < 1e-6) return toast(rot < 0 ? 'Nessun lato piatto stabile: è già appoggiato al piatto' : 'È già appoggiato al piatto');
  selection.forEach(m => { m.position.z += dz; m.updateMatrixWorld(true); });
  touch(); syncPanel(); updateHandles(); commit();
  if (rot > 0) toast(`Raddrizzato di ${(rot < 10 ? Math.round(rot * 10) / 10 : Math.round(rot)).toString().replace('.', ',')}° e appoggiato sul piatto`);
  else if (rot < 0) toast('Nessun lato piatto stabile: l’ho solo appoggiato al piatto');
}
async function layOnPlate() {
  if (!selection.length) return;
  return trisOf(selection) > 60000 ? busyRun('Cerco il lato su cui appoggiare…', layOnPlateNow) : layOnPlateNow();
}
function flagSelection(key) {                        // blocca o nasconde la selezione (come i pulsanti dei Livelli: non entra nella cronologia)
  const list = selection.slice();
  if (!list.length) return;
  list.forEach(o => { o.userData[key] = true; o.visible = !o.userData.hidden; });
  setSelection([]);
  touch(); dirty = true; commit();
  toast(key === 'locked' ? 'Bloccato: lo sblocchi dai Livelli (F7)' : 'Nascosto: lo ritrovi nei Livelli (F7)');
}
function ctxObjectItems() {
  const S = selection, multi = S.length > 1, grouped = S.some(m => m.userData.gid != null);
  const items = [
    { t: 'Duplica', k: '⌘D', f: () => duplicateSelection(true) },
    { t: 'Copia', k: '⌘C', f: () => copySelection() },
    'sep',
    { t: S.every(m => m.userData.hole) ? 'Trasforma in solido' : 'Trasforma in foro', k: 'X', f: toggleHole },
  ];
  if (multi) items.push({ t: 'Combina', k: '⌘E', f: () => combine() }, { t: 'Interseca', k: '⇧⌘E', f: () => intersect() });
  if (grouped) items.push({ t: 'Separa gruppo', k: '⇧⌘G', f: ungroupSelection });
  else if (multi) items.push({ t: 'Raggruppa', k: '⌘G', f: groupSelection });
  items.push('sep', { t: 'Appoggia sul piatto', f: () => layOnPlate() }, { t: 'Blocca', f: () => flagSelection('locked') }, { t: 'Nascondi', f: () => flagSelection('hidden') },
    'sep', { t: 'Elimina', k: '⌫', f: deleteSelection });
  return items;
}
const ctxEmptyItems = () => [
  { t: 'Incolla', k: '⌘V', f: () => pasteClip(), off: !(clip && clip.length) },
  { t: 'Seleziona tutto', k: '⌘A', f: () => setSelection([...objects]), off: !objects.length },
  'sep',
  { t: 'Inquadra tutto', k: '⌘0', f: fitView },
  { t: 'Raggi X', k: 'Z', f: () => setXray(), chk: true, on: state.xray },
  { t: 'Misure', k: 'M', f: () => setDims(), chk: true, on: state.dims },
];
function openCtx(e) {
  closeFlyout(); hideTip();
  const hit = pickObject(e);
  if (hit && !selection.includes(hit)) setSelection(withGroups([hit]));       // come un clic: se l'oggetto non è già selezionato, si seleziona
  const items = hit && selection.length ? ctxObjectItems() : ctxEmptyItems();
  ctxActs = items.filter(i => i !== 'sep');
  let n = 0;
  ctxEl.classList.toggle('has-chk', items.some(i => i.chk));
  ctxEl.innerHTML = items.map(i => i === 'sep' ? '<hr>' :
    `<button role="menuitem" data-n="${n++}"${i.off ? ' disabled' : ''}${i.on ? ' class="on"' : ''}><span>${i.t}</span>${i.k ? `<kbd>${i.k}</kbd>` : ''}</button>`).join('');
  ctxEl.classList.remove('hidden');
  const w = ctxEl.offsetWidth, h = ctxEl.offsetHeight;
  const x = e.clientX + 4 + w > window.innerWidth - 12 ? e.clientX - 4 - w : e.clientX + 4;
  const y = e.clientY + 4 + h > window.innerHeight - 12 ? e.clientY - 4 - h : e.clientY + 4;
  ctxEl.style.left = Math.max(12, x) + 'px';
  ctxEl.style.top = Math.max(12, y) + 'px';
}
ctxEl.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  const a = ctxActs[+b.dataset.n];
  closeCtx(true);
  if (a) a.f();
});
document.addEventListener('pointerdown', e => { if (ctxOpen() && !e.target.closest('#ctx')) closeCtx(); }, true);
['resize', 'blur'].forEach(ev => window.addEventListener(ev, () => closeCtx()));
window.addEventListener('wheel', () => closeCtx(), { passive: true, capture: true });
window.addEventListener('keydown', e => {                // frecce: si scorrono le voci; ogni altro tasto chiude (Esc lo gestisce il passo dei menu)
  if (!ctxOpen() || e.key === 'Escape' || ['Shift', 'Control', 'Meta', 'Alt'].includes(e.key)) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); e.stopPropagation();
    const bs = [...ctxEl.querySelectorAll('button:not([disabled])')], i = bs.indexOf(document.activeElement), down = e.key === 'ArrowDown';
    if (bs.length) bs[i < 0 ? (down ? 0 : bs.length - 1) : (i + (down ? 1 : bs.length - 1)) % bs.length].focus();
    return;
  }
  if (e.key === 'Enter' && ctxEl.contains(document.activeElement)) return;      // il pulsante a fuoco fa il suo clic
  closeCtx();
}, true);
function setTool(t) {
  noStash = true; try { setToolInner(t); } finally { noStash = false; }
}
function setToolInner(t) {
  state.tool = t;
  updateRotGizmo();
  if (t !== 'face') { clearFace(false); hideHover(); }
  if (t !== 'edge') clearEdges();
  if (t === 'ruler' || state.tool !== 'ruler') clearRuler();
  syncPanel();
  showMember(t);
  const actEl = toolEls[t];
  new Set(Object.values(toolEls)).forEach(el => el.classList.toggle('active', el === actEl));
  updateCursor(false);
  updateHandles();
  updateFaceHandle();
  cutToolChanged();
}

/* ------------------------------------------- barra ridotta e suggerimenti */
const sideEl = $('#side'), tipEl = $('#tip');
function setMini(on, save = true) {
  closeFlyout();
  sideEl.classList.toggle('mini', on);
  if (!on && save) { sideEl.classList.add('opening'); clearTimeout(setMini.t); setMini.t = setTimeout(() => sideEl.classList.remove('opening'), 320); }
  if (on && save) { sideEl.classList.add('closing'); clearTimeout(setMini.t2); setMini.t2 = setTimeout(() => sideEl.classList.remove('closing'), 320); }
  document.documentElement.style.setProperty('--sw', on ? '72px' : '312px');
  hideTip();
  document.querySelectorAll('#tools .tool').forEach(b => {      // barra stretta: c'è già il nostro pop up, quindi niente tooltip del browser (si sovrapporrebbero)
    if (on) { if (b.hasAttribute('title')) { b.dataset.title = b.getAttribute('title'); b.removeAttribute('title'); } b.setAttribute('aria-label', b.querySelector('b')?.textContent || ''); }
    else if (b.dataset.title) { b.setAttribute('title', b.dataset.title); delete b.dataset.title; }
  });
  if (save) { try { localStorage.setItem('forma.mini', on ? '1' : '0'); } catch (_) {} }
}
$('#side-toggle').addEventListener('click', () => { setMini(!sideEl.classList.contains('mini')); canvas.focus(); });
let tipTimer = null, tipOn = false;
function hideTip() { clearTimeout(tipTimer); tipOn = false; tipEl.classList.remove('show'); }
function showTip(b) {
  const t = TOOLS[b.dataset.s][1][b.dataset.i];
  tipEl.innerHTML = `<b>${t.name}</b>${t.key ? `<kbd>${t.key}</kbd>` : ''}<small>${t.desc}</small>${b.classList.contains('grp') ? '<small class="alt">Tieni premuto per altre varianti</small>' : ''}`;
  const r = b.getBoundingClientRect();
  tipEl.classList.remove('up');
  tipEl.style.left = r.right + 16 + 'px';
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

/* tooltip del browser sostituito dal nostro pop up (stesso stile, stessa attesa) */
let ttTimer = null;
function ttHide() { clearTimeout(ttTimer); if (tipEl.classList.contains('tt')) { tipEl.classList.remove('tt', 'help', 'left', 'up'); tipEl.style.maxWidth = ''; hideTip(); } }
document.addEventListener('pointerover', e => {
  const el = e.target.closest && e.target.closest('[title]');
  if (!el || el.closest('#bar') || el.closest('[data-help]') && el.closest('[data-help]') !== el) { return; }
  if (el.hasAttribute('title') && el.title) { el.dataset.tt = el.title; el.removeAttribute('title'); }
}, true);
document.addEventListener('pointerover', e => {
  const el = e.target.closest && e.target.closest('[data-tt]');
  clearTimeout(ttTimer);
  if (!el || el.closest('[data-help]')) return;
  ttTimer = setTimeout(() => {
    const r = el.getBoundingClientRect();
    tipEl.innerHTML = `<small class="hl one">${esc(tr(el.dataset.tt))}</small>`;
    tipEl.classList.add('help', 'tt'); tipEl.classList.remove('left', 'up'); tipEl.style.maxWidth = '260px';
    const below = r.top < 120, x = Math.min(Math.max(r.left + r.width / 2, 130), window.innerWidth - 130);
    tipEl.style.left = x + 'px'; tipEl.style.top = (below ? r.bottom + 12 : r.top - 12) + 'px';
    tipEl.style.transform = below ? 'translate(-50%,0)' : 'translate(-50%,-100%)';
    tipEl.classList.add('show'); tipOn = true;
  }, 500);
});
document.addEventListener('pointerout', e => { if (e.target.closest && e.target.closest('[data-tt]')) { tipEl.style.transform = ''; ttHide(); } });
document.addEventListener('pointerdown', () => { tipEl.style.transform = ''; ttHide(); });
/* spiegazioni al passaggio del mouse sul titolo di un pannello (data-help) */
let helpTimer = null;
function showHelp(el) {
  const txt = tr(el.dataset.help || ''); if (!txt) return;
  const title = (el.firstChild && el.firstChild.nodeType === 3 ? el.firstChild.textContent : el.textContent).replace(/\?$/, '').trim();
  tipEl.innerHTML = `<b>${esc(tr(title))}</b><small class="hl">${esc(txt)}</small>`;
  tipEl.classList.add('help'); tipEl.classList.remove('up', 'left'); tipEl.style.maxWidth = '290px';
  const r = el.getBoundingClientRect(), box = (el.closest('#props, #cut-card, #side, .panel') || el).getBoundingClientRect(), left = r.left > window.innerWidth * 0.5;
  tipEl.classList.toggle('left', left);
  tipEl.style.left = (left ? box.left - 16 : box.right + 16) + 'px';
  tipEl.style.top = Math.min(Math.max(r.top + r.height / 2, 60), window.innerHeight - 90) + 'px';
  tipEl.classList.add('show'); tipOn = true;
}
document.addEventListener('pointerover', e => {
  const el = e.target.closest && e.target.closest('[data-help]');
  if (!el) return;
  clearTimeout(helpTimer); helpTimer = setTimeout(() => showHelp(el), 450);
});
document.addEventListener('pointerout', e => { const el = e.target.closest && e.target.closest('[data-help]'); if (el) { clearTimeout(helpTimer); tipEl.classList.remove('help', 'left'); tipEl.style.maxWidth = ''; hideTip(); } });
document.addEventListener('pointerdown', () => { clearTimeout(helpTimer); tipEl.classList.remove('help', 'left'); tipEl.style.maxWidth = ''; hideTip(); });


/* ----------------------------------------------------------- barra bassa */
$('#viewcube').addEventListener('click', e => {
  const b = e.target.closest('[data-vc]'); if (!b) return;
  const O = ORTHO_FOV, V = { front: { az: 0, el: 0, fov: O }, back: { az: 180, el: 0, fov: O }, right: { az: 90, el: 0, fov: O }, left: { az: -90, el: 0, fov: O }, top: { az: cam.az, el: 89.9, fov: O }, bottom: { az: cam.az, el: -89.9, fov: O } };
  animateTo(V[b.dataset.vc]);
});
$('#views').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) { animateTo(VIEWS[b.dataset.view]); viewOn(b.dataset.view); } });
$('#b-dims').addEventListener('click', () => setDims());
function setMagnet(on, announce = true) {         // calamita: aggancio agli angoli e ai lati degli altri oggetti
  state.magnet = on ?? !state.magnet;
  $('#b-mag').classList.toggle('on', state.magnet);
  if (!state.magnet) { vtxMark.visible = false; guide.visible = false; dragRead.style.display = 'none'; dirty = true; }
  try { localStorage.setItem('forma.magnet', state.magnet ? '1' : '0'); } catch (e) {}
  if (announce) toast(state.magnet ? 'Calamita attiva' : 'Calamita spenta');
}
$('#b-mag').addEventListener('click', () => { setMagnet(); canvas.focus(); });
try { if (localStorage.getItem('forma.magnet') === '0') state.magnet = false; } catch (e) {}
$('#b-mag').classList.toggle('on', state.magnet);
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
const SNAPS = [0, 0.1, 0.5, 1, 5, 10];
const snapLabel = v => v ? String(v).replace('.', ',') + ' mm' : 'Libero';
const snapMenu = $('#snapmenu');
snapMenu.innerHTML = '<div class="mh">Scatto di spostamento</div>' + SNAPS.map(v => `<button class="btn" data-snap="${v}"><span>${snapLabel(v)}</span><em>${v === 0 ? 'senza aggancio' : v === 0.1 ? 'fine' : v === 1 ? 'standard' : ''}</em></button>`).join('');
function setSnap(v, announce = true) {
  state.snap = v;
  $('#b-snap em').textContent = snapLabel(v);
  snapMenu.querySelectorAll('[data-snap]').forEach(b => b.classList.toggle('on', parseFloat(b.dataset.snap) === v));
  try { localStorage.setItem('forma.snap', String(v)); } catch (e) {}
  if (announce) toast(v ? `Scatto: ${String(v).replace('.', ',')} mm` : 'Scatto: libero');
}
$('#b-snap').addEventListener('click', e => {
  e.stopPropagation();
  bedMenu.classList.add('hidden'); dotMenu.classList.add('hidden');
  snapMenu.classList.toggle('hidden'); anchorMenu(snapMenu, e.currentTarget); menuState();
});
document.addEventListener('pointerdown', e => { if (!e.target.closest('#snapmenu,#b-snap')) { snapMenu.classList.add('hidden'); menuState(); } });
snapMenu.addEventListener('click', e => {
  const b = e.target.closest('[data-snap]');
  if (b) { setSnap(parseFloat(b.dataset.snap)); snapMenu.classList.add('hidden'); menuState(); canvas.focus(); }
});
{ let sv = 1; try { const t = parseFloat(localStorage.getItem('forma.snap')); if (SNAPS.includes(t)) sv = t; } catch (e) {} setSnap(sv, false); }
/* distanza dei pallini */
const DOTS = [2, 5, 10];
const dotMenu = $('#dotmenu');
dotMenu.innerHTML = '<div class="mh">Distanza griglia</div>' + DOTS.map(v => `<button class="btn" data-dot="${v}"><span>${v} mm</span><em>${v === 2 ? 'fitta' : v === 5 ? 'media' : 'larga'}</em></button>`).join('');
function setDots(v, announce = true) {
  dotStep = gridStep = v; buildBedDots(v);
  $('#b-dots em').textContent = v + ' mm';
  dotMenu.querySelectorAll('[data-dot]').forEach(b => b.classList.toggle('on', +b.dataset.dot === v));
  try { localStorage.setItem('forma.dots', String(v)); } catch (e) {}
  if (announce) toast(`Griglia ogni ${v} mm`);
}
$('#b-dots').addEventListener('click', e => {
  e.stopPropagation();
  bedMenu.classList.add('hidden'); snapMenu.classList.add('hidden');
  dotMenu.classList.toggle('hidden'); anchorMenu(dotMenu, e.currentTarget); menuState();
});
document.addEventListener('pointerdown', e => { if (!e.target.closest('#dotmenu,#b-dots')) { dotMenu.classList.add('hidden'); menuState(); } });
dotMenu.addEventListener('click', e => {
  const b = e.target.closest('[data-dot]');
  if (b) { setDots(+b.dataset.dot); dotMenu.classList.add('hidden'); menuState(); canvas.focus(); }
});
let _d = 10; try { const sv = +localStorage.getItem('forma.dots'); if (DOTS.includes(sv)) _d = sv; } catch (e) {}
setDots(_d, false);

/* altezza della barra bassa: Livelli e Cronologia ne tengono conto */
(function () {
  const bar = $('#bar'), set = () => document.documentElement.style.setProperty('--barh', Math.round(bar.getBoundingClientRect().height) + 'px');
  set(); if (window.ResizeObserver) new ResizeObserver(set).observe(bar); addEventListener('resize', set);
})();
/* descrizioni al passaggio sulla barra bassa: come nella barra laterale, compaiono dopo una breve attesa e poi passano subito da un pulsante all'altro */
(function () {
  const bar = $('#bar'); let tm = null, cur = null, on = false;
  const restore = () => { if (cur && cur.dataset.t) { cur.title = cur.dataset.t; delete cur.dataset.t; } };
  const hide = () => { clearTimeout(tm); on = false; tipEl.classList.remove('show', 'up'); restore(); cur = null; };
  const render = b => {
    const name = (b.querySelector('em') ? [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('') : b.textContent).trim();
    const desc = (b.dataset.t || '').replace(/\s*\([^)]*\)\s*$/, '');
    if (!desc && !b.dataset.k) { tipEl.classList.remove('show'); on = false; return; }
    tipEl.innerHTML = `<b>${tr(name)}</b>${b.dataset.k ? `<kbd>${tr(b.dataset.k)}</kbd>` : ''}${desc ? `<small>${tr(desc)}</small>` : ''}`;
    const r = b.getBoundingClientRect(), one = new Set([...bar.querySelectorAll('.sec')].map(s => Math.round(s.getBoundingClientRect().top))).size === 1;
    // barra su una riga: il suggerimento sta sopra tutta la barra; se va a capo, sopra la sezione del pulsante
    const bt = bar.getBoundingClientRect().top, st = b.closest('.sec').getBoundingClientRect().top, top = one || st < bt + 20 ? bt : st;
    tipEl.classList.add('up');
    const w = tipEl.offsetWidth || 220;
    tipEl.style.left = Math.round(clamp(r.left + r.width / 2, w / 2 + 8, innerWidth - w / 2 - 8)) + 'px'; tipEl.style.top = top - 16 + 'px';
    tipEl.classList.add('show'); on = true;
  };
  bar.addEventListener('pointerover', e => {
    const b = e.target.closest('.btn'); if (!b || b === cur) return;
    clearTimeout(tm); restore(); cur = b;
    if (b.title) { b.dataset.t = b.title; b.removeAttribute('title'); }
    if (on) render(b); else tm = setTimeout(() => render(b), 550);
  });
  bar.addEventListener('pointerleave', hide); bar.addEventListener('pointerdown', hide);
})();
/* piatto di stampa */
const BEDS = [
  ['A1 mini', 180, 180], ['A1 · P1S · X1C · P2S', 256, 256], ['H2S', 340, 320], ['H2D', 350, 320], ['Max (40 cm)', 400, 400]
];
const bedMenu = $('#bedmenu');
bedMenu.innerHTML = '<div class="mh">Piatto di stampa</div>' + BEDS.map(([n, w, d], i) => `<button class="btn" data-bed="${i}"><span>${n}</span><em>${w}×${d}</em></button>`).join('') +
  `<div class="cust"><label class="f">L<input id="bed-w" type="number" min="20" max="400" step="1"></label><label class="f">P<input id="bed-d" type="number" min="20" max="400" step="1"></label><button class="btn primary" id="bed-go">OK</button></div>`;
function syncBedUI() {
  $('#b-bed').firstChild.textContent = 'Piatto ';
  $('#b-bed em').textContent = `${BEDX}×${BEDY}`;
  $('#bed-w').value = BEDX; $('#bed-d').value = BEDY;
  bedMenu.querySelectorAll('[data-bed]').forEach(b => { const p = BEDS[b.dataset.bed]; b.classList.toggle('on', p[1] === BEDX && p[2] === BEDY); });
}
function anchorMenu(menu, btn) {
  const r = btn.getBoundingClientRect(), w = menu.offsetWidth || 220;
  menu.style.left = Math.round(clamp(r.left + r.width / 2, w / 2 + 8, innerWidth - w / 2 - 8)) + 'px';
  menu.style.bottom = Math.round(innerHeight - $('#bar').getBoundingClientRect().top + 8) + 'px';
}
function menuState() { $('#b-snap').classList.toggle('open', !snapMenu.classList.contains('hidden')); $('#b-bed').classList.toggle('open', !bedMenu.classList.contains('hidden')); $('#b-dots').classList.toggle('open', !dotMenu.classList.contains('hidden')); }
$('#b-bed').addEventListener('click', e => { e.stopPropagation(); dotMenu.classList.add('hidden'); snapMenu.classList.add('hidden'); bedMenu.classList.toggle('hidden'); anchorMenu(bedMenu, e.currentTarget); menuState(); });
document.addEventListener('pointerdown', e => { if (!e.target.closest('#bedmenu,#b-bed')) bedMenu.classList.add('hidden'); menuState(); });
bedMenu.addEventListener('click', e => {
  const b = e.target.closest('[data-bed]');
  if (b) { const p = BEDS[b.dataset.bed]; setBed(p[1], p[2]); syncBedUI(); toast(`Piatto: ${p[0]} ${p[1]}×${p[2]} mm`); bedMenu.classList.add('hidden'); menuState(); }
  if (e.target.closest('#bed-go')) { setBed(+$('#bed-w').value, +$('#bed-d').value); syncBedUI(); toast(`Piatto: ${BEDX}×${BEDY} mm`); bedMenu.classList.add('hidden'); menuState(); }
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
function syncPrintRow() {
  const row = $('#exp-print'), on = expFmt === '3mf' && !!printCfg;
  row.classList.toggle('hidden', !on);
  if (!on) return;
  $('#exp-keep').checked = keepPrint;
  const s = printCfg.sum || {};
  $('#exp-print-d').textContent = [printCfg.src, s.printer, s.process, s.filament].filter(Boolean).join(' · ');
}
function setExpFmt(f) { expFmt = f; syncPrintRow(); document.querySelectorAll('#exp-fmt button').forEach(b => b.classList.toggle('on', b.dataset.v === f)); $('#exp-ext').textContent = '.' + f; $('#exp-hint').textContent = EXP_HINT[f]; }
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
$('#exp-keep').addEventListener('change', e => { keepPrint = e.target.checked; try { localStorage.setItem('forma.keepPrint', keepPrint ? '1' : '0'); } catch (err) {} });
$('#exp-forget').addEventListener('click', () => { const d = $('#dlg-forget'); if (!d.open) d.showModal(); });
$('#forget-cancel').addEventListener('click', () => $('#dlg-forget').close());
$('#forget-form').addEventListener('submit', () => { printCfg = null; savePrintCfg(); syncPrintRow(); toast('Impostazioni di stampa dimenticate'); });
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

/* Esc: 1) annulla la modifica di un campo numerico o del nome e ne esce, 2) chiude i menu aperti, 3) poi deseleziona (gestore sotto) */
const fieldStart = new WeakMap();
document.addEventListener('focusin', e => { if (e.target.tagName === 'INPUT') fieldStart.set(e.target, e.target.value); });
function closeOpenMenus() {
  const open = [snapMenu, dotMenu, bedMenu].filter(m => !m.classList.contains('hidden'));
  const fontOpen = !tFontList.classList.contains('hidden');
  const flyWas = [closeFlyout(true), closeCtx(true)].some(Boolean);
  if (!open.length && !fontOpen) return flyWas;
  open.forEach(m => m.classList.add('hidden')); closeFontList(); menuState();
  return true;
}
window.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || e.isComposing) return;
  const t = e.target;
  if (t.tagName === 'INPUT' && (t.type === 'number' || t.id === 'p-name') && !t.closest('dialog, #hpop') && fieldStart.has(t)) {
    e.preventDefault(); e.stopPropagation();
    const v0 = fieldStart.get(t);
    if (t.value !== v0) {
      t.value = v0;
      t.dispatchEvent(new Event('input', { bubbles: true })); // riporta il modello al valore di partenza
      const m = single(); if (m) { delete m.userData.lockS; delete m.userData.lockC; }
      gScale = null; syncPanel();
    }
    t.blur();
    return;
  }
  if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || dlg.open || document.querySelector('dialog[open]:not(#dlg-check)')) return;
  if (closeOpenMenus()) { e.preventDefault(); e.stopPropagation(); }
}, true);

/* ------------------------------------------------------------ tastiera */
window.addEventListener('keydown', e => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || dlg.open || document.querySelector('dialog[open]:not(#dlg-check)')) return;
  const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
  if (k === 'tab' && !mod && !e.altKey) { e.preventDefault(); setMini(!sideEl.classList.contains('mini')); return; }
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
    else if (k === 'v') { stop(); pasteClip(e.shiftKey); }
    else if (k === 'a') { stop(); setSelection([...objects]); }
    else if (k === 'e') { stop(); e.shiftKey ? intersect() : combine(); }
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
  else if (k === 'q') setTool('marquee');
  else if (k === 'w') setTool('lasso');
  else if (k === 'k') setTool('cut');
  else if (k === 'u') setTool('stretch');
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
  stashCtx();
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
  pendCtx = null;
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
const TF = { k: { value: '1.5' }, depth: { value: '1' }, margin: { value: '1.5' }, push: $('#f-push') };
function basisMatrix(X, Y, Z, pos) {
  const z = Z.clone();
  if (X.clone().cross(Y).dot(z) < 0) z.negate();
  return new THREE.Matrix4().makeBasis(X, Y, z).setPosition(pos);
}
// parti staccate di una geometria (coordinate locali): [{ts}] ordinate per dimensione; i frammenti minuscoli seguono la parte più grande
const triVolume = (A, ts) => { let v = 0; for (const t of ts) { const o = t * 9; v += (A[o] * (A[o + 4] * A[o + 8] - A[o + 5] * A[o + 7]) - A[o + 1] * (A[o + 3] * A[o + 8] - A[o + 5] * A[o + 6]) + A[o + 2] * (A[o + 3] * A[o + 7] - A[o + 4] * A[o + 6])) / 6; } return Math.abs(v); };
function pieceGroups(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo, A = g.attributes.position.array, nT = A.length / 9, q = v => Math.round(v * 2000);
  const ids = new Map(), parent = [];
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const vid = i => { const k = q(A[i]) + ',' + q(A[i + 1]) + ',' + q(A[i + 2]); let id = ids.get(k); if (id === undefined) { id = parent.length; parent.push(id); ids.set(k, id); } return id; };
  const tv = [];
  for (let t = 0; t < nT; t++) { const a = vid(t * 9), b = vid(t * 9 + 3), c = vid(t * 9 + 6); tv.push(a); parent[find(b)] = find(a); parent[find(c)] = find(a); }
  // la CSG lascia giunture a T: un vertice a metà di uno spigolo altrui. Lo si collega a quello spigolo, altrimenti una superficie sembra divisa in due
  if (nT > 120000) return null;
  const P = new Array(parent.length);
  for (let t = 0; t < nT; t++) for (let j = 0; j < 3; j++) P[tv[t] === undefined ? 0 : [tv[t], ids.get(q(A[t * 9 + 3]) + ',' + q(A[t * 9 + 4]) + ',' + q(A[t * 9 + 5])), ids.get(q(A[t * 9 + 6]) + ',' + q(A[t * 9 + 7]) + ',' + q(A[t * 9 + 8]))][j]] = [A[t * 9 + j * 3], A[t * 9 + j * 3 + 1], A[t * 9 + j * 3 + 2]];
  const edges = new Map();
  for (let t = 0; t < nT; t++) { const v = [tv[t], ids.get(q(A[t * 9 + 3]) + ',' + q(A[t * 9 + 4]) + ',' + q(A[t * 9 + 5])), ids.get(q(A[t * 9 + 6]) + ',' + q(A[t * 9 + 7]) + ',' + q(A[t * 9 + 8]))]; for (let k = 0; k < 3; k++) { const a = v[k], b = v[(k + 1) % 3]; if (a !== b) edges.set(a < b ? a + ',' + b : b + ',' + a, [a, b]); } }
  const CELL = 2, grid = new Map(), ck = (x, y, z) => Math.floor(x / CELL) + ',' + Math.floor(y / CELL) + ',' + Math.floor(z / CELL);
  for (const [a, b] of edges.values()) {
    const pa = P[a], pb = P[b], lo = [0, 1, 2].map(i => Math.floor(Math.min(pa[i], pb[i]) / CELL)), hi = [0, 1, 2].map(i => Math.floor(Math.max(pa[i], pb[i]) / CELL));
    if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) > 400) continue;
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const k = x + ',' + y + ',' + z; (grid.get(k) || grid.set(k, []).get(k)).push([a, b]); }
  }
  for (let v = 0; v < P.length; v++) {
    const p = P[v]; if (!p) continue;
    for (const [a, b] of grid.get(ck(p[0], p[1], p[2])) || []) {
      if (a === v || b === v || find(v) === find(a)) continue;
      const pa = P[a], pb = P[b], ex = pb[0] - pa[0], ey = pb[1] - pa[1], ez = pb[2] - pa[2], l2 = ex * ex + ey * ey + ez * ez;
      if (l2 < 1e-12) continue;
      const u = ((p[0] - pa[0]) * ex + (p[1] - pa[1]) * ey + (p[2] - pa[2]) * ez) / l2;
      if (u <= 0 || u >= 1) continue;
      const dx = pa[0] + u * ex - p[0], dy = pa[1] + u * ey - p[1], dz = pa[2] + u * ez - p[2];
      if (dx * dx + dy * dy + dz * dz < 1e-6) parent[find(v)] = find(a);
    }
  }
  const comps = new Map();
  for (let t = 0; t < nT; t++) { const r = find(tv[t]); if (!comps.has(r)) comps.set(r, []); comps.get(r).push(t); }
  let list = [...comps.values()].sort((x, y) => y.length - x.length);
  // frammenti senza volume (resti di lame sottilissime, es. dopo aver portato a filo un testo inciso): lo slicer li rifiuta
  const solid = list.filter(c => triVolume(A, c) >= 0.01), dropped = list.length - solid.length;
  if (dropped && solid.length) list = solid; else if (dropped) return null;
  const big = list.filter(c => c.length >= 12);
  if (!big.length || big.length > 400) return null;
  if (big.length < 2 && !dropped) return null;
  list.filter(c => c.length < 12).forEach(c => big[0].push(...c));
  return { A, parts: big, dropped };
}
let lastPieces = [];
function replaceWithMerged(old, baked, quiet = false) {
  const hole = old.userData.hole;
  const pg = pieceGroups(baked.geo);
  removeMesh(old);
  let pieces;
  if (pg) {                                   // l'oggetto è ora fatto di più parti: diventano un gruppo
    const off = baked.pos;
    pieces = pg.parts.map((ts, i) => {
      const a = new Float32Array(ts.length * 9);
      ts.forEach((t, k) => { for (let j = 0; j < 9; j++) a[k * 9 + j] = pg.A[t * 9 + j] + off[j % 3]; });
      const bk = bakeResult({ updateMatrixWorld() {}, matrixWorld: new THREE.Matrix4(), geometry: geometryFromPositions(a) }, pg.parts.length > 1 ? `${baked.name} ${i + 1}` : baked.name);
      const m = addMerged(bk); m.userData.gid = old.userData.gid ?? null; return m;   // pezzi separati: ognuno ha il suo livello
    });
  } else { pieces = [addMerged(baked)]; pieces[0].userData.gid = old.userData.gid ?? null; }
  pieces.forEach(nm => { nm.userData.hole = hole; nm.userData.color = old.userData.color ?? null; nm.userData.text = null; nm.castShadow = !hole; });
  const nm = pieces[0]; lastPieces = pieces;
  if (quiet) return nm;
  clearFace(false);
  setSelection(pieces);
  touch(); commit();
  if (pieces.length > 1) toast(`Ora sono ${pieces.length} pezzi separati: li trovi nei Livelli (F7)`);
  else if (pg && pg.dropped) toast(`Tolti ${pg.dropped} frammenti senza volume`);
  return nm;
}

/* ------------------------------------------------------------ lati curvi e cilindri */
// profilo di una cella (passo p) lungo il senso di scorrimento: punti [a, y] con y>0 fuori dal materiale. cut: solchi, raise: coste
// sagoma del lato rimpicciolita di 'inset' mm (poligoni Clipper in micron): tiene le righe lontane dal bordo
// il lato è un rettangolo con i bordi paralleli agli assi u e v? (altrimenti le righe vanno ritagliate sulla sagoma)
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
    setSelection(withGroups(out));
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
/* Il lato è arrivato a filo con un'altra superficie: tutte le facce nello stesso piano diventano un'unica superficie (unione 2D + nuova triangolazione),
   così le pareti collassate non lasciano triangoli doppi o spigoli non chiusi. */
function mergeFlush(arr, orig, n, dP) {
  const nT = arr.length / 9, K = 1000, C = ClipperLib;
  const u = Math.abs(n.z) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1).cross(n).normalize(), v = n.clone().cross(u);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const inPlane = new Uint8Array(nT), paths = [], lookup = new Map();
  let untouched = 0, count = 0;
  for (let t = 0; t < nT; t++) {
    A.fromArray(arr, t * 9); B.fromArray(arr, t * 9 + 3); Cc.fromArray(arr, t * 9 + 6);
    if (Math.abs(n.dot(A) - dP) > 2e-3 || Math.abs(n.dot(B) - dP) > 2e-3 || Math.abs(n.dot(Cc) - dP) > 2e-3) continue;
    inPlane[t] = 1; count++;
    let same = true; for (let j = 0; j < 9 && same; j++) same = arr[t * 9 + j] === orig[t * 9 + j];
    if (same) untouched++;
    e1.subVectors(B, A); e2.subVectors(Cc, A);
    if (e1.cross(e2).dot(n) <= 1e-9) continue;                       // solo le facce rivolte come il lato: le altre sono pareti collassate
    const pl = [A, B, Cc].map(p => { const X = Math.round(p.dot(u) * K), Y = Math.round(p.dot(v) * K); const k = X + ',' + Y; if (!lookup.has(k)) lookup.set(k, p.toArray()); return { X, Y }; });
    paths.push(pl);
  }
  if (!count || !untouched || !paths.length) return null;
  const cl = new C.Clipper(C.Clipper.ioPreserveCollinear), tree = new C.PolyTree();
  cl.AddPaths(paths, C.PolyType.ptSubject, true);
  cl.Execute(C.ClipType.ctUnion, tree, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
  const add = [], p3 = p => { const k = p.X + ',' + p.Y; return lookup.get(k) || n.clone().multiplyScalar(dP).addScaledVector(u, p.X / K).addScaledVector(v, p.Y / K).toArray(); };
  const thin = pl => { let a2 = 0, per = 0; for (let i = 0; i < pl.length; i++) { const p = pl[i], q = pl[(i + 1) % pl.length]; a2 += p.X * q.Y - q.X * p.Y; per += Math.hypot(q.X - p.X, q.Y - p.Y); } return per > 0 && Math.abs(a2) / per / K < 0.05; };   // spicchi sottilissimi lasciati dalle pareti curve collassate
  const walk = node => {
    for (const o of node.Childs()) {
      if (o.IsHole()) { walk(o); continue; }
      const contour = o.Contour(), holes = o.Childs().filter(h => !thin(h.Contour())).map(h => h.Contour());
      const all = [...contour, ...holes.flat()];
      const cv = contour.map(p => new THREE.Vector2(p.X / K, p.Y / K)), hv = holes.map(h => h.map(p => new THREE.Vector2(p.X / K, p.Y / K)));
      for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(cv, hv)) {
        const a = p3(all[i]), b = p3(all[j]), c = p3(all[k]);
        A.fromArray(a); B.fromArray(b); Cc.fromArray(c);
        e1.subVectors(B, A).cross(e2.subVectors(Cc, A));
        if (e1.length() / Math.max(1e-9, A.distanceTo(B), B.distanceTo(Cc), Cc.distanceTo(A)) < 2e-3) continue;   // punti quasi allineati: nessuna superficie
        const flip = e1.dot(n) < 0;
        add.push(...(flip ? [...a, ...c, ...b] : [...a, ...b, ...c]));
      }
      for (const h of o.Childs()) if (!thin(h.Contour())) walk(h);       // le isole dentro uno spicchio scartato sono già coperte dal riempimento
    }
  };
  walk(tree);
  if (!add.length) return null;
  const out = new Float32Array((nT - count) * 9 + add.length);
  let w = 0;
  for (let t = 0; t < nT; t++) if (!inPlane[t]) { out.set(arr.subarray(t * 9, t * 9 + 9), w); w += 9; }
  out.set(add, w);
  return out;
}
function pushOne(obj, faces, dist) {
  if (faces.length === 1 && faces[0].full && ['cylinder', 'cone'].includes(obj.userData.kind)) {   // lato intero di un cilindro: allarga o stringe il raggio
    const u = obj.userData, nd = u.p.w + 2 * dist;
    if (nd < 0.2) return { err: FLAT_MSG };
    setSize(obj, 'w', nd); setSize(obj, 'd', nd);
    return { mesh: obj, ext: false };
  }
  if (faces.length === 1 && faces[0].full && faces[0].curved && obj.userData.kind === 'merged') {   // cilindro già modificato: allarga o stringe tutto in modo radiale
    const rp = ringParams(faces[0]);
    if (rp && rp.full && rp.R + dist >= 0.2) {
      obj.updateMatrixWorld(true);
      const g = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
      g.applyMatrix4(obj.matrixWorld);
      const arr = new Float32Array(g.attributes.position.array), k = (rp.R + dist) / rp.R;
      let inside = true;
      for (let i = 0; i < arr.length; i += 3) if (Math.hypot(arr[i] - rp.cx, arr[i + 1] - rp.cy) > rp.R + 0.05) { inside = false; break; }
      g.dispose();
      if (inside) {
        for (let i = 0; i < arr.length; i += 3) { arr[i] = rp.cx + (arr[i] - rp.cx) * k; arr[i + 1] = rp.cy + (arr[i + 1] - rp.cy) * k; }
        const baked = bakeResult({ updateMatrixWorld() {}, matrixWorld: new THREE.Matrix4(), geometry: geometryFromPositions(arr) }, obj.userData.name);
        if (baked && !isFlat(baked)) return { mesh: replaceWithMerged(obj, baked, true), ext: false };
      }
    }
  }
  if (faces.length === 1 && faces[0].curved) {
    let pv = null; try { pv = pushVertical(obj, faces[0], dist); } catch (e) { pv = null; }
    if (pv && pv.err) return { err: pv.err };
    if (pv && pv.baked) { if (isFlat(pv.baked)) return { err: FLAT_MSG }; return { mesh: replaceWithMerged(obj, pv.baked, true), ext: true }; }
  }
  obj.updateMatrixWorld(true);
  let g = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
  g.applyMatrix4(obj.matrixWorld);
  const pos = g.attributes.position; let arr = new Float32Array(pos.array);
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
  let spiky = false, flushed = false;
  const orig = pos.array;
  {   // pareti che collassano a zero (il lato arriva a filo con un'altra superficie): lo spostamento lascerebbe triangoli doppi, meglio l'unione per CSG
    const hOf = (A, t) => { const a = t * 9; let m2 = 0; const e = [[0, 3], [3, 6], [6, 0]].map(([i, j]) => { const l = Math.hypot(A[a + i] - A[a + j], A[a + i + 1] - A[a + j + 1], A[a + i + 2] - A[a + j + 2]); m2 = Math.max(m2, l); return l; });
      const s = (e[0] + e[1] + e[2]) / 2, ar = Math.sqrt(Math.max(0, s * (s - e[0]) * (s - e[1]) * (s - e[2]))); return m2 > 1e-9 ? 2 * ar / m2 : 0; };
    let collapsed = 0;
    for (let t = 0; t < arr.length / 9; t++) {
      let touched = false; for (let j = 0; j < 9 && !touched; j++) touched = arr[t * 9 + j] !== orig[t * 9 + j];
      if (touched && hOf(arr, t) < 0.05 && hOf(orig, t) > 0.05) collapsed++;
    }
    if (collapsed) {
      const f0 = faces[0], dP = f0.n.x * f0.world[0] + f0.n.y * f0.world[1] + f0.n.z * f0.world[2] + dist;
      const merged = mergeFlush(arr, orig, f0.n, dP);
      if (merged) { arr = merged; flushed = true; }
    }
  }
  const maxEdge = (A, t) => { let m = 0; for (let j = 0; j < 3; j++) { const a = t * 9 + j * 3, b = t * 9 + ((j + 1) % 3) * 3; m = Math.max(m, Math.hypot(A[a] - A[b], A[a + 1] - A[b + 1], A[a + 2] - A[b + 2])); } return m; };
  for (let t = 0; t < arr.length / 9 && !spiky && !flushed; t++) {
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
  const sp = new THREE.Sprite(mat); sp.scale.setScalar(0.024); fovSprites.push([sp, 0.024]); sp.renderOrder = 999; sp.visible = false; scene.add(sp); return sp;
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
  const base = fs.n.dot(faceCenter(fs)), set = new Map(), v = new THREE.Vector3(), wn = new THREE.Vector3();
  for (const m of objects) {
    m.updateMatrixWorld(true);
    const info = meshInfo(m.geometry), geo = m.geometry, pos = geo.attributes.position, idx = geo.index;
    const nm = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
    for (let t = 0; t < info.nTri; t++) {
      if (!info.ok[t]) continue;
      wn.set(info.nrm[t * 3], info.nrm[t * 3 + 1], info.nrm[t * 3 + 2]).applyMatrix3(nm).normalize();
      if (Math.abs(wn.dot(fs.n)) < 0.9999) continue;
      v.fromBufferAttribute(pos, idx ? idx.getX(t * 3) : t * 3).applyMatrix4(m.matrixWorld);
      const d = fs.n.dot(v) - base, k = Math.round(d * 50);
      if (!set.has(k)) set.set(k, d);                                   // valore esatto: così a filo non resta una parete di 0,01 mm
    }
  }
  return [...set.values()];
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
  let pcfg = null;
  if (files['Metadata/project_settings.config']) {
    const cfg = dec.decode(files['Metadata/project_settings.config']), sum = printSummary(cfg);
    const mm = /<metadata name="Application">([^<]*)</.exec(text(root));
    if (sum) pcfg = { cfg, sum, app: mm ? mm[1] : '' };
  }
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
  const res = list.map(it => { const out = []; emit(it.path || root, it.id, mat(it.tf), out); return { pos: Float32Array.from(out) }; }).filter(it => it.pos.length >= 9);
  res.print = pcfg;
  return res;
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
function askSplit(n, name) {                           // finestra: dividere in livelli le parti staccate di un file
  const dl = $('#dlg-split');
  $('#split-n').textContent = n;
  return new Promise(res => {
    dl.returnValue = '';
    dl.addEventListener('close', () => res(dl.returnValue === 'split'), { once: true });
    dl.showModal();
  });
}
async function importFiles(files) {
  for (const f of files) {
    const ext = f.name.split('.').pop().toLowerCase();
    try {
      const buf = await f.arrayBuffer();
      let items;
      if (ext === '3mf') {
        items = parse3MF(buf);
        if (items.print) { printCfg = { ...items.print, src: f.name }; keepPrint = true; savePrintCfg(); try { localStorage.setItem('forma.keepPrint', '1'); } catch (e) {} }
      }
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
      setSelection(made);
      let nParts = 0;                                    // un solo oggetto fatto di parti staccate: si propone di dividerle
      if (made.length === 1 && made[0].geometry.index.count / 3 < 400000) {
        const bk = bakeResult(made[0], made[0].userData.name), pg = bk && pieceGroups(bk.geo);
        if (pg && pg.parts.length > 1 && await askSplit(pg.parts.length, f.name)) nParts = separateSelection(true) || 0;
      }
      touch(); commit(); fitView();
      if (nParts) { toast(`Importato ${f.name}: diviso in ${nParts} pezzi separati`); continue; }
      const tris = made.reduce((s, m) => s + m.geometry.index.count / 3, 0);
      toast(`Importato ${f.name}: ${made.length} ${made.length === 1 ? 'oggetto' : 'oggetti'}, ${tris.toLocaleString('it-IT')} triangoli`);
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
  if (state.tool === 'ruler') rulerCardText([tr('Metro'), tr('Clicca un punto o un lato, poi un secondo. Su due lati paralleli misura la distanza tra i piani.'), tr('Tieni premuto ⌥ per vedere larghezza e altezza del lato sotto il mouse, e gli angoli se passi su un angolo o uno spigolo.')]); else rulerCard.classList.add('hidden');
}
// punto cliccato sulla superficie; si aggancia a un vertice o a uno spigolo vicino
function rulerPick(hit) {
  const obj = hit.object, p = hit.point.clone();
  const n = hit.face ? hit.face.normal.clone().transformDirection(obj.matrixWorld).normalize() : null;
  const wpp = 2 * Math.tan(camera.fov * D2R / 2) * camera.position.distanceTo(p) / canvas.clientHeight, thr = 18 * wpp;
  const eg = obj.userData.edges?.geometry, pos = eg?.attributes.position;
  let snap = null, bv = thr, be = thr * 0.7, bm = thr * 0.85, pv = null, pe = null, pm = null;
  if (pos) {
    const A = new THREE.Vector3(), B = new THREE.Vector3(), AB = new THREE.Vector3(), tmp = new THREE.Vector3();
    obj.updateMatrixWorld(true);
    for (let i = 0; i + 1 < pos.count; i += 2) {
      A.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld); B.fromBufferAttribute(pos, i + 1).applyMatrix4(obj.matrixWorld);
      for (const V of [A, B]) { const d = V.distanceTo(p); if (d < bv) { bv = d; pv = V.clone(); } }
      AB.subVectors(B, A); const l2 = AB.lengthSq(); if (l2 < 1e-12) continue;
      { const mid = A.clone().add(B).multiplyScalar(0.5), dm = mid.distanceTo(p); if (dm < bm) { bm = dm; pm = mid; } }
      const t = clamp(tmp.subVectors(p, A).dot(AB) / l2, 0, 1), q = A.clone().addScaledVector(AB, t), d = q.distanceTo(p);
      if (d < be) { be = d; pe = q; }
    }
  }
  if (pv) { p.copy(pv); snap = 'v'; } else if (pm) { p.copy(pm); snap = 'm'; } else if (pe) { p.copy(pe); snap = 'e'; }
  return { p, n, snap };
}
const rulerHov = document.createElement('div'); rulerHov.className = 'ruler-hov'; labelsEl.appendChild(rulerHov);
function faceRect(fs) {                                    // rettangolo più piccolo che contiene il lato: larghezza e altezza vere anche se il lato è ruotato o inclinato
  const T = fs.tri2d, seen = new Map();
  for (let i = 0; i < T.length; i += 2) seen.set(Math.round(T[i] * 500) + ',' + Math.round(T[i + 1] * 500), [T[i], T[i + 1]]);
  const P = [...seen.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (P.length < 3) return { a: fs.W, b: fs.H, ang: 0 };
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const hull = lo.slice(0, -1).concat(up.slice(0, -1));
  let best = null;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), c = Math.cos(ang), sn = Math.sin(ang);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of hull) { const u = p[0] * c + p[1] * sn, v = -p[0] * sn + p[1] * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const A = (u1 - u0) * (v1 - v0);
    if (!best || A < best.A - 1e-9) best = { A, a: u1 - u0, b: v1 - v0, ang };
  }
  return best;
}
const faceDim = document.createElement('div'); faceDim.className = 'alt-tip'; faceDim.style.pointerEvents = 'none'; labelsEl.appendChild(faceDim);
let rulerLastEv = null;
function hideFaceDim() { faceDim.style.display = 'none'; if (hoverMesh) hideHover(); }

/* ⌥ su un angolo: angolo interno del lato; ⌥ su uno spigolo: angolo tra i due lati */
function setAltTip(big, cap, rows) {
  faceDim.innerHTML = `<b>${big}</b>${rows.map(r => `<div class="r"><span>${r[0]}</span><em>${r[1]}</em></div>`).join('')}<span class="c">${cap}</span>`;
}
function angleAt(hit, e) {
  const obj = hit.object, an = edgeAnalysis(obj), W = window.innerWidth, H = window.innerHeight;
  const toS = p => { const v = p.clone().project(camera); return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H]; };
  const fn = hit.face.normal.clone().transformDirection(obj.matrixWorld);
  let best = null, bd = 16;                                                       // angolo: vertice entro 16 px
  for (const [vi, edges] of an.at) {
    const p = an.vp(vi), s = toS(p), d = Math.hypot(s[0] - e.clientX, s[1] - e.clientY);
    if (d >= bd) continue;
    const dirs = [], lens = [];
    for (const ed of edges) {
      const q = an.vp(ed.a === vi ? ed.b : ed.a).sub(p).normalize();
      if (Math.abs(q.dot(fn)) < 0.02) { dirs.push(q); lens.push(an.vp(ed.a).distanceTo(an.vp(ed.b))); }                              // solo gli spigoli che stanno nel piano del lato
    }
    if (dirs.length < 2) continue;
    const u = dirs[0].clone(), w = fn.clone().cross(u);
    const ar = dirs.map(q => Math.atan2(q.dot(w), q.dot(u)));
    const sorted = ar.map((a, i) => [(a + 2 * Math.PI) % (2 * Math.PI), i]).sort((a, b) => a[0] - b[0]);
    const pd = hit.point.clone().sub(p), pa = (Math.atan2(pd.dot(w), pd.dot(u)) + 2 * Math.PI) % (2 * Math.PI);
    let lo = sorted[sorted.length - 1], hi = sorted[0], wedge = 2 * Math.PI - lo[0] + hi[0];
    for (let i = 0; i < sorted.length; i++) { const a = sorted[i], b = sorted[(i + 1) % sorted.length]; const span = (b[0] - a[0] + 2 * Math.PI) % (2 * Math.PI) || 2 * Math.PI; const rel = (pa - a[0] + 2 * Math.PI) % (2 * Math.PI); if (rel <= span) { lo = a; hi = b; wedge = span; break; } }
    best = { kind: 'corner', deg: wedge * 180 / Math.PI, p, sides: [lens[lo[1]], lens[hi[1]]] }; bd = d;
  }
  if (best) return best;
  const dist = camera.position.distanceTo(hit.point), tol = dist * 2 * Math.tan(camera.fov * D2R / 2) / H * 9;
  const ed = nearestEdge(an, hit.point, tol);
  if (!ed) return null;
  const a = an.vp(ed.a), b = an.vp(ed.b), ab = b.clone().sub(a), t = Math.max(0, Math.min(1, hit.point.clone().sub(a).dot(ab) / ab.lengthSq()));
  return { kind: 'edge', deg: 180 - Math.acos(Math.max(-1, Math.min(1, ed.n1.dot(ed.n2)))) * 180 / Math.PI, len: ab.length(), p: a.clone().addScaledVector(ab, t) };
}
function rulerHover(e) {                                  // anteprima del punto che verrebbe preso con un clic; con ⌥ misura il lato sotto il mouse
  rulerLastEv = e;
  const hit = pickHit(e);
  if (e.altKey) {
    rulerHov.style.display = 'none';
    if (!hit || hit.object.userData.heavy) return hideFaceDim();
    if (!(hoverFs && hoverFs.obj === hit.object && hoverFs.triSet.has(hit.faceIndex))) {
      hideHover();
      const fs = computeFace(hit.object, hit.faceIndex);
      if (!fs) return hideFaceDim();
      hoverFs = fs; hoverMesh = makeOverlay(fs, 0.22); scene.add(hoverMesh); dirty = true;
    }
    const ang = angleAt(hit, e);
    if (ang) {
      const v = ang.p.clone().project(camera);
      rulerHov.className = 'ruler-hov ' + (ang.kind === 'corner' ? 'v' : 'e'); rulerHov.style.display = 'block';
      rulerHov.style.transform = `translate(${(v.x * 0.5 + 0.5) * window.innerWidth}px, ${(-v.y * 0.5 + 0.5) * window.innerHeight}px) translate(-50%, -50%)`;
      setAltTip(`${fmt(ang.deg)}°`, ang.kind === 'corner' ? tr('angolo del lato') : tr('angolo tra i due lati'), ang.len !== undefined ? [[tr('Lunghezza'), `${fmt(ang.len)} mm`]] : ang.sides ? [[tr('Lati'), `${fmt(ang.sides[0])} · ${fmt(ang.sides[1])} mm`]] : []);
      faceDim.style.display = 'block';
      faceDim.style.transform = `translate(${e.clientX + 18}px, ${e.clientY + 18}px)`;
      return;
    }
    const fs = hoverFs, flat = Math.abs(fs.n.z) > 0.9;
    let w1 = fs.W, h1 = fs.H;
    if (!fs.curved) {                                    // asse "alto" = quello più vicino alla direzione su (lato) o avanti (piano)
      const r = faceRect(fs), d = Math.abs(Math.cos(r.ang));                       // r.a è lungo la direzione r.ang rispetto all'asse u del lato
      const uAlong = d > Math.SQRT1_2;                                             // r.a quasi parallelo a u
      const A = r.a, B = r.b; w1 = uAlong ? A : B; h1 = uAlong ? B : A;
    }
    setAltTip(`${fs.curved ? '≈ ' : ''}${fmt(w1)} × ${fmt(h1)} mm`, tr(flat ? 'larghezza × profondità' : 'larghezza × altezza'), []);
    faceDim.style.display = 'block';
    faceDim.style.transform = `translate(${e.clientX + 18}px, ${e.clientY + 18}px)`;
    return;
  }
  if (hoverMesh || faceDim.style.display !== 'none') hideFaceDim();
  if (!hit) { rulerHov.style.display = 'none'; return; }
  const pt = rulerPick(hit), v = pt.p.clone().project(camera), w = window.innerWidth, h = window.innerHeight;
  rulerHov.className = 'ruler-hov ' + (pt.snap || 'f');
  rulerHov.style.display = 'block';
  rulerHov.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
}
window.addEventListener('keydown', e => { if (e.key === 'Alt' && state.tool === 'ruler' && rulerLastEv && !e.repeat) rulerHover({ clientX: rulerLastEv.clientX, clientY: rulerLastEv.clientY, altKey: true }); });
window.addEventListener('keyup', e => { if (e.key === 'Alt' && state.tool === 'ruler') { hideFaceDim(); if (rulerLastEv) rulerHover({ clientX: rulerLastEv.clientX, clientY: rulerLastEv.clientY, altKey: false }); } });
function rulerClick(hit) {
  if (!hit) { clearRuler(); return; }
  const pt = rulerPick(hit);
  if (!ruler.a || ruler.b) { clearRuler(); ruler.a = pt; rulerCardText([tr('Metro'), tr('Ora clicca il secondo punto o lato.')]); dirty = true; return; }
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
const _cl = new THREE.Vector3();
function updateSilhouettes() {                     // Raggi X: contorno (i due lati) di cilindri e coni, visto dalla camera
  for (const m of objects) {
    const u = m.userData, sx = u.silX;
    if (!sx) continue;
    sx.visible = state.xray && m.visible;
    if (!sx.visible || !u.p) continue;
    const p = u.p, rt = u.kind === 'cone' ? Math.max(p.q || 0, 1) / 100 : clamp(p.t ?? 100, 1, 100) / 100, z0 = Math.min(p.fb || 0, p.h / 2), z1 = p.h - Math.min(p.ft || 0, p.h / 2);
    const km = z => 1 + (rt - 1) * z / p.h, a = p.w / 2, b = p.d / 2, zm = (z0 + z1) / 2;
    _cl.copy(camera.position); m.worldToLocal(_cl);
    const A = _cl.x / (a * km(zm)), B = _cl.y / (b * km(zm)), R = Math.hypot(A, B);
    const arr = sx.geometry.attributes.position.array;
    if (R <= 1.0001) { arr.fill(0); sx.geometry.attributes.position.needsUpdate = true; continue; }
    const phi = Math.atan2(B, A), d = Math.acos(1 / R);
    let i = 0;
    for (const th of [phi - d, phi + d]) for (const z of [z0, z1]) { const k = km(z); arr[i++] = Math.cos(th) * a * k; arr[i++] = Math.sin(th) * b * k; arr[i++] = z; }
    sx.geometry.attributes.position.needsUpdate = true; sx.computeLineDistances();
    sx.material.color.copy(u.xray.material.color); sx.material.opacity = u.xray.material.opacity;
  }
}
function render() {
  updateSilhouettes();
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
const isEdgeBox = o => edgeShape(o.userData.kind, o.userData.p);
function edgeAtPointer(e, hit) {
  if (!hit) return null;
  const obj = hit.object;
  const wpp = 2 * camera.position.distanceTo(hit.point) * Math.tan(camera.fov * D2R / 2) / canvas.clientHeight;
  if (isEdgeBox(obj)) {                                // scatola: i 12 spigoli "virtuali" della forma intera
    obj.updateMatrixWorld(true);
    const lim = Math.max(0.8, 14 * wpp), ln = new THREE.Line3(), q = new THREE.Vector3();
    let best = null, bd = lim;
    for (const k of edgeKeysOf(obj.userData.kind, obj.userData.p)) {
      const fr = edgeFrame(obj.userData.kind, obj.userData.p, k), [A, B] = [fr.A, fr.B].map(v => v.clone().applyMatrix4(obj.matrixWorld));
      ln.set(A, B); ln.closestPointToPoint(hit.point, true, q);
      const d = q.distanceTo(hit.point);
      if (d < bd) { bd = d; best = { key: k, pts: [A, B] }; }
    }
    if (obj.userData.kind === 'prism') {                // anche gli spigoli verticali (si possono spostare e arrotondare)
      const p = obj.userData.p, n = prismSides(p);
      for (let i = 0; i < n; i++) {
        const th = 2 * Math.PI * i / n, x = Math.cos(th) * p.w / 2, y = Math.sin(th) * p.d / 2;
        const [A, B] = [new THREE.Vector3(x, y, 0), new THREE.Vector3(x, y, p.h)].map(v => v.applyMatrix4(obj.matrixWorld));
        ln.set(A, B); ln.closestPointToPoint(hit.point, true, q);
        const d = q.distanceTo(hit.point);
        if (d < bd) { bd = d; best = { key: 'pv:' + i, pts: [A, B], vert: true }; }
      }
    }
    if (best && best.vert) return { obj, virt: { key: best.key, chain: { pts: best.pts, closed: false, verts: [best.key] } } };
    return best ? { obj, virt: { key: best.key, chain: { pts: best.pts, closed: false, verts: [best.key], vkey: best.key } } } : null;
  }
  const an = edgeAnalysis(obj);
  const ed = nearestEdge(an, hit.point, Math.max(0.8, 14 * wpp));
  if (!ed) return null;
  return { obj, an, ed };
}
function updateEdgeHover(e) {
  const r = edgeAtPointer(e, pickHit(e));
  const key = r ? r.obj.userData.id + ':' + (r.virt ? r.virt.key : r.ed.key) : null;
  canvas.style.cursor = r ? 'pointer' : 'crosshair';
  if (key === edgeHoverKey) return;
  edgeHoverKey = key; dropLines(edgeHoverLine); edgeHoverLine = null;
  if (r) edgeHoverLine = makeLines([r.virt ? r.virt.chain : chainOf(r.an, r.ed)], edgeHoverMat);
  dirty = true;
}
function sameChain(a, b) { return a.obj === b.obj && a.chain.verts.length === b.chain.verts.length && new Set(a.chain.verts).size === new Set(b.chain.verts).size && b.chain.verts.every(v => a.chain.verts.includes(v)); }
function selectEdgeAt(hit, add) {
  pendCtx = null;
  const r = edgeAtPointer(null, hit);
  if (!r) { if (!add) clearEdges(); return; }
  const item = { obj: r.obj, chain: r.virt ? r.virt.chain : chainOf(r.an, r.ed) };
  const i = edgeSel.findIndex(x => sameChain(x, item));
  if (i >= 0) edgeSel.splice(i, 1);
  else if (add && edgeSel.every(x => x.obj === item.obj)) edgeSel.push(item);
  else edgeSel = [item];
  if (!selection.includes(item.obj)) setSelection([item.obj]);
  prefillEdgeSize(); refreshEdgeLines(); updateEdgePanel(); updateEdgeHandle();
}
function prefillEdgeSize() {                          // scatola: mostra misura e tipo già impostati sugli spigoli scelti
  const ks = edgeSel.map(x => x.chain.vkey); if (!ks.length || ks.some(k => !k)) return;
  const mp = edgeMapOf(edgeSel[0].obj.userData.kind, edgeSel[0].obj.userData.p), vs = ks.map(k => mp[k]);
  if (vs.every(v => v && v.r === vs[0].r && v.t === vs[0].t)) { EF.size.value = fmt(vs[0].r); edgeMode.v = vs[0].t === 'c' ? 'chamfer' : 'fillet'; } else EF.size.value = '';
}
function refreshEdgeLines() {
  dropLines(edgeLines); edgeLines = edgeSel.length ? makeLines(edgeSel.map(x => x.chain), edgeMat) : null;
  dirty = true;
}
function clearEdges() {
  stashCtx();
  edgeSel = []; refreshEdgeLines(); updateEdgeHandle(); dragRead.style.display = 'none';
  dropLines(edgeHoverLine); edgeHoverLine = null; edgeHoverKey = null;
}
const EF = { size: $('#e-size'), go: $('#e-go'), info: $('#e-info'), hint: $('#e-hint') };
function updateEdgePanel() {
  const n = edgeSel.length;
  EF.info.textContent = n ? `· ${n} ${n === 1 ? 'spigolo' : 'spigoli'}` : tr('· nessuno selezionato');
  EF.hint.textContent = n ? (edgeSel.every(x => x.chain.vkey) ? 'Scegli tipo e misura, poi Applica. Per cambiarlo dopo, riseleziona lo spigolo (con 0 lo togli).' : 'Scegli tipo e misura, poi Applica.') : 'Clicca uno spigolo. Con Maiusc ne scegli più di uno.';
  EF.go.disabled = !n;
  const lp = !!selectedLoop();
  $('#e-fillet-box').classList.toggle('dim', !n); $('#e-scale-box').classList.toggle('dim', !lp);
  $('#e-size').disabled = !n; $('#e-scale').disabled = !lp; $('#e-scale-go').disabled = !lp;
  const mi = moveInfo(); $('#e-move-box').classList.toggle('dim', !mi); $('#e-mv').disabled = !mi; $('#e-mv-colw').classList.toggle('hidden', !(mi && mi.horiz)); $('#e-mv-go').disabled = !mi;
  document.querySelectorAll('#e-mv-ax button').forEach(b => { const a = mi ? edgeMoveAxis(mi) : null; b.classList.toggle('on', b.dataset.v === a); b.disabled = !mi || b.dataset.v === mi.par || (b.dataset.v === 'n' && !mi.n); });
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
  const sp = new THREE.Sprite(mat); sp.scale.setScalar(0.024); fovSprites.push([sp, 0.024]); sp.renderOrder = 1000; sp.visible = false; scene.add(sp); return sp;
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
  const mi = state.tool === 'edge' ? moveInfo() : null;
  moveHandle.visible = !!mi; if (mi) moveHandle.position.copy(mi.c);
  dirty = true;
}
function ringTargets(ri) {                              // raggi degli altri anelli dello stesso pezzo (piani paralleli): per tornare a un cilindro, o uguagliare l'altro bordo
  const arr = worldPositions(ri.obj), best = new Map(), v = new THREE.Vector3();
  for (let i = 0; i < arr.length; i += 3) {
    v.set(arr[i], arr[i + 1], arr[i + 2]).sub(ri.c);
    const h = v.dot(ri.nrm); if (Math.abs(h) < 0.01) continue;
    const k = Math.round(h * 100), rad = v.addScaledVector(ri.nrm, -h).length();
    if (rad > (best.get(k) || 0)) best.set(k, rad);
  }
  return [...best.values()].filter(r => r > 0.05).map(r => r / ri.r0);
}
function startEdgeScale() { const ri = ringInfo(); return ri ? { ri, f: 1, cands: ringTargets(ri) } : null; }
function moveEdgeScale(e, es) {
  const { ri } = es;
  setRay(e);
  const p = raycaster.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(ri.nrm, ri.c), new THREE.Vector3());
  if (!p) return;
  let f = p.distanceTo(ri.c) / ri.r0;
  f = Math.round(clamp(f, 0.01, 10) * 100) / 100;
  let tag = '';
  if (Math.abs(f - 1) < 0.03) { f = 1; tag = 'come prima'; }
  if (state.magnet && !e.metaKey && !e.ctrlKey) {
    let bd = Math.max(0.03, 0.6 / ri.r0);
    for (const c of es.cands) if (Math.abs(f - c) < bd && c > 0.01) { bd = Math.abs(f - c); f = Math.round(c * 1000) / 1000; tag = 'uguale all\'altro anello'; }
  }
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
  dragRead.textContent = `${fmt(Math.round(f * 1000) / 10)} %${tag ? ' · ' + tr(tag) : ''}`;
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

/* ---------------------------------------------------- sposta spigolo (maniglia o mm): inclina o allunga una faccia */
const moveHandle = (() => {
  const mat = new THREE.SpriteMaterial({ map: handleTexture('#ff6a00'), sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true });
  const sp = new THREE.Sprite(mat); sp.scale.setScalar(0.024); fovSprites.push([sp, 0.024]); sp.renderOrder = 1000; sp.visible = false; scene.add(sp); return sp;
})();
const WAX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const ekey = (x, y, z) => Math.round(x * 2000) + ',' + Math.round(y * 2000) + ',' + Math.round(z * 2000);
function moveInfo() {                                   // spigoli scelti (non un anello): punti, centro e asse parallelo da escludere
  if (!edgeSel.length || edgeSel.some(x => x.obj !== edgeSel[0].obj) || selectedLoop()) return null;
  const seen = new Map(), c = new THREE.Vector3();
  edgeSel.forEach(x => x.chain.pts.forEach(p => seen.set(ekey(p.x, p.y, p.z), p)));
  const pts = [...seen.values()]; pts.forEach(p => c.add(p)); c.divideScalar(pts.length);
  let par = null;
  if (edgeSel.length === 1 && edgeSel[0].chain.pts.length === 2) {
    const d = edgeSel[0].chain.pts[1].clone().sub(edgeSel[0].chain.pts[0]).normalize();
    for (const a of 'xyz') if (Math.abs(d.dot(WAX[a])) > 0.999) par = a;
  }
  let n = null;                                          // spigolo orizzontale e storto (es. un lato dell'esagono): si può spostare anche in perpendicolare, verso l'esterno
  if (edgeSel.length === 1 && edgeSel[0].chain.pts.length === 2 && (!par || par === 'z')) {
    const d = edgeSel[0].chain.pts[1].clone().sub(edgeSel[0].chain.pts[0]).normalize();
    const bb = new THREE.Box3().setFromObject(edgeSel[0].obj), cc = bb.getCenter(new THREE.Vector3()), out = new THREE.Vector3(c.x - cc.x, c.y - cc.y, 0);
    if (Math.abs(d.z) < 0.02) {
      n = new THREE.Vector3(d.y, -d.x, 0).normalize();
      if (n.dot(out) < 0) n.negate();
    } else if (Math.abs(d.z) > 0.98 && out.length() > 1e-3) n = out.normalize();      // spigolo verticale: verso l'esterno
  }
  const horiz = edgeSel.length === 1 && edgeSel[0].chain.pts.length === 2 && Math.abs(edgeSel[0].chain.pts[1].z - edgeSel[0].chain.pts[0].z) < 1e-3;
  let rad = null, radRef = null;                         // più cerchi (anelli) selezionati: ⊥ allarga o stringe ogni cerchio attorno al suo centro
  if (edgeSel.length >= 2 && edgeSel.every(x => x.chain.closed && x.chain.pts.length >= 6)) {
    rad = new Map(); const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0); let bd = -Infinity;
    for (const x of edgeSel) {
      const P = x.chain.pts, cc = new THREE.Vector3(), nr = new THREE.Vector3();
      P.forEach(p => cc.add(p)); cc.divideScalar(P.length);
      for (let i = 0; i < P.length; i++) nr.add(P[i].clone().sub(cc).cross(P[(i + 1) % P.length].clone().sub(cc)));
      if (nr.lengthSq() < 1e-9) { rad = null; break; }
      nr.normalize();
      for (const p of P) {
        const d = p.clone().sub(cc); d.addScaledVector(nr, -d.dot(nr)); if (d.length() < 1e-6) continue; d.normalize();
        rad.set(ekey(p.x, p.y, p.z), d);
        const s = p.clone().sub(c).dot(right); if (s > bd) { bd = s; radRef = d.clone(); }
      }
    }
    if (rad && !radRef) rad = null;
  }
  return { obj: edgeSel[0].obj, pts, c, par: rad ? null : par, n: rad ? radRef : n, horiz: rad ? false : horiz, rad };
}
const dvOf = (mi, ax, k) => ax === 'n' && mi.rad ? (mi.rad.get(k) || new THREE.Vector3()) : axV(mi, ax);
const axV = (mi, ax) => ax === 'n' ? mi.n : WAX[ax];
const EM = { ax: null, col: true };
const xyKey = (x, y) => Math.round(x * 2000) + ',' + Math.round(y * 2000);
const useCol = (mi, ax) => EM.col && mi.horiz && ax !== 'z';        // parete dritta: si sposta tutta la colonna di vertici sotto/sopra lo spigolo
function edgeMoveAxis(mi) { if (EM.ax && EM.ax !== mi.par && (EM.ax !== 'n' || mi.n)) return EM.ax; if (mi.n) return 'n'; return 'xyz'.split('').find(a => a !== mi.par); }
function moveEdgeBy(mi, ax, mm) {                       // sposta davvero: i vertici dello spigolo, poi il pezzo diventa libero
  const obj = mi.obj, arr = worldPositions(obj), keys = new Set(mi.pts.map(p => ekey(p.x, p.y, p.z))), hit = new Set(), dv = axV(mi, ax), col = useCol(mi, ax), xys = col ? new Set(mi.pts.map(p => xyKey(p.x, p.y))) : null;
  for (let i = 0; i < arr.length; i += 3) {
    const k = ekey(arr[i], arr[i + 1], arr[i + 2]);
    if (keys.has(k) || (col && xys.has(xyKey(arr[i], arr[i + 1])))) { const d = keys.has(k) ? dvOf(mi, ax, k) : dv; arr[i] += d.x * mm; arr[i + 1] += d.y * mm; arr[i + 2] += d.z * mm; if (keys.has(k)) hit.add(k); }
  }
  if (hit.size < keys.size) { toast('Questo spigolo è arrotondato: per spostarlo togli prima l\'arrotondamento'); return false; }
  const baked = bakeResult(new THREE.Mesh(geometryFromPositions(arr)), obj.userData.name);
  if (!baked) { toast('Il risultato è vuoto'); return false; }
  const nm = replaceWithMerged(obj, baked, true);
  nm.userData.color = obj.userData.color ?? null;
  clearEdges(); setSelection([nm]); touch(); commit();
  toast(ax === 'n' ? `Spigolo spostato di ${fmt(mm)} mm in perpendicolare` : `Spigolo spostato di ${fmt(mm)} mm su ${ax.toUpperCase()}`);
  return true;
}
function startEdgeMove(e) {
  const mi = moveInfo(); if (!mi) return null;
  const obj = mi.obj, pos = obj.geometry.attributes.position, keys = new Set(mi.pts.map(p => ekey(p.x, p.y, p.z))), v = new THREE.Vector3(), idx = [], idxCol = [], rd = new Map(), hit = new Set(), xys = new Set(mi.pts.map(p => xyKey(p.x, p.y)));
  obj.updateMatrixWorld(true);
  const wg = obj.geometry.clone(); wg.applyMatrix4(obj.matrixWorld); const wpos = wg.attributes.position;   // stessa precisione (float32) dell'analisi degli spigoli, altrimenti i vertici non combaciano
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(wpos, i); const k = ekey(v.x, v.y, v.z); if (keys.has(k)) { idx.push(i); idxCol.push(i); hit.add(k); if (mi.rad) rd.set(i, mi.rad.get(k)); } else if (xys.has(xyKey(v.x, v.y))) idxCol.push(i); }
  wg.dispose();
  if (hit.size < keys.size) { toast('Questo spigolo è arrotondato: per spostarlo togli prima l\'arrotondamento'); return null; }
  const sc = new THREE.Vector2(), proj = p => { const q = p.clone().project(camera); return new THREE.Vector2((q.x * 0.5 + 0.5) * window.innerWidth, (-q.y * 0.5 + 0.5) * window.innerHeight); };
  const c0 = proj(mi.c), dirs = {};
  for (const a of (mi.n ? 'xyzn' : 'xyz')) if (a !== mi.par) { const d = proj(mi.c.clone().addScaledVector(axV(mi, a), 10)).sub(c0); dirs[a] = d; }
  return { mi, idx, idxCol, rd, orig: pos.array.slice(), origN: obj.geometry.attributes.normal ? obj.geometry.attributes.normal.array.slice() : null, sx: e.clientX, sy: e.clientY, dirs, ax: null, mm: 0, inv: new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().copy(obj.matrixWorld).invert()) };
}
function setEdgeMovePreview(em, mm) {
  const { mi } = em, idx = useCol(mi, em.ax) ? em.idxCol : em.idx, pos = mi.obj.geometry.attributes.position, dl = axV(mi, em.ax).clone().multiplyScalar(mm).applyMatrix3(em.inv);
  const radial = mi.rad && em.ax === 'n';
  for (const i of idx) {
    let d = dl; if (radial) { const r = em.rd.get(i); d = r ? r.clone().multiplyScalar(mm).applyMatrix3(em.inv) : new THREE.Vector3(); }
    pos.setXYZ(i, em.orig[i * 3] + d.x, em.orig[i * 3 + 1] + d.y, em.orig[i * 3 + 2] + d.z);
  }
  pos.needsUpdate = true; mi.obj.geometry.computeVertexNormals(); mi.obj.geometry.computeBoundingSphere(); mi.obj.geometry.computeBoundingBox();
  const sh = axV(mi, em.ax).clone().multiplyScalar(mm);
  dropLines(edgeLines); edgeLines = makeLines(edgeSel.map(x => ({ ...x.chain, pts: x.chain.pts.map(p => p.clone().addScaledVector(dvOf(mi, em.ax, ekey(p.x, p.y, p.z)), mm)) })), edgeMat);
  moveHandle.position.copy(mi.c.clone().add(sh));
  dirty = true;
}
function restoreEdgeMove(em) {
  const g = em.mi.obj.geometry; g.attributes.position.array.set(em.orig); g.attributes.position.needsUpdate = true;
  if (em.origN) { g.attributes.normal.array.set(em.origN); g.attributes.normal.needsUpdate = true; }
  g.computeBoundingSphere(); g.computeBoundingBox();
  refreshEdgeLines(); updateEdgeHandle();
}
function edgeMoveTargets(em) {                          // coordinate (lungo l'asse scelto) a cui lo spigolo si aggancia: dov'era, parallelo agli altri vertici del pezzo, altri oggetti
  const { mi } = em; if (em.ax === 'n') return [{ v: mi.c.dot(mi.n), t: 'orig' }];
  const k = 'xyz'.indexOf(em.ax), out = [{ v: mi.c[em.ax], t: 'orig' }], seen = new Set([Math.round(mi.c[em.ax] * 1000)]);
  const moved = new Set(mi.pts.map(p => ekey(p.x, p.y, p.z)));
  const add = (v, t) => { const q = Math.round(v * 1000); if (!seen.has(q)) { seen.add(q); out.push({ v, t }); } };
  const arr = worldPositions(mi.obj);
  for (let i = 0; i < arr.length; i += 3) if (!moved.has(ekey(arr[i], arr[i + 1], arr[i + 2]))) add(arr[i + k], 'self');
  for (const o of objects) { if (o === mi.obj || o.userData.hidden || out.length > 4000) continue; for (const c of worldCorners(o)) add(c[em.ax], 'other'); }
  return out;
}
const MAG_TAG = { orig: 'come prima', self: 'parallelo', other: 'allineato' };
function moveEdgeMove(e, em) {
  const dv = new THREE.Vector2(e.clientX - em.sx, e.clientY - em.sy);
  if (!em.ax) {                                         // l'asse si sceglie dalla direzione del primo tratto del trascinamento
    if (dv.length() < 6) return;
    let best = null, bs = 0.3;
    for (const [a, d] of Object.entries(em.dirs)) { if (d.length() < 8) continue; const sc = Math.abs(dv.dot(d)) / (dv.length() * d.length()); if (sc > bs) { bs = sc; best = a; } }
    if (!best) return;
    em.ax = best;
  }
  const d = em.dirs[em.ax];
  let mm = dv.dot(d) / (d.lengthSq()) * 10, tag = '';
  if (state.magnet && !e.metaKey && !e.ctrlKey) {       // calamita: torna com'era, si allinea ai vertici paralleli del pezzo o agli altri oggetti
    if (!em.targets) em.targets = edgeMoveTargets(em);
    const cv = em.ax === 'n' ? em.mi.c.dot(em.mi.n) : em.mi.c[em.ax], thr = Math.min(6, 90 / d.length()), cur = cv + mm;
    let best = null, bd = thr;
    for (const t of em.targets) { const dd = Math.abs(t.v - cur); if (dd < bd) { bd = dd; best = t; } }
    if (best) { mm = best.v - cv; tag = best.t; }
  }
  if (!tag) mm = snapV(mm);
  em.mm = mm;
  setEdgeMovePreview(em, mm);
  const v = em.mi.c.clone().addScaledVector(axV(em.mi, em.ax), mm).project(camera);
  dragRead.style.display = 'block';
  dragRead.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth + 18) + 'px';
  dragRead.style.top = ((-v.y * 0.5 + 0.5) * window.innerHeight - 12) + 'px';
  dragRead.textContent = `${em.ax === 'n' ? '⊥' : em.ax.toUpperCase()} ${mm > 0 ? '+' : ''}${fmt(mm)} mm${tag ? ' · ' + tr(MAG_TAG[tag]) : ''}`;
}
function endEdgeMove(em, moved) {
  dragRead.style.display = 'none';
  if (!moved || !em.ax || Math.abs(em.mm) < 1e-6) { if (em.ax) restoreEdgeMove(em); else updateEdgeHandle(); return; }
  restoreEdgeMove(em);                                  // si parte dal pezzo originale e si applica lo spostamento vero
  const mi = moveInfo(); if (mi) moveEdgeBy(mi, em.ax, em.mm);
}
$('#e-mv-col').addEventListener('change', e => { EM.col = e.target.checked; });
document.querySelectorAll('#e-mv-ax button').forEach(b => b.addEventListener('click', () => { EM.ax = b.dataset.v; updateEdgePanel(); }));
$('#e-mv-go').addEventListener('click', () => {
  const mi = moveInfo(); if (!mi) return;
  const mm = parseFloat(String($('#e-mv').value).replace(',', '.')), ax = edgeMoveAxis(mi);
  if (!mm) return toast('Scrivi di quanti mm spostare lo spigolo');
  if (ax === mi.par) return toast('Questa direzione è lungo lo spigolo: scegline un\'altra');
  if (heavyGuard([mi.obj])) return;
  if (moveEdgeBy(mi, ax, mm)) $('#e-mv').value = '';
});
$('#e-mv').addEventListener('keydown', e => { if (e.key === 'Enter') $('#e-mv-go').click(); });

function applyEdges() {
  const size = parseFloat(String(EF.size.value).replace(',', '.'));
  if (!edgeSel.length) return;
  const obj = edgeSel[0].obj;
  if (edgeSel.every(x => x.chain.vkey)) {              // scatola: spigoli singoli, restano modificabili
    const u = obj.userData, p = u.p, lim = edgeLimitOf(u.kind, p);
    if (!(size >= 0)) return toast('Scrivi una misura in mm (0 per togliere)');
    if (size > lim) return toast('La misura è troppo grande per questo pezzo: massimo ' + fmt(lim) + ' mm');
    const ed = {}; for (const [k, v] of Object.entries(edgeMapOf(u.kind, p))) ed[k] = v;     // i parametri globali diventano spigoli singoli
    for (const x of edgeSel) ed[x.chain.vkey] = size > 0 ? { r: size, t: edgeMode.v === 'chamfer' ? 'c' : 'f' } : { r: 0, t: 'f' };
    u.p = { ...p, ft: 0, fb: 0, rm: null, ed }; if (u.kind === 'box') u.p.r = 0;
    obj.geometry.dispose(); obj.geometry = buildGeometry(u.kind, u.p); refreshEdges(obj); obj.updateMatrixWorld(true);
    syncPanel(); touch(); commit(); dirty = true;
    const n = edgeSel.length;
    return toast(size === 0 ? `Tolto da ${n} ${n === 1 ? 'spigolo' : 'spigoli'}` : `${edgeMode.v === 'fillet' ? 'Arrotondamento' : 'Smusso'} di ${fmt(size)} mm su ${n} ${n === 1 ? 'spigolo' : 'spigoli'}: resta modificabile`);
  }
  if (!(size > 0)) return toast('Scrivi una misura in mm');
  if (heavyGuard([obj])) return;
  // i 4 spigoli verticali di una scatola: raccordo o smusso restano parametrici (stesso campo Raggio)
  if (obj.userData.kind === 'box' && edgeSel.length === 4 && !(obj.userData.p.r > 0.001)) {
    const u = obj.userData, corners = new Set(), tt = (u.p.t ?? 100) / 100; obj.updateMatrixWorld(true);
    const ok = edgeSel.every(x => {
      const P = x.chain.pts; if (P.length !== 2) return false;
      const L = P.map(p => obj.worldToLocal(p.clone())).sort((a, b) => a.z - b.z);
      if (Math.abs(L[0].z) > 0.01 || Math.abs(L[1].z - u.p.h) > 0.01) return false;
      if (!(Math.abs(Math.abs(L[0].x) - u.p.w / 2) < 0.01 && Math.abs(Math.abs(L[0].y) - u.p.d / 2) < 0.01)) return false;
      if (!(Math.abs(Math.abs(L[1].x) - u.p.w / 2 * tt) < 0.01 && Math.abs(Math.abs(L[1].y) - u.p.d / 2 * tt) < 0.01)) return false;
      if (Math.sign(L[0].x) !== Math.sign(L[1].x) || Math.sign(L[0].y) !== Math.sign(L[1].y)) return false;
      corners.add(Math.sign(L[0].x) + ',' + Math.sign(L[0].y)); return true;
    });
    if (ok && corners.size === 4) {
      if (size >= Math.min(u.p.w, u.p.d) / 2) return toast('La misura è troppo grande per questa scatola');
      u.p.r = size; u.p.rm = edgeMode.v === 'chamfer' ? 'chamfer' : null;
      obj.geometry.dispose(); obj.geometry = buildGeometry('box', u.p); refreshEdges(obj); obj.updateMatrixWorld(true);
      clearEdges(); setSelection([obj]); touch(); commit(); EF.size.value = '';
      return toast(edgeMode.v === 'fillet' ? 'Arrotondamento applicato: resta modificabile dal pannello' : 'Smusso applicato: resta modificabile dal pannello');
    }
  }
  // bordo alto o basso di una scatola (anello chiuso a Z = altezza o Z = 0): resta parametrico
  if (obj.userData.kind === 'box') {
    const loop = selectedLoop(), u = obj.userData, tt = (u.p.t ?? 100) / 100;
    if (loop && loop.length >= 4) {
      obj.updateMatrixWorld(true);
      const L = loop.map(p => obj.worldToLocal(p.clone()));
      const top = L.every(v => Math.abs(v.z - u.p.h) < 0.01), bot = L.every(v => Math.abs(v.z) < 0.01);
      const ex = Math.max(...L.map(v => Math.abs(v.x))), ey = Math.max(...L.map(v => Math.abs(v.y)));
      const kk = top ? tt : 1;
      if ((top || bot) && Math.abs(ex - u.p.w / 2 * kk) < 0.01 && Math.abs(ey - u.p.d / 2 * kk) < 0.01) {
        if (size >= Math.min(u.p.w, u.p.d) / 2 || size >= u.p.h) return toast('La misura è troppo grande per questa scatola');
        u.p[top ? 'ft' : 'fb'] = size; u.p.rm = edgeMode.v === 'chamfer' ? 'chamfer' : null;
        obj.geometry.dispose(); obj.geometry = buildGeometry('box', u.p); refreshEdges(obj); obj.updateMatrixWorld(true);
        clearEdges(); setSelection([obj]); touch(); commit(); EF.size.value = '';
        return toast(edgeMode.v === 'fillet' ? 'Arrotondamento applicato: resta modificabile dal pannello' : 'Smusso applicato: resta modificabile dal pannello');
      }
    }
  }
  // bordo alto o basso di un cilindro o di un cono (anello a Z = altezza o Z = 0): resta parametrico, come per la scatola
  if (['cylinder', 'cone'].includes(obj.userData.kind) && !obj.userData.p.ed) {
    const loop = selectedLoop(), u = obj.userData;
    if (loop && loop.length >= 8) {
      obj.updateMatrixWorld(true);
      const L = loop.map(p => obj.worldToLocal(p.clone()));
      const top = L.every(v => Math.abs(v.z - u.p.h) < 0.01), bot = L.every(v => Math.abs(v.z) < 0.01);
      if (top || bot) {
        const R = Math.max(...L.map(v => Math.hypot(v.x, v.y)));
        if (size >= R || size >= u.p.h) return toast('La misura è troppo grande per questo pezzo');
        u.p[top ? 'ft' : 'fb'] = size; u.p.rm = edgeMode.v === 'chamfer' ? 'chamfer' : null;
        obj.geometry.dispose(); obj.geometry = buildGeometry(u.kind, u.p); refreshEdges(obj); obj.updateMatrixWorld(true);
        clearEdges(); setSelection([obj]); touch(); commit(); EF.size.value = '';
        return toast(edgeMode.v === 'fillet' ? 'Arrotondamento applicato: resta modificabile dal pannello' : 'Smusso applicato: resta modificabile dal pannello');
      }
    }
  }
  const cutters = edgeSel.map(x => cutter(x.chain, edgeMode.v, size));
  if (cutters.some(g => !g)) return toast('Questo spigolo è troppo particolare per arrotondarlo');
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
  toast(`${edgeMode.v === 'fillet' ? 'Arrotondamento' : 'Smusso'} di ${fmt(size)} mm su ${n} ${n === 1 ? 'spigolo' : 'spigoli'}`);
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
const APP_VERSION = '0.10.0';
const infoDlg = $('#dlg-info');
$('#ver-num').textContent = APP_VERSION; $('#beta-ver').textContent = APP_VERSION;
$('#b-info').addEventListener('click', () => infoDlg.showModal());
$('#info-close').addEventListener('click', () => infoDlg.close());
infoDlg.addEventListener('click', e => { if (e.target === infoDlg) infoDlg.close(); });
initI18n();
Promise.race([document.fonts && document.fonts.ready, new Promise(r => setTimeout(r, 900))]).then(() => requestAnimationFrame(() => document.documentElement.classList.add('ui-ready')));
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
/* ------------------------------------------------------------ taglia con un piano */
var CUT = { ax: 'z', pos: 0, delta: 10 }, cutPlane = null;
function planeTool() { return state.tool === 'cut' || state.tool === 'stretch'; }
function cutAxisCenter() { const b = selBox(); return b.isEmpty() ? 0 : b.getCenter(new THREE.Vector3())[CUT.ax]; }
function cutEnsurePlane() {
  if (cutPlane) return cutPlane;
  const g = new THREE.Group(), pl = new THREE.PlaneGeometry(1, 1);
  const fill = new THREE.Mesh(pl, new THREE.MeshBasicMaterial({ color: 0xff6a00, opacity: 0.16, transparent: true, side: THREE.DoubleSide, depthTest: false, depthWrite: false }));
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(pl), new THREE.LineBasicMaterial({ color: 0xff6a00, depthTest: false, transparent: true }));
  fill.renderOrder = edge.renderOrder = 950; edge.raycast = () => {};
  g.add(fill, edge); g.visible = false; scene.add(g); return (cutPlane = g);
}
function cutRefresh() {                                        // piano di anteprima: segue asse, posizione e ingombro della selezione
  const g = cutEnsurePlane(), on = planeTool() && selection.length > 0;
  g.visible = on; dirty = true;
  if (!on) return;
  const b = selBox(), c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3()), ax = CUT.ax, m = 8;
  g.rotation.set(0, 0, 0);
  if (ax === 'x') { g.rotation.y = Math.PI / 2; g.scale.set(sz.z + m, sz.y + m, 1); g.position.set(CUT.pos, c.y, c.z); }
  else if (ax === 'y') { g.rotation.x = Math.PI / 2; g.scale.set(sz.x + m, sz.z + m, 1); g.position.set(c.x, CUT.pos, c.z); }
  else { g.scale.set(sz.x + m, sz.y + m, 1); g.position.set(c.x, c.y, CUT.pos); }
}
function cutReset() { CUT.pos = Math.round(cutAxisCenter() * 100) / 100; $('#cut-pos').value = fmt(CUT.pos); cutRefresh(); }
function cutToolChanged() {
  $('#cut-card').classList.toggle('hidden', !planeTool());
  if (planeTool()) {
    const st = state.tool === 'stretch';
    $('#cut-title').innerHTML = tr(st ? 'Allunga' : 'Taglia') + '<i class="inf" aria-hidden="true">?</i>'; $('#cut-go').textContent = tr(st ? 'Applica' : 'Taglia');
    $('#cut-delta-wrap').classList.toggle('hidden', !st); $('#cut-title').dataset.help = st ? 'Trascina il piano per scegliere da dove allungare. Tutto quello che sta oltre il piano si sposta: un numero positivo allunga, uno negativo accorcia.' : 'Scegli l\'asse e la posizione del piano. Puoi trascinare il piano o cliccare sull\'oggetto. Alla fine hai due oggetti separati.';
    cutReset(); if (!selection.length) toast(st ? 'Seleziona l\'oggetto da allungare, poi scegli il piano' : 'Seleziona l\'oggetto da tagliare, poi scegli il piano');
  } else cutRefresh();
}
function cutPlaneHit(e) { if (!cutPlane || !cutPlane.visible) return false; setRay(e); cutPlane.updateMatrixWorld(true); return !!raycaster.intersectObject(cutPlane.children[0], false)[0]; }
function cutAxisParam(e, p00) {                                     // punto dell'asse (retta per il centro del piano) più vicino al raggio del mouse
  setRay(e);
  const o = raycaster.ray.origin, d = raycaster.ray.direction, a = WAX[CUT.ax], p0 = p00 || cutPlane.position.clone();
  const w = o.clone().sub(p0), b = d.dot(a), den = 1 - b * b;
  if (den < 1e-4) return null;                                 // asse quasi verso la camera: non si può trascinare
  return (a.dot(w) - b * d.dot(w)) / den;
}
function startCutMove(e) { const p0 = cutPlane.position.clone(), t = cutAxisParam(e, p0); return t === null ? null : { t0: t, pos0: CUT.pos, p0 }; }   // l'origine resta quella di inizio: se seguisse il piano in movimento, il piano vibrerebbe
function moveCutMove(e, cm) {
  const t = cutAxisParam(e, cm.p0); if (t === null) return;
  const b = selBox(); let v = snapV(cm.pos0 + (t - cm.t0));
  v = clamp(v, b.min[CUT.ax] - 5, b.max[CUT.ax] + 5);
  CUT.pos = Math.round(v * 100) / 100; $('#cut-pos').value = fmt(CUT.pos); cutRefresh();
  dragRead.style.display = 'block'; dragRead.style.left = e.clientX + 18 + 'px'; dragRead.style.top = e.clientY - 12 + 'px';
  dragRead.textContent = `${CUT.ax.toUpperCase()} ${fmt(CUT.pos)} mm`;
}
function cutClick(hit) {                                       // un clic sull'oggetto mette il piano in quel punto
  if (!hit) return;
  if (!selection.includes(hit.object)) { const keep = CUT.pos; setSelection(withGroups([hit.object])); CUT.pos = keep; }
  let v = hit.point[CUT.ax]; if (state.snap) v = snapV(v);
  CUT.pos = Math.round(v * 100) / 100; $('#cut-pos').value = fmt(CUT.pos); cutRefresh();
}
document.querySelectorAll('#cut-ax button').forEach(b => b.addEventListener('click', () => {
  CUT.ax = b.dataset.v; b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); cutReset(); canvas.focus();
}));
$('#cut-pos').addEventListener('input', () => { const v = parseFloat($('#cut-pos').value); if (isFinite(v)) { CUT.pos = v; cutRefresh(); } });
$('#cut-pos').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('#cut-go').click(); });
async function planeCut() {
  if (trisOf(selection) > 20000) return busyRun('Taglio l\'oggetto…', planeCutNow);
  return planeCutNow();
}
function planeCutNow() {
  const list = selection.slice();
  if (!list.length) return toast('Seleziona prima un oggetto');
  if (heavyGuard(list)) return;
  const ax = CUT.ax, pos = CUT.pos, made = [], BIG = 8000;
  let cutN = 0;
  const half = (m, side) => {                                  // tiene la metà dalla parte 'side' togliendo con un blocco enorme l'altra
    const c = new Brush(new THREE.BoxGeometry(BIG, BIG, BIG), M.solid);
    c.position[ax] = pos - side * BIG / 2; c.updateMatrixWorld(true);
    m.updateMatrixWorld(true);
    const nm = `${m.userData.name} ${side < 0 ? 1 : 2}`, mh = window.__noManifold ? null : manifoldHalf(m, ax, pos, side, M.solid);
    if (mh) return bakeResult(mh, nm);
    return bakeResult(evaluator.evaluate(m, c, SUBTRACTION), nm);
  };
  for (const m of list) {
    const b = worldBox(m);
    if (pos <= b.min[ax] + 1e-3 || pos >= b.max[ax] - 1e-3) { made.push(m); continue; }   // il piano non attraversa l'oggetto
    const lo = half(m, -1), hi = half(m, 1);
    if (!lo || !hi) { made.push(m); continue; }
    const ghost = { userData: { ...m.userData, kind: 'merged' } };
    replaceWithMerged(m, lo, true); made.push(...lastPieces);
    replaceWithMerged(ghost, hi, true); made.push(...lastPieces);
    cutN++;
  }
  if (!cutN) return toast('Il piano non attraversa nessun oggetto selezionato');
  setSelection(made); touch(); commit(); cutReset();
  toast(cutN === 1 ? 'Oggetto tagliato in due' : `Tagliati ${cutN} oggetti`);
}
$('#cut-delta').addEventListener('input', () => { const v = parseFloat($('#cut-delta').value); if (isFinite(v)) CUT.delta = v; });
$('#cut-delta').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('#cut-go').click(); });
/* allunga / accorcia: i triangoli che attraversano il piano vengono divisi, poi i punti oltre il piano si spostano (con delta negativo si toglie la fetta tra pos+delta e pos) */
function splitAtPlane(T, k, v) {                        // T = array piatto di triangoli (9 numeri ciascuno)
  const out = [], E = 1e-6, A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const lerp = (a, b) => { const t = (v - a[k]) / (b[k] - a[k]), r = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; r[k] = v; return r; };
  const push = (a, b, c) => out.push(...a, ...b, ...c);
  for (let i = 0; i < T.length; i += 9) {
    const P = [[T[i], T[i + 1], T[i + 2]], [T[i + 3], T[i + 4], T[i + 5]], [T[i + 6], T[i + 7], T[i + 8]]], d = P.map(q => q[k] - v);
    const pos = d.filter(x => x > E).length, neg = d.filter(x => x < -E).length;
    if (!pos || !neg) { push(...P); continue; }
    // vertice isolato = quello da solo dalla sua parte (l'altro lato può avere anche vertici sul piano)
    const lone = pos === 1 && neg >= 1 ? d.findIndex(x => x > E) : neg === 1 && pos >= 1 ? d.findIndex(x => x < -E) : -1;
    const a = P[lone >= 0 ? lone : 0], b = P[((lone >= 0 ? lone : 0) + 1) % 3], c = P[((lone >= 0 ? lone : 0) + 2) % 3];
    if (lone < 0) { push(...P); continue; }
    const db = (lone + 1) % 3, dc = (lone + 2) % 3;
    if (Math.abs(d[db]) <= E) { const m = lerp(a, c); push(a, b, m); push(b, c, m); }              // b sul piano: basta un taglio verso c
    else if (Math.abs(d[dc]) <= E) { const m = lerp(a, b); push(a, m, c); push(m, b, c); }
    else { const m1 = lerp(a, b), m2 = lerp(a, c); push(a, m1, m2); push(m1, b, c); push(m1, c, m2); }
  }
  return out;
}
function stretchPositions(world, k, pos, delta) {
  const L = delta < 0 ? pos + delta : pos, H = pos, E = 1e-5;
  if (delta > 0) { const T = Float32Array.from(world); for (let i = k; i < T.length; i += 3) if (T[i] >= H - E) T[i] += delta; return T; }   // ogni vertice oltre il piano scorre: le pareti si allungano
  let T = splitAtPlane(world, k, H);
  T = splitAtPlane(T, k, L);
  const out = [];
  for (let i = 0; i < T.length; i += 9) {
    const c = [T[i + k], T[i + 3 + k], T[i + 6 + k]];
    if (c.every(x => x <= L + E)) { out.push(...T.slice(i, i + 9)); continue; }
    if (c.every(x => x >= H - E)) { const t = T.slice(i, i + 9); for (let j = 0; j < 3; j++) t[j * 3 + k] += delta; out.push(...t); continue; }
    if (delta > 0) { const t = T.slice(i, i + 9); for (let j = 0; j < 3; j++) if (t[j * 3 + k] >= H - E) t[j * 3 + k] += delta; out.push(...t); }    // parete a cavallo del piano: si allunga
    // con delta negativo i triangoli dentro la fetta vengono tolti
  }
  return Float32Array.from(out);
}
async function stretchSel() {
  if (trisOf(selection) > 20000) return busyRun('Allungo la parte…', stretchNow);
  return stretchNow();
}
function stretchNow() {
  const list = selection.slice(), k = 'xyz'.indexOf(CUT.ax), pos = CUT.pos, delta = CUT.delta;
  if (!list.length) return toast('Seleziona prima un oggetto');
  if (!delta) return toast('Scrivi di quanti millimetri allungare (negativo per accorciare)');
  if (heavyGuard(list)) return;
  const made = []; let n = 0;
  for (const m of list) {
    const b = worldBox(m);
    if (pos <= b.min[CUT.ax] + 1e-3 || pos >= b.max[CUT.ax] - 1e-3) { made.push(m); continue; }
    if (delta < 0 && pos + delta <= b.min[CUT.ax] + 0.1) { toast('Si può accorciare al massimo fino a ' + fmt(pos - b.min[CUT.ax] - 0.1) + ' mm'); made.push(m); continue; }
    m.updateMatrixWorld(true);
    const g = m.geometry, idx = g.index, pa = g.attributes.position, nI = idx ? idx.count : pa.count, v = new THREE.Vector3(), W = new Float32Array(nI * 3);
    for (let i = 0; i < nI; i++) { v.fromBufferAttribute(pa, idx ? idx.getX(i) : i).applyMatrix4(m.matrixWorld); W[i * 3] = v.x; W[i * 3 + 1] = v.y; W[i * 3 + 2] = v.z; }
    let res = null;
    if (!window.__noManifold) res = manifoldStretch(m, CUT.ax, pos, delta, M.solid);
    let bk = null;
    if (res) bk = bakeResult(res, m.userData.name);
    else {
      const arr = stretchPositions(W, k, pos, delta);
      if (!arr.length) { made.push(m); continue; }
      bk = bakeResult({ updateMatrixWorld() {}, matrixWorld: new THREE.Matrix4(), geometry: geometryFromPositions(arr) }, m.userData.name);
    }
    if (!bk) { made.push(m); continue; }
    replaceWithMerged(m, bk, true); made.push(...lastPieces); n++;
  }
  if (!n) return;
  setSelection(made); touch(); commit(); cutReset();
  toast(delta > 0 ? `Allungato di ${fmt(delta)} mm` : `Accorciato di ${fmt(-delta)} mm`);
}
$('#cut-go').addEventListener('click', () => { if (state.tool === 'stretch') stretchSel(); else planeCut(); canvas.focus(); });
/* sfumatura ai bordi dei pannelli che scorrono */
function scrollFade(el) {
  const upd = () => { el.classList.toggle('fade-t', el.scrollTop > 4); el.classList.toggle('fade-b', el.scrollTop + el.clientHeight < el.scrollHeight - 4); };
  el.addEventListener('scroll', upd, { passive: true });
  new ResizeObserver(upd).observe(el);
  new MutationObserver(upd).observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  window.addEventListener('resize', upd); upd();
}
scrollFade($('#tools')); scrollFade($('#p-scroll'));


/* ---------------------------------------------------------- controlla stampa */
const chk = { R: null, ov: null, plane: null, timer: 0, busy: false };
const dlgChk = $('#dlg-check');
const fmtMin = m => m < 60 ? `${Math.max(1, Math.round(m))} min` : `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min`;
function chkClear() {
  if (chk.R && chk.R.dispose) chk.R.dispose();
  chk.R = null;
  for (const k of ['ov', 'plane']) if (chk[k]) { scene.remove(chk[k]); chk[k].geometry.dispose(); chk[k].material.dispose(); chk[k] = null; }
  dirty = true;
}
function chkDraw(i) {
  const R = chk.R; if (!R || !R.U) return;
  const cv = $('#chk-cv'), ctx = cv.getContext('2d'), t = thinAt(R, i), css = getComputedStyle(document.documentElement);
  ctx.clearRect(0, 0, cv.width, cv.height);
  const bx = R.bb, w = Math.max(bx.max[0] - bx.min[0], 1), h = Math.max(bx.max[1] - bx.min[1], 1), pad = 26, k = Math.min((cv.width - 2 * pad) / w, (cv.height - 2 * pad) / h);
  const X = x => pad + (x - bx.min[0]) * k + (cv.width - 2 * pad - w * k) / 2, Y = y => cv.height - (pad + (y - bx.min[1]) * k + (cv.height - 2 * pad - h * k) / 2);
  const path = polys => { ctx.beginPath(); for (const p of polys) { p.forEach((q, j) => j ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1]))); ctx.closePath(); } };
  ctx.fillStyle = 'rgba(255,106,0,.28)'; ctx.strokeStyle = '#ff6a00'; ctx.lineWidth = 2;
  path(t.polys); ctx.fill('evenodd'); ctx.stroke();
  if (t.thin.length) { ctx.fillStyle = 'rgba(229,72,77,.85)'; ctx.strokeStyle = '#e5484d'; ctx.lineWidth = 3; path(t.thin); ctx.fill('nonzero'); ctx.stroke(); }
  $('#chk-rd').textContent = `Strato ${i + 1} / ${R.layers} · ${(t.z).toFixed(2).replace('.', ',')} mm${t.thin.length ? ' · ' + tr('parete sottile') : ''}`;
  if (chk.plane) { chk.plane.position.z = t.z; dirty = true; }
}
function chkShow() {
  const R = chk.R, L = $('#chk-list'); L.innerHTML = '';
  const row = (cls, title, text) => { const li = document.createElement('li'); li.className = cls; li.innerHTML = `<i></i><div><b>${tr(title)}</b><span>${text}</span></div>`; L.appendChild(li); };
  const bad = R.open.length;
  if (bad) row('b', 'Solido non chiuso', `${R.open.map(esc).join(', ')}: ${tr('ha crepe o facce sovrapposte, lo slicer potrebbe sbagliare. Rifai l\'ultima operazione o ricostruisci il pezzo.')}`);
  else row('', 'Solido chiuso', tr('Nessuna crepa: lo slicer lo legge come un oggetto pieno.'));
  if (R.U) {
    if (R.floating.length) row('b', 'Pezzo sospeso', `${R.floating.length} ${tr(R.floating.length === 1 ? 'parte non tocca il piatto' : 'parti non toccano il piatto')} (${tr('più in basso')}: ${R.floating[0].z.toFixed(1).replace('.', ',')} mm). ${tr('Senza supporti non si stampa.')}`);
    else row('', R.parts > 1 ? 'Parti separate ma tutte sul piatto' : 'Poggia sul piatto', `${tr('Base a contatto')}: ${Math.round(R.first)} mm².`);
    if (R.first < 20 && !R.floating.length) row('w', 'Base molto piccola', tr('Poca superficie a contatto: il pezzo potrebbe staccarsi. Valuta un brim o un appoggio più largo.'));
    if (R.thin.layers) row('w', 'Pareti sottili', `${tr('In')} ${R.thin.layers} ${tr('strati controllati su')} ${R.thin.scanned} ${tr('ci sono parti sotto')} ${String(R.minWall).replace('.', ',')} mm (${tr('prima a')} ${R.thin.first.toFixed(1).replace('.', ',')} mm). ${tr('Scorri lo strato: sono in rosso.')}`);
    else row('', 'Pareti abbastanza spesse', `${tr('Niente sotto')} ${String(R.minWall).replace('.', ',')} mm.`);
    const pc = R.over.area / Math.max(R.over.total, 1) * 100;
    if (R.over.area > 8) row(pc > 8 ? 'w' : '', 'Sbalzi oltre 45°', `${Math.round(R.over.area)} mm² (${pc.toFixed(1).replace('.', ',')} %): ${tr(pc > 8 ? 'servono probabilmente i supporti, o ruota il pezzo.' : 'pochi, di solito si stampano bene.')}`);
    else row('', 'Nessuno sbalzo critico', tr('Niente facce che sporgono troppo.'));
    const b = R.bb;
    const f1 = n => n.toFixed(1).replace('.', ',');
    $('#chk-est').innerHTML = `<span><em>${tr('Strati')}</em>${R.layers}</span><span><em>${tr('Altezza')}</em>${f1(b.max[2])} mm</span><span><em>${tr('Peso')}</em>${R.grams.toFixed(R.grams < 10 ? 1 : 0).replace('.', ',')} g</span><span><em>${tr('Tempo')}</em>${fmtMin(R.minutes)}</span>`;
  } else $('#chk-est').innerHTML = '';
}
async function chkRun() {
  if (chk.busy) return; chk.busy = true;
  $('#chk-wait').classList.remove('hidden'); $('#chk-body').classList.add('hidden');
  await new Promise(r => setTimeout(r, 30));
  chkClear();
  const list = checkList();
  if (!list.length) { toast('Niente da controllare: aggiungi almeno un solido'); chk.busy = false; dlgChk.close(); return; }
  try { chk.R = buildCheck(list, { layer: parseFloat($('#chk-lh').dataset.v), minWall: parseFloat($('#chk-mw').dataset.v) }); } catch (e) { console.warn(e); chk.R = { err: 'Non sono riuscito ad analizzare il pezzo', open: [] }; }
  const R = chk.R;
  if (R.err) { toast(R.err); chk.busy = false; return; }
  $('#chk-wait').classList.add('hidden'); $('#chk-body').classList.remove('hidden');
  const has = !!R.U;
  $('.chk-prev').classList.toggle('hidden', !has);
  if (has) {
    const sl = $('#chk-sl'); sl.max = R.layers - 1; if (!(+sl.value <= +sl.max)) sl.value = 0;
    if (R.over.pos.length) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(R.over.pos, 3));
      chk.ov = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xe5484d, transparent: true, opacity: .75, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      chk.ov.renderOrder = 3; chk.ov.visible = $('#chk-ov').checked; scene.add(chk.ov);
    }
    const bx = R.bb, pg = new THREE.PlaneGeometry(bx.max[0] - bx.min[0] + 6, bx.max[1] - bx.min[1] + 6);
    chk.plane = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: 0xff6a00, transparent: true, opacity: .16, side: THREE.DoubleSide, depthWrite: false }));
    chk.plane.position.set((bx.min[0] + bx.max[0]) / 2, (bx.min[1] + bx.max[1]) / 2, 0); chk.plane.renderOrder = 2; scene.add(chk.plane);
    chkDraw(Math.min(+sl.value, R.layers - 1));
  }
  chkShow(); dirty = true; chk.busy = false;
}
window.__chkStale = () => { if (!dlgChk.open) return; clearTimeout(chk.timer); chk.timer = setTimeout(chkRun, 700); };
function openCheck() { if (!dlgChk.open) dlgChk.show(); chkRun(); }
$('#b-check').addEventListener('click', () => dlgChk.open ? dlgChk.close() : openCheck());
$('#chk-x').addEventListener('click', () => dlgChk.close());
dlgChk.addEventListener('close', () => { clearTimeout(chk.timer); chkClear(); });
$('#chk-sl').addEventListener('input', e => chkDraw(+e.target.value));
for (const id of ['#chk-lh', '#chk-mw']) $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const g = $(id); g.dataset.v = b.dataset.v; g.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); chkRun(); });
{ const hd = $('#chk-drag'); let d = null;
  hd.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; const r = dlgChk.getBoundingClientRect(); d = { dx: e.clientX - r.left, dy: e.clientY - r.top }; hd.setPointerCapture(e.pointerId); hd.classList.add('drag'); });
  hd.addEventListener('pointermove', e => { if (!d) return; const w = dlgChk.offsetWidth; const x = Math.max(8, Math.min(innerWidth - w - 8, e.clientX - d.dx)), y = Math.max(8, Math.min(innerHeight - 60, e.clientY - d.dy)); dlgChk.style.left = x + 'px'; dlgChk.style.top = y + 'px'; dlgChk.style.right = 'auto'; dlgChk.style.maxHeight = (innerHeight - y - 16) + 'px'; });
  const up = () => { d = null; hd.classList.remove('drag'); }; hd.addEventListener('pointerup', up); hd.addEventListener('pointercancel', up); }
$('#chk-ov').addEventListener('change', e => { if (chk.ov) { chk.ov.visible = e.target.checked; dirty = true; } });


/* ------------------------------------------ ultimo lavoro: salvataggio automatico nel browser e avviso prima di ricaricare */
const IDB = { db: null };
function idb() {
  return IDB.db || (IDB.db = new Promise((res, rej) => { try { const r = indexedDB.open('filo', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }));
}
const idbGet = k => idb().then(db => new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }));
const idbSet = (k, v) => idb().then(db => new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }));
const idbDel = k => idb().then(db => new Promise(res => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(k); tx.oncomplete = () => res(); tx.onerror = () => res(); }));
let saveTimer = 0;
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveLast, 1500); }
function saveLast() {
  if (!objects.length) return;                                       // un'area vuota non cancella l'ultimo lavoro
  try {
    const list = objects.map(m => {
      const d = entryOf(m); d.hidden = !!m.userData.hidden; d.locked = !!m.userData.locked;
      if (d.kind === 'merged' && d.geo) { const g = d.geo; d.geo = { pos: g.attributes.position.array.slice(), nor: g.attributes.normal ? g.attributes.normal.array.slice() : null, idx: g.index ? g.index.array.slice() : null }; }
      return d;
    });
    idbSet('last', { t: Date.now(), n: objects.length, nextId, nextGid, list }).catch(() => {});
  } catch (e) { console.warn('salvataggio', e); }
}
function geoFromSaved(s) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(s.pos, 3));
  if (s.nor) g.setAttribute('normal', new THREE.BufferAttribute(s.nor, 3));
  if (s.idx) g.setIndex(new THREE.BufferAttribute(s.idx, 1));
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}
async function restoreLast() {
  let s; try { s = await idbGet('last'); } catch (e) { return false; }
  if (!s || !s.list || !s.list.length) return false;
  [...objects].forEach(removeMesh);
  s.list.forEach(d => { if (d.kind === 'merged') d.geo = geoFromSaved(d.geo); makeMesh(d); });
  nextId = Math.max(nextId, s.nextId || 1, ...objects.map(o => o.userData.id + 1)); nextGid = Math.max(nextGid, s.nextGid || 1);
  setSelection([]); touch(); commit(); fitView();
  unsaved = false;
  toast(`${tr("Ripreso l'ultimo lavoro")}: ${s.n} ${tr(s.n === 1 ? 'pezzo' : 'pezzi')}`);
  return true;
}
function ago(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return tr('adesso');
  if (m < 60) return `${m} ${tr('min fa')}`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} ${tr(h === 1 ? 'ora fa' : 'ore fa')}`;
  return new Date(t).toLocaleDateString(getLang() === 'en' ? 'en-GB' : 'it-IT', { day: 'numeric', month: 'short' });
}
async function offerResume() {
  let s; try { s = await idbGet('last'); } catch (e) { return; }
  const sec = $('#ew-resume');
  if (!s || !s.list || !s.list.length || objects.length) { sec.classList.add('hidden'); return; }
  const names = s.list.slice(0, 3).map(d => d.name).join(', ') + (s.list.length > 3 ? '…' : '');
  $('#ew-resume-t').textContent = `${s.n} ${tr(s.n === 1 ? 'pezzo' : 'pezzi')} · ${ago(s.t)} · ${names}`;
  sec.classList.remove('hidden');
}
window.addEventListener('beforeunload', e => { if (unsaved && objects.length) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && unsaved) saveLast(); });
$('#ew-resume').addEventListener('click', async e => {
  const b = e.target.closest('[data-eh]'); if (!b) return;
  e.stopPropagation();
  if (b.dataset.eh === 'resume') { if (!(await restoreLast())) toast('Non c\'è niente da riprendere'); }
  else if (b.dataset.eh === 'resume-del') { await idbDel('last'); $('#ew-resume').classList.add('hidden'); toast('Lavoro salvato eliminato'); }
});
offerResume();

window.forma = { restoreLast, saveLast, offerResume, openCheck, chk, MM: manifoldMod, evaluator, Brush, buildGeometry, combineBrushes, bakeResult, THREE, M, moveInfo, moveEdgeBy, startEdgeMove, moveEdgeMove, endEdgeMove, moveHandle, stretchNow, openEdgeCount, planeCut, CUT, ensureSnap, snapFaces, separateSelection, getPrintCfg: () => printCfg, applyEdgeScale, updateEdgeHandle, edgeHandle, edgeSel: () => edgeSel, selectEdgeAt, applyEdges, edgeMode, edgeAnalysis, chainOf, cutter, nearestEdge, askExport, importFiles, parse3MF, computeFace, applyPush, selectFaceFromHit, get faceSel() { return faceSel; }, get faceSet() { return faceSet; }, setTool, setSnap, objects, state, cam, createObject, combine, intersect, openCtx, layOnPlate, setSelection, exportSTL, alignSelection, buildBoxModel, undo, redo, setDims, worldBox, sizeOf, get selection() { return selection; }, get keyObj() { return keyObj; }, set keyObj(v) { keyObj = v; }, HANDLES, camera, canvas, fitView, export3MF, build3MF, rotateSelection, setEulerDeg, startRot, groupSelection, ungroupSelection, updateFaceHandle, prismPush, replaceWithMerged, setBed, get bed() { return [BEDX, BEDY]; }, duplicateSelection, toggleHole, repeatSelection };


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
let layerAnchor = null;
layersList.addEventListener('click', e => {
  const tb = e.target.closest('.lbt');
  if (tb) {
    const d = tb.dataset, list = (d.lg || d.vg) ? objects.filter(o => o.userData.gid === +(d.lg || d.vg)) : objects.filter(o => o.userData.id === +(d.lo || d.vo));
    const key = (d.lg || d.lo) ? 'locked' : 'hidden', val = !list.every(o => o.userData[key]);
    list.forEach(o => { o.userData[key] = val; o.visible = !o.userData.hidden; });
    setSelection(selection.filter(o => o.visible && !o.userData.locked));
    touch(); renderLayers(); dirty = true; commit();
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
  const key = r.dataset.g ? 'g' + r.dataset.g : 'i' + r.dataset.id;
  if (!layerAnchor && selection[0]) layerAnchor = 'i' + selection[0].userData.id;
  if ((e.metaKey || e.ctrlKey) && layerAnchor) {
    const rows = [...layersList.querySelectorAll('.lrow')], keyOf = x => x.dataset.g ? 'g' + x.dataset.g : 'i' + x.dataset.id;
    const a = rows.findIndex(x => keyOf(x) === layerAnchor), b = rows.indexOf(r);
    if (a >= 0 && b >= 0) {
      const set = new Set();
      rows.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => {
        if (x.dataset.g) objects.filter(o => o.userData.gid === +x.dataset.g).forEach(o => set.add(o));
        else { const o = objects.find(o => o.userData.id === +x.dataset.id); if (o) set.add(o); }
      });
      setSelection([...set].filter(o => o.visible && !o.userData.locked));
      return;
    }
  }
  layerAnchor = key;
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
  inp.value = tr(m.userData.name); inp.className = 'lren'; inp.spellcheck = false;
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
  const dlg = $('#dlg-help'), nav = $('#hp-nav'), main = $('#hp-main');
  let cur = 'start';
  const render = () => {
    const lg = getLang(), items = HELP[lg], gr = GROUPS[lg];
    nav.innerHTML = Object.keys(gr).map(g => {
      const its = items.filter(x => x.g === g);
      return its.length ? `<div class="hp-g">${gr[g]}</div>` + its.map(x => `<button data-id="${x.id}" class="${x.id === cur ? 'on' : ''}">${x.t}</button>`).join('') : '';
    }).join('');
    const it = items.find(x => x.id === cur) || items[0];
    const body = it.h.replace(/\{\{img:([^|}]+)\|([^}]*)\}\}/g, (_, n, c) => IMG[n] ? `<figure><img src="${IMG[n]}" alt="${c.replace(/"/g, '')}" loading="lazy"><figcaption>${c}</figcaption></figure>` : '');
    main.innerHTML = `<h2>${it.t}</h2>` + plat(body, false);
    main.scrollTop = 0;
    const i = items.indexOf(it), pv = items[i - 1], nx = items[i + 1];
    main.insertAdjacentHTML('beforeend', `<div class="hp-pn">${pv ? `<button data-id="${pv.id}">← ${pv.t}</button>` : '<span></span>'}${nx ? `<button data-id="${nx.id}">${nx.t} →</button>` : ''}</div>`);
  };
  const open = id => { if (id) cur = id; render(); if (!dlg.open) dlg.showModal(); };
  document.addEventListener('click', e => { const b = e.target.closest('#hp-nav button, .hp-pn button'); if (b) { cur = b.dataset.id; render(); } });
  document.addEventListener('click', e => { if (e.target.closest('[data-lang]') && dlg.open) setTimeout(render, 0); });
  $('#help-open').addEventListener('click', () => open());
  $('#hp-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  window.addEventListener('keydown', e => {
    const t = e.target, typing = t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
    if (e.key === 'F1' || (e.key === '?' && !typing && !e.metaKey && !e.ctrlKey)) { e.preventDefault(); e.stopPropagation(); dlg.open ? dlg.close() : open(); }
  }, true);
  window.openHelp = open;
})();


/* -------------------------------------------------------------- benvenuto */
I.help = '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5M12 16.6v.1"/>';
I.import = '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M4 19h16"/>';
document.querySelectorAll('#empty-hint [data-ic]').forEach(el => el.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 24 24">${I[el.dataset.ic] || ''}</svg>`));
$('#empty-hint').addEventListener('click', e => {
  const b = e.target.closest('[data-eh]');
  if (!b) return;
  const a = b.dataset.eh;
  if (a === 'resume' || a === 'resume-del') return;
  if (a === 'text') addText();
  else if (a === 'import') $('#file-in').click();
  else if (a === 'help') window.openHelp();
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
