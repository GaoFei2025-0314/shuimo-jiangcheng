const { test, expect, ready } = require('./fixtures.cjs');

test('a stalled font stylesheet does not delay map readiness', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('https://fonts.googleapis.com/**', async route => { await gate; await route.fulfill({ body: '', contentType: 'text/css' }); });
  await page.goto('/', { waitUntil: 'commit' });
  try {
    await expect.poll(() => page.evaluate(() => window.__ready === true)).toBe(true);
    await expect(page.locator('#nav button:enabled')).toHaveCount(9);
  } finally { release(); }
});

test('an initialization exception leaves navigation disabled and offers recovery', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/BufferGeometryUtils.js', route => route.fulfill({ contentType: 'text/javascript',
    body: 'THREE.BufferGeometryUtils = { mergeBufferGeometries() { throw new Error("Injected initialization failure"); } };' }));
  await page.goto('/');
  await expect(page.locator('#retry')).toBeVisible();
  await expect(page.locator('#nav button:enabled')).toHaveCount(0);
  expect(await page.evaluate(() => window.__ready)).toBe(false);
  expect(errors).toEqual([]);
});

test('failure during the first frame never reports ready', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      const context = original.call(this, type, ...args);
      if (context && /webgl/i.test(type)) context.drawElements = () => { throw new Error('Injected first-frame failure'); };
      return context;
    };
  });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#retry')).toBeVisible();
  await expect(page.locator('#loadMessage')).toContainText('画面已中断');
  expect(await page.evaluate(() => window.__ready)).toBe(false);
  expect(errors).toEqual([]);
});

test('wheel zoom cancels flight and panel gestures do not reach map controls', async ({ page }) => {
  await ready(page);
  await page.locator('#b-lake').click();
  await page.mouse.move(750, 500);
  await page.mouse.wheel(0, -200);
  await expect.poll(() => page.evaluate(() => gsap.getTweensOf([window.__testCamera.position, window.__testControls.target]).length)).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => { window.__gestureStarts = 0; window.__testControls.addEventListener('start', () => window.__gestureStarts++); });
  await page.locator('#poem-toggle').click();
  await page.locator('#poem').hover();
  await page.mouse.wheel(0, 120);
  expect(await page.evaluate(() => window.__gestureStarts)).toBe(0);
});

test('Tab visits only visible controls and Enter activates the focused destination', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await page.locator('#b-tower').click();
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => {
      const el = document.activeElement;
      return !el.classList.contains('mark') || (!el.disabled && el.getAttribute('aria-hidden') === 'false' && getComputedStyle(el).visibility === 'visible');
    })).toBe(true);
  }
  await page.locator('#b-wuda').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#cardTitle')).toHaveText('武大 · 老斋舍');
});
