
  /* ═════════ 四、景点模型（各自以原点为基准建造，再按坐标落位） ═════════ */

  // Blender meshes are embedded in the HTML so file:// and offline model loading share one path.
  const architectureTints = {
    stone: ['#766e63', '#ded5c4'], plaster: ['#9a8466', '#f1e4c8'],
    timber: ['#55372e', '#a96e52'], vermilion: ['#683d32', '#af7058'],
    roofGold: ['#795632', '#ceaf73'], bronze: ['#685336', '#d0ae6e'],
    ink: ['#28312c', '#50564b'], shadow: ['#373b34', '#666452'],
    steel: ['#344b49', '#798d82'], deck: ['#646961', '#ada99b'],
    plaqueBlue: ['#10242e', '#345968'], plaqueGold: ['#c09650', '#f3d88d'],
    suspensionOrange: ['#864432', '#dc895d'],
    glaze: ['#42574e', '#8c9a87'],
    cityWall: ['#a19788', '#ddd6c6'], cityRoof: ['#65736c', '#aaafa0'],
    cityBrick: ['#978275', '#c9b6a0'], cityShade: ['#7f8075', '#b0ac9c']
  };
  const architectureMaterials = Object.fromEntries(Object.entries(architectureTints).map(([key, tint]) => {
    const material = inkMat(.04, true, tint, key.startsWith('city') ? [16, 42] : null);
    material.defines = { ARCHITECTURE_AO: 1 };
    return [key, material];
  }));
  function decodeWords(data, Type) {
    const bytes = Uint8Array.from(atob(data), char => char.charCodeAt(0));
    return new Type(bytes.buffer);
  }
  function architectureParts(name) {
    return Object.entries(ARCHITECTURE[name]).map(([key, [vertices, faces, light]]) => {
      const coordinates = Float32Array.from(decodeWords(vertices, Int16Array), n => n / 128);
      const indexed = new THREE.BufferGeometry();
      indexed.setAttribute('position', new THREE.BufferAttribute(coordinates, 3));
      indexed.setAttribute('skyVisibility', new THREE.BufferAttribute(decodeWords(light, Uint8Array), 1, true));
      indexed.setIndex(new THREE.BufferAttribute(decodeWords(faces, Uint16Array), 1));
      const geometry = indexed.toNonIndexed();
      geometry.computeVertexNormals();
      return { geometry, material: architectureMaterials[key] };
    });
  }
  function builtLandmark(name) {
    const group = new THREE.Group();
    group.userData.modelKey = name;
    architectureParts(name).forEach(({ geometry, material }) => group.add(new THREE.Mesh(geometry, material)));
    return group;
  }

  /* ── 舟船 ── */
  function sampan() {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(hullGeo([[-2.8, 0], [-1.6, .78, 0, .78], [1.6, .78, 3.0, .12], [3.05, 0, 3.0, -.12], [1.6, -.78, 0, -.78], [-1.6, -.78, -2.8, 0]], .6), M.std);
    hull.position.y = -.15; g.add(ink(hull, 25));
    const a = new Acc();
    const cap = new THREE.CylinderGeometry(.62, .62, 2.3, 12, 1, true, 0, Math.PI); cap.rotateZ(Math.PI / 2);
    const awn = new THREE.Mesh(cap, M.dbl); awn.position.set(-.3, .5, 0); g.add(ink(awn, 40));
    a.cone(.28, 1.1, 3.05, .55, 0, V(1, 1.4, 0)); a.cone(.28, 1.0, -2.85, .5, 0, V(-1, 1.2, 0));
    a.cyl(.15, .9, 1.7, .55, 0); a.geo(new THREE.SphereGeometry(.2, 8, 6), 1.7, 1.15, 0);
    a.cone(.46, .22, 1.7, 1.35, 0, UP);
    a.beam(V(1.7, .8, .2), V(3.6, 2.6, .9), .06);
    a.beam(V(-2.5, .15, .5), V(-4.3, -.4, 1.6), .07);
    g.add(a.mesh(brushMat, false));
    return g;
  }
  function junk() {
    const g = sampan(), a = new Acc();
    a.cyl(.07, 5.2, .6, 3.0, 0);
    for (let k = 0; k < 7; k++) a.box(.06, .07, 2.5 - k * .05, -.55, 1.2 + k * .62, 0);
    g.add(a.mesh(brushMat, false));
    const sg = new THREE.PlaneGeometry(2.6, 4.2, 1, 8), p = sg.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / 1.3 + 1) * Math.PI / 2) * .4 * (1 - Math.abs(p.getY(i)) / 3));
    sg.computeVertexNormals(); sg.rotateY(Math.PI / 2);
    const sail = new THREE.Mesh(sg, inkMat(.45, true)); sail.position.set(-.05, 3.2, 0); g.add(ink(sail, 60));
    return g;
  }
  const contMats = [inkMat(.05), inkMat(.32), inkMat(.55), inkMat(.18)];
  function cargoShip() {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(hullGeo([[-6.4, -1.7], [5.2, -1.7], [7.2, -1.5, 9.2, 0], [7.2, 1.5, 5.2, 1.7], [-6.4, 1.7]], 1.7), M.std);
    hull.position.y = -.5; g.add(ink(hull, 25));
    for (let x = -1.2; x < 5.2; x += 1.8) for (const z of [-.85, .85]) for (let l = 0; l < 3; l++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(1.7, .9, 1.55), contMats[(Math.floor(x * 3 + z * 5 + l * 2) % 4 + 4) % 4]);
      c.position.set(x, 1.65 + l * .92, z); g.add(ink(c));
    }
    const a = new Acc(), b = new Acc();
    b.box(3.0, 1.3, 3.0, -4.3, 1.9, 0); b.box(2.6, 1.2, 2.8, -4.3, 3.15, 0); b.box(2.1, 1.1, 2.6, -4.3, 4.3, 0);
    [1.5, 2.75, 3.9].forEach(y => a.box(.06, .38, 3.05, -4.3, y, 0));
    a.box(.9, 1.4, .9, -5.3, 5.5, 0); a.cyl(.07, 2.2, -3.6, 5.4, 0); a.box(1.4, .07, .07, -3.6, 5.9, 0);
    g.add(b.mesh(M.pale, true, 30), a.mesh(brushMat, false));
    g.scale.setScalar(.78); return g;
  }
  function riverLiner() {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(hullGeo([[-5.6, -1.6], [4.4, -1.6], [6.0, -1.4, 7.4, 0], [6.0, 1.4, 4.4, 1.6], [-5.6, 1.6]], 1.3), M.std);
    hull.position.y = -.4; g.add(ink(hull, 25));
    const a = new Acc(), b = new Acc();
    b.box(9.4, 1.0, 2.8, -.4, 1.4, 0); b.box(7.6, 1.0, 2.6, -.8, 2.4, 0); b.box(5.2, 1.0, 2.3, -1.2, 3.4, 0); b.box(2.6, .9, 1.9, -.6, 4.3, 0);
    [1.4, 2.4, 3.4].forEach((y, i) => a.box(8.6 - i * 2, .24, 2.86 - i * .22, -.4 - i * .4, y + .05, 0));
    a.cyl(.48, 1.9, -2.6, 4.8, 0); a.box(1.1, .28, 1.1, -2.6, 5.4, 0); a.cyl(.05, 2.0, 1.4, 5.4, 0);
    g.add(b.mesh(M.pale, true, 30), a.mesh(brushMat, false));
    g.scale.setScalar(.8); return g;
  }
