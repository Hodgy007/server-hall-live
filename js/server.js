// The pulled-out server: an open-lid Dell PowerEdge R7725 (2U, two AMD EPYC sockets) at true scale, local +z = front,
// and its per-core telemetry. Front to back: eight NVMe drives and their backplane, six hot-swap fans, the two CPU
// sockets with their heatsinks and 24 DIMMs, then the PCIe risers, OCP NIC, BOSS boot module and two power supplies.
import { THREE, scene, lc, COL, clamp, grad, gradIn, LST, U, ease, reduceMotion, canvasTex, speckle } from './core.js';
import { W, SV } from './state.js';
import { plates, LED, setInstance, doorOpen, DIMMS } from './racks.js';
import { makePoints } from './particles.js';
import { pushAlert } from './alerts.js';

export const SRV = new THREE.Group(); SRV.visible = false; scene.add(SRV);
// Hex colours here are sRGB, as picked; converted to the linear values the renderer works in
const std = (color, metalness, roughness, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: typeof color === 'number' ? lc(color) : color, metalness, roughness }, extra));
const steel = std(0x9aa3ab, 0.7, 0.55);           // zinc-plated chassis steel
const darkMetal = std(0x1c252e, 0.6, 0.45);
const blackPlastic = std(0x111417, 0.1, 0.7);
const touch = std(lc('#1f7bd1'), 0.1, 0.5);        // Dell's blue touch points: the latches and handles you are meant to use
const copper = std(lc('#b8734a'), 0.9, 0.35);
const pcbMat = std(0x1d3b2e, 0.2, 0.75);
const cardMat = std(0x245640, 0.2, 0.7);
const driveMat = std(0x8d969e, 0.7, 0.4);
const cableMat = std(0x2b3035, 0.1, 0.8);
const basic = c => new THREE.MeshBasicMaterial({ color: c || 0xffffff, toneMapped: false });
const M4 = new THREE.Matrix4();
function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); (parent || SRV).add(m); return m;
}
// Many copies of one part as a single instanced mesh
function many(geo, mat, pts) {
  const m = new THREE.InstancedMesh(geo, mat, pts.length);
  pts.forEach(([x, y, z], i) => m.setMatrixAt(i, M4.makeTranslation(x, y, z)));
  SRV.add(m); return m;
}
// A printed label lying flat; redrawn when a different server is pulled out
function label(w, h, x, y, z) {
  const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * h / w);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std(0x9a9ea2, 0, 0.9, { map: t }));
  m.position.set(x, y, z); m.rotation.x = -Math.PI / 2; SRV.add(m);
  return draw => { draw(c.getContext('2d'), c.width, c.height); t.needsUpdate = true; };
}

// ---------- Chassis ----------
box(0.5, 0.004, 0.9, steel, 0, -0.042, 0);
box(0.006, 0.084, 0.9, steel, -0.252, 0, 0); box(0.006, 0.084, 0.9, steel, 0.252, 0, 0);
box(0.006, 0.016, 0.95, darkMetal, -0.262, -0.028, -0.9); box(0.006, 0.016, 0.95, darkMetal, 0.262, -0.028, -0.9);
box(0.52, 2 * U - 0.0016, 0.012, plates.material, 0, 0, 0.456);
const frontLed = [0, 1].map(k => box(0.016, 0.016, 0.008, basic(), 0.19 + k * 0.035, 0, 0.466));

// ---------- Front: eight NVMe drives in their carriers, the backplane behind them, cables back to the board ----------
const DRIVE_X = i => -0.2148 + 0.0366 * i;   // lines up with the carriers drawn on the front plate
const driveLeds = [];
for (let i = 0; i < 8; i++) {
  const x = DRIVE_X(i);
  box(0.026, 0.068, 0.1, driveMat, x, -0.004, 0.39);
  box(0.031, 0.004, 0.1, blackPlastic, x, 0.032, 0.39);
  driveLeds.push({ m: box(0.008, 0.003, 0.006, basic(), x + 0.009, 0.0355, 0.436), on: false });
}
box(0.004, 0.08, 0.11, steel, -0.237, 0, 0.39); box(0.004, 0.08, 0.11, steel, 0.08, 0, 0.39);
box(0.32, 0.07, 0.003, pcbMat, -0.08, -0.004, 0.336);
many(new THREE.BoxGeometry(0.02, 0.012, 0.008), blackPlastic, [0, 1, 2, 3].map(k => [-0.2 + k * 0.073, -0.018, 0.33]));
// MCIO cables from the backplane, along the left wall and in to the board in front of CPU 1
[0, 1, 2, 3].forEach(k => {
  box(0.003, 0.012, 0.25, cableMat, -0.246 + k * 0.004, -0.024 + k * 0.004, 0.205);
  box(0.03 + k * 0.012, 0.003, 0.012, cableMat, -0.23 + (0.03 + k * 0.012) / 2, -0.035, 0.085 - k * 0.003);
});

