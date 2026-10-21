// Cabinets and everything mounted in them, built from the hall's floor grid and its servers (data.js). Fronts face the
// cold aisle, rears the hot aisle.
import { THREE, scene, lc, COL, rnd, vrnd, labelTex, RACK_W, RACK_H, RACK_D, KINDS, U, U0, U_TOP, FRONT, uY, plateH, ease, reduceMotion } from './core.js';
import { SITE, LAYOUT, HALL_SERVERS, fill } from './data.js';
import { kindOf, fmtGB, MAX_U } from './site.js';
import { sideTexes, roughTex, topTex, topTexB, railTex, bezelTex, plinthTex, contactTex, doorTexes, doorAlphas, plateMat, drawSwFans, drawSwPorts, drawPatch, drawBlank, faceSpec } from './textures.js';
import { rackCables, mergeGeos, cableMat } from './cabling.js';

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

// ---------- Cabinets, where the grid puts them ----------
const svByRack = new Map();
for (const n of HALL_SERVERS) { if (!svByRack.has(n.rack)) svByRack.set(n.rack, []); svByRack.get(n.rack).push(n); }
for (const L of LAYOUT.racks) {
  // Not every cabinet is the same: a few come from a second vendor, the rest differ in wear, tint and finish
  const vendor = vrnd() < 0.09, wear = Math.floor(vrnd() * 3), finish = cabinetFinish(vendor);
  const sideM = new THREE.MeshStandardMaterial({ map: sideTexes[vendor ? 3 : wear], roughnessMap: roughTex, metalness: vendor ? 0.35 : 0.5, roughness: finish.rough, color: finish.color, emissive: 0x000000 });
  const topM = new THREE.MeshStandardMaterial({ map: vendor ? topTexB : topTex, roughnessMap: roughTex, metalness: vendor ? 0.35 : 0.5, roughness: finish.rough - 0.05, color: finish.color, emissive: 0x000000 });
  const mesh = new THREE.Mesh(cabGeo, [sideM, sideM, topM, darkInside, darkInside, darkInside]);
  mesh.position.set(L.x, RACK_H / 2, L.z); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
  // The rack's workload (for the simulation) is the one most of its servers have
  const recs = (svByRack.get(L.id) || []).sort((a, b) => a.u - b.u), votes = [0, 0, 0, 0];
  recs.forEach(n => votes[kindOf(n.role)]++);
  const kind = recs.length ? votes.indexOf(Math.max(...votes)) : 1, prof = KINDS[kind];
  const r = {
    id: L.id, kind, prof, row: L.row, end: L.end, x: L.x, z: L.z, face: L.face, mesh, mats: [sideM, topM], vendor, wear, finish: finish.color, recs,
    phase: rnd() * 20, base: prof.base + (rnd() - 0.5) * 0.18, memBase: rnd() * 0.18, inletOffset: (rnd() - 0.5) * 1.2,
    demand: 0.4, load: 0.4, mem: 0.5, inlet: 20, exhaust: 30, power: 0, swPower: 0, net: 0, cpuLvl: 0, tLvl: 0, svLvl: 0, status: 0, svWarn: 0, svCrit: 0,
    hist: [], ihist: [], pktAcc: 0, leds: []
  };
  const col = new THREE.Mesh(colGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false }));
  col.position.set(r.x, RACK_H + 0.01, r.z + r.face * 0.44); scene.add(col); r.colMesh = col;
  const frame = new THREE.LineSegments(frameGeo, frameMat); frame.position.copy(col.position); scene.add(frame);
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.085), new THREE.MeshBasicMaterial({ map: labelTex(r.id), transparent: true, toneMapped: false }));
  lab.position.set(r.x, (U_TOP + RACK_H) / 2, r.z + r.face * (FRONT + 0.015)); lab.rotation.y = r.face > 0 ? 0 : Math.PI; scene.add(lab);
  mesh.userData.rack = r; cabinets.push(mesh); racks.push(r);
}
// Each row's workload, for the panels: the one most of its racks run
for (const row of LAYOUT.rows) {
  const v = [0, 0, 0, 0]; racks.filter(r => r.row === row).forEach(r => v[r.kind]++);
  row.role = KINDS[v.indexOf(Math.max(...v))].role;
}
export const byId = Object.fromEntries(racks.map(r => [r.id, r]));

