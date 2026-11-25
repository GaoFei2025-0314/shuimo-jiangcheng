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
  const textureLoader=new THREE.TextureLoader();
  const [fabricAtlas,windowAtlas,laneEarth,laneFoliage,laneMoss]=await Promise.all([laneMaterialImage,laneWindowImage,laneEarthImage,laneFoliageImage,laneMossImage].map(url=>textureLoader.loadAsync(url)));
  laneEarth.wrapS=laneEarth.wrapT=THREE.MirroredRepeatWrapping;
  for (const atlas of [fabricAtlas,windowAtlas,laneEarth,laneFoliage,laneMoss]) {
    atlas.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
    app.cleanups.push(()=>atlas.dispose());
  }
  const groundContacts = [];
  const contactU = { uContact: { value: null }, uContactRect: { value: new THREE.Vector4() } };
  const camU = { uCam: { value: new THREE.Vector3() } };        // 逐帧同步镜头位置
  const streetLight = { value: 0 };
  const sharedInk = { uStreetLight: streetLight, uInk: { value: new THREE.Color('#29332f') }, uPaper: { value: PAPER }, uLight: { value: new THREE.Vector3(-.45, .85, .5) } };

  const inkVert = `
    #ifdef WALK_WEAR
      attribute float walkEdge;
      varying float vWalkEdge;
    #endif
    #ifdef ARCHITECTURE_AO
      attribute float skyVisibility; varying float vSky;
    #endif
    #ifdef CITY_DETAIL
      varying vec3 vCityPosition;
      varying vec3 vCityNormal;
      #ifdef CITY_JOINERY
        attribute vec4 cityPane;
        varying vec4 vCityPane;
      #endif
    #endif
    varying vec3 vN; varying vec3 vW; varying float vD; varying vec3 vC;
    void main(){
      #ifdef WALK_WEAR
        vWalkEdge = walkEdge;
      #endif
      #ifdef ARCHITECTURE_AO
        vSky = skyVisibility;
      #endif
      #ifdef CITY_DETAIL
        vCityPosition = position;
        vCityNormal = normal;
        #ifdef CITY_JOINERY
          vCityPane = cityPane;
          #ifdef USE_INSTANCING
            vCityPane.w += floor(instanceMatrix[3].x*.32) + floor(instanceMatrix[3].z*.17);
          #endif
        #endif
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
    #ifdef WALK_WEAR
      varying float vWalkEdge;
    #endif
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
    #if defined(CITY_DETAIL) || defined(COURT_TIMBER)
      uniform sampler2D uMaterialAtlas;
      vec3 paintedSurface(vec2 uv,vec2 quadrant){
        vec2 tile = 1.-abs(mod(uv,2.)-1.);
        return texture2D(uMaterialAtlas,quadrant*.5+(.003+tile*.994)*.5).rgb;
      }
      float density(vec3 tone){return dot(tone,vec3(.299,.587,.114));}
    #endif
    #ifdef CITY_JOINERY
      uniform sampler2D uWindowAtlas;
      uniform float uApartmentWindow;
    #endif
    #ifdef COURT_EARTH
      uniform sampler2D uLaneEarth;
    #endif
    #ifdef LANE_SHADOW
      uniform sampler2D uLaneShadow;
      uniform mat4 uLaneLight;
      uniform vec2 uShadowTexel;
      float shadowAt(vec2 uv,float receiver){
        vec4 packedDepth=texture2D(uLaneShadow,uv);
        float depth=dot(packedDepth,vec4(1./16777216.,1./65536.,1./256.,1.)*(255./256.));
        return step(depth,receiver);
      }
      float streetShade(vec3 world,float viewDepth){
        float nearSet=min(length(world.xz-vec2(-218.,36.)),length(world.xz-vec2(-62.,80.)));
        float strength=(1.-smoothstep(34.,53.,nearSet))*(1.-smoothstep(110.,230.,viewDepth));
        if(strength<=0.) return 0.;
        vec3 uvz=(uLaneLight*vec4(world,1.)).xyz*.5+.5;
        float receiver=uvz.z-.0013;
        vec2 pixel=uvz.xy/uShadowTexel-.5;
        vec2 at=(floor(pixel)+.5)*uShadowTexel;
        vec2 blend=smoothstep(vec2(0.),vec2(1.),fract(pixel));
        float lower=mix(shadowAt(at,receiver),shadowAt(at+vec2(uShadowTexel.x,0.),receiver),blend.x);
        float upper=mix(shadowAt(at+vec2(0.,uShadowTexel.y),receiver),shadowAt(at+uShadowTexel,receiver),blend.x);
        return mix(lower,upper,blend.y)*strength;
      }
    #endif
    uniform vec3 uFog, uInk, uPaper, uLight, uCam;
    uniform float uStreetLight;
    uniform float uNear, uFar, uTone, uRim, uCun, uFoot; uniform vec2 uFade;
    #ifdef CITY_DETAIL
      varying vec3 vCityPosition;
      varying vec3 vCityNormal;
      #ifdef CITY_JOINERY
        varying vec4 vCityPane;
      #endif
      float cityLine(float p, float width) {
        float aa = min(.27, fwidth(p));
        return 1. - smoothstep(width, width + aa + .007, abs(fract(p) - .5));
      }
    #endif
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
          tone += nearHill*steep*rise*(.11*lift-.31*brush-.095*body);
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
      #ifdef WALK_WEAR
        // Footfall polishes the middle of the path. Patchy darker edges merge into the verge.
        float grain = vnoise(vW.xz * 1.7);
        float margin = smoothstep(.32,.95,abs(vWalkEdge) + .18*(grain-.5));
        float wearMask = smoothstep(.27,.76,vnoise(vW.xz*.39));
        float weathering = 1. + wearMask * mix(.016,-.034,margin) + .032*(grain-.5);
        col *= mix(1.,weathering,1.-smoothstep(62.,165.,vD));
      #endif
      #ifdef COURT_EARTH
        float toLane=min(length(vW.xz-vec2(-215.,39.)),length(vW.xz-vec2(-65.,81.)));
        float earthMix=(1.-smoothstep(39.,68.,toLane))*(1.-smoothstep(100.,170.,vD));
        if(earthMix>.001){
          vec2 field=vW.xz*.15;
          vec3 soil=texture2D(uLaneEarth,field).rgb;
          float pooled=fbm(vW.xz*.13);
          float damp=smoothstep(.40,.71,pooled+.22*(vnoise(vW.xz*.78)-.5));
          soil=mix(soil,soil*vec3(.79,.82,.86),damp);
          // Bare courtyard soil takes the same paper wash as the riverbank.
          float value=dot(soil,vec3(.26,.59,.15));
          soil=mix(value*uPaper,soil,.60);
          vec3 clay=uPaper*mix(vec3(.78,.77,.73),vec3(.91,.91,.88),pooled);
          col=mix(col,soil*.68+clay*.32,earthMix*(.49+.21*pooled));
        }
      #endif
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
        #ifdef CITY_DETAIL
          float cityNear = 1. - smoothstep(34., 105., distance(vW, uCam));
          #ifdef CITY_JOINERY
            // Broad apartment panes catch a shallow daylight reflection before the deeper room.
            bool paleApartment=uApartmentWindow>.5 && vD<175. && vCityPane.z>.01 && vCityPane.z<1.6 &&
              distance(vW.xz,vec2(-40.09,71.99))>=8.;
            if (paleApartment) {
              float facing=abs(dot(n,normalize(uCam-vW)));
              vec2 pane=vCityPane.xy;
              vec2 edge=min(pane,1.-pane);
              vec2 aa=clamp(fwidth(pane),.004,.16);
              float tone=hash(vec2(vCityPane.w,22.));
              float upper=smoothstep(.16,.92,pane.y);
              float light=.41+.17*upper+.06*tone+.07*(1.-facing);
              vec3 glass=mix(vec3(.31,.39,.38),vec3(.62,.66,.60),light);
              float hem=.61+.24*tone+.018*cos(pane.x*12.);
              float drawn=smoothstep(hem-.10,hem+.03,pane.y);
              float sideFold=smoothstep(.46,.84,abs(2.*pane.x-1.));
              float paper=.11+.45*drawn*step(.52,tone)+.24*sideFold*(1.-step(.40,tone));
              glass=mix(glass,mix(vec3(.57,.59,.54),vec3(.68,.66,.56),tone),paper);
              glass*=.90+.10*smoothstep(.025,.14,min(edge.x,edge.y));
              float sash=1.-smoothstep(.031,.042+aa.x,abs(pane.x-mix(.43,.55,tone)));
              float lintel=1.-smoothstep(.025,.044+aa.y,abs(pane.y-.67));
              float frame=max(1.-smoothstep(.024,.061+aa.x,edge.x),1.-smoothstep(.034,.064+aa.y,edge.y));
              float bars=max(frame*.66,max(sash*.63,lintel*.37));
              glass=mix(glass,vec3(.405,.445,.417)*(.91+.09*upper),bars);
              glass*=mix(.86,1.,vSky);
              float roomDetail=1.-smoothstep(96.,175.,vD);
              col=mix(col,glass,roomDetail*.94);
            } else
          #endif
          if (cityNear > .001) {
            vec3 localNormal = normalize(vCityNormal);
            float face = abs(localNormal.x) > abs(localNormal.z) ? vCityPosition.z : vCityPosition.x;
            float height = vCityPosition.y;
            float grain = fbm(vec2(face * .43, height * .31) + vW.xz * .039);
            #ifdef CITY_JOINERY
              if (vCityPane.z > .01) {
                vec2 pane = vCityPane.xy;
                float perimeter = min(min(pane.x, 1. - pane.x), min(pane.y, 1. - pane.y));
                float moulding = 1. - smoothstep(.045, .084, perimeter);
                float tall = smoothstep(2.3, 4., vCityPane.z);
                float variant = hash(vec2(vCityPane.w,16.));
                float sashCenter = mix(.42,.61,hash(vec2(vCityPane.w,17.)));
                float paneAA = clamp(fwidth(pane.x),.004,.052);
                float divider = (1.-smoothstep(.021,.026+paneAA,abs(pane.x-sashCenter)))*step(.16,variant);
                divider = max(divider,step(.74,variant)*(1.-smoothstep(.016,.022+paneAA,abs(pane.x-.28))));
                float transom = mix(1. - smoothstep(.020,.046,abs(pane.y - mix(.28,.48,variant))),
                  cityLine(pane.y * vCityPane.z * .57,.036),tall);
                float wood = max(moulding*.89, max(divider*.66, transom*.73));
                float fadedSky = smoothstep(.21,.96,pane.y);
                float reflection = vnoise(vec2(face*.65, height*.28)+vW.xz*.11);
                float paneTone = .12 + .43*fadedSky + .12*reflection + .07*grain;
                vec3 glass = mix(vec3(.18,.25,.23), vec3(.62,.64,.57), paneTone);
                float section=mod(vCityPane.w,4.);
                vec2 quadrant=vec2(mod(section,2.),floor(section*.5));
                vec3 eyeDir=normalize(uCam-vW);
                vec2 inset=clamp(pane+.065*vec2(dot(eyeDir,vec3(n.z,0.,-n.x)),eyeDir.y),.012,.988);
                vec3 inside=texture2D(uWindowAtlas,quadrant*.5+.005+.49*inset).rgb;
                float curtainLight=.46+.24*hash(vec2(vCityPane.w,4.))+.15*max(0.,dot(eyeDir,n));
                curtainLight*=1.-.80*smoothstep(12.,39.,vD);
                curtainLight*=1.-smoothstep(1.85,2.7,vCityPane.z);
                float recess=(.73+.27*smoothstep(.01,.11,perimeter))*(.88+.12*fadedSky);
                float hem = .76+.17*hash(vec2(vCityPane.w,13.)) + .017*sin(pane.x*23.);
                float gathered = .32-.19*pane.y+.04*sin(pane.y*7.);
                float curtain = 1.-smoothstep(gathered-.04,gathered+.07,mix(pane.x,1.-pane.x,step(.46,variant)));
                float blind = smoothstep(hem-.041,hem+.018,pane.y);
                float folds = .73+.19*sin(pane.x*37.+pane.y*2.7);
                vec3 lining = mix(vec3(.29,.36,.35),vec3(.59,.55,.44),hash(vec2(vCityPane.w,8.)));
                glass *= .79+.22*hash(vec2(vCityPane.w,2.));
                glass = mix(glass,glass*.57+lining*.52,(1.-step(.34,variant))*curtain*folds);
                glass = mix(glass,lining*.80,step(.65,variant)*blind*.88);
                // Reflection, half-blind and occupied light read differently at street distance.
                float occupied=smoothstep(.49,.78,variant);
                vec3 lamplit=mix(inside,vec3(density(inside)),.32)*vec3(1.01,.94,.83)*recess;
                glass = mix(glass,lamplit,curtainLight*occupied*.74);
                glass *= .75+.25*smoothstep(.04,.12,pane.y);
                float skyGlint=smoothstep(.25,.95,pane.y)*(.18+.20*variant);
                glass=mix(glass,vec3(.64,.69,.66),skyGlint*(1.-occupied*.72));
                // The street-facing room beside the arched entry has its own curtain and tea table.
                if (distance(vW.xz,vec2(-40.09,71.99))<8. && vCityPosition.x < -2.30 &&
                    vCityPosition.y<2.14 && vCityPosition.z>3.27) {
                  vec2 curtainUV=clamp(pane+.105*vec2(dot(eyeDir,vec3(n.z,0.,-n.x)),eyeDir.y),.025,.975);
                  vec3 room=texture2D(uWindowAtlas,vec2(.005,.505)+.49*curtainUV).rgb;
                  float light=(.54+.24*max(0.,dot(eyeDir,n)))*(.83+.17*fadedSky);
                  glass=mix(glass,room*vec3(.89,.88,.78)*recess,light);
                }
                glass *= .78 + .22*smoothstep(.01,.14,pane.y);
                vec3 trim = mix(vec3(.29,.26,.21), vec3(.71,.64,.51), .40 + .26*d + .14*grain);
                // Diffuse daylight through the street flat's glazing joins the drawn rooms across both floors.
                if (uApartmentWindow>.5 && distance(vW.xz,vec2(-40.09,71.99))<8.) {
                  float value=density(glass);
                  vec3 inkedRoom=mix(vec3(.32,.35,.32),vec3(.66,.65,.56),smoothstep(.13,.80,value));
                  glass=mix(glass,inkedRoom,.48);
                  // The three front openings already have modeled wooden mullions.
                  bool lowerFrame=vCityPosition.z>3.27 && vCityPosition.y<2.03 && vCityPosition.x>.29;
                  bool upperFrame=vCityPosition.z>2.55 && vCityPosition.z<2.62 &&
                    vCityPosition.y>3.01 && vCityPosition.y<4.08 && vCityPosition.x>2.26;
                  if (lowerFrame || upperFrame) wood=moulding*.76;
                }
                vec3 sash = mix(glass, trim, wood) * mix(.78,1.,vSky);
                col = mix(col, sash, cityNear * .91);
              }
            #elif defined(CITY_TILE)
              vec2 roof = abs(localNormal.z) >= abs(localNormal.x) ? vCityPosition.xz : vCityPosition.zx;
              float slope = smoothstep(.18,.60,localNormal.y)*(1.-smoothstep(.94,1.,localNormal.y));
              vec3 clayWash=paintedSurface(roof*vec2(.26,.32),vec2(0.,0.));
              float underEave=smoothstep(1.48,2.85,abs(roof.y));
              float roofWash=mix(.28,.94,max(underEave,1.-smoothstep(.08,.65,dot(n,normalize(uLight)))));
              col *= 1.+cityNear*slope*roofWash*clamp((density(clayWash)-.32)*1.48,-.34,.43);
              float row = roof.y * 3.35;
              float column = roof.x * 3.15 + mod(floor(row),2.) * .16;
              float clay = vnoise(roof * 1.65 + vW.xz * .043);
              float tile = vnoise(vec2(floor(column),floor(row)) + vW.xz*.026);
              float channel = cityLine(column,.077) * mix(.29,1.,tile);
              float overlap = cityLine(row + .042*(clay-.5),.038);
              float relief = slope * roofWash * (.12*channel + .047*overlap + .085*tile);
              col *= 1. - cityNear * (.052 + relief + .12*(1.-clay));
            #else
              float upright = 1. - smoothstep(.18,.65,abs(localNormal.y));
              #ifdef CITY_BRICK
                vec2 stoneGrain = vec2(face+height*.41, height-face*.28);
                vec3 lime=paintedSurface(stoneGrain*vec2(.37,.39),vec2(1.,1.));
                // Exposed courses use the painted brick quadrant. Lime survives in broader patches.
                vec2 brickUV=vec2(face*.255,height*.35)+vW.xz*.012;
                vec3 fired=paintedSurface(brickUV,vec2(0.,1.));
                float exposed=.34+.52*smoothstep(.31,.66,grain);
                float weather=mix(.87+.34*density(lime),.74+.82*density(fired),exposed);
                col=mix(col,col*weather,cityNear*upright);
              #else
                vec3 wash=paintedSurface(vec2(face*.20,height*.22),vec2(1.,1.));
                col=mix(col,col*(.45+.82*density(wash)),cityNear*upright*.89);
              #endif
              float foot = (1.-smoothstep(.18,1.66,height)) * upright;
              float rain = vnoise(vec2(face * 1.85,height * .16) + vW.xz * .03);
              float stain = smoothstep(.24,.78,grain*.64+rain*.36);
              float dusty = vnoise(vec2(face,height)*5.1+vW.xz*.19);
              float shoe = 1.-smoothstep(.28,.60,height+.11*(rain-.5));
              float surface = .066 + .16*foot + (.16*stain + .045*dusty)*upright;
              #ifdef CITY_BRICK
                float bed = height * 7.65;
                float brick = face*3.15+mod(floor(bed),2.)*.50;
                float chipped = vnoise(vec2(floor(brick),floor(bed))+vW.xz*.043);
                float runoff = smoothstep(.53,.85,rain) * smoothstep(1.28,2.43,height) *
                  (1.-smoothstep(2.78,3.38,height));
                surface += .11 * upright * runoff;
                float courses = cityLine(bed+.059*(dusty-.5),.042);
                float firing = vnoise(vec2(floor(brick)+.11,floor(bed)+.63)+vW.xz*.018);
                // Only the damp plinth, chips and turning edges need every mortar joint.
                float halfSpan=abs(localNormal.x)>abs(localNormal.z)?2.72:4.8;
                float turn=1.-smoothstep(.13,1.06,abs(halfSpan-abs(face)));
                float sunlit=smoothstep(-.30,.60,dot(n,normalize(uLight)));
                float paper=smoothstep(.32,.72,grain+.17*(rain-.5))*sunlit;
                float drawBrick=clamp(.04+.87*turn+.88*foot+.55*(1.-sunlit)+.19*(1.-paper),0.,1.);
                float glaze=smoothstep(.46,.75,grain+.13*(firing-.5));
                col*=1.+cityNear*upright*drawBrick*(.19*(firing-.44)+.038*(dusty-.52));
                col=mix(col,col*vec3(1.14,1.035,.937),cityNear*upright*glaze*.68);
                col=mix(col,vec3(.66,.645,.58),cityNear*upright*paper*.24*(1.-foot));
                float limecoat=smoothstep(.52,.76,grain*.6+.4*rain);
                col=mix(col,vec3(.67,.665,.601),cityNear*upright*(.095+.27*limecoat));
                float joints = cityLine(brick,.039);
                surface -= upright * (.086*courses+.066*joints) * (.30+.70*chipped)*drawBrick;
              #else
                surface += upright * (.016 + .018*rain) * cityLine(height * 1.6,.034);
              #endif
              col *= 1. - cityNear * surface;
              col = mix(col,uInk,cityNear*(.085*foot+.14*shoe*upright));
            #endif
          }
        #endif
        #ifdef ARCHITECTURE_WASH
          vec3 luminance = vec3(.24, .65, .11);
          float brightness = dot(col, luminance);
          vec3 neutralPaper = mix(uFog, vec3(dot(uFog, luminance)), .72);
          vec3 wash = mix(vec3(brightness), neutralPaper, .55);
          col = mix(col, wash, uCityWash * smoothstep(86., 425., vD));
        #endif
      #endif
      #ifdef COURT_TIMBER
        float face=abs(n.x)>abs(n.z)?vW.z:vW.x;
        vec3 grain=paintedSurface(vec2(face*.57,vW.y*.52),vec2(1.,0.));
        col *= mix(1.,.63+density(grain)*1.50,1.-smoothstep(23.,62.,vD));
      #endif
      #ifdef LANE_SHADOW
        if (uStreetLight>.001) {
          float nearby=min(length(vW.xz-vec2(-218.,36.)),length(vW.xz-vec2(-62.,80.)));
          float foreground=uStreetLight*(1.-smoothstep(33.,64.,nearby))*(1.-smoothstep(38.,105.,vD));
          float inkLoad=1.-smoothstep(.22,.75,dot(col,vec3(.29,.58,.13)));
          col*=mix(vec3(1.),vec3(.78,.82,.85),inkLoad*foreground);
          float receiving=smoothstep(.07,.45,dot(n,normalize(uLight)));
          float shadow=receiving*streetShade(vW+n*.13,vD)*uStreetLight;
          col *= mix(vec3(1.),vec3(.63,.69,.75),shadow);
          col *= 1.+foreground*(1.-shadow)*max(0.,dot(n,normalize(uLight)))*vec3(.055,.028,-.019);
        }
      #endif
      #ifdef CITY_BRICK
        // Reflected daylight keeps the grey brick readable beneath the eaves.
        float wall=1.-smoothstep(.20,.70,abs(normalize(vCityNormal).y));
        float closeWall=wall*(1.-smoothstep(52.,145.,vD));
        float daylight=.105+.105*smoothstep(-.3,.72,dot(n,normalize(uLight)));
        col=mix(col,mix(uFog,vec3(.76,.80,.78),.44),closeWall*daylight*(.78+.22*vSky));
      #endif
      float mist=smoothstep(uNear,uFar,vD);
      #if defined(ARCHITECTURE_AO) && !defined(CITY_DETAIL)
        // At eye height retain the lightest ink outline of the inhabited far shore.
        mist*=1.-.21*uStreetLight*smoothstep(95.,180.,vD)*(1.-smoothstep(315.,440.,vD));
      #endif
      col = mix(col, uFog, mist);
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
    hill: inkMat(.13, false, ['#53605a', '#c7c9ba'], null, { cun: 1 }),
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
  M.land.defines.COURT_EARTH=1;
  M.land.uniforms.uLaneEarth={value:laneEarth};
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
