
  /* ═════════ 五、两江与三镇：按真实河道生成水面与陆地 ═════════ */
  const LAND_Y = .75, X0 = -2200, X1 = 2400, ZTOP = -2600, ZBOT = 2200;

  // 长江与汉水：中泓线与半宽按实测水体掩膜追出（tools/geodata/extract.py）[经度, 纬度, 半宽(米)]
  const YANGTZE = GEO.yangtze, HANSHUI = GEO.hanshui;

  function sampleRiver(pts, n) {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => gv(p[0], p[1], 0)), false, 'catmullrom', .5);
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = curve.getPoint(t), d = curve.getTangent(t);
      const f = t * (pts.length - 1), i0 = Math.min(pts.length - 2, Math.floor(f)), fr = f - i0;
      out.push({ p, d, w: (pts[i0][2] * (1 - fr) + pts[i0 + 1][2] * fr) / MPU });
    }
    return { s: out, curve };
  }
  function bank(samples, side) {                       // side +1 左岸（面向下游）
    return samples.map(s => {
      const nx = s.d.z, nz = -s.d.x, L = Math.hypot(nx, nz) || 1;
      return [s.p.x + side * nx / L * s.w, s.p.z + side * nz / L * s.w];
    });
  }
  const YZ = sampleRiver(YANGTZE, 360), HAN = sampleRiver(HANSHUI, 200);   // 约 150 米一个采样
  const yzW = bank(YZ.s, +1), yzE = bank(YZ.s, -1);    // 长江北流：左岸即西岸
  const hanN = bank(HAN.s, +1), hanS = bank(HAN.s, -1);// 汉水东流：左岸即北岸

  // 汉水入江处，在长江西岸上找最近点
  const mouth = HAN.s[HAN.s.length - 1].p;
  let kk = 0, best = 1e18;
  yzW.forEach((p, i) => { const d = (p[0] - mouth.x) ** 2 + (p[1] - mouth.z) ** 2; if (d < best) { best = d; kk = i; } });
  const HCUT = 3;                                       // 河口张开的余量：约 450 米

  const hanNorthBank = hanN.slice(0, hanN.length - HCUT), hanSouthBank = hanS.slice(0, hanS.length - HCUT);
  const yangtzeUpperWest = yzW.slice(0, Math.max(1, kk - HCUT));
  const yangtzeLowerWest = yzW.slice(kk + HCUT);
  const HANKOU = hanNorthBank.concat(yangtzeLowerWest)
    .concat([[X1, yzW[yzW.length - 1][1]], [X1, ZTOP], [X0, ZTOP], [X0, hanN[0][1]]]);   // 长江自东缘出图：北岸沿江向东收到场景边，东北角是陆地
  const HANYANG = yangtzeUpperWest.slice().reverse()
    .concat([[yzW[0][0], ZBOT], [X0, ZBOT], [X0, hanS[0][1]]])
    .concat(hanSouthBank);
  const WUCHANG = yzE.slice()
    .concat([[X1, yzE[yzE.length - 1][1]], [X1, ZBOT], [yzE[0][0], ZBOT]]);

  // 湖：实测水体掩膜圆滑后的岸线。第一个是东湖——中国最大的城中湖，水域约 33 平方公里
  // 水体掩膜的岸线带着像素台阶的硬角：先切一次角（Chaikin）再过 Catmull-Rom，成自然湖岸。
  // 听涛两桥的石质登陆台按原岸线逐点贴合，附近约 800 米内的岸点保持原位不切。
  const keepShore = p => { const v = gv(p[0], p[1], 0); return Math.hypot(v.x - AT.xingyin.x, v.z - AT.xingyin.z) < 62; };
  const chaikin = pts => {
    const ring = pts.slice(0, pts.length - (pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1] ? 1 : 0));
    return ring.flatMap((p, i) => {
      const q = ring[(i + 1) % ring.length], out = [];
      out.push(keepShore(p) ? p : [.75 * p[0] + .25 * q[0], .75 * p[1] + .25 * q[1]]);
      if (!keepShore(q)) out.push([.25 * p[0] + .75 * q[0], .25 * p[1] + .75 * q[1]]);
      return out;
    });
  };
  const LAKES = GEO.lakes.map(L => {
    const c = new THREE.CatmullRomCurve3(chaikin(L.pts).map(p => gv(p[0], p[1], 0)), true, 'catmullrom', .5);
    return c.getPoints(L.pts.length * 6).map(p => [p.x, p.z]);
  });
  const LAKE = LAKES[0];
  const lakeC = geo(GEO.lakeBoat.c[0], GEO.lakeBoat.c[1]);           // 东湖主湖面中心
  const LRX = GEO.lakeBoat.rx / MPU, LRZ = GEO.lakeBoat.rz / MPU;     // 湖上舟行椭圆的半轴
  const LAKE_BB = LAKES.map(L => L.reduce((b, p) =>
    [Math.min(b[0], p[0]), Math.max(b[1], p[0]), Math.min(b[2], p[1]), Math.max(b[3], p[1])], [1e9, -1e9, 1e9, -1e9]));
  // 湖面笔触的取样半径：按各湖尺寸定，小湖（沙湖、月湖等）也能收到几笔，东湖仍按 120 封顶不变
  const LAKE_REACH = LAKE_BB.map(b => Math.min(120, .4 * Math.min(b[1] - b[0], b[3] - b[2])));

  function inPoly(poly, x, z) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) c = !c;
    }
    return c;
  }
  const inLake = (x, z) => LAKES.some((L, i) => {
    const b = LAKE_BB[i];
    return x > b[0] && x < b[1] && z > b[2] && z < b[3] && inPoly(L, x, z);
  });
  const onLand = (x, z) =>
    (inPoly(WUCHANG, x, z) || inPoly(HANKOU, x, z) || inPoly(HANYANG, x, z)) && !inLake(x, z);

  // Bridge-local stationing is shared by the terrain cut and the bank connectors.
  // Match tools/blender/bridge.py. Positive station is the bend around Guishan.
  const bA = geo(114.28957, 30.54783), bB = geo(114.27607, 30.55633);
  const bridgeAngle = Math.atan2(bB.x - bA.x, bB.z - bA.z);
  const bridgeScale = .74, bridgeLengthRatio = .81, bridgeLift = -.3;
  const bridgeDeckEnd = 154, approachHalfWidth = 6.025 * bridgeScale;
  const bridgeLocal = (u, y, s) => V(
    AT.bridge.x + bridgeScale*(Math.cos(bridgeAngle)*u + Math.sin(bridgeAngle)*s*bridgeLengthRatio), y,
    AT.bridge.z + bridgeScale*(-Math.sin(bridgeAngle)*u + Math.cos(bridgeAngle)*s*bridgeLengthRatio));
  const deckGrade = s => bridgeLift + bridgeScale*(11.9-Math.max(0,Math.abs(s)-72)*.127);
  function hanyangOffset(s) {
    const d = Math.max(0, s-83), t = Math.min(1, d/12);
    return 1.24*(12*t**3*(1-.5*t)+Math.max(0,d-12));
  }
  // Continue the bridge surface into the adjacent street grid at their landward ends.
  const bridgeStreetEntries = [
    { width: 5.12, next: { x: 8, z: 38 }, streetLead: { x: 25, z: 39 } },
    { width: 4.85, next: { x: -265, z: -22 }, streetLead: { x: -269, z: -22.15 } }
  ];
  const approachLinks = [
    [bridgeLocal(0,0,-154),bridgeLocal(0,0,-158),V(-24.45,0,14.41),V(-22.85,0,17.95),V(-21.38,0,22.60),
      V(-19.57,0,27.13),V(-17.70,0,31.14),V(-14.64,0,34.51),V(-10.20,0,36.48)],
    [...[[hanyangOffset(154),154],[87.3,159.4],[94.5,163.9],[102.1,167.3],
      [110,170],[119,172.5],[128,174.7],[136,176]].map(([u,s]) => bridgeLocal(u,0,s)),
      V(-252.45,0,-21.08),V(-256.32,0,-21.21)]
  ].map((controls,side) => {
    const {next,streetLead}=bridgeStreetEntries[side];
    const streetEnd=V(next.x,0,next.z);
    const incoming=V(next.x-streetLead.x,0,next.z-streetLead.z).normalize();
    const curve=new THREE.CatmullRomCurve3([...controls,streetEnd.clone().addScaledVector(incoming,4),streetEnd]);
    const length=curve.getLength(), count=Math.ceil(length/.66);
    const sign=side===0 ? -1 : 1, seam=deckGrade(bridgeDeckEnd), street=LAND_Y+.068;
    const from=bridgeLocal(side ? hanyangOffset(153.9) : 0,deckGrade(153.9),sign*153.9);
    const to=controls[0];
    const incomingGrade=(from.y-seam)/Math.hypot(to.x-from.x,to.z-from.z);
    // Round off the declining deck with a short cubic that starts at the deck grade
    // and reaches level again before the street rise. Sample its small transition more closely.
    const easingLength=.83, spacing=length/count;
    const distances=[0, spacing/4, spacing/2, 3*spacing/4,
      ...Array.from({length:count},(_,i)=>(i+1)*spacing)];
    return distances.map(distance=>{
      const t=Math.min(1,distance/length), easing=Math.min(1,distance/easingLength);
      const grade=THREE.MathUtils.lerp(seam,street,THREE.MathUtils.smoothstep(t,0,.55));
      const heel=incomingGrade*easingLength*easing*(1-easing)**2;
      return curve.getPointAt(t).setY(grade-heel);
    });
  });
  const approachRoads = [-1,1].map((sign,index) => [
    ...Array.from({length: 83}, (_,i) => {
      const s = sign*(72+i);
      return bridgeLocal(sign > 0 ? hanyangOffset(s) : 0,deckGrade(s),s);
    }),
    ...approachLinks[index].slice(1)
  ]);
  const approachSegments = approachRoads.flatMap(points => points.slice(1).map((b,i) => {
    const a = points[i], dx = b.x-a.x, dz = b.z-a.z;
    return { a,b,dx,dz,squared: dx*dx+dz*dz };
  }));
  const bridgeRoadBounds = new THREE.Box3().setFromPoints(approachRoads.flat()).expandByScalar(19);
  function roadAt(x,z) {
    if (x < bridgeRoadBounds.min.x || x > bridgeRoadBounds.max.x ||
        z < bridgeRoadBounds.min.z || z > bridgeRoadBounds.max.z) return null;
    let distanceSquared = 19*19, height;
    for (const {a,b,dx,dz,squared} of approachSegments) {
      const u = THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/squared,0,1);
      const d = (x-a.x-u*dx)**2 + (z-a.z-u*dz)**2;
      if (d >= distanceSquared) continue;
      distanceSquared = d;
      height = THREE.MathUtils.lerp(a.y,b.y,u);
    }
    return height === undefined ? null : { distance: Math.sqrt(distanceSquared), height };
  }
  function cutForApproach(x,z,y) {
    const road = roadAt(x,z);
    if (!road) return y;
    const cut = 1-THREE.MathUtils.smoothstep(road.distance, approachHalfWidth+1.5,15.5);
    const top = Math.max(LAND_Y-.12, road.height-.36);
    return y-Math.max(0,y-top)*cut;
  }

  const GROUND_BIN = 12;
  function groundTriangle(bins, a, b, c) {
    const xmin = Math.floor(Math.min(a[0], b[0], c[0])/GROUND_BIN);
    const xmax = Math.floor(Math.max(a[0], b[0], c[0])/GROUND_BIN);
    const zmin = Math.floor(Math.min(a[2], b[2], c[2])/GROUND_BIN);
    const zmax = Math.floor(Math.max(a[2], b[2], c[2])/GROUND_BIN);
    const area = (b[2]-a[2])*(c[0]-a[0]) - (b[0]-a[0])*(c[2]-a[2]);
    if (Math.abs(area) < 1e-6) return false;
    const triangle = { a, b, c, area };
    for (let z = zmin; z <= zmax; z++) for (let x = xmin; x <= xmax; x++) {
      const key = x + ',' + z;
      if (!bins.has(key)) bins.set(key, []);
      bins.get(key).push(triangle);
    }
    return area;
  }
  const coastGround = new Map(), shoulderGround = new Map();
  function groundSampler(bins, x, z) {
    const triangles = bins.get(Math.floor(x/GROUND_BIN) + ',' + Math.floor(z/GROUND_BIN));
    if (!triangles) return -Infinity;
    let height = -Infinity;
    for (const { a, b, c, area } of triangles) {
      const ax = x-a[0], az = z-a[2];
      const v = (az*(c[0]-a[0])-ax*(c[2]-a[2])) / area;
      const w = ((b[2]-a[2])*ax-(b[0]-a[0])*az) / area;
      const u = 1-v-w;
      if (u >= -1e-5 && v >= -1e-5 && w >= -1e-5) height = Math.max(height, u*a[1]+v*b[1]+w*c[1]);
    }
    return height;
  }
  function registerPlantingSurface(geometry) {
    const p = geometry.attributes.position, index = geometry.index.array;
    const point = i => [p.getX(i), p.getY(i), p.getZ(i)];
    for (let i = 0; i < index.length; i += 3)
      groundTriangle(shoulderGround, point(index[i]), point(index[i+1]), point(index[i+2]));
  }

  /* 水纹图保存横向距离、岸带与沿江航程。两江汇合处让不同方向的笔触都变淡。 */
  // Extend the atlas downstream at the existing texel density.
  const FLOW_H = 512, FLOW_W = 640, WR = { x: -1000, z: -1300, w: 3000, h: 2200 };
  const downstreamFade = '1090.,1610.';
  const [flowTex, driftTex] = (() => {
    const data = new Uint8Array(FLOW_W * FLOW_H * 4);
    const drift = new Uint8Array(FLOW_W * FLOW_H * 4);
    function segments(samples, step) {
      const stations = samples.filter((_, i) => i % step === 0 || i === samples.length-1);
      let along = 0;
      return stations.slice(0,-1).map((s,i)=>{
        const next = stations[i+1], dx = next.p.x-s.p.x, dz = next.p.z-s.p.z;
        const length = Math.hypot(dx,dz);
        const record = { x:s.p.x, z:s.p.z, dx:dx/length, dz:dz/length, length,
          w:s.w, taper:(next.w-s.w)/length, along };
        along += length;
        return record;
      });
    }
    const yangtze = segments(YZ.s,5), han = segments(HAN.s,4);
    function field(x,z,river,out) {
      let nearest=Infinity, segment, projection=0;
      for (const s of river) {
        const px=x-s.x, pz=z-s.z;
        const t=Math.max(0,Math.min(s.length,px*s.dx+pz*s.dz));
        const dx=px-t*s.dx, dz=pz-t*s.dz, distance=dx*dx+dz*dz;
        if (distance>=nearest) continue;
        nearest=distance;
        segment=s;
        projection=t;
      }
      if (segment) {
        const s=segment, t=projection;
        const radius=Math.sqrt(nearest);
        const cross=(x-s.x)*s.dz-(z-s.z)*s.dx;
        out.band=1-radius/(s.w+t*s.taper);
        out.across=(cross<0 ? -1 : 1)*radius;
        out.along=s.along+t;
      }
    }
    const yzField={}, hanField={}, outlet={};
    field(mouth.x,mouth.z,yangtze,outlet);
    const smooth=THREE.MathUtils.smoothstep;
    const byte = v => Math.round(Math.max(0,Math.min(1,v))*255);
    const LK = LAKES.map(L => L.filter((p, k) => k % 3 === 0));
    for (let j2 = 0; j2 < FLOW_H; j2++) {
      const z = WR.z + (j2 + .5) / FLOW_H * WR.h;
      for (let i2 = 0; i2 < FLOW_W; i2++) {
        const x = WR.x + (i2 + .5) / FLOW_W * WR.w;
        field(x,z,yangtze,yzField);
        field(x,z,han,hanField);
        const margin=hanField.band-yzField.band;
        const selected=margin>0 ? hanField : yzField;
        let signed=selected.across, band=selected.band, lake=0;
        const downstream=yzField.along-outlet.along;
        const turn=smooth(downstream,-20,42);
        const reach=smooth(downstream,-22,13)*(1-smooth(downstream,38,156));
        const tongueAxis=outlet.across*(1-.26*turn)+1.8*Math.sin(downstream*.055);
        const tongueWidth=22-8*turn;
        const tongue=reach*(1-smooth(Math.abs(yzField.across-tongueAxis),tongueWidth*.12,tongueWidth));
        const intoMain=smooth(downstream,-17,17)*smooth(yzField.band,-.23,.09);
        const intake=smooth(margin,-.15,.24)*smooth(hanField.band,-.11,.23)*(1-intoMain);
        const hanTint=Math.max(intake,.84*tongue);
        const merger=1-.74*Math.max(tongue*(1-smooth(downstream,24,80)),
          smooth(Math.min(yzField.band,hanField.band),-.05,.23)*(1-smooth(Math.abs(margin),.035,.23)));
        for (let li = 0; li < LAKES.length; li++) {
          const bb = LAKE_BB[li];
          if (x <= bb[0] || x >= bb[1] || z <= bb[2] || z >= bb[3] || !inPoly(LAKES[li], x, z)) continue;
          let de = 1e18;
          for (const p of LK[li]) {
            const dd = (p[0] - x) * (p[0] - x) + (p[1] - z) * (p[1] - z);
            if (dd < de) de = dd;
          }
          signed = z - lakeC.z;                               // 湖面平远：横笔数道，不作同心圆；所有湖都借东湖湖心定相，仅为横笔取一致的相位基准，与各湖自身位置无关
          band = Math.min(1, Math.sqrt(de) / LAKE_REACH[li]); // 按各湖尺寸定取样半径，小湖也能收到几笔，东湖（半径已封顶 120）不受影响
          lake = 1;
          break;
        }
        const o = (j2 * FLOW_W + i2) * 4;
        const cross=Math.round(THREE.MathUtils.clamp(signed/512+.5,0,1)*65535);
        data[o] = cross >> 8;
        data[o+1] = cross & 255;
        data[o+2] = byte((band+.12)/1.12);
        data[o+3] = byte(lake);
        const station=Math.round(Math.min(selected.along/6500,1)*65535);
        drift[o] = station >> 8;
        drift[o+1] = station & 255;
        drift[o+2] = byte(hanTint);
        drift[o+3] = byte(merger);
      }
    }
    return [data,drift].map(bytes=>{
      const tex=new THREE.DataTexture(bytes,FLOW_W,FLOW_H,THREE.RGBAFormat);
      tex.minFilter=tex.magFilter=THREE.LinearFilter;
      tex.needsUpdate=true;
      return tex;
    });
  })();

  const boatU = Array.from({length:6},()=>new THREE.Vector2(9e5,9e5));
  const boatWakeU = Array.from({length:6},()=>new THREE.Vector4(0,0,0,0));
  // One clock and wind direction keep the lake ripples and shoreline planting in step.
  const weatherU = {
    uTime: { value: 0 },
    uWindDirection: { value: new THREE.Vector2(4.4, 2.8).normalize() }
  };
  const waterU = Object.assign({
    ...weatherU, uBoats: { value: boatU }, uBoatWake: { value: boatWakeU },
    uFlow: { value: flowTex }, uDrift: { value: driftTex },
    uQuaySpurs: { value: Array.from({length: 3}, () => new THREE.Vector4()) },
    uQuayOut: { value: new THREE.Vector2() },
    uTrussInk: {value:null}, uTowerInk: {value:null},
    uBridgeAxis: {value:[new THREE.Vector4(),new THREE.Vector4()]},
    uBridgeBounds: {value:[new THREE.Vector4(),new THREE.Vector4()]},
    uCutwaterRow: { value: new THREE.Vector4() }, uCutwaterFlow: { value: new THREE.Vector4() },
    uRect: { value: new THREE.Vector4(WR.x, WR.z, WR.w, WR.h) }
  }, fogU, camU, sharedInk);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(X1 - X0 + 900, ZBOT - ZTOP + 900),
    new THREE.ShaderMaterial({
      uniforms: waterU,
      vertexShader: `varying vec3 vW; varying float vD;
        void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: NOISE + `
        uniform vec3 uFog, uInk, uPaper; uniform float uNear, uFar, uTime;
        uniform vec2 uWindDirection, uBoats[6]; uniform vec4 uBoatWake[6], uRect;
        uniform vec4 uCutwaterRow, uCutwaterFlow, uQuaySpurs[3];
        uniform vec2 uQuayOut;
        uniform sampler2D uFlow, uDrift, uTrussInk, uTowerInk;
        uniform vec4 uBridgeAxis[2], uBridgeBounds[2];
        uniform vec3 uCam;
        varying vec3 vW; varying float vD;
        // Short tapered crests interrupt the long washes when the camera approaches the water.
        float brokenCrest(vec2 p){
          vec2 cell = floor(p), local = fract(p)-.5;
          float seed = hash(cell);
          float x = (local.x-(hash(cell+3.7)-.5)*.24)/(.14+.20*seed);
          float taper = 1.-smoothstep(.24,1.,abs(x));
          float y = local.y-(hash(cell+7.1)-.5)*.44-.034*x*x-.12*(seed-.5)*x;
          float crest = 1.-smoothstep(.012,.077,abs(y));
          float echo = (1.-smoothstep(.015,.062,abs(y+.14)))*(1.-smoothstep(.16,.68,abs(x+.14)));
          return taper*(crest+.36*echo)*smoothstep(.18,.63,seed);
        }
        // Stagger the small groups in both axes so a portrait view never stacks them into rules.
        float lakeBrush(vec2 wind, float scale, float width){
          vec2 spacing = vec2(48.,38.)*scale;
          vec2 cell = floor(wind/spacing);
          float seed = hash(cell);
          vec2 jitter = vec2(hash(cell+2.4),hash(cell+8.1))-.5;
          vec2 offset = wind-(cell+.5+.40*jitter)*spacing;
          vec2 axis = normalize(vec2(1.,(hash(cell+9.4)-.5)*1.62));
          vec2 stroke = vec2(dot(offset,axis),dot(offset,vec2(-axis.y,axis.x)));
          float x = stroke.x/(scale*mix(5.9,13.1,hash(cell+6.2)));
          float y = stroke.y/width-(seed-.54)*1.45*x*x;
          float body = (1.-smoothstep(.12,1.,abs(x)))*(1.-smoothstep(.18,1.02,abs(y)));
          float echo = (1.-smoothstep(.12,.70,abs(x-.20)))*(1.-smoothstep(.16,.83,abs(y-2.45)));
          echo *= smoothstep(.16,.44,abs(x-.06))*smoothstep(.67,.93,seed);
          return (body+.52*echo)*smoothstep(.48,.76,seed);
        }
        vec2 cutwaterBrush(vec2 p, float time){
          vec2 delta = p-uCutwaterRow.xy;
          if(max(abs(delta.x),abs(delta.y))>57.) return vec2(0.);
          vec2 downstream = uCutwaterFlow.xy;
          vec2 lateral = vec2(-downstream.y,downstream.x);
          // Project across the current so a downstream trace stays attached to its own pier.
          float station = dot(delta,lateral)/dot(uCutwaterRow.zw,lateral);
          float pier = floor(station+4.);
          if(pier<0. || pier>7.) return vec2(0.);
          delta -= (pier-3.5)*uCutwaterRow.zw;
          vec2 fromCenter = vec2(dot(delta,downstream),dot(delta,lateral));
          vec2 nose = uCutwaterFlow.zw;
          vec2 upstream = fromCenter+nose;
          float split = abs(upstream.y);
          float bow = (1.-smoothstep(.06,.43,abs(upstream.x+.45-.40*split*split)));
          bow *= smoothstep(.15,.65,split)*(1.-smoothstep(1.18,2.65,split));
          vec2 tail = fromCenter-nose;
          float aft = tail.x;
          float lateralTail = abs(tail.y-.052*aft);
          float trace = 1.-smoothstep(.08,.50,abs(lateralTail-.48-.10*aft));
          trace *= smoothstep(.14,1.10,aft)*(1.-smoothstep(4.,9.5,aft));
          trace *= mix(.12,1.,smoothstep(-.55,.42,sin(.88*aft+1.7*pier-.68*time+tail.y)));
          // The granite batter is already below the surface. Place its ink outside the stone.
          vec2 rowAxis = normalize(uCutwaterRow.zw);
          vec2 footing = abs(vec2(dot(delta,vec2(-rowAxis.y,rowAxis.x)),dot(delta,rowAxis)));
          float flank = 1.05*(1.-smoothstep(2.95,4.98,footing.x));
          float lip = (1.-smoothstep(.10,1.16,abs(footing.y-flank-.33)))
                    * (1.-smoothstep(3.85,5.25,footing.x));
          // Occasional seam downstream of the cutwater; leave clear gaps between successive marks.
          float reach=hash(vec2(pier,8.7));
          float span=1.-smoothstep(.48,1.,abs(aft-9.-4.*reach)/(4.2+3.5*reach));
          float seam=1.-smoothstep(.12,.66,abs(tail.y-(reach-.5)*2.8-.06*aft-.25*sin(aft*.42-time*.13)));
          return vec2(bow,max(max(trace,lip*1.30),seam*span*reach*.91));
        }
        // The three orange tower plinths have chamfered plans, with a longer centre footing.
        float towerWaterline(vec2 p,vec4 axis,vec4 bounds,float time) {
          if(bounds.x<=0.) return 0.;
          vec2 normal=vec2(-axis.w,axis.z);
          vec2 delta=p-axis.xy;
          float crossDeck=dot(delta,normal);
          if(abs(crossDeck)>18.) return 0.;
          // Side-elevation bounds include the 200-unit deck plus the .20 border at either end.
          float scale=bounds.x/200.4, station=dot(delta,axis.zw);
          float tower=clamp(floor(station/(71.5*scale)+.5),-1.,1.);
          vec2 local=vec2(crossDeck,station-tower*71.5*scale);
          vec2 edge=abs(local)-vec2(11.44,(mix(16.5,8.9,abs(tower))*.5+.12)*scale);
          float rim=max(max(edge.x,edge.y),(edge.x+edge.y+1.16)*.7071);
          if(rim<-.1 || rim>5.6) return 0.;
          float grain=vnoise(local*vec2(.33,.48)+tower);
          float contact=(1.-smoothstep(.16,1.28,abs(rim-.34)))*(.63+.37*grain);
          float breakUp=smoothstep(.27,.72,vnoise(local*vec2(.22,.8)+time*.019));
          float echo=(1.-smoothstep(.18,1.12,abs(rim-2.22-.62*grain)))*breakUp;
          return .35*contact+.16*echo;
        }
        // Only the exposed, river-facing shoulders catch a stroke; leave quiet water in the inlets.
        vec2 quayBrush(vec2 p, float time){
          vec2 tangent = vec2(-uQuayOut.y,uQuayOut.x);
          vec2 brush = vec2(0.);
          for(int i=0;i<3;i++){
            vec4 rock = uQuaySpurs[i];
            vec2 delta = p-rock.xy;
            float along = dot(delta,tangent)/max(.1,rock.z);
            float outwards = dot(delta,uQuayOut);
            if(abs(along)>1.4 || outwards<0. || outwards>rock.w+2.1) continue;
            float rim = rock.w*sqrt(max(0.,1.-along*along));
            float phase = float(i)*2.1 + along*2.3;
            float gap = outwards-rim-.12*sin(phase+time*.30);
            float span = (1.-smoothstep(.65,1.16,abs(along)))*smoothstep(-.23,.48,along*sin(float(i)+1.4)+.35);
            float wash = (1.-smoothstep(.12,.95,abs(gap-.18)))*span;
            float glint = (1.-smoothstep(.055,.30,abs(gap-.85)))*span;
            glint *= smoothstep(-.45,.65,sin(phase*1.9+.20*time));
            brush = max(brush,vec2(wash,glint));
          }
          return brush;
        }
        // Reflect the actual bridge elevation across the water plane, then let gaps in the ink show through.
        float bridgeWash(vec2 waterAt, vec4 axis, vec4 bounds, sampler2D silhouette){
          vec2 ray = waterAt - uCam.xz;
          vec2 normal = vec2(-axis.w,axis.z);
          float across = dot(ray,normal);
          if(abs(across)<.01 || bounds.x<=0.) return 0.;
          float further = dot(axis.xy-waterAt,normal)/across;
          if(further<0.) return 0.;
          vec2 local = vec2(dot(waterAt + ray*further-axis.xy,axis.zw),uCam.y*further);
          vec2 uv = (local-bounds.zw)/bounds.xy;
          if(min(uv.x,uv.y)<0. || max(uv.x,uv.y)>1.) return 0.;
          // Filter along the projected elevation so narrow rails soften into the same wash.
          // A low-frequency lateral drift leaves the reflected tower body continuous.
          vec2 band=waterAt*vec2(.047,.082);
          float drift=uTime*.016;
          float wash=vnoise(band+vec2(drift*.16,0.));
          float ripple=sin(waterAt.y*.61+waterAt.x*.14+drift+2.1*wash);
          uv+=vec2(ripple*(.10+.24*uv.y),.09*ripple)/bounds.xy;
          vec2 spread=vec2(.40,.62+.80*uv.y)/bounds.xy;
          float body=.44*texture2D(silhouette,uv).r;
          body+=.18*(texture2D(silhouette,uv+vec2(0.,spread.y)).r+
                     texture2D(silhouette,uv-vec2(0.,spread.y)).r);
          body+=.10*(texture2D(silhouette,uv+spread).r+texture2D(silhouette,uv-spread).r);
          float grounded=1.-smoothstep(.02,.35,uv.y);
          return body*(.29+.15*wash+.045*ripple+.15*grounded)*(1.-.47*uv.y);
        }
        void main(){
          vec2 p = vW.xz;
          vec2 uv = (p - uRect.xy) / uRect.zw;
          vec4 f = texture2D(uFlow, clamp(uv, .0015, .9985));
          float inR = step(0., uv.x) * step(uv.x, 1.) * step(0., uv.y) * step(uv.y, 1.);
          const vec2 word = vec2(65280.,255.)/65535.;
          float aw = (dot(f.rg,word)-.5)*512.;  // 距中泓的世界距离
          float shore = f.b*1.12-.12;
          float band = max(0.,shore);         // 1 江心 → 0 近岸
          float lake = f.a;
          float wet = max(lake,smoothstep(-.12,.035,shore))*inR;

          float haze = smoothstep(uNear,uFar,vD);
          // The mapped downstream reach runs east into paper, before the mask ends.
          float riverFade = (1.-lake)*smoothstep(${downstreamFade},p.x);
          if(wet<.001){
            gl_FragColor=vec4(mix(uPaper,uFog,haze),1.);
            return;
          }
          vec3 base = uPaper;
          float ink = 0.;
          float paperLight = 0.;
          float ambientDriftTime = uTime / 6.;
          float fineDetail = 1.-smoothstep(300.,1050.,vD);
          if(lake<.999){
            vec4 drift = texture2D(uDrift,clamp(uv,.0015,.9985));
            float station = dot(drift.rg,word)*6500.;
            vec2 stream = vec2(station,aw);
            // Broad brush groups travel along the mapped channel. Warped spacing and
            // broken ends let the moving strokes read at the scale of the whole city.
            vec2 current = vec2(station-ambientDriftTime*13.,aw);
            float group = vnoise(current*vec2(.021,.051));
            float phase = aw*.22+4.8*vnoise(current*vec2(.011,.036))+.47*sin(current.x*.033);
            float strokes = smoothstep(.08,.94,sin(phase))*smoothstep(.31,.77,group);
            float away = smoothstep(.04,.30,band);
            // 低机位放大近岸细笔，放慢细纹漂移，宽笔水势仍沿原流速推进。
            float fineDriftTime = ambientDriftTime / 7.;
            float fineStation = station-fineDriftTime*13.;
            vec2 ripples = vec2(aw+.16*fineStation, fineStation-.24*aw)*vec2(.073,.061);
            float crests = brokenCrest(ripples)*(.46+.54*group)*fineDetail;
            ink += (strokes*.26+crests*.25)*away*drift.a*(1.-lake);

            float knot = fbm(stream*vec2(.025,.14));
            float driftPhase = aw*.78+knot*.93;
            float track = floor(driftPhase/6.28318+.5);
            float across = abs(fract(driftPhase/6.28318+.5)-.5)*6.28318;
            float advance = (station-fineDriftTime*9.)*.071+hash(vec2(track,17.));
            float segment = floor(advance);
            float grain = hash(vec2(segment,track));
            float along = (fract(advance)-.5)/mix(.19,.47,grain);
            float shape = length(vec2(across/mix(.22,.46,grain),along));
            float main = (1.-smoothstep(.14,1.,shape))*smoothstep(.16,.69,grain);
            float dryMask = smoothstep(.47,.74,vnoise(stream*vec2(.31,.19)-vec2(fineDriftTime*.047,0.)));
            float faint = smoothstep(.92,.999,sin(driftPhase*2.07+knot))*dryMask;
            ink += (main*.17+faint*.065)*fineDetail*away*drift.a*(1.-lake);

            vec3 tint = mix(vec3(.64,.66,.56),vec3(.45,.64,.60),drift.b);
            float pigment = (.32+.26*away+.075*fbm(stream*vec2(.013,.043)))*wet*(1.-lake);
            base = mix(base,tint,pigment);
            if(vD<290. && lake<.001 && shore>.012){
              float pierDetail = (1.-smoothstep(145.,290.,vD))*smoothstep(.012,.075,shore);
              vec2 brush = cutwaterBrush(p,ambientDriftTime)*pierDetail;
              paperLight = .30*brush.x;
              ink += .235*brush.y;
              ink += towerWaterline(p,uBridgeAxis[1],uBridgeBounds[1],ambientDriftTime)*pierDetail;
            }
            vec2 quayDelta = abs(p-uQuaySpurs[1].xy);
            if(vD<185. && max(quayDelta.x,quayDelta.y)<38. && lake<.001){
              vec2 brush = quayBrush(p,ambientDriftTime)*(1.-smoothstep(90.,185.,vD));
              ink += .09*brush.x;
              paperLight += .19*brush.y;
            }
          }
          if(lake>.001){
            vec2 wind = p-uWindDirection*(5.2*ambientDriftTime);
            float wash = smoothstep(.29,.76,vnoise(wind*vec2(.018,.038)));
            float warp = 4.4*vnoise(wind*vec2(.008,.029));
            float lakeDetail = 1.-smoothstep(185.,520.,vD);
            float lakeInk = 0.;
            if(lakeDetail<1.){
              // World-space strokes with enough body to survive the compressed aerial view.
              lakeInk = lakeBrush(wind,1.48,2.25)*.235*(1.-lakeDetail)*smoothstep(.035,.31,band);
            }
            if(lakeDetail>0.){
              lakeInk += lakeBrush(wind,1.,1.)*.135*lakeDetail*smoothstep(.035,.31,band);
              vec2 ripples = vec2(wind.x+.11*wind.y,wind.y-.08*wind.x)*vec2(.097,.14);
              lakeInk += brokenCrest(ripples)*(.30+.70*wash)*.23*lakeDetail*smoothstep(.018,.21,band);
            }
            float littoral = (1.-smoothstep(.0,.42,band))*lake*wet;
            float lakeWash = lake*wet*(.153+.032*vnoise(p*.009))+.27*littoral*(.75+.5*vnoise(p*.02));
            float shoreRipples = smoothstep(.86,.99,sin(p.y*2.2+warp+ambientDriftTime*.25));
            lakeInk += .12*littoral*shoreRipples*smoothstep(.32,.70,fbm(p*.075))*lakeDetail;
            base = mix(base,vec3(.43,.57,.57),lakeWash);
            ink += lakeInk*lake;
          }
          vec3 col = mix(base,uInk,wet*ink);
          col = mix(col,uPaper,wet*paperLight);
          if(lake<.05 && vD<420. && uCam.y<175.){
            float weight = wet*(1.-smoothstep(240.,420.,vD))*(1.-.38*smoothstep(30.,85.,uCam.y))*(1.-smoothstep(90.,175.,uCam.y));
            col=mix(col,vec3(.30,.40,.39),weight*.73*bridgeWash(p,uBridgeAxis[0],uBridgeBounds[0],uTrussInk));
            col=mix(col,vec3(.48,.32,.25),weight*.73*bridgeWash(p,uBridgeAxis[1],uBridgeBounds[1],uTowerInk));
          }
          float foam = 0.;
          for(int i=0;i<6;i++){
            vec4 wake=uBoatWake[i];
            vec2 delta=p-uBoats[i];
            float aft=-dot(delta,wake.xy)-wake.z;
            if(aft<0. || aft>=wake.w) continue;
            float lateral=abs(dot(delta,vec2(-wake.y,wake.x)));
            float t=aft/wake.w;
            float strength=smoothstep(0.,.12,t)*(1.-smoothstep(.30,1.,t));
            float width=mix(.12,.42,t);
            float ripple=sin(aft*1.7-uTime*2.5)*.10;
            float v=1.-smoothstep(width*.36,width,abs(lateral-aft*.27-ripple));
            float echo=1.-smoothstep(width*.34,width,abs(lateral-aft*.42-ripple));
            float prop=(1.-smoothstep(.04,.32,lateral))*max(0.,sin(aft*1.8-uTime*2.6))
               *(1.-smoothstep(.05,.20,t));
            foam=max(foam,(v*.60+echo*.29*(1.-smoothstep(.30,.67,t))+prop*.32)*strength);
          }
          col=mix(col,mix(uPaper,vec3(1.,.985,.93),.58),wet*foam*mix(.95,.40,lake));
          col = mix(col,uFog,max(haze,riverFade));
          gl_FragColor = vec4(col, 1.);
        }`
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set((X0 + X1) / 2, 0, (ZTOP + ZBOT) / 2);
  scene.add(water);

  /* 岸脚接原水线，岸顶接回三镇陆块。分带退入陆侧，桥下江宽不变。 */
  function riverBanks() {
    const cap = new Map();
    // Let the existing lowest stone step pick up the same tide mark as the exposed quay rocks.
    const dampStone = M.bankStone.clone();
    dampStone.uniforms = M.bankStone.uniforms;
    dampStone.defines = {...dampStone.defines, TIDAL_STONE: 1};
    const batches = [
      { name: '两江近水石驳岸', material: 'BankStone', ink: dampStone, vertices: [], indices: [] },
      { name: '两江岸坡', material: 'BankGrass', ink: M.bankGrass, vertices: [], indices: [] },
      { name: '两江分阶近水步道', material: 'Path', ink: M.bankPath, vertices: [], indices: [] }
    ];
    const profile = [[0, .035], [.15, .17], [.27, .23], [.45, .23],
      [.52, .43], [.66, .43], [.82, .59], [1, LAND_Y]];
    const materialAt = [0, 0, 2, 0, 2, 1, 1];
    const segments = [[hanNorthBank, 1, 2.65], [hanSouthBank, -1, 2.65],
      [yangtzeUpperWest, 1, 4.6], [yangtzeLowerWest, 1, 4.6], [yzE, -1, 4.6]];
    const fade = THREE.MathUtils.smoothstep;
    for (const [edge, side, width] of segments) {
      const sections = edge.map(([x, z], i) => {
        const a = edge[Math.max(0, i-1)], b = edge[Math.min(edge.length-1, i+1)];
        const tx = b[0]-a[0], tz = b[1]-a[1], len = Math.hypot(tx, tz) || 1;
        const nx = side*tz/len, nz = -side*tx/len;
        const center = Math.hypot((x-AT.bridge.x)*.84, (z-AT.bridge.z)*.72);
        const entry = fade(Math.min(i, edge.length-i-1), 0, 7);
        const setback = width * entry * (1-fade(center, 302, 720));
        let w = Math.min(setback, .62*Math.min(Math.hypot(x-a[0], z-a[1]), Math.hypot(b[0]-x, b[1]-z)));
        // Very tight bends can fold parallel offsets back across the water mask.
        while (w > .10 && ![.15, .52, 1].every(t => onLand(x+nx*w*t, z+nz*w*t))) w *= .55;
        if (w <= .10) w = 0;
        const depth = fade(w, 0, .98);
        const row = profile.map(([t, y]) => [x+nx*w*t, LAND_Y+(y-LAND_Y)*depth, z+nz*w*t]);
        cap.set(edge[i], [row.at(-1)[0], row.at(-1)[2]]);
        return row;
      });
      for (let i = 1; i < sections.length; i++) for (let j = 0; j < materialAt.length; j++) {
        const q = [sections[i-1][j], sections[i][j], sections[i-1][j+1], sections[i][j+1]];
        const { vertices, indices } = batches[materialAt[j]], start = vertices.length / 3;
        const first = indices.length;
        for (const [a, b, c] of [[0, 1, 2], [1, 3, 2]]) {
          const area = groundTriangle(coastGround, q[a], q[b], q[c]);
          if (area > 0) indices.push(start+a, start+b, start+c);
          if (area < 0) indices.push(start+a, start+c, start+b);
        }
        if (indices.length > first) for (const point of q) vertices.push(...point);
      }
    }
    for (const batch of batches) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(batch.vertices, 3));
      geometry.setIndex(batch.indices); geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, batch.ink);
      mesh.name = batch.name;
      mesh.userData.landscapeSurface = { group: '三镇河岸', name: batch.name, material: batch.material };
      mesh.raycast = function () {};
      scene.add(mesh);
    }
    return cap;
  }
  const coastCap = riverBanks();

  // Interpolate the exact rendered embankment sections between survey samples.
  function riverBankFrame(edge, station) {
    const i=Math.floor(station), t=station-i;
    const line=(a,b)=>V(a[0],0,a[1]).lerp(V(b[0],0,b[1]),t);
    const shore=line(edge[i],edge[i+1]);
    const cap=line(coastCap.get(edge[i]),coastCap.get(edge[i+1]));
    const inland=cap.clone().sub(shore).normalize();
    const tangent=V(edge[i+1][0]-edge[i][0],0,edge[i+1][1]-edge[i][1]).normalize();
    return {shore,cap,inland,tangent};
  }

  // Let the ink outline dissolve with the downstream wash at the edge of the map.
  const coastInk = [lineMat, lineMat2].map(base => {
    const mat = base.clone();
    mat.onBeforeCompile = shader => {
      shader.vertexShader = 'varying float vEasting;\n'+shader.vertexShader.replace(
        '#include <begin_vertex>', '#include <begin_vertex>\nvEasting = (modelMatrix * vec4(position, 1.)).x;');
      shader.fragmentShader = 'varying float vEasting;\n'+shader.fragmentShader.replace(
        '#include <color_fragment>', `#include <color_fragment>\ndiffuseColor.a *= 1.-smoothstep(${downstreamFade},vEasting);`);
    };
    return mat;
  });
  /* 陆地：三镇分别成块，湖洞沿用水体掩膜。 */
  function landMesh(poly, holes) {
    const sh = new THREE.Shape(poly.map(p => coastCap.get(p) || p).map(p => new THREE.Vector2(p[0], -p[1])));
    (holes || []).forEach(h => sh.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], -p[1])))));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 1.3, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, M.land); m.position.y = LAND_Y - 1.3; ink(m, 35, ...coastInk);  // 挤出体的顶面与地形、街巷共用 LAND_Y
    m.raycast = function () {};
    return m;
  }
  // 湖整个落在哪块陆地里，就在哪块上挖空
  const holesIn = poly => LAKES.filter(L => L.every(p => inPoly(poly, p[0], p[1])));
  const LAND_HOLES = [holesIn(HANKOU), holesIn(HANYANG), holesIn(WUCHANG)];
  scene.add(landMesh(HANKOU, LAND_HOLES[0]), landMesh(HANYANG, LAND_HOLES[1]), landMesh(WUCHANG, LAND_HOLES[2]));

  /* ═════════ 六、山：DEM 决定形状和高度 ═════════
     Catmull-Rom 加密格点。山脚在低起伏处缓缓归入平原，网格与地表采样共用三角面。 */
  const VEX = 5 / MPU;                                  // 米 → 场景单位，竖向五倍
  const landHeight = (x, z) => {
    const shore = groundSampler(coastGround, x, z);
    return Number.isFinite(shore) ? shore : LAND_Y;
  };
  function triangleOnLand(a, b, c) {
    return [a, b, c].every(p => onLand(p[0], p[2]))
      && onLand((a[0]+b[0]+c[0])/3, (a[2]+b[2]+c[2])/3)
      && [[a,b], [b,c], [c,a]].every(([p,q]) => onLand((p[0]+q[0])/2, (p[2]+q[2])/2));
  }
  function hillField(t) {
    const bin = atob(t.q), a = new Float32Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i) * .5 * VEX;
    const o = geo(t.lon0, t.lat0), e = geo(t.lon0 + t.dlon, t.lat0 + t.dlat);
    return { a, nx: t.nx, nz: t.nz, x0: o.x, z0: o.z, dx: e.x - o.x, dz: e.z - o.z };
  }
  const crSpline = (p0, p1, p2, p3, t) =>
    p1 + .5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  function sampleField(f, x, z) {
    const u = (x - f.x0) / f.dx, v = (z - f.z0) / f.dz;
    if (u < 0 || v < 0 || u > f.nx - 1 || v > f.nz - 1) return 0;
    const i = Math.floor(u), j = Math.floor(v), fx = u - i, fz = v - j;
    const at = (ii, jj) => f.a[Math.min(f.nz - 1, Math.max(0, jj)) * f.nx + Math.min(f.nx - 1, Math.max(0, ii))];
    const row = jj => crSpline(at(i - 1, jj), at(i, jj), at(i + 1, jj), at(i + 2, jj), fx);
    return Math.max(0, crSpline(row(j - 1), row(j), row(j + 1), row(j + 2), fz));
  }
  // Align the long terrace face to the shore at the foot of Guishan.
  const qcSite = {
    x: AT.qc.x-9, z: AT.qc.z-5, y: LAND_Y+2.8, yaw: 1.16,
    scaleX: .85, scaleY: .92, scaleZ: .60
  };
  const qcCos = Math.cos(qcSite.yaw), qcSin = Math.sin(qcSite.yaw);
  function cutForQingchuan(x, z, y) {
    const dx = x-qcSite.x, dz = z-qcSite.z;
    const u = (qcCos*dx-qcSin*dz)/qcSite.scaleX, v = (qcSin*dx+qcCos*dz)/qcSite.scaleZ;
    const side = Math.max(-24.7-u, u-27.7, 0);
    const rear = Math.max(0, -7.7-v);
    const front = Math.max(0, v-25);
    const blend = THREE.MathUtils.smoothstep(Math.hypot(side*qcSite.scaleX, Math.max(rear,front)*qcSite.scaleZ), 0, 8);
    if (blend === 1) return y;
    // The uphill terrace meets the deck below its coping. The front lands at the bank walk.
    const frontGrade = THREE.MathUtils.smoothstep(v, 3.5, 10.5);
    const grade = THREE.MathUtils.lerp(qcSite.y-.16, LAND_Y+.07, frontGrade);
    return Math.min(y, THREE.MathUtils.lerp(grade, y, blend));
  }
  const hillGround = new Map();
  const HILLS = GEO.hills.map(t => {
    const f = hillField(t), pk = geo(t.peak[0], t.peak[1]), guishan = t.name === '龟山';
    const SUB = 3, cols = (f.nx - 1) * SUB + 1, rows = (f.nz - 1) * SUB + 1;
    const pos = new Float32Array(cols * rows * 3), idx = [], points = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = f.x0 + i / SUB * f.dx, z = f.z0 + j / SUB * f.dz, h = sampleField(f, x, z), k = (j * cols + i) * 3;
      const toe = THREE.MathUtils.smoothstep(h, .04, 1.45);
      const coast = groundSampler(coastGround, x, z);
      const y = LAND_Y + (.03+h)*toe - .075*(1-toe);
      pos[k] = x - pk.x;
      const grade = guishan ? cutForQingchuan(x,z,y) : y;
      pos[k+1] = Number.isFinite(coast) || !onLand(x,z) ? -.12 : cutForApproach(x,z,grade);
      pos[k+2] = z - pk.z;
      points.push([x, pos[k+1], z]);
    }
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
      for (const tri of [[a, c, b], [b, c, d]]) {
        const [p, q, r] = tri.map(k => points[k]);
        if (Math.max(p[1], q[1], r[1]) <= LAND_Y-.05 || !triangleOnLand(p, q, r)) continue;
        idx.push(...tri);
        groundTriangle(hillGround, p, q, r);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, M.hill); mesh.position.set(pk.x, 0, pk.z);
    mesh.name = t.name || '城郊低岭';
    mesh.userData.landscapeSurface = { group: '山林', name: mesh.name, material: 'Hills' };
    scene.add(mesh);
    return { name: t.name, f, mesh, peak: pk, x0: f.x0, x1: f.x0 + (f.nx - 1) * f.dx, z0: f.z0, z1: f.z0 + (f.nz - 1) * f.dz };
  });
  const HILL = {}; HILLS.forEach(h => { if (h.name) HILL[h.name] = h; });
  const landSurface = (x, z) => Math.max(landHeight(x, z), groundSampler(hillGround, x, z));
  const terrainTop = (x, z) => onLand(x, z) ? landSurface(x, z) : 0;
  const reliefAt = (x, z) => Math.max(0, terrainTop(x, z)-LAND_Y);
  const plantingSurface = (x, z) => onLand(x, z) ? Math.max(landSurface(x, z), groundSampler(shoulderGround, x, z)) : null;

  // Keep a continuous low corridor through the distant washes, including the eastward bend.
  function riverClearance(x, z) {
    let clearance = Infinity;
    for (const river of [YZ, HAN]) for (let i = 0; i < river.s.length-1; i += 3) {
      const a = river.s[i], b = river.s[Math.min(i+3,river.s.length-1)];
      const dx = b.p.x-a.p.x, dz = b.p.z-a.p.z, lengthSq = dx*dx+dz*dz;
      const t = THREE.MathUtils.clamp(((x-a.p.x)*dx+(z-a.p.z)*dz)/lengthSq,0,1);
      const across = Math.hypot(x-a.p.x-t*dx,z-a.p.z-t*dz);
      clearance = Math.min(clearance, across-THREE.MathUtils.lerp(a.w,b.w,t));
    }
    return THREE.MathUtils.smoothstep(clearance, 35, 210);
  }

  // 远山：层层淡出，烘托「烟波浩渺」
  const ridgeFogFar = { value: 3400 };
  function ridgeNoise(t) {
    const i = Math.floor(t), f = t - i;
    const sample = k => THREE.MathUtils.euclideanModulo(Math.sin(k * 127.1 + 31.7) * 43758.5453, 1) * 2 - 1;
    return THREE.MathUtils.lerp(sample(i), sample(i + 1), f * f * (3 - 2 * f));
  }
  [
    { z:  -980, tone: .24, n: 10, h: 132, w: 390 },
    { z: -1360, tone: .44, n: 9,  h: 187, w: 520 },
    { z:  1080, tone: .32, n: 9,  h: 149, w: 442 },
    { z:  1520, tone: .52, n: 8,  h: 209, w: 559 }
  ].forEach(Lr => {
    const mat = inkMat(.46 + Lr.tone * .24, false, ['#454b44', '#d9d9ce'], null, { foot: 1 });
    mat.defines = { RIDGE_CLOUD: 1 };
    mat.extensions.derivatives = true;
    mat.uniforms.uFar = ridgeFogFar;
    for (let i = 0; i < Lr.n; i++) {
      const x = (i - (Lr.n - 1) / 2) * Lr.w * .95 + (rnd() - .5) * 200 + 200;
      const radius = Lr.w * (.6 + rnd() * .5), height = Lr.h * (.55 + rnd() * .7);
      const z = Lr.z + (rnd() - .5) * 160, depth = Lr.w * .35;
      const geometry = new THREE.PlaneGeometry(2, 2, 56, 12);
      geometry.rotateX(-Math.PI / 2);
      const vertices = geometry.attributes.position;
      for (let j = 0; j < vertices.count; j++) {
        const along = vertices.getX(j), across = vertices.getZ(j);
        const worldX = x + along * radius;
        // 中间一行是蜿蜒的分水岭；山腹向两侧跌落，边沿在纸面下接平。
        const spine = .26 * ridgeNoise((worldX + z) / 125);
        const offsetZ = depth * (across + spine * (1 - Math.abs(across)));
        const worldZ = z + offsetZ, station = worldX + worldZ * .23;
        const peaks = .94 + .37 * ridgeNoise(station / 96) + .22 * ridgeNoise(station / 47) + .09 * ridgeNoise(station / 22);
        const flank = (1 - along * along) * Math.pow(1 - Math.abs(across), 1.3);
        vertices.setXYZ(j, along * radius, flank * peaks * riverClearance(worldX, worldZ), offsetZ);
      }
      geometry.computeVertexNormals();
      const ridge = new THREE.Mesh(geometry, mat);
      ridge.position.set(x, -6, z);
      ridge.scale.y = height;
      ridge.userData.landscapeSurface = { group: '远山', name: '远岭 ' + Lr.z + ' · ' + (i+1), material: 'DistantRidge' };
      scene.add(ridge);
    }
  });