// ---------- Servers: front plates, rear plates, status LEDs (instanced) ----------
const PLATE_D = 0.012, LED_Z = FRONT + 0.016;
const dev1U = new THREE.BoxGeometry(0.52, plateH(1), PLATE_D);
// Each kind of face (maker and height, textures.faceSpec) has its own materials, made when first needed; the pulled-out
// model uses the same front. Fronts are moulded plastic, and only the power buttons' rings glow.
const faceMatCache = new Map();
export function faceMats(spec) {
  if (!faceMatCache.has(spec.key)) faceMatCache.set(spec.key, {
    front: plateMat(512, spec.ph, spec.front, { glow: true, metalness: 0.2, roughness: 0.75 }), rear: plateMat(512, spec.ph, spec.rear, { glow: true })
  });
  return faceMatCache.get(spec.key);
}
// The front's geometry: the plate, with the ears and drive carriers standing proud of it. UVs are projected straight
// on, so the raised parts carry the same texture and their sides take the colour of their edges.
export function faceGeo(spec) {
  const ph = spec.ph, H = plateH(spec.h), pos = [], nor = [], uv = [], idx = [];
  [[0, 0, 512, ph, -PLATE_D / 2, PLATE_D / 2], ...spec.relief.map(([x, y, w, hh], i) => [x, y, w, hh, 0.004, i < 2 ? 0.0095 : 0.0085])].forEach(([x, y, w, hh, z0, z1]) => {
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
export const LED = {
  act: lc('#5dffa5').multiplyScalar(2.4), off: lc('#0d1a14'), idle: lc('#2a6e9a').multiplyScalar(2),
  warn: lc('#ffbe3b').multiplyScalar(2.2), crit: lc('#ff4a3d').multiplyScalar(2.6), dark: lc('#1a0d0c')
};
const ledM = [], ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
// Where the out-of-band console lives: "oobUrl" in the site file (or the older "idracUrl" / "iloUrl"),
// e.g. "https://{ip}/" or "https://{host}-idrac.example.com/"
export const iloUrl = sv => { const u = fill(SITE.oobUrl || 'https://{ip}/', sv); return sv.ilo && /^https?:\/\//i.test(u) ? u : '#'; };
export const DOMAIN = SITE.domain;
const m4 = new THREE.Matrix4(), tint = new THREE.Color();
// Place an instance on the front (side = 1) or rear (side = -1) face of rack r
function mount(mesh, i, r, side, y, dz, x, store) {
  m4.makeRotationY(r.face * side > 0 ? 0 : Math.PI).setPosition(r.x + (x || 0), y, r.z + r.face * side * (FRONT + dz));
  mesh.setMatrixAt(i, m4); if (store) store.push(m4.clone());
}
// What a server's record says, as the panels show it
const coresText = c => c.sockets > 1 ? `${c.cores} cores each${c.ghz ? ` at ${c.ghz} GHz` : ''}, ${c.cores * c.sockets} in total` : `${c.cores} cores${c.ghz ? ` at ${c.ghz} GHz` : ''}`;
const diskText = d => `${d.count > 1 ? d.count + '× ' : ''}${d.sizeGB ? fmtGB(d.sizeGB) + ' ' : ''}${d.type || 'disk'}`;
// The switch port a link goes to: the number at the end of its record's port name, else the one numbered after the server
const portNo = (name, fallback) => { const m = /(\d+)\s*$/.exec(name || ''); const n = m ? +m[1] : 0; return n >= 1 && n <= 48 ? n : fallback; };

// Every server in the hall, one instanced mesh per face kind and side
export const plateMeshes = [], rearMeshes = [], allServers = [];
const faceMesh = new Map();
for (const r of racks) {
  r.servers = r.recs.map((n, s) => {
    const face = faceSpec(n.family, n.h), c = n.cpu;
    const sv = {
      r, s, idx: allServers.length, rec: n, face, u: n.u, h: n.h, y: uY(n.u, n.h), host: n.host,
      bias: 0.75 + rnd() * 0.5, memBias: 0.85 + rnd() * 0.3, phase: rnd() * 20, load: 0.4, stressLeft: 0, stressAmp: 0, hist: [],
      mem: 0.5, temp: 45, rpm: 4000, power: 500, net: 0, cLvl: 0, tLvl: 0, status: 0, diskUsed: 0.25 + rnd() * 0.5,
      serial: n.serial || '—', installed: n.installed || '—', os: [n.os || 'Operating system not recorded', n.kernel], model: n.model,
      spec: { u: n.h, family: face.family, sockets: c.sockets, vendor: c.vendor, dimms: n.memory.dimms, channels: n.memory.channels, cores: c.cores, ghz: c.ghz, w: n.power,
        key: [face.key, c.sockets, c.vendor, n.memory.dimms, c.cores > 64].join('|') },
      cpu: `${c.sockets}× ${c.model}`, cpuNote: coresText(c), memGB: n.memory.gb,
      drives: n.localDisks.length ? n.localDisks.map(diskText).join(' + ') : 'No local disks recorded',
      driveTB: n.localDisks.reduce((t, d) => t + (d.sizeGB || 0) * d.count, 0) / 1000,
      ilo: n.oob.ip, oobName: n.oob.type
    };
    // Patch leads: the out-of-band port, then up to two NICs (two assumed when the record lists none)
    const nics = n.nics.length ? n.nics.slice(0, 2) : [{}, {}];
    sv.links = [{ k: 0, port: portNo(n.oob.port, s + 1) }, ...nics.map((nic, j) => ({ k: j + 1, port: portNo(nic.port, s + 1) }))];
    allServers.push(sv);
    return sv;
  });
}
for (const sv of allServers) {
  if (!faceMesh.has(sv.face.key)) faceMesh.set(sv.face.key, []);
  faceMesh.get(sv.face.key).push(sv);
}
const leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.016, 0.016, 0.008), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), Math.max(1, allServers.length * 2));
export { leds };
for (const list of faceMesh.values()) {
  const spec = list[0].face, n = list.length, mats = faceMats(spec);
  // The svIdx attribute carries each instance's server index (for the thermal camera); userData.servers maps an instance to its server (for picking)
  const geo = new THREE.BoxGeometry(0.52, plateH(spec.h), PLATE_D), front = faceGeo(spec);
  const svIdx = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  geo.setAttribute('svIdx', svIdx); front.setAttribute('svIdx', svIdx);
  const fm = new THREE.InstancedMesh(front, mats.front, n), rm = new THREE.InstancedMesh(geo, mats.rear, n);
  fm.userData = { servers: list, face: 'front' }; rm.userData = { servers: list, face: 'rear' };
  plateMeshes.push(fm); rearMeshes.push(rm);
  list.forEach((sv, j) => {
    const r = sv.r;
    sv.slot = { fm, rm, j };
    mount(fm, j, r, 1, sv.y, 0.007); sv.slot.mf = m4.clone();
    mount(rm, j, r, -1, sv.y, 0.007); sv.slot.mr = m4.clone();
    svIdx.array[j] = sv.idx;
    // slight finish variation so no two chassis read as copies
    tint.setScalar(0.86 + rnd() * 0.14); fm.setColorAt(j, tint); rm.setColorAt(j, tint);
  });
}
for (const sv of allServers) for (let k = 0; k < 2; k++) {
  const r = sv.r, li = sv.idx * 2 + k;
  m4.makeTranslation(r.x + r.face * sv.face.led.x, sv.y + sv.face.led.y[k], r.z + r.face * LED_Z);
  leds.setMatrixAt(li, m4); ledM[li] = m4.clone(); leds.setColorAt(li, LED.off);
  r.leds.push({ i: li, k, sv, on: rnd() < 0.5 });
}
if (!allServers.length) leds.count = 0;
scene.add(...plateMeshes, ...rearMeshes, leds);
export const byHost = new Map(allServers.map(sv => [sv.host.toLowerCase(), sv]));

// ---------- Rear cabling (cabling.js) ----------
// Close up, each cabinet's own fine mesh (rebuilt without a server's leads while it is pulled out); from further away
// one coarse mesh for the whole hall
const cableObj = new THREE.Object3D();
function cableFrame(r) {
  cableObj.position.set(r.x, 0, r.z - r.face * FRONT); cableObj.rotation.set(0, r.face > 0 ? Math.PI : 0, 0); cableObj.updateMatrix();
  return cableObj.matrix.clone();
}
const fineCables = [];
for (const r of racks) {
  if (!r.servers.length) continue;
  r.cables = new THREE.Mesh(rackCables(r.servers, 'fine'), cableMat);
  r.cables.matrixAutoUpdate = false; r.cables.matrix.copy(cableFrame(r)); r.cables.visible = false;
  fineCables.push(r.cables);
}
const coarseCables = new THREE.Mesh(mergeGeos(racks.filter(r => r.servers.length).map(r => ({ geo: rackCables(r.servers, 'coarse'), matrix: cableFrame(r) }))), cableMat);
scene.add(coarseCables, ...fineCables);
// Fine cabling while the camera is within 7 m of any cabinet (rack view, a pulled-out server, down an aisle), coarse
// for the hall overview
const rackC = new THREE.Vector3();
let fineOn = false;
export function updateCabling(cam) {
  let d = Infinity;
  for (const r of racks) d = Math.min(d, rackC.set(r.x, RACK_H / 2, r.z).distanceToSquared(cam));
  const fine = d < 49;
  if (fine === fineOn) return;
  fineOn = fine; coarseCables.visible = !fine;
  for (const m of fineCables) m.visible = fine;
}

// Hide or restore a server's plates, LEDs and patch leads while it is pulled out
export function setInstance(sv, show) {
  const { fm, rm, j, mf, mr } = sv.slot, r = sv.r;
  fm.setMatrixAt(j, show ? mf : ZERO); rm.setMatrixAt(j, show ? mr : ZERO);
  for (let k = 0; k < 2; k++) leds.setMatrixAt(sv.idx * 2 + k, show ? ledM[sv.idx * 2 + k] : ZERO);
  fm.instanceMatrix.needsUpdate = true; rm.instanceMatrix.needsUpdate = true; leds.instanceMatrix.needsUpdate = true;
  r.cables.geometry.dispose(); r.cables.geometry = rackCables(r.servers, 'fine', show ? null : sv);
}

// ---------- Switches, OOB switch, patch panel, blanking panels (front blanks cover every free U up to U40; U39–40 are rear-mounted) ----------
const swFans = new THREE.InstancedMesh(dev1U, plateMat(512, 44, drawSwFans, { glow: true }), racks.length * 2);
const swPorts = new THREE.InstancedMesh(dev1U, plateMat(512, 44, drawSwPorts, { glow: true }), racks.length * 2);
const patch = new THREE.InstancedMesh(dev1U, plateMat(512, 44, drawPatch), racks.length);
const oob = new THREE.InstancedMesh(dev1U, swPorts.material, racks.length);
const blankMat = plateMat(512, 44, drawBlank, { metalness: 0.5, roughness: 0.75 });
blankMat.color.setScalar(0.8);
// The highest U a server takes in a rack (0 when it is empty), and the U from 1 to 40 with nothing in them
export const topU = r => r.servers.reduce((t, sv) => Math.max(t, sv.u + sv.h - 1), 0);
const freeU = r => { const used = new Set(r.servers.flatMap(sv => Array.from({ length: sv.h }, (_, k) => sv.u + k))); return Array.from({ length: 40 }, (_, k) => k + 1).filter(u => !used.has(u)); };
export const freeCount = r => freeU(r).filter(u => u <= MAX_U).length;
const blanks = new THREE.InstancedMesh(dev1U, blankMat, Math.max(1, racks.reduce((n, r) => n + freeU(r).length, 0)));
let nb = 0;
racks.forEach((r, i) => {
  [41, 42].forEach((u, k) => { mount(swFans, i * 2 + k, r, 1, uY(u, 1), 0.007); mount(swPorts, i * 2 + k, r, -1, uY(u, 1), 0.007); });
  mount(patch, i, r, -1, uY(40, 1), 0.007);
  mount(oob, i, r, -1, uY(39, 1), 0.007);
  for (const u of freeU(r)) mount(blanks, nb++, r, 1, uY(u, 1), 0.006);
});
blanks.count = nb;
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
