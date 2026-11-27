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

async function sunAtRidge(page) {
  return page.evaluate(() => {
    const sun = document.getElementById('sun'), rect = sun.getBoundingClientRect();
    const ridge = window.__dbg.farHills.ridgeTopAt(rect.x + rect.width / 2);
    return { visible: Number(getComputedStyle(sun).opacity) > 0, bottom: rect.bottom, limit: ridge + .15 * rect.height };
  });
}

test('the cinnabar sun clears the far ridges', async ({ page }) => {
  await openMap(page);
  for (const [width, height] of [[1456,788], [390,844], [844,390]]) {
    await page.setViewportSize({ width, height });
    await page.locator('#b-qc').click();
    let visible = 0;
    for (const [pitch, yaw, distance] of [[6,-30,130], [11,70,580], [14,-130,330]]) {
      await orbit(page, pitch, yaw, distance);
      const sun = await sunAtRidge(page);
      if (!sun.visible) continue;
      visible++;
      expect(sun.bottom).toBeLessThanOrEqual(sun.limit);
    }
    expect(visible).toBeGreaterThan(0);
  }
});

test('resizing reflows the hills and sun at once', async ({ page }) => {
  await openMap(page);
  await page.locator('#b-qc').click();
  await orbit(page, 11, 70, 580);
  await page.setViewportSize({ width: 390, height: 844 });
  const result = await page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const { farHills, camera, controls } = window.__dbg;
    const before = farHills.ridgeTopAt(195), sun = document.getElementById('sun');
    const direction = camera.getWorldDirection(new THREE.Vector3());
    direction.y = 0;
    const point = direction.normalize().multiplyScalar(1e5).add(camera.position).project(camera);
    const horizonY = (1 - point.y) * innerHeight / 2;
    const fit = THREE.MathUtils.clamp((horizonY - 8) / (sun.offsetTop + sun.offsetHeight), 0, 1);
    farHills.update({ horizonY, azimuth: controls.getAzimuthalAngle(), fit, streetView: 0, width: innerWidth, height: innerHeight, sunDiameter: sun.offsetHeight });
    return { before, after: farHills.ridgeTopAt(195) };
  });
  expect(Number.isFinite(result.before)).toBe(true);
  expect(result.before).toBeCloseTo(result.after, 3);
  const sun = await sunAtRidge(page);
  expect(sun.visible).toBe(true);
  expect(sun.bottom).toBeLessThanOrEqual(sun.limit);
});

test('near ridges rise as a middle distance and stay out of the rivers', async ({ page }) => {
  await openMap(page);
  const ridges = await page.evaluate(() => {
    const { scene, YZ, HAN } = window.__dbg;
    const segments = [YZ, HAN].flatMap(river => river.s.slice(1).map((b, i) => {
      const a = river.s[i], dx = b.p.x - a.p.x, dz = b.p.z - a.p.z;
      const margin = Math.max(a.w, b.w);
      return { a, b, dx, dz, lengthSq: dx * dx + dz * dz,
        left: Math.min(a.p.x, b.p.x) - margin, right: Math.max(a.p.x, b.p.x) + margin,
        top: Math.min(a.p.z, b.p.z) - margin, bottom: Math.max(a.p.z, b.p.z) + margin };
    }));
    let height = 0, peak = 0, inRiver = 0, riverTop = -Infinity;
    const point = new THREE.Vector3();
    scene.traverse(mesh => {
      if (mesh.userData.landscapeSurface?.group !== '远山') return;
      const box = new THREE.Box3().setFromObject(mesh);
      height = Math.max(height, box.max.y - box.min.y);
      peak = Math.max(peak, box.max.y);
      const vertices = mesh.geometry.attributes.position;
      for (let i = 0; i < vertices.count; i++) {
        point.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld);
        for (const { a, b, dx, dz, lengthSq, left, right, top, bottom } of segments) {
          if (point.x < left || point.x > right || point.z < top || point.z > bottom) continue;
          const x = point.x - a.p.x, z = point.z - a.p.z;
          const t = THREE.MathUtils.clamp((x * dx + z * dz) / lengthSq, 0, 1);
          if (Math.hypot(x - t * dx, z - t * dz) > THREE.MathUtils.lerp(a.w, b.w, t)) continue;
          riverTop = Math.max(riverTop, point.y);
          inRiver++;
          break;
        }
      }
    });
    return { height, peak, inRiver, riverTop };
  });
  expect(ridges.height).toBeGreaterThanOrEqual(180);
  expect(ridges.peak).toBeGreaterThanOrEqual(180);
  expect(ridges.inRiver).toBeGreaterThan(0);
  expect(ridges.riverTop).toBeLessThanOrEqual(.5);
});

