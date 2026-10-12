const assert=require('node:assert/strict'),P=require('../lib/logic.js');
assert.equal(P.recommendedPrice({laborHours:1,hourlyRate:100,marginPct:40}).price,166.67);
for(const inputs of [{laborHours:1e308,hourlyRate:1e308},{materials:1e308},{laborHours:1,hourlyRate:100,overheadPct:1e308}])assert.throws(()=>P.recommendedPrice(inputs),RangeError);
const now=Date.now;try{Date.now=()=>123;let quotes=[{id:'original',name:'Synthetic quote',state:{inputs:{hours:1,rate:100,margin:40}}}];for(let i=0;i<50;i++)quotes=P.duplicateQuote(quotes,'original').quotes;assert.equal(new Set(quotes.map(q=>q.id)).size,51);assert.equal(quotes[0].id,'original');assert.equal(quotes[1].id,'q123');assert.equal(quotes[2].id,'q123-1');assert.equal(P.duplicateQuote(quotes,'missing').duplicated,null);}finally{Date.now=now;}
assert.equal(P.recommendedPrice({laborHours:-5,hourlyRate:100}).price,0);
console.log('PASS baseline pricing, unsafe amount rejection and 50 same-millisecond duplicate IDs');