// ---------- Six hot-swap fans ----------
const rotors = [];
box(0.48, 0.004, 0.01, darkMetal, 0, 0.041, 0.205); box(0.48, 0.004, 0.01, darkMetal, 0, 0.041, 0.265);
const bladeGeo = new THREE.BoxGeometry(0.021, 0.0085, 0.002);
for (let i = 0; i < 6; i++) {
  const x = -0.19 + i * 0.076;
  box(0.066, 0.006, 0.056, blackPlastic, x, 0.034, 0.235); box(0.066, 0.006, 0.056, blackPlastic, x, -0.034, 0.235);
  box(0.006, 0.062, 0.056, blackPlastic, x - 0.031, 0, 0.235); box(0.006, 0.062, 0.056, blackPlastic, x + 0.031, 0, 0.235);
  box(0.02, 0.004, 0.012, touch, x, 0.039, 0.252);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.0275, 0.031, 28), new THREE.MeshBasicMaterial({ color: lc('#2a3038'), side: THREE.DoubleSide }));
  ring.position.set(x, 0, 0.262); SRV.add(ring);
  const rotor = new THREE.Group(); rotor.position.set(x, 0, 0.25); SRV.add(rotor);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.016, 16), blackPlastic); hub.rotation.x = Math.PI / 2; rotor.add(hub);
  for (let b = 0; b < 7; b++) {
    const arm = new THREE.Group(); arm.rotation.z = b * Math.PI * 2 / 7;
    const blade = new THREE.Mesh(bladeGeo, blackPlastic); blade.position.x = 0.018; blade.rotation.x = 0.5; arm.add(blade); rotor.add(arm);
  }
  rotors.push(rotor);
}

// ---------- System board: two SP5 sockets with heatsinks, 24 DIMMs, VRM chokes ----------
box(0.488, 0.0025, 0.62, pcbMat, 0, -0.0385, -0.12);
const SOCK_X = [-0.112, 0.112], SOCK_Z = 0.02;
const carrierMat = std(lc('#e07a2e'), 0.1, 0.6);   // the orange carrier frame every EPYC 9005 package sits in
const sinkMats = [], cpuLabels = [];
SOCK_X.forEach(cx => {
  box(0.096, 0.004, 0.106, darkMetal, cx, -0.035, SOCK_Z);
  box(0.086, 0.0025, 0.096, carrierMat, cx, -0.0325, SOCK_Z);
  box(0.078, 0.007, 0.086, copper, cx, -0.0275, SOCK_Z);
  const sm = std(0x9aa6b0, 0.85, 0.35, { emissive: 0x000000 }); sinkMats.push(sm);
  many(new THREE.BoxGeometry(0.0006, 0.05, 0.086), sm, Array.from({ length: 22 }, (_, j) => [cx - 0.0385 + j * 0.00367, 0.0005, SOCK_Z]));
  // heat pipes across the top of the fin stack, and the four captive screws
  [-0.036, -0.026, 0.026, 0.036].forEach(dz => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.0026, 0.0026, 0.08, 10), copper);
    p.rotation.z = Math.PI / 2; p.position.set(cx, 0.0265, SOCK_Z + dz); SRV.add(p);
  });
  many(new THREE.CylinderGeometry(0.0035, 0.0035, 0.01, 10), darkMetal, [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => [cx + a * 0.044, -0.022, SOCK_Z + b * 0.048]));
  cpuLabels.push(label(0.062, 0.02, cx, 0.0262, SOCK_Z));
  // VRM chokes in a row behind the socket
  many(new THREE.BoxGeometry(0.008, 0.008, 0.008), std(0x2a2f34, 0.4, 0.6), Array.from({ length: 7 }, (_, j) => [cx - 0.036 + j * 0.012, -0.033, SOCK_Z - 0.07]));
});
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
const dimmMats = [], slotPts = [], latchPts = [];
// Fill order alternates sockets and sides, so both memory banks of both CPUs populate evenly
for (let i = 0; i < DIMMS; i++) {
  const s = i % 2, slot = i >> 1, side = slot % 2 ? 1 : -1, k = slot >> 1, x = SOCK_X[s] + side * (0.052 + k * 0.0085);
  const m = std(0xffffff, 0.3, 0.6, { map: dimmTex, emissive: lc(COL.cold), emissiveIntensity: 0 });
  dimmMats.push(m);
  const d = new THREE.Mesh(dimmGeo, m); d.position.set(x, -0.0125, SOCK_Z); SRV.add(d);
  slotPts.push([x, -0.0325, SOCK_Z]); latchPts.push([x, -0.03, SOCK_Z - 0.072], [x, -0.03, SOCK_Z + 0.072]);
}
many(new THREE.BoxGeometry(0.0062, 0.009, 0.142), blackPlastic, slotPts);
many(new THREE.BoxGeometry(0.0062, 0.013, 0.004), std(0x9fa4a9, 0.1, 0.7), latchPts);

