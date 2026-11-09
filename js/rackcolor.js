// Rack colouring and the rack filter. In inventory mode a rack is coloured by what is in it (fill, role, make, model or
// age, see colorby.js); in either mode a filter query lights the racks that hold matching servers and dims the rest,
// the way the capacity finder does. This module holds the state; visuals.js, hud.js and plan.js read it.
import { THREE, lc, gradIn } from './core.js';
import { UI } from './state.js';
import { racks, markServers } from './racks.js';
import { FILL_STOPS, AGE_STOPS, NONE, fillOf, oldest, rackCategory, buildCategories, ageYears, usedU } from './colorby.js';
import { matchRecord, tokens } from './search.js';

const NOW = new Date();
const lin = s => s.map(([v, c]) => [v, lc(c)]);
const FILL = lin(FILL_STOPS), AGE = lin(AGE_STOPS), noneC = lc(NONE);
const asCss = c => '#' + new THREE.Color().copy(c).convertLinearToSRGB().getHexString();

// by: the colour mode; hits: rack → { n servers, u rack units } for the filter (null when it is empty); rev counts changes
export const CB = { by: 'fill', q: '', hits: null, svHits: null, nServers: 0, rev: 0, cats: null, legend: null };
const look = new Map(), catOf = new Map(), hexCache = new Map();
const catColour = (hex) => { if (!hexCache.has(hex)) hexCache.set(hex, lc(hex)); return hexCache.get(hex); };

// Work out every rack's colour for the current mode (the data does not change, so this runs when the mode does)
export function recolour() {
  const by = CB.by, cat = by === 'role' || by === 'maker' || by === 'model';
  const vals = cat ? racks.map(r => rackCategory(r.recs, by)) : null;
  const cats = cat ? buildCategories(vals) : null;
  CB.cats = cats; catOf.clear();
  racks.forEach((r, i) => {
    const col = new THREE.Color(), fill = fillOf(r.recs);
    if (by === 'fill') gradIn(FILL, fill, col);
    else if (by === 'age') { const a = oldest(r.recs, NOW); if (a === null) col.copy(noneC); else gradIn(AGE, a, col); }
    else col.copy(catColour(cats.colourOf(vals[i])));
    look.set(r, { col, h: fill });
  });
  CB.legend = by === 'fill'
    ? { kind: 'scale', stops: FILL_STOPS, lo: 0, hi: 1, ticks: [[0, '0'], [0.5, '19U'], [1, '38U used']], note: 'Used U of the 38 usable in each rack' }
    : by === 'age'
      ? { kind: 'scale', stops: AGE_STOPS, lo: 0, hi: 6, ticks: [[0, 'new'], [2, '2 yr'], [4, '4 yr'], [6, '6+ yr']], note: 'Years since the oldest server in the rack went into service; grey: no date recorded', none: true }
      : { kind: 'cats', list: cats.list, note: by === 'role' ? 'Role taking the most U in each rack' : by === 'maker' ? 'Make taking the most U in each rack' : 'Model taking the most U in each rack' };
  CB.rev++;
}
export const rackLook = r => look.get(r) || { col: noneC, h: 0 };
// The colour of one server (for the rack panel's strip): its category, or its age; fill has no per-server colour
export function serverCss(sv) {
  const by = CB.by, rec = sv.rec;
  if (by === 'age') { const a = ageYears(rec.installed, NOW); return a === null ? NONE : asCss(gradIn(AGE, a, new THREE.Color())); }
  return CB.cats ? CB.cats.colourOf(rackCategory([rec], by)) : null;
}
export function setBy(by) { CB.by = by; recolour(); }

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
  CB.rev++;
}
export const filtering = () => !!CB.hits;

// Mark the matching servers on the front of the rack in rack view (see racks.markServers); cheap when nothing changed
let markedKey = '';
export function syncMarks() {
  const key = CB.rev + '|' + (CB.svHits && UI.cutRack ? UI.cutRack.id : '');
  if (key === markedKey) return;
  markedKey = key;
  markServers(CB.svHits && UI.cutRack ? { set: CB.svHits, rack: UI.cutRack } : null);
}
export { usedU };
