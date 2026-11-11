import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, ageYears, fillOf, oldest, rackCategory, rackMix, ageMix, serverCategory, buildCategories, tabValue, TAB_SCALE, PALETTE, OTHER, NONE } from '../js/colorby.js';

const sv = (h, o = {}) => ({ h, role: '', maker: 'Dell', model: 'R1', installed: '', ...o });

test('dates in the formats a spreadsheet gives', () => {
  assert.equal(parseDate('2021-03-15').toISOString().slice(0, 10), '2021-03-15');
  assert.equal(parseDate('2021-03').toISOString().slice(0, 10), '2021-03-01');
  assert.equal(parseDate('2021').toISOString().slice(0, 10), '2021-01-01');
  assert.equal(parseDate('15/03/2021').toISOString().slice(0, 10), '2021-03-15');
  assert.equal(parseDate('2021-03-15T10:00:00Z').toISOString().slice(0, 10), '2021-03-15');
  for (const bad of ['', 'soon', '2021-13', '31/31/2021', null]) assert.equal(parseDate(bad), null);
});
test('age is in years and never negative', () => {
  const now = new Date(Date.UTC(2026, 0, 1));
  assert.ok(Math.abs(ageYears('2021-01-01', now) - 5) < 0.02);
  assert.equal(ageYears('2030-01-01', now), 0);
  assert.equal(ageYears('', now), null);
  assert.equal(oldest([sv(1, { installed: '2024' }), sv(1, { installed: '2020' }), sv(1)], now) > 5.9, true);
  assert.equal(oldest([sv(1)], now), null);
});
test('fill is the share of the 38 usable U', () => {
  assert.equal(fillOf([]), 0);
  assert.equal(fillOf([sv(2), sv(17)]), 0.5);
  assert.equal(fillOf([sv(40)]), 1);
});
test('a rack takes the category holding most U', () => {
  assert.equal(rackCategory([], 'role'), null);
  assert.equal(rackCategory([sv(1, { role: 'web' }), sv(2, { role: 'db' }), sv(1, { role: 'web' })], 'role'), 'db');
  assert.equal(rackCategory([sv(1, { role: 'b' }), sv(1, { role: 'a' })], 'role'), 'a');
  assert.equal(rackCategory([sv(1)], 'role'), 'Not recorded');
  assert.equal(rackCategory([sv(1, { maker: 'Generic' })], 'maker'), 'Not recorded');
});
test('categories are capped with an Other bucket', () => {
  const values = []; for (let i = 0; i < 12; i++) for (let k = 0; k <= 12 - i; k++) values.push('m' + i);
  values.push(null, 'Not recorded');
  const c = buildCategories(values);
  assert.equal(c.list.length, PALETTE.length + 2);
  assert.equal(c.list[0].label, 'm0'); assert.equal(c.list[0].colour, PALETTE[0]);
  assert.match(c.list[PALETTE.length].label, /^Other \(4\)$/);
  assert.equal(c.colourOf('m11'), OTHER); assert.equal(c.colourOf('m1'), PALETTE[1]);
  assert.equal(c.colourOf(null), NONE); assert.equal(c.colourOf('Not recorded'), NONE);
  assert.equal(c.list.at(-1).label, 'Not recorded');
  assert.equal(buildCategories(['a', 'b']).list.length, 2);
});
test('a rack of mixed servers is the mix of what it holds', () => {
  assert.deepEqual(rackMix([], 'model'), []);
  const mix = rackMix([sv(1, { model: 'R660' }), sv(2, { model: 'DL380' }), sv(1, { model: 'R660' }), sv(4, { model: '' })], 'model');
  assert.deepEqual(mix, [{ label: 'Not recorded', u: 4, n: 1 }, { label: 'DL380', u: 2, n: 1 }, { label: 'R660', u: 2, n: 2 }]);
  assert.equal(serverCategory(sv(1, { role: ' db ' }), 'role'), 'db');
  assert.equal(serverCategory(sv(1, { maker: 'Generic' }), 'maker'), 'Not recorded');
});
test('ages are grouped by whole years, oldest first, undated last', () => {
  const now = new Date(Date.UTC(2026, 0, 1));
  const mix = ageMix([sv(1, { installed: '2025-06' }), sv(2, { installed: '2017' }), sv(1, { installed: '2019' }), sv(1), sv(2, { installed: '2025-03' })], now);
  assert.deepEqual(mix.map(e => [e.u, e.n]), [[3, 2], [3, 2], [1, 1]]);
  assert.ok(mix[0].years > 7.9 && mix[0].years < 8.1);   // 9 and 7 years, grouped as "6 and over"
  assert.ok(mix[1].years > 0.5 && mix[1].years < 0.9);
  assert.equal(mix[2].years, null);
});
test('categories keep their legend order for stacking', () => {
  const c = buildCategories(['a', 'a', 'b', 'Not recorded', 'c'], 2);
  assert.deepEqual(['a', 'b', 'c', 'Not recorded'].map(c.orderOf), [0, 1, 2, 3]);
});

test('monitoring tabs show the server\'s own figure for the mode', () => {
  const m = { load: 0.4, temp: 61, power: 300, spec: { w: [100, 600] } };
  assert.equal(tabValue('load', m), 0.4);
  assert.equal(tabValue('heat', m), 61);
  assert.equal(tabValue('power', m), 0.5);
  assert.equal(tabValue('power', { ...m, spec: { w: [0, 0] } }), 0);   // no flat-out figure
  assert.equal(tabValue('power', { ...m, spec: undefined }), 0);
  assert.equal(tabValue('heat', { ...m, temp: NaN }), 0);
  assert.deepEqual(TAB_SCALE, { load: 'load', heat: 'cpu', power: 'power' });
});
