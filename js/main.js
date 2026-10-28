// Entry point: wires the scene, simulation, HUD and interaction together and runs the frame loop.
import { THREE, $, canvas, renderer, scene, camera, controls, clamp, ROOM, cutPlane, esc, GFX } from './core.js';
import { W, UI, SV } from './state.js';
import { racks, byId, byHost, allServers, cabinets, plateMeshes, rearMeshes, selBox, setDoor, doorOpen, updateDoors, updateCabling } from './racks.js';
import './hall.js';
import { updateLights, prepare } from './lights.js';
import { setThermal, updateThermal } from './thermal.js';
import { heat, cold } from './particles.js';
import { SRV, srvMeshes, air, shim, mountServer, updateServerModel } from './server.js';
import { step } from './sim.js';
import { updateVisuals } from './visuals.js';
import { flyHall, flyRack, flyServer, updateCam, setOrbit, releaseCut } from './camera.js';
import { hooks, updateHud, updateSparks, drawCores, renderLegend } from './hud.js';
import { live, fresh } from './live.js';
import { render, resizePost } from './post.js';
import { SITE, HALL, SITE_HOSTS } from './data.js';
import { goHall } from './sitebar.js';
import { initAttention } from './attention.js';
import { initCapacity } from './capacity.js';

// ---------- Selection, doors, pulling servers out ----------
function select(r, openDoor = true) {
  if (UI.selected && UI.selected !== r) setDoor(UI.selected, false);
  UI.selected = r; selBox.position.copy(r.mesh.position);
  if (openDoor) setDoor(r, true);
  updateHud(); updateSparks();
}
// On a phone the details panel starts folded so the server can be seen sliding out; Next server keeps it as it is
const phone = matchMedia('(max-width: 720px)');
function openServer(sv, fold = true) {
  if (SV.sel === sv && SV.open) return;
  select(sv.r);                 // opens the door; the server waits for it before sliding
  mountServer(sv);
  setOrbit(false);              // inspecting a server stops the orbit until Start rotation is pressed
  if (fold && phone.matches) setSrvMin(true);
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
const updateAttention = initAttention({ openServer, focusRack });
const clearFit = initCapacity({ focusRack, onChange: () => renderLegend() });

// ---------- Deep links: #rack=B03 opens rack view, #host=db-e04-07 pulls that server out ----------
// The address follows what you are looking at (without adding history entries), so it can be copied and shared
function setLink(kind, id) {
  history.replaceState(null, '', kind ? `#${kind}=${encodeURIComponent(id)}` : location.pathname + location.search);
}
function followLink() {
  const m = /^#(rack|host)=(.+)$/.exec(location.hash); if (!m) return;
  const id = decodeURIComponent(m[2]);
  // a host or rack in another hall switches to that hall
  if (m[1] === 'host') {
    const sv = byHost.get(id.toLowerCase()), other = SITE_HOSTS.get(id.toLowerCase());
    if (sv) openServer(sv); else if (other && other !== HALL.id) goHall(other, `host=${encodeURIComponent(id)}`);
  } else {
    const r = byId[id.toUpperCase()], other = SITE.halls.find(h => h !== HALL && h.grid.racks.some(x => x.id === id.toUpperCase()));
    if (r) focusRack(r); else if (other) goHall(other.id, `rack=${encodeURIComponent(id.toUpperCase())}`);
  }
}
window.addEventListener('hashchange', followLink);

// ---------- Picking ----------
const pickables = [...plateMeshes, ...rearMeshes, ...cabinets];
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
    const servers = h.object.userData.servers;
    if (servers) {
      const sv = servers[h.instanceId], r = sv.r;
      if (sv === SV.sel) continue;
      // The first click on a rack shows its front (and opens the door); once there, a click pulls a server out
      const ready = UI.cutRack === r && h.object.userData.face === 'front' && (doorOpen(r) || (SV.open && SV.sel.r === r));
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
$('sNext').addEventListener('click', () => { const sv = SV.sel; if (sv) openServer(sv.r.servers[(sv.s + 1) % sv.r.servers.length], false); });
$('sStress').addEventListener('click', () => {
  const sv = SV.sel; if (!sv) return;
  sv.stressLeft = sv.stressLeft > 0 ? 0 : 20;
  updateHud();
});
// In rack view the arrows walk the camera from rack to rack; otherwise they just change the selection
const stepRack = d => { const r = racks[(racks.indexOf(UI.selected) + d + racks.length) % racks.length]; if (UI.cutRack) focusRack(r); else select(r); };
$('prevRack').addEventListener('click', () => stepRack(-1));
$('nextRack').addEventListener('click', () => stepRack(1));
// Phones: the rack and server panels can be folded down to their headers
function setMin(panel, btn, what, min) {
  $(panel).classList.toggle('min', min);
  const b = $(btn);
  b.setAttribute('aria-expanded', String(!min));
  b.setAttribute('aria-label', `${min ? 'Show' : 'Hide'} ${what} details`);
  b.textContent = min ? '▴' : '▾';
  if (!min) updateSparks();
}
const setRackMin = min => setMin('rackPanel', 'rackMin', 'rack', min);
const setSrvMin = min => setMin('srvPanel', 'srvMin', 'server', min);
$('rackMin').addEventListener('click', () => setRackMin(!$('rackPanel').classList.contains('min')));
$('srvMin').addEventListener('click', () => setSrvMin(!$('srvPanel').classList.contains('min')));
// Picking a colour mode puts the racks back to it from the capacity finder's colours
document.querySelectorAll('input[name="mode"]').forEach(el => el.addEventListener('change', e => { W.mode = e.target.value; if (UI.fit) clearFit(); else renderLegend(); }));
$('orbit').addEventListener('click', () => setOrbit(!UI.orbitOn));
setOrbit(controls.autoRotate);
// Airflow: hot-aisle exhaust, cold-aisle supply, and the air and heat inside a pulled-out server. Off until Show airflow.
function setAir(on) {
  UI.airOn = on;
  [heat, cold, air, shim].forEach(p => { p.pts.visible = on; });
  $('airflow').textContent = on ? 'Hide airflow' : 'Show airflow'; $('airflow').classList.toggle('off', !on);
}
$('airflow').addEventListener('click', () => setAir(!UI.airOn));
setAir(UI.airOn);
// Thermal camera: swaps the hall to a false-colour infrared view; the colour mode does not apply while it is on
$('thermal').addEventListener('click', () => {
  UI.thermal = !UI.thermal; setThermal(UI.thermal);
  const b = $('thermal'); b.classList.toggle('off', !UI.thermal); b.setAttribute('aria-pressed', String(UI.thermal));
  $('modeSet').disabled = UI.thermal;
  renderLegend();
});
$('hallView').addEventListener('click', hallView);
// Graphics: the renderer is set up at start-up, so a change is remembered in this browser and the page reloads
{
  const radio = document.querySelector(`input[name="gfx"][value="${GFX}"]`); if (radio) radio.checked = true;
  document.querySelectorAll('input[name="gfx"]').forEach(el => el.addEventListener('change', e => {
    try { localStorage.setItem('gfx', e.target.value); } catch {}
    const q = new URLSearchParams(location.search); q.delete('quality');
    history.replaceState(null, '', `${location.pathname}${q.size ? '?' + q : ''}${location.hash}`);
    location.reload();   // setting href would not reload when only the hash is left
  }));
}

// ---------- Header chip: live feed or simulation ----------
function syncChip() {
  $('liveChip').textContent = live.enabled && fresh(live) ? `Live data · ${live.servers} of ${allServers.length} servers` : 'Simulated telemetry';
}

// ---------- Find a host or rack ----------
{
  // every rack and host in the site; ones in another hall switch to it
  const dl = $('hosts'), add = v => { const o = document.createElement('option'); o.value = v; dl.append(o); };
  for (const h of SITE.halls) for (const r of h.grid.racks) add(r.id);
  for (const sv of SITE.servers) add(sv.host);
}
function find(q, exactOnly) {
  q = q.trim().toLowerCase(); if (!q) return false;
  const msg = $('findMsg');
  const sv = byHost.get(q), r = byId[q.toUpperCase()];
  if (sv) { openServer(sv); msg.textContent = ''; return true; }
  if (r) { focusRack(r); msg.textContent = ''; return true; }
  const elsewhere = SITE_HOSTS.get(q), otherRack = SITE.halls.find(h => h !== HALL && h.grid.racks.some(x => x.id === q.toUpperCase()));
  if (elsewhere && elsewhere !== HALL.id) { goHall(elsewhere, 'host=' + encodeURIComponent(q)); return true; }
  if (otherRack) { goHall(otherRack.id, 'rack=' + encodeURIComponent(q.toUpperCase())); return true; }
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
    const r = UI.cutRack, next = r.row.racks[r.row.racks.indexOf(r) + (e.key === 'ArrowRight' ? 1 : -1) * r.face];
    if (next) { e.preventDefault(); focusRack(next); }
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

// Reflections, the baked fixture light and the rack-view cut for everything built so far (lights.js)
prepare(scene);

// ---------- Boot: pre-run two minutes of telemetry so trends are populated ----------
for (let i = 0; i < 480; i++) step(0.25);
renderLegend();
UI.selected = byId.A03 || racks[0] || null;
resize();
if (UI.selected) select(UI.selected, false); else $('rackPanel').hidden = true;   // a hall with no racks yet
syncChip(); updateAttention();
followLink();

let last = performance.now(), hudAcc = 0;
function frame(now) {
  // a frame's timestamp can precede the previous performance.now() (slow first frames), so never step backwards
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  step(dt);
  updateVisuals(dt);
  updateThermal(dt);
  updateDoors(dt);
  updateCabling(camera.position);
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
  if (W.sampled) { W.sampled = false; updateSparks(); syncChip(); updateAttention(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
