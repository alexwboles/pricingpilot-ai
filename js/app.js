/* pricingpilot-ai UI — localStorage persistence, no network.
   Uses the shared core: window.PricingPilot (lib/logic.js). */
(function () {
  'use strict';
  var P = window.PricingPilot;
  var LS_STATE = 'pricingpilot.scenario.v1';
  var LS_QUOTES = 'pricingpilot.quotes.v1';

  function loadState() {
    var d = {
      inputs: { hours: '', rate: '', materials: '', other: '', overhead: '', margin: 40 },
      multipliers: { budget: 0.85, standard: 1.0, premium: 1.35 },
      names: { budget: 'Budget', standard: 'Standard', premium: 'Premium' },
      features: null, // tierKey -> [lines] when user edited inclusions
      bizName: '', svcName: '', validDays: 30, recTier: 'standard',
      competitors: ['', '', '']
    };
    try {
      var raw = localStorage.getItem(LS_STATE);
      if (raw) { var s = JSON.parse(raw); for (var k in s) d[k] = s[k]; }
    } catch (e) {}
    return d;
  }
  function saveState(s) { try { localStorage.setItem(LS_STATE, JSON.stringify(s)); } catch (e) {} }
  var state = loadState();

  function loadQuotes() {
    try { return JSON.parse(localStorage.getItem(LS_QUOTES) || '[]'); } catch (e) { return []; }
  }
  function saveQuotes(q) { try { localStorage.setItem(LS_QUOTES, JSON.stringify(q)); } catch (e) {} }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return P.money(n); }
  function $(id) { return document.getElementById(id); }

  var lastRec = null;   // recommendedPrice() result
  var lastTiers = [];   // generateTiers() result

  // ---------- nav ----------
  document.querySelectorAll('.topbar nav button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.topbar nav button').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      document.querySelectorAll('.view').forEach(function (v) { v.classList.add('hidden'); });
      $('view-' + b.dataset.view).classList.remove('hidden');
      if (b.dataset.view === 'tiers') renderTiersView();
      if (b.dataset.view === 'present') { /* rendered on demand */ }
    });
  });

  // ---------- calculator ----------
  function readInputs() {
    return {
      laborHours: $('inHours').value, hourlyRate: $('inRate').value,
      materials: $('inMaterials').value, other: $('inOther').value,
      overheadPct: $('inOverhead').value, marginPct: $('inMargin').value
    };
  }
  function fillInputs() {
    var i = state.inputs;
    $('inHours').value = i.hours; $('inRate').value = i.rate;
    $('inMaterials').value = i.materials; $('inOther').value = i.other;
    $('inOverhead').value = i.overhead; $('inMargin').value = i.margin;
    $('bizName').value = state.bizName; $('svcName').value = state.svcName;
    $('validDays').value = state.validDays; $('recTier').value = state.recTier;
    $('comp1').value = state.competitors[0]; $('comp2').value = state.competitors[1]; $('comp3').value = state.competitors[2];
  }

  function breakdownBar(segs) {
    var html = '<div class="breakdown-bar">';
    segs.forEach(function (s) {
      var w = Math.max(s.pct, 0);
      html += '<div class="seg" style="width:' + w + '%;background:' + s.color + '" title="' +
        esc(s.label) + ': ' + money(s.amount) + ' (' + s.pct + '%)">' +
        (s.pct >= 9 ? esc(s.label) + ' ' + s.pct + '%' : '') + '</div>';
    });
    html += '</div><div class="legend">' + segs.map(function (s) {
      return '<span><span class="swatch" style="background:' + s.color + '"></span>' +
        esc(s.label) + ' ' + money(s.amount) + '</span>';
    }).join('') + '</div>';
    return html;
  }

  function computeTiers() {
    var opts = {
      multipliers: state.multipliers,
      names: state.names,
      customFeatures: {} // user-added lines beyond templates are folded into state.features instead
    };
    lastTiers = P.generateTiers(lastRec ? lastRec.price : 0, opts);
    if (state.features) {
      lastTiers.forEach(function (t) {
        if (state.features[t.key] && state.features[t.key].length) t.features = state.features[t.key].slice();
      });
    }
    return lastTiers;
  }

  function calculate() {
    var raw = readInputs();
    state.inputs = { hours: raw.laborHours, rate: raw.hourlyRate, materials: raw.materials,
      other: raw.other, overhead: raw.overheadPct, margin: raw.marginPct };
    saveState(state);
    lastRec = P.recommendedPrice(raw);
    computeTiers();
    var c = lastRec.breakdown, segs = P.marginBreakdown(lastRec);
    var html = '<div class="price-big">' + money(lastRec.price) + '</div>' +
      '<p class="price-sub">at your ' + c.marginPct + '% target margin</p>' +
      '<div class="kv"><span>Labor (' + c.laborHours + 'h × ' + money(c.hourlyRate) + ')</span><span>' + money(c.labor) + '</span></div>' +
      '<div class="kv"><span>Materials</span><span>' + money(c.materials) + '</span></div>' +
      '<div class="kv"><span>Other costs</span><span>' + money(c.other) + '</span></div>' +
      '<div class="kv"><span>Overhead (' + c.overheadPct + '%)</span><span>' + money(c.overhead) + '</span></div>' +
      '<div class="kv"><strong>Total cost</strong><strong>' + money(c.fullCost) + '</strong></div>' +
      '<div class="kv"><span>Profit baked in</span><span class="profit">' + money(lastRec.profit) + '</span></div>' +
      '<h3>Price breakdown</h3>' + breakdownBar(segs);
    $('calcResult').innerHTML = html;
    $('tierBase').textContent = money(lastRec.price);
    renderTierEditors();
    renderTierMargins();
  }
  $('calcBtn').addEventListener('click', calculate);

  // ---------- tiers view ----------
  function renderTierEditors() {
    var box = $('tierEditors');
    box.innerHTML = '';
    P.TIER_KEYS.forEach(function (k) {
      var tier = lastTiers.filter(function (t) { return t.key === k; })[0];
      var feats = tier ? tier.features : P.TIER_TEMPLATES[k];
      var div = document.createElement('div');
      div.className = 'tier-card tier-' + k;
      div.innerHTML =
        '<div class="tier-head"><span class="tname">' + esc(state.names[k]) + '</span>' +
        '<span class="tier-mult">' + esc(state.multipliers[k]) + '×</span></div>' +
        '<label>Name <input data-k="' + k + '" data-f="name" value="' + esc(state.names[k]) + '"></label>' +
        '<label>Multiplier <input data-k="' + k + '" data-f="mult" type="number" min="0.1" step="0.05" value="' + esc(state.multipliers[k]) + '"></label>' +
        '<label>Inclusions (one per line)<textarea data-k="' + k + '" data-f="feats">' +
        esc(feats.join('\n')) + '</textarea></label>';
      box.appendChild(div);
    });
    // live-sync tier header names with the name inputs
    box.querySelectorAll('input[data-f="name"]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var head = inp.closest('.tier-card').querySelector('.tname');
        if (head) head.textContent = inp.value.trim() || inp.dataset.k;
      });
    });
  }

  function readTierEditors() {
    $('tierEditors').querySelectorAll('input,textarea').forEach(function (el) {
      var k = el.dataset.k, f = el.dataset.f;
      if (f === 'name') state.names[k] = el.value.trim() || k;
      else if (f === 'mult') { var m = parseFloat(el.value); if (!isNaN(m) && m > 0) state.multipliers[k] = m; }
      else if (f === 'feats') {
        state.features = state.features || {};
        state.features[k] = el.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      }
    });
    saveState(state);
  }

  function renderTiersView() {
    if (!lastRec) calculate(); else { computeTiers(); }
    renderTierEditors();
    renderTierMargins();
  }
  $('regenTiers').addEventListener('click', function () {
    if (!lastRec) { alert('Calculate a price first.'); return; }
    readTierEditors();
    computeTiers();
    renderTierMargins();
  });

  function renderTierMargins() {
    var box = $('tierMarginTable');
    if (!lastRec || !lastTiers.length) { box.innerHTML = '<p class="muted">Calculate a price first.</p>'; return; }
    var rows = P.tierMarginTable(lastTiers, lastRec.breakdown.fullCost);
    var html = '<table class="margins"><tr><th>Tier</th><th>Price</th><th>Margin</th><th>vs target</th></tr>';
    rows.forEach(function (r) {
      var diff = Math.round((r.marginPct - lastRec.breakdown.marginPct) * 10) / 10;
      var note = diff >= 0 ? '+' + diff + ' pts' : diff + ' pts';
      var cls = diff > 0 ? 'delta up' : diff < 0 ? 'delta down' : 'delta';
      html += '<tr><td><strong>' + esc(r.name) + '</strong></td><td>' + money(r.price) + '</td><td>' +
        r.marginPct + '%</td><td><span class="' + cls + '">' + note + '</span></td></tr>';
    });
    box.innerHTML = html + '</table>';
  }

  // ---------- competitor positioning ----------
  $('posBtn').addEventListener('click', function () {
    if (!lastRec) { alert('Calculate a price first.'); return; }
    readTierEditors();
    computeTiers();
    state.competitors = [$('comp1').value, $('comp2').value, $('comp3').value];
    saveState(state);
    var comps = state.competitors.map(Number).filter(function (n) { return !isNaN(n) && n > 0; });
    var report = P.positioningReport(lastTiers, comps);
    var html = '';
    report.forEach(function (r) {
      html += '<div class="pos-advice ' + r.verdict + '"><strong>' + esc(r.tierName) + '</strong> — ' + money(r.price) + ' ' +
        '<span class="flag ' + r.verdict + '">' +
        (r.verdict === 'no-data' ? 'no data' : r.verdict.toUpperCase()) + '</span>' +
        '<p>' + esc(r.advice) + '</p></div>';
    });
    html += '<p><strong>Overall:</strong> ' + esc(P.positioningSummary(report)) + '</p>';
    $('posResult').innerHTML = html;
  });

  // ---------- present / one-pager ----------
  function collectPresent() {
    state.bizName = $('bizName').value; state.svcName = $('svcName').value;
    state.validDays = $('validDays').value; state.recTier = $('recTier').value;
    saveState(state);
  }
  $('renderSheet').addEventListener('click', function () {
    if (!lastRec) { alert('Calculate a price first.'); return; }
    collectPresent();
    var rows = P.tierMarginTable(lastTiers, lastRec.breakdown.fullCost);
    var page = P.buildOnePager({
      businessName: state.bizName, serviceName: state.svcName,
      tiers: lastTiers, tierMargins: rows,
      recommendedKey: state.recTier, validDays: state.validDays
    });
    var html = '<div class="sheet-doc"><div class="sheet-head">' +
      '<div class="sheet-biz">' + esc(page.businessName) + '</div>' +
      '<div class="sheet-svc">' + esc(page.serviceName) + '</div>' +
      '<p class="sheet-meta">Priced with PricingPilot AI · ' + esc(page.generated) + ' · Valid until ' + esc(page.validUntil) + '</p></div>';
    html += '<div class="sheet-tiers">';
    page.tiers.forEach(function (t) {
      var rec = t.key === page.recommendedKey;
      html += '<div class="sheet-tier' + (rec ? ' recommended' : '') + '">' +
        (rec ? '<div class="badge">RECOMMENDED</div>' : '') +
        '<h3>' + esc(t.name) + '</h3><div class="tier-price">' + money(t.price) + '</div><ul>' +
        t.features.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul></div>';
    });
    html += '</div>';
    html += '<h3>Margin at a glance</h3><table class="margins"><tr><th>Tier</th><th>Price</th><th>Margin</th></tr>';
    page.tierMargins.forEach(function (r) {
      html += '<tr><td>' + esc(r.name) + '</td><td>' + money(r.price) + '</td><td>' + r.marginPct + '%</td></tr>';
    });
    html += '</table><p class="muted small">This quote is valid until ' + esc(page.validUntil) + '.</p>';
    html += '<div class="sheet-actions no-print"><button id="printSheet" class="primary">Print one-pager</button></div>';
    html += '</div>';
    $('sheetWrap').innerHTML = html;
    $('printSheet').addEventListener('click', function () { window.print(); });
  });

  // ---------- saved quotes ----------
  $('saveQuote').addEventListener('click', function () {
    var name = $('quoteName').value.trim();
    if (!name) { alert('Name the quote first.'); return; }
    var qs = loadQuotes();
    qs.push({ id: 'q' + Date.now(), name: name, savedAt: new Date().toISOString(), state: state });
    saveQuotes(qs);
    $('quoteName').value = '';
    renderQuotes();
  });

  function renderQuotes() {
    var qs = loadQuotes(), box = $('quoteList');
    if (!qs.length) { box.innerHTML = '<p class="muted">No saved quotes yet.</p>'; return; }
    box.innerHTML = '';
    qs.forEach(function (q) {
      var row = document.createElement('div');
      row.className = 'quote-row';
      var d = new Date(q.savedAt);
      row.innerHTML = '<div><strong>' + esc(q.name) + '</strong><br><span class="muted small">saved ' +
        esc(d.toLocaleDateString()) + '</span></div>' +
        '<div class="qbtns"><button class="ghost">Load</button> <button class="danger">Delete</button></div>';
      row.querySelector('.ghost').addEventListener('click', function () {
        state = q.state; saveState(state); fillInputs(); calculate();
        alert('Loaded "' + q.name + '".');
      });
      row.querySelector('.danger').addEventListener('click', function () {
        if (confirm('Delete "' + q.name + '"?')) { saveQuotes(loadQuotes().filter(function (x) { return x.id !== q.id; })); renderQuotes(); }
      });
      box.appendChild(row);
    });
  }

  fillInputs();
  renderQuotes();
})();
