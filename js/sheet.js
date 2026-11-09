// The whole-site inventory table, without the DOM: its columns, a row for each server, filtering, sorting and the rows
// the CSV export writes. Plain JavaScript with no three.js, so it runs under `node --test`.
import { matchRecord, tokens, natural } from './search.js';

const join = list => list.filter(Boolean).join('; ');
// get(server record, its hall) → text or number. `csv` is the header Export CSV writes (parseServers reads them all back).
export const COLUMNS = [
  { id: 'host', label: 'Host', csv: 'Host', get: s => s.host },
  { id: 'building', label: 'Building', csv: 'Building', get: (s, h) => h ? h.building : '' },
  { id: 'room', label: 'Hall', csv: 'Hall', get: (s, h) => h ? h.room : '' },
  { id: 'rack', label: 'Rack', csv: 'Rack', get: s => s.rack },
  { id: 'u', label: 'U', csv: 'U', num: true, get: s => s.u },
  { id: 'h', label: 'Height', csv: 'Height', num: true, get: s => s.h },
  { id: 'maker', label: 'Make', csv: 'Manufacturer', get: s => s.maker === 'Generic' ? '' : s.maker },
  { id: 'model', label: 'Model', csv: 'Model', get: s => s.maker === 'Generic' && s.model === 'Server' ? '' : s.model },
  { id: 'serial', label: 'Serial', csv: 'Serial', get: s => s.serial },
  { id: 'ip', label: 'IP', csv: 'IP', get: s => join(s.ips.map(a => a.address)) },
  { id: 'oob', label: 'OOB', csv: 'OOB', get: s => s.oob.ip },
  { id: 'role', label: 'Role', csv: 'Role', get: s => s.role },
  { id: 'os', label: 'OS', csv: 'OS', get: s => s.os },
  { id: 'installed', label: 'In service', csv: 'In service', get: s => s.installed }
];

// One row per server: its record, its hall and the cells as text
export const buildRows = (servers, hallById) => servers.map(rec => {
  const hall = hallById.get(rec.hall) || null;
  return { rec, cells: COLUMNS.map(c => { const v = c.get(rec, hall); return v === undefined || v === null || (c.num && !Number.isFinite(v)) ? '' : String(v); }) };
});

export const filterRows = (rows, q) => { const t = tokens(q); return t.length ? rows.filter(r => matchRecord(r.rec, t)) : rows; };

// Sorted by one column (blank cells last whichever way it runs); no column gives the physical order: building, hall,
// rack, then U from the top of the rack down
export function sortRows(rows, colId, dir = 1) {
  const c = COLUMNS.findIndex(x => x.id === colId);
  const by = (a, b, i, num) => num ? (+a.cells[i] || 0) - (+b.cells[i] || 0) : natural(a.cells[i], b.cells[i]);
  if (c < 0) {
    const [b, r, rk, u] = ['building', 'room', 'rack', 'u'].map(id => COLUMNS.findIndex(x => x.id === id));
    return rows.slice().sort((a, z) => by(a, z, b) || by(a, z, r) || by(a, z, rk) || by(z, a, u, true) || natural(a.rec.host, z.rec.host));
  }
  const num = !!COLUMNS[c].num;
  return rows.slice().sort((a, z) => {
    const x = a.cells[c], y = z.cells[c];
    if (x === '' || y === '') return x === y ? 0 : x === '' ? 1 : -1;
    return dir * by(a, z, c, num) || natural(a.rec.host, z.rec.host);
  });
}

// The rows as a header and lines for toCSV
export const csvRows = rows => [COLUMNS.map(c => c.csv), ...rows.map(r => r.cells)];
