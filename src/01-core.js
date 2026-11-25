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
    bridge:  [114.28282, 30.55208],   // 武汉长江大桥 桥心：OSM 桥梁节点沿桥轴移到江心（约 85 米，水体掩膜与场景实测）；原手工值偏东南约 600 米
    tv:      [114.27508, 30.55802],   // 龟山电视塔（OSM；与 DEM 龟山峰顶相距 45 米）
    qc:      [114.27980, 30.55867],   // 晴川阁·禹稷行宫
    customs: [114.29208, 30.57874],   // 江汉关
    wuda:    [114.36250, 30.53950],   // 武大老斋舍
    hongshan:   [114.33497, 30.53454],   // 宝通禅寺（Nominatim），洪山宝塔在寺内
    watertower: [114.28471, 30.58153],   // 汉口水塔（OSM building=water_tower）
    museum:     [114.35973, 30.56374],   // 湖北省博物馆（OSM tourism=museum）
    honglou:    [114.30084, 30.54445],   // 红楼 · 辛亥革命博物院北区（Nominatim）
    yingwuzhou: [114.27612, 30.53310],   // 鹦鹉洲长江大桥 桥心：沿 OSM 桥向，取江面两岸之间的中点（水体掩膜）
    guiyuan:    [114.25369, 30.54784],   // 归元禅寺（Nominatim）
    qintai:     [114.25833, 30.55667],   // 古琴台示意中心：公开点位与汉阳区「龟山西、月湖东南畔」一致
    xingyin: [114.37112, 30.56733],   // 听涛景区行吟阁，OSM 建筑轮廓中心
    chutian: [114.40500, 30.55450]    // 东湖磨山·楚天台（原纬度 30.5445 为笔误；DEM 磨山峰顶在 30.5543）
  };
  const AT = {}; Object.keys(SITE).forEach(k => AT[k] = geo(SITE[k][0], SITE[k][1]));

  const stage = document.getElementById('stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  stage.appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    app.fail('三维画面已中断，请重新加载。');
  });
  app.cleanups.push(() => renderer.dispose());

  const PAPER = new THREE.Color('#F2EFE6');
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
  const groundContacts = [];
  const contactU = { uContact: { value: null }, uContactRect: { value: new THREE.Vector4() } };
  const camU = { uCam: { value: new THREE.Vector3() } };        // 逐帧同步镜头位置
  const sharedInk = { uInk: { value: new THREE.Color('#29332f') }, uPaper: { value: PAPER }, uLight: { value: new THREE.Vector3(-.45, .85, .5) } };

  const inkVert = `
    #ifdef ARCHITECTURE_AO
      attribute float skyVisibility; varying float vSky;
    #endif
    varying vec3 vN; varying vec3 vW; varying float vD; varying vec3 vC;
    void main(){
      #ifdef ARCHITECTURE_AO
        vSky = skyVisibility;
      #endif
      vec4 local = vec4(position, 1.0);
      vec3 localNormal = normal;
      #ifdef USE_INSTANCING
        local = instanceMatrix * local;
        mat3 basis = mat3(instanceMatrix);
        localNormal = basis * (normal / vec3(dot(basis[0], basis[0]), dot(basis[1], basis[1]), dot(basis[2], basis[2])));
      #endif
      vec4 w = modelMatrix * local;
      mat3 worldBasis = mat3(modelMatrix);
      vec3 scaleSquared = vec3(dot(worldBasis[0], worldBasis[0]), dot(worldBasis[1], worldBasis[1]), dot(worldBasis[2], worldBasis[2]));
      vW = w.xyz; vN = normalize(worldBasis * (localNormal / scaleSquared));
      vC = (modelMatrix * vec4(0., 0., 0., 1.)).xyz;          // 物体中心，皴笔以此放射
      vec4 mv = viewMatrix * w; vD = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`;
  const inkFrag = NOISE + `
    #ifdef ARCHITECTURE_AO
      varying float vSky;
      #ifdef ARCHITECTURE_SHADOW
        uniform float uArchShadow;
      #endif
      #ifdef ARCHITECTURE_WASH
        uniform float uCityWash;
      #endif
    #endif
    #ifdef GROUND_CONTACT
      uniform sampler2D uContact;
      uniform vec4 uContactRect;
    #endif
    uniform vec3 uFog, uInk, uPaper, uLight, uCam;
    uniform float uNear, uFar, uTone, uRim, uCun, uFoot; uniform vec2 uFade;
    varying vec3 vN; varying vec3 vW; varying float vD; varying vec3 vC;
    void main(){
      float near = 1.0;
      if(uFade.y > .5){                                   // 镜头穿过时，屋舍化入宣纸
        near = smoothstep(uFade.x, uFade.y, distance(vW, uCam));
        // A one-pixel screen door keeps close roof tiles from dissolving in large blocks.
        if(near <= fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(.06711056, .00583715))))) discard;
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

      if(uCun > .5){                                      // 短皴顺坡分组，远处只余山势
        vec2 p = vW.xz;
        float grade = length(n.xz);
        vec2 downhill = n.xz / max(grade, .02);
        float steep = smoothstep(.12,.72,grade);
        float rise = smoothstep(3.,13.,vW.y);
        float nearHill = 1.-smoothstep(145.,540.,vD);
        float wash = fbm(p*.053);
        float body = smoothstep(.27,.69,wash);
        tone -= steep*(.045+.12*body)*(.48+.52*rise);
        if(nearHill > .001){
          // Sample ahead and behind each point instead of drawing unbroken periodic lines.
          vec2 q = p*.19+vec2(vW.y*.025);
          vec2 reach = downhill*.69;
          float trail = (vnoise(q-reach)+2.*vnoise(q)+vnoise(q+reach))*.25;
          float group = smoothstep(.31,.65,fbm(p*.082+vec2(14.,7.)));
          float brush = group*smoothstep(.42,.74,trail);
          float lift = smoothstep(.58,.88,d)*(1.-body);
          tone += nearHill*steep*rise*(.095*lift-.36*brush-.12*body);
        }
        tone = clamp(tone+(fbm(p*.027)-.5)*.15,0.,1.);
      }
      #ifdef TIDAL_STONE
        // Wicking breaks the damp edge just above the actual water plane (world y = 0).
        float tideMark = .20+.29*vnoise(vW.xz*1.85);
        float damp = 1.-smoothstep(tideMark-.17,tideMark+.20,vW.y);
        float closeStone = 1.-smoothstep(90.,185.,vD);
        // Exposed bedding follows the same slant across adjacent slabs and breaks at dry patches.
        vec2 bedding = vec2(dot(vW.xz,vec2(.43,-.90)),dot(vW.xz,vec2(.90,.43)));
        float broken = vnoise(bedding*vec2(.54,1.1));
        float seam = abs(fract(bedding.y*.80+vW.y*.95+.34*broken)-.5);
        float grain = (1.-smoothstep(.022,.125,seam))*smoothstep(.39,.74,broken);
        tone *= 1.-closeStone*(.37*damp+.35*grain);
      #endif
      if(uRim > .5){                                      // 廓：侧影处落墨，代替硬描边
        float rim = pow(1.0 - abs(dot(n, normalize(uCam - vW))), 1.9);
        tone = mix(tone, .05, clamp(rim, 0., 1.) * .40);
      }
      if(uFoot > .5){                                     // 山脚化入云气，只虚下缘
        tone = mix(mix(1., tone, .42), tone, smoothstep(.4, 7.5, vW.y));
      }

      vec3 col = mix(uInk, uPaper, tone);
      #ifdef GROUND_CONTACT
        vec2 uv = (vW.xz-uContactRect.xy)/uContactRect.zw;
        float field = texture2D(uContact,uv).r;
        float nearContact = 1.-smoothstep(220.,720.,vD);
        float foot = field * nearContact * smoothstep(.08,.32,n.y);
        col = mix(col,mix(vec3(.46,.43,.36),vec3(.26,.34,.275),uCun),foot);
      #endif
      if(uCun > .5) col = mix(uFog * .948, col, smoothstep(.74, 4.3, vW.y));
      #ifdef ARCHITECTURE_AO
        col *= mix(.62, 1., vSky);
        #ifdef ARCHITECTURE_SHADOW
          float sheltered = 1. - smoothstep(.40, .83, vSky);
          float underside = smoothstep(.10, .85, -n.y);
          col = mix(col, uInk, uArchShadow * sheltered * (.70 + .30 * underside));
        #endif
        #ifdef ARCHITECTURE_WASH
          vec3 luminance = vec3(.24, .65, .11);
          float brightness = dot(col, luminance);
          vec3 neutralPaper = mix(uFog, vec3(dot(uFog, luminance)), .72);
          vec3 wash = mix(vec3(brightness), neutralPaper, .55);
          col = mix(col, wash, uCityWash * smoothstep(86., 425., vD));
        #endif
      #endif
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
  const M = {
    std:  inkMat(0),     land: inkMat(.60),   roof: inkMat(.06, true, ['#29332f', '#9ba49a']), pale: inkMat(.46),
    wall: inkMat(.32),   dbl:  inkMat(.08, true),
    hill: inkMat(.13, false, ['#495a50', '#b7bcaa'], null, { cun: 1 }),
    bankStone: inkMat(.22, false, ['#72786e', '#c2c1aa']),
    bankGrass: inkMat(.18, false, ['#687967', '#bfc4a8']),
    bankPath: inkMat(.36, false, ['#827d70', '#d6cfb8']),
    pine: inkMat(-.08, false, null, [12, 46]),
    sakura: inkMat(.60, false, ['#7f5a55', '#f0dcd6'])
  };
  for (const ground of [M.land, M.hill]) {
    ground.defines = { GROUND_CONTACT: 1 };
    Object.assign(ground.uniforms, contactU);
  }
  const lineMat  = new THREE.LineBasicMaterial({ color: 0x343d36, fog: true, transparent: true, opacity: .72 });
  const lineMat2 = new THREE.LineBasicMaterial({ color: 0x5a5851, fog: true, transparent: true, opacity: .18 });
  const lineSoft = new THREE.LineBasicMaterial({ color: 0x6b6960, fog: true, transparent: true, opacity: .6 });
  const brushMat = new THREE.MeshBasicMaterial({ color: 0x2a2924, fog: true, side: THREE.DoubleSide });

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
