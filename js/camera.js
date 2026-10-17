// Camera flights (hall overview, rack, open server) and the orbit toggle.
import { THREE, $, camera, controls, reduceMotion, ease, HALL_VIEW, cutPlane, FRONT } from './core.js';
import { UI, SV } from './state.js';
import { slotPos } from './server.js';

const CAM = { active: false, t: 0, dur: 1, fromP: new THREE.Vector3(), toP: new THREE.Vector3(), fromT: new THREE.Vector3(), toT: new THREE.Vector3() };
export function flyTo(p, t, dur) {
  CAM.fromP.copy(camera.position); CAM.fromT.copy(controls.target); CAM.toP.copy(p); CAM.toT.copy(t);
  CAM.t = 0; CAM.dur = reduceMotion ? 0.01 : dur; CAM.active = true; controls.enabled = false;
}
export function updateCam(dt) {
  if (!CAM.active) return;
  CAM.t += dt;
  const u = ease(Math.min(1, CAM.t / CAM.dur));
  camera.position.lerpVectors(CAM.fromP, CAM.toP, u); controls.target.lerpVectors(CAM.fromT, CAM.toT, u);
  if (CAM.t >= CAM.dur) { CAM.active = false; controls.enabled = true; }
}

export function setOrbit(on) {
  UI.orbitOn = on; controls.autoRotate = on && !SV.open;
  $('orbit').textContent = on ? 'Stop rotation' : 'Start rotation'; $('orbit').classList.toggle('off', !on);
}

export const flyHall = () => { setCut(null); flyTo(HALL_VIEW.pos, HALL_VIEW.target, 1.4); };

// Rack view: the cold aisle is only 1.4 m wide, too close to see a whole 42U rack, so the camera stands
// 2.9 m back (beyond the opposite row) and everything between it and the rack is clipped away.
const CUT_GAP = 0.75;   // the cut sits this far in front of the rack, clear of its open door
const n3 = new THREE.Vector3();
export function setCut(r) {
  UI.cutRack = r || null;
  if (!r) { cutPlane.set(n3.set(0, 0, 1), 1e6); return; }
  // keep the side of the plane that holds the rack: face·(z0 − z) ≥ 0
  const z0 = r.z + r.face * (FRONT + CUT_GAP);
  cutPlane.set(n3.set(0, 0, -r.face), r.face * z0);
}
const p3 = new THREE.Vector3(), t3 = new THREE.Vector3();
export function flyRack(r) {
  setCut(r);
  t3.set(r.x, 1.02, r.z + r.face * FRONT);
  p3.set(r.x + 0.3, 1.2, r.z + r.face * (FRONT + 2.9));
  flyTo(p3, t3, 1.2);
}
// Look down into the open chassis from the aisle in front of it
export function flyServer(sv) {
  const r = sv.r;
  setCut(r);
  slotPos(sv, 1, t3); t3.z -= r.face * 0.06;
  p3.set(t3.x + 0.3, t3.y + 1.0, t3.z + r.face * 1.0);
  flyTo(p3, t3, 1.3);
}
