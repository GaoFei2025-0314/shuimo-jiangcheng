const { test, expect, ready } = require('./fixtures.cjs');

test('city wash centres on the active landmark', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const readWash = () => page.evaluate(async () => {
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    const materials = [...new Set(window.__testScene.children
      .filter(mesh => mesh.name.startsWith('City / '))
      .map(mesh => mesh.material))];
    const uniforms = materials.find(material => material.uniforms.uFocus)?.uniforms;
    if (!uniforms) return null;
    const { uFocus, uFocusRange, uFocusStrength } = uniforms;
    const target = window.__testControls.target;
    return {
      shared: materials.every(({ uniforms }) => uniforms.uFocus === uFocus &&
        uniforms.uFocusRange === uFocusRange && uniforms.uFocusStrength === uFocusStrength),
      error: Math.hypot(uFocus.value.x - target.x, uFocus.value.z - target.z),
      inner: uFocusRange.value.x,
      outer: uFocusRange.value.y,
      strength: uFocusStrength.value
    };
  });

  for (const key of ['tower', 'hongshan', 'guiyuan']) {
    await page.locator('#b-' + key).click();
    const wash = await readWash();
    expect(wash, key + ' has city wash uniforms').not.toBeNull();
    expect(wash.shared, key).toBe(true);
    expect(wash.error, key).toBeLessThan(.5);
    expect(wash.strength, key).toBeGreaterThan(0);
    expect(wash.outer, key).toBeLessThan(200);
  }
  // The outermost building extents are 747 and 741 world units from these targets.
  for (const [key, cityRadius] of [['home', 747], ['core', 741]]) {
    await page.locator('#b-' + key).click();
    expect((await readWash()).inner, key).toBeGreaterThan(cityRadius);
  }

  await page.locator('#atlas-open').click();
  await page.locator('#atlas-walk').click();
  const walk = page.locator('#walk-view');
  const streets = await walk.locator('optgroup[label="街巷近景"] option').evaluateAll(options =>
    options.map(option => option.value));
  expect(streets).toHaveLength(8);
  for (const key of streets) {
    await walk.selectOption(key);
    expect((await readWash()).strength, key).toBe(0);
  }
});

test('ink contours fade with the city focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const readFocus = () => page.evaluate(async () => {
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    const city = window.__testScene.children.find(mesh =>
      mesh.name.startsWith('City / ') && mesh.material.uniforms.uFocus).material.uniforms;
    const print = window.__testInkPrint?.uniforms;
    return {
      shared: ['uFocus', 'uFocusRange', 'uFocusStrength'].every(name => print?.[name] === city[name]),
      strength: print?.uFocusStrength?.value
    };
  });

  await page.locator('#b-hongshan').click();
  const landmark = await readFocus();
  expect(landmark.shared).toBe(true);
  expect(landmark.strength).toBeGreaterThan(0);

  await page.locator('#atlas-open').click();
  await page.locator('#atlas-walk').click();
  await page.locator('#walk-view').selectOption('hy-in');
  expect(await readFocus()).toEqual({ shared: true, strength: 0 });
});

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

