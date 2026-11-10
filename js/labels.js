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

// When racks stand closer together on screen than a label is wide, only some labels are shown: the ends of each row
// first, then every eighth rack, every fourth, every second, then the rest, each only if it is clear of the ones
// already placed. The order never depends on the camera, so labels do not swap about as the view turns; zoom in and
// the ones in between appear.
const LW = 34, LH = 20;   // room a label needs on screen, in pixels
{
  const byRow = new Map();
  racks.forEach((r, i) => { if (!byRow.has(r.row)) byRow.set(r.row, []); byRow.get(r.row).push(i); });
  for (const idx of byRow.values()) {
    idx.sort((a, b) => racks[a].x - racks[b].x);
    idx.forEach((ri, i) => {
      const end = i === 0 || i === idx.length - 1;
      sprites[ri].userData.rank = end ? 4 : i % 8 === 0 ? 3 : i % 4 === 0 ? 2 : i % 2 === 0 ? 1 : 0;
    });
  }
}
const order = sprites.map((s, i) => i).sort((a, b) => sprites[b].userData.rank - sprites[a].userData.rank || a - b);
const v = new THREE.Vector3(), taken = new Map();
function clear(x, y) {
  const cx = Math.floor(x / LW), cy = Math.floor(y / LH);
  for (let i = cx - 1; i <= cx + 1; i++) for (let j = cy - 1; j <= cy + 1; j++) {
    const list = taken.get(i * 4096 + j); if (!list) continue;
    for (let k = 0; k < list.length; k += 2) if (Math.abs(list[k] - x) < LW && Math.abs(list[k + 1] - y) < LH) return false;
  }
  const key = cx * 4096 + cy, list = taken.get(key);
  if (list) list.push(x, y); else taken.set(key, [x, y]);
  return true;
}

// Size the sprites for the viewport, fade them by how far the camera is from what it looks at, and thin them out
// where they would overlap
export function updateLabels() {
  const w = innerWidth, h = innerHeight;
  const near = SV.open || UI.cutRack;
  const d = camera.position.distanceTo(controls.target);
  // full strength from the overview, gone by the time you are within ~7 m
  const a = near ? 0 : Math.max(0, Math.min(1, (d - 6) / 6));
  const sy = PX * 2 * Math.tan(camera.fov * Math.PI / 360) / h;
  taken.clear();
  for (const i of order) {
    const s = sprites[i];
    let show = a > 0.02;
    if (show) {
      v.copy(s.position).project(camera);
      show = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && clear((v.x * 0.5 + 0.5) * w, (0.5 - v.y * 0.5) * h);
    }
    // ease in and out, so labels do not pop as the view moves
    const o = s.material.opacity, to = show ? a : 0;
    s.material.opacity = Math.abs(to - o) < 0.02 ? to : o + (to - o) * 0.25;
    s.visible = s.material.opacity > 0.02;
    s.scale.set(sy * 2, sy, 1);
  }
}