// ---------- Rear: two PCIe risers, the OCP NIC, BOSS-N1 boot module, power supplies ----------
[-0.165, -0.04].forEach(x => {
  box(0.003, 0.072, 0.15, steel, x - 0.055, 0, -0.355); box(0.003, 0.072, 0.15, steel, x + 0.055, 0, -0.355);
  box(0.11, 0.004, 0.02, touch, x, 0.04, -0.29);
  box(0.004, 0.064, 0.12, pcbMat, x + 0.05, -0.002, -0.36);
  box(0.1, 0.002, 0.13, cardMat, x, 0.008, -0.36);
  box(0.03, 0.012, 0.04, std(0x8f9aa3, 0.8, 0.4), x - 0.01, 0.016, -0.35);
  box(0.11, 0.07, 0.002, darkMetal, x, 0, -0.437);
});
box(0.1, 0.002, 0.09, cardMat, -0.145, -0.032, -0.39);
const nicLeds = [-0.17, -0.12].map(x => { box(0.018, 0.014, 0.012, darkMetal, x, -0.024, -0.428); return { m: box(0.006, 0.004, 0.003, basic(), x + 0.012, -0.014, -0.435), on: false }; });
box(0.05, 0.022, 0.085, blackPlastic, 0.085, -0.026, -0.38); box(0.02, 0.004, 0.01, touch, 0.085, -0.013, -0.34);
box(0.016, 0.002, 0.016, blackPlastic, 0.04, -0.0365, -0.22);
{ const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.003, 20), std(0xc8ccd0, 0.9, 0.3)); cell.position.set(-0.01, -0.0355, -0.25); SRV.add(cell); }
box(0.09, 0.07, 0.003, pcbMat, 0.195, -0.004, -0.275);
const psuLeds = [-0.017, 0.019].map(y => { box(0.085, 0.034, 0.16, steel, 0.195, y, -0.36); return box(0.01, 0.01, 0.004, basic(lc(COL.ok)), 0.22, y, -0.442); });
const PSU_OK = lc(COL.ok).multiplyScalar(2);
// Service tag label on the floor behind the front grille
const tagLabel = label(0.12, 0.045, 0.165, -0.0395, 0.39);
// Print the model, service tag and CPU labels for the server being pulled out
function printLabels(sv) {
  tagLabel((g, w, h) => {
    g.fillStyle = '#f2f3f4'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f7bd1'; g.fillRect(0, 0, w, 16);
    g.fillStyle = '#ffffff'; g.font = '600 12px "IBM Plex Mono", monospace'; g.fillText(sv.model.replace(/^Dell /, ''), 6, 12);
    g.fillStyle = '#16181a'; g.font = '500 14px "IBM Plex Mono", monospace'; g.fillText('Service Tag ' + sv.serial, 6, 36);
    g.font = '400 11px "IBM Plex Mono", monospace'; g.fillText(sv.host, 6, 56);
    for (let x = 6; x < w - 6; x += 3) if ((x * 7) % 5 < 3) g.fillRect(x, 66, 2, h - 72);
  });
  const name = sv.cpu.replace(/^\d+\s*×\s*/, '');
  cpuLabels.forEach((draw, k) => draw((g, w, h) => {
    g.fillStyle = '#d9dde1'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#16181a'; g.font = '600 26px "IBM Plex Mono", monospace'; g.fillText(name, 10, 38);
    g.font = '400 18px "IBM Plex Mono", monospace'; g.fillText(`CPU ${k + 1} · ${sv.cpuNote.split(',')[0].replace(' each at ', ' · ')}`, 10, 70);
  }));
}

