// Site data: the halls (a floor grid for each building and room) and every server in them, read from a JSON file and
// normalised so the rest of the app reads one shape however the file spelled things. Plain JavaScript with no
// three.js, so the layout editor uses it too. With no halls in the file a demo hall is generated in the same format.
//
// File format (every field but the grid, a server's rack and its U is optional; see data/hall.example.json):
//   halls:   [{ building, room, grid: ["token token …", …] }]          one string per row of 0.6 m floor tiles
//   servers: [{ host, building, room, rack, u, height, manufacturer, model, serial, installed, role, os, kernel,
//              cpu: { model, sockets, cores, ghz }, memory: { gb, dimms, type },
//              ip: "10.0.0.5/24" | [{ address, vlan, gateway, interface }],
//              oob: { type, ip, mac, switch, port }        (also accepted as ilo / idrac / bmc, or just an address)
//              nics: [{ name, speed, mac, switch, port, bond }],
//              localDisks: [{ type, size, count, raid, model }], attachedDisks: [{ type, array, protocol, size, lun, name }] }]
// Grid tokens: "." floor, "P" vented tile (cold aisle), "H" contained hot aisle, "+" the back half of a rack, and a
// rack as "ID:S" or "ID:N" for the way its front faces (south is down the grid). A rack is one tile wide and two deep:
// its own tile, at the front, and the "+" tile behind it.

export const TILE = 0.6, RACK_W = 0.6, RACK_D = 1.0, RACK_H = 2.08, ROOM_H = 3.7, MAX_U = 38;

// ---------- Small parsers ----------
const str = v => (v === undefined || v === null ? '' : String(v)).trim();
const num = v => { const n = typeof v === 'string' ? parseFloat(v) : v; return Number.isFinite(n) ? n : null; };
// Sizes in GB from 960, "960 GB", "1.92TB", "2 TiB"
export function sizeGB(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const m = /^\s*([\d.]+)\s*(t|g|m|p)?i?b?\s*$/i.exec(str(v)); if (!m) return null;
  return parseFloat(m[1]) * ({ m: 0.001, g: 1, t: 1000, p: 1e6 }[(m[2] || 'g').toLowerCase()]);
}
export const fmtGB = gb => gb >= 1000 ? `${+(gb / 1000).toFixed(2)} TB` : `${+gb.toFixed(gb < 10 ? 1 : 0)} GB`;
// Memory is counted in binary units: 1024 GB is 1 TB
export const fmtMem = gb => gb >= 1024 ? `${+(gb / 1024).toFixed(2)} TB` : `${Math.round(gb)} GB`;
const list = v => Array.isArray(v) ? v : v === undefined || v === null || v === '' ? [] : [v];
const key = s => str(s).toLowerCase();

