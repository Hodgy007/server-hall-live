// Camera flights (hall overview, rack, open server) and the orbit toggle.
import { THREE, $, camera, controls, reduceMotion, ease, HALL_VIEW } from './core.js';
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

export const flyHall = () => flyTo(HALL_VIEW.pos, HALL_VIEW.target, 1.4);

// Stand in the cold aisle (it is 1.4 m wide), just off-centre in front of the rack, clear of its open door
const p3 = new THREE.Vector3(), t3 = new THREE.Vector3();
export function flyRack(r) {
  t3.set(r.x - 0.05, 1.0, r.z + r.face * 0.5);
  p3.set(r.x + 0.45, 1.5, r.z + r.face * 1.78);
  flyTo(p3, t3, 1.2);
}
// Look down into the open chassis from the aisle in front of it
export function flyServer(sv) {
  const r = sv.r;
  slotPos(sv, 1, t3); t3.z -= r.face * 0.06;
  p3.set(t3.x + 0.3, t3.y + 1.0, t3.z + r.face * 1.0);
  flyTo(p3, t3, 1.3);
}
