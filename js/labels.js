// Rack IDs and row letters you can read from the hall overview. Each rack gets a small label above it that keeps the
// same size on screen, shown from afar and faded out as you come close (so close-ups are not cluttered); each row gets
// its letter on the floor at both ends.
import { THREE, scene, camera, controls, lc, COL, ROWS, RACK_H } from './core.js';
import { UI, SV } from './state.js';
import { racks } from './racks.js';

const FONT = '600 56px "Barlow Condensed", "Arial Narrow", sans-serif';
function tex(text, color, w, h, size) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const draw = () => {
    const g = c.getContext('2d'); g.clearRect(0, 0, w, h);
    g.font = FONT.replace('56px', size + 'px'); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = size * 0.18; g.strokeStyle = 'rgba(6,10,14,0.9)'; g.strokeText(text, w / 2, h / 2 + size * 0.04);
    g.fillStyle = color; g.fillText(text, w / 2, h / 2 + size * 0.04); t.needsUpdate = true;
  };
  draw();
  // the font loads after the page starts: draw again once it is there
  if (document.fonts && document.fonts.load) document.fonts.load(FONT.replace('56px', size + 'px')).then(draw, () => {});
  return t;
}

// ---------- Rack labels: constant size on screen ----------
const PX = 20;   // label height in pixels
const sprites = racks.map(r => {
  const m = new THREE.SpriteMaterial({ map: tex(r.id, '#e8f3fa', 192, 96, 70), sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true, fog: false, toneMapped: false });
  const s = new THREE.Sprite(m); s.position.set(r.x, RACK_H + 0.22, r.z); s.renderOrder = 8; s.center.set(0.5, 0);
  scene.add(s); return s;
});
// ---------- Row letters on the floor ----------
const rowTex = new Map();
for (const row of ROWS) {
  if (!rowTex.has(row.id)) rowTex.set(row.id, tex(row.id, lc(COL.cold).convertLinearToSRGB().getStyle(), 128, 128, 100));
  for (const x of [row.x0 - 0.5, row.x1 + 0.5]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: rowTex.get(row.id), transparent: true, depthWrite: false, toneMapped: false, opacity: 0.85 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.012, row.z); m.renderOrder = 2; scene.add(m);
  }
}

// Size the sprites for the viewport, and fade them by how far the camera is from what it looks at
let lastH = 0, lastFov = 0;
export function updateLabels() {
  const h = innerHeight, fov = camera.fov;
  const near = SV.open || UI.cutRack;
  const d = camera.position.distanceTo(controls.target);
  // full strength from the overview, gone by the time you are within ~7 m
  const a = near ? 0 : Math.max(0, Math.min(1, (d - 6) / 6));
  if (h !== lastH || fov !== lastFov) { lastH = h; lastFov = fov; }
  const sy = PX * 2 * Math.tan(fov * Math.PI / 360) / h;
  for (const s of sprites) { s.visible = a > 0.02; s.material.opacity = a; s.scale.set(sy * 2, sy, 1); }
}