// ---------- Known models: what a record leaves out comes from here ----------
// Power is idle and flat-out watts. Memory is 32 GB RDIMMs in every slot unless the record says otherwise.
export const MODELS = {
  'PowerEdge R7725':   { maker: 'Dell', u: 2, sockets: 2, vendor: 'amd', dimms: 24, cpu: 'AMD EPYC 9355', cores: 32, ghz: 3.55, w: [260, 900] },
  'PowerEdge R7725xd': { maker: 'Dell', u: 2, sockets: 2, vendor: 'amd', dimms: 24, cpu: 'AMD EPYC 9375F', cores: 32, ghz: 3.8, w: [280, 960] },
  'PowerEdge R7715':   { maker: 'Dell', u: 2, sockets: 1, vendor: 'amd', dimms: 24, cpu: 'AMD EPYC 9535', cores: 64, ghz: 2.4, w: [220, 700] },
  'PowerEdge R6725':   { maker: 'Dell', u: 1, sockets: 2, vendor: 'amd', dimms: 24, cpu: 'AMD EPYC 9335', cores: 32, ghz: 3.0, w: [240, 820] },
  'PowerEdge R6715':   { maker: 'Dell', u: 1, sockets: 1, vendor: 'amd', dimms: 24, cpu: 'AMD EPYC 9535', cores: 64, ghz: 2.4, w: [200, 650] },
  'PowerEdge R770':    { maker: 'Dell', u: 2, sockets: 2, vendor: 'intel', dimms: 32, cpu: 'Intel Xeon 6737P', cores: 32, ghz: 2.9, w: [280, 950] },
  'PowerEdge R770AP':  { maker: 'Dell', u: 2, sockets: 2, vendor: 'intel', dimms: 24, cpu: 'Intel Xeon 6978P', cores: 120, w: [400, 1200] },
  'PowerEdge R670':    { maker: 'Dell', u: 1, sockets: 2, vendor: 'intel', dimms: 32, cpu: 'Intel Xeon 6737P', cores: 32, ghz: 2.9, w: [260, 880] },
  'PowerEdge R570':    { maker: 'Dell', u: 2, sockets: 1, vendor: 'intel', dimms: 16, cpu: 'Intel Xeon 6737P', cores: 32, ghz: 2.9, w: [180, 520] },
  'PowerEdge R470':    { maker: 'Dell', u: 1, sockets: 1, vendor: 'intel', dimms: 16, cpu: 'Intel Xeon 6737P', cores: 32, ghz: 2.9, w: [170, 500] },
  'PowerEdge R760':    { maker: 'Dell', u: 2, sockets: 2, vendor: 'intel', dimms: 32, cpu: 'Intel Xeon Gold 6430', cores: 32, ghz: 2.1, w: [250, 850] },
  'PowerEdge R660':    { maker: 'Dell', u: 1, sockets: 2, vendor: 'intel', dimms: 32, cpu: 'Intel Xeon Gold 6430', cores: 32, ghz: 2.1, w: [230, 800] },
  'ProLiant DL380 Gen11': { maker: 'HPE', u: 2, sockets: 2, vendor: 'intel', dimms: 32, cpu: 'Intel Xeon Gold 6430', cores: 32, ghz: 2.1, w: [250, 860] },
  'ProLiant DL360 Gen11': { maker: 'HPE', u: 1, sockets: 2, vendor: 'intel', dimms: 32, cpu: 'Intel Xeon Gold 6430', cores: 32, ghz: 2.1, w: [230, 800] },
  'ProLiant DL385 Gen11': { maker: 'HPE', u: 2, sockets: 2, vendor: 'amd', dimms: 24, cpu: 'AMD EPYC 9354', cores: 32, ghz: 3.25, w: [260, 900] },
  'ProLiant DL365 Gen11': { maker: 'HPE', u: 1, sockets: 2, vendor: 'amd', dimms: 24, cpu: 'AMD EPYC 9354', cores: 32, ghz: 3.25, w: [240, 820] },
  'ProLiant DL345 Gen11': { maker: 'HPE', u: 1, sockets: 1, vendor: 'amd', dimms: 12, cpu: 'AMD EPYC 9454P', cores: 48, ghz: 2.75, w: [180, 560] },
  'ProLiant DL325 Gen11': { maker: 'HPE', u: 1, sockets: 1, vendor: 'amd', dimms: 12, cpu: 'AMD EPYC 9454P', cores: 48, ghz: 2.75, w: [170, 520] },
  'ProLiant DL560 Gen11': { maker: 'HPE', u: 2, sockets: 4, vendor: 'intel', dimms: 64, cpu: 'Intel Xeon Platinum 8460H', cores: 40, ghz: 2.2, w: [450, 1800] }
};
// The longest catalogue name the record's model contains, e.g. "Dell PowerEdge R7725xd" → R7725xd, not R7725
function findModel(model) {
  const m = key(model); let best = null;
  for (const k in MODELS) if (m.includes(key(k).replace(/^(poweredge|proliant) /, '')) && (!best || k.length > best.length)) best = k;
  return best;
}
// Faces drawn for each maker; anything else gets the generic chassis
export const familyOf = maker => /dell/i.test(maker) ? 'dell' : /hpe|hewlett/i.test(maker) ? 'hpe' : 'other';
const OOB_NAME = { dell: 'iDRAC', hpe: 'iLO', other: 'BMC' };
const cpuVendor = s => /amd|epyc/i.test(s) ? 'amd' : /intel|xeon/i.test(s) ? 'intel' : 'other';
// Workload profiles for the simulation; a server's role picks one (matched on these words), racks take their servers' majority
export const KINDS = [
  { role: 'Web front-end', match: /web|front|http|proxy|cdn/i, aff: 1.0, base: 0.55, net: 36 },
  { role: 'API services', match: /api|app|service|micro/i, aff: 0.8, base: 0.5, net: 30 },
  { role: 'Database', match: /db|data|sql|storage|cache/i, aff: 0.45, base: 0.45, net: 22 },
  { role: 'Batch and analytics', match: /batch|analytic|hpc|compute|ml|ai|render/i, aff: 0.1, base: 0.5, net: 14 }
];
export const kindOf = role => { const k = KINDS.findIndex(K => K.match.test(role || '')); return k < 0 ? 1 : k; };

