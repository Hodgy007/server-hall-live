// Cabinets and everything mounted in them. Fronts face the cold aisle, rears the hot aisle.
import { THREE, scene, lc, COL, rnd, labelTex, RACK_W, RACK_H, RACK_D, COLS, PITCH, SERVERS, ROWS, U, U0, U_TOP, FRONT, uY, ease, reduceMotion } from './core.js';
import { sideTex, roughTex, topTex, railTex, bezelTex, plinthTex, contactTex, doorTex, doorAlpha, plateMat, drawFront, drawRear, drawSwFans, drawSwPorts, drawPatch, drawBlank } from './textures.js';

export const racks = [], cabinets = [];
const colGeo = new THREE.BoxGeometry(0.5, 1, 0.05); colGeo.translate(0, 0.5, 0);
const frameGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.5, 0.9, 0.05)); frameGeo.translate(0, 0.45, 0);
const frameMat = new THREE.LineBasicMaterial({ color: lc('#8299a8'), transparent: true, opacity: 0.18 });
const darkInside = new THREE.MeshStandardMaterial({ color: 0x06080a, roughness: 0.9, metalness: 0.2 });
const cabGeo = new THREE.BoxGeometry(RACK_W, RACK_H, RACK_D);

ROWS.forEach((row, ri) => {
  for (let c = 0; c < COLS; c++) {
    const x = (c - (COLS - 1) / 2) * PITCH;
    const sideM = new THREE.MeshStandardMaterial({ map: sideTex, roughnessMap: roughTex, metalness: 0.5, roughness: 0.8, emissive: 0x000000 });
    const topM = new THREE.MeshStandardMaterial({ map: topTex, roughnessMap: roughTex, metalness: 0.5, roughness: 0.75, emissive: 0x000000 });
    const mesh = new THREE.Mesh(cabGeo, [sideM, sideM, topM, darkInside, darkInside, darkInside]);
    mesh.position.set(x, RACK_H / 2, row.z); scene.add(mesh);
    const r = {
      id: row.id + String(c + 1).padStart(2, '0'), ri, c, row, x, z: row.z, face: row.face, mesh, mats: [sideM, topM],
      phase: rnd() * 20, base: row.base + (rnd() - 0.5) * 0.18, memBase: rnd() * 0.18, inletOffset: (rnd() - 0.5) * 1.2,
      demand: 0.4, load: 0.4, mem: 0.5, inlet: 20, exhaust: 30, power: 0, swPower: 0, net: 0, cpuLvl: 0, tLvl: 0, svLvl: 0, status: 0, svWarn: 0, svCrit: 0,
      hist: [], ihist: [], pktAcc: 0, leds: []
    };
    const col = new THREE.Mesh(colGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false }));
    col.position.set(x, RACK_H + 0.01, row.z + row.face * 0.44); scene.add(col); r.colMesh = col;
    const frame = new THREE.LineSegments(frameGeo, frameMat); frame.position.copy(col.position); scene.add(frame);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.085), new THREE.MeshBasicMaterial({ map: labelTex(r.id), transparent: true, toneMapped: false }));
    lab.position.set(x, (U_TOP + RACK_H) / 2, row.z + row.face * (FRONT + 0.015)); lab.rotation.y = row.face > 0 ? 0 : Math.PI; scene.add(lab);
    mesh.userData.rack = r; cabinets.push(mesh); racks.push(r);
  }
});
export const byId = Object.fromEntries(racks.map(r => [r.id, r]));

