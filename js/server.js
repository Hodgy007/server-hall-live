// The pulled-out server: detailed open-lid 2U model (local +z = front) and its per-core telemetry.
import { THREE, scene, lc, COL, clamp, grad, gradIn, LST, U, ease, reduceMotion } from './core.js';
import { W, SV } from './state.js';
import { plates, LED, setInstance, doorOpen } from './racks.js';
import { makePoints } from './particles.js';
import { pushAlert } from './alerts.js';

export const SRV = new THREE.Group(); SRV.visible = false; scene.add(SRV);
const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1c252e, metalness: 0.6, roughness: 0.45 });
const driveMat = new THREE.MeshStandardMaterial({ color: 0x2e3945, metalness: 0.5, roughness: 0.5 });
const pcbMat = new THREE.MeshStandardMaterial({ color: 0x10261f, metalness: 0.2, roughness: 0.75 });
const fanMat = new THREE.MeshStandardMaterial({ color: 0x4a5866, metalness: 0.4, roughness: 0.5 });
const basic = c => new THREE.MeshBasicMaterial({ color: c || 0xffffff, toneMapped: false });
function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); (parent || SRV).add(m); return m;
}
box(0.5, 0.006, 0.9, darkMetal, 0, -0.04, 0);
box(0.008, 0.08, 0.9, darkMetal, -0.252, 0, 0); box(0.008, 0.08, 0.9, darkMetal, 0.252, 0, 0);
box(0.006, 0.016, 0.95, darkMetal, -0.262, -0.028, -0.9); box(0.006, 0.016, 0.95, darkMetal, 0.262, -0.028, -0.9);
box(0.484, 0.003, 0.86, pcbMat, 0, -0.036, -0.01);
box(0.52, 2 * U - 0.0016, 0.012, plates.material, 0, 0, 0.456);
const frontLed = [0, 1].map(k => box(0.016, 0.016, 0.008, basic(), 0.19 + k * 0.035, 0, 0.466));
const driveLeds = [];
for (let i = 0; i < 8; i++) {
  const x = -0.175 + i * 0.05;
  box(0.044, 0.07, 0.1, driveMat, x, -0.002, 0.39);
  driveLeds.push({ m: box(0.012, 0.004, 0.012, basic(), x, 0.035, 0.35), on: false });
}
const rotors = [];
for (let i = 0; i < 6; i++) {
  const x = -0.2 + i * 0.08;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.033, 0.039, 24), new THREE.MeshBasicMaterial({ color: lc('#3a4855'), side: THREE.DoubleSide }));
  ring.position.set(x, 0, 0.22); SRV.add(ring);
  const rotor = new THREE.Group(); rotor.position.set(x, 0, 0.22); SRV.add(rotor);
  box(0.012, 0.012, 0.012, fanMat, 0, 0, 0, rotor);
  for (let b = 0; b < 5; b++) {
    const arm = new THREE.Group(); arm.rotation.z = b * Math.PI * 2 / 5;
    box(0.03, 0.011, 0.003, fanMat, 0.018, 0, 0, arm); rotor.add(arm);
  }
  rotors.push(rotor);
}
const sinkMats = [];
[-0.11, 0.11].forEach(cx => {
  const sm = new THREE.MeshStandardMaterial({ color: 0x8796a3, metalness: 0.8, roughness: 0.35, emissive: 0x000000 });
  sinkMats.push(sm);
  box(0.1, 0.008, 0.1, sm, cx, -0.03, 0);
  for (let f = 0; f < 9; f++) box(0.004, 0.05, 0.1, sm, cx - 0.044 + f * 0.011, 0, 0);
});
// 16 DIMMs; fill order alternates sockets so both memory banks populate evenly
const dimmMats = [];
for (let i = 0; i < 16; i++) {
  const cx = i % 2 ? 0.11 : -0.11, slot = i >> 1, side = slot < 4 ? -1 : 1;
  const m = new THREE.MeshStandardMaterial({ color: 0x173a2e, metalness: 0.3, roughness: 0.6, emissive: lc(COL.cold), emissiveIntensity: 0 });
  dimmMats.push(m);
  box(0.005, 0.03, 0.13, m, cx + side * (0.064 + (slot % 4) * 0.011), -0.02, 0);
}
const psuLeds = [-0.017, 0.019].map(y => { box(0.085, 0.034, 0.16, darkMetal, 0.195, y, -0.36); return box(0.01, 0.01, 0.004, basic(lc(COL.ok)), 0.22, y, -0.442); });
const PSU_OK = lc(COL.ok).multiplyScalar(2);
box(0.13, 0.004, 0.09, pcbMat, -0.14, -0.012, -0.38);
const nicLeds = [-0.17, -0.12].map(x => { box(0.018, 0.014, 0.01, darkMetal, x, -0.01, -0.428); return { m: box(0.006, 0.004, 0.003, basic(), x + 0.012, 0, -0.434), on: false }; });

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
  shim.pos[o] = (i % 2 ? 0.11 : -0.11) + (Math.random() - 0.5) * 0.09; shim.pos[o + 1] = 0.028 + (scatter ? Math.random() * 0.19 : 0); shim.pos[o + 2] = (Math.random() - 0.5) * 0.09;
}
for (let i = 0; i < air.n; i++) resetAir(i, true);
for (let i = 0; i < shim.n; i++) resetShim(i, true);

const SLIDE = 0.8;
export const slotPos = (sv, e, out) => out.set(sv.r.x, sv.y, sv.r.z + sv.r.face * (0.05 + SLIDE * e));

// Put the model in the slot of sv and seed its detailed telemetry from the server's own figures
export function mountServer(sv) {
  if (SV.sel && SV.sel !== sv) { setInstance(SV.sel, true); SV.slide = 0; }
  SV.sel = sv; SV.open = true;
  setInstance(sv, false);
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
  SV.temp.forEach((t, k) => { grad('cpu', t, tmp); sinkMats[k].emissive.copy(tmp); sinkMats[k].emissiveIntensity = 0.25 + clamp((t - 40) / 50, 0, 1) * 0.6; });
  const fill = SV.mem * 16;
  dimmMats.forEach((m, i) => { m.emissiveIntensity = clamp(fill - i, 0, 1) * (0.55 + 0.25 * Math.sin(W.t * 9 + i * 1.7)); });
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