// Every solid part (not the air particles below): clicking one pushes the server back in
export const srvMeshes = [];
SRV.traverse(o => { if (o.isMesh) { o.userData.srv = true; srvMeshes.push(o); } });

// Air drawn through the chassis front to back, and heat rising off the heatsinks
export const air = makePoints(220, 0.028, SRV), shim = makePoints(90, 0.045, SRV);
function resetAir(i, scatter) {
  const o = i * 3;
  air.pos[o] = (Math.random() - 0.5) * 0.46; air.pos[o + 1] = -0.032 + Math.random() * 0.064; air.pos[o + 2] = scatter ? 0.44 - Math.random() * 1.05 : 0.44;
}
function resetShim(i, scatter) {
  const o = i * 3;
  shim.pos[o] = SOCK_X[i % 2] + (Math.random() - 0.5) * 0.08; shim.pos[o + 1] = 0.028 + (scatter ? Math.random() * 0.19 : 0); shim.pos[o + 2] = SOCK_Z + (Math.random() - 0.5) * 0.08;
}
for (let i = 0; i < air.n; i++) resetAir(i, true);
for (let i = 0; i < shim.n; i++) resetShim(i, true);

const SLIDE = 0.8;
export const slotPos = (sv, e, out) => out.set(sv.r.x, sv.y, sv.r.z + sv.r.face * (0.05 + SLIDE * e));

// Put the model in the slot of sv and seed its detailed telemetry from the server's own figures
export function mountServer(sv) {
  if (SV.sel && SV.sel !== sv) { setInstance(SV.sel, true); SV.slide = 0; }
  SV.sel = sv; SV.open = true;
  setInstance(sv, false); printLabels(sv);
  SRV.rotation.y = sv.r.face > 0 ? 0 : Math.PI;
  slotPos(sv, ease(SV.slide), SRV.position); SRV.visible = true;
  for (let i = 0; i < 64; i++) { SV.coreBias[i] = Math.random(); SV.cores[i] = sv.load; }
  SV.temp = [sv.temp + 1, sv.temp - 1];
  SV.rpm = sv.rpm; SV.tLvl = sv.tLvl; SV.cLvl = sv.cLvl; SV.status = sv.status;
}

