  /* ── 三处地标场地：岛岸登陆、北馆前庭、蛇山石阶 ── */
  const landmarkGrounds = {
    xingyin: { bridges: [], paths: [], shade: [] },
    museum: { paths: [], lines: [], shade: [] },
    tower: { paths: [], steps: [], shade: [] }
  };
  function buildLandmarkGrounds() {
    const stone = inkMat(.30, false, ['#8b826d', '#d9cbb4']);
    const curb = inkMat(.20, false, ['#777362', '#c5b8a2']);
    const terrace = inkMat(.43, false, ['#857b66', '#e2d5bd']);
    const lakesideGrass = inkMat(.27, false, ['#6d7865', '#aeb49b']);
    const shoreGrass = lakesideGrass.clone();
    shoreGrass.uniforms = lakesideGrass.uniforms;
    shoreGrass.fragmentShader = shoreGrass.fragmentShader.replace('col = mix(col, uFog, smoothstep(uNear, uFar, vD));',
      'col = mix(uFog * .937, col, smoothstep(.742, .867, vW.y)); col = mix(col, uFog, smoothstep(uNear, uFar, vD));');
    const tuftShape = new THREE.IcosahedronGeometry(1,0);
    const hillsideStone = inkMat(.26, false, ['#777562', '#c3b7a0']);
    const landHeightAt = p => plantingSurface(p.x,p.z) ?? LAND_Y;
    const local = (site,x,y,z) => site.localToWorld(V(x,y,z));
    const plan = (site,x,z) => local(site,x,0,z);
    for (const site of [xingyin,museum,tower]) site.updateMatrixWorld(true);

    function surface(name, group, material, key, geometry) {
      const mesh = new THREE.Mesh(geometry,material);
      mesh.name = name;
      mesh.userData.landscapeSurface = { group, name, material: key };
      scene.add(mesh);
      return mesh;
    }
    function faces(name, group, material, key, points, indices) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flatMap(p=>p.toArray()),3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return surface(name,group,material,key,geometry);
    }
    function section(a,b,center,width) {
      const dx = b.x-a.x, dz = b.z-a.z, h = width/(2*Math.hypot(dx,dz));
      return [V(center.x-dz*h,center.y,center.z+dx*h),
              V(center.x+dz*h,center.y,center.z-dx*h)];
    }
    function ribbon(name, group, material, key, rows, padding) {
      const points = rows.flatMap(([a,b])=>[a,b]);
      const indices = [];
      for (let i=2;i<points.length;i+=2) indices.push(i-2,i,i-1,i-1,i,i+1);
      if (padding) {
        const n = points.length;
        points.push(...points.map(p=>V(p.x,padding(p),p.z)));
        for (const start of [0,1]) {
          for (let i=start;i<n-2;i+=2) {
            const wall = [i,i+2,n+i+2,i,n+i+2,n+i];
            indices.push(...(start ? wall : wall.reverse()));
          }
        }
        indices.push(0,1,n+1,0,n+1,n,n-2,2*n-2,2*n-1,n-2,2*n-1,n-1);
      }
      return faces(name,group,material,key,points,indices);
    }
    function pathRecord(place, rows) {
      const points = rows.map(([a,b])=>a.clone().lerp(b,.5));
      place.paths.push(points);
      for (let i=1;i<points.length;i++)
        cityGround.streets.push({a:points[i-1],b:points[i],width:rows[i][0].distanceTo(rows[i][1])});
      return points;
    }
    function nearestShore(p) {
      let nearest, distance = Infinity;
      for (let i=1;i<LAKE.length;i++) {
        const [ax,az] = LAKE[i-1], [bx,bz] = LAKE[i];
        const dx = bx-ax, dz = bz-az, length2 = dx*dx+dz*dz;
        if (length2 < 1e-9) continue;
        const t = THREE.MathUtils.clamp(((p.x-ax)*dx+(p.z-az)*dz)/length2,0,1);
        const q = V(ax+t*dx,LAND_Y,az+t*dz), d = p.distanceToSquared(q);
        if (d < distance) { nearest=q; distance=d; }
      }
      return nearest;
    }

    const mouths = [];
    const shoreX = z => nearestShore(V(xingyin.position.x-8,LAND_Y,z)).x;
    const lakesideWalk = z => V(shoreX(z)-4.75-.22*Math.sin((z+174)*.18),LAND_Y+.147,z);

    // Coordinates of the model's last two deck stations, in its local X/Y/Z frame.
    function connectFootbridges() {
      for (const [name,start,end,width] of [
        ['荷风桥',[-.49,1.05,31.45],[-.65,.91,35.7],3.58],
        ['落羽桥',[-16.08,1.01,-21.55],[-21.55,.90,-26.48],2.93]
      ]) {
        const previous = local(xingyin,...start), tip = local(xingyin,...end);
        const bank = nearestShore(tip);
        const inward = V(bank.x-tip.x,0,bank.z-tip.z).normalize();
        const tangent = V(tip.x-previous.x,0,tip.z-previous.z).normalize();
        const throat = tip.clone().addScaledVector(tangent,.52).addScaledVector(inward,.46);
        throat.y = tip.y + .035;
        const lip = bank.clone().addScaledVector(inward,-.48); lip.y = LAND_Y+.075;
        const land = bank.clone().addScaledVector(inward,1.82);
        land.y = landHeightAt(land)+.129;
        const walk = lakesideWalk(land.z+(name==='荷风桥' ? .9 : -.9));
        walk.x+=.58;
        const controls = [tip,throat,lip,land,walk];
        const nodes = new THREE.CatmullRomCurve3(controls).getPoints(12);
        const endRow = section(previous,tip,tip,width*xingyin.scale.x);
        const rows = [endRow,...nodes.slice(1).map((p,i)=>section(nodes[i],nodes[Math.min(i+2,nodes.length-1)],p,
          THREE.MathUtils.lerp(width*xingyin.scale.x,1.51,Math.sin((i+1)/12*Math.PI*.72))))];
        ribbon(name+' · 贴岸石质登陆台','东湖听涛',curb,'BankStone',rows.slice(0,10),
          p=>onLand(p.x,p.z) ? landHeightAt(p)-.12 : -.18);
        ribbon(name+' · 岸上步径','东湖听涛',stone,'Path',rows.slice(9));
        pathRecord(landmarkGrounds.xingyin,rows);
        landmarkGrounds.xingyin.bridges.push({name,endFace:[endRow[0],tip,endRow[1]],land});
        mouths.push({tip, bank});
        landmarkGrounds.xingyin.shade.push(walk.clone().add(V(-4.0,0,2.1)));
      }
    }
    connectFootbridges();
    function plantLakeBank() {
      // A shallow, scalloped bank connects the two landings without filling the channel.
      const middle = (mouths[0].bank.z+mouths[1].bank.z)/2;
      const margin = Math.abs(mouths[0].bank.z-mouths[1].bank.z)/2+10.5;
      const points=[], indices=[], foot=[], promenade=[], tufts=new Acc();
      for (let i=0;i<=40;i++) {
        const z=middle+margin*(i/20-1), bank=shoreX(z);
        const blend=1-THREE.MathUtils.smoothstep(Math.abs(z-middle),margin-5.8,margin);
        const scallop=Math.max(...mouths.map(({tip,bank})=>Math.max(0,tip.x-bank.x-.72)*
          (1-THREE.MathUtils.smoothstep(Math.abs(z-tip.z),.3,5.8))));
        const edge=bank+scallop+.32*blend*Math.sin((z-middle)*.32);
        points.push(V(bank-5.4-(7.55+1.90*Math.sin(z*.27))*blend,LAND_Y-.027,z),
                    V(bank-5.1-3.65*blend,LAND_Y+.063*blend,z), V(bank-4.75,LAND_Y+.113*blend,z),
                    V(bank-.40,LAND_Y+.085*blend,z), V(edge,LAND_Y-.21*blend,z));
        foot.push([V(edge-.02,LAND_Y-.20*blend,z),V(edge+.33,LAND_Y-.55*blend,z)]);
        if(i) for(let c=0;c<4;c++) {
          const a=(i-1)*5+c,b=a+1,d=a+5,e=d+1;
          indices.push(a,d,b,b,d,e);
        }
        const p=lakesideWalk(z);
        p.y=LAND_Y+.113*blend+.027;
        const w=1.30*THREE.MathUtils.lerp(.25,1,blend);
        promenade.push([V(p.x-w/2,p.y,z),V(p.x+w/2,p.y,z)]);
        if (i%4===1 && blend>.56) {
          const x=bank-8.1-.55*Math.sin(z*.69);
          for (const offset of [-.24,.19]) tufts.place(tuftShape,x+offset,LAND_Y+.14*blend,z+offset*.58,.27,.19,.22,z);
        }
      }
      faces('听涛 · 两桥间落岸草坡','东湖听涛',shoreGrass,'BankGrass',points,indices);
      ribbon('听涛 · 岸脚浅石','东湖听涛',curb,'BankStone',foot,p=>p.y-.30);
      ribbon('听涛 · 连续岸侧步道','东湖听涛',stone,'Path',promenade);
      surface('听涛 · 岸草','东湖听涛',lakesideGrass,'BankGrass',tufts.mesh(lakesideGrass,false).geometry);
      pathRecord(landmarkGrounds.xingyin,promenade);
      for (const z of [-193,-183,-173,-161,-153]) {
        const p=lakesideWalk(z); p.x-=4.7;
        landmarkGrounds.xingyin.shade.push(p);
      }
    }

    plantLakeBank();

    // North forecourt faces the Donghu Road gate of the original museum.
    function buildNorthForecourt() {
      const stations = [[12.22,8.5],[16.70,10.3],[20.6,27.5],[28.8,27.5],[34.2,18.7],[40.4,10.4],[48.5,8.8]];
      const rows = stations.map(([z,w])=>[-w/2,w/2].map(x=>{
          const p=plan(museum,x,z); p.y=landHeightAt(p)+.041; return p;
        }));
      ribbon('省博北馆 · 中轴石铺前庭','湖北省博物馆',terrace,'Path',rows);
      pathRecord(landmarkGrounds.museum,rows);
      landmarkGrounds.museum.lines = [-3.6,0,3.6].map(x=>stations.map(([,w],i)=>rows[i][0].clone().lerp(rows[i][1],.5+x/w)));
      const band = new Acc(), beds = new Acc(), shrubs = new Acc();
      const box = (batch,x,z,w,d,h,offset=0) => {
        const p=plan(museum,x,z), y=landHeightAt(p)+h/2+offset;
        batch.box(w*museum.scale.x,h,d*museum.scale.z,p.x,y,p.z,museum.rotation.y);
      };
      for (const z of [18.5,21.6,24.7,27.8,30.9,34,37.1,40.2,43.3,46.4])
        box(band,0,z,8.38,.075,.016,.042);
      for (const x of [-5.05,5.05])
        box(band,x,25.45,.12,15.25,.022,.043);
      for (const sign of [-1,1]) {
        for (const z of [23.95,27.35,32.8]) {
          const x=sign*(z > 30 ? 7.2 : 9.2);
          box(beds,x,z,z > 30 ? 3.04 : 5.10,2.66,.115,.045);
        }
        const wing = [plan(museum,sign*10.9,20.9),plan(museum,sign*17.8,20.25),plan(museum,sign*22,16.01)];
        for (const p of wing) p.y=landHeightAt(p)+.065;
        const row = wing.map((p,i)=>section(wing[Math.max(0,i-1)],wing[Math.min(i+1,wing.length-1)],p,2.15));
        ribbon('省博北馆 · '+(sign<0?'东':'西')+'翼步道','湖北省博物馆',stone,'Path',row);
        pathRecord(landmarkGrounds.museum,row);
        const sideYard=[[26.1,11.4,20.6],[28.3,9.1,22.9],[37.8,9.35,22.5],
          [42.4,11.7,22.4],[46.8,14.4,19.8]].map(([z,a,b])=>(sign<0?[-b,-a]:[a,b]).map(x=>{
            const p=plan(museum,x,z);
            p.y=landHeightAt(p)+.037;
            return p;
          }));
        ribbon('省博北馆 · '+(sign<0?'东':'西')+'侧庭','湖北省博物馆',lakesideGrass,'BankGrass',sideYard);
        for(const [k,z] of [29.8,31.5,33.2,34.9,40.8,42.5,44.2].entries()){
          const p=plan(museum,sign*(21.8+.27*Math.sin(k*2.3)),z), y=landHeightAt(p);
          shrubs.place(tuftShape,p.x,y+.19,p.z,.71,.42+.07*(k%3),.70,museum.rotation.y+k*.27);
        }
        for(const [x,z] of [[12.2,34.1],[19.0,39.2],[12.0,45.4],[25.0,51.8]])
          landmarkGrounds.museum.shade.push(plan(museum,sign*x,z));
        const gate=plan(museum,sign*5.55,46.75), y=landHeightAt(gate);
        band.box(.66,1.53,.66,gate.x,y+.765,gate.z,museum.rotation.y);
        band.box(.78,.14,.78,gate.x,y+1.59,gate.z,museum.rotation.y);
      }
      surface('省博北馆 · 石带与前庭界柱','湖北省博物馆',curb,'Masonry',band.mesh(curb,false).geometry);
      surface('省博北馆 · 低矮绿地边框','湖北省博物馆',M.bankGrass,'BankGrass',beds.mesh(M.bankGrass,false).geometry);
      surface('省博北馆 · 侧庭低灌木','湖北省博物馆',lakesideGrass,'BankGrass',shrubs.mesh(lakesideGrass,false).geometry);
      const sidewalk = [[-35,48.9,.25],[-30,48.65,1.35],[-20,48.35,2.4],[-4.4,49.68,2.36],
        [4.4,49.68,2.36],[20,48.35,2.4],[30,48.65,1.35],[35,48.9,.25]]
        .map(([x,z,width])=>[z+width/2,z-width/2].map(s=>{
          const p=plan(museum,x,s);p.y=landHeightAt(p)+.052;return p;
        }));
      ribbon('省博北馆 · 东湖路人行带','湖北省博物馆',stone,'Path',sidewalk);
      pathRecord(landmarkGrounds.museum,sidewalk);
    }

    buildNorthForecourt();

    // Extend the two native stair flights straight down the sampled shoulders.
    function buildTowerStairs() {
      const stair = new Acc(), wall = new Acc(), coping = new Acc();
      for (const sign of [-1,1]) {
        const start=15.465,end=sign < 0 ? 32.1 : 31.12, count=Math.ceil((end-start)/.23), run=(end-start)/count;
        const top = local(tower,0,.31,sign*start).y;
        const path = [], edges = [];
        const treads = Array.from({length:count},(_,i)=>{
          const a=start+i*run,b=a+run,mid=(a+b)/2;
          const upperHalf=THREE.MathUtils.lerp(3.2,1.68,THREE.MathUtils.smoothstep(mid,start,start+4.4));
          const half=THREE.MathUtils.lerp(upperHalf,.97,THREE.MathUtils.smoothstep(mid,end-3.45,end));
          const probes=[a,mid,b].flatMap(z=>[-half,0,half].map(x=>landHeightAt(plan(tower,x,sign*z))));
          const crest=Math.max(...probes)+.055;
          const y=Math.max(crest,THREE.MathUtils.lerp(top,crest,THREE.MathUtils.smoothstep(mid,start,start+5.2)));
          return {a,b,mid,half,probes,y};
        });
        for(let i=count-2;i>=0;i--) treads[i].y=Math.max(treads[i].y,treads[i+1].y);
        for (const [i,{a,b,mid,half,probes,y}] of treads.entries()) {
          const foot=Math.min(y-.21,...probes)-.055;
          const p=plan(tower,0,sign*mid); p.y=y;
          stair.box(half*2*tower.scale.x,y-foot,run*tower.scale.z,p.x,(y+foot)/2,p.z,tower.rotation.y);
          const edge=section(plan(tower,0,sign*a),plan(tower,0,sign*b),p,half*2*tower.scale.x);
          path.push(p); edges.push(edge);
          if (i >= 6 && i < count-4) for (const sx of [-1,1]) {
            const q=plan(tower,sx*(half+.18),sign*mid), h=.22+(.12*THREE.MathUtils.smoothstep(mid,start+3,start+9));
            const floor=Math.min(y-.09,landHeightAt(q)-.04);
            wall.box(.33,y+h-floor,run*tower.scale.z,q.x,(y+h+floor)/2,q.z,tower.rotation.y);
            coping.box(.42,.075,run*tower.scale.z,q.x,y+h+.029,q.z,tower.rotation.y);
          }
        }
        const last=path.at(-1), toe=plan(tower,0,sign*end);
        const turn=plan(tower,sign*.65,sign*(end+1.45)),finish=plan(tower,sign*2.35,sign*(end+3.25));
        toe.y=last.y+.005;
        turn.y=finish.y=toe.y;
        const apron=new THREE.CatmullRomCurve3([toe,turn,finish]).getPoints(16);
        const rows=apron.map((p,i)=>section(apron[Math.max(0,i-1)],apron[Math.min(i+1,apron.length-1)],p,1.69)
          .map(q=>{
            const field=landHeightAt(q)+.075;
            q.y=Math.max(field,THREE.MathUtils.lerp(toe.y,field,Math.min(1,i/2)));
            return q;
          }));
        rows[0]=section(last,toe,toe,1.69);
        ribbon('黄鹤楼 · '+(sign<0?'后':'前')+'坡石径','蛇山',hillsideStone,'Path',rows,
          p=>Math.min(p.y-.20,landHeightAt(p)-.08));
        pathRecord(landmarkGrounds.tower,rows);
        pathRecord(landmarkGrounds.tower,edges);
        landmarkGrounds.tower.steps.push({side:sign, treads:path, sections:edges, landing:toe});
        landmarkGrounds.tower.shade.push(plan(tower,-sign*5.95,sign*(end-1.5)), plan(tower,sign*10.3,sign*(end+4.3)));
      }
      surface('黄鹤楼 · 贴坡石阶','蛇山',hillsideStone,'Path',stair.mesh(hillsideStone,false).geometry);
      surface('黄鹤楼 · 石阶矮护墙','蛇山',curb,'Masonry',wall.mesh(curb,false).geometry);
      surface('黄鹤楼 · 护墙压顶','蛇山',terrace,'Path',coping.mesh(terrace,false).geometry);
    }
    buildTowerStairs();
  }
  buildLandmarkGrounds();
