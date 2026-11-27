const { test, expect, ready, STARTUP } = require('./fixtures.cjs');

test('a stalled font stylesheet does not delay map readiness', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('https://fonts.googleapis.com/**', async route => { await gate; await route.fulfill({ body: '', contentType: 'text/css' }); });
  await page.goto('/', { waitUntil: 'commit' });
  try {
    await expect.poll(() => page.evaluate(() => window.__ready === true), STARTUP).toBe(true);
    await expect(page.locator('#nav button:enabled')).toHaveCount(16);
  } finally { release(); }
});

test('an initialization exception leaves navigation disabled and offers recovery', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/BufferGeometryUtils.js', route => route.fulfill({ contentType: 'text/javascript',
    body: 'THREE.BufferGeometryUtils = { mergeBufferGeometries() { throw new Error("Injected initialization failure"); } };' }));
  await page.goto('/');
  await expect(page.locator('#retry')).toBeVisible();
  await expect(page.locator('#nav button:enabled')).toHaveCount(0);
  expect(await page.evaluate(() => window.__ready)).toBe(false);
  expect(errors).toEqual([]);
});

test('failure during the first frame never reports ready', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      const context = original.call(this, type, ...args);
      if (context && /webgl/i.test(type)) context.drawElements = () => { throw new Error('Injected first-frame failure'); };
      return context;
    };
  });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#retry')).toBeVisible();
  await expect(page.locator('#loadMessage')).toContainText('画面已中断');
  expect(await page.evaluate(() => window.__ready)).toBe(false);
  expect(errors).toEqual([]);
});

test('wheel zoom cancels flight and panel gestures do not reach map controls', async ({ page }) => {
  await ready(page);
  await page.locator('#b-lake').click();
  await page.mouse.move(750, 500);
  await page.mouse.wheel(0, -200);
  await expect.poll(() => page.evaluate(() => gsap.getTweensOf([window.__testCamera.position, window.__testControls.target]).length)).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => { window.__gestureStarts = 0; window.__testControls.addEventListener('start', () => window.__gestureStarts++); });
  await page.locator('#more-toggle').click();
  await page.locator('#poem-toggle').click();
  await page.locator('#poem').hover();
  await page.mouse.wheel(0, 120);
  expect(await page.evaluate(() => window.__gestureStarts)).toBe(0);
});

test('Tab visits only visible controls and Enter activates the focused destination', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await page.locator('#b-tower').click();
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => {
      const el = document.activeElement;
      return !el.classList.contains('mark') || (!el.disabled && el.getAttribute('aria-hidden') === 'false' && getComputedStyle(el).visibility === 'visible');
    })).toBe(true);
  }
  await page.locator('#b-wuda').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#cardTitle')).toHaveText('武大 · 老斋舍');
});

async function controlPaintTiming(page) {
  await page.setViewportSize({ width: 480, height: 360 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__dbg && window.__ready);
  await page.evaluate(async () => {
    window.motionChanged = new Promise(done => {
      matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', done, { once: true });
    });
    const nativeFrame = window.requestAnimationFrame.bind(window);
    const queued = [];
    window.requestAnimationFrame = callback => queued.push(callback);
    // 接住应用已经排队的真实帧，从下一次回调起只推进指定的时间。
    await new Promise(done => nativeFrame(() => nativeFrame(done)));
    let now = Math.ceil(performance.now()), painted = false, multisample;
    window.__dbg.scene.onAfterRender = renderer => {
      painted = true;
      multisample = Boolean(renderer.getRenderTarget()?.isWebGLMultisampleRenderTarget);
    };
    function tick(ms) {
      now += ms;
      painted = false;
      for (const callback of queued.splice(0)) callback(now);
    }
    window.samplePaint = ms => {
      tick(ms);
      // 慢帧后的节流可跳过若干 rAF，记录下一次真正绘到的印版。
      for (let i = 0; !painted && i < 100; i++) tick(16);
      if (!painted) throw Error('No scene paint after the injected frame');
      return { multisample, slow: window.__dbg.slowRaster };
    };
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => window.motionChanged.then(() => true));
}

test('three consecutive fast full-size still paints restore multisampling', async ({ page }) => {
  await controlPaintTiming(page);
  const report = await page.evaluate(() => {
    window.samplePaint(16);
    window.samplePaint(16);
    const samples = [180, 180, 79, 79, 80, 79, 79, 79].map(window.samplePaint);
    [180, 180, 79].forEach(window.samplePaint);
    window.__dbg.controls.dispatchEvent({ type: 'change' });
    window.samplePaint(79); // 上一帧是第二次快静景，本次绘制包含镜头变化。
    const afterMotion = [79, 79, 79, 79].map(window.samplePaint);
    const state = Object.getOwnPropertyDescriptor(window.__dbg, 'slowRaster');
    return { samples, afterMotion, readOnly: Boolean(state?.get && !state.set) };
  });
  expect(report.samples.map(s => s.multisample)).toEqual([true, false, false, false, false, false, false, true]);
  expect(report.samples.map(s => s.slow)).toEqual([false, true, true, true, true, true, true, false]);
  expect(report.afterMotion.map(s => s.slow)).toEqual([true, true, true, false]);
  expect(report.readOnly).toBe(true);
});

test('ink print releases each depth texture on replacement and cleanup', async ({ page }) => {
  await controlPaintTiming(page);
  const releases = await page.evaluate(() => {
    const renderer = window.__testRenderer, gl = renderer.getContext();
    const setTarget = renderer.setRenderTarget.bind(renderer), remove = gl.deleteTexture.bind(gl);
    const depths = new Map();
    renderer.setRenderTarget = target => {
      setTarget(target);
      if (!target?.depthTexture) return;
      const handle = renderer.properties.get(target.depthTexture).__webglTexture;
      if (!handle) throw Error('The depth attachment has no allocated GPU texture');
      if (!depths.has(handle)) depths.set(handle, { multisample: Boolean(target.isWebGLMultisampleRenderTarget), deleted: 0 });
    };
    gl.deleteTexture = texture => {
      const depth = depths.get(texture);
      if (depth) depth.deleted++;
      remove(texture);
    };
    [16, 16, 180, 180, 79, 79, 79].forEach(window.samplePaint);
    const beforeCleanup = [...depths.values()].map(d => d.deleted);
    renderer.domElement.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    return { beforeCleanup, textures: [...depths.values()] };
  });
  expect(releases.beforeCleanup).toEqual([1, 1, 0]);
  expect(releases.textures).toEqual([
    { multisample: true, deleted: 1 }, { multisample: false, deleted: 1 }, { multisample: true, deleted: 1 }
  ]);
});
