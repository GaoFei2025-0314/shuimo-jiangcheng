  /* 码头、坡街与支巷按原岸线和地标落位；街坊细部是画意概括。 */
  function buildDistrictRoutes(route, lot) {
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
    const bridgeExit = approachLinks[0].at(-1);
    route({ name: '蛇山脚坡街与首义街口', group: wuchang, width: 2.55, connect: true,
      points: [bridgeExit, ...points([-29,27],[-19,34],[-9,37],[8,38],[25,39],[45,45],[71,50])] });
    route({ name: '蛇山东麓土径', group: wuchang, width: 1.04, earthy: true,
      points: points([-29,27],[-32,14],[-34,2],[-31,-12],[-24,-25],[-13,-36],[-1,-42],[17,-43],[27,-53]) });
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
    route({ name: '汉阳桥头至翠微巷', group: hanyang, width: 2.3,
      points: [approachLinks[1].at(-1), ...points([-265,-22],[-282,-19],[-297,-12],[-297,4],[-309,12])] });
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
    // The two asphalt approaches start flush with the authored 100-unit deck ends.
    const deckEnd = yingwuzhou.position.y+7.70-(100-71.5)*.095;
    for (const side of [-1,1]) {
      route({ name: '鹦鹉洲两岸接地引道', group: '鹦鹉洲长江大桥', width: 15.47, earthy: true, gradeStart: deckEnd,
        points: local(yingwuzhou,[0,side*100],[0,side*108],[0,side*120],[side*2,side*136]) });
    }
  }
