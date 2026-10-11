const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const handler = source.split("$('renderSheet').addEventListener('click', function () {")[1].split('// ---------- saved quotes')[0];
const body = handler.slice(0, handler.lastIndexOf('});'));
const P = require('../lib/logic.js');
for (const enabled of [false,true]) {
 const elements = {includeMargins:{checked:enabled},sheetWrap:{},printSheet:{addEventListener(){}}};
 const rec = P.recommendedPrice({laborHours:1,hourlyRate:100,marginPct:40});
 const context = {$:id=>elements[id],P,lastRec:rec,lastTiers:P.generateTiers(rec.price),collectPresent(){},state:{bizName:'Demo',svcName:'Review',recTier:'standard',validDays:30},esc:String,money:P.money,window:{print(){}}};
 vm.runInNewContext('(function(){'+body+'})()',context);
 assert.equal(elements.sheetWrap.innerHTML.includes('Internal copy'),enabled);
 assert.equal(elements.sheetWrap.innerHTML.includes('<th>Margin</th>'),enabled);
 assert.ok(elements.sheetWrap.innerHTML.includes('Demo'));
}
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.match(html, /id="includeMargins" type="checkbox">/);
console.log('Quote privacy: 7 assertions passed (render handler, not browser UI)');
for (const tier of P.generateTiers(100)) {
 assert.ok(tier.features.every(feature=>feature.startsWith('Confirm ')), 'default inclusions require business confirmation');
}
console.log('Default quote terms: 3 tier checks passed');
