// Cabinets and everything mounted in them. Fronts face the cold aisle, rears the hot aisle.
import { THREE, scene, lc, COL, rnd, vrnd, labelTex, RACK_W, RACK_H, RACK_D, COLS, PITCH, SERVERS, ROWS, U, U0, U_TOP, FRONT, uY, ease, reduceMotion } from './core.js';
import { HALL, fill } from './data.js';
import { sideTexes, roughTex, topTex, topTexB, railTex, bezelTex, plinthTex, contactTex, doorTexes, doorAlphas, plateMat, drawFront, drawRear, drawRear1U, drawSwFans, drawSwPorts, drawPatch, drawBlank, FRONT_LED, FRONT_RELIEF } from './textures.js';
import { leadGeo, trunkGeo, cableMat } from './cabling.js';

export const racks = [], cabinets = [];
const colGeo = new THREE.BoxGeometry(0.5, 1, 0.05); colGeo.translate(0, 0.5, 0);
const frameGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.5, 0.9, 0.05)); frameGeo.translate(0, 0.45, 0);
const frameMat = new THREE.LineBasicMaterial({ color: lc('#8299a8'), transparent: true, opacity: 0.18 });
const darkInside = new THREE.MeshStandardMaterial({ color: 0x06080a, roughness: 0.9, metalness: 0.2 });
const cabGeo = new THREE.BoxGeometry(RACK_W, RACK_H, RACK_D);
// Powder coat from different batches: a slightly cooler or warmer, lighter or darker grey, and a different sheen
function cabinetFinish(vendor) {
  const k = vendor ? 1.3 : 0.9 + vrnd() * 0.18, h = vendor ? -0.03 : (vrnd() - 0.5) * 0.08;
  return { color: new THREE.Color(k * (1 + h), k, k * (1 - h)), rough: vendor ? 0.62 : 0.7 + vrnd() * 0.18 };
}

// ---------- Server models ----------
// The Dell PowerEdge models in the hall. Each rack holds twelve of one model, picked at random; a rack of 1U
// servers fills U1–12 and is blanked above. Memory is 32 GB RDIMMs in every slot; power is idle and flat-out watts.
export const MODELS = {
  R7725:   { u: 2, sockets: 2, vendor: 'amd', dimms: 24, channels: 12, cpu: 'AMD EPYC 9355', cores: 32, ghz: 3.55, w: [260, 900] },
  R7725xd: { u: 2, sockets: 2, vendor: 'amd', dimms: 24, channels: 12, cpu: 'AMD EPYC 9375F', cores: 32, ghz: 3.8, w: [280, 960] },
  R7715:   { u: 2, sockets: 1, vendor: 'amd', dimms: 24, channels: 12, cpu: 'AMD EPYC 9535', cores: 64, ghz: 2.4, w: [220, 700] },
  R6725:   { u: 1, sockets: 2, vendor: 'amd', dimms: 24, channels: 12, cpu: 'AMD EPYC 9335', cores: 32, ghz: 3.0, w: [240, 820] },
  R6715:   { u: 1, sockets: 1, vendor: 'amd', dimms: 24, channels: 12, cpu: 'AMD EPYC 9535', cores: 64, ghz: 2.4, w: [200, 650] },
  R770:    { u: 2, sockets: 2, vendor: 'intel', dimms: 32, channels: 8, cpu: 'Intel Xeon 6737P', cores: 32, ghz: 2.9, w: [280, 950] },
  R770AP:  { u: 2, sockets: 2, vendor: 'intel', dimms: 24, channels: 12, cpu: 'Intel Xeon 6978P', cores: 120, w: [400, 1200] },
  R670:    { u: 1, sockets: 2, vendor: 'intel', dimms: 32, channels: 8, cpu: 'Intel Xeon 6737P', cores: 32, ghz: 2.9, w: [260, 880] },
  R570:    { u: 2, sockets: 1, vendor: 'intel', dimms: 16, channels: 8, cpu: 'Intel Xeon 6737P', cores: 32, ghz: 2.9, w: [180, 520] },
  R470:    { u: 1, sockets: 1, vendor: 'intel', dimms: 16, channels: 8, cpu: 'Intel Xeon 6737P', cores: 32, ghz: 2.9, w: [170, 500] }
};
for (const k in MODELS) MODELS[k].key = k;
// Its own random stream, so the layout of models never shifts the generated serials or the cabinet finishes
let mseed = 4099;
const pickModel = () => { const keys = Object.keys(MODELS); mseed = (mseed * 16807) % 2147483647; return MODELS[keys[Math.floor(mseed / 2147483647 * keys.length)]]; };

