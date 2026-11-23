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

test('Blender buildings sit on the land and both bridge approaches fit a narrow desktop', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await page.locator('#b-bridge').click();
  const details = await page.evaluate(() => {
    const scene = window.__testScene, camera = window.__testCamera, v = new THREE.Vector3();
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    const houses = scene.children.filter(node => node.isInstancedMesh && node.name.startsWith('City / '));
    const land = scene.children.find(node => node.geometry?.type === 'ExtrudeGeometry');
    const ground = new THREE.Box3().setFromObject(land).max.y;
    const matrix = new THREE.Matrix4();
    const bases = houses.map(node => { node.getMatrixAt(0, matrix); return matrix.elements[13]; });
    const bridge = scene.children.find(node => node.userData.focus === 'bridge');
    const bounds = new THREE.Box2();
    for (const part of bridge.children) {
      const vertices = part.geometry.attributes.position;
      for (let i = 0; i < vertices.count; i++) {
        v.fromBufferAttribute(vertices, i).applyMatrix4(part.matrixWorld).project(camera);
        bounds.expandByPoint(v);
      }
    }
    return {
      types: [...new Set(houses.map(node => node.name.slice(7)))].sort(),
      groundErrors: bases.map(y => Math.abs(y - ground)),
      outside: Math.max(-bounds.min.x, bounds.max.x, -bounds.min.y, bounds.max.y)
    };
  });
  expect(details.types).toEqual(['apartment', 'arcade', 'highrise', 'lane', 'wharf']);
  expect(Math.max(...details.groundErrors)).toBeLessThan(.15);
  expect(details.outside).toBeLessThan(1);
});
