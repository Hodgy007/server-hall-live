// Shared foundations: three.js setup, colour scales, hall geometry constants, canvas texture helpers.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Colours are authored in sRGB and converted explicitly with lc(), so three's automatic conversion stays off
THREE.ColorManagement.enabled = false;

export { THREE };
export const $ = id => document.getElementById(id);
const css = getComputedStyle(document.documentElement);
export const tok = n => css.getPropertyValue(n).trim();
export const COL = { ok: tok('--ok'), warn: tok('--warn'), crit: tok('--crit'), cold: tok('--cold'), muted: tok('--muted'), line: tok('--line'), fg: tok('--fg') };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lc = h => new THREE.Color(h).convertSRGBToLinear();
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Colour scales (shared by 3D scene and legend) ----------
export const STOPS = {
  load: [[0, '#2a8fbf'], [0.5, '#3fcf8e'], [0.8, '#f2b441'], [0.95, '#ff5a4f']],
  heat: [[18, '#2a8fbf'], [23, '#3fcf8e'], [27, '#f2b441'], [32, '#ff5a4f']],
  exh:  [[26, '#34495c'], [36, '#f2b441'], [48, '#ff5a4f']],
  cpu:  [[35, '#2a8fbf'], [55, '#3fcf8e'], [75, '#f2b441'], [92, '#ff5a4f']],
  air:  [[18, '#4fc3e8'], [32, '#f2b441'], [46, '#ff5a4f']]
};
export const LST = {}; const CST = {};
for (const k in STOPS) { LST[k] = STOPS[k].map(([v, h]) => [v, lc(h)]); CST[k] = STOPS[k].map(([v, h]) => [v, new THREE.Color(h)]); }
export function gradIn(s, v, out) {
  if (v <= s[0][0]) return out.copy(s[0][1]);
  for (let i = 1; i < s.length; i++) {
    if (v <= s[i][0]) return out.copy(s[i - 1][1]).lerp(s[i][1], (v - s[i - 1][0]) / (s[i][0] - s[i - 1][0]));
  }
  return out.copy(s[s.length - 1][1]);
}
export const grad = (k, v, out) => gradIn(LST[k], v, out);
const cssC = new THREE.Color();
export const cssGrad = (k, v) => '#' + gradIn(CST[k], v, cssC).getHexString();

// ---------- Renderer, scene, camera ----------
export const canvas = $('stage');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.localClippingEnabled = true;
// Rack view cut-away: geometry between the camera and the viewed rack is clipped. Far away = off.
export const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 1e6);
export const scene = new THREE.Scene();
const BG = lc(tok('--bg'));
scene.background = BG;
scene.fog = new THREE.Fog(BG, 13, 28);
export const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 100);
export const HALL_VIEW = { pos: new THREE.Vector3(7.4, 5.4, 8.2), target: new THREE.Vector3(0.4, 0.9, 0) };
camera.position.copy(HALL_VIEW.pos);
export const controls = new OrbitControls(camera, canvas);
controls.target.copy(HALL_VIEW.target);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 0.35;
controls.maxDistance = 20;
controls.autoRotateSpeed = 0.35;
controls.autoRotate = !reduceMotion;

// Image-based lighting gives the steel, rails and handles something to reflect.
// Lights are physically based since three r155, so the old intensities are scaled by π.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0x9cc4e0, 0x0a0f14, 0.45 * Math.PI));
const key = new THREE.DirectionalLight(0xdfefff, 0.55 * Math.PI); key.position.set(3, 8, 4); scene.add(key);

// ---------- Hall geometry (metres) ----------
export const RACK_W = 0.6, RACK_H = 2.08, RACK_D = 1.0, COLS = 6, PITCH = 0.64, SERVERS = 12;
export const TRAY_Y = 2.75, TRAY_X = 2.55, CORE_X = 3.4;
export const ROOM = { x: 4.6, z: 6.3, h: 3.7 };
// 42U cabinets at true scale (1U = 44.5 mm): servers U1–24, blanking U25–39, patch panel U40, ToR switches U41–42
export const U = 0.0445, U0 = 0.075, U_TOP = U0 + 42 * U, FRONT = RACK_D / 2;
export const uY = (u, h) => U0 + (u - 1 + h / 2) * U;   // centre height of a device at U u, h units tall
export const ROWS = [
  { id: 'A', z: -3.5, face: 1,  role: 'Web front-end', aff: 1.0,  base: 0.55, net: 36, rps: 3100 },
  { id: 'B', z: -1.1, face: -1, role: 'API services',  aff: 0.8,  base: 0.5,  net: 30, rps: 1400 },
  { id: 'C', z: 1.1,  face: 1,  role: 'Database',      aff: 0.45, base: 0.45, net: 22, rps: 0 },
  { id: 'D', z: 3.5,  face: -1, role: 'Batch and analytics', aff: 0.1, base: 0.5, net: 14, rps: 0 }
];
// Rows B and C exhaust into a shared, contained hot aisle; hot air leaves through two chimneys to the ceiling plenum
export const HAC = { z0: -0.6, z1: 0.6, x0: -1.93, x1: 1.93, top: RACK_H, chimneys: [-0.96, 0.96] };

// ---------- Canvas textures ----------
let seed = 7;
export const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export function canvasTex(w, h, draw, data) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
export function labelTex(text, color) {
  return canvasTex(256, 64, (g, w, h) => {
    g.font = '500 40px "IBM Plex Mono", ui-monospace, monospace';
    g.fillStyle = color || '#cfe0ea'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  });
}
// Powder-coat speckle
export function speckle(g, w, h, n, a) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 1.6})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random(), 1 + Math.random());
  }
}
export const ease = u => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
