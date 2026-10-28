// Procedural textures for cabinets and rack-mounted hardware, all drawn on canvas.
import { THREE, canvasTex, speckle, plateH, loadImg, grainOf, grain } from './core.js';

// Photographed grain (textures/): black powder coat for the cabinets, anodised aluminium for the faceplates
const [COAT, ALU] = (await Promise.all(['coat', 'alu'].map(n => loadImg(`textures/${n}.jpg`)))).map(i => grainOf(i));

// ---------- Wear ----------
// Rubs where the powder coat is worn towards bare steel, and darker marks from trolleys, boots and cable reels
function scuffs(g, x, y, w, h, n) {
  for (let i = 0; i < n; i++) {
    const px = x + Math.random() * w, py = y + Math.random() * h, len = 3 + Math.random() * 16, a = (Math.random() - 0.5) * 0.9;
    g.strokeStyle = Math.random() < 0.65 ? `rgba(170,182,192,${0.05 + Math.random() * 0.12})` : `rgba(0,0,0,${0.15 + Math.random() * 0.25})`;
    g.lineWidth = 0.7 + Math.random() * 1.6;
    g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); g.stroke();
  }
}

// ---------- Cabinet steel ----------
// Three worn variants of the standard cabinet and a second vendor's (index 3): smoother, lighter panels with
// ribbed sides, slotted roof vents and no mid-height seam
function drawSide(g, w, h, vendor) {
  g.fillStyle = vendor ? '#22272c' : '#1c242d'; g.fillRect(0, 0, w, h); speckle(g, w, h, vendor ? 4000 : 9000, 0.035);
  g.fillStyle = '#0b1015'; g.fillRect(0, 0, 5, h); g.fillRect(w - 5, 0, 5, h); g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
  if (vendor) {
    for (let x = 40; x < w - 30; x += 44) { g.fillStyle = '#15191d'; g.fillRect(x, 30, 3, h - 60); g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x + 3, 30, 1, h - 60); }
    g.fillStyle = '#3b434b'; g.fillRect(18, 22, 40, 12);
  } else {
    g.fillStyle = '#0b1015'; g.fillRect(0, h / 2 - 2, w, 4);
    g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(0, h / 2 + 2, w, 1);
    [h * 0.25, h * 0.75].forEach(y => { g.fillStyle = '#0d1217'; g.fillRect(w - 28, y - 16, 12, 32); g.fillStyle = '#56626d'; g.fillRect(w - 25, y - 5, 6, 10); });
  }
  g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(0, 4, w, 1); g.fillRect(5, 0, 1, h);
}
export const sideTexes = [0, 1, 2, 3].map(k => canvasTex(256, 512, (g, w, h) => {
  drawSide(g, w, h, k === 3); grain(g, COAT, 0.7, 0.5);
  // front and rear edges get knocked, the bottom gets kicked; the vendor cabinet is the newest and least worn
  const n = k % 3;
  scuffs(g, 0, 0, 22, h, 10 + n * 14); scuffs(g, w - 22, 0, 22, h, 6 + n * 10); scuffs(g, 0, h - 70, w, 66, 8 + n * 12);
}));
export const roughTex = canvasTex(128, 256, (g, w, h) => { g.fillStyle = '#a0a0a0'; g.fillRect(0, 0, w, h); speckle(g, w, h, 6000, 0.12); grain(g, COAT, 0.8, 0.5); }, true);
const drawTop = vendor => (g, w, h) => {
  g.fillStyle = vendor ? '#20252a' : '#1a222b'; g.fillRect(0, 0, w, h); speckle(g, w, h, 7000, 0.035); grain(g, COAT, 0.7, 0.5);
  g.fillStyle = '#080b0e';
  if (vendor) for (let y = 110; y < 310; y += 14) g.fillRect(44, y, w - 88, 6);
  else for (let y = 120, k = 0; y < 300; y += 9, k++) for (let x = 40 + (k % 2) * 4.5; x < w - 40; x += 9) { g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fill(); }
  [[30, 34], [h - 64, 34]].forEach(([y, hh]) => {
    g.fillStyle = '#06080b'; g.fillRect(50, y, w - 100, hh);
    g.fillStyle = '#1c232b'; for (let x = 52; x < w - 50; x += 3) g.fillRect(x, y + 2, 1, hh - 4);
  });
  g.strokeStyle = '#0b1015'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  scuffs(g, 0, 0, w, h, 25);
};
export const topTex = canvasTex(256, 420, drawTop(false)), topTexB = canvasTex(256, 420, drawTop(true));
export const railTex = canvasTex(32, 1024, (g, w, h) => {
  g.fillStyle = '#34404b'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#050608'; for (let k = 0; k < 126; k++) g.fillRect(11, k * h / 126 + 1.5, 10, 4.6);
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, 2, h);
});
export const bezelTex = canvasTex(512, 128, (g, w, h) => {
  g.fillStyle = '#151c23'; g.fillRect(0, 0, w, h); speckle(g, w, h, 5000, 0.04); grain(g, COAT, 0.6, 0.5);
  g.fillStyle = '#07090c'; for (let x = 24; x < w - 24; x += 10) g.fillRect(x, 12, 5, 18);
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, h - 3, w, 2);
});
export const plinthTex = canvasTex(512, 64, (g, w, h) => {
  g.fillStyle = '#10161c'; g.fillRect(0, 0, w, h); speckle(g, w, h, 3000, 0.04); grain(g, COAT, 0.6, 0.5);
  g.fillStyle = '#040506'; for (let x = 30; x < w - 30; x += 14) g.fillRect(x, 16, 8, h - 32);
});
export const contactTex = canvasTex(128, 192, (g, w, h) => {
  g.filter = 'blur(14px)'; g.fillStyle = 'rgba(0,0,0,0.85)'; g.fillRect(30, 34, w - 60, h - 68);
}, true);