// ---------- Grid ----------
// One grid row is a string of space-separated tokens (or an array of them)
export function parseGrid(grid, problems, where) {
  const rows = list(grid).map(r => Array.isArray(r) ? r.map(str) : str(r).split(/\s+/).filter(Boolean));
  const h = rows.length, w = Math.max(0, ...rows.map(r => r.length));
  const cells = Array.from({ length: h }, () => Array(w).fill('.')), racks = [], seen = new Set();
  rows.forEach((r, row) => r.forEach((t, col) => {
    const m = /^([^:\s]+):([NnSs])$/.exec(t);
    if (m) {
      const id = m[1].toUpperCase();
      if (seen.has(id)) { problems.push(`${where}: rack ${id} appears twice in the grid`); return; }
      seen.add(id); cells[row][col] = 'R'; racks.push({ id, col, row, face: /s/i.test(m[2]) ? 1 : -1 });
    } else if (/^[.PH+]$/i.test(t)) cells[row][col] = t.toUpperCase();
    else { problems.push(`${where}: "${t}" at row ${row + 1}, column ${col + 1} is not a grid token (. P H + or ID:N / ID:S)`); }
  }));
  // A rack's back half is the tile behind it, which must be free floor or "+"
  for (const r of racks) {
    const br = r.row - r.face;
    if (br < 0 || br >= h) { problems.push(`${where}: rack ${r.id} has no tile behind it for its back half (it needs two tiles front to back)`); continue; }
    const c = cells[br][r.col];
    if (c === '.' || c === '+') cells[br][r.col] = '+';
    else problems.push(`${where}: the tile behind rack ${r.id} is ${c === 'R' ? 'another rack' : `"${c}"`}, not free for its back half`);
  }
  return { w, h, cells, racks };
}
export const gridText = (cells, racks) => cells.map((r, row) => r.map((c, col) => {
  if (c !== 'R') return c;
  const k = racks.find(x => x.col === col && x.row === row); return k ? `${k.id}:${k.face > 0 ? 'S' : 'N'}` : '.';
}).join(' '));

// Connected areas of one tile type, as their tiles and bounding box (in tiles)
function areas(cells, type) {
  const h = cells.length, w = h ? cells[0].length : 0, done = new Set(), out = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if (cells[r][c] !== type || done.has(r * w + c)) continue;
    const tiles = [], stack = [[r, c]]; done.add(r * w + c);
    while (stack.length) {
      const [y, x] = stack.pop(); tiles.push([x, y]);
      for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const yy = y + dy, xx = x + dx;
        if (yy >= 0 && yy < h && xx >= 0 && xx < w && cells[yy][xx] === type && !done.has(yy * w + xx)) { done.add(yy * w + xx); stack.push([yy, xx]); }
      }
    }
    out.push({ tiles, c0: Math.min(...tiles.map(t => t[0])), c1: Math.max(...tiles.map(t => t[0])), r0: Math.min(...tiles.map(t => t[1])), r1: Math.max(...tiles.map(t => t[1])) });
  }
  return out;
}

