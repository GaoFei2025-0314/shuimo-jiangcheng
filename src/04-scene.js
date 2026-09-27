
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
  const bA = geo(114.28875, 30.54835), bB = geo(114.27525, 30.55685);   // 随桥心一并平移，桥向与桥长不变
  const bridge  = place(buildBridge(), AT.bridge, .74, Math.atan2(bB.x - bA.x, bB.z - bA.z), '武汉长江大桥', 'bridge', 0);
  const tower   = place(buildTower(), AT.tower, .88, .18, '黄鹤楼', 'tower');
  const tv      = place(buildTV(), AT.tv, 1.5, 0, '龟山电视塔', 'tv');
  const qc      = place(buildQingchuan(), AT.qc, .92, Math.PI / 2, '晴川阁', 'qc');
  const customs = place(buildCustoms(), AT.customs, .98, Math.PI / 2, '江汉关', 'customs');
  const wuda    = place(buildWuda(), AT.wuda, .74, .1, '武大 · 老斋舍', 'wuda');
  const chutian = place(buildChutian(), AT.chutian, .82, 0, '东湖 · 楚天台', 'chutian');
  const hongshan   = place(buildPagoda(), AT.hongshan, .74, 0, '洪山宝塔 · 宝通禅寺', 'hongshan');
  const watertower = place(buildWaterTower(), AT.watertower, .82, 0, '汉口水塔', 'watertower');
  const museum     = place(buildMuseum(), AT.museum, .78, 0, '湖北省博物馆', 'museum');
  const honglou    = place(buildHonglou(), AT.honglou, .8, 0, '红楼', 'honglou');
  const guiyuan    = place(buildGuiyuan(), AT.guiyuan, .7, 0, '归元禅寺', 'guiyuan');
  const qintai     = place(buildQintai(), AT.qintai, .7, -Math.PI / 2, '古琴台', 'qintai');   // 台面朝西，对着月湖
  // 鹦鹉洲大桥：沿 OSM 桥向（原两端点连线并非江岸），两端各在水体掩膜江面之外 150 米落岸，桥长随之
  const yA = geo(114.26637, 30.53657), yB = geo(114.28587, 30.52963);
  const yingwuzhou = place(buildSuspension(Math.hypot(yB.x - yA.x, yB.z - yA.z) / 2), AT.yingwuzhou, 1,
    Math.atan2(yB.x - yA.x, yB.z - yA.z), '鹦鹉洲长江大桥', 'yingwuzhou', 0);
  // 东湖水面本身也可点选
  const lakePick = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(LAKE.map(p => new THREE.Vector2(p[0], -p[1])))), new THREE.MeshBasicMaterial({ visible: false }));
  lakePick.rotation.x = -Math.PI / 2; lakePick.position.y = .05;
  lakePick.userData.focus = 'lake'; lakePick.userData.name = '东湖';
  pickables.push(lakePick); scene.add(lakePick);

  /* ── 东湖绿道：沿岸一圈淡墨 ── */
  {
    // 沿岸线向湖内收：真实湖岸有凹有凸，不能再按湖心等比缩。收进量本应固定 4，但岸线
    // 打结处（局部转弯半径小于收进量）会把偏移折线收出自交的小环，所以按局部曲率限一
    // 限：半径取相邻 ±3 点的外接圆估计，只在岸线朝收进方向弯曲（外心在收进一侧，说明
    // 再收下去会穿过去）时收紧到 0.8 倍半径，其余仍收 4；万一还剩打结，直接切掉夹在
    // 中间的那一小环。
    const n = LAKE.length, sg = LAKE.reduce((s, p, i) => s + p[0] * LAKE[(i + 1) % n][1] - LAKE[(i + 1) % n][0] * p[1], 0) > 0 ? 1 : -1;
    const normal = i => {                                 // 该点的内收方向（单位向量）
      const a = LAKE[(i + n - 1) % n], b = LAKE[(i + 1) % n], tx = b[0] - a[0], tz = b[1] - a[1], L = Math.hypot(tx, tz) || 1;
      return [-sg * tz / L, sg * tx / L];
    };
    const circumcenter = (a, b, c) => {                   // 三点外接圆心，共线则无解
      const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
      if (Math.abs(d) < 1e-9) return null;
      const a2 = a[0] * a[0] + a[1] * a[1], b2 = b[0] * b[0] + b[1] * b[1], c2 = c[0] * c[0] + c[1] * c[1];
      return [(a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d,
              (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d];
    };
    const insets = LAKE.map((p, i) => {
      const cc = circumcenter(LAKE[(i - 3 + n) % n], p, LAKE[(i + 3) % n]);
      if (!cc) return 4;
      const [ox, oz] = normal(i), R = Math.hypot(cc[0] - p[0], cc[1] - p[1]);
      return (cc[0] - p[0]) * ox + (cc[1] - p[1]) * oz > 0 ? Math.min(4, Math.max(.5, .8 * R)) : 4;
    });
    let pts = LAKE.map((p, i) => { const [ox, oz] = normal(i); return [p[0] + ox * insets[i], p[1] + oz * insets[i]]; });

    const segX = (a1, a2, b1, b2) => {                    // 严格线段相交，返回交点或 null
      const dax = a2[0] - a1[0], daz = a2[1] - a1[1], dbx = b2[0] - b1[0], dbz = b2[1] - b1[1];
      const den = dax * dbz - daz * dbx;
      if (Math.abs(den) < 1e-9) return null;
      const t = ((b1[0] - a1[0]) * dbz - (b1[1] - a1[1]) * dbx) / den, u = ((b1[0] - a1[0]) * daz - (b1[1] - a1[1]) * dax) / den;
      return (t > 0 && t < 1 && u > 0 && u < 1) ? [a1[0] + t * dax, a1[1] + t * daz] : null;
    };
    for (let guard = 0; guard < 20; guard++) {            // 逐轮找相交的两条边，先切最短的那一小环
      const m = pts.length; let hit = null;
      for (let i = 0; i < m; i++) for (let j = i + 2; j < m; j++) {
        if (i === 0 && j === m - 1) continue;             // 首尾相邻，不算相交
        const P = segX(pts[i], pts[(i + 1) % m], pts[j], pts[(j + 1) % m]);
        if (P && (!hit || j - i < hit.j - hit.i)) hit = { i, j, P };
      }
      if (!hit) break;
      pts = pts.slice(0, hit.i + 1).concat([hit.P], pts.slice(hit.j + 1));   // 用交点取代夹在中间的一段，切掉小环
    }

    const road = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p[0], LAND_Y + .12, p[1]))), lineSoft);
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
  const KEEP = [AT.tower, AT.tv, AT.qc, AT.chutian, AT.wuda];
  // 新景点各按自身占地避让，不随调用方的半径——汉口水塔若按市廛的 46 单位清场，汉口就被掏空了
  const KEEP2 = [[AT.hongshan, 22], [AT.watertower, 12], [AT.museum, 34], [AT.honglou, 26], [AT.guiyuan, 36], [AT.qintai, 20]];
  const clearOf = (x, z, r) => KEEP.every(k => (k.x - x) ** 2 + (k.z - z) ** 2 > r * r)
    && KEEP2.every(([k, rr]) => (k.x - x) ** 2 + (k.z - z) ** 2 > rr * rr);
  const CORE = geo(114.2950, 30.5600);
  // 在山的格子里撒点，只留起伏超过 3 个单位的（真在山上，不在山脚水边）。密度按格子面积，
  // 无名山只按约三分之一的密度种，免得抢了主山的戏
  function dressHill(h, kind, s0, density, keep) {
    if (!h) return;                                                          // 数据重生成后山名若变了，不至于整页出错
    const n = Math.round((h.x1 - h.x0) * (h.z1 - h.z0) / 55 * (density || 1) * (h.name ? 1 : .35));
    for (let i = 0; i < n; i++) {
      const x = h.x0 + rnd() * (h.x1 - h.x0), z = h.z0 + rnd() * (h.z1 - h.z0);
      if (sampleField(h.f, x, z) < 3 || !clearOf(x, z, 22) || (keep && !keep(x, z))) continue;   // 22：盖住电视塔 30×30 台座的四角
      const y = terrainTop(x, z) - .3, s = s0 * (.55 + rnd() * 1.05);        // 网格线性、terrainTop 双三次，树根最多悬空 0.6，略沉入地面
      if (kind === 'p') pine(x, y, z, s); else sakura(x, y, z, s);
    }
  }
  const WUDA_AT = AT.wuda;
  dressHill(HILL['蛇山'], 'p', 1.5);
  dressHill(HILL['龟山'], 'p', 1.5);
  dressHill(HILL['磨山'], 'p', 1.5);
  dressHill(HILL['磨山'], 's', 1.4, .6);                                    // 磨山樱园
  dressHill(HILL['珞珈山'], 'p', 1.4);
  dressHill(HILL['珞珈山'], 's', 1.3, 1, (x, z) => (x - WUDA_AT.x) ** 2 + (z - WUDA_AT.z) ** 2 < 32 * 32);   // 武大樱顶
  HILLS.filter(h => !['蛇山', '龟山', '磨山', '珞珈山'].includes(h.name)).forEach(h => dressHill(h, 'p', 1.4));
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

  {   // 汉口江滩：汉水口以下的长江西岸，护岸与路灯，江汉关就立在岸上
    const B = new Acc(), L = new Acc(), latOf = z => O[1] - z * MPU / M_LAT;
    for (let i = 0; i < YZ.s.length; i++) {
      const s = YZ.s[i], nx = s.d.z, nz = -s.d.x, Ln = Math.hypot(nx, nz) || 1;
      const x = s.p.x + nx / Ln * (s.w - .9), z = s.p.z + nz / Ln * (s.w - .9), lat = latOf(z);
      if (lat < 30.566 || lat > 30.600 || !inPoly(HANKOU, s.p.x + nx / Ln * (s.w + 2), s.p.z + nz / Ln * (s.w + 2))) continue;   // 护岸骑在水线上，取岸上 2 个单位处判定是否属汉口
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
    { m: junk(),   a: .7, k: .92, sp: .045, s: 1.1 },
    { m: sampan(), a: 3.4, k: .62, sp: -.035, s: 1.0 }
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
