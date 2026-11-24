  // Both approaches fade from the exported deck pigment to the city street finish.
  const approachPaving = (() => {
    const asphalt = M.bankPath.clone();
    asphalt.uniforms = { ...M.bankPath.uniforms,
      deckInk: architectureMaterials.deck.uniforms.uInk,
      deckPaper: architectureMaterials.deck.uniforms.uPaper,
    };
    asphalt.vertexShader = 'attribute float deckPigment; varying float vDeckPigment;\n' + asphalt.vertexShader
      .replace('vW = w.xyz;', 'vDeckPigment = deckPigment; vW = w.xyz;');
    asphalt.fragmentShader = 'varying float vDeckPigment; uniform vec3 deckInk, deckPaper;\n' + asphalt.fragmentShader
      .replace('1., uTone),', '1., mix(uTone, .04, vDeckPigment)),')
      .replace('vec3 col = mix(uInk, uPaper, tone);',
        'vec3 col = mix(mix(uInk, uPaper, tone), mix(deckInk, deckPaper, tone), vDeckPigment);');
    return asphalt;
  })();

  /* 鹦鹉洲大桥 · 从现有桥面断面接续两岸车行道与人行道。 */
  function yingwuzhouJunction(side) {
    yingwuzhou.updateMatrixWorld(true);
    return yingwuzhou.localToWorld(V(side < 0 ? 0 : 4.8, 0, side * 150));
  }

  function yingwuzhouNorthStreetEnd(side) {
    yingwuzhou.updateMatrixWorld(true);
    return yingwuzhou.localToWorld(V(side < 0 ? 18 : 28.8, 0, side * 150));
  }

  function buildYingwuzhouRoads(route, reservePath, lot) {
    yingwuzhou.updateMatrixWorld(true);
    const group = '鹦鹉洲长江大桥';
    const lanePaint = inkMat(.04, false, ['#c7c0a9', '#eee5d0']);
    const step = .65, run = 50, count = Math.ceil(run / step);
    const toWorld = (x, z) => yingwuzhou.localToWorld(V(x, 0, z));
    // Match the same 1/128-unit encoding used by the exported bridge mesh.
    const encoded = value => Math.round(value * 128) / 128;
    const deckY = yingwuzhou.position.y + encoded(7.70 - (100 - 71.5) * .095);
    const deckEdge = encoded(15.47 / 2);
    const streetEdge = 2.90;
    for (const side of [-1, 1]) {
      const bank = side < 0 ? '汉阳' : '武昌';
      const name = '鹦鹉洲' + bank + '引道';
      const junction = yingwuzhouJunction(side);
      const junctionY = terrainTop(junction.x, junction.z) + .068;
      const smooth = THREE.MathUtils.smoothstep;
      const mix = THREE.MathUtils.lerp;
      const nodes = Array.from({length: count + 1}, (_, i) => {
        const t = i / count, z = 100 + t * run;
        const center = toWorld(side < 0 ? 0 : 4.8 * smooth(t, .25, .88), side * z);
        const taper = smooth(t, .28, .86);
        // A cubic starts tangent to the bridge and settles onto the level street.
        const y = mix(deckY, junctionY, smooth(t, 0, 1)) - .095 * run * t * (1-t) ** 2;
        return { center, y, half: mix(deckEdge, streetEdge, taper), taper, z };
      });
      const rows = nodes.map((node, i) => {
        const a = nodes[Math.max(0, i-1)].center, b = nodes[Math.min(count, i+1)].center;
        const dx = b.x-a.x, dz = b.z-a.z, length = Math.hypot(dx,dz);
        return { ...node, nx: dz/length, nz: -dx/length };
      });
      const point = (row, x, y) => [row.center.x+row.nx*x, y, row.center.z+row.nz*x];
      const pavement = row => [point(row,-row.half,row.y), point(row,row.half,row.y)];
      function strip(section, start, end, vertices, indices) {
        const first = vertices.length / 3;
        for (const row of rows.slice(start,end+1)) vertices.push(...section(row).flat());
        for (let i=0;i<end-start;i++) {
          const a=first+i*2;
          indices.push(a,a+2,a+1,a+1,a+2,a+3);
        }
      }
      function show(label, material, ink, vertices, indices, pigment) {
        const shape = new THREE.BufferGeometry();
        shape.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
        if (pigment) shape.setAttribute('deckPigment',new THREE.Float32BufferAttribute(pigment,1));
        shape.setIndex(indices);
        shape.computeVertexNormals();
        const mesh = new THREE.Mesh(shape,ink);
        mesh.name = name + ' · ' + label;
        mesh.userData.landscapeSurface = { group, name:mesh.name, material };
        scene.add(mesh);
      }

      const road = [], roadTris = [], base = [], baseTris = [];
      strip(pavement,0,count,road,roadTris);
      for (const direction of [-1,1]) {
        // A stone retaining face embeds in sampled land and disappears into the last grade.
        strip(row => {
          const top = point(row,direction*row.half,row.y);
          const ground = terrainTop(top[0],top[2]);
          const toe = point(row,direction*(row.half+(row.y-ground)*.10), Math.min(row.y-.03,ground-.035));
          return direction < 0 ? [toe,top] : [top,toe];
        },0,count,base,baseTris);
      }
      const pigment = rows.flatMap(row => {
        const ink = 1 - smooth(row.z,100,150);
        return [ink,ink];
      });
      show('车行面','ApproachPaving',approachPaving,road,roadTris,pigment);
      show('坡脚挡面','BankStone',M.bankStone,base,baseTris);

      const walks=[], walkTris=[], marks=[], markTris=[];
      for (const direction of [-1,1]) {
        const walk = row => {
          const outer = mix(encoded(7.15 + .93 / 2), streetEdge - .06, row.taper);
          const inner = mix(encoded(7.15 - .93 / 2), streetEdge - .80, row.taper);
          const y = row.y + mix(encoded(.15),.045,smooth(row.z,140,150));
          return direction<0 ? [point(row,-outer,y),point(row,-inner,y)] :
            [point(row,inner,y),point(row,outer,y)];
        };
        strip(walk,0,count,walks,walkTris);
        strip(row => {
          const [a,b]=walk(row);
          const top = direction < 0 ? b : a;
          const bottom = [top[0],row.y-.015,top[2]];
          return direction < 0 ? [top,bottom] : [bottom,top];
        },0,count,walks,walkTris);
        for (const lane of [1,2,3]) {
          // Two dashed tracks per direction terminate as the side lanes merge.
          const end = lane===1 ? count-7 : Math.floor(count*(lane===2 ? .64 : .49));
          for (let start=1;start<end;start+=7) {
            strip(row => {
              const x = direction*lane*2*(1-.48*row.taper), y = row.y+.016;
              return [point(row,x-.038,y),point(row,x+.038,y)];
            },start,Math.min(start+3,end),marks,markTris);
          }
        }
      }
      const medianEnd = Math.floor(count*.27);
      strip(row => {
        const taper = smooth(row.z,100,114), half = mix(encoded(.24),.045,taper);
        const y = row.y + mix(encoded(.10),.022,taper);
        return [point(row,-half,y),point(row,half,y)];
      },0,medianEnd,marks,markTris);
      strip(row => [point(row,-.045,row.y+.022),point(row,.045,row.y+.022)],medianEnd,count-5,marks,markTris);
      for (const x of [-1.6,-1.2,-.8,-.4,0,.4,.8,1.2,1.6]) {
        strip(row => [point(row,x-.13,row.y+.018),point(row,x+.13,row.y+.018)],count-5,count-3,marks,markTris);
      }
      show('路缘与人行道','BankStone',M.bankStone,walks,walkTris);
      show('车道线','RoadPaint',lanePaint,marks,markTris);
      for (let i=0;i<count;i++) {
        reservePath({a:rows[i].center,b:rows[i+1].center,width:2*rows[i].half,group,name});
      }

      const streetGroup = bank+'桥头街坊';
      const offset = side < 0 ? 0 : 4.8;
      const street = (x,z) => toWorld(offset+x,side*z);
      const innerJunction = street(side < 0 ? 3 : 2.7, side < 0 ? 200 : 203);
      const streetName = side < 0 ? '马鹦路与鹦鹉大道路口' : '复兴路街口';
      route({ name:streetName, group:streetGroup, width:5.8, entryHeight:junctionY,
        points:[junction,street(0,157),street(2,174),street(4,188),innerJunction], connect:true });
      route({ name:bank+'桥头横街', group:streetGroup, width:3.9, entryHeight:junctionY, junctionLift:.016,
        points:[junction,yingwuzhouNorthStreetEnd(side)] });
      // The smaller branch returns to the inland street instead of stopping in the field.
      const returnLane = [junction, street(-17,150), street(-22,156), street(-23,169),
        street(-19,183), street(-12,195), innerJunction];
      // Round the lane corners inside the block while keeping the two street mouths fixed.
      const lane = [returnLane[0]];
      for (let i=1; i<returnLane.length-1; i++) {
        const corner = returnLane[i];
        const toward = next => corner.clone().lerp(next, Math.min(.30,3.0/corner.distanceTo(next)));
        const bend = new THREE.QuadraticBezierCurve3(toward(returnLane[i-1]),corner,toward(returnLane[i+1]));
        lane.push(...bend.getPoints(5));
      }
      lane.push(innerJunction);
      route({ name:bank+'桥头里巷', group:streetGroup, width:3.25, entryHeight:junctionY, junctionLift:.016, points:lane });

      // Staggered shopfronts leave open sightlines toward the deck and mark the smaller street.
      const fronts = side < 0 ? [
        [-15,118],[-13,130],[14,139],[10,159],[12,174],[-10,162],[-12,176],
        [-29,156],[-32,169],[-29,183],[-18,201],[11,190]
      ] : [
        [-14,111],[13,117],[-16,126],[16,130],[-15,139],[16,140],[12,159],
        [13,173],[14,187],[-11,161],[-13,176],[-8,184],[-29,156],
        [-33,169],[-28,184],[-21,197],[-10,206],[13,207]
      ];
      for (const [i,[x,z]] of fronts.entries()) {
        const p = street(x,z);
        const toward = street(x + (x < 0 ? 1 : -1),z);
        const yaw = Math.atan2(toward.x-p.x,toward.z-p.z);
        const scale = .67 + .10 * (1 + Math.sin(i*2.3));
        const height = (side < 0 ? .47 : .52) + .14 * (1 + Math.sin(i*1.77));
        lot(i%5===3 ? 'arcade' : 'lane',p,yaw,scale,height);
      }
      for (const [x,z] of [[-11,119],[11,126],[-9,140],[8,154],[-7,163],[8,180],
        [-27,160],[-27,175],[-20,192]]) cityGround.verges.push(street(x,z));
    }
  }
