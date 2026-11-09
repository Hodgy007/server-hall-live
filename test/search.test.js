import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSite, resolveMode } from '../js/site.js';
import { normMac, matchRecord, searchAll, exactTarget } from '../js/search.js';
import { COLUMNS, buildRows, filterRows, sortRows, csvRows } from '../js/sheet.js';
import { parseServers, toCSV } from '../js/csv.js';

const site = loadSite({
  halls: [{ building: 'LON1', room: 'Hall A', grid: ['A01:S A02:S', '+ +'] }, { building: 'MAN2', room: 'Hall 1', grid: ['B01:S', '+'] }],
  servers: [
    { host: 'db-a01-01', building: 'LON1', room: 'Hall A', rack: 'A01', u: 1, height: 2, manufacturer: 'Dell', model: 'PowerEdge R760', serial: '7XK2Q93', installed: '2021-06', role: 'Database', os: 'Red Hat Enterprise Linux 9',
      ip: [{ address: '10.130.4.11/24' }, { address: '10.130.5.11/24' }], oob: { ip: '10.250.4.11', mac: '00:14:22:01:02:03' }, nics: [{ mac: '00:0a:f7:01:02:03' }, { mac: '00:0a:f7:01:02:04' }] },
    { host: 'web-a01-01', building: 'LON1', room: 'Hall A', rack: 'A01', u: 5, height: 1, manufacturer: 'HPE', model: 'ProLiant DL360 Gen11', serial: 'CZ123', installed: '2024-02-10', role: 'Web front-end', os: 'Ubuntu 24.04', ip: '10.110.1.5/24' },
    { host: 'web-b01-01', building: 'MAN2', room: 'Hall 1', rack: 'B01', u: 1, height: 1, manufacturer: 'Supermicro', model: 'SYS-110', serial: '', role: 'Web front-end', os: 'Debian 12' }
  ]
});
const hit = q => searchAll(site.servers, site.halls.flatMap(h => h.grid.racks.map(r => ({ id: r.id, hall: h.id }))), q);

test('mode: address beats file beats telemetry', () => {
  assert.equal(resolveMode(null, null, null), 'inventory');
  assert.equal(resolveMode(null, null, { url: 'x' }), 'monitoring');
  assert.equal(resolveMode('inventory', 'monitoring', { url: 'x' }), 'inventory');
  assert.equal(resolveMode('bogus', 'monitoring', null), 'monitoring');
  assert.equal(resolveMode(null, 'Inventory', { url: 'x' }), 'inventory');
  assert.equal(resolveMode(null, null, {}), 'inventory');
  assert.equal(loadSite({ mode: 'monitoring' }).mode, 'monitoring');
  assert.equal(loadSite({ mode: 'nonsense' }).mode, null);
});
test('MACs compare without separators or case', () => {
  assert.equal(normMac('00-0A-F7-01-02-03'), '000af7010203');
  for (const q of ['000af7010203', '00:0A:F7:01:02:03', '00-0a-f7', '0a.f7.01', '00:14:22:01:02:03']) assert.equal(hit(q).map(r => r.host).join(), 'db-a01-01', q);
  assert.equal(hit('00:0a:f7:01:02:04')[0].field, 'NIC MAC');
  assert.equal(hit('001422')[0].field, 'OOB MAC');
});
test('short hex-looking words do not match MACs', () => {
  assert.equal(hit('2021').map(r => r.field).join(), 'In service');
  assert.equal(hit('db').length, 1);
});
test('finds serials, IPs, OOB addresses, models, makes, roles and OS across halls', () => {
  assert.equal(hit('7xk2')[0].field, 'Serial');
  assert.equal(hit('10.130.5.11')[0].field, 'IP address');
  assert.equal(hit('10.250.4.11')[0].field, 'OOB address');
  assert.equal(hit('r760')[0].field, 'Model');
  assert.equal(hit('supermicro')[0].host, 'web-b01-01');
  assert.deepEqual(hit('web front').map(r => r.host).sort(), ['web-a01-01', 'web-b01-01']);
  assert.equal(hit('database')[0].field, 'Role');
  assert.equal(hit('debian')[0].field, 'OS');
  assert.equal(hit('dell r760').length, 1);
  assert.equal(hit('dell dl360').length, 0);
  assert.equal(hit('').length, 0);
});
test('a rack ID gives rack results, and exact ids are found directly', () => {
  const r = hit('b01'); assert.ok(r.some(x => x.kind === 'rack' && x.rack === 'B01'));
  const racks = [{ id: 'A01', hall: 'h' }];
  assert.deepEqual(exactTarget(site.servers, racks, 'A01'), { kind: 'rack', rack: 'A01', hall: 'h' });
  assert.equal(exactTarget(site.servers, racks, 'DB-A01-01').kind, 'host');
  assert.equal(exactTarget(site.servers, racks, 'nope'), null);
});
test('an exact hostname ranks first', () => {
  assert.equal(hit('web-a01-01')[0].host, 'web-a01-01');
});

