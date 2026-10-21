// The pulled-out server: an open-lid rack server at true scale, local +z = front, and its per-core telemetry.
// A model is built for each kind of server (its face, 1U to 4U, sockets, AMD or Intel, DIMM count) when one is first
// pulled out, and reused for the next of its kind. Front to back: eight NVMe drives and their backplane,
// the fan wall, the CPU sockets with their heatsinks and DIMMs, then PCIe risers, OCP NIC, BOSS boot module, PSUs.
import { THREE, scene, lc, COL, clamp, grad, gradIn, LST, U, ease, reduceMotion, canvasTex, speckle } from './core.js';
import { W, SV } from './state.js';
import { faceMats, faceGeo, LED, setInstance, doorOpen } from './racks.js';
import { faceSpec } from './textures.js';
import { prepare } from './lights.js';
import { makePoints } from './particles.js';

export const SRV = new THREE.Group(); SRV.visible = false; scene.add(SRV);
// Hex colours here are sRGB, as picked; converted to the linear values the renderer works in
const std = (color, metalness, roughness, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: typeof color === 'number' ? lc(color) : color, metalness, roughness }, extra));
const steel = std(0x9aa3ab, 0.7, 0.55);            // zinc-plated chassis steel
const darkMetal = std(0x1c252e, 0.6, 0.45);
const blackPlastic = std(0x111417, 0.1, 0.7);
const touch = std(lc('#1f7bd1'), 0.1, 0.5);        // Dell's blue touch points: the latches and handles you are meant to use
const copper = std(lc('#b8734a'), 0.9, 0.35);
const pcbMat = std(0x1d3b2e, 0.2, 0.75);
const cardMat = std(0x245640, 0.2, 0.7);
const driveMat = std(0x8d969e, 0.7, 0.4);
const cableMat = std(0x2b3035, 0.1, 0.8);
const chokeMat = std(0x2a2f34, 0.4, 0.6);
const latchMat = std(0x9fa4a9, 0.1, 0.7);
const cellMat = std(0xc8ccd0, 0.9, 0.3);
const sinkTop = std(0x8f9aa3, 0.8, 0.4);
// the carrier frame the processor package sits in: orange on AMD's SP5, dark on Intel's LGA sockets
const CARRIER = { amd: std(lc('#e07a2e'), 0.1, 0.6), intel: std(0x3a4048, 0.3, 0.6) };
const ringMat = new THREE.MeshBasicMaterial({ color: lc('#2a3038'), side: THREE.DoubleSide });
const basic = c => new THREE.MeshBasicMaterial({ color: c || 0xffffff, toneMapped: false });
const M4 = new THREE.Matrix4();
// DDR5 RDIMM: green board, ten DRAM packages a side, the register in the middle, PMIC at one end, gold contacts below
const dimmTex = canvasTex(256, 64, (g, w, h) => {
  g.fillStyle = '#1d5c3a'; g.fillRect(0, 0, w, h); speckle(g, w, h, 600, 0.05);
  g.fillStyle = '#c9a227'; g.fillRect(4, h - 7, w - 8, 7);
  g.fillStyle = '#16181a';
  for (let i = 0; i < 10; i++) { const x = 10 + i * 23 + (i >= 5 ? 14 : 0); g.fillRect(x, 16, 17, 26); }
  g.fillRect(w / 2 - 10, 18, 20, 20); g.fillStyle = '#2a2d31'; g.fillRect(w - 18, 20, 10, 10);
  g.fillStyle = '#e8ebee'; g.fillRect(12, 4, 60, 8);
});
const dimmGeo = new THREE.BoxGeometry(0.0035, 0.031, 0.133);

