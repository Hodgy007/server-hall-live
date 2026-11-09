// Inventory table: every server in the site, all halls, sortable by any column and filtered as you type (same matching as
// Find). Only the rows in view are drawn, so a few thousand servers stay quick. Export CSV writes the rows shown and
// reads back through the CSV import. The model (columns, filter, sort, export rows) is sheet.js.
import { $, esc } from './core.js';
import { SITE, HALL } from './data.js';
import { COLUMNS, buildRows, filterRows, sortRows, csvRows } from './sheet.js';
import { toCSV } from './csv.js';
import { goHall } from './sitebar.js';

const ROW = 28, BUFFER = 8;

export function initTable({ openServer, onChange }) {
  const box = $('sheet'), sc = $('sheetScroll'), body = $('sheetBody'), tbl = $('sheetTbl'), filter = $('sheetFilter'), count = $('sheetCount');
  let all = null, view = [], sort = { id: null, dir: 1 }, opener = null, from = -1, to = -1;

  const head = document.createElement('tr');
  COLUMNS.forEach(c => {
    const th = document.createElement('th'); th.scope = 'col'; th.dataset.id = c.id;
    const b = document.createElement('button'); b.type = 'button'; b.textContent = c.label;
    b.addEventListener('click', () => { sort = sort.id === c.id ? (sort.dir === 1 ? { id: c.id, dir: -1 } : { id: null, dir: 1 }) : { id: c.id, dir: 1 }; refresh(); });
    th.append(b); head.append(th);
  });
  tbl.tHead.append(head);

  function refresh() {
    view = sortRows(filterRows(all, filter.value), sort.id, sort.dir);
    count.textContent = `${view.length.toLocaleString('en-US')} of ${all.length.toLocaleString('en-US')} servers`;
    head.querySelectorAll('th').forEach(th => { if (th.dataset.id === sort.id) th.setAttribute('aria-sort', sort.dir === 1 ? 'ascending' : 'descending'); else th.removeAttribute('aria-sort'); });
    tbl.setAttribute('aria-rowcount', String(view.length + 1));
    sc.scrollTop = 0; from = to = -1; draw();
  }
  function draw() {
    const top = sc.scrollTop, h = sc.clientHeight || 400;
    const a = Math.max(0, Math.floor(top / ROW) - BUFFER), b = Math.min(view.length, Math.ceil((top + h) / ROW) + BUFFER);
    if (a === from && b === to) return;
    from = a; to = b;
    const pad = n => `<tr class="pad" aria-hidden="true"><td colspan="${COLUMNS.length}" style="height:${n * ROW}px"></td></tr>`;
    let html = a ? pad(a) : '';
    for (let i = a; i < b; i++) {
      const r = view[i];
      html += `<tr class="row" tabindex="0" data-i="${i}" aria-rowindex="${i + 2}">` + r.cells.map((v, k) => `<td${COLUMNS[k].num ? ' class="num"' : ''} title="${esc(v)}">${esc(v)}</td>`).join('') + '</tr>';
    }
    if (b < view.length) html += pad(view.length - b);
    body.innerHTML = html;
  }
  function pick(i) {
    const r = view[i]; if (!r) return;
    close(true);
    if (r.rec.hall === HALL.id) openServer(r.rec.host); else goHall(r.rec.hall, 'host=' + encodeURIComponent(r.rec.host));
  }
  sc.addEventListener('scroll', () => requestAnimationFrame(draw), { passive: true });
  window.addEventListener('resize', () => { if (!box.hidden) { from = to = -1; draw(); } });
  body.addEventListener('click', e => { const tr = e.target.closest('tr.row'); if (tr) pick(+tr.dataset.i); });
  body.addEventListener('keydown', e => {
    const tr = e.target.closest('tr.row'); if (!tr) return;
    const i = +tr.dataset.i;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(i); return; }
    const d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : e.key === 'PageDown' ? 10 : e.key === 'PageUp' ? -10 : 0;
    if (!d) return;
    e.preventDefault();
    const j = Math.max(0, Math.min(view.length - 1, i + d));
    if (j * ROW < sc.scrollTop || (j + 1) * ROW > sc.scrollTop + sc.clientHeight - ROW) sc.scrollTop = Math.max(0, j * ROW - sc.clientHeight / 2);
    draw();
    body.querySelector(`tr.row[data-i="${j}"]`)?.focus();
  });
  filter.addEventListener('input', refresh);
  $('sheetExport').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([toCSV(csvRows(view), { bom: true })], { type: 'text/csv;charset=utf-8' }));
    a.download = 'server-inventory.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('sheetClose').addEventListener('click', () => close());
  box.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') {   // keep the focus inside the dialog
      const f = [...box.querySelectorAll('input, button, [tabindex="0"]')].filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  function open() {
    if (!box.hidden) return;
    if (!all) all = buildRows(SITE.servers, new Map(SITE.halls.map(h => [h.id, h])));
    opener = document.activeElement;
    box.hidden = false; $('invBtn').setAttribute('aria-expanded', 'true');
    refresh(); filter.focus();
    onChange(true);
  }
  function close(keepFocus) {
    if (box.hidden) return;
    box.hidden = true; $('invBtn').setAttribute('aria-expanded', 'false');
    if (!keepFocus && opener && opener.focus) opener.focus();
    onChange(false);
  }
  $('invBtn').addEventListener('click', () => (box.hidden ? open() : close()));
  return { open, close, toggle: () => (box.hidden ? open() : close()), isOpen: () => !box.hidden };
}
