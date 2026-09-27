// Optional network check: unlike the deterministic regression suite, this uses the real CDN and file:// output.
const { chromium, webkit } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
(async () => {
  const name = process.argv[2] || 'webkit';
  if (!['chromium', 'webkit'].includes(name)) throw new Error('Use chromium or webkit');
  const browser = await ({ chromium, webkit })[name].launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [], responses = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.request().resourceType() === 'script') responses.push({ url: response.url(), status: response.status() }); });
  try {
    await page.goto(pathToFileURL(path.resolve('dist/index.html')).href, { waitUntil: 'commit' });
    await page.waitForFunction(() => window.__ready || document.body.dataset.state === 'failed', null, { timeout: 25000 });
    const state = await page.locator('body').getAttribute('data-state');
    if (state !== 'ready') throw new Error(await page.locator('#loadMessage').textContent());
    await page.locator('#b-tower').click();
    await page.locator('#sound').click();
    if (await page.locator('#sound').getAttribute('aria-pressed') !== 'true') throw new Error('Music toggle did not start');
    await page.locator('#sound').click();
    if (errors.length) throw new Error(errors.join('\n'));
    fs.mkdirSync('output/playwright/live', { recursive: true });
    await page.screenshot({ path: `output/playwright/live/${name}-file-cdn.png` });
    const result = { browser: name, version: browser.version(), state, scriptResponses: responses, uncaughtErrors: errors, date: new Date().toISOString() };
    fs.writeFileSync(`output/playwright/live/${name}.json`, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