// ---------- Servers: front plates, rear plates, status LEDs (instanced) ----------
const PLATE_D = 0.012, LED_Z = FRONT + 0.016;
const sv2U = new THREE.BoxGeometry(0.52, 2 * U - 0.0016, PLATE_D), dev1U = new THREE.BoxGeometry(0.52, U - 0.0012, PLATE_D);
const nPlates = racks.length * SERVERS;
export const plates = new THREE.InstancedMesh(sv2U, plateMat(512, 86, drawFront, { metalness: 0.6, roughness: 0.55 }), nPlates);
export const rears = new THREE.InstancedMesh(sv2U, plateMat(512, 86, drawRear, { glow: true }), nPlates);
export const leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.016, 0.016, 0.008), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), nPlates * 2);
// LED colours sit above 1.0 so the bloom pass picks them up
export const LED = {
  act: lc('#5dffa5').multiplyScalar(2.4), off: lc('#0d1a14'), idle: lc('#2a6e9a').multiplyScalar(2),
  warn: lc('#ffbe3b').multiplyScalar(2.2), crit: lc('#ff4a3d').multiplyScalar(2.6), dark: lc('#1a0d0c')
};
const plateM = [], rearM = [], ledM = [], ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
export const HOST = ['web', 'api', 'db', 'batch'];
// Per-row hardware: same 2U chassis (2× 32-core, 512 GB, 8 NVMe bays), different drives
export const MODEL = ['2U compute node', '2U compute node', '2U storage node', '2U compute node'];
export const DRIVE = ['8× 960 GB NVMe', '8× 1.92 TB NVMe', '8× 7.68 TB NVMe', '8× 3.84 TB NVMe'];
export const DRIVE_TB = [7.68, 15.36, 61.44, 30.72];
const m4 = new THREE.Matrix4(), tint = new THREE.Color();
// Place an instance on the front (side = 1) or rear (side = -1) face of rack r
function mount(mesh, i, r, side, y, dz, x, store) {
  m4.makeRotationY(r.face * side > 0 ? 0 : Math.PI).setPosition(r.x + (x || 0), y, r.z + r.face * side * (FRONT + dz));
  mesh.setMatrixAt(i, m4); if (store) store.push(m4.clone());
}
{
  let pi = 0, li = 0;
  racks.forEach(r => {
    r.servers = [];
    for (let s = 0; s < SERVERS; s++) {
      const u = 1 + s * 2, y = uY(u, 2);
      const sv = {
        r, s, idx: pi, y, u, host: `${HOST[r.ri]}-${r.id.toLowerCase()}-${String(s + 1).padStart(2, '0')}`,
        bias: 0.75 + rnd() * 0.5, memBias: 0.85 + rnd() * 0.3, phase: rnd() * 20, load: 0.4, stressLeft: 0, stressAmp: 0, hist: [],
        mem: 0.5, temp: 45, rpm: 4000, power: 500, net: 0, cLvl: 0, tLvl: 0, status: 0,
        serial: 'HX' + (2400000 + Math.floor(rnd() * 99999)).toString(36).toUpperCase(),
        installed: `20${22 + Math.floor(rnd() * 4)}-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}`
      };
      r.servers.push(sv);
      mount(plates, pi, r, 1, y, 0.007, 0, plateM);
      mount(rears, pi, r, -1, y, 0.007, 0, rearM);
      // slight finish variation so no two chassis read as copies
      tint.setScalar(0.86 + rnd() * 0.14); plates.setColorAt(pi, tint); rears.setColorAt(pi, tint);
      pi++;
      for (let k = 0; k < 2; k++) {
        m4.makeTranslation(r.x + r.face * (0.19 + k * 0.035), y, r.z + r.face * LED_Z);
        leds.setMatrixAt(li, m4); ledM.push(m4.clone()); leds.setColorAt(li, LED.off);
        r.leds.push({ i: li, k, sv, on: rnd() < 0.5 }); li++;
      }
    }
  });
}
scene.add(plates, rears, leds);
export const byHost = new Map(racks.flatMap(r => r.servers.map(sv => [sv.host, sv])));

// Hide or restore a server's plates and LEDs while it is pulled out
export function setInstance(sv, show) {
  plates.setMatrixAt(sv.idx, show ? plateM[sv.idx] : ZERO);
  rears.setMatrixAt(sv.idx, show ? rearM[sv.idx] : ZERO);
  for (let k = 0; k < 2; k++) leds.setMatrixAt(sv.idx * 2 + k, show ? ledM[sv.idx * 2 + k] : ZERO);
  plates.instanceMatrix.needsUpdate = true; rears.instanceMatrix.needsUpdate = true; leds.instanceMatrix.needsUpdate = true;
}

// ---------- Switches, patch panel, blanking panels ----------
const swFans = new THREE.InstancedMesh(dev1U, plateMat(512, 44, drawSwFans, { glow: true }), racks.length * 2);
const swPorts = new THREE.InstancedMesh(dev1U, plateMat(512, 44, drawSwPorts, { glow: true }), racks.length * 2);
const patch = new THREE.InstancedMesh(dev1U, plateMat(512, 44, drawPatch), racks.length);
const blankMat = plateMat(512, 44, drawBlank, { metalness: 0.5, roughness: 0.75 });
blankMat.color.setScalar(0.8);
const blanks = new THREE.InstancedMesh(dev1U, blankMat, racks.length * 16);
racks.forEach((r, i) => {
  [41, 42].forEach((u, k) => { mount(swFans, i * 2 + k, r, 1, uY(u, 1), 0.007); mount(swPorts, i * 2 + k, r, -1, uY(u, 1), 0.007); });
  mount(patch, i, r, -1, uY(40, 1), 0.007);
  for (let u = 25; u <= 40; u++) mount(blanks, i * 16 + u - 25, r, 1, uY(u, 1), 0.006);
});
scene.add(swFans, swPorts, patch, blanks);