// Perforated front door: honeycomb holes in a solid border, solid lock strip on the opening edge. The second
// vendor's door has larger square perforations, a wider frame and a nameplate.
const DOOR_W = 256, DOOR_H = 832;
function doorHoles(g, w, h, solid, hole, vendor) {
  g.fillStyle = solid; g.fillRect(0, 0, w, h);
  g.fillStyle = hole;
  if (vendor) {
    for (let y = 60; y < h - 40; y += 8) for (let x = 24; x < w - 44; x += 8) g.fillRect(x, y, 5, 5);
    return;
  }
  for (let y = 22, k = 0; y < h - 22; y += 5.2, k++) {
    for (let x = 16 + (k % 2) * 3; x < w - 34; x += 6) { g.beginPath(); g.arc(x, y, 2.1, 0, Math.PI * 2); g.fill(); }
  }
}
// Three worn variants of the standard door and the second vendor's (index 3)
export const doorTexes = [0, 1, 2, 3].map(k => canvasTex(DOOR_W, DOOR_H, (g, w, h) => {
  const vendor = k === 3;
  doorHoles(g, w, h, vendor ? '#252a30' : '#202932', '#0b0f13', vendor);
  speckle(g, w, h, 4000, 0.03); grain(g, COAT, 0.6, 0.5);
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
  if (vendor) { g.fillStyle = '#4a535c'; g.fillRect(70, 22, 100, 18); g.fillStyle = '#1a1f24'; g.fillRect(76, 28, 88, 6); }
  // the lock strip is handled every day; the bottom rail gets kicked
  const n = k % 3;
  scuffs(g, w - 36, h * 0.3, 36, h * 0.4, 14 + n * 12); scuffs(g, 0, h - 26, w, 26, 6 + n * 10); scuffs(g, 0, 0, 6, h, 4 + n * 6);
}));
const alphaStd = canvasTex(DOOR_W, DOOR_H, (g, w, h) => doorHoles(g, w, h, '#ffffff', '#1a1a1a'), true);
export const doorAlphas = [alphaStd, alphaStd, alphaStd, canvasTex(DOOR_W, DOOR_H, (g, w, h) => doorHoles(g, w, h, '#ffffff', '#1a1a1a', true), true)];

// ---------- Rack-mounted hardware ----------
// Each face is drawn three times: colour, height map for bump shading, and glow (LEDs only). Faces are laid out on a
// 512-wide grid (about 1 px per mm) and drawn at twice that resolution, so the detail holds close up.
const BUMP = { base: '#808080', ear: '#a8a8a8', handle: '#ffffff', hole: '#000000', latch: '#d0d0d0', panel: '#707070', tag: '#c0c0c0', psu: '#989898', slot: '#a0a0a0', port: '#101010', cable: '#e0e0e0', led: '#000000', vga: '#202020',
  bezel: '#a0a0a0', carrier: '#989898', face: '#b0b0b0', hex: '#8c8c8c', btn: '#e0e0e0', pipe: '#b4b4b4', pwr: '#c8c8c8', usb: '#181818', icon: '#a8a8a8', cage: '#c0c0c0', uid: '#c0c0c0' };
const PAL = { base: '#2b343d', ear: '#3a4550', handle: '#a3aeb8', hole: '#080a0d', latch: '#8f9aa4', panel: '#161c22', tag: '#d2d9df', psu: '#2a323a', slot: '#29313a', port: '#090c0f', cable: '#33b5c9', led: '#000000', vga: '#2d5fa8',
  bezel: '#16191c', carrier: '#1b1e22', face: '#24282d', hex: '#1d2125', btn: '#6f777e', pipe: '#26302b', pwr: '#2f8f55', usb: '#0b0d0f', icon: '#59636c', cage: '#7d868e', uid: '#1f4f8f' };
