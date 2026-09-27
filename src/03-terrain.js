
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

  const HANKOU = hanN.slice(0, hanN.length - HCUT)
    .concat(yzW.slice(kk + HCUT))
    .concat([[X1, yzW[yzW.length - 1][1]], [X1, ZTOP], [X0, ZTOP], [X0, hanN[0][1]]]);   // 长江自东缘出图：北岸沿江向东收到场景边，东北角是陆地
  const HANYANG = yzW.slice(0, Math.max(1, kk - HCUT)).reverse()
    .concat([[yzW[0][0], ZBOT], [X0, ZBOT], [X0, hanS[0][1]]])
    .concat(hanS.slice(0, hanS.length - HCUT));
  const WUCHANG = yzE.slice()
    .concat([[X1, yzE[yzE.length - 1][1]], [X1, ZBOT], [yzE[0][0], ZBOT]]);

  // 湖：实测水体掩膜圆滑后的岸线。第一个是东湖——中国最大的城中湖，水域约 33 平方公里
  const LAKES = GEO.lakes.map(L => {                    // 再过一遍 Catmull-Rom，成自然湖岸
    const c = new THREE.CatmullRomCurve3(L.pts.map(p => gv(p[0], p[1], 0)), true, 'catmullrom', .5);
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

  /* 水面：以「水纹图」驱动的笔触——顺流成线，近岸留白，湖面作同心波 */
  const FN = 512, WR = { x: -1000, z: -1300, w: 2400, h: 2200 };
  const flowTex = (() => {
    const data = new Uint8Array(FN * FN * 4);
    const CL = [];
    const grab = (S, step) => {
      for (let k = 0; k < S.length; k += step) {
        const s = S[k], L = Math.hypot(s.d.x, s.d.z) || 1;
        CL.push({ x: s.p.x, z: s.p.z, w: s.w, nx: s.d.z / L, nz: -s.d.x / L });
      }
    };
    grab(YZ.s, 5); grab(HAN.s, 4);   // 汉水原始采样点比长江少，跨步也按比例调小，取完两条中泓线的点数、烘焙开销大致相当
    const LK = LAKES.map(L => L.filter((p, k) => k % 3 === 0));
    for (let j2 = 0; j2 < FN; j2++) {
      const z = WR.z + (j2 + .5) / FN * WR.h;
      for (let i2 = 0; i2 < FN; i2++) {
        const x = WR.x + (i2 + .5) / FN * WR.w;
        let bd = 1e18, b = CL[0];
        for (let k = 0; k < CL.length; k++) {
          const c = CL[k], dd = (c.x - x) * (c.x - x) + (c.z - z) * (c.z - z);
          if (dd < bd) { bd = dd; b = c; }
        }
        const dist = Math.sqrt(bd);
        let signed = (x - b.x) * b.nx + (z - b.z) * b.nz;
        let band = 1 - dist / b.w, wet = dist < b.w ? 1 : 0, lake = 0;
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
          wet = 1; lake = 1;
          break;
        }
        const o = (j2 * FN + i2) * 4;
        data[o]     = Math.round(Math.min(1, Math.max(0, signed / 512 + .5)) * 255);
        data[o + 1] = Math.round(Math.min(1, Math.max(0, band)) * 255);
        data[o + 2] = wet * 255;
        data[o + 3] = lake * 255;
      }
    }
    const t = new THREE.DataTexture(data, FN, FN, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = false; t.premultiplyAlpha = false; t.needsUpdate = true;
    return t;
  })();

  const boatU = [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector2(9e5, 9e5));
  const waterU = Object.assign({
    uTime: { value: 0 }, uBoats: { value: boatU },
    uFlow: { value: flowTex }, uRect: { value: new THREE.Vector4(WR.x, WR.z, WR.w, WR.h) }
  }, fogU, camU, sharedInk);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(X1 - X0 + 900, ZBOT - ZTOP + 900),
    new THREE.ShaderMaterial({
      uniforms: waterU,
      vertexShader: `varying vec3 vW; varying float vD;
        void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: NOISE + `
        uniform vec3 uFog, uInk, uPaper; uniform float uNear, uFar, uTime;
        uniform vec2 uBoats[6]; uniform sampler2D uFlow; uniform vec4 uRect;
        varying vec3 vW; varying float vD;
        void main(){
          vec2 p = vW.xz;
          vec2 uv = (p - uRect.xy) / uRect.zw;
          vec4 f = texture2D(uFlow, clamp(uv, .0015, .9985));
          float inR = step(0., uv.x) * step(uv.x, 1.) * step(0., uv.y) * step(uv.y, 1.);
          float aw   = (f.r - .5) * 512.0;          // 距中泓的世界距离
          float band = f.g;                          // 1 江心 → 0 近岸
          float wet  = f.b * inR;

          float lake = f.a;
          float freq = mix(.38, .17, lake);          // 湖面笔疏，江面笔密
          float warp  = fbm(p * .010 + uTime * .004) * 11.0 + fbm(p * .035) * 3.0;
          float s1 = sin(aw * freq + warp + uTime * .20);
          float s2 = sin(aw * freq * 3.0 - warp * .5 + uTime * .38);
          // 成片的留白把长线断开，沿程还有浓淡
          float wash = mix(.26, .04, lake) + (1. - mix(.26, .04, lake))
                     * smoothstep(mix(.30, .42, lake), .68, fbm(p * .0068 + vec2(uTime * .010, 0.)));
          float vary = .42 + .58 * fbm(vec2(aw * .035, fbm(p * .0035) * 4.0));
          float mid = smoothstep(.02, .26, band);    // 近岸留白
          float ink = smoothstep(.42, .94, s1) * wash * vary * mid * .80
                    + smoothstep(.80, .99, s2) * wash * mid * .38;
          ink *= wet * mix(1.0, .34, lake);          // 湖面平静，笔淡

          for(int i = 0; i < 6; i++){
            float r = distance(p, uBoats[i]);
            float ring = smoothstep(.86, 1., sin(r * 1.7 - uTime * 1.6)) * smoothstep(9., 1.5, r);
            ink = max(ink, ring * .5 * wet);
          }

          vec3 base = uPaper * mix(1.0, .935 - fbm(p * .004) * .06, wet);
          vec3 col = mix(base, uInk, clamp(ink, 0., 1.));
          col = mix(col, uFog, smoothstep(uNear, uFar, vD));
          gl_FragColor = vec4(col, 1.);
        }`
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set((X0 + X1) / 2, 0, (ZTOP + ZBOT) / 2);
  scene.add(water);

  /* 陆地：三镇各自成块，东湖在武昌之中挖空；棱边即是岸线 */
  function landMesh(poly, holes) {
    const sh = new THREE.Shape(poly.map(p => new THREE.Vector2(p[0], -p[1])));
    (holes || []).forEach(h => sh.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], -p[1])))));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 1.3, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, M.land); m.position.y = LAND_Y; ink(m, 35);
    m.raycast = function () {};
    return m;
  }
  // 湖整个落在哪块陆地里，就在哪块上挖空
  const holesIn = poly => LAKES.filter(L => L.every(p => inPoly(poly, p[0], p[1])));
  const LAND_HOLES = [holesIn(HANKOU), holesIn(HANYANG), holesIn(WUCHANG)];
  scene.add(landMesh(HANKOU, LAND_HOLES[0]), landMesh(HANYANG, LAND_HOLES[1]), landMesh(WUCHANG, LAND_HOLES[2]));

  /* ═════════ 六、山：形取 DEM，高取实测海拔（tools/geodata/extract.py） ═════════
     每座山一块高程格子（相对平原的起伏，0.5 米一级）。网格点之间用 Catmull-Rom 双三次插值，
     轮廓是圆的，不见格子。山脚没入水下，临江临湖的山自然入水。 */
  const VEX = 5 / MPU;                                  // 米 → 场景单位，竖向五倍
  const HILL_DIP = 2.6;                                 // 起伏归零处沉到水面以下，山裙不浮在水上
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
  const HILLS = GEO.hills.map(t => {
    const f = hillField(t), pk = geo(t.peak[0], t.peak[1]);
    const SUB = 2, cols = (f.nx - 1) * SUB + 1, rows = (f.nz - 1) * SUB + 1;
    const pos = new Float32Array(cols * rows * 3), idx = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = f.x0 + i / SUB * f.dx, z = f.z0 + j / SUB * f.dz, h = sampleField(f, x, z), k = (j * cols + i) * 3;
      pos[k] = x - pk.x;                                // 以山顶为原点：皴笔自山顶放射，顺坡而下
      pos[k + 1] = LAND_Y + h - HILL_DIP * (1 - THREE.MathUtils.smoothstep(h, 0, 1.5));
      pos[k + 2] = z - pk.z;
    }
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, M.hill); mesh.position.set(pk.x, 0, pk.z);
    scene.add(mesh);
    return { name: t.name, f, mesh, peak: pk, x0: f.x0, x1: f.x0 + (f.nx - 1) * f.dx, z0: f.z0, z1: f.z0 + (f.nz - 1) * f.dz };
  });
  const HILL = {}; HILLS.forEach(h => { if (h.name) HILL[h.name] = h; });
  const reliefAt = (x, z) => {
    let y = 0;
    for (const h of HILLS) if (x >= h.x0 && x <= h.x1 && z >= h.z0 && z <= h.z1) y = Math.max(y, sampleField(h.f, x, z));
    return y;
  };
  const terrainTop = (x, z) => LAND_Y + reliefAt(x, z);

  // 远山：层层淡出，烘托「烟波浩渺」
  [
    { z:  -980, tone: .24, n: 10, h: 48, w: 300 },
    { z: -1360, tone: .44, n: 9,  h: 68, w: 400 },
    { z:  1080, tone: .32, n: 9,  h: 54, w: 340 },
    { z:  1520, tone: .52, n: 8,  h: 76, w: 430 }
  ].forEach(Lr => {
    const mat = inkMat(Lr.tone, false, null, null, { rim: 1, foot: 1 });
    for (let i = 0; i < Lr.n; i++) {
      const x = (i - (Lr.n - 1) / 2) * Lr.w * .95 + (rnd() - .5) * 200 + 200;
      scene.add(ellipsoid(Lr.w * (.6 + rnd() * .5), Lr.h * (.55 + rnd() * .7), Lr.w * .35, x, -6, Lr.z + (rnd() - .5) * 160, mat, 20));
    }
  });
