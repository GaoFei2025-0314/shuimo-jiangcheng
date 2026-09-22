const { test: base, expect } = require('@playwright/test');
const path = require('node:path');
const { readFileSync } = require('node:fs');
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
      if (!file) return route.abort();
      let body = readFileSync(path.join(root, 'node_modules', file), 'utf8');
      // Observe real rendered geometry/camera in tests; no diagnostic globals ship in the HTML.
      if (filename === 'three.min.js') body += `
        const OriginalRenderer = THREE.WebGLRenderer;
        THREE.WebGLRenderer = function (...args) {
          const renderer = new OriginalRenderer(...args), render = renderer.render;
          renderer.render = function (scene, camera) {
            window.__testScene = scene; window.__testCamera = camera;
            return render.call(this, scene, camera);
          };
          return renderer;
        };`;
      if (filename === 'OrbitControls.js') body += `
        const OriginalControls = THREE.OrbitControls;
        THREE.OrbitControls = class extends OriginalControls {
          constructor(...args) { super(...args); window.__testControls = this; }
        };`;
      return route.fulfill({ body, contentType: 'text/javascript' });
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
