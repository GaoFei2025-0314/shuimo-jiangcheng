  /* 西区总平依《黄鹤楼设计纪事》图4-1-6及4-1-8；按现有蛇山地形压缩进深。 */
  function buildTowerPark() {
    const group = '黄鹤楼公园西区';
    const result = { assets: [], assetBounds: [], surfaces: [], paths: [], courts: [], plantBeds: [], bounds: new THREE.Box3(), axis: {} };
    const flagstone = inkMat(.37, false, ['#827561', '#d2be9f']);
    flagstone.fragmentShader=flagstone.fragmentShader.replace('col = mix(col, uFog,', `
      vec2 paving = vec2(dot(vW.xz, vec2(.984,-.179)), dot(vW.xz, vec2(.179,.984))) / vec2(1.15,.73);
      paving.x += mod(floor(paving.y),2.) * .5;
      vec2 halves = abs(fract(paving)-.5);
      float joint = smoothstep(.474,.50,max(halves.x,halves.y));
      col *= 1. - joint * .074 * (1.-smoothstep(38.,110.,vD));
      col = mix(col, uFog,`);
    const paleStone = inkMat(.43, false, ['#8a7b65', '#e1d1ac']);
    const masonry = inkMat(.23, false, ['#6e6657', '#ac9d81']);
    const pond = inkMat(.50, false, ['#536c5d', '#8caa97']);
    tower.updateMatrixWorld(true);
    const at = (x,z,y) => {
      const p = tower.localToWorld(V(x,0,z));
      p.y = y ?? (plantingSurface(p.x,p.z) ?? LAND_Y);
      return p;
    };
    const ground = ({x,z}) => plantingSurface(x,z) ?? LAND_Y;
    const ownsLand = p => onLand(p.x,p.z);
    const local2 = ([x,z]) => new THREE.Vector2(x,z);
    const districtPaths = cityGround.streets.filter(s=>s.group==='武昌古城' && s.a.x>-65 && s.a.x<10);
    function nearStreet(p) {
      return districtPaths.some(({a,b,width})=>{
        const dx=b.x-a.x,dz=b.z-a.z, u=THREE.MathUtils.clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz),0,1);
        return Math.hypot(p.x-a.x-u*dx,p.z-a.z-u*dz)<width*.5+.20;
      });
    }

    function surface(name, key, mat, geometry, frame = true) {
      const mesh = new THREE.Mesh(geometry,mat);
      mesh.name = name;
      mesh.userData.landscapeSurface = {group,name,material:key};
      scene.add(mesh);
      result.surfaces.push(mesh);
      if (frame) result.bounds.union(new THREE.Box3().setFromObject(mesh));
      return mesh;
    }
    function faces(name,key,mat,positions,indices,frame) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions.flatMap(p=>p.toArray()),3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return surface(name,key,mat,geometry,frame);
    }
    function paving(name,poly,y,mat,key,holes=[]) {
      const rings = [poly,...holes], positions = rings.flatMap(ring=>ring.map(([x,z])=>at(x,z,y)));
      const tris = THREE.ShapeUtils.triangulateShape(poly.map(local2),holes.map(ring=>ring.map(local2)));
      const indices = tris.flatMap(([a,b,c]) => {
        const [p,q,r] = [positions[a],positions[b],positions[c]];
        return (q.x-p.x)*(r.z-p.z) > (q.z-p.z)*(r.x-p.x) ? [a,c,b] : [a,b,c];
      });
      return faces(name,key,mat,positions,indices);
    }
    function course(name,mat,key,rows,closed=false,frame=true) {
      const positions = rows.flat(), n = rows.length, columns=rows[0].length;
      const indices = [];
      for (let i=0; i<n-(closed?0:1); i++) {
        for (let j=0; j<columns-1; j++) {
          const a=i*columns+j,b=columns*((i+1)%n)+j;
          for (const tri of [[a,a+1,b],[a+1,b+1,b]]) {
            const [p,q,r] = tri.map(k=>positions[k]);
            if (q.clone().sub(p).cross(r.clone().sub(p)).lengthSq() > 1e-12 &&
                triangleOnLand(p.toArray(),q.toArray(),r.toArray())) indices.push(...tri);
          }
        }
      }
      return faces(name,key,mat,positions,indices,frame);
    }
    function platform(name,poly,level,holes=[]) {
      const polygon = poly.map(([x,z])=>at(x,z,level));
      result.courts.push({name,polygon,y:level});
      paving(name,poly,level,flagstone,'Path',holes);
      const center = polygon.reduce((sum,p)=>sum.add(p),V(0,0,0)).multiplyScalar(1/polygon.length);
      const edge = [];
      for (let i=0; i<polygon.length; i++) {
        const a=polygon[i], b=polygon[(i+1)%polygon.length], steps=Math.ceil(a.distanceTo(b)/.62);
        for (let j=0; j<steps; j++) edge.push(a.clone().lerp(b,j/steps));
      }
      const retaining = edge.map(p=>[p.clone().setY(Math.max(ground(p)-.05,level-.52)),p.clone()]);
      course(name+' · 石砌台沿',masonry,'Masonry',retaining,true,false);
      const columns=6;
      const banks = retaining.map(([p])=>{
        const outward=V(p.x-center.x,0,p.z-center.z).normalize();
        const reach=THREE.MathUtils.clamp((p.y-ground(p))*1.65,.20,4.8);
        let distance=reach, q=p.clone().addScaledVector(outward,distance);
        while (distance>.09 && (!ownsLand(q) || nearStreet(q) || (roadAt(q.x,q.z)?.distance ?? Infinity)<approachHalfWidth+.7)) {
          distance*=.62;
          q.copy(p).addScaledVector(outward,distance);
        }
        const raise=p.y-ground(p);
        return Array.from({length:columns},(_,i)=>{
          const t=i/(columns-1), point=p.clone().lerp(q,t);
          const height=ground(point)+raise*(1-THREE.MathUtils.smoothstep(t,0,1))-.018*t;
          return point.setY(height);
        });
      });
      // The embankment uses the same elevation wash and surface sampler as Snake Hill.
      const bankPoints=banks.flat(), indices=[];
      for (let i=0;i<banks.length;i++) for (let j=0;j<columns-1;j++) {
        const a=i*columns+j,b=((i+1)%banks.length)*columns+j;
        for (const tri of [[a,b,a+1],[a+1,b,b+1]]) {
          if (triangleOnLand(...tri.map(k=>bankPoints[k].toArray()))) indices.push(...tri);
        }
      }
      const bank=faces(name+' · 台缘草土收坡','Hills',M.hill,bankPoints,indices,false);
      registerPlantingSurface(bank.geometry);
    }

    // Shared cross sections seal the risers while keeping each tread horizontal.
    function stepped(name,points,width,throat=[width,width],startSection,endSection) {
      const route=new THREE.CatmullRomCurve3(points), span=Math.ceil(route.getLength()/.30);
      const nodes=route.getSpacedPoints(span), rows=[], tops=[], sides=[];
      const widthAt=t=>THREE.MathUtils.lerp(throat[0],width,THREE.MathUtils.smoothstep(t,0,.25))
        +THREE.MathUtils.smoothstep(t,.60,1)*(throat[1]-width);
      const sections=nodes.map((p,i)=>{
        const a=i===nodes.length-1 ? points.at(-2) : nodes[Math.max(0,i-1)];
        const b=i===0 ? points[1] : nodes[Math.min(nodes.length-1,i+1)];
        let half=widthAt(i/span)*.5;
        if (i>0 && i<nodes.length-1) {
          const incoming=V(p.x-a.x,0,p.z-a.z), outgoing=V(b.x-p.x,0,b.z-p.z);
          const run=Math.min(incoming.length(),outgoing.length());
          const bend=Math.sqrt(.5*(1-THREE.MathUtils.clamp(incoming.normalize().dot(outgoing.normalize()),-1,1)));
          if (bend>.015) half=Math.min(half,.39*run/bend);
        }
        const normal=V(a.z-b.z,0,b.x-a.x).normalize().multiplyScalar(half);
        return [p.clone().add(normal),p.clone().sub(normal)];
      });
      if (startSection) sections[0]=startSection;
      if (endSection) sections[span]=endSection;
      const quad=(target,a,b,c,d)=>target.push(a,b,c,c,b,d);
      let prior;
      for (let i=0; i<nodes.length-1; i++) {
        const a=nodes[i], b=nodes[i+1], first=sections[i], next=sections[i+1];
        const middle=first.map((p,k)=>p.clone().lerp(next[k],.5));
        const samples=[first,middle,next].flatMap(([left,right])=>[0,.25,.50,.75,1].map(t=>left.clone().lerp(right,t)));
        if (!samples.every(ownsLand)) continue;
        const target=i===0 ? a.y : i===nodes.length-2 ? b.y : (a.y+b.y)*.5;
        const crest=Math.max(target,Math.max(...samples.map(ground))+.062);
        const [a0,a1,b0,b1]=[...first,...next].map(p=>p.clone().setY(crest));
        if (i===0 && startSection) { a0.y=first[0].y; a1.y=first[1].y; }
        if (i===span-1 && endSection) { b0.y=next[0].y; b1.y=next[1].y; }
        const foot=p=>p.clone().setY(Math.min(crest-.07,ground(p)-.06));
        quad(tops,a0,b0,a1,b1);
        quad(sides,foot(a0),foot(b0),a0,b0);
        quad(sides,foot(b1),foot(a1),b1,a1);
        if (prior && Math.abs(prior[0].y-crest)>.004) {
          if (crest>prior[0].y) quad(sides,prior[1],prior[0],a1,a0);
          else quad(sides,prior[0],prior[1],a0,a1);
        }
        prior=[b0,b1];
        const mid=a.clone().lerp(b,.5).setY((a0.y+a1.y+b0.y+b1.y)*.25);
        rows.push(mid);
        cityGround.streets.push({a,b,width:(a0.distanceTo(a1)+b0.distanceTo(b1))*.5,group,name});
      }
      if (rows.length) {
        faces(name,'Path',paleStone,tops,tops.map((_,i)=>i));
        faces(name+' · 阶侧石砌', 'Masonry',masonry,sides,sides.map((_,i)=>i),false);
      }
      result.paths.push([points[0],...rows,points.at(-1)]);
      return prior;
    }
    function flatWalk(name,points,width,street=false) {
      const controls = points.map(([x,z])=>at(x,z));
      const spline = new THREE.CatmullRomCurve3(controls);
      const nodes = spline.getSpacedPoints(Math.ceil(spline.getLength()/.45));
      const rows = nodes.map((p,i)=>{
        const a=nodes[Math.max(0,i-1)], b=nodes[Math.min(nodes.length-1,i+1)], dx=b.x-a.x, dz=b.z-a.z;
        const normal=V(-dz,0,dx).normalize();
        const t=i/(nodes.length-1);
        const stationWidth=street ? THREE.MathUtils.lerp(width,1.04,THREE.MathUtils.smoothstep(t,.61,1))
          : width+1.03*THREE.MathUtils.smoothstep(t,0,.34)*(1-THREE.MathUtils.smoothstep(t,.48,.96));
        const offsets=street ? [-.5,-.25,0,.25,.5] : [-.5,.5];
        return offsets.map(side=>{
          const q=p.clone().addScaledVector(normal,stationWidth*side);
          q.y=ground(q)+(street ? .098-.022*t : .074);
          return q;
        });
      });
      course(name,street ? flagstone : paleStone,'Path',rows);
      if (!street) result.paths.push(rows.map(([a,b])=>a.clone().lerp(b,.5)));
      for (let i=1;i<nodes.length;i++) cityGround.streets.push({a:nodes[i-1],b:nodes[i],width:rows[i][0].distanceTo(rows[i].at(-1)),group,name});
      return rows.at(-1).slice().reverse();
    }
    function model(key,name,x,z,y,scale,turn=0) {
      if (!ARCHITECTURE[key]) throw new Error('Missing Yellow Crane Tower park asset: '+key);
      const asset=builtLandmark(key);
      delete asset.userData.modelKey;
      asset.userData.parkAsset=key;
      asset.userData.name=asset.name=name;
      asset.scale.setScalar(scale);
      asset.rotation.y=tower.rotation.y+turn;
      asset.position.copy(at(x,z,y));
      scene.add(asset);
      asset.updateMatrixWorld(true);
      result.assets.push(asset);
      const bounds=new THREE.Box3().setFromObject(asset);
      result.assetBounds.push(bounds);
      result.bounds.union(bounds);
    }

    const lower=4.66, middle=10.88, upper=14.36;
    const lowCourt=[[-47.6,-20.8],[-45.3,-22.6],[-42.3,-22.2],[-40.6,-20.0],[-40.6,-16.8],[-42.1,-15.7],[-45.3,-15.7],[-47.5,-17.3]];
    const gateCourt=[[-29.0,-20.35],[-25.6,-20.35],[-24.20,-18.4],[-24.20,-10.2],[-25.65,-8.15],[-29.0,-8.15]];
    const highCourt=[[-19.0,-10.4],[-16.45,-10.55],[-13.65,-9.65],[-12.55,-7.9],[-12.55,9.15],[-14.05,10.55],
      [-16.9,10.55],[-17.6,5.40],[-19.4,1.4],[-20.30,-3.2],[-20.30,-7.1]];
    const ring = (rx,rz) => Array.from({length:40},(_,i)=>{
      const t=i/40*Math.PI*2;
      return [-16.55+rx*Math.cos(t),-1.22+rz*Math.sin(t)];
    });
    const poolHole=ring(2.55,3.88), basin=ring(2.33,3.66);
    platform('胜像宝塔 · 西门下院',lowCourt,lower);
    platform('三楚一楼 · 牌坊中院',gateCourt,middle);
    platform('黄鹤归来 · 楼前上院',highCourt,upper,[poolHole]);
    paving('归鹤池 · 池水',basin,upper-.155,pond,'Water');
    paving('归鹤池 · 石压边',poolHole,upper+.039,paleStone,'BankStone',[basin]);
    course('归鹤池 · 池壁',masonry,'Masonry',basin.map(([x,z])=>[at(x,z,upper+.039),at(x,z,upper-.172)]),true,false);
    course('归鹤池 · 外压边',paleStone,'BankStone',poolHole.map(([x,z])=>[at(x,z,upper),at(x,z,upper+.039)]),true,false);

    // Low stone balustrades frame the pool, with two open stone approaches.
    const piers = new Acc();
    for (let i=0;i<poolHole.length;i+=2) {
      const [x,z]=poolHole[i], a=at(x,z,upper+.22);
      if (Math.abs(z+1.22)<1.39) continue;
      const q=poolHole[(i+2)%poolHole.length];
      piers.box(.16,.42,.16,a.x,a.y,a.z,tower.rotation.y);
      if (Math.abs(q[1]+1.22)<1.39) continue;
      const b=at(...q,upper+.325), cap=a.clone().setY(b.y);
      piers.beam(cap,b,.085);
      piers.beam(cap.clone().setY(upper+.16),b.clone().setY(upper+.16),.065);
    }
    surface('归鹤池 · 望柱与低栏','BankStone',paleStone,piers.mesh(paleStone,false).geometry);

    // Low enclosing walls follow selected garden edges and leave the gate and paths open.
    const gardenWalls=new Acc(), wallCaps=new Acc();
    for (const [height,segments] of [[lower,[[[-47.35,-20.8],[-45.20,-22.34]],[[-45.18,-22.34],[-42.5,-22.0]]]],
      [middle,[[[-28.86,-19.92],[-25.7,-19.92]],[[-28.83,-8.36],[-26,-8.36]]]],
      [upper,[[[-16.65,10.12],[-14.23,10.12]],[[-19.03,1.11],[-17.26,5.00]]]]]) {
      for (const [a,b] of segments) {
        const p=at(...a,height), q=at(...b,height), c=p.clone().lerp(q,.5);
        const yaw=Math.atan2(q.x-p.x,q.z-p.z), length=p.distanceTo(q)+.06;
        gardenWalls.box(.29,.42,length,c.x,height+.18,c.z,yaw);
        wallCaps.box(.39,.08,length+.05,c.x,height+.42,c.z,yaw);
      }
    }
    surface('西区 · 三院矮石墙','Masonry',masonry,gardenWalls.mesh(masonry,false).geometry,false);
    surface('西区 · 墙顶石条','BankStone',paleStone,wallCaps.mesh(paleStone,false).geometry,false);
    const slopeStone=new Acc(), stoneShape=new THREE.IcosahedronGeometry(1,0);
    for (const [x,z,s] of [[-24.3,-5.85,.27],[-24.0,-6.12,.19],[-22.45,-1.75,.23],[-22.06,-1.45,.17],
      [-19.5,4.47,.31],[-19.24,4.84,.24],[-18.34,8.55,.22],[-18.13,8.71,.17],[-38.2,-20.8,.21],[-37.81,-20.45,.15]]) {
      const p=at(x,z);
      slopeStone.place(stoneShape,p.x,p.y+.035,p.z,s*1.45,s*.55,s,Math.atan2(z,x));
    }
    surface('西区 · 山脚散石','Masonry',masonry,slopeStone.mesh(masonry,false).geometry,false);

    function streetAt(z) {
      for (const {a,b,name} of districtPaths) {
        if (name!=='蛇山东麓土径') continue;
        const p=tower.worldToLocal(V(a.x,0,a.z)), q=tower.worldToLocal(V(b.x,0,b.z));
        if ((p.z>z)===(q.z>z)) continue;
        return V(THREE.MathUtils.lerp(p.x,q.x,(z-p.z)/(q.z-p.z)),0,z);
      }
      return V(-35.3,0,z);
    }
    const streetLocal=streetAt(-11.0), streetTurn=streetAt(-12.20), cross=streetAt(-16.6);
    const crossing=at(cross.x,cross.z);
    crossing.y=ground(crossing)+.068;
    const lowerMouth=at(-43.2,-15.7,lower);
    const doorSection=flatWalk('西区 · 山脚街口',[[streetLocal.x,streetLocal.z],[streetTurn.x-.72,streetTurn.z+.12],[-36.56,-12.60],[-37.45,-12.97]],.94);
    const threshold=doorSection[0].clone().lerp(doorSection[1],.5);
    stepped('西区 · 西门石阶',[threshold,at(-39.0,-13.51,3.84),at(-41.20,-13.85,4.11),at(-42.40,-14.23,4.37),
      at(-43.20,-14.96,4.52),lowerMouth],1.65,[.94,1.54],doorSection);
    const trailSection=stepped('西区 · 宝塔上行至山径',[at(-40.6,-18.05,lower),at(-37.8,-17.55,5.65),crossing],2.50);
    stepped('西区 · 山径上行至牌坊',[crossing,at(cross.x+1.62,cross.z+.36,9.18),at(-30.25,-14.74,10.29),
      at(-29.70,-14.49,10.56),at(-29,-14.49,middle)],2.50,[2.50,2.50],trailSection);
    stepped('西区 · 由牌坊至归鹤池',[at(-24.20,-11.15,middle),at(-23.30,-11.15,11.28),at(-22.69,-10.51,11.62),
      at(-22.52,-8.90,11.81),at(-22.34,-7.18,12.30),at(-21.48,-5.62,13.45),at(-20.30,-5.62,upper)],1.70,[.86,1.15]);

    const existing = landmarkGrounds.tower.steps.find(s=>s.side===-1).sections;
    const westEdge=i=>existing[i].reduce((a,b)=>a.x<b.x?a:b);
    const west=westEdge(4), oldTread=west.clone().lerp(existing[4].find(p=>p!==west),.014);
    const stairThroat=[3,5].map(i=>oldTread.clone().add(westEdge(i).clone().sub(west)));
    const courtEdge=x=>at(x,-10.55+.90*(x+16.45)/2.8,upper);
    const courtThroat=[courtEdge(-14.78),courtEdge(-16.22)];
    stepped('西区 · 绕台接主楼侧阶',[courtEdge(-15.50),at(-13.25,-14.55,14.48),at(-9.70,-16.2,west.y),oldTread],1.33,[1.33,.60],courtThroat,stairThroat);

    const streetOrigin=at(streetLocal.x,streetLocal.z);
    const oldWay=districtPaths.filter(s=>s.name==='蛇山东麓土径' && s.a.z<streetOrigin.z-.25 && s.a.z>-16.4)
      .map(s=>tower.worldToLocal(V(s.a.x,0,s.a.z)));
    flatWalk('西区 · 山径接西门石坪',[[streetLocal.x,streetLocal.z],...oldWay.map(p=>[p.x,p.z])],1.62,true);

    model('park_stupa','胜像宝塔',-44.1,-19.2,lower,.73);
    model('park_paifang','三楚一楼牌坊',-26.6,-14.49,middle,.49,-Math.PI/2);
    model('park_cranes','黄鹤归来铜雕',-16.55,-1.22,upper-.19,.71,-Math.PI/2);
    model('park_pavilion','西区 · 北侧游亭',-17.17,-7.60,upper,.54,-Math.PI/2);
    model('park_pavilion','西区 · 南侧游亭',-14.97,7.30,upper,.52,-Math.PI/2);
    result.axis={entry:at(-44.1,-19.2,lower),gate:at(-26.6,-14.49,middle),pool:at(-16.55,-1.22,upper),tower:at(-12.4,0,upper)};

    // Two loose colonies on the pool embankment leave the stairs and the view axis open.
    const undergrowth = [
      [[-21.72,-2.76,.70,1.04],[-21.24,-1.64,.45,.65],[-22.08,-1.34,.56,.82],[-21.77,-.35,.53,.72],[-21.50,1.05,.42,.52]],
      [[-19.36,4.45,.56,.68],[-19.02,5.73,.73,1.17],[-18.72,6.72,.47,.58],[-18.90,7.64,.56,.80],[-18.05,8.19,.61,.95]]
    ];
    const leaf = new THREE.IcosahedronGeometry(1,1), foliage = new Acc(), shadedFoliage = new Acc();
    const leafWash = inkMat(.26,false,['#51634d','#879879']);
    const shadeWash = inkMat(.18,false,['#455744','#75896d']);
    const parkStreets = cityGround.streets.filter(s=>s.group===group ||
      (!s.group && s.a.x>-32 && s.a.x<15 && Math.abs(s.a.z)<28));
    function distanceFrom(p,a,b) {
      const dx=b.x-a.x,dz=b.z-a.z, t=THREE.MathUtils.clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz || 1),0,1);
      return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);
    }
    for (const [side,colony] of undergrowth.entries()) for (const [i,[x,z,spread,height]] of colony.entries()) {
      const p=at(x,z);
      if (!ownsLand(p) || BRIDGES.some(([a,b])=>distanceFrom(p,a,b)<12+spread) ||
          (roadAt(p.x,p.z)?.distance ?? Infinity)<approachHalfWidth+spread+.45 ||
          parkStreets.some(({a,b,width})=>distanceFrom(p,a,b)<width*.5+spread+.28)) continue;
      const angle=side*.31+i*1.53;
      for (const [k,[dx,dz,size,lift]] of [[0,0,1,.34],[-.35,.18,.68,.30],[.23,-.31,.69,.44],[.18,.23,.52,.65]].entries()) {
        const q=at(x+spread*(Math.cos(angle)*dx-Math.sin(angle)*dz),z+spread*(Math.sin(angle)*dx+Math.cos(angle)*dz));
        const mass=(i+k+side)%3===0 ? shadedFoliage : foliage;
        mass.place(leaf,q.x,q.y+height*lift,q.z,spread*size,height*(k===0?.39:.31),spread*size*.76,angle+k*.29);
      }
    }
    surface('西区 · 池院坡腰浅叶灌丛','BankGrass',leafWash,foliage.mesh(leafWash,false).geometry,false);
    surface('西区 · 池院坡腰背荫叶丛','Reeds',shadeWash,shadedFoliage.mesh(shadeWash,false).geometry,false);

    for (const [x,z,spread,height,species='broadleaf'] of [
      [-48.1,-24.7,.59,.58],[-45.9,-25.7,.77,.73,'pine'],[-42.1,-25.0,.68,.62],[-39.1,-23.1,.72,.69],
      [-35.9,-23.9,.69,.68],[-35.7,-21.8,.56,.51],[-31.1,-24.3,.73,.77,'pine'],[-29.7,-20.9,.79,.72,'pine'],
      [-27.0,-17.0,.60,.57],[-25.8,-14.7,.57,.53],[-23.1,-13.2,.63,.59],[-21.35,-14.9,.74,.67,'pine'],
      [-23.4,-2.7,.55,.48],[-21.8,2.0,.51,.48],[-22.1,5.9,.68,.63,'pine'],[-20.5,10.3,.71,.63],
      [-20.0,13.5,.84,.78],[-16.4,13.0,.65,.63,'pine'],[-13.2,14.1,.58,.56],[-17.5,-22.2,.72,.73,'pine'],
      [-32,-11,.48,.49],[-28,-5,.59,.60],[-25.9,-3,.48,.51],[-24,-1,.55,.54,'pine'],[-22,7,.56,.57],
      [-24.6,11.8,.52,.45],[-21,20,.68,.62],[-17,20,.57,.61,'pine'],[-38.22,-21.55,.46,.46],[-34,-21,.51,.50],[-20,-22,.60,.66],
      [-50,-27,.77,.81,'pine'],[-39.8,-26.8,.85,.87],[-38,-25,.49,.41],[-36,-27,.70,.75,'pine'],[-32.4,-27,.51,.52],
      [-28.2,.75,.61,.66],[-25.8,3.15,.44,.37],[-23.8,5.14,.55,.53,'pine'],[-23,14,.68,.65],[-22.9,17.9,.56,.48],[-19,22,.44,.45]
    ]) {
      const p=at(x,z);
      result.plantBeds.push({x:p.x,z:p.z,spread,height,species});
    }
    return result;
  }
  const towerPark = buildTowerPark();
