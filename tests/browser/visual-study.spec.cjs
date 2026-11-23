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
    const bases = houses.map(node => matrix.fromArray(node.userData.authoredMatrices).elements[13]);
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
  expect(details.types).toEqual(['apartment', 'arcade', 'highrise', 'lane', 'slab_tower', 'terrace_tower', 'wharf']);
  expect(Math.max(...details.groundErrors)).toBeLessThan(.15);
  expect(details.outside).toBeLessThan(1);
});

test('each atlas plate opens for its own model, with two architectural detail views', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await page.locator('#b-tower').click();
  await page.getByRole('button', { name: '建筑图录', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '建筑图录' });
  const select = dialog.getByRole('combobox'), image = dialog.getByRole('img');
  const keys = await select.locator('option').evaluateAll(opts => opts.map(o => o.value));
  const sceneKeys = await page.evaluate(() => window.__testScene.children.map(o => o.userData.modelKey).filter(Boolean));
  expect(keys.sort()).toEqual(sceneKeys.sort());
  expect(keys).toHaveLength(15);
  for (const key of keys) {
    await select.selectOption(key);
    await image.evaluate(image => image.decode());
    expect(await image.evaluate(image => image.naturalWidth)).toBeGreaterThanOrEqual(1000);
    if (key === 'tower' || key === 'bridge') {
      const before = await image.getAttribute('alt');
      await dialog.locator('#atlas-detail').click();
      await image.evaluate(image => image.decode());
      await expect(image).not.toHaveAttribute('alt', before);
      await expect(dialog.locator('#atlas-detail')).toHaveAttribute('aria-pressed', 'true');
    }
  }
  await select.selectOption('lake');
  await dialog.getByRole('button', { name: '在地图中查看' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#cardTitle')).toHaveText('东湖 · 行吟阁');
  await expect(page.locator('#b-lake')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#atlas-open').click();
  await expect(select).toHaveValue('lake');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#atlas-open')).toBeFocused();
});

test('street trees and tower groups follow the same ground and corridors as the exported landscape', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__ready && window.__dbg);
  const result = await page.evaluate(() => {
    const { scene, BRIDGES, roadAt, approachHalfWidth, plantingSurface } = window.__dbg;
    const trees = {}, tall = {}, banks = new Set();
    let maxRootGap = 0, minBridgeClearance = Infinity, minRoadEdge = Infinity;
    const m = new THREE.Matrix4(), box = new THREE.Box3();
    for (const node of scene.children) {
      if (node.userData.landscapeSurface) banks.add(node.userData.landscapeSurface.material);
      const placements = node.userData.authoredMatrices;
      if (!placements) continue;
      const tree = node.userData.vegetation;
      if (tree?.part === 'wood') {
        trees[tree.species] = placements.length / 16;
        for (let i = 0; i < placements.length; i += 16) {
          const x = placements[i+12], y = placements[i+13], z = placements[i+14], ground = plantingSurface(x,z);
          maxRootGap = Math.max(maxRootGap, ground == null ? Infinity : Math.abs(y-ground));
          const road = roadAt(x,z);
          if (road) minRoadEdge = Math.min(minRoadEdge, road.distance - approachHalfWidth);
          for (const [a,b] of BRIDGES) {
            const dx=b.x-a.x, dz=b.z-a.z;
            const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
            minBridgeClearance=Math.min(minBridgeClearance,Math.hypot(x-a.x-t*dx,z-a.z-t*dz));
          }
        }
      }
      if (!node.name.startsWith('City / ')) continue;
      const kind = node.name.slice(7);
      if (!['highrise','slab_tower','terrace_tower'].includes(kind)) continue;
      const group = tall[kind] ||= { count: placements.length/16, peak: 0 };
      for (let i = 0; i < placements.length; i += 16) {
        m.fromArray(placements,i);
        box.copy(node.geometry.boundingBox).applyMatrix4(m);
        group.peak = Math.max(group.peak,box.max.y-box.min.y);
      }
    }
    return { trees, tall, banks:[...banks], maxRootGap, minBridgeClearance, minRoadEdge };
  });
  expect(Object.keys(result.trees).sort()).toEqual(['broadleaf','cherry','pine','willow']);
  expect(Object.values(result.trees).every(n => n > 0)).toBe(true);
  expect(result.maxRootGap).toBeLessThan(.17);
  expect(result.minBridgeClearance).toBeGreaterThan(12);
  expect(result.minRoadEdge).toBeGreaterThan(.45);
  expect(result.banks).toEqual(expect.arrayContaining(['Hills','BankStone','BankGrass','Path']));
  expect(Object.keys(result.tall).sort()).toEqual(['highrise','slab_tower','terrace_tower']);
  expect(Object.values(result.tall).every(batch => batch.count >= 3 && batch.peak >= 20)).toBe(true);
});

test('the Wuhan University arrival looks uphill at the three arch entrances', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__ready && window.__dbg);
  await page.locator('#b-wuda').click();
  const minimumClearance = await page.evaluate(() => {
    const { camera, scene, plantingSurface } = window.__dbg;
    const dorm = scene.children.find(node => node.userData.focus === 'wuda');
    const eye = camera.position;
    if (dorm.worldToLocal(eye.clone()).z <= 5) return -Infinity;
    const sample = new THREE.Vector3();
    let lowest = Infinity;
    for (const x of [-12.65, 0, 12.65]) {
      // Halfway up each arch on the downhill facade in the Blender model.
      const arch = dorm.localToWorld(new THREE.Vector3(x, 2.4, 4.9));
      for (let step = 1; step <= 50; step++) {
        sample.lerpVectors(eye, arch, step / 50);
        const ground = plantingSurface(sample.x, sample.z);
        if (ground != null) lowest = Math.min(lowest, sample.y - ground);
      }
    }
    return lowest;
  });
  expect(minimumClearance).toBeGreaterThan(.5);
});

test('both approach carriageways stay above the terrain through the bridgeheads to the city streets', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__ready && window.__dbg);
  const failures = await page.evaluate(() => {
    const { scene, approachRoads, plantingSurface } = window.__dbg;
    const bridge = scene.children.find(node => node.userData.modelKey === 'bridge');
    const connectors = scene.children.filter(node => node.userData.landscapeSurface?.group === '武汉长江大桥');
    const roads = [...bridge.children, ...connectors];
    const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    ray.far = .85;
    const bad = [];
    for (const [bank, approach] of approachRoads.entries()) {
      for (let i = 1; i < approach.length - 1; i += 3) {
        const before = approach[i-1], at = approach[i], after = approach[i+1];
        const dx = after.x - before.x, dz = after.z - before.z, length = Math.hypot(dx,dz);
        let edge = 3.85;
        if (i >= 82) {
          const positions = connectors[bank].geometry.attributes.position;
          const j = (i - 82) * 2;
          // The approach tapers into the narrower city street. Check its actual edges.
          edge = .46 * Math.hypot(positions.getX(j) - positions.getX(j+1), positions.getZ(j) - positions.getZ(j+1));
        }
        for (const offset of [-edge, 0, edge]) {
          const x = at.x - dz*offset/length, z = at.z + dx*offset/length;
          ray.set(new THREE.Vector3(x, at.y + .42, z), down);
          const road = ray.intersectObjects(roads)[0];
          const ground = plantingSurface(x,z);
          if (!road || (ground != null && road.point.y < ground + .005))
            bad.push({ bank, i, offset, ground, surface: road?.point.y });
        }
      }
    }
    return bad;
  });
  expect(failures).toEqual([]);
});
