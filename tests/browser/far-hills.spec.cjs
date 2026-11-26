const { test, expect, STARTUP } = require('./fixtures.cjs');

test.use({ contextOptions: { reducedMotion: 'reduce' } });

async function openMap(page) {
  await page.goto('/?debug');
  await expect.poll(() => page.evaluate(() => Boolean(window.__ready && window.__dbg)), STARTUP).toBe(true);
}

async function orbit(page, pitch, yaw = 22, distance = 440) {
  await page.evaluate(async ({ pitch, yaw, distance }) => {
    const { camera, controls } = window.__dbg;
    controls.dispatchEvent({ type: 'start' });
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSphericalCoords(distance,
      THREE.MathUtils.degToRad(90 - pitch), THREE.MathUtils.degToRad(yaw)));
    controls.update();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, { pitch, yaw, distance });
}

const hillsOpacity = page => page.locator('#far-hills').evaluate(el => Number(getComputedStyle(el).opacity));

test('far hills show over a low horizon and hide in overhead views', async ({ page }) => {
  await openMap(page);
  await page.locator('#b-core').click();
  await orbit(page, 15);
  const bands = page.locator('#far-hills .far-hill');
  await expect(bands).toHaveCount(3);
  await expect.poll(() => bands.evaluateAll(nodes => nodes.every(el => getComputedStyle(el).backgroundImage.includes('blob:')))).toBe(true);
  expect(await hillsOpacity(page)).toBeGreaterThan(.5);
  expect(await page.evaluate(() => window.__dbg.farHills.ridgeTopAt(720))).toBeLessThan(450);
  await orbit(page, 55);
  expect(await hillsOpacity(page)).toBe(0);
  expect(await page.evaluate(() => window.__dbg.farHills.ridgeTopAt(720))).toBe(Infinity);
  let low = 6, high = 55, fit;
  for (let i = 0; i < 12; i++) {
    const pitch = (low + high) / 2;
    await orbit(page, pitch);
    fit = await page.locator('#sun').evaluate(el => Number(getComputedStyle(el).getPropertyValue('--sky-fit')));
    if (fit > .1) low = pitch;
    else high = pitch;
  }
  expect(Math.abs(fit - .1)).toBeLessThan(.01);
  expect(await hillsOpacity(page)).toBeLessThan(.05);
});

test('far hills pan continuously through a full orbit', async ({ page }) => {
  await openMap(page);
  const near = page.locator('#far-hills [data-layer="2"]');
  await expect(near).toHaveCount(1);
  const positions = [];
  for (let yaw = 0; yaw <= 360; yaw += 10) {
    await orbit(page, 15, yaw);
    positions.push(await near.evaluate(el => parseFloat(getComputedStyle(el).backgroundPositionX)));
  }
  const deltas = positions.slice(1).map((value, i) => value - positions[i]);
  for (const delta of deltas) {
    expect(Math.sign(delta)).toBe(Math.sign(deltas[0]));
    expect(Math.abs(delta)).toBeGreaterThan(0);
    expect(Math.abs(delta)).toBeLessThan(400);
  }
});

test('far hills fade in the riverside walk and return on leaving it', async ({ page }) => {
  await openMap(page);
  await orbit(page, 15);
  await expect(page.locator('#far-hills')).toHaveCount(1);
  await page.locator('#painting-toggle').click();
  expect(await hillsOpacity(page)).toBeGreaterThan(.5);
  await page.keyboard.press('Escape');
  await page.locator('#atlas-open').click();
  expect(await hillsOpacity(page)).toBeGreaterThan(.5);
  await page.locator('#atlas-walk').click();
  await expect.poll(() => hillsOpacity(page)).toBe(0);
  await page.keyboard.press('Escape');
  await page.locator('#b-core').click();
  await orbit(page, 15);
  expect(await hillsOpacity(page)).toBeGreaterThan(.5);
});

test('far hills are built once even after a retry', async ({ page }) => {
  await page.route('**/BufferGeometryUtils.js', route => route.fulfill({ contentType: 'text/javascript',
    body: 'THREE.BufferGeometryUtils = { mergeBufferGeometries() { throw new Error("Injected failure"); } };' }), { times: 1 });
  await page.goto('/?debug');
  await page.locator('#retry').click();
  await expect.poll(() => page.evaluate(() => window.__ready), STARTUP).toBe(true);
  await expect(page.locator('#far-hills .far-hill')).toHaveCount(3);
});