const GLOW = Object.fromEntries(Object.keys(PAL).map(k => [k, '#000000']));
GLOW.led = '#46ff9a'; GLOW.pwr = '#1c7a3e';
export function plateMat(w, h, draw, opts) {
  const { glow, ...rest } = opts || {};
  // the faceplate grain goes into colour and, fainter, into the bump; never into the LED glow
  const at = (P, data) => canvasTex(w * 2, h * 2, (g) => { g.scale(2, 2); draw(g, w, h, P); if (P !== GLOW) grain(g, ALU, P === PAL ? 0.55 : 0.35, 0.5); }, data);
  const m = new THREE.MeshStandardMaterial(Object.assign({ map: at(PAL), bumpMap: at(BUMP, true), bumpScale: 0.6, roughnessMap: roughTex, metalness: 0.55, roughness: 0.7 }, rest));
  if (glow) { m.emissiveMap = at(GLOW); m.emissive = new THREE.Color(0xffffff); m.emissiveIntensity = 2.2; }
  return m;
}
function ears(g, w, h, P) {
  [0, w - 22].forEach(x => {
    g.fillStyle = P.ear; g.fillRect(x, 0, 22, h);
    g.fillStyle = P.hole; g.beginPath(); g.arc(x + 11, 7, 2.6, 0, Math.PI * 2); g.arc(x + 11, h - 7, 2.6, 0, Math.PI * 2); g.fill();
  });
}
function grille(g, cx, cy, r, P) {
  g.strokeStyle = P.hole; g.lineWidth = 1.6;
  for (let k = r; k > 2; k -= 4) { g.beginPath(); g.arc(cx, cy, k, 0, Math.PI * 2); g.stroke(); }
  g.beginPath(); g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.moveTo(cx, cy - r); g.lineTo(cx, cy + r); g.stroke();
}
// Hexagonal perforation, as in Dell's front grilles and drive carriers
function hexes(g, x0, y0, x1, y1, r, P) {
  g.fillStyle = P.hole; g.beginPath();
  const dx = r * 1.5 + 0.8, dy = r * 1.732 + 0.8;
  for (let c = 0, x = x0 + r; x <= x1 - r; c++, x += dx) {
    for (let y = y0 + r * 0.866 + (c % 2) * dy / 2; y <= y1 - r * 0.866; y += dy) {
      g.moveTo(x + r, y);
      for (let k = 1; k < 6; k++) g.lineTo(x + r * Math.cos(k * Math.PI / 3), y + r * Math.sin(k * Math.PI / 3));
      g.closePath();
    }
  }
  g.fill();
}
const screw = (g, x, y, P) => { g.fillStyle = P.latch; g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); g.fillStyle = P.hole; g.fillRect(x - 2, y - 0.4, 4, 0.8); };

