// Site bar: which building and hall is on show, where the data came from, loading a file into the browser, and the
// problems found in the data. Changing hall or file reloads the page, since the whole 3D hall is built from it.
import { $, esc } from './core.js';
import { SITE, HALL, HALL_SERVERS } from './data.js';
import { loadSite } from './site.js';
import { putLocal, clearLocal } from './store.js';
import { racks } from './racks.js';

// Go to another hall, optionally straight to a rack or host in it
export function goHall(id, hash) {
  const q = new URLSearchParams(location.search); q.set('hall', id);
  location.href = `${location.pathname}?${q}${hash ? '#' + hash : ''}`;
}

// ---------- Hall picker and header line ----------
{
  const pick = $('hallPick'), count = new Map();
  for (const sv of SITE.servers) count.set(sv.hall, (count.get(sv.hall) || 0) + 1);
  const byBuilding = new Map();
  for (const h of SITE.halls) { if (!byBuilding.has(h.building)) byBuilding.set(h.building, []); byBuilding.get(h.building).push(h); }
  for (const [b, halls] of byBuilding) {
    const g = document.createElement('optgroup'); g.label = b;
    for (const h of halls) {
      const o = document.createElement('option'); o.value = h.id; o.textContent = `${h.room} · ${h.grid.racks.length} racks · ${count.get(h.id) || 0} servers`;
      o.selected = h === HALL; g.append(o);
    }
    pick.append(g);
  }
  pick.closest('label').hidden = SITE.halls.length < 2;
  pick.addEventListener('change', () => goHall(pick.value));
  const rows = new Set(racks.map(r => r.row.id)).size;
  $('hallLine').textContent = `${HALL.building} · ${HALL.room} · ${rows} row${rows === 1 ? '' : 's'} · ${racks.length} racks · ${HALL_SERVERS.length} servers`;
  $('stage').setAttribute('aria-label', `3D view of ${HALL.building} ${HALL.room}: ${racks.length} racks in ${rows} rows`);
  document.title = `${HALL.room} · Server Hall Live`;
}

// ---------- Where the data came from ----------
{
  const src = SITE.source;
  $('srcLine').textContent = SITE.demo ? (src.kind === 'browser' ? `Demo hall (${src.name} has no halls)` : 'Demo hall · load a site file to show yours')
    : src.kind === 'browser' ? `From ${src.name}, loaded in this browser` : `From ${src.name}`;
  $('srcReset').hidden = src.kind !== 'browser';
  $('srcReset').addEventListener('click', () => clearLocal().then(() => location.reload()));
}

// ---------- Problems in the data ----------
{
  const P = SITE.problems, btn = $('probBtn'), list = $('probList');
  btn.hidden = !P.length;
  btn.textContent = `${P.length} problem${P.length === 1 ? '' : 's'} in the data`;
  list.innerHTML = P.slice(0, 200).map(p => `<li>${esc(p)}</li>`).join('') + (P.length > 200 ? `<li>…and ${P.length - 200} more</li>` : '');
  btn.addEventListener('click', () => { list.hidden = !list.hidden; btn.setAttribute('aria-expanded', String(!list.hidden)); });
}

// ---------- Load a file: the button, or drop one anywhere on the page ----------
// The file is checked before it replaces anything: it must be JSON, and the halls in it must hold at least one rack
async function take(file) {
  const text = await file.text();
  let raw;
  try { raw = JSON.parse(text); } catch (e) { alert(`${file.name} is not valid JSON: ${e.message}`); return; }
  const site = loadSite(raw);
  if (!site.demo && !site.halls.some(h => h.grid.racks.length)) { alert(`${file.name} has halls but no racks in their grids, so there is nothing to show.`); return; }
  await putLocal(file.name, text);
  const q = new URLSearchParams(location.search); q.delete('hall');
  location.href = `${location.pathname}${q.size ? '?' + q : ''}`;
}
$('loadFile').addEventListener('click', () => $('fileIn').click());
$('fileIn').addEventListener('change', e => { const f = e.target.files[0]; if (f) take(f); });
{
  const zone = $('dropZone'); let depth = 0;
  const files = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  window.addEventListener('dragenter', e => { if (!files(e)) return; depth++; zone.hidden = false; });
  window.addEventListener('dragleave', e => { if (!files(e)) return; if (--depth <= 0) { depth = 0; zone.hidden = true; } });
  window.addEventListener('dragover', e => { if (files(e)) e.preventDefault(); });
  window.addEventListener('drop', e => {
    if (!files(e)) return;
    e.preventDefault(); depth = 0; zone.hidden = true;
    const f = e.dataTransfer.files[0]; if (f) take(f);
  });
}