// The hall in metres, centred on the origin: x east along the grid's columns, z south down its rows
export function buildLayout(hall) {
  const g = hall.grid, ROOM = { x: Math.max(g.w, 6) * TILE / 2, z: Math.max(g.h, 6) * TILE / 2, h: ROOM_H };
  const X = col => (col + 0.5) * TILE - ROOM.x, Z = row => (row + 0.5) * TILE - ROOM.z;
  // A rack's front sits on the front edge of its tile, so it lines up with the aisle in front of it
  const racks = g.racks.map(r => ({ id: r.id, col: r.col, gridRow: r.row, face: r.face, x: X(r.col), z: Z(r.row) + r.face * (TILE / 2 - RACK_D / 2) }));
  // Rows: racks on the same grid row facing the same way, west to east
  const rowMap = new Map();
  for (const r of racks) { const k = r.gridRow + '|' + r.face; if (!rowMap.has(k)) rowMap.set(k, []); rowMap.get(k).push(r); }
  const rows = [...rowMap.values()].map(rs => rs.sort((a, b) => a.x - b.x)).sort((a, b) => a[0].z - b[0].z || a[0].x - b[0].x).map((rs, i) => {
    const pre = rs.map(r => /^[^\d]*/.exec(r.id)[0]), id = pre[0] && pre.every(p => p === pre[0]) ? pre[0].replace(/[-_ ]+$/, '') : `R${i + 1}`;
    const row = { id, z: rs[0].z, face: rs[0].face, racks: rs, x0: rs[0].x - RACK_W / 2, x1: rs[rs.length - 1].x + RACK_W / 2 };
    rs.forEach((r, k) => { r.row = row; r.pos = k; r.end = rs.length > 1 ? Math.abs(k - (rs.length - 1) / 2) / ((rs.length - 1) / 2) : 0; });
    return row;
  });
  const box = a => ({ x0: a.c0 * TILE - ROOM.x, x1: (a.c1 + 1) * TILE - ROOM.x, z0: a.r0 * TILE - ROOM.z, z1: (a.r1 + 1) * TILE - ROOM.z, tiles: a.tiles.map(([c, r]) => [X(c), Z(r)]) });
  // Cold aisles: the vented tiles
  const cold = areas(g.cells, 'P').map(a => { const b = box(a); return Object.assign(b, { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 }); });
  // Hot-aisle containment over each "H" area, stretched to meet the rears of the racks either side; chimneys every ~2.6 m
  const hot = areas(g.cells, 'H').map(a => {
    const b = box(a);
    for (const r of racks) {
      if (r.x < b.x0 || r.x > b.x1) continue;
      const rear = r.z - r.face * RACK_D / 2;
      if (rear <= b.z0 && b.z0 - rear < TILE) b.z0 = Math.min(b.z0, rear);
      if (rear >= b.z1 && rear - b.z1 < TILE) b.z1 = Math.max(b.z1, rear);
    }
    const n = Math.max(1, Math.round((b.x1 - b.x0) / 2.6));
    return Object.assign(b, { zc: (b.z0 + b.z1) / 2, top: RACK_H, chimneys: Array.from({ length: n }, (_, i) => b.x0 + (i + 0.5) * (b.x1 - b.x0) / n) });
  });
  const east = racks.length ? Math.max(...racks.map(r => r.x)) + RACK_W / 2 : 0;
  const trayX = Math.min(ROOM.x - 0.3, east + 0.55);
  return { ROOM, racks, rows, cold, hot, trayX };
}

// ---------- Servers ----------
// Older files listed servers under racks.<id>.servers.U<n> with flat fields; they still work
function legacyRecord(id, uKey, o) {
  const rec = { rack: id, u: parseInt(String(uKey).replace(/^U/i, ''), 10), host: o.host, serial: o.serial, installed: o.installed, model: o.model, os: o.os, kernel: o.kernel };
  const cm = /^(\d+)\s*[×x]\s*(.+)$/.exec(str(o.cpu));
  if (o.cpu) rec.cpu = cm ? { sockets: +cm[1], model: cm[2] } : { model: o.cpu };
  const dm = /^(\d+)\s*[×x]\s*([\d.]+\s*[TG]B)\s*(.*)$/i.exec(str(o.drives));
  if (dm) rec.localDisks = [{ count: +dm[1], size: dm[2], type: dm[3] || 'NVMe' }];
  if (o.ip) rec.ip = [{ address: o.ip, vlan: o.vlan, gateway: o.gateway, interface: 'bond0' }];
  const oobIp = o.idrac || o.ilo; if (oobIp || o.oobPort) rec.oob = { ip: oobIp, mac: o.idracMac || o.iloMac, port: o.oobPort };
  if (o.mac || o.port) rec.nics = [0, 1].map(k => ({ name: `ens1f${k}`, mac: list(o.mac)[k], port: o.port }));
  return rec;
}

