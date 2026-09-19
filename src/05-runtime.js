
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
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  camera.position.set(VIEWS.home.pos.x, VIEWS.home.pos.y, VIEWS.home.pos.z);
  if (!reduce) camera.position.set(VIEWS.home.pos.x + 210, VIEWS.home.pos.y * 1.62, VIEWS.home.pos.z * 1.44);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .06;
  controls.rotateSpeed = .6; controls.zoomSpeed = .8;
  controls.minDistance = 22; controls.maxDistance = 2600;
  controls.maxPolarAngle = Math.PI * .47;
  controls.target.set(VIEWS.home.target.x, VIEWS.home.target.y, VIEWS.home.target.z);
  controls.update();

  const cardTitle = document.getElementById('cardTitle'), cardText = document.getElementById('cardText'), card = document.getElementById('card');
  const buttons = Array.from(document.querySelectorAll('#nav button'));
  let activeView = 'home';
  function flyTo(key) {
    const v = VIEWS[key]; if (!v) return;
    activeView = key;
    const navKey = key === 'chutian' ? 'lake' : key;
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === navKey)));
    gsap.killTweensOf(camera.position); gsap.killTweensOf(controls.target);
    gsap.to(camera.position, { x: v.pos.x, y: v.pos.y, z: v.pos.z, duration: 2.6, ease: 'power3.inOut' });
    gsap.to(controls.target, { x: v.target.x, y: v.target.y, z: v.target.z, duration: 2.6, ease: 'power3.inOut', onUpdate: () => controls.update() });
    gsap.to(card, { opacity: 0, y: 8, duration: .3, onComplete: () => {
      cardTitle.textContent = COPY[key][0]; cardText.textContent = COPY[key][1];
      gsap.to(card, { opacity: 1, y: 0, duration: .6, delay: .5 });
    } });
  }
  buttons.forEach(b => b.addEventListener('click', () => flyTo(b.dataset.view)));
  // 入场只动镜头；题名与导览的浮现交给 CSS，不受渲染帧率拖累
  if (!reduce) gsap.to(camera.position, { x: VIEWS.home.pos.x, y: VIEWS.home.pos.y, z: VIEWS.home.pos.z, duration: 3.0, ease: 'power2.inOut' });

  /* ═════════ 十三、地名题记 ═════════ */
  const labelBox = document.getElementById('labels');
  const LABELS = [
    ['汉口', 114.2820, 30.5990, 'town', 26],
    ['汉阳', 114.2610, 30.5430, 'town', 18],
    ['武昌', 114.3220, 30.5330, 'town', 20],
    ['长江', 114.2905, 30.5700, 'water', 4],
    ['汉水', 114.2470, 30.5868, 'water', 4],
    ['东湖', 114.3880, 30.5605, 'water', 4],
    ['南岸嘴', 114.2838, 30.5628, 'hill', 8],
    ['蛇山', 114.3085, 30.5458, 'hill', 26],
    ['龟山', 114.2700, 30.5562, 'hill', 30],
    ['珞珈山', 114.3655, 30.5372, 'hill', 28],
    ['磨山', 114.4062, 30.5395, 'hill', 30]
  ].map(L => {
    const el = document.createElement('b'); el.className = L[3]; el.textContent = L[0];
    labelBox.appendChild(el);
    const p = geo(L[1], L[2]);
    return { el, v: new THREE.Vector3(p.x, L[4], p.z), kind: L[3] };
  });
  /* 地标竖牌 */
  const markBox = document.getElementById('marks');
  const MARKS = [
    ['黄鹤楼', 'tower', AT.tower, 52], ['长江大桥', 'bridge', AT.bridge, 28],
    ['晴川阁', 'qc', AT.qc, 22], ['龟山电视塔', 'tv', AT.tv, 168],
    ['江汉关', 'customs', AT.customs, 48], ['武大樱园', 'wuda', wudaAt, 32],
    ['楚天台', 'chutian', AT.chutian, 62]
  ].map(m => {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'mark'; el.setAttribute('aria-label', '移至' + m[0]);
    el.innerHTML = '<span class="plate">' + [...m[0]].map(c => '<i>' + c + '</i>').join('') + '</span>'
                 + '<span class="stem"></span><span class="dot"></span>';
    el.addEventListener('click', () => flyTo(m[1]));
    markBox.appendChild(el);
    return { el, key: m[1], v: new THREE.Vector3(m[2].x, m[3], m[2].z) };
  });
  function drawMarks(w, h) {
    MARKS.forEach(m => {
      projV.copy(m.v).project(camera);
      const d = camera.position.distanceTo(m.v);
      const nx = projV.x * .5 + .5, ny = -projV.y * .5 + .5;
      // 太近则让路，太远或出画则隐去；当前所在景点不再标注
      let o = THREE.MathUtils.smoothstep(d, 90, 170) * (1 - THREE.MathUtils.smoothstep(d, 1500, 2100));
      if (projV.z > 1 || m.key === activeView || nx < -.02 || nx > 1.02 || ny < -.12 || ny > 1.04) o = 0;
      m.el.style.opacity = o.toFixed(3);
      m.el.style.pointerEvents = o > .35 ? 'auto' : 'none';
      if (o < .01) return;
      if (!m.h) m.h = m.el.offsetHeight || 60;
      const px = Math.min(w - 40, Math.max(40, nx * w));
      const py = Math.min(h - 24, Math.max(m.h + 8, ny * h));   // 牌子不出画
      m.el.style.transform = `translate(-50%,-100%) translate(${px.toFixed(1)}px,${py.toFixed(1)}px)`;
    });
  }

  const RANGE = { town: [340, 3200], water: [140, 2800], hill: [70, 1000] };
  const projV = new THREE.Vector3();
  function drawLabels(w, h) {
    LABELS.forEach(L => {
      projV.copy(L.v).project(camera);
      if (projV.z > 1) { L.el.style.opacity = 0; return; }
      const d = camera.position.distanceTo(L.v), r = RANGE[L.kind];
      const o = THREE.MathUtils.smoothstep(d, r[0] * .55, r[0]) * (1 - THREE.MathUtils.smoothstep(d, r[1], r[1] * 1.35));
      L.el.style.opacity = o.toFixed(3);
      if (o < .01) return;
      L.el.style.transform = `translate(-50%,-50%) translate(${((projV.x * .5 + .5) * w).toFixed(1)}px,${((-projV.y * .5 + .5) * h).toFixed(1)}px)`;
    });
  }

  /* 罗盘与比例尺 */
  const dial = document.querySelector('#rose .dial'), sBar = document.getElementById('scaleBar'), sTxt = document.getElementById('scaleText');
  const NICE = [100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  function drawTools(h) {
    const az = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z) * 180 / Math.PI;
    dial.setAttribute('transform', `rotate(${az.toFixed(1)} 26 26)`);
    const dist = camera.position.distanceTo(controls.target);
    const mPerPx = 2 * dist * Math.tan(camera.fov * Math.PI / 360) / h * MPU;
    let m = NICE[0];
    for (const n of NICE) { m = n; if (n / mPerPx >= 64) break; }
    sBar.style.width = Math.min(190, Math.round(m / mPerPx)) + 'px';
    sTxt.textContent = m >= 1000 ? (m / 1000) + ' 公里' : m + ' 米';
  }

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
  renderer.domElement.addEventListener('pointermove', e => {
    if (e.buttons) { tip.style.opacity = 0; return; }
    const o = pick(e);
    stage.classList.toggle('hot', !!o);
    if (o) { tip.textContent = o.userData.name; tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px'; tip.style.opacity = 1; }
    else tip.style.opacity = 0;
  });
  renderer.domElement.addEventListener('pointerleave', () => { tip.style.opacity = 0; });

  /* ═════════ 十五、循环 ═════════ */
  let W = 1, H = 1;
  function resize() {
    W = stage.clientWidth || window.innerWidth; H = stage.clientHeight || window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.fov = W / H < .9 ? 52 : 38;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  const clock = new THREE.Clock();
  function frame() {
    const t = clock.getElapsedTime() * (reduce ? .25 : 1);
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
    drawLabels(W, H); drawMarks(W, H); drawTools(H);
    requestAnimationFrame(frame);
  }
  frame();
  window.__ready = true;
