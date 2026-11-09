// Site bar: which building and hall is on show, where the data came from, loading a file into the browser, and the
// problems found in the data. Changing hall or file reloads the page, since the whole 3D hall is built from it.
import { $, esc } from './core.js';
import { SITE, HALL, HALL_SERVERS, RAW } from './data.js';
import { parseServers, applyServers } from './csv.js';
import { choose } from './choose.js';
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
// The file is checked before it replaces anything: JSON must parse and its halls must hold at least one rack. A .csv
// is a list of servers (csv.js): laid into the halls already in use (asking whether to replace or merge), or, with no
// halls yet, saved so the layout editor can place their racks.
const reload = () => { location.href = `${location.pathname}${location.search}`; };
async function takeCsv(file, text) {
  const res = parseServers(text);
  if (res.error) { await choose(`${file.name} could not be read`, res.error, [], [], 'Close'); return; }
  if (!res.records.length) { await choose(`${file.name} has no servers`, 'No rows with a hostname were found.', [], res.problems, 'Close'); return; }
  const hasHalls = !SITE.demo && SITE.halls.length > 0, n = res.records.length;
  const jsonName = SITE.source.kind === 'browser' && /\.json$/i.test(SITE.source.name) ? SITE.source.name : 'hall.json';
  const save = async site => { await putLocal(jsonName, JSON.stringify(site, null, 1)); reload(); };
  if (!hasHalls) {
    const go = await choose(`${n} server${n === 1 ? '' : 's'} read from ${file.name}`, 'This site has no halls yet, so the layout editor opens next, with an empty hall for each building and room in the list, to place their racks.', [{ id: 'edit', label: 'Open the layout editor', primary: true }], res.problems);
    if (!go) return;
    await putLocal(jsonName, JSON.stringify(applyServers(SITE.demo ? { ...RAW, servers: [] } : RAW, res.records, 'replace', res.problems).site, null, 1));
    location.href = 'layout.html'; return;
  }
  const placed = mode => { const r = applyServers(RAW, res.records, mode, res.problems); const s = loadSite(r.site); return { r, s }; };
  const rep = placed('replace'), mer = placed('merge');
  const pick = await choose(`${n} server${n === 1 ? '' : 's'} read from ${file.name}`,
    `This site already has ${SITE.servers.length} server${SITE.servers.length === 1 ? '' : 's'} in ${SITE.halls.length} hall${SITE.halls.length === 1 ? '' : 's'}; the halls and layout are kept either way. Replace all servers: ${rep.s.servers.length} of ${n} fit in a rack. Merge by hostname: ${mer.r.updated} updated, ${mer.r.added} added, ${mer.r.kept} left as they are.`,
    [{ id: 'replace', label: 'Replace all servers' }, { id: 'merge', label: 'Merge by hostname', primary: true }], res.problems);
  if (pick) await save((pick === 'merge' ? mer : rep).r.site);
}
async function take(file) {
  const text = await file.text();
  if (/\.(csv|tsv)$/i.test(file.name) || /^text\/(csv|tab-separated)/.test(file.type)) { await takeCsv(file, text); return; }
  let raw;
  try { raw = JSON.parse(text); } catch (e) { alert(`${file.name} is not valid JSON: ${e.message}`); return; }
  const site = loadSite(raw);
  if (!site.demo && !site.halls.some(h => h.grid.racks.length)) { alert(`${file.name} has halls but no racks in their grids, so there is nothing to show.`); return; }
  await putLocal(file.name, text);
  const q = new URLSearchParams(location.search); q.delete('hall');
  location.href = `${location.pathname}${q.size ? '?' + q : ''}`;
}
$('loadFile').addEventListener('click', () => $('fileIn').click());
$('fileIn').addEventListener('change', e => { const f = e.target.files[0]; if (f) take(f); e.target.value = ''; });
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
