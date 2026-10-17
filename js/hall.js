// The room around the racks: raised floor, walls and ceiling, hot-aisle containment, cable trays,
// overhead busway, wall-mounted cooling units and the uplink panel to the meet-me room.
import { THREE, scene, lc, COL, canvasTex, labelTex, speckle, ROWS, COLD, HACS, COOLING, RACK_H, ROW_HALF, TRAY_Y, TRAY_X, ROOM } from './core.js';
import { racks } from './racks.js';

const m4 = new THREE.Matrix4();

// ---------- Raised floor ----------
const floorTex = canvasTex(256, 256, (g) => {
  g.fillStyle = '#131b23'; g.fillRect(0, 0, 256, 256); speckle(g, 256, 256, 5000, 0.03);
  g.fillStyle = '#080c10'; g.fillRect(0, 0, 256, 3); g.fillRect(0, 0, 3, 256);
  g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(3, 3, 250, 1); g.fillRect(3, 3, 1, 250);
});
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(2 * ROOM.x / 0.6, 2 * ROOM.z / 0.6);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * ROOM.x, 2 * ROOM.z), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.5, metalness: 0.3 }));
floor.rotation.x = -Math.PI / 2; floor.material.userData.noClip = true; scene.add(floor);

const perfTex = canvasTex(128, 128, (g) => {
  g.fillStyle = '#0e1820'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#7fd6f2';
  for (let y = 10; y < 128; y += 12) for (let x = 10; x < 128; x += 12) { g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = '#26404f'; g.lineWidth = 4; g.strokeRect(2, 2, 124, 124);
});
const PERF_W = 2 * ROW_HALF + 0.4, PERF_D = 1.2;
perfTex.wrapS = perfTex.wrapT = THREE.RepeatWrapping; perfTex.repeat.set(PERF_W / 0.6, PERF_D / 0.6);
// Perforated tiles down the middle of every cold aisle, one material each so a cooling failure can dim them
export const perfMats = [];
COLD.forEach(z => {
  const m = new THREE.MeshBasicMaterial({ map: perfTex, color: lc('#8fb8c8'), toneMapped: false }); m.userData.noClip = true;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(PERF_W, PERF_D), m);
  p.rotation.x = -Math.PI / 2; p.position.set(0, 0.003, z); scene.add(p); perfMats.push(m);
});

// ---------- Walls and suspended ceiling ----------
// Single-sided, facing inwards: from outside the room the near walls and the ceiling drop away (dollhouse cut-away)
const wallTex = canvasTex(512, 256, (g, w, h) => {
  g.fillStyle = '#1a2129'; g.fillRect(0, 0, w, h); speckle(g, w, h, 8000, 0.03);
  g.fillStyle = '#0e1318'; for (let x = 0; x < w; x += 128) g.fillRect(x, 0, 3, h);
  g.fillStyle = '#10161b'; g.fillRect(0, h - 22, w, 22);
  g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, h - 22, w, 1);
});
wallTex.wrapS = THREE.RepeatWrapping;
const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.92, metalness: 0.05 });
function wall(len, x, z, ry) {
  const t = wallTex.clone(); t.needsUpdate = true; t.repeat.set(len / 4.8, 1);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(len, ROOM.h), wallMat.clone()); m.material.map = t; m.material.userData.noClip = true;
  m.position.set(x, ROOM.h / 2, z); m.rotation.y = ry; scene.add(m);
}
wall(2 * ROOM.x, 0, -ROOM.z, 0); wall(2 * ROOM.x, 0, ROOM.z, Math.PI);
wall(2 * ROOM.z, -ROOM.x, 0, Math.PI / 2); wall(2 * ROOM.z, ROOM.x, 0, -Math.PI / 2);
{ const s = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: labelTex('HALL 2', '#8299a8'), transparent: true }));
  s.position.set(-ROOM.x + 0.01, 3.0, 0); s.rotation.y = Math.PI / 2; scene.add(s); }

