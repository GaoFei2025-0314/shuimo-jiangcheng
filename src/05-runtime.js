
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
    home:    orbit({ x: 250, z: -130 }, 0, 1150, 8.25, 11),
    core:    orbit(geo(114.2855, 30.5528), 32, 440, 22, 12),
    tower:   orbit(AT.tower, terrainTop(AT.tower.x, AT.tower.z) + 13, 100, -48, 13),
    bridge:  orbit(AT.bridge, 6.2, 174, -71, 11),
    qc:      orbit(qc.position, qc.position.y + 7, 112, 65, 8),
    tv:      orbit(AT.tv, 82, 350, 104, 7),
    customs: orbit(AT.customs, 18, 115, 92, 11),
    wuda:    orbit(wudaAt, terrainTop(wudaAt.x, wudaAt.z) + 6, 112, 152, 26),
    xingyin:  orbit(xingyin.position, xingyin.position.y + 5, 68, 22, 17),
    lake:    orbit(lakeC, 3, 560, 14, 25),
    chutian: orbit(AT.chutian, terrainTop(AT.chutian.x, AT.chutian.z) + 14, 155, 22, 19),
    hongshan:   orbit(AT.hongshan, terrainTop(AT.hongshan.x, AT.hongshan.z) + 11, 125, 18, 18),
    watertower: orbit(AT.watertower, 12, 95, 38, 15),
    museum:     orbit(AT.museum, 6, 150, 146, 20),
    honglou:    orbit(AT.honglou, terrainTop(AT.honglou.x, AT.honglou.z) + 7, 120, 34, 19),
    yingwuzhou: orbit(AT.yingwuzhou, 14, 300, -24, 8),
    guiyuan:    orbit(AT.guiyuan, 5, 135, 18, 22),
    qintai:     orbit(AT.qintai, 4, 110, 25, 23)
  };
  const COPY = {
    home:    ['两江四岸', '汉水自西北来，于南岸嘴汇入长江。江北为汉口，两江之间是汉阳，大江东南岸为武昌。图上方位依实测经纬度，水平一比一，山楼竖向略作夸张。'],
    core:    ['龟蛇锁大江', '龟蛇隔江对峙：蛇山踞武昌，上有黄鹤楼；龟山在汉阳，顶立电视塔。大桥自蛇山头跨向龟山东麓。'],
    tower:   ['黄鹤楼', '从蛇山西麓拾级而上，经过胜像宝塔、三楚一楼牌坊和归鹤池，抵达主楼。楼高五十一点四米，西面顶层悬「黃鶴樓」匾。'],
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
  let activeView = 'core', cameraMode = 'preset', flight = null, flightStart=0;
  // Close-up camera targets use the local axes of the baked Blender meshes.
  const bridgeInscriptions = {
    bridge: { model: bridge, at: V(11.98,10.19,-82), front: V(1,.20,.10), width: 7.4, distance: 13, plate: 'bridge-name' },
    yingwuzhou: { model: yingwuzhou, at: V(0,34.25,1.09), front: V(.12,.07,1), width: 17, distance: 23, plate: 'yingwuzhou-detail' }
  };
  const bridgeCraft = {
    bridge: {
      model: bridge, at: V(5.90,12.57,49.80435), front: V(-1,.19,.19), width: 2.9, distance: 3.35,
      plate: 'bridge-craft', label: '铸铁栏花',
      caption: '荷叶旁，一尾鲤鱼游过铸铁栏板。沿桥再走几步，还能找到花枝上的喜鹊和梅枝下的小鹿。'
    },
    yingwuzhou: {
      model: yingwuzhou, at: V(7.40,10.6,34), front: V(.66,.28,-.70), width: 11.8, distance: 11,
      // Leave the full drop from cable clamp to girder above the desktop navigation.
      landscape: { at: V(7.40,10.3,34), front: V(1,.22,.37), distance: 20 },
      plate: 'yingwuzhou-craft', label: '主缆与吊杆',
      caption: '沿着橙红色主缆找到索夹，顺成对的吊杆向下看，杆脚的锚套和耳板扣在桥面外侧的边梁上。'
    }
  };
  let bridgeCloseView = 'whole';
  let layoutDirty = true, safeRect = null, uiBlocks = [], layoutSignature = '', markFarScale = 1;
  const walkSelect=document.getElementById('walk-view');
  const layout = createMapLayout(() => { layoutDirty = true; }, leaveWalk);
  scene.updateMatrixWorld(true);
  const surveyRadius = Math.hypot(Math.max(-X0, X1), Math.max(-ZTOP, ZBOT));
  const viewBounds = {};
  pickables.forEach(object => { viewBounds[object.userData.focus] = new THREE.Box3().setFromObject(object); });
  viewBounds.home = pickables.filter(object => object.userData.focus !== 'lake')
    .map(object => viewBounds[object.userData.focus]);
  // 从沙湖一带沿原来的 49° 方位俯看。先把街区和湖岸换算到这个机位的右、上、后三轴。
  const portraitHome = orbit({ x: 365, z: -120 }, LAND_Y, 1, 49, 38);
  const portraitTarget = V().copy(portraitHome.target), portraitEye = V().copy(portraitHome.pos);
  const portraitBack = portraitEye.clone().sub(portraitTarget).normalize();
  const mapToView = new THREE.Matrix4().lookAt(portraitEye, portraitTarget, camera.up).setPosition(portraitTarget).invert();
  const portraitSites = LAKE.map(([x, z]) => V(x, LAND_Y, z).applyMatrix4(mapToView));
  const houseKinds = new Set();
  for (const mesh of scene.children) {
    // 同款建筑的各材质批次共用落点。启动时读取完整分布，之后的视锥裁剪不会改变取景。
    if (!mesh.isInstancedMesh || !mesh.name.startsWith('City / ') || houseKinds.has(mesh.name)) continue;
    houseKinds.add(mesh.name);
    for (let i = 0; i < mesh.count; i++) {
      portraitSites.push(V().fromArray(mesh.instanceMatrix.array, i * 16 + 12).applyMatrix4(mesh.matrixWorld).applyMatrix4(mapToView));
    }
  }
  for (const box of viewBounds.home) {
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      portraitSites.push(V(x, y, z).applyMatrix4(mapToView));
    }
  }
  const portraitAimY = .45;
  function portraitHomeView() {
    const width = safeRect.right - safeRect.left, height = safeRect.bottom - safeRect.top;
    const focal = H / (2 * Math.tan(THREE.MathUtils.degToRad(mapFov('home') / 2)));
    const halfWidth = width / 2 - 2, above = height * portraitAimY - 2, below = height * (1 - portraitAimY) - 2;
    let distance = 22;
    for (const { x, y, z } of portraitSites) {
      // 深度为 distance - z；每个点到题头、导览和两侧都再留两像素。
      const depth = focal * Math.max(Math.abs(x) / halfWidth, y / above, -y / below);
      distance = Math.max(distance, z + depth);
    }
    return { target: portraitTarget.clone(), pos: portraitTarget.clone().addScaledVector(portraitBack, distance) };
  }
  // 手动环绕仍可退到容纳整块测绘地形的距离。
  const surveyBounds = new THREE.Box3(V(X0, LAND_Y, ZTOP), V(X1, LAND_Y, ZBOT));
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
  const isFramed = key => layout.compact || (W < H && key === 'home') || (key !== 'home' && key !== 'lake');
  // 以较低的俯角纳入江天地平线，控制近桥的透视变形。
  function mapFov(key) {
    // 两江和黄鹤楼共用镜头，从江面手动回到西园时，同一机位仍指向同一座建筑。
    if (walkSelect.hidden && (key === 'home' || key === 'core' || key === 'tower')) {
      return W < H ? 60 : 50;
    }
    return W / H < .9 ? 52 : 38;
  }
  function viewFor(key) {
    const close = activeView === key && (bridgeCloseView === 'name' ? bridgeInscriptions[key]
      : bridgeCloseView === 'craft' && bridgeCraft[key]);
    if (close) {
      const pose = (!layout.compact && W >= H && close.landscape) || close;
      const target = close.model.localToWorld(pose.at.clone());
      const front = pose.front.clone().applyQuaternion(close.model.quaternion).normalize();
      const halfFov = THREE.MathUtils.degToRad(mapFov(key) / 2);
      const distance = Math.max(pose.distance, close.width * H / (2 * W * Math.tan(halfFov)));
      return { target, pos: target.clone().addScaledVector(front, distance) };
    }
    // 竖屏沿龟蛇两山的轴线取景，让地标前后展开。
    let base = VIEWS[key];
    if (W < H && key === 'core') base = orbit(geo(114.2855, 30.5528), 32, 440, 55, 14);
    if (W < H && key === 'home') return portraitHomeView();
    if (key === 'home' && !layout.compact && safeRect.bottom < H) {
      // 武昌东南街区前排的屋脚对齐导览安全线。沿画面竖轴平移，保留江天地平线。
      const target = V().copy(base.target), pos = V().copy(base.pos).lerp(target, .04);
      const back = pos.clone().sub(target).normalize();
      const up = V(0, 1, 0).projectOnPlane(back).normalize();
      const toFrontRow = gv(114.3594, 30.5080, LAND_Y).sub(pos);
      const depth = -toFrontRow.dot(back);
      const halfHeight = depth * Math.tan(THREE.MathUtils.degToRad(mapFov(key) / 2));
      const safeY = (1 - 2 * safeRect.bottom / H) * halfHeight;
      const lift = toFrontRow.dot(up) - safeY;
      return { pos: pos.addScaledVector(up, lift), target: target.addScaledVector(up, lift) };
    }
    // Look east across the full lake: its long axis fills the vertical page.
    const portraitLake = W < H && key === 'lake';
    if (portraitLake) base = orbit(lakeC, 3, 560, 266, 59);
    if (W < H && key === 'tower') base = orbit(AT.tower, VIEWS.tower.target.y, 100, -66, 18);
    const portraitBridge = key === 'bridge' && W < H;
    const landscapeBridge = key === 'bridge' && !layout.compact && W >= H;
    if (landscapeBridge) base = orbit(AT.bridge, 6.2, 174, 140, 7);
    if (portraitBridge) base = orbit(AT.bridge, 6.2, 174, -100, 8);
    if (!isFramed(key)) return base;
    const bounds = key === 'tower' ? [viewBounds.tower, ...towerPark.assetBounds] : key === 'bridge' ? bridgeBounds : viewBounds[key];
    let fill = .8;
    if (portraitLake) fill = .96;
    if (key === 'honglou' && !layout.compact) fill = .68;
    if (key === 'qc') fill = layout.compact ? .97 : 1.13;
    if (key === 'museum' || key === 'tower' || (key === 'bridge' && !layout.compact)) fill = .97;
    if (layout.compact && (key === 'home' || key === 'bridge')) fill = portraitBridge ? .99 : .92;
    const view = fittedView(base, bounds, safeRect, W, H, mapFov(key), fill);
    if (key === 'core' && !layout.compact && W >= H) {
      // 对准江面，前景鹦鹉洲大桥的桥面和引桥留在导览上方。
      view.target.y -= 31;
      view.pos.y -= 31;
    }
    if (key === 'honglou' && !layout.compact) {
      view.pos.y += 1.8;
      view.target.y += 1.8;
    }
    if (landscapeBridge) {
      // Frame the truss against the river, with Yellow Crane Tower at the left bank.
      const back = view.pos.clone().sub(view.target).normalize();
      const offset = V(0, 1, 0).cross(back).normalize().multiplyScalar(-58);
      offset.y = 13;
      view.pos.add(offset);
      view.target.add(offset);
      // On narrower desktops leave room for the approach on the right.
      const extra = 28 * (1 - THREE.MathUtils.smoothstep(W/H, 1.14, 1.55));
      view.pos.addScaledVector(back, extra);
    }
    if (key === 'qc') {
      // Along the river, keep the pavilion and gate framed below the Guishan podium.
      view.pos.y -= 3.0;
      view.target.y -= 3.0;
    }
    return view;
  }
  function stopFlight() {
    if (flight) { flight.kill(); flight = null; }
    gsap.killTweensOf([camera.position, controls.target, card]);
    card.style.opacity = '1'; card.style.transform = 'none';
  }
  const lens = { fov: camera.fov };
  function moveCamera(view, animate) {
    const fov = view.fov ?? mapFov(activeView);
    if (!animate || reduce) {
      lens.fov = camera.fov = fov;
      camera.updateProjectionMatrix();
      sceneDirty = true;
      camera.position.copy(view.pos); controls.target.copy(view.target); controls.update();
      return;
    }
    flightStart=performance.now();
    flight = gsap.timeline({ paused:true, onUpdate: () => controls.update(),
      onComplete: () => {
        camera.fov = fov;
        camera.updateProjectionMatrix();
        sceneDirty = true;
        flight.kill(); flight = null;
      } });
    flight.to(lens, { fov, duration: 2.6, ease: 'power3.inOut' }, 0)
      .to(camera.position, { ...view.pos, duration: 2.6, ease: 'power3.inOut' }, 0)
      .to(controls.target, { ...view.target, duration: 2.6, ease: 'power3.inOut' }, 0)
      .fromTo(card, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .45 }, 0);
  }
  const walkViews={
    'hy-in':['汉阳 · 茶棚入巷',[-211,3.1,34],[-222,2.52,31.3]],
    'hy-door':['汉阳 · 茶棚后院',[-226.45,2.95,28.45],[-224,1.05,24]],
    'hy-court':['汉阳 · 沿巷小院',[-238.1,3.62,39.15],[-230.4,2.40,44.5]],
    'hy-out':['汉阳 · 回望武汉长江大桥',[-205.3,3.1,35.1],[-81,2.5,-20]],
    'wc-in':['武昌 · 从江岸入里分',[-68.2,3,85],[-57.8,3.55,76.6]],
    'wc-door':['武昌 · 转角公寓',[-46.45,3.42,79.75],[-40.7,2.74,76.4]],
    'wc-court':['武昌 · 灰瓦人家',[-29,4.23,53],[-37,1.72,58.9]],
    'wc-out':['武昌 · 回望鹦鹉洲长江大桥',[-66,3.18,84.4],[-159,17.1,121]],
    'hy-above':['汉阳 · 茶棚与江岸',[-249,53,70],[-200,1,-1]],
    'wc-above':['武昌 · 里分与红桥',[-28,61,44],[-99,6,124]],
  };
  // Portrait entry compositions keep the foreground action inside the narrower field of view.
  const portraitWalkViews={
    'hy-in':[[-207.3,3.4,34.6],[-218.1,1.80,32.47]],
    'wc-in':[[-64.3,3.4,87],[-56.05,2.08,80.37]],
    'wc-door':[[-47.9,3.5,79.6],[-41.65,2.1,75.1]],
    'wc-court':[[-29,4.23,53],[-36.8,1.85,55.8]],
  };
  for (const [name,above] of [['街巷近景',false],['小城沙盘斜俯视',true]]) {
    const group=document.createElement('optgroup');
    group.label=name;
    for (const [key,[label]] of Object.entries(walkViews)) {
      if (key.endsWith('-above')===above) group.append(new Option(label,key));
    }
    walkSelect.append(group);
  }
  let walkReturn;
  function leaveWalk() {
    if (walkSelect.hidden) return;
    walkSelect.hidden=true;
    cameraMode=walkReturn.mode;
    bridgeCloseView=walkReturn.bridgeCloseView;
    layout.setBridgeDetail(bridgeCloseView === 'craft');
    controls.maxPolarAngle=Math.PI*.47;
    controls.minDistance=walkReturn.minDistance;
    controls.maxDistance=walkReturn.maxDistance;
    camera.fov=mapFov(activeView);
    camera.updateProjectionMatrix();
    if (cameraMode==='manual') moveCamera(walkReturn,false);
    else layoutSignature=''; // Refit the preset after the dock has been restored.
    walkReturn=null;
    sceneDirty=true;
    if (location.hash.startsWith('#walk=')) history.replaceState(null,'',location.href.split('#')[0]);
  }
  function visitWalk(key) {
    if (!Object.hasOwn(walkViews,key)) return false;
    if (walkSelect.hidden) walkReturn={
      mode:cameraMode, bridgeCloseView, fov:lens.fov, minDistance:controls.minDistance, maxDistance:controls.maxDistance,
      pos:camera.position.clone(), target:controls.target.clone()
    };
    stopFlight();
    bridgeCloseView='whole'; cameraMode='manual';
    layout.setBridgeDetail(false);
    controls.maxPolarAngle=Math.PI*.55;
    controls.minDistance=22;
    controls.enableDamping=false;
    controls.update();
    layout.setPainting(true,false);
    walkSelect.hidden=false;
    walkSelect.value=key;
    refreshLayout(false);
    const desktopPose=walkViews[key].slice(1);
    const [eye,look]=(camera.aspect<.75 && portraitWalkViews[key]) || desktopPose;
    const position=new THREE.Vector3(...eye);
    const target=new THREE.Vector3(...look).sub(position).setLength(24).add(position);
    moveCamera({pos:position,target},false);
    controls.enableDamping=!reduce;
    sceneDirty=true;
    if (location.hash!=='#walk='+key) history.replaceState(null,'','#walk='+key);
    return true;
  }
  walkSelect.addEventListener('change',()=>visitWalk(walkSelect.value));
  function restoreWalkFromHash(){
    const match=/^#walk=([a-z-]+)$/.exec(location.hash);
    if (match && visitWalk(match[1])) return true;
    if (!walkSelect.hidden) layout.setPainting(false);
    return false;
  }
  window.addEventListener('hashchange',restoreWalkFromHash);
  app.cleanups.push(()=>window.removeEventListener('hashchange',restoreWalkFromHash));
  function flyTo(key, mode = 'whole') {
    if (app.state !== 'ready' || !VIEWS[key]) return;
    if (!walkSelect.hidden) layout.setPainting(false);
    stopFlight();
    // 消除上一次手势的惯性，防止它与新镜头竞争。
    controls.enableDamping = false; controls.update(); controls.enableDamping = !reduce;
    bridgeCloseView = bridgeInscriptions[key] && (mode === 'name' || mode === 'craft') ? mode : 'whole';
    layout.setBridgeDetail(bridgeCloseView === 'craft');
    controls.minDistance = bridgeCloseView === 'craft' ? 2 : bridgeCloseView === 'name' ? 6 : 22;
    activeView = key; cameraMode = 'preset';
    document.body.toggleAttribute('data-poem-rest', true);
    const navKey = ['chutian','xingyin'].includes(key) ? 'lake' : key;
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === navKey)));
    cardTitle.textContent = COPY[key][0];
    cardText.textContent = bridgeCloseView === 'craft' ? bridgeCraft[key].caption
      : bridgeCloseView === 'name' && key === 'bridge'
      ? '桥头堡拱窗上方的六字铭牌为本图游览增设。沿青绿色桁梁望去，上层是公路，下层是双线铁路。'
      : COPY[key][1];
    refreshLayout(false);
    moveCamera(viewFor(key), true);
    if (layout.compact) buttons.find(b => b.dataset.view === navKey).scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  buttons.forEach(b => b.addEventListener('click', () => flyTo(b.dataset.view)));
  document.getElementById('reset-view').addEventListener('click', () => flyTo('home'));
  const atlas = document.getElementById('atlas'), atlasSite = document.getElementById('atlas-site');
  const atlasPlate = document.getElementById('atlas-plate'), detailButton = document.getElementById('atlas-detail');
  const atlasTrigger = document.getElementById('atlas-open');
  const details = { tower: ['tower-plaque','看西面匾额'], bridge: ['bridge-detail','看桥头与桁架'] };
  function atlasView(key) { return key === 'lake' ? 'xingyin' : key; }
  for (const key of Object.keys(LANDMARK_PLATES)) {
    if (COPY[atlasView(key)]) atlasSite.add(new Option(COPY[atlasView(key)][0], key));
  }
  const nameButton = document.getElementById('atlas-name'), locateButton = document.getElementById('atlas-locate');
  const craftButton = document.getElementById('atlas-craft');
  let plateMode = 'whole';
  // The studio renders arrive on a grey cyclorama. Print each one onto the map's paper the
  // first time it opens: the backdrop becomes paper, paint settles to a light wash, value
  // steps become ink lines, and the same fibre runs through it. The original shows meanwhile.
  const printedPlates = new Map();
  function printPlate(key) {
    if (!printedPlates.has(key)) printedPlates.set(key, (async () => {
      const source = new Image();
      source.src = 'data:image/jpeg;base64,' + LANDMARK_PLATES[key];
      await source.decode();
      const w = source.naturalWidth, h = source.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(source, 0, 0);
      const image = context.getImageData(0, 0, w, h), px = image.data;
      const paper = sharedInk.uPaper.value, ink = sharedInk.uInk.value;
      const P = [paper.r * 255, paper.g * 255, paper.b * 255], K = [ink.r * 255, ink.g * 255, ink.b * 255];
      // Backdrop colour from the four corners.
      const backdrop = [0, 0, 0];
      for (const [cx, cy] of [[4, 4], [w - 5, 4], [4, h - 5], [w - 5, h - 5]])
        for (let c = 0; c < 3; c++) backdrop[c] += px[(cy * w + cx) * 4 + c] / 4;
      const lum = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) lum[i] = (.26 * px[i * 4] + .59 * px[i * 4 + 1] + .15 * px[i * 4 + 2]) / 255;
      const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
      const fibre = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, o = i * 4;
        const r = px[o], g = px[o + 1], b = px[o + 2], l = lum[i];
        const off = Math.hypot(r - backdrop[0], g - backdrop[1], b - backdrop[2]);
        const ground = 1 - smooth(10, 34, off);
        // Light wash over the value of the drawing.
        const tone = Math.min(1, l * 1.08 + .05);
        let out = [0, 1, 2].map(c => K[c] + (P[c] - K[c]) * smooth(.04, .96, tone));
        const chroma = [r, g, b].map(v => v - l * 255);
        out = out.map((v, c) => v + chroma[c] * .5);
        // Sobel on value: an ink line wherever the drawing turns.
        let edge = 0;
        if (x > 0 && y > 0 && x < w - 1 && y < h - 1) {
          const L = (dx, dy) => lum[i + dy * w + dx];
          const gx = L(1, -1) + 2 * L(1, 0) + L(1, 1) - L(-1, -1) - 2 * L(-1, 0) - L(-1, 1);
          const gy = L(-1, 1) + 2 * L(0, 1) + L(1, 1) - L(-1, -1) - 2 * L(0, -1) - L(1, -1);
          edge = smooth(.16, .55, Math.hypot(gx, gy)) * (.65 + .35 * fibre(x >> 3, y >> 3));
        }
        const grain = (fibre(x, y) - .5) * 7;
        for (let c = 0; c < 3; c++) {
          let v = out[c] + (K[c] - out[c]) * edge * .82;
          v = v + (P[c] - v) * ground;
          px[o + c] = v + grain;
        }
      }
      context.putImageData(image, 0, 0);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .9));
      const url = URL.createObjectURL(blob);
      app.cleanups.push(() => URL.revokeObjectURL(url));
      return url;
    })().catch(() => null));
    return printedPlates.get(key);
  }
  function showPlate(mode = 'whole') {
    const key = atlasSite.value, detail = details[key], inscription = bridgeInscriptions[key];
    plateMode = mode;
    const detailView = mode === 'detail', nameView = mode === 'name';
    const craft = bridgeCraft[key], craftView = mode === 'craft';
    const plateKey = craftView ? craft.plate : nameView ? inscription.plate : detailView ? detail[0] : key;
    craftButton.hidden = !craft;
    craftButton.textContent = craftView ? '看全貌' : craft ? '看'+craft.label : '';
    craftButton.setAttribute('aria-pressed', String(craftView));
    atlasPlate.alt = COPY[atlasView(key)][0] + ' · ' + (craftView ? craft.label : nameView ? '桥名题字' : detailView ? detail[1].slice(1) : '建筑全貌');
    atlasPlate.src = 'data:image/jpeg;base64,' + LANDMARK_PLATES[plateKey];
    atlasPlate.dataset.plate = plateKey;
    printPlate(plateKey).then(url => {
      if (url && atlasPlate.dataset.plate === plateKey) atlasPlate.src = url;
    });
    detailButton.hidden = !detail;
    detailButton.textContent = detailView ? '看全貌' : detail ? detail[1] : '';
    detailButton.setAttribute('aria-pressed', String(detailView));
    document.getElementById('atlas-note').hidden = !(nameView && key === 'bridge');
    const siteText = COPY[atlasView(key)][1];
    document.getElementById('atlas-caption-text').textContent = craftView ? craft.caption : siteText.split('。')[0] + '。';
    nameButton.hidden = !inscription;
    nameButton.textContent = nameView ? '看全貌' : '看桥名';
    nameButton.setAttribute('aria-pressed', String(nameView));
    locateButton.textContent = craftView ? '在地图中看构件' : nameView ? '在地图中看桥名' : '在地图中查看';
  }
  atlasTrigger.addEventListener('click', event => {
    atlasSite.value = activeView === 'xingyin' ? 'lake' : LANDMARK_PLATES[activeView] ? activeView : 'tower';
    showPlate(bridgeCloseView);
    atlas.showModal();
    // 鼠标打开时把焦点放在册页本身，关闭按钮不亮焦点框；键盘打开仍落在「关闭」上。
    if (event.detail > 0) atlas.focus({ preventScroll: true });
  });
  atlasSite.addEventListener('change', () => showPlate());
  // 册页翻页：按下拉中的景点顺序前后翻，首尾相接；方向键同样可用。
  function turnPage(step) {
    const n = atlasSite.options.length, focused = document.activeElement;
    atlasSite.selectedIndex = (atlasSite.selectedIndex + step + n) % n;
    showPlate();
    // 新景点若没有当前聚焦的视图按钮（细部、构件、桥名），焦点留在册页内。
    if (atlas.contains(focused) && !focused.getClientRects().length) atlas.focus({ preventScroll: true });
  }
  document.getElementById('atlas-prev').addEventListener('click', () => turnPage(-1));
  document.getElementById('atlas-next').addEventListener('click', () => turnPage(1));
  atlas.addEventListener('keydown', event => {
    if (event.target === atlasSite || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      turnPage(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  detailButton.addEventListener('click', () => showPlate(plateMode === 'detail' ? 'whole' : 'detail'));
  craftButton.addEventListener('click', () => showPlate(plateMode === 'craft' ? 'whole' : 'craft'));
  nameButton.addEventListener('click', () => showPlate(plateMode === 'name' ? 'whole' : 'name'));
  document.getElementById('atlas-close').addEventListener('click', () => atlas.close());
  locateButton.addEventListener('click', () => { atlas.close(); flyTo(atlasView(atlasSite.value), plateMode); });
  document.getElementById('atlas-walk').addEventListener('click',()=>{
    atlas.close();
    visitWalk('hy-in');
    walkSelect.focus({preventScroll:true});
  });
  atlas.addEventListener('close', () => {
    if (!atlas.open && walkSelect.hidden && app.state === 'ready') atlasTrigger.focus({ preventScroll: true });
  });
  atlas.addEventListener('click', event => { if (event.target === atlas) {
    const rect = atlas.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) atlas.close();
  } });
  app.cleanups.push(() => { if (atlas.open) atlas.close(); });
  controls.addEventListener('start', () => {
    stopFlight(); cameraMode = 'manual';
    if (bridgeCloseView === 'name') bridgeCloseView = 'whole';
  });
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
    if (restoreWalkFromHash()) return;
    const view = viewFor(activeView);
    moveCamera(view, false);
    if (reduce) return;
    camera.position.sub(controls.target).multiplyScalar(1.35).add(controls.target);
    moveCamera(view, true);
  }

  const overlays = createMapOverlays(camera, controls, flyTo, buttons);

  /* ═════════ 十四、点选 ═════════ */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tip = document.getElementById('tip');
  const sitePickables = [...pickables, ...towerPark.assets];
  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(sitePickables, true)[0];
    if (!hit) return null;
    let o = hit.object; while (o && !o.userData.focus && !o.userData.parkAsset) o = o.parent;
    return o || null;
  }
  let down = null;
  renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    if (moved > 5) return;
    const o = pick(e); if (o) flyTo(o.userData.parkAsset ? 'tower' : o.userData.focus);
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
  const sun = document.getElementById('sun');
  const riverSky=document.getElementById('river-sky');
  riverSky.style.backgroundImage='url('+riverSkyImage+')';
  const farHills = createFarHills(document.getElementById('far-hills'));
  app.cleanups.push(() => farHills.dispose());
  let sunExtent = 1, sunDiameter = 1;
  const riverSun=new THREE.Vector3(-1,.20,.42).normalize(), skyPoint=new THREE.Vector3();
  function sunSlot(preferredX, scale, horizonY) {
    const size = sunDiameter * scale, radius = size / 2;
    const restingTop = (sunExtent - sunDiameter) * scale;
    const columns = [preferredX, radius, W - radius];
    for (const b of uiBlocks) columns.push(b.left - radius - 3, b.right + radius + 3);
    let best = null, distance = Infinity;
    for (const column of columns) {
      const x = THREE.MathUtils.clamp(column, radius, W - radius);
      // 每次横移都重新采样该处山脊，日盘下缘最多入山 15%。
      const ceiling = Math.min(horizonY - size, farHills.ridgeTopAt(x) - .85 * size) - 1;
      if (ceiling < 0) continue;
      const blocks = uiBlocks.filter(b => x + radius + 1 > b.left && x - radius - 1 < b.right);
      const tops = [Math.min(ceiling, restingTop), 0];
      for (const b of blocks) tops.push(b.top - size - 3, b.bottom + 3);
      for (const top of tops) {
        if (top < 0 || top > ceiling || blocks.some(b => top + size + 1 > b.top && top - 1 < b.bottom)) continue;
        const delta = (x - preferredX) ** 2 + (top - restingTop) ** 2;
        if (delta < distance) { best = { x, top }; distance = delta; }
        if (delta === 0) return best;
      }
    }
    return best;
  }
  function fitSunToSky(streetView) {
    // Project a horizontal sightline using the same off-centre lens as the map.
    const lens = camera.projectionMatrix.elements;
    const pitch = Math.PI / 2 - controls.getPolarAngle();
    const horizonY = H * .5 * (1 + lens[9] - lens[5] * Math.tan(pitch));
    const fit = THREE.MathUtils.clamp((horizonY - 8) / sunExtent, 0, 1);
    skyPoint.copy(camera.position).addScaledVector(riverSun,900).project(camera);
    const visible=skyPoint.z<1 && skyPoint.z>-1 ? 1.-THREE.MathUtils.smoothstep(Math.abs(skyPoint.x),.88,1.15) : 0;
    const position=THREE.MathUtils.clamp(50+50*skyPoint.x,-15,115);
    const left = THREE.MathUtils.lerp(64, position, streetView);
    // A distant cinnabar dab sits behind the street, clear of the silhouettes over the water.
    let disc = 1 - .46 * streetView;
    sun.style.setProperty('--sun-presence',((1.-streetView*(1.-visible))*(1.-.54*streetView)).toFixed(3));
    sun.style.setProperty('--sky-fit', fit.toFixed(4));
    // 完全淡出时让日盘收在自身中心，避免 4vh 的亚像素取整把零宽边界推到纸外。
    sun.style.transformOrigin = fit === 0 ? 'center' : '';
    // A continuous angle keeps the cloud banks in place through a complete camera orbit.
    const azimuth=controls.getAzimuthalAngle();
    farHills.update({ horizonY, azimuth, fit, streetView: walkSelect.hidden ? streetView : 1, width: W, height: H, sunDiameter });
    const preferredX = W * left / 100 + sunDiameter / 2;
    let slot = fit > 0 && sunSlot(preferredX, fit * disc, horizonY);
    // 极窄的天际线若被控件占满，缩小朱砂点，保留山脊与纸边间的余地。
    while (fit > 0 && !slot && disc > .01) {
      disc *= .75;
      slot = sunSlot(preferredX, fit * disc, horizonY);
    }
    sun.style.left = ((slot ? slot.x : preferredX) - sunDiameter / 2) + 'px';
    sun.style.setProperty('--sun-disc', disc);
    const shift = slot ? slot.top - (sunExtent - sunDiameter) * fit * disc : 0;
    sun.style.setProperty('--sun-shift', shift + 'px');
    riverSky.style.setProperty('--sky-x',(50+43*Math.sin(azimuth)).toFixed(2)+'%');
    riverSky.style.setProperty('--sky-wash',(fit*(.15+.55*streetView)).toFixed(3));
  }
  function refreshLayout(refit = true) {
    const measured = layout.measure(W, H);
    safeRect = measured.rect; uiBlocks = measured.blocks; layoutDirty = false;
    overlays.invalidate();
    sceneDirty = true; // 字体或控件可改变避让区域，即使安全区四边不动。
    const framed = isFramed(activeView);
    // 竖幅全城把三镇放在导览与题头之间，给横贯画幅的江面留出纵深。
    const portraitOverview = activeView === 'home' && W < H;
    const signature = [framed, portraitOverview, W, H, ...Object.values(safeRect)].join(',');
    if (signature === layoutSignature) return;
    layoutSignature = signature;
    if (framed) {
      const cx = (safeRect.left + safeRect.right) / 2;
      const cy = THREE.MathUtils.lerp(safeRect.top, safeRect.bottom, portraitOverview ? portraitAimY : .5);
      camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
    } else camera.clearViewOffset();
    if (layout.compact || W < H) {
      const home = W < H
        ? fittedView(orbit({ x: 0, z: 0 }, 0, 1, 0, 18), surveyBounds, safeRect, W, H, mapFov('home'), .98)
        : viewFor('home');
      controls.maxDistance = Math.max(2600, home.pos.distanceTo(home.target) * 1.4);
      // 地标牌签仍以建成区的距离分级。
      const landmarkView = W < H
        ? fittedView(VIEWS.home, viewBounds.home, safeRect, W, H, mapFov('home'), .92)
        : home;
      const halfAngle = Math.PI / 360;
      const coverage = landmarkView.pos.distanceTo(landmarkView.target) * Math.tan(mapFov('home') * halfAngle) / Math.tan((W / H < .9 ? 52 : 38) * halfAngle);
      markFarScale = Math.max(1, coverage / 1500);
    } else {
      controls.maxDistance = 2600; markFarScale = 1;
    }
    if (cameraMode === 'manual') controls.maxDistance = Math.max(controls.maxDistance, camera.position.distanceTo(controls.target) + 1);
    if (refit && cameraMode === 'preset') { stopFlight(); moveCamera(viewFor(activeView), false); }
  }
  function resize() {
    if (app.state === 'failed') return;
    W = stage.clientWidth || window.innerWidth; H = stage.clientHeight || window.innerHeight;
    sunDiameter = sun.offsetHeight;
    sunExtent = sun.offsetTop + sunDiameter;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; lens.fov = camera.fov = mapFov(activeView);
    camera.updateProjectionMatrix();
    layoutSignature = '';
    refreshLayout();
  }
  window.addEventListener('resize', resize); resize();

  const clock = new THREE.Clock();
  const lowViewLanes = cityGround.riverfrontPaths.filter(path =>
    path.name?.endsWith('滨水通街支巷') || path.name?.endsWith('后巷步道'));
  // The inland Wuchang threshold and its turning alley open onto an existing cross street.
  const backLaneEnds=lowViewLanes.filter(p=>p.name==='武昌后巷步道').flatMap(p=>[p.a,p.b]);
  for (const street of cityGround.streets) {
    if (!street.group && backLaneEnds.some(p=>distanceToPath(p.x,p.z,street)<street.width/2+.16)) lowViewLanes.push(street);
  }
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
  const projectedDetails = [];
  let streetContours;
  function registerProjectedDetail(node) {
    const { detailSize, detailDepth }=node.userData;
    node.geometry.computeBoundingSphere();
    const sphere=node.geometry.boundingSphere.clone().applyMatrix4(node.matrixWorld);
    projectedDetails.push({node,sphere,detailSize,detailDepth});
  }
  for (const node of scene.children) {
    const { detailSize, detailDepth } = node.userData;
    if (detailSize || detailDepth) registerProjectedDetail(node);
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
    for (const [attribute, label] of [['midGeometry', 'Mid-distance '], ['farGeometry', 'Distant ']]) {
      if (!first.userData[attribute]) continue;
      const distant = group.meshes.map(part => {
        const mesh = new THREE.InstancedMesh(part.userData[attribute], part.material, first.count);
        mesh.name = label + part.name;
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
    // Detail below one raster pixel cannot be seen in a temporary smaller drawing buffer.
    const rasterHeight=Math.min(H,renderer.domElement.height);
    if (previousClip.equals(clipMatrix) && previousHeight === rasterHeight) return;
    previousClip.copy(clipMatrix);
    previousHeight = rasterHeight;
    viewVolume.setFromProjectionMatrix(clipMatrix);
    const clip = clipMatrix.elements;
    const pixelsPerUnit = rasterHeight * camera.projectionMatrix.elements[5];
    // Drop leaf and branch subdivisions before switching to the distant silhouette.
    const fullTreeScale = pixelsPerUnit / 68, midTreeScale = pixelsPerUnit / 18;
    const viewDepth = p => clip[3]*p.x + clip[7]*p.y + clip[11]*p.z + clip[15];
    for (const { node, sphere, detailSize, detailDepth } of projectedDetails) {
      const depth = viewDepth(sphere.center) - sphere.radius;
      node.visible = depth <= (detailDepth ?? detailSize * pixelsPerUnit / 2);
    }
    for (const { batches, spheres, source } of instanceGroups.values()) {
      for (const batch of batches) batch.count = 0;
      for (let i = 0; i < spheres.length; i++) {
        const sphere = spheres[i];
        if (!viewVolume.intersectsSphere(sphere)) continue;
        const depth = viewDepth(sphere.center);
        const lod = batches.length === 1 ? 0 : depth <= sphere.radius * fullTreeScale ? 0
          : depth <= sphere.radius * midTreeScale ? 1 : 2;
        const batch = batches[lod];
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
  // Print every view onto one sheet of paper. The street wash keeps its broken folds;
  // the aerial pass adds a contour line wherever the depth jumps, quiets saturated paint
  // to a mineral wash, and lets the same paper fibre show through models and terrain.
  function inkPrint() {
    const depthReady=renderer.capabilities.isWebGL2 || renderer.extensions.has('WEBGL_depth_texture');
    function makeTarget(multisample) {
      const Target=multisample ? THREE.WebGLMultisampleRenderTarget : THREE.WebGLRenderTarget;
      const buffer=new Target(1,1,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
      if (multisample) buffer.samples=Math.min(4,renderer.capabilities.maxSamples);
      if (depthReady) {
        buffer.depthTexture=new THREE.DepthTexture(1,1);
        buffer.depthTexture.type=THREE.UnsignedIntType;
      }
      return buffer;
    }
    let target=makeTarget(renderer.capabilities.isWebGL2);
    const drawingSize = new THREE.Vector2();
    const material = new THREE.ShaderMaterial({
      defines:depthReady ? {CONTOUR:1} : {},
      uniforms:{drawing:{value:target.texture},depthMap:{value:target.depthTexture},pixel:{value:new THREE.Vector2()},
        strength:{value:1},aerial:{value:1},lineWidth:{value:1},clip:{value:new THREE.Vector2(1,9000)},
        mist:{value:new THREE.Vector2(300,1800)},paper:sharedInk.uPaper,ink:sharedInk.uInk},
      vertexShader:`varying vec2 where;void main(){where=uv;gl_Position=vec4(position.xy,0.,1.);}`,
      fragmentShader:`uniform sampler2D drawing,depthMap;uniform vec2 pixel,clip,mist;uniform float strength,aerial,lineWidth;
        uniform vec3 paper,ink;varying vec2 where;
        float lightness(vec3 color){return dot(color,vec3(.26,.59,.15));}
        float paperValue(vec2 uv){
          vec4 sampleColor=texture2D(drawing,uv);
          return lightness(sampleColor.rgb)+lightness(paper)*(1.-sampleColor.a);
        }
        float grain(vec2 p){
          vec2 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          vec4 v=fract(sin(dot(cell,vec2(127.1,311.7))+vec4(0.,127.1,311.7,438.8))*43758.5453);
          return mix(mix(v.x,v.y,f.x),mix(v.z,v.w,f.x),f.y);
        }
        // Reciprocal depth is linear across any flat face, so its second difference only
        // answers at silhouettes and folds, never along a long receding street or river.
        float nearness(vec2 uv){
          float z=texture2D(depthMap,uv).r;
          if(z>=.99999) return 0.;
          return (clip.y-z*(clip.y-clip.x))/(clip.x*clip.y);
        }
        void main(){
          vec4 original=texture2D(drawing,where);
          if(original.a<.012){gl_FragColor=vec4(0.);return;}
          vec3 color=clamp(original.rgb/max(original.a,.01),0.,1.);
          float l=lightness(color);
          vec2 x=vec2(pixel.x,0.), y=vec2(0.,pixel.y);
          float chroma=max(color.r,max(color.g,color.b))-min(color.r,min(color.g,color.b));
          // 地图视角的街巷墨量为零，跳过对颜色没有贡献的四次采样与纤维噪声。
          if(strength>0.){
            float grain1=grain(gl_FragCoord.xy*.19),grain2=grain(gl_FragCoord.xy*.04);
            float reach=1.05+1.4*grain2;
            float edge=max(max(paperValue(where+x*reach),paperValue(where-x*reach)),
              max(paperValue(where+y*reach),paperValue(where-y*reach)))-l;
            float nib=smoothstep(.035,.23,edge)*(.29+.32*grain1);
            float lift=smoothstep(.26,.82,l);
            float tone=clamp(l*.95 + .16*lift-.088*(1.-lift),0.,1.);
            vec3 halfInk=mix(ink,paper,.36);
            vec3 shade=mix(ink,halfInk,smoothstep(.02,.53,tone));
            vec3 pigment=mix(shade,paper,smoothstep(.37,.94,tone));
            pigment+=(color-vec3(l))*(.71+.33*smoothstep(.08,.32,chroma));
            pigment+=vec3(.022,.025,.023)*(grain1-.5)*smoothstep(.06,.29,l)*(1.-smoothstep(.77,.96,l));
            pigment=mix(pigment,ink,nib*(1.-smoothstep(.74,.94,l)));
            float amount=strength*(.89-.70*smoothstep(.59,.94,l));
            color=mix(color,pigment,amount);
            // Let paper show through broad midtones while leaving a broken ink edge at the folds.
            float wash=smoothstep(.08,.39,l)*(1.-smoothstep(.72,.94,l));
            color=mix(color,paper,wash*strength*(.095+.035*grain2));
            color=mix(color,ink,nib*strength*.93*(1.-smoothstep(.68,.97,l)));
          }

          if(aerial>.001){
            // Mineral wash: gilt, brick and steel keep their hue at the strength of a light
            // colour laid over ink, and every value sinks a little into the warm paper.
            l=lightness(color);
            float vivid=smoothstep(.10,.42,chroma);
            vec3 settled=vec3(l)+(color-vec3(l))*mix(.80,.52,vivid);
            settled=mix(settled,settled*paper/max(lightness(paper),.01),.20);
            settled=mix(settled,paper,.07*smoothstep(.45,.9,l));
            float fibre=grain(gl_FragCoord.xy*.62)*.6+grain(gl_FragCoord.xy*.11)*.4;
            settled*=1.+.045*(fibre-.5);
            color=mix(color,settled,aerial);
          }
          #ifdef CONTOUR
            float here=nearness(where);
            if(here>1./min(mist.y*.86,720.)){
              float depth=1./here;
              // Past a few hundred units a house is only a few pixels wide; outlining it there
              // turns the far shore to grit, so the contour gives way to the wash.
              float fade=(1.-smoothstep(mist.x,mist.y*.86,depth))*(1.-smoothstep(300.,720.,depth));
              float w=lineWidth*(.85+.85*grain(gl_FragCoord.xy*.035+7.));
              vec2 dx=x*w, dy=y*w;
              float bendX=here*2.-nearness(where+dx)-nearness(where-dx);
              float bendY=here*2.-nearness(where+dy)-nearness(where-dy);
              float jump=max(bendX,bendY)/here;
              float contour=smoothstep(.004,.024,jump);
              // A dry brush lifts off the paper now and then; the stroke breaks rather than fades.
              float dry=smoothstep(.18,.52,grain(gl_FragCoord.xy*vec2(.045,.06)+vec2(depth*.01)));
              contour*=fade*(.55+.45*dry);
              float load=mix(.80,.94,1.-smoothstep(.35,.85,l));
              color=mix(color,ink*.82,contour*load);
            }
          #endif
          gl_FragColor=vec4(color*original.a,original.a);
        }`,
      depthTest:false,depthWrite:false,blending:THREE.NoBlending
    });
    const sheet=new THREE.PlaneGeometry(2,2), page=new THREE.Scene(), lens=new THREE.Camera();
    const print=new THREE.Mesh(sheet,material);print.frustumCulled=false;page.add(print);
    function disposeTarget() {
      // r128 已登记的目标会级联 dispose，先摘下深度附件，确保只释放一次。
      const depth = target.depthTexture;
      target.depthTexture = null;
      depth?.dispose();
      target.dispose();
    }
    // renderer.dispose 会清空纹理句柄，先归还印版及其附件。
    app.cleanups.unshift(() => { disposeTarget(); sheet.dispose(); material.dispose(); });
    return (street,aerial)=>{
      const multisample=renderer.capabilities.isWebGL2 && (reduce || !slowRaster);
      if (Boolean(target.isWebGLMultisampleRenderTarget)!==multisample) {
        disposeTarget();
        target=makeTarget(multisample);
        material.uniforms.drawing.value=target.texture;
        material.uniforms.depthMap.value=target.depthTexture;
      }
      renderer.getDrawingBufferSize(drawingSize);
      // Keep the multisampled print within a GPU memory budget a phone can still afford.
      const ratio=Math.min(1,Math.sqrt(4200000/(drawingSize.x*drawingSize.y)));
      target.setSize(Math.max(1,Math.round(drawingSize.x*ratio)),Math.max(1,Math.round(drawingSize.y*ratio)));
      const u=material.uniforms;
      u.pixel.value.set(1/target.width,1/target.height);
      u.strength.value=street;
      u.aerial.value=aerial;
      // About 1.35 CSS pixels of line regardless of device pixel ratio or render scale.
      u.lineWidth.value=Math.max(1,1.35*target.width/Math.max(1,W));
      u.clip.value.set(camera.near,camera.far);
      u.mist.value.set(fogU.uNear.value,fogU.uFar.value);
      renderer.setRenderTarget(target);
      try { renderer.render(scene,camera); }
      finally { renderer.setRenderTarget(null); }
      renderer.render(page,lens);
    };
  }
  let renderInkPrint;
  let renderScale=1, slowFrames=0, fastFrames=0;
  let stillSamples=0, slowRaster=false;
  let lastPaintAt=-Infinity, lastMoveAt=-Infinity, nextPaintAt=-Infinity;
  let samplePaint=false, lastPaintMoving=false, openingPaintUntil=-Infinity;
  const fullPixelRatio=()=>Math.min(window.devicePixelRatio||1,2);
  function paintScale(now,moving) {
    if (reduce) {
      samplePaint=false;
      slowFrames=fastFrames=stillSamples=0;
      return 1;
    }
    if (moving) lastMoveAt=now;
    if (samplePaint) {
      const elapsed=now-lastPaintAt;
      // 只计前一次确实绘出的原尺寸静景。连续两慢帧降级，连续三快帧恢复。
      const fullStill = !document.hidden && !lastPaintMoving && renderer.getPixelRatio() === fullPixelRatio();
      const changingMode = slowRaster ? elapsed < 80 : elapsed > 160;
      stillSamples = fullStill && changingMode ? stillSamples + 1 : 0;
      if (stillSamples === (slowRaster ? 3 : 2)) {
        slowRaster = !slowRaster;
        stillSamples = 0;
      }
      if (lastPaintMoving) {
        slowFrames=elapsed>80 ? slowFrames+1 : 0;
        fastFrames=elapsed<34 ? fastFrames+1 : 0;
        if (slowFrames>=2) {
          renderScale=Math.max(.35,renderScale*(elapsed>210?.59:.78));
          slowFrames=0;
        } else if (fastFrames>=30) {
          renderScale=Math.min(1,renderScale+.12);
          fastFrames=0;
        }
      }
      // Let the browser composite and handle input between unusually expensive rasters.
      nextPaintAt=Math.max(nextPaintAt,elapsed>80 ? now+Math.min(150,elapsed*.29) : now);
      samplePaint=false;
    }
    return moving || now-lastMoveAt<650 ? renderScale : 1;
  }

  function frame(now = performance.now()) {
    if (app.state === 'failed') return;
    try { renderFrame(now); }
    catch (error) { console.error('Map rendering failed:', error); app.fail('三维画面已中断，请重新加载。'); }
  }
  function renderFrame(now) {
    if (!reduce && now<openingPaintUntil) {
      frameId=requestAnimationFrame(frame);
      return;
    }
    if (layoutDirty) refreshLayout();
    // Motion follows the wall clock even when WebGL misses multiple display intervals.
    if (flight) flight.time(Math.max(0,(now-flightStart)/1000));
    const delta = clock.getDelta();
    if (!reduce) sceneTime += Math.min(delta, .1);
    const t = sceneTime;
    weatherU.uTime.value = t;
    mistMats.forEach(m => m.uniforms.uTime.value = t);

    updateVessels(t);

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

    const ground = plantingSurface(camera.position.x, camera.position.z) ?? 0;
    let clearance = 7, laneCloseness = 0;
    if (cameraMode === 'manual' && camera.position.y < ground + clearance) {
      // Lower the camera floor gradually near a lookout so the steps and street can share the foreground.
      for (const lookout of riverfrontLookouts) {
        const radius = Math.hypot(camera.position.x - lookout.x, camera.position.z - lookout.z);
        clearance = Math.min(clearance, 2.2 + 4.8 * THREE.MathUtils.smoothstep(radius, 5, 18));
      }
      for (const lane of lowViewLanes) {
        const fromEdge = distanceToPath(camera.position.x, camera.position.z, lane) - lane.width/2;
        laneCloseness = Math.max(laneCloseness, 1 - THREE.MathUtils.smoothstep(fromEdge, 0, 3.5));
      }
    }
    clearance = Math.min(clearance, 7 - 4.8 * laneCloseness);
    const floorY = ground + clearance;
    if (camera.position.y < floorY) camera.position.y = floorY;
    // At walking height, keep the opposite facade solid while a wall touching the camera still dissolves.
    const streetView = laneCloseness * (1 - THREE.MathUtils.smoothstep(camera.position.y-ground, 3.8, 7));
    streetLight.value=1.-THREE.MathUtils.smoothstep(camera.position.y-ground,24,95);
    if (!streetContours && streetLight.value>.01 &&
        Math.min(Math.hypot(camera.position.x+218,camera.position.z-36),Math.hypot(camera.position.x+62,camera.position.z-80))<100) {
      streetContours=bakeLaneShadows();
      registerProjectedDetail(streetContours);
    }
    controls.maxPolarAngle=Math.PI*THREE.MathUtils.lerp(.47,.55,streetView);
    cityCloseFade.value.set(6 - 5.4*streetView, 14 - 11.5*streetView);
    camU.uCam.value.copy(camera.position);

    const dist = camera.position.distanceTo(controls.target);
    if (bridgeCloseView === 'craft' && cameraMode === 'manual' && dist > 50) {
      bridgeCloseView = 'whole';
      layout.setBridgeDetail(false);
      cardText.textContent = COPY[activeView][1];
    }
    // A high aerial view needs enough depth precision to separate the water and low banks.
    // Limit the near plane by both height and viewing distance when descending or zooming in.
    const clipNear = THREE.MathUtils.clamp(.01 * Math.min(camera.position.y - floorY, dist), .5, 12);
    const streetFov=THREE.MathUtils.lerp(lens.fov,camera.aspect<.9?66:51,streetView*(1.-THREE.MathUtils.smoothstep(dist,32,67)));
    // The ridge is close behind the Red Chamber. Keep the brick facade clear and wash the farther slope.
    const atRedChamber = 1 - THREE.MathUtils.smoothstep(Math.hypot(
      controls.target.x-honglou.position.x, controls.target.z-honglou.position.z), 10, 32);
    const courtyard = atRedChamber * (1-THREE.MathUtils.smoothstep(dist, 120, 220));
    const cityNear = Math.max(55, dist * .45);
    const near = THREE.MathUtils.lerp(cityNear, dist * .88, courtyard);
    fogU.uNear.value = THREE.MathUtils.lerp(near,22,streetView);
    fogU.uFar.value = THREE.MathUtils.lerp(cityNear + Math.max(420, dist * 2.3), dist + 77, courtyard);
    fogU.uFar.value = THREE.MathUtils.lerp(fogU.uFar.value,293,streetView);
    // 近岭比城区更远，保留其山腹墨色；进入街巷时仍随江岸一起入雾。
    ridgeFogFar.value = THREE.MathUtils.lerp(Math.max(fogU.uFar.value, 3400), fogU.uFar.value, streetView);
    scene.fog.near = fogU.uNear.value; scene.fog.far = fogU.uFar.value;

    // 平原随镜头铺至完整雾带。把测绘地块包在不透明区，最外圈才与纸色山脚渐融。
    const halfWidth = Math.tan(THREE.MathUtils.degToRad(streetFov / 2)) * camera.aspect;
    const groundRadius = Math.max(Math.hypot(camera.position.x, camera.position.z) + surveyRadius,
      fogU.uFar.value * Math.hypot(1, halfWidth)) * 1.5;
    water.position.set(camera.position.x, 0, camera.position.z);
    water.scale.set(groundRadius, groundRadius, 1);
    waterU.uPlainRadius.value = groundRadius;
    const clipFar = Math.ceil(Math.hypot(groundRadius, groundRadius, camera.position.y)) + 1;
    if (camera.far !== clipFar || Math.abs(camera.near - clipNear) > .04 || Math.abs(camera.fov-streetFov)>.08) {
      camera.fov=streetFov;
      camera.far = clipFar;
      camera.near = clipNear;
      camera.updateProjectionMatrix();
    }

    controls.update();
    // Follow the target after OrbitControls has applied any damped pan.
    const focusDistance = camera.position.distanceTo(controls.target);
    const overview = THREE.MathUtils.smoothstep(focusDistance, 250, 430);
    const focusInner = Math.max(26, focusDistance * .42) + overview * 600;
    const focusOuter = focusInner + Math.max(68, focusDistance * .76);
    cityFocus.uFocus.value.copy(controls.target);
    cityFocus.uFocusRange.value.set(focusInner, focusOuter);
    cityFocus.uFocusStrength.value = (walkSelect.hidden ? 1 - streetView : 0) * (1 - overview);
    // Reduced motion freezes the water, wind, boats and birds. Repaint the geometry on a
    // camera or layout change; keyboard focus and labels still update independently.
    if (sceneDirty) fitSunToSky(streetView);
    const moving=!!flight || sceneDirty;
    const firstPaint=!reduce && app.state==='loading';
    // Present a real opening frame before queuing full-size animated buffers.
    const scale=firstPaint ? .60 : paintScale(now,moving);
    const ratio=fullPixelRatio()*scale;
    const resolutionDirty=renderer.getPixelRatio()!==ratio;
    // Leave time for pointer/DOM updates on slow rasterizers once the full-size still is restored.
    const idleInterval=renderScale<.85 && scale===1 ? 1200 : 0;
    const readyToPaint=now>=nextPaintAt;
    if (reduce ? sceneDirty || resolutionDirty : readyToPaint &&
        (moving || resolutionDirty || now-lastPaintAt>=idleInterval)) {
      if (resolutionDirty) renderer.setDrawingBufferSize(W,H,ratio);
      prepareBridgeReflections();
      updateLandscapeVisibility();
      renderInkPrint ||= inkPrint();
      renderInkPrint(streetView*.68, 1-streetView);
      lastPaintAt=now;
      lastPaintMoving=moving;
      samplePaint=!firstPaint;
      if (firstPaint) openingPaintUntil=performance.now()+760;
      sceneDirty = false;
    }
    const focusMarks = layout.compact && !['home','core','lake','bridge','yingwuzhou'].includes(activeView) ? .38 : markFarScale;
    overlays.draw(W, H, activeView, uiBlocks, focusMarks);
    frameId = requestAnimationFrame(frame);
  }
  enterScene();
  frame();
  // ?debug 时把内部状态挂出来，供浏览器里核对；正常访问不暴露。就绪与否仍以 app.ready() 置的 window.__ready 为准
  if (/[?&]debug\b/.test(location.search)) window.__dbg = {
    get slowRaster() { return slowRaster; },
    farHills, GEO, LAKES, LAND_HOLES, HILLS, HILL, YZ, HAN, HANKOU, HANYANG, WUCHANG, AT, VIEWS, MARKS: overlays.marks, LABELS: overlays.labels,
    LAND_Y, terrainTop, plantingSurface, cityGround, landmarkGrounds, towerPark, BRIDGES, approachRoads, roadAt, approachHalfWidth, vessels, updateVessels, reliefAt, onLand, inPoly, geo, camera, controls, flyTo, scene
  };
