
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

    function prototype(crownSides = 7, crownRings = crownProfile) {
      const positions = [], indices = [], colors = [];
      function add(x, y, z, tint, shade) {
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
        const offset = positions.length / 3;
        const tint = new THREE.Color(hex), c = Math.cos(yaw), s = Math.sin(yaw);
        const rings = crownRings, n = crownSides;
        const phase = x * 2.7 + z * 3.1 + yaw;
        for (const [j, [py, radius]] of rings.entries()) {
          for (let i = 0; i < n; i++) {
            const a = i * Math.PI * 2 / n + (j % 2) * .27;
            const bud = Math.sin(a * 3 + phase) * .14 + Math.cos(a * 2 - phase + j) * .09;
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
      }
      function geometry() {
        const mesh = new THREE.BufferGeometry();
        mesh.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        mesh.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        mesh.setIndex(indices);
        mesh.computeVertexNormals();
        return mesh;
      }
      return { branch, crown, geometry };
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

    for (const [i, model] of Object.values(treeTypes).entries()) {
      const wood = prototype(), leaves = prototype();
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
      for (const lobe of model.crowns) leaves.crown(lobe);
      model.assets = { wood: wood.geometry(), foliage: leaves.geometry() };
      // Distant instances keep the full footprint and pigment from three broad lobes.
      const farWood = prototype(), farLeaves = prototype(5, distantCrownProfile);
      farWood.branch(model.trunk[0], model.trunk[1], stem[0], stem[1], 4);
      farWood.branch(model.trunk[1], model.trunk[3], stem[1], stem[3], 4);
      for (const lobe of model.distantCrown) farLeaves.crown(lobe);
      model.farAssets = { wood: farWood.geometry(), foliage: farLeaves.geometry() };
      for (const geometry of [...Object.values(model.assets), ...Object.values(model.farAssets)]) {
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
    for (const road of cityGround.streets) {
      const { a, b, width } = road, margin = width / 2 + 6;
      const [x0, z0] = cell(Math.min(a.x, b.x) - margin, Math.min(a.z, b.z) - margin);
      const [x1, z1] = cell(Math.max(a.x, b.x) + margin, Math.max(a.z, b.z) + margin);
      for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
        const key = keyAt(i, j);
        if (!roadCells.has(key)) roadCells.set(key, []);
        roadCells.get(key).push(road);
      }
    }
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
          cityGround.occupied(x, z, radius * .81 + .42) ||
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
        if (plant('broadleaf', p.x, p.z, .87, .82, forecourtTrees) || key !== 'museum') continue;
        // Preserve the side courts when an exact point lies too close to a walk.
        const local = museum.worldToLocal(p.clone());
        for (const [side, along] of [[2.1,-3.7],[2.6,2.6],[-1.2,-4.3],[3.5,-5.4]]) {
          const q = museum.localToWorld(V(local.x+Math.sign(local.x)*side,0,local.z+along));
          if (plant('broadleaf', q.x, q.z, .71, .76, forecourtTrees)) break;
        }
      }
    }
    const spitTrees = seeded(0x674fc2a);
    for (const [x,z,scale] of [[-151,-124,.76],[-145,-131,.62],[-139,-128,.88],
      [-134,-126,.70],[-124,-130,.52],[-120,-132,.58],[-113,-135,.46],[-148,-135,.62]])
      plant(scale < .65 ? 'willow' : 'broadleaf', x, z, scale, .72*scale, spitTrees);
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
      for (const { a, b, width } of cityGround.streets) {
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

    // Color stores sRGB floats for the standalone map and the Blender capture.
    const plantMaterial = new THREE.ShaderMaterial({
      vertexColors: true,
      uniforms: { ...fogU, ...weatherU, uLight: sharedInk.uLight, uCanopy: { value: 1 } },
      vertexShader: vegetationWind + `
        attribute float windResponse;
        varying vec3 vTint, vNormal, vWorld, vSprig;
        varying float vDistance;
        void main() {
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          mat3 basis = mat3(instanceMatrix);
          vec3 scaled = normal / vec3(dot(basis[0], basis[0]), dot(basis[1], basis[1]), dot(basis[2], basis[2]));
          vec2 root = (modelMatrix * instanceMatrix[3]).xz;
          // Bark and foliage share a shear so branch tips stay inside their lobes.
          vec2 wind = windAt(root) * windResponse;
          float bendHeight = max(position.y - .28, 0.) * .255;
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
          float light = dot(normalize(vNormal),normalize(uLight))*.5+.5;
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
    barkMaterial.uniforms = { ...plantMaterial.uniforms, uCanopy: { value: 0 } };
    for (const [species, model] of Object.entries(treeTypes)) {
      for (const [part, geometry] of Object.entries(model.assets)) {
        if (!model.instances.length) continue;
        const mesh = new THREE.InstancedMesh(geometry, part === 'wood' ? barkMaterial : plantMaterial, model.instances.length);
        mesh.name = `Vegetation / ${species} / ${part}`;
        mesh.userData.vegetation = { species, part, material: part === 'wood' ? 'plantBark' : model.material };
        mesh.userData.farGeometry = model.farAssets[part];
        model.instances.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
        mesh.instanceMatrix.needsUpdate = true;
        scene.add(mesh);
      }
    }
  }
  buildVegetation();


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
