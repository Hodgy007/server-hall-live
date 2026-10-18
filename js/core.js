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
// Site data (data/hall.json) can contain anything, so it is escaped wherever it goes into HTML
const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = v => String(v).replace(/[&<>"']/g, c => ENT[c]);
export const COL = { ok: tok('--ok'), warn: tok('--warn'), crit: tok('--crit'), cold: tok('--cold'), muted: tok('--muted'), line: tok('--line'), fg: tok('--fg') };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lc = h => new THREE.Color(h).convertSRGBToLinear();
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Phones skip ambient occlusion and use smaller shadow maps; ?quality=low or high overrides
const QUALITY = new URLSearchParams(location.search).get('quality');
export const LOW_POWER = QUALITY ? QUALITY === 'low' : matchMedia('(max-width: 720px), (pointer: coarse)').matches;

// ---------- Colour scales (shared by 3D scene and legend) ----------
export const STOPS = {
  load: [[0, '#2a8fbf'], [0.5, '#3fcf8e'], [0.8, '#f2b441'], [0.95, '#ff5a4f']],
  heat: [[18, '#2a8fbf'], [23, '#3fcf8e'], [27, '#f2b441'], [32, '#ff5a4f']],
  exh:  [[26, '#34495c'], [36, '#f2b441'], [48, '#ff5a4f']],
  cpu:  [[35, '#2a8fbf'], [55, '#3fcf8e'], [75, '#f2b441'], [92, '#ff5a4f']],
  air:  [[18, '#4fc3e8'], [32, '#f2b441'], [46, '#ff5a4f']],
  power: [[0.3, '#2a8fbf'], [0.6, '#3fcf8e'], [0.8, '#f2b441'], [0.95, '#ff5a4f']],
  // thermal camera, °C: the "ironbow" palette of infrared cameras
  ir: [[16, '#08001a'], [20.5, '#2d0b6b'], [26.5, '#8a1c84'], [32.5, '#d8433b'], [38.5, '#f89a1c'], [43, '#fde16a'], [46, '#fffbe6']]
};
// Each rack's power budget (what its PDUs and the busway tap are provisioned for)
export const RACK_KW = 12;
// The value a rack is coloured by, and how tall its light column stands (0–1), for each colour mode
export const modeValue = (mode, r) => mode === 'load' ? r.load : mode === 'power' ? r.power / RACK_KW : r.inlet;
export const modeHeight = (mode, r) => mode === 'load' ? r.load : mode === 'power' ? Math.min(1, r.power / RACK_KW) : Math.max(0, Math.min(1, (r.inlet - 16) / 18));
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
// Only the viewed aisle's ceiling lights cast shadows; the maps are re-rendered when those lights move (see lights.js)
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
// Rack view cut-away: geometry between the camera and the viewed rack is clipped. Far away = off.
export const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 1e6);
export const scene = new THREE.Scene();
const BG = lc(tok('--bg'));
scene.background = BG;
// A faint cool haze: fixtures, LEDs and far racks fall off with distance
scene.fog = new THREE.FogExp2(lc('#15202a'), 0.024);
export const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 100);
export const HALL_VIEW = { pos: new THREE.Vector3(12.5, 10.5, 15.5), target: new THREE.Vector3(0, 0.4, 0) };
camera.position.copy(HALL_VIEW.pos);
export const controls = new OrbitControls(camera, canvas);
controls.target.copy(HALL_VIEW.target);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 0.35;
controls.maxDistance = 34;
// Right-drag (or shift-drag, or two fingers) slides the view across the floor rather than in the screen plane
controls.screenSpacePanning = false;
controls.autoRotateSpeed = 0.35;
controls.autoRotate = !reduceMotion;