// ---------- Server fronts (Dell PowerEdge, no bezel) ----------
// The status LEDs are separate meshes in the left ear, in metres from the face centre: activity below, system health and ID above
const FRONT_LED = { x: -0.249, y: { 2: [-0.004, 0.02], 1: [-0.0105, 0.0105] } };
// Left control panel: windows for the two LEDs, the status icons (drive, temperature, electrical, memory, PCIe), a slam latch.
// Right control panel: power button with its green ring, USB and the iDRAC Direct port.
function frontEars(g, w, h, P) {
  const two = h > 50, ly = FRONT_LED.y[two ? 2 : 1].map(y => h / 2 - y / plateH(two ? 2 : 1) * h);
  [0, w - 22].forEach(x => {
    g.fillStyle = P.bezel; g.fillRect(x, 0, 22, h);
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x + 1, 0, 1, h);
    g.fillStyle = P.hole; g.fillRect(x === 0 ? 21 : x, 0, 1, h);
  });
  ly.forEach(y => { g.fillStyle = P.hole; g.fillRect(2, y - 9.5, 18, 19); g.fillStyle = P.panel; g.fillRect(3, y - 8.5, 16, 17); });
  if (two) {
    g.fillStyle = P.latch; g.fillRect(4, 2.5, 14, 7); g.fillStyle = P.hole; g.fillRect(6, 5, 10, 1.2);
    g.fillStyle = P.icon; for (let k = 0; k < 5; k++) g.fillRect(8.5, 59 + k * 4, 5, 2.4);
    screw(g, 11, h - 6, P);
    g.fillStyle = P.latch; g.fillRect(w - 18, 2.5, 14, 7); g.fillStyle = P.hole; g.fillRect(w - 16, 5, 10, 1.2);
    screw(g, w - 11, h - 6, P);
  }
  const bx = w - 11, by = two ? 25 : 11, br = two ? 6 : 5;
  g.fillStyle = P.pwr; g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
  g.fillStyle = P.panel; g.beginPath(); g.arc(bx, by, br - 1.3, 0, Math.PI * 2); g.fill();
  g.strokeStyle = P.icon; g.lineWidth = 0.9; g.beginPath(); g.arc(bx, by, br * 0.45, -Math.PI * 0.3, Math.PI * 1.3); g.moveTo(bx, by - br * 0.6); g.lineTo(bx, by - br * 0.1); g.stroke();
  const uy = two ? 40 : 21;
  g.fillStyle = P.cage; g.fillRect(w - 17, uy, 12, 6); g.fillStyle = P.usb; g.fillRect(w - 16, uy + 1, 10, 4); g.fillStyle = P.panel; g.fillRect(w - 15, uy + 1, 8, 1.6);
  g.fillStyle = P.cage; g.fillRect(w - 15, uy + (two ? 11 : 9), 8, 3.4); g.fillStyle = P.usb; g.fillRect(w - 14.4, uy + (two ? 11.6 : 9.6), 6.8, 2.2);
  g.fillStyle = P.pipe; g.fillRect(w - 12.5, uy + (two ? 17 : 14), 3, 1.6);
}
// NVMe carrier: in 2U two light pipes and the release button over a hex-vented handle; in 1U the button sits at the side
function carrier(g, x, y, ww, hh, P, two) {
  g.fillStyle = P.carrier; g.fillRect(x, y, ww, hh);
  g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x, y, ww, 0.8); g.fillRect(x, y, 0.8, hh);
  if (two) {
    g.fillStyle = P.pipe; g.fillRect(x + 4, y + 3, 4, 2.4); g.fillRect(x + 10, y + 3, 4, 2.4);
    g.fillStyle = P.btn; g.fillRect(x + 19, y + 2, 11, 8);
    g.fillStyle = P.hole; g.beginPath(); g.moveTo(x + 22, y + 4); g.lineTo(x + 27, y + 6); g.lineTo(x + 22, y + 8); g.fill();
    g.fillStyle = P.face; g.fillRect(x + 2.5, y + 13, ww - 5, hh - 16);
    hexes(g, x + 4, y + 15, x + ww - 4, y + hh * 0.66, 2.1, P);
    g.fillStyle = P.hole; g.fillRect(x + 6, y + hh - 13, ww - 12, 1.2);
    g.fillStyle = P.bezel; g.fillRect(x + 6, y + hh - 10, ww - 12, 5);
  } else {
    g.fillStyle = P.face; g.fillRect(x + 2, y + 2, ww - 13, hh - 4);
    hexes(g, x + 3.5, y + 3.5, x + ww - 12.5, y + hh - 3.5, 1.9, P);
    g.fillStyle = P.btn; g.fillRect(x + ww - 9, y + 3, 7, 9);
    g.fillStyle = P.hole; g.beginPath(); g.moveTo(x + ww - 7.5, y + 5); g.lineTo(x + ww - 3.5, y + 7.5); g.lineTo(x + ww - 7.5, y + 10); g.fill();
    g.fillStyle = P.pipe; g.fillRect(x + ww - 8, y + hh - 9, 5, 2); g.fillRect(x + ww - 8, y + hh - 5.5, 5, 2);
  }
}
// 1U and 2U fronts: eight NVMe carriers lined up with the pulled-out model's drives, a hex grille over the empty bays,
// and in 2U the pull-out information tag
export function drawFront(g, w, h, P) {
  const two = h > 50, m = two ? 4 : 3;
  g.fillStyle = P.bezel; g.fillRect(0, 0, w, h);
  g.fillStyle = P.hole; g.fillRect(25, m - 2, 294, h - 2 * m + 4);
  for (let i = 0; i < 8; i++) carrier(g, 28 + i * 36, m, 33, h - 2 * m, P, two);
  g.fillStyle = P.hex; g.fillRect(322, m - 1, 166, h - 2 * m + 2);
  hexes(g, 325, m + 1, 485, h - m - (two ? 9 : 1), two ? 3.1 : 2.6, P);
  if (two) {
    g.fillStyle = P.hole; g.fillRect(420, h - m - 7, 62, 4);
    g.fillStyle = P.latch; g.fillRect(424, h - m - 6.2, 52, 2.4);
  }
  frontEars(g, w, h, P);
}