test('near ridges have secondary peaks separated by saddles', async ({ page }) => {
  await openMap(page);
  const { varied, total } = await page.evaluate(() => {
    let total = 0, varied = 0;
    const ray = new THREE.Raycaster();
    ray.ray.direction.set(0, -1, 0);
    window.__dbg.scene.traverse(ridge => {
      if (ridge.userData.landscapeSurface?.group !== '远山') return;
      const box = new THREE.Box3().setFromObject(ridge);
      const centerZ = (box.min.z + box.max.z) / 2;
      // 横穿山顶取高程，单个椭圆拱不会出现两峰间的鞍部。
      const profile = [];
      for (let i = 1; i < 40; i++) {
        const x = THREE.MathUtils.lerp(box.min.x, box.max.x, i / 40);
        ray.ray.origin.set(x, box.max.y + 1, centerZ);
        profile.push(ray.intersectObject(ridge, false)[0]?.point.y ?? 0);
      }
      const relief = Math.max(...profile) - Math.min(...profile);
      const hasSaddle = profile.some((height, i) =>
        Math.min(Math.max(...profile.slice(0, i)), Math.max(...profile.slice(i + 1))) - height > relief * .06);
      total++;
      if (hasSaddle) varied++;
    });
    return { varied, total };
  });
  expect(varied).toBeGreaterThan(total / 2);
});

test('near ridges have broad shoulders and rounded summits', async ({ page }) => {
  await openMap(page);
  const shape = await page.evaluate(() => {
    const point = new THREE.Vector3();
    let highestAspect = 0, sharpestTurn = 0, summits = 0;
    for (const ridge of window.__dbg.scene.children.filter(node => node.userData.landscapeSurface?.group === '远山')) {
      const columns = new Map(), positions = ridge.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(ridge.matrixWorld);
        columns.set(point.x, Math.max(point.y, columns.get(point.x) ?? -Infinity));
      }
      const profile = [...columns].sort(([x], [nextX]) => x - nextX);
      const heights = profile.map(([, y]) => y), base = Math.min(...heights), top = Math.max(...heights);
      highestAspect = Math.max(highestAspect, (top - base) / (profile.at(-1)[0] - profile[0][0]));
      // A broad hill can still hide a sawtooth along its crest. Measure the change of tangent
      // across adjacent mesh columns at every summit in the upper half of its relief.
      for (let i = 1; i < profile.length - 1; i++) {
        const [x, y] = profile[i], [lx, ly] = profile[i - 1], [rx, ry] = profile[i + 1];
        if (y <= (base + top) / 2 || y < ly || y <= ry) continue;
        summits++;
        const turn = Math.atan2(y - ly, x - lx) - Math.atan2(ry - y, rx - x);
        sharpestTurn = Math.max(sharpestTurn, THREE.MathUtils.radToDeg(turn));
      }
    }
    return { highestAspect, sharpestTurn, summits };
  });
  expect(shape.summits).toBeGreaterThan(0);
  expect.soft(shape.sharpestTurn, 'summit change of tangent in degrees').toBeLessThan(25);
  expect(shape.highestAspect, 'height / full ridge width').toBeLessThan(.22);
});

test('near ridges keep a pale ink wash below paper brightness in the tower view', async ({ page }) => {
  await openMap(page);
  await page.locator('#b-tower').click();
  const ink = await page.evaluate(async () => {
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    const { camera, scene } = window.__dbg, renderer = window.__testRenderer;
    const hills = new THREE.Scene();
    for (const mesh of scene.children.filter(node => node.userData.landscapeSurface?.group === '远山')) {
      hills.add(mesh.clone(false));
    }
    const target = new THREE.WebGLRenderTarget(720, 450), previous = renderer.getRenderTarget();
    const bytes = new Uint8Array(target.width * target.height * 4);
    try {
      renderer.setRenderTarget(target);
      renderer.render(hills, camera);
      renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, bytes);
    } finally {
      renderer.setRenderTarget(previous);
      target.dispose();
    }
    // Trace each visible skyline, then sample the first eight occupied pixels below it.
    // This includes lit summits and their shoulders without confusing sky or foreground roofs for snow.
    const paper = scene.fog.color.toArray().map(channel => Math.round(channel * 255));
    const wash = [];
    let abovePaper = 0;
    for (let x = 0; x < target.width; x++) {
      let samples = 0;
      for (let y = target.height - 1; y >= 0 && samples < 8; y--) {
        const at = (y * target.width + x) * 4;
        if (!bytes[at + 3]) continue;
        samples++;
        // Blending into the clear target stores premultiplied colour. Show it on the
        // painting's paper before measuring the light, just as the finished print does.
        const uncovered = 1 - bytes[at + 3] / 255;
        const colour = paper.map((channel, i) => bytes[at + i] + channel * uncovered);
        if (colour.some((value, i) => value > paper[i] + 1)) abovePaper++;
        wash.push(paper[1] - colour[1]);
      }
    }
    wash.sort((a, b) => a - b);
    return { count: wash.length, abovePaper, median: wash[Math.floor(wash.length / 2)] };
  });
  expect(ink.count).toBeGreaterThan(500);
  expect(ink.abovePaper).toBe(0);
  expect(ink.median, 'paper-to-summit difference in 8-bit green').toBeGreaterThanOrEqual(20);
  expect(ink.median).toBeLessThan(80);
});

