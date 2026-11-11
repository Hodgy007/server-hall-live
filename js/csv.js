// CSV for server lists: a parser that copes with what spreadsheets write, the header names it understands, and the
// writer behind "Export CSV". Plain JavaScript with no three.js and no DOM, so it runs under `node --test` and in the
// layout editor. Rows become server records in the site file's format (site.js normalises them as it does any record).

// ---------- Parsing ----------
// The delimiter is whichever of , ; or tab appears most in the header line (outside quotes); ties go to the comma
export function detectDelimiter(text) {
  const count = { ',': 0, ';': 0, '\t': 0 };
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') quoted = !quoted;
    else if (!quoted && (c === '\n' || c === '\r')) break;
    else if (!quoted && c in count) count[c]++;
  }
  return [',', ';', '\t'].reduce((best, d) => (count[d] > count[best] ? d : best), ',');
}

// Text to rows of fields. Quoted fields may hold the delimiter, line breaks and doubled quotes; a BOM, CRLF, LF or CR
// line ends are all fine. Every record is returned, blank ones included, so row n is the n-th row of the sheet.
export function parseCSV(text, delimiter) {
  text = String(text).replace(/^﻿/, '');
  const d = delimiter || detectDelimiter(text), rows = [];
  let row = [], field = '', quoted = false, started = false, unterminated = false;
  const endField = () => { row.push(field); field = ''; started = false; };
  const endRow = () => { endField(); rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"' && !started && field === '') { quoted = true; started = true; }
    else if (c === d) endField();
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; endRow(); }
    else { field += c; started = true; }
  }
  if (quoted) unterminated = true;
  if (field !== '' || row.length || started) endRow();
  return { rows, delimiter: d, unterminated };
}

