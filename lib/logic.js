/* pricingpilot-ai core logic — shared between Node (tests) and browser.
   No dependencies. All pricing math + tier copy is local; works fully offline. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PricingPilot = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- Input validation ----------
  // Clamp a numeric input to >= 0; NaN/null/undefined -> fallback (default 0).
  function num(v, fallback) {
    var n = parseFloat(v);
    if (isNaN(n)) n = (fallback == null ? 0 : fallback);
    if (n < 0) n = 0;
    return n;
  }
  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  // ---------- Cost-to-price math ----------
  // inputs: {laborHours, hourlyRate, materials, other, overheadPct, marginPct}
  function costBreakdown(inputs) {
    inputs = inputs || {};
    var laborHours = num(inputs.laborHours), hourlyRate = num(inputs.hourlyRate);
    var materials = num(inputs.materials), other = num(inputs.other);
    var overheadPct = num(inputs.overheadPct);
    var marginPct = Math.max(0, Math.min(95, num(inputs.marginPct)));
    var labor = round2(laborHours * hourlyRate);
    var subtotal = round2(labor + materials + other);
    var overhead = round2(subtotal * overheadPct / 100);
    var fullCost = round2(subtotal + overhead);
    return {
      laborHours: laborHours, hourlyRate: hourlyRate,
      labor: labor, materials: materials, other: other,
      subtotal: subtotal, overheadPct: overheadPct, overhead: overhead,
      fullCost: fullCost, marginPct: marginPct
    };
  }

  // price = totalCost / (1 - margin); margin clamped to < 95%.
  function priceFromMargin(fullCost, marginPct) {
    var m = Math.max(0, Math.min(95, num(marginPct))) / 100;
    if (fullCost <= 0) return 0;
    return round2(fullCost / (1 - m));
  }

  // Full pipeline: cost inputs -> recommended price.
  function recommendedPrice(inputs) {
    var c = costBreakdown(inputs);
    var price = priceFromMargin(c.fullCost, c.marginPct);
    var profit = round2(price - c.fullCost);
    var actualMargin = price > 0 ? round2((price - c.fullCost) / price * 100) : 0;
    return {
      breakdown: c,
      price: price,
      profit: profit,
      actualMarginPct: actualMargin
    };
  }

  // Actual margin % of a quoted price against a full cost.
  function actualMarginPct(fullCost, price) {
    if (!price || price <= 0) return 0;
    return round2((price - fullCost) / price * 100);
  }

  // ---------- 3-tier pricing ----------
  var DEFAULT_MULTIPLIERS = { budget: 0.85, standard: 1.0, premium: 1.35 };
  var TIER_KEYS = ['budget', 'standard', 'premium'];
  var DEFAULT_TIER_NAMES = { budget: 'Budget', standard: 'Standard', premium: 'Premium' };

  // Local feature templates: budget = essentials, standard = essentials + extras,
  // premium = everything + white-glove items.
  var TIER_TEMPLATES = {
    budget: [
      'Essential service scope — exactly what you asked for',
      'Standard materials included',
      'Workmanship warranty included',
      'Flexible scheduling within 2 weeks'
    ],
    standard: [
      'Everything in Budget',
      'Upgraded materials and finishes',
      'Priority scheduling within 5 business days',
      'Free post-job touch-up visit (30 days)'
    ],
    premium: [
      'Everything in Standard',
      'Top-tier materials and finishes',
      'Dedicated project point-of-contact',
      'Same-week scheduling available',
      'Extended 2-year workmanship warranty'
    ]
  };

  function generateTiers(basePrice, opts) {
    opts = opts || {};
    var mults = opts.multipliers || DEFAULT_MULTIPLIERS;
    var names = opts.names || DEFAULT_TIER_NAMES;
    var custom = opts.customFeatures || {};
    var include = opts.include || {}; // tierKey -> boolean (default true)
    var tiers = [];
    TIER_KEYS.forEach(function (k) {
      if (include[k] === false) return;
      var m = num(mults[k], DEFAULT_MULTIPLIERS[k]);
      if (m <= 0) m = DEFAULT_MULTIPLIERS[k];
      var price = round2(basePrice * m);
      var extra = Array.isArray(custom[k]) ? custom[k].filter(function (s) { return String(s).trim(); }) : [];
      tiers.push({
        key: k,
        name: String(names[k] || DEFAULT_TIER_NAMES[k]),
        multiplier: m,
        price: price,
        features: TIER_TEMPLATES[k].concat(extra)
      });
    });
    return tiers;
  }

  // ---------- Margin breakdown (SVG stacked bar) ----------
  // Returns segments: labor / materials / overhead / profit with $ and % of price.
  function marginBreakdown(rec) {
    var c = rec.breakdown, price = rec.price;
    if (!price || price <= 0) return [];
    function seg(label, amount, color) {
      return { label: label, amount: round2(amount), pct: round2(amount / price * 100), color: color };
    }
    var segs = [
      seg('Labor', c.labor, '#2563eb'),
      seg('Materials', c.materials + c.other, '#f59e0b'),
      seg('Overhead', c.overhead, '#8b5cf6'),
      seg('Profit', rec.profit, '#16a34a')
    ];
    return segs;
  }

  // Per-tier margin table rows: tier name, price, margin % vs the job's full cost.
  function tierMarginTable(tiers, fullCost) {
    return tiers.map(function (t) {
      return {
        key: t.key, name: t.name, price: t.price,
        marginPct: actualMarginPct(fullCost, t.price)
      };
    });
  }

  // ---------- Competitor positioning ----------
  // competitorPrices: array of 1-3 numbers. Returns per-tier verdict + advice.
  function nearestCompetitor(price, competitors) {
    var list = (competitors || []).map(Number).filter(function (n) { return !isNaN(n) && n > 0; });
    if (!list.length) return null;
    var best = list[0], bestDiff = Math.abs(price - list[0]);
    list.forEach(function (c) {
      var d = Math.abs(price - c);
      if (d < bestDiff) { best = c; bestDiff = d; }
    });
    return best;
  }

  function positionTier(tier, competitors) {
    var near = nearestCompetitor(tier.price, competitors);
    if (near === null) {
      return {
        tierKey: tier.key, tierName: tier.name, price: tier.price,
        verdict: 'no-data', diffPct: null, nearest: null,
        advice: 'Add competitor prices to see how this tier stacks up.'
      };
    }
    var diffPct = round2((tier.price - near) / near * 100);
    var verdict, advice;
    if (diffPct <= -10) {
      verdict = 'undercut';
      advice = 'Priced ' + Math.abs(diffPct) + '% below the nearest competitor (' + money(near) + '). ' +
        'If the margin still holds, lean into value — but make sure you are not leaving money on the table.';
    } else if (diffPct <= 10) {
      verdict = 'aligned';
      advice = 'Priced ' + Math.abs(diffPct) + '% ' + (diffPct >= 0 ? 'above' : 'below') +
        ' the nearest competitor (' + money(near) + ') — right in the pack. ' +
        'Win on reviews, guarantees, and speed rather than price.';
    } else {
      verdict = 'premium';
      advice = 'Priced ' + diffPct + '% above the nearest competitor (' + money(near) + '). ' +
        'Lean on quality guarantees, the extended warranty, and white-glove touches to justify it — ' +
        'customers pay more when the difference is obvious.';
    }
    return { tierKey: tier.key, tierName: tier.name, price: tier.price, verdict: verdict, diffPct: diffPct, nearest: near, advice: advice };
  }

  function positioningReport(tiers, competitors) {
    return tiers.map(function (t) { return positionTier(t, competitors); });
  }

  // Overall plain-language positioning summary.
  function positioningSummary(report) {
    if (!report.length) return 'Add tiers to see positioning advice.';
    var undercut = report.filter(function (r) { return r.verdict === 'undercut'; }).length;
    var premium = report.filter(function (r) { return r.verdict === 'premium'; }).length;
    var nodata = report.filter(function (r) { return r.verdict === 'no-data'; }).length;
    if (nodata === report.length) return 'Enter up to 3 competitor prices above to unlock positioning advice.';
    if (undercut >= 2) return 'Most tiers undercut the market. Good for volume, but double-check your costs — chronic underpricing burns you out.';
    if (premium >= 2) return 'Most tiers sit above competitors. That works if your reviews and guarantees back it up — lead with trust signals.';
    return 'Good spread: a value option to win price shoppers, an aligned middle to win the comparison, and a premium tier for customers who want the best.';
  }

  // ---------- One-pager / presentation ----------
  function money(n) {
    return '$' + round2(n).toFixed(2);
  }

  function validUntil(days) {
    var d = new Date();
    d.setDate(d.getDate() + Math.max(1, Math.floor(num(days, 30))));
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function buildOnePager(opts) {
    opts = opts || {};
    return {
      businessName: String(opts.businessName || 'Your Business').trim() || 'Your Business',
      serviceName: String(opts.serviceName || 'Service Quote').trim() || 'Service Quote',
      tiers: opts.tiers || [],
      tierMargins: opts.tierMargins || [],
      recommendedKey: opts.recommendedKey || 'standard',
      validUntil: validUntil(opts.validDays || 30),
      generated: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    };
  }

  // Optional OpenAI polish — never required; enhancement hook only.
  function polishWithOpenAI(texts, apiKey) {
    return new Promise(function (resolve) {
      if (!apiKey || typeof fetch === 'undefined') { resolve({ polished: false, texts: texts }); return; }
      resolve({ polished: false, texts: texts }); // hook: wire real call when key present
    });
  }

  return {
    num: num,
    round2: round2,
    money: money,
    costBreakdown: costBreakdown,
    priceFromMargin: priceFromMargin,
    recommendedPrice: recommendedPrice,
    actualMarginPct: actualMarginPct,
    DEFAULT_MULTIPLIERS: DEFAULT_MULTIPLIERS,
    TIER_KEYS: TIER_KEYS,
    TIER_TEMPLATES: TIER_TEMPLATES,
    generateTiers: generateTiers,
    marginBreakdown: marginBreakdown,
    tierMarginTable: tierMarginTable,
    nearestCompetitor: nearestCompetitor,
    positionTier: positionTier,
    positioningReport: positioningReport,
    positioningSummary: positioningSummary,
    validUntil: validUntil,
    buildOnePager: buildOnePager,
    polishWithOpenAI: polishWithOpenAI
  };
}));
