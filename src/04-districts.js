  /* 码头、坡街与支巷按原岸线和地标落位；街坊细部是画意概括。 */
  function buildDistrictRoutes(route, lot, reservePath) {
    function bankPoint(edge, i, side, offset) {
      const p = edge[i], a = edge[Math.max(0,i-1)], b = edge[Math.min(edge.length-1,i+1)];
      const dx = b[0]-a[0], dz = b[1]-a[1], length = Math.hypot(dx,dz) || 1;
      return { x: p[0]+side*dz/length*offset, z: p[1]-side*dx/length*offset };
    }
    const points = (...pairs) => pairs.map(([x,z]) => ({ x,z }));
    function local(site, ...pairs) {
      site.updateMatrixWorld(true);
      return pairs.map(([x,z]) => site.localToWorld(V(x,0,z)));
    }

    // The two bridges feed a continuous street on each bank. The first span
    // continues the actual bridgehead cross street at the same width and tangent.
    for (const [side, group, name, bends] of [
      [-1, '汉阳两桥街道', '汉阳桥间街道', [[-256,43],[-260,34],[-265,16],[-270,-3],[-279,-12],[-282,-19]]],
      [1, '武昌两桥街道', '武昌桥间街道', [[-28,117],[-22,100],[-14,85],[-8,69],[4,51],[8,38]]],
    ]) {
      const start = yingwuzhouNorthStreetEnd(side), junction = yingwuzhouJunction(side);
      const tangent = start.clone().sub(junction).setY(0).normalize();
      const lead = start.clone().addScaledVector(tangent, 2.4);
      const curve = new THREE.CatmullRomCurve3([lead, ...bends.map(([x,z]) => V(x,0,z))]);
      const centerline = [start, ...curve.getSpacedPoints(Math.ceil(curve.getLength()/2))];
      route({ group, name, points:centerline, width:3.9, surfaceLift:.022 });
      // Leave the junctions open and group verge trees along the intervening blocks.
      for (let k=6; k<centerline.length-4; k+=5) {
        const normal = centerline[k+1].clone().sub(centerline[k-1]).setY(0).normalize();
        const offset = k % 3 === 0 ? -4.4 : 4.7;
        cityGround.verges.push({x:centerline[k].x + normal.z*offset, z:centerline[k].z - normal.x*offset});
      }
    }

    // The municipal road hierarchy places Zhongbei, Donghu and Wuluo/Luoyu on these
    // axes. The map simplifies their detail around the registered lakes and hills.
    const north = points([27,-53],[53,-67],[74,-100],[84,-142],[94,-176],[112,-219],
      [142,-252],[188,-274],[244,-290],[293,-317],[321,-349],[347,-375],
      [385,-361],[421,-335],[448,-288],[452,-233],[445,-199]);
    const northEdge = points([321,-349],[331,-394],[343,-426],[380,-456],[417,-450]);
    const south = points([71,50],[91,61],[126,69],[166,75],[203,80],[222,94],[227,116],
      [244,138],[283,149],[318,155],[363,166],[399,184],[437,202],[475,217],[516,220]);
    const campus = points([399,184],[403,146],[418,119],[426,89],[438,62],[448,42],[457,42]);
    const group = '武昌内陆街廊';
    route({ group, name:'中北路至东湖路', points:north, width:3.36, plain:true });
    route({ group, name:'秦园路北侧支路', points:northEdge, width:2.18, plain:true });
    route({ group, name:'武珞路至珞喻路', points:south, width:3.26, plain:true });
    route({ group, name:'珞狮路至珞珈山', points:campus, width:2.31, plain:true });
    route({ group, name:'东湖路接省博外围', width:1.44, plain:true,
      points:[north.at(-1), ...local(museum,[40,57],[35,48.9])] });
    route({ group, name:'珞珈山入口园径', width:1.40, earthy:true,
      points:[campus.at(-1),{x:458,z:47.5},...local(wuda,[34,12])] });

    // Short, staggered frontage groups leave intermittent views across the parks.
    const protectedSites = [[AT.museum,48],[AT.xingyin,35],[AT.wuda,33],[AT.hongshan,28]];
    for (const [line, shift, weight] of [[north,0,1],[northEdge,5,.80],[south,9,1],[campus,15,.64]]) {
      let passed = 0, next = 14, station = shift;
      for (let j = 1; j < line.length; j++) {
        const a = line[j-1], b = line[j], dx = b.x-a.x, dz = b.z-a.z, length = Math.hypot(dx,dz);
        while (next < passed+length-2) {
          const t = Math.max(0,(next-passed)/length), nx = -dz/length, nz = dx/length;
          const x = a.x+t*dx, z = a.z+t*dz;
          const side = station % 5 < 2 ? -1 : 1;
          const setback = side*(8.1+2.7*(1+Math.sin(station*1.81)));
          const p = {x:x+nx*setback, z:z+nz*setback};
          const clear = protectedSites.every(([site,r]) => Math.hypot(p.x-site.x,p.z-site.z)>r);
          if (clear && station % 7 !== 4) {
            const edge = Math.min(1,j/4,(line.length-j)/3) * weight;
            const scale = .63+edge*.22;
            if (station % 6 === 0) lot('apartment',p,Math.atan2(-nx*side,-nz*side),scale,.39+edge*.21);
            else lot(station % 5 === 2 ? 'arcade' : 'lane',p,Math.atan2(-nx*side,-nz*side),scale,.57+edge*.20);
            if (edge > .58 && station % 5 < 2) {
              const q = {x:p.x+dx/length*9.7+nx*side*1.4, z:p.z+dz/length*9.7+nz*side*1.4};
              if (protectedSites.every(([site,r]) => Math.hypot(q.x-site.x,q.z-site.z)>r))
                lot('lane',q,Math.atan2(-nx*side,-nz*side),scale*.91,.62);
            }
          }
          const treeSide = station % 4 === 0 ? side : -side;
          const treeOffset = treeSide*(4.2+.88*Math.cos(station*1.53));
          if (clear) cityGround.verges.push({x:x+nx*treeOffset,z:z+nz*treeOffset});
          station++;
          next += 16+6*(1+Math.sin(station*1.28))+(station%5===0?12:0);
        }
        passed += length;
      }
    }

    // Jianghanguan to the nearby ferry landings: continuous riverside street,
    // cross lanes at the water, and low storefronts opening towards the street.
    const hankou = '汉口商埠', bank = yangtzeLowerWest;
    const waterside = (i, offset) => bankPoint(bank,i,1,offset);
    const coast = bank.slice(2, 31).map((_,i) => waterside(i+2,18.8));
    route({ name: '沿江大道与里分支巷', group: hankou, points: coast, width: 3.5 });
    for (const i of [6, 12, 20]) {
      route({ name: '江汉关沿江码头', group: hankou,
        points: [waterside(i,19.1), waterside(i,9.4), waterside(i,4.5), waterside(i,1.55)],
        width: i === 12 ? 4.6 : 2.15, material: 'BankStone', terrace: true });
    }
    route({ name: '沿江大道与里分支巷', group: hankou, width: 2.6,
      points: [waterside(10,19), waterside(10,35.5),
        {x:AT.watertower.x+12,z:AT.watertower.z+12}, {x:AT.watertower.x-10,z:AT.watertower.z+12},
        {x:AT.watertower.x-31,z:AT.watertower.z+1}] });
    const frontage = (station, setback) => {
      const i = Math.floor(station);
      const a = waterside(i,setback), b = waterside(i+1,setback);
      return {x:THREE.MathUtils.lerp(a.x,b.x,station-i),z:THREE.MathUtils.lerp(a.z,b.z,station-i)};
    };
    // Two closely spaced rows within each block. The quay approaches and the
    // view corridor opposite the Customs House stay open across both rows.
    for (const [start, end, rear] of [[2.8,5.25,true],[6.68,7.52,false],[10.78,11.36,false],
      [12.75,15.1,true],[16.15,18.58,true],[20.78,23.15,true],[24.2,26.58,true]]) {
      for (let i = start, j = 0; i <= end; i += .76, j++) {
        const p = frontage(i,27.4), street = frontage(i,18.8);
        const yaw = Math.atan2(street.x-p.x,street.z-p.z);
        lot(j % 4 === 2 ? 'wharf' : 'arcade',p,yaw,.72+(j % 3)*.034,.87+(j % 3)*.10);
        if (rear && i+.28 < end)
          lot(j % 3 === 0 ? 'arcade' : 'lane',frontage(i+.28,39.8),yaw,.72,.71+(j % 3)*.12);
      }
      route({name:'沿江铺面石板人行道',group:hankou,width:2.8,material:'BankStone',
        points:[frontage(start-.18,21.65),frontage((start+end)/2,21.65),frontage(end+.18,21.65)]});
      cityGround.verges.push(frontage((start+end)/2,14.7));
    }

    const wuchang = '武昌古城';
    for (const {stations} of wuhanApproachFeatures) for (const [i,row] of stations.slice(1).entries()) {
      const previous=stations[i];
      reservePath({a:previous.center,b:row.center,width:row.edges[0].outer.distanceTo(row.edges[1].outer)+1.45}, false);
    }
    const bridgeExit = approachLinks[0].at(-1);
    route({ name: '蛇山脚坡街与首义街口', group: wuchang, width: bridgeStreetEntries[0].width, connect: true, entryHeight:bridgeExit.y,
      points: [bridgeExit, bridgeStreetEntries[0].streetLead, ...points([45,45],[71,50])] });
    // The hillside walk reaches the outer curb on its own side of the approach.
    const parkStation = wuhanApproachFeatures[0].stations.reduce((best,row)=>
      Math.abs(row.edges[1].outer.z-16.1)<Math.abs(best.edges[1].outer.z-16.1) ? row : best);
    const parkLink=parkStation.edges[1].outer;
    const curbExit=parkLink.clone().addScaledVector(parkStation.normal,1.45);
    const parkTurn=new THREE.CatmullRomCurve3([parkLink,curbExit,V(-17.5,0,14.1),V(-19,0,12.1),V(-22,0,8)]);
    const parkEntry=parkTurn.getSpacedPoints(Math.ceil(parkTurn.getLength()/.7));
    route({ name: '蛇山东麓土径', group: wuchang, width: 1.04, earthy: true, entryHeight:parkLink.y,
      points: [...parkEntry,...points([-25,4],[-28.1,1.8],[-29.1,.1],[-31.0,-2.1],[-32.7143,-4],[-31,-12],
        [-24,-25],[-13,-36],[-1,-42],[17,-43],[27,-53])] });
    wuhanApproachFeatures[0].parkLink = parkLink;
    for (const [x,z,yaw,kind] of [[-23,30,.15,'arcade'],[-12,29,.22,'lane'],[4,36,.25,'lane'],
      [17,40,.32,'arcade'],[-9,-49,3.45,'lane'],[6,-49,3.48,'lane'],[23,-47,2.75,'arcade']])
      lot(kind,{x,z},yaw,.82,.71);

    // Use the foot of the ridge for a lower row, leaving the climb in the opening.
    for (const [x,z,yaw,kind] of [[-29,46,.17,'lane'],[-20,48,.25,'arcade'],[-10,51,.29,'lane'],
      [10,48,.18,'lane'],[19,50,.25,'arcade']]) lot(kind,{x,z},yaw,.69,.67);

    // Short stone forecourts run from one approach curb to the existing blocks.
    // Leave the opposite verge open to the hills and the view from the bridge.
    for (const [side, fraction, group, name, forecourt, house, shade] of [
      [0,.40,'武昌桥头 · 蛇山脚街坊','武昌桥头石巷',
        [[-26.9,30.2],[-29.2,32.1],[-32.6,34.9]], [-34,39.4,3.10],
        [[-29.9,28.4],[-31.7,27.3]]],
      [1,.39,'汉阳桥头 · 龟山脚街坊','汉阳桥头石巷',
        [[-238.6,-44.9],[-240.5,-46.8],[-241.8,-49.1]], [-240.1,-53.8,.16],
        [[-236.7,-51.9],[-234.5,-53.6],[-233.0,-57.3]]],
    ]) {
      const stations=wuhanApproachFeatures[side].stations;
      const curb=stations[Math.round(fraction*(stations.length-1))].edges[0].outer;
      const [x,z,yaw]=house, scale=.60;
      const line=[curb,...forecourt.map(([a,b])=>V(a,0,b))];
      if (lot('lane',{x,z},yaw,scale,.64)) {
        // The center doorway is offset along the front of the lane house.
        const front=2.72*scale+.22, door=-.75*scale;
        line.push(V(x+Math.sin(yaw)*front+Math.cos(yaw)*door,0,
          z+Math.cos(yaw)*front-Math.sin(yaw)*door));
      }
      const curve=new THREE.CatmullRomCurve3(line);
      const length=curve.getLength();
      // A narrow lane opens into a small landing in front of the doorway.
      route({ name, group, width:1.16, widthAt:d=>1.16+.94*THREE.MathUtils.smoothstep(d,length-2.8,length-.65), planted:true, material:'BankStone', gradeStart:curb.y,
        points:curve.getSpacedPoints(Math.ceil(curve.getLength()/.74)) });
      cityGround.bridgeGardens.push(...points(...shade));
    }

    // Two low folds follow the toe of each slope, with short gravel exposures.
    // Adapt every ring to the existing grade so the edges settle into the ground.
    const vergeSoil=vergeWash(.30,['#858e7a','#d5d2b6']);
    const vergeGravel=vergeWash(.34,['#a29b86','#dcd3bb']);
    const vergeOutline=[.95,1.05,.98,.87,.98,.91,.78,.82,1.06,.99,.90,1.02,.97,.86,.90];
    function slopeVerge(group,name,material,ink,x,z,yaw,length,width,relief) {
      const vertices=[], coverage=[], faces=[], sides=vergeOutline.length;
      function point(u,v,raise) {
        const px=x+Math.cos(yaw)*u+Math.sin(yaw)*v, pz=z-Math.sin(yaw)*u+Math.cos(yaw)*v;
        const floor=plantingSurface(px,pz);
        return [px,(floor ?? LAND_Y)+raise,pz];
      }
      vertices.push(point(0,0,relief));
      coverage.push(.90);
      for (const [ring,alpha] of [[.36,.82],[.71,.47],[1,0]]) {
        for (const [i,stretch] of vergeOutline.entries()) {
          const a=i/sides*Math.PI*2, r=ring*stretch;
          vertices.push(point(Math.cos(a)*length*r,Math.sin(a)*width*r,
            .009+relief*(1-ring*ring)));
          coverage.push(alpha);
        }
      }
      for (let i=0;i<sides;i++) {
        const j=(i+1)%sides;
        faces.push([0,1+j,1+i]);
        for (const base of [1,1+sides]) {
          const a=base+i,b=base+j,c=a+sides,d=b+sides;
          faces.push([a,b,c],[b,d,c]);
        }
      }
      const valid=faces.filter(face=>triangleOnLand(...face.map(i=>vertices[i])) &&
        face.every(i=>(roadAt(vertices[i][0],vertices[i][2])?.distance ?? Infinity)>approachHalfWidth+1.05));
      if (!valid.length) return;
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));
      geometry.setAttribute('vergeCover',new THREE.Float32BufferAttribute(coverage,1));
      geometry.setIndex(valid.flat());
      geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,ink);
      mesh.name=name;
      mesh.userData.landscapeSurface={group,name,material};
      scene.add(mesh);
    }
    const snakeFoot='武昌桥头 · 蛇山脚街坊', turtleFoot='汉阳桥头 · 龟山脚街坊';
    for (const [group,name,x,z,yaw,length,width] of [
      [snakeFoot,'蛇山脚薄草地',-8.6,28.5,.16,4.2,1.34],
      [snakeFoot,'武昌街坊草土路肩',-30.5,28.3,-.28,3.6,1.2],
      [turtleFoot,'龟山脚薄草地',-234.6,-55.7,-.48,3.8,1.65],
      [turtleFoot,'汉阳街坊草土路肩',-235.6,-48.6,-.64,2.8,1.25],
    ]) slopeVerge(group,name,'BankGrass',vergeSoil,x,z,yaw,length,width,.073);
    slopeVerge(snakeFoot,'武昌石巷碎石路肩','BankStone',vergeGravel,-27.8,29.9,-.52,1.28,.39,.041);
    slopeVerge(turtleFoot,'汉阳石巷碎石路肩','BankStone',vergeGravel,-239.9,-49.7,-.76,1.19,.47,.041);

    const hanyang = '汉阳滨江';
    route({ name: '龟山东麓至南岸嘴滨江步道', group: hanyang, width: 1.88, earthy: true,
      points: points([-127,-127],[-121,-133],[-115,-139],[-111,-142]) });
    route({ name: '南岸嘴两江会口石径', group: hanyang, width: 1.48, material: 'BankStone', terrace: true,
      points: points([-127,-127],[-134,-132],[-143,-135],[-155,-136],[-164,-135]) });
    const gateToe=local(qc,[20,19.9],[20,21.5]);
    route({ name: '晴川阁与铁门关沿台石径', group: '晴川阁', width: 1.48, material: 'BankStone',
      entryHeight:terrainTop(gateToe[0].x,gateToe[0].z)+.09*qc.scale.y,
      points:[...gateToe,...points([-117.6,-118.4],[-120.5,-121.2],[-124.2,-124.9],[-127,-127])] });
    const rounds=[approachLinks[1].at(-1),bridgeStreetEntries[1].streetLead,...points([-276,-21.3],[-282,-19],[-286.9,-12],
      [-288,0],[-288,14],[-289.4,22],[-292,31])];
    const hanyangStreet=new THREE.CatmullRomCurve3(rounds.map(({x,z})=>V(x,0,z))).getPoints((rounds.length-1)*8);
    route({ name: '汉阳桥头至翠微巷', group: hanyang, width: bridgeStreetEntries[1].width, entryHeight:approachLinks[1].at(-1).y,
      points: hanyangStreet });
    const templeFront = local(guiyuan,[0,30],[0,37],[0,42]);
    for (let i=1;i<templeFront.length;i++)
      reservePath({a:templeFront[i-1],b:templeFront[i],width:14},false);
    route({ name: '翠微山门接乡路', group: hanyang, width: 2.6, connect: true,
      points: [...local(guiyuan,[0,42], [0,46]), ...points([-309,29],[-292,31],[-270,25])] });
    route({ name: '古琴台山门与月湖步道', group: '古琴台', width: 1.95, entryHeight: qintai.localToWorld(V(0,.12,18.30)).y,
      points: local(qintai,[0,18.30],[0,23],[0,28],[-7,31],[-19,30],[-26,23],[-27,12],
        [-28,0],[-28,-12],[-25,-18],[-19,-23],[-13,-27],[-9,-33],[-7.65,-35.55]) });

    route({ name: '宝通禅寺山门铺地', group: '宝通禅寺', width: 1.95, earthy: true, connect: true,
      points: local(hongshan,[0,25.3],[0,28],[1,33],[4,37],[7,39]) });
    route({ name: '磨山楚天台阶前山径', group: '楚天台', width: 2.15, material: 'BankStone',
      points: local(chutian,[0,24.5],[0,29],[.5,36],[4,43],[10,49]) });
    for (const x of [-12.65,0,12.65]) {
      route({ name: '武大老斋舍台阶接樱园', group: '珞珈山', width: 1.55,
        points: local(wuda,[x,7.28],[x,10.6],[x*.77,13]) });
    }
    route({ name: '武大老斋舍台阶接樱园', group: '珞珈山', width: 2.28, terrace: true,
      points: local(wuda,[-25,13],[-12,13],[0,13],[12,13],[25,13],[34,12]) });
    buildYingwuzhouRoads(route, reservePath, lot);
  }
