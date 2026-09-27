
  /* ═════════ 十二、镜头 ═════════ */
  function orbit(at, ty, dist, azDeg, elDeg) {
    const a = azDeg * Math.PI / 180, e = elDeg * Math.PI / 180;
    return {
      pos: { x: at.x + dist * Math.cos(e) * Math.sin(a), y: ty + dist * Math.sin(e), z: at.z + dist * Math.cos(e) * Math.cos(a) },
      target: { x: at.x, y: ty, z: at.z }
    };
  }
  const wudaAt = geo(114.3625, 30.5397);
  const VIEWS = {
    home:    { pos: { x: 440, y: 650, z: 1180 }, target: { x: 250, y: 0, z: -130 } },
    core:    orbit(geo(114.2855, 30.5570), 6, 660, 18, 27),
    tower:   orbit(AT.tower, terrainTop(AT.tower.x, AT.tower.z) + 13, 120, 28, 21),
    bridge:  orbit(AT.bridge, 12, 245, 58, 16),
    qc:      orbit(AT.qc, terrainTop(AT.qc.x, AT.qc.z) + 7, 112, 82, 19),
    tv:      orbit(AT.tv, 82, 350, 104, 10),
    customs: orbit(AT.customs, 18, 115, 92, 17),
    wuda:    orbit(wudaAt, terrainTop(wudaAt.x, wudaAt.z) + 6, 112, 8, 19),
    lake:    orbit(lakeC, 3, 560, 14, 25),
    chutian: orbit(AT.chutian, terrainTop(AT.chutian.x, AT.chutian.z) + 14, 155, 22, 19)
  };
  const COPY = {
    home:    ['两江四岸', '汉水自西北来，于南岸嘴汇入长江。江北为汉口，两江之间是汉阳，大江东南岸为武昌。图上方位依实测经纬度，水平一比一，山楼竖向略作夸张。'],
    core:    ['南岸嘴', '龟蛇隔江对峙：蛇山踞武昌，上有黄鹤楼；龟山在汉阳，顶立电视塔。大桥自蛇山头跨向龟山东麓。'],
    tower:   ['黄鹤楼', '现楼为一九八五年重建，通高五十一点四米，五层攒尖、层层飞檐，顶冠五米高的葫芦形宝顶。踞蛇山西端，下临大江。'],
    bridge:  ['武汉长江大桥', '全长一千六百七十米，正桥一千一百五十六米，九孔八墩，最大跨径一百二十八米；上层行车、下层走火车，两端立着七层桥头堡。'],
    qc:      ['晴川阁', '在汉阳龟山东麓的禹功矶上，北望汉水入江口，东濒长江，与黄鹤楼夹江相望。一九八四年起复建，旁有铁门关。'],
    tv:      ['龟山电视塔', '塔身二百二十一点二米，海拔三百一十一点四米，一九八五年建成，中国第一座自行设计施工的电视塔，人称「亚洲桅杆」。'],
    customs: ['江汉关', '一九二四年落成，主楼四层、钟楼五层，通高四十五点八五米，文艺复兴式样，钟面直径四米。正门朝东，面对长江。'],
    wuda:    ['武大 · 老斋舍', '一九三一年落成，依狮子山南坡而建，三座罗马券拱门连起四栋斋舍，门上是歇山亭楼，绿琉璃瓦掩在樱花里。'],
    lake:    ['东湖', '中国最大的城中湖，水域约三十三平方公里，绿道一百零五公里。磨山三面环水，自南岸伸入湖中。'],
    chutian: ['东湖 · 楚天台', '立于磨山之巅，按楚国「章华台」形制而建，外五层内六层，高三十六米，台前三百四十五级石阶，顶置青铜凤标。']
  };
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = motionPreference.matches;
  camera.position.copy(VIEWS.home.pos);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !reduce; controls.dampingFactor = .06;
  controls.rotateSpeed = .6; controls.zoomSpeed = .8;
  controls.minDistance = 22; controls.maxDistance = 2600;
  controls.maxPolarAngle = Math.PI * .47;
  controls.target.copy(VIEWS.home.target);
  controls.update();

  const cardTitle = document.getElementById('cardTitle'), cardText = document.getElementById('cardText'), card = document.getElementById('card');
  const buttons = Array.from(document.querySelectorAll('#nav button'));
  let activeView = 'home', cameraMode = 'preset', flight = null;
  let layoutDirty = true, safeRect = null, uiBlocks = [], layoutSignature = '', markFarScale = 1;
  const layout = createMapLayout(() => { layoutDirty = true; });
  scene.updateMatrixWorld(true);
  const viewBounds = {};
  pickables.forEach(object => { viewBounds[object.userData.focus] = new THREE.Box3().setFromObject(object); });
  viewBounds.home = new THREE.Box3();
  ['tower', 'bridge', 'qc', 'tv', 'customs', 'wuda', 'chutian'].forEach(key => viewBounds.home.union(viewBounds[key]));
  viewBounds.core = new THREE.Box3();
  ['tower', 'bridge', 'qc', 'tv', 'customs'].forEach(key => viewBounds.core.union(viewBounds[key]));
  function viewFor(key) {
    return layout.compact ? fittedView(VIEWS[key], viewBounds[key], safeRect, W, H, camera.fov) : VIEWS[key];
  }
  function stopFlight() {
    if (flight) { flight.kill(); flight = null; }
    gsap.killTweensOf([camera.position, controls.target, card]);
    card.style.opacity = '1'; card.style.transform = 'none';
  }
  function moveCamera(view, animate) {
    if (!animate || reduce) {
      camera.position.copy(view.pos); controls.target.copy(view.target); controls.update();
      return;
    }
    flight = gsap.timeline({ onUpdate: () => controls.update(), onComplete: () => { flight = null; } });
    flight.to(camera.position, { ...view.pos, duration: 2.6, ease: 'power3.inOut' }, 0)
      .to(controls.target, { ...view.target, duration: 2.6, ease: 'power3.inOut' }, 0)
      .fromTo(card, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .45 }, 0);
  }
  function flyTo(key) {
    if (app.state !== 'ready' || !VIEWS[key]) return;
    stopFlight();
    // 消除上一次手势的惯性，防止它与新镜头竞争。
    controls.enableDamping = false; controls.update(); controls.enableDamping = !reduce;
    activeView = key; cameraMode = 'preset';
    const navKey = key === 'chutian' ? 'lake' : key;
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === navKey)));
    cardTitle.textContent = COPY[key][0]; cardText.textContent = COPY[key][1];
    refreshLayout(false);
    moveCamera(viewFor(key), true);
    if (layout.compact) buttons.find(b => b.dataset.view === navKey).scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  buttons.forEach(b => b.addEventListener('click', () => flyTo(b.dataset.view)));
  controls.addEventListener('start', () => { stopFlight(); cameraMode = 'manual'; });
  motionPreference.addEventListener('change', event => {
    reduce = event.matches;
    const wasFlying = !!flight;
    stopFlight();
    controls.enableDamping = !reduce;
    if (reduce && wasFlying) moveCamera(viewFor(activeView), false);
  });
  function enterScene() {
    const view = viewFor('home');
    moveCamera(view, false);
    if (reduce) return;
    camera.position.sub(controls.target).multiplyScalar(1.35).add(controls.target);
    moveCamera(view, true);
  }

  const overlays = createMapOverlays(camera, controls, flyTo, buttons);

  /* ═════════ 十四、点选 ═════════ */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tip = document.getElementById('tip');
  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, true)[0];
    if (!hit) return null;
    let o = hit.object; while (o && !o.userData.focus) o = o.parent;
    return o || null;
  }
  let down = null;
  renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    if (moved > 5) return;
    const o = pick(e); if (o) flyTo(o.userData.focus);
  });
  // 悬停的 raycast 按帧节流：指针事件可能比渲染帧率密得多，没必要逐次都算一遍拾取
  let hoverEv = null, hoverQueued = false;
  function applyHover() {
    hoverQueued = false;
    const e = hoverEv; if (!e) return;
    const o = pick(e);
    stage.classList.toggle('hot', !!o);
    if (o) { tip.textContent = o.userData.name; tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px'; tip.style.opacity = 1; }
    else tip.style.opacity = 0;
  }
  renderer.domElement.addEventListener('pointermove', e => {
    if (e.buttons) { hoverEv = null; tip.style.opacity = 0; return; }
    hoverEv = e;
    if (!hoverQueued) { hoverQueued = true; requestAnimationFrame(applyHover); }
  });
  renderer.domElement.addEventListener('pointerleave', () => { hoverEv = null; tip.style.opacity = 0; });

  /* ═════════ 十五、循环 ═════════ */
  let W = 1, H = 1;
  function refreshLayout(refit = true) {
    const measured = layout.measure(W, H);
    safeRect = measured.rect; uiBlocks = measured.blocks; layoutDirty = false;
    overlays.invalidate();
    const signature = [layout.compact, W, H, ...Object.values(safeRect)].join(',');
    if (signature === layoutSignature) return;
    layoutSignature = signature;
    if (layout.compact) {
      const cx = (safeRect.left + safeRect.right) / 2, cy = (safeRect.top + safeRect.bottom) / 2;
      camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
      const home = viewFor('home'), distance = home.pos.distanceTo(home.target);
      controls.maxDistance = Math.max(2600, distance * 1.4);
      markFarScale = Math.max(1, distance / 1500);
    } else {
      camera.clearViewOffset(); controls.maxDistance = 2600; markFarScale = 1;
    }
    if (cameraMode === 'manual') controls.maxDistance = Math.max(controls.maxDistance, camera.position.distanceTo(controls.target) + 1);
    if (refit && cameraMode === 'preset') { stopFlight(); moveCamera(viewFor(activeView), false); }
  }
  function resize() {
    if (app.state === 'failed') return;
    W = stage.clientWidth || window.innerWidth; H = stage.clientHeight || window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.fov = W / H < .9 ? 52 : 38;
    camera.updateProjectionMatrix();
    layoutSignature = '';
    refreshLayout();
  }
  window.addEventListener('resize', resize); resize();

  const clock = new THREE.Clock();
  let sceneTime = 0;
  let frameId = 0;
  app.cleanups.push(() => {
    cancelAnimationFrame(frameId);
    controls.enabled = false;
    controls.dispose();
    stopFlight();
  });
  function frame() {
    if (app.state === 'failed') return;
    try { renderFrame(); }
    catch (error) { console.error('Map rendering failed:', error); app.fail('三维画面已中断，请重新加载。'); }
  }
  function renderFrame() {
    if (layoutDirty) refreshLayout();
    const delta = clock.getDelta();
    if (!reduce) sceneTime += Math.min(delta, .1);
    const t = sceneTime;
    waterU.uTime.value = t;
    mistMats.forEach(m => m.uniforms.uTime.value = t);

    riverBoats.forEach(b => {
      let u = (b.t + b.v * t) % 1; if (u < 0) u += 1;
      const tt = .30 + .40 * u;
      const p = YZ.curve.getPointAt(tt), d = YZ.curve.getTangentAt(tt);
      const nx = d.z, nz = -d.x, L = Math.hypot(nx, nz) || 1;
      const sgn = b.v > 0 ? 1 : -1;
      b.m.position.set(p.x + nx / L * b.off, .3 + Math.sin(t * 1.2 + b.i) * .12, p.z + nz / L * b.off);
      b.m.rotation.y = Math.atan2(-d.z * sgn, d.x * sgn);
      b.m.rotation.z = Math.sin(t * .9 + b.i * 2) * .02;
      boatU[b.i].set(b.m.position.x, b.m.position.z);
    });
    lakeBoats.forEach(b => {
      const a = b.a + t * b.sp;
      const x = lakeC.x + Math.cos(a) * 300 * b.k, z = lakeC.z + Math.sin(a) * 210 * b.k;
      b.m.position.set(x, .3 + Math.sin(t * 1.1 + b.a) * .07, z);
      const dx = -Math.sin(a) * 300 * b.k * Math.sign(b.sp), dz = Math.cos(a) * 210 * b.k * Math.sign(b.sp);
      b.m.rotation.y = Math.atan2(-dz, dx);
      boatU[b.i].set(x, z);
    });

    birds.forEach(b => {                                            // 环飞，翅随之开合
      const a = b.a + t * b.sp;
      const x = 160 + Math.cos(a) * b.r, z = -200 + Math.sin(a) * b.r * .66;
      b.g.position.set(x, b.y + Math.sin(t * .6 + b.a) * 5, z);
      b.g.rotation.y = Math.atan2(Math.sin(a) * b.r, -Math.cos(a) * b.r * .62) + Math.PI / 2;
      b.g.rotation.z = b.tilt;
      // 远近都只作几笔：按距离补偿大小
      b.g.scale.setScalar(THREE.MathUtils.clamp(camera.position.distanceTo(b.g.position) / 330, .8, 2.6));
      const f = Math.sin(t * b.g.userData.flap + b.g.userData.ph) * .55;
      b.g.userData.w1.rotation.z = f; b.g.userData.w0.rotation.z = -f;
    });

    camU.uCam.value.copy(camera.position);
    const floorY = terrainTop(camera.position.x, camera.position.z) + 7;   // 不钻山、不入地
    if (camera.position.y < floorY) camera.position.y = floorY;

    const dist = camera.position.distanceTo(controls.target);
    const near = Math.max(55, dist * .45);
    fogU.uNear.value = near; fogU.uFar.value = near + Math.max(420, dist * 2.3);
    scene.fog.near = near; scene.fog.far = fogU.uFar.value;

    controls.update();
    renderer.render(scene, camera);
    overlays.draw(W, H, activeView, uiBlocks, markFarScale);
    frameId = requestAnimationFrame(frame);
  }
  enterScene();
  frame();
