const { test, expect, ready } = require('./fixtures.cjs');
const fs = require('node:fs');
const path = require('node:path');
const shots = path.resolve('output/playwright/screenshots');
fs.mkdirSync(shots, { recursive: true });

async function subjectBounds(page, key) {
  return page.evaluate(key => {
    const scene = window.__testScene, camera = window.__testCamera;
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const subjects = scene.children.filter(o => o.userData.focus && (key === 'home' ? o.userData.focus !== 'lake' : key === 'core' ? ['tower', 'bridge', 'qc', 'tv'].includes(o.userData.focus) : o.userData.focus === key));
    const points = [];
    const crossing = subjects.find(o => o.userData.focus === 'bridge');
    if (crossing) {
      // Its diagonal world-axis bounding box contains empty space on both sides of the river.
      // Project the actual deck, trusses and approach vertices to check the occupied pixels.
      const projected = new THREE.Box2(), v = new THREE.Vector3();
      for (const part of crossing.children) {
        const positions = part.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++)
          projected.expandByPoint(v.fromBufferAttribute(positions, i).applyMatrix4(part.matrixWorld).project(camera));
      }
      for (const p of [projected.min, projected.max]) {
        points.push({ x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight });
      }
    }
    const boxes = subjects.filter(o => o !== crossing).map(o => new THREE.Box3().setFromObject(o));
    for (const bounds of boxes) for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
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
    await expect(page.locator('#more-toggle')).toBeVisible();
    await expect(page.locator('#poem-toggle')).toBeHidden();
    for (const key of ['home', 'core', 'tower', 'bridge', 'qc', 'tv', 'customs', 'wuda', 'lake',
      'yingwuzhou', 'honglou', 'hongshan', 'museum', 'guiyuan', 'qintai', 'watertower']) {
      await page.locator(`#b-${key}`).click();
      await expect.poll(async () => {
        const b = await subjectBounds(page, key);
        return b.left >= 16 && b.right <= b.width - 16 && b.top >= b.safeTop && b.bottom <= b.safeBottom;
      }).toBe(true);
      if (['home', 'tower', 'lake'].includes(key)) await page.screenshot({ path: path.join(shots, `${info.project.name}-${width}x${height}-${key}.png`) });
    }
    await page.locator('#more-toggle').click();
    const heights = await page.locator('#nav button, #sound, .panel-toggle, #action-menu button')
      .evaluateAll(els => els.filter(e => e.checkVisibility()).map(e => e.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThan(20);
    await page.keyboard.press('Escape');
    expect(heights.every(h => h >= 44)).toBe(true);
    await expect(page.locator('#nav')).toHaveCSS('flex-wrap', 'nowrap');
  });
}

test('the portrait East Lake view gives its shoreline room and separates the banks in depth', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__ready && window.__dbg);
  await page.locator('#b-lake').click();
  // Let the reduced-motion render apply the new lens and camera world matrix.
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const result = await page.evaluate(() => {
    const { camera, LAKES, LAND_Y } = window.__dbg;
    const gl = window.__testRenderer.getContext();
    const levels = 2 ** gl.getParameter(gl.DEPTH_BITS) - 1;
    const pixels = new THREE.Box2();
    let separation = Infinity;
    for (const [x,z] of LAKES[0]) {
      const shore = new THREE.Vector3(x, 0, z);
      const water = shore.clone().project(camera);
      pixels.expandByPoint(new THREE.Vector2(water.x, water.y));
      // Sample the bank and water on the same sightline, measured in depth buffer steps.
      const bank = shore.lerp(camera.position, LAND_Y / camera.position.y).project(camera);
      separation = Math.min(separation, (water.z - bank.z) * .5 * levels);
    }
    const safeHeight = document.querySelector('#dock').getBoundingClientRect().top
                     - document.querySelector('#title').getBoundingClientRect().bottom;
    return { fill: (pixels.max.y-pixels.min.y)*innerHeight/(2*safeHeight), separation };
  });
  expect(result.fill).toBeGreaterThan(.36);
  expect(result.separation).toBeGreaterThan(4);
  await expect(page.getByRole('button', { name: '移至行吟阁' })).toBeVisible();
  await expect(page.getByRole('button', { name: '移至楚天台' })).toBeVisible();
});

