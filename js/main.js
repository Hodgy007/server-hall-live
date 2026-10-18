// Entry point: wires the scene, simulation, HUD and interaction together and runs the frame loop.
import { THREE, $, canvas, renderer, scene, camera, controls, clamp, SERVERS, COLS, ROOM, cutPlane, esc } from './core.js';
import { W, UI, SV } from './state.js';
import { racks, byId, byHost, cabinets, plates, rears, selBox, setDoor, doorOpen, updateDoors } from './racks.js';
import './hall.js';
import { updateLights, bakedLighting } from './lights.js';
import { setThermal, updateThermal } from './thermal.js';
import { heat, cold } from './particles.js';
import { SRV, srvMeshes, air, shim, mountServer, updateServerModel } from './server.js';
import { step } from './sim.js';
import { updateVisuals } from './visuals.js';
import { flyHall, flyRack, flyServer, updateCam, setOrbit, releaseCut } from './camera.js';
import { hooks, updateHud, updateSparks, drawCores, renderLegend } from './hud.js';
import { pushAlert } from './alerts.js';
import { replay, recorded, swapIn, swapOut } from './replay.js';
import { live, fresh } from './live.js';
import { render, resizePost } from './post.js';

// ---------- Selection, doors, pulling servers out ----------
function select(r, openDoor = true) {
  if (UI.selected && UI.selected !== r) setDoor(UI.selected, false);
  UI.selected = r; selBox.position.copy(r.mesh.position);
  if (openDoor) setDoor(r, true);
  updateHud(); updateSparks();
}
function openServer(sv) {
  if (SV.sel === sv && SV.open) return;
  select(sv.r);                 // opens the door; the server waits for it before sliding
  mountServer(sv);
  setOrbit(false);              // inspecting a server stops the orbit until Start rotation is pressed
  $('rackPanel').hidden = true; $('srvPanel').hidden = false;
  flyServer(sv);
  setLink('host', sv.host);
  updateHud(); updateSparks();
}
// Slide the server back in like a drawer; the camera stays put
function closeServer() {
  if (!SV.open) return;
  SV.open = false;
  controls.autoRotate = UI.orbitOn;
  $('rackPanel').hidden = false; $('srvPanel').hidden = true;
  setLink(UI.cutRack && 'rack', UI.cutRack && UI.cutRack.id);
  updateHud(); updateSparks();
}
function focusRack(r) {
  closeServer(); select(r); setOrbit(false); flyRack(r);
  setLink('rack', r.id);
}
function hallView() {
  closeServer();
  if (UI.selected) setDoor(UI.selected, false);
  flyHall();
  setLink();
}
hooks.open = openServer;

// ---------- Deep links: #rack=B03 opens rack view, #host=db-e04-07 pulls that server out ----------
// The address follows what you are looking at (without adding history entries), so it can be copied and shared
function setLink(kind, id) {
  history.replaceState(null, '', kind ? `#${kind}=${encodeURIComponent(id)}` : location.pathname + location.search);
}
function followLink() {
  const m = /^#(rack|host)=(.+)$/.exec(location.hash); if (!m) return;
  const id = decodeURIComponent(m[2]);
  if (m[1] === 'host') { const sv = byHost.get(id) || byHost.get(id.toLowerCase()); if (sv) openServer(sv); }
  else { const r = byId[id.toUpperCase()]; if (r) focusRack(r); }
}
window.addEventListener('hashchange', followLink);