// ---------- Server rears ----------
// Rear I/O, centres in grid pixels: the iDRAC port, and the OCP NIC's four SFP28 cages along one line
const REAR_IO = { 2: { idrac: [258, 21], ocp: [284, 304, 330, 350], ocpY: 43.5 }, 1: { idrac: [150, 18], ocp: [208, 228, 254, 274], ocpY: 13.5 } };
// SFP28 cage centred on (cx, cy) and its link light; only the two cabled ports are lit
function sfp(g, cx, cy, P, lit) {
  const x = cx - 8, y = cy - 5.5;
  g.fillStyle = P.cage; g.fillRect(x, y, 16, 11);
  g.fillStyle = P.port; g.fillRect(x + 1.5, y + 1.5, 13, 8);
  g.fillStyle = lit ? P.led : P.panel; g.fillRect(x + 6, y - 5, 4, 3);
}
// 2U server rear: two hot-swap PSUs, I/O, the OCP NIC's SFP28 cages, PCIe slot covers
export function drawRear(g, w, h, P) {
  g.fillStyle = P.base; g.fillRect(0, 0, w, h);
  ears(g, w, h, P);
  [26, 112].forEach(x => {
    g.fillStyle = P.psu; g.fillRect(x, 4, 82, h - 8);
    grille(g, x + 22, h / 2, 17, P);
    g.fillStyle = P.port; g.fillRect(x + 44, h / 2 - 11, 18, 22);
    g.fillStyle = P.handle; g.fillRect(x + 70, 10, 6, h - 20);
    g.fillStyle = P.led; g.fillRect(x + 48, 8, 6, 4);
  });
  const { idrac: [ix, iy], ocp, ocpY } = REAR_IO[2];
  g.fillStyle = P.port; g.fillRect(202, 18, 12, 6); g.fillRect(202, 30, 12, 6); g.fillRect(ix - 8, iy - 7, 16, 14);
  g.fillStyle = P.vga; g.fillRect(220, 16, 24, 11);
  g.fillStyle = P.led; g.fillRect(ix - 7, iy - 6, 3, 2); g.fillRect(ix + 4, iy - 6, 3, 2);
  ocp.forEach((x, k) => sfp(g, x, ocpY, P, k < 2));
  for (let i = 0; i < 4; i++) {
    const x = 368 + i * 29;
    g.fillStyle = P.slot; g.fillRect(x, 4, 25, h - 8);
    g.fillStyle = P.hole; for (let y = 10; y < h - 10; y += 6) g.fillRect(x + 6, y, 13, 2);
  }
}
// 1U server rear: a power supply at each side, the OCP NIC's SFP28 cages, a low-profile PCIe slot, I/O
export function drawRear1U(g, w, h, P) {
  g.fillStyle = P.base; g.fillRect(0, 0, w, h);
  ears(g, w, h, P);
  [26, w - 26 - 86].forEach(x => {
    g.fillStyle = P.psu; g.fillRect(x, 3, 86, h - 6);
    grille(g, x + 18, h / 2, 13, P);
    g.fillStyle = P.port; g.fillRect(x + 38, h / 2 - 9, 16, 18);
    g.fillStyle = P.handle; g.fillRect(x + 74, 7, 5, h - 14);
    g.fillStyle = P.led; g.fillRect(x + 60, 6, 6, 4);
  });
  const { idrac: [ix, iy], ocp, ocpY } = REAR_IO[1];
  g.fillStyle = P.port; g.fillRect(124, 10, 12, 6); g.fillRect(124, 22, 12, 6); g.fillRect(ix - 8, iy - 6, 16, 12);
  g.fillStyle = P.vga; g.fillRect(164, 12, 22, 10);
  ocp.forEach((x, k) => sfp(g, x, ocpY, P, k < 2));
  g.fillStyle = P.slot; g.fillRect(296, 4, 100, h - 8);
  g.fillStyle = P.hole; for (let x = 304; x < 390; x += 8) g.fillRect(x, 10, 4, h - 20);
}
// ---------- HPE ProLiant (no bezel) ----------
// Front: the serial-label pull tab on the left ear; eight SFF Smart Carriers, each with its round activity ring and a
// release latch; a square-perforated vent with the status lights at its right (the LEDs are meshes, at HPE_LED); on
// the right ear the power button with its ring, the UID button, USB and the iLO service port.
const HPE_LED = { x: 0.205, y: { 2: [-0.012, 0.012], 1: [-0.0105, 0.0105] } };
function squares(g, x0, y0, x1, y1, s, P) {
  g.fillStyle = P.hole;
  for (let y = y0; y + s <= y1; y += s + 1.4) for (let x = x0; x + s <= x1; x += s + 1.4) g.fillRect(x, y, s, s);
}
export function drawFrontHPE(g, w, h, P) {
  const two = h > 50, m = two ? 4 : 3, ly = HPE_LED.y[two ? 2 : 1].map(y => h / 2 - y / plateH(two ? 2 : 1) * h);
  g.fillStyle = P.bezel; g.fillRect(0, 0, w, h);
  [0, w - 22].forEach(x => { g.fillStyle = P.ear; g.fillRect(x, 0, 22, h); g.fillStyle = P.hole; g.fillRect(x === 0 ? 21 : x, 0, 1, h); });
  g.fillStyle = P.latch; g.fillRect(3, h / 2 - 4, 15, 8); g.fillStyle = P.hole; g.fillRect(5, h / 2 - 0.6, 11, 1.2);
  g.fillStyle = P.hole; g.fillRect(25, m - 2, 294, h - 2 * m + 4);
  for (let i = 0; i < 8; i++) {
    const x = 28 + i * 36, y = m, hh = h - 2 * m;
    g.fillStyle = P.carrier; g.fillRect(x, y, 33, hh);
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x, y, 33, 0.8);
    g.strokeStyle = P.pipe; g.lineWidth = 1.4; g.beginPath(); g.arc(x + 9, y + (two ? 8 : 7), two ? 4 : 3, 0, Math.PI * 2); g.stroke();
    squares(g, x + 4, y + (two ? 16 : 3), x + 30, y + hh - (two ? 16 : 3), 2, P);
    if (two) { g.fillStyle = P.btn; g.fillRect(x + 4, y + hh - 12, 25, 8); g.fillStyle = P.hole; g.fillRect(x + 8, y + hh - 9, 17, 1.4); }
    else { g.fillStyle = P.btn; g.fillRect(x + 22, y + 3, 8, hh - 6); }
  }
  g.fillStyle = P.hex; g.fillRect(322, m - 1, 166, h - 2 * m + 2);
  squares(g, 326, m + 2, 438, h - m - 2, 2.6, P);
  ly.forEach(y => { g.fillStyle = P.hole; g.fillRect(449, y - 9.5, 18, 19); g.fillStyle = P.panel; g.fillRect(450, y - 8.5, 16, 17); });
  const bx = w - 11, by = two ? 20 : 11, br = two ? 6 : 5;
  g.fillStyle = P.pwr; g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
  g.fillStyle = P.panel; g.beginPath(); g.arc(bx, by, br - 1.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = P.uid; g.fillRect(w - 16, two ? 32 : 19, 10, two ? 8 : 6);
  if (two) {
    g.fillStyle = P.cage; g.fillRect(w - 17, 48, 12, 6); g.fillStyle = P.usb; g.fillRect(w - 16, 49, 10, 4);
    g.fillStyle = P.cage; g.fillRect(w - 15, 60, 8, 3.4); g.fillStyle = P.usb; g.fillRect(w - 14.4, 60.6, 6.8, 2.2);
  }
}
// Rear: PCIe slot covers across the top in three risers (one in 1U), and along the bottom the OCP NIC's SFP28 cages,
// the dedicated iLO port with USB and VGA, and the two power supplies side by side at the right
const HPE_IO = { 2: { oob: [240, 66], ocp: [158, 178, 198], ocpY: 66 }, 1: { oob: [222, 22], ocp: [140, 160, 180], ocpY: 22 } };
export function drawRearHPE(g, w, h, P) {
  const two = h > 50, io = HPE_IO[two ? 2 : 1];
  g.fillStyle = P.base; g.fillRect(0, 0, w, h); ears(g, w, h, P);
  const slots = two ? Array.from({ length: 8 }, (_, i) => 28 + i * 58) : [28, 64];
  slots.forEach(x => { g.fillStyle = P.slot; g.fillRect(x, 4, two ? 52 : 32, two ? 44 : h - 8); g.fillStyle = P.hole; for (let y = 10; y < (two ? 44 : h - 10); y += 6) g.fillRect(x + 6, y, two ? 40 : 20, 2); });
  io.ocp.forEach((x, k) => sfp(g, x, io.ocpY, P, k < 2));
  const [ox, oy] = io.oob;
  g.fillStyle = P.port; g.fillRect(ox - 8, oy - 7, 16, 14); g.fillStyle = P.led; g.fillRect(ox - 7, oy - 6, 3, 2); g.fillRect(ox + 4, oy - 6, 3, 2);
  g.fillStyle = P.port; g.fillRect(ox + 14, oy - 8, 12, 6); g.fillRect(ox + 14, oy + 2, 12, 6);
  g.fillStyle = P.vga; g.fillRect(ox + 32, oy - 5, 22, 10);
  const pw = 72, py = two ? 52 : 3, ph = two ? h - 56 : h - 6;
  [w - 26 - 2 * pw - 4, w - 26 - pw].forEach(x => {
    g.fillStyle = P.psu; g.fillRect(x, py, pw, ph);
    grille(g, x + 16, py + ph / 2, Math.min(13, ph / 2 - 2), P);
    g.fillStyle = P.port; g.fillRect(x + 34, py + ph / 2 - 8, 14, 16);
    g.fillStyle = P.handle; g.fillRect(x + 60, py + 4, 5, ph - 8);
    g.fillStyle = P.led; g.fillRect(x + 50, py + 4, 5, 3);
  });
}

