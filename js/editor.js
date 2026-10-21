// Layout editor: draw each hall's floor grid (racks, vented tiles, hot aisles) and save it back into the site file.
// The servers in the file are kept as they are; renaming a rack or a hall moves its servers with it. Grids are held
// as tiles (". P H +" and "R" for a rack's front tile) plus a rack list, and written back as grid strings (site.js).
import { loadSite, parseGrid, gridText, demoSite } from './site.js';
import { getLocal, putLocal } from './store.js';

const $ = id => document.getElementById(id);
const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = v => String(v).replace(/[&<>"']/g, c => ENT[c]);
const key = s => String(s || '').trim().toLowerCase();

let site = {}, fileName = 'hall.json', halls = [], cur = 0, tool = 'rackS', sel = null, hover = null;
let checked = { problems: [], counts: new Map(), unplaced: new Map() };
const history = [];

// ---------- Loading ----------
// A file with halls is edited as it is. A file with servers but no halls gets one empty hall for each building and
// room its servers name, with their racks waiting to be placed. Nothing at all starts from the demo hall.
function use(raw, name, note) {
  site = raw && typeof raw === 'object' ? raw : {}; fileName = name || 'hall.json';
  if (!Array.isArray(site.servers)) site.servers = [];
  if (!Array.isArray(site.halls) || !site.halls.length) {
    if (site.servers.length) {
      const seen = new Map();
      for (const s of site.servers) { const b = s.building || 'Site', r = s.room || 'Hall 1'; seen.set(key(b) + '|' + key(r), { building: b, room: r }); }
      site.halls = [...seen.values()].map(h => ({ ...h, grid: Array.from({ length: 16 }, () => Array(24).fill('.').join(' ')) }));
      note += ' It has no halls yet, so there is an empty one for each building and room its servers name: place their racks.';
    } else { Object.assign(site, demoSite()); note += ' It has no halls or servers, so this starts from the demo hall.'; }
  }
  halls = site.halls.map(h => { const g = parseGrid(h.grid, [], ''), rest = { ...h }; delete rest.grid; return { ...rest, building: h.building || 'Site', room: h.room || h.name || 'Hall', cells: g.cells, racks: g.racks }; });
  cur = 0; sel = null; history.length = 0;
  $('src').textContent = note;
  refresh(true);
}
async function start() {
  const local = await getLocal();
  if (local) { try { use(JSON.parse(local.text), local.name, `Editing ${local.name}, the copy loaded in this browser.`); return; } catch { /* fall through to the server file */ } }
  const raw = await fetch('data/hall.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  use(raw, 'hall.json', 'Editing data/hall.json from the server.');
}

// The whole site as a file again: every hall's grid written out, everything else as it came in
function toSite() {
  return { ...site, halls: halls.map(({ cells, racks, ...h }) => ({ ...h, grid: gridText(cells, racks) })) };
}
const hallId = h => h.id || `${h.building} / ${h.room}`;
// Servers in hall h: the ones whose building and room match it (or that name neither, when there is one hall)
const inHall = (s, h) => (s.hallId ? key(s.hallId) === key(hallId(h)) : (!s.building || key(s.building) === key(h.building)) && (!s.room || key(s.room) === key(h.room)));

// ---------- Checking ----------
// Problems, servers per rack and racks the servers name that are not on any grid, worked out from the file as it now stands
function check() {
  const out = loadSite(toSite());
  const counts = new Map(), unplaced = new Map();
  for (const s of out.servers) counts.set(s.hall + '|' + s.rack, (counts.get(s.hall + '|' + s.rack) || 0) + 1);
  halls.forEach(h => {
    const ids = new Set(h.racks.map(r => r.id)), want = new Set();
    for (const s of site.servers) if (s.rack && inHall(s, h) && !ids.has(String(s.rack).toUpperCase())) want.add(String(s.rack).toUpperCase());
    unplaced.set(h, [...want].sort());
  });
  checked = { problems: out.problems, counts, unplaced };
}

// ---------- Drawing ----------
const cv = $('grid'), g = cv.getContext('2d'), PAD = 22;
const COLOR = { '.': '#1a232c', P: '#22485a', H: '#4a2420', rack: '#3a4a58', front: '#4fc3e8', grid: 'rgba(255,255,255,0.05)', sel: '#f2b441' };
function draw() {
  const h = halls[cur], z = +$('zoom').value, W = h.cells[0] ? h.cells[0].length : 0, H = h.cells.length, dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = (W * z + PAD * 2) * dpr; cv.height = (H * z + PAD * 2) * dpr;
  cv.style.width = (W * z + PAD * 2) + 'px'; cv.style.height = (H * z + PAD * 2) + 'px';
  g.setTransform(dpr, 0, 0, dpr, PAD * dpr, PAD * dpr);
  g.clearRect(-PAD, -PAD, W * z + PAD * 2, H * z + PAD * 2);
  // tile numbers every five, so a layout can be checked against a floor plan
  g.fillStyle = '#5d7281'; g.font = '9px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let c = 0; c < W; c += 5) g.fillText(c + 1, c * z + z / 2, -10);
  for (let r = 0; r < H; r += 5) g.fillText(r + 1, -11, r * z + z / 2);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const t = h.cells[r][c], x = c * z, y = r * z;
    g.fillStyle = COLOR[t === 'P' || t === 'H' ? t : '.']; g.fillRect(x, y, z, z);
    if (t === 'P') { g.fillStyle = 'rgba(127, 214, 242, 0.35)'; for (let i = 1; i < 4; i++) for (let j = 1; j < 4; j++) g.fillRect(x + i * z / 4 - 1, y + j * z / 4 - 1, 2, 2); }
    g.strokeStyle = COLOR.grid; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, z - 1, z - 1);
  }
  const id = hallId(h);
  for (const k of h.racks) {
    const top = Math.min(k.row, k.row - k.face), x = k.col * z, y = top * z, n = checked.counts.get(id + '|' + k.id) || 0;
    g.fillStyle = COLOR.rack; g.fillRect(x + 1, y + 1, z - 2, 2 * z - 2);
    g.fillStyle = COLOR.front; g.fillRect(x + 1, k.face > 0 ? y + 2 * z - 4 : y + 1, z - 2, 3);
    if (sel && sel.k === k) { g.strokeStyle = COLOR.sel; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, z - 2, 2 * z - 2); }
    // the name along the rack, and its server count
    g.save(); g.translate(x + z / 2, y + z); g.rotate(-Math.PI / 2);
    g.fillStyle = '#e6eef3'; g.font = `500 ${Math.max(8, Math.min(12, z * 0.42))}px "IBM Plex Mono", monospace`; g.fillText(k.id, 0, n ? -z * 0.14 : 0, 2 * z - 6);
    if (n) { g.fillStyle = '#9fb4c2'; g.font = `${Math.max(7, Math.min(10, z * 0.32))}px "IBM Plex Mono", monospace`; g.fillText(n, 0, z * 0.24); }
    g.restore();
  }
  if (hover) { g.strokeStyle = 'rgba(79, 195, 232, 0.8)'; g.lineWidth = 1.5; g.strokeRect(hover.c * z + 1, hover.r * z + 1, z - 2, z - 2); }
}

