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
    const connectors = ['武昌','汉阳'].map(bank => scene.getObjectByName(bank+'引道 · 接地铺装'));
    const roads = [...bridge.children, ...connectors];
    const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    ray.far = .85;
    const bad = [];
    for (const [bank, approach] of approachRoads.entries()) {
      for (let i = 1; i < approach.length - 1; i += 3) {
        const before = approach[i-1], at = approach[i], after = approach[i+1];
        const dx = after.x - before.x, dz = after.z - before.z, length = Math.hypot(dx,dz);
        let edge = 3.85;
        const positions = connectors[bank].geometry.attributes.position;
        const first = approach.length - positions.count/2;
        if (i >= first) {
          const j = (i - first) * 2;
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

test('both riverbanks have continuous paved streets between the two bridge junctions', async ({ page }) => {
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__ready && window.__dbg);
  const failures = await page.evaluate(() => {
    const { scene, cityGround, plantingSurface, onLand } = window.__dbg;
    const ray = new THREE.Raycaster(), down = new THREE.Vector3(0,-1,0);
    const material = new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
    const failures = [];
    for (const [bank, street] of [['汉阳','汉阳桥头至翠微巷'],['武昌','蛇山脚坡街与首义街口']]) {
      const name = bank+'桥间街道';
      const path = cityGround.streets.filter(segment => segment.name === name);
      const pavement = new THREE.Mesh(scene.getObjectByName(name).geometry, material);
      const touches = (a,b) => Math.hypot(a.x-b.x,a.z-b.z) < .015;
      const branch = cityGround.streets.filter(segment => segment.name === bank+'桥头横街');
      const main = cityGround.streets.filter(segment => segment.name === street);
      if (!path.length || !branch.some(s=>touches(s.b,path[0].a)) ||
          !main.some(s=>touches(s.a,path.at(-1).b) || touches(s.b,path.at(-1).b))) {
        failures.push({bank, reason:'bridge junction disconnected'});
        continue;
      }
      for (const [i,{a,b,width}] of path.entries()) {
        if (i && !touches(a,path[i-1].b)) failures.push({bank,i,reason:'missing segment'});
        const length = Math.hypot(b.x-a.x,b.z-a.z);
        for (const offset of [-.42,0,.42]) {
          const x = (a.x+b.x)/2+offset*width*(b.z-a.z)/length;
          const z = (a.z+b.z)/2-offset*width*(b.x-a.x)/length;
          ray.set(new THREE.Vector3(x,65,z), down);
          const hit = ray.intersectObject(pavement)[0];
          if (!onLand(x,z) || !hit || hit.point.y <= plantingSurface(x,z) ||
              cityGround.occupied(x,z,0)) failures.push({bank,i,offset,reason:'unusable carriageway'});
        }
      }
      // Check the two sides of the deck joint against the actual rendered asphalt.
      const group = scene.children.find(o => o.userData.modelKey === 'yingwuzhou');
      const approach = scene.getObjectByName('鹦鹉洲'+bank+'引道 · 车行面');
      const sign = bank === '汉阳' ? -1 : 1;
      for (const lane of [-4,4]) {
        const heights = [.04,-.04].map(inset => {
          const origin = group.localToWorld(new THREE.Vector3(lane,25,sign*(100-inset)));
          ray.set(origin,down);
          return ray.intersectObjects(inset>0 ? group.children : [approach],true)[0]?.point.y;
        });
        if (!heights.every(Number.isFinite) || Math.abs(heights[0]-heights[1])>.025)
          failures.push({bank,lane,heights,reason:'open bridge seam'});
      }
    }
    material.dispose();
    return failures;
  });
  expect(failures).toEqual([]);
});

test('the bridge sidewalks clear the hillside and the painted crossings at their landings', async ({ page }) => {
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__ready && window.__dbg);
  const buried = await page.evaluate(() => {
    const { scene, plantingSurface } = window.__dbg;
    const missing = [];
    const ray = new THREE.Raycaster(), down = new THREE.Vector3(0,-1,0);
    const walks = [];
    for (const bank of ['武昌','汉阳']) {
      for (const side of ['左','右']) walks.push([bank+'引道 · '+side+'侧连续步道']);
      walks.push(['鹦鹉洲'+bank+'引道 · 横街人行转角', '鹦鹉洲'+bank+'引道 · 车道线']);
    }
    for (const [name, paintName] of walks) {
      const mesh = scene.getObjectByName(name), paint = paintName && scene.getObjectByName(paintName);
      const {position} = mesh.geometry.attributes, index = mesh.geometry.index;
      const [a,b,c] = Array.from({length:3}, () => new THREE.Vector3());
      const face = new THREE.Triangle(a,b,c), normal = new THREE.Vector3(), center = new THREE.Vector3();
      for (let i=0; i<index.count; i+=3) {
        for (const [j,point] of [a,b,c].entries()) point.fromBufferAttribute(position,index.getX(i+j));
        if (Math.abs(face.getNormal(normal).y)<.85) continue;
        face.getMidpoint(center);
        const grade = plantingSurface(center.x,center.z);
        if (grade == null || center.y < grade-.015) missing.push({name,i,grade,y:center.y});
        if (paint) {
          ray.set(new THREE.Vector3(center.x,65,center.z),down);
          if (ray.intersectObject(paint).length) missing.push({name,i,reason:'curb in crossing'});
        }
      }
    }
    return missing;
  });
  expect(buried).toEqual([]);
});

test('the East Lake greenway follows land around the full lake', async ({ page }) => {
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__ready && window.__dbg);
  const result = await page.evaluate(() => {
    const { scene, LAKES, onLand, plantingSurface } = window.__dbg;
    const points = scene.children.find(node => node.userData.lakeGreenway).geometry.attributes.position;
    const lake = new THREE.Box2().setFromPoints(LAKES[0].map(([x,z]) => new THREE.Vector2(x,z)));
    const route = new THREE.Box2();
    let wet = 0, error = 0;
    for (let i = 0; i < points.count; i++) {
      const j = (i+1) % points.count;
      const x = (points.getX(i)+points.getX(j))/2, z = (points.getZ(i)+points.getZ(j))/2;
      if (!onLand(x,z)) wet++;
      else error = Math.max(error, Math.abs((points.getY(i)+points.getY(j))/2-plantingSurface(x,z)));
      route.expandByPoint(new THREE.Vector2(x,z));
    }
    return { wet, error, extent: route.getSize(new THREE.Vector2()).divide(lake.getSize(new THREE.Vector2())).toArray() };
  });
  expect(result.wet).toBe(0);
  expect(result.error).toBeLessThan(.09);
  for (const size of result.extent) expect(size).toBeGreaterThan(.95);
});