test('compact text panels are mutually exclusive, bounded and keyboard operable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const nav = page.locator('#nav');
  await expect(nav).toHaveClass(/more-right/);
  await nav.evaluate(el => { el.scrollLeft = el.scrollWidth; });
  await expect(nav).not.toHaveClass(/more-right/);
  await expect(nav).toHaveClass(/more-left/);
  await nav.evaluate(el => { el.scrollLeft = 0; });
  const towerBounds = await subjectBounds(page, 'tower');
  const redHouseLabel = await page.locator('#marks button[aria-label="移至红楼"]').boundingBox();
  if (redHouseLabel) {
    const towerX = (towerBounds.left + towerBounds.right) / 2, towerY = (towerBounds.top + towerBounds.bottom) / 2;
    expect(towerX < redHouseLabel.x || towerX > redHouseLabel.x + redHouseLabel.width ||
      towerY < redHouseLabel.y || towerY > redHouseLabel.y + redHouseLabel.height).toBe(true);
  }
  await page.locator('#more-toggle').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#more-toggle')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#poem-toggle').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#poem')).toBeVisible();
  await expect(page.locator('#action-menu')).toBeHidden();
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

test('landscape controls leave the drawing room and restore keyboard navigation', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const dock = page.locator('#dock'), toggle = page.getByRole('button', { name: '观画', exact: true });
  const overview = page.locator('#reset-view');
  const occupiedHeight = await dock.evaluate(el => innerHeight - el.getBoundingClientRect().top);
  expect(occupiedHeight).toBeLessThanOrEqual(97);
  await expect(page.locator('#hint')).toContainText('轻触景点');
  await expect.poll(() => overview.evaluate(el => el.style.getPropertyValue('--north-angle'))).toMatch(/deg$/);
  await page.getByRole('button', { name: '黄鹤楼', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#b-tower')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#more-toggle').click();
  await toggle.focus();
  await page.keyboard.press('Enter');
  const restore = page.getByRole('button', { name: '退出观画' });
  await expect(restore).toBeFocused();
  for (const selector of ['#marks', '#labels', '#poem', '#nav']) await expect(page.locator(selector)).toBeHidden();
  await expect(overview).toBeVisible();
  await overview.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#more-toggle')).toBeFocused();
  await expect(page.locator('#nav')).toBeVisible();
  await expect(page.locator('#b-home')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#marks')).toBeVisible();
  await page.getByRole('button', { name: '详情' }).click();
  await expect(page.locator('#cardText')).toBeVisible();
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

test('the compact action menu opens from the ellipsis, closes on Escape and outside taps', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const more = page.locator('#more-toggle'), menu = page.locator('#action-menu');
  await expect(menu).toBeHidden();
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  for (const id of ['#poem-toggle', '#reset-view', '#painting-toggle']) await expect(page.locator(id)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(more).toBeFocused();
  await more.click();
  await page.mouse.click(195, 420);
  await expect(menu).toBeHidden();
  // Tabbing past the last item folds the menu away instead of leaving it over the map.
  await more.focus();
  await page.keyboard.press('Enter');
  await page.locator('#painting-toggle').focus();
  await page.keyboard.press('Tab');
  await expect(menu).toBeHidden();
  // Choosing an item by keyboard closes the menu and hands focus back to the ellipsis.
  await more.focus();
  await page.keyboard.press('Enter');
  await page.locator('#poem-toggle').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#poem')).toBeVisible();
  await expect(more).toBeFocused();
  await page.keyboard.press('Escape');
  await more.click();
  await page.locator('#painting-toggle').click();
  await expect(page.getByRole('button', { name: '退出观画' })).toBeVisible();
  await expect(more).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(more).toBeVisible();
  await expect(menu).toBeHidden();
});

test('compact nav keeps the whole focus ring inside its scroll strip', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  // After a key press, focus counts as keyboard focus (WebKit does not Tab to buttons by default).
  await page.keyboard.press('Shift');
  await page.locator('#b-core').focus();
  expect(await page.locator('#b-core').evaluate(el => el.matches(':focus-visible'))).toBe(true);
  const ring = await page.locator('#b-core').evaluate(el => {
    const style = getComputedStyle(el), box = el.getBoundingClientRect(), nav = el.closest('#nav').getBoundingClientRect();
    const reach = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
    return { top: box.top - reach, bottom: box.bottom + reach, navTop: nav.top, navBottom: nav.bottom };
  });
  expect(ring.top).toBeGreaterThanOrEqual(ring.navTop);
  expect(ring.bottom).toBeLessThanOrEqual(ring.navBottom);
});

for (const width of [1440, 1280, 1216, 1181, 1120, 1101, 1000]) {
  test(`the compass and scale stay on the card's line or step aside at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page);
    const { visible, toolsBottom, cardBottom } = await page.evaluate(() => {
      const tools = document.getElementById('tools');
      return { visible: tools.getClientRects().length > 0,
        toolsBottom: tools.getBoundingClientRect().bottom, cardBottom: document.getElementById('card').getBoundingClientRect().bottom };
    });
    if (visible) expect(toolsBottom).toBeLessThanOrEqual(cardBottom + 1);
  });
}

test('the resting poem returns for keyboard readers', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await page.locator('#b-tower').click();
  const line = page.locator('#poem p').nth(1);
  await expect(line).toHaveCSS('opacity', '0.35');
  await page.locator('#poem').focus();
  await expect(page.locator('#poem')).toBeFocused();
  await expect(line).toHaveCSS('opacity', '1');
});
