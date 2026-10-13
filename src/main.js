import { initI18n } from './i18n.js';
import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { mergeVertices, mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { unzipSync, zipSync, strToU8 } from 'three/addons/libs/fflate.module.js';
import { Brush, Evaluator, ADDITION, SUBTRACTION } from 'three-bvh-csg';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { analyze, nearestEdge, chainOf, cutter } from './edges.js';
import { FONTS, fontById, addUserFont, textPositions, svgItems } from './textgen.js';

THREE.Object3D.DEFAULT_UP.set(0, 0, 1); // Z verso l'alto, come nei programmi di stampa 3D

const $ = (s, r = document) => r.querySelector(s);
const D2R = Math.PI / 180;
const fmt = v => String(+Number(v).toFixed(2));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ------------------------------------------------------------------ stato */
const state = { tool: 'move', space: false, snap: 1, dims: false };
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
  if (typeof hpop !== 'undefined' && hpop) closeHandlePopup();
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

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  dirty = true;
}
window.addEventListener('resize', resize);

/* ------------------------------------------------------------ geometrie */
function roundedRectShape(w, d, r) {
  const x = -w / 2, y = -d / 2;
  r = Math.min(r, w / 2 - 1e-3, d / 2 - 1e-3);
  const s = new THREE.Shape();
  if (r <= 0.001) { s.moveTo(x, y); s.lineTo(x + w, y); s.lineTo(x + w, y + d); s.lineTo(x, y + d); s.closePath(); return s; }
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
function buildGeometry(kind, p) {
  let g;
  if (kind === 'box') {
    if (p.r <= 0.001) { g = new THREE.BoxGeometry(p.w, p.d, p.h); g.translate(0, 0, p.h / 2); }
    else g = mergeVertices(clean(new THREE.ExtrudeGeometry(roundedRectShape(p.w, p.d, p.r), { depth: p.h, bevelEnabled: false, curveSegments: 12 })));
  } else if (kind === 'cylinder') {
    g = new THREE.CylinderGeometry(1, 1, 1, 72, 1);
    g.rotateX(Math.PI / 2); g.scale(p.w / 2, p.d / 2, p.h); g.translate(0, 0, p.h / 2);
  } else if (kind === 'cone') {
    g = new THREE.CylinderGeometry(Math.max(p.q || 0, 1) / 100, 1, 1, 72, 1);
    g.rotateX(Math.PI / 2); g.scale(p.w / 2, p.d / 2, p.h); g.translate(0, 0, p.h / 2);
  } else if (kind === 'prism') {
    g = new THREE.CylinderGeometry(1, 1, 1, Math.round(clamp(p.q || 6, 3, 64)), 1);
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
  const e = new THREE.LineSegments(featureEdges(m.geometry, 30),
    new THREE.LineBasicMaterial({ color: EDGE.normal, transparent: true, opacity: 0.55 }));
  e.raycast = () => {};
  m.add(e);
  m.userData.edges = e;
  styleObject(m);
}
function styleObject(m) {
  m.material = matFor(m);
  const e = m.userData.edges;
  if (!e) return;
  const sel = selection.includes(m), isKey = m === keyObj;
  e.material.color.setHex(isKey ? EDGE.key : sel ? EDGE.sel : EDGE.normal);
  e.material.opacity = sel ? 1 : 0.55;
}
function makeMesh(d) {
  const geo = d.kind === 'merged' ? d.geo : buildGeometry(d.kind, d.p);
  const m = new Brush(geo, d.hole ? M.hole : M.solid);
  m.castShadow = true;
  m.receiveShadow = false;
  m.userData = { id: d.id ?? nextId++, name: d.name, kind: d.kind, p: { ...d.p }, hole: !!d.hole, base: d.base ? { ...d.base } : null, geo: d.kind === 'merged' ? geo : null, gid: d.gid ?? null, color: d.color ?? null, text: d.text ? { ...d.text } : null, hidden: !!d.hidden, locked: !!d.locked };
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
    const ax = { w: 'x', d: 'y', h: 'z' }[key];
    m.scale[ax] = v / u.base[key];
    u.p[key] = v;
  } else {
    u.p[key] = v;
    if (u.kind === 'box') u.p.r = Math.min(u.p.r, Math.min(u.p.w, u.p.d) / 2);
    m.geometry.dispose();
    m.geometry = buildGeometry(u.kind, u.p);
    refreshEdges(m);
  }
  m.updateMatrixWorld(true);
}
function setRadius(m, r) {
  const u = m.userData;
  u.p.r = clamp(r, 0, Math.min(u.p.w, u.p.d) / 2);
  m.geometry.dispose();
  m.geometry = buildGeometry('box', u.p);
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
function snapshot() {
  return {
    sel: selection.map(m => m.userData.id),
    list: objects.map(m => ({
      id: m.userData.id, name: m.userData.name, kind: m.userData.kind, p: { ...m.userData.p }, hole: m.userData.hole,
      base: m.userData.base ? { ...m.userData.base } : null, geo: m.userData.geo, gid: m.userData.gid ?? null,
      pos: m.position.toArray(), q: m.quaternion.toArray(), scale: m.scale.toArray(), color: m.userData.color ?? null, text: m.userData.text ? { ...m.userData.text } : null,
    })),
  };
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
function touch() { dirty = dimsDirty = true; $('#empty-hint').classList.toggle('hidden', objects.length > 0); scheduleLayers(); updateRotGizmo(); }
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
    drag.mode = 'orbit'; drag.edgeHit = pickHit(e); drag.emptyClick = !drag.edgeHit;
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
    if (state.tool === 'edge' && !state.space) updateEdgeHover(e);
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
  if (d.mode === 'facepush') {
    const dist = d.fd.dist;
    if (d.moved && Math.abs(dist) > 1e-4) applyPush(dist); else { selMeshes.forEach(m => m.position.set(0, 0, 0)); updateFaceHandle(); TF.push.focus(); }
    return;
  }
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
  canvas.style.cursor = pan ? (grabbing ? 'grabbing' : 'grab') : state.tool === 'orbit' ? 'move' : state.tool === 'rotate' ? 'crosshair' : state.tool === 'face' || state.tool === 'edge' ? 'crosshair' : 'default';
}

/* ------------------------------------------------------------- pannello */
/* ---------------------------------------------------------------- rotazione */
const _qId = new THREE.Quaternion(), _eu = new THREE.Euler();
const eulerDeg = m => { _eu.setFromQuaternion(m.quaternion, 'XYZ'); const r = v => Math.round(v / D2R * 100) / 100 + 0; return { rx: r(_eu.x), ry: r(_eu.y), rz: r(_eu.z) }; };
function setEulerDeg(m, rx, ry, rz) {
  const b0 = worldBox(m), c0 = b0.getCenter(new THREE.Vector3()), grounded = Math.abs(b0.min.z) < 0.02;
  m.quaternion.setFromEuler(new THREE.Euler(rx * D2R, ry * D2R, rz * D2R, 'XYZ'));
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
function rotateSelection(ax, deg) {
  if (!selection.length) return;
  const c = selBox().getCenter(new THREE.Vector3());
  applyRot(startRot(), AXV[ax], deg * D2R, c);
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
const ids = ['x', 'y', 'z', 'w', 'd', 'h', 'r', 'q', 'rx', 'ry', 'rz'];
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
    const s = sizeOf(m), v = { x: m.position.x, y: m.position.y, z: m.position.z, w: s.w, d: s.d, h: s.h, r: m.userData.p.r ?? 0, q: m.userData.p.q ?? 0, ...eulerDeg(m) };
    ids.forEach(i => { if (document.activeElement !== F[i]) F[i].value = fmt(v[i]); });
    $('#p-r-wrap').classList.toggle('hidden', m.userData.kind !== 'box');
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
['rx', 'ry', 'rz'].forEach(id => bind(id, m => setEulerDeg(m, +F.rx.value || 0, +F.ry.value || 0, +F.rz.value || 0)));
['#p-lock', '#g-lock'].forEach(id => $(id).addEventListener('click', () => {
  sizeLock = !sizeLock; syncLock();
  try { localStorage.setItem('forma.lock', sizeLock ? '1' : '0'); } catch (e) {}
  toast(sizeLock ? 'Proporzioni bloccate: le misure cambiano insieme' : 'Proporzioni libere');
}));
syncLock();
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
$('#views').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) animateTo(VIEWS[b.dataset.view]); });
$('#b-dims').addEventListener('click', () => setDims());
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
const expMenu = $('#expmenu');
$('#b-export').addEventListener('click', e => { e.stopPropagation(); expMenu.classList.toggle('hidden'); });
document.addEventListener('pointerdown', e => { if (!e.target.closest('#expmenu,#b-export')) expMenu.classList.add('hidden'); });
expMenu.addEventListener('click', e => { const b = e.target.closest('[data-exp]'); if (!b) return; expMenu.classList.add('hidden'); askExport(b.dataset.exp); });
const dlgExp = $('#dlg-exp'), expName = $('#exp-name');
let expFmt = '3mf';
function setExpFmt(f) { expFmt = f; document.querySelectorAll('#exp-fmt button').forEach(b => b.classList.toggle('on', b.dataset.v === f)); $('#exp-ext').textContent = '.' + f; }
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
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2400);
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
    else if (k === 'a') { stop(); setSelection([...objects]); }
    else if (k === 'e') { stop(); combine(); }
    else if (k === 'g') { stop(); e.shiftKey ? ungroupSelection() : groupSelection(); }
    else if (k === '0') { stop(); fitView(); }
    else if (k === 's') { stop(); askExport('3mf'); }
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
  else if (k === 'r') setTool('rotate');
  else if (k === 'b') createObject('box');
  else if (k === 'c') createObject('cylinder');
  else if (k === 's') createObject('sphere');
  else if (k === 'o') createObject('cone');
  else if (k === 'p') createObject('prism');
  else if (k === 't') { e.preventDefault(); addText(); }
  else if (k === 'x') toggleHole();
  else if (k === 'm') setDims();
  else if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSelection(); }
  else if (k === 'escape') { if (faceSel) clearFace(); else setSelection([]); }
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
  const curvedList = curvedTris(geo, t0);
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
    avg.normalize();
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
  return { obj: m, n, u: uAx, v: vAx, o: org, world, vn, tri2d, b, W, H, area, curved: !!curvedList, rect: !curvedList && area >= W * H * 0.995, triSet: new Set(tris) };
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
  if (!hit) return hideHover();
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
  const { n, u, v, o: org } = fs, d = o.depth, raise = o.mode === 'raise';
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
      pts.push([w, -sgn * 0.35], [-w, -sgn * 0.35]);
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
      g = new THREE.ExtrudeGeometry(sh, { depth: d + 0.4, bevelEnabled: false, curveSegments: 16 });
      g.translate(0, 0, raise ? -0.4 : -d);
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
  if (faceSet.some(f => f.curved)) return toast('Le texture funzionano sui lati piatti');
  const o = texOpts(), obj = faceSel.obj, faces = faceSet.slice();
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
function pushOne(obj, faces, dist) {
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
    if (b2) return { mesh: replaceWithMerged(obj, b2, true), ext: true };
  }
  const baked = bakeResult({ updateMatrixWorld() {}, matrixWorld: new THREE.Matrix4(), geometry: geometryFromPositions(arr) }, obj.userData.name);
  if (!baked) return { err: 'Il risultato è vuoto' };
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
  if (best !== null) { dist = best; snapped = true; } else dist = snapV(dist);
  fd.dist = dist; fd.snapped = snapped;
  const c = groupCenter().addScaledVector(fs.n, dist);
  faceHandle.position.copy(c);
  faceSet.forEach((f, i) => selMeshes[i] && selMeshes[i].position.copy(f.n).multiplyScalar(dist));
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
  dragRead.textContent = `${dist > 0 ? '+' : ''}${fmt(dist)} mm${snapped ? ' · allineato' : ''}`;
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
      const rec = { comps: [...o.getElementsByTagName('component')].map(c => ({ id: c.getAttribute('objectid'), path: c.getAttribute('p:path'), tf: c.getAttribute('transform') })) };
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
    } catch (err) { console.error(err); toast(`Impossibile leggere ${f.name}`); }
  }
}