// ---------- Generic chassis: any other make, and any 3U or 4U server ----------
// Front: grey ears with pull handles, the status LEDs in the left ear, 3.5" carriers four across in rows (one row in
// 1U, three in 2U, four in 3U, six in 4U), and a slotted vent at the right with the power button
const GEN_ROWS = { 1: 1, 2: 3, 3: 4, 4: 6 };
const genLed = (h, H) => h === 1 ? [-0.0105, 0.0105] : [H / 2 - 0.03, H / 2 - 0.012];
const genBays = (h, ph) => {
  const n = GEN_ROWS[h], m = 3, rh = (ph - 2 * m) / n, out = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < 4; c++) out.push([28 + c * 99, m + r * rh + 0.5, 96, rh - 1]);
  return out;
};
export function drawFrontGeneric(g, w, ph, P, h) {
  const H = plateH(h), ly = genLed(h, H).map(y => ph / 2 - y / H * ph);
  g.fillStyle = P.bezel; g.fillRect(0, 0, w, ph);
  [0, w - 22].forEach(x => {
    g.fillStyle = P.ear; g.fillRect(x, 0, 22, ph); g.fillStyle = P.hole; g.fillRect(x === 0 ? 21 : x, 0, 1, ph);
    const hy = Math.max(...ly) + 12;
    if (ph - hy - 6 > 10) { g.strokeStyle = P.handle; g.lineWidth = 3; g.strokeRect(x + 7, hy, 8, ph - hy - 6); }
  });
  ly.forEach(y => { g.fillStyle = P.hole; g.fillRect(2, y - 9.5, 18, 19); g.fillStyle = P.panel; g.fillRect(3, y - 8.5, 16, 17); });
  g.fillStyle = P.hole; g.fillRect(25, 1, 404, ph - 2);
  for (const [x, y, bw, bh] of genBays(h, ph)) {
    g.fillStyle = P.carrier; g.fillRect(x, y, bw, bh);
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x, y, bw, 0.8);
    g.fillStyle = P.hole; for (let xx = x + 5; xx < x + 60; xx += 4) g.fillRect(xx, y + 4, 2, bh - 8);
    g.fillStyle = P.btn; g.fillRect(x + 66, y + bh / 2 - 4, 22, 8);
    g.fillStyle = P.pipe; g.fillRect(x + 90, y + 4, 3, 2.4); g.fillRect(x + 90, y + 9, 3, 2.4);
  }
  g.fillStyle = P.hex; g.fillRect(432, 1, 56, ph - 2);
  g.fillStyle = P.hole; for (let x = 436; x < 484; x += 5) g.fillRect(x, 6, 2.4, ph - 12);
  g.fillStyle = P.pwr; g.beginPath(); g.arc(w - 11, Math.min(ph - 9, 12), 5, 0, Math.PI * 2); g.fill();
  g.fillStyle = P.panel; g.beginPath(); g.arc(w - 11, Math.min(ph - 9, 12), 3.7, 0, Math.PI * 2); g.fill();
}
// Rear: the BMC port, USB, VGA and two SFP28 cages at the left, PCIe slot covers in the middle, power supplies at the right
const genIO = (h, ph) => { const y = h === 1 ? 22 : ph - 22; return { oob: [44, y], ocp: [84, 104], y }; };
export function drawRearGeneric(g, w, ph, P, h) {
  const io = genIO(h, ph);
  g.fillStyle = P.base; g.fillRect(0, 0, w, ph); ears(g, w, ph, P);
  const [ox, oy] = io.oob;
  g.fillStyle = P.port; g.fillRect(ox - 8, oy - 7, 16, 14); g.fillStyle = P.led; g.fillRect(ox - 7, oy - 6, 3, 2); g.fillRect(ox + 4, oy - 6, 3, 2);
  io.ocp.forEach(x => sfp(g, x, io.y, P, true));
  g.fillStyle = P.port; g.fillRect(122, io.y - 8, 12, 6); g.fillRect(122, io.y + 2, 12, 6);
  g.fillStyle = P.vga; g.fillRect(140, io.y - 5, 22, 10);
  const slotTop = 4, slotH = h === 1 ? ph - 8 : ph - 44;
  for (let x = 172; x < 352; x += 30) { g.fillStyle = P.slot; g.fillRect(x, slotTop, 26, slotH); g.fillStyle = P.hole; for (let y = slotTop + 6; y < slotTop + slotH - 4; y += 6) g.fillRect(x + 6, y, 14, 2); }
  const n = h === 1 ? 1 : 2, psH = (ph - 8 - (n - 1) * 3) / n;
  for (let k = 0; k < n; k++) {
    const y = 4 + k * (psH + 3), x = h === 1 ? 400 : 362;
    g.fillStyle = P.psu; g.fillRect(x, y, w - 26 - x, psH);
    grille(g, x + 18, y + psH / 2, Math.min(14, psH / 2 - 2), P);
    g.fillStyle = P.port; g.fillRect(x + 40, y + psH / 2 - 8, 14, 16);
    g.fillStyle = P.handle; g.fillRect(w - 26 - 10, y + 4, 5, psH - 8);
  }
}