test('near ridge feet reveal the plain through a graduated wash', async ({ page }) => {
  await openMap(page);
  const through = await page.evaluate(() => {
    const renderer = window.__testRenderer;
    const ridges = window.__dbg.scene.children.filter(mesh => mesh.userData.landscapeSurface?.group === '远山');
    const ridge = ridges.reduce((tallest, mesh) =>
      new THREE.Box3().setFromObject(mesh).max.y > new THREE.Box3().setFromObject(tallest).max.y ? mesh : tallest);
    const box = new THREE.Box3().setFromObject(ridge), peak = new THREE.Vector3(0, -Infinity, 0);
    const point = new THREE.Vector3(), vertices = ridge.geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      point.fromBufferAttribute(vertices, i).applyMatrix4(ridge.matrixWorld);
      if (point.y > peak.y) peak.copy(point);
    }
    const hills = new THREE.Scene();
    hills.add(ridge.clone(false));
    const camera = new THREE.OrthographicCamera(-8, 8, peak.y, box.min.y, 1, 1600);
    camera.position.set(peak.x, 0, box.max.z + 100);
    camera.lookAt(peak.x, 0, peak.z);
    const target = new THREE.WebGLRenderTarget(32, 128), previous = renderer.getRenderTarget();
    function frame(gray) {
      hills.background = new THREE.Color(gray, gray, gray);
      renderer.render(hills, camera);
      const pixels = new Uint8Array(target.width * target.height * 4);
      renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, pixels);
      return pixels;
    }
    try {
      renderer.setRenderTarget(target);
      const dark = frame(.4), light = frame(.8);
      // A flat paper-coloured foot stays the same on both grounds. A translucent ink wash
      // carries their actual colour difference, progressively less as the hillside rises.
      return [.06, .28, .80].map(fraction => {
        const row = Math.floor(fraction * target.height);
        let difference = 0;
        for (let y = row - 2; y <= row + 2; y++) for (let x = 0; x < target.width; x++) {
          const g = (y * target.width + x) * 4 + 1;
          difference += light[g] - dark[g];
        }
        return difference / (5 * target.width * (.8 - .4) * 255);
      });
    } finally {
      renderer.setRenderTarget(previous);
      target.dispose();
    }
  });
  const [foot, shoulder, summit] = through;
  expect.soft(foot, 'ground visible at the foot').toBeGreaterThan(.85);
  expect.soft(shoulder, 'transition on the lower slope').toBeGreaterThan(.15);
  expect.soft(shoulder).toBeLessThan(.80);
  expect(summit, 'the upper ridge holds its ink').toBeLessThan(.07);
});