// One server record → the shape the app reads. Missing specs come from the model catalogue, then sensible defaults.
function normServer(o, i, problems) {
  const where = `server ${str(o.host) || '#' + (i + 1)}`;
  const known = MODELS[findModel(o.model)] || null;
  const maker = str(o.manufacturer || o.vendor || o.make) || (known ? known.maker : /poweredge/i.test(o.model) ? 'Dell' : /proliant/i.test(o.model) ? 'HPE' : '');
  const family = familyOf(maker);
  const model = str(o.model) || 'Server';
  const display = maker && !key(model).startsWith(key(maker)) ? `${maker} ${model}` : model;
  const c = typeof o.cpu === 'string' ? { model: o.cpu } : o.cpu || {};
  const cpuModel = str(c.model || c.name) || (known ? known.cpu : 'CPU');
  const sockets = Math.max(1, Math.min(8, Math.round(num(c.sockets ?? c.count) ?? (known ? known.sockets : 2))));
  const cores = Math.max(1, Math.round(num(c.cores ?? c.coresPerSocket) ?? (known ? known.cores : 16)));
  const ghz = num(c.ghz ?? c.clock) ?? (known && key(cpuModel) === key(known.cpu) ? known.ghz : null);
  const vendor = cpuVendor(cpuModel) !== 'other' ? cpuVendor(cpuModel) : known ? known.vendor : 'intel';
  const mem = typeof o.memory === 'object' && o.memory ? o.memory : { gb: o.memory ?? o.memoryGB ?? o.ram };
  const channels = vendor === 'amd' ? 12 : 8;
  let dimms = num(mem.dimms);
  const gb = sizeGB(mem.gb ?? mem.size ?? mem.total) ?? (dimms ? dimms * 32 : known ? known.dimms * 32 : sockets * channels * 32);
  if (!dimms) dimms = Math.max(sockets * 4, Math.min(sockets * channels * 2, Math.round(gb / 32 / sockets) * sockets));
  dimms = Math.max(sockets, Math.round(dimms));
  const h = Math.max(1, Math.min(4, Math.round(num(o.height ?? o.u_height ?? o.size) ?? (known ? known.u : 2))));
  const u = Math.round(num(o.u ?? o.position ?? o.slot) ?? NaN);
  // Addresses: a string, a list of strings, or objects
  const ips = list(o.ip ?? o.ips ?? o.addresses).map(a => typeof a === 'object' ? { address: str(a.address || a.ip), vlan: a.vlan, gateway: str(a.gateway || a.gw), iface: str(a.interface || a.iface || a.name) } : { address: str(a) }).filter(a => a.address);
  let oob = o.oob ?? o.ilo ?? o.idrac ?? o.bmc ?? o.ipmi;
  oob = typeof oob === 'object' && oob ? oob : oob ? { ip: oob } : {};
  oob = { type: str(oob.type) || (o.ilo ? 'iLO' : o.idrac ? 'iDRAC' : OOB_NAME[family]), ip: str(oob.ip || oob.address), mac: str(oob.mac), switch: str(oob.switch), port: str(oob.port || oob.switchPort) };
  const nics = list(o.nics ?? o.nic ?? o.interfaces).map((n, k) => typeof n === 'object' ? { name: str(n.name) || `nic${k}`, speed: str(n.speed), mac: str(n.mac), switch: str(n.switch), port: str(n.port || n.switchPort), bond: str(n.bond) } : { name: str(n) });
  const disk = (d, k) => typeof d === 'object' ? { type: str(d.type || d.kind), sizeGB: sizeGB(d.size ?? d.capacity ?? d.sizeGB), count: Math.max(1, Math.round(num(d.count) ?? 1)), raid: str(d.raid), model: str(d.model), array: str(d.array || d.target), protocol: str(d.protocol), lun: d.lun, name: str(d.name) || `disk${k}` } : { type: str(d), sizeGB: sizeGB(d), count: 1, name: `disk${k}` };
  const localDisks = list(o.localDisks ?? o.local_disks ?? o.disks ?? o.drives).map(disk);
  const attachedDisks = list(o.attachedDisks ?? o.attached_disks ?? o.san ?? o.volumes).map(disk);
  const p = list(o.power).map(num);
  const tdp = cores * 4.5 + 90;
  const power = p.length === 2 && p.every(v => v > 0) ? p : known && sockets === known.sockets && cores === known.cores ? known.w : [Math.round(90 + sockets * 55 + gb * 0.04), Math.round(140 + sockets * tdp + gb * 0.12)];
  if (!str(o.rack)) problems.push(`${where}: no rack`);
  if (!Number.isFinite(u)) problems.push(`${where}: no U position`);
  return {
    host: str(o.host || o.hostname || o.name) || `server-${i + 1}`, building: str(o.building), room: str(o.room || o.hall), hallId: str(o.hallId),
    rack: str(o.rack).toUpperCase(), u, h, maker: maker || 'Generic', family, model: display, serial: str(o.serial || o.serviceTag || o.assetTag), installed: str(o.installed),
    role: str(o.role || o.function || o.workload), os: str(o.os), kernel: str(o.kernel),
    cpu: { model: cpuModel, sockets, cores, ghz, vendor }, memory: { gb, dimms, channels, type: str(mem.type) || 'DDR5 RDIMM' },
    ips, oob, nics, localDisks, attachedDisks, power, extra: o.notes ? str(o.notes) : ''
  };
}

