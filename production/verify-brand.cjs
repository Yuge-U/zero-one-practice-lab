const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const config = {"url": "https://yuge-u.github.io/zero-one-practice-lab/", "files": ["index.html", "manifest.webmanifest", "sw.js", "icons/icon-192.webp", "icons/icon-512.webp", "icons/apple-touch-icon.png"], "selector": ".brand img,.zeroone-splash img", "root": "_site"};
(async () => {
  const base = process.env.SITE_URL || config.url;
  for (const file of config.files) {
    const response = await fetch(new URL(file + '?verify=' + process.env.GITHUB_SHA, base));
    assert.equal(response.status, 200, file);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), fs.readFileSync(path.join(config.root || '.', file)), 'Deployed bytes differ: ' + file);
    console.log('Deployed bytes match:', file);
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => { const img=document.querySelector('.zeroone-splash img'); return img && img.complete && img.naturalWidth>0; });
    assert.ok((await page.locator('.zeroone-splash img').getAttribute('src')).includes('20261007d'));
    await page.screenshot({ path: 'production-splash.png' });
    await page.locator('.zeroone-splash').waitFor({ state: 'hidden' });
    await page.waitForLoadState('networkidle');
    const notice = page.getByRole('button', {name:'確認しました',exact:true});
    if (await notice.count() && await notice.isVisible()) await notice.click();
    const images = await page.locator(config.selector).evaluateAll(imgs => imgs.map(img => ({src:img.src,loaded:img.complete && img.naturalWidth>0})));
    assert.ok(images.length>=2 && images.every(img => img.loaded && img.src.includes('20261007d')), JSON.stringify(images));
    await page.screenshot({ path: 'production-mobile.png' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: 'production-desktop.png' });
    console.log('Production brand images loaded:', JSON.stringify(images));
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
