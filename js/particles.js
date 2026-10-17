// Particle systems: hot-aisle exhaust, cold-aisle supply air, network packets on the trays.
import { THREE, scene, lc, COL, clamp, grad, canvasTex, RACK_H, RACK_D, TRAY_Y, TRAY_X, ROOM, HACS, COLD, ROW_HALF, coolingUnit } from './core.js';
import { W } from './state.js';
import { racks } from './racks.js';
import { RISER_DZ } from './hall.js';

const glow = canvasTex(64, 64, (g) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
}, true);
export function makePoints(n, size, parent) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: glow, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  pts.frustumCulled = false; (parent || scene).add(pts);
  return { geo, pos, col, n, pts };
}
const tmp = new THREE.Color();
// Each rack whose rear faces a contained hot aisle gets that aisle; the outer rows (A, H) blow towards the end walls
racks.forEach(r => { const rear = r.z - r.face * RACK_D / 2; r.hac = HACS.find(H => Math.abs(rear - H.zc) < 0.7) || null; });
const contained = r => r.hac !== null;

// ---------- Hot-aisle exhaust ----------
// Contained rows: air rises to the roof, runs to the nearest chimney and leaves upwards.
export const heat = makePoints(2400, 0.17); const hp = [];
function spawnHeat(i, scatter) {
  const p = hp[i] || (hp[i] = {}); const r = racks[(Math.random() * racks.length) | 0]; p.r = r; p.duct = 0;
  p.life = contained(r) ? 4.5 + Math.random() * 2.5 : 2.4 + Math.random() * 1.8; p.age = scatter ? Math.random() * p.life : 0;
  p.vx = (Math.random() - 0.5) * 0.08; p.vy = 0.04 + Math.random() * 0.08; p.vz = -r.face * (0.25 + r.load * 0.45);
  const o = i * 3;
  heat.pos[o] = r.x + (Math.random() - 0.5) * 0.52; heat.pos[o + 1] = 0.09 + Math.random() * 1.04; heat.pos[o + 2] = r.z - r.face * (RACK_D / 2 + 0.02);
  if (scatter) {
    const t = Math.min(p.age, 1.5);
    heat.pos[o + 1] += p.vy * t * 3; heat.pos[o + 2] += p.vz * t * 0.6;
    if (contained(r)) heat.pos[o + 2] = clamp(heat.pos[o + 2], r.hac.z0 + 0.03, r.hac.z1 - 0.03);
  }
}
for (let i = 0; i < heat.n; i++) spawnHeat(i, true);

function stepHeat(p, o, dt) {
  const P = heat.pos;
  if (!contained(p.r)) {
    p.vz *= 1 - dt * 0.9; p.vy += dt * 0.22;
    P[o] += p.vx * dt; P[o + 1] += p.vy * dt; P[o + 2] += p.vz * dt;
    return;
  }
  const H = p.r.hac;
  if (p.duct === 0) {
    // mixing in the aisle: momentum from the fans dies off against the opposite row, buoyancy lifts it
    p.vz *= 1 - dt * 1.6; p.vy += dt * 0.35;
    P[o] += p.vx * dt; P[o + 1] += p.vy * dt; P[o + 2] += p.vz * dt;
    if (P[o + 2] < H.z0 + 0.03) { P[o + 2] = H.z0 + 0.03; p.vz = Math.abs(p.vz) * 0.3; }
    if (P[o + 2] > H.z1 - 0.03) { P[o + 2] = H.z1 - 0.03; p.vz = -Math.abs(p.vz) * 0.3; }
    if (P[o + 1] > H.top - 0.07) { P[o + 1] = H.top - 0.07; p.duct = 1; }
    return;
  }
  const cx = H.chimneys.reduce((a, b) => Math.abs(P[o] - b) < Math.abs(P[o] - a) ? b : a);
  const dx = cx - P[o];
  if (p.duct === 1) {   // under the roof, drifting to the chimney
    P[o] += Math.sign(dx) * Math.min(Math.abs(dx), 0.75 * dt); P[o + 2] += (H.zc - P[o + 2]) * dt * 1.5;
    if (Math.abs(dx) < 0.22) p.duct = 2;
  } else {              // up the chimney
    P[o + 1] += 0.9 * dt; P[o] += dx * dt * 2; P[o + 2] += (H.zc - P[o + 2]) * dt * 3;
    if (P[o + 1] > ROOM.h - 0.05) p.age = p.life;
  }
}

// ---------- Cold-aisle supply air from the perforated tiles ----------
export const cold = makePoints(900, 0.13); const cp = [];
function spawnCold(i, scatter) {
  const p = cp[i] || (cp[i] = {}); p.aisle = i % COLD.length;
  p.life = 2 + Math.random() * 1.5; p.age = scatter ? Math.random() * p.life : 0;
  p.vy = 0.35 + Math.random() * 0.3; p.vz = (Math.random() < 0.5 ? -1 : 1) * (0.08 + Math.random() * 0.14);
  const o = i * 3;
  cold.pos[o] = (Math.random() - 0.5) * 2 * ROW_HALF; cold.pos[o + 1] = 0.02 + (scatter ? p.vy * p.age : 0); cold.pos[o + 2] = COLD[p.aisle] + (Math.random() - 0.5) * 1.1;
}
for (let i = 0; i < cold.n; i++) spawnCold(i, true);
const coldC = lc(COL.cold);

