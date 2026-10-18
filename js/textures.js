// Procedural textures for cabinets and rack-mounted hardware, all drawn on canvas.
import { THREE, canvasTex, speckle } from './core.js';

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
  drawSide(g, w, h, k === 3);
  // front and rear edges get knocked, the bottom gets kicked; the vendor cabinet is the newest and least worn
  const n = k % 3;
  scuffs(g, 0, 0, 22, h, 10 + n * 14); scuffs(g, w - 22, 0, 22, h, 6 + n * 10); scuffs(g, 0, h - 70, w, 66, 8 + n * 12);
}));
export const roughTex = canvasTex(128, 256, (g, w, h) => { g.fillStyle = '#a0a0a0'; g.fillRect(0, 0, w, h); speckle(g, w, h, 6000, 0.12); }, true);
const drawTop = vendor => (g, w, h) => {
  g.fillStyle = vendor ? '#20252a' : '#1a222b'; g.fillRect(0, 0, w, h); speckle(g, w, h, 7000, 0.035);
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
  g.fillStyle = '#151c23'; g.fillRect(0, 0, w, h); speckle(g, w, h, 5000, 0.04);
  g.fillStyle = '#07090c'; for (let x = 24; x < w - 24; x += 10) g.fillRect(x, 12, 5, 18);
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, h - 3, w, 2);
});
export const plinthTex = canvasTex(512, 64, (g, w, h) => {
  g.fillStyle = '#10161c'; g.fillRect(0, 0, w, h); speckle(g, w, h, 3000, 0.04);
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
  speckle(g, w, h, 4000, 0.03);
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
  if (vendor) { g.fillStyle = '#4a535c'; g.fillRect(70, 22, 100, 18); g.fillStyle = '#1a1f24'; g.fillRect(76, 28, 88, 6); }
  // the lock strip is handled every day; the bottom rail gets kicked
  const n = k % 3;
  scuffs(g, w - 36, h * 0.3, 36, h * 0.4, 14 + n * 12); scuffs(g, 0, h - 26, w, 26, 6 + n * 10); scuffs(g, 0, 0, 6, h, 4 + n * 6);
}));
const alphaStd = canvasTex(DOOR_W, DOOR_H, (g, w, h) => doorHoles(g, w, h, '#ffffff', '#1a1a1a'), true);
export const doorAlphas = [alphaStd, alphaStd, alphaStd, canvasTex(DOOR_W, DOOR_H, (g, w, h) => doorHoles(g, w, h, '#ffffff', '#1a1a1a', true), true)];

