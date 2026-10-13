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
  function saveState(s) {
    try { localStorage.setItem(LS_STATE, JSON.stringify(s)); return true; }
    catch (e) { alert('Your current changes could not be saved in this browser. Keep this page open and copy your details before closing.'); return false; }
  }
  var state = loadState();

  function loadQuotes() {
    try {
      var quotes = JSON.parse(localStorage.getItem(LS_QUOTES) || '[]');
      if (!Array.isArray(quotes) || quotes.some(function(q) { return !q || typeof q !== 'object' || !q.state || typeof q.state !== 'object'; })) throw new Error('Invalid quote storage');
      return quotes;
    } catch (e) {
      alert('Saved quotes could not be read. Existing stored data has not been overwritten. Stop saving new quotes until the data is recovered.');
      throw e;
    }
  }
  function saveQuotes(q) {
    try { localStorage.setItem(LS_QUOTES, JSON.stringify(q)); return true; }
    catch (e) { alert('Quote changes were not saved. Browser storage may be unavailable or full. Existing saved quotes were not changed.'); return false; }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return P.money(n); }
  function $(id) { return document.getElementById(id); }

  var lastRec = null;   // recommendedPrice() result
  var lastTiers = [];   // generateTiers() result

  function invalidatePricing() {
    lastRec = null;
    lastTiers = [];
    $('calcResult').textContent = 'Costs changed. Calculate again before using this price.';
    $('tierBase').textContent = 'Recalculation required';
    $('tierMarginTable').textContent = 'Recalculation required';
    $('posResult').textContent = 'Recalculation required';
    $('sheetWrap').textContent = 'Costs changed. Recalculate and render a new quote before printing.';
  }
  ['inHours','inRate','inMaterials','inOther','inOverhead','inMargin'].forEach(function (id) {
    $(id).addEventListener('input', invalidatePricing);
  });

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
        if (Array.isArray(state.features[t.key])) t.features = state.features[t.key].slice();
      });
    }
    return lastTiers;
  }

  function calculate() {
    $('sheetWrap').textContent = 'Price recalculated. Render a new quote before printing.';
    var raw = readInputs();
    state.inputs = { hours: raw.laborHours, rate: raw.hourlyRate, materials: raw.materials,
      other: raw.other, overhead: raw.overheadPct, margin: raw.marginPct };
    saveState(state);
    try {
      lastRec = P.recommendedPrice(raw);
      computeTiers();
    } catch (error) {
      lastRec = null;
      lastTiers = [];
      $('calcResult').textContent = 'Cannot calculate: ' + error.message;
      $('calcResult').setAttribute('role', 'alert');
      $('tierBase').textContent = 'Recalculation required';
      $('tierMarginTable').textContent = 'Reduce inputs and recalculate before presenting a quote.';
      $('sheetWrap').textContent = 'No valid quote available. Correct inputs and recalculate.';
      return;
    }
    $('calcResult').removeAttribute('role');
    var c = lastRec.breakdown, segs = P.marginBreakdown(lastRec);
    var effRate = P.effectiveHourlyRate(lastRec.price, c.laborHours);
    var html = '<div class="price-big">' + money(lastRec.price) + '</div>' +
      '<p class="price-sub">at your ' + c.marginPct + '% target margin</p>' +
      '<div class="kv"><span>Labor (' + c.laborHours + 'h × ' + money(c.hourlyRate) + ')</span><span>' + money(c.labor) + '</span></div>' +
      '<div class="kv"><span>Materials</span><span>' + money(c.materials) + '</span></div>' +
      '<div class="kv"><span>Other costs</span><span>' + money(c.other) + '</span></div>' +
      '<div class="kv"><span>Overhead (' + c.overheadPct + '%)</span><span>' + money(c.overhead) + '</span></div>' +
      '<div class="kv"><strong>Total cost</strong><strong>' + money(c.fullCost) + '</strong></div>' +
      '<div class="kv"><span>Profit baked in</span><span class="profit">' + money(lastRec.profit) + '</span></div>' +
      '<div class="kv"><span>Quoted revenue per labor hour (not take-home pay)</span><span>' +
      (effRate === null ? '<span class="muted">— (enter labor hours)</span>' : money(effRate) + ' / hr') + '</span></div>' +
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
      else if (f === 'mult') { var m = P.num(el.value); if (m > 0) state.multipliers[k] = m; }
      else if (f === 'feats') {
        state.features = state.features || {};
        state.features[k] = el.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      }
    });
    saveState(state);
  }

  $('tierEditors').addEventListener('input', function () {
    readTierEditors();
    computeTiers();
    renderTierMargins();
    $('sheetWrap').textContent = 'Tier details changed. Render a new quote before printing.';
    $('posResult').textContent = 'Tier details changed. Run positioning again.';
  });

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
    var html = '<table class="margins"><tr><th>Tier</th><th>Price</th><th>Margin</th><th>vs target</th><th title="Quoted revenue per labor hour, not profit or take-home pay">Revenue / labor hr</th></tr>';
    rows.forEach(function (r) {
      var diff = Math.round((r.marginPct - lastRec.breakdown.marginPct) * 10) / 10;
      var note = diff >= 0 ? '+' + diff + ' pts' : diff + ' pts';
      var cls = diff > 0 ? 'delta up' : diff < 0 ? 'delta down' : 'delta';
      var eff = P.effectiveHourlyRate(r.price, lastRec.breakdown.laborHours);
      html += '<tr><td><strong>' + esc(r.name) + '</strong></td><td>' + money(r.price) + '</td><td>' +
        r.marginPct + '%</td><td><span class="' + cls + '">' + note + '</span></td><td>' +
        (eff === null ? '—' : money(eff)) + '</td></tr>';
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
    var belowCost = lastTiers.filter(function (tier) { return tier.price < lastRec.breakdown.fullCost; });
    if (belowCost.length && !confirm('These tiers are below your estimated full cost: ' + belowCost.map(function (tier) { return tier.name + ' (' + money(tier.price) + ')'; }).join(', ') + '. Estimated cost: ' + money(lastRec.breakdown.fullCost) + '. Continue only if you intentionally accept this loss-making price.')) {
      $('sheetWrap').textContent = 'Quote not generated: adjust below-cost tiers or explicitly acknowledge them before presenting.';
      return;
    }
    collectPresent();
    var rows = P.tierMarginTable(lastTiers, lastRec.breakdown.fullCost);
    var page = P.buildOnePager({
      businessName: state.bizName, serviceName: state.svcName,
      tiers: lastTiers, tierMargins: $('includeMargins').checked ? rows : [],
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
    if (page.tierMargins.length) {
    html += '<h3>Internal copy — profit margins</h3><table class="margins"><tr><th>Tier</th><th>Price</th><th>Margin</th></tr>';
    page.tierMargins.forEach(function (r) {
      html += '<tr><td>' + esc(r.name) + '</td><td>' + money(r.price) + '</td><td>' + r.marginPct + '%</td></tr>';
    });
    html += '</table>';
    }
    html += '<p class="muted small">This quote is valid until ' + esc(page.validUntil) + '.</p>';
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
    qs.push({ id: P.uniqueQuoteId(qs), name: name, savedAt: new Date().toISOString(), state: state });
    if (!saveQuotes(qs)) return;
    $('quoteName').value = '';
    renderQuotes();
  });

  function renderQuotes() {
    var box = $('quoteList');
    var searchEl = $('quoteSearch');
    var q = searchEl ? searchEl.value : '';
    var qs = P.filterQuotes(loadQuotes(), q);
    if (!qs.length) {
      box.innerHTML = loadQuotes().length
        ? '<p class="muted">No quotes match "' + esc(q) + '".</p>'
        : '<p class="muted">No saved quotes yet.</p>';
      return;
    }
    box.innerHTML = '';
    qs.forEach(function (quote) {
      var row = document.createElement('div');
      row.className = 'quote-row';
      var d = new Date(quote.savedAt);
      row.innerHTML = '<div><strong>' + esc(quote.name) + '</strong><br><span class="muted small">saved ' +
        esc(d.toLocaleDateString()) + '</span></div>' +
        '<div class="qbtns"><button class="ghost" data-act="load">Load</button> ' +
        '<button class="ghost" data-act="dup">Duplicate</button> ' +
        '<button class="danger" data-act="del">Delete</button></div>';
      row.querySelector('[data-act="load"]').addEventListener('click', function () {
        state = quote.state; saveState(state); fillInputs(); calculate();
        alert('Loaded "' + quote.name + '".');
      });
      row.querySelector('[data-act="dup"]').addEventListener('click', function () {
        var res = P.duplicateQuote(loadQuotes(), quote.id);
        if (!saveQuotes(res.quotes)) return;
        renderQuotes();
        alert('Duplicated as "' + res.duplicated.name + '".');
      });
      row.querySelector('[data-act="del"]').addEventListener('click', function () {
        if (confirm('Delete "' + quote.name + '"?')) { saveQuotes(loadQuotes().filter(function (x) { return x.id !== quote.id; })); renderQuotes(); }
      });
      box.appendChild(row);
    });
  }

  function downloadCSV(filename, text) {
    var blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  $('exportQuotes').addEventListener('click', function () {
    var qs = loadQuotes();
    if (!qs.length) { alert('No saved quotes to export yet.'); return; }
    downloadCSV('pricingpilot-quotes.csv', P.quotesToCSV(qs));
  });

  var searchBox = $('quoteSearch');
  if (searchBox) searchBox.addEventListener('input', renderQuotes);

  // Ctrl/Cmd+Enter anywhere on the calculator step re-runs the estimate.
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' &&
        !$('view-calc').classList.contains('hidden')) {
      e.preventDefault();
      calculate();
    }
  });

  fillInputs();
  renderQuotes();
})();
