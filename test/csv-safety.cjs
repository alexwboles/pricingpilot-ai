'use strict';
const assert = require('node:assert/strict');
const P = require('../lib/logic.js');
function exportName(name) {
  return P.quotesToCSV([{name, savedAt: '2026-10-10', state: {}}]).split('\n')[1];
}
for (const name of ['=1+1', '+SUM(A1)', '-1+2', '@SUM(A1)', '  =1+1', '\t=1+1']) {
  assert.ok(exportName(name).startsWith("'" + name + ','), name);
}
assert.ok(exportName('Normal quote').startsWith('Normal quote,'));
assert.ok(exportName('Smith, "kitchen"').startsWith('"Smith, ""kitchen""",'));
assert.ok(exportName('First\rSecond').startsWith('"First\rSecond",'));
const csv = P.quotesToCSV([{name:'Loss', state:{inputs:{hours:1, rate:100, margin:0}}}]);
assert.ok(csv.includes('-17.65'), 'negative numeric margins remain numbers');
assert.equal(P.quotesToCSV([]).split('\n').length, 1);
console.log('CSV safety: 11 assertions passed');
