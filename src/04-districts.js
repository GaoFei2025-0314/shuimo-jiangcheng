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
    for (let i = 3; i < 27; i++) {
      if ([6, 9, 10, 11, 12, 19, 20].includes(i)) continue;
      const p = waterside(i,27.4), land = waterside(i,19);
      const yaw = Math.atan2(land.x-p.x,land.z-p.z);
      lot(i % 4 === 0 ? 'wharf' : i % 3 === 1 ? 'lane' : 'arcade', p, yaw, .80+(i % 3)*.055, .79+(i % 4)*.075);
    }

    const wuchang = '武昌古城';
    for (const {walkStations} of wuhanApproachFeatures) for (const [i,row] of walkStations.slice(1).entries()) {
      const previous=walkStations[i];
      reservePath({a:previous.center,b:row.center,width:row.edges[0].outer.distanceTo(row.edges[1].outer)+1.45}, false);
    }
    const bridgeExit = approachLinks[0].at(-1);
    route({ name: '蛇山脚坡街与首义街口', group: wuchang, width: bridgeStreetEntries[0].width, connect: true, entryHeight:bridgeExit.y,
      points: [bridgeExit, bridgeStreetEntries[0].next, ...points([25,39],[45,45],[71,50])] });
    // The hillside walk reaches the outer curb on its own side of the approach.
    const parkStation = wuhanApproachFeatures[0].stations.reduce((best,row)=>
      Math.abs(row.edges[1].outer.z-16.1)<Math.abs(best.edges[1].outer.z-16.1) ? row : best);
    const parkLink=parkStation.edges[1].outer;
    const curbExit=parkLink.clone().addScaledVector(parkStation.normal,1.45);
    route({ name: '蛇山东麓土径', group: wuchang, width: 1.04, earthy: true, entryHeight:parkLink.y,
      points: [parkLink,curbExit,...points([-17.5,14.1],[-19.0,12.1],[-22,8],[-25,4],[-28.1,1.8],[-29.1,.1],[-31.0,-2.1],[-32.7143,-4],[-31,-12],
        [-24,-25],[-13,-36],[-1,-42],[17,-43],[27,-53])] });
    wuhanApproachFeatures[0].parkLink = parkLink;
    for (const [x,z,yaw,kind] of [[-23,30,.15,'arcade'],[-12,29,.22,'lane'],[4,36,.25,'lane'],
      [17,40,.32,'arcade'],[-9,-49,3.45,'lane'],[6,-49,3.48,'lane'],[23,-47,2.75,'arcade']])
      lot(kind,{x,z},yaw,.82,.71);

    const hanyang = '汉阳滨江';
    route({ name: '龟山东麓至南岸嘴滨江步道', group: hanyang, width: 1.88, earthy: true,
      points: points([-128,-115],[-128,-120],[-127,-127],[-117,-134],[-106,-141],[-102,-142]) });
    route({ name: '南岸嘴两江会口石径', group: hanyang, width: 1.48, material: 'BankStone', terrace: true,
      points: points([-127,-127],[-134,-135],[-143,-140],[-155,-142],[-166,-144]) });
    route({ name: '晴川阁与铁门关沿台石径', group: '晴川阁', width: 1.38, material: 'BankStone',
      points: local(qc,[0,10.6],[1,11.8],[7,10.2],[13,10.1],[18,11.75],[22,13.6]) });
    const rounds=[bridgeStreetEntries[1].next,...points([-269,-22.15],[-276,-21.3],[-282,-19],[-286.9,-12],
      [-288,0],[-288,14],[-289.4,22],[-292,31])];
    const hanyangStreet=new THREE.CatmullRomCurve3(rounds.map(({x,z})=>V(x,0,z))).getPoints((rounds.length-1)*8);
    route({ name: '汉阳桥头至翠微巷', group: hanyang, width: bridgeStreetEntries[1].width, entryHeight:approachLinks[1].at(-1).y,
      points: [approachLinks[1].at(-1),...hanyangStreet] });
    route({ name: '归元禅寺山门前庭', group: '归元禅寺', width: 6.4, material: 'BankStone',
      points: local(guiyuan,[0,29],[0,33],[0,40]) });
    route({ name: '翠微山门接乡路', group: hanyang, width: 2.6, connect: true,
      points: [...local(guiyuan,[0,40], [0,46]), ...points([-309,29],[-292,31],[-270,25])] });
    route({ name: '古琴台山门与月湖步道', group: '古琴台', width: 2.25,
      points: local(qintai,[0,18],[0,23],[1,28],[-5,35],[-18,36],[-24,31],[-24,20],[-24,8],[-22,-4]) });

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
