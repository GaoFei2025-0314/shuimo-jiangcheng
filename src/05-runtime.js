
  /* ═════════ 十二、镜头 ═════════ */
  function orbit(at, ty, dist, azDeg, elDeg) {
    const a = azDeg * Math.PI / 180, e = elDeg * Math.PI / 180;
    return {
      pos: { x: at.x + dist * Math.cos(e) * Math.sin(a), y: ty + dist * Math.sin(e), z: at.z + dist * Math.cos(e) * Math.cos(a) },
      target: { x: at.x, y: ty, z: at.z }
    };
  }
  const wudaAt = AT.wuda;
  const VIEWS = {
    home:    { pos: { x: 440, y: 650, z: 1180 }, target: { x: 250, y: 0, z: -130 } },
    core:    orbit(geo(114.2855, 30.5528), 32, 440, 22, 30),
    tower:   orbit(AT.tower, terrainTop(AT.tower.x, AT.tower.z) + 13, 100, -68, 11),
    bridge:  orbit(AT.bridge, 6.2, 174, -85, 23),
    qc:      orbit(AT.qc, terrainTop(AT.qc.x, AT.qc.z) + 7, 112, 82, 19),
    tv:      orbit(AT.tv, 82, 350, 104, 10),
    customs: orbit(AT.customs, 18, 115, 92, 17),
    wuda:    orbit(wudaAt, terrainTop(wudaAt.x, wudaAt.z) + 6, 112, 152, 26),
    xingyin:  orbit(AT.xingyin, terrainTop(AT.xingyin.x, AT.xingyin.z) + 5, 68, 22, 17),
    lake:    orbit(lakeC, 3, 560, 14, 25),
    chutian: orbit(AT.chutian, terrainTop(AT.chutian.x, AT.chutian.z) + 14, 155, 22, 19),
    hongshan:   orbit(AT.hongshan, terrainTop(AT.hongshan.x, AT.hongshan.z) + 11, 125, 18, 18),
    watertower: orbit(AT.watertower, 12, 95, 38, 15),
    museum:     orbit(AT.museum, 6, 150, 12, 20),
    honglou:    orbit(AT.honglou, terrainTop(AT.honglou.x, AT.honglou.z) + 7, 120, 8, 17),
    yingwuzhou: orbit(AT.yingwuzhou, 14, 300, -24, 11),
    guiyuan:    orbit(AT.guiyuan, 5, 135, 18, 22),
    qintai:     orbit(AT.qintai, 4, 110, 250, 19)
  };
  const COPY = {
    home:    ['两江四岸', '汉水自西北来，于南岸嘴汇入长江。江北为汉口，两江之间是汉阳，大江东南岸为武昌。图上方位依实测经纬度，水平一比一，山楼竖向略作夸张。'],
    core:    ['龟蛇锁大江', '龟蛇隔江对峙：蛇山踞武昌，上有黄鹤楼；龟山在汉阳，顶立电视塔。大桥自蛇山头跨向龟山东麓。'],
    tower:   ['黄鹤楼', '现楼为一九八五年重建，通高五十一点四米，五层攒尖、层层飞檐，顶冠五米高的葫芦形宝顶。踞蛇山西端，下临大江。'],
    bridge:  ['武汉长江大桥', '全长一千六百七十米，正桥一千一百五十六米，九孔八墩，最大跨径一百二十八米；上层行车、下层走火车，两端立着七层桥头堡。'],
    qc:      ['晴川阁', '在汉阳龟山东麓的禹功矶上，北望汉水入江口，东濒长江，与黄鹤楼夹江相望。一九八四年起复建，旁有铁门关。'],
    tv:      ['龟山电视塔', '塔身二百二十一点二米，海拔三百一十一点四米，一九八五年建成，中国第一座自行设计施工的电视塔，人称「亚洲桅杆」。'],
    customs: ['江汉关', '一九二四年落成，主楼四层、钟楼五层，通高四十五点八五米，文艺复兴式样，钟面直径四米。正门朝东，面对长江。'],
    wuda:    ['武大 · 老斋舍', '一九三一年落成，依狮子山南坡而建，三座罗马券拱门连起四栋斋舍，门上是歇山亭楼，绿琉璃瓦掩在樱花里。'],
    xingyin:  ['东湖 · 行吟阁', '行吟阁立于听涛景区湖畔。三重攒尖顶下，屈原像面湖而立，荷风桥连接岸边游径。'],
    lake:    ['东湖', '中国最大的城中湖，水域约三十三平方公里，绿道一百零五公里。磨山三面环水，自南岸伸入湖中。'],
    chutian: ['东湖 · 楚天台', '立于磨山之巅，按楚国「章华台」形制而建，外五层内六层，高三十六米，台前三百四十五级石阶，顶置青铜凤标。'],
    hongshan:   ['洪山宝塔 · 宝通禅寺', '宝通禅寺依洪山南坡层层而上，为武汉四大丛林之一。寺后洪山宝塔始建于元代，八面七级，砖石仿木。'],
    watertower: ['汉口水塔', '一九〇九年落成，八角形塔身，高四十一米余，曾是汉口最高的建筑，塔顶兼作消防瞭望。'],
    museum:     ['湖北省博物馆', '楚式高台建筑，一主两翼，深檐高脊。馆藏曾侯乙编钟、越王勾践剑，是楚文化的重镇。'],
    honglou:    ['红楼', '一九一〇年建成，原为湖北谘议局。一九一一年武昌起义后，湖北军政府在此成立。今为辛亥革命博物院北区。'],
    yingwuzhou: ['鹦鹉洲长江大桥', '三塔悬索桥，二〇一四年底通车。桥名出自崔颢「芳草萋萋鹦鹉洲」——诗里的鹦鹉洲早已没入江中。'],
    guiyuan:    ['归元禅寺', '始建于清顺治十五年（一六五八年），以五百罗汉堂闻名，武汉四大丛林之一。'],
    qintai:     ['古琴台', '相传春秋时俞伯牙在此鼓琴，钟子期听出「高山流水」，二人结为知音。台在龟山西麓，临月湖。']
  };
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = motionPreference.matches, sceneDirty = true;
  camera.position.copy(VIEWS.core.pos);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.addEventListener('change', () => { sceneDirty = true; });
  controls.enableDamping = !reduce; controls.dampingFactor = .06;
  controls.rotateSpeed = .6; controls.zoomSpeed = .8;
  controls.minDistance = 22; controls.maxDistance = 2600;
  controls.maxPolarAngle = Math.PI * .47;
  controls.target.copy(VIEWS.core.target);
  controls.update();

  const cardTitle = document.getElementById('cardTitle'), cardText = document.getElementById('cardText'), card = document.getElementById('card');
  const buttons = Array.from(document.querySelectorAll('#nav button'));
  let activeView = 'core', cameraMode = 'preset', flight = null;
  let layoutDirty = true, safeRect = null, uiBlocks = [], layoutSignature = '', markFarScale = 1;
  const layout = createMapLayout(() => { layoutDirty = true; });
  scene.updateMatrixWorld(true);
  const viewBounds = {};
  pickables.forEach(object => { viewBounds[object.userData.focus] = new THREE.Box3().setFromObject(object); });
  viewBounds.home = new THREE.Box3();                  // 全城取景框住所有地标（东湖水面本身除外）
  pickables.forEach(object => { if (object.userData.focus !== 'lake') viewBounds.home.union(viewBounds[object.userData.focus]); });
  // Follow the curve as well as the straight truss. A single box around both banks
  // would fit a large empty rectangle beside the Hanyang approach.
  const bridgeSlices = new Map(), bridgePoint = new THREE.Vector3();
  for (const part of bridge.children) {
    const vertices = part.geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      bridgePoint.fromBufferAttribute(vertices,i);
      const slice = Math.floor(bridgePoint.z / 12);
      if (!bridgeSlices.has(slice)) bridgeSlices.set(slice,new THREE.Box3());
      bridgeSlices.get(slice).expandByPoint(bridgePoint.applyMatrix4(part.matrixWorld));
    }
  }
  const bridgeBounds = [...bridgeSlices.values()];
  viewBounds.core = [viewBounds.tower, viewBounds.qc, viewBounds.tv, ...bridgeBounds];
  const isFramed = key => layout.compact || (key !== 'home' && key !== 'lake');
  function viewFor(key) {
    // 竖屏沿龟蛇两山的轴线取景，让地标前后展开。
    let base = VIEWS[key];
    if (W < H && key === 'core') base = orbit(geo(114.2855, 30.5528), 32, 440, 55, 30);
    if (W < H && key === 'bridge') base = orbit(AT.bridge, 6.2, 174, 84, 28);
    if (!isFramed(key)) return base;
    const bounds = key === 'bridge' ? bridgeBounds : viewBounds[key];
    const fill = !layout.compact && (key === 'tower' || key === 'bridge') ? .97 : .8;
    return fittedView(base, bounds, safeRect, W, H, camera.fov, fill);
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
    const navKey = ['chutian','xingyin'].includes(key) ? 'lake' : key;
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === navKey)));
    cardTitle.textContent = COPY[key][0]; cardText.textContent = COPY[key][1];
    refreshLayout(false);
    moveCamera(viewFor(key), true);
    if (layout.compact) buttons.find(b => b.dataset.view === navKey).scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  buttons.forEach(b => b.addEventListener('click', () => flyTo(b.dataset.view)));
  const atlas = document.getElementById('atlas'), atlasSite = document.getElementById('atlas-site');
  const atlasPlate = document.getElementById('atlas-plate'), detailButton = document.getElementById('atlas-detail');
  const atlasTrigger = document.getElementById('atlas-open');
  const details = { tower: ['tower-plaque','看西面匾额'], bridge: ['bridge-detail','看桥头与桁架'] };
  function atlasView(key) { return key === 'lake' ? 'xingyin' : key; }
  for (const key of Object.keys(LANDMARK_PLATES)) {
    if (COPY[atlasView(key)]) atlasSite.add(new Option(COPY[atlasView(key)][0], key));
  }
  function showPlate(detail = false) {
    const key = atlasSite.value, entry = details[key];
    const selected = detail && entry;
    atlasPlate.alt = COPY[atlasView(key)][0] + (selected ? ' · ' + entry[1].slice(1) : ' · 建筑全貌');
    atlasPlate.src = 'data:image/jpeg;base64,' + LANDMARK_PLATES[selected ? entry[0] : key];
    detailButton.hidden = !entry;
    detailButton.textContent = selected ? '看全貌' : entry ? entry[1] : '';
    detailButton.setAttribute('aria-pressed', String(Boolean(selected)));
  }
  atlasTrigger.addEventListener('click', () => {
    atlasSite.value = activeView === 'xingyin' ? 'lake' : LANDMARK_PLATES[activeView] ? activeView : 'tower';
    showPlate();
    atlas.showModal();
  });
  atlasSite.addEventListener('change', () => showPlate());
  detailButton.addEventListener('click', () => showPlate(detailButton.getAttribute('aria-pressed') !== 'true'));
  document.getElementById('atlas-close').addEventListener('click', () => atlas.close());
  document.getElementById('atlas-locate').addEventListener('click', () => { atlas.close(); flyTo(atlasView(atlasSite.value)); });
  atlas.addEventListener('close', () => {
    if (!atlas.open && app.state === 'ready') atlasTrigger.focus({ preventScroll: true });
  });
  atlas.addEventListener('click', event => { if (event.target === atlas) {
    const rect = atlas.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) atlas.close();
  } });
  app.cleanups.push(() => { if (atlas.open) atlas.close(); });
  controls.addEventListener('start', () => { stopFlight(); cameraMode = 'manual'; });
  motionPreference.addEventListener('change', event => {
    reduce = event.matches;
    sceneDirty = true;
    overlays.invalidate();
    const wasFlying = !!flight;
    stopFlight();
    controls.enableDamping = !reduce;
    if (reduce && wasFlying) moveCamera(viewFor(activeView), false);
  });
  function enterScene() {
    const view = viewFor(activeView);
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
    const framed = isFramed(activeView);
    const signature = [framed, W, H, ...Object.values(safeRect)].join(',');
    if (signature === layoutSignature) return;
    layoutSignature = signature;
    sceneDirty = true;
    if (framed) {
      const cx = (safeRect.left + safeRect.right) / 2, cy = (safeRect.top + safeRect.bottom) / 2;
      camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
    } else camera.clearViewOffset();
    if (layout.compact) {
      const home = viewFor('home'), distance = home.pos.distanceTo(home.target);
      controls.maxDistance = Math.max(2600, distance * 1.4);
      markFarScale = Math.max(1, distance / 1500);
    } else {
      controls.maxDistance = 2600; markFarScale = 1;
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
  // r128 culls ordinary meshes, but sends every instance of a city-wide batch to the GPU.
  // Keep the authored transforms for native export and share one visible buffer across materials.
  const instanceGroups = new Map(), viewVolume = new THREE.Frustum();
  const clipMatrix = new THREE.Matrix4(), previousClip = new THREE.Matrix4();
  for (const node of scene.children) {
    if (!node.isInstancedMesh) continue;
    const key = node.userData.vegetation?.species || (node.name.startsWith('City / ') && node.name);
    if (!key) continue;
    if (!instanceGroups.has(key)) instanceGroups.set(key, { meshes: [], bounds: new THREE.Box3() });
    const group = instanceGroups.get(key);
    group.meshes.push(node);
    node.geometry.computeBoundingBox();
    group.bounds.union(node.geometry.boundingBox);
  }
  for (const group of instanceGroups.values()) {
    const first = group.meshes[0], localSphere = group.bounds.getBoundingSphere(new THREE.Sphere());
    group.source = first.instanceMatrix.array.slice();
    group.buffer = first.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.spheres = [];
    const transform = new THREE.Matrix4();
    for (let i = 0; i < first.count; i++) {
      first.getMatrixAt(i, transform);
      group.spheres.push(localSphere.clone().applyMatrix4(transform.premultiply(first.matrixWorld)));
    }
    group.batches = [{ meshes: group.meshes, buffer: group.buffer, count: 0 }];
    if (first.userData.farGeometry) {
      const distant = group.meshes.map(part => {
        const mesh = new THREE.InstancedMesh(part.userData.farGeometry, part.material, first.count);
        mesh.name = 'Distant ' + part.name;
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(part.matrix);
        scene.add(mesh);
        return mesh;
      });
      const buffer = distant[0].instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (const mesh of distant) mesh.instanceMatrix = buffer;
      group.batches.push({ meshes: distant, buffer, count: 0 });
    }
    for (const part of group.meshes) {
      part.userData.authoredMatrices = group.source;
      part.instanceMatrix = group.buffer;
    }
  }
  let previousHeight = 0;
  function updateLandscapeVisibility() {
    camera.updateMatrixWorld();
    clipMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (previousClip.equals(clipMatrix) && previousHeight === H) return;
    previousClip.copy(clipMatrix);
    previousHeight = H;
    viewVolume.setFromProjectionMatrix(clipMatrix);
    const clip = clipMatrix.elements;
    // Below an 18 CSS-pixel diameter the crown silhouette carries the detail.
    const nearScale = H * camera.projectionMatrix.elements[5] / 18;
    for (const { batches, spheres, source } of instanceGroups.values()) {
      for (const batch of batches) batch.count = 0;
      for (let i = 0; i < spheres.length; i++) {
        const sphere = spheres[i];
        if (!viewVolume.intersectsSphere(sphere)) continue;
        const p = sphere.center, depth = clip[3]*p.x + clip[7]*p.y + clip[11]*p.z + clip[15];
        const batch = batches.length > 1 && depth > sphere.radius * nearScale ? batches[1] : batches[0];
        const offset = batch.count++ * 16;
        for (let k = 0; k < 16; k++) batch.buffer.array[offset + k] = source[i * 16 + k];
      }
      for (const { meshes, buffer, count } of batches) {
        buffer.updateRange.count = count * 16;
        if (count) buffer.needsUpdate = true;
        for (const part of meshes) { part.count = count; part.visible = count > 0; }
      }
    }
  }
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
      const x = lakeC.x + Math.cos(a) * LRX * b.k, z = lakeC.z + Math.sin(a) * LRZ * b.k;
      b.m.position.set(x, .3 + Math.sin(t * 1.1 + b.a) * .07, z);
      const dx = -Math.sin(a) * LRX * b.k * Math.sign(b.sp), dz = Math.cos(a) * LRZ * b.k * Math.sign(b.sp);
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
    const floorY = (plantingSurface(camera.position.x, camera.position.z) ?? 0) + 7;   // 不钻山、不入地
    if (camera.position.y < floorY) camera.position.y = floorY;

    const dist = camera.position.distanceTo(controls.target);
    const near = Math.max(55, dist * .45);
    fogU.uNear.value = near; fogU.uFar.value = near + Math.max(420, dist * 2.3);
    scene.fog.near = near; scene.fog.far = fogU.uFar.value;

    controls.update();
    // Reduced motion freezes the water, boats and birds. Repaint the geometry on a
    // camera or layout change; keyboard focus and labels still update independently.
    if (!reduce || sceneDirty) {
      updateLandscapeVisibility();
      renderer.render(scene, camera);
      sceneDirty = false;
    }
    overlays.draw(W, H, activeView, uiBlocks, markFarScale);
    frameId = requestAnimationFrame(frame);
  }
  enterScene();
  frame();
  // ?debug 时把内部状态挂出来，供浏览器里核对；正常访问不暴露。就绪与否仍以 app.ready() 置的 window.__ready 为准
  if (/[?&]debug\b/.test(location.search)) window.__dbg = {
    GEO, LAKES, LAND_HOLES, HILLS, HILL, YZ, HAN, HANKOU, HANYANG, WUCHANG, AT, VIEWS, MARKS: overlays.marks, LABELS: overlays.labels,
    LAND_Y, terrainTop, plantingSurface, cityGround, BRIDGES, approachRoads, roadAt, approachHalfWidth, reliefAt, onLand, inPoly, geo, camera, controls, flyTo, scene
  };