test('the inventory table: columns, filter, sort', () => {
  const hallById = new Map(site.halls.map(h => [h.id, h]));
  const rows = buildRows(site.servers, hallById);
  assert.equal(rows.length, 3);
  assert.deepEqual(COLUMNS.map(c => c.label), ['Host', 'Building', 'Hall', 'Rack', 'U', 'Height', 'Make', 'Model', 'Serial', 'IP', 'OOB', 'Role', 'OS', 'In service']);
  assert.equal(rows[0].cells[9], '10.130.4.11/24; 10.130.5.11/24');
  assert.equal(filterRows(rows, 'web').length, 2);
  assert.equal(filterRows(rows, '').length, 3);
  assert.deepEqual(sortRows(rows, 'u', 1).map(r => r.rec.host), ['db-a01-01', 'web-b01-01', 'web-a01-01']);
  assert.deepEqual(sortRows(rows, 'u', -1).map(r => r.rec.host), ['web-a01-01', 'db-a01-01', 'web-b01-01']);
  assert.equal(sortRows(rows, 'serial', 1).at(-1).rec.host, 'web-b01-01');   // blank last
  assert.equal(sortRows(rows, 'serial', -1).at(-1).rec.host, 'web-b01-01');
  assert.deepEqual(sortRows(rows, null).map(r => r.rec.host), ['web-a01-01', 'db-a01-01', 'web-b01-01']);   // building, hall, rack, top of rack first
});
test('Export CSV reads back through the importer', () => {
  const hallById = new Map(site.halls.map(h => [h.id, h]));
  const rows = filterRows(buildRows(site.servers, hallById), 'a01');
  const back = parseServers(toCSV(csvRows(rows), { bom: true }));
  assert.equal(back.problems.length, 0, back.problems.join('\n'));
  const site2 = loadSite({ halls: site.halls.map(h => ({ building: h.building, room: h.room, grid: h.grid.cells.map(r => r.join(' ')) })), servers: back.records });
  // (the grid was rebuilt crudely above, so compare the records before placement)
  assert.equal(back.records.length, 2);
  const a = back.records.find(r => r.host === 'db-a01-01');
  assert.equal(a.rack, 'A01'); assert.equal(a.u, 1); assert.equal(a.height, 2); assert.equal(a.serial, '7XK2Q93'); assert.equal(a.manufacturer, 'Dell');
  assert.equal(a.model, 'Dell PowerEdge R760'); assert.deepEqual(a.ip, ['10.130.4.11/24', '10.130.5.11/24']); assert.deepEqual(a.oob, { ip: '10.250.4.11' });
  assert.equal(a.installed, '2021-06'); assert.equal(a.building, 'LON1'); assert.equal(a.room, 'Hall A'); assert.equal(a.role, 'Database'); assert.equal(a.os, 'Red Hat Enterprise Linux 9');
  assert.ok(site2);
});