// ---------- Picking ----------
const pickables = [plates, rears, ...cabinets];
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tip = $('tip');
let downAt = null;
function pick(e) {
  const rect = canvas.getBoundingClientRect();
  ndc.set((e.clientX - rect.left) / rect.width * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const targets = SV.open && SRV.visible ? srvMeshes.concat(pickables) : pickables;
  for (const h of ray.intersectObjects(targets, false)) {
    if (cutPlane.distanceToPoint(h.point) < 0) continue;   // clipped away in rack view
    if (h.object.userData.srv) return { rack: SV.sel.r, sv: null, close: true };
    if (h.object === plates || h.object === rears) {
      const r = racks[(h.instanceId / SERVERS) | 0], sv = r.servers[h.instanceId % SERVERS];
      if (sv === SV.sel) continue;
      // The first click on a rack shows its front (and opens the door); once there, a click pulls a server out
      const ready = UI.cutRack === r && h.object === plates && (doorOpen(r) || (SV.open && SV.sel.r === r));
      return { rack: r, sv, focus: !ready };
    }
    return { rack: h.object.userData.rack, sv: null };
  }
  return null;
}
canvas.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') return;
  const hit = pick(e);
  UI.hovered = hit ? hit.rack : null;
  canvas.style.cursor = hit && (hit.sv || hit.close || !SV.open) ? 'pointer' : 'grab';
  if (hit) {
    tip.hidden = false;
    const sv = hit.sv, r = UI.hovered;
    tip.innerHTML = hit.close ? `<b>${esc(SV.sel.host)}</b>click to push back in`
      : sv && !hit.focus ? `<b>${esc(sv.host)}</b>U${sv.u} · CPU ${Math.round(sv.load * 100)}% · click to pull out`
      : `<b>${r.id}</b>CPU ${Math.round(r.load * 100)}% · inlet ${r.inlet.toFixed(1)} °C · ${r.power.toFixed(1)} of 12 kW` + (UI.cutRack === r ? '' : ' · click to view the front');
    const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
    tip.style.left = x + 'px'; tip.style.top = (e.clientY + 16) + 'px';
  } else tip.hidden = true;
});
canvas.addEventListener('pointerleave', () => { UI.hovered = null; tip.hidden = true; });
canvas.addEventListener('pointerdown', e => { downAt = e.button === 0 ? [e.clientX, e.clientY] : null; });   // right-drag pans, it never picks
canvas.addEventListener('pointerup', e => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]); downAt = null;
  if (moved >= 6) return;
  const hit = pick(e);
  if (!hit) return;
  if (hit.close) closeServer();
  else if (hit.sv && !hit.focus) openServer(hit.sv);
  else if (UI.cutRack !== hit.rack || !doorOpen(hit.rack)) focusRack(hit.rack);
});

// ---------- Panel buttons and controls ----------
$('sBack').addEventListener('click', closeServer);
$('sNext').addEventListener('click', () => { const sv = SV.sel; if (sv) openServer(sv.r.servers[(sv.s + 1) % SERVERS]); });
$('sStress').addEventListener('click', () => {
  const sv = SV.sel; if (!sv) return;
  if (sv.stressLeft > 0) { sv.stressLeft = 0; pushAlert('info', `${sv.host} stress test stopped`); }
  else { sv.stressLeft = 20; pushAlert('info', `${sv.host} stress test started: all 64 cores for 20 s`); }
  updateHud();
});
// In rack view the arrows walk the camera from rack to rack; otherwise they just change the selection
const stepRack = d => { const r = racks[(racks.indexOf(UI.selected) + d + racks.length) % racks.length]; if (UI.cutRack) focusRack(r); else select(r); };
$('prevRack').addEventListener('click', () => stepRack(-1));
$('nextRack').addEventListener('click', () => stepRack(1));
// Phones: the rack panel can be folded down to its header
function setRackMin(min) {
  const b = $('rackMin');
  $('rackPanel').classList.toggle('min', min);
  b.setAttribute('aria-expanded', String(!min));
  b.setAttribute('aria-label', min ? 'Show rack details' : 'Hide rack details');
  b.textContent = min ? '▴' : '▾';
  if (!min) updateSparks();
}
$('rackMin').addEventListener('click', () => setRackMin(!$('rackPanel').classList.contains('min')));
document.querySelectorAll('input[name="mode"]').forEach(el => el.addEventListener('change', e => { W.mode = e.target.value; renderLegend(); }));
$('orbit').addEventListener('click', () => setOrbit(!UI.orbitOn));
setOrbit(controls.autoRotate);
// Airflow: hot-aisle exhaust, cold-aisle supply, and the air and heat inside a pulled-out server
$('airflow').addEventListener('click', () => {
  UI.airOn = !UI.airOn;
  [heat, cold, air, shim].forEach(p => { p.pts.visible = UI.airOn; });
  $('airflow').textContent = UI.airOn ? 'Hide airflow' : 'Show airflow'; $('airflow').classList.toggle('off', !UI.airOn);
});
// Thermal camera: swaps the hall to a false-colour infrared view; the colour mode does not apply while it is on
$('thermal').addEventListener('click', () => {
  UI.thermal = !UI.thermal; setThermal(UI.thermal);
  const b = $('thermal'); b.classList.toggle('off', !UI.thermal); b.setAttribute('aria-pressed', String(UI.thermal));
  $('modeSet').disabled = UI.thermal;
  renderLegend();
});
$('hallView').addEventListener('click', hallView);

