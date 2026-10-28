// Capacity finder: which racks can take another server of a given height and peak power. A rack fits when it has
// that many free U in one run (U1–38) and its power budget still covers every server in it running flat out, plus
// the switches and the new one. Racks that fit light up in the hall, the best in green; the rest go dark.
import { $, esc, RACK_KW } from './core.js';
import { UI } from './state.js';
import { racks, highlight } from './racks.js';
import { MAX_U } from './site.js';

const SWITCH_KW = 0.5;   // both top-of-rack switches at full traffic
const peakKW = r => r.servers.reduce((t, sv) => t + sv.spec.w[1], 0) / 1000 + SWITCH_KW;
const SHOWN = 8;

// The lowest run of h free U, or 0 if there is none
function slot(r, h) {
  const used = new Set(r.servers.flatMap(sv => Array.from({ length: sv.h }, (_, k) => sv.u + k)));
  for (let u = 1, run = 0; u <= MAX_U; u++) {
    run = used.has(u) ? 0 : run + 1;
    if (run === h) return u - h + 1;
  }
  return 0;
}

export function initCapacity({ focusRack, onChange }) {
  const out = $('fitOut');
  let hits = [];

  function clear() {
    UI.fit = null; hits = []; out.innerHTML = ''; onChange();
  }
  function find(h, w) {
    const kw = w / 1000;
    hits = racks.map(r => ({ r, u: slot(r, h), head: RACK_KW - peakKW(r) - kw }))
      .filter(x => x.u && x.head >= 0)
      // the most power left over first: it runs coolest and leaves room for the next one
      .sort((a, b) => b.head - a.head || a.r.id.localeCompare(b.r.id, undefined, { numeric: true }));
    UI.fit = { racks: new Map(hits.map(x => [x.r, x])), best: hits[0] && hits[0].r, h };
    const why = !hits.length ? (racks.some(r => slot(r, h)) ? `No rack has ${w} W of power budget left alongside ${h}U free.` : `No rack has ${h}U free in one run.`) : '';
    out.innerHTML = `<div class="fitsum">${hits.length ? `<b>${hits.length}</b> of ${racks.length} racks fit · best in green` : esc(why)}` +
      ` <button type="button" class="linkish" data-clear>Clear</button></div>` +
      (hits.length ? '<ul class="fitl">' + hits.slice(0, SHOWN).map((x, i) =>
        `<li><button type="button" data-i="${i}"><b>${esc(x.r.id)}</b><span>U${x.u}${h > 1 ? '–' + (x.u + h - 1) : ''}</span><span>${x.head.toFixed(1)} kW spare</span></button></li>`).join('') +
        (hits.length > SHOWN ? `<li class="more">and ${hits.length - SHOWN} more lit up in the hall</li>` : '') + '</ul>' : '');
    onChange();
  }

  $('fitForm').addEventListener('submit', e => {
    e.preventDefault();
    const w = Math.round(+$('fitW').value);
    if (!(w > 0)) { $('fitW').focus(); return; }
    find(+$('fitU').value, w);
  });
  out.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.clear !== undefined) { clear(); return; }
    const x = hits[+b.dataset.i]; if (!x) return;
    focusRack(x.r);
    highlight(x.r, x.u, UI.fit.h, 1);   // outline the free slot on the front
    if (matchMedia('(max-width: 720px)').matches) $('opsBox').open = false;   // on a phone Controls would cover the rack
  });
  return clear;
}