// ---------- Faces by maker and height ----------
// What each kind of server looks like: its front and rear drawings (grid pixels high), the raised parts of the front
// for the relief geometry, the two status LEDs (metres from the face centre: activity, then health) and the rear ports
// its patch leads plug into (out-of-band first, then NIC 1 and NIC 2). Dell and HPE in 1U and 2U; anything else, or
// taller, is the generic chassis.
export const gridH = h => h === 1 ? 44 : 43 * h;
const earsAnd = (ph, bays) => [[0, 0, 22, ph], [490, 0, 22, ph], ...bays];
const sff8 = ph => Array.from({ length: 8 }, (_, i) => [28 + i * 36, ph > 50 ? 4 : 3, 33, ph - (ph > 50 ? 8 : 6)]);
const faces = new Map();
export function faceSpec(family, h) {
  const k = (family === 'dell' || family === 'hpe') && h <= 2 ? `${family}|${h}` : `other|${h}`;
  if (faces.has(k)) return faces.get(k);
  const ph = gridH(h), f = k.split('|')[0];
  let spec;
  if (f === 'dell') {
    const io = REAR_IO[h];
    spec = { front: drawFront, rear: h === 1 ? drawRear1U : drawRear, relief: earsAnd(ph, sff8(ph)), led: { x: FRONT_LED.x, y: FRONT_LED.y[h] }, ports: [io.idrac, [io.ocp[0], io.ocpY], [io.ocp[1], io.ocpY]] };
  } else if (f === 'hpe') {
    const io = HPE_IO[h];
    spec = { front: drawFrontHPE, rear: drawRearHPE, relief: earsAnd(ph, sff8(ph)), led: { x: HPE_LED.x, y: HPE_LED.y[h] }, ports: [io.oob, [io.ocp[0], io.ocpY], [io.ocp[1], io.ocpY]] };
  } else {
    const io = genIO(h, ph);
    spec = { front: (g, w, hh, P) => drawFrontGeneric(g, w, hh, P, h), rear: (g, w, hh, P) => drawRearGeneric(g, w, hh, P, h), relief: earsAnd(ph, genBays(h, ph)),
      led: { x: FRONT_LED.x, y: genLed(h, plateH(h)) }, ports: [io.oob, [io.ocp[0], io.y], [io.ocp[1], io.y]] };
  }
  Object.assign(spec, { key: k, family: f, h, ph });
  faces.set(k, spec);
  return spec;
}
// 1U switch, fan/PSU side (faces the cold aisle) and port side (faces the hot aisle)
export function drawSwFans(g, w, h, P) {
  g.fillStyle = P.base; g.fillRect(0, 0, w, h); ears(g, w, h, P);
  for (let i = 0; i < 5; i++) { g.fillStyle = P.psu; g.fillRect(32 + i * 62, 3, 56, h - 6); grille(g, 60 + i * 62, h / 2, 17, P); }
  [350, 420].forEach(x => { g.fillStyle = P.psu; g.fillRect(x, 3, 64, h - 6); g.fillStyle = P.handle; g.fillRect(x + 54, 8, 5, h - 16); g.fillStyle = P.port; g.fillRect(x + 8, 10, 18, h - 20); g.fillStyle = P.led; g.fillRect(x + 32, 8, 6, 4); });
}
// Port n (from 1) of a switch's 48 access ports, odd ones on top as switches number them: its centre in grid pixels
export const SW_PORT = n => [34 + ((n - 1) >> 1) * 14.5, (n - 1) & 1 ? 31.5 : 12.5];
// The first 24 ports are cabled to servers (lit); the rest stand empty. The 100G uplinks carry fibre to the riser.
export function drawSwPorts(g, w, h, P) {
  g.fillStyle = P.base; g.fillRect(0, 0, w, h); ears(g, w, h, P);
  for (let n = 1; n <= 48; n++) {
    const [cx, cy] = SW_PORT(n), x = cx - 6, y = cy - 6.5;
    g.fillStyle = P.cage; g.fillRect(x, y, 12, 13); g.fillStyle = P.port; g.fillRect(x + 1, y + 1, 10, 11);
    g.fillStyle = n <= 24 ? P.led : P.panel; g.fillRect(x + 2, (n - 1) & 1 ? y + 14 : y - 4, 3, 2);
  }
  for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) {
    const x = 384 + i * 25, y = k ? h - 19 : 6;
    g.fillStyle = P.port; g.fillRect(x, y, 21, 13); g.fillStyle = P.led; g.fillRect(x + 8, k ? y + 14 : y - 4, 4, 2);
  }
}
export function drawPatch(g, w, h, P) {
  g.fillStyle = P.base; g.fillRect(0, 0, w, h); ears(g, w, h, P);
  for (let i = 0; i < 24; i++) {
    const x = 32 + i * 18.5;
    g.fillStyle = P.port; g.fillRect(x, 12, 14, h - 24);
    g.fillStyle = P.cable; g.fillRect(x + 2, 15, 4, h - 30); g.fillRect(x + 8, 15, 4, h - 30);
  }
}
export function drawBlank(g, w, h, P) {
  g.fillStyle = P.base; g.fillRect(0, 0, w, h); ears(g, w, h, P);
  g.fillStyle = P.hole; g.fillRect(22, 0, w - 44, 1.5); g.fillRect(22, h - 1.5, w - 44, 1.5);
  g.fillStyle = P.panel; for (let x = 60; x < w - 60; x += 12) g.fillRect(x, h / 2 - 5, 6, 10);
}