// ---------- Rack-mounted hardware ----------
// Each face is drawn three times: colour, height map for bump shading, and glow (LEDs only).
const BUMP = { base: '#808080', ear: '#a8a8a8', handle: '#ffffff', hole: '#000000', caddy: '#909090', latch: '#d0d0d0', panel: '#707070', tag: '#c0c0c0', psu: '#989898', slot: '#a0a0a0', port: '#101010', cable: '#e0e0e0', led: '#000000', vga: '#202020' };
const PAL = { base: '#2b343d', ear: '#3a4550', handle: '#a3aeb8', hole: '#080a0d', caddy: '#1f262d', latch: '#8f9aa4', panel: '#161c22', tag: '#d2d9df', psu: '#2a323a', slot: '#29313a', port: '#090c0f', cable: '#33b5c9', led: '#000000', vga: '#2d5fa8' };
const GLOW = Object.fromEntries(Object.keys(PAL).map(k => [k, '#000000']));
GLOW.led = '#46ff9a';
export function plateMat(w, h, draw, opts) {
  const { glow, ...rest } = opts || {};
  const tex = canvasTex(w, h, (g) => draw(g, w, h, PAL));
  const bump = canvasTex(w, h, (g) => draw(g, w, h, BUMP), true);
  const m = new THREE.MeshStandardMaterial(Object.assign({ map: tex, bumpMap: bump, bumpScale: 0.6, roughnessMap: roughTex, metalness: 0.55, roughness: 0.7 }, rest));
  if (glow) { m.emissiveMap = canvasTex(w, h, (g) => draw(g, w, h, GLOW)); m.emissive = new THREE.Color(0xffffff); m.emissiveIntensity = 2.2; }
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
// 2U server front: rack ears with handles, 8 NVMe caddies, honeycomb intake, control panel (LEDs are separate meshes)
export function drawFront(g, w, h, P) {
  g.fillStyle = P.base; g.fillRect(0, 0, w, h);
  ears(g, w, h, P);
  [0, w - 22].forEach(x => { g.strokeStyle = P.handle; g.lineWidth = 4; g.strokeRect(x + 7, 14, 8, h - 28); });
  for (let i = 0; i < 8; i++) {
    const x = 28 + i * 36;
    g.fillStyle = P.caddy; g.fillRect(x, 5, 33, h - 10);
    g.fillStyle = P.hole;
    for (let y = 10; y < h * 0.52; y += 5) for (let xx = x + 4; xx < x + 30; xx += 5) g.fillRect(xx, y, 2.4, 2.4);
    g.fillStyle = P.latch; g.fillRect(x + 3, h - 27, 27, 15);
    g.fillStyle = P.hole; g.fillRect(x + 3, h - 20, 27, 1.5); g.fillRect(x + 25, h - 35, 4, 4);
  }
  g.fillStyle = P.hole;
  for (let y = 9, k = 0; y < h - 6; y += 6, k++) for (let x = 326 + (k % 2) * 3.5; x < 426; x += 7) { g.beginPath(); g.arc(x, y, 2.3, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = P.panel; g.fillRect(430, 5, 56, h - 10);
  g.fillStyle = P.tag; g.fillRect(436, h - 19, 44, 8);
}
// 2U server rear: two hot-swap PSUs, I/O, SFP28 with fibre leads, PCIe slot covers
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
  g.fillStyle = P.port; g.fillRect(202, 18, 12, 6); g.fillRect(202, 30, 12, 6); g.fillRect(250, 14, 16, 14);
  g.fillStyle = P.vga; g.fillRect(220, 16, 24, 11);
  g.fillStyle = P.led; g.fillRect(251, 15, 3, 2); g.fillRect(262, 15, 3, 2);
  [276, 296, 322, 342].forEach(x => {
    g.fillStyle = P.port; g.fillRect(x, 38, 16, 11);
    g.fillStyle = P.cable; g.fillRect(x + 3, 47, 10, h - 47);
    g.fillStyle = P.led; g.fillRect(x + 6, 33, 4, 3);
  });
  for (let i = 0; i < 4; i++) {
    const x = 368 + i * 29;
    g.fillStyle = P.slot; g.fillRect(x, 4, 25, h - 8);
    g.fillStyle = P.hole; for (let y = 10; y < h - 10; y += 6) g.fillRect(x + 6, y, 13, 2);
  }
}
// 1U server front: rack ears with handles, eight NVMe carriers lined up with the 2U ones, honeycomb intake, control panel
export function drawFront1U(g, w, h, P) {
  g.fillStyle = P.base; g.fillRect(0, 0, w, h);
  ears(g, w, h, P);
  [0, w - 22].forEach(x => { g.strokeStyle = P.handle; g.lineWidth = 3; g.strokeRect(x + 7, 8, 8, h - 16); });
  for (let i = 0; i < 8; i++) {
    const x = 28 + i * 36;
    g.fillStyle = P.caddy; g.fillRect(x, 4, 33, h - 8);
    g.fillStyle = P.hole; for (let xx = x + 4; xx < x + 22; xx += 4) g.fillRect(xx, 8, 2, h - 16);
    g.fillStyle = P.latch; g.fillRect(x + 23, 8, 7, h - 16);
  }
  g.fillStyle = P.hole;
  for (let y = 7, k = 0; y < h - 4; y += 6, k++) for (let x = 326 + (k % 2) * 3.5; x < 426; x += 7) { g.beginPath(); g.arc(x, y, 2.3, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = P.panel; g.fillRect(430, 4, 56, h - 8);
  g.fillStyle = P.tag; g.fillRect(436, h - 14, 44, 6);
}
// 1U server rear: a power supply at each side, OCP NIC with fibre leads, a low-profile PCIe slot, I/O
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
  g.fillStyle = P.port; g.fillRect(124, 10, 12, 6); g.fillRect(124, 22, 12, 6); g.fillRect(142, 12, 16, 12);
  g.fillStyle = P.vga; g.fillRect(164, 12, 22, 10);
  [200, 220, 246, 266].forEach(x => {
    g.fillStyle = P.port; g.fillRect(x, 8, 16, 11);
    g.fillStyle = P.cable; g.fillRect(x + 3, 17, 10, h - 17);
    g.fillStyle = P.led; g.fillRect(x + 6, 4, 4, 3);
  });
  g.fillStyle = P.slot; g.fillRect(296, 4, 100, h - 8);
  g.fillStyle = P.hole; for (let x = 304; x < 390; x += 8) g.fillRect(x, 10, 4, h - 20);
}
// 1U switch, fan/PSU side (faces the cold aisle) and port side (faces the hot aisle)
export function drawSwFans(g, w, h, P) {
  g.fillStyle = P.base; g.fillRect(0, 0, w, h); ears(g, w, h, P);
  for (let i = 0; i < 5; i++) { g.fillStyle = P.psu; g.fillRect(32 + i * 62, 3, 56, h - 6); grille(g, 60 + i * 62, h / 2, 17, P); }
  [350, 420].forEach(x => { g.fillStyle = P.psu; g.fillRect(x, 3, 64, h - 6); g.fillStyle = P.handle; g.fillRect(x + 54, 8, 5, h - 16); g.fillStyle = P.port; g.fillRect(x + 8, 10, 18, h - 20); g.fillStyle = P.led; g.fillRect(x + 32, 8, 6, 4); });
}
export function drawSwPorts(g, w, h, P) {
  g.fillStyle = P.base; g.fillRect(0, 0, w, h); ears(g, w, h, P);
  for (let i = 0; i < 24; i++) for (let k = 0; k < 2; k++) {
    const x = 28 + i * 14.5, y = k ? h - 19 : 6;
    g.fillStyle = P.port; g.fillRect(x, y, 12, 13);
    if ((i * 7 + k * 3) % 5 < 4) { g.fillStyle = P.led; g.fillRect(x + 2, k ? y + 14 : y - 4, 3, 2); g.fillStyle = P.cable; g.fillRect(x + 3, y + 3, 6, 7); }
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