for (const [width, height] of [[1440,900], [1280,720], [390,844], [844,390]]) {
  test(`the sun fits the sky clear of visible controls at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openMap(page);
    async function checkSun(key) {
      const disc = await page.locator('#sun').evaluate(async sun => {
        await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
        const r = sun.getBoundingClientRect();
        const collisions = [...document.querySelectorAll('#title, #map-actions, #sound, #poem')]
          .filter(el => el.checkVisibility()).filter(el => {
            const b = el.getBoundingClientRect();
            return b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top;
          }).map(el => el.id);
        return { diameter: Math.max(r.width, r.height), opacity: Number(getComputedStyle(sun).opacity), collisions };
      });
      // 390×844 全城以读图为先；地平线出画时太阳随远山淡出。若仍可见，照常检查遮挡。
      if (width === 390 && height === 844 && key === 'home' && disc.opacity === 0) return;
      expect(disc.opacity).toBeGreaterThan(0);
      expect(disc.diameter).toBeGreaterThan(0);
      expect(disc.diameter).toBeLessThanOrEqual(width < height ? 64 : 104);
      expect(disc.collisions).toEqual([]);
    }
    for (const key of ['home', 'core']) {
      await page.locator('#b-' + key).click();
      await checkSun(key);
    }
    if (width < height) {
      await page.locator('#more-toggle').click();
      await page.locator('#poem-toggle').click();
      await expect(page.locator('#poem')).toBeVisible();
      await checkSun('core');
    }
  });

  test(`home, core and tower retain a natural field of view at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openMap(page);
    for (const key of ['home', 'core', 'tower']) {
      await page.locator('#b-' + key).click();
      const fov = await page.evaluate(() => window.__dbg.camera.fov);
      expect(fov, key).toBeLessThanOrEqual(width < height ? 60 : 50);
    }
  });

  // 竖屏全城以读图为先，地平线可出画，见构图设计文档的竖屏修订。
  const horizonViews = width < height ? ['core'] : ['home', 'core'];
  test(`the horizon stays in the upper sky for ${horizonViews.join(' and ')} at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openMap(page);
    for (const key of horizonViews) {
      await page.locator('#b-' + key).click();
      const ratio = await page.evaluate(async () => {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const { camera } = window.__dbg;
        const forward = camera.getWorldDirection(new THREE.Vector3());
        forward.y = 0;
        forward.normalize().multiplyScalar(1e5).add(camera.position).project(camera);
        return (1 - forward.y) / 2;
      });
      expect(ratio, key).toBeGreaterThanOrEqual(.15);
      expect(ratio, key).toBeLessThanOrEqual(.40);
      expect(await hillsOpacity(page), key).toBeGreaterThan(.5);
    }
  });
}

for (const [width, height] of [[390, 844], [360, 640]]) {
  test(`the portrait overview frames the three built-up towns and the full East Lake shoreline at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openMap(page);
    await page.locator('#b-home').click();
    const bounds = await page.evaluate(async () => {
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      const { scene, camera, HANKOU, HANYANG, WUCHANG, LAKES, LAND_Y, inPoly } = window.__dbg;
      const box = new THREE.Box3(), lake = new THREE.Box2(), point = new THREE.Vector3();
      function toPixels(point) {
        point.project(camera);
        return point.set((point.x + 1) * innerWidth / 2, (1 - point.y) * innerHeight / 2, point.z);
      }
      // 三镇多边形用底板四角封口；把封口也收入画面会将城区压成细带。按各镇建筑落点验收。
      const towns = [HANKOU, HANYANG, WUCHANG], counts = [0, 0, 0], batches = new Set();
      for (const mesh of scene.children) {
        const matrices = mesh.userData.authoredMatrices;
        if (!mesh.name.startsWith('City / ') || !matrices || batches.has(matrices)) continue;
        batches.add(matrices);
        for (let i = 0; i < matrices.length; i += 16) {
          point.fromArray(matrices, i + 12).applyMatrix4(mesh.matrixWorld);
          const town = towns.findIndex(ring => inPoly(ring, point.x, point.z));
          if (town >= 0) counts[town]++;
          box.expandByPoint(toPixels(point));
        }
      }
      for (const [x, z] of LAKES[0]) {
        toPixels(point.set(x, LAND_Y, z));
        lake.expandByPoint(point);
        box.expandByPoint(point);
      }
      const top = Math.max(...['title', 'sound'].map(id => document.getElementById(id).getBoundingClientRect().bottom)) + 8;
      return { min: box.min.toArray(), max: box.max.toArray(), lakeWidth: lake.max.x - lake.min.x, counts, fov: camera.fov, top,
        bottom: document.getElementById('dock').getBoundingClientRect().top - 8 };
    });
    expect(Math.min(...bounds.counts), 'buildings in each town').toBeGreaterThan(0);
    expect(bounds.fov).toBeLessThanOrEqual(60);
    expect(bounds.min[0]).toBeGreaterThanOrEqual(16);
    expect(bounds.max[0]).toBeLessThanOrEqual(width - 16);
    expect.soft(bounds.max[0] - bounds.min[0], 'horizontal city and lake span').toBeGreaterThanOrEqual(width * .70);
    expect(bounds.min[1]).toBeGreaterThanOrEqual(bounds.top);
    expect(bounds.max[1]).toBeLessThanOrEqual(bounds.bottom);
    expect.soft(bounds.max[1] - bounds.min[1], 'vertical outline span').toBeGreaterThanOrEqual((bounds.bottom - bounds.top) * .45);
    expect.soft(bounds.lakeWidth, 'East Lake shoreline width').toBeGreaterThanOrEqual(120);
    expect(bounds.min[2]).toBeGreaterThan(-1);
    expect(bounds.max[2]).toBeLessThan(1);
    for (const name of ['汉口', '汉阳', '武昌', '东湖']) {
      await expect(page.locator('#labels b').filter({ hasText: name })).toBeVisible();
    }
  });
}