// ---------- Editing ----------
const rackAt = (h, c, r) => h.racks.find(k => k.col === c && (k.row === r || k.row - k.face === r));
const snapshot = () => { history.push(JSON.stringify({ halls, servers: site.servers, cur })); if (history.length > 40) history.shift(); };
function undo() {
  const s = history.pop(); if (!s) return;
  const o = JSON.parse(s); halls = o.halls; site.servers = o.servers; cur = Math.min(o.cur, halls.length - 1); sel = null;
  refresh(true);
}
// The next rack's name: a rack the servers name that is not placed yet, else the prefix and the lowest free number
function nextId() {
  const h = halls[cur], used = new Set(h.racks.map(k => k.id)), waiting = (checked.unplaced.get(h) || []).filter(i => !used.has(i));
  if (waiting.length) return waiting[0];
  const p = ($('prefix').value || 'R').trim().toUpperCase().replace(/[\s:]+/g, '');
  for (let n = 1; ; n++) { const id = p + String(n).padStart(2, '0'); if (!used.has(id)) return id; }
}
let flash = null;
function say(msg) { $('src').textContent = msg; clearTimeout(flash); flash = setTimeout(() => { $('src').textContent = ''; }, 5000); }
function apply(c, r) {
  const h = halls[cur], t = h.cells[r][c];
  if (tool === 'select') { const k = rackAt(h, c, r); sel = k ? { k } : null; return; }
  if (tool === 'rackS' || tool === 'rackN') {
    const face = tool === 'rackS' ? 1 : -1, back = r - face;
    if (t === 'R' || t === '+') return;
    if (t !== '.' || back < 0 || back >= h.cells.length || h.cells[back][c] !== '.') { say('A rack needs this tile and the one behind it to be plain floor.'); return; }
    const k = { id: nextId(), col: c, row: r, face };
    h.cells[r][c] = 'R'; h.cells[back][c] = '+'; h.racks.push(k); sel = { k };
    return;
  }
  // tiles: plain floor also clears a rack; vented and hot-aisle tiles leave racks alone
  if (t === 'R' || t === '+') {
    if (tool !== '.') return;
    const k = rackAt(h, c, r); removeRack(h, k); return;
  }
  h.cells[r][c] = tool;
}
function removeRack(h, k) {
  h.cells[k.row][k.col] = '.'; h.cells[k.row - k.face][k.col] = '.';
  h.racks.splice(h.racks.indexOf(k), 1); if (sel && sel.k === k) sel = null;
}
const cellOf = e => {
  const z = +$('zoom').value, b = cv.getBoundingClientRect(), c = Math.floor((e.clientX - b.left - PAD) / z), r = Math.floor((e.clientY - b.top - PAD) / z), h = halls[cur];
  return r >= 0 && r < h.cells.length && c >= 0 && c < h.cells[0].length ? { c, r } : null;
};
let painting = null;
cv.addEventListener('pointerdown', e => {
  const p = cellOf(e); if (!p || e.button !== 0) return;
  snapshot(); painting = new Set([p.c + ',' + p.r]); cv.setPointerCapture(e.pointerId);
  apply(p.c, p.r); refresh();
});
cv.addEventListener('pointermove', e => {
  const p = cellOf(e);
  if (painting && p && tool !== 'select' && !painting.has(p.c + ',' + p.r)) { painting.add(p.c + ',' + p.r); apply(p.c, p.r); refresh(); }
  if ((p && (!hover || hover.c !== p.c || hover.r !== p.r)) || (!p && hover)) { hover = p; draw(); }
});
const stop = () => { if (painting) { painting = null; refresh(true); } };
cv.addEventListener('pointerup', stop); cv.addEventListener('pointercancel', stop);
cv.addEventListener('pointerleave', () => { hover = null; draw(); });

