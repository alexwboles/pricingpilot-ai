#!/usr/bin/env bash
# smoke.sh — 11 quick checks for pricingpilot-ai
set -u
cd "$(dirname "$0")/.."
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "PASS: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL: $1"; }

[ -f index.html ] && ok "index.html exists" || bad "index.html missing"
[ -f css/style.css ] && ok "css/style.css exists" || bad "css missing"
[ -f js/app.js ] && ok "js/app.js exists" || bad "js missing"
[ -f lib/logic.js ] && ok "lib/logic.js exists" || bad "logic missing"
[ -f README.md ] && ok "README exists" || bad "README missing"

node --check lib/logic.js 2>/dev/null && ok "logic.js syntax valid" || bad "logic.js syntax"
node --check js/app.js 2>/dev/null && ok "app.js syntax valid" || bad "app.js syntax"

node -e "
var P = require('./lib/logic.js');
// cost -> price: 4h*75 + 120 + 30 = 450; +15% ovh = 517.5; / (1-0.4) = 862.5
var rec = P.recommendedPrice({laborHours:4, hourlyRate:75, materials:120, other:30, overheadPct:15, marginPct:40});
if (rec.price !== 862.5) { console.error('price '+rec.price); process.exit(1); }
if (rec.breakdown.fullCost !== 517.5) { console.error('cost '+rec.breakdown.fullCost); process.exit(1); }
// margin clamp: >95% clamps to 95%
if (P.priceFromMargin(100, 150) !== 2000) { console.error('clamp'); process.exit(1); }
// negatives treated as zero
if (P.recommendedPrice({laborHours:-2, hourlyRate:75, materials:-5, other:0, overheadPct:0, marginPct:40}).price !== 0) { console.error('neg'); process.exit(1); }
// tiers: 0.85x / 1.0x / 1.35x, budget gets essentials-only template
var tiers = P.generateTiers(1000);
if (tiers.length !== 3) { console.error('tier count'); process.exit(1); }
if (tiers[0].price !== 850 || tiers[1].price !== 1000 || tiers[2].price !== 1350) { console.error('tier prices'); process.exit(1); }
if (tiers[0].features.length === 0 || tiers[2].features.length <= tiers[0].features.length) { console.error('tier features'); process.exit(1); }
// breakdown: 4 segments summing to price
var segs = P.marginBreakdown(rec);
var sum = segs.reduce(function(a,s){return a+s.amount;},0);
if (segs.length !== 4 || Math.abs(sum - 862.5) > 0.01) { console.error('breakdown'); process.exit(1); }
// positioning verdicts: 850 vs [700,900] -> aligned; 1350 vs [700,900] -> premium
var rep = P.positioningReport(P.generateTiers(1000), [700, 900]);
if (rep[0].verdict !== 'aligned') { console.error('verdict1 '+rep[0].verdict); process.exit(1); }
if (rep[2].verdict !== 'premium') { console.error('verdict3 '+rep[2].verdict); process.exit(1); }
if (!/quality guarantees/i.test(rep[2].advice)) { console.error('advice'); process.exit(1); }
console.log('logic checks ok');
" && ok "logic: price/clamp/tiers/breakdown/positioning" || bad "logic checks"

grep -q "window.print" js/app.js && grep -q "@media print" css/style.css && ok "print one-pager wired" || bad "print wiring missing"
grep -q "localStorage" js/app.js && ok "localStorage persistence" || bad "no persistence"
grep -q "window.PricingPilot" lib/logic.js js/app.js && ok "PricingPilot global wired" || bad "global missing"

echo "--- smoke: $PASS passed, $FAIL failed ---"
[ "$FAIL" -eq 0 ]