export function stepServer(dt) {
  const sv = SV.sel, r = sv.r;
  let s0 = 0, s1 = 0;
  for (let i = 0; i < 64; i++) {
    const tgt = clamp(sv.load * (0.55 + 0.9 * SV.coreBias[i]), 0, 1);
    SV.cores[i] = clamp(SV.cores[i] + (tgt - SV.cores[i]) * Math.min(1, dt * 3) + (Math.random() - 0.5) * dt * 1.5, 0, 1);
    if (i < 32) s0 += SV.cores[i]; else s1 += SV.cores[i];
  }
  s0 /= 32; s1 /= 32;
  const fanOut = sv.faults.some(f => f.kind === 'fan') ? 6 : 0;
  SV.temp[0] += (r.inlet + 14 + s0 * 56 + fanOut - SV.temp[0]) * Math.min(1, dt * 0.5);
  SV.temp[1] += (r.inlet + 12 + s1 * 54 + fanOut - SV.temp[1]) * Math.min(1, dt * 0.5);
  const hot = Math.max(SV.temp[0], SV.temp[1]);
  SV.rpm += ((3800 + clamp((hot - 45) / 40, 0, 1) * 9200) * (fanOut ? 1.15 : 1) - SV.rpm) * Math.min(1, dt * 0.8);
  SV.mem = sv.mem;
  const ioMax = r.kind === 2 ? 180000 : r.kind === 3 ? 60000 : 22000;
  SV.iops += (sv.load * ioMax * (0.8 + 0.4 * Math.random()) - SV.iops) * Math.min(1, dt * 3);
  const n = sv.net * (1 - sv.stressAmp * 0.5);
  SV.netIn = n * 0.45 * (0.9 + 0.2 * Math.sin(W.t * 2.1 + sv.phase));
  SV.netOut = n * 0.55 * (0.9 + 0.2 * Math.sin(W.t * 1.7 + sv.phase));
  SV.power = sv.power;
  const pt = SV.tLvl, pc = SV.cLvl, ps = SV.status;
  SV.tLvl = level(hot, 85, 95, pt, 2);
  SV.cLvl = level(sv.load * 100, 85, 95, pc, 3);
  SV.status = Math.max(SV.tLvl, SV.cLvl, sv.faults.length ? 1 : 0);
  if (SV.tLvl > pt) pushAlert(SV.tLvl === 2 ? 'crit' : 'warn', `${sv.host} CPU at ${hot.toFixed(0)} °C, ${SV.tLvl === 2 ? 'thermal throttling' : 'near the 95 °C throttle point'}`);
  if (SV.cLvl > pc) pushAlert(SV.cLvl === 2 ? 'crit' : 'warn', `${sv.host} CPU at ${Math.round(sv.load * 100)}%`);
  if (ps > 0 && SV.status === 0) pushAlert('ok', `${sv.host} back within limits`);
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
  const r = sv.r, blink = (W.t * 2.5) % 1 < 0.5;
  rotors.forEach((f, i) => { if (!sv.faults.some(x => x.kind === 'fan' && x.k === i)) f.rotation.z += dt * SV.rpm / 1000 * 2.2 * (1 + i * 0.02); });
  psuLeds.forEach((m, k) => m.material.color.copy(sv.faults.some(x => x.kind === 'psu' && x.k === k) ? (blink ? LED.crit : LED.dark) : PSU_OK));
  SV.temp.forEach((t, k) => { grad('cpu', t, tmp); sinkMats[k].emissive.copy(tmp); sinkMats[k].emissiveIntensity = 0.06 + clamp((t - 40) / 50, 0, 1) * 0.3; });
  const fill = SV.mem * DIMMS;
  dimmMats.forEach((m, i) => { m.emissiveIntensity = clamp(fill - i, 0, 1) * (0.18 + 0.08 * Math.sin(W.t * 9 + i * 1.7)); });
  const ioRate = dt * (2 + SV.iops / 4000);
  driveLeds.forEach((d, i) => {
    if (sv.faults.some(x => x.kind === 'disk' && x.k === i)) { d.m.material.color.copy(LED.warn); return; }
    if (Math.random() < ioRate) d.on = !d.on; d.m.material.color.copy(d.on ? LED.act : LED.off);
  });
  const netRate = dt * (2 + (SV.netIn + SV.netOut) * 8);
  nicLeds.forEach(d => { if (Math.random() < netRate) d.on = !d.on; d.m.material.color.copy(d.on ? LED.warn : LED.off); });
  if (Math.random() < dt * (1.5 + sv.load * 22)) SV.fOn = !SV.fOn;
  frontLed[0].material.color.copy(SV.fOn ? LED.act : LED.off);
  frontLed[1].material.color.copy(SV.status === 2 ? (blink ? LED.crit : LED.dark) : SV.status === 1 ? LED.warn : LED.idle);

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
    const o = i * 3, k = i % 2;
    shim.pos[o + 1] += dt * (0.06 + (i % 7) * 0.012);
    if (shim.pos[o + 1] > 0.22) resetShim(i, false);
    grad('cpu', SV.temp[k], tmp);
    const b = clamp((SV.temp[k] - 42) / 45, 0.03, 1) * (1 - (shim.pos[o + 1] - 0.03) / 0.19) * 0.7;
    shim.col[o] = tmp.r * b; shim.col[o + 1] = tmp.g * b; shim.col[o + 2] = tmp.b * b;
  }
  shim.geo.attributes.position.needsUpdate = true; shim.geo.attributes.color.needsUpdate = true;
}