// Renaming moves the servers with it: servers in this hall naming the old rack (or hall) are updated
function renameRack(k, to) {
  const h = halls[cur]; to = to.trim().toUpperCase().replace(/[\s:]+/g, '');
  if (!to || to === k.id) return;
  if (h.racks.some(x => x !== k && x.id === to)) { say(`There is already a rack ${to} in this hall.`); return; }
  snapshot();
  for (const s of site.servers) if (String(s.rack).toUpperCase() === k.id && inHall(s, h)) s.rack = to;
  k.id = to; refresh(true);
}
function turnRack(k) {
  const h = halls[cur]; snapshot();
  h.cells[k.row][k.col] = '+'; k.row -= k.face; k.face = -k.face; h.cells[k.row][k.col] = 'R';
  refresh(true);
}
function renameHall(field, v) {
  const h = halls[cur], old = { building: h.building, room: h.room }; v = v.trim(); if (!v || v === h[field]) return;
  snapshot();
  for (const s of site.servers) if (inHall(s, h) && s[field] && key(s[field]) === key(old[field])) s[field] = v;
  h[field] = v; delete h.id; refresh(true);
}
function resize(W, H) {
  const h = halls[cur], w0 = h.cells[0].length, h0 = h.cells.length;
  W = Math.max(4, Math.min(200, W | 0)); H = Math.max(4, Math.min(200, H | 0));
  if (W === w0 && H === h0) return;
  const lost = h.racks.filter(k => k.col >= W || k.row >= H || k.row - k.face >= H);
  if (lost.length && !confirm(`Making the hall this small removes ${lost.length} rack${lost.length > 1 ? 's' : ''} (${lost.map(k => k.id).join(', ')}). Go ahead?`)) { refresh(); return; }
  snapshot();
  lost.forEach(k => removeRack(h, k));
  h.cells = Array.from({ length: H }, (_, r) => Array.from({ length: W }, (_, c) => (h.cells[r] && h.cells[r][c]) || '.'));
  refresh(true);
}

