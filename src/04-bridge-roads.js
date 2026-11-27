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

  function vergeWash(tone, colors) {
    const ink=inkMat(tone,false,colors);
    ink.vertexShader='attribute float vergeCover; varying float vVergeCover;\n'+
      ink.vertexShader.replace('vW = w.xyz;','vVergeCover = vergeCover; vW = w.xyz;');
    ink.fragmentShader='varying float vVergeCover;\n'+
      ink.fragmentShader.replace('vec4(col, 1.);',`vec4(col, vVergeCover *
          (.88 + .12 * vnoise(vW.xz * .63))); `);
    ink.transparent=true;
    ink.depthWrite=false;
    return ink;
  }

  /* 鹦鹉洲大桥 · 从现有桥面断面接续两岸车行道与人行道。 */
  function yingwuzhouJunction(side) {
    yingwuzhou.updateMatrixWorld(true);
    return yingwuzhou.localToWorld(V(side < 0 ? 0 : 4.8, 0, side * 150));
  }

  function yingwuzhouNorthStreetEnd(side) {
    yingwuzhou.updateMatrixWorld(true);
    return yingwuzhou.localToWorld(V(side < 0 ? 18 : 28.8, 0, side * 150));
  }

  const yingwuzhouRiverWalkEnds = new Map();

  function buildYingwuzhouRoads(route, reservePath, lot) {
    yingwuzhou.updateMatrixWorld(true);
    const group = '鹦鹉洲长江大桥';
    const lanePaint = inkMat(.04, false, ['#c7c0a9', '#eee5d0']);
    const grassWash = vergeWash(.23,['#798571','#c1c6a8']);
    const dryWash = vergeWash(.34,['#97896f','#d7ccb3']);
    const toeStone = inkMat(.18, false, ['#71675a', '#ab9c83']);
    const step = .65, run = 50, count = Math.ceil(run / step);
    const toWorld = (x, z) => yingwuzhou.localToWorld(V(x, 0, z));
    // Match the same 1/128-unit encoding used by the exported bridge mesh.
    const encoded = value => Math.round(value * 128) / 128;
    const deckY = yingwuzhou.position.y + encoded(7.70 - (100 - 71.5) * .095);
    const deckEdge = encoded(15.47 / 2);
    const deckThickness = encoded(.43);
    const junctionHalf = 5.2;
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
        const taper = smooth(t, .11, .91);
        // A cubic starts tangent to the bridge and settles onto the level street.
        const y = mix(deckY, junctionY, smooth(t, 0, 1)) - .095 * run * t * (1-t) ** 2;
        return { center, y, half: mix(deckEdge, junctionHalf, taper), taper, z };
      });
      const rows = nodes.map((node, i) => {
        const a = nodes[Math.max(0, i-1)].center, b = nodes[Math.min(count, i+1)].center;
        const dx = b.x-a.x, dz = b.z-a.z, length = Math.hypot(dx,dz);
        return { ...node, nx: dz/length, nz: -dx/length };
      });
      const point = (row, x, y) => [row.center.x+row.nx*x, y, row.center.z+row.nz*x];
      const pavement = row => [point(row,-row.half,row.y), point(row,row.half,row.y)];
      function ribbon(sections, vertices, indices) {
        const first = vertices.length / 3;
        for (const section of sections) vertices.push(...section.flat());
        for (let i=0;i<sections.length-1;i++) {
          const a=first+i*2;
          indices.push(a,a+2,a+1,a+1,a+2,a+3);
        }
      }
      function strip(section, start, end, vertices, indices) {
        ribbon(rows.slice(start,end+1).map(section),vertices,indices);
      }
      function solid(sections, vertices, indices) {
        const first = vertices.length / 3;
        for (const section of sections) vertices.push(...section.flat());
        const last = first + (sections.length-1)*4;
        indices.push(first,first+2,first+1,first,first+3,first+2);
        for (let start=first;start<last;start+=4) {
          for (let j=0;j<4;j++) {
            const a=start+j, b=start+(j+1)%4;
            indices.push(a,b,a+4,b,b+4,a+4);
          }
        }
        indices.push(last,last+1,last+2,last,last+2,last+3);
      }
      function show(label, material, ink, vertices, indices, pigment, cover) {
        const shape = new THREE.BufferGeometry();
        shape.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
        if (pigment) shape.setAttribute('deckPigment',new THREE.Float32BufferAttribute(pigment,1));
        if (cover) shape.setAttribute('vergeCover',new THREE.Float32BufferAttribute(cover,1));
        if (ink.defines?.ARCHITECTURE_AO) {
          shape.setAttribute('skyVisibility',new THREE.BufferAttribute(new Float32Array(vertices.length/3).fill(.92),1));
        }
        shape.setIndex(indices);
        shape.computeVertexNormals();
        const mesh = new THREE.Mesh(shape,ink);
        mesh.name = name + ' · ' + label;
        mesh.userData.landscapeSurface = { group, name:mesh.name, material };
        scene.add(mesh);
      }

      const road = [], roadTris = [], base = [], baseTris = [];
      const grass = [], grassTris = [], earth = [], earthTris = [], edging = [], edgingTris = [];
      const grassCover = [], earthCover = [];
      const courses = [], courseTris = [];
      function landOnly(vertices, indices) {
        const visible = [];
        for (let i=0;i<indices.length;i+=3) {
          const face = indices.slice(i,i+3);
          if (triangleOnLand(...face.map(j => vertices.slice(j*3,j*3+3)))) visible.push(...face);
        }
        return visible;
      }
      strip(pavement,0,count,road,roadTris);
      for (const direction of [-1,1]) {
        // A stone retaining face embeds in sampled land and disappears into the last grade.
        strip(row => {
          const top = point(row,direction*row.half,row.y);
          const ground = terrainTop(top[0],top[2]);
          const toe = point(row,direction*(row.half+Math.max(0,row.y-ground)*.36), row.y);
          toe[1] = Math.min(row.y-.03,terrainTop(toe[0],toe[2])-.035);
          return direction < 0 ? [toe,top] : [top,toe];
        },0,count,base,baseTris);

        // Low grass folds climb partway up the retaining slope and thin into sampled ground.
        const profile = (row, i) => {
          const edge = point(row,direction*row.half,row.y);
          const rise = Math.max(0,row.y-terrainTop(edge[0],edge[2]));
          const toe = row.half+rise*.36;
          const wave = .52+.28*Math.sin(i*.42+direction*1.4+side)+.18*Math.cos(i*.19-side);
          const taper = smooth(i,5,16)*(1-smooth(i,count*.67,count*.83));
          const toGround = (offset, lift) => {
            const p = point(row,direction*offset,row.y);
            p[1] = terrainTop(p[0],p[2])+lift;
            return p;
          };
          const inner = toGround(toe-rise*(.07+.10*wave)*taper,.04);
          inner[1] += rise*(.20+.32*wave)*taper;
          const hump = toGround(toe+(.85+.62*wave)*taper,.025+.22*taper);
          const fringe = toe+(2.1+1.30*wave)*taper;
          const verge = toGround(fringe,.025);
          const bare = toGround(fringe+(.55+.33*Math.sin(i*.24+side*direction))*taper,.017);
          return { inner,hump,verge,bare };
        };
        if (side>0) {
          // Bed the riverward end of the Wuchang ramp in short, staggered granite courses.
          for (let course=0;course<4;course++) {
            const stop=34-course*6+(direction>0?2:0);
            for (let first=1+(course%2)*2;first+3<=stop;first+=5) {
              const sections=[first,Math.min(stop,first+5)].map((i,end)=>{
                const row=rows[i], edge=point(row,direction*row.half,row.y);
                const ground=terrainTop(edge[0],edge[2]);
                const bottom=ground+.055+course*.43;
                const top=Math.min(bottom+.40+.035*Math.sin(first*1.7+course),row.y-.30);
                if (top<bottom+.20) return null;
                const section=(height,projection)=>point(row,direction*(row.half+(row.y-height)*.36+projection),height);
                const ledge=.30+.055*Math.sin(i*.74+course)+.095*(3-course);
                const corners=[section(bottom,-.06),section(bottom,ledge+.05),section(top,ledge),section(top,-.06)];
                const shift=end?-.035:.035;
                for (const q of corners) { q[0]-=row.nz*shift;q[2]+=row.nx*shift; }
                return direction>0?corners:corners.reverse();
              });
              if (sections.every(Boolean)) solid(sections,courses,courseTris);
            }
          }
        }
        const heels = rows.map(profile);
        const pair = (a,b) => direction < 0 ? [b,a] : [a,b];
        const edgeStart = Math.floor(count*.25), edgeEnd = Math.floor(count*.78);
        const banking = heels.slice(6,edgeEnd+1);
        function washBand(from,to,innerCover,outerCover,positions,indices,coverage) {
          const sections = banking.map((p,i) => {
            const endFade = smooth(Math.min(i,banking.length-1-i),0,4);
            coverage.push(...pair(innerCover*endFade,outerCover*endFade));
            return pair(p[from],p[to]);
          });
          ribbon(sections,positions,indices);
        }
        washBand('inner','hump',.97,.95,grass,grassTris,grassCover);
        washBand('hump','verge',.95,.41,grass,grassTris,grassCover);
        washBand('verge','bare',.41,0,earth,earthTris,earthCover);
        for (let first=edgeStart+(direction===side ? 4 : 0);first<edgeEnd;first+=13) {
          const ledge = heels.slice(first,Math.min(first+5,edgeEnd)+1);
          if (ledge.length < 3) continue;
          ribbon(ledge.map(({hump,verge},i) => {
            const raised = i>0 && i<ledge.length-1;
            const inner = V(...hump).lerp(V(...verge),raised ? .62 : .85);
            const outer = V(...hump).lerp(V(...verge),raised ? .96 : .92);
            inner.y += raised ? .13 : .025;
            outer.y += raised ? .065 : .015;
            return pair(inner.toArray(),outer.toArray());
          }),edging,edgingTris);
        }
      }
      const pigment = rows.flatMap(row => {
        const ink = 1 - smooth(row.z,100,150);
        return [ink,ink];
      });
      show('车行面','ApproachPaving',approachPaving,road,roadTris,pigment);
      show('坡脚挡面','BankStone',M.bankStone,base,baseTris);
      if (courses.length) show('临江端错缝石护脚','ShoreStone',M.bankStone,courses,courseTris);
      show('坡脚草土','BankGrass',grassWash,grass,landOnly(grass,grassTris),null,grassCover);
      show('坡脚露土','Path',dryWash,earth,landOnly(earth,earthTris),null,earthCover);
      show('坡脚石缘','BankStone',toeStone,edging,landOnly(edging,edgingTris));

      // A short abutment closes the exposed end of the two retaining faces below the deck.
      const abutment=[], abutmentTris=[];
      const joint = rows[0];
      const reach = 1.35;
      const bridgeSeat = {
        ...joint, center:joint.center.clone().add(V(joint.nz*reach,0,-joint.nx*reach)),
        y:deckY+.095*reach/yingwuzhou.scale.z,
      };
      const abutmentSections = [bridgeSeat,rows[1]].map((row,i) => {
        const topY = row.y-deckThickness, topHalf = row.half-.42;
        const bottom = [-1,1].map(direction => {
          const edge = point(row,direction*row.half,row.y);
          const grade = terrainTop(edge[0],edge[2]);
          const flare = i===0 ? .20 : Math.max(0,row.y-grade)*.36;
          const p = point(row,direction*(topHalf+flare),topY);
          p[1] = Math.min(topY-.10,terrainTop(p[0],p[2])-.12);
          return p;
        });
        return [...bottom,point(row,topHalf,topY),point(row,-topHalf,topY)];
      });
      solid(abutmentSections,abutment,abutmentTris);
      show('桥台端墙','Masonry',architectureMaterials.stone,abutment,abutmentTris);

      const walks=[], walkTris=[], returns=[], returnTris=[], marks=[], markTris=[];
      const rails=[], railTris=[];
      const turnStart = count - 8;
      const forward = rows[count].center.clone().sub(rows[count-1].center).normalize();
      const railEnd = rows.findIndex((row,i) => i >= count*.30 &&
        row.y-terrainTop(row.center.x,row.center.z)<.45);
      for (const direction of [-1,1]) {
        const walk = row => {
          const outer = mix(encoded(7.15 + .93 / 2), junctionHalf - .06, row.taper);
          const inner = mix(encoded(7.15 - .93 / 2), junctionHalf - .80, row.taper);
          const y = row.y + mix(encoded(.15),.045,smooth(row.z,140,150));
          return direction<0 ? [point(row,-outer,y),point(row,-inner,y)] :
            [point(row,inner,y),point(row,outer,y)];
        };
        strip(walk,0,turnStart,walks,walkTris);
        strip(row => {
          const [a,b]=walk(row);
          const top = direction < 0 ? b : a;
          const bottom = [top[0],row.y-.015,top[2]];
          return direction < 0 ? [top,bottom] : [bottom,top];
        },0,turnStart,walks,walkTris);

        // Carry the existing paired steel rails onto the raised sidewalk, then lower the handrail.
        const lastRail = railEnd > 0 ? railEnd : turnStart;
        const railRows = rows.slice(0,lastRail+1);
        const railX = row => direction*mix(encoded(7.63),junctionHalf-.14,row.taper);
        const drop = i => smooth(i/lastRail,.68,1)*.47;
        const rectangle = (row,x,y,half,height) => [
          point(row,x-half,y),point(row,x+half,y),point(row,x+half,y+height),point(row,x-half,y+height),
        ];
        for (const height of [.29,.99]) {
          solid(railRows.map((row,i) => rectangle(row,railX(row),row.y+height-.055-
            drop(i)*(height>.5 ? 1 : .13),.065,.11)),rails,railTris);
        }
        const posts = railRows.filter((_,i) => i%3===1 && i<lastRail-1);
        posts.push(railRows.at(-1));
        for (const row of posts) {
          const i = railRows.indexOf(row);
          const top = row.y+.99-drop(i);
          const bottom = row.y+mix(encoded(.15),.045,smooth(row.z,140,150))-.04;
          solid([-.066,.066].map(along => rectangle({
            ...row, center:row.center.clone().add(V(-row.nz*along,0,row.nx*along)),
          },railX(row),bottom,.052,top-bottom)),rails,railTris);
        }

        // Each sidewalk curves away from the crossing, then lowers beside the cross street.
        const first = walk(rows[turnStart]);
        const a = V(...first[0]).lerp(V(...first[1]),.5);
        const outward = V(rows[count].nx * direction,0,rows[count].nz * direction);
        const crossStreetHalf = direction === side ? 1.95 : 1.625;
        const landing = junction.clone().addScaledVector(forward,-crossStreetHalf-.36).addScaledVector(outward,9);
        const curve = new THREE.CubicBezierCurve3(a, a.clone().addScaledVector(forward,1.45),
          landing.clone().addScaledVector(outward,-3.4).setY(a.y), landing.clone().setY(a.y));
        const corners = [first];
        for (let i=1;i<=15;i++) {
          const t=i/15, p=curve.getPoint(t), along=curve.getTangent(t);
          const half=mix(.37,.32,smooth(t,.65,1));
          const grade=terrainTop(p.x,p.z);
          p.y=mix(a.y,grade+.03,smooth(t,.04,1));
          const across=V(along.z,0,-along.x).normalize().multiplyScalar(half);
          corners.push([p.clone().sub(across).toArray(),p.clone().add(across).toArray()]);
        }
        if (direction === side) {
          yingwuzhouRiverWalkEnds.set(side, {
            edge: corners.at(-1).map(p => V(...p)),
            previous: corners.at(-2).map(p => V(...p)),
          });
        }
        ribbon(corners,returns,returnTris);
        ribbon(corners.map(([left,right])=>{
          const top=direction<0 ? right : left;
          const base=[top[0],terrainTop(top[0],top[2])-.025,top[2]];
          return direction<0 ? [top,base] : [base,top];
        }),returns,returnTris);
        for (const lane of [1,2,3]) {
          // The outer bridge lane merges on the ramp. Two lanes feed each side of the junction.
          const end = lane===1 ? count-7 : Math.floor(count*(lane===2 ? .88 : .59));
          for (let start=1;start<end;start+=7) {
            strip(row => {
              const x = direction*lane*mix(2,1.52,row.taper), y = row.y+.016;
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
      for (let bar=-9;bar<=9;bar++) {
        const x = bar*.43;
        strip(row => [point(row,x-.13,row.y+.018),point(row,x+.13,row.y+.018)],count-5,count-3,marks,markTris);
      }
      show('引桥步道护栏','SuspensionOrange',architectureMaterials.suspensionOrange,rails,railTris);
      show('路缘与人行道','BankStone',M.bankStone,walks,walkTris);
      show('横街人行转角','BankStone',M.bankStone,returns,returnTris);
      for (let i=0;i<count;i++) {
        reservePath({a:rows[i].center,b:rows[i+1].center,width:2*rows[i].half,group,name});
      }

      const streetGroup = bank+'桥头街坊';
      const offset = side < 0 ? 0 : 4.8;
      const street = (x,z) => toWorld(offset+x,side*z);
      const innerJunction = street(side < 0 ? 3 : 2.7, side < 0 ? 200 : 203);
      const streetName = side < 0 ? '马鹦路与鹦鹉大道路口' : '复兴路街口';
      const receiving = route({ name:streetName, group:streetGroup, width:5.8, entryHeight:junctionY,
        widthAt: distance => mix(junctionHalf*2,5.8,smooth(distance,10,29)),
        points:[junction,street(0,157),street(2,174),street(4,188),innerJunction], connect:true });
      if (receiving) {
        // Use the street's own sampled cross sections so the paint follows the road crown.
        function receivingMark(section, offset) {
          const [left, center, right] = section;
          const edge = offset < 0 ? left : right;
          const u = Math.abs(offset);
          return [mix(center[0],edge[0],u),mix(center[1],edge[1],u)+.018,mix(center[2],edge[2],u)];
        }
        ribbon(receiving.slice(3,-2).map(section =>
          [-.014,.014].map(offset => receivingMark(section,offset))),marks,markTris);
        for (const direction of [-1,1]) {
          for (let start=3;start<Math.min(19,receiving.length-2);start+=3) {
            ribbon(receiving.slice(start,start+2).map(section =>
              [direction*.30-.012,direction*.30+.012].map(offset => receivingMark(section,offset))),marks,markTris);
          }
        }
      }
      show('车道线','RoadPaint',lanePaint,marks,markTris);
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

      // The cross street feeds a low sidewalk alongside the receiving street and shopfront courts.
      const footway = new THREE.CatmullRomCurve3(
        [[8.4,150],[7.3,155],[7.8,166],[8.8,177],[8.7,184],[6.9,188]].map(([x,z])=>street(x,z)));
      route({name:bank+'桥头步道',group:bank+'桥头步行环境',planted:true,width:1.34,material:'BankStone',surfaceLift:.014,
        points:footway.getSpacedPoints(Math.ceil(footway.getLength()/1.2))});
      const court=[], courtTris=[];
      function forecourt(x,z) {
        const stations = [-2.35,-1.15,0,1.15,2.35].map((along,i) => {
          const inset = i===0 || i===4 ? .38 : 0;
          const near = street(x-2.6+inset,z+along);
          const far = street(x+1.68-inset,z+along);
          const section = [near,far].map(p => [p.x,terrainTop(p.x,p.z)+.088,p.z]);
          return side < 0 ? section.reverse() : section;
        });
        ribbon(stations,court,courtTris);
      }

      // Staggered shopfronts leave open sightlines toward the deck and mark the smaller street.
      const fronts = side < 0 ? [
        [-15,118],[-13,130],[14,139],[10,159],[15,174,10.8],[-10,162],[-12,176],
        [-29,156],[-32,169],[-29,183],[-18,201],[11,190],[-9,185]
      ] : [
        [-14,111],[13,117],[-16,126],[16,130],[-15,139],[16,140],[14,159,9.9],
        [15,173,10.7],[14,187],[-11,161],[-13,176],[-8,184],[-29,156],
        [-33,169],[-28,184],[-21,197],[-10,206],[13,207],[-12,193]
      ];
      for (const [i,[x,z,yardX]] of fronts.entries()) {
        const p = street(x,z);
        const toward = street(x + (x < 0 ? 1 : -1),z);
        const yaw = Math.atan2(toward.x-p.x,toward.z-p.z);
        const scale = yardX ? .60 : .67 + .10 * (1 + Math.sin(i*2.3));
        const height = (yardX ? .45 : side < 0 ? .47 : .52) + .14 * (1 + Math.sin(i*1.77));
        if (lot(i%5===3 ? 'arcade' : 'lane',p,yaw,scale,height) && yardX) {
          forecourt(yardX,z);
        }
      }
      // The existing Hanyang wharf warehouse also opens onto this sidewalk.
      if (side < 0) forecourt(10.1,161.3);
      show('房前院落','Path',M.bankPath,court,landOnly(court,courtTris));
      for (const [x,z] of [[-11,119],[11,126],[-10,140],[9,145],[10,155],[-9,162],[9,180],
        [-27,160],[-27,175],[-20,192]]) cityGround.verges.push(street(x,z));
      for (const [x,z] of [[-12,117],[-12,123],[12.1,130],[10,143],[11,146],[10.6,153],
        [-9.6,168],[11.3,180],[11.6,183]]) cityGround.bridgeGardens.push(street(x,z));
    }
  }
