// Per-frame visual updates driven by the telemetry: rack tint and light columns, LEDs, particles, cooling-unit fans.
import { THREE, lc, COL, clamp, grad } from './core.js';
import { W, G, UI } from './state.js';
import { racks, leds, LED, swLeds } from './racks.js';
import { perfMats, uplinkStripMat, coolers, tapLeds } from './hall.js';
import { updateParticles } from './particles.js';

const tmp = new THREE.Color(), coldC = lc(COL.cold), TAP_ON = lc('#46ff9a').multiplyScalar(2), TAP_WARN = LED.warn;
export function updateVisuals(dt) {
  const blink = (W.t * 2.5) % 1 < 0.5;
  racks.forEach((r, i) => {
    grad(W.mode, W.mode === 'load' ? r.load : r.inlet, tmp);
    const ei = r === UI.hovered ? 0.2 : (r === UI.selected ? 0.12 : 0.045);
    for (const m of r.mats) { m.emissive.copy(tmp); m.emissiveIntensity = ei; }
    r.colMesh.material.color.copy(tmp);
    const h = W.mode === 'load' ? r.load : clamp((r.inlet - 16) / 18, 0, 1);
    r.colMesh.scale.y = Math.max(0.02, h * 0.9);
    for (const L of r.leds) {
      if (L.k === 0) {
        if (Math.random() < dt * (1.5 + L.sv.load * 22)) L.on = !L.on;
        leds.setColorAt(L.i, L.on ? LED.act : LED.off);
      } else {
        const st = L.sv.status;
        leds.setColorAt(L.i, st === 2 ? (blink ? LED.crit : LED.dark) : st === 1 ? LED.warn : LED.idle);
      }
    }
    // Busway tap-off: green, amber when the rack draws over 10 kW
    tapLeds.setColorAt(i, r.power > 10 ? TAP_WARN : TAP_ON);
    for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) swLeds.setColorAt(i * 4 + k * 2 + j, r.torDown[k] ? (blink ? LED.crit : LED.dark) : LED.act);
  });
  leds.instanceColor.needsUpdate = true; tapLeds.instanceColor.needsUpdate = true; swLeds.instanceColor.needsUpdate = true;

  updateParticles(dt, perfMats);

  uplinkStripMat.color.copy(coldC).multiplyScalar(0.35 + 0.9 * clamp(G.net / 3200, 0, 1) * (0.85 + 0.15 * Math.sin(W.t * 9)));
  coolers[0].fans.forEach(f => f.rotation.y += dt * 7 * (1 + W.faultLevel * 0.4));
  coolers[1].fans.forEach(f => f.rotation.y += dt * 7 * (1 - W.faultLevel));
  if (W.fault) coolers[1].stripMat.color.copy(blink ? LED.crit : LED.dark);
  else coolers[1].stripMat.color.copy(coldC);
}
