
  /* ═════════ 四、景点模型（各自以原点为基准建造，再按坐标落位） ═════════ */

  // Blender meshes are embedded in the HTML so file:// and offline model loading share one path.
  const architectureTints = {
    stone: ['#766e63', '#ded5c4'], plaster: ['#9a8466', '#f1e4c8'],
    enamelWhite: ['#e4d9c6', '#fff7e6'],
    timber: ['#473831', '#a16f55'], vermilion: ['#623d34', '#b0785e'],
    roofGold: ['#78502e', '#dbb878'], bronze: ['#685336', '#d0ae6e'],
    ink: ['#28312c', '#50564b'], shadow: ['#373b34', '#666452'],
    steel: ['#263e3e', '#7b9389'], deck: ['#646961', '#ada99b'],
    plaqueBlue: ['#10242e', '#345968'], plaqueGold: ['#c09650', '#f3d88d'],
    suspensionOrange: ['#864432', '#dc895d'],
    glaze: ['#42574e', '#8c9a87'],
    cityWall: ['#a19788', '#ddd6c6'], cityRoof: ['#65736c', '#aaafa0'],
    cityBrick: ['#888578', '#c6b9a6'], cityShade: ['#7f8075', '#b0ac9c']
  };
  const shelteredInk = { timber:.34, vermilion:.24, roofGold:.29, shadow:.18, steel:.33, glaze:.21 };
  const distantCityWash = { cityWall:.27, cityRoof:.68, cityBrick:.43, cityShade:.80 };
  const cityDetail = {cityWall:'CITY_WALL',cityRoof:'CITY_TILE',cityBrick:'CITY_BRICK',cityShade:'CITY_JOINERY'};
  const cityCloseFade = {value:new THREE.Vector2(6,14)};
  const architectureMaterials = Object.fromEntries(Object.entries(architectureTints).map(([key, tint]) => {
    const material = inkMat(.04, true, tint);
    material.defines = { ARCHITECTURE_AO: 1 };
    if (shelteredInk[key]) {
      material.defines.ARCHITECTURE_SHADOW = 1;
      material.uniforms.uArchShadow = { value: shelteredInk[key] };
    }
    if (distantCityWash[key]) {
      material.uniforms.uFade = cityCloseFade;
      material.defines.ARCHITECTURE_WASH = 1;
      material.defines.CITY_DETAIL = 1;
      material.defines[cityDetail[key]] = 1;
      material.uniforms.uMaterialAtlas={value:fabricAtlas};
      if (key==='cityShade') {
        material.uniforms.uWindowAtlas={value:windowAtlas};
        material.uniforms.uApartmentWindow={value:0};
      }
      material.extensions.derivatives = true;
      material.uniforms.uCityWash = { value: distantCityWash[key] };
    }
    return [key, material];
  }));
  const apartmentWindow=architectureMaterials.cityShade.clone();
  apartmentWindow.uniforms={...architectureMaterials.cityShade.uniforms,uApartmentWindow:{value:1}};
  function decodeWords(data, Type) {
    const bytes = Uint8Array.from(atob(data), char => char.charCodeAt(0));
    return new Type(bytes.buffer);
  }
  // The neighborhood window panels are baked as two consecutive triangles.
  // Derive pane coordinates on their own plane, so sash and weathering follow every instance.
  function cityPaneCoordinates(coordinates,faces) {
    const values=new Float32Array(faces.length*4);
    for (let i=0;i+5<faces.length;i+=6) {
      const ids=faces.subarray(i,i+6);
      if (new Set(ids).size!==4) continue;
      const bounds=axis=>{
        const points=Array.from(ids,id=>coordinates[id*3+axis]);
        return [Math.min(...points),Math.max(...points)];
      };
      const x=bounds(0), y=bounds(1), z=bounds(2);
      const dx=x[1]-x[0], dy=y[1]-y[0], dz=z[1]-z[0];
      const axis=dx>=dz?0:2, width=Math.max(dx,dz);
      if (width<.12 || dy<.12 || Math.min(dx,dz)>.07) continue;
      const low=axis===0?x[0]:z[0];
      for (const [j,id] of ids.entries()) {
        const row=(i+j)*4;
        values[row]=(coordinates[id*3+axis]-low)/width;
        values[row+1]=(coordinates[id*3+1]-y[0])/dy;
        values[row+2]=dy/width;
        values[row+3]=Math.round(x[0]*7.61+z[0]*13.57+y[0]*3.91);
      }
    }
    return values;
  }
  function architectureParts(name) {
    return Object.entries(ARCHITECTURE[name]).map(([key, [vertices, faces, light]]) => {
      const coordinates = Float32Array.from(decodeWords(vertices, Int16Array), n => n / 128);
      const indexed = new THREE.BufferGeometry();
      indexed.setAttribute('position', new THREE.BufferAttribute(coordinates, 3));
      indexed.setAttribute('skyVisibility', new THREE.BufferAttribute(decodeWords(light, Uint8Array), 1, true));
      const triangles=decodeWords(faces,Uint16Array);
      indexed.setIndex(new THREE.BufferAttribute(triangles,1));
      const geometry = indexed.toNonIndexed();
      if (key==='cityShade') geometry.setAttribute('cityPane',
        new THREE.Float32BufferAttribute(cityPaneCoordinates(coordinates,triangles),4));
      geometry.computeVertexNormals();
      return { geometry, material: name==='apartment'&&key==='cityShade' ? apartmentWindow : architectureMaterials[key] };
    });
  }
  function builtLandmark(name) {
    const group = new THREE.Group();
    group.userData.modelKey = name;
    architectureParts(name).forEach(({ geometry, material }) => group.add(new THREE.Mesh(geometry, material)));
    return group;
  }

  /* ── 舟船 ── */
  const boatMaterials = {
    BoatHull: inkMat(.13,false,['#314841','#667d70']), BoatBottom: inkMat(.12,false,['#56382e','#a26a51']),
    BoatDeck: inkMat(.26,false,['#726455','#baad8f']), BoatCabin: inkMat(.39,false,['#8f8065','#e6dec4']),
    BoatGlass: inkMat(.12,false,['#223638','#5e7b7c']), BoatRail: inkMat(.18,false,['#44483f','#8e9381']),
    BoatAccent: inkMat(.25,false,['#843d31','#b87157']), BoatCargo: inkMat(.22,false,['#4f5e4a','#8c9a78']),
    BoatLoad: inkMat(.19,false,['#4c493d','#80735e']),
    BoatCanopy: inkMat(.32,false,['#69765c','#bcc098'])
  };
  const boatHullKeys=['BoatDeck','BoatHull','BoatBottom'];

  // Each section starts at the port deck edge. The closed loft crosses the design waterline at Y=0.
  function vesselShell(group, type, draft, stations) {
    const vertices=[], bands=[[],[],[]], ringSize=10;
    for (const [x,half,immersion,sheer] of stations) {
      const keel=draft*immersion;
      for (const [y,z] of [[sheer,-half*.90],[sheer,half*.90],[sheer*.55,half*.975],[0,half],
        [-keel*.61,half*.80],[-keel,half*.43],[-keel,-half*.43],[-keel*.61,-half*.80],[0,-half],[sheer*.55,-half*.975]]) {
        vertices.push(x,y,z);
      }
    }
    for (let i=0;i<stations.length-1;i++) for (let j=0;j<ringSize;j++) {
      const a=i*ringSize+j, next=i*ringSize+(j+1)%ringSize, b=a+ringSize, after=next+ringSize;
      bands[j===0 ? 0 : j>=3 && j<8 ? 2 : 1].push(a,next,b,next,after,b);
    }
    for (const row of [0,stations.length-1]) {
      const origin=row*ringSize;
      for (const [material,loop] of [[1,[8,9,0,1,2,3]],[2,[3,4,5,6,7,8]]]) {
        for (let j=1;j<loop.length-1;j++) {
          const [a,b,c]=[loop[0],loop[j],loop[j+1]].map(v=>origin+v);
          bands[material].push(a,row ? b : c,row ? c : b);
        }
      }
    }
    const shell=new THREE.BufferGeometry();
    shell.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    shell.setIndex(bands.flat());
    let start=0;
    for (const [i,indices] of bands.entries()) { shell.addGroup(start,indices.length,i); start+=indices.length; }
    shell.computeVertexNormals();
    const hull=new THREE.Mesh(shell,boatHullKeys.map(key=>boatMaterials[key]));
    hull.name='船体与龙骨';
    hull.userData.vesselMaterial=boatHullKeys;
    group.add(hull);
    group.userData.vessel={type,stern:stations[0][0],bow:stations.at(-1)[0],draft,
      beam:2*Math.max(...stations.map(station=>station[1]))};
  }

  function addBoatParts(group, parts) {
    for (const [name,material,part] of parts) {
      const mesh=part.mesh(boatMaterials[material],false);
      mesh.name=name;
      mesh.userData.vesselMaterial=material;
      group.add(mesh);
    }
    return group;
  }
  function clippedBoatDeck(part, aft, fore, half, y, thickness, corner) {
    const shape=[[aft,-half+corner],[aft+corner,-half],[fore-corner,-half],[fore,-half+corner],
      [fore,half-corner],[fore-corner,half],[aft+corner,half],[aft,half-corner]];
    part.geo(hullGeo(shape,thickness),0,y,0);
  }
  function boatRail(part, posts, y, height) {
    for (const [i,[x,z]] of posts.entries()) {
      part.cyl(.031,height,x,y+height*.5,z);
      if (i) for (const level of [.49,.98]) {
        const [ax,az]=posts[i-1], wy=y+height*level;
        part.beam(V(ax,wy,az),V(x,wy,z),.042);
      }
    }
  }

  function riverLiner() {
    const group=new THREE.Group();
    group.name='武汉客渡';
    vesselShell(group,'ferry',.74,[[-5.95,1.06,.55,.64],[-5.62,1.53,.79,.60],[-4.8,1.70,.94,.58],
      [-3.7,1.75,1,.57],[2.88,1.75,1,.58],[4.54,1.61,.96,.61],[5.56,1.25,.78,.69],[6.43,.67,.57,.79],[6.95,.075,.32,.91]]);
    const cabin=new Acc(), deck=new Acc(), glass=new Acc(), rail=new Acc(), trim=new Acc();
    // Two saloons, open aft promenade, and the wrapped windows of the forward wheelhouse.
    cabin.box(8.61,1.06,2.63,.13,1.055,0);
    clippedBoatDeck(deck,-5.33,4.96,1.535,1.56,.15,.30);
    cabin.box(5.50,.86,2.37,.90,2.114,0);
    clippedBoatDeck(cabin,-2.05,3.90,1.27,2.53,.14,.24);
    clippedBoatDeck(cabin,1.94,4.23,1.055,2.64,.63,.16);
    clippedBoatDeck(cabin,1.78,4.36,1.135,3.26,.12,.20);
    for (const s of [-1,1]) {
      for (let i=0;i<8;i++) glass.box(.77,.42,.048,-3.59+i*.99,1.142,s*1.318);
      for (let i=0;i<5;i++) glass.box(.82,.38,.044,-1.22+i*1.01,2.18,s*1.188);
      for (const x of [2.39,3.24,3.83]) glass.box(.54,.30,.035,x,3.035,s*1.053);
      trim.box(8.32,.10,.055,.15,.804,s*1.322);
      boatRail(rail,[[-5.10,s*.99],[-4.65,s*1.39],[-3.63,s*1.44],[-2.57,s*1.44],[-1.89,s*1.39]],1.71,.56);
      rail.cyl(.087,.23,5.55,.81,s*.49);
      const lifeRing=new THREE.TorusGeometry(.183,.045,6,12);
      trim.geo(lifeRing,-3.18,1.94,s*1.45);
      trim.geo(lifeRing,1.95,1.98,s*1.23);
    }
    for (const z of [-.66,0,.66]) glass.box(.046,.32,.53,4.229,3.033,z);
    for (const z of [-.70,.70]) glass.box(.043,.72,.54,-4.181,.98,z);
    boatRail(rail,[[-5.11,-.98],[-5.28,-.46],[-5.28,.46],[-5.11,.98]],1.71,.56);
    rail.cyl(.046,.51,2.48,3.59,0);
    rail.beam(V(2.48,3.74,-.47),V(2.48,3.74,.47),.045);
    trim.box(.39,.42,.37,-.98,2.80,0);
    return addBoatParts(group,[['客舱与驾驶室','BoatCabin',cabin],['上层甲板','BoatDeck',deck],['舷窗与驾驶窗','BoatGlass',glass],
      ['栏杆与桅杆','BoatRail',rail],['舷线与救生圈','BoatAccent',trim]]);
  }

  function cargoShip(load = 'bulk') {
    const group=new THREE.Group();
    group.name=load==='containers' ? '长江集装箱货驳' : '长江散货驳船';
    vesselShell(group,'cargo',.94,[[-7.60,1.58,.71,.57],[-7.15,1.94,.88,.56],[-6.15,2.05,1,.54],
      [3.78,2.05,1,.54],[5.59,1.96,.95,.61],[6.83,1.59,.79,.73],[7.86,.96,.62,.84],[8.80,.08,.34,.98]]);
    group.userData.vessel.load=load;
    const cabin=new Acc(), deck=new Acc(), covers=new Acc(), glass=new Acc(), rail=new Acc(), trim=new Acc();
    const cargo=new Acc(), redContainers=new Acc(), bulk=new Acc();
    clippedBoatDeck(deck,-7.17,-3.08,1.80,.52,.13,.28);
    cabin.box(2.64,1.03,2.97,-5.38,1.12,0);
    clippedBoatDeck(cabin,-6.88,-3.73,1.66,1.62,.11,.20);
    clippedBoatDeck(cabin,-6.52,-4.16,1.31,1.71,.84,.22);
    clippedBoatDeck(cabin,-6.66,-4.03,1.43,2.54,.14,.24);
    for (const s of [-1,1]) {
      for (let i=0;i<3;i++) glass.box(.50,.34,.043,-6.01+i*.63,2.24,s*1.31);
      for (const x of [-6.17,-5.45,-4.74]) glass.box(.40,.32,.035,x,1.25,s*1.486);
      rail.cyl(.094,.22,7.15,.85,s*.58);
      boatRail(rail,[[-7.05,s*1.31],[-6.64,s*1.75],[-5.36,s*1.80],[-4.10,s*1.72]],.66,.47);
      deck.box(8.92,.10,.19,1.43,.55,s*1.73);
    }
    for (const z of [-.70,0,.70]) glass.box(.040,.35,.49,-4.164,2.24,z);
    rail.cyl(.077,.55,-6.42,2.89,.82);
    rail.cyl(.038,.88,-5.42,3.105,0);
    cabin.box(.64,.058,.062,-5.42,3.38,0);
    trim.box(.18,.105,.15,-5.41,3.52,0);
    // Coamings surround two working holds. One is shut and the forward hold shows its charcoal load.
    for (const [x,length] of [[-.92,3.74],[3.45,4.24]]) {
      for (const z of [-1.51,1.51]) deck.box(length,.27,.15,x,.679,z);
      for (const s of [-1,1]) deck.box(.17,.27,2.87,x+s*(length-.17)/2,.679,0);
    }
    covers.box(3.59,.15,2.86,-.92,.866,0);
    for (let i=0;i<6;i++) covers.box(.08,.068,2.79,-2.42+i*.60,.976,0);
    if (load==='containers') {
      covers.box(4.08,.13,2.88,3.45,.854,0);
      for (let i=0;i<3;i++) for (const s of [-1,1]) {
        const x=2.14+i*1.25,z=s*.65, container=(i+(s>0?1:0))%3===0 ? redContainers : cargo;
        container.box(1.17,.62,1.20,x,1.225,z);
        for (const d of [-.43,-.17,.16,.43]) rail.box(.035,.51,.027,x+d,1.225,z+s*.605);
      }
    } else {
      glass.box(4.06,.07,2.8,3.45,.578,0);
      const mound=new THREE.IcosahedronGeometry(1,0);
      bulk.place(mound,2.51,.58,.10,1.25,.27,1.15,.10);
      bulk.place(mound,4.25,.57,-.15,1.31,.22,.97,-.17);
      bulk.place(mound,3.63,.61,.57,.47,.21,.48,.24);
    }
    clippedBoatDeck(deck,5.79,7.63,.98,.67,.12,.30);
    trim.box(.55,.18,.59,6.66,.824,0);
    return addBoatParts(group,[['机舱与驾驶室','BoatCabin',cabin],['甲板与舱口围板','BoatDeck',deck],['货舱盖','BoatCargo',covers],
      ['舷窗与驾驶窗','BoatGlass',glass],['栏杆与船具','BoatRail',rail],['舱口与信号灯','BoatAccent',trim],
      ...(load==='containers' ? [['绿集装箱','BoatCargo',cargo],['红集装箱','BoatAccent',redContainers]] : [['散装货堆','BoatLoad',bulk]])]);
  }

  function lakeLaunch(covered = true) {
    const group=new THREE.Group();
    group.name=covered ? '东湖带篷轻舟' : '东湖敞篷轻舟';
    vesselShell(group,'lakeLaunch',.36,[[-2.8,.62,.58,.28],[-2.49,.82,.88,.32],[-1.7,.875,1,.32],
      [1.32,.875,1,.31],[2.22,.69,.80,.39],[2.90,.34,.58,.47],[3.25,.06,.32,.52]]);
    const deck=new Acc(), cabin=new Acc(), glass=new Acc(), rail=new Acc(), canopy=new Acc(), trim=new Acc();
    deck.box(.47,.22,1.30,-1.88,.413,0);
    deck.box(.43,.19,1.27,-.39,.411,0);
    deck.box(.34,.20,1.18,.97,.42,0);
    cabin.box(.48,.33,.96,1.39,.496,0);
    glass.box(.075,.37,.93,1.56,.743,0,-.06);
    for (const s of [-1,1]) {
      cabin.box(4.36,.11,.078,-.10,.35,s*.824);
      trim.box(.27,.100,.29,-2.49,.425,s*.39);
    }
    if (covered) {
      for (const x of [-1.76,1.26]) for (const z of [-.63,.63]) rail.cyl(.031,1.00,x,.80,z);
      clippedBoatDeck(canopy,-2.04,1.57,.79,1.27,.11,.25);
      clippedBoatDeck(canopy,-1.93,1.46,.68,1.37,.13,.23);
    } else {
      for (const s of [-1,1]) boatRail(rail,[[-2.24,s*.58],[-1.56,s*.77],[-.74,s*.77]],.32,.32);
    }
    return addBoatParts(group,[['座椅','BoatDeck',deck],['舷围与驾驶台','BoatCabin',cabin],['驾驶挡风窗','BoatGlass',glass],
      ['栏杆与篷架','BoatRail',rail],['艉部系泊件','BoatAccent',trim],...(covered ? [['遮阳篷','BoatCanopy',canopy]] : [])]);
  }