test('Wuchang foreground streets reach the desktop overview guide', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__ready && window.__dbg);
  for (const [width, height] of [[1440, 900], [1280, 720]]) {
    await page.setViewportSize({ width, height });
    await page.locator('#b-home').click();
    const gaps = await page.evaluate(async () => {
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      const { scene, camera, WUCHANG, inPoly } = window.__dbg;
      const dockTop = document.querySelector('#dock').getBoundingClientRect().top;
      const batches = new Set(), gaps = [];
      const instance = new THREE.Matrix4(), foot = new THREE.Vector3();
      // Wall, tile and other material parts share the same visible instance buffer.
      for (const mesh of scene.children) {
        if (!mesh.isInstancedMesh || !mesh.visible || !mesh.name.includes('City / ') || batches.has(mesh.instanceMatrix)) continue;
        batches.add(mesh.instanceMatrix);
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, instance);
          foot.setFromMatrixPosition(instance).applyMatrix4(mesh.matrixWorld);
          if (!inPoly(WUCHANG, foot.x, foot.z)) continue;
          foot.project(camera);
          if (Math.abs(foot.x) > 1 || Math.abs(foot.y) > 1 || Math.abs(foot.z) > 1) continue;
          gaps.push(dockTop - (1 - foot.y) * innerHeight / 2);
        }
      }
      return gaps.sort((a, b) => a - b).slice(0, 6);
    });
    // Keep the front row above the guide's hairline, with a whole group of houses close to it.
    expect(gaps, width + 'px').toHaveLength(6);
    expect.soft(gaps[0], width + 'px closest house').toBeGreaterThanOrEqual(8);
    expect.soft(gaps[5], width + 'px sixth closest house').toBeLessThanOrEqual(height * .05);
  }
});

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
  // The album pages turn with the side buttons and the arrow keys, captioned by the selected site.
  await expect(select).toHaveValue('tower');
  await dialog.getByRole('button', { name: '下一处景点' }).click();
  await expect(select).not.toHaveValue('tower');
  await expect(dialog.locator('#atlas-caption-text')).not.toContainText('蛇山西麓');
  await dialog.locator('#atlas-close').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(select).toHaveValue('tower');
  await expect(dialog.locator('#atlas-caption-text')).toContainText('蛇山西麓');
  // Turning from a view button that the next site lacks keeps focus inside the album.
  await select.selectOption('bridge');
  await dialog.locator('#atlas-detail').focus();
  await page.keyboard.press('ArrowRight');
  await expect(select).toHaveValue('qc');
  await expect(dialog.locator('#atlas-detail')).toBeHidden();
  expect(await page.evaluate(() => {
    const el = document.activeElement;
    return !!el.closest('#atlas') && el.checkVisibility();
  })).toBe(true);
  await select.selectOption('tower');
  for (const key of keys) {
    await select.selectOption(key);
    // 水墨图会替换原始 JPEG；待成图就位后核对解码与实际分辨率。
    await expect(image).toHaveAttribute('src', /^blob:/);
    await image.evaluate(image => image.decode());
    expect(await image.evaluate(image => image.naturalWidth)).toBeGreaterThanOrEqual(1000);
    if (key === 'tower' || key === 'bridge') {
      const before = await image.getAttribute('alt');
      await dialog.locator('#atlas-detail').click();
      await expect(image).toHaveAttribute('src', /^blob:/);
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

test('both bridge craft plates locate their modelled joints in desktop and portrait views', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const dialog = page.getByRole('dialog', { name: '建筑图录' });
  const bridges = [
    { key: 'bridge', label: '铸铁栏花', at: [5.90, 12.57, 49.80435] },
    { key: 'yingwuzhou', label: '主缆与吊杆', at: [7.40, 10.6, 34] }
  ];
  for (const { key, label, at } of bridges) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('#b-'+key).click();
    await page.locator('#atlas-open').click();
    await dialog.getByRole('button', { name: '看'+label }).click();
    await expect(dialog.getByRole('img')).toHaveAttribute('alt', new RegExp(label+'$'));
    expect(await dialog.getByRole('img').evaluate(async img => {
      await img.decode();
      return img.naturalWidth;
    })).toBeGreaterThanOrEqual(1000);
    await dialog.getByRole('button', { name: '看桥名' }).click();
    await expect(dialog.getByRole('img')).toHaveAttribute('alt', /桥名题字$/);
    await dialog.getByRole('button', { name: '看'+label }).click();
    await dialog.getByRole('button', { name: '在地图中看构件' }).click();
    await expect(page.locator('#labels')).toBeHidden();
    await expect(page.locator('#title')).toBeHidden();
    await expect(page.locator('#poem')).toBeHidden();
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const pose = await page.evaluate(async ({key, at}) => {
        await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
        const model = window.__testScene.children.find(o => o.userData.modelKey === key);
        const target = model.localToWorld(new THREE.Vector3(...at));
        const distance = target.distanceTo(window.__testControls.target);
        const camera = window.__testCamera;
        const ndc = target.project(camera);
        // The middle pair in this main span runs from the clamp to the edge-girder plate.
        const ends = key === 'yingwuzhou' ? [[7.34, 11.4, 35.75], [7.69, 7.50, 35.75]] : [at];
        const blocks = ['#title', '#poem', '#dock'].map(id => document.querySelector(id).getBoundingClientRect());
        const clear = ends.every(point => {
          const screen = model.localToWorld(new THREE.Vector3(...point)).project(camera);
          const x = (1+screen.x)*innerWidth/2, y = (1-screen.y)*innerHeight/2;
          return Math.abs(screen.x)<1 && Math.abs(screen.y)<1 &&
            blocks.every(rect => x<rect.left || x>rect.right || y<rect.top || y>rect.bottom);
        });
        return { distance, visible: Math.abs(ndc.z)<1 && clear };
      }, { key, at: key === 'yingwuzhou' && viewport.width > viewport.height ? [7.40, 10.3, 34] : at });
      expect(pose.distance).toBeLessThan(.01);
      expect(pose.visible).toBe(true);
    }
    await page.locator('#atlas-open').click();
    await expect(dialog.locator('#atlas-craft')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await page.locator('#b-'+key).click();
    await page.locator('#atlas-open').click();
    await expect(dialog.getByRole('img')).toHaveAttribute('alt', /建筑全貌$/);
    await expect(page.locator('#labels')).toBeVisible();
    await expect(page.locator('#title')).toBeVisible();
    await page.keyboard.press('Escape');
  }
});