/* ------------------------------------------------------------- avvio */
function render() {
  edgeMat.resolution.set(canvas.clientWidth, canvas.clientHeight); edgeHoverMat.resolution.copy(edgeMat.resolution);
  if (rotGizmo.visible) updateRotGizmo();
  updateHandleFacing();
  renderer.render(scene, camera);
  updateDims();
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
  refreshEdgeLines(); updateEdgePanel();
}
function refreshEdgeLines() {
  dropLines(edgeLines); edgeLines = edgeSel.length ? makeLines(edgeSel.map(x => x.chain), edgeMat) : null;
  dirty = true;
}
function clearEdges() {
  edgeSel = []; refreshEdgeLines();
  dropLines(edgeHoverLine); edgeHoverLine = null; edgeHoverKey = null;
}
const EF = { size: $('#e-size'), go: $('#e-go'), info: $('#e-info'), hint: $('#e-hint') };
function updateEdgePanel() {
  const n = edgeSel.length;
  EF.info.textContent = n ? `· ${n} ${n === 1 ? 'spigolo' : 'spigoli'}` : '';
  EF.hint.textContent = n ? 'Scegli il tipo e la misura, poi Applica.' : 'Clicca uno spigolo del pezzo. Maiusc + clic: aggiungi o togli spigoli.';
  EF.go.disabled = !n;
  document.querySelectorAll('#e-type button').forEach(b => b.classList.toggle('on', b.dataset.v === edgeMode.v));
}
document.querySelectorAll('#e-type button').forEach(b => b.addEventListener('click', () => { edgeMode.v = b.dataset.v; updateEdgePanel(); }));
function applyEdges() {
  const size = parseFloat(EF.size.value);
  if (!edgeSel.length) return;
  if (!(size > 0)) return toast('Scrivi una misura in mm');
  const obj = edgeSel[0].obj;
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
const APP_VERSION = '0.7.2';
const infoDlg = $('#dlg-info');
$('#ver-num').textContent = APP_VERSION;
$('#b-info').addEventListener('click', () => infoDlg.showModal());
$('#info-close').addEventListener('click', () => infoDlg.close());
infoDlg.addEventListener('click', e => { if (e.target === infoDlg) infoDlg.close(); });
initI18n();
window.forma = { edgeSel: () => edgeSel, selectEdgeAt, applyEdges, edgeMode, edgeAnalysis, chainOf, cutter, nearestEdge, askExport, importFiles, parse3MF, computeFace, applyTexture, applyPush, selectFaceFromHit, texUI, layout, get faceSel() { return faceSel; }, get faceSet() { return faceSet; }, setTool, setSnap, objects, state, cam, createObject, combine, setSelection, exportSTL, alignSelection, buildBoxModel, undo, redo, setDims, worldBox, sizeOf, get selection() { return selection; }, get keyObj() { return keyObj; }, set keyObj(v) { keyObj = v; }, HANDLES, camera, canvas, fitView, export3MF, build3MF, rotateSelection, setEulerDeg, startRot, groupSelection, ungroupSelection, updateFaceHandle, prismPush, replaceWithMerged, setBed, get bed() { return [BEDX, BEDY]; }, duplicateSelection, toggleHole };


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