// ---------- Replay: the slider runs from 10 minutes ago (left) to live (right) ----------
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
function syncReplay() {
  const el = $('replay'), have = Math.max(0, recorded() - 1);
  el.min = String(-Math.floor(have / 5) * 5);
  const ago = replay.ago;
  $('replayVal').textContent = ago ? `${mmss(ago)} ago` : 'Live';
  const feed = live.enabled && fresh(live) ? `Live data · ${live.servers} of ${racks.length * SERVERS} servers` : 'Simulated telemetry';
  $('liveChip').textContent = ago ? `Replay · ${mmss(ago)} ago` : feed;
  $('liveChip').classList.toggle('past', !!ago);
  $('replayLive').hidden = !ago;
}
$('replay').addEventListener('input', e => { replay.ago = -Number(e.target.value); syncReplay(); updateHud(); });
$('replayLive').addEventListener('click', () => { replay.ago = 0; $('replay').value = '0'; syncReplay(); updateHud(); });

// ---------- Find a host or rack ----------
{
  const dl = $('hosts');
  for (const r of racks) {
    const o = document.createElement('option'); o.value = r.id; dl.append(o);
    for (const sv of r.servers) { const h = document.createElement('option'); h.value = sv.host; dl.append(h); }
  }
}
function find(q, exactOnly) {
  q = q.trim().toLowerCase(); if (!q) return false;
  const msg = $('findMsg');
  const sv = byHost.get(q), r = byId[q.toUpperCase()];
  if (sv) { openServer(sv); msg.textContent = ''; return true; }
  if (r) { focusRack(r); msg.textContent = ''; return true; }
  if (exactOnly) return false;
  const part = [...byHost.values()].find(s => s.host.includes(q));
  if (part) { openServer(part); $('find').value = part.host; msg.textContent = ''; return true; }
  msg.textContent = `No host or rack matches “${q}”`;
  return false;
}
$('findForm').addEventListener('submit', e => { e.preventDefault(); if (find($('find').value)) $('find').blur(); });
$('find').addEventListener('input', e => { $('findMsg').textContent = ''; if (e.inputType === 'insertReplacementText' || !e.inputType) find(e.target.value, true); });
document.addEventListener('keydown', e => {
  const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
  // Esc: leave the search box, push a server back in, or (with nothing open) reset the view
  if (e.key === 'Escape') { if (typing) document.activeElement.blur(); else if (SV.open) closeServer(); else hallView(); }
  else if (e.key === '/' && !typing) { e.preventDefault(); $('find').focus(); }
  // Rack view: walk along the row; screen-right is +x for front-facing rows and −x for the others
  else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !typing && UI.cutRack && !/BUTTON/.test(document.activeElement.tagName)) {
    const r = UI.cutRack, c = r.c + (e.key === 'ArrowRight' ? 1 : -1) * r.face;
    if (c >= 0 && c < COLS) { e.preventDefault(); focusRack(byId[r.row.id + String(c + 1).padStart(2, '0')]); }
  }
  else if (!typing && MOVE[e.key.toLowerCase()] && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.key.startsWith('Arrow') && /BUTTON/.test(document.activeElement.tagName))) {
    e.preventDefault(); held.add(e.key.toLowerCase());
  }
});
document.addEventListener('keyup', e => held.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => held.clear());