// Build the open chassis of one server model
function build(m) {
  const g = new THREE.Group(); g.visible = false; SRV.add(g);
  const V = { g, m, rotors: [], sinkMats: [], dimmMats: [], driveLeds: [], cpuLabels: [], meshes: [] };
  const H = m.u * U, YB = -H / 2, BT = YB + 0.00725, two = m.u >= 2;   // height, bottom, top of the system board
  const box = (w, h, d, mat, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); g.add(o); return o; };
  const many = (geo, mat, pts) => { const o = new THREE.InstancedMesh(geo, mat, pts.length); pts.forEach(([x, y, z], i) => o.setMatrixAt(i, M4.makeTranslation(x, y, z))); g.add(o); return o; };
  // a printed label lying flat; redrawn when a different server is pulled out
  const label = (w, h, x, y, z) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * h / w);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std(0x9a9ea2, 0, 0.9, { map: t }));
    o.position.set(x, y, z); o.rotation.x = -Math.PI / 2; g.add(o);
    return draw => { draw(c.getContext('2d'), c.width, c.height); t.needsUpdate = true; };
  };

  // ---------- Chassis ----------
  box(0.5, 0.004, 0.9, steel, 0, YB + 0.0025, 0);
  box(0.006, H - 0.005, 0.9, steel, -0.252, 0, 0); box(0.006, H - 0.005, 0.9, steel, 0.252, 0, 0);
  box(0.006, 0.016, 0.95, darkMetal, -0.262, YB + 0.0165, -0.9); box(0.006, 0.016, 0.95, darkMetal, 0.262, YB + 0.0165, -0.9);
  const fspec = faceSpec(m.family, m.u), face = new THREE.Mesh(faceGeo(fspec), faceMats(fspec).front); face.position.z = 0.456; g.add(face);
  V.frontLed = [0, 1].map(k => box(0.016, 0.016, 0.008, basic(), fspec.led.x, fspec.led.y[k], 0.466));

  // ---------- Front: eight NVMe drives in carriers lined up with the front plate, backplane, cables ----------
  const dh = two ? 0.068 : 0.03, dy = YB + 0.0045 + dh / 2;
  for (let i = 0; i < 8; i++) {
    const x = -0.2148 + 0.0366 * i;
    box(0.026, dh, 0.1, driveMat, x, dy, 0.39);
    box(0.031, 0.004, 0.1, blackPlastic, x, dy + dh / 2 + 0.002, 0.39);
    V.driveLeds.push({ m: box(0.008, 0.003, 0.006, basic(), x + 0.009, dy + dh / 2 + 0.0055, 0.436), on: false });
  }
  box(0.004, H - 0.009, 0.11, steel, -0.237, 0, 0.39); box(0.004, H - 0.009, 0.11, steel, 0.08, 0, 0.39);
  box(0.32, H - 0.019, 0.003, pcbMat, -0.08, YB + 0.0045 + (H - 0.019) / 2, 0.336);
  many(new THREE.BoxGeometry(0.02, Math.min(0.012, H * 0.25), 0.008), blackPlastic, [0, 1, 2, 3].map(k => [-0.2 + k * 0.073, BT + 0.019 * m.u / 2, 0.33]));
  // MCIO cables from the backplane, along the left wall and in to the board in front of the first CPU
  [0, 1, 2, 3].forEach(k => {
    box(0.003, two ? 0.012 : 0.006, 0.25, cableMat, -0.246 + k * 0.004, BT + 0.006 + k * (two ? 0.004 : 0.002), 0.205);
    box(0.03 + k * 0.012, 0.003, 0.012, cableMat, -0.23 + (0.03 + k * 0.012) / 2, BT + 0.002, 0.085 - k * 0.003);
  });

  // ---------- Fan wall: six 60 mm fans in 2U, eight 40 mm fans in 1U ----------
  const nf = two ? 6 : 8, pitch = 0.456 / nf, fw = pitch - 0.01, fs = H - 0.02, rr = Math.min(fw, fs) * 0.45;
  box(0.48, 0.004, 0.01, darkMetal, 0, H / 2 - 0.004, 0.205); box(0.48, 0.004, 0.01, darkMetal, 0, H / 2 - 0.004, 0.265);
  const bladeGeo = new THREE.BoxGeometry(rr * 0.75, rr * 0.3, 0.002), hubGeo = new THREE.CylinderGeometry(rr * 0.32, rr * 0.32, 0.016, 16);
  for (let i = 0; i < nf; i++) {
    const x = -0.228 + pitch / 2 + i * pitch;
    box(fw, 0.005, 0.056, blackPlastic, x, fs / 2, 0.235); box(fw, 0.005, 0.056, blackPlastic, x, -fs / 2, 0.235);
    box(0.005, fs, 0.056, blackPlastic, x - fw / 2, 0, 0.235); box(0.005, fs, 0.056, blackPlastic, x + fw / 2, 0, 0.235);
    box(Math.min(0.02, fw * 0.5), 0.004, 0.012, touch, x, fs / 2 + 0.004, 0.252);
    const ring = new THREE.Mesh(new THREE.RingGeometry(rr * 0.9, rr, 28), ringMat); ring.position.set(x, 0, 0.262); g.add(ring);
    const rotor = new THREE.Group(); rotor.position.set(x, 0, 0.25); g.add(rotor);
    const hub = new THREE.Mesh(hubGeo, blackPlastic); hub.rotation.x = Math.PI / 2; rotor.add(hub);
    for (let b = 0; b < 7; b++) {
      const arm = new THREE.Group(); arm.rotation.z = b * Math.PI * 2 / 7;
      const blade = new THREE.Mesh(bladeGeo, blackPlastic); blade.position.x = rr * 0.6; blade.rotation.x = 0.5; arm.add(blade); rotor.add(arm);
    }
    V.rotors.push(rotor);
  }

  // ---------- System board: sockets with heatsinks, DIMMs either side, VRM chokes ----------
  box(0.488, 0.0025, 0.62, pcbMat, 0, BT - 0.00125, -0.12);
  const SZ = 0.02, perSide = m.dimms / m.sockets / 2, dp = perSide > 8 ? 0.0082 : perSide > 6 ? 0.0078 : 0.0085;
  V.sockX = m.sockets === 1 ? [0] : perSide > 6 ? [-0.118, 0.118] : [-0.112, 0.112];
  const bw = m.cores > 64 ? 0.09 : 0.078, fh = two ? 0.05 : 0.02, baseTop = BT + 0.01325;
  V.sockX.forEach(cx => {
    box(bw + 0.018, 0.004, 0.106, darkMetal, cx, BT + 0.00225, SZ);
    box(bw + 0.008, 0.0025, 0.096, CARRIER[m.vendor], cx, BT + 0.00475, SZ);
    box(bw, 0.007, 0.086, copper, cx, BT + 0.00975, SZ);
    const sm = std(0x9aa6b0, 0.85, 0.35, { emissive: 0x000000 }); V.sinkMats.push(sm);
    const nfin = Math.round(bw / 0.00367);
    many(new THREE.BoxGeometry(0.0006, fh, 0.086), sm, Array.from({ length: nfin }, (_, j) => [cx - bw / 2 + 0.001 + j * (bw - 0.002) / (nfin - 1), baseTop + fh / 2, SZ]));
    // heat pipes across the top of the fin stack, the four captive screws, the label
    [-0.036, -0.026, 0.026, 0.036].forEach(dz => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.0026, 0.0026, bw + 0.002, 10), copper);
      p.rotation.z = Math.PI / 2; p.position.set(cx, baseTop + fh + 0.0013, SZ + dz); g.add(p);
    });
    many(new THREE.CylinderGeometry(0.0035, 0.0035, 0.01, 10), darkMetal, [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => [cx + a * (bw / 2 + 0.005), BT + 0.015, SZ + b * 0.048]));
    V.cpuLabels.push(label(Math.min(0.062, bw - 0.012), 0.02, cx, baseTop + fh + 0.001, SZ));
    many(new THREE.BoxGeometry(0.008, 0.008, 0.008), chokeMat, Array.from({ length: 7 }, (_, j) => [cx - 0.036 + j * 0.012, BT + 0.00425, SZ - 0.07]));
  });
  // DIMMs fill alternating sockets and sides, so every memory bank populates evenly
  const slotPts = [], latchPts = [];
  for (let i = 0; i < m.dimms; i++) {
    const s = i % m.sockets, slot = Math.floor(i / m.sockets), side = slot % 2 ? 1 : -1, k = slot >> 1;
    const x = V.sockX[s] + side * (0.052 + k * dp);
    const mm = std(0xffffff, 0.3, 0.6, { map: dimmTex, emissive: lc(COL.cold), emissiveIntensity: 0 }); V.dimmMats.push(mm);
    const d = new THREE.Mesh(dimmGeo, mm); d.position.set(x, BT + 0.0175, SZ); g.add(d);
    slotPts.push([x, BT + 0.0045, SZ]); latchPts.push([x, BT + 0.0075, SZ - 0.072], [x, BT + 0.0075, SZ + 0.072]);
  }
  many(new THREE.BoxGeometry(0.0062, 0.009, 0.142), blackPlastic, slotPts);
  many(new THREE.BoxGeometry(0.0062, 0.013, 0.004), latchMat, latchPts);

  // ---------- Rear: PCIe risers, OCP NIC, BOSS-N1, BMC, CMOS cell, power supplies ----------
  const rh = H - 0.017;
  (two ? [-0.165, -0.04] : [-0.04]).forEach(x => {
    box(0.003, rh, 0.15, steel, x - 0.055, 0, -0.355); box(0.003, rh, 0.15, steel, x + 0.055, 0, -0.355);
    box(0.11, 0.004, 0.02, touch, x, H / 2 - 0.0045, -0.29);
    box(0.004, rh - 0.008, 0.12, pcbMat, x + 0.05, 0, -0.36);
    box(0.1, 0.002, 0.13, cardMat, x, two ? 0.008 : 0.004, -0.36);
    box(0.03, Math.min(0.012, rh * 0.3), 0.04, sinkTop, x - 0.01, (two ? 0.008 : 0.004) + 0.007, -0.35);
    box(0.11, rh, 0.002, darkMetal, x, 0, -0.437);
  });
  const ocpX = two ? -0.145 : 0.06;
  box(0.1, 0.002, 0.09, cardMat, ocpX, BT + 0.004, -0.39);
  V.nicLeds = [ocpX - 0.025, ocpX + 0.025].map(x => { box(0.018, 0.012, 0.012, darkMetal, x, BT + 0.012, -0.428); return { m: box(0.006, 0.004, 0.003, basic(), x + 0.012, BT + 0.02, -0.435), on: false }; });
  box(0.05, Math.min(0.022, H * 0.45), 0.085, blackPlastic, two ? 0.085 : -0.13, BT + Math.min(0.011, H * 0.22), -0.38);
  box(0.016, 0.002, 0.016, blackPlastic, 0.04, BT + 0.001, -0.22);
  { const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.003, 20), cellMat); cell.position.set(-0.01, BT + 0.0015, -0.25); g.add(cell); }
  // 2U: two supplies stacked at one side behind a distribution board; 1U: one at each rear corner
  const psus = two ? [[0.195, -0.017], [0.195, 0.019]] : [[-0.205, 0], [0.205, 0]];
  if (two) box(0.09, 0.07, 0.003, pcbMat, 0.195, -0.004, -0.275);
  const PH = two ? 0.034 : H - 0.008;
  V.psuLeds = psus.map(([x, y]) => { box(two ? 0.085 : 0.07, PH, 0.16, steel, x, y, -0.36); return box(0.01, Math.min(0.01, PH * 0.3), 0.004, basic(lc(COL.ok)), x + 0.025, y, -0.442); });
  V.tagLabel = label(0.12, 0.045, 0.165, YB + 0.005, 0.39);

  g.traverse(o => { if (o.isMesh) { o.userData.srv = true; V.meshes.push(o); } });
  return V;
}
// One model per kind of server, built when the first of its kind is pulled out and given the hall's lighting and clipping
const VARIANTS = new Map();
const variant = m => { if (!VARIANTS.has(m.key)) { const v = build(m); prepare(v.g); VARIANTS.set(m.key, v); } return VARIANTS.get(m.key); };
let cur = null;
const PSU_OK = lc(COL.ok).multiplyScalar(2);