// ---------- Network packets: rack top → riser → row tray → spine → uplink panel in the east wall ----------
racks.forEach(r => {
  const zr = r.z - r.face * RISER_DZ;
  const pts = [[r.x, RACK_H, zr], [r.x, TRAY_Y, zr], [r.x, TRAY_Y, r.z], [TRAY_X, TRAY_Y, r.z], [TRAY_X, TRAY_Y, 0], [ROOM.x - 0.1, TRAY_Y, 0]].map(a => new THREE.Vector3(...a));
  const cum = [0]; for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + pts[k].distanceTo(pts[k - 1]));
  r.path = { pts, cum, len: cum[cum.length - 1] };
});
function pathAt(path, s, out, o) {
  const { pts, cum } = path; let k = 1;
  while (k < cum.length - 1 && s > cum[k]) k++;
  const t = clamp((s - cum[k - 1]) / (cum[k] - cum[k - 1] || 1), 0, 1);
  const a = pts[k - 1], b = pts[k];
  out[o] = a.x + (b.x - a.x) * t; out[o + 1] = a.y + (b.y - a.y) * t; out[o + 2] = a.z + (b.z - a.z) * t;
}
const pk = makePoints(1600, 0.09); const pkd = []; const free = [];
for (let i = 0; i < pk.n; i++) { pkd.push({ on: false }); free.push(i); pk.pos[i * 3 + 1] = -50; }
const PK_OUT = lc(COL.cold), PK_IN = lc('#eaf6ff');

export function updateParticles(dt, perfMats) {
  // heat
  for (let i = 0; i < heat.n; i++) {
    const p = hp[i]; p.age += dt;
    if (p.age > p.life) spawnHeat(i, false);
    const o = i * 3;
    stepHeat(p, o, dt);
    const fade = Math.sin(Math.PI * Math.min(1, p.age / p.life));
    grad('exh', p.r.exhaust, tmp);
    const b = clamp((p.r.exhaust - 26) / 20, 0.05, 1) * fade * 0.5;
    heat.col[o] = tmp.r * b; heat.col[o + 1] = tmp.g * b; heat.col[o + 2] = tmp.b * b;
  }
  heat.geo.attributes.position.needsUpdate = true; heat.geo.attributes.color.needsUpdate = true;

  // cold
  // CU-1 feeds the northern cold aisles, CU-2 the southern ones; a CU-2 failure starves its aisles
  const unitFlow = [1 - W.faultLevel * 0.25, 1 - W.faultLevel * 0.85], flow = COLD.map(z => unitFlow[coolingUnit(z)]);
  for (let i = 0; i < cold.n; i++) {
    const p = cp[i]; p.age += dt;
    if (p.age > p.life) spawnCold(i, false);
    const o = i * 3;
    cold.pos[o + 1] += p.vy * dt * (0.4 + 0.6 * flow[p.aisle]); cold.pos[o + 2] += p.vz * dt;
    const b = Math.sin(Math.PI * Math.min(1, p.age / p.life)) * 0.3 * flow[p.aisle];
    cold.col[o] = coldC.r * b; cold.col[o + 1] = coldC.g * b; cold.col[o + 2] = coldC.b * b;
  }
  cold.geo.attributes.position.needsUpdate = true; cold.geo.attributes.color.needsUpdate = true;
  perfMats.forEach((m, i) => m.color.setScalar(0.55 * flow[i] + 0.15));

  // packets
  for (const r of racks) {
    r.pktAcc += r.net * dt * 0.28;
    while (r.pktAcc >= 1 && free.length) {
      r.pktAcc -= 1; const i = free.pop(); const p = pkd[i];
      p.on = true; p.r = r; p.s = 0; p.out = Math.random() < 0.6; p.speed = 2.2 + Math.random() * 0.9;
      const c = p.out ? PK_OUT : PK_IN, o = i * 3;
      pk.col[o] = c.r * 0.55; pk.col[o + 1] = c.g * 0.55; pk.col[o + 2] = c.b * 0.55;
    }
    if (r.pktAcc > 1) r.pktAcc = 1;
  }
  for (let i = 0; i < pk.n; i++) {
    const p = pkd[i]; if (!p.on) continue;
    p.s += p.speed * dt;
    if (p.s >= p.r.path.len) { p.on = false; free.push(i); pk.pos[i * 3 + 1] = -50; continue; }
    pathAt(p.r.path, p.out ? p.s : p.r.path.len - p.s, pk.pos, i * 3);
  }
  pk.geo.attributes.position.needsUpdate = true; pk.geo.attributes.color.needsUpdate = true;
}