test('both inscribed bridge names are legible in the atlas and on the physical models', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  for (const [width, height] of [[1440,900], [390,844]]) {
    await page.setViewportSize({ width, height });
    for (const [key, name] of [['bridge','武汉长江大桥'], ['yingwuzhou','鹦鹉洲长江大桥']]) {
      await page.locator('#b-'+key).click();
      await page.locator('#atlas-open').click();
      await page.getByRole('button', { name: '看桥名', exact: true }).click();
      await expect(page.locator('#atlas-note')).toBeVisible({ visible: key === 'bridge' });
      const plate = page.locator('#atlas-plate');
      await expect(plate).toHaveAttribute('alt', name+' · 桥名题字');
      expect(await plate.evaluate(async img => { await img.decode(); return img.naturalWidth; })).toBeGreaterThanOrEqual(1000);
      await page.getByRole('button', { name: '在地图中看桥名' }).click();
      const glyphPixels = await page.evaluate(async ({ key, count }) => {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const scene = window.__testScene, camera = window.__testCamera, renderer = window.__testRenderer;
        const model = scene.children.find(o => o.userData.modelKey === key);
        const steel = key === 'bridge', center = steel ? new THREE.Vector3(11.98,10.19,-82) : new THREE.Vector3(0,33.24,1.51);
        // Find the raised lettering by its actual face plane, independently of material batches.
        const facePoints = mesh => {
          const vertices = mesh.geometry.attributes.position, letters = new THREE.Box3();
          const p = new THREE.Vector3(); let hits = 0;
          for (let i=0; i<vertices.count; i++) {
            p.fromBufferAttribute(vertices,i);
            const normalOffset = steel ? p.x-center.x : p.z-center.z;
            const lateral = steel ? p.z-center.z : p.x-center.x;
            if (Math.abs(normalOffset)>.045 || Math.abs(lateral)>(steel ? 2.1 : 5.4) || Math.abs(p.y-center.y)>(steel ? .32 : .61)) continue;
            letters.expandByPoint(p); hits++;
          }
          return { mesh, letters, hits };
        };
        const {mesh, letters, hits} = model.children.map(facePoints).sort((a,b) => b.hits-a.hits)[0];
        if (hits < 100) throw Error('Missing raised lettering on '+key);
        const w = Math.round(innerWidth*.65), h = Math.round(innerHeight*.65);
        const target = new THREE.WebGLRenderTarget(w,h), previous = renderer.getRenderTarget();
        function frame() {
          renderer.render(scene,camera);
          const pixels = new Uint8Array(w*h*4);
          renderer.readRenderTargetPixels(target,0,0,w,h,pixels);
          return pixels;
        }
        try {
          renderer.setRenderTarget(target);
          const actual = frame();
          mesh.visible = false;
          const plain = frame();
          const min = new THREE.Vector2(Infinity,Infinity), max = new THREE.Vector2(-Infinity,-Infinity);
          for (const x of [letters.min.x,letters.max.x]) for (const y of [letters.min.y,letters.max.y]) for (const z of [letters.min.z,letters.max.z]) {
            const p = model.localToWorld(new THREE.Vector3(x,y,z)).project(camera);
            const px = new THREE.Vector2((p.x+1)*w/2,(p.y+1)*h/2); min.min(px); max.max(px);
          }
          if (min.x<0 || min.y<0 || max.x>w || max.y>h) throw Error('Inscription outside the viewport');
          const columns = Array(count).fill(0);
          for (let y=Math.ceil(min.y); y<max.y; y++) for (let x=Math.ceil(min.x); x<max.x; x++) {
            const offset = (y*w+x)*4;
            if (Math.abs(actual[offset+1]-plain[offset+1])>20)
              columns[Math.floor((x-min.x)*count/(max.x-min.x))]++;
          }
          return columns;
        } finally {
          mesh.visible = true;
          renderer.setRenderTarget(previous);
          target.dispose();
        }
      }, { key, count: name.length });
      expect(Math.min(...glyphPixels)).toBeGreaterThan(8);
      await page.locator('#b-'+key).click();
      await page.locator('#atlas-open').click();
      await expect(page.locator('#atlas-name')).toHaveAttribute('aria-pressed','false');
      await page.keyboard.press('Escape');
    }
  }
});