// ---------- Cabinet frame: mounting rails, top bezel, vented plinth, rear cable looms ----------
const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.034, 42 * U + 0.01, 0.01), new THREE.MeshStandardMaterial({ map: railTex, metalness: 0.75, roughness: 0.45 }), racks.length * 4);
const bezels = new THREE.InstancedMesh(new THREE.BoxGeometry(RACK_W, RACK_H - U_TOP, 0.014), new THREE.MeshStandardMaterial({ map: bezelTex, roughnessMap: roughTex, metalness: 0.5, roughness: 0.8 }), racks.length * 2);
const plinths = new THREE.InstancedMesh(new THREE.BoxGeometry(RACK_W, U0, 0.014), new THREE.MeshStandardMaterial({ map: plinthTex, metalness: 0.4, roughness: 0.85 }), racks.length * 2);
const looms = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.018, 42 * U, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.05 }), racks.length * 2);
const LOOM = [lc('#15191d'), lc('#2b9fb4')];   // power cords one side, fibre the other
racks.forEach((r, i) => {
  [-1, 1].forEach((s, k) => {
    mount(rails, i * 4 + k * 2, r, 1, U0 + 21 * U, 0.004, s * 0.278);
    mount(rails, i * 4 + k * 2 + 1, r, -1, U0 + 21 * U, 0.004, s * 0.278);
    mount(bezels, i * 2 + k, r, s, (U_TOP + RACK_H) / 2, 0.007);
    mount(plinths, i * 2 + k, r, s, U0 / 2, 0.007);
    mount(looms, i * 2 + k, r, -1, U0 + 21 * U, 0.04, s * 0.236);
    tint.copy(LOOM[k]).multiplyScalar(0.85 + rnd() * 0.3); looms.setColorAt(i * 2 + k, tint);
  });
});
scene.add(rails, bezels, plinths, looms);

// Soft contact shadow under each cabinet so the racks sit on the floor
const contact = new THREE.InstancedMesh(new THREE.PlaneGeometry(RACK_W + 0.42, RACK_D + 0.5),
  new THREE.MeshBasicMaterial({ map: contactTex, color: 0x000000, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), racks.length);
racks.forEach((r, i) => { m4.makeRotationX(-Math.PI / 2).setPosition(r.x, 0.004, r.z); contact.setMatrixAt(i, m4); });
scene.add(contact);

// ---------- Perforated front doors, hinged on the left; the selected rack's door swings open ----------
const DOOR_H = U_TOP + 0.01 - 0.07, DOOR_Y = 0.07 + DOOR_H / 2, DOOR_Z = FRONT + 0.03, DOOR_OPEN = -1.75;
const doorGeo = new THREE.BoxGeometry(0.585, DOOR_H, 0.012); doorGeo.translate(0.2925, 0, 0);
const doorMat = new THREE.MeshStandardMaterial({ map: doorTex, alphaMap: doorAlpha, transparent: true, metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide });
const handleGeo = new THREE.BoxGeometry(0.018, 0.22, 0.03); handleGeo.translate(0.55, 0, 0.018);
const handleMat = new THREE.MeshStandardMaterial({ color: 0x9aa6b0, metalness: 0.85, roughness: 0.3 });
racks.forEach(r => {
  const pivot = new THREE.Group();
  pivot.position.set(r.x - r.face * 0.2925, DOOR_Y, r.z + r.face * DOOR_Z);
  const base = r.face > 0 ? 0 : Math.PI; pivot.rotation.y = base;
  const door = new THREE.Mesh(doorGeo, doorMat); door.renderOrder = 1;
  pivot.add(door, new THREE.Mesh(handleGeo, handleMat));
  scene.add(pivot);
  r.door = { pivot, base, a: 0, target: 0 };
});
export const doorOpen = r => r.door.a > 0.85;
export function setDoor(r, open) { r.door.target = open ? 1 : 0; }
export function updateDoors(dt) {
  for (const r of racks) {
    const d = r.door; if (d.a === d.target) continue;
    d.a = d.target > d.a ? Math.min(1, d.a + dt / (reduceMotion ? 0.01 : 0.55)) : Math.max(0, d.a - dt / (reduceMotion ? 0.01 : 0.55));
    d.pivot.rotation.y = d.base + ease(d.a) * DOOR_OPEN;
  }
}

// ---------- Selection outline and inventory highlight ----------
export const selBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(RACK_W + 0.06, RACK_H + 0.06, RACK_D + 0.06)), new THREE.LineBasicMaterial({ color: lc(COL.cold), toneMapped: false }));
scene.add(selBox);
const hl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: lc(COL.cold).multiplyScalar(2.5), toneMapped: false, depthTest: false }));
hl.renderOrder = 10; hl.visible = false; scene.add(hl);
// Outline a span of rack units on the front (side 1) or rear (side -1); x/w override the width for 0U PDUs
export function highlight(r, u, h, side, x, w) {
  const depth = 0.04;
  hl.scale.set((w || 0.56) + 0.01, h * U + 0.006, depth);
  hl.position.set(r.x + (x || 0), uY(u, h), r.z + r.face * side * (FRONT + depth / 2));
  hl.visible = true;
}
export function unhighlight() { hl.visible = false; }
