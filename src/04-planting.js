
  /* ═════════ 山林与行道树 ═════════ */
  function buildVegetation() {
    // Separate seeds keep both street layouts and unrelated planting schemes stable.
    function seeded(seed) {
      return () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
    }

    const up = new THREE.Vector3(0, 1, 0);
    const woodColor = '#544b3b';
    const crownProfile = [[-.63, .53], [-.28, .89], [.17, 1], [.65, .64]];
    const distantCrownProfile = [[-.39, .81], [.28, .95]];
    const sprayProfile = [[-.52,.40],[-.19,.68],[.17,.76],[.51,.53]];

    function prototype(crownSides = 7, crownRings = crownProfile, spray = false) {
      const positions = [], indices = [], colors = [], centers = [], leafCenters = [];
      let center=null, leafCenter=null;
      function add(x, y, z, tint, shade) {
        if (spray) {
          centers.push(...(center ?? [0,0,0]));
          leafCenters.push(...(leafCenter ?? [0,0,0]));
        }
        positions.push(x, y, z);
        colors.push(tint.r * shade, tint.g * shade, tint.b * shade);
      }
      function branch(start, end, r0, r1, sides = 5) {
        const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
        const axis = b.clone().sub(a).normalize();
        const lateral = (Math.abs(axis.y) > .92 ? new THREE.Vector3(1, 0, 0) : up.clone()).cross(axis).normalize();
        const flank = axis.clone().cross(lateral);
        const offset = positions.length / 3;
        const tint = new THREE.Color(woodColor);
        for (const [endPoint, radius] of [[a, r0], [b, r1]]) {
          for (let i = 0; i < sides; i++) {
            const angle = i * 2 * Math.PI / sides;
            const p = endPoint.clone().addScaledVector(lateral, Math.cos(angle) * radius)
              .addScaledVector(flank, Math.sin(angle) * radius);
            add(p.x, p.y, p.z, tint, .85 + .15 * (i % 3) / 2 + (endPoint === b ? .06 : 0));
          }
        }
        for (let i = 0; i < sides; i++) {
          const v = offset + i, next = offset + (i + 1) % sides;
          indices.push(v, next, next + sides, v, next + sides, v + sides);
        }
        for (let i = 1; i < sides - 1; i++) {
          indices.push(offset, offset + i + 1, offset + i,
            offset + sides, offset + sides + i, offset + sides + i + 1);
        }
      }
      function crown([x, y, z, w, h, d, hex, yaw]) {
        center=[x,y,z];
        const offset = positions.length / 3;
        const tint = new THREE.Color(hex), c = Math.cos(yaw), s = Math.sin(yaw);
        const rings = crownRings, n = crownSides;
        const phase = x * 2.7 + z * 3.1 + yaw;
        for (const [j, [py, radius]] of rings.entries()) {
          for (let i = 0; i < n; i++) {
            const a = i * Math.PI * 2 / n + (j % 2) * .27;
            const bud = Math.sin(a * 3 + phase) * (spray ? .085 : .14) +
              Math.cos(a * 2 - phase + j) * (spray ? .055 : .09);
            const px = Math.cos(a) * (radius + bud) + py * .12;
            const pz = -Math.sin(a) * (radius + bud);
            const lift = py + .13 * Math.cos(a * 2 + phase - j * .5);
            add(x + px * w * c + pz * d * s, y + lift * h, z - px * w * s + pz * d * c,
              tint, .86 + (lift + 1) * .07 + .034 * Math.sin(a + phase));
            if (j < rings.length - 1) {
              const v = offset + j * n + i, next = offset + j * n + (i + 1) % n;
              indices.push(v, next, next + n, v, next + n, v + n);
            }
          }
        }
        const floor = offset + rings.length * n, top = floor + 1, last = floor - n;
        add(x - .12 * w, y - .83 * h, z + .16 * d, tint, .81);
        add(x + .19 * w, y + .89 * h, z - .15 * d, tint, 1.03);
        for (let i = 0; i < n; i++) {
          const next = (i + 1) % n;
          indices.push(floor, offset + next, offset + i, top, last + i, last + next);
        }
        center=null;
      }
      function leaf(p,length,width,yaw,dip,tint,shade) {
        leafCenter=p.toArray();
        const along=new THREE.Vector3(Math.cos(yaw),dip,Math.sin(yaw)).normalize();
        const across=new THREE.Vector3(-Math.sin(yaw),.32*Math.cos(yaw*1.7),Math.cos(yaw)).normalize();
        const offset=positions.length/3;
        for (const [u,v,lift] of [[-.58,0,0],[-.05,.47,.01],[.60,0,.09],[-.10,-.40,0],[.06,0,.22]]) {
          const q=p.clone().addScaledVector(along,length*u).addScaledVector(across,width*v);
          add(q.x,q.y+width*lift,q.z,tint,shade*(v>.05 ? 1.035 : .97));
        }
        for (let i=0;i<4;i++) indices.push(offset+4,offset+(i+1)%4,offset+i);
        leafCenter=null;
      }
      function geometry() {
        const mesh = new THREE.BufferGeometry();
        mesh.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        mesh.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        if (spray) {
          mesh.setAttribute('crownCenter',new THREE.Float32BufferAttribute(centers,3));
          mesh.setAttribute('leafCenter',new THREE.Float32BufferAttribute(leafCenters,3));
        }
        mesh.setIndex(indices);
        mesh.computeVertexNormals();
        return mesh;
      }
      return { branch, crown, leaf, geometry };
    }

    // Species use the same height origin and several deliberately offset canopy lobes.
    const treeTypes = {
      pine: {
        material: 'plantPine', radius: 2.75, wind: .51,
        distantCrown: [
          [-1.51, 3.34, -.48, 1.75, .75, 1.22, '#62785f', .26],
          [1.23, 3.66, .38, 1.9, .72, 1.53, '#5e785f', -.14],
          [-.45, 4.54, .16, 1.64, .94, 1.28, '#6a826b', .38]
        ],
        trunk: [[0, -.43, 0], [.12, 1.64, -.09], [-.26, 3.14, .12], [-.42, 4.48, .21]],
        limbs: [
          [[.12, 1.64, -.09], [-1.03, 2.64, -.21], [-2.03, 3.11, -.32]],
          [[-.06, 2.44, .03], [1.21, 2.99, -.14], [1.81, 3.41, -.15]],
          [[-.13, 2.58, .05], [.07, 3.14, 1.24]]
        ],
        crowns: [
          [-1.76, 3.24, -.36, 1.53, .62, 1.02, '#62785f', .26],
          [-.83, 3.54, -.82, 1.41, .62, .98, '#516a57', .32],
          [1.41, 3.58, -.42, 1.64, .63, 1.08, '#708565', .18],
          [.46, 3.71, 1.01, 1.49, .69, 1.06, '#526f5f', -.24],
          [-.36, 4.42, .18, 1.53, .81, 1.19, '#607c68', .38],
          [-.75, 4.77, .14, .89, .6, .76, '#788970', .61]
        ]
      },
      broadleaf: {
        material: 'plantBroadleaf', radius: 2.60, wind: .66,
        distantCrown: [
          [-1.09, 4.31, -.42, 1.71, 1.36, 1.51, '#687d58', .31],
          [1.04, 4.62, .42, 1.62, 1.46, 1.48, '#748866', -.23],
          [-.02, 5.51, -.32, 1.73, 1.54, 1.64, '#82936d', .31]
        ],
        trunk: [[0, -.4, 0], [-.08, 1.93, .03], [.21, 3.67, -.07], [.01, 4.64, .13]],
        limbs: [
          [[-.08, 1.93, .03], [1.15, 3.39, .47], [1.68, 4.11, .29]],
          [[.1, 2.8, 0], [-1.01, 3.98, -.62], [-1.57, 4.3, -.66]],
          [[.12, 3.2, 0], [-.39, 4.04, 1.47]]
        ],
        crowns: [
          [-1.27, 4.25, -.54, 1.47, 1.16, 1.23, '#627653', .31],
          [1.13, 4.31, .28, 1.5, 1.25, 1.23, '#718761', -.23],
          [.01, 4.25, 1.13, 1.34, 1.06, 1.06, '#718060', .74],
          [.17, 4.77, -.99, 1.42, 1.16, 1.28, '#718961', .12],
          [-.23, 5.34, .03, 1.59, 1.31, 1.45, '#82916d', .31],
          [.42, 6.0, -.12, .91, .93, .96, '#8b9a75', -.51]
        ]
      },
      willow: {
        material: 'plantWillow', radius: 2.65, wind: 1.18,
        distantCrown: [
          [-1.42, 2.88, .51, 1.29, 2.03, 1.25, '#789164', .24],
          [1.27, 2.66, .21, 1.46, 1.91, 1.31, '#849c70', .10],
          [-.01, 3.68, -.34, 1.78, 1.37, 1.53, '#92a377', .61]
        ],
        trunk: [[0, -.4, 0], [.28, 1.36, -.04], [.23, 2.81, -.17], [-.27, 3.81, -.06]],
        limbs: [
          [[.28, 1.36, -.04], [-.51, 2.55, .64], [-1.59, 3.69, .65]],
          [[.23, 2.81, -.17], [1.23, 3.45, -.45], [1.67, 3.44, -.86]],
          [[.23, 2.81, -.17], [.18, 3.72, 1.01]]
        ],
        crowns: [
          [-1.56, 3.05, .61, 1.04, 1.28, .97, '#7c946a', .24],
          [1.56, 2.89, -.38, 1.17, 1.52, .87, '#869966', .10],
          [-.67, 2.77, -.96, .96, 1.46, 1.06, '#6e8862', -.6],
          [.19, 2.85, 1.31, .95, 1.58, 1.03, '#82996e', .75],
          [-.01, 3.81, -.08, 1.75, 1.09, 1.29, '#92a377', .61],
          [-1.71, 2.22, -.05, .51, 1.14, .69, '#79936b', -.38],
          [1.04, 2.24, 1.12, .51, 1.28, .62, '#8aa073', .16]
        ]
      },
      cherry: {
        material: 'plantCherry', radius: 2.80, wind: .92,
        distantCrown: [
          [-1.34, 3.36, -.05, 1.56, 1.01, 1.35, '#cf9e9d', .52],
          [1.35, 3.42, -.26, 1.60, 1.03, 1.35, '#d9aaa3', -.48],
          [.04, 3.91, .43, 1.59, 1.16, 1.57, '#e0b9b2', .49]
        ],
        trunk: [[0, -.43, 0], [-.06, 1.46, .01], [.28, 2.69, .28], [.4, 3.33, .38]],
        limbs: [
          [[-.06, 1.46, .01], [-1.06, 2.53, -.61], [-1.8, 3.03, -.71]],
          [[.06, 1.94, .07], [1.24, 2.73, -.49], [2.03, 3.28, -.61]],
          [[.29, 2.74, .29], [-.49, 3.52, .97]]
        ],
        crowns: [
          [-1.63, 3.31, -.63, 1.25, .87, 1.03, '#c89491', .52],
          [1.67, 3.36, -.64, 1.31, .92, 1.08, '#d7a29c', -.48],
          [.57, 3.42, 1.01, 1.35, .86, 1.18, '#d3aaa1', .24],
          [-.78, 3.52, .73, 1.26, 1.0, 1.09, '#d7a7a3', -.37],
          [-.28, 3.64, -.91, 1.24, .89, 1.09, '#d8aaa8', .2],
          [.13, 4.1, .16, 1.42, 1.01, 1.11, '#e0bbb4', .49],
          [1.05, 3.92, .19, .85, .77, .89, '#ead0c2', .4]
        ]
      }
    };

    for (const [i, [species,model]] of Object.entries(treeTypes).entries()) {
      const wood=prototype(), leaves=prototype(7,sprayProfile,true);
      const midLeaves=prototype(5,distantCrownProfile,true);
      const rng=seeded(0xa10b39+i*9137), weeping=species==='willow';
      // Broadening the first tube into the root flare keeps the trunk on irregular ground.
      const stem = [.34, .21, .135, .054];
      for (const [j, point] of model.trunk.slice(1).entries())
        wood.branch(model.trunk[j], point, stem[j], stem[j + 1], 6);
      for (const path of model.limbs) {
        for (let j = 1; j < path.length; j++)
          wood.branch(path[j - 1], path[j], j === 1 ? .135 : .085, j === 1 ? .093 : .03);
        const [x, y, z] = path[path.length - 1];
        const [ax, ay, az] = path[path.length - 2];
        wood.branch([(x + ax) / 2, (y + ay) / 2, (z + az) / 2],
          [x - .32 * Math.sign(z), y + .48, z + .36 * Math.sign(x)], .052, .023, 4);
      }
      for (let k = 0; k < 3; k++) {
        const angle = i * 1.7 + k * 2.3;
        wood.branch([0, .13, 0], [.63 * Math.cos(angle), -.23, .63 * Math.sin(angle)], .16, .077, 4);
      }
      const midWood=wood.geometry();
      const axes=model.limbs.flat().map(p=>new THREE.Vector3(...p));
      const paperSprigs=[];
      axes.push(new THREE.Vector3(...model.trunk.at(-1)));
      for (const [cx,cy,cz,w,h,d,hex,yaw] of model.crowns) {
        const origin=new THREE.Vector3(cx,cy,cz), tint=new THREE.Color(hex);
        const stem=axes.reduce((a,b)=>a.distanceToSquared(origin)<b.distanceToSquared(origin)?a:b);
        const fork=stem.clone().lerp(origin,.68);
        wood.branch(stem.toArray(),fork.toArray(),.052,.025,4);
        const c=Math.cos(yaw),s=Math.sin(yaw);
        const local=(a,b,z)=>new THREE.Vector3(cx+c*a*w+s*z*d,cy+b*h,cz-s*a*w+c*z*d);
        const n=8;
        for (let j=0;j<n;j++) {
          const a=j*2.399+yaw, radius=.23+.40*rng();
          const px=Math.cos(a)*radius,pz=Math.sin(a)*radius, py=(rng()-.43)*.74;
          const mid=local(px,py,pz);
          const fat=.126+.076*rng(), lift=weeping ? .24+.13*rng() : .16+.11*rng();
          const color=tint.clone().multiplyScalar(.83+.24*rng());
          if ((j+Math.round(7*yaw))%3!==1) {
            const cluster=[mid.x,mid.y,mid.z,w*fat,h*lift,d*fat,color.getStyle(),yaw+a*.25];
            leaves.crown(cluster);
            midLeaves.crown(cluster);
          }
          const tip=mid.clone().lerp(origin,.12), node=stem.clone().lerp(fork,.65+(j%4)*.11);
          wood.branch(node.toArray(),tip.toArray(),.022,.009,3);
          const k=12, trace=tip.clone();
          for (let l=0;l<k;l++) {
            const theta=a+l*2.399, r=.075+.28*rng();
            const drop=weeping ? -.49*l/(k-1) : (rng()-.35)*.42;
            const p=local(px+Math.sin(theta)*r,py+drop,pz+Math.cos(theta)*r);
            const mark=(.083+.124*rng())*(w+d)*.5;
            const width=mark*(weeping ? .21+.11*rng() : .39+.28*rng());
            const dip=(weeping ? -.95 : -.40)+.75*rng(), shade=.70+.38*rng();
            leaves.leaf(p,mark,width,theta,dip,tint,shade);
            if (l%4===j%4) midLeaves.leaf(p,mark,width,theta,dip,tint,shade);
            if ((weeping ? l%3 : l%4)===0) {
              const end=p.clone().lerp(mid,.15);
              wood.branch((weeping ? trace : tip).toArray(),end.toArray(),.011,.004,3);
              if (species==='broadleaf' && l===0 && (j===1 || j===5)) {
                paperSprigs.push({root:end, direction:end.clone().sub(fork), tint:hex});
              }
              trace.copy(end);
            }
          }
        }
      }
      model.assets = { wood: wood.geometry(), foliage: leaves.geometry() };
      model.paperSprigs=paperSprigs;
      model.midAssets = { wood: midWood, foliage: midLeaves.geometry() };
      // Distant instances keep the full footprint and pigment from three broad lobes.
      const farWood = prototype(), farLeaves = prototype(5, distantCrownProfile);
      farWood.branch(model.trunk[0], model.trunk[1], stem[0], stem[1], 4);
      farWood.branch(model.trunk[1], model.trunk[3], stem[1], stem[3], 4);
      for (const lobe of model.distantCrown) farLeaves.crown(lobe);
      model.farAssets = { wood: farWood.geometry(), foliage: farLeaves.geometry() };
      for (const geometry of [...Object.values(model.assets), ...Object.values(model.midAssets), ...Object.values(model.farAssets)]) {
        const response = new Float32Array(geometry.attributes.position.count).fill(model.wind);
        geometry.setAttribute('windResponse', new THREE.BufferAttribute(response, 1));
      }
      model.instances = [];
    }

    const shadow = new THREE.Box3();
    const landscapeFootings = scene.children.filter(node => node.userData.keepTreesClear);
    const landmarkGrids = pickables.filter(g => !['bridge', 'yingwuzhou', 'lake'].includes(g.userData.focus))
      .concat(landscapeFootings)
      .map(g => {
        g.updateMatrixWorld(true);
        return shadow.setFromObject(g).clone();
      });
    const cellSize = 12;
    const cell = (x, z) => [Math.floor(x / cellSize), Math.floor(z / cellSize)];
    const keyAt = (x, z) => x + ',' + z;
    const trunks = new Map(), roadCells = new Map();
    const parkCourts = towerPark.courts.map(court=>court.polygon.map(p=>[p.x,p.z]));
    function indexRoad(road) {
      const { a, b, width } = road, margin = width / 2 + 6;
      const [x0, z0] = cell(Math.min(a.x, b.x) - margin, Math.min(a.z, b.z) - margin);
      const [x1, z1] = cell(Math.max(a.x, b.x) + margin, Math.max(a.z, b.z) + margin);
      for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
        const key = keyAt(i, j);
        if (!roadCells.has(key)) roadCells.set(key, []);
        roadCells.get(key).push(road);
      }
    }
    for (const road of cityGround.streets) if (!road.riverfront) indexRoad(road);
    let occupied = cityGround.occupiedBeforeRiverfront;
    function distanceTo(x, z, a, b) {
      const dx = b.x - a.x, dz = b.z - a.z;
      const t = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      return Math.hypot(x - a.x - t * dx, z - a.z - t * dz);
    }

    const roots = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const transform = new THREE.Object3D();
    function plant(species, x, z, spread, height, rng) {
      const model = treeTypes[species], radius = model.radius * spread;
      const [cx, cz] = cell(x, z);
      if (BRIDGES.some(([a, b]) => distanceTo(x, z, a, b) < 12 + radius) ||
          (roadAt(x,z)?.distance ?? Infinity) < approachHalfWidth + radius + .45 ||
          landmarkGrids.some(b => x + radius + 2.4 > b.min.x && x - radius - 2.4 < b.max.x
                              && z + radius + 2.4 > b.min.z && z - radius - 2.4 < b.max.z) ||
          towerPark.assetBounds.some(b => x+radius+.6>b.min.x && x-radius-.6<b.max.x
                                      && z+radius+.6>b.min.z && z-radius-.6<b.max.z) ||
          parkCourts.some(court=>inPoly(court,x,z) || roots.some(([dx,dz])=>inPoly(court,x+dx*radius*.62,z+dz*radius*.62))) ||
          occupied(x, z, radius * .81 + .42) ||
          roadCells.get(keyAt(cx, cz))?.some(road => distanceTo(x, z, road.a, road.b) < road.width / 2 + radius * .65 + .48))
        return false;
      for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++)
        if (trunks.get(keyAt(i, j))?.some(p => Math.hypot(x - p.x, z - p.z) < (radius + p.radius) * .64))
          return false;
      const elevation = plantingSurface(x, z);
      if (elevation === null || !Number.isFinite(elevation)) return false;
      // Check the root-bearing patch as well as its center near channels and retaining edges.
      const pad = .54 * spread;
      for (const [nx, nz] of roots) {
        const sample = plantingSurface(x + nx * pad, z + nz * pad);
        if (!Number.isFinite(sample) || Math.abs(sample - elevation) > .24 + .50 * height) return false;
      }
      transform.position.set(x, elevation - .06, z);
      transform.rotation.set(0, rng() * Math.PI * 2, 0);
      transform.scale.set(spread, height, spread * (.90 + rng() * .19));
      transform.updateMatrix();
      model.instances.push(transform.matrix.clone());
      groundContacts.push({x,z, rx:.55+radius*.44, rz:.45+radius*.25,c:.78,s:.626,tree:true});
      const key = keyAt(cx, cz);
      if (!trunks.has(key)) trunks.set(key, []);
      trunks.get(key).push({ x, z, radius });
      return true;
    }

    // A few low groups on the front and sides of the retaining slopes frame the stairs.
    function slopeGrove(at, seed, groups, species = 'broadleaf') {
      const rng = seeded(seed);
      for (const [dx, dz, count, extent] of groups) {
        const angle = rng() * Math.PI * 2;
        for (let i = 0; i < count; i++) {
          const a = angle + i * 2.4;
          const offset = i ? extent * Math.sqrt(i / count) : 0;
          const x = at.x + dx + Math.cos(a) * offset, z = at.z + dz + Math.sin(a) * offset;
          const support = plantingSurface(x, z);
          if (support === null || support < LAND_Y + .22) continue;
          const small = i % 5 !== 0;
          plant(species, x, z, small ? .38 + rng() * .27 : .81 + rng() * .20,
            small ? .16 + rng() * .22 : .65 + rng() * .24, rng);
        }
      }
    }
    const westParkTrees = seeded(0x7ef245df);
    for (const {species,x,z,spread,height} of towerPark.plantBeds) plant(species,x,z,spread,height,westParkTrees);
    const forecourtTrees = seeded(0x753cb64);
    for (const [key, ground] of Object.entries(landmarkGrounds)) {
      for (const p of ground.shade) {
        const lakeside = key === 'qintai', forecourt = key === 'guiyuan';
        if (plant(lakeside ? 'willow' : 'broadleaf', p.x, p.z,
          lakeside || forecourt ? .73 : .87, lakeside ? .82 : forecourt ? .96 : .82, forecourtTrees) || key !== 'museum') continue;
        // Preserve the side courts when an exact point lies too close to a walk.
        const local = museum.worldToLocal(p.clone());
        for (const [side, along] of [[2.1,-3.7],[2.6,2.6],[-1.2,-4.3],[3.5,-5.4]]) {
          const q = museum.localToWorld(V(local.x+Math.sign(local.x)*side,0,local.z+along));
          if (plant('broadleaf', q.x, q.z, .71, .76, forecourtTrees)) break;
        }
      }
    }
    const spitTrees = seeded(0x674fc2a);
    for (const [x,z,scale] of [
      [-162,-126,.59],[-158,-126,.73],[-153,-125.8,.79],[-148,-124.8,.84],[-144,-125.5,.68],
      [-142,-130.3,.68],[-138,-129.1,.69],[-134,-128.8,.63],
      [-125,-130,.57],[-119,-133,.50],[-115,-135,.44],[-112,-137,.35],
      [-115,-145,.34],[-109.8,-145.6,.27],
      [-129,-119,.55],[-129,-115,.62]
    ]) plant(scale < .60 ? 'willow' : 'broadleaf', x, z, scale, .84*scale, spitTrees);
    slopeGrove(AT.tower, 0x15cd84a3, [
      [-22, 2, 11, 5.2], [-17.5, 10, 8, 5.1], [3.2, 23.8, 9, 4.9],
      [-31, -12, 8, 8.5], [-42, 2, 8, 10], [-29, 15, 10, 8.4],
      [-21, 22, 9, 6.4], [-34, 24, 6, 5.5], [18, -19, 6, 6.1], [29, 13, 8, 7.3]
    ]);
    slopeGrove(AT.chutian, 0x88731bf, [
      [-16, 13, 7, 7.5], [20, 13, 9, 9.3], [-12, 30, 7, 6.9], [11, 30, 7, 5.1]
    ], 'pine');
    slopeGrove(AT.tv, 0x855733e, [[-19, -11, 8, 7.3], [-19, 13, 6, 6.8], [-36, 14, 8, 8.2]], 'pine');

    // 武大樱花大道：双列交错、小组连续，道路口与斋舍前留白。
    {
      const rng = seeded(0x6fbd3a61);
      const axis = [geo(114.3585, 30.5392), geo(114.3622, 30.5397), geo(114.3672, 30.5408)];
      for (let arm = 1; arm < axis.length; arm++) {
        const a = axis[arm - 1], b = axis[arm], dx = b.x - a.x, dz = b.z - a.z;
        const length = Math.hypot(dx, dz);
        for (const side of [-1, 1]) for (let along = side > 0 ? 2.5 : 4.8, i = 0; along < length - 1; along += 4.4, i++) {
          if (i % 6 === 4 || (i % 6 === 5 && side > 0)) continue;
          const offset = side * (3.6 + rng() * .7), t = along / length;
          const spread = .71 + rng() * .37;
          plant('cherry', a.x + dx * t - dz / length * offset, a.z + dz * t + dx / length * offset,
            spread, .83 + rng() * .31, rng);
        }
      }
    }
    slopeGrove(AT.wuda, 0x6fc371, [
      [-24, -7, 6, 6.4], [-21, 11, 6, 7.2], [23, -5, 8, 9.7], [21, 13, 6, 6.2]
    ], 'cherry');

    const vergeTrees = seeded(0x6e43f8);
    for (const [i, p] of cityGround.verges.entries()) {
      if (i % 9 === 5) continue;
      const spread = .47+vergeTrees()*.26;
      plant(i % 6 === 2 ? 'willow' : 'broadleaf', p.x, p.z, spread, .52+vergeTrees()*.28, vergeTrees);
    }

    // 连片林冠沿坡脊聚合，林缘以小树断续过渡。
    const priorityHills = ['蛇山', '龟山', '磨山', '珞珈山', '洪山'];
    function dressHill(h, seed, spacing, density, pineRatio) {
      if (!h) return;
      const rng = seeded(seed);
      for (let x0 = h.x0 + spacing / 2; x0 < h.x1; x0 += spacing) {
        for (let z0 = h.z0 + spacing / 2; z0 < h.z1; z0 += spacing) {
          const x = x0 + (rng() - .5) * spacing * .95, z = z0 + (rng() - .5) * spacing * .95;
          const high = sampleField(h.f, x, z);
          if (high < 2.4) continue;
          const clusters = .54 + .23 * Math.sin(x * .064 + z * .037)
            + .21 * Math.cos(z * .147 - x * .031) + .13 * Math.sin(x * .175 + z * .118);
          const edge = THREE.MathUtils.smoothstep(high, 2.4, 9.2);
          if (rng() > clusters * density * (.37 + edge * .77)) continue;
          const spread = (.58 + rng() * .59 + (rng() > .88 ? .28 : 0)) * (.71 + edge * .36);
          const height = spread * (.87 + rng() * .52);
          const inBlossomGarden = h.name === '磨山' && x > h.peak.x + 14 && z > h.peak.z + 10;
          const species = inBlossomGarden && rng() < .65 ? 'cherry' : (rng() < pineRatio ? 'pine' : 'broadleaf');
          plant(species, x, z, spread, height, rng);
        }
      }
    }
    for (const [index, name] of priorityHills.entries())
      dressHill(HILL[name], 0x34862303 + index * 13201, name === '珞珈山' ? 5.6 : 5.25, 1,
        name === '磨山' || name === '珞珈山' ? .32 : .54);
    HILLS.filter(h => !priorityHills.includes(h.name)).forEach((h, i) =>
      dressHill(h, 0x5de1108 + 1729 * i, 8.3, .69, .44));

    // 河岸按真实中泓线和半宽推算。岸线移入后再次检查实际支承面。
    function riverside(river, from, to, axis, side, seed, setback) {
      const rng = seeded(seed);
      let dist = 0, order = 0, segment = 0;
      let next = 3;
      for (let i = 1; i < river.s.length; i++) {
        const a = river.s[i - 1], b = river.s[i];
        if (Math.max(a.p[axis], b.p[axis]) < from || Math.min(a.p[axis], b.p[axis]) > to) continue;
        const dx = b.p.x - a.p.x, dz = b.p.z - a.p.z, length = Math.hypot(dx, dz);
        if (length < .001) continue;
        while (next < dist + length) {
          const t = Math.max(0, (next - dist) / length), w = a.w + t * (b.w - a.w);
          const midX = a.p.x + dx * t, midZ = a.p.z + dz * t;
          const coordinate = axis === 'x' ? midX : midZ;
          if (coordinate >= from && coordinate <= to) {
            const spread = .65 + rng() * .38, height = .71 + rng() * .49;
            const species = (order + segment) % 4 === 0 ? 'broadleaf' : 'willow';
            const drift = rng() * 1.35;
            for (const margin of [setback + drift, setback - 1.55, setback + 3.9]) {
              const off = side * (w + margin);
              if (plant(species, midX + dz / length * off, midZ - dx / length * off, spread, height, rng)) {
                if (order % 3 === 1 && segment % 2 === 0) {
                  const inner = side * (w + margin + 3.7);
                  plant('broadleaf', midX + dz / length * inner, midZ - dx / length * inner,
                    .43 + rng() * .16, .31 + rng() * .19, rng);
                }
                break;
              }
            }
          }
          order++;
          const endOfRow = order >= 5 + (segment % 3);
          next += endOfRow ? 12 + rng() * 14 : 4.4 + rng() * 2.2;
          if (endOfRow) { order = 0; segment++; }
        }
        dist += length;
      }
    }
    const west = geo(114.246, 30.54694).x, east = geo(114.280, 30.54694).x;
    const south = geo(114.3, 30.524).z, bend = geo(114.3, 30.554).z;
    const north = geo(114.3, 30.593).z, wharf = geo(114.3, 30.572).z;
    riverside(YZ, bend, south, 'z', +1, 0x38ef722, 7.1);
    riverside(YZ, north, south, 'z', -1, 0x7f163d3, 6.0);
    riverside(YZ, north, wharf, 'z', +1, 0x15b443d, 8.6);
    riverside(HAN, west, east, 'x', +1, 0x47afe13, 6.4);
    riverside(HAN, west, east, 'x', -1, 0x975fa3f, 5.9);

    // 东湖只在听涛陆岸与磨山入口留短组柳树，岛及游步道仍清楚可见。
    {
      const rng = seeded(0x5aed131), ring = LAKE;
      const island = xingyin.position, hill = HILL['磨山'];
      let previous = null;
      for (let i = 1; i < ring.length - 1; i++) {
        const [x, z] = ring[i];
        const toIsland = Math.hypot(x - island.x, z - island.z);
        const nearHill = hill && Math.hypot(x - hill.peak.x, z - hill.peak.z) < 71;
        if ((toIsland < 21 || toIsland > 65) && !nearHill) continue;
        if (previous && Math.hypot(x - previous.x, z - previous.z) < 8.0) continue;
        previous = { x, z };
        if (rng() < .36) continue;
        const dx = ring[i + 1][0] - ring[i - 1][0], dz = ring[i + 1][1] - ring[i - 1][1];
        const length = Math.hypot(dx, dz);
        if (length < .001) continue;
        for (const side of [-1, 1]) {
          const offset = side * (4.7 + rng() * 1.6);
          if (plant('willow', x + dz / length * offset, z - dx / length * offset,
            .79 + rng() * .22, .87 + rng() * .30, rng)) break;
        }
      }
    }

    // 街坊入口的短树列留出门窗、转角和交叉路口。
    {
      const rng = seeded(0x47f1e6b);
      for (const { a, b, width, planted } of cityGround.streets) {
        if (planted) continue; // These footpaths have individually placed shade trees.
        if (rng() > .51) continue;
        const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
        if (length < 9) continue;
        const side = rng() < .5 ? -1 : 1;
        const offset = side * (width / 2 + 2.22);
        const max = Math.min(length - 2.9, 20 + rng() * 12);
        for (let along = 3.4 + rng() * 2; along < max; along += 5.8 + rng() * 1.7) {
          const t = along / length;
          const px = a.x + dx * t, pz = a.z + dz * t;
          const ox = dz / length * offset, oz = dx / length * offset;
          const spread = .57 + rng() * .18, height = .55 + rng() * .28;
          if (!plant('broadleaf', px - ox, pz + oz, spread, height, rng))
            plant('broadleaf', px + ox, pz - oz, spread, height, rng);
        }
      }
    }

    // 龟山、蛇山脚的短树列到路口前收住，保留从江面看桥头堡的视线。
    const bridgeTrees = seeded(0x3be621);
    for (const {side,stations} of wuhanApproachFeatures) {
      // Move the last Snake Hill canopy to the outer bend so the inner curb overlooks the pavilion eaves.
      const verge = side === 0 ? [[.34,-1],[.44,-1],[.65,1],[.77,-1]]
                               : [[.32,1],[.42,1],[.62,-1],[.72,-1],[.80,-1]];
      for (const [fraction,bank] of verge) {
        const row = stations[Math.round(fraction*(stations.length-1))];
        const spread = .65+bridgeTrees()*.15;
        for (const setback of [3.7,5.2]) {
          const offset = bank*(row.half+setback);
          if (plant('broadleaf',row.center.x+row.normal.x*offset,row.center.z+row.normal.z*offset,
            spread,spread*.91,bridgeTrees)) break;
        }
      }
    }

    // Local additions use their own planting sequence so streets elsewhere retain their composition.
    const frontageTrees = seeded(0x7f302e);
    for (const {x,z} of cityGround.bridgeGardens) {
      const spread = .52+.20*frontageTrees();
      plant('broadleaf',x,z,spread,spread*.94,frontageTrees);
    }

    // Apply the new walks and their clearings after generating the original planting batches.
    occupied = cityGround.occupied;
    cityGround.occupiedBeforeRiverfront = null;
    cityGround.riverfrontPaths.forEach(indexRoad);
    const removed = new Set();
    for (const model of Object.values(treeTypes)) {
      model.instances = model.instances.filter(({elements:e}) => {
        const x=e[12], z=e[14], radius=model.radius*Math.hypot(e[0],e[2]);
        const nearWalk = roadCells.get(keyAt(...cell(x,z)))?.some(road =>
          road.riverfront && distanceTo(x,z,road.a,road.b) < road.width/2+radius*.65+.48);
        if (!nearWalk && !riverfrontOpening(x,z,1.5) && !occupied(x,z,radius*.81+.42)) return true;
        removed.add(keyAt(x,z));
        return false;
      });
    }
    for (let i=groundContacts.length-1;i>=0;i--) {
      const contact = groundContacts[i];
      if (contact.tree && removed.has(keyAt(contact.x,contact.z))) groundContacts.splice(i,1);
    }
    for (const [key, trees] of trunks) {
      trunks.set(key,trees.filter(({x,z}) => !removed.has(keyAt(x,z))));
    }

    const bankShade = seeded(0x2c7bbe);
    for (const { groves } of riverfrontBlocks) {
      for (const { species, positions } of groves) {
        for (const [i,[x,z]] of positions.entries()) {
          if (riverfrontOpening(x,z,2)) continue;
          const canopy = i===0 || i===3;
          plant(canopy ? species : 'broadleaf',x,z,canopy ? .75 : .53,canopy ? .78 : .57,bankShade);
        }
      }
    }

    // Shift the few canopies that cross the lowest views from the riverwalk.
    const pocketTrees = seeded(0xa9b602);
    for (const {species,from,targets} of [
      {species:'willow',from:[-86.54,75.07],targets:[[-77.5,75],[-78.5,75],[-79.5,75]]},
      {species:'broadleaf',from:[-87.27,80.13],targets:[[-78.8,80.9],[-76.5,80.4],[-75,79.7]]},
      {species:'willow',from:[-92.15,105.14],targets:[[-83.1,105.6],[-81.5,102.3],[-79,104.1]]},
    ]) {
      const model=treeTypes[species];
      const index=model.instances.findIndex(({elements:e})=>Math.hypot(e[12]-from[0],e[14]-from[1])<.10);
      if (index<0) continue;
      const e=model.instances[index].elements, x=e[12], z=e[14];
      if (targets.some(([u,v])=>!riverfrontOpening(u,v,1.5) &&
        plant(species,u,v,.66,Math.min(e[5],.78),pocketTrees))) {
        model.instances.splice(index,1);
        const last=groundContacts.findIndex(p=>p.tree && p.x===x && p.z===z);
        if (last>=0) groundContacts.splice(last,1);
        const key=keyAt(...cell(x,z));
        trunks.set(key,trunks.get(key).filter(p=>p.x!==x||p.z!==z));
      } else {
        e[5]*=.52;
      }
    }

    // Smaller crowns belong to the inland gardens rather than the open river edge.
    const laneGrove = seeded(0x5a71bea);
    for (const [x,z,spread,height] of [
      [-215.40,40.67,.44,.34],[-216.88,42.40,.37,.27],[-231.70,43.62,.39,.29],
      [-50.70,79.20,.46,.35],[-51.95,77.66,.36,.29],[-43.10,62.20,.44,.31],
      [-40.72,54.21,.35,.27],
    ]) plant('broadleaf',x,z,spread,height,laneGrove);

    // Four tended plots add shade and crops to the existing blocks without reseeding street planting.
    function plantCultivatedCourts() {
      const gardens=[
        {name:'汉阳树荫小院', at:[-217,2.4], extent:[3.65,1.70], yaw:.15, tree:[-1.16,.05,.72,.68], layout:'shade'},
        {name:'汉阳竹篱菜畦', at:[-212,25.2], extent:[3.50,1.90], yaw:.20, tree:[-1.94,.32,.68,.58], layout:'beds'},
        {name:'武昌木架菜圃', at:[-50,113.4], extent:[3.65,1.76], yaw:.24, tree:[1.76,-.24,.68,.62], layout:'trellis'},
        {name:'武昌石沿树庭', at:[-68,89.1], extent:[3.46,1.66], yaw:.15, tree:[.80,.20,.71,.67], layout:'stone'},
      ];
      const soil=vergeWash(.32,['#8e795e','#b7a681']);
      const trenches=inkMat(.30,false,['#76674c','#a99874']);
      const cropInk=[
        inkMat(.27,true,['#4b654b','#87936c']),
        inkMat(.31,true,['#617857','#abb181']),
      ];
      const caneInk=inkMat(.53,false,['#776850','#a69167']);
      const rockInk=inkMat(.49,false,['#73736a','#b4ac90']);
      const lowStone=new THREE.IcosahedronGeometry(.7,0);
      const paths=[...cityGround.streets,...cityGround.courtyardPaths];
      const closePaths=([x,z])=>paths.filter(({a,b})=>x>Math.min(a.x,b.x)-6&&x<Math.max(a.x,b.x)+6&&
        z>Math.min(a.z,b.z)-6&&z<Math.max(a.z,b.z)+6);
      for (const [index,{name,at:[x,z],extent:[a,b],yaw,tree,layout}] of gardens.entries()) {
        const ground=[], alpha=[], furrows=[], foliage=[[],[]], cane=new Acc(), stones=new Acc();
        const rng=seeded(0xf1bd9d+index*167);
        const nearby=closePaths([x,z]);
        const c=Math.cos(yaw),s=Math.sin(yaw);
        function at(u,v,pad=.12) {
          const X=x+c*u+s*v, Z=z-s*u+c*v;
          if (occupied(X,Z,pad) || !offBridge(X,Z) || nearby.some(path=>
            distanceTo(X,Z,path.a,path.b)<path.width*.5+pad)) return null;
          const y=plantingSurface(X,Z);
          return y===null || y>LAND_Y+.35 ? null : V(X,y,Z);
        }
        const shade=at(tree[0],tree[1],.45);
        if (shade) plant('broadleaf',shade.x,shade.z,tree[2],tree[3],rng);
        function quad(target,p,q,r,t,lift) {
          if (!p||!q||!r||!t) return false;
          for (const v of [p,r,q,q,r,t]) target.push(v.x,v.y+lift,v.z);
          return true;
        }
        const corners=[[-.86,-.82],[-.28,-.97],[.54,-.90],[.93,-.64],[.99,.48],[.59,.94],
          [-.32,.83],[-.92,.66],[-1,.06]];
        for (let i=0;i<corners.length;i++) {
          const [u0,v0]=corners[i], [u1,v1]=corners[(i+1)%corners.length];
          const p=at(u0*a*.72,v0*b*.72), q=at(u1*a*.72,v1*b*.72);
          const r=at(u0*a,v0*b), t=at(u1*a,v1*b);
          const center=at(0,0);
          if (p&&q&&center) {
            for (const v of [center,q,p]) ground.push(v.x,v.y+.042,v.z);
            alpha.push(.81,.66,.66);
          }
          if (quad(ground,p,q,r,t,.042)) alpha.push(.66,0,.66,.66,0,0);
        }
        function rosette(u,v,h,patch) {
          const p=at(u,v,.20);
          if (!p || (shade && p.distanceTo(shade)<.28)) return;
          const leaves=foliage[patch];
          for(let i=0,n=4+Math.floor(rng()*3);i<n;i++){
            const angle=i*2.399+rng()*.75, dx=Math.cos(angle),dz=Math.sin(angle);
            const length=h*(.62+.46*rng()), width=length*(.29+.26*rng());
            const a=p.clone().add(V(dx*.30*length-dz*width,h*.56,dz*.30*length+dx*width));
            const b=p.clone().add(V(dx*.27*length+dz*width,h*.62,dz*.27*length-dx*width));
            const tip=p.clone().add(V(dx*length,h*(.75+.37*rng()),dz*length));
            leaves.push(...p.toArray(),...a.toArray(),...tip.toArray(),...p.toArray(),...tip.toArray(),...b.toArray());
          }
        }
        if (layout==='beds' || layout==='trellis') {
          const count=layout==='beds'?3:4, along=layout==='beds'?.37:.48;
          const lo=layout==='beds'?-1.04:-3.13, hi=layout==='beds'?2.81:.42;
          for (let row=0;row<count;row++) {
            const v=(row-(count-1)*.5)*along*1.49;
            const offset=.10*Math.sin(row*1.75);
            for (let k=0,n=Math.ceil((hi-lo)/.31);k<n;k++) {
              const u=lo+(hi-lo)*k/n+offset, end=lo+(hi-lo)*(k+1)/n+offset;
              quad(furrows,at(u,v-.16),at(end,v-.16),at(u,v+.16),at(end,v+.16),.066);
              const h=layout==='beds'?.21:.25;
              rosette((u+end)*.5,v+(rng()-.5)*.13,h+rng()*.17,(row+k%3)%2);
            }
          }
        } else {
          const patches=layout==='shade' ? [[1.1,-.56,7,.76],[1.98,.36,5,.52]] : [[-1.88,-.48,10,.70],[1.81,.82,5,.45]];
          for(const [u,v,count,radius] of patches) for(let i=0;i<count;i++){
            const a=i*2.4, r=radius*Math.sqrt(i/count);
            rosette(u+r*Math.cos(a),v+r*Math.sin(a),.27+rng()*.20,i%2);
          }
        }
        function frame(u0,u1,v,height,trellis) {
          const bases=[];
          const count=trellis?4:7;
          for (let i=0;i<count;i++) {
            const t=i/(count-1), base=at(THREE.MathUtils.lerp(u0,u1,t),v+.07*Math.sin(i*1.37));
            if (!base) return;
            bases.push(base);
          }
          for (const [i,base] of bases.entries()) {
            const top=base.clone().add(V(.025*Math.sin(i),height+.04*Math.cos(i*2.41),.03*Math.cos(i)));
            cane.beam(base,top,trellis?.078:.048);
            if (!i) continue;
            const prev=bases[i-1];
            for(const level of trellis?[height*.9,height*.60]:[height*.7,height*.31])
              cane.beam(prev.clone().add(V(0,level,0)),base.clone().add(V(0,level,0)),trellis?.063:.040);
            if (trellis) {
              const t=i/(bases.length-1);
              rosette(THREE.MathUtils.lerp(u0,u1,t)-.20,v+.21,.62+rng()*.23,i%2);
            }
          }
        }
        if (layout==='beds') frame(-.94,2.20,1.46,.55,false);
        if (layout==='trellis') frame(-2.52,.02,1.24,1.16,true);
        if (layout==='shade' || layout==='stone') {
          const v=layout==='shade'?-1.10:1.22;
          for (let i=0,n=layout==='shade'?5:11;i<n;i++) {
            const u=layout==='shade'?-2.72+i*.42:-2.52+i*.43;
            const p=at(u,v+.10*Math.sin(i*.86));
            if (!p || i%5===4) continue;
            stones.place(lowStone,p.x,p.y+.07,p.z,.31+rng()*.16,.12+rng()*.07,.20+rng()*.14,yaw+rng()*.32);
          }
        }
        function tag(mesh,label,material) {
          mesh.name=name+' · '+label;
          mesh.userData.landscapeSurface={group:'两岸街坊栽培小院',name:mesh.name,material};
          mesh.userData.detailSize=1.12;
          mesh.userData.vergePlanting=true;
          scene.add(mesh);
        }
        function show(positions,ink,label,material,cover) {
          if (!positions.length) return;
          const geometry=new THREE.BufferGeometry();
          geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
          if (cover) geometry.setAttribute('vergeCover',new THREE.Float32BufferAttribute(cover,1));
          geometry.computeVertexNormals();
          tag(new THREE.Mesh(geometry,ink),label,material);
        }
        show(ground,soil,'院土','BankGrass',alpha);
        show(furrows,trenches,'菜畦垄沟','Path');
        foliage.forEach((positions,i)=>show(positions,cropInk[i],i?'浅青菜叶':'深青菜叶','Reeds'));
        if (cane.l.length) tag(cane.mesh(caneInk,false),'竹木围架','BoatLoad');
        if (stones.l.length) tag(stones.mesh(rockInk,false),'低矮散石','ShoreStone');
      }
    }
    plantCultivatedCourts();

    const paperTargets=[[-226,40],[-216.88,42.4],[-50.7,79.2],[-78.8,80.9],[-212,31]];
    const activePaperTrees=paperTargets.map(([x,z])=>V(x,z,0));

    // Paper branches sit on the same twig tips and move in the same wind as their trunk.
    function addPaperFoliage() {
      if (typeof laneFoliage==='undefined' || !laneFoliage) return;
      const model=treeTypes.broadleaf;
      const sprays=[];
      const material=new THREE.ShaderMaterial({
        side:THREE.DoubleSide,transparent:true,depthWrite:false,vertexColors:true,
        uniforms:{...fogU,...weatherU,atlas:{value:laneFoliage},paperStrength:{value:1}},
        vertexShader:vegetationWind+`
          attribute vec2 stemWind;
          attribute vec3 veil;
          varying vec2 vUV;
          varying vec3 vVeil;
          varying vec3 vInk;
          varying float vDistance;
          void main() {
            vec4 w=modelMatrix*vec4(position,1.);
            vec2 wind=windAt(modelMatrix[3].xz)*stemWind.x;
            w.xz+=wind*stemWind.y;
            vec4 view=viewMatrix*w;
            vDistance=-view.z;
            vUV=uv; vVeil=veil; vInk=color;
            gl_Position=projectionMatrix*view;
          }`,
        fragmentShader:`
          uniform sampler2D atlas;
          uniform vec3 uFog;
          uniform float uNear,uFar,paperStrength;
          varying vec2 vUV;
          varying vec3 vVeil,vInk;
          varying float vDistance;
          void main(){
            vec4 wash=texture2D(atlas,vUV);
            float edge=min(min(vVeil.x,1.-vVeil.x),min(vVeil.y,1.-vVeil.y));
            float margin=mix(1.,smoothstep(0.,.11,edge),vVeil.z);
            float pigmentAlpha=smoothstep(.065,.73,wash.a)*margin*paperStrength;
            if (pigmentAlpha<.012) discard;
            float inkLight=dot(wash.rgb,vec3(.25,.60,.15));
            float leaf=smoothstep(.19,.53,inkLight);
            vec3 painted=mix(wash.rgb,vec3(inkLight)*vec3(.90,1.04,.98),.23);
            vec3 pigment=painted*mix(vec3(.87,.93,.91),vInk*1.47,leaf*.39);
            gl_FragColor=vec4(mix(pigment,uFog,smoothstep(uNear,uFar,vDistance)),pigmentAlpha);
          }`,
      });
      for (const [tree,[x,z]] of paperTargets.entries()) {
        const matrix=model.instances.find(({elements:e})=>Math.hypot(x-e[12],z-e[14])<.12);
        if (!matrix) continue;
        const base=V().setFromMatrixPosition(matrix), positions=[],uv=[],veil=[],pigments=[],wind=[],indices=[];
        const scale=V().setFromMatrixScale(matrix);
        for (let i=0;i<10;i++) {
          const {root,direction,tint}=model.paperSprigs[(i*5+tree)%model.paperSprigs.length];
          const theta=Math.atan2(direction.z,direction.x)+Math.sin(i*2.17+tree*.91)*1.14;
          const cut=i%3===2;
          const span=(cut?.72:1.21)+.21*Math.sin(i*2.41+tree);
          const height=(cut?.62:1.08)+.24*Math.cos(i*1.43+tree*.7);
          const u=V(Math.cos(theta)*span,.26*Math.cos(i*2.7),Math.sin(theta)*span);
          const v=V(direction.x*.25,height,direction.z*.25);
          const color=new THREE.Color(tint).lerp(new THREE.Color(i%3===1?'#89957e':'#708278'),.31);
          const start=positions.length/3;
          for (let row=0;row<3;row++) for (let col=0;col<3;col++) {
            const s=col/2,t=row/2;
            const bend=.31*Math.sin(Math.PI*s)*(t-.085);
            const local=root.clone().addScaledVector(u,s-.018).addScaledVector(v,t-.085)
              .add(V(-Math.sin(theta)*bend,0,Math.cos(theta)*bend));
            const shear=Math.max(local.y-.28,0)*.255;
            wind.push(model.wind,shear*shear*scale.y);
            positions.push(...local.applyMatrix4(matrix).sub(base).toArray());
            uv.push(cut?.53+s*.45:s,cut?.54+t*.44:t);
            veil.push(s,t,cut?1:0);
            pigments.push(color.r,color.g,color.b);
          }
          for (let row=0;row<2;row++) for (let col=0;col<2;col++) {
            const a=start+row*3+col;
            indices.push(a,a+1,a+3,a+1,a+4,a+3);
          }
        }
        const geo=new THREE.BufferGeometry();
        geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
        geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
        geo.setAttribute('color',new THREE.Float32BufferAttribute(pigments,3));
        geo.setAttribute('stemWind',new THREE.Float32BufferAttribute(wind,2));
        geo.setAttribute('veil',new THREE.Float32BufferAttribute(veil,3));
        geo.setIndex(indices);
        geo.computeBoundingSphere();
        const mesh=new THREE.Mesh(geo,material);
        mesh.name='两岸近树纸本枝叶 · '+(tree+1);
        mesh.position.copy(base);
        mesh.visible=false;
        const center=activePaperTrees[tree];
        mesh.onBeforeRender=()=>{
          material.uniforms.paperStrength.value=center.z;
          material.uniformsNeedUpdate=true;
        };
        scene.add(mesh);
        sprays.push({mesh,center});
      }
      // A nonzero projected canopy must justify the alpha coverage work. Perspective stays entirely in the geometry.
      const point=new THREE.Vector3();
      scene.onBeforeRender=(renderer,world,view)=>{
        if (view!==camera) return;
        const pixelScale=renderer.domElement.clientHeight*view.projectionMatrix.elements[5];
        for (const {mesh,center} of sprays) {
          const sphere=mesh.geometry.boundingSphere;
          const depth=-point.copy(sphere.center).add(mesh.position).applyMatrix4(view.matrixWorldInverse).z;
          const diameter=sphere.radius*pixelScale/Math.max(depth,.01);
          mesh.visible=depth>0 && diameter>52;
          center.z=mesh.visible ? THREE.MathUtils.smoothstep(diameter,52,78) : 0;
        }
      };
      app.cleanups.push(()=>{
        material.dispose();
        for (const {mesh} of sprays) mesh.geometry.dispose();
      });
    }
    addPaperFoliage();

    // Color stores sRGB floats for the standalone map and the Blender capture.
    const plantMaterial = new THREE.ShaderMaterial({
      vertexColors: true, side:THREE.DoubleSide,
      uniforms: { ...fogU, ...weatherU, uLight: sharedInk.uLight, uCanopy: { value: 1 }, uPaperTrees:{value:activePaperTrees} },
      vertexShader: vegetationWind + `
        attribute float windResponse;
        attribute vec3 crownCenter, leafCenter;
        uniform vec3 uPaperTrees[${paperTargets.length}];
        varying vec3 vTint, vNormal, vWorld, vSprig;
        varying float vDistance;
        void main() {
          vec2 root = (modelMatrix * instanceMatrix[3]).xz;
          vec3 sprig=position;
          bool onSprigBank=(root.x>-227. && root.x<-210. && root.y>30. && root.y<44.) ||
            (root.x>-80. && root.x<-50. && root.y>78. && root.y<82.);
          if(onSprigBank && (crownCenter.y>0. || leafCenter.y>0.)){
            for(int i=0;i<${paperTargets.length};i++){
              vec3 tree=uPaperTrees[i];
              vec2 offset=root-tree.xy;
              if(tree.z>.0 && dot(offset,offset)<.025){
                bool cluster=crownCenter.y>0.;
                vec3 bud=cluster ? crownCenter : leafCenter;
                sprig=mix(sprig,bud,tree.z*(cluster ? .75 : .56));
              }
            }
          }
          vec4 w = modelMatrix * instanceMatrix * vec4(sprig, 1.0);
          mat3 basis = mat3(instanceMatrix);
          vec3 scaled = normal / vec3(dot(basis[0], basis[0]), dot(basis[1], basis[1]), dot(basis[2], basis[2]));
          // Bark and foliage share a shear so branch tips stay inside their lobes.
          vec2 wind = windAt(root) * windResponse;
          float bendHeight = max(sprig.y - .28, 0.) * .255;
          w.xz += wind * bendHeight * bendHeight * length(mat3(modelMatrix) * basis[1]);
          vec3 worldNormal = mat3(modelMatrix) * basis * scaled;
          worldNormal.y -= dot(worldNormal.xz, wind) * bendHeight * .51;
          vNormal = normalize(worldNormal);
          vTint = color;
          vWorld = w.xyz;
          vSprig = position;
          vec4 view = viewMatrix * w;
          vDistance = -view.z;
          gl_Position = projectionMatrix * view;
        }`,
      fragmentShader: NOISE + `
        uniform vec3 uLight, uFog;
        uniform float uNear, uFar, uCanopy;
        varying vec3 vTint, vNormal, vWorld, vSprig;
        varying float vDistance;
        void main() {
          float light = dot(normalize(gl_FrontFacing ? vNormal : -vNormal),normalize(uLight))*.5+.5;
          float depth = smoothstep(.23,.73,light);
          vec3 pigment = vTint*(.67+.38*depth);
          if(uCanopy>.5){
            float nearCrown = 1.-smoothstep(140.,480.,vDistance);
            float bloom = smoothstep(.035,.22,vTint.r-vTint.g);
            vec3 shadowInk = mix(vec3(.105,.25,.184),vec3(.34,.205,.19),bloom);
            vec3 shadow = mix(vTint*.76,shadowInk,.54);
            vec3 middle = vTint*.94;
            vec3 sunlit = vTint*1.025+mix(vec3(.126,.102,.052),vec3(.112,.074,.045),bloom);
            float broad = vnoise(vWorld.xz*.33+vSprig.y*.59);
            float band = light+(broad-.5)*.20*nearCrown;
            pigment = mix(shadow,middle,smoothstep(.26,.57,band));
            pigment = mix(pigment,sunlit,smoothstep(.59,.87,band));
            if(nearCrown>.001){
              float tips = vnoise(vSprig.xz*2.3+vWorld.xz*.92+vSprig.y);
              pigment += vec3(.092,.080,.044)*nearCrown*smoothstep(.55,.86,band)*smoothstep(.47,.79,tips);
            }
          }
          gl_FragColor = vec4(mix(pigment,uFog,smoothstep(uNear,uFar,vDistance)),1.);
        }`
    });
    plantMaterial.userData.windVegetation = true;
    const barkMaterial = plantMaterial.clone();
    barkMaterial.side = THREE.FrontSide;
    barkMaterial.uniforms = { ...plantMaterial.uniforms, uCanopy: { value: 0 } };
    for (const [species, model] of Object.entries(treeTypes)) {
      for (const [part, geometry] of Object.entries(model.assets)) {
        if (!model.instances.length) continue;
        const mesh = new THREE.InstancedMesh(geometry, part === 'wood' ? barkMaterial : plantMaterial, model.instances.length);
        mesh.name = `Vegetation / ${species} / ${part}`;
        mesh.userData.vegetation = { species, part, material: part === 'wood' ? 'plantBark' : model.material };
        mesh.userData.farGeometry = model.farAssets[part];
        mesh.userData.midGeometry = model.midAssets[part];
        model.instances.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
        mesh.instanceMatrix.needsUpdate = true;
        scene.add(mesh);
      }
    }
  }
  buildVegetation();

  // Small plants follow wall bases and fallow shoulders. Paths retain a clear strip.
  function plantLaneVerge() {
    const leafInk=inkMat(.34,true,['#606d51','#a4a473']);
    const stalkInk=inkMat(.37,true,['#736d4f','#b7a476']);
    const ink=vergeWash(.34,['#6f7a5e','#a5a788']);
    const rootSoil=vergeWash(.46,['#726d55','#a39c7e']);
    const rootInk=inkMat(.37,false,['#5e5846','#8f8065']);
    const paths=[...cityGround.streets,...cityGround.courtyardPaths];
    const beds=[
      ['汉阳滨水街巷地面',[
        [-215.2,38.0,4.8,1.22,-.10],[-221.9,45.3,3.3,1.72,.24],
        [-228.0,21.6,4.2,1.04,-.55],[-231.5,32.2,2.5,.84,-.78],
        [-230.1,43.3,3.3,1.24,.50],[-231.6,47.0,2.6,1.39,-.47],
        [-202.0,31.6,3.1,.93,.34],[-201.5,34.2,2.8,.83,.28],
      ]],
      ['武昌滨水街巷地面',[
        [-65.1,81.2,3.8,1.16,-.15],[-61.0,86.1,4.2,1.46,.06],
        [-55.2,84.2,2.8,1.18,.48],[-48.9,74.8,3.5,.88,.67],
        [-40.4,75.5,3.2,1.25,-.83],[-35.1,53.1,2.3,.89,-.43],
        [-30.4,55.7,2.37,1.11,-.17],[-67.7,87.2,4.6,1.24,.28],
        [-40.4,77.62,1.58,.56,-.31],[-38.48,53.03,1.07,.44,.77],
      ]],
    ];
    let seed=0x74e69c;
    const sample=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const show=(group,label,material,shader,positions,alpha)=>{
      if (!positions.length) return;
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      if (alpha) geometry.setAttribute('vergeCover',new THREE.Float32BufferAttribute(alpha,1));
      geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,shader);
      mesh.name=group+' · '+label;
      mesh.userData.landscapeSurface={group,name:mesh.name,material};
      mesh.userData.detailSize=.44;
      mesh.userData.vergePlanting=true;
      scene.add(mesh);
    };
    for (const [group,x,z,spread] of [
      ['汉阳滨水街巷地面',-226,40,1.08],
      ['武昌滨水街巷地面',-50.70,79.20,.82],
      ['武昌滨水街巷地面',-83.10,105.60,1.26],
    ]) {
      const soil=[],alpha=[],roots=new Acc(), root=V(x,plantingSurface(x,z)??LAND_Y,z);
      const edge=(dx,dz,lift)=>{
        const px=x+dx,pz=z+dz, y=plantingSurface(px,pz);
        if (y===null || cityGround.occupied(px,pz,.05) || paths.some(path=>
          distanceToPath(px,pz,path)<path.width*.5+.18)) return null;
        return V(px,y+lift,pz);
      };
      const rings=[.38,.70,1].map(r=>Array.from({length:18},(_,i)=>{
        const angle=i*Math.PI/9, radius=r*spread*(.86+.12*Math.sin(angle*3+x)+.09*Math.cos(angle*5+z));
        return edge(radius*Math.cos(angle),radius*Math.sin(angle)*.82,.048-.023*r);
      }));
      const push=(a,b,c,x,y,z)=>{
        if (!a||!b||!c) return;
        soil.push(...a.toArray(),...b.toArray(),...c.toArray());
        alpha.push(x,y,z);
      };
      for (let i=0;i<18;i++) {
        const j=(i+1)%18;
        push(root.clone().add(V(0,.052,0)),rings[0][j],rings[0][i],.92,.79,.79);
        for (const [k,inner,outer] of [[0,.79,.44],[1,.44,0]]) {
          const [a,b]=[rings[k][i],rings[k][j]], [c,d]=[rings[k+1][i],rings[k+1][j]];
          push(a,b,c,inner,inner,outer); push(b,d,c,inner,outer,outer);
        }
      }
      for (let i=0;i<4;i++) {
        const a=i*2.39+z*.41, len=spread*(.42+.15*Math.sin(a*2)**2);
        const nodes=[0,.28,.63,1].map(t=>edge((.08+len*t)*Math.cos(a+t*.29),
          (.08+len*t)*Math.sin(a+t*.29),.115*(1-t)**1.7+.014));
        if (nodes.every(Boolean)) roots.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(nodes),
          9,.039*spread,5,false));
      }
      show(group,'旧树浅根盘 · '+x,'BankGrass',rootSoil,soil,alpha);
      if (roots.l.length) {
        const mesh=roots.mesh(rootInk,false);
        mesh.name=group+' · 外露根须 · '+x;
        mesh.userData.landscapeSurface={group,name:mesh.name,material:'BoatLoad'};
        mesh.userData.detailSize=.65;
        mesh.userData.vergePlanting=true;
        scene.add(mesh);
      }
    }
    const mossInk=new THREE.MeshBasicMaterial({map:laneMoss,color:0xd6dbce,transparent:true,
      opacity:.82,depthWrite:false,side:THREE.DoubleSide});
    for (const [group,locations] of beds) {
      const soil=[],alpha=[],blades=[],stalks=[],moss=[],mossUV=[];
      let patch=0;
      for (const [cx,cz,rx,rz,yaw] of locations) {
        const near=paths.filter(({a,b})=>cx>=Math.min(a.x,b.x)-6 && cx<=Math.max(a.x,b.x)+6 &&
          cz>=Math.min(a.z,b.z)-6 && cz<=Math.max(a.z,b.z)+6);
        const c=Math.cos(yaw),s=Math.sin(yaw);
        function point(a,b) {
          const x=cx+a*c+b*s,z=cz-a*s+b*c;
          const y=plantingSurface(x,z);
          if (y===null || cityGround.occupied(x,z,.05)) return null;
          for (const {a,b,width} of near) {
            const dx=b.x-a.x,dz=b.z-a.z;
            const t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);
            if (Math.hypot(x-a.x-dx*t,z-a.z-dz*t)<width*.5+.18) return null;
          }
          return V(x,y+.041,z);
        }
        const layers=[[],[],[]], rings=[.24,.63,1], sides=15;
        for (let i=0;i<sides;i++) {
          const angle=i*Math.PI*2/sides, scale=.79+sample()*.31;
          rings.forEach((r,j)=>layers[j].push(point(rx*scale*r*Math.cos(angle),rz*scale*r*Math.sin(angle))));
        }
        function triangle(a,b,c,x,y,z) {
          if (!a||!b||!c) return;
          soil.push(...a.toArray(),...b.toArray(),...c.toArray());
          alpha.push(x,y,z);
        }
        const center=point(0,0);
        for (let i=0;i<sides;i++) {
          const j=(i+1)%sides;
          triangle(center,layers[0][j],layers[0][i],.78,.66,.66);
          for (let k=0;k<2;k++) {
            const [a,b]=[layers[k][i],layers[k][j]], [c,d]=[layers[k+1][i],layers[k+1][j]];
            const inner=k===0?.66:.34, outer=k===0?.34:0;
            triangle(a,b,c,inner,inner,outer);
            triangle(b,d,c,inner,outer,outer);
          }
        }
        // Pigment and leaves gather in the same damp pockets. Open paper separates the pockets.
        const roots=[];
        const pockets=Math.max(2,Math.min(4,Math.round(rx)));
        for (let i=0;i<pockets;i++) {
          const u=((i+.15+.68*sample())/pockets*2-1)*rx*.83;
          const v=rz*(sample()-.5)*1.18;
          const center=point(u,v);
          if (!center) continue;
          const width=.30+Math.min(rx*.30,.74)*sample(), depth=.20+.24*sample();
          const rim=[], inner=[];
          // Follow the actual soil and clip back from paving. Four different paintings share one draw.
          const tile=patch++%4, grid=[], paintAngle=.62*Math.sin(1.31*patch+cx);
          const dc=Math.cos(paintAngle), ds=Math.sin(paintAngle);
          for(let y=0;y<=4;y++) for(let x=0;x<=4;x++){
            const du=(x/2-1)*width*1.75, dv=(y/2-1)*depth*2.2;
            const p=point(u+du*dc-dv*ds,v+du*ds+dv*dc);
            if(p) p.y+=.019;
            grid.push(p);
          }
          for(let y=0;y<4;y++) for(let x=0;x<4;x++){
            const k=y*5+x;
            for(const tri of [[k,k+5,k+1],[k+1,k+5,k+6]]){
              if(tri.some(n=>!grid[n])) continue;
              for(const n of tri){
                moss.push(...grid[n].toArray());
                mossUV.push((tile%2+.012+.976*(n%5)/4)*.5,
                  (Math.floor(tile/2)+.012+.976*Math.floor(n/5)/4)*.5);
              }
            }
          }
          for (let k=0;k<12;k++) {
            const a=k*Math.PI/6, spread=.81+.30*sample();
            const dx=width*spread*Math.cos(a), dz=depth*spread*Math.sin(a);
            rim.push(point(u+dx,v+dz));inner.push(point(u+.62*dx,v+.62*dz));
          }
          for (let k=0;k<12;k++) {
            const j=(k+1)%12;
            triangle(center,inner[j],inner[k],.92,.71,.71);
            triangle(inner[k],inner[j],rim[k],.71,.71,0);
            triangle(inner[j],rim[j],rim[k],.71,0,0);
          }
          for (let j=0,n=4+Math.floor(5*sample());j<n;j++) {
            const a=sample()*2*Math.PI,r=.91*Math.sqrt(sample());
            const p=point(u+r*width*Math.cos(a),v+r*depth*Math.sin(a));
            if (p) roots.push(p);
          }
        }
        for (const [i,p] of roots.entries()) {
          const a=sample()*Math.PI*2;
          for (let j=0,n=2+Math.floor(sample()*3);j<n;j++) {
            const turn=a+j*2.399+sample(), stalk=j===0 && i%11===0;
            const h=(stalk?.16:.056)+sample()*(stalk?.21:.12);
            const wide=stalk?.009:.022+sample()*.029;
            const side=V(-Math.sin(turn)*wide,0,Math.cos(turn)*wide);
            const direction=V(Math.cos(turn),0,Math.sin(turn));
            const root=p.clone().addScaledVector(direction,.045*sample());
            const bend=stalk?h*.67:h*1.42;
            const section=(t,w)=>{
              const center=root.clone().addScaledVector(direction,bend*t*t)
                .add(V(0,h*Math.sin(t*(stalk?1.30:2.36)),0));
              return [center.clone().addScaledVector(side,-w),center.clone().addScaledVector(side,w)];
            };
            const stroke=stalk?stalks:blades;
            let [left,right]=section(0,.19);
            for (const [t,w] of [[.28,.66],[.52,1],[.77,.68]]) {
              const [a,b]=section(t,w);
              stroke.push(...left.toArray(),...right.toArray(),...a.toArray(),...a.toArray(),...right.toArray(),...b.toArray());
              left=a; right=b;
            }
            stroke.push(...left.toArray(),...right.toArray(),...section(1,0)[0].toArray());
          }
        }
      }
      if (moss.length) {
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(moss,3));
        geometry.setAttribute('uv',new THREE.Float32BufferAttribute(mossUV,2));
        geometry.computeVertexNormals();
        const mesh=new THREE.Mesh(geometry,mossInk);
        mesh.name=group+' · 湿苔与贴地野叶';
        mesh.userData.landscapeSurface={group,name:mesh.name,material:'GroundMoss'};
        mesh.userData.detailSize=.63;
        mesh.userData.vergePlanting=true;
        mesh.renderOrder=2;
        scene.add(mesh);
      }
      show(group,'野草土斑','BankGrass',ink,soil,alpha);
      show(group,'墙脚野叶','Reeds',leafInk,blades);
      show(group,'篱根草穗','Reeds',stalkInk,stalks);
    }
  }
  plantLaneVerge();


  // Keep the established verge roots; bend each narrow blade into an inclined arc.
  function archLaneGrasses() {
    for (const mesh of scene.children.filter(node=>node.name.endsWith(' · 巷脚细草'))) {
      const old=mesh.geometry, blades=old.attributes.position, positions=[];
      for (let i=0;i<blades.count;i+=3) {
        const left=V().fromBufferAttribute(blades,i), right=V().fromBufferAttribute(blades,i+1);
        const root=left.clone().lerp(right,.5), tip=V().fromBufferAttribute(blades,i+2);
        const side=right.clone().sub(left).multiplyScalar(.31), height=tip.y-root.y;
        const drift=tip.clone().sub(root).setY(0).multiplyScalar(1.40);
        const middle=root.clone().addScaledVector(drift,.36).add(V(0,height*.62,0));
        const neck=root.clone().addScaledVector(drift,.77).add(V(0,height*.88,0));
        const edge=(p,scale)=>[p.clone().addScaledVector(side,-scale),p.clone().addScaledVector(side,scale)];
        const sections=[edge(root,.55),edge(middle,.76),edge(neck,.32),[root.clone().add(drift).add(V(0,height*.91,0))]];
        for (let j=0;j<sections.length-1;j++) {
          const [a,b]=sections[j], [c,d]=sections[j+1];
          positions.push(...a.toArray(),...b.toArray(),...c.toArray());
          if (d) positions.push(...b.toArray(),...d.toArray(),...c.toArray());
        }
      }
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geometry.computeVertexNormals();
      mesh.geometry=geometry;
      old.dispose();
    }
  }
  archLaneGrasses();


  // Bake each building footprint and tree root into the paper and slope materials once.
  function bakeGroundContact() {
    const size = 1024, extent = new THREE.Box2();
    const point = new THREE.Vector2();
    for (const mark of groundContacts) {
      const radius = Math.hypot(mark.rx, mark.rz) + 5;
      extent.expandByPoint(point.set(mark.x-radius, mark.z-radius));
      extent.expandByPoint(point.set(mark.x+radius, mark.z+radius));
    }
    const pixel = extent.getSize(new THREE.Vector2()).divideScalar(size);
    const xmin = extent.min.x, zmin = extent.min.y;
    const bytes = new Uint8Array(size*size);
    for (const {x, z, rx, rz, c, s, tree} of groundContacts) {
      const feather = tree ? 1.72 : 2.85;
      const radius = Math.hypot(rx, rz) + feather + 2;
      const left = Math.max(0, Math.floor((x-radius-xmin)/pixel.x));
      const right = Math.min(size-1, Math.ceil((x+radius-xmin)/pixel.x));
      const top = Math.max(0, Math.floor((z-radius-zmin)/pixel.y));
      const bottom = Math.min(size-1, Math.ceil((z+radius-zmin)/pixel.y));
      for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
        const dx = xmin+(col+.5)*pixel.x-x-.7, dz = zmin+(row+.5)*pixel.y-z+.53;
        const u = c*dx-s*dz, v = s*dx+c*dz;
        const falloff = tree ? Math.hypot(u/(rx+feather), v/(rz+feather*.7))
          : Math.hypot(Math.max(0, Math.abs(u)-rx), Math.max(0, Math.abs(v)-rz))/feather;
        const wash = 1 - THREE.MathUtils.smoothstep(falloff, tree ? .14 : 0, 1);
        const index = row*size+col;
        bytes[index] = Math.max(bytes[index], Math.round(wash*(tree ? 71 : 89)));
      }
    }
    const format = renderer.capabilities.isWebGL2 ? THREE.RedFormat : THREE.LuminanceFormat;
    const field = new THREE.DataTexture(bytes, size, size, format);
    field.magFilter = THREE.LinearFilter;
    field.minFilter = THREE.LinearMipmapLinearFilter;
    field.generateMipmaps = true;
    field.needsUpdate = true;
    contactU.uContact.value = field;
    contactU.uContactRect.value.set(xmin, zmin, pixel.x*size, pixel.y*size);
    groundContacts.length = 0;
    app.cleanups.push(() => field.dispose());
  }
  bakeGroundContact();

  // The streets are static. Bake the light once, retaining actual eaves, trees and doorway silhouettes.
  function bakeLaneShadows() {
    const sun=sharedInk.uLight.value;
    const center=V(-139,6,59);
    const lens=new THREE.OrthographicCamera(-140,140,88,-88,30,360);
    lens.position.copy(center).addScaledVector(sun,193);
    lens.lookAt(center);
    lens.updateMatrixWorld();
    const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
    const casters=new THREE.Scene();
    const receivers=new Set();
    const nearLane=(x,z)=>Math.min(Math.hypot(x+218,z-36),Math.hypot(x+62,z-80))<72;
    const matrix=new THREE.Matrix4(), selected=[], nearbyCrowns=[];
    const besideWalk=(x,z)=>Math.min(Math.hypot(x+206,z-35),Math.hypot(x+67,z-84))<15;
    scene.updateMatrixWorld(true);
    scene.traverse(mesh=>{
      if (!mesh.isMesh) return;
      if (mesh.material?.fragmentShader?.includes('#ifdef LANE_SHADOW')) receivers.add(mesh.material);
      if (mesh.isInstancedMesh && (mesh.name.startsWith('City /') || mesh.userData.vegetation)) {
        selected.length=0;
        nearbyCrowns.length=0;
        const foliage=mesh.userData.vegetation?.part==='foliage';
        // Visibility compaction rewrites the draw buffer. The shadow needs the original street.
        const authored=mesh.userData.authoredMatrices ?? mesh.instanceMatrix.array;
        for (let i=0;i<authored.length/16;i++) {
          matrix.fromArray(authored,i*16);
          const x=matrix.elements[12], z=matrix.elements[14];
          if (!nearLane(x,z)) continue;
          // Keep the nearest patches of dapple broken into leaves. The far proxy supplies the other crowns.
          const batch=foliage && besideWalk(x,z) ? nearbyCrowns : selected;
          batch.push(i);
        }
        for (const [ids,geometry] of [
          [selected,mesh.userData.farGeometry ?? mesh.geometry],
          [nearbyCrowns,mesh.userData.midGeometry]
        ]) {
          if (!ids.length) continue;
          const copies=new THREE.InstancedMesh(geometry,depth,ids.length);
          ids.forEach((source,i)=>{copies.setMatrixAt(i,matrix.fromArray(authored,source*16));});
          copies.frustumCulled=false;
          copies.userData.trace=mesh.name.startsWith('City /');
          casters.add(copies);
        }
      } else if (!mesh.userData.vergePlanting && (/滨水街巷|茶棚后街坊/.test(mesh.userData.landscapeSurface?.group ?? '') ||
          /^(汉阳岸上收缆人|武昌石凳上看江人) · /.test(mesh.name))) {
        mesh.geometry.computeBoundingBox();
        if (mesh.geometry.boundingBox.max.y<LAND_Y+.29) return;
        const copy=new THREE.Mesh(mesh.geometry,depth);
        copy.applyMatrix4(mesh.matrixWorld);
        copy.userData.trace=true;
        casters.add(copy);
      }
    });
    // A single batched line drawing picks up the corners of the houses and joinery near the visitor.
    const drawn=[], vertex=new THREE.Vector3();
    for (const part of casters.children) {
      if (!part.userData.trace) continue;
      const edges=new THREE.EdgesGeometry(part.geometry,46);
      const points=edges.getAttribute('position');
      for (let i=0;i<(part.isInstancedMesh ? part.count : 1);i++) {
        if (part.isInstancedMesh) {
          part.getMatrixAt(i,matrix);
          const x=matrix.elements[12], z=matrix.elements[14];
          if (Math.min(Math.hypot(x+222,z-36),Math.hypot(x+54,z-75))>36) continue;
        } else matrix.copy(part.matrix);
        for (let k=0;k<points.count;k++) {
          vertex.fromBufferAttribute(points,k).applyMatrix4(matrix);
          drawn.push(vertex.x,vertex.y,vertex.z);
        }
      }
      edges.dispose();
    }
    const lines=new THREE.BufferGeometry();
    lines.setAttribute('position',new THREE.Float32BufferAttribute(drawn,3));
    const inkLine=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,uniforms:{...camU,fade:cityCloseFade},
      vertexShader:`varying vec3 point; varying float depth;
        void main(){point=position;vec4 mv=viewMatrix*vec4(position,1.);depth=-mv.z;
          gl_Position=projectionMatrix*mv;gl_Position.z-=.000012*gl_Position.w;}`,
      fragmentShader:NOISE+`varying vec3 point;varying float depth;uniform vec3 uCam;uniform vec2 fade;
        void main(){float d=length(point-uCam);
          float focus=smoothstep(fade.x,fade.y,d)*(1.-smoothstep(21.,68.,depth));
          float broken=vnoise(point.xz*1.7+point.y*.72);
          gl_FragColor=vec4(.185,.186,.159,focus*(.13+.48*smoothstep(.20,.82,broken)));}`
    });
    const contours=new THREE.LineSegments(lines,inkLine);
    contours.name='两岸街屋转角墨线';
    contours.raycast=()=>{};
    contours.userData.detailDepth=68;
    scene.add(contours);
    app.cleanups.push(()=>{lines.dispose();inkLine.dispose();});
    const size=Math.min(2048,renderer.capabilities.maxTextureSize);
    const shadow=new THREE.WebGLRenderTarget(size,size,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
    const previous=renderer.getRenderTarget();
    casters.background=new THREE.Color(0xffffff);
    try {
      renderer.setRenderTarget(shadow);
      renderer.render(casters,lens);
    } finally {
      renderer.setRenderTarget(previous);
      casters.children.forEach(mesh=>{if(mesh.isInstancedMesh) mesh.dispose();});
      depth.dispose();
    }
    const uniforms={
      uLaneShadow:{value:shadow.texture},
      uLaneLight:{value:new THREE.Matrix4().multiplyMatrices(lens.projectionMatrix,lens.matrixWorldInverse)},
      uShadowTexel:{value:new THREE.Vector2(1/size,1/size)},
    };
    for (const material of receivers) {
      material.defines={...material.defines,LANE_SHADOW:1};
      Object.assign(material.uniforms,uniforms);
      material.needsUpdate=true;
    }
    app.cleanups.push(()=>shadow.dispose());
    return contours;
  }
