// Plan view: a flat top-down map of the hall, north up, drawn as SVG (so rack IDs are real, focusable, crisp text).
// Racks take the colours of the colour mode and dim for the rack filter; click or press Enter on one to open it in 3D.
// Wheel or the +/− buttons zoom, drag pans, Fit puts the whole hall back.
import { THREE, $, grad, modeValue, TILE, ROOM, RACK_W, RACK_D } from './core.js';
import { HALL, LAYOUT } from './data.js';
import { W } from './state.js';
import { racks, byId } from './racks.js';
import { INV } from './mode.js';
import { CB, rackLook } from './rackcolor.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.append(e); return e; };
const css = c => '#' + new THREE.Color().copy(c).convertLinearToSRGB().getHexString();
const tmp = new THREE.Color();
// "A01" → ["A", "01"]; anything without a letter prefix and a number stays on one line
const split = id => { const m = /^([A-Za-z]+[-_ ]?)(\d+)$/.exec(id); return m && id.length <= 6 ? [m[1], m[2]] : [id]; };

export function initPlan({ openRack, onChange }) {
  const svg = $('plan'), bar = $('planBar'), btn = $('planBtn');
  let on = false, built = false, k = 1, cx = 0, cz = 0, groups = new Map();
  const PAD = { t: 170, b: 30, l: 30, r: 70 };

  function build() {
    built = true;
    const world = el('g', { id: 'planWorld' }, svg);
    el('rect', { class: 'room', x: -ROOM.x, y: -ROOM.z, width: 2 * ROOM.x, height: 2 * ROOM.z }, world);
    HALL.grid.cells.forEach((row, r) => row.forEach((c, col) => {
      if (c === 'P' || c === 'H') el('rect', { class: c === 'P' ? 'tile-p' : 'tile-h', x: col * TILE - ROOM.x, y: r * TILE - ROOM.z, width: TILE, height: TILE }, world);
    }));
    // row letters at both ends of every row
    for (const row of LAYOUT.rows) for (const x of [row.x0 - 0.55, row.x1 + 0.55]) {
      const t = el('text', { class: 'rowlbl', x, y: row.z + 0.25 }, world); t.textContent = row.id;
    }
    const n = el('text', { class: 'north', x: -ROOM.x + 0.5, y: -ROOM.z + 0.6 }, world); n.textContent = 'N ↑';
    for (const L of LAYOUT.racks) {
      const r = byId[L.id]; if (!r) continue;
      const g = el('g', { class: 'rk', tabindex: '0', role: 'button' }, world);
      el('rect', { x: L.x - RACK_W / 2, y: L.z - RACK_D / 2, width: RACK_W, height: RACK_D, rx: 0.04 }, g);
      el('line', { class: 'front', x1: L.x - RACK_W / 2, x2: L.x + RACK_W / 2, y1: L.z + L.face * RACK_D / 2, y2: L.z + L.face * RACK_D / 2 }, g);
      const parts = split(L.id), fs = parts.length === 2 ? 0.3 : Math.min(0.34, 0.54 / (L.id.length * 0.5));
      parts.forEach((p, i) => {
        const t = el('text', { x: L.x, y: L.z + (parts.length === 2 ? (i ? 0.3 : -0.06) : 0.1), 'font-size': fs }, g);
        t.textContent = p;
      });
      g.addEventListener('click', () => { if (!moved) openRack(r); });
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRack(r); } });
      groups.set(r, g);
    }
  }
  function paint() {
    for (const [r, g] of groups) {
      const dim = !!CB.hits && !CB.hits.has(r);
      let col;
      if (INV) col = rackLook(r).col; else grad(W.mode, modeValue(W.mode, r), tmp), col = tmp;
      g.querySelector('rect').setAttribute('fill', css(col));
      g.classList.toggle('dim', dim);
      const n = r.servers.length, m = CB.hits && CB.hits.get(r);
      g.setAttribute('aria-label', `Rack ${r.id}, ${n} server${n === 1 ? '' : 's'}${m ? `, ${m.n} ${m.n === 1 ? 'match' : 'matches'}` : ''}. Open in 3D`);
    }
  }
  function view() {
    const w = svg.clientWidth || innerWidth, h = svg.clientHeight || innerHeight;
    svg.setAttribute('viewBox', `${cx - w / (2 * k)} ${cz - h / (2 * k)} ${w / k} ${h / k}`);
  }
  function fit() {
    const w = svg.clientWidth || innerWidth, h = svg.clientHeight || innerHeight;
    const phone = innerWidth <= 720, top = phone ? 150 : PAD.t, r = phone ? 20 : PAD.r, bot = phone ? 150 : PAD.b;
    k = Math.max(4, Math.min((w - PAD.l - r) / (2 * ROOM.x + 1.6), (h - top - bot) / (2 * ROOM.z + 1.6)));
    cx = 0; cz = -(top - bot) / 2 / k;
    view();
  }
  const zoom = (f, px, py) => {
    const w = svg.clientWidth, h = svg.clientHeight, nk = Math.max(4, Math.min(400, k * f));
    if (px === undefined) { px = w / 2; py = h / 2; }
    // keep the point under the cursor where it is
    cx += (px - w / 2) * (1 / k - 1 / nk); cz += (py - h / 2) * (1 / k - 1 / nk); k = nk; view();
  };
  let moved = false, drag = null;
  svg.addEventListener('wheel', e => { e.preventDefault(); const b = svg.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - b.left, e.clientY - b.top); }, { passive: false });
  svg.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; moved = false; });
  svg.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!moved && Math.hypot(dx, dy) < 5) return;
    if (!moved) svg.setPointerCapture(e.pointerId);
    moved = true; cx -= dx / k; cz -= dy / k; drag = { x: e.clientX, y: e.clientY }; view();
  });
  const end = () => { drag = null; setTimeout(() => { moved = false; }, 0); };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  $('planIn').addEventListener('click', () => zoom(1.4));
  $('planOut').addEventListener('click', () => zoom(1 / 1.4));
  $('planFit').addEventListener('click', fit);
  $('plan3d').addEventListener('click', () => show(false));
  window.addEventListener('resize', () => { if (on) fit(); });
  btn.addEventListener('click', () => show(!on));

  function show(v) {
    if (v === on) return;
    on = v;
    if (on) { if (!built) build(); paint(); }
    svg.toggleAttribute('hidden', !on); bar.hidden = !on;   // (an SVG element has no .hidden property)
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? 'Back to 3D' : 'Plan view';
    document.documentElement.classList.toggle('planning', on);
    if (on) { fit(); btn.focus({ preventScroll: true }); }
    onChange(on);
  }
  return { show, isOn: () => on, refresh: () => { if (on) paint(); } };
}