test('the sun stays above the map horizon while orbiting and fades in overhead views', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  for (const [width,height] of [[1456,788],[390,844],[844,390]]) {
    await page.setViewportSize({width,height});
    await page.locator('#b-qc').click();
    const samples = await page.evaluate(async () => {
      const camera = window.__testCamera, controls = window.__testControls;
      controls.dispatchEvent({type:'start'});
      const sun = document.getElementById('sun'), ray = new THREE.Raycaster();
      const results = [];
      for (const [pitch,yaw,distance] of [[6,-30,130],[11,70,580],[14,-130,330],[55,50,750],[6,135,560]]) {
        const direction = new THREE.Vector3().setFromSphericalCoords(distance,
          THREE.MathUtils.degToRad(90-pitch), THREE.MathUtils.degToRad(yaw));
        camera.position.copy(controls.target).add(direction);
        controls.update();
        await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
        const {x,width,bottom} = sun.getBoundingClientRect();
        ray.setFromCamera(new THREE.Vector2((x+width/2)/innerWidth*2-1, 1-bottom/innerHeight*2),camera);
        results.push({alpha:Number(getComputedStyle(sun).opacity), bottomRayY:ray.ray.direction.y});
      }
      return results;
    });
    expect(samples[0].alpha).toBeGreaterThan(.45);
    for (const sample of samples.filter(s=>s.alpha>0)) expect(sample.bottomRayY).toBeGreaterThan(0);
    expect(samples[3].alpha).toBe(0);
    expect(samples[4].alpha).toBeGreaterThan(.45);
  }
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

test('bridgehead roofs stay opaque from above and fade when the camera passes close', async ({ page }) => {
  await ready(page);
  const covered = await page.evaluate(() => {
    const renderer = window.__testRenderer;
    const roof = window.__testScene.children.find(n => n.name === 'City / lane');
    const material = roof.material.clone();
    const tile = new THREE.PlaneGeometry(8,8).rotateX(-Math.PI/2);
    tile.setAttribute('skyVisibility', new THREE.Float32BufferAttribute([1,1,1,1],1));
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(tile, material));
    const camera = new THREE.OrthographicCamera(-3,3,3,-3,.1,100);
    camera.up.set(0,0,-1);
    const target = new THREE.WebGLRenderTarget(16,16);
    const original = renderer.getRenderTarget();
    const color = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
    try {
      renderer.setRenderTarget(target);
      renderer.setClearColor(0,0);
      return [55,18,10,4].map(height => {
        camera.position.set(0,height,0);
        camera.lookAt(0,0,0);
        material.uniforms.uCam.value.copy(camera.position);
        renderer.clear();
        renderer.render(scene,camera);
        const pixels = new Uint8Array(16*16*4);
        renderer.readRenderTargetPixels(target,0,0,16,16,pixels);
        return pixels.filter((v,i) => i%4 === 3 && v === 255).length;
      });
    } finally {
      renderer.setRenderTarget(original);
      renderer.setClearColor(color,alpha);
      target.dispose(); tile.dispose(); material.dispose();
    }
  });
  expect(covered.slice(0,2)).toEqual([256,256]);
  expect(covered[2]).toBeGreaterThan(90);
  expect(covered[2]).toBeLessThan(185);
  expect(covered[3]).toBe(0);
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

test('manual close views stay low on waterfront landings and back lanes and rise away from them', async ({ page }) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__dbg && window.__ready);
  const result = await page.evaluate(async () => {
    const {camera, controls, plantingSurface} = __dbg;
    const frame = () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    async function clearance(x,z) {
      const ground = plantingSurface(x,z) ?? 0;
      controls.dispatchEvent({type:'start'});
      controls.target.set(x,ground-2,z-24);
      camera.position.set(x,ground+.7,z);
      controls.update();
      controls.dispatchEvent({type:'end'});
      await frame();
      return camera.position.y-ground;
    }
    const levels = [];
    for (const [x,z] of [[-203.6,54.5],[-197.6,40.1],[-189.1,23.6],[-89.1,112.8],[-87,92.3],[-81.7,61.2]]) {
      levels.push(await clearance(x,z));
    }
    const transition = await clearance(-209.6,40.1);
    for (const [x,z] of [[-226.1,29.3],[-47.0,68.5]]) levels.push(await clearance(x,z));
    const fade = __dbg.scene.getObjectByName('City / lane').material.uniforms.uFade.value.toArray();
    const inland = await clearance(-223,61);
    __dbg.flyTo('core');
    await frame();
    return {levels, transition, inland, fade, overview:camera.position.y};
  });
  for (const height of result.levels) {
    expect(height).toBeGreaterThan(1.8);
    expect(height).toBeLessThan(3);
  }
  expect(result.transition).toBeGreaterThan(3);
  expect(result.transition).toBeLessThan(7);
  expect(result.inland).toBeCloseTo(7,1);
  expect(result.fade[1]).toBeLessThan(3);
  expect(result.overview).toBeGreaterThan(60);
});

test('street trees and houses leave the bridgehead and waterfront views open', async ({ page }) => {
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__ready && window.__dbg);
  const blocked = await page.evaluate(() => {
    const {scene} = __dbg;
    // Surveyed points on the near pavilion eaves and the orange tower crowns.
    const landmarks = [
      ['武昌引道 · 接地铺装',[-60.561,12.635,-19.678]],
      ['汉阳引道 · 接地铺装',[-147.981,12.635,-67.468]],
      ['鹦鹉洲武昌引道 · 车行面',[-97.819,32.275,131.607]],
      ['鹦鹉洲汉阳引道 · 车行面',[-208.224,32.275,102.028]]
    ];
    const rays = landmarks.flatMap(([name,target]) => {
      const road = scene.getObjectByName(name);
      const p = road.geometry.attributes.position;
      return [p.count-2,p.count-1].map(i => {
        const eye = road.localToWorld(new THREE.Vector3().fromBufferAttribute(p,i));
        eye.y += .16;
        const direction = new THREE.Vector3(...target).sub(eye);
        return {name, caster:new THREE.Raycaster(eye,direction.clone().normalize(),0,direction.length())};
      });
    });
    // From the first tread at either end of each promenade, see the river and the two spans.
    for (const bank of ['汉阳','武昌']) for (const landing of [1,3]) {
      const name = bank+'滨水亲水石阶 '+landing;
      const p = scene.getObjectByName(name).geometry.attributes.position;
      const eye = new THREE.Vector3().fromBufferAttribute(p,0)
        .lerp(new THREE.Vector3().fromBufferAttribute(p,1),.5);
      eye.y += 1.55;
      for (const target of [[-60.561,12.635,-19.678],[-97.819,32.275,131.607],[-143,0,60]]) {
        const direction = new THREE.Vector3(...target).sub(eye);
        rays.push({name,caster:new THREE.Raycaster(eye,direction.clone().normalize(),0,direction.length())});
      }
    }
    const face = new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
    const sphere = new THREE.Sphere(), hits = [];
    for (const batch of scene.children) {
      const matrices = batch.userData.authoredMatrices;
      if (!matrices || !(batch.userData.vegetation || batch.name.startsWith('City / '))) continue;
      const proxy = new THREE.Mesh(batch.geometry,face);
      batch.geometry.computeBoundingSphere();
      for (let i=0; i<matrices.length; i+=16) {
        proxy.matrixWorld.fromArray(matrices,i).premultiply(batch.matrixWorld);
        sphere.copy(batch.geometry.boundingSphere).applyMatrix4(proxy.matrixWorld);
        for (const {name,caster} of rays) {
          if (caster.ray.intersectsSphere(sphere) && caster.intersectObject(proxy).length)
            hits.push({name,object:batch.name});
        }
      }
    }
    face.dispose();
    return hits;
  });
  expect(blocked).toEqual([]);
});