// Print the model, serial and CPU labels for the server being pulled out, in its maker's colour (Dell blue, HPE green)
const LABEL = { dell: ['#1f7bd1', 'Service Tag'], hpe: ['#01a982', 'Serial'], other: ['#5b6670', 'Serial'] };
function printLabels(sv) {
  const [ink, tag] = LABEL[sv.spec.family];
  cur.tagLabel((g, w, h) => {
    g.fillStyle = '#f2f3f4'; g.fillRect(0, 0, w, h); g.fillStyle = ink; g.fillRect(0, 0, w, 16);
    g.fillStyle = '#ffffff'; g.font = '600 12px "IBM Plex Mono", monospace'; g.fillText(sv.model.replace(new RegExp('^' + sv.rec.maker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' ', 'i'), ''), 6, 12);
    g.fillStyle = '#16181a'; g.font = '500 14px "IBM Plex Mono", monospace'; g.fillText(`${tag} ${sv.serial}`, 6, 36);
    g.font = '400 11px "IBM Plex Mono", monospace'; g.fillText(sv.host, 6, 56);
    for (let x = 6; x < w - 6; x += 3) if ((x * 7) % 5 < 3) g.fillRect(x, 66, 2, h - 72);
  });
  const m = sv.spec, name = sv.cpu.replace(/^\d+\s*×\s*/, ''), note = `${m.cores} cores${m.ghz ? ` · ${m.ghz} GHz` : ''}`;
  cur.cpuLabels.forEach((draw, k) => draw((g, w, h) => {
    g.fillStyle = '#d9dde1'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#16181a'; g.font = '600 24px "IBM Plex Mono", monospace'; g.fillText(name, 10, 38);
    g.font = '400 18px "IBM Plex Mono", monospace'; g.fillText(`CPU ${k + 1} · ${note}`, 10, 70);
  }));
}

