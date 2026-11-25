
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
      const { width,streetLead } = bridgeStreetEntries[side];
      const label=side===0?'武昌引道':'汉阳引道';
      const stations=rows.map((p,i)=>{
        const a = i === 0 ? approachRoads[side][bridgeDeckEnd-73] : (i === rows.length-1 ? p : rows[i-1]);
        const b = i===0 ? p : rows[i+1] ?? streetLead;
        const t = i/(rows.length-1);
        const narrowing = THREE.MathUtils.smoothstep(t,.12,.88);
        const street = THREE.MathUtils.smoothstep(t,.73,1);
        const walk = THREE.MathUtils.lerp(sidewalkWidth,1.12,narrowing)*(1-THREE.MathUtils.smoothstep(t,.94,1));
        return section(p,a,b,THREE.MathUtils.lerp(carriageHalf,width/2,narrowing),walk,
          THREE.MathUtils.lerp(.18*bridgeScale,0,street));
      });
      const roadPoints=[], roadFaces=[], pigment=[];
      for (const [i,row] of stations.entries()) {
        const t=i/(stations.length-1), ink=1-THREE.MathUtils.smoothstep(t,.08,1);
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
      const sidewalks=stations[0].edges.map((_,bank)=>{
        const points=[], indices=[];
        for (const [i,row] of stations.entries()) {
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
        const a=stations[i], t=i/(stations.length-1);
        if (i%7>=3) continue;
        for (const lane of [-.50,0,.50]) {
          const fade=1-THREE.MathUtils.smoothstep(t,lane===0?.65:.18,lane===0?.92:.49);
          if (fade<.08) continue;
          const k=marks.length, half=.038*fade;
          for (const row of [a,b]) marks.push(offset(row.center,row.normal,lane*row.half-half,.016),
            offset(row.center,row.normal,lane*row.half+half,.016));
          markFaces.push(k,k+2,k+1,k+1,k+2,k+3);
        }
      }
      const markings=addPaving(label+' · 延续车道标线','RoadPaint',paintedMaterial,marks,markFaces,true);
      wuhanApproachFeatures.push({side,road,sidewalks,markings,stations});
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
    qc.updateMatrixWorld(true);
    const toWorld = (x,y,z) => qc.localToWorld(V(x,y,z));
    function addQuaySurface(mesh, name, material) {
      mesh.name = name;
      mesh.userData.landscapeSurface = { group: '晴川阁', name, material };
      scene.add(mesh);
    }

    // Keep the dressed coping and the foundation behind the exposed rock.
    const footing = new Acc();
    footing.box(46.4, 3.35, 16.55, 4.0, -1.675, 1.23);
    footing.box(46.7, .20, 19.23, 4.0, -.072, 2.43);
    const apron = footing.mesh(M.bankStone, false);
    apron.applyMatrix4(qc.matrixWorld);
    addQuaySurface(apron,'晴川阁 · 禹功矶石台驳岸','BankStone');

    function rockMesh(vertices, material) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      geometry.computeVertexNormals();
      return new THREE.Mesh(geometry,material);
    }

    // The exposed courses strike obliquely across the face and break into uneven shelves.
    const stations = [
      [-19.2, .02, .00, 1.8], [-17.8, .42, .10, 2.5], [-15.1, 1.06, .16, 3.5],
      [-12.4, .76, .07, 3.0], [-10.3, -.14, -.20, 1.8], [-7.2, -.51, -.27, 1.5],
      [-4.3, .44, -.07, 2.4], [-.5, 1.02, .10, 3.8], [2.6, 1.29, .14, 4.5],
      [5.3, .53, .20, 4.3], [7.4, -.34, -.08, 2.8], [9.3, -.58, -.22, 1.8],
      [11.1, .20, -.18, 2.8], [14.6, 1.02, .08, 4.25], [16.8, .76, .13, 2.7],
      [18.15, -.8, -.12, .15], [21.85, -.83, -.09, .12], [23.5, .24, .17, 2.05],
      [25.4, .55, .25, 2.4], [27.2, .05, .10, 1.2]
    ];
    const rows = stations.map(([x,reach,tilt,toe]) => [
      toWorld(x,-.10,9.36),
      toWorld(x,-.19,11.45+reach*.36),
      toWorld(x,-.71+tilt,12.00+reach),
      toWorld(x,-1.03+tilt,11.64+reach),
      toWorld(x,-1.30+tilt,13.18+reach+toe*.16),
      toWorld(x,-1.78+tilt,13.68+reach+toe*.33),
      toWorld(x,-2.02+tilt,13.16+reach+toe*.34),
      toWorld(x,-2.44+tilt,13.98+reach+toe*.57),
      toWorld(x,-2.94,14.05+reach+toe),
      toWorld(x,-3.65,14.5+reach+toe)
    ]);
    const rockFace = [];
    const triangle = (vertices,a,b,c) => vertices.push(...a.toArray(),...b.toArray(),...c.toArray());
    for (let i=1; i<rows.length; i++) {
      const a=rows[i-1], b=rows[i];
      for (let j=1; j<a.length; j++) {
        triangle(rockFace,a[j-1],a[j],b[j-1]);
        triangle(rockFace,a[j],b[j],b[j-1]);
      }
    }
    for (const [side,row] of [rows[0],rows.at(-1)].entries()) {
      const heel=row[0].clone().setY(qc.position.y-3.65*qc.scale.y);
      for (let j=1; j<row.length; j++) {
        if (side) triangle(rockFace,heel,row[j-1],row[j]);
        else triangle(rockFace,heel,row[j],row[j-1]);
      }
    }
    addQuaySurface(rockMesh(rockFace,M.bankStone),'晴川阁 · 禹功矶层理岩壁','BankStone');

    // Sample the original shore mask along each local ray; the lower rim of every
    // tongue is buried, and its water-plane ring supplies the ripple dimensions.
    function shoreAt(x) {
      let land=12, river=32;
      for (let i=0; i<12; i++) {
        const middle=(land+river)/2, p=toWorld(x,0,middle);
        if (onLand(p.x,p.z)) land=middle;
        else river=middle;
      }
      return toWorld(x,0,(land+river)/2).setY(0);
    }
    const along = shoreAt(15).sub(shoreAt(-17)).normalize();
    const outward = V(-along.z,0,along.x);
    waterU.uQuayOut.value.set(outward.x,outward.z);
    const wetStone = inkMat(.13,false,['#626b61','#a6a797']);
    wetStone.defines.TIDAL_STONE = 1;
    const tongues = [
      // A broken set of overlapping shelves, a long tapered point and a narrow split ledge.
      [-14,2.65,2.85,.67,.66,[[-.88,-2.75],[-1,-.87],[-.72,.06],[-.81,.68],[-.36,.86],
        [.08,1],[.62,.70],[1,.31],[.66,-.40],[.36,-1.65],[.67,-2.62]]],
      [2.1,4.75,3.4,.66,.86,[[-.76,-2.73],[-.94,-1.40],[-.84,-.30],[-.67,.27],[-.34,.79],
        [.03,1],[.47,.83],[.96,.47],[1.31,.27],[1.52,-.12],[1.06,-.79],[.83,-2.14]]],
      [12.5,2.18,1.22,.44,-.32,[[-.20,-5.86],[-.94,-4.56],[-1,-2.63],[-.85,-.44],[-.72,.40],
        [-.38,.83],[.20,1],[.60,.70],[.82,-.42],[.56,-2.23],[.40,-4.91]]]
    ];
    function stoneTongue(center,width,reach,crest,skew,footprint,phase) {
      const rings=[
        [-.36,.91,1.03,-.11], [0,1,1,0], [.21,.98,.88,-.02],
        [.31,.91,.91,.02], [crest,.86,.88,-.13], [crest+.07,.58,.76,-.22]
      ].map(([y,sx,sz,inset]) => footprint.map(([u,v]) => {
        const root=Math.max(0,-v)*reach/3;
        const bankRise=.48*y*(1-THREE.MathUtils.smoothstep(v,-.62,.36))/(crest+.07);
        return center.clone().addScaledVector(along,width*sx*u+skew*v)
          .addScaledVector(outward,reach*(sz*v+inset))
          .setY(y > 0 ? y*(1+.20*Math.sin(u*3.7+phase)-.43*Math.max(0,v)) + root*(.24+y*.52) + bankRise : y);
      }));
      const faces=[];
      for (let band=1; band<rings.length; band++) {
        const a=rings[band-1],b=rings[band];
        for (let j=0;j<a.length;j++) {
          const k=(j+1)%a.length;
          triangle(faces,a[j],a[k],b[j]);
          triangle(faces,a[k],b[k],b[j]);
        }
      }
      const top=rings.at(-1);
      const crown=center.clone().addScaledVector(outward,-reach*.48).setY(crest+.64);
      for (let j=0;j<top.length;j++) triangle(faces,crown,top[j],top[(j+1)%top.length]);
      const radius=Math.max(...rings[1].filter((_,j)=>footprint[j][1]>=0)
        .map(p=>Math.abs(p.clone().sub(center).dot(along))));
      return {faces,radius};
    }
    for (const [i,[x,width,reach,crest,skew,footprint]] of tongues.entries()) {
      const center=shoreAt(x).addScaledVector(outward,.37);
      const {faces,radius}=stoneTongue(center,width,reach,crest,skew,footprint,i);
      if (i === 0) {
        const flank=center.clone().addScaledVector(along,1.62).addScaledVector(outward,-.92);
        const slab=[[-.45,-2.4],[-1,-1.02],[-.73,.23],[-.03,.76],[.58,.82],
          [1,.39],[.78,-.63],[.45,-2.1]];
        faces.push(...stoneTongue(flank,1.4,2.70,.46,.12,slab,2.5).faces);
      } else if (i === 1) {
        const shelf=center.clone().addScaledVector(along,5.44).addScaledVector(outward,-1.25);
        const slab=[[-1.0,-2.15],[-1.18,-1.52],[-.94,-.55],[-.69,.24],[-.25,.54],
          [.25,.41],[.70,.16],[1.15,-.03],[1.21,-.57],[.84,-1.05],[.49,-1.81],[-.37,-2.28]];
        faces.push(...stoneTongue(shelf,4.45,2.78,.55,-.54,slab,4).faces);
      }
      addQuaySurface(rockMesh(faces,wetStone),'晴川阁 · 禹功矶入水石舌 '+(i+1),'ShoreStone');
      waterU.uQuaySpurs.value[i].set(center.x,center.z,radius,reach);
    }

    // The exposed rock bed follows the bank grade and tapers above the waterline.
    const gravel = [];
    const gravelRows = Array.from({length:39},(_,i) => {
      const x=-21+i*.99, edge=qc.worldToLocal(shoreAt(x)).z;
      const ends=THREE.MathUtils.smoothstep(i,0,4)*THREE.MathUtils.smoothstep(38-i,0,5);
      const inlet=1-THREE.MathUtils.smoothstep(Math.abs(x+6.3),.9,4.1);
      const top=13.25+.39*Math.sin(x*.67)+.42*Math.cos(x*1.42);
      const toe=edge-.25-.88*inlet-.22*Math.sin(x*1.23);
      return Array.from({length:9},(_,j) => {
        const t=j/8, ripple=j===0 || j===8 ? 0 : .27*Math.sin(x*1.05+j*2.4);
        const z=THREE.MathUtils.lerp(top,toe,t*ends)+ripple*ends;
        const p=toWorld(x,0,z);
        const relief=(.035+.13*(1-t))*ends*(.78+.22*Math.cos(x*1.6+j*2.8));
        return p.setY(terrainTop(p.x,p.z)+.024+relief);
      });
    });
    for (let i=1;i<gravelRows.length;i++) {
      const a=gravelRows[i-1], b=gravelRows[i];
      for (let j=1;j<a.length;j++) {
        if (i>1) triangle(gravel,a[j-1],a[j],b[j-1]);
        if (i<gravelRows.length-1) triangle(gravel,a[j],b[j],b[j-1]);
      }
    }
    const gravelStone=inkMat(.20,false,['#767263','#aca692']);
    addQuaySurface(rockMesh(gravel,gravelStone),'晴川阁 · 禹功矶岸脚碎砾浅滩','ShoreStone');

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
  // Bake two small side elevations once. The water shader projects them without a second city render.
  function bridgeSilhouette(landmark, index, uniform) {
    const elevation = new THREE.Scene();
    const pigment = new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide});
    for (const part of landmark.children) {
      if (!part.isMesh) continue;
      const copy = new THREE.Mesh(part.geometry,pigment);
      copy.applyMatrix4(part.matrix);
      elevation.add(copy);
    }
    const box = new THREE.Box3().setFromObject(elevation);
    box.expandByScalar(.20);
    const width=box.max.z-box.min.z, height=box.max.y-box.min.y;
    const center=box.getCenter(new THREE.Vector3());
    const lens=new THREE.OrthographicCamera(-width/2,width/2,height/2,-height/2,.1,box.max.x-box.min.x+3);
    lens.position.set(box.min.x-1,center.y,center.z);
    lens.lookAt(center);
    const plate=new THREE.WebGLRenderTarget(768,160,{depthBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
    const previous=renderer.getRenderTarget();
    elevation.background=new THREE.Color(0x000000);
    try {
      renderer.setRenderTarget(plate);
      renderer.render(elevation,lens);
    } finally {
      renderer.setRenderTarget(previous);
      pigment.dispose();
    }
    const yaw=landmark.rotation.y, scale=landmark.scale, origin=landmark.position;
    waterU.uBridgeAxis.value[index].set(origin.x,origin.z,Math.sin(yaw),Math.cos(yaw));
    waterU.uBridgeBounds.value[index].set(width*scale.z,height*scale.y,box.min.z*scale.z,origin.y+box.min.y*scale.y);
    uniform.value=plate.texture;
    app.cleanups.push(()=>plate.dispose());
  }
  function prepareBridgeReflections() {
    if (waterU.uTrussInk.value || camera.position.y>=175) return;
    bridgeSilhouette(bridge,0,waterU.uTrussInk);
    bridgeSilhouette(yingwuzhou,1,waterU.uTowerInk);
  }
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
  const riverfrontLookouts = [];
  const cityGround = { occupied: () => false, streets: [], verges: [], bridgeGardens: [], riverfrontPaths: [], courtyardPaths: [] };

  // Loose groups behind the river walks keep the low shore open between both bridges.
  const riverfrontBlocks = [
    {
      yaw:1.82,
      openings:[[-203.6,54.5,7,5.4],[-197.6,40.1,12,9.5],[-189.1,23.6,8,6]],
      homes:[[-203,21],[-218,29],[-227,27],[-222,45],[-226,55],[-218,63],[-207,65],[-222,72]],
      groves:[
        { species:'willow', positions:[[-191,19],[-196,18],[-202,19],[-203,23]] },
        { species:'broadleaf', positions:[[-212,31],[-219,32],[-227,32],[-226,40]] },
        { species:'willow', positions:[[-205,55],[-209,57],[-216,56],[-209,62],[-215,65]] },
      ],
    },
    {
      yaw:-1.80,
      openings:[[-89.1,112.8,8.5,6],[-87,92.3,12,10.5],[-81.7,61.2,9,8.5],
        [-81.4,39.9,2.5,6.5],[-92.45,124.3,1.1,1.2]],
      homes:[[-71,46],[-65,54],[-76,63],[-65,67],[-73,76],[-56,85],[-72,96],[-61,107],[-69,118],[-80,131],[-66,25,'lane']],
      groves:[
        { species:'willow', positions:[[-80,49],[-78,52],[-74,52],[-72,55]] },
        { species:'broadleaf', positions:[[-69.1,38.2],[-70.75,36.25],[-67.75,40]] },
        { species:'broadleaf', positions:[[-82,71],[-83,75],[-79,77],[-74,78]] },
        { species:'willow', positions:[[-86,105],[-81,105],[-77,107],[-78,114]] },
        { species:'broadleaf', positions:[[-85,125],[-81.3,127.4],[-81.1,132],[-79,127]] },
      ],
    },
  ];
  function riverfrontOpening(x,z,margin = 0) {
    return riverfrontBlocks.some(({openings}) => openings.some(([cx,cz,hx,hz]) =>
      ((x-cx)/(hx+margin))**2 + ((z-cz)/(hz+margin))**2 < 1));
  }

  const riverfrontStoneInk=new Map();
  function riverfrontPavingInk(base,worn=false) {
    if (!riverfrontStoneInk.has(base)) riverfrontStoneInk.set(base,new Map());
    const variants=riverfrontStoneInk.get(base);
    if (variants.has(worn)) return variants.get(worn);
    const stone=base.clone();
    stone.uniforms=base.uniforms;
    if (worn) stone.defines={...base.defines,WALK_WEAR:1};
    stone.fragmentShader=stone.fragmentShader.replace('vec3 col = mix(uInk, uPaper, tone);',`
      vec3 col = mix(uInk, uPaper, tone);
      float quartz = vnoise(vW.xz*29.4) - .5;
      float streak = vnoise(vW.xz*vec2(2.1,5.8)) - .5;
      float patina = vnoise(vW.xz*.73);
      col *= 1. + (quartz*.072 + streak*.069 - patina*.035) *
        (1. - smoothstep(28.,107.,vD));
    `);
    variants.set(worn,stone);
    return stone;
  }
  const walkJointInk=inkMat(.49,false,['#827866','#b4ab91']);
  const walkEdgeInk=inkMat(.41,false,['#a49b84','#c8b99a']);
  const walkSlabInk=inkMat(.51,false,['#aaa28a','#c9c2a8']);

  // Tooling follows the sampled walking surface so the joints sit exactly on the laid stone.
  function layWalkDetails(group,name,rows,active = null,small=false) {
    const joints=[], edge=[], slabs=[];
    const point=(i,t,u,lift)=>{
      const side=u<0 ? 0 : 2, a=rows[i], b=rows[i+1];
      const section=row=>row[1].map((v,j)=>THREE.MathUtils.lerp(v,row[side][j],Math.abs(u)));
      const from=section(a), to=section(b), p=from.map((v,j)=>THREE.MathUtils.lerp(v,to[j],t));
      p[1]+=lift;
      return p;
    };
    function panel(batch,i,[t0,t1],[u0,u1],lift) {
      const p=point(i,t0,u0,lift), q=point(i,t1,u0,lift), r=point(i,t0,u1,lift), t=point(i,t1,u1,lift);
      if (triangleOnLand(p,q,r)) batch.push(...p,...q,...r);
      if (triangleOnLand(r,q,t)) batch.push(...r,...q,...t);
    }
    for (let i=0;i+1<rows.length;i++) {
      if (active && !active[i]) continue;
      const a=rows[i][1], b=rows[i+1][1], run=Math.hypot(a[0]-b[0],a[2]-b[2]);
      const width=Math.hypot(rows[i][0][0]-rows[i][2][0],rows[i][0][2]-rows[i][2][2]);
      if (run<.21 || width<.65) continue;
      const split=.10*Math.sin(i*.81);
      const groups=width>2.7 ? [-.82,-.35+split,.31+split,.82] : [-.82,split,.82];
      for (let j=0;j<groups.length-1;j++) {
        const u0=groups[j],u1=groups[j+1], t=.21+.54*((i*13+j*7)%19)/18;
        const jointHalf=Math.min(.13,(small ? .011 : .016)/run);
        if ((i+j)%7!==4) panel(joints,i,[t-jointHalf,t+jointHalf],[u0,u1],.019);
        if ((i*4+j)%9===0 && width>1.5)
          panel(slabs,i,[t+jointHalf,.93],[u0+.028,u1-.028],.012);
        if (j>0 && (i+j)%3!==0)
          panel(joints,i,[.025,.96],[u0-.014/width,u0+.014/width],.016);
      }
      if ((i%5)!==3 || small) {
        panel(edge,i,[.04,.96],[-.985,-.83],.011);
        panel(edge,i,[.06,.93],[.83,.985],.012);
      }
    }
    for (const [label,material,ink,positions] of [
      ['石缝','ShoreStone',walkJointInk,joints],['镶边','BankStone',walkEdgeInk,edge],['错缝铺石','Masonry',walkSlabInk,slabs],
    ]) {
      if (!positions.length) continue;
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geo.computeVertexNormals();
      const mesh=new THREE.Mesh(geo,ink);
      mesh.name=name+' · '+label;
      mesh.userData.landscapeSurface={group,name:mesh.name,material};
      mesh.userData.detailSize=label==='石缝' ? .08 : .40;
      scene.add(mesh);
    }
  }

  function buildRiverfrontAlleys(lots) {
    const {lane:lanes, apartment:apartments}=lots;
    const colors = {
      Masonry:inkMat(.38,false,['#8d7d6e','#d6c6ac']),
      FaceClay:inkMat(.31,false,['#846b57','#cbb49a']),
      Ink:inkMat(.21,false,['#463b33','#756558']),
      Paper:inkMat(.53,false,['#9a896c','#e3d4af']),
      BoatAccent:inkMat(.22,false,['#774d3c','#ac7856']),
      Slate:inkMat(.22,false,['#495954','#859287']),
      ShoreStone:inkMat(.17,false,['#4e5952','#7b8279']),
      BoatGlass:inkMat(.23,true,['#2e424b','#758488']),
      Reeds:inkMat(.21,true,['#475842','#9aab66']),
      BoatLoad:inkMat(.20,false,['#6d563b','#b29965']),
      BankStone:inkMat(.22,false,['#786c62','#b2a08f']),
      BoatCanopy:inkMat(.26,true,['#74674e','#b7a581']),
    };
    for (const key of ['BoatAccent','Ink']) {
      colors[key].defines={COURT_TIMBER:1};
      colors[key].uniforms.uMaterialAtlas={value:fabricAtlas};
    }
    const courtStone=colors.Masonry;
    courtStone.fragmentShader=courtStone.fragmentShader.replace('vec3 col = mix(uInk, uPaper, tone);',`
      vec3 col = mix(uInk, uPaper, tone);
      float lime = fbm(vec2(vW.x-vW.z,vW.y*.72)*1.25);
      float splash = 1.-smoothstep(.76,1.20,vW.y+.12*(lime-.5));
      col *= 1.-(1.-smoothstep(29.,63.,vD))*(.12*lime+.14*splash);`);
    const head = new THREE.SphereGeometry(1,8,6);
    const coat = new THREE.CylinderGeometry(.78,1,1,8);
    const floor = p => plantingSurface(p.x,p.z) ?? LAND_Y;
    const contacts=[], contactCover=[];
    function supportAt(p,paving) {
      if (!paving) return floor(p);
      const ray=new THREE.Raycaster(V(p.x,p.y+.23,p.z),V(0,-1,0),0,.42);
      return ray.intersectObject(paving)[0]?.point.y ?? floor(p);
    }
    function closeContact(p,yaw,rx,rz,paving,raised=0) {
      const cp=Math.cos(yaw), sp=Math.sin(yaw), vertices=[], sides=14;
      for (const [ring,opacity] of [[0,.94],[.48,.67],[1,0]]) {
        for (let i=0;i<sides;i++) {
          const t=2*Math.PI*i/sides, a=rx*ring*Math.cos(t), b=rz*ring*Math.sin(t);
          const v=p.clone().add(V(cp*a+sp*b,0,-sp*a+cp*b));
          v.y=Math.max(supportAt(v,paving),floor(v)+raised)+.008;
          vertices.push([v,opacity]);
        }
      }
      const face=(...slots)=>slots.forEach(i=>{
        const [v,opacity]=vertices[i];
        contacts.push(...v.toArray());
        contactCover.push(opacity);
      });
      for (let i=0;i<sides;i++) {
        const j=(i+1)%sides;
        face(0,sides+j,sides+i);
        face(sides+i,sides+j,sides*2+i);
        face(sides+j,sides*2+j,sides*2+i);
      }
    }
    function gateTreads(group,name,front,paving,rows) {
      const stone=blocks(group,name), {point,yaw}=front;
      for (const [u,d,width,depth,top] of rows) {
        const p=point(u,d);
        const h=supportAt(p,paving)-p.y+top;
        stone.box('BankStone',point(u,d,h*.5-.016),width,h+.021,depth,yaw);
        stone.box('Masonry',point(u+.005,d-.009,h-.008),width-.033,.021,depth-.038,yaw);
        closeContact(point(u,d+depth*.47),yaw,width*.56,.11,paving);
      }
      stone.show();
    }

    function laneFront(x,z,endWall) {
      const lane=lanes.find(({elements:e})=>Math.hypot(x-e[12],z-e[14])<.28);
      if (!lane) return null;
      const e=lane.elements, origin=V(e[12],0,e[14]);
      const u=V(e[0],0,e[2]), v=V(e[8],0,e[10]);
      const forward=(endWall ? u : v).clone().normalize().negate();
      const tangent=(endWall ? v : u).clone().normalize();
      if (endWall) origin.addScaledVector(u,-4.79);
      else origin.addScaledVector(v,-2.73).addScaledVector(u,-.03);
      const point=(across,along,height=0)=>{
        const p=origin.clone().addScaledVector(tangent,across).addScaledVector(forward,along);
        return p.setY(floor(p)+height);
      };
      return {origin,forward,tangent,point,yaw:Math.atan2(-tangent.z,tangent.x)};
    }
    function add(group,name,material,mesh) {
      mesh.name=name;
      mesh.userData.landscapeSurface={group,name,material};
      mesh.userData.detailSize=1.0;
      scene.add(mesh);
    }
    function blocks(group,label) {
      const batches=new Map();
      const batch=key=>{
        if (!batches.has(key)) batches.set(key,new Acc());
        return batches.get(key);
      };
      return {
        box(key,p,w,h,d,yaw,pitch=0){
          const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch,yaw,0,'YXZ'));
          batch(key).push(UBOX,new THREE.Matrix4().compose(p,rotation,V(w,h,d)));
        },
        round(key,shape,p,w,h,d,yaw){ batch(key).place(shape,p.x,p.y,p.z,w,h,d,yaw); },
        beam(key,a,b,width){ batch(key).beam(a,b,width); },
        surface(key,geometry){ batch(key).push(geometry); },
        show(){
          for (const [key,built] of batches) add(group,label+' · '+key,key,built.mesh(colors[key],false));
        },
      };
    }
    function laneApron(group,name,front,reach,half) {
      const {point,forward}=front;
      const start=point(0,0), lip=point(0,reach), path=cityGround.riverfrontPaths
        .filter(({name})=>name===group.slice(0,2)+'滨水通街支巷');
      let nearest=Infinity, target;
      for (const {a,b,width} of path) {
        const d=V(b.x-a.x,0,b.z-a.z), s=V(a.x-lip.x,0,a.z-lip.z);
        const t=THREE.MathUtils.clamp(-s.dot(d)/d.lengthSq(),0,1);
        const toward=s.addScaledVector(d,t), gap=toward.length();
        if (gap>=nearest || toward.dot(forward)<=0) continue;
        nearest=gap;
        target=lip.clone().addScaledVector(toward,Math.max(0,gap-width*.5+.09)/gap).setY(0);
      }
      if (!target || nearest>8) return;
      paveAlley(group,name,[start,lip,target],12,t =>
        THREE.MathUtils.lerp(half,.47,THREE.MathUtils.smoothstep(t,.25,1)));
    }
    function paveAlley(group,name,controls,count,halfWidth,{
      material='Path', liftAt=t=>THREE.MathUtils.lerp(.092,.071,t), routeName,
    } = {}) {
      const curve=new THREE.CatmullRomCurve3(controls.map(p=>p.clone().setY(0)));
      const points=curve.getSpacedPoints(count), vertices=[], indices=[], sections=[];
      for (let i=0;i<points.length;i++) {
        const p=points[i], a=points[Math.max(i-1,0)], b=points[Math.min(i+1,points.length-1)];
        const axis=V(b.z-a.z,0,a.x-b.x).normalize(), t=i/count;
        const section=[-1,1].map(sign=>{
          const q=p.clone().addScaledVector(axis,halfWidth(t)*sign);
          return [q.x,floor(q)+liftAt(t),q.z];
        });
        vertices.push(...section.flat());
        sections.push([section[0],section[0].map((v,j)=>(v+section[1][j])*.5),section[1]]);
        if (!i) continue;
        const j=2*(i-1);
        indices.push(j,j+2,j+1,j+1,j+2,j+3);
        const path={a:points[i-1],b:p,width:2*Math.max(halfWidth((i-1)/count),halfWidth(t)),
          name:routeName,group,planted:true,riverfront:true};
        cityGround.courtyardPaths.push(path);
        if (routeName) {
          cityGround.riverfrontPaths.push(path);
          cityGround.streets.push(path);
        }
      }
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      geometry.setIndex(indices); geometry.computeVertexNormals();
      const ink=riverfrontPavingInk(material==='BankStone' ? M.bankStone : M.bankPath);
      add(group,name,material,new THREE.Mesh(geometry,ink));
      layWalkDetails(group,name,sections,null,true);
    }
    const dripTile=new THREE.CylinderGeometry(.50,.45,1,7,1,false,Math.PI*.5,Math.PI).rotateX(Math.PI*.5);
    const closeTilePalette=[
      ['Slate',.15,['#293731','#7a8579']],
      ['ShoreStone',.13,['#35423c','#858e7f']],
      ['BankStone',.09,['#38463d','#8d9181']],
    ].map(([key,tone,tint])=>{
      const ink=inkMat(tone,false,tint);
      // Stipple into the baked roof over the mid range without changing depth order.
      ink.fragmentShader=ink.fragmentShader.replace('void main() {',`void main() {
        if (vD > 24.) {
          vec2 p = mod(floor(gl_FragCoord.xy), 4.);
          vec2 q = floor(p * .5);
          p = mod(p, 2.);
          float b = mod(2. * p.x + 3. * p.y, 4.) * 4. + mod(2. * q.x + 3. * q.y, 4.);
          if (smoothstep(24., 39., vD) >= (b + .5) / 16.) discard;
        }
      `);
      ink.fragmentShader=ink.fragmentShader.replace('vec3 col = mix(uInk, uPaper, tone);',`
        vec3 col = mix(uInk, uPaper, tone);
        float clayGrain = (vnoise(vW.xz * 16.) - .5) * .085;
        float clayWear = (vnoise(vW.xz * 3.6) - .5) * .095;
        col *= 1. + (clayGrain + clayWear) * (1. - smoothstep(20., 40., vD));
      `);
      return {key,ink};
    });
    function clayRoof(group,name,point,roofHeight,features) {
      const layers=closeTilePalette.map(()=>({positions:[],indices:[]}));
      const pitch=.283;
      function tile(layer,x,start,end,side,width,lift,arching,seed) {
        const {positions,indices}=layer, startVertex=positions.length/3;
        const rows=2, ribs=5;
        for (let row=0;row<=rows;row++) {
          const t=row/rows, course=THREE.MathUtils.lerp(start,end,t);
          const taper=.97+.086*t;
          for (let i=0;i<=ribs;i++) {
            const u=i/ribs, cross=(u-.5)*width*taper;
            const v=side*(course+.008*Math.sin(Math.PI*u+seed)*t);
            const h=roofHeight(v)+lift+arching(u)*(.93+.12*t)+.025*t*t*t;
            positions.push(...point(x+cross,h,v).toArray());
          }
        }
        for (let j=0;j<rows;j++) for (let i=0;i<ribs;i++) {
          const a=startVertex+j*(ribs+1)+i,b=a+1,c=a+ribs+1,d=c+1;
          if (side>0) indices.push(a,c,b,b,c,d);
          else indices.push(a,b,c,b,d,c);
        }
        // The exposed lower edge turns under to the tile immediately below it.
        const front=startVertex+rows*(ribs+1), underside=positions.length/3;
        for (let i=0;i<=ribs;i++) {
          const v=side*(end+.008*Math.sin(Math.PI*i/ribs+seed));
          const xEdge=x+(i/ribs-.5)*width*1.056;
          const h=roofHeight(v)+lift+arching(i/ribs)*1.05+.025;
          positions.push(...point(xEdge,end>2.93?roofHeight(v)-.017:h-.027,v-side*.014).toArray());
        }
        for (let i=0;i<ribs;i++) {
          const a=front+i,b=a+1,c=underside+i,d=c+1;
          if (side>0) indices.push(a,c,b,b,c,d);
          else indices.push(a,b,c,b,d,c);
        }
      }
      for (const [bayIndex,bay] of [-3.17,0,3.17].entries()) {
        for (const side of [-1,1]) for (let course=0;course<8;course++) {
          const start=.10+course*.352, end=Math.min(start+.385,2.966);
          for (let run=0;run<=10;run++) {
            const key=(run*7+course*3+bayIndex*13+side*11)*2.399;
            const u=bay+(run-5)*pitch+.012*Math.sin(key);
            const clear=(x,margin)=>!features.some(feature=>
              Math.sign(feature.v)===side &&
              Math.abs(x-feature.u)<margin+(feature.kind==='dormer'?.62:feature.kind==='chimney'?.31:.19) &&
              Math.abs((start+end)*.5-Math.abs(feature.v))<(feature.kind==='dormer'?.63:.32));
            const cover=layers[Math.sin(key)>.54?2:1];
            if (clear(u,.074)) tile(cover,u,start,end,side,.151,.043,
              t=>.077*Math.sin(Math.PI*t),key);
            if (run<10 && clear(u+pitch*.5,.13)) tile(layers[0],u+pitch*.5,start-.005,end,side,.261,.019,
              t=>.033*(2*t-1)**2,key);
          }
        }
      }
      for (const [i,{positions,indices}] of layers.entries()) {
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        const {key,ink}=closeTilePalette[i], mesh=new THREE.Mesh(geometry,ink);
        add(group,name+'实体青瓦 · '+key,key,mesh);
        mesh.userData.detailDepth=39;
      }
    }
    function streetEaves(group,name,x,z,features=[],nearTiles=false) {
      const matrix=lanes.find(({elements:e})=>Math.hypot(x-e[12],z-e[14])<.28);
      if (!matrix) return;
      const e=matrix.elements, scale=Math.hypot(e[0],e[2]), height=e[5], yaw=Math.atan2(-e[2],e[0]);
      const point=(u,h,v)=>V(u,h,v).applyMatrix4(matrix);
      const trim=blocks(group,name);
      // Three ridge lengths stop short of the party walls of the baked roof.
      for (const [i,bay] of [-3.17,0,3.17].entries()) {
        const crown=4.15+[.004,.052,.025][i];
        trim.box('ShoreStone',point(bay,crown,0),2.82*scale,.13*height,.21*scale,yaw);
        for (const side of [-1,1]) {
          trim.box('Ink',point(bay,2.642,side*2.91),2.92*scale,.096*height,.12*scale,yaw);
          for (let tile=0;!nearTiles && tile<12;tile++) {
            const u=bay-1.39+.25*tile, sag=.027*Math.sin(tile*1.34+i*.71);
            trim.round('ShoreStone',dripTile,point(u,2.655+sag,side*(2.94+sag*.42)),
              .213*scale,.14*height,.173*scale,yaw);
          }
        }
      }
      const roofHeight=v=>4.14-Math.abs(v)*1.46/2.94;
      if (nearTiles) clayRoof(group,name,point,roofHeight,features);
      for (const {kind,u,v} of features) {
        const side=Math.sign(v);
        if (kind==='chimney') {
          const top=roofHeight(v)+.83;
          const foot=roofHeight(v)-.22;
          trim.box('Masonry',point(u,(top+foot)*.5,v),.52*scale,(top-foot)*height,.46*scale,yaw);
          trim.box('BoatAccent',point(u,top-.20,v),.54*scale,.066*height,.48*scale,yaw);
          trim.box('ShoreStone',point(u,top-.065,v),.66*scale,.132*height,.57*scale,yaw);
          trim.box('Ink',point(u,top+.006,v),.30*scale,.025*height,.24*scale,yaw);
        } else if (kind==='dormer') {
          const front=v+side*.47, back=v-side*.56;
          const foot=roofHeight(front)-.13, sill=foot+.15;
          const lintel=foot+.62;
          trim.box('Masonry',point(u,foot+.325,(front+back)*.5),.94*scale,.67*height,1.03*scale,yaw);
          trim.box('Ink',point(u,(sill+lintel)*.5,front+side*.012),.66*scale,(lintel-sill)*height,.042*scale,yaw);
          trim.box('ShoreStone',point(u,sill,front+side*.068),.82*scale,.070*height,.18*scale,yaw);
          trim.box('BoatAccent',point(u,(lintel+sill)*.5,front+side*.041),.069*scale,.47*height,.038*scale,yaw);
          for (const slope of [-1,1]) {
            const panel=(a,b)=>point(u+slope*.64*a,lintel+.335-.305*a+.11*b,
              front+side*.15-side*1.34*b);
            fabric(trim,'Slate',(a,b)=>panel(a,slope===side?1-b:b),7,4);
            cane(trim,'ShoreStone',[panel(.99,.02),panel(.99,.98)],.031*scale);
          }
          cane(trim,'Ink',[point(u,lintel+.342,front+side*.16),point(u,lintel+.449,back-side*.18)],.045*scale);
        } else if (kind==='glass') {
          // A pair of curved daylight tiles follows one run; the original clay courses surround it.
          for (const row of [0,1]) {
            const center=v+side*(row-.5)*.30;
            fabric(trim,'Slate',(a,b)=>{
              const depth=center+(b-.5)*.308;
              return point(u+(a-.5)*.255,roofHeight(depth)+.014+.035*Math.sin(Math.PI*a),depth);
            },8,2);
          }
        } else {
          for (let row=0;row<4;row++) for(let col=0;col<6;col++) {
            if ((row===0&&col>3)||(row===3&&col<2)) continue;
            const tileU=u+(col-2.5)*.27+(row%2)*.12;
            const tileV=v+side*(row-1.5)*.31;
            const material=(row*3+col)%5<3?'ShoreStone':'Slate';
            fabric(trim,material,(a,b)=>{
              const depth=tileV+(b-.5)*.305;
              return point(tileU+(a-.5)*.26,roofHeight(depth)+.021+.040*Math.sin(a*Math.PI),depth);
            },4,1);
          }
          if (kind==='mended') {
            for (const [dx,len] of [[-.20,.56],[.54,.78]]) {
              trim.box('BankStone',point(u+dx,4.226,0),len*scale,.14*height,.29*scale,yaw);
            }
          }
        }
      }
      trim.show();
    }
    function doorway(detail,front,across,width,height) {
      const {point,yaw}=front;
      detail.box('Ink',point(across,.023,height*.5+.035),width,height,.035,yaw);
      for (const side of [-1,1]) {
        detail.box('BoatAccent',point(across+side*(width*.5+.025),.031,height*.5+.034),.035,height+.029,.058,yaw);
      }
      detail.box('Masonry',point(across,.05,height+.056),width+.12,.071,.105,yaw);
      detail.box('Masonry',point(across,.13,.059),width+.11,.094,.31,yaw);
    }
    function stoneFoot(detail,front,runs) {
      const {point,yaw}=front;
      for (const [start,end,depth] of runs) {
        const count=Math.ceil((end-start)/.44);
        for (let i=0;i<count;i++) {
          const width=(end-start)/count, center=start+(i+.5)*width;
          const rise=.138+.026*Math.sin(center*6.1), lip=.10+.022*Math.sin(center*8.4);
          detail.box(i%4===1?'Masonry':'BankStone',point(center,depth,rise*.5-.017),
            width-.012,rise+.028,lip*2,yaw);
          if (i%3!==2) detail.box('ShoreStone',point(center,depth-.025,rise+.004),
            width-.026,.035,lip*1.76,yaw);
        }
      }
    }
    function latticeWindow(detail,front,across,width,height) {
      const {point,yaw}=front;
      const center=1.12;
      detail.box('Ink',point(across,.014,center),width,height,.027,yaw);
      for (const r of [-1,-.33,.33,1]) {
        detail.box('BoatAccent',point(across+r*width*.48,.035,center),.027,height,.026,yaw);
      }
      for (const r of [-1,0,1]) {
        detail.box('BoatAccent',point(across,.035,center+r*height*.49),width,.029,.026,yaw);
      }
    }
    function person(detail,front,u,d,turn,size,outfit,stride,pose={}) {
      const seated=pose.mode==='seated', window=pose.mode==='window';
      const vendor=!seated&&!window&&Math.abs(stride)<.3, step=stride*.20, trousers=vendor?'Slate':'Ink';
      const root=front.point(u,d), yaw=front.yaw+turn, c=Math.cos(yaw), s=Math.sin(yaw);
      const paving=scene.getObjectByName(vendor?'汉阳茶案前埕接支巷':'武昌里分门前石径接支巷');
      if (window) root.y=pose.base;
      if (paving && !seated && !window) {
        const ground=new THREE.Raycaster(root.clone().add(V(0,.22,0)),V(0,-1,0),0,.25);
        const support=ground.intersectObject(paving)[0];
        if (support) root.y=Math.max(root.y,support.point.y);
      }
      const raw=(x,y,z)=>root.clone().add(V((x*c+z*s)*size,y*size,(-x*s+z*c)*size));
      const fold=seated?.276:0;
      const lean=window?.31:pose.hand?(seated?.18:.105):0;
      const reach=pose.hand&&!window?pose.side*(seated?.17:.12):0;
      const at=(x,y,z)=>raw(x+reach*Math.max(0,y-.57),y-fold,z+lean*Math.max(0,y-.57));
      const local=p=>{
        const q=p.clone().sub(root).divideScalar(size), y=q.y+fold;
        return [q.x*c-q.z*s-reach*Math.max(0,y-.57),y,q.x*s+q.z*c-lean*Math.max(0,y-.57)];
      };
      const seam=(key,path,radius)=>cane(detail,key,path.map(([x,y,z])=>at(x,y,z)),radius*size);
      function oval(key,place,x,y,z,rx,ry,rz,rotation=yaw) {
        detail.round(key,head,place(x,y,z),rx*size,ry*size,rz*size,rotation);
      }
      function rings(key,nodes,place=at,sides=12) {
        const points=[], indices=[];
        for (const [i,[x,y,z,wide,deep]] of nodes.entries()) {
          const before=nodes[Math.max(0,i-1)], after=nodes[Math.min(nodes.length-1,i+1)];
          const direction=V(after[0]-before[0],after[1]-before[1],after[2]-before[2]).normalize();
          const cross=V(1,0,0).addScaledVector(direction,-direction.x).normalize();
          const depth=V(0,0,0).crossVectors(cross,direction).normalize();
          for (let j=0;j<sides;j++) {
            const theta=j*Math.PI*2/sides;
            const offset=cross.clone().multiplyScalar(wide*Math.cos(theta)).addScaledVector(depth,deep*Math.sin(theta));
            points.push(...place(x+offset.x,y+offset.y,z+offset.z).toArray());
            if (i) {
              const a=(i-1)*sides+j,b=(i-1)*sides+(j+1)%sides,c=a+sides,d=b+sides;
              indices.push(a,c,b,b,c,d);
            }
          }
        }
        const mesh=new THREE.BufferGeometry();
        mesh.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
        mesh.setIndex(indices); mesh.computeVertexNormals();
        detail.surface(key,mesh);
      }
      rings(outfit,[
        [0,.565,0,.026,.039],[0,.568,0,.157,.099],[0,.612,-.013,.167,.108],
        [.009,.737,-.010,.147,.100],[.005,.848,.007,.152,.106],
        [0,.912,.013,.168,.093],[.005,.957,.014,.123,.069],[.005,.979,.018,.076,.055],
      ]);
      for (const side of [-1,1]) {
        if (!window) {
          const z=side*step, foot=seated?.273+side*.021:z+.055;
          const shoe=raw(side*.092,.043,foot), sole=supportAt(shoe,paving);
          const lifted=shoe.y-.046*size-sole;
          if (!seated && Math.abs(lifted)<.16) shoe.y-=lifted;
          detail.round('Ink',head,shoe,.064*size,.046*size,.115*size,yaw);
          closeContact(shoe,yaw,.091*size,.154*size,paving);
          rings(trousers,seated?[
            [side*.092,.080,foot-.010,.049,.052],[side*.102,.174,.263,.053,.061],
            [side*.105,.277,.283,.069,.068],[side*.103,.323,.200,.073,.065],
            [side*.090,.322,.102,.075,.071],[side*.079,.324,.009,.083,.070],
          ]:[
            [side*.092,.079,z,.053,.053],[side*.089,.137,z-.006,.056,.057],
            [side*.082,.27,z*.72,.059,.070],[side*.082,.344,z*.54+.023,.065,.071],
            [side*.080,.472,z*.20,.077,.076],[side*.077,.604,0,.082,.083],
            [side*.077,.624,0,.041,.051],
          ],raw);
        }
        const reaching=pose.hand && side===pose.side;
        const carrying=vendor&&side===1&&!pose.hand;
        const elbow=reaching?[side*.171,window?.841:.776,window?.126:.138]
          :vendor?[side*.173,carrying?.749:.719,carrying?.092:.066]
          :seated?[side*.162,.713,.132]:[side*.191,.761,-side*step*.50];
        const wrist=reaching?local(pose.hand)
          :vendor?[side*(carrying?.138:.139),carrying?.744:.683,carrying?.237:.149]
          :seated?[side*.118,.682,.283]:[side*.177,.648,-side*step*.83+.030];
        const mix=(a,b,t,r,d)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,
          a[2]+(b[2]-a[2])*t,r,d];
        const shoulder=[side*.133,.913,.006];
        rings(outfit,[mix(shoulder,elbow,-.08,.047,.052),mix(shoulder,elbow,.36,.066,.053),
          mix(shoulder,elbow,.82,.055,.053),[...elbow,.050,.051],
          mix(elbow,wrist,.43,.049,.043),mix(elbow,wrist,.80,.043,.038),
          mix(elbow,wrist,.91,.040,.035)]);
        rings(vendor?'Slate':outfit,[mix(elbow,wrist,.78,.044,.039),mix(elbow,wrist,.89,.045,.038),
          mix(elbow,wrist,.98,.040,.032)]);
        const [x,y,z2]=wrist;
        oval('FaceClay',at,x,y+.006,z2+.014,.035,.039,.034);
        oval('FaceClay',at,x+side*.021,y+.014,z2+.019,.015,.025,.019);
        if (reaching) {
          const shoulderHand=at(x,y,z2);
          const fingers=pose.hand.clone().addScaledVector(at(x,y,z2+.05).sub(shoulderHand).normalize(),.039*size);
          cane(detail,'FaceClay',[shoulderHand,shoulderHand.clone().lerp(fingers,.62).add(V(0,.009*size,0)),fingers],.012*size);
        }
        if (carrying) detail.round('Paper',ware.bowl,at(x+.001,y+.029,z2+.017),.40*size,.32*size,.40*size,yaw);
      }

      // Turn the face a little toward the patron, retaining the original stance.
      const turnHead=pose.head ?? (vendor?-.23:(stride<0?.13:-.09)), hc=Math.cos(turnHead), hs=Math.sin(turnHead);
      const face=(x,y,z)=>at(x*hc+z*hs,y,-x*hs+z*hc+.015);
      const skin='FaceClay', headYaw=yaw+turnHead;
      oval(skin,face,0,1.002,.008,.050,.066,.050,headYaw);
      rings(skin,[
        [0,1.022,.032,.019,.024],[.002,1.038,.027,.041,.045],
        [0,1.070,.013,.066,.066],[.003,1.105,.010,.079,.073],
        [0,1.139,.007,.075,.070],[0,1.171,.000,.065,.066],[0,1.199,-.003,.024,.030],
      ],face,18);
      oval('FaceClay',face,0,1.095,.079,.016,.023,.021,headYaw);
      oval(skin,face,0,1.082,.095,.022,.012,.013,headYaw);
      for (const ear of [-1,1]) {
        oval(skin,face,ear*.074,1.088,.009,.016,.025,.017,headYaw);
        oval('BoatAccent',face,ear*.083,1.086,.016,.007,.011,.008,headYaw);
        const trace=(key,pts,width)=>cane(detail,key,pts.map(p=>face(...p)),width*size);
        trace('Ink',[[ear*.020,1.125,.082],[ear*.034,1.130,.080],
          [ear*.053,1.125,.067]],.0034);
        trace('Ink',[[ear*.020,1.114,.083],[ear*.036,1.115,.077],
          [ear*.051,1.112,.068]],.0026);
      }
      cane(detail,'BoatAccent',[[ -.021,1.059,.073],[.002,1.061,.079],[.022,1.061,.072]]
        .map(p=>face(...p)),.0029*size);
      if (vendor) {
        rings('Ink',[[0,1.152,-.002,.081,.079],[0,1.173,-.008,.093,.085],
          [-.004,1.207,-.013,.085,.075],[-.007,1.225,-.015,.032,.034],
          [-.007,1.230,-.017,.004,.004]],face,16);
        oval('Slate',face,.004,1.160,.054,.079,.014,.068,headYaw);
        const apron=(u,t)=>at((u-.5)*(.245+.048*t),.827-.277*t,
          .139+.018*Math.sin(Math.PI*u)+.015*t+.006*Math.cos(u*16+t));
        fabric(detail,'ShoreStone',apron,7,8);
        seam('BoatLoad',[[-.136,.826,.146],[0,.816,.159],[.132,.822,.143]],.009);
        seam('Ink',[[-.139,.824,.143],[-.149,.827,.010],[-.126,.825,-.085]],.0065);
      } else {
        oval('Ink',face,0,1.174,-.003,.081,.057,.081,headYaw);
        if (stride<0) {
          oval('Ink',face,.009,1.146,-.079,.052,.048,.050,headYaw);
          seam('BoatLoad',[[.125,.902,.057],[.077,.830,.121],[-.113,.649,.108]],.011);
          oval('BoatLoad',at,-.132,.616,.103,.077,.070,.040);
        }
      }
      for (const side of [-1,1]) seam('ShoreStone',[[side*.063,.976,.061],
        [side*.067,.940,.099],[side*.022,.914,.116]],.010);
      seam('Ink',[[.017,.914,.116],[.048,.842,.118],[.058,.748,.103],[.060,.574,.105]],.0055);
      for (const y of [.894,.849,.783]) seam('BoatLoad',[[.035,y,.115],[.065,y-.003,.112]],.005);
    }

    function shoreVignettes() {
      const body=new THREE.SphereGeometry(1,14,9);
      const normal=V(0,-1,0), ray=new THREE.Raycaster();
      const frame=(x,z,yaw,base)=> {
        const c=Math.cos(yaw),s=Math.sin(yaw);
        return (u,y,d)=>V(x+c*u+s*d,base+y,z-s*u+c*d);
      };
      function stone(detail,x,z,w,d,yaw,phase) {
        if (!onLand(x,z) || cityGround.occupied(x,z,.14)) return;
        const c=Math.cos(yaw),s=Math.sin(yaw), group=[];
        const ring=[[-.44,-.37],[.25,-.52],[.48,-.14],[.44,.34],[.18,.48],[-.46,.31]];
        const center=V(x,0,z);
        center.y=floor(center)+.037;
        const rim=ring.map(([u,v],i)=>{
          const swell=1+.10*Math.sin(i*2.36+phase), dx=u*w*swell,dz=v*d;
          const p=V(x+c*dx+s*dz,0,z-s*dx+c*dz);
          p.y=floor(p)+.027+.006*Math.sin(i*1.87+phase);
          return p;
        });
        if (!rim.every(p=>onLand(p.x,p.z) && !cityGround.occupied(p.x,p.z,.04))) return;
        for (let i=0;i<rim.length;i++) {
          const a=rim[i], b=rim[(i+1)%rim.length];
          group.push(...center.toArray(),...b.toArray(),...a.toArray());
          const toe=a.clone().lerp(center,.065), end=b.clone().lerp(center,.065);
          toe.y-=.046; end.y-=.046;
          group.push(...a.toArray(),...b.toArray(),...toe.toArray(),...toe.toArray(),...b.toArray(),...end.toArray());
        }
        const shape=new THREE.BufferGeometry();
        shape.setAttribute('position',new THREE.Float32BufferAttribute(group,3));
        shape.computeVertexNormals();
        detail.surface(phase%3===0?'Masonry':'ShoreStone',shape);
      }
      const seat=scene.getObjectByName('武昌滨水分节石凳');
      if (seat) {
        const x=-83.76,z=92.25,yaw=-1.06;
        ray.set(V(x,4,z),normal);
        const y=ray.intersectObject(seat)[0]?.point.y;
        if (y) {
          const detail=blocks('武昌两桥滨水岸线','武昌石凳上看江人');
          const at=frame(x,z,yaw,y);
          for (const side of [-1,1]) {
            const hip=at(side*.095,.073,-.045), knee=at(side*.128,.028,.319);
            const ankle=at(side*.148,-.275,.377);
            cane(detail,'Ink',[hip,hip.clone().lerp(knee,.58).add(V(0,.017,0)),knee],.078);
            cane(detail,'Ink',[knee,knee.clone().lerp(ankle,.54),ankle],.063);
            detail.round('Ink',body,at(side*.148,-.364,.432),.070,.062,.125,yaw);
            const hand=at(side*.092,.104,.313);
            cane(detail,'BoatGlass',[at(side*.149,.37,-.015),at(side*.198,.19,.205),hand],.056);
            detail.round('FaceClay',body,hand,.039,.034,.064,yaw);
          }
          detail.round('BoatGlass',body,at(0,.243,-.063),.205,.255,.137,yaw);
          detail.round('Slate',body,at(0,.071,-.062),.199,.086,.150,yaw);
          detail.round('FaceClay',body,at(0,.493,-.023),.047,.075,.051,yaw);
          detail.round('FaceClay',body,at(0,.602,.009),.104,.124,.098,yaw);
          detail.round('Ink',body,at(0,.657,-.016),.106,.077,.102,yaw);
          detail.round('Ink',body,at(0,.594,-.097),.086,.093,.036,yaw);
          const basket=frame(x+.02,z+1.13,yaw,y+.005);
          const bowl=new THREE.LatheGeometry([[.12,.006],[.126,.03],[.16,.172],[.172,.185]]
            .map(([u,v])=>new THREE.Vector2(u,v)),14);
          detail.round('BoatLoad',bowl,basket(0,0,0),1,1,1,yaw);
          for (const r of [.04,.087,.135,.184]) {
            const ring=Array.from({length:19},(_,i)=>{
              const a=i*Math.PI/9, k=.122+r*.255;
              return basket(k*Math.cos(a),r,k*Math.sin(a));
            });
            cane(detail,'BoatLoad',ring,.0095);
          }
          cane(detail,'BoatLoad',[basket(-.163,.172,0),basket(-.11,.277,.02),basket(0,.31,.015),
            basket(.11,.276,0),basket(.163,.173,0)],.014);
          detail.show();

          const steps=blocks('武昌两桥滨水岸线','武昌观江凳后 · 路脚碎石');
          for (const [i,[sx,sz,w,d]] of [[-82.75,92.37,.51,.39],[-82.29,92.14,.41,.29],
            [-81.95,92.29,.27,.21],[-83.02,94.57,.28,.28],[-82.65,94.48,.37,.24]].entries()) {
            stone(steps,sx,sz,w,d,i*.51,i);
          }
          steps.show();
        }
      }
      const x=-201.0,z=28.9,yaw=1.01;
      if (onLand(x,z) && !cityGround.occupied(x,z,.33)) {
        const p=V(x,0,z), y=floor(p), at=frame(x,z,yaw,y);
        const detail=blocks('汉阳两桥滨水岸线','汉阳岸上收缆人');
        cane(detail,'Ink',[at(-.13,.40,-.104),at(-.16,.14,.183),at(-.15,.065,.08)],.084);
        cane(detail,'Ink',[at(.109,.39,-.109),at(.134,.34,.226),at(.17,.069,.257)],.077);
        detail.round('Ink',body,at(-.15,.065,.013),.072,.052,.134,yaw);
        detail.round('Ink',body,at(.17,.052,.285),.075,.049,.117,yaw);
        // The work jacket drapes off the hunched shoulders and over the bent hips.
        const jacket=(u,t)=>{
          const a=u*2*Math.PI, shoulder=Math.sin(Math.PI*t), fold=Math.cos(5*a+.4*t);
          const width=.145+.063*shoulder+.010*fold;
          const depth=.099+.041*shoulder+.008*fold;
          return at(width*Math.cos(a),.355+.398*t+.025*Math.sin(a)*t,
            -.084+.148*t+depth*Math.sin(a));
        };
        fabric(detail,'BoatGlass',jacket,24,9);
        for (const t of [.055,.085]) cane(detail,'Slate',Array.from({length:17},(_,i)=>jacket(i/16,t)),.010);
        cane(detail,'BoatGlass',[at(-.149,.633,.007),at(-.21,.44,.20),at(-.137,.239,.326)],.057);
        cane(detail,'BoatGlass',[at(.14,.65,.022),at(.19,.443,.203),at(.095,.250,.461)],.054);
        detail.round('FaceClay',body,at(-.137,.239,.326),.045,.044,.06,yaw);
        detail.round('FaceClay',body,at(.095,.250,.461),.046,.039,.060,yaw);
        detail.round('FaceClay',body,at(0,.747,.065),.048,.066,.048,yaw);
        detail.round('FaceClay',body,at(0,.828,.107),.104,.112,.099,yaw);
        detail.round('Ink',body,at(0,.884,.078),.109,.065,.105,yaw);
        // A shallow woven rain hat tilts with the worker's head as he feeds the line.
        const brim=(u,t)=>{
          const a=u*2*Math.PI, r=.018+.191*t;
          return at(Math.cos(a)*r,.994-.106*t-.040*Math.sin(a)*t,
            .090+Math.sin(a)*r*.93);
        };
        fabric(detail,'BoatCanopy',brim,28,5);
        cane(detail,'BoatLoad',Array.from({length:25},(_,i)=>brim(i/24,1)),.009);
        for (let rib=0;rib<8;rib++) cane(detail,'BoatLoad',[brim(rib/8,.22),brim(rib/8,.59),brim(rib/8,.965)],.0035);
        for(const side of [-1,1]) {
          const wrist=side<0?at(-.137,.251,.31):at(.102,.260,.449);
          detail.round('Slate',body,wrist,.061,.031,.040,yaw);
        }
        const coil=Array.from({length:49},(_,i)=>{
          const t=i/48,a=t*Math.PI*5.6,r=.08+.255*t;
          return at(r*Math.cos(a),.024+.018*(1-t),.66+r*Math.sin(a)*.78);
        });
        const last=coil.at(-1);
        coil.push(last.clone().lerp(at(.095,.250,.461),.46).add(V(0,-.027,.031)),at(.095,.25,.461));
        cane(detail,'BoatLoad',coil,.016);
        detail.show();
        groundContacts.push({x,z,rx:.39,rz:.40,c:Math.cos(yaw),s:Math.sin(yaw),tree:false});

        // The worn line curves into the riverside walk. Its feathered edges leave patches of paper.
        const path=new THREE.CatmullRomCurve3([V(-202,0,29.4),V(-200.3,0,29.85),V(-197.4,0,28.7),
          V(-195.15,0,27.66),V(-194.15,0,27.98),V(-192.9,0,28.79)]);
        const soil=[], cover=[], indices=[];
        for (let i=0;i<=18;i++){
          const t=i/18, p=path.getPointAt(t), tangent=path.getTangentAt(t);
          const half=.45+.27*Math.sin(5*t+.8)**2;
          for (const [j,lateral] of [-1,-.53,.06,.48,1].entries()){
            const q=p.clone().add(V(-tangent.z,0,tangent.x).multiplyScalar(lateral*half));
            q.y=floor(q)+.018;
            soil.push(...q.toArray());
            const edge=Math.max(0,1-Math.abs(lateral)**1.5);
            cover.push(edge*(.53+.18*Math.cos(9*t))*Math.min(1,i/2,(18-i)/2));
            if (i && j){const d=i*5+j;indices.push(d-6,d-1,d-5,d-5,d-1,d);}
          }
        }
        const footing=new THREE.BufferGeometry();
        footing.setAttribute('position',new THREE.Float32BufferAttribute(soil,3));
        footing.setAttribute('vergeCover',new THREE.Float32BufferAttribute(cover,1));
        footing.setIndex(indices);footing.computeVertexNormals();
        const bed=vergeWash(.40,['#83816e','#c0b8a1']);
        bed.side=THREE.DoubleSide;
        add('汉阳两桥滨水岸线','汉阳收缆处 · 通江湿土','WetBank',new THREE.Mesh(footing,bed));
        const ledge=blocks('汉阳两桥滨水岸线','汉阳收缆处 · 断石脚径');
        for (const [i,[sx,sz,w,d]] of [[-201.42,29.72,.98,.44],[-200.62,29.85,.55,.34],
          [-199.92,29.63,.62,.41],[-199.16,29.38,.65,.39],[-198.24,28.95,.60,.33],[-197.48,28.71,.45,.25],
          [-197.05,28.99,.25,.18],[-196.59,28.42,.33,.26],[-196.45,28.12,.27,.16],
          [-195.86,27.88,.28,.20],[-194.98,27.57,.34,.22],[-194.34,27.92,.45,.31],
          [-194.04,28.21,.20,.16],[-193.64,28.41,.38,.23]].entries()) {
          stone(ledge,sx,sz,w,d,i*.38,i);
        }
        ledge.show();
      }
    }
    shoreVignettes();

    function shapedMerchandise() {
      const turn=profile=>{
        const geometry=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),12);
        const points=geometry.attributes.position, faces=geometry.index.array, indices=[];
        const a=V(0,0,0), b=V(0,0,0), c=V(0,0,0);
        for (let i=0;i<faces.length;i+=3) {
          a.fromBufferAttribute(points,faces[i]);
          b.fromBufferAttribute(points,faces[i+1]).sub(a);
          c.fromBufferAttribute(points,faces[i+2]).sub(a);
          if (b.cross(c).lengthSq()>1e-14) indices.push(faces[i],faces[i+1],faces[i+2]);
        }
        geometry.setIndex(indices);
        return geometry;
      };
      return {
        jar:turn([[0,0],[.076,0],[.107,.03],[.132,.095],[.118,.19],[.094,.211],[.099,.227],
          [.082,.227],[.078,.196],[.086,.152],[0,.15]]),
        bowl:turn([[0,0],[.077,0],[.091,.034],[.164,.157],[.162,.174],[.149,.171],[.125,.108],[0,.081]]),
        tea:turn([[0,0],[.061,0],[.091,.019],[.115,.061],[.102,.103],[.070,.131],
          [.062,.141],[.022,.145],[.012,.162],[0,.165]]),
        stool:turn([[0,0],[.125,0],[.142,.022],[.134,.036],[0,.036]]),
      };
    }
    const ware=shapedMerchandise();
    function cane(detail,key,points,radius) {
      const curve=new THREE.CatmullRomCurve3(points);
      detail.surface(key,new THREE.TubeGeometry(curve,Math.max(8,points.length*3),radius,5,false));
    }
    function fabric(detail,key,point,columns,rows) {
      const vertices=[], indices=[];
      for (let j=0;j<=rows;j++) for (let i=0;i<=columns;i++) {
        vertices.push(...point(i/columns,j/rows).toArray());
        if (!i || !j) continue;
        const d=j*(columns+1)+i, c=d-1, b=d-columns-1, a=b-1;
        indices.push(a,c,b,b,c,d);
      }
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      geometry.setIndex(indices); geometry.computeVertexNormals();
      detail.surface(key,geometry);
    }
    function courtyardPlant(detail,front,across,depth,size,key) {
      const {point,yaw}=front;
      detail.round(key,ware.jar,point(across,depth,-.011),size,size,size,yaw);
      for (const [u,d,y] of [[-.12,.035,.53],[.15,-.03,.68],[.03,.13,.51]]) {
        const stem=(t)=>point(across+u*size*t,depth+d*size*t,(.18+(y-.18)*t)*size);
        cane(detail,'BoatLoad',[stem(0),stem(.48),stem(.78),stem(1)],.010*size);
        for (const [t,side] of [[.46,-1],[.64,1],[.82,-1],[.95,1]]) {
          const root=stem(t);
          const tip=root.clone().addScaledVector(V(-.57,.15,1).normalize(),.145*size*side);
          const blade=V(.87,0,.49).normalize();
          fabric(detail,'Reeds',(u,t)=>{
            const curl=Math.sin(Math.PI*t);
            return root.clone().lerp(tip,t).add(V(0,.039*size*curl,0))
              .addScaledVector(blade,(u-.5)*size*(.002+.056*curl));
          },2,5);
        }
      }
    }
    function teaDetails(group,front) {
      const {point,yaw}=front, detail=blocks(group,'汉阳茶招、提梁壶与竹凳');
      const banner=(u,v,ink=0)=>point(1.098+.088*Math.sin(u*5.1+v*4.4)*v+ink,
        1.43+(.5-u)*.55+.10*v*v,1.68-v*.67+.037*Math.sin(u*4.7)*v*v);
      colors.Paper.side=THREE.DoubleSide;
      colors.Ink.side=THREE.DoubleSide;
      fabric(detail,'Paper',(u,v)=>banner(u,v),12,12);
      cane(detail,'BoatLoad',[point(1.025,1.09,1.74),banner(.98,.01),banner(.50,0),banner(.02,.01)],.018);
      // Tea, set as individually tapered brush strokes on the curved cloth.
      const strokes=[
        [[.18,.245],[.43,.232],[.78,.218]], [[.348,.155],[.371,.301]], [[.656,.148],[.623,.300]],
        [[.505,.335],[.382,.458],[.176,.567]], [[.507,.338],[.641,.444],[.821,.519]],
        [[.349,.555],[.637,.542]], [[.222,.665],[.51,.651],[.770,.636]],
        [[.503,.559],[.510,.759],[.479,.852],[.427,.812]],
        [[.354,.716],[.254,.824]], [[.626,.709],[.724,.800]],
      ];
      for (const [i,stroke] of strokes.entries()) {
        const width=i===3||i===4?.042:.031;
        const curve=new THREE.CatmullRomCurve3(stroke.map(([u,v])=>V(u,v,0)));
        fabric(detail,'Ink',(u,v)=>{
          const p=curve.getPoint(v), along=curve.getTangent(v), taper=.31+.69*Math.sin(Math.PI*v)**.52;
          return banner(p.x+along.y*width*taper*(u-.5),p.y-along.x*width*taper*(u-.5),.005);
        },1,8);
      }
      const kettle=(u,d,h)=>point(u-.39,d+.12,h);
      detail.round('BoatAccent',ware.tea,kettle(.05,.94,.712),1.15,1.13,1.15,yaw);
      cane(detail,'Ink',[kettle(-.049,.94,.828),kettle(-.060,.94,.931),kettle(.054,.94,.973),
        kettle(.15,.94,.923),kettle(.151,.94,.830)],.014);
      cane(detail,'BoatAccent',[kettle(.13,.95,.773),kettle(.197,.957,.804),kettle(.237,.969,.867)],.023);
      const stoolU=-1.63,stoolD=2.21;
      detail.round('BoatLoad',ware.stool,point(stoolU,stoolD,.29),1.06,1,1.06,yaw);
      for (const [u,d] of [[-.07,-.076],[.086,-.064],[0,.094]]) {
        cane(detail,'BoatLoad',[point(stoolU+u*1.37,stoolD+d*1.37,-.015),
          point(stoolU+u*1.17,stoolD+d*1.16,.139),point(stoolU+u,stoolD+d,.301)],.022);
      }
      detail.round('BoatAccent',ware.jar,point(1.54,.30,-.013),1.43,1.24,1.43,yaw);
      courtyardPlant(detail,front,1.83,.40,.90,'ShoreStone');
      const foot=blocks(group,'汉阳茶棚缸盆与墙脚承石');
      stoneFoot(foot,front,[[.32,1.44,.032],[-.64,-.08,.025]]);
      foot.box('BankStone',point(1.54,.30,.023),.42,.086,.37,yaw);
      foot.box('Masonry',point(1.83,.40,.019),.36,.073,.33,yaw);
      foot.show();
      detail.show();
    }
    function paintedDoorGoods(group,front) {
      const {point,yaw}=front, detail=blocks(group,'武昌里分靛布、竹编与墙脚盆栽');
      const cloth=(u,v)=>point(.74+u*.34+.034*v, .193+.066*Math.sin(12*u+3*v)*v,1.52-v*.55);
      fabric(detail,'BoatGlass',cloth,10,12);
      cane(detail,'Ink',[point(.70,.18,1.537),point(.92,.19,1.536),point(1.13,.18,1.533)],.016);
      cane(detail,'BoatLoad',[point(.72,.01,1.53),point(.72,.09,1.54),point(.72,.19,1.54)],.011);
      for (const [u,y] of [[.22,.81],[.71,.80]]) {
        cane(detail,'Paper',[cloth(u,y),cloth(u+.024,y+.08),cloth(u+.012,y+.15)],.0038);
      }
      const near=1.16,d=.38;
      detail.round('BoatLoad',ware.bowl,point(near,d,-.017),1.10,1.13,1.10,yaw);
      for (const rad of [.10,.132,.164]) {
        const ring=Array.from({length:13},(_,i)=>{
          const angle=i/12*Math.PI*2;
          return point(near+rad*Math.cos(angle),d+rad*Math.sin(angle),.024+(rad-.10)*2.3);
        });
        cane(detail,'Paper',ring,.009);
      }
      courtyardPlant(detail,front,1.50,.27,.98,'BoatAccent');
      courtyardPlant(detail,front,1.78,.34,.73,'ShoreStone');
      detail.round('ShoreStone',ware.jar,point(-1.21,.24,-.012),.86,.77,.86,yaw);
      // A small diamond lattice and a few abraded streaks on the lower paint.
      for (const anchor of [1.19,1.59]) for (const sign of [-1,1]) {
        detail.beam('BoatLoad',point(anchor-.105,.071,1.10+sign*.087),
          point(anchor+.105,.071,1.10-sign*.087),.017);
      }
      for (const [u,y,l] of [[-.23,.276,.095],[-.18,.314,.070],[.26,.269,.091],[.34,.347,.071]]) {
        cane(detail,'BoatLoad',[point(u,.067,y),point(u+.009,.070,y+l*.62),
          point(u+.005,.068,y+l)],.0048);
      }
      detail.show();
    }

    // A tea counter sits against a real end wall, with a clear apron running into the side lane.
    const west=laneFront(-218,29,true);
    if (west) {
      const group='汉阳滨水街巷生活', {point,yaw}=west;
      laneApron(group,'汉阳茶案前埕接支巷',west,1.8,1.56);
      const counter=blocks(group,'汉阳贴墙竹木单坡茶寮');
      const teaPaving=scene.getObjectByName('汉阳茶案前埕接支巷');
      const footing=blocks(group,'汉阳茶棚窄石柱础');
      for (const u of [-1.02,1.02]) {
        const p=point(u*.987,1.59);
        const lift=supportAt(p,teaPaving)-p.y;
        footing.box('BankStone',point(u*.987,1.59,lift+.022),.174,.059,.167,yaw);
        footing.box('ShoreStone',point(u*.987,1.59,lift+.052),.143,.018,.139,yaw);
        closeContact(p,yaw,.151,.146,teaPaving);
      }
      footing.show();
      const roof=(u,v)=>point((u-.5)*2.34,.041+1.77*v,
        2.058-.401*v-.047*Math.sin(Math.PI*v)+.014*Math.cos(u*6.7+v*2.1));
      for (const u of [-1.02,1.02]) {
        cane(counter,'BoatLoad',[point(u*.987,1.59,-.012),point(u,1.61,.84),point(u*.999,1.60,1.70)],.050);
        counter.beam('Ink',point(u,.045,1.995),point(u,.045,1.744),.093);
        cane(counter,'BoatLoad',[point(u,1.59,1.17),point(u,1.47,1.43),point(u,.78,1.819)],.032);
        for (const d of [.66,1.25]) counter.box('Ink',point(u*.66,d,.31),.095,.60,.10,yaw);
      }
      counter.box('Ink',point(0,.072,1.994),2.21,.117,.14,yaw);
      for (const u of [-1.015,-.51,-.02,.47,1.02]) {
        const a=.5+u/2.34;
        cane(counter,'BoatLoad',[roof(a,.02).add(V(0,-.054,0)),roof(a,.52).add(V(0,-.055,0)),
          roof(a,1).add(V(0,-.034,0))],.027);
      }
      cane(counter,'Ink',[roof(.015,.94).add(V(0,-.043,0)),roof(.52,.95).add(V(0,-.045,0)),
        roof(.989,.962).add(V(0,-.044,0))],.038);
      colors.Paper.side=THREE.DoubleSide;
      fabric(counter,'BoatCanopy',roof,18,14);
      for (const at of [.185,.425,.674,.834]) {
        cane(counter,'BoatLoad',[roof(at,.018),roof(at,.50).add(V(0,.008,0)),
          roof(at,.98).add(V(0,.006,0))],.008);
      }
      fabric(counter,'BoatLoad',(u,v)=>roof(u,1).add(V(0,
        -.158*v-.062*Math.abs(Math.sin(u*15.7))*v*v,0)).addScaledVector(west.forward,.039*v*Math.sin(u*25.1)),24,8);
      counter.box('BoatAccent',point(0,.94,.65),1.65,.13,.76,yaw);
      counter.round('ShoreStone',ware.jar,point(-.72,.44,-.013),1.62,1.4,1.62,yaw);
      counter.round('Ink',ware.stool,point(-.72,.44,.303),1.26,.94,1.26,yaw);
      const second={point:(u,d,h)=>point(u-1.76,d+.72,h),yaw};
      counter.round('BoatLoad',ware.stool,second.point(0,0,.35),1.12,1,1.12,yaw);
      for (const [u,d] of [[-.089,-.057],[.077,-.080],[.019,.102]]) {
        cane(counter,'BoatLoad',[second.point(u*1.33,d*1.33,-.014),second.point(u*1.18,d*1.14,.16),
          second.point(u,d,.355)],.023);
      }
      for (const [u,d,size] of [[-.58,.82,.075],[-.03,1.13,.073],[.36,.84,.112],[.61,.86,.071]]) {
        counter.round(u>0?'Slate':'Paper',coat,point(u,d,.725+size*.45),size,size*.9,size,yaw);
      }
      counter.box('Masonry',point(1.33,.38,.21),.42,.39,.42,yaw);
      doorway(counter,west,-1.25,.55,1.25);
      latticeWindow(counter,west,.84,.51,.47);
      counter.show();
      teaDetails(group,west);
      const life=blocks(group,'汉阳茶案旁的店主');
      const bowl=west.point(-1.13,2.03,.748);
      person(life,west,-.63,1.91,-1.04,1.04,'Slate',.20,
        {hand:west.point(-1.072,2.025,.753),side:-1,head:-.19});
      life.round('Paper',ware.bowl,bowl,.49,.39,.49,yaw);
      life.round('BoatLoad',ware.stool,bowl.clone().add(V(0,.054,0)),.33,.09,.33,yaw);
      life.show();
      const patron=blocks(group,'汉阳竹凳上的接茶客人');
      person(patron,west,-1.63,2.21,1.04,.94,'BoatAccent',.35,
        {mode:'seated',hand:west.point(-1.196,2.043,.751),side:1,head:.16});
      patron.show();
    }

    function enclosingCourt(group,name,runs,gate) {
      const detail=blocks(group,name);
      const segment=(a,b,height,key='Masonry')=>{
        const p=a.clone().lerp(b,.5), rise=floor(p), span=Math.hypot(b.x-a.x,b.z-a.z);
        const yaw=Math.atan2(a.z-b.z,b.x-a.x);
        detail.box('BankStone',p.clone().setY(rise+.125),span+.045,.28,.284,yaw);
        detail.box(key,p.clone().setY(rise+height*.5+.008),span+.028,height,.227,yaw);
        detail.box('ShoreStone',p.clone().setY(rise+height+.028),span+.065,.067,.303,yaw);
      };
      for (const {line,heights,material} of runs) {
        for (let i=1;i<line.length;i++) segment(line[i-1],line[i],heights[i-1],material);
      }
      if (gate) {
        const [a,b]=gate, mid=a.clone().lerp(b,.5), y=floor(mid), width=a.distanceTo(b);
        const yaw=Math.atan2(a.z-b.z,b.x-a.x);
        for (const p of gate) {
          const h=floor(p);
          detail.box('BankStone',p.clone().setY(h+.92),.225,1.86,.273,yaw);
          detail.box('ShoreStone',p.clone().setY(h+.087),.29,.190,.344,yaw);
        }
        detail.box('Ink',mid.clone().setY(y+1.823),width+.29,.127,.268,yaw);
        detail.box('ShoreStone',mid.clone().setY(y+1.931),width+.416,.113,.433,yaw);
        for (let i=0;i<10;i++) {
          const station=a.clone().lerp(b,(i+.5)/10);
          detail.round('Slate',dripTile,station.setY(y+2.005+.018*Math.sin(i*.89)),.129,.098,.35,yaw);
        }
      }
      detail.show();
    }
    function kitchenWing(group,name,front,anchor,depth,sideVent=false) {
      const {point,yaw}=front, wing=blocks(group,name);
      const p=(u,d,h)=>point(anchor+u,d,h);
      // The rear ties into the existing house; a narrow unglazed service opening faces the court.
      wing.box('BankStone',p(0,depth*.50,.058),1.54,.151,depth+.075,yaw);
      for (const side of [-1,1]) {
        if (sideVent && side<0) {
          const u=-.715;
          wing.box('Masonry',p(u,depth*.49,.370),.128,.68,depth,yaw);
          wing.box('Masonry',p(u,depth*.49,1.135),.128,.267,depth,yaw);
          for (const d of [depth*.135,depth*.839]) wing.box('Masonry',p(u,d,.847),.128,.442,depth*.305,yaw);
          wing.box('BoatAccent',p(u-.019,depth*.48,.721),.19,.061,depth*.43,yaw);
          for (let row=0;row<3;row++)
            wing.box('Ink',p(u-.004,depth*.48,.808+row*.071),.055,.028,depth*.376,yaw);
        } else wing.box('Masonry',p(side*.715,depth*.49,.648),.128,1.24,depth,yaw);
        wing.box('BankStone',p(side*.494,depth,.691),.442,1.29,.127,yaw);
      }
      wing.box('Masonry',p(0,depth,.32),.567,.608,.141,yaw);
      wing.box('BoatAccent',p(0,depth+.014,.661),.755,.103,.265,yaw);
      wing.box('Masonry',p(0,depth,1.168),.568,.34,.126,yaw);
      wing.box('Ink',p(.01,depth-.18,.843),.52,.349,.035,yaw);
      for (const side of [-1,1]) wing.box('BoatAccent',p(side*.19,depth+.025,.883),.038,.342,.053,yaw);
      const canopy=(u,v)=>p((u-.5)*1.71,-.034+(depth+.19)*v,1.652-.279*v+.014*Math.sin(u*6.3));
      const planeX=canopy(1,0).sub(canopy(0,0)), planeZ=canopy(0,1).sub(canopy(0,0));
      const upward=planeZ.cross(planeX).y>0;
      fabric(wing,'ShoreStone',(u,v)=>canopy(upward?u:1-u,v),12,8);
      for (let i=0;i<10;i++) {
        const u=(i+.5)*.10;
        cane(wing,'Slate',[canopy(u,0),canopy(u,.47).add(V(0,.013,0)),
          canopy(u,.91).add(V(0,.012,0))],.026);
      }
      wing.box('Ink',p(0,depth+.096,1.34),1.658,.077,.118,yaw);
      wing.round('ShoreStone',ware.jar,p(-.51,depth+.18,.01),1.58,1.47,1.58,yaw);
      if (sideVent) {
        const plinth=blocks(group,name+'石脚与砖隅');
        stoneFoot(plinth,front,[[anchor-.75,anchor+.75,depth+.055]]);
        for (const side of [-1,1]) {
          for (let i=0;i<7;i++) {
            const y=.22+i*.145;
            plinth.box(i%4===2?'Slate':'Masonry',p(side*(.687-.016*(i%2)),depth+.064,y),
              i%2?.228:.157,.134,.096,yaw);
          }
          plinth.box('BankStone',p(side*.711,depth*.50,.107),.150,.196,depth+.035,yaw);
        }
        plinth.box('ShoreStone',p(-.51,depth+.18,.013),.365,.057,.31,yaw);
        plinth.show();
      }
      wing.show();
    }

    function hanyangCourtyards() {
      const group='汉阳茶棚后街坊';
      const street=cityGround.riverfrontPaths.filter(path=>path.name==='汉阳滨水通街支巷');
      function courtyardFront(x,z,endWall,opposite,across) {
        const face=laneFront(x,z,endWall);
        if (!face) return null;
        const {tangent,yaw}=face;
        const origin=opposite ? V(2*x-face.origin.x,0,2*z-face.origin.z) : face.origin.clone();
        const forward=face.forward.clone().multiplyScalar(opposite ? -1 : 1);
        origin.addScaledVector(tangent,across);
        const point=(u,d,h=0)=>{
          const p=origin.clone().addScaledVector(tangent,u).addScaledVector(forward,d);
          return p.setY(floor(p)+h);
        };
        return {origin,forward,tangent,point,yaw};
      }
      function courtWalk(front,name,bends) {
        const controls=[front.point(0,.12),...bends.map(([x,z])=>V(x,0,z))];
        const mouth=streetLip(street,controls.at(-1));
        if (!mouth) return false;
        controls.push(mouth);
        const length=new THREE.CatmullRomCurve3(controls.map(p=>p.clone().setY(0))).getLength();
        paveAlley(group,name,controls,Math.ceil(length/.53),
          t=>THREE.MathUtils.lerp(.68,.49,THREE.MathUtils.smoothstep(t,.18,.86)),
          {routeName:'汉阳后巷步道',liftAt:t=>THREE.MathUtils.lerp(.097,.071,t)});
        return true;
      }
      function householdCourt(front,use) {
        const {point,yaw}=front;
        const drying=use==='drying';
        const name=drying?'汉阳茶棚后院透气筛廊':'汉阳后排雨檐与接水小院';
        const details=blocks(group,name), depth=drying?1.89:1.35;
        const roof=(u,v)=>point(-.96-u*1.74,.025+depth*v,1.869-.24*v+.026*Math.cos(u*5.2));
        const row=roof(1,0).sub(roof(0,0)), slope=roof(0,1).sub(roof(0,0));
        const faceUp=slope.cross(row).y>0;
        fabric(details,'ShoreStone',(u,v)=>roof(faceUp?u:1-u,v),18,9);
        for (let i=0;i<11;i++) {
          const u=.045+i*.09, top=roof(u,1);
          details.round('Slate',dripTile,top,.147,.079,.14,yaw);
          cane(details,'ShoreStone',[roof(u,.07).add(V(0,.013,0)),roof(u,.54).add(V(0,.013,0)),
            roof(u,.91).add(V(0,.011,0))],.025);
        }
        details.box('Ink',point(-1.831,.073,1.815),1.72,.11,.147,yaw);
        for (const side of [-1.038,-2.59]) {
          const post=point(side,depth-.107,0);
        closeContact(post,yaw,.161,.168,undefined,.096);
          details.box('ShoreStone',post.clone().add(V(0,.075,0)),.143,.150,.155,yaw);
          cane(details,'BoatAccent',[post.clone().add(V(0,.113,0)),post.clone().add(V(0,1.27,0)),
            point(side,depth-.107,1.64)],.047);
          cane(details,'BoatAccent',[point(side,depth-.107,1.28),point(side,depth*.70,1.52),
            point(side,depth*.46,1.68)],.027);
        }
        details.box('BoatAccent',point(-1.82,depth-.08,1.631),1.76,.081,.108,yaw);
        const bed=depth*.53;
        details.box('ShoreStone',point(-1.82,bed,.035),1.63,.119,depth*.98,yaw);
        for (const [i,x] of [-2.33,-1.82,-1.31].entries()) {
          details.box(i===1?'Masonry':'BankStone',point(x,bed-.16,.088),.48,.035,depth*.57,yaw);
          details.box('Masonry',point(x+.015,bed+.48,.083),.48,.033,.355,yaw);
        }
        details.box('Masonry',point(-1.11,depth+.15,.075),.46,.15,.63,yaw);
        details.box('ShoreStone',point(-1.18,depth-.032,.207),.37,.117,.43,yaw);
        // A short return screens the working side without crossing either approach.
        details.box('Masonry',point(-2.64,depth+.125,.253),.24,.508,.572,yaw);
        details.box('Slate',point(-2.64,depth+.112,.517),.27,.047,.612,yaw);
        for (const h of [.35,.58]) cane(details,'BoatLoad',[point(-2.64,.58,h),point(-2.65,depth*.65,h-.021),
          point(-2.64,depth-.09,h)],.016);
        for (let i=0;i<7;i++) {
          const d=.60+i*(depth-.69)/6, h=.61+(i%3)*.028;
          cane(details,'BoatLoad',[point(-2.647,d,.131),point(-2.637,d+.021,h)],.020);
        }
        if (drying) {
          const tray=(angle,r)=>point(-1.73+r*Math.cos(angle),1.03,1.162+r*Math.sin(angle));
          for (const r of [.28,.278,.241]) {
            const rim=Array.from({length:17},(_,i)=>tray(i*Math.PI/8,r));
            cane(details,r===.241?'BoatLoad':'Paper',rim,.014);
          }
          for (let j=-3;j<=3;j++) {
            const y=j*.058, half=Math.sqrt(.225**2-y*y);
            cane(details,'BoatLoad',[point(-1.73-half,1.03,1.162+y),point(-1.73,1.016,1.163+y),
              point(-1.73+half,1.03,1.162+y)],.007);
          }
          for (const u of [-1.91,-1.53]) cane(details,'BoatLoad',
            [point(u,1.03,1.33),point(u,1.03,1.59)],.010);
          details.round('BoatAccent',ware.jar,point(-2.10,.66,.104),1.91,1.85,1.92,yaw);
          const pads=blocks(group,'汉阳筛廊石础与陶缸承板');
          stoneFoot(pads,front,[[-2.63,-.96,.039]]);
          pads.box('BankStone',point(-2.10,.66,.099),.51,.041,.49,yaw);
          pads.box('Masonry',point(-2.10,.66,.049),.47,.071,.45,yaw);
          for (const u of [-1.038,-2.59]) pads.box('Masonry',point(u,depth-.107,.027),.219,.083,.226,yaw);
          closeContact(point(-2.10,.66),yaw,.305,.27,undefined,.092);
          pads.show();
          // The opposite wall's return is also a seat, tied into its stone foot rather than freestanding.
          const wallSeat=V(-228.27,0,26.69), stoneYaw=Math.atan2(1.67,.68), ground=floor(wallSeat);
          details.box('BankStone',wallSeat.clone().setY(ground+.119),1.31,.24,.47,stoneYaw);
          details.box('Masonry',wallSeat.clone().setY(ground+.273),1.39,.089,.554,stoneYaw);
          const outerEdge=V(-228.04,0,26.76).setY(ground+.051);
          details.box('ShoreStone',outerEdge,1.46,.102,.48,stoneYaw);
        } else {
          const basin=point(-2.04,.82,.099);
          closeContact(basin,yaw,.27,.23,undefined,.090);
          details.round('ShoreStone',ware.jar,basin,1.75,1.42,1.75,yaw);
          cane(details,'Ink',[point(-2.24,1.27,1.653),point(-2.235,1.26,1.13),
            point(-2.245,1.19,.65),point(-2.106,.88,.40)],.015);
          courtyardPlant(details,front,-1.52,.72,.94,'BoatAccent');
        }
        details.show();
      }
      const yards=[
        {
          house:[-222.30,20.50,false,false,3.80], use:'drying', name:'汉阳茶棚后院门面', walk:'茶棚后院接汉阳滨水支巷',
          bends:[[-225.48,24.94],[-226.05,26.73],[-226.12,29.28],[-225.94,32.34],[-225.75,34.56]],
          walls:[[-228.0,29.53,1.64,.61,.10],[-223.87,29.29,1.25,.51,-.19]],
          returnToHouse:[[-228.78,27.55],[-228.10,25.88],[-226.75,24.16]],
          door:[1.06,1.60,.16], window:[-1.20,.70,.78],
        },
        {
          house:[-222,45,true,true,0], name:'汉阳沿巷小院山墙门面', walk:'汉阳沿巷小院过门石径',
          bends:[[-222.56,41.15],[-222.69,39.82],[-222.96,38.31],[-223.18,37.34]],
          walls:[[-224.79,39.08,1.21,.62,.06],[-221.08,39.19,1.10,.47,-.17]],
          returnToHouse:[[-225.28,40.45],[-223.64,42.40]],
          door:[.69,1.37], window:[.88,.44,.44],
        },
        {
          house:[-234.64,48.70,false,true,-.37], use:'rain', name:'汉阳后排里分门面', walk:'汉阳后排里分入巷石径',
          bends:[[-235.19,44.78],[-235.44,43.22],[-235.86,41.69],[-236.70,39.58],[-237.39,37.18]],
          walls:[[-237.52,42.13,1.38,.56,.27],[-233.98,42.19,1.22,.43,.08]],
          returnToHouse:[[-237.87,43.64],[-236.18,46.22]],
          door:[.84,1.59,-.39], window:[1.30,.40,.98],
        },
      ];
      for (const {house,name,walk,bends,walls,returnToHouse,door,window,use} of yards) {
        const face=courtyardFront(...house);
        if (!face || !courtWalk(face,walk,bends)) continue;
        const detail=blocks(group,name);
        const [width,height,offset=0]=door, {point,yaw}=face;
        doorway(detail,face,offset,width,height);
        const foot=blocks(group,name+'石脚与门槛进深');
        stoneFoot(foot,face,[[offset-2.13,offset-width*.54,.032],[offset+width*.54,offset+2.08,.034]]);
        foot.box('BankStone',point(offset,.24,.057),width+.26,.135,.55,yaw);
        foot.box('ShoreStone',point(offset,.278,.119),width+.12,.053,.31,yaw);
        foot.box('Masonry',point(offset-.016,.48,.031),width+.22,.082,.19,yaw);
        for (const side of [-1,1]) {
          const jamb=offset+side*(width*.5+.045);
          foot.box('BoatAccent',point(jamb,.073,height*.52),.069,height-.06,.138,yaw);
          foot.box('ShoreStone',point(jamb,.078,.13),.118,.215,.162,yaw);
        }
        foot.show();
        // Narrow inner leaves break the deep reveal, while the threshold remains flush.
        for (const side of [-1,1]) {
          const leaf=offset+side*width*.245;
          detail.box('BoatAccent',point(leaf,.046,height*.41+.04),width*.445,height*.73,.023,yaw);
          detail.box('Ink',point(leaf,.062,height*.47+.04),width*.308,height*.46,.012,yaw);
          detail.box('BoatAccent',point(leaf,.079,height*.47+.04),width*.31,.028,.016,yaw);
        }
        detail.box('Slate',point(offset+.045,.082,height*.43),.04,.043,.032,yaw);
        latticeWindow(detail,face,...window);
        detail.show();
        const edges=blocks(group,name+'的退让院墙');
        function lowWall(p,length,height,yaw) {
          const y=floor(p);
          edges.box('Masonry',p.clone().setY(y+height*.5-.035),length,height,.145,yaw);
          edges.box('Masonry',p.clone().setY(y+.023),length,.124,.205,yaw);
          edges.box('Slate',p.clone().setY(y+height-.02),length+.035,.038,.19,yaw);
        }
        for (const [i,[x,z,length,height,yaw]] of walls.entries()) {
          if (i && use) continue;
          const p=V(x,0,z);
          lowWall(p,length,height,yaw);
          if (i) continue;
          // Run the setback wall back to the actual house, clear of the gate opening.
          let end=p.clone().addScaledVector(V(Math.cos(yaw),0,-Math.sin(yaw)),.045-length*.5);
          for (const [nx,nz] of returnToHouse) {
            const next=V(nx,0,nz), dx=nx-end.x, dz=nz-end.z;
            lowWall(end.clone().lerp(next,.5),Math.hypot(dx,dz)+.034,height,Math.atan2(-dz,dx));
            end=next;
          }
        }
        edges.show();
        if (use) householdCourt(face,use);
        if (use==='drying') {
          const v=(x,z)=>V(x,0,z);
          const gate=[v(-231.61,23.21),v(-233.10,23.03)];
          enclosingCourt(group,'汉阳晒院连墙与过檐侧门',[
            {line:[v(-226.78,24.14),v(-229.03,23.74),gate[0]],heights:[.82,1.06]},
            {line:[gate[1],v(-234.21,22.88),v(-234.52,21.44)],heights:[1.07,.72]},
          ],gate);
          paveAlley(group,'汉阳晒院侧门石径',
            [v(-226.48,31.35),v(-229.48,30.45),v(-232.27,28.02),v(-232.36,23.15),v(-232.83,22.03),v(-233.24,21.53)],
            20,()=>.47,{material:'BankStone',liftAt:()=>.069});
        }
        if (use==='rain') {
          kitchenWing(group,'汉阳后院旧砖灶披屋',face,3.49,1.18);
          const v=(x,z)=>V(x,0,z);
          const gate=[v(-240.23,42.01),v(-241.66,41.81)];
          enclosingCourt(group,'汉阳后排院侧砖墙与檐门',[
            {line:[v(-237.86,43.63),v(-238.93,42.25),gate[0]],heights:[.61,.91],material:'BankStone'},
            {line:[gate[1],v(-242.90,41.69),v(-243.37,43.03)],heights:[.83,.65],material:'BankStone'},
          ],gate);
          paveAlley(group,'汉阳雨院檐门小道',
            [v(-237.35,37.96),v(-239.46,38.44),v(-241.52,39.71),v(-240.93,41.92),v(-241.00,43.58)],
            15,()=>.45,{material:'BankStone',liftAt:()=>.069});
        }
      }
    }
    hanyangCourtyards();
    streetEaves('汉阳茶棚后街坊','汉阳茶棚旧屋起伏瓦檐',-218,29,[{kind:'mended',u:2.92,v:-1.23}]);
    streetEaves('汉阳茶棚后街坊','汉阳后院灰瓦滴水',-222.30,20.50,[{kind:'dormer',u:-2.89,v:-1.18}],true);
    streetEaves('汉阳茶棚后街坊','汉阳后排灶间砖烟囱',-234.64,48.70,[{kind:'chimney',u:.67,v:-.72}],true);
    streetEaves('汉阳茶棚后街坊','汉阳内街补瓦压脊',-224.11,9.04,[{kind:'mended',u:-3.01,v:1.29}]);

    // The other bank has a quieter house gate, with short caps and an open way into the courtyard.
    const east=laneFront(-59.58,75.26,false);
    if (east) {
      const group='武昌滨水街巷生活', {point,yaw}=east;
      laneApron(group,'武昌里分门前石径接支巷',east,3.3,1.43);
      const gate=blocks(group,'武昌青砖里分门楼');
      const gateZ=2.25;
      const paving=scene.getObjectByName('武昌里分门前石径接支巷');
      gateTreads(group,'武昌门楼三级过门石',east,paving,[
        [.006,2.26,1.39,.40,.083],[-.024,2.68,1.30,.35,.035],[.028,3.06,1.18,.30,.014],
      ]);
      for (const side of [-1,1]) closeContact(point(side*.85,gateZ),yaw,.265,.27,paving);
      for (const side of [-1,1]) {
        gate.box('Masonry',point(side*1.35,gateZ,.39),.88,.76,.23,yaw);
        gate.box('ShoreStone',point(side*1.35,gateZ,.788),.90,.083,.30,yaw);
        gate.box('ShoreStone',point(side*.85,gateZ,.066),.33,.142,.43,yaw);
        for (let row=0;row<14;row++) {
          const key=row%4===1?'Slate':'ShoreStone';
          gate.box(key,point(side*.851,gateZ+(row%2)*.005,.176+row*.113),
            .260+(row%2)*.030,.107,.331,yaw);
        }
        gate.box('ShoreStone',point(side*.85,gateZ,1.752),.37,.115,.46,yaw);
        gate.box('Ink',point(side*.738,2.54,.451),.095,.81,.584,yaw+side*.21);
      }
      // The timber head and sign sit above the open passage between the brick piers.
      gate.box('Ink',point(0,gateZ,1.824),1.97,.166,.285,yaw);
      gate.box('Masonry',point(0,gateZ,1.977),1.83,.176,.353,yaw);
      gate.box('Ink',point(0,2.445,1.962),.82,.241,.063,yaw);
      gate.box('BoatLoad',point(0,2.484,2.082),.86,.024,.036,yaw);
      gate.box('BoatLoad',point(0,2.482,1.843),.853,.026,.036,yaw);
      const characters=[
        [[[.19,.18],[.81,.19]],[[.20,.18],[.20,.553]],[[.80,.18],[.80,.55]],[[.23,.37],[.78,.37]],
          [[.24,.55],[.78,.55]],[[.50,.20],[.50,.81]],[[.29,.70],[.72,.70]],[[.16,.84],[.86,.84]]],
        [[[.43,.19],[.25,.38],[.13,.49]],[[.59,.16],[.74,.37],[.86,.49]],[[.25,.49],[.74,.49],[.70,.70],[.65,.82],[.53,.79]],
          [[.46,.50],[.40,.70],[.26,.85]]],
      ];
      for (const [i,character] of characters.entries()) for (const stroke of character) {
        const words=stroke.map(([u,v])=>point((.5-i)*.286+(.5-u)*.233,2.486,2.065-.205*v));
        cane(gate,'Paper',words,.0112);
      }
      for (const side of [-1,1]) {
        fabric(gate,'ShoreStone',(u,v)=>point((side<0?.5-u:u-.5)*2.18,gateZ+side*.34*(1-v),
          2.069+.19*v+.030*Math.sin((side<0?1-u:u)*7.1)),20,9);
        for (let tile=0;tile<14;tile++) {
          const u=-1.018+tile*.156;
          gate.round('ShoreStone',dripTile,point(u,gateZ+side*.348,2.062+.028*Math.cos(tile*.45)),
            .156,.117,.133,yaw);
        }
      }
      gate.box('Slate',point(0,gateZ,2.268),2.19,.064,.13,yaw);
      gate.box('ShoreStone',point(0,2.31,.070),1.22,.091,.34,yaw);
      doorway(gate,east,0,.48,1.26);
      latticeWindow(gate,east,2.80,.45,.49);
      gate.show();
      const planter=blocks(group,'武昌开敞院门靠墙釉盆');
      courtyardPlant(planter,east,-1.93,1.82,1.13,'ShoreStone');
      planter.show();
      const life=blocks(group,'武昌入巷同行');
      person(life,east,-.52,3.64,Math.PI*.12,1.07,'Slate',.83);
      person(life,east,.36,4.33,Math.PI*.04,.91,'BoatAccent',-.53);
      life.show();
    }

    const backGroup='武昌滨水街巷生活', routeName='武昌后巷步道';
    streetEaves(backGroup,'武昌入巷老宅错搭瓦檐',-59.58,75.26,[{kind:'glass',u:.12,v:-1.36}]);
    streetEaves(backGroup,'武昌里分后排灰瓦滴水',-37.73,58.08,[{kind:'chimney',u:-2.88,v:-.62}],true);
    streetEaves(backGroup,'武昌临桥旧屋老虎窗',-72.17,112.68,[{kind:'dormer',u:3.03,v:-1.12}]);
    streetEaves(backGroup,'武昌临桥偏置砖烟囱',-76.14,123.58,[{kind:'chimney',u:-.61,v:.83}]);
    function oldThreshold(matrices,x,z,doorX,wallZ) {
      const matrix=matrices.find(({elements:e})=>Math.hypot(x-e[12],z-e[14])<.28);
      if (!matrix) return null;
      const e=matrix.elements;
      const origin=V(doorX,0,wallZ).applyMatrix4(matrix).setY(0);
      const tangent=V(e[0],0,e[2]).normalize(), forward=V(e[8],0,e[10]).normalize();
      const point=(across,along,height=0)=>{
        const p=origin.clone().addScaledVector(tangent,across).addScaledVector(forward,along);
        return p.setY(floor(p)+height);
      };
      return {point,forward,yaw:Math.atan2(-tangent.z,tangent.x),
        widthScale:Math.hypot(e[0],e[2]), heightScale:e[5], base:e[13]-floor(origin)};
    }
    function streetLip(paths,point) {
      let best=Infinity, lip;
      for (const {a,b,width} of paths) {
        const step=V(b.x-a.x,0,b.z-a.z), toward=V(a.x-point.x,0,a.z-point.z);
        toward.addScaledVector(step,THREE.MathUtils.clamp(-toward.dot(step)/step.lengthSq(),0,1));
        const gap=toward.length();
        if (gap>=best || gap<.001) continue;
        best=gap;
        lip=point.clone().addScaledVector(toward,Math.max(.04,gap-width*.5+.10)/gap);
      }
      return best<4 ? lip : null;
    }
    function apartmentEdge(group,name,x,z,draw) {
      const matrix=apartments.find(({elements:e})=>Math.hypot(x-e[12],z-e[14])<.28);
      if (!matrix) return;
      const e=matrix.elements, yaw=Math.atan2(-e[2],e[0]);
      const scale=Math.hypot(e[0],e[2]), height=e[5];
      const point=(u,h,v)=>V(u,h,v).applyMatrix4(matrix);
      const detail=blocks(group,name);
      const box=(key,u,h,v,w,t,d,pitch=0)=>detail.box(key,point(u,h,v),w*scale,t*height,d*scale,yaw,pitch);
      draw(box,point,detail,scale);
      detail.show();
    }
    apartmentEdge('汉阳茶棚后街坊','汉阳茶棚后公寓砖腰线与雨管',-240.52,24.59,(box,point,detail,scale)=>{
      box('Masonry',-4.485,4.28,.14,.14,.20,5.36);
      box('ShoreStone',-4.535,4.41,.14,.23,.073,5.53);
      box('BankStone',-4.485,6.59,.14,.16,.10,5.42);
      // The old side coping turns around the two corners without crossing the glazing.
      box('ShoreStone',-4.47,7.522,.14,.36,.15,5.68);
      for (const side of [-1,1]) box('ShoreStone',-4.14,7.522,.14+side*2.72,1.02,.15,.24);
      box('Masonry',-2.99,9.005,.25,1.60,.16,4.71);
      box('Slate',-3.11,9.095,.25,1.38,.074,4.83);
      box('Masonry',-4.485,5.75,.57,.10,.76,.95);
      box('Ink',-4.548,5.75,.57,.055,.56,.72);
      for(let i=0;i<5;i++) box('BankStone',-4.586,5.53+i*.11,.57,.079,.05,.74);
      cane(detail,'BankStone',[[ -4.62,7.47,2.33],[-4.71,6.92,2.33],[-4.69,3.00,2.34],
        [-4.97,2.20,2.36],[-4.97,.18,2.36]].map(v=>point(...v)),.047*scale);
    });
    apartmentEdge('汉阳茶棚后街坊','汉阳内街公寓短挑檐',-242.97,11.21,box=>{
      box('BankStone',2.04,9.895,.40,2.13,.085,3.86);
      box('Masonry',2.04,9.81,.40,2.04,.117,3.75);
      box('Masonry',4.48,6.70,.08,.12,.20,5.40);
      box('Slate',4.535,6.81,.08,.26,.081,5.60);
      box('ShoreStone',4.61,5.29,1.64,.40,.094,1.65);
      for(const v of [.94,2.34]) box('Masonry',4.58,5.12,v,.26,.29,.15);
      box('Ink',4.49,4.73,1.64,.047,.67,1.23);
      for(let i=0;i<4;i++) box('BankStone',4.518,4.48+i*.15,1.64,.074,.059,1.26);
    });
    apartmentEdge(backGroup,'武昌街口公寓旧压顶与山墙线脚',-40.09,71.99,box=>{
      box('Slate',-.59,9.015,2.55,6.39,.145,.25);
      box('BankStone',-3.66,9.015,.68,.25,.145,3.62);
      box('Masonry',-4.49,6.68,.01,.112,.17,5.30);
      box('ShoreStone',-4.52,6.79,.01,.18,.074,5.42);
      box('ShoreStone',-4.49,7.52,.48,.28,.095,2.71);
    });
    const middle=oldThreshold(apartments,-40.09,71.99,-1.05,3.29);
    const rear=oldThreshold(lanes,-37.73,58.08,-.75,2.73);
    const branch=cityGround.riverfrontPaths.filter(p=>p.name==='武昌滨水通街支巷');
    const oldStreet=cityGround.streets.filter(p=>!p.group);
    const branchLip=streetLip(branch,V(-46.7,0,80.6));
    const streetEnd=streetLip(oldStreet,V(-44.1,0,51.2));
    const bend=V(-47.0,0,77.2);
    if (branchLip && streetEnd) {
      paveAlley(backGroup,'武昌后巷绕屋接旧街',
        [branchLip,V(-46.8,0,79.0),bend,V(-47.25,0,73.8),V(-47.0,0,68.5),
          V(-46.15,0,63.0),V(-45.85,0,56.8),V(-45.7,0,51.8),streetEnd],
        55,t=>.53+.12*Math.sin(t*Math.PI),{material:'BankStone',liftAt:()=>.075,routeName});
    }
    if (middle && branchLip && streetEnd) {
      const {point,yaw}=middle;
      paveAlley(backGroup,'武昌公寓门前转入后巷',
        [point(0,.04),point(0,.96),V(-43.55,0,76.5),V(-45.35,0,77.15),bend],
        18,t=>THREE.MathUtils.lerp(1.05,.52,THREE.MathUtils.smoothstep(t,.25,.87)),{routeName});
      const court=blocks(backGroup,'武昌公寓转角短院墙');
      court.box('Masonry',point(.03,.25,.065),1.90,.13,.63,yaw);
      court.box('Slate',point(.03,.61,.041),1.63,.077,.29,yaw);
      // Actual brickwork projects in front of the timber leaves, leaving the reveal open.
      for (const side of [-1,1]) {
        for (let course=0;course<8;course++) {
          const y=.106+course*.135;
          const key=(course+side+2)%5===0?'Masonry':'BankStone';
          court.box(key,point(side*.749,.246+(course%2)*.006,y),.133+(course%2)*.025,.124,.48,yaw);
        }
        court.box('ShoreStone',point(side*.757,.241,.073),.23,.151,.51,yaw);
        court.box('Ink',point(side*.588,.042,.694),.065,1.25,.082,yaw);
        court.box('BoatAccent',point(side*.305,.041,.635),.56,1.14,.055,yaw);
        court.box('BoatGlass',point(side*.302,.071,.813),.416,.526,.024,yaw);
        court.box('BoatAccent',point(side*.302,.085,.785),.43,.041,.035,yaw);
        court.box('Ink',point(side*.302,.072,.364),.427,.256,.023,yaw);
        court.box('BoatAccent',point(side*.302,.085,.364),.354,.192,.034,yaw);
        court.box('BoatLoad',point(side*.089,.091,.624),.024,.136,.041,yaw);
      }
      for (let i=0;i<11;i++) {
        const a=Math.PI*(i+.035)/11,b=Math.PI*(i+.965)/11;
        const arc=(r,t)=>new THREE.Vector2(r*Math.cos(t),1.104+.70*r*Math.sin(t));
        const profile=new THREE.Shape([arc(.815,a),arc(.815,(a+b)*.5),arc(.815,b),
          arc(.668,b),arc(.668,(a+b)*.5),arc(.668,a)]);
        const brick=new THREE.ExtrudeGeometry(profile,{depth:.36,bevelEnabled:false});
        court.round(i===5?'Masonry':'BankStone',brick,point(0,.102),1,1,1,yaw);
      }
      for (let i=0;i<7;i++) {
        const a=Math.PI*i/7,b=Math.PI*(i+1)/7;
        const pane=new THREE.Shape([new THREE.Vector2(0,1.117),...Array.from({length:4},(_,j)=>{
          const angle=THREE.MathUtils.lerp(a+.016,b-.016,j/3);
          return new THREE.Vector2(.622*Math.cos(angle),1.117+.421*Math.sin(angle));
        })]);
        const glass=new THREE.ExtrudeGeometry(pane,{depth:.024,bevelEnabled:false});
        court.round('BoatGlass',glass,point(0,.068),1,1,1,yaw);
        for (const angle of [a,b]) {
          court.beam('BoatLoad',point(0,.103,1.117),
            point(.615*Math.cos(angle),.103,1.117+.415*Math.sin(angle)),.024);
        }
      }
      court.box('BoatAccent',point(0,.082,1.110),1.28,.068,.104,yaw);
      court.box('BoatAccent',point(-.966,.117,.82),.23,.24,.25,yaw);
      court.box('Ink',point(-.966,.21,.865),.174,.028,.022,yaw);
      court.box('ShoreStone',point(-.966,.16,.952),.262,.036,.16,yaw,.09);
      // The entrance faces the turning lane on its open side. A low return screens the other corner.
      court.box('Masonry',point(1.80,1.91,.31),2.18,.61,.23,yaw);
      court.box('Slate',point(1.80,1.91,.63),2.25,.08,.31,yaw);
      court.box('Masonry',point(2.95,.97,.25),.24,.49,1.99,yaw);
      court.box('Slate',point(2.95,.97,.52),.31,.074,2.04,yaw);
      court.box('Masonry',point(.72,1.91,.323),.24,.647,.31,yaw);
      court.box('ShoreStone',point(.72,1.91,.665),.32,.070,.38,yaw);
      court.box('ShoreStone',point(.71,1.91,.048),.37,.095,.43,yaw);
      for (const [u,d,w,l] of [[1.8,1.91,2.24,.30],[2.95,.97,.29,2.04]]) {
        const base=point(u,d,.035);
        court.box('Slate',base,w,.068,l,yaw);
        groundContacts.push({x:base.x,z:base.z,rx:w*.59,rz:l*.59,c:Math.cos(yaw),s:Math.sin(yaw),tree:false});
      }
      const {widthScale,heightScale,base}=middle;
      for (const center of [-3.22,1.12,3.29]) {
        const u=(center+1.05)*widthScale, w=1.60*widthScale;
        const sill=base+.34*heightScale;
        court.box('Slate',point(u,.079,sill-.025),w+.09,.058,.19,yaw);
        court.box('Masonry',point(u,.057,sill-.080),w+.025,.055,.116,yaw);
      }
      court.show();

      const lived=blocks(backGroup,'武昌旧公寓沿街半帘与晾杆');
      // Mount the details on the actual recessed apartment panes, clear of the slab edges.
      const recess=(2.57-3.29)*widthScale;
      const frames=blocks(backGroup,'武昌公寓临巷三樘木窗套与石脚');
      for (const {center,sill,depth} of [
        {center:1.12,sill:.34,depth:.045},{center:3.29,sill:.34,depth:.045},{center:3.08,sill:3.02,depth:recess+.049},
      ]) {
        const u=(center+1.05)*widthScale, w=1.60*widthScale, low=base+sill*heightScale;
        const h=(sill<1?1.54:1.03)*heightScale;
        frames.box('Ink',point(u,depth-.024,low+h*.50),w+.060,h+.065,.055,yaw);
        frames.box('BoatGlass',point(u,depth+.009,low+h*.50),w-.068,h-.088,.038,yaw);
        for (const side of [-1,1]) {
          frames.box('Slate',point(u+side*(w*.5-.012),depth+.037,low+h*.51),.051,h+.016,.081,yaw);
          frames.box('Slate',point(u,depth+.048,low+h*.50+side*(h*.5-.026)),w+.021,.057,.083,yaw);
        }
        frames.box('BoatAccent',point(u-.052,depth+.050,low+h*.51),.047,h-.079,.063,yaw);
        frames.box('BoatLoad',point(u,depth+.050,low+h*.656),w-.055,.054,.062,yaw);
        frames.box('BankStone',point(u,depth+.069,low-.040),w+.15,.076,.24,yaw);
      }
      stoneFoot(frames,middle,[[.94,2.86,.026],[-3.17,-.92,.032]]);
      frames.show();
      const bambooCenter=(-2.92+1.05)*widthScale;
      const bambooTop=base+4.05*heightScale;
      const bambooHalf=.69*widthScale;
      const bamboo=(u,v)=>point(bambooCenter+(u-.5)*bambooHalf*2,
        recess+.048+.013*Math.sin(Math.PI*u)+.018*v*v,
        bambooTop-.51*heightScale*v+.017*Math.sin(u*7.8)*v);
      fabric(lived,'BoatCanopy',bamboo,14,13);
      for (let row=0;row<11;row++) {
        const v=(row+.5)/11;
        cane(lived,'BoatLoad',[bamboo(.007,v),bamboo(.51,v).addScaledVector(middle.forward,.012),
          bamboo(.993,v)],.009);
      }
      cane(lived,'BoatLoad',[bamboo(.02,1),bamboo(.54,1).add(V(0,-.019,0)),bamboo(.98,1)],.028);
      for (const u of [bambooCenter-bambooHalf,bambooCenter+bambooHalf]) {
        cane(lived,'Ink',[point(u,recess,bambooTop+.035),point(u,recess+.072,bambooTop+.050)],.013);
      }

      const laundryCenter=(1.08+1.05)*widthScale;
      const laundryTop=base+3.85*heightScale;
      const rodDepth=recess+.36;
      cane(lived,'BoatLoad',[point(laundryCenter-.55,rodDepth,laundryTop),
        point(laundryCenter+.56,rodDepth,laundryTop-.022)],.015);
      for (const side of [-1,1]) cane(lived,'Ink',
        [point(laundryCenter+side*.50,recess,laundryTop-.086),point(laundryCenter+side*.54,rodDepth,laundryTop)],.013);
      for (const [shift,span,drop,key] of [[-.30,.30,.36,'Paper'],[.17,.45,.48,'BoatGlass']]) {
        fabric(lived,key,(u,v)=>point(laundryCenter+shift+(u-.5)*span+.016*v,
          rodDepth+.039*Math.sin(u*12.4+v*2.7)*v,
          laundryTop-.013-drop*v+.014*Math.cos(u*6.28)*v*v),10,12);
        lived.box('BoatLoad',point(laundryCenter+shift-span*.32,rodDepth,laundryTop+.008),.019,.064,.026,yaw);
      }
      lived.show();

      const windowDetail=blocks(backGroup,'武昌公寓窗边接布住户');
      const sill=base+3.02*heightScale, hinge=laundryCenter+.72*widthScale;
      const sash=(u,v)=>point(hinge-u*.61*widthScale,recess+.041+.229*u,
        sill+.028+v*.98*heightScale);
      fabric(windowDetail,'BoatGlass',sash,7,8);
      for (const u of [.008,.99]) cane(windowDetail,'BoatLoad',[sash(u,0),sash(u,.50),sash(u,1)],.018);
      for (const v of [.011,.48,.982]) cane(windowDetail,'BoatLoad',[sash(0,v),sash(.52,v),sash(1,v)],.017);
      const grip=point(laundryCenter+.017,rodDepth+.015,laundryTop-.158);
      person(windowDetail,middle,laundryCenter-.43,recess+.126,.39,.74,'Slate',.8,
        {mode:'window',hand:grip,side:1,head:.24,base:point(0,recess,sill).y-.57*.74});
      windowDetail.show();
    }
    if (rear) {
      const {point,yaw}=rear, endpoint=streetLip(oldStreet,point(.12,1.86));
      if (endpoint) {
        paveAlley(backGroup,'武昌灰瓦里分门前接旧街',
          [point(0,.05),point(0,.71),point(.08,1.45),endpoint],
          12,t=>THREE.MathUtils.lerp(.79,.53,t),{routeName});
      }
      const entry=blocks(backGroup,'武昌灰瓦里分木门头与窗台');
      const paving=scene.getObjectByName('武昌灰瓦里分门前接旧街');
      gateTreads(backGroup,'武昌灰瓦里分石径渐收踏步',rear,paving,[
        [.016,.66,1.04,.30,.057],[-.035,1.00,.97,.29,.031],[.047,1.34,.86,.25,.012],
      ]);
      for (const u of [-1.03,1.08]) closeContact(point(u,.16),yaw,.42,.22,paving);
      // Recessed timber leaves and narrow divisions follow the openings of this specific front.
      entry.box('Ink',point(0,.022,.81),.75,1.55,.046,yaw);
      entry.box('BoatAccent',point(0,.064,1.60),.82,.073,.11,yaw);
      const awning=(u,v)=>point((u-.5)*1.27,.05+.48*v,1.88-.17*v+.027*Math.cos(u*6.1)-.018*v*v);
      fabric(entry,'Ink',(u,v)=>awning(u,v).add(V(0,-.040,0)),12,7);
      for (let tile=0;tile<10;tile++) {
        const spread=tile%3===1?.012:-.006;
        fabric(entry,'ShoreStone',(u,v)=>{
          const p=awning((tile+.06+u*.88)/10,v);
          return p.add(V(0,.031*Math.sin(Math.PI*u)+spread,0));
        },5,8);
        const lip=awning((tile+.5)/10,1).add(V(0,.016+spread,0));
        entry.round('ShoreStone',dripTile,lip,.117,.102,.14,yaw);
      }
      cane(entry,'BoatAccent',[awning(.01,.93).add(V(0,-.044,0)),awning(.46,.96).add(V(0,-.052,0)),
        awning(.99,.94).add(V(0,-.045,0))],.032);
      for (const side of [-1,1]) {
        cane(entry,'BoatAccent',[point(side*.54,.077,1.345),point(side*.54,.185,1.53),
          point(side*.54,.317,1.63),point(side*.54,.457,1.71)],.037);
        entry.box('Ink',point(side*.54,.067,1.37),.089,.18,.084,yaw);
        entry.box('BoatAccent',point(side*.38,.061,.80),.075,1.54,.118,yaw);
        entry.box('BoatAccent',point(side*.175,.047,.79),.315,1.46,.031,yaw);
        entry.box('Ink',point(side*.175,.067,.98),.221,.69,.021,yaw);
        entry.box('BoatAccent',point(side*.175,.082,.97),.208,.035,.024,yaw);
        entry.box('Ink',point(side*.086,.080,.695),.087,.122,.021,yaw);
        const ring=Array.from({length:13},(_,i)=>{
          const angle=i*Math.PI/6;
          return point(side*.086+.033*Math.sin(angle),.110+.017*Math.cos(angle),.683+.041*Math.cos(angle));
        });
        cane(entry,'BoatLoad',ring,.009);
      }
      entry.box('BoatLoad',point(.043,.087,.618),.068,.075,.033,yaw);
      entry.box('Ink',point(.044,.103,.609),.013,.028,.009,yaw);
      // The timber bars land on the four actual panes flanking the threshold.
      const {widthScale,heightScale,base}=rear;
      for (const center of [-2.73,-2.19,.43,.97]) {
        const u=(center+.75)*widthScale, w=.40*widthScale, h=.95*heightScale, y=base+1.125*heightScale;
        const jamb=.032;
        for (const side of [-1,1]) {
          entry.box('BoatAccent',point(u+side*(w*.5-jamb*.5),.039,y),jamb,h+.012,.052,yaw);
        }
        entry.box('BoatAccent',point(u,.042,y-h*.11),w,.034,.055,yaw);
        entry.box('Slate',point(u,.036,y+h*.5),w+.045,.044,.049,yaw);
      }
      entry.box('Masonry',point(0,.21,.067),.91,.13,.48,yaw);
      entry.box('Masonry',point(.015,.53,.035),1.03,.066,.21,yaw);
      for (const [u,w] of [[-1.82,.88],[1.37,.91],[4.36,.91]]) {
        entry.box('Slate',point(u,.071,.517),w,.064,.21,yaw);
      }
      for (const [u,w] of [[-1.30,1.45],[1.46,1.88]]) {
        entry.box('ShoreStone',point(u,.032,.044),w,.094,.129,yaw);
      }
      entry.show();
      paintedDoorGoods(backGroup,rear);
      kitchenWing(backGroup,'武昌里分连屋小灶间',rear,3.75,1.43,true);
      const edgeGate=[point(-2.91,.995),point(-4.02,.995)];
      enclosingCourt(backGroup,'武昌里分侧院短砖界与进院门',[
        {line:[point(-4.89,.045),point(-4.67,.756),edgeGate[1]],heights:[.83,.76],material:'BankStone'},
        {line:[edgeGate[0],point(-2.58,1.02),point(-2.25,.44)],heights:[.65,.52],material:'Masonry'},
      ],edgeGate);
      paveAlley(backGroup,'武昌里分从便门到侧院',
        [point(-3.42,1.72),point(-3.46,1.00),point(-3.52,.29)],7,
        ()=>.375,{material:'BankStone',liftAt:()=>.069});
    }
    if (contacts.length) {
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(contacts,3));
      geometry.setAttribute('vergeCover',new THREE.Float32BufferAttribute(contactCover,1));
      geometry.computeVertexNormals();
      const ink=vergeWash(.68,['#3d342b','#726b59']);
      const mesh=new THREE.Mesh(geometry,ink);
      mesh.name='街巷近处脚底、柱础与屋脚接地';
      mesh.userData.detailSize=.65;
      scene.add(mesh);
    }
  }

  function dressRiverfrontGround(lots) {
    const meadow=vergeWash(.40,['#758068','#b4b895']);
    const earth=vergeWash(.47,['#9c9079','#c8baa1']);
    const moss=vergeWash(.24,['#596750','#9c9f7b']);
    const field=vergeWash(.34,['#918972','#c2b69a']);
    const courtEdge=vergeWash(.45,['#85816e','#bfb198']);
    const shoreEdge=vergeWash(.36,['#717d65','#afa98b']);
    field.fragmentShader=field.fragmentShader.replace('vec4(col, vVergeCover *',`vec4(col *
      (1. + (vnoise(vW.xz*12.1)-.5)*.105 + (vnoise(vW.xz*2.49)-.5)*.09), vVergeCover *`);
    const grass=inkMat(.47,true,['#627057','#9f9e76']);
    const distanceToWalk=(x,z,{a,b})=>{
      const dx=b.x-a.x, dz=b.z-a.z;
      const t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
      return Math.hypot(x-a.x-dx*t,z-a.z-dz*t);
    };
    const paths=[...new Set([...cityGround.streets,...cityGround.courtyardPaths])];
    const banks=[
      ['汉阳滨水街巷地面',[
        [-203.3,32.3,5.5,1.85,.15],[-210.6,38.7,4.1,1.65,-.06],
        [-216.6,40.7,4.0,2.65,-.15],[-224.0,41.0,4.2,1.65,.22],
        [-220.9,33.12,2.25,1.01,-.06],[-224.4,27.2,2.55,1.55,-1.43],
        [-229.8,40.1,5.3,1.85,.11],[-234.8,40.02,3.6,1.6,.19],
        [-229.9,48.2,3.6,2.5,-.33],[-204.1,50.6,2.6,1.09,.63],
      ]],
      ['武昌滨水街巷地面',[
        [-76.2,91.7,5.8,1.35,.18],[-71.7,80.0,4.8,1.65,-.13],
        [-64.7,81.0,3.1,1.25,.18],[-57.6,81.2,3.45,1.1,.49],
        [-54.7,87.4,4.3,1.56,-.18],[-49.5,78.4,5.2,1.7,-.97],
        [-40.6,79.0,3.2,.96,.11],[-48.8,69.1,4.15,1.75,1.34],
        [-43.1,60.8,3.8,1.84,1.19],[-40.6,54.0,4.7,1.48,-.43],
        [-32.35,55.6,3.8,1.6,-1.03],[-37.2,50.6,3.5,1.31,-.38],
      ]],
    ];
    for (const [group,zones] of banks) {
      const patches=new Map(), shoots=[];
      function plot(name,ink,material,cx,cz,rx,rz,yaw,seed,underWall=false,baseAlpha=1) {
        const range=Math.max(rx,rz)+3;
        const near=paths.filter(({a,b})=>cx>=Math.min(a.x,b.x)-range && cx<=Math.max(a.x,b.x)+range &&
          cz>=Math.min(a.z,b.z)-range && cz<=Math.max(a.z,b.z)+range);
        const landFade=([x,,z])=>{
          if (!onLand(x,z) || (!underWall && cityGround.occupied(x,z,.03))) return 0;
          const gap=Math.min(2,...near.map(path=>distanceToWalk(x,z,path)-path.width*.5));
          const walkFade=THREE.MathUtils.smoothstep(gap,.07,.91);
          return walkFade*(!underWall&&cityGround.occupied(x,z,.35) ? .30 : 1);
        };
        const openWash=ink===courtEdge || ink===shoreEdge;
        const rings=openWash ? [[.18,.84],[.36,.78],[.52,.66],[.69,.45],[.84,.22],[1,0]]
          : [[.38,.72],[.72,.50],[1,0]];
        const c=Math.cos(yaw),s=Math.sin(yaw), vertices=[], coverage=[], faces=[];
        const sides=openWash ? 36 : 23;
        const point=(u,v,lift)=>{
          const x=cx+c*u+s*v,z=cz-s*u+c*v;
          return [x,(plantingSurface(x,z) ?? LAND_Y)+lift,z];
        };
        vertices.push(point(0,0,openWash ? .028 : ink===field ? .021 : .037)); coverage.push(.79);
        for (const [ring,alpha] of rings) {
          for (let i=0;i<sides;i++) {
            const a=i/sides*Math.PI*2;
            const shape=openWash ? .92+.12*Math.sin(3*a+seed)+.08*Math.cos(5*a-seed)
              : .93+.12*Math.sin(i*2.29+seed)+.10*Math.cos(i*1.11+seed*.78);
            const lift=openWash ? .028 : ink===field ? .018 : .012+.028*(1-ring);
            vertices.push(point(Math.cos(a)*rx*ring*shape,Math.sin(a)*rz*ring*shape,lift));
            coverage.push(alpha*(openWash ? .83+.17*Math.cos(a*2+seed)**2 : .75+.25*Math.cos(i*1.7+seed)**2));
          }
        }
        for (let i=0;i<sides;i++) {
          const j=(i+1)%sides;
          faces.push([0,1+j,1+i]);
          for (let ring=0;ring<rings.length-1;ring++) {
            const base=1+ring*sides, a=base+i,b=base+j,c=a+sides,d=b+sides;
            faces.push([a,b,c],[b,d,c]);
          }
        }
        if (!patches.has(name)) patches.set(name,{ink,material,positions:[],alpha:[]});
        const batch=patches.get(name), fade=vertices.map(p=>landFade(p)*baseAlpha);
        for (const face of faces) {
          const tri=face.map(i=>vertices[i]);
          if (!face.some(i=>fade[i]*coverage[i]>.015) || !triangleOnLand(...tri)) continue;
          for (const i of face) {
            batch.positions.push(...vertices[i]); batch.alpha.push(coverage[i]*fade[i]);
          }
        }
        if (underWall || ink!==meadow) return;
        for (let j=0;j<13;j++) {
          const a=j*2.399+seed, r=.39+.54*(j%7)/7;
          const [x,y,z]=point(Math.cos(a)*rx*r,Math.sin(a)*rz*r,.026);
          if (landFade([x,y,z])<.96) continue;
          for (const k of [-2,-1,0,1,2]) {
            const a2=a+k*.71, h=.053+.115*Math.sin(j*1.77+seed+k)**2, w=.022+.008*(j%3);
            const dx=Math.cos(a2), dz=Math.sin(a2), shift=.024*k;
            shoots.push(x+(shift-w)*dz,y,z-(shift-w)*dx, x+(shift+w)*dz,y,z-(shift+w)*dx,
              x+dx*h*.54+shift*dz,y+h,z+dz*h*.54-shift*dx);
          }
        }
      }
      const fieldPads=group.startsWith('汉阳') ?
        [[-205,40.5,10.0,6.4,.16],[-219,40.7,12,7,.06],[-227,29,5.9,6.9,1.27],[-233,41.3,9.7,5.2,-.13],
          [-230,49,9.8,5.1,.37],[-213,28.3,7.1,5.2,-.08]] :
        [[-76.8,91.7,11.2,5.3,.24],[-66,89.4,9.7,5.7,-.24],[-71.3,88.0,8.9,4.65,-.14],[-64,78.9,9.1,6.8,.09],
          [-51,83.6,11.5,6.1,.41],[-44,72.7,9.7,10.6,-.15],[-42,58.4,9.5,8.2,.18],[-34,50.8,9.1,5.9,-.28]];
      for (const [i,[x,z,rx,rz,yaw]] of fieldPads.entries()) {
        plot('街坊浅土',field,'WetBank',x,z,rx,rz,yaw,21.7+i*1.72,false,.80);
      }
      for (const [i,[x,z,rx,rz,yaw]] of zones.entries()) {
        plot('低草与湿土',meadow,'BankGrass',x,z,rx,rz,yaw,1.9+i*1.23);
        if (i%3!==2) plot('巷边露土',earth,'WetBank',x+.22,z-rz*.61,rx*.85,rz*.56,yaw,4.3+i);
      }
      const [courts,shoulders]=group.startsWith('汉阳') ? [
        [[-231.5,16.4,8.9,4.6,-.65],[-213.5,24.4,9.0,3.8,-.28]],
        [[-197.2,23.2,5.2,2.8,1.02],[-203.2,36.1,5.2,3.3,1.22]],
      ] : [
        [[-45.3,99.8,12.0,6.8,.53],[-53.2,105.4,9.2,4.0,.79],[-48.0,88.5,8.1,4.8,-.28]],
        [[-80.9,82.1,5.4,2.4,1.34],[-83.8,96.6,7.0,3.5,1.34],[-85.3,109.3,4.9,2.6,1.49]],
      ];
      for (const [i,[x,z,rx,rz,yaw]] of courts.entries()) {
        plot('院埕浅土渗边',courtEdge,'WetBank',x,z,rx,rz,yaw,32+i*2.06,false,.94);
      }
      for (const [i,[x,z,rx,rz,yaw]] of shoulders.entries()) {
        plot('靠陆岸肩散墨',shoreEdge,'BankGrass',x,z,rx,rz,yaw,39+i*1.73,false,1);
      }
      const nearHouses=group.startsWith('汉阳') ? [[-218,29,'lane'],[-222,45,'lane'],[-234.64,48.70,'lane']]
        : [[-59.58,75.26,'lane'],[-40.09,71.99,'apartment'],[-37.73,58.08,'lane']];
      for (const [j,[x,z,kind]] of nearHouses.entries()) {
        const lot=lots[kind].find(({elements:e})=>Math.hypot(x-e[12],z-e[14])<.28);
        if (!lot) continue;
        const e=lot.elements, scale=Math.hypot(e[0],e[2]), yaw=Math.atan2(-e[2],e[0]);
        for (const [i,[u,v,r]] of [[-3.10,-3.1,1.22],[2.65,-3.05,.83],[-2.25,3.12,1.48],[3.06,3.02,1.12]].entries()) {
          const p=V(u,0,v*(kind==='apartment'?1.16:1)).applyMatrix4(lot);
          plot('屋脚薄苔',moss,'BankGrass',p.x,p.z,r*scale,.37,yaw,13.7+i+j*2.3,true);
        }
      }
      if (shoots.length) patches.set('巷脚细草',{ink:grass,material:'Reeds',positions:shoots});
      for (const [label,{ink,material,positions,alpha}] of patches) {
        if (!positions.length) continue;
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
        if (alpha) geometry.setAttribute('vergeCover',new THREE.Float32BufferAttribute(alpha,1));
        geometry.computeVertexNormals();
        const mesh=new THREE.Mesh(geometry,ink);
        mesh.name=group+' · '+label;
        mesh.userData.landscapeSurface={group,name:mesh.name,material};
        mesh.userData.detailSize=.65;
        scene.add(mesh);
      }
    }
  }

  /* ═════════ 九、三镇市廛 ═════════ */
  // Ground shared by a row of houses: compacted earth behind a lip of salvaged flagstones.
  function dressNeighborhoodCourts(lots) {
    const earthInk=vergeWash(.38,['#928268','#c8b796']);
    const stones=[
      inkMat(.31,false,['#777c70','#b0ad95']),
      inkMat(.37,false,['#838774','#bdb398']),
    ];
    const drainInk=inkMat(.29,false,['#5d6257','#8d8a71']);
    const walkPaths=[...cityGround.streets,...cityGround.courtyardPaths];
    const banks=[
      {
        name:'汉阳',
        rows:[
          [-224.11,9.04,-223.7,15.3],[-210.48,6.88,-210,12.1],
          [-222.3,20.5,-222.8,15.3],[-208.67,18.34,-209.7,12.6],
        ],
        lanes:[
          [[-228.8,15.8],[-231.1,16.8],[-232.6,19.1],[-233.2,21.5]],
          [[-203.6,11.6],[-201.8,12.8],[-201.1,15.3],[-200.8,18.4],[-202.8,22.7],[-202.5,25]],
          [[-225.8,16.7],[-220.6,15.7],[-214.8,14.7],[-210.5,14.0],[-206.2,13.35]],
        ],
      },
      {
        name:'武昌',
        rows:[
          [-72.17,112.68,-73,107.3],[-56.55,120.04,-57.2,114.3],
          [-43.58,124.76,-44.8,118.8],[-67.02,99.73,-66.8,93.3],
          [-59.58,75.26,-60.0,82.9],
        ],
        lanes:[
          [[-60.3,85.1],[-59.7,89.1],[-60.4,94.4],[-60.1,98.2],[-57.7,102.6],[-56.1,107.1],[-54.6,114.8]],
          [[-77.9,108.4],[-73.1,107.45],[-67.5,109.4],[-63,111.7],[-59.8,114],[-55,115],[-49.8,116.5],[-42.9,119.15]],
          [[-71.1,94.1],[-69.4,93.6],[-65.1,94.25],[-60.4,94.4]],
        ],
      },
    ];
    function buildBank({name,rows,lanes}) {
      const group=name+'滨水街坊共同院埕';
      const coarse=walkPaths.filter(({a,b})=>name==='汉阳' ?
        Math.max(a.x,b.x)>-239 && Math.min(a.x,b.x)<-194 && Math.max(a.z,b.z)>5 && Math.min(a.z,b.z)<34 :
        Math.max(a.x,b.x)>-83 && Math.min(a.x,b.x)<-37 && Math.max(a.z,b.z)>74 && Math.min(a.z,b.z)<127);
      const trees=riverfrontBlocks[name==='汉阳'?0:1].groves.flatMap(({positions})=>positions);
      const plots=new Map();
      function point(x,z,h) {
        if (cityGround.occupied(x,z,.23) || !offBridge(x,z) ||
          coarse.some(path=>distanceToPath(x,z,path)<path.width*.50+.08) ||
          trees.some(([a,b])=>Math.hypot(x-a,z-b)<.49)) return null;
        const y=plantingSurface(x,z);
        return y===null || y>LAND_Y+.38 ? null : [x,y+h,z];
      }
      function panel(key,points,alpha) {
        if (points.some(p=>!p)) return;
        if (!point(points.reduce((a,p)=>a+p[0],0)/4,points.reduce((a,p)=>a+p[2],0)/4,0)) return;
        if (!plots.has(key)) plots.set(key,{positions:[],covers:[]});
        const {positions,covers}=plots.get(key);
        const [a,b,c]=points;
        const ccw=(b[2]-a[2])*(c[0]-a[0])>(b[0]-a[0])*(c[2]-a[2]);
        for (const j of ccw ? [0,1,2,2,1,3] : [0,2,1,2,3,1]) {
          positions.push(...points[j]);
          if (alpha) covers.push(alpha[j]);
        }
      }
      function section(a,b,t,offset,lift) {
        const dx=b[0]-a[0],dz=b[1]-a[1],d=Math.hypot(dx,dz);
        return point(a[0]+dx*t+dz/d*offset,a[1]+dz*t-dx/d*offset,lift);
      }
      function course(a,b,t0,t1,lo,hi,key,lift,alpha) {
        panel(key,[section(a,b,t0,lo,lift),section(a,b,t1,lo,lift),
          section(a,b,t0,hi,lift),section(a,b,t1,hi,lift)],alpha);
      }
      const soil=.051, stone=.071, groove=.067;
      for (const [k,[x,z,sx,sz]] of rows.entries()) {
        const matrix=[...lots.lane,...lots.apartment].find(({elements:e})=>Math.hypot(e[12]-x,e[14]-z)<.08);
        if (!matrix) continue;
        const e=matrix.elements, scale=Math.hypot(e[0],e[2]);
        const normal=V(e[8],0,e[10]).normalize();
        if (normal.dot(V(sx-x,0,sz-z))<0) normal.negate();
        const front=V(x,0,z).addScaledVector(normal,3.95*scale+.36);
        const tangent=V(e[0],0,e[2]).normalize();
        const a=front.clone().addScaledVector(tangent,-4.8*scale),b=front.clone().addScaledVector(tangent,4.8*scale);
        const start=[a.x,a.z],end=[b.x,b.z];
        const orientation=normal.dot(V(tangent.z,0,-tangent.x));
        const depth=k%3===1?2.9:2.2;
        for (let i=0,n=Math.ceil(10*scale);i<n;i++) {
          const t0=i/n,t1=(i+1)/n;
          const skirt=(depth+.28*Math.sin(i*1.07+k))*orientation;
          course(start,end,t0,t1,0,skirt*.69,'院土',soil,[.95,.92,.88,.88]);
          course(start,end,t0,t1,skirt*.68,skirt,'院土',soil,[.84,.84,0,0]);
          if ((i+k)%6===4) continue;
          const inset=.018/n;
          const key=(i+2*k)%4===0?'灰石浅面':'青灰条石';
          course(start,end,t0+inset,t1-inset,.16*orientation,.77*orientation,key,stone);
          if ((i+k)%3!==1)
            course(start,end,t0+inset,t1-inset,.82*orientation,1.32*orientation,key,stone+.003);
          if (name==='汉阳' && (i+k)%5<2)
            course(start,end,t0+inset,t1-inset,1.37*orientation,1.92*orientation,'灰石浅面',stone+.006);
        }
      }
      for (const [li,route] of lanes.entries()) {
        const points=new THREE.CatmullRomCurve3(route.map(([x,z])=>V(x,0,z)))
          .getSpacedPoints(Math.ceil(route.slice(1).reduce((d,[x,z],i)=>d+Math.hypot(x-route[i][0],z-route[i][1]),0)/.71));
        for (let i=0;i+1<points.length;i++) {
          const a=[points[i].x,points[i].z],b=[points[i+1].x,points[i+1].z];
          const spread=.68+.16*Math.sin(i*.32+li), shoulders=[-spread-.45,-spread*.75,spread*.75,spread+.40];
          for (let j=0;j<3;j++) course(a,b,0,1,shoulders[j],shoulders[j+1],'院土',soil,
            j===0?[0,0,.92,.92]:j===1?[.92,.92,.92,.92]:[.92,.92,0,0]);
          const facing=(li===1?-1:1), slab=.26+.09*Math.sin(i*.76), lift=li*.003;
          course(a,b,.04,.95,-slab*facing,.43*facing,i%4===0?'灰石浅面':'青灰条石',stone+lift);
          if (i%9===6 || i%9===7) continue;
          const inset=(spread+.06)*facing;
          course(a,b,0,1,inset,inset+.22*facing,'落水浅沟',groove+lift);
          course(a,b,.02,.97,inset+.22*facing,inset+.36*facing,'灰石浅面',stone+.009+lift);
        }
      }
      for (const [label,{positions,covers}] of plots) {
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
        if (covers.length) geometry.setAttribute('vergeCover',new THREE.Float32BufferAttribute(covers,1));
        geometry.computeVertexNormals();
        const material=covers.length?'BankGrass':label==='落水浅沟'?'BankStone':'Masonry';
        const mesh=new THREE.Mesh(geometry,covers.length?earthInk:label==='落水浅沟'?drainInk:stones[label==='青灰条石'?0:1]);
        mesh.name=name+label;
        mesh.userData.landscapeSurface={group,name:mesh.name,material};
        mesh.userData.detailSize=.72;
        scene.add(mesh);
      }
    }
    banks.forEach(buildBank);
  }

  function buildWuchangStreetEaves(lots) {
    const hosts=[
      [lots.apartment,-40.09,71.99],
      [lots.lane,-24.77,62.80],
    ];
    if (!hosts.every(([row,x,z])=>row.some(({elements:e})=>Math.hypot(e[12]-x,e[14]-z)<.07))) return;
    const stone=inkMat(.34,false,['#818579','#b9af96']);
    const brick=inkMat(.40,false,['#797668','#b7a992']);
    const oak=inkMat(.43,false,['#655749','#a58b68']);
    const tile=inkMat(.31,true,['#556560','#849184']);
    const gray=inkMat(.38,false,['#687773','#a1a395']);
    const flags=new Acc(), plinth=new Acc(), frame=new Acc(), rolls=new Acc(), sheets=[];
    const paths=[...cityGround.streets,...cityGround.courtyardPaths].filter(({a,b})=>
      Math.min(a.x,b.x)<-25 && Math.max(a.x,b.x)>-40 && Math.min(a.z,b.z)<81 && Math.max(a.z,b.z)>65);
    function support(x,z,r=.12) {
      if (!offBridge(x,z) || cityGround.occupied(x,z,r) ||
          paths.some(path=>distanceToPath(x,z,path)<path.width*.5+r)) return null;
      const y=plantingSurface(x,z);
      return y===null ? null : V(x,y,z);
    }
    function course(a,b,width,rise) {
      const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      const steps=Math.ceil(length/.69),yaw=Math.atan2(-dz,dx);
      for(let i=0;i<steps;i++){
        const f=(i+.5)/steps,x=a[0]+f*dx,z=a[1]+f*dz;
        const p=support(x,z,width*.49);
        if(!p) continue;
        flags.box(length/steps-.014,rise,width,x,p.y+rise*.5-.002,z,yaw);
      }
    }
    function shed(a,b,depth,wallHeight,backing) {
      const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),yaw=Math.atan2(-dz,dx);
      const point=(f,offset,lift)=>V(a[0]+dx*f-dz/length*offset,LAND_Y+lift,a[1]+dz*f+dx/length*offset);
      const back=-depth*.5, lip=depth*.5;
      const roof=(u,v)=>point(u,back-.09+(depth+.27)*v,wallHeight+.42*(1-v)+.021*Math.sin(3.14*v));
      for(const u of [.05,.50,.94]){
        for(const side of [back+.15,lip-.13]){
          const post=point(u,side,0),p=support(post.x,post.z);
          if(!p)continue;
          const row=(side-back+.09)/(depth+.27);
          const head=roof(u,row).add(V(0,-.082,0));
          plinth.box(.22,.16,.22,p.x,p.y+.077,p.z,yaw);
          frame.beam(p.clone().add(V(0,.148,0)),head,.13);
          if(length>4 && side>0 && u!==.50){
            const brace=roof(u+(u<.5?.36:-.36)/length,row).add(V(0,-.10,0));
            frame.beam(head.clone().add(V(0,-.32,0)),brace,.067);
          }
        }
      }
      for(const offset of [back+.15,lip-.13]){
        const row=(offset-back+.09)/(depth+.27);
        frame.beam(roof(.015,row).add(V(0,-.093,0)),roof(.985,row).add(V(0,-.093,0)),.10);
      }
      const rip=Math.ceil(length/.22);
      for(let i=0;i<rip;i++){
        const p=i/rip,q=(i+1)/rip;
        const mid=(p+q)*.5;
        for(const [s,t] of [[.017,.49],[.495,.985]]){
          const l=roof(p,s), r=roof(q,s), b=roof(p,t), c=roof(q,t);
          const rib=roof(mid,(s+t)*.5).add(V(0,.078,0));
          for(const v of [l,b,rib,l,rib,r,r,rib,c,c,rib,b]) sheets.push(...v.toArray());
        }
        if (i%2===0) {
          const eave=roof(mid,.988);
          rolls.box(.094,.079,.16,eave.x,eave.y-.012,eave.z,yaw);
        }
      }
      // A low rear return defines the working side of the first bay; both ends remain open.
      if (backing) {
        const x=point(.12,back+.02,0),y=point(.53,back+.02,0);
        if ([x,y].every(p=>support(p.x,p.z,.15))) {
          const p=x.clone().lerp(y,.5);
          plinth.box(x.distanceTo(y),.42,.16,p.x,LAND_Y+.21,p.z,yaw);
          frame.box(x.distanceTo(y)+.07,.053,.23,p.x,LAND_Y+.445,p.z,yaw);
        }
      }
    }
    const frontA=[-37.24,77.68],frontB=[-31.05,79.22];
    // The old apartment's side apron turns out to the first timber bay.
    course([-39.05,76.65],[-37.8,77.51],1.13,.087);
    course([-37.8,77.51],[-35.35,77.96],1.27,.101);
    course(frontA,frontB,1.57,.123);
    shed(frontA,frontB,1.68,1.83,true);
    shed([-38.03,76.54],[-36.82,77.82],.92,2.09,false);
    course([-36.66,78.58],[-31.16,80.03],.58,.071);
    course([-31.05,79.22],[-29.38,79.62],1.14,.090);
    // Flagstones turn into the rear court; the gap between the canopies remains open.
    course([-33.07,78.69],[-32.51,75.33],1.16,.087);
    course([-32.51,75.33],[-31.93,70.47],1.22,.080);
    course([-31.93,70.47],[-30.69,67.02],1.18,.085);
    course([-30.69,67.02],[-27.81,66.98],1.35,.107);
    shed([-30.63,67.38],[-27.64,67.21],1.37,1.64,false);
    const group='武昌滨水街巷 · 转角短檐廊';
    function add(mesh,name,material) {
      mesh.name=name;
      mesh.userData.landscapeSurface={group,name,material};
      mesh.userData.detailSize=1.25;
      scene.add(mesh);
    }
    add(flags.mesh(stone,false),'武昌檐下连院石踏面','Path');
    add(plinth.mesh(brick,false),'武昌短廊砖脚与低隔墙','Masonry');
    add(frame.mesh(oak,false),'武昌两段檐廊木作','BoatLoad');
    add(rolls.mesh(gray,false),'武昌短廊滴水瓦头','ShoreStone');
    const roof=new THREE.BufferGeometry();
    roof.setAttribute('position',new THREE.Float32BufferAttribute(sheets,3));
    roof.computeVertexNormals();
    add(new THREE.Mesh(roof,tile),'武昌两段青瓦薄檐','Masonry');
  }

  function buildBridgeQuarterDetails(lots) {
    const masonry=inkMat(.34,false,['#746d62','#b3aa95']);
    const copings=inkMat(.36,false,['#646f69','#a8ab97']);
    const gates=inkMat(.45,false,['#615948','#a08c69']);
    const waterTank=inkMat(.40,false,['#5b716c','#96a095']);
    function show(acc,group,name,material,ink) {
      if (!acc.l.length) return;
      const mesh=acc.mesh(ink,false);
      mesh.name=name;
      mesh.userData.landscapeSurface={group,name,material};
      mesh.userData.detailSize=1.12;
      scene.add(mesh);
    }
    function roofTerrace() {
      const lot=lots.apartment.find(({elements:e})=>Math.hypot(e[12]+228.64,e[14]+3.27)<.055);
      if (!lot) return;
      const edge=new Acc(), cover=new Acc();
      const roof=9.0625, axis=new THREE.Quaternion(), box=new THREE.Matrix4();
      function add(batch,x,y,z,w,h,d) {
        box.compose(V(x,y,z),axis,V(w,h,d)).premultiply(lot);
        batch.push(UBOX,box);
      }
      // Surviving masonry on the broad roof slab, away from the taller stair head.
      add(edge,-3.55,roof+.18,-.32,.18,.38,4.18);
      add(edge,-1.84,roof+.18,1.91,3.54,.38,.19);
      add(cover,-3.55,roof+.39,-.32,.28,.10,4.20);
      add(cover,-1.84,roof+.39,1.91,3.55,.10,.29);
      add(edge,-1.96,roof+.13,.23,.91,.27,.73);
      add(cover,-1.96,roof+.48,.23,.69,.46,.58);
      show(edge,'汉阳旧公寓天台','汉阳白楼天台矮墙','Masonry',masonry);
      show(cover,'汉阳旧公寓天台','汉阳白楼天台压顶与小水箱','ShoreStone',waterTank);
    }
    const homes=[[-62.64,136.24],[-76.14,123.58]];
    if (homes.every(([x,z])=>lots.lane.some(({elements:e})=>Math.hypot(e[12]-x,e[14]-z)<.055))) {
      const bases=new Acc(), caps=new Acc(), timber=new Acc(), stone=new Acc();
      const group='武昌鹦鹉洲桥后里分';
      const paths=[...cityGround.streets,...cityGround.courtyardPaths].filter(({a,b})=>
        Math.min(a.x,b.x)<-58 && Math.max(a.x,b.x)>-80 && Math.min(a.z,b.z)<134 && Math.max(a.z,b.z)>123);
      function clear(x,z,r,join=false) {
        return (join || !cityGround.occupied(x,z,r)) && offBridge(x,z) && !paths.some(path=>
          distanceToPath(x,z,path)<path.width*.5+r);
      }
      function wall(start,end,height=.58,width=.26,join=false) {
        const [sx,sz]=start,[ex,ez]=end,dx=ex-sx,dz=ez-sz,length=Math.hypot(dx,dz);
        const count=Math.max(1,Math.ceil(length/1.43)),yaw=Math.atan2(-dz,dx);
        for (let i=0;i<count;i++) {
          const t=(i+.5)/count,x=sx+t*dx,z=sz+t*dz;
          if (![-.5,0,.5].every(p=>clear(x+dx/count*p,z+dz/count*p,width*.55,join))) continue;
          const y=plantingSurface(x,z);
          if (y===null) continue;
          bases.place(UBOX,x,y+height*.5-.015,z,length/count+.018,height,width,yaw);
          caps.place(UBOX,x,y+height+.016,z,length/count-.008,.076,width+.076,yaw);
        }
      }
      wall([-73.3,127.25],[-71.85,128.25]);
      wall([-71.85,128.25],[-70.60,129.08],.62);
      // The gate leaves a walking gap in the angled party wall.
      const portal=[[-70.60,129.08],[-69.37,129.92]];
      const gate=portal.map(([x,z])=>V(x,0,z));
      for(const p of gate){
        const y=plantingSurface(p.x,p.z);
        if(y===null) continue;
        p.y=y;
        bases.place(UBOX,p.x,y+.41,p.z,.31,.83,.33,0);
        caps.place(UBOX,p.x,y+.84,p.z,.42,.095,.44,0);
      }
      timber.beam(gate[0].clone().add(V(0,.922,0)),gate[1].clone().add(V(0,.922,0)),.090);
      const pin=gate[1].clone();
      for(let i=0;i<4;i++){
        const sill=pin.clone().lerp(gate[0],.10+i*.23);
        stone.place(UBOX,sill.x,sill.y+.037,sill.z,.28,.059,.62,-.60);
      }
      const center=gate[0].clone().lerp(gate[1],.5);
      const direction=gate[1].clone().sub(gate[0]).setY(0).normalize();
      const frontage=V(direction.z,0,-direction.x);
      for (const step of [.59,1.17,1.78]) for (const side of [-.31,.31]) {
        const p=center.clone().addScaledVector(frontage,step).addScaledVector(direction,side);
        const y=plantingSurface(p.x,p.z);
        if (y!==null && clear(p.x,p.z,.32)) stone.place(UBOX,p.x,y+.032,p.z,.56,.056,.49,-.60);
      }
      wall([-69.37,129.92],[-67.32,131.19],.58);
      wall([-67.32,131.19],[-65.95,131.22],.62);
      wall([-65.95,131.22],[-61.56,130.81],.51);
      wall([-74.75,127.97],[-76.68,129.66],.52);
      wall([-76.68,129.66],[-77.73,129.04],.50);
      wall([-67.32,131.19],[-67.38,132.90],.49);
      // These terminal pieces butt into the surveyed masonry faces of the two baked homes.
      wall([-73.3,127.25],[-73.57,126.90],.54,.25,true);
      wall([-74.75,127.97],[-75.29,126.28],.49,.25,true);
      wall([-65.95,131.22],[-64.90,132.84],.58,.25,true);
      wall([-61.56,130.81],[-62.18,133.95],.48,.25,true);
      // Separate a short rear work yard from the route through the open gate.
      const floor=V(-66.35,0,128.40), angle=-.58;
      for (let j=0;j<3;j++) for(let i=0;i<5;i++) {
        if ((i+j*3)%9===3) continue;
        const x=floor.x+(i-2)*.61, z=floor.z+(j-1)*.48+(i-2)*.26;
        const y=plantingSurface(x,z);
        if (y===null||!clear(x,z,.35)) continue;
        stone.place(UBOX,x,y+.035,z,.53,.06,.40,angle+.018*Math.sin(i+j*1.6));
      }
      show(bases,group,'武昌桥后共用低院墙','Masonry',masonry);
      show(caps,group,'武昌桥后青灰墙瓦压顶','ShoreStone',copings);
      show(timber,group,'武昌桥后夹巷门梁','BoatLoad',gates);
      show(stone,group,'武昌桥后门槛及后院石埕','BankStone',copings);
    }
    roofTerrace();
  }

  // 以街坊为单位，里分顺巷成排、临江商埠与厂房成带，现代楼群在内街起伏。
  // 空间为画意概括，河湖、桥轴和地标仍使用实测位置。
  function distanceToPath(x, z, {a, b}) {
    const dx = b.x-a.x, dz = b.z-a.z;
    const t = THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz || 1), 0, 1);
    return Math.hypot(x-a.x-dx*t, z-a.z-dz*t);
  }
  function buildCityBlocks() {
    const lots = { lane: [], arcade: [], wharf: [], apartment: [], highrise: [], terrace_tower: [], slab_tower: [] };
    const landmarks = pickables.filter(g => !['bridge', 'yingwuzhou', 'lake'].includes(g.userData.focus))
      .map(g => { g.updateMatrixWorld(true); return new THREE.Box3().setFromObject(g).expandByScalar(2.2); });
    const cells = new Map(), cellSize = 14;
    const streetsMesh = new Acc(), streetSurface = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const plannedStreets = [], routeEnds = [], districtPaving = new Map(), protectedPaths = new Map();
    const deferredRiverfront = [];
    let citySeed = 571;
    const cityRandom = () => (citySeed = (citySeed * 16807) % 2147483647) / 2147483647;
    const halfWidth = 5.25, halfDepth = 3.95;
    const landmarkAt = (x, z) => landmarks.some(box => x > box.min.x && x < box.max.x && z > box.min.z && z < box.max.z);
    function occupiedIn(lotsByCell, x, z, radius = 0) {
      const cx = Math.floor(x / cellSize), cz = Math.floor(z / cellSize);
      const cellsToCheck = Math.ceil((radius + 9) / cellSize);
      for (let i = cx - cellsToCheck; i <= cx + cellsToCheck; i++) for (let j = cz - cellsToCheck; j <= cz + cellsToCheck; j++) {
        const lotsInCell = lotsByCell.get(i + ',' + j);
        if (lotsInCell && lotsInCell.some(p => {
          const dx = x - p.x, dz = z - p.z;
          const u = Math.max(0, Math.abs(p.c * dx - p.s * dz) - halfWidth * p.scale);
          const v = Math.max(0, Math.abs(p.s * dx + p.c * dz) - halfDepth * p.scale);
          return u * u + v * v <= radius * radius;
        })) return true;
      }
      return false;
    }
    const occupied = occupiedIn.bind(null,cells);
    function oldStreetBed(a,b,width,bank,looseAtStart,court='') {
      const length=Math.hypot(b.x-a.x,b.z-a.z), steps=Math.ceil(length/.65);
      const nx=(b.z-a.z)/length, nz=(a.x-b.x)/length;
      const positions=[],cover=[],indices=[],rows=[],visible=[];
      const lerp=THREE.MathUtils.lerp, smooth=THREE.MathUtils.smoothstep;
      const ink=court ? vergeWash(.28,['#797e71','#b6af95']) : vergeWash(.50,['#9a917b','#d2c5a9']);
      for (let i=0;i<=steps;i++) {
        const t=i/steps, fromEnd=(looseAtStart?t:1-t)*length;
        const neck=court && looseAtStart===null ? 1 : smooth(fromEnd,0,Math.min(2.2,length*.33));
        const x=lerp(a.x,b.x,t),z=lerp(a.z,b.z,t), course=[];
        for(const [s,alpha] of [[-1,0],[-.80,.91],[0,.98],[.80,.91],[1,0]]) {
          const off=s*width*.5*(.60+.40*neck) +
            Math.pow(Math.abs(s),3)*.058*Math.sin(i*1.67+s*4);
          const px=x+nx*off,pz=z+nz*off;
          const p=[px,(plantingSurface(px,pz)??LAND_Y)+.046,pz];
          positions.push(...p);
          cover.push(alpha*neck);
          course.push(p);
        }
        rows.push([course[1],course[2],course[3]]);
        visible.push(fromEnd>1.9);
        if(!i) continue;
        for(let j=0;j<4;j++){
          const k=(i-1)*5+j;
          indices.push(k,k+5,k+1,k+1,k+5,k+6);
        }
      }
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geometry.setAttribute('vergeCover',new THREE.Float32BufferAttribute(cover,1));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,ink), group=bank+'两桥滨水岸线';
      const name=bank+(court ? '院埕间旧巷石土'+court : '旧巷石土收口');
      mesh.name=name;
      mesh.userData.landscapeSurface={group,name,material:'Path'};
      scene.add(mesh);
      layWalkDetails(group,name,rows,visible,true);
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
          const approach = roadAt(px,pz);
          if ((approach && approach.distance<approachHalfWidth+.85) ||
              !onLand(px, pz) || !offBridge(px, pz, false) || terrainTop(px, pz) > LAND_Y + .3 || landmarkAt(px, pz)) return;
        }
      }
      // These two exposed ends would otherwise read as square plugs in the shore-level views.
      if (Math.hypot(a.x+236.19,a.z-42.38)<.08 && Math.hypot(b.x+230.35,b.z-41.03)<.08)
        oldStreetBed(a,b,width,'汉阳',false);
      else if (Math.hypot(a.x+82.80,a.z-87.82)<.08 && Math.hypot(b.x+60.24,b.z-96.03)<.08)
        oldStreetBed(a,b,width,'武昌',true);
      else if (Math.hypot(a.x+228.24,a.z-15.56)<.08 && Math.hypot(b.x+204.54,b.z-11.81)<.08)
        oldStreetBed(a,b,width,'汉阳',null,'主段');
      else if (Math.hypot(a.x+91.92,a.z-111.67)<.08 && Math.hypot(b.x+52.05,b.z-127.85)<.08)
        oldStreetBed(a,b,width,'武昌',null,'主段');
      else if (Math.hypot(a.x+52.05,a.z-127.85)<.08 && Math.hypot(b.x+40.77,b.z-131.95)<.08)
        oldStreetBed(a,b,width,'武昌',false,'东段');
      else streetsMesh.place(streetSurface, (a.x + b.x) / 2, LAND_Y + .045, (a.z + b.z) / 2, length, 1, width, Math.atan2(-dz, dx));
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
      const matrix = dummy.matrix.clone();
      lots[kind].push(matrix);
      const key = Math.floor(x / cellSize) + ',' + Math.floor(z / cellSize);
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push({ x, z, c: Math.cos(yaw), s: Math.sin(yaw), scale, matrix });
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
            // Step the Hanyang tower cluster down into the low tea-shop quarter along its eastern edge.
            if (kind==='highrise' && Math.hypot(lot.x+269,lot.z-42)<17) {
              kind='apartment';
              top=Math.min(top,10.5);
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
      if (path.riverfront) {
        deferredRiverfront.push({path,registerStreet});
        cityGround.riverfrontPaths.push(path);
        return;
      }
      registerPath(path,registerStreet);
    }
    function registerPath(path, registerStreet) {
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

    function districtRoute({ name, group, points, width, widthAt, planted = false, riverfront = false, material = 'Path', terrace = false, earthy = false, connect = false, gradeStart = null, entryHeight = null, plain = false, surfaceLift = 0, junctionLift = 0 }) {
      const vertices = [], indices = [], onSurface = [];
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
      let distance = 0;
      const widths = rows.map((p, i) => {
        if (i > 0) distance += Math.hypot(p.x-rows[i-1].x,p.z-rows[i-1].z);
        return widthAt ? widthAt(distance) : width;
      });
      const worldPoints = rows.map((p, i) => {
        const a = rows[Math.max(0,i-1)], b = rows[Math.min(rows.length-1,i+1)];
        const dx = b.x-a.x, dz = b.z-a.z, length = Math.hypot(dx,dz) || 1;
        return [-1,0,1].map(side => {
          const x = p.x+side*dz/length*widths[i]/2, z = p.z-side*dx/length*widths[i]/2;
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
          onSurface[i]=true;
          reservePath({ a: rows[i], b: rows[i+1], width: widths[i], group, name, planted, riverfront });
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
      if (connect) routeEnds.push({ name, group, point: rows.at(-1), width: widths.at(-1), material, earthy });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3));
      geometry.setIndex(indices); geometry.computeVertexNormals();
      if (riverfront) {
        layWalkDetails(group,name,worldPoints,onSurface);
        const edge = new Float32Array(vertices.length/3);
        for (let i=0; i<worldPoints.length; i++) {
          edge[i*3] = -1;
          edge[i*3+2] = 1;
        }
        geometry.setAttribute('walkEdge',new THREE.Float32BufferAttribute(edge,1));
      }
      const key = group+' / '+material+(earthy ? ' / soil' : '');
      if (!districtPaving.has(key)) districtPaving.set(key, { name, group, material, earthy, riverfront, tiles: new Acc() });
      districtPaving.get(key).tiles.push(geometry);
      return worldPoints;
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
    // Add the waterfront walks after the original blocks and street endpoints have settled.
    // Original vegetation reads that same city layout before nearby conflicts are removed.
    cityGround.occupiedBeforeRiverfront = occupiedIn.bind(null,new Map(cells));
    const removed = new Set();
    for (const {path,registerStreet} of deferredRiverfront) registerPath(path,registerStreet);
    function walkCutsLot({a,b,width}, {x,z,c,s,scale}) {
      // Clip the segment to the lot rectangle, expanded by the walk's half-width.
      const u = p => c*(p.x-x)-s*(p.z-z);
      const v = p => s*(p.x-x)+c*(p.z-z);
      const clearance = width/2+.22;
      let enter=0, leave=1;
      for (const [start,end,bound] of [[u(a),u(b),halfWidth*scale+clearance],
        [v(a),v(b),halfDepth*scale+clearance]]) {
        const d = end-start;
        if (Math.abs(d)<1e-5) {
          if (Math.abs(start)>bound) return false;
          continue;
        }
        const low=(-bound-start)/d, high=(bound-start)/d;
        enter=Math.max(enter,Math.min(low,high));
        leave=Math.min(leave,Math.max(low,high));
      }
      return enter<=leave;
    }
    for (const [key, places] of cells) {
      const walks = protectedPaths.get(key)?.filter(path => path.riverfront);
      cells.set(key,places.filter(place => {
        if (!walks?.some(path => walkCutsLot(path,place))) return true;
        removed.add(place.matrix);
        return false;
      }));
    }
    for (const [kind, matrices] of Object.entries(lots)) lots[kind] = matrices.filter(matrix => !removed.has(matrix));
    for (const { yaw, homes } of riverfrontBlocks) {
      for (const [i,[x,z,kind]] of homes.entries()) {
        const scale = .58 + (i%3)*.045;
        const radius = Math.hypot(halfWidth,halfDepth)*scale+.38;
        if (riverfrontOpening(x,z,radius) || localStreets.some(street =>
          distanceToPath(x,z,street)<street.width/2+radius)) continue;
        const rotation = yaw+(i%3-1)*.11;
        buildLot(kind ?? (i%4===2 ? 'arcade' : 'lane'),{x,z},rotation,scale,.5+(i%3)*.1);
      }
    }
    cityGround.occupied = (x, z, radius) => occupied(x, z, radius);
    buildRiverfrontAlleys(lots);
    dressRiverfrontGround(lots);
    dressNeighborhoodCourts(lots);
    buildBridgeQuarterDetails(lots);
    buildWuchangStreetEaves(lots);
    const streets = streetsMesh.mesh(inkMat(.42, false, ['#b3a895', '#dfd8c7']), false);
    streets.name = 'City streets';
    scene.add(streets);
    const earthPath = inkMat(.23, false, ['#788074', '#a9ad99']);
    for (const { name, group, material, earthy, riverfront, tiles } of districtPaving.values()) {
      const base=earthy ? earthPath : material==='BankStone' ? M.bankStone : M.bankPath;
      const mesh=tiles.mesh(riverfront ? riverfrontPavingInk(base,true) : base,false);
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
