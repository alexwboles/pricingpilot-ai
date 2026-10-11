const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
const start = src.indexOf('  function invalidatePricing()');
const end = src.indexOf('  // ---------- nav',start);
assert.ok(start>=0 && end>start);
const nodes = Object.fromEntries(['calcResult','tierBase','tierMarginTable','posResult','sheetWrap','inHours','inRate','inMaterials','inOther','inOverhead','inMargin'].map(id=>[id,{textContent:'old quote',addEventListener(event,fn){this[event]=fn;}}]));
const ctx = {$:id=>nodes[id],lastRec:{price:100},lastTiers:[{price:85}]};
vm.runInNewContext(src.slice(start,end),ctx);
for (const id of ['inHours','inRate','inMaterials','inOther','inOverhead','inMargin']) {
 ctx.lastRec={price:100};ctx.lastTiers=[{price:85}];
 nodes[id].input();
 assert.equal(ctx.lastRec,null);
 assert.equal(ctx.lastTiers.length,0);
 assert.match(nodes.sheetWrap.textContent,/Recalculate/);
}
assert.match(src,/function calculate\(\) \{\s*\$\('sheetWrap'\)\.textContent/);
console.log('Stale price: 20 assertions passed (handler test, not browser UI)');
