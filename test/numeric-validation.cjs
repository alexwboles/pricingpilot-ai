const assert = require('node:assert/strict');
const P = require('../lib/logic.js');
let count = 0;
for (const value of [Infinity,-Infinity,NaN,'Infinity','1e999','100abc','',null,undefined,true,{},[]]) {
 assert.equal(P.num(value,7),7); count++;
 const rec = P.recommendedPrice({materials:value, marginPct:40});
 assert.equal(rec.price,0); count++;
}
assert.equal(P.num('12.50'),12.5); count++;
assert.equal(P.num(' 1e2 '),100); count++;
assert.equal(P.num(-10),0); count++;
assert.equal(P.num('bad',Infinity),0); count++;
assert.equal(P.recommendedPrice({laborHours:4,hourlyRate:75,materials:120,other:30,overheadPct:15,marginPct:40}).price,862.5); count++;
console.log('Numeric validation: '+count+' assertions passed');
