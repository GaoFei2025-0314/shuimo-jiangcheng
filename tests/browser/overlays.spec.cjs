const { test, expect, ready } = require('./fixtures.cjs');

async function collisions(page) {
  return page.evaluate(() => {
    const rect = e => ({ name: e.textContent, ...e.getBoundingClientRect().toJSON() });
    const visible = e => !e.hidden && getComputedStyle(e).visibility !== 'hidden' && Number(getComputedStyle(e).opacity) > .01 && e.getBoundingClientRect().width > 0;
    const marks = [...document.querySelectorAll('.mark')].filter(visible).map(rect);
    const ui = [...document.querySelectorAll('#title, #poem, #sound, #poem-toggle, #dock')].filter(visible).map(rect);
    const labels = [...document.querySelectorAll('#labels b')].filter(visible).map(rect);
    const overlap = (a, b) => a.left < b.right + 7.8 && a.right + 7.8 > b.left && a.top < b.bottom + 7.8 && a.bottom + 7.8 > b.top;
    const errors = [];
    marks.forEach((m, i) => {
      if (m.left < 8 || m.right > innerWidth - 8 || m.top < 8 || m.bottom > innerHeight - 8) errors.push(`${m.name} outside viewport`);
      [...marks.slice(i + 1), ...ui, ...labels].filter(r => overlap(m, r)).forEach(r => errors.push(`${m.name} overlaps ${r.name}`));
    });
    return errors;
  });
}

for (const [width, height] of [[1440, 900], [1280, 720], [390, 844], [360, 640], [844, 390]]) {
  test(`overlays avoid each other and the UI at ${width}x${height}`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page);
    for (const key of ['home', 'core', 'tower', 'lake']) {
      await page.locator(`#b-${key}`).click();
      await expect.poll(() => collisions(page)).toEqual([]);
    }
    if (width <= 640 || height <= 500) {
      await page.locator('#poem-toggle').click();
      await expect.poll(() => collisions(page)).toEqual([]);
      await page.locator('#details-toggle').click();
      await expect.poll(() => collisions(page)).toEqual([]);
    }
  });
}

test('stationary camera reuses overlay layout, then remeasures changed sizes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    window.__overlayWrites = 0;
    const observer = new MutationObserver(records => { window.__overlayWrites += records.length; });
    observer.observe(document.getElementById('marks'), { attributes: true, subtree: true });
    observer.observe(document.getElementById('labels'), { attributes: true, subtree: true });
    window.__overlayObserver = observer;
  });
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__overlayWrites)).toBe(0);
  await page.addStyleTag({ content: '.mark .plate { font-size: 27px; }' });
  await expect.poll(() => collisions(page)).toEqual([]);
  await expect.poll(() => page.evaluate(() => window.__overlayWrites)).toBeGreaterThan(0);
});

test('a focused landmark wins against other marks when their sizes change', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const mark = page.locator('.mark:visible').last();
  const name = await mark.getAttribute('aria-label');
  await mark.focus();
  await page.addStyleTag({ content: '.mark { min-width: 120px; }' });
  await expect(page.getByRole('button', { name, exact: true })).toBeFocused();
  await expect.poll(() => collisions(page)).toEqual([]);
});

test('Chutian landmark remains selectable from the lake view', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await page.locator('#b-lake').click();
  const mark = page.getByRole('button', { name: '移至楚天台' });
  await mark.click();
  await expect(page.locator('#cardTitle')).toHaveText('东湖 · 楚天台');
  await expect(page.locator('#b-lake')).toHaveAttribute('aria-pressed', 'true');
});