test('all four bridge approaches meet the receiving street at full width and level grade', async ({ page }) => {
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__ready && window.__dbg);
  const mouths = await page.evaluate(() => {
    const {scene,cityGround,plantingSurface} = window.__dbg;
    return [
      ['武昌引道 · 接地铺装','蛇山脚坡街与首义街口'],
      ['汉阳引道 · 接地铺装','汉阳桥头至翠微巷'],
      ['鹦鹉洲汉阳引道 · 车行面','马鹦路与鹦鹉大道路口'],
      ['鹦鹉洲武昌引道 · 车行面','复兴路街口']
    ].map(([road,street]) => {
      const mesh = scene.getObjectByName(road);
      const p = mesh.geometry.attributes.position;
      const vertex = i => mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(p,i));
      const left = vertex(p.count-2), right = vertex(p.count-1);
      const end = left.clone().lerp(right,.5);
      const prior = vertex(p.count-4).lerp(vertex(p.count-3),.5);
      const receiving = cityGround.streets.find(s => s.name === street);
      const dx = receiving.b.x-receiving.a.x, dz = receiving.b.z-receiving.a.z;
      const length = Math.hypot(dx,dz);
      const along = end.clone().sub(prior);
      return {road, gap:Math.hypot(end.x-receiving.a.x,end.z-receiving.a.z),
        widthError:Math.abs(left.distanceTo(right)-receiving.width),
        skew:Math.abs((left.x-right.x)*dx+(left.z-right.z)*dz)/(length*receiving.width),
        grade:Math.abs(along.y)/Math.hypot(along.x,along.z),
        elevation:Math.abs(end.y-plantingSurface(end.x,end.z))};
    });
  });
  for (const m of mouths) {
    expect(m.gap,m.road).toBeLessThan(.05);
    expect(m.widthError,m.road).toBeLessThan(.12);
    expect(m.skew,m.road).toBeLessThan(.15);
    expect(m.grade,m.road).toBeLessThan(.025);
    expect(m.elevation,m.road).toBeLessThan(.16);
  }
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
      const abutment = scene.getObjectByName('鹦鹉洲'+bank+'引道 · 桥台端墙');
      const wall = new THREE.Mesh(abutment.geometry,material);
      for (const x of [-5,0,5]) {
        // On the ramp side of the joint, the end wall must stay beneath the asphalt.
        ray.set(group.localToWorld(new THREE.Vector3(x,25,sign*100.48)),down);
        const top = ray.intersectObject(wall)[0], surface = ray.intersectObject(approach)[0];
        if (!top || !surface || surface.point.y-top.point.y < .12)
          failures.push({bank,x,reason:'abutment reaches the travel surface'});
      }
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

