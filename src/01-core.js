  if (!window.THREE || !THREE.OrbitControls || !THREE.BufferGeometryUtils) { document.getElementById('err').style.display = 'grid'; return; }
  const BGU = THREE.BufferGeometryUtils;

  /* ═════════ 一、真实地理投影 ═════════
     以黄鹤楼为原点，等距圆柱投影：+x 正东，−z 正北。
     水平 1:1（1 单位 = 13 米），竖向约放大 5 倍，使楼塔在全城视角下仍可辨认。 */
  const MPU = 13;                                  // 每单位米数
  const O = [114.29694, 30.54694];                 // 黄鹤楼 30°32′49″N 114°17′49″E
  const M_LON = 111320 * Math.cos(30.55 * Math.PI / 180), M_LAT = 110900;
  const geo = (lon, lat) => ({ x: (lon - O[0]) * M_LON / MPU, z: -(lat - O[1]) * M_LAT / MPU });
  const gv = (lon, lat, y) => { const p = geo(lon, lat); return new THREE.Vector3(p.x, y || 0, p.z); };

  const SITE = {                                   // 各景点实测坐标
    tower:   [114.29694, 30.54694],   // 黄鹤楼
    bridge:  [114.28775, 30.54975],   // 武汉长江大桥 正桥中点
    tv:      [114.27000, 30.55550],   // 龟山电视塔
    qc:      [114.27980, 30.55867],   // 晴川阁·禹稷行宫
    customs: [114.29208, 30.57874],   // 江汉关
    wuda:    [114.36250, 30.53950],   // 武大老斋舍
    chutian: [114.40500, 30.54450]    // 东湖磨山·楚天台
  };
  const AT = {}; Object.keys(SITE).forEach(k => AT[k] = geo(SITE[k][0], SITE[k][1]));

  const stage = document.getElementById('stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  stage.appendChild(renderer.domElement);

  const PAPER = new THREE.Color('#E6E3DA');
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PAPER, 300, 1800);                    // 随镜头距离逐帧调整
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 9000);

  /* ═════════ 二、水墨 Shader ═════════ */
  const NOISE = `
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p){
      vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(hash(i), hash(i+vec2(1.,0.)), f.x), mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), f.x), f.y);
    }
    float fbm(vec2 p){ float a = .5, s = 0.; for(int i=0;i<4;i++){ s += a*vnoise(p); p *= 2.03; a *= .5; } return s; }
  `;
  const fogU = { uFog: { value: PAPER }, uNear: { value: 300 }, uFar: { value: 1800 } };
  const camU = { uCam: { value: new THREE.Vector3() } };        // 逐帧同步镜头位置
  const sharedInk = { uInk: { value: new THREE.Color('#25241f') }, uPaper: { value: PAPER }, uLight: { value: new THREE.Vector3(-.45, .85, .5) } };

  const inkVert = `
    varying vec3 vN; varying vec3 vW; varying float vD; varying vec3 vC;
    void main(){
      vec4 w = modelMatrix * vec4(position, 1.0);
      vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
      vC = (modelMatrix * vec4(0., 0., 0., 1.)).xyz;          // 物体中心，皴笔以此放射
      vec4 mv = viewMatrix * w; vD = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`;
  const inkFrag = NOISE + `
    uniform vec3 uFog, uInk, uPaper, uLight, uCam;
    uniform float uNear, uFar, uTone, uRim, uCun, uFoot; uniform vec2 uFade;
    varying vec3 vN; varying vec3 vW; varying float vD; varying vec3 vC;
    void main(){
      float near = 1.0;
      if(uFade.y > .5){                                   // 镜头穿过时，屋舍化入宣纸
        near = smoothstep(uFade.x, uFade.y, distance(vW.xz, uCam.xz));
        if(near < hash(floor(vW.xz * 4.0) + floor(vW.y * 4.0) + .5)) discard;
      }
      vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n;
      float d = dot(n, normalize(uLight)) * .5 + .5;
      float blot = fbm(vW.xz * .32 + vW.y * .45) * .28 + fbm(vW.xy * 1.8 + vW.z) * .1;
      float hatch = sin((vW.x + vW.z) * 2.6 + vW.y * 3.5 + fbm(vW.xz * .7) * 7.0) * .5 + .5;
      float t = d + (blot - .17) - smoothstep(.72, 1., hatch) * .1 * (1. - d);
      float lv = smoothstep(.30,.37,t) + smoothstep(.50,.57,t) + smoothstep(.70,.77,t);
      float tone = mix(.20, .93, lv / 3.0);
      tone -= (1. - smoothstep(0., 9., vW.y)) * .10;
      tone = clamp(mix(clamp(tone, 0., 1.), 1., uTone), 0., 1.);
      tone = mix(1., tone, .18 + .82 * near);

      if(uCun > .5){                                      // 皴：顺坡放射的短笔，陡处见笔
        vec3 rel = vW - vC;
        float ang = atan(rel.z, rel.x);
        float steep = smoothstep(.92, .18, abs(n.y));
        float k = sin(ang * 38.0 + fbm(rel.xz * .055) * 6.0 + rel.y * .07);
        float k2 = sin(ang * 14.0 - fbm(rel.xz * .03) * 4.0);
        float cun = (smoothstep(.70, .99, k) * .6 + smoothstep(.86, .995, k2) * .35) * steep;
        tone = mix(tone, tone * .52, clamp(cun, 0., 1.) * .45);
      }
      if(uRim > .5){                                      // 廓：侧影处落墨，代替硬描边
        float rim = pow(1.0 - abs(dot(n, normalize(uCam - vW))), 1.9);
        tone = mix(tone, .05, clamp(rim, 0., 1.) * .92);
      }
      if(uFoot > .5){                                     // 山脚化入云气，只虚下缘
        tone = mix(mix(1., tone, .42), tone, smoothstep(.4, 7.5, vW.y));
      }

      vec3 col = mix(uInk, uPaper, tone);
      col = mix(col, uFog, smoothstep(uNear, uFar, vD));
      gl_FragColor = vec4(col, 1.);
    }`;
  function inkMat(tone, dbl, tint, fade, o) {
    o = o || {};
    return new THREE.ShaderMaterial({
      vertexShader: inkVert, fragmentShader: inkFrag, side: dbl ? THREE.DoubleSide : THREE.FrontSide,
      uniforms: Object.assign({ uTone: { value: tone || 0 }, uFade: { value: new THREE.Vector2(fade ? fade[0] : 0, fade ? fade[1] : 0) },
          uRim: { value: o.rim ? 1 : 0 }, uCun: { value: o.cun ? 1 : 0 }, uFoot: { value: o.foot ? 1 : 0 } },
        fogU, camU, sharedInk,
        tint ? { uInk: { value: new THREE.Color(tint[0]) }, uPaper: { value: new THREE.Color(tint[1]) } } : {})
    });
  }
  // 与之配套的勾线材质：同样随镜头淡出
  function lineMatOf(color, opacity, fade) {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: Object.assign({ uCol: { value: new THREE.Color(color) }, uOp: { value: opacity },
        uFade: { value: new THREE.Vector2(fade ? fade[0] : 0, fade ? fade[1] : 0) } }, fogU, camU),
      vertexShader: `varying vec3 vW; varying float vD;
        void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uCol, uFog, uCam; uniform float uNear, uFar, uOp; uniform vec2 uFade;
        varying vec3 vW; varying float vD;
        void main(){
          float a = uOp;
          if(uFade.y > .5) a *= smoothstep(uFade.x, uFade.y, distance(vW.xz, uCam.xz));
          if(a < .012) discard;
          gl_FragColor = vec4(mix(uCol, uFog, smoothstep(uNear, uFar, vD)), a);
        }`
    });
  }
  const M = {
    std:  inkMat(0),     land: inkMat(.52),   roof: inkMat(-.12, true), pale: inkMat(.24),
    wall: inkMat(.10),   dbl:  inkMat(.08, true),
    hill: inkMat(.02, false, null, null, { rim: 1, cun: 1, foot: 1 }),
    town: inkMat(.14, false, null, [20, 78]), townRoof: inkMat(-.08, true, null, [20, 78]),
    pine: inkMat(-.08, false, null, [12, 46]),
    sakura: inkMat(.60, false, ['#7f5a55', '#f0dcd6'])
  };
  const lineMat  = new THREE.LineBasicMaterial({ color: 0x22211d, fog: true });
  const lineMat2 = new THREE.LineBasicMaterial({ color: 0x5a5851, fog: true, transparent: true, opacity: .45 });
  const townLineA = lineMatOf(0x22211d, 1, [20, 78]), townLineB = lineMatOf(0x5a5851, .45, [20, 78]);
  const lineSoft = new THREE.LineBasicMaterial({ color: 0x6b6960, fog: true, transparent: true, opacity: .6 });
  const brushMat = new THREE.MeshBasicMaterial({ color: 0x2a2924, fog: true, side: THREE.DoubleSide });
  const dashMat  = new THREE.MeshBasicMaterial({ color: 0xece9e0, fog: true });

  // 毛笔勾线：两层略错位的描边，模拟笔锋飞白
  function ink(mesh, thresh, ma, mb) {
    const eg = new THREE.EdgesGeometry(mesh.geometry, thresh || 28);
    const a = new THREE.LineSegments(eg, ma || lineMat);
    const b = new THREE.LineSegments(eg, mb || lineMat2);
    b.scale.setScalar(1.006); b.position.set(.04, .025, -.04);
    a.raycast = b.raycast = function () {};
    mesh.add(a, b);
    return mesh;
  }

  /* ═════════ 三、几何累加器：把上千个小构件并成一次绘制 ═════════ */
  const dummy = new THREE.Object3D();
  const UBOX = new THREE.BoxGeometry(1, 1, 1);
  const UCYL = new THREE.CylinderGeometry(1, 1, 1, 8);
  const UCONE = new THREE.ConeGeometry(1, 1, 6);
  const UP = new THREE.Vector3(0, 1, 0);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  function Acc() { this.l = []; }
  Acc.prototype.push = function (g, m) {
    g = g.clone(); if (m) g.applyMatrix4(m);
    if (g.index) g = g.toNonIndexed();
    if (g.attributes.uv) g.deleteAttribute('uv');
    this.l.push(g); return this;
  };
  Acc.prototype.place = function (g, x, y, z, sx, sy, sz, ry) {
    dummy.position.set(x, y, z); dummy.rotation.set(0, ry || 0, 0); dummy.quaternion.setFromEuler(dummy.rotation);
    dummy.scale.set(sx, sy, sz); dummy.updateMatrix(); return this.push(g, dummy.matrix);
  };
  Acc.prototype.box = function (w, h, d, x, y, z, ry) { return this.place(UBOX, x, y, z, w, h, d, ry); };
  Acc.prototype.cyl = function (r, h, x, y, z) { return this.place(UCYL, x, y, z, r, h, r, 0); };
  Acc.prototype.cone = function (r, h, x, y, z, dir) {
    dummy.position.set(x, y, z); dummy.quaternion.setFromUnitVectors(UP, dir.clone().normalize()); dummy.scale.set(r, h, r);
    dummy.updateMatrix(); return this.push(UCONE, dummy.matrix);
  };
  Acc.prototype.beam = function (a, b, t) {
    dummy.position.copy(a).add(b).multiplyScalar(.5); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0);
    dummy.lookAt(b); dummy.scale.set(t, t, a.distanceTo(b)); dummy.updateMatrix(); return this.push(UBOX, dummy.matrix);
  };
  Acc.prototype.geo = function (g, x, y, z) {
    dummy.position.set(x, y, z); dummy.quaternion.identity(); dummy.scale.set(1, 1, 1);
    dummy.updateMatrix(); return this.push(g, dummy.matrix);
  };
  Acc.prototype.disc = function (r, t, x, y, z, ry) {
    dummy.position.set(x, y, z); dummy.scale.set(r, t, r);
    dummy.quaternion.setFromAxisAngle(UP, ry || 0).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2));
    dummy.updateMatrix(); return this.push(UCYL, dummy.matrix);
  };
  Acc.prototype.mesh = function (mat, outline, thresh, ma, mb) {
    if (!this.l.length) return new THREE.Group();
    const m = new THREE.Mesh(BGU.mergeBufferGeometries(this.l, false), mat);
    return outline ? ink(m, thresh, ma, mb) : m;
  };

  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // 中式屋顶：四坡攒尖，坡面内凹（举折），四角起翘
  function roofGeo(R, r, H, lift, nu, nv) {
    nu = nu || 16; nv = nv || 6;
    const pos = [], idx = [];
    for (let k = 0; k < 4; k++) {
      const cs = Math.cos(k * Math.PI / 2), sn = Math.sin(k * Math.PI / 2), base = pos.length / 3;
      for (let j = 0; j <= nv; j++) {
        const v = j / nv, w = R + (r - R) * v;
        for (let i = 0; i <= nu; i++) {
          const u = -1 + 2 * i / nu, x = u * w, z = w;
          const y = H * Math.pow(v, 1.7) + lift * Math.pow(Math.abs(u), 3) * Math.pow(1 - v, 2);
          pos.push(x * cs + z * sn, y, -x * sn + z * cs);
        }
      }
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  function perim(half, step) {
    const pts = [], n = Math.max(2, Math.round(2 * half / step));
    for (let s = 0; s < 4; s++) {
      const a = s * Math.PI / 2, cs = Math.cos(a), sn = Math.sin(a);
      for (let i = 0; i < n; i++) { const t = -half + 2 * half * i / n; pts.push([t * cs + half * sn, -t * sn + half * cs, a]); }
    }
    return pts;
  }
  function ringAt(acc, half, y, t, step, ox, oz) {
    const p = perim(half, step || half * .5);
    p.forEach((a, i) => { const b = p[(i + 1) % p.length]; acc.beam(V((ox || 0) + a[0], y, (oz || 0) + a[1]), V((ox || 0) + b[0], y, (oz || 0) + b[1]), t); });
  }
  const ring = (acc, half, y, t) => ringAt(acc, half, y, t, half * .5);
  const tips4 = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
  const mkS = () => ({ pale: new Acc(), wall: new Acc(), roofs: new Acc(), dark: new Acc() });
  function finish(S, g) {
    g.add(S.pale.mesh(M.pale, true, 30), S.wall.mesh(M.wall, true, 30), S.roofs.mesh(M.roof, true, 24), S.dark.mesh(brushMat, false));
    return g;
  }
  // 一层殿阁：楼板、墙身、窗、檐柱、斗拱、栏杆、四坡屋顶与翘角
  function hall(S, hw, yb, FH, o) {
    o = o || {};
    const R = o.R || hw + 2.7, r = o.r != null ? o.r : .3, H = o.H || 1.8, lift = o.lift || 1.1, ox = o.x || 0, oz = o.z || 0;
    S.pale.box(2 * hw + .9, .4, 2 * hw + .9, ox, yb + .2, oz);
    S.wall.box(hw * 1.5, FH - .4, hw * 1.5, ox, yb + .4 + (FH - .4) / 2, oz);
    if (o.win !== false) for (let s = 0; s < 4; s++) {
      const a = s * Math.PI / 2, cs = Math.cos(a), sn = Math.sin(a), d = hw * .75 + .06;
      [-hw * .32, hw * .32].forEach(t => S.dark.box(.9, FH - 1.7, .1, ox + t * cs + d * sn, yb + FH * .5 + .1, oz - t * sn + d * cs, a));
    }
    perim(hw, hw * 2 / (o.cols || 4)).forEach(p => {
      S.dark.cyl(.17, FH - .5, ox + p[0], yb + .4 + (FH - .5) / 2, oz + p[1]);
      S.dark.box(.56, .26, .56, ox + p[0], yb + FH - .2, oz + p[1]);
      S.dark.box(1.5, .2, .3, ox + p[0], yb + FH - .02, oz + p[1], p[2]);
    });
    ringAt(S.dark, hw, yb + FH - .55, .26, hw * .5, ox, oz);
    if (o.rail !== false) ringAt(S.dark, hw, yb + .95, .1, hw * .5, ox, oz);
    S.roofs.geo(roofGeo(R, r, H, lift, 16, 6), ox, yb + FH - .1, oz);
    tips4.forEach(([sx, sz]) => S.dark.cone(.28, 1.5, ox + sx * (R + .05), yb + FH - .1 + lift + .45, oz + sz * (R + .05), V(sx * .8, .9, sz * .8)));
  }
  function ellipsoid(rx, ry, rz, x, y, z, mat, seg) {
    const g = new THREE.SphereGeometry(1, seg || 28, 18); g.scale(rx, ry, rz);
    const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); return m;
  }
  function hullGeo(pts, depth) {
    const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      if (p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]); else s.lineTo(p[0], p[1]);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 8 });
    g.rotateX(-Math.PI / 2); return g;
  }
