// Same framing and fallback fonts on both revisions; this script never enters the shipped HTML.
const { chromium, webkit } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const libraries = {
  'three.min.js': 'three/build/three.min.js',
  'OrbitControls.js': 'three/examples/js/controls/OrbitControls.js',
  'BufferGeometryUtils.js': 'three/examples/js/utils/BufferGeometryUtils.js',
  'gsap.min.js': 'gsap/dist/gsap.min.js'
};
(async () => {
  const [name = 'webkit', html = 'dist/index.html', directory = 'output/visual-study'] = process.argv.slice(2);
  if (!['chromium', 'webkit'].includes(name)) throw new Error('Use chromium or webkit');
  fs.mkdirSync(directory, { recursive: true });
  const browser = await ({ chromium, webkit })[name].launch();
  const evidence = { browser: name, version: browser.version(), html: path.resolve(html), date: new Date().toISOString(), captures: [] };
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.route(/https:\/\/(cdnjs.cloudflare.com|cdn.jsdelivr.net)\//, route => {
        const file = libraries[new URL(route.request().url()).pathname.split('/').pop()];
        return file ? route.fulfill({ body: fs.readFileSync(path.resolve('node_modules', file)), contentType: 'text/javascript' }) : route.abort();
      });
      await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.fulfill({ body: '', contentType: 'text/css' }));
      await page.goto(pathToFileURL(path.resolve(html)).href);
      await page.waitForFunction(() => window.__ready === true);
      for (const view of ['entry', 'tower']) {
        if (view === 'tower') await page.locator('#b-tower').click();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const file = `${name}-${viewport.width}x${viewport.height}-${view}.png`;
        await page.screenshot({ path: path.join(directory, file), animations: 'disabled' });
        evidence.captures.push({ ...viewport, view, title: await page.locator('#cardTitle').textContent(), file });
      }
      if (errors.length) throw new Error(errors.join('\n'));
      await page.close();
    }
    fs.writeFileSync(path.join(directory, `${name}.json`), JSON.stringify(evidence, null, 2) + '\n');
    console.log(JSON.stringify(evidence));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