const ceilTex = canvasTex(128, 128, (g) => {
  g.fillStyle = '#20282f'; g.fillRect(0, 0, 128, 128); speckle(g, 128, 128, 1500, 0.04);
  g.fillStyle = '#3a454f'; g.fillRect(0, 0, 128, 4); g.fillRect(0, 0, 4, 128);
});
ceilTex.wrapS = ceilTex.wrapT = THREE.RepeatWrapping; ceilTex.repeat.set(2 * ROOM.x / 0.6, 2 * ROOM.z / 0.6);
const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(2 * ROOM.x, 2 * ROOM.z), new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.95 }));
ceiling.rotation.x = Math.PI / 2; ceiling.position.y = ROOM.h; ceiling.material.userData.noClip = true; scene.add(ceiling);

// Light fixtures over every aisle (bright enough to bloom); one point light per cold aisle
{
  const fxGeo = new THREE.BoxGeometry(1.6, 0.04, 0.16), fxMat = new THREE.MeshBasicMaterial({ color: lc('#d8ecff').multiplyScalar(2.2) });
  const aisles = COLD.concat(HACS.map(h => h.zc)), fx = new THREE.InstancedMesh(fxGeo, fxMat, aisles.length * 3);
  aisles.forEach((z, i) => {
    [-2.6, 0, 2.6].forEach((x, k) => { m4.makeTranslation(x, ROOM.h - 0.03, z); fx.setMatrixAt(i * 3 + k, m4); });
    if (i < COLD.length) { const pl = new THREE.PointLight(0xa8dcff, 3.0, 9, 2); pl.position.set(0, ROOM.h - 0.2, z); scene.add(pl); }
  });
  scene.add(fx);
}

// ---------- Hot-aisle containment between back-to-back rows ----------
// Tinted roof panels on a frame, sliding end doors, and chimneys to the ceiling plenum
const glassMat = new THREE.MeshStandardMaterial({ color: 0x5a7a90, metalness: 0.1, roughness: 0.15, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
const frameMat = new THREE.MeshStandardMaterial({ color: 0x2f3a45, metalness: 0.8, roughness: 0.35 });
const chimMat = new THREE.MeshStandardMaterial({ color: 0x232c35, metalness: 0.55, roughness: 0.55, transparent: true, opacity: 0.55, depthWrite: false });
const signTex = labelTex('HOT AISLE', '#ff8a5c');
HACS.forEach(H => {
  const W = H.x1 - H.x0, D = H.z1 - H.z0, XM = (H.x0 + H.x1) / 2, Z = H.zc;
  const bar = (w, h, d, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat); b.position.set(x, y, z); scene.add(b); };
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W, 0.01, D), glassMat);
  roof.position.set(XM, H.top + 0.005, Z); roof.renderOrder = 2; scene.add(roof);
  for (let k = 0; k <= 12; k++) bar(0.03, 0.035, D, H.x0 + k * W / 12, H.top + 0.02, Z);
  bar(W, 0.035, 0.03, XM, H.top + 0.02, H.z0); bar(W, 0.035, 0.03, XM, H.top + 0.02, H.z1);
  // End doors: two sliding glass leaves in a frame, with a "HOT AISLE" sign above
  [H.x0, H.x1].forEach((x, i) => {
    const s = i ? 1 : -1;
    bar(0.04, H.top, 0.04, x, H.top / 2, H.z0); bar(0.04, H.top, 0.04, x, H.top / 2, H.z1);
    bar(0.04, 0.05, D, x, H.top - 0.025, Z);
    [-1, 1].forEach(k => {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.012, H.top - 0.1, D / 2 - 0.03), glassMat);
      leaf.position.set(x + s * (k > 0 ? 0.02 : 0.005), (H.top - 0.05) / 2, Z + k * D / 4); leaf.renderOrder = 2; scene.add(leaf);
      bar(0.02, 0.28, 0.02, x + s * 0.03, 1.05, Z + k * 0.05);
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.14), new THREE.MeshBasicMaterial({ map: signTex, transparent: true }));
    sign.position.set(x + s * 0.03, H.top - 0.12, Z); sign.rotation.y = s * Math.PI / 2; scene.add(sign);
  });
  H.chimneys.forEach(x => {
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.62, ROOM.h - H.top, 0.62), chimMat);
    ch.position.set(x, (ROOM.h + H.top) / 2, Z); ch.renderOrder = 2; scene.add(ch);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(ch.geometry), new THREE.LineBasicMaterial({ color: 0x3d4a56 }));
    edges.position.copy(ch.position); scene.add(edges);
  });
});

