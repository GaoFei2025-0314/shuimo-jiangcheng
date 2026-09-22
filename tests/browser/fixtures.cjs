const { test: base, expect } = require('@playwright/test');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const scripts = {
  'three.min.js': 'three/build/three.min.js',
  'OrbitControls.js': 'three/examples/js/controls/OrbitControls.js',
  'BufferGeometryUtils.js': 'three/examples/js/utils/BufferGeometryUtils.js',
  'gsap.min.js': 'gsap/dist/gsap.min.js'
};
const test = base.extend({
  page: async ({ page }, use) => {
    // Exercise real pinned libraries without making each regression test depend on a CDN.
    await page.route(/https:\/\/(cdnjs.cloudflare.com|cdn.jsdelivr.net)\//, route => {
      const filename = new URL(route.request().url()).pathname.split('/').pop();
      const file = scripts[filename];
      return file ? route.fulfill({ path: path.join(root, 'node_modules', file), contentType: 'text/javascript' }) : route.abort();
    });
    await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.fulfill({ body: '', contentType: 'text/css' }));
    await use(page);
  }
});
async function ready(page) {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__ready === true)).toBe(true);
}
module.exports = { test, expect, ready, scripts };