// Rows to text. Fields are quoted when they need it. With `safe` (the default) a value a spreadsheet would run as a
// formula gets a leading ' (parseServers takes it off again, so a file written here reads back the same).
const FORMULA = /^[=+\-@]/;
export function toCSV(rows, { delimiter = ',', eol = '\r\n', bom = false, safe = true } = {}) {
  const cell = v => {
    let s = v === undefined || v === null ? '' : String(v);
    if (safe && FORMULA.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s)) s = "'" + s;   // plain numbers are not formulas
    return /[",\r\n\t;]|^\s|\s$/.test(s) || s.includes(delimiter) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return (bom ? '﻿' : '') + rows.map(r => r.map(cell).join(delimiter)).join(eol) + (rows.length ? eol : '');
}

// ---------- Header names ----------
// Header text is compared lower case with everything but letters and digits removed: "U position", "u_position" and
// "U-Position" are all "uposition".
export const norm = s => String(s === undefined || s === null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
export const ALIASES = {
  host: ['host', 'hostname', 'name', 'servername', 'server', 'devicename'],
  rack: ['rack', 'cab', 'cabinet', 'rackid', 'rackname', 'cabinetid'],
  u: ['u', 'position', 'uposition', 'rackposition', 'rackunit', 'startu', 'lowestu', 'bottomu'],
  height: ['height', 'size', 'ru', 'uheight', 'usize', 'rackunits', 'units', 'heightu'],
  building: ['building', 'site', 'bldg', 'datacenter', 'datacentre', 'dc'],
  room: ['room', 'hall', 'datahall', 'suite'],
  manufacturer: ['manufacturer', 'make', 'vendor', 'brand', 'maker'],
  model: ['model', 'servermodel', 'hardwaremodel', 'productname'],
  serial: ['serial', 'serialnumber', 'serialno', 'servicetag', 'assettag', 'sn', 'tag'],
  ip: ['ip', 'ipaddress', 'ipaddresses', 'ips', 'ipv4', 'ipaddr', 'primaryip'],
  oob: ['oob', 'oobaddress', 'oobip', 'idrac', 'idracip', 'idracaddress', 'ilo', 'iloip', 'iloaddress', 'bmc', 'bmcip', 'bmcaddress', 'ipmi', 'ipmiip', 'drac', 'managementip', 'mgmtip'],
  oobMac: ['oobmac', 'idracmac', 'ilomac', 'bmcmac', 'ipmimac'],
  mac: ['mac', 'macaddress', 'macaddresses', 'macs', 'nicmac', 'nicmacs'],
  role: ['role', 'function', 'workload', 'purpose'],
  os: ['os', 'operatingsystem', 'osname'],
  installed: ['installed', 'inservice', 'inservicedate', 'installdate', 'installeddate', 'dateinstalled', 'commissioned', 'deployed', 'deploymentdate'],
  cpu: ['cpu', 'processor', 'cpumodel'],
  memory: ['memory', 'ram', 'memorygb', 'ramgb', 'mem']
};
const BY_NAME = new Map(Object.entries(ALIASES).flatMap(([f, names]) => names.map(n => [n, f])));
// Which field a header names, or null
export const fieldOf = header => BY_NAME.get(norm(header)) || null;

// ---------- Servers ----------
const list = s => String(s).split(/[;,|\s]+/).map(x => x.trim()).filter(Boolean);
// "12", "U12", "u12-13" → { u: 12, to: 13 }
function parseU(s) {
  const m = /^u?\s*(\d+)\s*(?:[-–]\s*u?\s*(\d+))?$/i.exec(s);
  return m ? { u: +m[1], to: m[2] ? +m[2] : null } : null;
}
// "2x Intel Xeon Gold 6430" → { sockets: 2, model } like the older file format; anything else is just the model
function parseCpu(s) {
  const m = /^(\d+)\s*[×x]\s*(.+)$/i.exec(s);
  return m ? { sockets: +m[1], model: m[2].trim() } : { model: s };
}

// A sheet to server records. Returns { records, problems, columns, ignored, delimiter, rows, error }:
//   records   server records in the site file's format, each with csvRow (its row number in the sheet, header = 1)
//   problems  in words, with row numbers, for rows that could not be used and columns that were ignored
//   columns   { field: header as written }
//   error     set (and records empty) when the sheet has no hostname column at all
export function parseServers(text) {
  const { rows, delimiter, unterminated } = parseCSV(text);
  const out = { records: [], problems: [], columns: {}, ignored: [], delimiter, rows: 0, error: '' };
  const headRow = rows.findIndex(r => r.some(c => c.trim() !== ''));
  if (headRow < 0) { out.error = 'The file is empty.'; return out; }
  const idx = {};   // field → column
  rows[headRow].forEach((h, c) => {
    const f = fieldOf(h);
    if (!f) { if (h.trim()) out.ignored.push(h.trim()); return; }
    if (f in idx) { out.problems.push(`Column "${h.trim()}" is ignored: "${rows[headRow][idx[f]].trim()}" already gives the ${f === 'u' ? 'U position' : f}`); return; }
    idx[f] = c; out.columns[f] = h.trim();
  });
  if (!('host' in idx)) { out.error = 'No hostname column found: name one of the columns host, hostname or name.'; return out; }
  if (out.ignored.length) out.problems.push(`Columns not recognised, so ignored: ${out.ignored.join(', ')}`);
  if (!('rack' in idx)) out.problems.push('No rack column found (rack, cab or cabinet): servers cannot be placed in a rack without it');
  if (!('u' in idx)) out.problems.push('No U position column found (u, position or u position): servers cannot be placed in a rack without it');
  if (unterminated) out.problems.push('A quoted value is never closed, so the rows after it were read as part of it');
  const seen = new Map();
  for (let i = headRow + 1; i < rows.length; i++) {
    const row = rows[i], n = i + 1;
    if (row.every(c => c.trim() === '')) continue;
    out.rows++;
    // a leading ' protecting a formula-looking value (see toCSV) comes off again
    const get = f => { if (!(f in idx)) return ''; const v = (row[idx[f]] || '').trim(); return /^'[=+\-@]/.test(v) ? v.slice(1) : v; };
    const host = get('host');
    if (!host) { out.problems.push(`Row ${n}: no hostname, so the row was skipped`); continue; }
    const k = host.toLowerCase();
    if (seen.has(k)) { out.problems.push(`Row ${n}: ${host} is already on row ${seen.get(k)}, so this row was skipped`); continue; }
    seen.set(k, n);
    const rec = { host, csvRow: n };
    for (const f of ['building', 'room', 'rack', 'manufacturer', 'model', 'serial', 'role', 'os', 'installed']) { const v = get(f); if (v) rec[f] = v; }
    const u = get('u');
    if (u) { const p = parseU(u); if (p) { rec.u = p.u; if (p.to && p.to >= p.u) rec.height = p.to - p.u + 1; } else out.problems.push(`Row ${n}: ${host}: U position "${u}" is not a number`); }
    const h = get('height').replace(/\s*u$/i, '');
    if (h) { if (/^\d+$/.test(h)) rec.height = +h; else out.problems.push(`Row ${n}: ${host}: height "${get('height')}" is not a number of U`); }
    const ip = get('ip'); if (ip) { const l = list(ip); rec.ip = l.length === 1 ? l[0] : l; }
    const oob = get('oob'), om = get('oobMac');
    if (oob || om) rec.oob = Object.assign({}, oob && { ip: oob }, om && { mac: om });
    const mac = get('mac'); if (mac) rec.nics = list(mac).map(m => ({ mac: m }));
    const cpu = get('cpu'); if (cpu) rec.cpu = parseCpu(cpu);
    const mem = get('memory'); if (mem) rec.memory = /^\d+(\.\d+)?$/.test(mem) ? +mem : mem;
    out.records.push(rec);
  }
  return out;
}

// ---------- Putting records into a site file ----------
const key = s => String(s === undefined || s === null ? '' : s).trim().toLowerCase();
const hostOf = o => key(o.host || o.hostname || o.name);
const addrs = v => (Array.isArray(v) ? v : v === undefined || v === null || v === '' ? [] : [v]).map(a => (typeof a === 'object' && a ? a.address || a.ip : a)).map(a => String(a || '').trim());
// A CSV record laid over an existing one: fields the sheet gave replace the existing ones; the rest of the record
// (disks, cabling, vlans…) stays. Addresses the sheet repeats keep their vlan and gateway.
function overlay(base, rec) {
  const out = { ...base };
  for (const [k, v] of Object.entries(rec)) {
    if (k === 'ip') {
      const old = new Map((Array.isArray(base.ip) ? base.ip : base.ip ? [base.ip] : []).filter(a => a && typeof a === 'object').map(a => [key(a.address || a.ip), a]));
      out.ip = addrs(v).map(a => old.get(key(a)) || a);
    } else if (k === 'oob') {
      const b = base.oob && typeof base.oob === 'object' ? base.oob : base.oob ? { ip: base.oob } : {};
      out.oob = { ...b, ...v };
    } else if (k === 'nics') {
      const b = Array.isArray(base.nics) ? base.nics : [];
      out.nics = v.map((n, i) => ({ ...(b[i] && typeof b[i] === 'object' ? b[i] : {}), ...n }));
      if (b.length > v.length) out.nics.push(...b.slice(v.length));
    } else if (k === 'cpu') {
      out.cpu = { ...(base.cpu && typeof base.cpu === 'object' ? base.cpu : {}), ...v };
    } else out[k] = v;
  }
  return out;
}
// The site file with the sheet's servers in it. Halls, layout and settings are kept either way.
//   mode "replace": the file's servers are exactly the sheet's.
//   mode "merge":   servers are matched by hostname; a match takes the sheet's values, a new hostname is added, and
//                   servers the sheet does not list stay as they are.
// Returns { site, added, updated, removed, kept }.
export function applyServers(raw, records, mode, notes) {
  const site = { ...(raw && typeof raw === 'object' ? raw : {}) };
  const old = Array.isArray(site.servers) ? site.servers : [];
  let added = 0, updated = 0, removed = 0, kept = 0;
  if (mode === 'merge') {
    const at = new Map(); old.forEach((o, i) => { if (o && typeof o === 'object' && hostOf(o) && !at.has(hostOf(o))) at.set(hostOf(o), i); });
    const servers = old.slice();
    for (const rec of records) {
      const i = at.get(key(rec.host));
      if (i === undefined) { servers.push(rec); at.set(key(rec.host), servers.length - 1); added++; }
      else { servers[i] = overlay(servers[i], rec); updated++; }
    }
    site.servers = servers; kept = old.length - updated;
  } else {
    site.servers = records.slice(); added = records.length; removed = old.length;
    delete site.racks;   // servers listed the older way (racks.<id>.servers.U<n>) would come back otherwise
  }
  if (notes && notes.length) site.importNotes = notes; else delete site.importNotes;
  return { site, added, updated, removed, kept };
}
