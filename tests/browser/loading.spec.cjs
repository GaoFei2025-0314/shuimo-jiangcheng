const { test, expect, ready, scripts } = require('./fixtures.cjs');

for (const filename of Object.keys(scripts)) {
  test(`a failed ${filename} shows a recoverable error`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(`**/${filename}`, route => route.abort());
    await page.goto('/');
    await expect(page.getByRole('button', { name: '重新加载' })).toBeVisible();
    await expect(page.locator('#nav button:enabled')).toHaveCount(0);
    expect(await page.evaluate(() => window.__ready === true)).toBe(false);
    expect(errors).toEqual([]);
    await page.unroute(`**/${filename}`);
    await page.getByRole('button', { name: '重新加载' }).click();
    await expect.poll(() => page.evaluate(() => window.__ready === true)).toBe(true);
    await expect(page.locator('canvas')).toHaveCount(1);
  });
}

test('navigation stays disabled while dependencies load', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/gsap.min.js', async route => { await gate; await route.fallback(); });
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('#nav button:enabled')).toHaveCount(0);
  release();
  await expect.poll(() => page.evaluate(() => window.__ready === true)).toBe(true);
  await expect(page.locator('#nav button:enabled')).toHaveCount(9);
});

test('missing library globals are reported without an uncaught error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/gsap.min.js', route => route.fulfill({ body: '', contentType: 'text/javascript' }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: '重新加载' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a stalled dependency times out and late delivery cannot start the scene', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/gsap.min.js', async route => { await gate; await route.fallback(); });
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.getByRole('button', { name: '重新加载' })).toBeVisible({ timeout: 19000 });
  await expect(page.locator('#loadMessage')).toContainText('超时');
  release();
  await page.waitForLoadState('load');
  expect(await page.evaluate(() => window.__ready === true)).toBe(false);
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('WebGL creation failure is explained', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return /webgl/i.test(kind) ? null : getContext.call(this, kind, ...args);
    };
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: '重新加载' })).toBeVisible();
  await expect(page.locator('#loadMessage')).toContainText('三维');
  expect(errors).toEqual([]);
});

test('context loss disables interaction and clears readiness', async ({ page }) => {
  await ready(page);
  await page.locator('canvas').dispatchEvent('webglcontextlost');
  await expect(page.getByRole('button', { name: '重新加载' })).toBeVisible();
  await expect(page.locator('#nav button:enabled')).toHaveCount(0);
  expect(await page.evaluate(() => window.__ready)).toBe(false);
});

test('system fonts can be used and scene loads without runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  await expect(page.locator('#err')).toBeHidden();
  await expect(page.locator('#nav button:enabled')).toHaveCount(9);
  expect(errors).toEqual([]);
});