// ---------- Ladder cable trays with fibre bundles, threaded drop rods ----------
const trayMat = new THREE.MeshStandardMaterial({ color: 0x2a3743, metalness: 0.75, roughness: 0.4 });
const bundleMat = new THREE.MeshStandardMaterial({ color: lc('#8c7a34'), roughness: 0.8 });
const rodMat = new THREE.MeshStandardMaterial({ color: 0x55616c, metalness: 0.8, roughness: 0.4 });
const rungs = [], rods = [];
function tray(x0, z0, x1, z1) {
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, y = TRAY_Y - 0.04;
  [-0.15, 0.15].forEach(o => {
    const rail = new THREE.Mesh(alongX ? new THREE.BoxGeometry(len, 0.06, 0.012) : new THREE.BoxGeometry(0.012, 0.06, len), trayMat);
    rail.position.set(cx + (alongX ? 0 : o), y + 0.02, cz + (alongX ? o : 0)); scene.add(rail);
  });
  for (let s = -len / 2 + 0.1; s < len / 2; s += 0.3) rungs.push([alongX ? cx + s : cx, y, alongX ? cz : cz + s, alongX]);
  for (let s = -len / 2 + 0.2; s < len / 2; s += 1.2) [-0.17, 0.17].forEach(o => rods.push([alongX ? cx + s : cx + o, alongX ? cz + o : cz + s]));
  const b = new THREE.Mesh(alongX ? new THREE.BoxGeometry(len, 0.035, 0.16) : new THREE.BoxGeometry(0.16, 0.035, len), bundleMat);
  b.position.set(cx, y + 0.025, cz); scene.add(b);
}
ROWS.forEach(row => tray(-ROW_HALF - 0.1, row.z, TRAY_X, row.z));
tray(TRAY_X, ROWS[0].z - 0.15, TRAY_X, ROWS[ROWS.length - 1].z + 0.15);   // spine
tray(TRAY_X, 0, ROOM.x - 0.06, 0);                                       // to the uplink panel in the east wall
{
  const rg = new THREE.InstancedMesh(new THREE.BoxGeometry(0.02, 0.012, 0.3), trayMat, rungs.length);
  rungs.forEach(([x, y, z, ax], i) => { m4.makeRotationY(ax ? 0 : Math.PI / 2).setPosition(x, y, z); rg.setMatrixAt(i, m4); });
  const rd = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.006, 0.006, ROOM.h - TRAY_Y + 0.05, 6), rodMat, rods.length);
  rods.forEach(([x, z], i) => { m4.makeTranslation(x, (ROOM.h + TRAY_Y) / 2 - 0.04, z); rd.setMatrixAt(i, m4); });
  scene.add(rg, rd);
}

// Fibre risers from each rack top up into its row tray
export const RISER_DZ = 0.1;   // offset towards the rear, inside the tray footprint
{
  const riser = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.016, 0.016, TRAY_Y - RACK_H - 0.04, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), racks.length * 2);
  const RC = [lc('#2b9fb4'), lc('#d6b23c')];
  racks.forEach((r, i) => [-1, 1].forEach((s, k) => {
    m4.makeTranslation(r.x + s * 0.035, (RACK_H + TRAY_Y - 0.04) / 2, r.z - r.face * RISER_DZ); riser.setMatrixAt(i * 2 + k, m4);
    riser.setColorAt(i * 2 + k, RC[k]);
  }));
  scene.add(riser);
}

// Uplink panel where the trays leave the hall for the meet-me room; its strips pulse with hall traffic
export const uplinkStripMat = new THREE.MeshBasicMaterial({ color: lc(COL.cold), toneMapped: false });
{
  const x = ROOM.x - 0.06;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 1.3), new THREE.MeshStandardMaterial({ color: 0x141b23, metalness: 0.6, roughness: 0.45 }));
  panel.position.set(x, TRAY_Y - 0.05, 0); scene.add(panel);
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.02, 1.1), uplinkStripMat); s.position.set(x - 0.065, TRAY_Y - 0.25 + i * 0.1, 0); scene.add(s);
  }
  const l = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.2), new THREE.MeshBasicMaterial({ map: labelTex('UPLINKS · MMR', COL.cold), transparent: true, toneMapped: false }));
  l.position.set(x - 0.07, TRAY_Y - 0.5, 0); l.rotation.y = -Math.PI / 2; scene.add(l);
}

