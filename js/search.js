// Search over servers and racks: one matcher for the Find box, the inventory table's filter and the rack colouring
// filter. Plain JavaScript with no three.js and no DOM, so it runs under `node --test`.
// It works on normalised server records (the objects site.js builds): host, rack, serial, ips, nics, oob, model, maker,
// role, os and installed.

export const normMac = s => String(s === undefined || s === null ? '' : s).toLowerCase().replace(/[^0-9a-f]/g, '');
export const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });

// The fields a query is looked for in, best first (the first that matches is the one reported)
export const FIELDS = ['Hostname', 'Rack', 'Serial', 'IP address', 'NIC MAC', 'OOB address', 'OOB MAC', 'Model', 'Manufacturer', 'Role', 'OS', 'In service'];
const cache = new WeakMap();
// [{ label, values: [lower-case text], mac: [hex only] }] for a record, built once
function fieldsOf(r) {
  let f = cache.get(r); if (f) return f;
  const v = x => (x === undefined || x === null ? '' : String(x).trim());
  const lc = list => list.map(v).filter(Boolean).map(s => s.toLowerCase());
  const nics = (r.nics || []).map(n => n && n.mac), oob = r.oob || {};
  f = [
    { label: 'Hostname', values: lc([r.host]) },
    { label: 'Rack', values: lc([r.rack]) },
    { label: 'Serial', values: lc([r.serial]) },
    { label: 'IP address', values: lc((r.ips || []).map(a => a.address)) },
    { label: 'NIC MAC', values: lc(nics), mac: nics.map(normMac).filter(Boolean) },
    { label: 'OOB address', values: lc([oob.ip]) },
    { label: 'OOB MAC', values: lc([oob.mac]), mac: [normMac(oob.mac)].filter(Boolean) },
    { label: 'Model', values: lc([r.model]) },
    { label: 'Manufacturer', values: lc([r.maker]) },
    { label: 'Role', values: lc([r.role]) },
    { label: 'OS', values: lc([r.os]) },
    { label: 'In service', values: lc([r.installed]) }
  ];
  cache.set(r, f);
  return f;
}
// A token looks like (part of) a MAC address when it is made of hex digits and : - . separators and holds at least
// three bytes' worth; shorter ones ("2021", "db") are left to the text fields so they do not match every address
const MAC_TOKEN = /^[0-9a-f]+([:.-][0-9a-f]+)*$/;
const macQuery = t => (MAC_TOKEN.test(t) && normMac(t).length >= 6 ? normMac(t) : '');

// The first field (best first) the token is in: { field, value } or null
function tokenHit(f, t) {
  const mq = macQuery(t);
  for (const x of f) {
    const hit = x.values.find(s => s.includes(t));
    if (hit) return { field: x.label, value: hit, exact: hit === t };
    if (mq && x.mac && x.mac.some(m => m.includes(mq))) return { field: x.label, value: x.values[x.mac.findIndex(m => m.includes(mq))], exact: false };
  }
  return null;
}
export const tokens = q => String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
// Does a record match the query? Every word of it must be found somewhere (so "dell r760" works). Returns
// { field, value } for the first word, or null.
export function matchRecord(rec, q) {
  const t = Array.isArray(q) ? q : tokens(q); if (!t.length) return null;
  const f = fieldsOf(rec); let first = null;
  for (const w of t) { const h = tokenHit(f, w); if (!h) return null; if (!first) first = h; }
  return first;
}

// Everything that matches, best first: servers (kind "host") and, for a one-word query, racks whose ID contains it
// (kind "rack"). servers: normalised records with .hall; racks: [{ id, hall }].
export function searchAll(servers, racks, q) {
  const t = tokens(q); if (!t.length) return [];
  const hits = [];
  for (const rec of servers) {
    const m = matchRecord(rec, t); if (!m) continue;
    hits.push({ kind: 'host', rec, host: rec.host, rack: rec.rack, u: rec.u, h: rec.h, hall: rec.hall, field: m.field, value: m.value,
      rank: (m.field === 'Hostname' ? (rec.host.toLowerCase() === t[0] ? 0 : rec.host.toLowerCase().startsWith(t[0]) ? 1 : 2) : 3) * 100 + FIELDS.indexOf(m.field) });
  }
  if (t.length === 1) for (const r of racks) {
    const id = r.id.toLowerCase(); if (!id.includes(t[0])) continue;
    hits.push({ kind: 'rack', host: '', rack: r.id, u: null, h: 0, hall: r.hall, field: 'Rack ID', value: id, rank: id === t[0] ? -1 : 150 });
  }
  return hits.sort((a, b) => a.rank - b.rank || natural(a.rack, b.rack) || (b.u || 0) - (a.u || 0) || natural(a.host, b.host));
}
// An exact hostname or rack ID, which Find goes straight to: { kind, host?, rack, hall } or null
export function exactTarget(servers, racks, q) {
  const k = String(q || '').trim().toLowerCase(); if (!k) return null;
  const sv = servers.find(s => s.host.toLowerCase() === k);
  if (sv) return { kind: 'host', host: sv.host, rack: sv.rack, hall: sv.hall };
  const r = racks.find(x => x.id.toLowerCase() === k);
  return r ? { kind: 'rack', rack: r.id, hall: r.hall } : null;
}
