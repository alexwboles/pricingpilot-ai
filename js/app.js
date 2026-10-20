/* pricingpilot-ai UI — localStorage persistence, no network.
   Uses the shared core: window.PricingPilot (lib/logic.js). */
(async function () {
  'use strict';
  var P = window.PricingPilot;
  var LS_STATE = 'pricingpilot.scenario.v1';
  var LS_QUOTES = 'pricingpilot.quotes.v1';
  var scenarioRecoveryNeeded = false;
  var quoteStorageUnavailable = false;
  var B = window.PricingPilotBackup, storageRecoveryNeeded = false;
  var editingAllowed = false, releaseEditingLock = null;
  // The lock is held for the document lifetime, not a time-based lease that
  // could expire while a sleeping/background tab still has an unsaved draft.
  if (navigator.locks && window.isSecureContext) {
    await new Promise(function(resolve) {
      navigator.locks.request('pricingpilot-editor:' + location.pathname, {ifAvailable:true}, function(lock) {
        if (!lock) { resolve(); return; }
        editingAllowed = true;
        resolve();
        return new Promise(function(release) { releaseEditingLock = release; });
      }).catch(function() { editingAllowed = false; resolve(); });
    });
  }
  try { if (editingAllowed && B.recover(localStorage)) $('backupStatus').textContent = 'An interrupted restore was rolled back. Previous browser data was recovered.'; }
  catch (recoveryError) { storageRecoveryNeeded = true; alert('Browser recovery could not finish. Editing will not be saved. Download a raw recovery snapshot before resolving browser storage.'); }

  function defaultState() {
    return {
      inputs: { hours: '', rate: '', materials: '', other: '', overhead: '', margin: 40 },
      multipliers: { budget: 0.85, standard: 1.0, premium: 1.35 },
      names: { budget: 'Budget', standard: 'Standard', premium: 'Premium' },
      features: null, bizName: '', svcName: '', validDays: 30, recTier: 'standard',
      taxPct: 0, taxOn: false, competitors: ['', '', ''], whatDiscount: 10, whatOverhead: ''
    };
  }
  function normalizeState(s) {
    var d = defaultState();
    if (!s || typeof s !== 'object' || Array.isArray(s)) throw new Error('Invalid scenario');
    ['inputs', 'multipliers', 'names'].forEach(function (key) {
      if (key in s && (!s[key] || typeof s[key] !== 'object' || Array.isArray(s[key]))) throw new Error('Invalid scenario fields');
    });
    if ('competitors' in s && (!Array.isArray(s.competitors) || s.competitors.some(function(v) { return typeof v !== 'string' && !(typeof v === 'number' && Number.isFinite(v)); }))) throw new Error('Invalid competitors');
    if ('features' in s && s.features !== null && (typeof s.features !== 'object' || Array.isArray(s.features))) throw new Error('Invalid features');
    Object.keys(d).forEach(function (k) {
      if (!(k in s)) return;
      if (['inputs', 'multipliers', 'names'].indexOf(k) >= 0) {
        Object.keys(d[k]).forEach(function (field) { if (typeof s[k][field] === 'string' || (typeof s[k][field] === 'number' && Number.isFinite(s[k][field]))) d[k][field] = s[k][field]; });
      } else if (k === 'features') d[k] = s[k];
      else if (k === 'competitors') d[k] = s[k].slice(0, 3);
      else if (k === 'taxOn') {
        if (typeof s[k] !== 'boolean') throw new Error('Invalid tax toggle');
        d[k] = s[k];
      } else if (typeof s[k] === 'string' || (typeof s[k] === 'number' && Number.isFinite(s[k]))) d[k] = s[k];
    });
    return d;
  }
  function loadState() {
    try {
      var raw = localStorage.getItem(LS_STATE);
      return raw ? normalizeState(JSON.parse(raw)) : defaultState();
    } catch (e) {
      scenarioRecoveryNeeded = true;
      alert('Your saved scenario could not be read. Its original data has not been overwritten. You can calculate using defaults, but scenario autosave is disabled for this session. Back up the original data before attempting recovery.');
      return defaultState();
    }
  }
  function saveState(s) {
    if (typeof editingAllowed !== 'undefined' && !editingAllowed) return false;
    if (scenarioRecoveryNeeded || (typeof storageRecoveryNeeded !== 'undefined' && storageRecoveryNeeded)) return false;
    try { localStorage.setItem(LS_STATE, JSON.stringify(s)); return true; }
    catch (e) { alert('Your current changes could not be saved in this browser. Keep this page open and copy your details before closing.'); return false; }
  }
  var state = loadState();

  function loadQuotes() {
    if (quoteStorageUnavailable) return [];
    var raw;
    try {
      raw = localStorage.getItem(LS_QUOTES);
    } catch (e) {
      // An unreadable library is not an empty library. Keep calculations usable,
      // but fail closed for this session rather than overwrite unseen quotes.
      quoteStorageUnavailable = true;
      editingAllowed = false;
      alert('Saved quotes cannot be read in this browser. Calculations are temporary; saving and restoring are disabled. Existing data has not been overwritten. Resolve browser storage and reload before editing.');
      if (typeof updateAccessControls === 'function') updateAccessControls();
      return [];
    }
    try {
      var quotes = JSON.parse(raw || '[]');
      if (!Array.isArray(quotes) || quotes.some(function(q) { return !q || typeof q !== 'object' || !q.state || typeof q.state !== 'object'; })) throw new Error('Invalid quote storage');
      return quotes;
    } catch (e) {
      alert('Saved quotes could not be read. Existing stored data has not been overwritten. Stop saving new quotes until the data is recovered.');
      throw e;
    }
  }
  function saveQuotes(q) {
    if (typeof editingAllowed !== 'undefined' && !editingAllowed) { alert('Quotes were not saved: this tab is view-only. Close the editing tab and reload latest data to edit.'); return false; }
    if (typeof storageRecoveryNeeded !== 'undefined' && storageRecoveryNeeded) { alert('Quotes were not saved: resolve the pending recovery first.'); return false; }
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

  function updateAccessControls() {
    $('editAccessStatus').textContent = quoteStorageUnavailable
      ? 'View-only: saved quotes cannot be read. Calculations are temporary; saving and restoring are disabled. Resolve browser storage and reload before editing.'
      : editingAllowed
      ? 'Editing tab. Other tabs are view-only to protect saved quotes.'
      : navigator.locks && window.isSecureContext
        ? 'View-only tab: another tab is editing. Calculations here are temporary and will not be saved. Close the editing tab, back up any draft here, then reload latest data to edit.'
        : 'View-only: this browser cannot safely coordinate editing tabs. Open the local app in a supported Microsoft Edge browser. Calculations here are temporary and will not be saved.';
    $('editAccessStatus').parentElement.dataset.mode = editingAllowed ? 'edit' : 'view';
    $('reloadForEditing').hidden = editingAllowed;
    ['saveQuote','importBackup','restoreBackup'].forEach(function(id) { $(id).disabled = !editingAllowed || storageRecoveryNeeded; });
    document.querySelectorAll('.status-sel,[data-act="dup"],[data-act="del"]').forEach(function(el) { el.disabled = !editingAllowed || storageRecoveryNeeded; });
  }
  $('reloadForEditing').addEventListener('click', function() {
    if (confirm('Reload the latest saved data and recheck editing access? Temporary calculations and unsaved draft edits in this tab will be lost. Download a full backup first if you need to keep them.')) location.reload();
  });
  window.addEventListener('pagehide', function() { editingAllowed = false; if (releaseEditingLock) releaseEditingLock(); });
  window.addEventListener('pageshow', function(event) { if (event.persisted) { editingAllowed = false; updateAccessControls(); } });

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
    $('inTaxPct').value = state.taxPct || ''; $('inTaxOn').checked = !!state.taxOn;
    $('comp1').value = state.competitors[0]; $('comp2').value = state.competitors[1]; $('comp3').value = state.competitors[2];
    $('whatDiscount').value = state.whatDiscount; $('whatOverhead').value = state.whatOverhead;
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
    state.taxPct = P.taxRatePct($('inTaxPct').value);
    state.taxOn = $('inTaxOn').checked;
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
    var taxOn = state.taxOn && state.taxPct > 0;
    var displayPrice = taxOn ? P.priceWithTax(lastRec.price, state.taxPct) : lastRec.price;
    var html = '<div class="price-big">' + money(displayPrice) + '</div>' +
      (taxOn ? '<p class="price-sub">incl. ' + state.taxPct + '% sales tax (base ' + money(lastRec.price) + ')</p>'
             : '<p class="price-sub">at your ' + c.marginPct + '% target margin</p>') +
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
    renderMarginLadder();
    renderWhatIf();
  }
  $('calcBtn').addEventListener('click', calculate);

  // ---------- what-if ----------
  function renderWhatIf() {
    var box = $('whatResult');
    if (!lastRec) { box.innerHTML = '<p class="muted empty">Calculate a price first.</p>'; return; }
    var d = P.discountImpact(lastRec.price, lastRec.breakdown.fullCost, $('whatDiscount').value);
    var oh = parseFloat($('whatOverhead').value);
    var be = P.breakEvenJobs($('whatOverhead').value, lastRec.price, lastRec.breakdown.fullCost);
    var html = '<div class="kv"><span>' + d.discountPct + '% discount → new price</span><span><strong>' + money(d.newPrice) + '</strong></span></div>' +
      '<div class="kv"><span>Margin at the discounted price</span><span>' + d.newMarginPct + '% <span class="muted">(−' + d.marginLostPts + ' pts)</span></span></div>' +
      '<div class="kv"><span>Profit you give up per job</span><span class="profit">' + money(d.profitLost) + '</span></div>';
    if (!isNaN(oh) && oh > 0) {
      html += '<div class="kv"><span>Jobs / month to cover ' + money(oh) + ' overhead</span><span>' +
        (be === null ? '<span class="muted">— price doesn\'t cover cost</span>' : '<strong>' + be + '</strong>') + '</span></div>';
    }
    box.innerHTML = html;
  }
  ['whatDiscount','whatOverhead'].forEach(function(id) {
    $(id).addEventListener('input', function() { state[id] = $(id).value; saveState(state); renderWhatIf(); });
  });

  // ---------- second sweep: tax toggle re-renders ----------
  $('inTaxPct').addEventListener('input', function () { if (lastRec) calculate(); });
  $('inTaxOn').addEventListener('change', function () { if (lastRec) calculate(); });

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
        (k === 'standard' ? '<div class="pop-flag">MOST POPULAR</div>' : '') +
        '<div class="tier-head"><span class="tname">' + esc(state.names[k]) + '</span>' +
        '<span class="tier-mult">' + esc(state.multipliers[k]) + '×</span></div>' +
        '<div class="tier-price-hero" data-pricehero="' + k + '">' +
        (tier ? money(tier.price) : money(0)) + '</div>' +
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

  function renderTierPriceHeroes() {
    (lastTiers || []).forEach(function (t) {
      var hero = document.querySelector('[data-pricehero="' + t.key + '"]');
      if (hero) hero.textContent = money(t.price);
    });
  }

  $('tierEditors').addEventListener('input', function () {
    readTierEditors();
    computeTiers();
    renderTierPriceHeroes();
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
    var taxOn = state.taxOn && state.taxPct > 0;
    var html = '<table class="margins"><tr><th>Tier</th><th>Price' + (taxOn ? ' (incl. ' + state.taxPct + '% tax)' : '') + '</th><th>Margin</th><th>vs target</th><th title="Quoted revenue per labor hour, excluding sales tax; not profit or take-home pay">Revenue / labor hr</th></tr>';
    rows.forEach(function (r) {
      var diff = Math.round((r.marginPct - lastRec.breakdown.marginPct) * 10) / 10;
      var note = diff >= 0 ? '+' + diff + ' pts' : diff + ' pts';
      var cls = diff > 0 ? 'delta up' : diff < 0 ? 'delta down' : 'delta';
      var eff = P.effectiveHourlyRate(r.price, lastRec.breakdown.laborHours);
      html += '<tr><td><strong>' + esc(r.name) + '</strong></td><td>' + money(taxOn ? P.priceWithTax(r.price, state.taxPct) : r.price) + '</td><td>' +
        r.marginPct + '%</td><td><span class="' + cls + '">' + note + '</span></td><td>' +
        (eff === null ? '—' : money(eff)) + '</td></tr>';
    });
    box.innerHTML = html + '</table>';
  }

  // ---------- second sweep: margin ladder ----------
  function renderMarginLadder() {
    var box = $('ladderResult');
    if (!box) return;
    if (!lastRec) { box.innerHTML = '<p class="muted empty">Calculate a price first.</p>'; return; }
    var rows = P.marginLadder(lastRec.breakdown.fullCost);
    var html = '<table class="margins"><tr><th>Margin held</th><th>Price you must charge</th><th>Profit per job</th><th></th></tr>';
    rows.forEach(function (r) {
      var isTarget = Math.round(r.marginPct) === Math.round(lastRec.breakdown.marginPct);
      html += '<tr' + (isTarget ? ' class="ladder-target"' : '') + '><td><strong>' + r.marginPct + '%</strong></td><td>' +
        money(r.price) + '</td><td>' + money(r.profit) + '</td><td>' + (isTarget ? '<span class="muted small">your target</span>' : '') + '</td></tr>';
    });
    box.innerHTML = html + '</table>' +
      '<p class="muted small">Floor: at cost (' + money(lastRec.breakdown.fullCost) + ') you make $0. Discount below the 10% line and you are working for exposure.</p>';
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
      recommendedKey: state.recTier, validDays: state.validDays,
      taxPct: state.taxPct, taxOn: state.taxOn
    });
    var sheetTaxOn = page.taxOn && page.taxPct > 0;
    var longQuote = page.businessName.length + page.serviceName.length > 180 || page.tiers.some(function(t) { return t.features.length > 10 || t.features.join(' ').length > 1400; });
    var html = '<div class="sheet-doc' + (longQuote ? ' long-quote' : '') + '">' +
      (longQuote ? '<p class="no-print print-length-note" role="status">Detailed quote: uses a multi-page layout with repeated tier headings. Review the PDF before sharing.</p>' : '') + '<div class="sheet-head">' +
      '<div class="sheet-biz">' + esc(page.businessName) + '</div>' +
      '<div class="sheet-svc">' + esc(page.serviceName) + '</div>' +
      '<p class="sheet-meta">Priced with PricingPilot AI · ' + esc(page.generated) + ' · Valid until ' + esc(page.validUntil) + '</p></div>';
    html += '<div class="sheet-tiers">';
    page.tiers.forEach(function (t) {
      var rec = t.key === page.recommendedKey;
      if (longQuote) {
        html += '<table class="sheet-tier-table' + (rec ? ' recommended' : '') + '"><thead><tr><th>' +
          (rec ? '<span class="badge">RECOMMENDED</span> ' : '') + '<h3>' + esc(t.name) + '</h3><div class="tier-price">' + money(sheetTaxOn ? P.priceWithTax(t.price, page.taxPct) : t.price) + '</div></th></tr></thead><tbody>' +
          t.features.map(function(f) { return '<tr><td>• ' + esc(f) + '</td></tr>'; }).join('') + '</tbody></table>';
        return;
      }
      html += '<div class="sheet-tier' + (rec ? ' recommended' : '') + '">' +
        (rec ? '<div class="badge">RECOMMENDED</div>' : '') +
        '<h3>' + esc(t.name) + '</h3><div class="tier-price">' +
        money(sheetTaxOn ? P.priceWithTax(t.price, page.taxPct) : t.price) + '</div><ul>' +
        t.features.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul></div>';
    });
    html += '</div>';
    if (sheetTaxOn) html += '<p class="muted small">Prices include ' + page.taxPct + '% sales tax.</p>';
    if (page.tierMargins.length) {
    html += '<h3>Internal copy — profit margins</h3><table class="margins"><tr><th>Tier</th><th>Price</th><th>Margin</th></tr>';
    page.tierMargins.forEach(function (r) {
      html += '<tr><td>' + esc(r.name) + '</td><td>' + money(r.price) + '</td><td>' + r.marginPct + '%</td></tr>';
    });
    html += '</table>';
    }
    html += '<p class="muted small">This quote is valid until ' + esc(page.validUntil) + '.</p>';
    html += '<div class="sheet-actions no-print"><button id="printSheet" class="primary">Print quote</button> ' +
      '<button id="copySheet" class="ghost">Copy quote as text</button></div>';
    html += '</div>';
    $('sheetWrap').innerHTML = html;
    $('printSheet').addEventListener('click', function () { window.print(); });
    var copyBtn = $('copySheet');
    if (copyBtn) copyBtn.addEventListener('click', function () {
      var text = P.quoteToText(page);
      var done = function () {
        var b = $('copySheet');
        if (b) { b.textContent = 'Copied!'; setTimeout(function () { b.textContent = 'Copy quote as text'; }, 1400); }
      };
      var failed = function () {
        alert('The quote was not copied. Clipboard access is unavailable or was denied. Select and copy the text below manually.');
        var existing = $('copyFallback');
        if (existing) existing.remove();
        var fallback = document.createElement('textarea');
        fallback.id = 'copyFallback';
        fallback.className = 'no-print';
        fallback.readOnly = true;
        fallback.setAttribute('aria-label', 'Quote text for manual copy');
        fallback.value = text;
        $('sheetWrap').appendChild(fallback);
        fallback.focus();
        fallback.select();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try { navigator.clipboard.writeText(text).then(done, failed); } catch (error) { failed(); }
      } else failed();
    });
  });

  // ---------- saved quotes ----------
  $('saveQuote').addEventListener('click', function () {
    var name = $('quoteName').value.trim();
    if (!name) { alert('Name the quote first.'); return; }
    var qs;
    try { qs = loadQuotes(); }
    catch (error) { backupNotice('Saved quotes are unreadable. Download a raw recovery snapshot before restoring a valid backup.', true); return; }
    state = captureCurrent();
    qs.push({ id: P.uniqueQuoteId(qs), name: name, savedAt: new Date().toISOString(), state: state });
    if (!saveQuotes(qs)) return;
    $('quoteName').value = '';
    renderQuotes();
  });

  function renderQuotes() {
    var box = $('quoteList');
    var searchEl = $('quoteSearch');
    var q = searchEl ? searchEl.value : '';
    var allQuotes;
    try { allQuotes = loadQuotes(); }
    catch (error) {
      box.textContent = 'Saved quotes are unreadable. Open Backup & restore to download raw recovery data or review a valid backup.';
      $('quoteStats').textContent = ''; return;
    }
    if (quoteStorageUnavailable) {
      box.textContent = 'Saved quotes are unavailable, not empty. Resolve browser storage and reload before editing. Existing data has not been overwritten.';
      $('quoteStats').textContent = ''; return;
    }
    var stats = P.winLossStats(allQuotes);
    var statsBox = $('quoteStats');
    if (statsBox) {
      statsBox.innerHTML = allQuotes.length
        ? '<span class="stat-pill"><strong>' + stats.won + '</strong> won</span>' +
          '<span class="stat-pill"><strong>' + stats.lost + '</strong> lost</span>' +
          '<span class="stat-pill"><strong>' + stats.open + '</strong> open</span>' +
          (stats.winRatePct === null ? '<span class="muted small">mark quotes won/lost to see your win rate</span>'
            : '<span class="stat-pill win"><strong>' + stats.winRatePct + '%</strong> win rate</span>' +
              '<span class="stat-pill" title="Estimated quoted value; not payments received or verified revenue"><strong>' + P.money(stats.wonRevenue) + '</strong> won quoted value</span>')
        : '<span class="muted small">Save a quote above — then mark it won or lost to track your close rate.</span>';
      if (stats.invalidValues) statsBox.innerHTML += '<span class="muted small" role="status">' + stats.invalidValues + ' won quote(s) have invalid pricing and are excluded from this estimated total. Recover their data before relying on it.</span>';
    }
    var qs = P.filterQuotes(allQuotes, q);
    if (!qs.length) {
      box.innerHTML = allQuotes.length
        ? '<p class="muted">No quotes match "' + esc(q) + '".</p>'
        : '<p class="muted">No saved quotes yet.</p>';
      return;
    }
    box.innerHTML = '';
    qs.forEach(function (quote) {
      var row = document.createElement('div');
      row.className = 'quote-row';
      var d = new Date(quote.savedAt);
      var price = P.quotePrice(quote);
      var outcome = ['open','won','lost'].indexOf(quote.status) >= 0 ? quote.status : 'open';
      row.innerHTML = '<div><strong>' + esc(quote.name) + '</strong>' +
        ' <span class="qstatus ' + outcome + '">' + outcome + '</span>' +
        (price !== null ? ' · ' + P.money(price) : '') +
        '<br><span class="muted small">saved ' + esc(d.toLocaleDateString()) + '</span></div>' +
        '<div class="qbtns"><select class="status-sel" aria-label="Quote outcome">' +
        ['open', 'won', 'lost'].map(function (s) {
          return '<option value="' + s + '"' + ((quote.status || 'open') === s ? ' selected' : '') + '>' + s + '</option>';
        }).join('') + '</select> ' +
        '<button class="ghost" data-act="load">Load</button> ' +
        '<button class="ghost" data-act="dup">Duplicate</button> ' +
        '<button class="danger" data-act="del">Delete</button></div>';
      row.querySelector('.status-sel').addEventListener('change', function (e) {
        var fresh = loadQuotes();
        P.setQuoteStatus(fresh, quote.id, e.target.value);
        if (saveQuotes(fresh)) renderQuotes();
        else e.target.value = quote.status || 'open';
      });
      row.querySelector('[data-act="load"]').addEventListener('click', function () {
        try { state = normalizeState(quote.state); }
        catch (error) { alert('This saved quote could not be loaded. Its original data was preserved: ' + error.message); return; }
        saveState(state); fillInputs(); calculate();
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
    updateAccessControls();
  }

  function downloadCSV(filename, text, type) {
    var blob = new Blob([text], { type: type || 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  $('exportQuotes').addEventListener('click', function () {
    try {
      var qs = loadQuotes();
      if (!qs.length) { alert('No saved quotes to export yet.'); return; }
      downloadCSV('pricingpilot-quotes.csv', P.quotesToCSV(qs));
    } catch (error) { backupNotice('CSV export failed: ' + error.message + ' Download a raw recovery snapshot to preserve all original data.', true); }
  });

  // ---------- versioned full backup and recovery ----------
  var pendingRestore = null, pendingSnapshot = null, importSequence = 0;
  function backupNotice(message, error) { $('backupStatus').textContent = message; $('backupStatus').dataset.error = String(!!error); }
  function captureCurrent() {
    var current = JSON.parse(JSON.stringify(state)), raw = readInputs();
    current.inputs = {hours:raw.laborHours,rate:raw.hourlyRate,materials:raw.materials,other:raw.other,overhead:raw.overheadPct,margin:raw.marginPct};
    current.bizName = $('bizName').value; current.svcName = $('svcName').value;
    current.validDays = $('validDays').value; current.recTier = $('recTier').value;
    current.taxPct = $('inTaxPct').value; current.taxOn = $('inTaxOn').checked;
    current.competitors = [$('comp1').value,$('comp2').value,$('comp3').value];
    current.whatDiscount = $('whatDiscount').value; current.whatOverhead = $('whatOverhead').value;
    return current;
  }
  function recoverySnapshot() {
    return {format:'pricingpilot-raw-recovery',version:1,exportedAt:new Date().toISOString(),stored:B.snapshot(localStorage),journal:localStorage.getItem(B.KEYS.journal),visibleDraft:captureCurrent(),draftName:$('quoteName').value};
  }
  function downloadJSON(name, value) { downloadCSV(name, JSON.stringify(value,null,2), 'application/json;charset=utf-8'); }
  function cancelRestore() { importSequence++; pendingRestore = null; pendingSnapshot = null; $('restorePreview').hidden = true; $('importBackup').value = ''; }
  $('exportRecovery').addEventListener('click', function() {
    try { downloadJSON('pricingpilot-raw-recovery.json', recoverySnapshot()); backupNotice('Raw recovery snapshot download requested. It preserves original storage bytes; it is not directly importable. Keep it private.'); }
    catch (error) { backupNotice('Recovery snapshot could not be downloaded: ' + error.message, true); }
  });
  $('exportBackup').addEventListener('click', function() {
    try {
      if (scenarioRecoveryNeeded || storageRecoveryNeeded) throw new Error('Existing storage needs recovery; download a raw recovery snapshot instead.');
      downloadJSON('pricingpilot-backup.json', B.create(captureCurrent(),loadQuotes(),$('quoteName').value));
      backupNotice('Full backup download requested. Verify the file is saved before clearing browser data. Contains private costs and quote details.');
    } catch (error) { backupNotice('Full backup failed: ' + error.message, true); }
  });
  $('importBackup').addEventListener('change', async function() {
    var file = this.files[0], sequence = ++importSequence;
    pendingRestore = null; pendingSnapshot = null; $('restorePreview').hidden = true;
    if (!file) return;
    try {
      if (!editingAllowed) throw new Error('This tab is view-only. Close the editing tab and reload latest data before restoring.');
      if (storageRecoveryNeeded) throw new Error('Resolve the pending restore journal before importing.');
      if (file.size > B.LIMIT) throw new Error('Backup exceeds 5 MB.');
      var data = B.parse(await file.text()); if (sequence !== importSequence) return;
      pendingSnapshot = B.snapshot(localStorage); pendingRestore = data;
      $('restoreMode').value = 'merge';
      $('restoreSummary').textContent = data.quotes.length + ' saved quote(s), plus one current scenario. Exported ' + new Date(data.exportedAt).toLocaleString() + '. Review the mode before restoring.';
      $('restorePreview').hidden = false; backupNotice('Backup validated. No browser data has changed.');
    } catch (error) { if (sequence === importSequence) backupNotice('Backup rejected: ' + error.message + ' Existing data was not changed.', true); }
  });
  $('cancelRestore').addEventListener('click', function() { cancelRestore(); backupNotice('Restore cancelled. Existing data was not changed.'); });
  $('restoreBackup').addEventListener('click', function() {
    if (!pendingRestore) return;
    try {
      if (!editingAllowed) throw new Error('Restore is disabled in this view-only tab.');
      var replace = $('restoreMode').value === 'replace', merge, next, message;
      var now = B.snapshot(localStorage);
      if (now.scenario !== pendingSnapshot.scenario || now.quotes !== pendingSnapshot.quotes) throw new Error('Browser data changed since preview. Choose the file again and review.');
      if (replace) { next = {scenario:JSON.stringify(pendingRestore.current),quotes:JSON.stringify(pendingRestore.quotes)}; message = 'Replace all saved quotes and the current scenario with this backup? Existing browser data will be replaced. A raw pre-restore recovery snapshot will be downloaded first.'; }
      else {
        merge = B.merge(loadQuotes(),pendingRestore.quotes); next = {scenario:now.scenario,quotes:JSON.stringify(merge.quotes)};
        message = 'Add ' + merge.added + ' quote(s), skip ' + merge.skipped + ' identical record(s), and reassign ' + merge.renamed + ' conflicting ID(s)? Your current draft is kept. A raw pre-restore recovery snapshot will be downloaded first.';
      }
      if (!confirm(message)) { backupNotice('Restore not confirmed. Existing data was not changed.'); return; }
      downloadJSON('pricingpilot-before-restore-' + Date.now() + '.json', recoverySnapshot());
      B.replace(localStorage,next,pendingSnapshot);
      if (replace) {
        state = normalizeState(pendingRestore.current); scenarioRecoveryNeeded = false;
        fillInputs(); $('quoteName').value = pendingRestore.draftName;
        $('includeMargins').checked = false; invalidatePricing();
        $('tierEditors').textContent = ''; $('ladderResult').textContent = 'Recalculation required'; $('whatResult').textContent = 'Recalculation required';
      }
      $('quoteSearch').value = ''; cancelRestore(); renderQuotes();
      backupNotice(replace ? 'Backup restored. Calculate and render again; internal margin display is off.' : 'Merged ' + merge.added + ' quote(s). Current draft preserved. ' + merge.skipped + ' identical record(s) skipped.');
    } catch (error) {
      try { storageRecoveryNeeded = !!localStorage.getItem(B.KEYS.journal); } catch (readError) { storageRecoveryNeeded = true; }
      updateAccessControls();
      backupNotice(error.message, true);
    }
  });
  window.addEventListener('storage', function(event) {
    if (pendingRestore && [LS_STATE,LS_QUOTES,B.KEYS.journal].indexOf(event.key) >= 0) { cancelRestore(); backupNotice('Browser data changed in another tab. Choose the backup again before restoring.', true); }
    if (!editingAllowed && event.key === LS_QUOTES) renderQuotes();
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
  updateAccessControls();
  document.querySelector('main').inert = false;
  document.querySelector('main').setAttribute('aria-busy','false');
})();