// Every solid part of the model on show (not the air particles below): clicking one pushes the server back in
export const srvMeshes = [];

// Air drawn through the chassis front to back, and heat rising off the heatsinks
export const air = makePoints(220, 0.028, SRV), shim = makePoints(90, 0.045, SRV);
function resetAir(i, scatter) {
  const o = i * 3, hh = cur.m.u * U / 2 - 0.008;
  air.pos[o] = (Math.random() - 0.5) * 0.46; air.pos[o + 1] = (Math.random() * 2 - 1) * hh; air.pos[o + 2] = scatter ? 0.44 - Math.random() * 1.05 : 0.44;
}
function resetShim(i, scatter) {
  const o = i * 3, xs = cur.sockX;
  shim.pos[o] = xs[i % xs.length] + (Math.random() - 0.5) * 0.08; shim.pos[o + 1] = 0.028 + (scatter ? Math.random() * 0.19 : 0); shim.pos[o + 2] = 0.02 + (Math.random() - 0.5) * 0.08;
}
const reseed = () => { for (let i = 0; i < air.n; i++) resetAir(i, true); for (let i = 0; i < shim.n; i++) resetShim(i, true); };

const SLIDE = 0.8;
export const slotPos = (sv, e, out) => out.set(sv.r.x, sv.y, sv.r.z + sv.r.face * (0.05 + SLIDE * e));
// Cores on each socket and in total for the server's model
const coresOf = sv => [sv.spec.cores, sv.spec.cores * sv.spec.sockets];

