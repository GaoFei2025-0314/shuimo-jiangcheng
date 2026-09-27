const { test, expect, ready } = require('./fixtures.cjs');
const fs = require('node:fs');
const path = require('node:path');
const shots = path.resolve('output/playwright/screenshots');
fs.mkdirSync(shots, { recursive: true });

async function subjectBounds(page, key) {
  return page.evaluate(key => {
    const scene = window.__testScene, camera = window.__testCamera;
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    scene.children.filter(o => o.userData.focus && (key === 'home' ? o.userData.focus !== 'lake' : key === 'core' ? ['tower', 'bridge', 'qc', 'tv', 'customs'].includes(o.userData.focus) : o.userData.focus === key))
      .forEach(o => bounds.union(new THREE.Box3().setFromObject(o)));
    const points = [];
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const p = new THREE.Vector3(x, y, z).project(camera);
      points.push({ x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight });
    }
    return { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
      top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)),
      safeTop: document.getElementById('title').getBoundingClientRect().bottom + 8,
      safeBottom: document.getElementById('dock').getBoundingClientRect().top - 8, width: innerWidth };
  }, key);
}

for (const [width, height] of [[390, 844], [360, 640], [844, 390]]) {
  test(`compact ${width}x${height} keeps the city and selected subjects inside the map area`, async ({ page }, info) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page);
    await expect(page.locator('#poem')).toBeHidden();
    await expect(page.locator('#cardText')).toBeHidden();
    await expect(page.locator('#poem-toggle')).toBeVisible();
    for (const key of ['home', 'core', 'tower', 'bridge', 'qc', 'tv', 'customs', 'wuda', 'lake',
      'yingwuzhou', 'honglou', 'hongshan', 'museum', 'guiyuan', 'qintai', 'watertower']) {
      await page.locator(`#b-${key}`).click();
      await expect.poll(async () => {
        const b = await subjectBounds(page, key);
        return b.left >= 16 && b.right <= b.width - 16 && b.top >= b.safeTop && b.bottom <= b.safeBottom;
      }).toBe(true);
      if (['home', 'tower', 'lake'].includes(key)) await page.screenshot({ path: path.join(shots, `${info.project.name}-${width}x${height}-${key}.png`) });
    }
    const heights = await page.locator('#nav button, #sound, .panel-toggle').evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
    expect(heights.every(h => h >= 44)).toBe(true);
    await expect(page.locator('#nav')).toHaveCSS('flex-wrap', 'nowrap');
  });
}

test('compact text panels are mutually exclusive, bounded and keyboard operable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await page.locator('#poem-toggle').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#poem')).toBeVisible();
  await expect(page.locator('#poem-toggle')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#details-toggle').click();
  await expect(page.locator('#poem')).toBeHidden();
  await expect(page.locator('#cardText')).toBeVisible();
  const h = await page.locator('#cardText').evaluate(e => e.getBoundingClientRect().height);
  expect(h).toBeLessThanOrEqual(844 * .45);
  await page.keyboard.press('Escape');
  await expect(page.locator('#cardText')).toBeHidden();
  await expect(page.locator('#details-toggle')).toBeFocused();
});

test('resizing after a manual orbit preserves camera position and target', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await page.mouse.move(180, 330); await page.mouse.down();
  await page.mouse.move(230, 370, { steps: 3 }); await page.mouse.up();
  const before = await page.evaluate(() => [window.__testCamera.position.toArray(), window.__testControls.target.toArray()]);
  for (const viewport of [{ width: 844, height: 390 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(100);
    const after = await page.evaluate(() => [window.__testCamera.position.toArray(), window.__testControls.target.toArray()]);
    after.flat().forEach((v, i) => expect(v).toBeCloseTo(before.flat()[i], 5));
  }
});

for (const [width, height] of [[1440, 900], [1280, 720]]) {
  test(`desktop ${width}x${height} retains full poetry and captures the city and tower`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page);
    await expect(page.locator('#poem')).toBeVisible();
    await expect(page.locator('#cardText')).toBeVisible();
    for (const key of ['home', 'tower']) {
      await page.locator(`#b-${key}`).click();
      if (['home', 'tower', 'lake'].includes(key)) await page.screenshot({ path: path.join(shots, `${info.project.name}-${width}x${height}-${key}.png`) });
    }
  });
}
