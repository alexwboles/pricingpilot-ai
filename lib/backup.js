(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PricingPilotBackup = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var KEYS = { scenario: 'pricingpilot.scenario.v1', quotes: 'pricingpilot.quotes.v1', journal: 'pricingpilot.restore-journal.v1' };
  var LIMIT = 5 * 1024 * 1024;
  function object(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function fields(v, allowed, label) {
    if (!object(v)) throw new Error(label + ' must be an object.');
    Object.keys(v).forEach(function (k) { if (allowed.indexOf(k) < 0) throw new Error('Unsupported ' + label + ' field: ' + k); });
  }
  function text(v, max, label) { if (typeof v !== 'string' || v.length > max) throw new Error('Invalid ' + label + '.'); return v; }
  function numeric(v, label) {
    if (v === '') return v;
    if ((typeof v !== 'string' && typeof v !== 'number') || !Number.isFinite(Number(v)) || Math.abs(Number(v)) > Number.MAX_SAFE_INTEGER / 100) throw new Error('Invalid ' + label + '.');
    return v;
  }
  function scenario(s) {
    fields(s, ['inputs','multipliers','names','features','bizName','svcName','validDays','recTier','taxPct','taxOn','competitors','whatDiscount','whatOverhead'], 'scenario');
    var out = { inputs: { hours:'',rate:'',materials:'',other:'',overhead:'',margin:40 }, multipliers:{budget:0.85,standard:1,premium:1.35}, names:{budget:'Budget',standard:'Standard',premium:'Premium'}, features:null, bizName:'',svcName:'',validDays:30,recTier:'standard',taxPct:0,taxOn:false,competitors:['','',''],whatDiscount:10,whatOverhead:'' };
    ['inputs','multipliers','names'].forEach(function (key) {
      if (!(key in s)) return;
      fields(s[key], Object.keys(out[key]), key);
      Object.keys(s[key]).forEach(function (k) { out[key][k] = key === 'names' ? text(s[key][k], 2000, 'tier name') : numeric(s[key][k], key + '.' + k); });
    });
    if ('features' in s && s.features !== null) {
      fields(s.features, ['budget','standard','premium'], 'features'); out.features = {};
      Object.keys(s.features).forEach(function (k) {
        if (!Array.isArray(s.features[k]) || s.features[k].length > 100) throw new Error('Invalid tier inclusions.');
        out.features[k] = s.features[k].map(function (v) { return text(v, 10000, 'inclusion'); });
      });
    }
    ['bizName','svcName'].forEach(function (k) { if (k in s) out[k] = text(s[k], 10000, k); });
    ['validDays','taxPct','whatDiscount','whatOverhead'].forEach(function (k) { if (k in s) out[k] = numeric(s[k], k); });
    if ('recTier' in s) { if (['budget','standard','premium'].indexOf(s.recTier) < 0) throw new Error('Invalid recommended tier.'); out.recTier = s.recTier; }
    if ('taxOn' in s) { if (typeof s.taxOn !== 'boolean') throw new Error('Invalid tax toggle.'); out.taxOn = s.taxOn; }
    if ('competitors' in s) {
      if (!Array.isArray(s.competitors) || s.competitors.length > 3) throw new Error('Invalid competitors.');
      s.competitors.forEach(function (v,i) { out.competitors[i] = numeric(v, 'competitor price'); });
    }
    var i = out.inputs, clamp = function(v) { return Math.max(0,Number(v) || 0); };
    var cost = (clamp(i.hours) * clamp(i.rate) + clamp(i.materials) + clamp(i.other)) * (1 + clamp(i.overhead) / 100);
    var price = cost / (1 - Math.min(95,clamp(i.margin)) / 100);
    var values = [cost,price];
    Object.keys(out.multipliers).forEach(function(k) { values.push(price * Math.max(clamp(out.multipliers[k]),1)); });
    if (values.some(function(v) { return !Number.isFinite(v) || Math.abs(v) > Number.MAX_SAFE_INTEGER / 100; })) throw new Error('Scenario exceeds supported pricing limits.');
    return out;
  }
  function quotes(list) {
    if (!Array.isArray(list) || list.length > 1000) throw new Error('Backup supports up to 1,000 quotes.');
    var ids = new Set();
    return list.map(function (q) {
      fields(q, ['id','name','savedAt','status','state'], 'quote');
      text(q.id, 200, 'quote ID'); if (!q.id || ids.has(q.id)) throw new Error('Missing or duplicate quote ID.'); ids.add(q.id);
      text(q.name, 10000, 'quote name'); text(q.savedAt, 100, 'saved date');
      if (!Number.isFinite(Date.parse(q.savedAt))) throw new Error('Invalid saved date.');
      if ('status' in q && ['open','won','lost'].indexOf(q.status) < 0) throw new Error('Invalid quote outcome.');
      return {id:q.id,name:q.name,savedAt:q.savedAt,status:q.status || 'open',state:scenario(q.state)};
    });
  }
  function create(current, list, draftName) {
    var data = {format:'pricingpilot-backup',version:1,exportedAt:new Date().toISOString(),current:scenario(current),quotes:quotes(list),draftName:text(draftName || '',10000,'draft name')};
    if (new BlobSize(JSON.stringify(data)).size > LIMIT) throw new Error('Backup exceeds 5 MB.');
    return data;
  }
  // UTF-8 size works in both browser and dependency-free Node tests.
  function BlobSize(value) { this.size = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(value).length : value.length * 3; }
  function parse(raw) {
    if (new BlobSize(raw).size > LIMIT) throw new Error('Backup exceeds 5 MB.');
    var b = JSON.parse(raw);
    fields(b,['format','version','exportedAt','current','quotes','draftName'],'backup');
    if (b.format !== 'pricingpilot-backup' || b.version !== 1) throw new Error('Choose a supported PricingPilot version 1 backup, not a CSV or recovery snapshot.');
    text(b.exportedAt,100,'backup date'); if (!Number.isFinite(Date.parse(b.exportedAt))) throw new Error('Invalid backup date.');
    return {format:b.format,version:1,exportedAt:b.exportedAt,current:scenario(b.current),quotes:quotes(b.quotes),draftName:text(b.draftName || '',10000,'draft name')};
  }
  function merge(existing, incoming) {
    var result = quotes(existing), added = 0, skipped = 0, renamed = 0;
    quotes(incoming).forEach(function (q) {
      var old = result.find(function (x) { return x.id === q.id; });
      if (old && JSON.stringify(old) === JSON.stringify(q)) { skipped++; return; }
      if (old) { var base = q.id.slice(0,150), n = 1; while (result.some(function(x) { return x.id === q.id; })) q.id = base + '-import-' + n++; renamed++; }
      result.push(q); added++;
    });
    if (result.length > 1000) throw new Error('Merged library exceeds 1,000 quotes.');
    return {quotes:result,added:added,skipped:skipped,renamed:renamed};
  }
  function snapshot(storage) { return {scenario:storage.getItem(KEYS.scenario),quotes:storage.getItem(KEYS.quotes)}; }
  function put(storage,key,value) { if (value === null) storage.removeItem(key); else storage.setItem(key,value); }
  function recover(storage) {
    var raw = storage.getItem(KEYS.journal); if (!raw) return false;
    var journal = JSON.parse(raw);
    fields(journal,['format','version','previous'],'restore journal');
    if (journal.format !== 'pricingpilot-restore-journal' || journal.version !== 1) throw new Error('Unknown recovery journal.');
    fields(journal.previous,['scenario','quotes'],'recovery data');
    ['scenario','quotes'].forEach(function(k) { if (journal.previous[k] !== null && typeof journal.previous[k] !== 'string') throw new Error('Invalid recovery data.'); });
    put(storage,KEYS.scenario,journal.previous.scenario); put(storage,KEYS.quotes,journal.previous.quotes);
    storage.removeItem(KEYS.journal); return true;
  }
  function replace(storage, next, expected) {
    if (storage.getItem(KEYS.journal)) throw new Error('Resolve the unfinished restore before making changes.');
    var before = snapshot(storage);
    if (expected && (before.scenario !== expected.scenario || before.quotes !== expected.quotes)) throw new Error('Browser data changed since the restore preview. Review the backup again.');
    // A durable undo journal precedes either write. Startup always rolls back
    // an incomplete restore, including interruption before journal cleanup.
    storage.setItem(KEYS.journal,JSON.stringify({format:'pricingpilot-restore-journal',version:1,previous:before}));
    try {
      put(storage,KEYS.quotes,next.quotes); put(storage,KEYS.scenario,next.scenario);
      storage.removeItem(KEYS.journal);
    } catch (error) {
      try { recover(storage); }
      catch (rollbackError) { throw new Error('Restore failed and recovery is pending. Keep this page open, download a recovery snapshot and resolve browser storage before editing.'); }
      throw new Error('Restore was not completed. Previous data was restored: ' + error.message);
    }
    return true;
  }
  return {KEYS:KEYS,LIMIT:LIMIT,create:create,parse:parse,scenario:scenario,quotes:quotes,merge:merge,snapshot:snapshot,recover:recover,replace:replace};
}));
