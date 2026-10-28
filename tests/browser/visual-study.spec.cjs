const { test, expect, ready } = require('./fixtures.cjs');

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`opens on the core city while keeping the full overview reachable at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page);
    await expect(page.locator('#b-core')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#cardTitle')).toHaveText('龟蛇锁大江');
    const towerHeight = await page.evaluate(() => {
      const tower = window.__testScene.children.find(o => o.userData.focus === 'tower');
      const box = new THREE.Box3().setFromObject(tower), ys = [];
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        ys.push(new THREE.Vector3(x, y, z).project(window.__testCamera).y);
      }
      return (Math.max(...ys) - Math.min(...ys)) * innerHeight / 2;
    });
    expect(towerHeight).toBeGreaterThanOrEqual(viewport.width < 640 ? 60 : 85);
    const initialDistance = await page.evaluate(() => window.__testCamera.position.distanceTo(window.__testControls.target));
    await page.locator('#b-home').click();
    await expect(page.locator('#cardTitle')).toHaveText('两江四岸');
    await expect.poll(() => page.evaluate(() => window.__testCamera.position.distanceTo(window.__testControls.target))).toBeGreaterThan(initialDistance * 1.5);
    await page.locator('#b-core').click();
    await expect(page.locator('#b-core')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#nav [aria-pressed="true"]')).toHaveCount(1);
  });
}
