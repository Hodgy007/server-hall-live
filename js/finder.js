// Find: type a hostname, rack, serial, IP or MAC address, model, make, role or OS and get the matches across every hall
// in the file. An exact hostname or rack ID, or a single match, goes straight there; otherwise a list opens under the
// field that arrow keys, Enter, Esc and clicks work on. Matching is search.js.
import { $, esc } from './core.js';
import { SITE, HALL } from './data.js';
import { byHost, byId } from './racks.js';
import { goHall } from './sitebar.js';
import { searchAll, exactTarget } from './search.js';

const SHOWN = 40;
const hallName = new Map(SITE.halls.map(h => [h.id, `${h.building} / ${h.room}`]));
const RACKS = SITE.halls.flatMap(h => h.grid.racks.map(r => ({ id: r.id, hall: h.id })));

export function initFinder({ openServer, focusRack }) {
  const input = $('find'), list = $('findList'), msg = $('findMsg'), form = $('findForm');
  let hits = [], active = -1;

  const close = () => { list.hidden = true; list.textContent = ''; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
  function go(t) {
    close(); msg.textContent = ''; input.blur();
    const mine = t.hall === HALL.id;
    if (t.kind === 'host') {
      if (mine) openServer(byHost.get(t.host.toLowerCase())); else goHall(t.hall, 'host=' + encodeURIComponent(t.host));
    } else if (mine) focusRack(byId[t.rack.toUpperCase()]); else goHall(t.hall, 'rack=' + encodeURIComponent(t.rack.toUpperCase()));
  }
  function setActive(i) {
    const items = [...list.children].filter(li => li.id);
    if (!items.length) return;
    active = (i + items.length) % items.length;
    items.forEach((li, k) => li.setAttribute('aria-selected', String(k === active)));
    input.setAttribute('aria-activedescendant', items[active].id);
    items[active].scrollIntoView({ block: 'nearest' });
  }
  function render() {
    list.textContent = '';
    hits.slice(0, SHOWN).forEach((h, i) => {
      const li = document.createElement('li'); li.id = 'findOpt' + i; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', 'false');
      const where = h.kind === 'host' ? `Rack ${h.rack} · U${h.u}${h.h > 1 ? '–' + (h.u + h.h - 1) : ''}` : 'Rack';
      li.innerHTML = `<b>${esc(h.kind === 'host' ? h.host : h.rack)}</b><span>${esc(where)}</span><span>${esc(hallName.get(h.hall) || '')}</span>` +
        `<span class="w">matched <em>${esc(h.field)}</em>${h.kind === 'host' && h.field !== 'Hostname' ? ': ' + esc(h.value) : ''}</span>`;
      li.addEventListener('pointerdown', e => e.preventDefault());   // keep the focus in the field
      li.addEventListener('click', () => go(h));
      list.append(li);
    });
    if (hits.length > SHOWN) { const li = document.createElement('li'); li.className = 'more'; li.textContent = `and ${hits.length - SHOWN} more: type more to narrow them down`; list.append(li); }
    list.hidden = false; input.setAttribute('aria-expanded', 'true');
    setActive(0);
  }
  function update() {
    const q = input.value.trim();
    if (!q) { close(); msg.textContent = ''; return; }
    hits = searchAll(SITE.servers, RACKS, q);
    if (!hits.length) { close(); msg.textContent = `No server or rack matches “${q}”`; return; }
    msg.textContent = hits.length > 1 ? `${hits.length} matches` : '';
    render();
  }
  input.addEventListener('input', update);
  input.addEventListener('focus', () => { if (input.value.trim() && list.hidden) update(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (list.hidden) update(); else setActive(active + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Escape' && !list.hidden) { e.stopPropagation(); close(); }
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = input.value.trim(); if (!q) return;
    const ex = exactTarget(SITE.servers, RACKS, q);
    if (ex) { go(ex); return; }
    if (list.hidden) update();
    const t = hits[Math.max(0, active)];
    if (t) go(t);
  });
  form.addEventListener('focusout', e => { if (!form.contains(e.relatedTarget)) setTimeout(() => { if (!form.contains(document.activeElement)) close(); }, 0); });
}
