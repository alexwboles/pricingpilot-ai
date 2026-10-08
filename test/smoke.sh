#!/usr/bin/env bash
# smoke.sh — 16 quick checks for pricingpilot-ai
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

node -e "
var P = require('./lib/logic.js');
// CSV export: header + one row per quote, tier prices/margins recomputed from stored state
var st = { inputs: { hours: 4, rate: 75, materials: 120, other: 30, overhead: 15, margin: 40 },
           multipliers: { budget: 0.85, standard: 1.0, premium: 1.35 },
           names: { budget: 'Budget', standard: 'Standard', premium: 'Premium' } };
var qs = [{ id: 'q1', name: 'Smith, kitchen \"refit\"', savedAt: '2026-10-01T00:00:00.000Z', state: st }];
var csv = P.quotesToCSV(qs);
var lines = csv.split('\n');
if (lines.length !== 2) { console.error('csv lines '+lines.length); process.exit(1); }
if (!/^Quote name,Saved at,Base price/.test(lines[0])) { console.error('csv header'); process.exit(1); }
if (!/\"Smith, kitchen \"\"refit\"\"\"/.test(lines[1])) { console.error('csv escaping: '+lines[1]); process.exit(1); }
if (lines[1].indexOf('\$862.50') === -1) { console.error('csv base price missing: '+lines[1]); process.exit(1); }
if (P.quotesToCSV([]).split('\n').length !== 1) { console.error('csv empty'); process.exit(1); }
// filterQuotes: case-insensitive, empty query returns all
var fq = P.filterQuotes(qs, 'SMITH');
if (fq.length !== 1) { console.error('filter hit'); process.exit(1); }
if (P.filterQuotes(qs, 'zzz').length !== 0) { console.error('filter miss'); process.exit(1); }
if (P.filterQuotes(qs, '').length !== 1) { console.error('filter empty query'); process.exit(1); }
// duplicateQuote: fresh id, (copy) suffix, state preserved
var dup = P.duplicateQuote(qs, 'q1');
if (dup.quotes.length !== 2) { console.error('dup len'); process.exit(1); }
if (!dup.duplicated || dup.duplicated.id === 'q1') { console.error('dup id'); process.exit(1); }
if (dup.duplicated.name !== 'Smith, kitchen \"refit\" (copy)') { console.error('dup name'); process.exit(1); }
if (dup.duplicated.state.inputs.hours !== 4) { console.error('dup state'); process.exit(1); }
var none = P.duplicateQuote(qs, 'nope');
if (none.duplicated !== null || none.quotes.length !== 1) { console.error('dup missing id'); process.exit(1); }
// effectiveHourlyRate: price / labor hours, null when hours unknown
if (P.effectiveHourlyRate(862.5, 4) !== 215.63) { console.error('eff rate '+P.effectiveHourlyRate(862.5, 4)); process.exit(1); }
if (P.effectiveHourlyRate(862.5, 0) !== null) { console.error('eff zero hours'); process.exit(1); }
if (P.effectiveHourlyRate(0, 4) !== null) { console.error('eff zero price'); process.exit(1); }
console.log('new-feature logic checks ok');
" && ok "logic: CSV export/duplicate/filter/effective-rate" || bad "new-feature logic checks"

grep -q "window.print" js/app.js && grep -q "@media print" css/style.css && ok "print one-pager wired" || bad "print wiring missing"
grep -q "localStorage" js/app.js && ok "localStorage persistence" || bad "no persistence"
grep -q "window.PricingPilot" lib/logic.js js/app.js && ok "PricingPilot global wired" || bad "global missing"
grep -q 'getElementById(.exportQuotes.)\|$("exportQuotes")\|\$('"'"'exportQuotes'"'"')' js/app.js && grep -q 'id="exportQuotes"' index.html && ok "CSV export button wired" || bad "CSV export wiring missing"
grep -q 'id="quoteSearch"' index.html && grep -q "filterQuotes" js/app.js && ok "quote search wired" || bad "quote search wiring missing"
grep -q "duplicateQuote" js/app.js lib/logic.js && ok "duplicate quote wired" || bad "duplicate wiring missing"
grep -q "keydown" js/app.js && grep -q "metaKey" js/app.js && grep -q "Ctrl" index.html && ok "Ctrl/Cmd+Enter shortcut wired" || bad "shortcut wiring missing"

echo "--- smoke: $PASS passed, $FAIL failed ---"
[ "$FAIL" -eq 0 ]