// ---------- Overhead busway with a tap-off box, power drop and status LED per rack (instanced) ----------
export let tapLeds;
{
  const busMat = new THREE.MeshStandardMaterial({ color: 0x3a434c, metalness: 0.7, roughness: 0.45 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: lc('#c9a227'), roughness: 0.6 });
  const BUS_Y = 2.42, BUS_L = 2 * ROW_HALF + 0.3;
  ROWS.forEach(row => {
    const z = row.z + row.face * 0.26;
    const bus = new THREE.Mesh(new THREE.BoxGeometry(BUS_L, 0.1, 0.13), busMat); bus.position.set(0, BUS_Y, z); scene.add(bus);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(BUS_L, 0.012, 0.132), stripeMat); stripe.position.set(0, BUS_Y + 0.03, z); scene.add(stripe);
    for (let k = -ROW_HALF + 0.3; k < ROW_HALF; k += 2.4) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, ROOM.h - BUS_Y, 6), rodMat);
      rod.position.set(k, (ROOM.h + BUS_Y) / 2, z); scene.add(rod);
    }
  });
  const taps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.12, 0.11), new THREE.MeshStandardMaterial({ color: 0x4a545e, metalness: 0.5, roughness: 0.5 }), racks.length);
  const drops = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.011, 0.011, BUS_Y - 0.11 - RACK_H, 8), new THREE.MeshStandardMaterial({ color: 0x111417, roughness: 0.7 }), racks.length);
  tapLeds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.012, 0.004), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), racks.length);
  const off = new THREE.Color(0, 0, 0);
  racks.forEach((r, i) => {
    const z = r.z + r.face * 0.26;
    m4.makeTranslation(r.x, BUS_Y - 0.11, z); taps.setMatrixAt(i, m4);
    m4.makeTranslation(r.x + 0.04, (BUS_Y - 0.17 + RACK_H) / 2, z); drops.setMatrixAt(i, m4);
    m4.makeTranslation(r.x - 0.05, BUS_Y - 0.09, z + r.face * 0.057); tapLeds.setMatrixAt(i, m4); tapLeds.setColorAt(i, off);
  });
  scene.add(taps, drops, tapLeds);
}

// ---------- Cooling units along the west wall ----------
// Downflow units: warm air returns from the ceiling plenum through the top fans, cold air goes under the floor
export const coolers = [];
const louvreTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#1d262f'; g.fillRect(0, 0, w, h); speckle(g, w, h, 3000, 0.04);
  g.fillStyle = '#0a0e12'; for (let y = 16; y < h - 16; y += 9) g.fillRect(14, y, w - 28, 4);
});
const cuSide = new THREE.MeshStandardMaterial({ color: 0x1b242d, metalness: 0.5, roughness: 0.5 });
const cuFront = new THREE.MeshStandardMaterial({ map: louvreTex, metalness: 0.5, roughness: 0.55 });
COOLING.forEach(({ name, z }) => {
  const x = -ROOM.x + 0.45, L = 3.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, L), [cuFront, cuSide, cuSide, cuSide, cuSide, cuSide]);
  body.position.set(x, 1.1, z); scene.add(body);
  const stripMat = new THREE.MeshBasicMaterial({ color: lc(COL.cold), toneMapped: false });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.05, L - 0.4), stripMat); strip.position.set(x + 0.455, 1.92, z); scene.add(strip);
  const l = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.18), new THREE.MeshBasicMaterial({ map: labelTex(name), transparent: true, toneMapped: false }));
  l.position.set(x + 0.456, 2.06, z); l.rotation.y = Math.PI / 2; scene.add(l);
  const fans = [];
  [-1, 0, 1].forEach(k => {
    const g = new THREE.Group(); g.position.set(x, 2.215, z + k * 0.95);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.33, 0.38, 32), new THREE.MeshBasicMaterial({ color: lc('#3a4855'), side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; g.add(ring);
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.08), new THREE.MeshStandardMaterial({ color: 0x5a6a78, metalness: 0.6 }));
      blade.position.x = 0.15; const arm = new THREE.Group(); arm.rotation.y = b * Math.PI / 2; arm.add(blade); g.add(arm);
    }
    scene.add(g); fans.push(g);
  });
  coolers.push({ name, stripMat, fans });
});
