const { test, expect, ready } = require('./fixtures.cjs');

async function motion(page) {
  return page.evaluate(() => {
    const times = [];
    window.__testScene.traverse(o => {
      if (o.material && o.material.uniforms && o.material.uniforms.uTime) times.push(o.material.uniforms.uTime.value);
    });
    return { times, camera: window.__testCamera.position.toArray(), target: window.__testControls.target.toArray(),
      tweens: gsap.getTweensOf([window.__testCamera.position, window.__testControls.target]).length };
  });
}

test('reduced motion switches instantly and freezes automatic scenery', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await page.getByRole('button', { name: '黄鹤楼', exact: true }).click();
  await expect(page.locator('#cardTitle')).toHaveText('黄鹤楼');
  const first = await motion(page);
  expect(first.tweens).toBe(0);
  await page.waitForTimeout(150);
  const next = await motion(page);
  expect(next.camera).toEqual(first.camera);
  expect(next.times).toEqual(first.times);
});

test('changing the system motion preference stops a running flight', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: '东湖', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(async () => (await motion(page)).tweens).toBe(0);
  const first = await motion(page);
  await page.waitForTimeout(150);
  expect((await motion(page)).times).toEqual(first.times);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(async () => (await motion(page)).times[0]).toBeGreaterThan(first.times[0]);
});

test('rapid navigation keeps the last title and selected button', async ({ page }) => {
  await ready(page);
  for (const id of ['tower', 'lake', 'bridge', 'customs']) await page.locator(`#b-${id}`).click();
  await expect(page.locator('#cardTitle')).toHaveText('江汉关');
  await expect(page.locator('#b-customs')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#nav [aria-pressed="true"]')).toHaveCount(1);
  await expect.poll(async () => (await motion(page)).tweens).toBe(0);
  await expect(page.locator('#card')).toHaveCSS('opacity', '1');
  await expect(page.locator('#cardTitle')).toHaveText('江汉关');
});

test('dragging interrupts the camera flight', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: '东湖', exact: true }).click();
  await page.mouse.move(800, 500);
  await page.mouse.down();
  await page.mouse.move(930, 540, { steps: 5 });
  await page.mouse.up();
  expect((await motion(page)).tweens).toBe(0);
  await expect(page.locator('#card')).toHaveCSS('opacity', '1');
});

test('a disappearing focused landmark moves focus to its navigation button', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const mark = page.getByRole('button', { name: '移至黄鹤楼', exact: true });
  await mark.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#b-tower')).toBeFocused();
  await expect(mark).toBeHidden();
});

test('invisible landmark buttons cannot enter the tab order', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await page.getByRole('button', { name: '黄鹤楼', exact: true }).click();
  const invisibleFocusable = await page.locator('.mark').evaluateAll(marks => marks.filter(m =>
    (getComputedStyle(m).opacity < .35 || getComputedStyle(m).visibility === 'hidden') && !m.disabled && m.tabIndex >= 0
  ).length);
  expect(invisibleFocusable).toBe(0);
});

test('all nine navigation destinations and music toggle remain usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const titles = { home: '两江四岸', core: '南岸嘴', tower: '黄鹤楼', bridge: '武汉长江大桥', qc: '晴川阁', tv: '龟山电视塔', customs: '江汉关', wuda: '武大 · 老斋舍', lake: '东湖' };
  for (const [id, title] of Object.entries(titles)) {
    await page.locator(`#b-${id}`).click();
    await expect(page.locator('#cardTitle')).toHaveText(title);
  }
  await page.locator('#sound').click();
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#sound').click();
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
});
