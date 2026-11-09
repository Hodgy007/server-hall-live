import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, toCSV, detectDelimiter, fieldOf, parseServers, applyServers } from '../js/csv.js';
import { loadSite } from '../js/site.js';

test('parses quoted fields, embedded commas, newlines and doubled quotes', () => {
  const { rows } = parseCSV('a,b,c\r\n"x, y","line1\nline2","say ""hi"""\r\n1,,3\r\n');
  assert.deepEqual(rows, [['a', 'b', 'c'], ['x, y', 'line1\nline2', 'say "hi"'], ['1', '', '3']]);
});
test('handles a BOM, LF, CR and a missing final newline', () => {
  assert.deepEqual(parseCSV('﻿a,b\n1,2').rows, [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCSV('a,b\r1,2\r').rows, [['a', 'b'], ['1', '2']]);
});
test('detects semicolon and tab delimiters from the header line', () => {
  assert.equal(detectDelimiter('host;rack;u\n1,5;2;3'), ';');
  assert.equal(detectDelimiter('host\track\tu\n'), '\t');
  assert.equal(detectDelimiter('host,rack,u'), ',');
  assert.equal(detectDelimiter('"a;b",c,d\n'), ',');
  assert.deepEqual(parseCSV('host;rack\nweb1;A01').rows, [['host', 'rack'], ['web1', 'A01']]);
});
test('a quote inside an unquoted field is literal, and an unclosed quote is reported', () => {
  assert.deepEqual(parseCSV('a,5" disk,c').rows, [['a', '5" disk', 'c']]);
  assert.equal(parseCSV('a,"open').unterminated, true);
});
test('blank rows are kept so row numbers match the sheet', () => {
  assert.equal(parseCSV('h\n\nx\n').rows.length, 3);
});
test('header aliases are case and punctuation insensitive', () => {
  const cases = { 'Host Name': 'host', HOSTNAME: 'host', Name: 'host', Cab: 'rack', Cabinet: 'rack', 'U Position': 'u', position: 'u', size: 'height', RU: 'height', Site: 'building', Hall: 'room',
    Make: 'manufacturer', Vendor: 'manufacturer', 'Service Tag': 'serial', 'Asset tag': 'serial', 'IP Address': 'ip', iDRAC: 'oob', iLO: 'oob', BMC: 'oob', MAC: 'mac', 'In service': 'installed', 'in_service': 'installed', RAM: 'memory', Processor: 'cpu', OS: 'os' };
  for (const [h, f] of Object.entries(cases)) assert.equal(fieldOf(h), f, h);
  assert.equal(fieldOf('Colour'), null);
});
test('parseServers builds records, with row numbers and problems', () => {
  const r = parseServers('Hostname;Cabinet;U position;Height;Vendor;Colour\nweb-1;a01;U5;2U;Dell;red\n;A01;9;1;;\nweb-2;A01;x;1;;\nweb-1;A02;3;1;;\n');
  assert.equal(r.delimiter, ';');
  assert.equal(r.records.length, 2);
  assert.deepEqual(r.records[0], { host: 'web-1', csvRow: 2, rack: 'a01', manufacturer: 'Dell', u: 5, height: 2 });
  assert.ok(r.problems.some(p => /Colour/.test(p)));
  assert.ok(r.problems.some(p => /^Row 3: no hostname/.test(p)));
  assert.ok(r.problems.some(p => /^Row 4: web-2: U position "x"/.test(p)));
  assert.ok(r.problems.some(p => /^Row 5: web-1 is already on row 2/.test(p)));
});
test('parseServers reads addresses, MACs, cpu, memory and U ranges', () => {
  const r = parseServers('host,rack,u,ip,oob,mac,cpu,memory\nh1,A01,3-4,"10.0.0.1; 10.0.0.2",10.9.0.1,"00:aa:bb:cc:dd:01 00:aa:bb:cc:dd:02",2x Xeon Gold,768\n');
  const x = r.records[0];
  assert.equal(x.u, 3); assert.equal(x.height, 2);
  assert.deepEqual(x.ip, ['10.0.0.1', '10.0.0.2']);
  assert.deepEqual(x.oob, { ip: '10.9.0.1' });
  assert.equal(x.nics.length, 2);
  assert.deepEqual(x.cpu, { sockets: 2, model: 'Xeon Gold' });
  assert.equal(x.memory, 768);
});
test('no hostname column is an error', () => {
  assert.match(parseServers('rack,u\nA01,1').error, /hostname/);
  assert.match(parseServers('').error, /empty/);
});
test('toCSV quotes what needs it, protects formulas and round-trips', () => {
  const rows = [['Host', 'Role'], ['a,b', 'say "x"'], ['=SUM(A1)', 'line\nbreak'], ['-5', ' pad ']];
  const text = toCSV(rows);
  assert.ok(text.includes("'=SUM(A1)"));
  const back = parseCSV(text).rows;
  assert.deepEqual(back[1], ['a,b', 'say "x"']);
  assert.deepEqual(back[3], ['-5', ' pad ']);
  const r = parseServers(toCSV([['Host', 'Rack', 'U', 'Role'], ['h1', 'A01', '1', '=cmd|x']]));
  assert.equal(r.records[0].role, '=cmd|x');
  assert.ok(toCSV([['a']], { bom: true }).startsWith('﻿'));
});

const raw = () => ({ domain: 'x.local', halls: [{ building: 'B', room: 'H', grid: ['A01:S A02:S', '+ +'] }],
  servers: [{ host: 'one', rack: 'A01', u: 1, height: 1, serial: 'S1', ip: [{ address: '10.0.0.1/24', vlan: 5 }], oob: { ip: '10.1.1.1', switch: 'sw' } }, { host: 'two', rack: 'A01', u: 3, height: 1 }] });
test('replace keeps the halls and swaps the servers', () => {
  const recs = parseServers('host,rack,u,height\nnew,A02,1,1\n').records;
  const r = applyServers({ ...raw(), racks: { A01: { servers: { U9: { host: 'old' } } } } }, recs, 'replace', ['n']);
  assert.equal(r.site.halls.length, 1); assert.equal(r.site.domain, 'x.local');
  assert.deepEqual(r.site.servers.map(s => s.host), ['new']);
  assert.equal(r.site.racks, undefined); assert.deepEqual(r.site.importNotes, ['n']);
  assert.equal(r.added, 1); assert.equal(r.removed, 2);
});
test('merge matches by hostname, keeps unlisted servers and fields the sheet lacks', () => {
  const recs = parseServers('Host,Rack,U,IP,OOB,Role\nONE,A01,2,10.0.0.1/24,10.1.1.9,db\nthree,A02,1,,,\n').records;
  const r = applyServers(raw(), recs, 'merge');
  assert.deepEqual(r.site.servers.map(s => s.host), ['ONE', 'two', 'three']);   // a match takes the sheet's spelling
  const one = r.site.servers[0];
  assert.equal(one.u, 2); assert.equal(one.serial, 'S1'); assert.equal(one.role, 'db');
  assert.deepEqual(one.ip, [{ address: '10.0.0.1/24', vlan: 5 }]);   // a repeated address keeps its vlan
  assert.deepEqual(one.oob, { ip: '10.1.1.9', switch: 'sw' });
  assert.deepEqual([r.added, r.updated, r.kept], [1, 1, 1]);
});
test('imported rows go through loadSite and problems name the CSV row', () => {
  const recs = parseServers('host,rack,u,height\nok,A01,1,1\nnowhere,Z99,1,1\nclash,A01,1,1\nnorack,,2,1\n').records;
  const site = loadSite(applyServers(raw(), recs, 'replace', ['Columns not recognised, so ignored: Foo']).site);
  assert.deepEqual(site.servers.map(s => s.host), ['ok']);
  assert.ok(site.problems.some(p => /nowhere \(CSV row 3\): rack Z99/.test(p)), site.problems.join('\n'));
  assert.ok(site.problems.some(p => /clash \(CSV row 4\).*already taken/.test(p)));
  assert.ok(site.problems.some(p => /norack \(CSV row 5\)/.test(p)));
  assert.ok(site.problems.some(p => /Columns not recognised/.test(p)));
});