// Put the model in the slot of sv and seed its detailed telemetry from the server's own figures
export function mountServer(sv) {
  if (SV.sel && SV.sel !== sv) { setInstance(SV.sel, true); SV.slide = 0; }
  SV.sel = sv; SV.open = true;
  setInstance(sv, false);
  const v = variant(sv.spec);
  if (v !== cur) { if (cur) cur.g.visible = false; cur = v; reseed(); }
  cur.g.visible = true; srvMeshes.length = 0; srvMeshes.push(...cur.meshes);
  printLabels(sv);
  SRV.rotation.y = sv.r.face > 0 ? 0 : Math.PI;
  slotPos(sv, ease(SV.slide), SRV.position); SRV.visible = true;
  for (let i = 0; i < coresOf(sv)[1]; i++) { SV.coreBias[i] = Math.random(); SV.cores[i] = sv.load; }
  SV.temp = sv.spec.sockets === 2 ? [sv.temp + 1, sv.temp - 1] : [sv.temp];
  SV.rpm = sv.rpm; SV.tLvl = sv.tLvl; SV.cLvl = sv.cLvl; SV.status = sv.status;
}

export function stepServer(dt) {
  const sv = SV.sel, r = sv.r, [per, n] = coresOf(sv), avg = [0, 0];
  for (let i = 0; i < n; i++) {
    const tgt = clamp(sv.load * (0.55 + 0.9 * SV.coreBias[i]), 0, 1);
    SV.cores[i] = clamp(SV.cores[i] + (tgt - SV.cores[i]) * Math.min(1, dt * 3) + (Math.random() - 0.5) * dt * 1.5, 0, 1);
    avg[(i / per) | 0] += SV.cores[i] / per;
  }
  const fanOut = sv.faults.some(f => f.kind === 'fan') ? 6 : 0;
  SV.temp.forEach((t, k) => { SV.temp[k] += (r.inlet + 14 - k * 2 + avg[k] * (56 - k * 2) + fanOut - t) * Math.min(1, dt * 0.5); });
  const hot = Math.max(...SV.temp);
  SV.rpm += ((3800 + clamp((hot - 45) / 40, 0, 1) * 9200) * (fanOut ? 1.15 : 1) - SV.rpm) * Math.min(1, dt * 0.8);
  SV.mem = sv.mem;
  const ioMax = r.kind === 2 ? 180000 : r.kind === 3 ? 60000 : 22000;
  SV.iops += (sv.load * ioMax * (0.8 + 0.4 * Math.random()) - SV.iops) * Math.min(1, dt * 3);
  const nt = sv.net * (1 - sv.stressAmp * 0.5);
  SV.netIn = nt * 0.45 * (0.9 + 0.2 * Math.sin(W.t * 2.1 + sv.phase));
  SV.netOut = nt * 0.55 * (0.9 + 0.2 * Math.sin(W.t * 1.7 + sv.phase));
  SV.power = sv.power;
  SV.tLvl = level(hot, 85, 95, SV.tLvl, 2);
  SV.cLvl = level(sv.load * 100, 85, 95, SV.cLvl, 3);
  SV.status = Math.max(SV.tLvl, SV.cLvl, sv.faults.length ? 1 : 0);
}

