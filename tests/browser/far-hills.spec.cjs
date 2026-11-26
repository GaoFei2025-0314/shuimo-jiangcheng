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

for (const [width, height] of [[1440,900], [1280,720], [390,844], [844,390]]) {
  test(`home and core show the horizon in the upper sky at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openMap(page);
    for (const key of ['home', 'core']) {
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
