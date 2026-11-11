// Rack and server colouring, and the rack filter. In inventory mode the hall is coloured by what is in it (fill, role,
// make, model or age, see colorby.js). Fill is one colour per rack. For the others every server carries its own colour
// on a tab at the left of its front, and the column over a rack is stacked to show the rack's mix, because most racks
// hold more than one model and role; the cabinet itself is only tinted when everything in it is the same. In either
// mode a filter query lights the racks that hold matching servers and dims the rest, the way the capacity finder does.
// This module holds the state; visuals.js, hud.js and plan.js read it.
import { THREE, lc, gradIn } from './core.js';
import { UI } from './state.js';
import { racks, allServers, markServers, paintTabs } from './racks.js';
import { FILL_STOPS, AGE_STOPS, NONE, MIXED, fillOf, oldest, serverCategory, rackMix, ageMix, buildCategories, ageYears } from './colorby.js';
import { matchRecord, tokens } from './search.js';
import { MAX_U } from './site.js';
import { INV } from './mode.js';

const NOW = new Date();
const lin = s => s.map(([v, c]) => [v, lc(c)]);
const FILL = lin(FILL_STOPS), AGE = lin(AGE_STOPS), noneC = lc(NONE), mixedC = lc(MIXED), darkC = lc('#141b22');
const asCss = c => '#' + new THREE.Color().copy(c).convertLinearToSRGB().getHexString();
const NOTE = { role: 'role', maker: 'make', model: 'model' };

// by: the colour mode; hits: rack → { n servers, u rack units } for the filter (null when it is empty); rev counts changes
export const CB = { by: 'fill', q: '', hits: null, svHits: null, nServers: 0, rev: 0, cats: null, legend: null };
const look = new Map(), hexCache = new Map();
const catColour = hex => { if (!hexCache.has(hex)) hexCache.set(hex, lc(hex)); return hexCache.get(hex); };
const perServer = () => INV && CB.by !== 'fill';

// How one rack looks for the servers `recs` (all of its own, or the ones the filter matches): the cabinet's colour,
// its column's height h and, when the servers differ, the column's segments from the bottom up (shares of its height)
function lookFor(r, recs, h) {
  const by = CB.by, col = new THREE.Color();
  if (by === 'fill') return { col: gradIn(FILL, fillOf(r.recs), col), h, segs: null };
  let parts;   // [{ col, u }] in legend order
  if (by === 'age') {
    parts = ageMix(recs, NOW).map(e => ({ col: e.years === null ? noneC : gradIn(AGE, e.years, new THREE.Color()), u: e.u }));
    const a = oldest(recs, NOW); if (a === null) col.copy(noneC); else gradIn(AGE, a, col);
  } else {
    // categories sharing a colour ("Other") make one segment
    const m = new Map();
    for (const e of rackMix(recs, by)) {
      const k = CB.cats.orderOf(e.label), p = m.get(k) || { k, col: catColour(CB.cats.colourOf(e.label)), u: 0 };
      p.u += e.u; m.set(k, p);
    }
    parts = [...m.values()].sort((a, b) => a.k - b.k);
    col.copy(parts.length === 1 ? parts[0].col : parts.length ? mixedC : noneC);
  }
  const total = parts.reduce((t, p) => t + p.u, 0);
  return { col, h, segs: parts.length > 1 ? parts.map(p => ({ col: p.col, css: asCss(p.col), frac: p.u / total })) : null };
}

// Work out every rack's and server's colour for the current mode and filter (the data does not change, so this runs
// when one of those does)
function rebuild() {
  const by = CB.by, cat = by === 'role' || by === 'maker' || by === 'model';
  CB.cats = cat ? buildCategories(allServers.map(sv => serverCategory(sv.rec, by))) : null;
  look.clear();
  for (const r of racks) {
    const hit = CB.hits && CB.hits.get(r);
    look.set(r, hit ? lookFor(r, r.servers.filter(sv => CB.svHits.has(sv)).map(sv => sv.rec), Math.min(1, 0.15 + hit.u / MAX_U)) : lookFor(r, r.recs, fillOf(r.recs)));
  }
  const tail = CB.hits ? '. Servers and racks without a match are dark.' : '';
  CB.legend = by === 'fill'
    ? { kind: 'scale', stops: FILL_STOPS, lo: 0, hi: 1, ticks: [[0, '0'], [0.5, '19U'], [1, '38U used']], note: 'Used U of the 38 usable in each rack' + (CB.hits ? '. Racks without a match are dark.' : '') }
    : by === 'age'
      ? { kind: 'scale', stops: AGE_STOPS, lo: 0, hi: 6, ticks: [[0, 'new'], [2, '2 yr'], [4, '4 yr'], [6, '6+ yr']], note: 'Years in service. Each server\'s colour is on the left of its front; the column over a rack shows its mix by U and the cabinet takes its oldest server. Grey: no date recorded' + tail }
      : { kind: 'cats', list: CB.cats.list, note: `Number of servers of each ${NOTE[by]}. Each server's colour is on the left of its front; the column over a rack shows its mix by U. A cabinet is tinted only when it holds one ${NOTE[by]}` + tail };
  // Servers the filter leaves out lose their colour; in fill mode (and monitoring mode) servers carry none
  paintTabs(perServer() ? sv => (CB.svHits && !CB.svHits.has(sv) ? darkC : serverColour(sv)) : null);
  CB.rev++;
}
// A rack's look: { col, h, segs }. While the filter is on, a matching rack's is worked out from its matching servers.
export const rackLook = r => look.get(r) || { col: noneC, h: 0, segs: null };
// The colour of one server: its category, or its age; fill has no per-server colour (null)
function serverColour(sv) {
  const by = CB.by, rec = sv.rec;
  if (by === 'age') { const a = ageYears(rec.installed, NOW); return a === null ? noneC : gradIn(AGE, a, new THREE.Color()); }
  return CB.cats ? catColour(CB.cats.colourOf(serverCategory(rec, by))) : null;
}
// The same for the panels: a CSS colour and what it stands for, or null when servers carry no colour
export function serverTag(sv) {
  if (!perServer()) return null;
  const by = CB.by, rec = sv.rec;
  if (by === 'age') { const a = ageYears(rec.installed, NOW); return { css: asCss(serverColour(sv)), text: a === null ? 'No in-service date' : a < 1 ? 'Under a year in service' : `${Math.floor(a)} year${a < 2 ? '' : 's'} in service` }; }
  return { css: CB.cats.colourOf(serverCategory(rec, by)), text: serverCategory(rec, by) };
}
export function setBy(by) { CB.by = by; rebuild(); }

// The filter: which racks and servers match, and how many
export function setQuery(q) {
  CB.q = String(q || '').trim();
  const t = tokens(CB.q);
  CB.hits = null; CB.svHits = null; CB.nServers = 0;
  if (t.length) {
    CB.hits = new Map(); CB.svHits = new Set();
    for (const r of racks) {
      let n = 0, u = 0;
      for (const sv of r.servers) if (matchRecord(sv.rec, t)) { n++; u += sv.h; CB.svHits.add(sv); }
      if (n) CB.hits.set(r, { n, u });
      CB.nServers += n;
    }
  }
  rebuild();
}

// Mark the matching servers on the front of the rack in rack view (see racks.markServers); cheap when nothing changed
let markedKey = '';
export function syncMarks() {
  const key = CB.rev + '|' + (CB.svHits && UI.cutRack ? UI.cutRack.id : '');
  if (key === markedKey) return;
  markedKey = key;
  markServers(CB.svHits && UI.cutRack ? { set: CB.svHits, rack: UI.cutRack } : null);
}
