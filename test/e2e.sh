#!/usr/bin/env bash
# e2e.sh — 9 end-to-end flows through pricingpilot-ai core logic (the same code the UI runs)
set -u
cd "$(dirname "$0")/.."
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "PASS: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL: $1"; }

node << 'EOF'
var P = require('./lib/logic.js');
var fails = [];
function eq(a, b, label) { if (a !== b) fails.push(label + ': got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b)); }
function t(cond, label) { if (!cond) fails.push(label); }

// FLOW 1: full job lifecycle — costs in, recommended price out, margin table
var rec = P.recommendedPrice({laborHours:8, hourlyRate:60, materials:200, other:50, overheadPct:10, marginPct:35});
// labor 480 + 200 + 50 = 730; ovh 73; full 803; price 803/0.65 = 1235.38
eq(rec.breakdown.labor, 480, 'flow1 labor');
eq(rec.breakdown.overhead, 73, 'flow1 overhead');
eq(rec.breakdown.fullCost, 803, 'flow1 fullCost');
eq(rec.price, 1235.38, 'flow1 price');
var tiers = P.generateTiers(rec.price);
var rows = P.tierMarginTable(tiers, rec.breakdown.fullCost);
eq(rows[1].marginPct, 35, 'flow1 standard tier holds target margin');
t(rows[0].marginPct < 35 && rows[2].marginPct > 35, 'flow1 budget < premium margin');

// FLOW 2: breakdown segments tile exactly to the price
var segs = P.marginBreakdown(rec);
eq(segs.length, 4, 'flow2 four segments');
var total = Math.round(segs.reduce(function (a, s) { return a + s.amount; }, 0) * 100) / 100;
eq(total, rec.price, 'flow2 segments sum to price');
var pctTotal = Math.round(segs.reduce(function (a, s) { return a + s.pct; }, 0) * 100) / 100;
t(Math.abs(pctTotal - 100) < 0.05, 'flow2 pcts sum to 100');
t(segs[0].label === 'Labor' && segs[3].label === 'Profit', 'flow2 segment labels');

// FLOW 3: custom multipliers + editable names + extra features
var custom = P.generateTiers(1000, {
  multipliers: { budget: 0.8, standard: 1.1, premium: 1.5 },
  names: { budget: 'Essential', standard: 'Deluxe', premium: 'Signature' },
  customFeatures: { premium: ['Drone photo of finished work'] }
});
eq(custom[0].price, 800, 'flow3 custom multiplier');
eq(custom[2].name, 'Signature', 'flow3 custom name');
t(custom[2].features.indexOf('Drone photo of finished work') >= 0, 'flow3 extra feature appended');
t(custom[0].features.length < custom[2].features.length, 'flow3 template differentiation');

// FLOW 4: competitor positioning — undercut, aligned, premium all fire
var rep = P.positioningReport(P.generateTiers(1000), [850, 990]);
var v = {};
rep.forEach(function (r) { v[r.tierKey] = r.verdict; });
// budget 850 vs nearest 850 -> aligned (0%); standard 1000 vs 990 -> aligned (1%); premium 1350 vs 990 -> premium
eq(v.budget, 'aligned', 'flow4 budget aligned');
eq(v.standard, 'aligned', 'flow4 standard aligned');
eq(v.premium, 'premium', 'flow4 premium premium');
t(/quality guarantees/i.test(rep[2].advice), 'flow4 premium advice mentions guarantees');
var under = P.positioningReport(P.generateTiers(1000), [1400, 1500]);
t(under[0].verdict === 'undercut', 'flow4 undercut fires');
t(/leaving money on the table/i.test(under[0].advice), 'flow4 undercut advice');
var s = P.positioningSummary(rep);
t(/Good spread/i.test(s), 'flow4 summary for spread');
t(/competitor prices/i.test(P.positioningSummary(P.positioningReport(P.generateTiers(100), []))), 'flow4 no-data summary');

// FLOW 5: one-pager assembly
var page = P.buildOnePager({
  businessName: 'Acme Plumbing', serviceName: 'Water heater install',
  tiers: tiers, tierMargins: rows, recommendedKey: 'standard', validDays: 14
});
eq(page.businessName, 'Acme Plumbing', 'flow5 business');
eq(page.recommendedKey, 'standard', 'flow5 recommended');
t(page.validUntil.length > 5, 'flow5 valid-until date present');
t(page.tiers.length === 3, 'flow5 tiers carried through');

// FLOW 6: edge inputs never crash or go negative
t(P.recommendedPrice({}).price === 0, 'flow6 empty inputs = 0');
t(P.recommendedPrice({laborHours:2, hourlyRate:50, marginPct:95}).price === 2000, 'flow6 95% margin allowed');
t(P.recommendedPrice({laborHours:2, hourlyRate:50, marginPct:99}).price === 2000, 'flow6 >95% clamped to 95%');
t(P.marginBreakdown({price: 0, breakdown: {}, profit: 0}).length === 0, 'flow6 zero price = no segments');
eq(P.actualMarginPct(500, 1000), 50, 'flow6 actual margin 50%');
eq(P.nearestCompetitor(900, [1000, 850, 1200]), 850, 'flow6 nearest competitor');

// FLOW 7: money + deterministic tiers — same inputs always same outputs
eq(P.money(862.5), '$862.50', 'flow7 money format');
var a = JSON.stringify(P.generateTiers(862.5));
var b = JSON.stringify(P.generateTiers(862.5));
eq(a, b, 'flow7 deterministic tiers');

// FLOW 8: saved-quote lifecycle — duplicate, filter, CSV export
var st = { inputs: { hours: 8, rate: 60, materials: 200, other: 50, overhead: 10, margin: 35 },
           multipliers: { budget: 0.85, standard: 1.0, premium: 1.35 },
           names: { budget: 'Budget', standard: 'Standard', premium: 'Premium' } };
var myQuotes = [{ id: 'q1', name: 'Acme HQ rewire', savedAt: '2026-10-01T00:00:00.000Z', state: st }];
var dupRes = P.duplicateQuote(myQuotes, 'q1');
eq(dupRes.quotes.length, 2, 'flow8 duplicate adds one');
eq(dupRes.duplicated.name, 'Acme HQ rewire (copy)', 'flow8 duplicate name');
t(dupRes.duplicated.id !== 'q1', 'flow8 duplicate fresh id');
var filtered = P.filterQuotes(dupRes.quotes, 'copy');
eq(filtered.length, 1, 'flow8 filter finds copy');
t(P.filterQuotes(dupRes.quotes, 'ACME').length === 2, 'flow8 filter case-insensitive');
var csv = P.quotesToCSV(dupRes.quotes);
var csvLines = csv.split('\n');
eq(csvLines.length, 3, 'flow8 csv has header + 2 rows');
t(csvLines[0].split(',').length === 9, 'flow8 csv header has 9 columns');
// 8h*60 + 200 + 50 = 730; ovh 73; full 803; 803/0.65 = 1235.38 base price in CSV
t(csvLines[1].indexOf('$1235.38') !== -1, 'flow8 csv carries recomputed base price');
t(csvLines[1].indexOf('Acme HQ rewire (copy)') === -1 && csvLines[2].indexOf('Acme HQ rewire (copy)') !== -1,
  'flow8 csv rows follow quote order');

// FLOW 9: effective hourly rate — sanity check on the whole estimate
// flow1 recap: price 1235.38 over 8 labor hours -> 154.42 $/hr
eq(P.effectiveHourlyRate(rec.price, rec.breakdown.laborHours), 154.42, 'flow9 base effective rate');
var effRows = P.tierMarginTable(tiers, rec.breakdown.fullCost).map(function (r) {
  return P.effectiveHourlyRate(r.price, rec.breakdown.laborHours);
});
t(effRows[0] < effRows[1] && effRows[1] < effRows[2], 'flow9 per-tier effective rates rise with tiers');
t(P.effectiveHourlyRate(1000, 0) === null, 'flow9 null without labor hours');

if (fails.length) { fails.forEach(function (f) { console.error('FAIL: ' + f); }); process.exit(1); }
console.log('all 9 flows green');
EOF
if [ $? -eq 0 ]; then
  for i in 1 2 3 4 5 6 7 8 9; do ok "e2e flow $i"; done
else
  bad "e2e flows (node assertions failed)"
fi

# HTML sanity: all referenced assets exist
for f in $(grep -o 'src="[^"]*"\|href="[^"]*"' index.html | cut -d'"' -f2 | grep -v '^http'); do
  [ -f "$f" ] && ok "asset $f" || bad "asset $f missing"
done

echo "--- e2e: $PASS passed, $FAIL failed ---"
[ "$FAIL" -eq 0 ]
