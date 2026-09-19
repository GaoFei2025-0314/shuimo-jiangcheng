
  /* ═════════ 七、景点落位：各按实测经纬度 ═════════ */
  const pickables = [];
  function place(g, at, scale, ry, name, key, lift) {
    g.scale.setScalar(scale);
    g.position.set(at.x, (lift != null ? lift : terrainTop(at.x, at.z)) - .3, at.z);
    if (ry) g.rotation.y = ry;
    g.userData.focus = key; g.userData.name = name;
    pickables.push(g); scene.add(g);
    return g;
  }
  // 大桥轴线：武昌蛇山头 → 汉阳龟山东麓
  const bA = geo(114.2945, 30.5455), bB = geo(114.2810, 30.5540);
  const bridge  = place(buildBridge(), AT.bridge, .74, Math.atan2(bB.x - bA.x, bB.z - bA.z), '武汉长江大桥', 'bridge', 0);
  const tower   = place(buildTower(), AT.tower, .88, .18, '黄鹤楼', 'tower');
  const tv      = place(buildTV(), AT.tv, 1.5, 0, '龟山电视塔', 'tv');
  const qc      = place(buildQingchuan(), AT.qc, .92, Math.PI / 2, '晴川阁', 'qc');
  const customs = place(buildCustoms(), AT.customs, .98, Math.PI / 2, '江汉关', 'customs');
  const wuda    = place(buildWuda(), geo(114.3625, 30.5397), .74, .1, '武大 · 老斋舍', 'wuda');
  const chutian = place(buildChutian(), AT.chutian, .82, 0, '东湖 · 楚天台', 'chutian');
  // 东湖水面本身也可点选
  const lakePick = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(LAKE.map(p => new THREE.Vector2(p[0], -p[1])))), new THREE.MeshBasicMaterial({ visible: false }));
  lakePick.rotation.x = -Math.PI / 2; lakePick.position.y = .05;
  lakePick.userData.focus = 'lake'; lakePick.userData.name = '东湖';
  pickables.push(lakePick); scene.add(lakePick);

  /* ── 东湖绿道：沿岸一圈淡墨 ── */
  {
    const pts = LAKE.map(p => new THREE.Vector3(lakeC.x + (p[0] - lakeC.x) * .962, LAND_Y + .12, lakeC.z + (p[1] - lakeC.z) * .962));
    const road = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), lineSoft);
    road.raycast = function () {}; scene.add(road);
  }

  /* ═════════ 八、草木：山上松柏，磨山与武大的樱 ═════════ */
  const pines = new Acc(), sakBloom = new Acc(), sakTrunk = new Acc();
  const ICO = new THREE.IcosahedronGeometry(1, 1);
  function pine(x, y, z, s) {
    for (let k = 0; k < 3; k++) pines.cone(s * (.78 - k * .22), s * 1.45, x, y + s * (.35 + k * .88), z, UP);
    pines.cyl(.07 * s, .7 * s, x, y + s * .3, z);
  }
  function sakura(x, y, z, s) {
    sakTrunk.cyl(.15 * s, 1.5 * s, x, y + .7 * s, z);
    [[0, 2.1, 0, 1.15], [.75, 1.75, .4, .85], [-.7, 1.65, -.3, .8], [.1, 2.7, .25, .72], [-.2, 1.5, .8, .7]]
      .forEach(b => sakBloom.place(ICO, x + b[0] * s, y + b[1] * s, z + b[2] * s, b[3] * s, b[3] * s * .82, b[3] * s, 0));
  }
  const KEEP = [AT.tower, AT.tv, AT.qc, AT.chutian, geo(114.3625, 30.5397)];
  const clearOf = (x, z, r) => KEEP.every(k => (k.x - x) ** 2 + (k.z - z) ** 2 > r * r);
  const CORE = geo(114.2950, 30.5600);
  function dressRidge(r, n, kind, s0) {
    for (let i = 0; i < n; i++) {
      const u = (rnd() * 2 - 1) * .92, v = (rnd() * 2 - 1) * .92;
      if (u * u + v * v > .88) continue;
      const x = r.cx + u * r.L * ((r.mesh.rotation.y !== 0) ? Math.cos(r.mesh.rotation.y) : 1) - v * r.w * (-Math.sin(r.mesh.rotation.y));
      const z = r.cz - u * r.L * Math.sin(r.mesh.rotation.y) + v * r.w * Math.cos(r.mesh.rotation.y);
      const y = terrainTop(x, z);
      if (y < LAND_Y + 1 || !clearOf(x, z, 16)) continue;
      const s = s0 * (.55 + rnd() * 1.05);
      if (kind === 'p') pine(x, y, z, s); else sakura(x, y, z, s);
    }
  }
  dressRidge(SHESHAN, 150, 'p', 1.5);
  dressRidge(GUISHAN, 150, 'p', 1.5);
  dressRidge(MOSHAN, 130, 'p', 1.5);
  dressRidge(MOSHAN, 90, 's', 1.4);          // 磨山樱园
  dressRidge(LUOJIA, 90, 'p', 1.4);
  dressRidge(SHIZI, 60, 's', 1.3);           // 武大樱顶
  ridges.slice(5).forEach(r => dressRidge(r, 70, 'p', 1.4));
  {                                           // 武大樱花大道
    const a = geo(114.3585, 30.5392), b = geo(114.3672, 30.5408);
    for (let i = 0; i <= 26; i++) {
      const t = i / 26, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, s = (i % 2 ? 1 : -1) * 4.5;
      sakura(x + s * .2, terrainTop(x + s * .2, z + s), z + s, 1.3 + rnd() * .5);
    }
  }
  scene.add(pines.mesh(M.pine, false), sakTrunk.mesh(brushMat, false), sakBloom.mesh(M.sakura, false));

  /* ═════════ 九、三镇市廛 ═════════ */
  const townW = new Acc(), townR = new Acc();
  function town(lon0, lon1, lat0, lat1, count, tall) {
    for (let i = 0; i < count; i++) {
      const p = geo(lon0 + rnd() * (lon1 - lon0), lat0 + rnd() * (lat1 - lat0));
      if (!onLand(p.x, p.z) || terrainTop(p.x, p.z) > LAND_Y + 1.2 || !clearOf(p.x, p.z, 46)) continue;
      const far = Math.hypot(p.x - CORE.x, p.z - CORE.z);
      if (rnd() > 1.15 - far / 900) continue;                       // 近江稠密，远郊疏落
      const k = Math.max(.45, 1.15 - far / 700);
      const w = (2.2 + rnd() * 3.4) * k, d = (2.2 + rnd() * 3.4) * k, h = (1.8 + Math.pow(rnd(), 2.5) * tall) * k;
      townW.box(w, h, d, p.x, LAND_Y + h / 2, p.z);
      if (h < 5.5) townR.geo(roofGeo(Math.max(w, d) * .60, .18, .9, .12, 6, 2), p.x, LAND_Y + h, p.z);
      else townW.box(w * 1.08, .3, d * 1.08, p.x, LAND_Y + h + .15, p.z);
    }
  }
  town(114.2520, 114.3300, 30.5730, 30.6300, 520, 30);   // 汉口
  town(114.2420, 114.2880, 30.5250, 30.5670, 320, 20);   // 汉阳
  town(114.2970, 114.3560, 30.5180, 30.5780, 420, 26);   // 武昌
  town(114.3520, 114.4200, 30.4900, 30.5240, 180, 20);   // 南湖 · 光谷
  town(114.3400, 114.4050, 30.5950, 30.6280, 160, 18);   // 青山
  town(114.2100, 114.2520, 30.5650, 30.6150, 130, 14);   // 汉口西
  scene.add(townW.mesh(M.town, true, 32, townLineA, townLineB), townR.mesh(M.townRoof, true, 24, townLineA, townLineB));

  {   // 汉口江滩：护岸与路灯，江汉关就立在岸上
    const B = new Acc(), L = new Acc();
    for (let i = 8; i < 60; i++) {
      const s = YZ.s[i], nx = s.d.z, nz = -s.d.x, Ln = Math.hypot(nx, nz) || 1;
      const x = s.p.x + nx / Ln * (s.w - .9), z = s.p.z + nz / Ln * (s.w - .9);
      if (!inPoly(HANKOU, x, z)) continue;
      B.box(6, 1.2, 5.2, x, LAND_Y - .1, z, Math.atan2(s.d.x, s.d.z));
      if (i % 3 === 0) { L.cyl(.09, 4.2, x, LAND_Y + 2.1, z); L.box(.7, .22, .7, x, LAND_Y + 4.3, z); }
    }
    scene.add(B.mesh(M.pale, true, 32), L.mesh(brushMat, false));
  }

  /* ═════════ 十、江上舟船 ═════════ */
  const riverBoats = [
    { m: cargoShip(),  t: .44, v: .0022,  off:  18, s: 1.5 },
    { m: riverLiner(), t: .60, v: -.0018, off: -20, s: 1.4 },
    { m: junk(),       t: .36, v: .0014,  off: -26, s: 1.2 },
    { m: sampan(),     t: .52, v: -.0011, off:  28, s: 1.1 }
  ];
  riverBoats.forEach((b, i) => { b.m.scale.setScalar(b.s); b.i = i; scene.add(b.m); });
  const lakeBoats = [
    { m: junk(),   a: .7, k: .42, sp: .045, s: 1.1 },
    { m: sampan(), a: 3.4, k: .30, sp: -.035, s: 1.0 }
  ];
  lakeBoats.forEach((b, i) => { b.m.scale.setScalar(b.s); b.i = 4 + i; scene.add(b.m); });

  /* ═════════ 十一、江上飞鸟：几笔浓墨 ═════════ */
  const birds = [];
  {
    // 一翅一笔：自翅根起笔，向翅尖渐渐提锋收细，略带后掠与上扬
    const wingGeo = (() => {
      const seg = 7, pos = [], idx = [];
      for (let k = 0; k <= seg; k++) {
        const t = k / seg;
        const hw = .27 * Math.pow(1 - t, 1.5) + .012;     // 由按到提
        const y = Math.pow(t, 1.7) * .34;                 // 翅尖上扬
        const sw = Math.pow(t, 1.5) * .30;                // 后掠
        pos.push(t, y, sw - hw, t, y, sw + hw);
      }
      for (let k = 0; k < seg; k++) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx); g.computeVertexNormals();
      return g;
    })();
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group(), span = 2.0 + rnd() * 1.3;
      [-1, 1].forEach(s => {
        const w = new THREE.Mesh(wingGeo, brushMat);
        w.scale.set(span * s, span * .9, span); g.add(w);
        g.userData['w' + (s > 0 ? 1 : 0)] = w;
      });
      g.userData.ph = rnd() * 6.28; g.userData.flap = 1.8 + rnd() * 1.4;
      birds.push({ g, r: 260 + rnd() * 300, y: 178 + rnd() * 120, a: rnd() * 6.28, sp: .026 + rnd() * .020, tilt: (rnd() - .5) * .22 });
      scene.add(g);
    }
  }

  /* ═════════ 十二、烟波 ═════════ */
  const mistMats = [];
  function mist(y, w, d, x, z, speed, alpha) {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uPaper: { value: PAPER }, uSpeed: { value: speed }, uAlpha: { value: alpha }, uSeed: { value: rnd() * 20 } },
      vertexShader: `varying vec2 vUv; varying float vD;
        void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: NOISE + `
        uniform float uTime, uSpeed, uAlpha, uSeed; uniform vec3 uPaper;
        varying vec2 vUv; varying float vD;
        void main(){
          float e = smoothstep(0.,.4,vUv.x) * smoothstep(1.,.6,vUv.x) * smoothstep(0.,.4,vUv.y) * smoothstep(1.,.6,vUv.y);
          float n = fbm(vUv * vec2(5., 2.4) + vec2(uTime * .012 * uSeed * 0. + uTime * .012 * uSpeed + uSeed, 0.));
          float far = smoothstep(70., 340., vD);            // 近处不起雾
          gl_FragColor = vec4(uPaper, smoothstep(.34, .82, n) * e * uAlpha * far);
        }`
    });
    mistMats.push(mat);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.renderOrder = 3;
    m.raycast = function () {}; scene.add(m);
  }
  mist(5,  1500, 420, -120,  300,  1.0, .26);
  mist(14, 1700, 460,  180, -280, -.7, .22);
  mist(26, 1500, 420, -260, -100,  .6, .20);
  mist(8,   900, 360,  780,   40, -.5, .24);   // 东湖
  mist(46, 2600, 900,  200, -900,  .4, .34);   // 远岸
  mist(42, 2600, 900,  200, 1060, -.35, .34);
