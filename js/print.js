// Print elevation: the rack U42 down to U1 on a clean page, each device's host, model and serial in its U positions,
// with the rack ID, hall and date. The page is built into #printSheet, which css/print.css prints on its own
// (everything else is hidden in print), then cleared again.
import { $ } from './core.js';
import { HALL } from './data.js';

const cell = (tag, text, cls, rowspan) => { const c = document.createElement(tag); c.textContent = text; if (cls) c.className = cls; if (rowspan > 1) c.rowSpan = rowspan; return c; };

// The rows of the elevation, top first: [{ u, span, host, model, serial, kind }]. kind: server, fixed, empty
export function elevationRows(r) {
  const id = r.id.toLowerCase(), at = new Map(r.servers.map(sv => [sv.u + sv.h - 1, sv])), rows = [];
  for (let u = 42; u >= 1;) {
    if (u === 42 || u === 41) { rows.push({ u, span: 1, kind: 'fixed', host: `tor-${id}-${u === 42 ? 'a' : 'b'}`, model: 'Top-of-rack switch', serial: '' }); u--; continue; }
    if (u === 40) { rows.push({ u, span: 1, kind: 'fixed', host: `pp-${id}`, model: 'Patch panel, 48-port LC fibre', serial: '' }); u--; continue; }
    if (u === 39) { rows.push({ u, span: 1, kind: 'fixed', host: `oob-${id}`, model: 'Out-of-band switch', serial: '' }); u--; continue; }
    const sv = at.get(u);
    if (sv) { rows.push({ u, span: sv.h, kind: 'server', host: sv.host, model: sv.model, serial: sv.rec.serial || '' }); u -= sv.h; continue; }
    rows.push({ u, span: 1, kind: 'empty', host: 'Empty', model: '', serial: '' }); u--;
  }
  return rows;
}

export function printElevation(r) {
  const sheet = $('printSheet'); sheet.textContent = '';
  const h1 = document.createElement('h1'); h1.textContent = `Rack ${r.id}`;
  const meta = document.createElement('p'); meta.className = 'meta';
  meta.textContent = `${HALL.building} / ${HALL.room} · ${r.servers.length} server${r.servers.length === 1 ? '' : 's'} · ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`;
  const t = document.createElement('table'), hr = t.createTHead().insertRow();
  [['U', 'u'], ['Host', ''], ['Model', ''], ['Serial', '']].forEach(([x, c]) => hr.append(cell('th', x, c)));
  const tb = t.createTBody();
  for (const e of elevationRows(r)) {
    for (let k = 0; k < e.span; k++) {
      const tr = tb.insertRow(); tr.append(cell('td', 'U' + (e.u - k), 'u'));
      if (k) continue;
      if (e.kind === 'server') tr.append(cell('td', e.host, 'host', e.span), cell('td', e.model, '', e.span), cell('td', e.serial, '', e.span));
      else tr.append(cell('td', e.host, e.kind), cell('td', e.model, e.kind), cell('td', '', e.kind));
    }
  }
  const foot = document.createElement('p'); foot.className = 'meta'; foot.textContent = 'U42 at the top, U1 at the bottom. Printed from Server Hall Live.';
  sheet.append(h1, meta, t, foot);
  const title = document.title; document.title = `Rack ${r.id} elevation`;
  const done = () => { sheet.textContent = ''; document.title = title; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
}