test('each riverfront walk joins both bridgeheads and a neighborhood street on dry, clear paving', async ({ page }) => {
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__ready && window.__dbg);
  const problems = await page.evaluate(() => {
    const {scene,cityGround,onLand,plantingSurface} = __dbg;
    const material = new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
    const ray = new THREE.Raycaster(), down = new THREE.Vector3(0,-1,0);
    const issues = [];
    const gap = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
    const segments = name => cityGround.streets.filter(s => s.name===name);
    for (const bank of ['汉阳','武昌']) {
      const names = ['两桥滨水步道','大桥桥头接岸步道','鹦鹉洲桥头接岸步道','滨水通街支巷'].map(s => bank+s);
      const [waterfront,wuhan,orange,lane] = names.map(segments);
      if (![waterfront,wuhan,orange,lane].every(s => s.length>2)) {
        issues.push({bank,reason:'missing path'});
        continue;
      }
      const joins = [
        gap(waterfront.at(-1).b,wuhan.at(-1).b),
        gap(waterfront[0].a,orange.at(-1).b),
        Math.min(...waterfront.map(s=>gap(s.a,lane[0].a))),
      ];
      const street = segments(bank+'桥间街道');
      const toStreet = Math.min(...street.map(s => {
        const line = new THREE.Line3(new THREE.Vector3(s.a.x,0,s.a.z),new THREE.Vector3(s.b.x,0,s.b.z));
        const end = new THREE.Vector3(lane.at(-1).b.x,0,lane.at(-1).b.z);
        return line.closestPointToPoint(end,true,new THREE.Vector3()).distanceTo(end)-s.width/2;
      }));
      if (joins.some(n=>n>.06) || toStreet>.05) issues.push({bank,joins,toStreet});
      for (const name of names) {
        const path = segments(name);
        const surface = new THREE.Mesh(scene.getObjectByName(name).geometry,material);
        for (const [i,{a,b,width}] of path.entries()) {
          if (i && gap(a,path[i-1].b)>.06) issues.push({name,i,reason:'missing span'});
          const length=gap(a,b);
          for (const side of [-.37,0,.37]) {
            const x=(a.x+b.x)/2+(b.z-a.z)*width*side/length;
            const z=(a.z+b.z)/2-(b.x-a.x)*width*side/length;
            ray.set(new THREE.Vector3(x,65,z),down);
            const hit=ray.intersectObject(surface)[0];
            if (!onLand(x,z) || !hit || hit.point.y<plantingSurface(x,z)-.015 || cityGround.occupied(x,z))
              issues.push({name,i,side,reason:'unusable paving'});
          }
        }
      }
    }
    material.dispose();
    return issues.slice(0,16);
  });
  expect(problems).toEqual([]);
});

test('the tea stall and courtyard entrances meet the riverside lanes at walking grade', async ({ page }) => {
  const shaderErrors = [];
  page.on('console', message => {
    if (message.type()==='error' && /shader|WebGLProgram/i.test(message.text())) shaderErrors.push(message.text());
  });
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__ready && window.__dbg);
  const error = await page.evaluate(() => {
    const {scene,cityGround} = __dbg;
    const issues = [], ray = new THREE.Raycaster();
    const material = new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
    const walks = scene.children.filter(mesh => mesh.geometry?.getAttribute('walkEdge'));
    if (walks.length !== 8) issues.push('expected two promenades, four bridge links and two cross lanes');
    for (const walk of walks) {
      const side = walk.geometry.getAttribute('walkEdge');
      const samples = new Set(side.array);
      if (side.count !== walk.geometry.getAttribute('position').count ||
          ![-1,0,1].every(value => samples.has(value))) issues.push(walk.name);
    }
    const down = new THREE.Vector3(0,-1,0);
    for (const [bank,frontage] of [['汉阳','汉阳茶案前埕接支巷'],['武昌','武昌里分门前石径接支巷']]) {
      const pathName = bank+'滨水通街支巷';
      const road = new THREE.Mesh(scene.getObjectByName(pathName).geometry,material);
      const porch = scene.getObjectByName(frontage);
      const p = porch.geometry.getAttribute('position');
      const lip = new THREE.Vector3().fromBufferAttribute(p,p.count-2)
        .lerp(new THREE.Vector3().fromBufferAttribute(p,p.count-1),.5);
      ray.set(lip.clone().addScaledVector(down,-2),down);
      const hit = ray.intersectObject(road)[0];
      if (!hit || Math.abs(lip.y-hit.point.y)>.025 || cityGround.occupied(lip.x,lip.z))
        issues.push(frontage);
    }
    material.dispose();
    return issues;
  });
  expect(error).toEqual([]);
  expect(shaderErrors).toEqual([]);
});

