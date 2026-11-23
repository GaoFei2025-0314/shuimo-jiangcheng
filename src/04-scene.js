
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
  const bridge  = place(builtLandmark('bridge'), AT.bridge, bridgeScale, bridgeAngle, '武汉长江大桥', 'bridge', 0);
  bridge.scale.z = bridgeScale * bridgeLengthRatio;
  {
    const material = inkMat(.28, false, ['#75766d', '#b8b2a2']);
    for (const [side, rows] of approachLinks.entries()) {
      const vertices = [], indices = [];
      for (let i = 0; i < rows.length; i++) {
        const p = rows[i];
        const a = i === 0 ? approachRoads[side][bridgeDeckEnd-73] : rows[i-1];
        const b = i === 0 ? rows[0] : rows[Math.min(rows.length-1,i+1)];
        const dx = b.x-a.x, dz = b.z-a.z, length = Math.hypot(dx,dz);
        const half = THREE.MathUtils.lerp(approachHalfWidth, 1.23, i/(rows.length-1));
        for (const direction of [-1,1])
          vertices.push(p.x+direction*dz/length*half, p.y, p.z-direction*dx/length*half);
        if (i) {
          const k = i*2;
          indices.push(k-2,k,k-1,k-1,k,k+1);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3));
      geometry.setIndex(indices); geometry.computeVertexNormals();
      const road = new THREE.Mesh(geometry, material);
      road.name = side === 0 ? '武昌引道 · 接地铺装' : '汉阳引道 · 接地铺装';
      road.userData.landscapeSurface = { group: '武汉长江大桥', name: road.name, material: 'ApproachPaving' };
      scene.add(road);
    }
  }
  const tower   = place(builtLandmark('tower'), AT.tower, .88, .18, '黄鹤楼', 'tower');
  summitGround(tower, 12.1, 17.4, 17.4, 13.5, -.78);
  { // 两处楼梯在山肩上接短转折梯，薄石面随土坡降到原地面。
    tower.updateMatrixWorld(true);
    const ground = (x, z) => {
      const p = tower.localToWorld(V(x, 0, z));
      return (plantingSurface(p.x, p.z) - tower.position.y) / tower.scale.y;
    };
    const stone = new Acc();
    function stoneCourse(x, z, width, depth, top) {
      const heights = [-1, 1].flatMap(i => [-1, 1].map(j => ground(x+i*width/2, z+j*depth/2)));
      const tread = Math.max(top, ...heights.map(h => h+.09));
      const foot = Math.min(tread-.20, ...heights) - .06;
      stone.box(width, tread-foot, depth, x, (tread+foot)/2, z);
    }
    for (const side of [-1, 1]) {
      stoneCourse(0, side*15.58, 6.54, 4.25, .06);
      const z = side*16.2, width = 3.06, run = 13, start = 3.27;
      const toe = ground(side*(start+run), z)+.08;
      const count = Math.max(3, Math.ceil(Math.abs(.06-toe)/.27));
      for (let i = 0; i < count; i++) {
        const t = (i+1)/count, x = side*(start+(i+.5)*run/count);
        stoneCourse(x, z, run/count, width, .06 + (toe-.06)*t);
      }
    }
    const terrace = stone.mesh(M.bankPath, false);
    terrace.name = '蛇山石阶与转折步道';
    terrace.userData.keepTreesClear = true;
    terrace.userData.landscapeSurface = { group: '蛇山', name: terrace.name, material: 'Path' };
    terrace.applyMatrix4(tower.matrixWorld);
    scene.add(terrace);
  }
  const tv      = place(builtLandmark('tv'), AT.tv, 1.5, 0, '龟山电视塔', 'tv');
  const qc      = place(builtLandmark('qc'), AT.qc, .92, Math.PI / 2, '晴川阁', 'qc');
  const customs = place(builtLandmark('customs'), AT.customs, .98, Math.PI / 2, '江汉关', 'customs');
  // The three archways face downhill; their toe meets the graded campus apron.
  const wuda    = place(builtLandmark('wuda'), AT.wuda, .74, Math.PI-.08, '武大 · 老斋舍', 'wuda');
  summitGround(wuda, 25, 7.8, 8.5, 16.5, -.42);
  const xingyin = place(builtLandmark('lake'), AT.xingyin, .34, -.35, '东湖 · 行吟阁', 'xingyin', .45);
  xingyin.scale.y = .42; // 在狭小的湖岛上保留三层楼阁的宽高关系。
  const chutian = place(builtLandmark('chutian'), AT.chutian, .82, 0, '东湖 · 楚天台', 'chutian');
  // Blend a grass shoulder under each footing without burying the entrance steps.
  function summitGround(site, halfWidth, back, front, margin, baseLocal) {
    const divisions = 32, vertices = [], points = [], indices = [], raised = [];
    const base = site.position.y + site.scale.y*baseLocal;
    const bridgeAxis = new THREE.Vector2(bB.x-bA.x,bB.z-bA.z).normalize();
    site.updateMatrixWorld(true);
    for (let row = 0; row <= divisions; row++) for (let col = 0; col <= divisions; col++) {
      const x = (2*col/divisions-1)*(halfWidth+margin);
      const z = -back-margin + row/divisions*(back+front+2*margin);
      const { x: wx, z: wz } = site.localToWorld(V(x,0,z));
      const ground = terrainTop(wx,wz)-.036;
      const distance = Math.hypot(Math.max(0,Math.abs(x)-halfWidth), Math.max(0,-z-back,z-front));
      const dx = wx-AT.bridge.x, dz = wz-AT.bridge.z;
      const along = dx*bridgeAxis.x+dz*bridgeAxis.y, across = dx*bridgeAxis.y-dz*bridgeAxis.x;
      // Keep the bridgehead faces and both approach carriageways clear of added soil.
      const bridgeClearance = Math.max(THREE.MathUtils.smoothstep(Math.abs(across), 6, 14),
        THREE.MathUtils.smoothstep(Math.abs(along), 51, 55));
      const fill = onLand(wx,wz) ? Math.max(0,base-ground) * bridgeClearance *
        (1-THREE.MathUtils.smoothstep(distance,0,margin)) : 0;
      const height = cutForApproach(wx,wz,ground+fill);
      const point = [wx, height, wz];
      points.push(point); vertices.push(...point);
      raised.push(height-ground > .045);
    }
    for (let row = 0; row < divisions; row++) for (let col = 0; col < divisions; col++) {
      const a = row*(divisions+1)+col, b = a+1, c = a+divisions+1, d = c+1;
      for (const tri of [[a,c,b], [b,c,d]])
        if (tri.some(i => raised[i]) && triangleOnLand(...tri.map(i => points[i]))) indices.push(...tri);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const bank = new THREE.Mesh(geometry,M.hill);
    bank.name = site.userData.name+' · 山肩';
    bank.userData.landscapeSurface = { group: '山林', name: bank.name, material: 'Hills' };
    bank.raycast = function () {};
    registerPlantingSurface(geometry);
    scene.add(bank);
  }
  summitGround(tv, 9.5, 10.8, 9.5, 15.5, -.34);
  summitGround(chutian, 14.5, 26.7, 14.3, 16.2, -.38);
  const hongshan   = place(builtLandmark('hongshan'), AT.hongshan, .74, 0, '洪山宝塔 · 宝通禅寺', 'hongshan');
  const watertower = place(builtLandmark('watertower'), AT.watertower, .82, 0, '汉口水塔', 'watertower');
  const museum     = place(builtLandmark('museum'), AT.museum, .78, 0, '湖北省博物馆', 'museum');
  const honglou    = place(builtLandmark('honglou'), AT.honglou, .8, 0, '红楼', 'honglou');
  summitGround(honglou, 23, 9.8, 12, 10.6, -.53);
  const guiyuan    = place(builtLandmark('guiyuan'), AT.guiyuan, .7, 0, '归元禅寺', 'guiyuan');
  const qintai     = place(builtLandmark('qintai'), AT.qintai, .7, -Math.PI / 2, '古琴台', 'qintai');   // 台面朝西，对着月湖
  // 鹦鹉洲大桥：沿 OSM 桥向（原两端点连线并非江岸），两端各在水体掩膜江面之外 150 米落岸，桥长随之
  const yA = geo(114.26637, 30.53657), yB = geo(114.28587, 30.52963);
  const yingwuzhou = place(builtLandmark('yingwuzhou'), AT.yingwuzhou, 1,
    Math.atan2(yB.x - yA.x, yB.z - yA.z), '鹦鹉洲长江大桥', 'yingwuzhou', 0);
  yingwuzhou.scale.z = Math.hypot(yB.x - yA.x, yB.z - yA.z) / 200;
  // 两座大桥桥面之下不起楼、不种树：离桥轴 12 个单位内一概让开（长江大桥连引桥共 ±154 模型单位 × .74 × .81）
  const bridgeSpan = (c, a, b, half) => {
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
    return [{ x: c.x - dx / L * half, z: c.z - dz / L * half }, { x: c.x + dx / L * half, z: c.z + dz / L * half }];
  };
  const BRIDGES = [bridgeSpan(AT.bridge, bA, bB, bridgeDeckEnd * bridgeScale * bridgeLengthRatio), [yA, yB]];
  const offBridge = (x, z, reserveApproach = true) => (!reserveApproach || (roadAt(x,z)?.distance ?? Infinity) > 8)
    && BRIDGES.every(([a, b]) => {
    const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - a.x - t * dx, z - a.z - t * dz) > 12;
  });
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

  // The planting pass queries the completed street grid and building footprints.
  const cityGround = { occupied: () => false, streets: [] };

  /* ═════════ 九、三镇市廛 ═════════ */
  // 以街坊为单位，里分顺巷成排、临江商埠与厂房成带，现代楼群在内街起伏。
  // 空间为画意概括，河湖、桥轴和地标仍使用实测位置。
  {
    const lots = { lane: [], arcade: [], wharf: [], apartment: [], highrise: [], terrace_tower: [], slab_tower: [] };
    const landmarks = pickables.filter(g => !['bridge', 'yingwuzhou', 'lake'].includes(g.userData.focus))
      .map(g => { g.updateMatrixWorld(true); return new THREE.Box3().setFromObject(g).expandByScalar(2.2); });
    const cells = new Map(), cellSize = 14;
    const streetsMesh = new Acc(), streetSurface = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const plannedStreets = [];
    let citySeed = 571;
    const cityRandom = () => (citySeed = (citySeed * 16807) % 2147483647) / 2147483647;
    const halfWidth = 5.25, halfDepth = 3.95;
    const landmarkAt = (x, z) => landmarks.some(box => x > box.min.x && x < box.max.x && z > box.min.z && z < box.max.z);
    function occupied(x, z, radius = 0) {
      const cx = Math.floor(x / cellSize), cz = Math.floor(z / cellSize);
      const cellsToCheck = Math.ceil((radius + 9) / cellSize);
      for (let i = cx - cellsToCheck; i <= cx + cellsToCheck; i++) for (let j = cz - cellsToCheck; j <= cz + cellsToCheck; j++) {
        const lotsInCell = cells.get(i + ',' + j);
        if (lotsInCell && lotsInCell.some(p => {
          const dx = x - p.x, dz = z - p.z;
          const u = Math.max(0, Math.abs(p.c * dx - p.s * dz) - halfWidth * p.scale);
          const v = Math.max(0, Math.abs(p.s * dx + p.c * dz) - halfDepth * p.scale);
          return u * u + v * v <= radius * radius;
        })) return true;
      }
      return false;
    }
    function pavedLine(a, b, width) {
      const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
      if (length < .15) return;
      const steps = Math.ceil(length / 2), sideX = -dz / length, sideZ = dx / length;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, x = a.x + dx * t, z = a.z + dz * t;
        if (occupied(x, z, width / 2 + .63)) return;
        for (const offset of [-width / 2, 0, width / 2]) {
          const px = x + sideX * offset, pz = z + sideZ * offset;
          if (!onLand(px, pz) || !offBridge(px, pz, false) || terrainTop(px, pz) > LAND_Y + .3 || landmarkAt(px, pz)) return;
        }
      }
      streetsMesh.place(streetSurface, (a.x + b.x) / 2, LAND_Y + .045, (a.z + b.z) / 2, length, 1, width, Math.atan2(-dz, dx));
      cityGround.streets.push({ a: { x: a.x, z: a.z }, b: { x: b.x, z: b.z }, width });
    }
    function fits(x, z, yaw, scale, reserveApproach = true) {
      const c = Math.cos(yaw), s = Math.sin(yaw);
      for (const [u, v] of [[0, 0], [-halfWidth, -halfDepth], [-halfWidth, halfDepth], [halfWidth, -halfDepth], [halfWidth, halfDepth]]) {
        const px = x + scale * (c * u + s * v), pz = z + scale * (-s * u + c * v);
        if (!onLand(px, pz) || !offBridge(px, pz, reserveApproach) || terrainTop(px, pz) > LAND_Y + .48 || landmarkAt(px, pz)) return false;
      }
      return true;
    }
    function buildLot(kind, {x, z}, yaw, scale, height) {
      if (occupied(x, z, Math.hypot(halfWidth, halfDepth) * scale + .24) || !fits(x, z, yaw, scale)) return false;
      dummy.position.set(x, LAND_Y - .10, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(scale, height, scale);
      dummy.updateMatrix();
      lots[kind].push(dummy.matrix.clone());
      const key = Math.floor(x / cellSize) + ',' + Math.floor(z / cellSize);
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push({ x, z, c: Math.cos(yaw), s: Math.sin(yaw), scale });
      return true;
    }
    const skylineClearance = [[AT.tower, 51], [AT.tv, 57], [AT.qc, 46], [AT.customs, 47], [AT.watertower, 29],
      [AT.honglou, 43], [AT.guiyuan, 41], [AT.qintai, 39]];
    const prototypeHeight = { lane: 4.4, apartment: 9.92, highrise: 18.83, terrace_tower: 25.69, slab_tower: 30.92 };
    const inlandAt = (x, z, r) => onLand(x - r, z) && onLand(x + r, z) && onLand(x, z - r) && onLand(x, z + r);
    function urbanCore(lon, lat, degrees, height, preferred) {
      const center = geo(lon, lat), yaw = degrees * Math.PI / 180;
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const point = (u, v) => ({ x: center.x + c * u + s * v, z: center.z - s * u + c * v });
      const crossStreet = 7.85, pitch = 15.7, rowPitch = 25;
      const rows = [-1, 0, 1], columns = [-2, -1, 0, 1, 2];
      for (const row of rows) {
        const street = row * rowPitch;
        const developed = [];
        for (const col of columns) {
          let built = false;
          for (const side of [-1, 1]) {
            const u = col * pitch + (cityRandom() - .5) * 1.10;
            const lot = point(u, street + side * (6.25 + cityRandom() * .86));
            const inland = skylineClearance.every(([p, r]) => (lot.x - p.x) ** 2 + (lot.z - p.z) ** 2 > r * r)
              && inlandAt(lot.x, lot.z, 23);
            const radius = Math.hypot(col * .43, row * .62 + side * .11);
            const mainTowers = row === 0 && Math.abs(col) <= 1;
            let kind = radius > 1.02 ? 'lane' : 'apartment';
            let top = (kind === 'lane' ? 5.4 : 10.2 + 3.5 * (1 - radius)) * (.83 + cityRandom() * .26);
            const shoulder = row !== 0 && side === -row && (col === 0 || col === -row);
            if (inland && (mainTowers || shoulder)) {
              const leading = mainTowers && (col === 0 || (col === -1 && side === 1));
              if (leading) {
                const alternate = preferred === 'slab_tower' ? 'terrace_tower' : 'slab_tower';
                kind = col === 0 && side === 1 ? alternate : preferred;
              } else {
                kind = mainTowers ? 'terrace_tower' : 'highrise';
              }
              top = height * ((leading ? 1.02 : .80) - .49 * radius) * (.87 + cityRandom() * .23);
            }
            const scale = .83 + cityRandom() * .30;
            built = buildLot(kind, lot, yaw + (side > 0 ? Math.PI : 0), scale, top / prototypeHeight[kind]) || built;
          }
          if (built) developed.push(col);
        }
        for (let i = 0; i < developed.length; i++) {
          const u = developed[i] * pitch;
          if (i === 0) plannedStreets.push([point(u - 6, street), point(u, street), 2.2]);
          const next = developed[i + 1];
          plannedStreets.push([point(u, street), point(next === undefined ? u + 6 : next * pitch, street), 2.2]);
        }
      }
      for (let i = 0; i < rows.length - 1; i++) {
        plannedStreets.push([point(crossStreet, rows[i] * rowPitch), point(crossStreet, rows[i + 1] * rowPitch), 1.8]);
      }
    }
    function district(lon, lat, cols, rows, degrees, streets, shoulders = []) {
      const center = geo(lon, lat), yaw = degrees * Math.PI / 180;
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const blocks = new Map();
      const crests = shoulders.map(([x, z, radius, height]) => [geo(x, z), radius, height]);
      function apartmentRise(x, z) {
        const rise = Math.max(0, ...crests.map(([at, r, h]) =>
          h * (1 - THREE.MathUtils.smoothstep(Math.hypot(at.x - x, at.z - z), 8, r))));
        if (!rise || !inlandAt(x, z, 29)) return 0;
        const protection = Math.min(...skylineClearance.map(([at, r]) =>
          THREE.MathUtils.smoothstep(Math.hypot(at.x - x, at.z - z), r + 3, r + 20)));
        return rise * protection / prototypeHeight.apartment;
      }
      for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
        const u = col + .5 - cols / 2, v = row + .5 - rows / 2;
        const edge = (2 * u / cols) ** 2 + (2 * v / rows) ** 2;
        if (edge > 1 || cityRandom() < .10 + edge * .18) continue;
        // Each block faces one street and has a shared building line and storey range.
        const kind = streets[Math.floor(cityRandom() * streets.length)];
        const blockHeight = (.80 + cityRandom() * .34) * (1 - .15 * edge);
        const u0 = 31 * u + 4 * Math.sin(v * .69), v0 = 25 * v + 3 * Math.sin(u * .65 + row * .18);
        const x0 = center.x + c * u0 + s * v0, z0 = center.z - s * u0 + c * v0;
        for (let side = -1; side <= 1; side += 2) for (let lot = -1; lot <= 1; lot += 2) {
          if (cityRandom() < .09 + edge * .06) continue;
          const a = lot * 6.9, b = side * 5.8;
          const x = x0 + c * a + s * b, z = z0 - s * a + c * b;
          const scale = .78 + cityRandom() * .30;
          const height = scale * blockHeight + (kind === 'apartment' && crests.length ? apartmentRise(x, z) : 0);
          const built = buildLot(kind, { x, z }, yaw + (side > 0 ? Math.PI : 0), scale, height);
          // A vacant lot next to the approaches still belongs to its street block.
          if (built || ((roadAt(x,z)?.distance ?? Infinity) < 8 && fits(x,z,yaw,scale,false))) {
            blocks.set(row + ',' + col, {x: x0, z: z0, row, col});
          }
        }
      }
      for (const block of blocks.values()) {
        const previous = blocks.get(block.row + ',' + (block.col - 1));
        const next = blocks.get(block.row + ',' + (block.col + 1));
        const end = next || {x: block.x + c * 12, z: block.z - s * 12};
        plannedStreets.push([previous ? block : {x: block.x - c * 12, z: block.z + s * 12}, end, 1.48]);
        const across = blocks.get((block.row + 1) + ',' + block.col);
        if (across && block.col % 3 === 1) {
          // Cross streets sit in the gap between the two pairs of lots.
          plannedStreets.push([block, across, 1.08]);
        }
      }
    }
    const oldTown = ['lane', 'lane', 'arcade', 'apartment'];
    const port = ['wharf', 'wharf', 'lane', 'arcade'];
    const suburbs = ['lane', 'apartment', 'apartment'];
    urbanCore(114.277, 30.583, 25, 42, 'slab_tower');          // 汉口商埠背后的内城
    urbanCore(114.260, 30.544, 13, 45, 'terrace_tower');       // 汉阳内街，桥上远望
    urbanCore(114.3074, 30.553, -26, 19.5, 'slab_tower');      // 武昌楼群东退，蛇山近侧保留中层街坊
    district(114.292, 30.580, 11, 11, 36, oldTown);   // 汉口沿江商埠
    district(114.272, 30.587, 11, 12, 23, suburbs, [[114.269, 30.586, 77, 8.9]]);   // 汉口腹地
    district(114.266, 30.554, 10, 10, -13, port);     // 汉阳港区与龟山两侧
    district(114.251, 30.543, 9, 9, 9, suburbs,
      [[114.2534, 30.5402, 82, 10.4], [114.2637, 30.5395, 61, 9.8]]);  // 由汉阳楼群向内陆压低
    district(114.295, 30.540, 8, 9, -20, oldTown);    // 蛇山南麓
    district(114.302, 30.557, 9, 10, -32, oldTown);   // 武昌临江街坊
    district(114.325, 30.538, 10, 9, -8, suburbs, [[114.320, 30.5460, 76, 6.1]]);
    district(114.358, 30.520, 8, 8, 14, suburbs);
    district(114.344, 30.598, 9, 8, 26, port);
    plannedStreets.forEach(([a, b, width]) => pavedLine(a, b, width));
    cityGround.occupied = (x, z, radius) => occupied(x, z, radius);
    const streets = streetsMesh.mesh(inkMat(.42, false, ['#b3a895', '#dfd8c7']), false);
    streets.name = 'City streets';
    scene.add(streets);
    for (const [kind, matrices] of Object.entries(lots)) {
      if (!matrices.length) continue;
      for (const { geometry, material } of architectureParts(kind)) {
        const block = new THREE.InstancedMesh(geometry, material, matrices.length);
        block.name = 'City / ' + kind;
        matrices.forEach((matrix, i) => block.setMatrixAt(i, matrix));
        block.instanceMatrix.needsUpdate = true;
        scene.add(block);
      }
    }
  }

  {   // 汉口江滩：汉水口以下的长江西岸，护岸与路灯，江汉关就立在岸上
    const B = new Acc(), L = new Acc(), latOf = z => O[1] - z * MPU / M_LAT;
    for (let i = 0; i < YZ.s.length; i++) {
      const s = YZ.s[i], nx = s.d.z, nz = -s.d.x, Ln = Math.hypot(nx, nz) || 1;
      const x = s.p.x + nx / Ln * (s.w - .9), z = s.p.z + nz / Ln * (s.w - .9), lat = latOf(z);
      if (lat < 30.566 || lat > 30.600 || !inPoly(HANKOU, s.p.x + nx / Ln * (s.w + 2), s.p.z + nz / Ln * (s.w + 2))) continue;   // 护岸骑在水线上，取岸上 2 个单位处判定是否属汉口；纬度窗 30.566～30.600：南界在汉水入江口略北，北界约当武汉长江二桥
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
