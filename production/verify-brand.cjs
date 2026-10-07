const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const config = {"url": "https://yuge-u.github.io/zero-one-practice-lab/", "files": ["apple-touch-practice-180-20261007k.png", "apple-touch-icon.png", "apple-touch-icon-precomposed.png", "safari-practice-180-20261007g.png", "safari-practice-192-20261007g.png", "favicon.ico", "favicon-practice-20261007f.ico", "favicon-practice-32-20261007f.png", "brand-entry.js", "index.html", "manifest.webmanifest", "sw.js", "icons/icon-192.webp", "icons/icon-512.webp", "icons/apple-touch-icon.png"], "selector": ".brand img,.zeroone-splash img", "root": "_site"};
(async () => {
  const base = process.env.SITE_URL || config.url;
  for (const file of config.files) {
    const response = await fetch(new URL(file + '?verify=' + process.env.GITHUB_SHA, base));
    assert.equal(response.status, 200, file);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), fs.readFileSync(path.join(config.root || '.', file)), 'Deployed bytes differ: ' + file);
    console.log('Deployed bytes match:', file);
  }
  for (const engine of [chromium,webkit]) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(url => url.searchParams.get('brand') === '20261007k');
    assert.equal(await page.locator('link[rel="icon"]').getAttribute('href'), './safari-practice-192-20261007g.png');
    assert.equal(await page.locator('link[rel="icon"]').getAttribute('type'), 'image/png');
    assert.deepEqual(await page.evaluate(async()=>{const result=[];for(const rel of ['icon','apple-touch-icon']){const img=new Image();img.src=document.querySelector(`link[rel="${rel}"]`).href;await img.decode();result.push([img.naturalWidth,img.naturalHeight]);}return result;}),[[192,192],[180,180]]);
    await page.waitForFunction(() => { const img=document.querySelector('.zeroone-splash img'); return img && img.complete && img.naturalWidth>0; });
    assert.ok((await page.locator('.zeroone-splash img').getAttribute('src')).includes('20261007d'));
    assert.deepEqual(await page.evaluate(async () => {const img=new Image();img.src='favicon-practice-32-20261007f.png';await img.decode();return [img.naturalWidth,img.naturalHeight];}),[32,32]);
    await page.screenshot({ path: 'production-splash-'+engine.name()+'.png' });
    await page.locator('.zeroone-splash').waitFor({ state: 'hidden' });
    await page.waitForLoadState('networkidle');
    const notice = page.getByRole('button', {name:'確認しました',exact:true});
    if (await notice.count() && await notice.isVisible()) await notice.click();
    const images = await page.locator(config.selector).evaluateAll(imgs => imgs.map(img => ({src:img.src,loaded:img.complete && img.naturalWidth>0})));
    assert.ok(images.length>=2 && images.every(img => img.loaded && img.src.includes('20261007d')), JSON.stringify(images));
    await page.screenshot({ path: 'production-mobile-'+engine.name()+'.png' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: 'production-desktop-'+engine.name()+'.png' });
    console.log('Production brand images loaded:', JSON.stringify(images));
  } finally { await browser.close(); }
  }
})().catch(error => {console.error(error);process.exitCode=1;});