// ---------- Moving around: WASD (or the arrow keys, outside rack view) slide the view across the floor ----------
const MOVE = { w: [0, 1], s: [0, -1], a: [-1, 0], d: [1, 0], arrowup: [0, 1], arrowdown: [0, -1], arrowleft: [-1, 0], arrowright: [1, 0] };
const held = new Set(), fwd = new THREE.Vector3(), side = new THREE.Vector3(), move = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function moveView(dt) {
  if (!held.size || !controls.enabled) return;
  let mx = 0, mz = 0;
  for (const k of held) { mx += MOVE[k][0]; mz += MOVE[k][1]; }
  fwd.subVectors(controls.target, camera.position).setY(0);
  if ((!mx && !mz) || fwd.lengthSq() < 1e-6) return;
  if (UI.orbitOn) setOrbit(false);
  fwd.normalize(); side.crossVectors(fwd, UP);
  // faster from far away, slow enough to walk an aisle up close
  const speed = clamp(camera.position.distanceTo(controls.target) * 0.6, 1.2, 8) * dt;
  move.copy(side).multiplyScalar(mx).addScaledVector(fwd, mz).setLength(speed);
  camera.position.add(move); controls.target.add(move);
}
// Keep what you are looking at inside the hall, however you got there
function keepInHall() {
  const t = controls.target, x = clamp(t.x, -ROOM.x, ROOM.x), z = clamp(t.z, -ROOM.z, ROOM.z);
  if (x === t.x && z === t.z) return;
  camera.position.x += x - t.x; camera.position.z += z - t.z; t.x = x; t.z = z;
}

// ---------- Layout ----------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); resizePost(w, h);
  camera.aspect = w / h; camera.fov = w / h < 1 ? 64 : 42; camera.updateProjectionMatrix();
  updateSparks();
}
window.addEventListener('resize', resize);
if (window.innerWidth <= 720) { $('opsBox').open = false; setRackMin(true); }

// Keep reflections subtle (just enough for steel to read as steel); let the rack-view cut clip everything but the room shell
scene.traverse(o => {
  const ms = Array.isArray(o.material) ? o.material : [o.material];
  for (const m of ms) {
    if (!m) continue;
    if (m.isMeshStandardMaterial && !m.userData.baked) {
      m.envMapIntensity = m.userData.envMapIntensity ?? (m.metalness > 0.6 ? 0.22 : 0.12);
      bakedLighting(m); m.userData.baked = true;
    }
    if (!m.userData.noClip) { m.clippingPlanes = [cutPlane]; m.clipShadows = true; }
  }
});

// ---------- Boot: pre-run two minutes of telemetry so trends are populated ----------
for (let i = 0; i < 480; i++) step(0.25);
W.warm = false;
pushAlert('info', `Telemetry stream connected · ${racks.length} racks reporting`);
renderLegend();
UI.selected = byId.A03;
resize();
select(UI.selected, false);
syncReplay();
followLink();

let last = performance.now(), hudAcc = 0;
function frame(now) {
  // a frame's timestamp can precede the previous performance.now() (slow first frames), so never step backwards
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  step(dt);
  const past = swapIn();          // replaying: draw (and show in the panels) the recorded state, then restore the live one
  updateVisuals(dt);
  updateThermal(dt);
  updateDoors(dt);
  updateServerModel(dt);
  updateCam(dt);
  moveView(dt);
  controls.update();
  keepInHall();
  updateLights(dt);
  if (releaseCut() && !SV.open && UI.selected) { setDoor(UI.selected, false); setLink(); }
  render();
  if (SV.open) drawCores();
  hudAcc += dt;
  if (hudAcc > 0.2) { hudAcc = 0; updateHud(); }
  if (W.sampled) { W.sampled = false; updateSparks(); syncReplay(); }
  if (past) swapOut();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
