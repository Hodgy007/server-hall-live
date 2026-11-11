// What colours the racks and servers in inventory mode, without three.js or the DOM so it runs under `node --test`:
// fill level, role, manufacturer, model and age. Fill is one value per rack. For the other four every server has its
// own value (a category, or its age) and a rack is the mix of what it holds, since most racks hold more than one
// model and role. Categories beyond the first few share an "Other" colour so the legend stays short.
import { MAX_U } from './site.js';

export const BY = [
  { id: 'fill', label: 'Fill' }, { id: 'role', label: 'Role' }, { id: 'maker', label: 'Make' },
  { id: 'model', label: 'Model' }, { id: 'age', label: 'Age' }
];
// Scales for the two numeric modes: [value, colour]. Fill is the share of the usable U (1–38) that servers take;
// age is the years since the oldest server in the rack went into service.
export const FILL_STOPS = [[0, '#2f4d63'], [0.5, '#2a8fbf'], [1, '#9be7ff']];
export const AGE_STOPS = [[0, '#2a8fbf'], [2, '#3fcf8e'], [4, '#f2b441'], [6, '#ff5a4f']];
export const PALETTE = ['#4fc3e8', '#f2b441', '#3fcf8e', '#c77dff', '#ff7a90', '#9bd14b', '#ff9f5a', '#7b8cff'];
export const OTHER = '#8a9aa6', NONE = '#34414c';   // "Other" categories; racks with nothing to show (empty, or no date)
export const MIXED = '#566571';   // a cabinet holding more than one category: its servers and column carry the colours
export const MAX_CATEGORIES = PALETTE.length;

// ---------- Dates ----------
// 2021-03-15, 2021-03, 2021, 15/03/2021 (day first) and 15.03.2021 → a Date (UTC), or null
export function parseDate(s) {
  s = String(s === undefined || s === null ? '' : s).trim(); if (!s) return null;
  let m = /^(\d{4})(?:[-/.](\d{1,2})(?:[-/.](\d{1,2}))?)?(?:[T ].*)?$/.exec(s), y, mo, d;
  if (m) { y = +m[1]; mo = m[2] ? +m[2] : 1; d = m[3] ? +m[3] : 1; }
  else if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1970 || y > 2200) return null;
  return new Date(Date.UTC(y, mo - 1, d));
}
// Years from the in-service date to `now`, or null when there is no usable date; never negative
export function ageYears(installed, now = new Date()) {
  const d = parseDate(installed); if (!d) return null;
  return Math.max(0, (now.getTime() - d.getTime()) / (365.25 * 864e5));
}

// ---------- Values for one rack ----------
export const usedU = servers => servers.reduce((t, s) => t + s.h, 0);
export const fillOf = servers => Math.min(1, usedU(servers) / MAX_U);
export function oldest(servers, now) {
  let best = null;
  for (const s of servers) { const a = ageYears(s.installed, now); if (a !== null && (best === null || a > best)) best = a; }
  return best;
}
const NOT_RECORDED = 'Not recorded';
const label = { role: s => s.role, maker: s => (s.maker === 'Generic' ? '' : s.maker), model: s => s.model };
// One server's category for role, make or model; "Not recorded" when its record says nothing
export const serverCategory = (s, by) => String(label[by](s) || '').trim() || NOT_RECORDED;
// What a rack holds for role, make or model: [{ label, u, n }] (rack units and servers per category), most U first
// (ties: alphabetically). Empty for a rack with no servers.
export function rackMix(servers, by) {
  const m = new Map();
  for (const s of servers) {
    const k = serverCategory(s, by), e = m.get(k) || { label: k, u: 0, n: 0 };
    e.u += s.h; e.n++; m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.u - a.u || a.label.localeCompare(b.label));
}
// The category taking the most U in a rack, or null for a rack with no servers
export function rackCategory(servers, by) {
  const mix = rackMix(servers, by);
  return mix.length ? mix[0].label : null;
}
// The same for age: servers grouped by whole years in service (6 and over together), oldest first, then those with no
// date. [{ years (the group's mean age, null for no date), u, n }]
export function ageMix(servers, now) {
  const m = new Map();
  for (const s of servers) {
    const a = ageYears(s.installed, now), k = a === null ? -1 : Math.min(6, Math.floor(a)), e = m.get(k) || { k, sum: 0, u: 0, n: 0 };
    e.sum += a || 0; e.u += s.h; e.n++; m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.k - a.k).map(e => ({ years: e.k < 0 ? null : e.sum / e.n, u: e.u, n: e.n }));
}
// Colour for each category: the most common ones in palette order, everything past the cap sharing "Other".
// values: one category (or null) per server. Returns { list: [{ label, colour, count }], colourOf(label), orderOf(label) }
// (orderOf is the label's place in the legend, for stacking a rack's mix in the same order everywhere)
export function buildCategories(values, cap = MAX_CATEGORIES) {
  const n = new Map();
  for (const v of values) if (v !== null && v !== undefined) n.set(v, (n.get(v) || 0) + 1);
  const sorted = [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  // "Not recorded" never takes a palette colour of its own
  const named = sorted.filter(([k]) => k !== NOT_RECORDED), keep = named.slice(0, cap), rest = named.slice(cap);
  const colours = new Map(keep.map(([k], i) => [k, PALETTE[i]]));
  const list = keep.map(([k, c]) => ({ label: k, colour: colours.get(k), count: c }));
  const otherN = rest.reduce((t, [, c]) => t + c, 0);
  if (otherN) list.push({ label: `Other (${rest.length})`, colour: OTHER, count: otherN });
  if (n.has(NOT_RECORDED)) list.push({ label: NOT_RECORDED, colour: NONE, count: n.get(NOT_RECORDED) });
  const order = new Map(keep.map(([k], i) => [k, i]));
  return {
    list, colourOf: v => v === null || v === undefined || v === NOT_RECORDED ? NONE : colours.get(v) || OTHER,
    orderOf: v => v === NOT_RECORDED ? cap + 1 : order.has(v) ? order.get(v) : cap
  };
}

// ---------- Monitoring mode: each server's own figure for the tab beside its front ----------
// A rack is coloured by its roll-up, but the busy or hot server in it is the point, so the tab shows the server's own
// telemetry: CPU load (0-1) for load, its draw against its flat-out figure for power, and its CPU temperature for heat
// (inlet temperature belongs to the rack; each server's temp is simulated, or reported by the feed, per server).
export const TAB_SCALE = { load: 'load', heat: 'cpu', power: 'power' };
export const TAB_NOTE = {
  load: 'CPU load of each server',
  heat: 'CPU temperature of each server (the racks show inlet air)',
  power: 'draw of each server against its flat-out figure'
};
const fin = v => (Number.isFinite(v) ? v : 0);
export function tabValue(mode, sv) {
  if (mode === 'heat') return fin(sv.temp);
  if (mode === 'power') { const w = sv.spec && sv.spec.w && sv.spec.w[1]; return w > 0 ? fin(sv.power / w) : 0; }
  return fin(sv.load);
}
