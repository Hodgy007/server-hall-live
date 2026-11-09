// What colours a rack in inventory mode, without three.js or the DOM so it runs under `node --test`: fill level, role,
// manufacturer, model and age. A rack gets a value (fill, age) or a category (the other three); categories beyond the
// first few share an "Other" colour so the legend stays short.
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
// The category a rack falls in for role, make or model: the one taking the most U (ties: the first alphabetically).
// A rack with no servers has none (null); one whose servers say nothing gets "Not recorded".
export function rackCategory(servers, by) {
  if (!servers.length) return null;
  const u = new Map();
  for (const s of servers) { const k = String(label[by](s) || '').trim() || NOT_RECORDED; u.set(k, (u.get(k) || 0) + s.h); }
  return [...u].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}
// Colour for each category: the most common ones in palette order, everything past the cap sharing "Other".
// values: one category (or null) per rack. Returns { list: [{ label, colour, count }], other: n, colourOf(label) }
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
  return { list, colourOf: v => v === null || v === undefined || v === NOT_RECORDED ? NONE : colours.get(v) || OTHER };
}