ROWS.forEach((row, ri) => {
  for (let c = 0; c < COLS; c++) {
    const x = (c - (COLS - 1) / 2) * PITCH;
    // Not every cabinet is the same: a few come from a second vendor, the rest differ in wear, tint and finish
    const vendor = vrnd() < 0.09, wear = Math.floor(vrnd() * 3), finish = cabinetFinish(vendor);
    const sideM = new THREE.MeshStandardMaterial({ map: sideTexes[vendor ? 3 : wear], roughnessMap: roughTex, metalness: vendor ? 0.35 : 0.5, roughness: finish.rough, color: finish.color, emissive: 0x000000 });
    const topM = new THREE.MeshStandardMaterial({ map: vendor ? topTexB : topTex, roughnessMap: roughTex, metalness: vendor ? 0.35 : 0.5, roughness: finish.rough - 0.05, color: finish.color, emissive: 0x000000 });
    const mesh = new THREE.Mesh(cabGeo, [sideM, sideM, topM, darkInside, darkInside, darkInside]);
    mesh.position.set(x, RACK_H / 2, row.z); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
    const r = {
      id: row.id + String(c + 1).padStart(2, '0'), ri, kind: row.kind, c, row, x, z: row.z, face: row.face, mesh, mats: [sideM, topM], vendor, wear, finish: finish.color, model: pickModel(),
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
const dev1U = new THREE.BoxGeometry(0.52, U - 0.0012, PLATE_D);
const nPlates = racks.length * SERVERS;
// Server faces for each chassis height; the pulled-out model uses the same front. Fronts are moulded plastic, and
// only the power buttons' rings glow.
export const FACE = {
  2: { front: plateMat(512, 86, drawFront, { glow: true, metalness: 0.2, roughness: 0.75 }), rear: plateMat(512, 86, drawRear, { glow: true }) },
  1: { front: plateMat(512, 44, drawFront, { glow: true, metalness: 0.2, roughness: 0.75 }), rear: plateMat(512, 44, drawRear1U, { glow: true }) }
};
// The front's geometry: the plate, with the ears and drive carriers standing proud of it. UVs are projected straight
// on, so the raised parts carry the same texture and their sides take the colour of their edges.
export function faceGeo(h) {
  const ph = h === 2 ? 86 : 44, H = h * U - (h === 2 ? 0.0016 : 0.0012), pos = [], nor = [], uv = [], idx = [];
  [[0, 0, 512, ph, -PLATE_D / 2, PLATE_D / 2], ...FRONT_RELIEF(ph).map(([x, y, w, hh], i) => [x, y, w, hh, 0.004, i < 2 ? 0.0095 : 0.0085])].forEach(([x, y, w, hh, z0, z1]) => {
    const b = new THREE.BoxGeometry(w / 512 * 0.52, hh / ph * H, z1 - z0);
    b.translate(((x + w / 2) / 512 - 0.5) * 0.52, (0.5 - (y + hh / 2) / ph) * H, (z0 + z1) / 2);
    const P = b.attributes.position, base = pos.length / 3;
    for (let i = 0; i < P.count; i++) uv.push(P.getX(i) / 0.52 + 0.5, P.getY(i) / H + 0.5);
    pos.push(...P.array); nor.push(...b.attributes.normal.array); idx.push(...Array.from(b.index.array, v => v + base));
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
// One instanced mesh per face and height. userData.servers maps an instance to its server (for picking), and the
// svIdx attribute carries the server's index (for the thermal camera)
export const plateMeshes = [], rearMeshes = [];
const faceMesh = {};
[2, 1].forEach(h => {
  const n = racks.filter(r => r.model.u === h).length * SERVERS; if (!n) return;
  const geo = new THREE.BoxGeometry(0.52, h * U - (h === 2 ? 0.0016 : 0.0012), PLATE_D), front = faceGeo(h);
  const svIdx = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  geo.setAttribute('svIdx', svIdx); front.setAttribute('svIdx', svIdx);
  [1, -1].forEach(side => {
    const m = new THREE.InstancedMesh(side > 0 ? front : geo, side > 0 ? FACE[h].front : FACE[h].rear, n);
    m.userData.servers = []; m.userData.face = side > 0 ? 'front' : 'rear';
    faceMesh[h + '|' + side] = m; (side > 0 ? plateMeshes : rearMeshes).push(m);
  });
});
export const leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.016, 0.016, 0.008), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), nPlates * 2);
// LED colours sit above 1.0 so the bloom pass picks them up
export const LED = {
  act: lc('#5dffa5').multiplyScalar(2.4), off: lc('#0d1a14'), idle: lc('#2a6e9a').multiplyScalar(2),
  warn: lc('#ffbe3b').multiplyScalar(2.2), crit: lc('#ff4a3d').multiplyScalar(2.6), dark: lc('#1a0d0c')
};
const ledM = [], ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
// Rear cabling (cabling.js): per height, each server slot's own leads and the rest of a cabinet's cabling, one
// instance per cabinet of that height. The coarse twin of each mesh shares its instance matrices.
const leadMeshes = {}, trunks = {}, cableMeshes = [];
const cables = (geo, n) => {
  const m = [new THREE.InstancedMesh(geo('fine'), cableMat, n), new THREE.InstancedMesh(geo('coarse'), cableMat, n)];
  m[1].instanceMatrix = m[0].instanceMatrix; m[0].visible = false; cableMeshes.push(m);
  return m;
};
[2, 1].forEach(h => {
  const n = racks.filter(r => r.model.u === h).length; if (!n) return;
  trunks[h] = cables(d => trunkGeo(h, d), n);
  for (let s = 0; s < SERVERS; s++) leadMeshes[h + '|' + s] = cables(d => leadGeo(h, s, d), n);
});
// Fine cabling once the view closes in on something (a rack, a server, an aisle), coarse for the hall overview
export function updateCabling(dist) {
  const fine = dist < 9;
  if (fine !== cableMeshes[0][0].visible) for (const [f, c] of cableMeshes) { f.visible = fine; c.visible = !fine; }
}
export const HOST = ['web', 'api', 'db', 'batch'];
// Drives differ by workload row, whatever the model
export const DRIVE = ['8× 960 GB NVMe', '8× 1.92 TB NVMe', '8× 7.68 TB NVMe', '8× 3.84 TB NVMe'];
export const DRIVE_TB = [7.68, 15.36, 61.44, 30.72];
const coresText = m => m.sockets === 2 ? `${m.cores} cores each${m.ghz ? ` at ${m.ghz} GHz` : ''}, ${m.cores * 2} in total` : `${m.cores} cores${m.ghz ? ` at ${m.ghz} GHz` : ''}`;
const VLAN = [110, 120, 130, 140];
const mac = (oui, n) => [oui >> 16 & 255, oui >> 8 & 255, oui & 255, 0x20 + (n >> 16 & 15), n >> 8 & 255, n & 255].map(b => b.toString(16).padStart(2, '0')).join(':');
// Where the iDRAC (Dell's BMC) web console lives: "idracUrl" in data/hall.json (or the older "iloUrl"),
// e.g. "https://{ip}/" or "https://{host}-idrac.example.com/"
export const iloUrl = sv => { const u = fill(HALL.idracUrl || HALL.iloUrl || 'https://{ip}/', sv); return /^https?:\/\//i.test(u) ? u : '#'; };
// Dell service tags: seven characters, no vowels
const TAG = '0123456789BCDFGHJKLMNPQRSTVWXYZ';
const serviceTag = v => { let n = Math.floor(v * TAG.length ** 7), s = ''; for (let i = 0; i < 7; i++) { s = TAG[n % TAG.length] + s; n = Math.floor(n / TAG.length); } return s; };
export const DOMAIN = HALL.domain || 'hall2.local';
const OS = [
  [['Ubuntu 22.04.4 LTS', '5.15'], ['Ubuntu 24.04.1 LTS', '6.8']],
  [['Ubuntu 24.04.1 LTS', '6.8'], ['Debian 12.7', '6.1']],
  [['Red Hat Enterprise Linux 9.4', '5.14']],
  [['Rocky Linux 9.4', '5.14'], ['Ubuntu 22.04.4 LTS', '5.15']]
];
const m4 = new THREE.Matrix4(), tint = new THREE.Color();
// Place an instance on the front (side = 1) or rear (side = -1) face of rack r
function mount(mesh, i, r, side, y, dz, x, store) {
  m4.makeRotationY(r.face * side > 0 ? 0 : Math.PI).setPosition(r.x + (x || 0), y, r.z + r.face * side * (FRONT + dz));
  mesh.setMatrixAt(i, m4); if (store) store.push(m4.clone());
}
{
  let pi = 0, li = 0;
  const nh = { 1: 0, 2: 0 };
  racks.forEach(r => {
    const ci = nh[r.model.u]++;
    mount(trunks[r.model.u][0], ci, r, -1, 0, 0);
    r.servers = [];
    for (let s = 0; s < SERVERS; s++) {
      const m = r.model, h = m.u, u = 1 + s * h, y = uY(u, h);
      const sv = {
        r, s, idx: pi, y, u, h, host: `${HOST[r.kind]}-${r.id.toLowerCase()}-${String(s + 1).padStart(2, '0')}`,
        bias: 0.75 + rnd() * 0.5, memBias: 0.85 + rnd() * 0.3, phase: rnd() * 20, load: 0.4, stressLeft: 0, stressAmp: 0, hist: [],
        mem: 0.5, temp: 45, rpm: 4000, power: 500, net: 0, cLvl: 0, tLvl: 0, status: 0,
        serial: serviceTag(rnd()),
        installed: `20${25 + Math.floor(rnd() * 2)}-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}`,
        os: OS[r.kind][Math.floor(rnd() * OS[r.kind].length)], diskUsed: 0.25 + rnd() * 0.5,
        model: `Dell PowerEdge ${m.key}`, spec: m, drives: DRIVE[r.kind], driveTB: DRIVE_TB[r.kind], cpu: `${m.sockets}× ${m.cpu}`, cpuNote: coresText(m),
        memGB: m.dimms * 32,
        // NIC 1 and NIC 2 run to the same port on the rack's A and B top-of-rack switches (LACP bond);
        // the iDRAC port runs to the rack's out-of-band switch
        port: `Ethernet1/${s + 1}`, oobPort: `Gi1/0/${s + 1}`,
        // one /24 per rack: 10.<VLAN>.<rack>.x, rack numbered within its workload's pair of rows
        vlan: VLAN[r.kind], ip: `10.${VLAN[r.kind]}.${(r.ri % 2) * 20 + r.c + 1}.${11 + s}`, gw: `10.${VLAN[r.kind]}.${(r.ri % 2) * 20 + r.c + 1}.1`,
        ilo: `10.250.${r.ri * 16 + r.c + 1}.${11 + s}`,
        // Broadcom OCP NIC ports; the iDRAC carries a Dell address
        mac: [mac(0x000af7, pi * 4), mac(0x000af7, pi * 4 + 1)], iloMac: mac(0x001422, pi * 4 + 2)
      };
      r.servers.push(sv);
      const fm = faceMesh[h + '|1'], rm = faceMesh[h + '|-1'], j = fm.userData.servers.length;
      sv.slot = { fm, rm, j };
      mount(fm, j, r, 1, y, 0.007); sv.slot.mf = m4.clone();
      mount(rm, j, r, -1, y, 0.007); sv.slot.mr = m4.clone();
      sv.slot.lm = leadMeshes[h + '|' + s][0]; sv.slot.lj = ci; mount(sv.slot.lm, ci, r, -1, y, 0); sv.slot.ml = m4.clone();
      fm.userData.servers.push(sv); rm.userData.servers.push(sv); fm.geometry.attributes.svIdx.array[j] = pi;
      // slight finish variation so no two chassis read as copies
      tint.setScalar(0.86 + rnd() * 0.14); fm.setColorAt(j, tint); rm.setColorAt(j, tint);
      pi++;
      for (let k = 0; k < 2; k++) {
        m4.makeTranslation(r.x + r.face * FRONT_LED.x, y + FRONT_LED.y[h][k], r.z + r.face * LED_Z);
        leds.setMatrixAt(li, m4); ledM.push(m4.clone()); leds.setColorAt(li, LED.off);
        r.leds.push({ i: li, k, sv, on: rnd() < 0.5 }); li++;
      }
    }
  });
}
scene.add(...plateMeshes, ...rearMeshes, leds, ...cableMeshes.flat());

// Real inventory from data/hall.json replaces the generated values slot by slot: racks.<id>.servers.U<n>
const SET = { host: 'host', serial: 'serial', installed: 'installed', model: 'model', drives: 'drives', driveTB: 'driveTB', cpu: 'cpu', cpuNote: 'cpuNote',
  ip: 'ip', vlan: 'vlan', gateway: 'gw', ilo: 'ilo', iloMac: 'iloMac', idrac: 'ilo', idracMac: 'iloMac', port: 'port', oobPort: 'oobPort' };
for (const r of racks) {
  const slots = HALL.racks && HALL.racks[r.id] && HALL.racks[r.id].servers;
  if (!slots) continue;
  for (const sv of r.servers) {
    const o = slots['U' + sv.u]; if (!o) continue;
    for (const k in SET) if (o[k] !== undefined) sv[SET[k]] = o[k];
    if (o.driveTB !== undefined) sv.driveTB = Number(o.driveTB) || DRIVE_TB[r.kind];
    if (o.os) sv.os = [o.os, o.kernel || sv.os[1]];
    if (o.mac) sv.mac = o.mac;
    sv.real = true;
  }
}
export const byHost = new Map(racks.flatMap(r => r.servers.map(sv => [sv.host, sv])));

// Hide or restore a server's plates, LEDs and patch leads while it is pulled out
export function setInstance(sv, show) {
  const { fm, rm, j, mf, mr, lm, lj, ml } = sv.slot;
  fm.setMatrixAt(j, show ? mf : ZERO); rm.setMatrixAt(j, show ? mr : ZERO); lm.setMatrixAt(lj, show ? ml : ZERO);
  for (let k = 0; k < 2; k++) leds.setMatrixAt(sv.idx * 2 + k, show ? ledM[sv.idx * 2 + k] : ZERO);
  fm.instanceMatrix.needsUpdate = true; rm.instanceMatrix.needsUpdate = true; lm.instanceMatrix.needsUpdate = true; leds.instanceMatrix.needsUpdate = true;
}

// ---------- Switches, OOB switch, patch panel, blanking panels (front blanks cover the free U up to U40; U39–40 are rear-mounted) ----------
const swFans = new THREE.InstancedMesh(dev1U, plateMat(512, 44, drawSwFans, { glow: true }), racks.length * 2);
const swPorts = new THREE.InstancedMesh(dev1U, plateMat(512, 44, drawSwPorts, { glow: true }), racks.length * 2);
const patch = new THREE.InstancedMesh(dev1U, plateMat(512, 44, drawPatch), racks.length);
const oob = new THREE.InstancedMesh(dev1U, swPorts.material, racks.length);
const blankMat = plateMat(512, 44, drawBlank, { metalness: 0.5, roughness: 0.75 });
blankMat.color.setScalar(0.8);
// Servers fill U1 up to SERVERS × height; everything above that to U40 is blanked
export const topU = r => SERVERS * r.model.u;
const blanks = new THREE.InstancedMesh(dev1U, blankMat, racks.reduce((n, r) => n + 40 - topU(r), 0));
let nb = 0;
racks.forEach((r, i) => {
  [41, 42].forEach((u, k) => { mount(swFans, i * 2 + k, r, 1, uY(u, 1), 0.007); mount(swPorts, i * 2 + k, r, -1, uY(u, 1), 0.007); });
  mount(patch, i, r, -1, uY(40, 1), 0.007);
  mount(oob, i, r, -1, uY(39, 1), 0.007);
  for (let u = topU(r) + 1; u <= 40; u++) mount(blanks, nb++, r, 1, uY(u, 1), 0.006);
});
scene.add(swFans, swPorts, patch, oob, blanks);
// Switch status LEDs, on the fan side and the port side of both ToR switches: index = rack * 4 + switch * 2 + face
export const swLeds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.012, 0.006), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), racks.length * 4);
racks.forEach((r, i) => [42, 41].forEach((u, k) => [1, -1].forEach((side, j) => {
  const flip = r.face * side > 0 ? 1 : -1;
  m4.makeTranslation(r.x - flip * 0.215, uY(u, 1), r.z + r.face * side * (FRONT + 0.015)); swLeds.setMatrixAt(i * 4 + k * 2 + j, m4);
  swLeds.setColorAt(i * 4 + k * 2 + j, LED.act);
})));
scene.add(swLeds);

// ---------- Cabinet frame: mounting rails, top bezel, vented plinth, rear power loom ----------
const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.034, 42 * U + 0.01, 0.01), new THREE.MeshStandardMaterial({ map: railTex, metalness: 0.75, roughness: 0.45 }), racks.length * 4);
const bezels = new THREE.InstancedMesh(new THREE.BoxGeometry(RACK_W, RACK_H - U_TOP, 0.014), new THREE.MeshStandardMaterial({ map: bezelTex, roughnessMap: roughTex, metalness: 0.5, roughness: 0.8 }), racks.length * 2);
const plinths = new THREE.InstancedMesh(new THREE.BoxGeometry(RACK_W, U0, 0.014), new THREE.MeshStandardMaterial({ map: plinthTex, metalness: 0.4, roughness: 0.85 }), racks.length * 2);
// Power cords bundled down the left of the rear (seen from behind) as far as the servers go; data cabling is on the right
const looms = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.05 }), racks.length);
const LOOM = lc('#15191d'), loomLen = new THREE.Vector3();
racks.forEach((r, i) => {
  const len = topU(r) * U + 0.06;
  mount(looms, i, r, -1, U0 + len / 2 - 0.03, 0.04, r.face * 0.236);
  looms.getMatrixAt(i, m4); looms.setMatrixAt(i, m4.scale(loomLen.set(1, len, 1)));
  looms.setColorAt(i, tint.copy(LOOM).multiplyScalar(0.85 + rnd() * 0.3));
  [-1, 1].forEach((s, k) => {
    mount(rails, i * 4 + k * 2, r, 1, U0 + 21 * U, 0.004, s * 0.278);
    mount(rails, i * 4 + k * 2 + 1, r, -1, U0 + 21 * U, 0.004, s * 0.278);
    mount(bezels, i * 2 + k, r, s, (U_TOP + RACK_H) / 2, 0.007); bezels.setColorAt(i * 2 + k, r.finish);
    mount(plinths, i * 2 + k, r, s, U0 / 2, 0.007); plinths.setColorAt(i * 2 + k, r.finish);
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
const handleGeo = new THREE.BoxGeometry(0.018, 0.22, 0.03); handleGeo.translate(0.55, 0, 0.018);
const handleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.85, roughness: 0.3 });
// Instanced, one mesh per door style (three worn variants and the second vendor's); a door's matrix is only rebuilt while it moves
const doorStyle = r => r.vendor ? 3 : r.wear;
const doorMeshes = doorTexes.map((map, k) => {
  const m = new THREE.InstancedMesh(doorGeo, new THREE.MeshStandardMaterial({ map, alphaMap: doorAlphas[k], transparent: true, metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide }),
    Math.max(1, racks.filter(r => doorStyle(r) === k).length));
  m.renderOrder = 1; m.count = 0;
  return m;
});
const handles = new THREE.InstancedMesh(handleGeo, handleMat, racks.length);
handles.userData.irHide = true;   // the thermal camera hides the doors, and their handles with them
const dObj = new THREE.Object3D(), HANDLE = [lc('#9aa6b0'), lc('#2a2f34')];
function placeDoor(r) {
  const d = r.door;
  dObj.position.copy(d.hinge); dObj.rotation.set(0, d.base + ease(d.a) * DOOR_OPEN, 0); dObj.updateMatrix();
  d.mesh.setMatrixAt(d.j, dObj.matrix); handles.setMatrixAt(d.i, dObj.matrix);
}
racks.forEach((r, i) => {
  const mesh = doorMeshes[doorStyle(r)], j = mesh.count++;
  r.door = { i, mesh, j, hinge: new THREE.Vector3(r.x - r.face * 0.2925, DOOR_Y, r.z + r.face * DOOR_Z), base: r.face > 0 ? 0 : Math.PI, a: 0, target: 0 };
  placeDoor(r);
  mesh.setColorAt(j, tint.copy(r.finish).multiplyScalar(0.95 + vrnd() * 0.1));
  handles.setColorAt(i, HANDLE[r.vendor ? 1 : 0]);
});
scene.add(...doorMeshes, handles);
export const doorOpen = r => r.door.a > 0.85;
export function setDoor(r, open) { r.door.target = open ? 1 : 0; }
export function updateDoors(dt) {
  let moved = false;
  for (const r of racks) {
    const d = r.door; if (d.a === d.target) continue;
    d.a = d.target > d.a ? Math.min(1, d.a + dt / (reduceMotion ? 0.01 : 0.55)) : Math.max(0, d.a - dt / (reduceMotion ? 0.01 : 0.55));
    placeDoor(r); moved = true;
  }
  if (moved) { for (const m of doorMeshes) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); } handles.instanceMatrix.needsUpdate = true; }
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
