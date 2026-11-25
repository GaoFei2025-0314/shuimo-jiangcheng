
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
    // The eight cutwaters in tools/blender/bridge.py span stations -56 to 56.
    bridge.updateMatrixWorld(true);
    const center = bridge.localToWorld(V(0,0,0));
    const pierStep = bridge.localToWorld(V(0,0,16)).sub(center);
    const nose = bridge.localToWorld(V(6.3*1.06,0,0)).sub(center);
    let distance = Infinity, riverT = 0;
    for (let i = 1; i < YZ.s.length; i++) {
      const start = YZ.s[i-1].p, end = YZ.s[i].p;
      const dx = end.x-start.x, dz = end.z-start.z;
      const t = THREE.MathUtils.clamp(((center.x-start.x)*dx+(center.z-start.z)*dz)/(dx*dx+dz*dz),0,1);
      const gap = (center.x-start.x-t*dx)**2+(center.z-start.z-t*dz)**2;
      if (gap < distance) {
        distance = gap;
        riverT = (i-1+t)/(YZ.s.length-1);
      }
    }
    const flow = YZ.curve.getTangent(riverT);
    const downstream = Math.sign(nose.dot(flow));
    waterU.uCutwaterRow.value.set(center.x,center.z,pierStep.x,pierStep.z);
    waterU.uCutwaterFlow.value.set(flow.x,flow.z,nose.dot(flow)*downstream,
      (nose.z*flow.x-nose.x*flow.z)*downstream);
  }
  const wuhanApproachFeatures = [];
  {
    const carriageMaterial=approachPaving.clone();
    carriageMaterial.uniforms=approachPaving.uniforms;
    // Begin with the baked deck's slope lighting, then ease into the city pavement wash.
    const deckLightVaryings='varying float vJointSky; varying vec3 vJointNormal;\n';
    carriageMaterial.vertexShader='attribute float jointSky; attribute vec3 jointNormal;\n'+deckLightVaryings+
      carriageMaterial.vertexShader.replace('vDeckPigment = deckPigment;',
        'vJointSky = jointSky; vJointNormal = jointNormal; vDeckPigment = deckPigment;');
    carriageMaterial.fragmentShader=deckLightVaryings+carriageMaterial.fragmentShader
      .replace('vec3 n = normalize(vN);','vec3 n = normalize(mix(vN, vJointNormal, smoothstep(.83,1.,vDeckPigment)));')
      .replace('mix(deckInk, deckPaper, tone),','mix(deckInk, deckPaper, tone) * mix(.62,1.,vJointSky),');
    const sidewalkMaterial=inkMat(.35,false,['#7d796a','#cfc5af']);
    const paintedMaterial=inkMat(.62,false,['#b6a891','#e9dcbf']);
    const carriageHalf=(5.47-1.14/2)*bridgeScale, sidewalkWidth=1.14*bridgeScale;
    const details=[];
    function addPaving(name, key, mat, positions, indices, detail=false, pigment) {
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions.flatMap(p=>p.toArray()),3));
      if (pigment) geometry.setAttribute('deckPigment',new THREE.Float32BufferAttribute(pigment,1));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,mat);
      mesh.name=name;
      mesh.userData.landscapeSurface={group:detail?'武汉长江大桥 · 步行与标线':'武汉长江大桥',name,material:key};
      if (detail) details.push(mesh); else scene.add(mesh);
      return mesh;
    }
    const offset=(point,normal,dx,y=0)=>point.clone().addScaledVector(normal,dx).setY(point.y+y);
    function section(p,a,b,half,walk,curb) {
      const normal=V(b.z-a.z,0,a.x-b.x).normalize();
      const edges=[-1,1].map(s=>{
        const road=offset(p,normal,s*half), inner=road.clone().setY(road.y+curb);
        const outer=offset(p,normal,s*(half+walk),curb);
        return {road,inner,outer};
      });
      return {center:p,normal,half,edges};
    }
    bridge.updateMatrixWorld(true);
    const bakedDeck=bridge.children.find(node=>node.material===architectureMaterials.deck);
    const deckPositions=bakedDeck.geometry.getAttribute('position'), deckNormals=bakedDeck.geometry.getAttribute('normal');
    const deckSky=bakedDeck.geometry.getAttribute('skyVisibility'), deckBasis=new THREE.Matrix3().getNormalMatrix(bakedDeck.matrixWorld);
    function deckLight(row) {
      const crosses=[];
      const forward=V(-row.normal.z,0,row.normal.x);
      for (let i=0;i<deckPositions.count;i++) {
        const point=V(0,0,0).fromBufferAttribute(deckPositions,i).applyMatrix4(bakedDeck.matrixWorld).sub(row.center);
        if (Math.abs(point.y)>.014 || Math.abs(point.dot(forward))>.025) continue;
        const normal=V(0,0,0).fromBufferAttribute(deckNormals,i).applyNormalMatrix(deckBasis);
        if (normal.y<.80) continue;
        crosses.push({offset:point.dot(row.normal),normal,sky:deckSky.getX(i)/255});
      }
      crosses.sort((a,b)=>a.offset-b.offset);
      const a=crosses[0], b=crosses.at(-1);
      if (!a || b.offset-a.offset<1) return row.edges.map(()=>({normal:V(0,1,0),sky:.52}));
      return row.edges.map((_,i)=>{
        const fraction=THREE.MathUtils.clamp(((i===0?-row.half:row.half)-a.offset)/(b.offset-a.offset),0,1);
        return {normal:a.normal.clone().lerp(b.normal,fraction).normalize(),sky:THREE.MathUtils.lerp(a.sky,b.sky,fraction)};
      });
    }
    for (const [side, rows] of approachLinks.entries()) {
      const { width, next } = bridgeStreetEntries[side];
      const label=side===0?'武昌引道':'汉阳引道';
      const stations=rows.map((p,i)=>{
        const a = i === 0 ? approachRoads[side][bridgeDeckEnd-73] : (i === rows.length-1 ? p : rows[i-1]);
        const b = i === 0 ? rows[0] : rows[i+1] || next;
        const t = i/(rows.length-1);
        const narrowing = THREE.MathUtils.smoothstep(t,.08,.92);
        return section(p,a,b,THREE.MathUtils.lerp(carriageHalf,width/2,narrowing),
          THREE.MathUtils.lerp(sidewalkWidth,1.03,narrowing),THREE.MathUtils.lerp(.18*bridgeScale,.073,narrowing));
      });
      const roadPoints=[], roadFaces=[], pigment=[];
      for (const [i,row] of stations.entries()) {
        const t=i/(stations.length-1), ink=1-THREE.MathUtils.smoothstep(t,.03,.94);
        roadPoints.push(...row.edges.map(edge=>edge.road));
        pigment.push(ink,ink);
        if (i) {
          const k = i*2;
          roadFaces.push(k-2,k,k-1,k-1,k,k+1);
        }
      }
      const road=addPaving(label+' · 接地铺装','ApproachPaving',carriageMaterial,roadPoints,roadFaces,false,pigment);
      const joint=deckLight(stations[0]), sky=[], normal=[];
      for (const station of stations) for (const light of joint) {
        sky.push(light.sky);
        normal.push(...light.normal.toArray());
      }
      road.geometry.setAttribute('jointSky',new THREE.Float32BufferAttribute(sky,1));
      road.geometry.setAttribute('jointNormal',new THREE.Float32BufferAttribute(normal,3));
      const end=stations.at(-1).center;
      const streetLength=Math.hypot(next.x-end.x,next.z-end.z), links=Math.ceil(streetLength/.64);
      const walks=stations.concat(Array.from({length:links},(_,i)=>{
        const t=(i+1)/links, p=V(THREE.MathUtils.lerp(end.x,next.x,t),0,THREE.MathUtils.lerp(end.z,next.z,t));
        p.y=THREE.MathUtils.lerp(end.y,(plantingSurface(p.x,p.z) ?? LAND_Y)+.068,t);
        return section(p,end,next,width/2,THREE.MathUtils.lerp(1.03,.74,THREE.MathUtils.smoothstep(t,.58,1)),
          THREE.MathUtils.lerp(.073,.026,THREE.MathUtils.smoothstep(t,.33,1)));
      }));
      const sidewalks=walks[0].edges.map((_,bank)=>{
        const points=[], indices=[];
        for (const [i,row] of walks.entries()) {
          const {road,inner,outer}=row.edges[bank];
          const bottom=Math.min(outer.y-.12,(plantingSurface(outer.x,outer.z) ?? LAND_Y)-.035);
          points.push(road,inner,outer,outer.clone().setY(bottom));
          if (!i) continue;
          for (let j=0;j<3;j++) {
            const a=(i-1)*4+j,b=i*4+j;
            indices.push(...(bank ? [a,b,a+1,a+1,b,b+1] : [a,a+1,b,a+1,b+1,b]));
          }
        }
        return addPaving(label+' · '+(bank===0?'左':'右')+'侧连续步道','BankStone',sidewalkMaterial,points,indices,true);
      });
      const marks=[], markFaces=[];
      for (const [i,b] of stations.slice(1).entries()) {
        const a=stations[i],t=i/(stations.length-1),fade=1-THREE.MathUtils.smoothstep(t,.20,.68);
        if (fade<.07) continue;
        const stripes=t<.33 && i%6<2 ? [-.50,0,.50] : t<.43 || i%6<3 ? [0] : [];
        for (const f of stripes) {
          const k=marks.length,h=.031*fade;
          for (const row of [a,b]) marks.push(offset(row.center,row.normal,f*row.half-h,.016),
            offset(row.center,row.normal,f*row.half+h,.016));
          markFaces.push(k,k+2,k+1,k+1,k+2,k+3);
        }
      }
      const markings=addPaving(label+' · 延续车道标线','RoadPaint',paintedMaterial,marks,markFaces,true);
      wuhanApproachFeatures.push({side,road,sidewalks,markings,stations,walkStations:walks});
    }
    scene.add(...details);
  }
  const tower   = place(builtLandmark('tower'), AT.tower, .88, .18, '黄鹤楼', 'tower');
  summitGround(tower, 12.1, 17.4, 17.4, 13.5, -.78);
  const tv      = place(builtLandmark('tv'), AT.tv, 1.5, 0, '龟山电视塔', 'tv');
  tv.scale.x = tv.scale.z = 1.13;
  // Keep the exaggerated architectural footprints on the surveyed land side of the bank.
  const qc      = place(builtLandmark('qc'), qcSite, 1, qcSite.yaw, '晴川阁', 'qc', qcSite.y+.3);
  qc.scale.set(qcSite.scaleX,qcSite.scaleY,qcSite.scaleZ);
  {
    // Tie the main plinth and the gate into a single dressed river-side retaining course.
    const footing = new Acc();
    footing.box(46.4, 3.35, 18.95, 4.0, -1.675, 2.43);
    footing.box(46.7, .20, 19.23, 4.0, -.072, 2.43);
    const apron = footing.mesh(M.bankStone, false);
    apron.name = '晴川阁 · 禹功矶石台驳岸';
    apron.userData.landscapeSurface = { group: '晴川阁', name: apron.name, material: 'BankStone' };
    qc.updateMatrixWorld(true);
    apron.applyMatrix4(qc.matrixWorld);
    scene.add(apron);

    // Begin inside the apron coping and end on the sampled bank at the foot of the gate.
    const steps = new Acc(), gateX = 20, first = 12, run = .79, count = 10;
    const toe = qc.localToWorld(V(gateX, 0, first + run * count));
    const grade = (terrainTop(toe.x, toe.z) - qc.position.y) / qc.scale.y;
    const bottom = grade - .15;
    for (let i = 0; i < count; i++) {
      const top = THREE.MathUtils.lerp(.028, grade + .09, i / (count - 1));
      steps.box(3.65, top - bottom, run, gateX, (top + bottom) / 2, first + (i + .5) * run);
    }
    const stair = steps.mesh(M.bankStone, false);
    stair.name = '铁门关 · 接岸石阶';
    stair.userData.landscapeSurface = { group: '晴川阁', name: stair.name, material: 'BankStone' };
    stair.applyMatrix4(qc.matrixWorld);
    scene.add(stair);
  }
  const customs = place(builtLandmark('customs'), {x:AT.customs.x-2,z:AT.customs.z}, .98, Math.PI / 2, '江汉关', 'customs');
  // The three archways face downhill; their toe meets the graded campus apron.
  const wuda    = place(builtLandmark('wuda'), AT.wuda, .74, Math.PI-.08, '武大 · 老斋舍', 'wuda');
  summitGround(wuda, 25, 7.8, 8.5, 16.5, -.42);
  const xingyin = place(builtLandmark('lake'), { x: AT.xingyin.x-7.7, z: AT.xingyin.z }, .34, -.35, '东湖 · 行吟阁', 'xingyin', .45);
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
      let height = cutForApproach(wx,wz,ground+fill);
      if (site.userData.focus === 'tv') {
        // At the summit podium keep the road's own clearance, with a shorter soil taper outside it.
        const path = roadAt(wx,wz);
        if (path) height = THREE.MathUtils.lerp(height, ground+fill,
          THREE.MathUtils.smoothstep(path.distance, approachHalfWidth+1.85, approachHalfWidth+5.08));
        // Keep the tower podium covered while tapering its eastern shoulder into the Qingchuan terrace.
        const podiumEast = site.position.x + halfWidth*site.scale.x;
        const terraceClearance = THREE.MathUtils.smoothstep(wx,podiumEast,qcSite.x-8);
        height = THREE.MathUtils.lerp(height,cutForQingchuan(wx,wz,height),terraceClearance);
      }
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
  summitGround(hongshan, 13.2, 14, 25.4, 11.3, -.43);
  const watertower = place(builtLandmark('watertower'), AT.watertower, .82, 0, '汉口水塔', 'watertower');
  const museum     = place(builtLandmark('museum'), AT.museum, .78, Math.PI-.32, '湖北省博物馆', 'museum', terrainTop(AT.museum.x,AT.museum.z)+.14);
  const honglou    = place(builtLandmark('honglou'), AT.honglou, .8, 0, '红楼', 'honglou');
  summitGround(honglou, 23, 9.8, 12, 10.6, -.53);
  const guiyuan    = place(builtLandmark('guiyuan'), AT.guiyuan, .7, 0, '归元禅寺', 'guiyuan', terrainTop(AT.guiyuan.x,AT.guiyuan.z)+.27);
  const qintai     = place(builtLandmark('qintai'), AT.qintai, .53, .13, '古琴台', 'qintai', terrainTop(AT.qintai.x, AT.qintai.z)+.27);
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
  function buildLakeGreenway() {
    // 绿道沿陆侧绕行。凹湾按曲率缩短偏移，尖角处裁掉自交的小环。
    const shore = LAKE.slice(0, -1); // Closed Catmull-Rom samples repeat their first point.
    const n = shore.length, sg = shore.reduce((s, p, i) => s + p[0] * shore[(i + 1) % n][1] - shore[(i + 1) % n][0] * p[1], 0) > 0 ? 1 : -1;
    const normal = i => {                                 // 岸边朝陆地的单位向量
      const a = shore[(i + n - 1) % n], b = shore[(i + 1) % n], tx = b[0] - a[0], tz = b[1] - a[1], L = Math.hypot(tx, tz) || 1;
      return [sg * tz / L, -sg * tx / L];
    };
    const circumcenter = (a, b, c) => {                   // 三点外接圆心，共线则无解
      const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
      if (Math.abs(d) < 1e-9) return null;
      const a2 = a[0] * a[0] + a[1] * a[1], b2 = b[0] * b[0] + b[1] * b[1], c2 = c[0] * c[0] + c[1] * c[1];
      return [(a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d,
              (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d];
    };
    const insets = shore.map((p, i) => {
      const cc = circumcenter(shore[(i - 3 + n) % n], p, shore[(i + 3) % n]);
      if (!cc) return 4;
      const [ox, oz] = normal(i), R = Math.hypot(cc[0] - p[0], cc[1] - p[1]);
      return (cc[0] - p[0]) * ox + (cc[1] - p[1]) * oz > 0 ? Math.min(4, Math.max(.5, .8 * R)) : 4;
    });
    let pts = shore.map((p, i) => {
      const [ox, oz] = normal(i);
      let setback = insets[i];
      while (setback > .03 && !onLand(p[0] + ox * setback, p[1] + oz * setback)) setback *= .5;
      return [p[0] + ox * setback, p[1] + oz * setback];
    });

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
        const removed = Math.min(j-i, m-j+i);
        if (P && (!hit || removed < hit.removed)) hit = { i, j, P, removed };
      }
      if (!hit) break;
      pts = hit.j-hit.i <= m/2
        ? pts.slice(0,hit.i+1).concat([hit.P],pts.slice(hit.j+1))
        : [hit.P,...pts.slice(hit.i+1,hit.j+1)];
    }

    const knots = [];
    const groundPoint = (x,z) => V(x,(plantingSurface(x,z) ?? LAND_Y)+.025,z);
    function followGround(a, b, depth) {
      const mid = groundPoint((a.x+b.x)/2, (a.z+b.z)/2);
      if (depth < 5 && Math.abs(mid.y-(a.y+b.y)/2) > .025) {
        followGround(a, mid, depth+1);
        followGround(mid, b, depth+1);
      } else knots.push(a);
    }
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
      const count = Math.ceil(Math.hypot(bx-ax,bz-az)/2);
      let point = groundPoint(ax,az);
      for (let j = 1; j <= count; j++) {
        const next = groundPoint(ax+(bx-ax)*j/count,az+(bz-az)*j/count);
        followGround(point,next,0);
        point = next;
      }
    }
    const road = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(knots), lineSoft);
    road.userData.lakeGreenway = true;
    road.raycast = function () {}; scene.add(road);
  }
  buildLakeGreenway();

  // The planting pass queries the completed street grid and building footprints.
  const cityGround = { occupied: () => false, streets: [], verges: [] };

  /* ═════════ 九、三镇市廛 ═════════ */
  // 以街坊为单位，里分顺巷成排、临江商埠与厂房成带，现代楼群在内街起伏。
  // 空间为画意概括，河湖、桥轴和地标仍使用实测位置。
  function buildCityBlocks() {
    const lots = { lane: [], arcade: [], wharf: [], apartment: [], highrise: [], terrace_tower: [], slab_tower: [] };
    const landmarks = pickables.filter(g => !['bridge', 'yingwuzhou', 'lake'].includes(g.userData.focus))
      .map(g => { g.updateMatrixWorld(true); return new THREE.Box3().setFromObject(g).expandByScalar(2.2); });
    const cells = new Map(), cellSize = 14;
    const streetsMesh = new Acc(), streetSurface = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const plannedStreets = [], routeEnds = [], districtPaving = new Map(), protectedPaths = new Map();
    let citySeed = 571;
    const cityRandom = () => (citySeed = (citySeed * 16807) % 2147483647) / 2147483647;
    const halfWidth = 5.25, halfDepth = 3.95;
    const landmarkAt = (x, z) => landmarks.some(box => x > box.min.x && x < box.max.x && z > box.min.z && z < box.max.z);
    const distanceToPath = (x, z, { a, b }) => {
      const dx = b.x-a.x, dz = b.z-a.z;
      const t = THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz), 0, 1);
      return Math.hypot(x-a.x-dx*t, z-a.z-dz*t);
    };
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
      const lotRadius = Math.hypot(halfWidth, halfDepth)*scale;
      const nearby = protectedPaths.get(Math.floor(x/cellSize)+','+Math.floor(z/cellSize));
      if (nearby?.some(path =>
        distanceToPath(x, z, path) < path.width/2 + lotRadius + .18)) return false;
      if (occupied(x, z, lotRadius+.24) || !fits(x, z, yaw, scale)) return false;
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
      [AT.honglou, 43], [AT.guiyuan, 59], [AT.qintai, 47]];
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
    function district(lon, lat, cols, rows, degrees, streets, shoulders = [], fringe = false) {
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
        const irregular = fringe ? .65+.21*Math.sin(1.31*u+.86*v)**2+.14*Math.sin(v*1.13+.2)**2 : 1;
        if (edge > irregular || cityRandom() < .10 + edge * (fringe ? .34 : .18)) continue;
        // Each block faces one street and has a shared building line and storey range.
        const kind = fringe && edge > .52 ? 'lane' : streets[Math.floor(cityRandom() * streets.length)];
        const blockHeight = (.80 + cityRandom() * .34) * (1 - (fringe ? .42 : .15) * edge);
        const u0 = 31 * u + (fringe ? 11 : 4) * Math.sin(v * .69), v0 = 25 * v + (fringe ? 10 : 3) * Math.sin(u * .65 + row * .18);
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
    function reservePath(path, registerStreet = true) {
      if (registerStreet) cityGround.streets.push(path);
      const reserve = path.width/2+8;
      const x0 = Math.floor((Math.min(path.a.x,path.b.x)-reserve)/cellSize);
      const x1 = Math.floor((Math.max(path.a.x,path.b.x)+reserve)/cellSize);
      const z0 = Math.floor((Math.min(path.a.z,path.b.z)-reserve)/cellSize);
      const z1 = Math.floor((Math.max(path.a.z,path.b.z)+reserve)/cellSize);
      for (let x=x0; x<=x1; x++) for (let z=z0; z<=z1; z++) {
        const key = x+','+z;
        if (!protectedPaths.has(key)) protectedPaths.set(key,[]);
        protectedPaths.get(key).push(path);
      }
    }

    function districtRoute({ name, group, points, width, material = 'Path', terrace = false, earthy = false, connect = false, gradeStart = null, entryHeight = null, plain = false, surfaceLift = 0, junctionLift = 0 }) {
      const vertices = [], indices = [];
      const rows = [];
      for (let i = 0; i < points.length-1; i++) {
        const a = points[i], b = points[i+1];
        const length = Math.hypot(b.x-a.x,b.z-a.z);
        if (length < .05) continue;
        const steps = Math.ceil(length/(earthy ? .62 : 1.2));
        for (let j = 0; j < steps; j++) rows.push({ x: a.x+(b.x-a.x)*j/steps, z: a.z+(b.z-a.z)*j/steps });
      }
      if (!rows.length) return;
      rows.push(points.at(-1));
      const worldPoints = rows.map((p, i) => {
        const a = rows[Math.max(0,i-1)], b = rows[Math.min(rows.length-1,i+1)];
        const dx = b.x-a.x, dz = b.z-a.z, length = Math.hypot(dx,dz) || 1;
        return [-1,0,1].map(side => {
          const x = p.x+side*dz/length*width/2, z = p.z-side*dx/length*width/2;
          const floor = plantingSurface(x,z);
          const surface = (floor ?? 0)+(terrace ? .112 : .068)+surfaceLift*Math.min(i/3,1);
          const u = i/(rows.length-1);
          let height = gradeStart === null ? surface : THREE.MathUtils.lerp(gradeStart,surface,u);
          if (i === 0 && entryHeight !== null) height = entryHeight;
          if (junctionLift) height += junctionLift * (1-THREE.MathUtils.smoothstep(Math.min(i, rows.length-1-i), 3, 8));
          return [x, height, z];
        });
      });
      for (const row of worldPoints) for (const point of row) vertices.push(...point);
      for (let i = 0; i < worldPoints.length-1; i++) {
        let active = false;
        for (let j = 0; j < 2; j++) {
          const a = i*3+j, b = a+1, c = a+3, d = c+1;
          for (const tri of [[a,c,b],[b,c,d]]) {
            const v = tri.map(k => worldPoints[Math.floor(k/3)][k%3]);
            if (!triangleOnLand(...v)) continue;
            if (plain && v.some(p => p[1] > LAND_Y+.57 || landmarkAt(p[0],p[2]))) continue;
            indices.push(...tri); active = true;
          }
        }
        if (active) {
          const path = { a: rows[i], b: rows[i+1], width, group, name };
          reservePath(path);
          if (gradeStart !== null) {
            // Two embedded embankment faces close the gap between the leveled deck and grade.
            for (const j of [0,2]) {
              const a = worldPoints[i][j], b = worldPoints[i+1][j];
              if (!onLand(a[0],a[2]) || !onLand(b[0],b[2])) continue;
              const base = (p) => [p[0],Math.min(p[1]-.03,plantingSurface(p[0],p[2])-.045),p[2]];
              const k = vertices.length/3;
              vertices.push(...a,...b,...base(a),...base(b));
              if (j) indices.push(k,k+1,k+2,k+1,k+3,k+2);
              else indices.push(k,k+2,k+1,k+1,k+2,k+3);
            }
          }
        }
      }
      if (!indices.length) return;
      if (connect) routeEnds.push({ name, group, point: rows.at(-1), width, material, earthy });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3));
      geometry.setIndex(indices); geometry.computeVertexNormals();
      const key = group+' / '+material+(earthy ? ' / soil' : '');
      if (!districtPaving.has(key)) districtPaving.set(key, { name, group, material, earthy, tiles: new Acc() });
      districtPaving.get(key).tiles.push(geometry);
    }
    buildDistrictRoutes(districtRoute, buildLot, reservePath);
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
    district(114.358, 30.520, 8, 8, 14, suburbs, [], true);
    district(114.344, 30.598, 9, 8, 26, ['lane','arcade','apartment'], [], true);
    plannedStreets.forEach(([a, b, width]) => pavedLine(a, b, width));
    const localStreets = cityGround.streets.filter(street => !street.group);
    for (const { point, ...route } of routeEnds) {
      let target, nearest = 30;
      for (const { a, b, width } of localStreets) {
        const dx = b.x-a.x, dz = b.z-a.z, length = Math.hypot(dx,dz);
        const t = THREE.MathUtils.clamp(((point.x-a.x)*dx+(point.z-a.z)*dz)/(length*length), 0, 1);
        const p = { x:a.x+dx*t, z:a.z+dz*t };
        const distance = Math.hypot(point.x-p.x,point.z-p.z);
        if (distance >= nearest) continue;
        const steps = Math.max(1,Math.ceil(distance/1.5));
        const clear = Array.from({length:steps+1}, (_,i) => i/steps).every(s => {
          const x = THREE.MathUtils.lerp(point.x,p.x,s), z = THREE.MathUtils.lerp(point.z,p.z,s);
          return onLand(x,z) && !occupied(x,z,Math.max(width,route.width)*.5+.30) && !landmarkAt(x,z);
        });
        if (clear) { target = p; nearest = distance; }
      }
      if (target && nearest > .15) districtRoute({ ...route, points:[point,target] });
    }
    cityGround.occupied = (x, z, radius) => occupied(x, z, radius);
    const streets = streetsMesh.mesh(inkMat(.42, false, ['#b3a895', '#dfd8c7']), false);
    streets.name = 'City streets';
    scene.add(streets);
    const earthPath = inkMat(.23, false, ['#788074', '#a9ad99']);
    for (const { name, group, material, earthy, tiles } of districtPaving.values()) {
      const mesh = tiles.mesh(earthy ? earthPath : material === 'BankStone' ? M.bankStone : M.bankPath, false);
      mesh.name = name;
      mesh.userData.landscapeSurface = { group, name, material };
      mesh.raycast = function () {};
      scene.add(mesh);
    }
    for (const [kind, matrices] of Object.entries(lots)) {
      if (!matrices.length) continue;
      const footprint = new THREE.Box2();
      const corner = new THREE.Vector2();
      for (const { geometry, material } of architectureParts(kind)) {
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          if (positions.getY(i) < .43) footprint.expandByPoint(corner.set(positions.getX(i), positions.getZ(i)));
        }
        const block = new THREE.InstancedMesh(geometry, material, matrices.length);
        block.name = 'City / ' + kind;
        matrices.forEach((matrix, i) => block.setMatrixAt(i, matrix));
        block.instanceMatrix.needsUpdate = true;
        scene.add(block);
      }
      if (!footprint.isEmpty()) {
        const center = footprint.getCenter(new THREE.Vector2());
        const half = footprint.getSize(new THREE.Vector2()).multiplyScalar(.5);
        for (const {elements: e} of matrices) {
          const scale = Math.hypot(e[0], e[2]);
          const x = e[12] + center.x*e[0] + center.y*e[8];
          const z = e[14] + center.x*e[2] + center.y*e[10];
          groundContacts.push({x, z, rx: half.x*scale, rz: half.y*Math.hypot(e[8], e[10]),
            c: e[0]/scale, s: -e[2]/scale, tree: false});
        }
      }
    }
  }
  buildCityBlocks();

  /* ═════════ 十、江上舟船 ═════════ */
  function riverStation(river, fraction, offset = 0) {
    const point = river.curve.getPointAt(fraction);
    const tangent = river.curve.getTangentAt(fraction);
    return point.add(V(tangent.z * offset, 0, -tangent.x * offset));
  }

  // Parallel legs join through semicircles, so a vessel can turn back without teleporting or reversing its bow.
  function returnChannel(spine, radius) {
    const points = [], last = spine.length - 1;
    const frames = spine.map((point, i) => {
      const forward = spine[Math.min(i + 1, last)].clone().sub(spine[Math.max(i - 1, 0)]).normalize();
      return { point, forward, normal: V(forward.z, 0, -forward.x) };
    });
    for (const sign of [1, -1]) {
      for (let i = 0; i <= last; i++) {
        const { point, normal } = frames[sign === 1 ? i : last - i];
        points.push(point.clone().addScaledVector(normal, sign * radius));
      }
      const { point, forward, normal } = frames[sign === 1 ? last : 0];
      for (let j = 1; j < 12; j++) {
        const angle = j * Math.PI / 12;
        points.push(point.clone().addScaledVector(normal, sign * radius * Math.cos(angle))
          .addScaledVector(forward, sign * radius * Math.sin(angle)));
      }
    }
    const route = new THREE.CatmullRomCurve3(points, true);
    route.arcLengthDivisions = points.length * 10;
    return route;
  }

  function alongRiver(river, start, end, count, offset, radius) {
    const spine = Array.from({ length: count }, (_, i) =>
      riverStation(river, start + (end - start) * i / (count - 1), offset));
    return returnChannel(spine, radius);
  }

  function lakeRoute(radius, direction) {
    const points = Array.from({ length: 48 }, (_, i) => {
      const angle = direction * i * Math.PI / 24;
      return V(lakeC.x + LRX * radius * Math.cos(angle), 0, lakeC.z + LRZ * radius * Math.sin(angle));
    });
    return new THREE.CatmullRomCurve3(points, true);
  }

  // The two freight lanes line up with open spans of both bridges. Ferry crossings use the wider confluence downstream.
  const freightChannel = alongRiver(YZ, .395, .483, 42, -.5, 18.5);
  const confluenceFerry = returnChannel([
    riverStation(YZ, .497, 26), riverStation(YZ, .499, 19), riverStation(YZ, .502, 3),
    riverStation(YZ, .505, -14), riverStation(YZ, .508, -25)
  ], 5.2);
  const hanFerry = alongRiver(HAN, .87, .991, 32, 0, 3.1);
  const vessels = [
    { model: cargoShip(),      route: freightChannel, phase: .27, speed: 1.55, scale: .74, wakeLength: 18 },
    { model: cargoShip('containers'), route: freightChannel, phase: .78, speed: 1.55, scale: .72, wakeLength: 16 },
    { model: riverLiner(),     route: confluenceFerry, phase: .19, speed: 1.22, scale: .77, wakeLength: 12 },
    { model: riverLiner(),     route: hanFerry, phase: .34, speed: .96, scale: .66, wakeLength: 9 },
    { model: lakeLaunch(true), route: lakeRoute(.92, 1), phase: .12, speed: .65, scale: 1, wakeLength: 6 },
    { model: lakeLaunch(false), route: lakeRoute(.62, -1), phase: .43, speed: .46, scale: .93, wakeLength: 4 }
  ];
  const shipHeading = V(0, 0, 0);
  vessels.forEach(({model, scale}) => {
    model.scale.setScalar(scale);
    model.rotation.order = 'YXZ';
    scene.add(model);
  });
  function updateVessels(time) {
    vessels.forEach(({model, route, phase, speed, scale, wakeLength}, i) => {
      const station = THREE.MathUtils.euclideanModulo(phase + time * speed / route.getLength(), 1);
      route.getPointAt(station, model.position);
      route.getTangentAt(station, shipHeading);
      model.position.y = .025 * scale * Math.sin(time * .8 + i);
      model.rotation.y = Math.atan2(-shipHeading.z, shipHeading.x);
      model.rotation.z = .003 * Math.sin(time * .77 + i);
      model.rotation.x = .008 * Math.sin(time * .62 + i);
      boatU[i].set(model.position.x, model.position.z);
      boatWakeU[i].set(shipHeading.x, shipHeading.z, -model.userData.vessel.stern * scale, wakeLength);
    });
  }

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
    m.userData.mistStrength = alpha;
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.renderOrder = 3;
    m.raycast = function () {}; scene.add(m);
  }
  mist(5,  1500, 420, -120,  300,  1.0, .26);
  mist(14, 1700, 460,  180, -280, -.7, .22);
  mist(26, 1500, 420, -260, -100,  .6, .20);
  mist(8,   900, 360,  780,   40, -.5, .24);   // 东湖
  mist(46, 2600, 900,  200, -900,  .4, .34);   // 远岸
  mist(42, 2600, 900,  200, 1060, -.35, .34);