// ---------- Panels ----------
function refresh(recheck) {
  if (recheck) check();
  const h = halls[cur];
  $('halls').innerHTML = halls.map((x, i) => `<li><button type="button" data-i="${i}" aria-current="${i === cur}">${esc(x.room)}<small>${esc(x.building)} · ${x.racks.length} racks</small></button></li>`).join('');
  for (const [id, v] of [['hBuilding', h.building], ['hRoom', h.room], ['hW', h.cells[0].length], ['hH', h.cells.length]]) if (document.activeElement !== $(id)) $(id).value = v;
  $('hSize').textContent = `${(h.cells[0].length * 0.6).toFixed(1)} × ${(h.cells.length * 0.6).toFixed(1)} m floor.`;
  $('delHall').disabled = halls.length < 2;
  $('nextId').textContent = nextId();
  // the selected rack
  const box = $('rackBox'); box.hidden = !sel;
  if (sel) {
    const k = sel.k, id = hallId(h), list = site.servers.filter(s => String(s.rack).toUpperCase() === k.id && inHall(s, h)).sort((a, b) => (a.u || 0) - (b.u || 0));
    $('rTitle').textContent = k.id; if (document.activeElement !== $('rName')) $('rName').value = k.id;
    $('rNote').textContent = `Front faces ${k.face > 0 ? 'south (down the grid)' : 'north (up the grid)'} · column ${k.col + 1}, row ${k.row + 1} · ${checked.counts.get(id + '|' + k.id) || 0} servers in the file.`;
    $('rServers').innerHTML = list.slice(0, 60).map(s => `<li>U${esc(s.u ?? '?')} ${esc(s.host || s.hostname || '—')} <span>${esc([s.manufacturer, s.model].filter(Boolean).join(' '))}</span></li>`).join('') + (list.length > 60 ? `<li><span>…and ${list.length - 60} more</span></li>` : '');
  }
  // problems, and racks waiting to be placed
  const waiting = checked.unplaced.get(h) || [], P = checked.problems.filter(p => !/is not in any hall's grid/.test(p));
  const items = (waiting.length ? [`Racks the servers name that are not placed in this hall yet: ${waiting.join(', ')}. The rack tools place them next.`] : []).concat(P);
  $('probN').textContent = items.length ? `· ${items.length}` : '';
  $('probs').innerHTML = items.length ? items.slice(0, 200).map(p => `<li>${esc(p)}</li>`).join('') : '<li class="ok">None. Every server has a place.</li>';
  draw();
}
$('halls').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (!b) return; cur = +b.dataset.i; sel = null; refresh(); });
$('hBuilding').addEventListener('change', e => renameHall('building', e.target.value));
$('hRoom').addEventListener('change', e => renameHall('room', e.target.value));
$('hW').addEventListener('change', () => resize(+$('hW').value, +$('hH').value));
$('hH').addEventListener('change', () => resize(+$('hW').value, +$('hH').value));
$('addHall').addEventListener('click', () => {
  snapshot();
  const b = halls[cur] ? halls[cur].building : 'Site';
  let n = halls.length + 1; while (halls.some(h => key(h.room) === key(`Hall ${n}`) && key(h.building) === key(b))) n++;
  halls.push({ building: b, room: `Hall ${n}`, cells: Array.from({ length: 16 }, () => Array(24).fill('.')), racks: [] });
  cur = halls.length - 1; sel = null; refresh(true);
});
$('delHall').addEventListener('click', () => {
  const h = halls[cur];
  if (!confirm(`Delete ${h.building} / ${h.room} and its ${h.racks.length} racks? Its servers stay in the file, without a place.`)) return;
  snapshot(); halls.splice(cur, 1); cur = 0; sel = null; refresh(true);
});
$('rName').addEventListener('change', e => sel && renameRack(sel.k, e.target.value));
$('rTurn').addEventListener('click', () => sel && turnRack(sel.k));
$('rDel').addEventListener('click', () => { if (!sel) return; snapshot(); removeRack(halls[cur], sel.k); refresh(true); });
document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => {
  tool = b.dataset.tool;
  document.querySelectorAll('[data-tool]').forEach(x => x.setAttribute('aria-checked', String(x === b)));
}));
$('prefix').addEventListener('input', () => { $('nextId').textContent = nextId(); });
$('zoom').addEventListener('input', draw);
$('undo').addEventListener('click', undo);
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/INPUT/.test(document.activeElement.tagName)) { e.preventDefault(); undo(); } });

// ---------- Files ----------
const text = () => JSON.stringify(toSite(), null, 1);
$('download').addEventListener('click', () => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text()], { type: 'application/json' })); a.download = fileName;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('toViewer').addEventListener('click', async () => {
  await putLocal(fileName, text());
  location.href = `index.html?hall=${encodeURIComponent(hallId(halls[cur]))}`;
});
$('openFile').addEventListener('click', () => $('fileIn').click());
$('fileIn').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try { use(JSON.parse(await f.text()), f.name, `Editing ${f.name}.`); } catch (err) { say(`${f.name} is not valid JSON: ${err.message}`); }
  e.target.value = '';
});

start();
