const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('C:/Users/alexw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sourceRoot = path.resolve(__dirname,'..');
const appRoot = process.argv[2] ? path.resolve(process.argv[2]) : sourceRoot;
assert(!process.argv[2] || appRoot.startsWith(path.join(sourceRoot,'output/installer-qa')+path.sep),
       'Installed checks must stay inside isolated installer QA directories');

(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    for (const mode of ['quotes-only','all-storage']) {
      const context = await browser.newContext();
      const page = await context.newPage(), errors = [];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('dialog',d=>d.accept());
      await page.route(/^https?:/,r=>r.abort());
      await page.addInitScript(mode => {
        const read = Storage.prototype.getItem, write = Storage.prototype.setItem;
        const scenario = JSON.stringify({inputs:{hours:2,rate:100,margin:40}});
        const quotes = JSON.stringify([{id:'synthetic',name:'Synthetic saved quote',state:{inputs:{hours:2}}}]);
        write.call(localStorage,'pricingpilot.scenario.v1',scenario);
        write.call(localStorage,'pricingpilot.quotes.v1',quotes);
        window.qaRawSnapshot = () => ({scenario:read.call(localStorage,'pricingpilot.scenario.v1'),quotes:read.call(localStorage,'pricingpilot.quotes.v1')});
        window.qaBefore = {scenario,quotes};
        Storage.prototype.getItem = function(key) {
          if (mode === 'all-storage' || key === 'pricingpilot.quotes.v1') throw new DOMException('Synthetic blocked storage','SecurityError');
          return read.call(this,key);
        };
      }, mode);
      await page.goto(pathToFileURL(path.join(appRoot,'index.html')).href, {waitUntil:'domcontentloaded'});
      await page.locator('main[aria-busy=false]').waitFor();
      assert.equal(await page.locator('main').evaluate(el=>el.inert),false);
      assert.match(await page.locator('#editAccessStatus').innerText(),/View-only: saved quotes cannot be read/);
      assert.match(await page.locator('#quoteList').innerText(),/unavailable, not empty/);
      for (const id of ['saveQuote','importBackup','restoreBackup']) assert(await page.locator('#'+id).isDisabled());
      await page.locator('#inHours').fill('1');
      await page.locator('#inRate').fill('100');
      await page.locator('#calcBtn').click();
      assert.match(await page.locator('#calcResult').innerText(),/166.67/);
      assert.deepEqual(await page.evaluate(()=>qaRawSnapshot()),await page.evaluate(()=>qaBefore));
      assert.deepEqual(errors,[]);
      await context.close();
      console.log('PASS '+mode+': startup, temporary calculation, honest status, blocked writes and original data preservation');
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
