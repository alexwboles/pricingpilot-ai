const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
const save=source.slice(source.indexOf('  function saveState('),source.indexOf('  var state = loadState();'));
const quotes=source.slice(source.indexOf('  function loadQuotes('),source.indexOf('  function esc('));
let raw='[]',fail=false,alerts=[],writes=0;
const context={LS_STATE:'state',LS_QUOTES:'quotes',alert:msg=>alerts.push(msg),localStorage:{getItem:()=>raw,setItem(){if(fail)throw Error('quota');writes++;}}};
vm.runInNewContext(save+quotes,context);
assert.equal(context.saveState({}),true);
assert.equal(context.saveQuotes([]),true);
fail=true;
assert.equal(context.saveState({}),false);
assert.equal(context.saveQuotes([]),false);
assert.equal(writes,2);
assert.equal(alerts.length,2);
for(const bad of ['{broken','{}','null','[null]','[{"state":null}]']){
 raw=bad;
 assert.throws(()=>context.loadQuotes());
 assert.equal(writes,2);
}
raw='[]';assert.equal(context.loadQuotes().length,0);
assert.match(source,/if \(!saveQuotes\(qs\)\) return;/);
assert.match(source,/if \(!saveQuotes\(res.quotes\)\) return;/);
console.log('Storage errors: 19 assertions passed');
