// Per-frame visual updates driven by the telemetry: rack tint and light columns, LEDs, particles.
import { THREE, lc, COL, clamp, grad, modeValue, modeHeight } from './core.js';
import { W, G, UI } from './state.js';
import { racks, leds, LED, swLeds, setColumnMix } from './racks.js';
import { perfMats, uplinkStripMat, tapLeds } from './hall.js';
import { updateParticles } from './particles.js';
import { INV } from './mode.js';
import { CB, rackLook, syncMarks } from './rackcolor.js';
import { MAX_U } from './site.js';

let staticKey = '', mixKey = '';

const tmp = new THREE.Color(), coldC = lc(COL.cold), okC = lc(COL.ok), offC = lc('#1c2630'), TAP_ON = lc('#46ff9a').multiplyScalar(2), TAP_WARN = LED.warn;
export function updateVisuals(dt) {
  const blink = (W.t * 2.5) % 1 < 0.5, fit = UI.fit;
  syncMarks();
  const marked = CB.svHits && UI.cutRack;
  // Inventory mode: the LEDs and busway lights are steady (nothing simulated drives them); only the rack filter's marks change them
  const key = INV ? CB.rev + '|' + (marked ? UI.cutRack.id : '') : '', redo = !INV || key !== staticKey;
  staticKey = key;
  // Inventory mode: a rack of mixed servers has its column stacked by what it holds (rackcolor.js). The capacity
  // finder's colours, and racks the filter leaves dark, go back to one column.
  const mk = INV ? CB.rev + '|' + (fit ? 'fit' : '') : '';
  if (mk !== mixKey) {
    mixKey = mk;
    for (const r of racks) { const L = rackLook(r), on = INV && !fit && (!CB.hits || CB.hits.has(r)); setColumnMix(r, on ? L.segs : null, L.h); }
  }
  racks.forEach((r, i) => {
    // The capacity finder takes over the colours: racks that fit in blue (the best in green), their columns as tall as
    // the room left; the rest dark. Then the rack filter: matching racks keep their colour, the rest go dark.
    const hit = fit && fit.racks.get(r), fh = !fit && CB.hits && CB.hits.get(r);
    let h;
    if (fit) { tmp.copy(!hit ? offC : r === fit.best ? okC : coldC); h = hit ? hit.frac : 0; }
    else if (CB.hits) {
      if (fh) { if (INV) tmp.copy(rackLook(r).col); else grad(W.mode, modeValue(W.mode, r), tmp); h = Math.min(1, 0.15 + fh.u / MAX_U); } else { tmp.copy(offC); h = 0; }   // (in inventory mode rackLook has that height too)
    } else if (INV) { const L = rackLook(r); tmp.copy(L.col); h = L.h; }
    else { grad(W.mode, modeValue(W.mode, r), tmp); h = modeHeight(W.mode, r); }
    const ei = r === UI.hovered ? 0.2 : (r === UI.selected ? 0.12 : hit || fh ? 0.1 : 0.045);
    for (const m of r.mats) { m.emissive.copy(tmp); m.emissiveIntensity = ei; }
    r.colMesh.material.color.copy(tmp);
    r.colMesh.scale.y = Math.max(0.02, h * 0.9);
    if (!redo) return;
    for (const L of r.leds) {
      if (INV) {
        const on = marked && r === UI.cutRack;
        leds.setColorAt(L.i, on ? (CB.svHits.has(L.sv) ? LED.act : LED.off) : LED.idle);
      } else if (L.k === 0) {
        if (Math.random() < dt * (1.5 + L.sv.load * 22)) L.on = !L.on;
        leds.setColorAt(L.i, marked && r === UI.cutRack && !CB.svHits.has(L.sv) ? LED.off : L.on ? LED.act : LED.off);
      } else {
        const st = L.sv.status;
        leds.setColorAt(L.i, st === 2 ? (blink ? LED.crit : LED.dark) : st === 1 ? LED.warn : LED.idle);
      }
    }
    // Busway tap-off: green, amber when the rack draws over 10 kW
    tapLeds.setColorAt(i, !INV && r.power > 10 ? TAP_WARN : TAP_ON);
    for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) swLeds.setColorAt(i * 4 + k * 2 + j, !INV && r.torDown[k] ? (blink ? LED.crit : LED.dark) : INV ? LED.idle : LED.act);
  });
  if (redo) { leds.instanceColor.needsUpdate = true; tapLeds.instanceColor.needsUpdate = true; swLeds.instanceColor.needsUpdate = true; }

  if (INV) { uplinkStripMat.color.copy(coldC).multiplyScalar(0.5); return; }
  updateParticles(dt, perfMats);

  uplinkStripMat.color.copy(coldC).multiplyScalar(0.35 + 0.9 * clamp(G.net / 3200, 0, 1) * (0.85 + 0.15 * Math.sin(W.t * 9)));
}