test('the foreground suspension bridge clears the desktop guide on entry', async ({ page }) => {
  await openMap(page);
  for (const [width, height] of [[1440,900], [1280,720]]) {
    await page.setViewportSize({ width, height });
    const gap = await page.evaluate(async () => {
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      const { scene, camera } = window.__dbg;
      const bridge = scene.children.find(object => object.userData.focus === 'yingwuzhou');
      const vertex = new THREE.Vector3();
      let bottom = -Infinity;
      bridge.traverse(part => {
        const positions = part.geometry?.attributes.position;
        if (!positions) return;
        for (let i = 0; i < positions.count; i++) {
          vertex.fromBufferAttribute(positions, i).applyMatrix4(part.matrixWorld).project(camera);
          bottom = Math.max(bottom, (1 - vertex.y) * innerHeight / 2);
        }
      });
      return document.getElementById('dock').getBoundingClientRect().top - bottom;
    });
    expect(gap, width + 'px').toBeGreaterThanOrEqual(8);
  }
});

test('the broad city sky keeps the sun inside the paper', async ({ page }) => {
  await openMap(page);
  for (const [width, height] of [[1440,900], [1280,720], [390,844], [844,390]]) {
    await page.setViewportSize({ width, height });
    for (const key of ['home', 'core']) {
      await page.locator('#b-' + key).click();
      const top = await page.locator('#sun').evaluate(async el => {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return el.getBoundingClientRect().top;
      });
      expect(top, width + ' ' + key).toBeGreaterThanOrEqual(0);
    }
  }
});

test('the city lens changes with the flight to a landmark', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openMap(page);
  const start = await page.evaluate(() => {
    const { camera, flyTo } = window.__dbg;
    const from = camera.fov;
    flyTo('qc');
    return { from, first: camera.fov };
  });
  expect(start.first).toBeCloseTo(start.from, 2);
  await expect.poll(() => page.evaluate(() => window.__dbg.camera.fov)).toBeLessThan(start.from - 5);
  await expect.poll(() => page.evaluate(() => window.__dbg.camera.fov)).toBeCloseTo(38, 1);
});

test('the map blooms in from the centre and leaves no mask behind', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const ready = new MutationObserver(() => {
      if (!window.__ready) return;
      const stage = document.getElementById('stage');
      const animation = stage.getAnimations().find(a => a.animationName === 'inkBloom');
      const style = getComputedStyle(stage);
      window.__entryAtReady = { name: style.animationName, state: animation?.playState, masked: style.maskImage !== 'none' };
      if (animation) {
        const time = animation.currentTime;
        animation.currentTime = 550;
        const firstMask = style.maskImage;
        animation.currentTime = 950;
        window.__entryAtReady.expands = firstMask !== style.maskImage;
        animation.currentTime = time;
      }
      ready.disconnect();
    });
    ready.observe(document, { attributes: true, subtree: true, attributeFilter: ['data-state'] });
    document.addEventListener('animationend', e => {
      if (e.target.id === 'stage' && e.animationName === 'inkBloom') window.__entryFinished = true;
    });
  });
  await openMap(page);
  expect(await page.evaluate(() => window.__entryAtReady)).toEqual({ name: 'inkBloom', state: 'running', masked: true, expands: true });
  await expect.poll(() => page.evaluate(() => window.__entryFinished === true)).toBe(true);
  const masks = await page.locator('#stage').evaluate(el => {
    const style = getComputedStyle(el);
    return [style.maskImage, style.webkitMaskImage];
  });
  expect(masks).toEqual(['none', 'none']);
});

test('reduced motion shows the finished map at once', async ({ page }) => {
  await openMap(page);
  await expect(page.locator('#stage')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('#stage')).toHaveCSS('mask-image', 'none');
  expect(await page.locator('#far-hills').evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
});