// ---------- The whole file ----------
export function loadSite(raw) {
  const problems = [];
  let src = raw && typeof raw === 'object' ? raw : {};
  const demo = !list(src.halls).length;
  if (demo) src = Object.assign({}, demoSite(src), { domain: src.domain || 'hall2.local', oobUrl: src.oobUrl, idracUrl: src.idracUrl, iloUrl: src.iloUrl, telemetry: src.telemetry, racks: src.racks });
  const halls = list(src.halls).map((h, i) => {
    const building = str(h.building) || 'Site', room = str(h.room || h.name) || `Hall ${i + 1}`, id = str(h.id) || `${building} / ${room}`;
    return { id, building, room, grid: parseGrid(h.grid, problems, id) };
  });
  // Servers: the list, plus any listed the old way (racks.<id>.servers.U<n>), which also override listed ones at the same slot
  const recs = list(src.servers).slice();
  for (const [id, r] of Object.entries(src.racks || {})) for (const [uKey, o] of Object.entries((r && r.servers) || {})) {
    const lr = legacyRecord(id.toUpperCase(), uKey, o), at = recs.findIndex(x => key(x.rack) === key(lr.rack) && +x.u === lr.u);
    // fields the old entry gives replace the listed server's; objects (oob) are merged field by field
    const given = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
    if (at >= 0) {
      const base = recs[at], merged = Object.assign({}, base);
      for (const [k, v] of Object.entries(given(lr))) merged[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' ? { ...base[k], ...given(v) } : v;
      recs[at] = merged;
    }
    else recs.push(lr);
  }
  const servers = recs.map((o, i) => normServer(o, i, problems));
  // Which hall each server is in: its hall id, or building and room, or the only hall there is
  const hallOf = sv => halls.find(h => h.grid.racks.some(r => r.id === sv.rack) && (sv.hallId ? key(h.id) === key(sv.hallId)
    : (!sv.building || key(h.building) === key(sv.building)) && (!sv.room || key(h.room) === key(sv.room))));
  const hosts = new Set();
  for (const sv of servers) {
    const h = hallOf(sv);
    if (!h) { problems.push(`${sv.host}: rack ${sv.rack || '?'}${sv.building || sv.room ? ` in ${[sv.building, sv.room].filter(Boolean).join(' / ')}` : ''} is not in any hall's grid`); continue; }
    sv.hall = h.id;
    if (hosts.has(key(sv.host))) problems.push(`${sv.host}: hostname used more than once`);
    hosts.add(key(sv.host));
    if (Number.isFinite(sv.u) && (sv.u < 1 || sv.u + sv.h - 1 > MAX_U)) { problems.push(`${sv.host}: U${sv.u}${sv.h > 1 ? `–${sv.u + sv.h - 1}` : ''} is outside U1–${MAX_U} (U39–42 hold the switches)`); sv.hall = null; }
  }
  // Two servers in the same rack units: the later one is left out
  const taken = new Map();
  for (const sv of servers) {
    if (!sv.hall || !Number.isFinite(sv.u)) { sv.hall = null; continue; }
    for (let u = sv.u; u < sv.u + sv.h; u++) {
      const k = `${sv.hall}|${sv.rack}|${u}`;
      if (taken.has(k)) { problems.push(`${sv.host}: U${u} of rack ${sv.rack} is already taken by ${taken.get(k)}`); sv.hall = null; break; }
    }
    if (sv.hall) for (let u = sv.u; u < sv.u + sv.h; u++) taken.set(`${sv.hall}|${sv.rack}|${u}`, sv.host);
  }
  return {
    demo, problems, halls, servers: servers.filter(sv => sv.hall),
    domain: str(src.domain) || 'dc.local', oobUrl: str(src.oobUrl || src.idracUrl || src.iloUrl), telemetry: src.telemetry || null
  };
}

// ---------- Demo hall ----------
// Eight rows of 12 racks: pairs of rows face each other across 1.8 m cold aisles (three vented tiles) and stand back to
// back over contained hot aisles; rows A and H exhaust towards the end walls. Each rack holds twelve servers of one
// Dell model; the two rows of each pair run one workload. Returned in the file format, so it doubles as a template.
export function demoSite() {
  let s1 = 7, s2 = 4099;
  const rnd = () => (s1 = (s1 * 16807) % 2147483647) / 2147483647;
  const DELL = Object.keys(MODELS).filter(k => k.startsWith('PowerEdge') && !/R760|R660/.test(k));
  const pickModel = () => { s2 = (s2 * 16807) % 2147483647; return DELL[Math.floor(s2 / 2147483647 * DELL.length)]; };
  const COLS = 12, LEFT = 4, W = 20, ids = 'ABCDEFGH';
  // rows of the grid, north to south: wall gap, then per pair of rows: rack, cold aisle, rack, hot aisle
  const grid = [], put = (row, col, t) => { grid[row][col] = t; };
  const plan = ['.', '.', '.', 'A', 'P', 'P', 'P', 'B', 'H', 'H', 'C', 'P', 'P', 'P', 'D', 'H', 'H', 'E', 'P', 'P', 'P', 'F', 'H', 'H', 'G', 'P', 'P', 'P', 'H8', '.', '.'];
  // each rack letter takes two grid rows: south-facing racks keep their back half above, north-facing below
  const lines = [];
  for (const p of plan) {
    if (/^[A-H]8?$/.test(p) && p !== 'H') {
      const id = p[0], south = ids.indexOf(id) % 2 === 0;
      if (south) { lines.push({ back: true }); lines.push({ rack: id, face: 'S' }); }
      else { lines.push({ rack: id, face: 'N' }); lines.push({ back: true }); }
    } else lines.push({ tile: p });
  }
  lines.forEach((l, row) => {
    grid.push(Array(W).fill('.'));
    for (let c = 0; c < COLS; c++) {
      if (l.rack) put(row, LEFT + c, `${l.rack}${String(c + 1).padStart(2, '0')}:${l.face}`);
      else if (l.back) put(row, LEFT + c, '+');
      else if (l.tile === 'P' || l.tile === 'H') put(row, LEFT + c, l.tile);
    }
  });
  const HOST = ['web', 'api', 'db', 'batch'], ROLE = KINDS.map(k => k.role), VLAN = [110, 120, 130, 140];
  const DRIVE = [['960 GB', 8], ['1.92 TB', 8], ['7.68 TB', 8], ['3.84 TB', 8]];
  const OS = [[['Ubuntu 22.04.4 LTS', '5.15'], ['Ubuntu 24.04.1 LTS', '6.8']], [['Ubuntu 24.04.1 LTS', '6.8'], ['Debian 12.7', '6.1']], [['Red Hat Enterprise Linux 9.4', '5.14']], [['Rocky Linux 9.4', '5.14'], ['Ubuntu 22.04.4 LTS', '5.15']]];
  const TAG = '0123456789BCDFGHJKLMNPQRSTVWXYZ';
  const serviceTag = v => { let n = Math.floor(v * TAG.length ** 7), s = ''; for (let i = 0; i < 7; i++) { s = TAG[n % TAG.length] + s; n = Math.floor(n / TAG.length); } return s; };
  const mac = (oui, n) => [oui >> 16 & 255, oui >> 8 & 255, oui & 255, 0x20 + (n >> 16 & 15), n >> 8 & 255, n & 255].map(b => b.toString(16).padStart(2, '0')).join(':');
  const servers = []; let pi = 0;
  for (let ri = 0; ri < 8; ri++) for (let c = 0; c < COLS; c++) {
    const rack = ids[ri] + String(c + 1).padStart(2, '0'), kind = ri >> 1, model = pickModel(), m = MODELS[model];
    for (let s = 0; s < 12; s++) {
      const net = `${(ri % 2) * 20 + c + 1}`, os = OS[kind][Math.floor(rnd() * OS[kind].length)];
      servers.push({
        host: `${HOST[kind]}-${rack.toLowerCase()}-${String(s + 1).padStart(2, '0')}`, building: 'DC1', room: 'Hall 2', rack, u: 1 + s * m.u, height: m.u,
        manufacturer: 'Dell', model, serial: serviceTag(rnd()), installed: `20${25 + Math.floor(rnd() * 2)}-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}`,
        role: ROLE[kind], os: os[0], kernel: os[1],
        cpu: { model: m.cpu, sockets: m.sockets, cores: m.cores, ghz: m.ghz }, memory: { gb: m.dimms * 32, dimms: m.dimms, type: 'DDR5-6400 RDIMM' },
        ip: [{ address: `10.${VLAN[kind]}.${net}.${11 + s}/24`, vlan: VLAN[kind], gateway: `10.${VLAN[kind]}.${net}.1`, interface: 'bond0' }],
        oob: { type: 'iDRAC', ip: `10.250.${ri * 16 + c + 1}.${11 + s}`, mac: mac(0x001422, pi * 4 + 2), switch: `oob-${rack.toLowerCase()}`, port: `Gi1/0/${s + 1}` },
        nics: [0, 1].map(k => ({ name: `ens1f${k}`, speed: '25G', mac: mac(0x000af7, pi * 4 + k), switch: `tor-${rack.toLowerCase()}-${'ab'[k]}`, port: `Ethernet1/${s + 1}`, bond: 'bond0' })),
        localDisks: [{ type: 'NVMe', size: DRIVE[kind][0], count: DRIVE[kind][1], raid: kind === 2 ? 'RAID 10' : 'RAID 5' }, { type: 'M.2 SATA (BOSS-N1)', size: '480 GB', count: 2, raid: 'RAID 1' }],
        attachedDisks: kind === 2 ? [{ type: 'SAN', array: 'pure-x90-01', protocol: 'NVMe/TCP', size: '20 TB', lun: s + 1, name: `vol-${HOST[kind]}-${rack.toLowerCase()}-${s + 1}` }] : []
      });
      pi++;
    }
  }
  return { domain: 'hall2.local', halls: [{ building: 'DC1', room: 'Hall 2', grid: grid.map(r => r.join(' ')) }], servers };
}