test('back lane paving reaches the occupied doorways, through lane and old street at walking grade', async ({ page }) => {
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__ready && window.__dbg);
  const errors = await page.evaluate(() => {
    const {scene,cityGround,onLand,plantingSurface} = __dbg;
    const joins = [
      ['茶棚后院接汉阳滨水支巷',[-225.55,24.03],'汉阳滨水通街支巷'],
      ['汉阳沿巷小院过门石径',[-222.40,42.13],'汉阳滨水通街支巷'],
      ['汉阳后排里分入巷石径',[-234.95,45.88],'汉阳滨水通街支巷'],
      ['武昌后巷绕屋接旧街','武昌滨水通街支巷','City streets'],
      ['武昌里分门前石径接支巷','武昌后巷绕屋接旧街','武昌滨水通街支巷'],
      ['武昌公寓门前转入后巷',[-42.11,74.60],'武昌后巷绕屋接旧街'],
      ['武昌灰瓦里分门前接旧街',[-36.16,55.87],'City streets'],
    ];
    const issues=[], ray=new THREE.Raycaster(), down=new THREE.Vector3(0,-1,0);
    const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
    for (const [name,begin,end] of joins) {
      const positions=scene.getObjectByName(name)?.geometry.attributes.position;
      if (!positions) { issues.push(name+' missing'); continue; }
      for (let i=0; i<positions.count; i+=2) {
        const a=new THREE.Vector3().fromBufferAttribute(positions,i);
        const b=new THREE.Vector3().fromBufferAttribute(positions,i+1);
        if (a.distanceTo(b)<.9 || [a,b].some(p=>!onLand(p.x,p.z) || p.y < plantingSurface(p.x,p.z))) {
          issues.push(name+' buried or too narrow');
          break;
        }
        if (i!==0 && i!==positions.count-2) continue;
        const center=a.lerp(b,.5), join=i===0 ? begin : end;
        if (Array.isArray(join)) {
          if (Math.hypot(center.x-join[0],center.z-join[1])>.25) issues.push(name+' misses door');
        } else {
          ray.set(center.clone().addScaledVector(down,-2),down);
          const road=new THREE.Mesh(scene.getObjectByName(join).geometry,material);
          const hit=ray.intersectObject(road)[0];
          if (!hit || Math.abs(hit.point.y-center.y)>.05) issues.push(name+' misses '+join);
        }
      }
    }
    const passage=cityGround.courtyardPaths.filter(segment=>segment.name==='武昌里分门后纵巷');
    if (!passage.length || passage.some(({a,b})=>cityGround.occupied((a.x+b.x)/2,(a.z+b.z)/2)))
      issues.push('the lane behind the Wuchang gate must remain open through the block');
    material.dispose();
    return issues;
  });
  expect(errors).toEqual([]);
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

test('vessels clear the banks, sit in the water and carry their wakes through each loop', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__ready && window.__dbg);
  const metrics = await page.evaluate(() => {
    const { vessels, updateVessels, scene, onLand } = window.__dbg;
    const { uBoats, uBoatWake } = scene.children.find(o => o.material?.uniforms?.uBoatWake).material.uniforms;
    return vessels.map(({ model, route, speed, phase, scale }, i) => {
      const period = route.getLength() / speed;
      const hull = model.children.find(part => Array.isArray(part.material));
      const vertices = hull.geometry.attributes.position;
      const data = model.userData.vessel, centre = new THREE.Vector3(), bow = new THREE.Vector3();
      let touchesLand = false, maxKeel = -Infinity, minDeck = Infinity;
      let maxOriginError = 0, minFacing = 1, maxSternError = 0;
      for (let step = 0; step < 80; step++) {
        const time = period * (step / 80 - phase);
        updateVessels(time);
        model.updateMatrixWorld(true);
        let keel = Infinity, deck = -Infinity;
        for (let n = 0; n < vertices.count; n++) {
          const y = bow.fromBufferAttribute(vertices, n).applyMatrix4(hull.matrixWorld).y;
          keel = Math.min(keel, y);
          deck = Math.max(deck, y);
        }
        maxKeel = Math.max(maxKeel, keel);
        minDeck = Math.min(minDeck, deck);
        for (const x of [data.stern, 0, data.bow]) for (const z of [-data.beam/2, data.beam/2]) {
          bow.set(x, 0, z).applyMatrix4(model.matrixWorld);
          touchesLand ||= onLand(bow.x, bow.z);
        }
        const wake = uBoatWake.value[i], origin = uBoats.value[i];
        maxOriginError = Math.max(maxOriginError, Math.hypot(origin.x-model.position.x, origin.y-model.position.z));
        maxSternError = Math.max(maxSternError, Math.abs(wake.z + data.stern * scale));
        centre.copy(model.position);
        const dx = wake.x, dz = wake.y;
        updateVessels(time + .02);
        bow.copy(model.position).sub(centre);
        bow.y = 0;
        bow.normalize();
        minFacing = Math.min(minFacing, bow.x*dx + bow.z*dz);
      }
      // Check the actual moving model on both sides of the route's wrap.
      updateVessels(period * (1 - phase) - .015);
      centre.copy(model.position);
      updateVessels(period * (1 - phase) + .015);
      return { type: data.type, touchesLand, maxKeel, minDeck, maxOriginError, minFacing, maxSternError,
        seamDistance: centre.distanceTo(model.position), wakeLength: uBoatWake.value[i].w };
    });
  });
  expect(metrics.map(v => v.type).sort()).toEqual(['cargo','cargo','ferry','ferry','lakeLaunch','lakeLaunch']);
  for (const ship of metrics) {
    expect(ship.touchesLand).toBe(false);
    expect(ship.maxKeel).toBeLessThan(-.1);
    expect(ship.minDeck).toBeGreaterThan(.1);
    expect(ship.minFacing).toBeGreaterThan(.99);
    expect(ship.maxOriginError).toBeLessThan(.001);
    expect(ship.maxSternError).toBeLessThan(.001);
    expect(ship.seamDistance).toBeLessThan(.06);
    expect(ship.wakeLength).toBeGreaterThan(0);
  }
});

