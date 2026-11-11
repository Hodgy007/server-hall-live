import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, ageYears, fillOf, oldest, rackCategory, buildCategories, PALETTE, OTHER, NONE } from '../js/colorby.js';

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