// Threshold level with hysteresis: 0 ok, 1 warning, 2 critical
export function level(v, warn, crit, prev, hyst) {
  let l = v > crit ? 2 : v > warn ? 1 : 0;
  if (l < prev) {
    if (prev === 2 && v > crit - hyst) l = 2;
    else if (prev >= 1 && v > warn - hyst) l = Math.max(l, 1);
  }
  return l;
}

const tmp = new THREE.Color();
export function updateServerModel(dt) {
  const sv = SV.sel; if (!sv) return;
  // The server only starts sliding once its rack door is open
  if (!SV.open || doorOpen(sv.r)) SV.slide = clamp(SV.slide + (SV.open ? 1 : -1) * dt / (reduceMotion ? 0.01 : 0.9), 0, 1);
  slotPos(sv, ease(SV.slide), SRV.position);
  if (!SV.open && SV.slide <= 0) { setInstance(sv, true); SV.sel = null; SRV.visible = false; return; }
  const r = sv.r, V = cur, blink = (W.t * 2.5) % 1 < 0.5;
  V.rotors.forEach((f, i) => { if (!sv.faults.some(x => x.kind === 'fan' && x.k === i)) f.rotation.z += dt * SV.rpm / 1000 * 2.2 * (1 + i * 0.02); });
  V.psuLeds.forEach((m, k) => m.material.color.copy(sv.faults.some(x => x.kind === 'psu' && x.k === k) ? (blink ? LED.crit : LED.dark) : PSU_OK));
  SV.temp.forEach((t, k) => { grad('cpu', t, tmp); V.sinkMats[k].emissive.copy(tmp); V.sinkMats[k].emissiveIntensity = 0.06 + clamp((t - 40) / 50, 0, 1) * 0.3; });
  const fill = SV.mem * V.dimmMats.length;
  V.dimmMats.forEach((m, i) => { m.emissiveIntensity = clamp(fill - i, 0, 1) * (0.18 + 0.08 * Math.sin(W.t * 9 + i * 1.7)); });
  const ioRate = dt * (2 + SV.iops / 4000);
  V.driveLeds.forEach((d, i) => {
    if (sv.faults.some(x => x.kind === 'disk' && x.k === i)) { d.m.material.color.copy(LED.warn); return; }
    if (Math.random() < ioRate) d.on = !d.on; d.m.material.color.copy(d.on ? LED.act : LED.off);
  });
  const netRate = dt * (2 + (SV.netIn + SV.netOut) * 8);
  V.nicLeds.forEach(d => { if (Math.random() < netRate) d.on = !d.on; d.m.material.color.copy(d.on ? LED.warn : LED.off); });
  if (Math.random() < dt * (1.5 + sv.load * 22)) SV.fOn = !SV.fOn;
  V.frontLed[0].material.color.copy(SV.fOn ? LED.act : LED.off);
  V.frontLed[1].material.color.copy(SV.status === 2 ? (blink ? LED.crit : LED.dark) : SV.status === 1 ? LED.warn : LED.idle);

  const spd = 0.25 + SV.rpm / 13000 * 0.9, rise = 8 + sv.load * 22;
  for (let i = 0; i < air.n; i++) {
    const o = i * 3;
    air.pos[o + 2] -= spd * dt * (0.8 + (i % 5) * 0.1);
    if (air.pos[o + 2] < -0.62) resetAir(i, false);
    const z = air.pos[o + 2], u = clamp((0.44 - z) / 0.9, 0, 1);
    gradIn(LST.air, r.inlet + Math.max(0, u - 0.35) / 0.65 * rise, tmp);
    const b = 0.5 * (z < -0.45 ? (z + 0.62) / 0.17 : 1);
    air.col[o] = tmp.r * b; air.col[o + 1] = tmp.g * b; air.col[o + 2] = tmp.b * b;
  }
  air.geo.attributes.position.needsUpdate = true; air.geo.attributes.color.needsUpdate = true;
  for (let i = 0; i < shim.n; i++) {
    const o = i * 3, k = i % SV.temp.length;
    shim.pos[o + 1] += dt * (0.06 + (i % 7) * 0.012);
    if (shim.pos[o + 1] > 0.22) resetShim(i, false);
    grad('cpu', SV.temp[k], tmp);
    const b = clamp((SV.temp[k] - 42) / 45, 0.03, 1) * (1 - (shim.pos[o + 1] - 0.03) / 0.19) * 0.7;
    shim.col[o] = tmp.r * b; shim.col[o + 1] = tmp.g * b; shim.col[o + 2] = tmp.b * b;
  }
  shim.geo.attributes.position.needsUpdate = true; shim.geo.attributes.color.needsUpdate = true;
}