test('all eight Yangtze Bridge piers split the water locally and fade in the overview', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const result = await page.evaluate(() => {
    const renderer = window.__testRenderer, scene = window.__testScene;
    const bridge = scene.children.find(node => node.userData.modelKey === 'bridge');
    const water = scene.children.find(node => node.material?.uniforms?.uCutwaterRow);
    const row = water.material.uniforms.uCutwaterRow.value, originalX = row.x;
    const flow = water.material.uniforms.uCutwaterFlow.value;
    const center = bridge.getWorldPosition(new THREE.Vector3());
    const waterOnly = new THREE.Scene();
    waterOnly.add(water.clone());
    const camera = new THREE.OrthographicCamera(-66,66,66,-66,.1,600);
    camera.up.set(0,0,-1);
    const size = 384, target = new THREE.WebGLRenderTarget(size,size);
    const previous = renderer.getRenderTarget();
    function differences(height) {
      camera.position.set(center.x,height,center.z);
      camera.lookAt(center.x,0,center.z);
      function frame() {
        const pixels = new Uint8Array(size*size*4);
        renderer.render(waterOnly,camera);
        renderer.readRenderTargetPixels(target,0,0,size,size,pixels);
        return pixels;
      }
      row.x = originalX;
      const painted = frame();
      row.x = 1e5;
      const plain = frame();
      return Int16Array.from({length:size*size}, (_,i) => painted[i*4]-plain[i*4]);
    }
    try {
      renderer.setRenderTarget(target);
      const near = differences(65), far = differences(320);
      // Test small patches around the actual ends of each modelled pier, in world space.
      function visibleNear(point, radius, sign) {
        const x = Math.floor((.5+(point.x-center.x)/132)*size);
        const y = Math.floor((.5-(point.z-center.z)/132)*size);
        const reach = Math.ceil(radius*size/132);
        for (let dy=-reach; dy<=reach; dy++) for (let dx=-reach; dx<=reach; dx++) {
          if (dx*dx+dy*dy <= reach*reach && near[(y+dy)*size+x+dx]*sign >= 2) return true;
        }
        return false;
      }
      const piers = Array.from({length:8}, (_,i) => {
        const ends = [-1,1].map(sign => bridge.localToWorld(new THREE.Vector3(sign*6.3*1.06,0,-56+i*16)));
        ends.sort((a,b) => (a.x-b.x)*flow.x+(a.z-b.z)*flow.y);
        const downstream = ends[1].add(new THREE.Vector3(3*flow.x,0,3*flow.y));
        return visibleNear(ends[0],2.5,1) && visibleNear(downstream,2.5,-1);
      });
      return { piers, distant: far.some(delta => delta !== 0) };
    } finally {
      row.x = originalX;
      renderer.setRenderTarget(previous);
      target.dispose();
    }
  });
  expect(result.piers).toEqual(Array(8).fill(true));
  expect(result.distant).toBe(false);
});

test('Qingchuan rock tips touch the river and catch a quiet broken waterline', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const result = await page.evaluate(() => {
    const renderer = window.__testRenderer, scene = window.__testScene;
    const water = scene.children.find(o => o.material?.uniforms?.uDrift);
    const { uQuaySpurs, uQuayOut, uTime } = water.material.uniforms;
    const rocks = uQuaySpurs.value, middle = rocks[1], center = middle.clone();
    const width = 56, size = 336, half = width / 2;
    const camera = new THREE.OrthographicCamera(-half, half, half, -half, .1, 500);
    camera.up.set(0, 0, -1);
    const target = new THREE.WebGLRenderTarget(size, size);
    const previous = renderer.getRenderTarget(), originalTime = uTime.value;
    // Render the full scene so a stroke hidden by dry ground or rock does not count.
    function exposedStrokes(height, seconds) {
      camera.position.set(center.x, height, center.y);
      camera.lookAt(center.x, 0, center.y);
      uTime.value = seconds;
      function frame() {
        const rgba = new Uint8Array(size * size * 4);
        renderer.render(scene, camera);
        renderer.readRenderTargetPixels(target, 0, 0, size, size, rgba);
        return rgba;
      }
      const painted = frame();
      middle.x += 1000;
      const plain = frame();
      middle.x = center.x;
      return Int16Array.from({ length: size * size }, (_, i) => painted[4*i] - plain[4*i]);
    }
    try {
      renderer.setRenderTarget(target);
      const start = exposedStrokes(70, 0), glance = exposedStrokes(70, 1.6);
      const settled = exposedStrokes(70, 12), distant = exposedStrokes(240, 0);
      const counts = rocks.map(rock => {
        let dark = 0, light = 0;
        for (let i = 0; i < start.length; i++) {
          const dx = ((i % size + .5) / size - .5) * width + center.x - rock.x;
          const dz = (.5 - (Math.floor(i / size) + .5) / size) * width + center.y - rock.y;
          const outward = dx * uQuayOut.value.x + dz * uQuayOut.value.y;
          const along = -dx * uQuayOut.value.y + dz * uQuayOut.value.x;
          if (outward < 0 || outward > rock.w + 2 || Math.abs(along) > rock.z * 1.4) continue;
          if (start[i] <= -2) dark++;
          if (start[i] >= 2) light++;
        }
        return { dark, light };
      });
      const change = next => next.reduce((sum, value, i) => sum + Math.abs(value - start[i]), 0);
      return { counts, glance: change(glance), settled: change(settled), distant: distant.some(Boolean) };
    } finally {
      middle.x = center.x;
      uTime.value = originalTime;
      renderer.setRenderTarget(previous);
      target.dispose();
    }
  });
  for (const patch of result.counts) {
    expect(patch.dark).toBeGreaterThan(2);
    expect(patch.light).toBeGreaterThan(2);
  }
  expect(result.glance).toBeLessThan(result.settled);
  expect(result.distant).toBe(false);
});