// Image-based lighting gives the steel, rails and handles something to reflect.
// Lights are physically based since three r155, so the old intensities are scaled by π.
const pmrem = new THREE.PMREMGenerator(renderer);
// Its light boxes (radiance up to 100) are toned down: at that strength any glossy surface seen at a grazing angle
// (a cabinet side in the gap between racks, an open door) catches one as a hot spot that the bloom blows up
const roomEnv = new RoomEnvironment();
roomEnv.traverse(o => { if (o.material && o.material.isMeshBasicMaterial) o.material.color.multiplyScalar(0.08); });
scene.environment = pmrem.fromScene(roomEnv, 0.04).texture;
// A low fill keeps the shadows from going black; the ceiling fixtures (lights.js) do the real lighting.
scene.add(new THREE.HemisphereLight(0x9cc4e0, 0x0a0f14, 0.2 * Math.PI));
const key = new THREE.DirectionalLight(0xdfefff, 0.16 * Math.PI); key.position.set(3, 8, 4); scene.add(key);
// The shadow-casting spots (lights.js) stand in for 1.6 m panels. On a glossy surface a point light's highlight is a
// hot pin-prick where the panel would leave a soft streak, so glossy materials widen the highlight of point, spot and
// directional lights and keep their own gloss for the area lights and reflections.
export function broadPunctualSpec(shader, rough) {
  shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin
    .replace('vec3 geometryPosition', `float glossRough = material.roughness; material.roughness = max(glossRough, ${rough.toFixed(2)});\nvec3 geometryPosition`)
    .replace('#if ( NUM_RECT_AREA_LIGHTS > 0 )', 'material.roughness = glossRough;\n#if ( NUM_RECT_AREA_LIGHTS > 0 )'));
}

// ---------- Hall geometry (metres) ----------
// 8 rows of 12 racks. Rows face each other in pairs across 1.8 m cold aisles; back to back they share
// a 1.2 m contained hot aisle. The outer rows exhaust towards the end walls.
export const RACK_W = 0.6, RACK_H = 2.08, RACK_D = 1.0, COLS = 12, PITCH = 0.64, SERVERS = 12;
export const ROW_HALF = (COLS - 1) / 2 * PITCH + RACK_W / 2;   // half the length of a row
export const TRAY_Y = 2.75, TRAY_X = ROW_HALF + 0.55;          // overhead trays; the spine runs along x = TRAY_X
export const ROOM = { x: 6.0, z: 10.6, h: 3.7 };
// 42U cabinets at true scale (1U = 44.5 mm): servers U1–24, blanking U25–38, OOB switch U39, patch panel U40, ToR switches U41–42
export const U = 0.0445, U0 = 0.075, U_TOP = U0 + 42 * U, FRONT = RACK_D / 2;
export const uY = (u, h) => U0 + (u - 1 + h / 2) * U;   // centre height of a device at U u, h units tall
// Workloads, one per pair of rows; arrays elsewhere (hostnames, hardware, VLANs) are indexed by kind
export const KINDS = [
  { role: 'Web front-end', aff: 1.0, base: 0.55, net: 36 },
  { role: 'API services', aff: 0.8, base: 0.5, net: 30 },
  { role: 'Database', aff: 0.45, base: 0.45, net: 22 },
  { role: 'Batch and analytics', aff: 0.1, base: 0.5, net: 14 }
];
const COLD_W = 1.8, HOT_W = 1.2;
export const ROWS = [], COLD = [], HACS = [];
{
  const zs = []; let z = 0;
  for (let i = 0; i < 8; i++) { zs.push(z); z += RACK_D + (i % 2 === 0 ? COLD_W : HOT_W); }
  const off = (zs[0] + zs[7]) / 2;
  zs.forEach((zz, i) => ROWS.push({ ...KINDS[i >> 1], id: 'ABCDEFGH'[i], z: zz - off, face: i % 2 ? -1 : 1, kind: i >> 1 }));
  for (let i = 0; i < 8; i += 2) COLD.push((ROWS[i].z + ROWS[i + 1].z) / 2);
  // Hot-aisle containment between back-to-back rows; hot air leaves through chimneys to the ceiling plenum
  for (let i = 1; i < 7; i += 2) {
    const zc = (ROWS[i].z + ROWS[i + 1].z) / 2;
    HACS.push({ zc, z0: zc - HOT_W / 2, z1: zc + HOT_W / 2, x0: -ROW_HALF - 0.03, x1: ROW_HALF + 0.03, top: RACK_H, chimneys: [-2.56, 0, 2.56] });
  }
}
// Cooling units (outside the hall): CU-1 feeds the northern cold aisles (z < 0), CU-2 the southern ones
const coolsSouth = z => z > 0;
export const coolingUnit = z => coolsSouth(z) ? 1 : 0;

// ---------- Canvas textures ----------
let seed = 7;
export const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
// Separate stream for wear and finish variation, so adding visual detail never shifts the generated serials and dates
let vseed = 2027;
export const vrnd = () => (vseed = (vseed * 48271) % 2147483647) / 2147483647;
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
