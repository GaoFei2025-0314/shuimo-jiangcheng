
  /* ═════════ 四、景点模型（各自以原点为基准建造，再按坐标落位） ═════════ */

  // ── 黄鹤楼：三重台基 · 五层攒尖 · 斗拱重檐 · 葫芦宝顶（1985 年重建，通高 51.4 米）
  function buildTower() {
    const g = new THREE.Group(), pale = new Acc(), wall = new Acc(), roofs = new Acc(), dark = new Acc();
    pale.box(25, 9, 25, 0, -4.5, 0);
    let y = 0;
    [[23, 1.0], [20.5, 1.0], [18, 1.2]].forEach(([s, h]) => { pale.box(s, h, s, 0, y + h / 2, 0); y += h; });
    const PT = y;
    for (let i = 0; i < 8; i++) pale.box(5.4, .4 * (i + 1), .6, 0, .2 * (i + 1), 13.6 - i * .6);
    ring(dark, 9.0, PT + .95, .16); ring(dark, 9.0, PT + .55, .1);
    perim(9.0, .9).forEach(p => dark.box(.16, .9, .16, p[0], PT + .45, p[1]));

    const hws = [6.6, 5.9, 5.2, 4.5, 3.8], FH = 3.5, STRIDE = 5.3;
    let yb = PT;
    hws.forEach((hw, i) => {
      pale.box(2 * hw + .9, .4, 2 * hw + .9, 0, yb + .2, 0);
      wall.box(hw * 1.5, FH - .4, hw * 1.5, 0, yb + .4 + (FH - .4) / 2, 0);
      for (let s = 0; s < 4; s++) {
        const a = s * Math.PI / 2, cs = Math.cos(a), sn = Math.sin(a), dist = hw * .75 + .06;
        [-1.7, 0, 1.7].forEach(t => {
          dark.box(1.0, 1.7, .1, t * cs + dist * sn, yb + 1.75, -t * sn + dist * cs, a);
          dark.box(1.25, .12, .14, t * cs + (dist + .04) * sn, yb + 2.7, -t * sn + (dist + .04) * cs, a);
        });
      }
      perim(hw, hw * 2 / 5).forEach(p => {
        dark.cyl(.17, FH - .5, p[0], yb + .4 + (FH - .5) / 2, p[1]);
        dark.box(.56, .26, .56, p[0], yb + FH - .2, p[1]);
        dark.box(1.6, .2, .3, p[0], yb + FH - .02, p[1], p[2]);
        dark.box(.9, .18, .26, p[0], yb + FH + .16, p[1], p[2]);
      });
      ring(dark, hw, yb + FH - .55, .26);
      ringAt(dark, hw, yb + .95, .1, .5);
      perim(hw + .02, .55).forEach(p => dark.box(.09, .6, .09, p[0], yb + .7, p[1]));

      const top = i === hws.length - 1;
      const R = hw + 2.7, r = top ? .3 : hws[i + 1] * .95 + .3, H = top ? 3.6 : 1.8, lift = top ? 1.3 : 1.15;
      const ry = yb + FH - .1;
      roofs.geo(roofGeo(R, r, H, lift, 18, 7), 0, ry, 0);
      tips4.forEach(([sx, sz]) => {
        dark.cone(.3, 1.6, sx * (R + .05), ry + lift + .5, sz * (R + .05), V(sx * .8, .9, sz * .8));
        if (!top) dark.cone(.14, .7, sx * (R * .55), ry + H * .35 + lift * .12, sz * (R * .55), V(sx * .3, 1, sz * .3));
        dark.beam(V(sx * r, ry + H, sz * r), V(sx * R, ry + lift * .5, sz * R), .16);
      });
      if (i === 0) {   // 底层副檐 → 重檐
        const R2 = hw + 4.6, sy = yb + 2.35;
        roofs.geo(roofGeo(R2, hw + .7, 1.2, .9, 18, 5), 0, sy, 0);
        perim(hw + 3.9, (hw + 3.9) * 2 / 6).forEach(p => {
          dark.cyl(.16, 2.0, p[0], yb + .4 + 1.0, p[1]); dark.box(.5, .2, .5, p[0], sy - .1, p[1]);
        });
        ring(dark, hw + 3.9, yb + 1.0, .1);
        tips4.forEach(([sx, sz]) => dark.cone(.26, 1.3, sx * (R2 + .05), sy + 1.25, sz * (R2 + .05), V(sx * .8, .9, sz * .8)));
      }
      yb += STRIDE;
    });
    const yTop = yb - STRIDE + FH - .1 + 3.6;
    const prof = [[0, 0], [.55, .05], [.85, .5], [.6, .95], [.34, 1.15], [.5, 1.45], [.8, 2.0], [.72, 2.55], [.3, 3.05], [0, 3.3]].map(p => new THREE.Vector2(p[0], p[1]));
    const fin = new THREE.Mesh(new THREE.LatheGeometry(prof, 14), M.pale); fin.position.y = yTop - .1; ink(fin, 20);
    g.add(pale.mesh(M.pale, true, 30), wall.mesh(M.wall, true, 30), roofs.mesh(M.roof, true, 24), dark.mesh(brushMat, false), fin);
    return g;
  }

  // ── 武汉长江大桥：九孔八墩 · 三联连续钢桁梁 · 上路下轨 · 七层桥头堡（1957 年）
  function buildBridge() {
    const g = new THREE.Group();
    const pale = new Acc(), solid = new Acc(), dark = new Acc(), dash = new Acc(), roofs = new Acc(), wall = new Acc();
    const ROAD = 10.6, RAIL = 5.2, BOT = 4.4, PX = 5.6, END = 72;
    const piersZ = [-56, -40, -24, -8, 8, 24, 40, 56];
    const hTop = z => {
      const c = .5 + .5 * Math.cos(2 * Math.PI * (z + 56) / 16);
      return BOT + (8.0 + 3.0 * c) * (1 - .45 * THREE.MathUtils.smoothstep(Math.abs(z), 58, 72));
    };
    const zs = []; for (let z = -END; z <= END + .01; z += 4) zs.push(z);
    [-PX, PX].forEach(x => {
      zs.forEach((z, i) => {
        const t = V(x, hTop(z), z), b = V(x, BOT, z);
        dark.beam(b, t, .38);
        if (i < zs.length - 1) {
          const z2 = zs[i + 1], t2 = V(x, hTop(z2), z2), b2 = V(x, BOT, z2);
          dark.beam(t, t2, .5); dark.beam(b, b2, .5);
          dark.beam(b, t2, .26); dark.beam(t, b2, .26);       // 菱形腹杆
        }
      });
    });
    zs.forEach((z, i) => {
      dark.beam(V(-PX, hTop(z), z), V(PX, hTop(z), z), .3);
      dark.beam(V(-PX, BOT, z), V(PX, BOT, z), .3);
      if (i % 2 === 0 && i < zs.length - 2) {
        const z2 = zs[i + 2];
        dark.beam(V(-PX, hTop(z), z), V(PX, hTop(z2), z2), .18);
        dark.beam(V(PX, hTop(z), z), V(-PX, hTop(z2), z2), .18);
      }
      if (i % 4 === 0) {
        dark.beam(V(-PX, hTop(z) - 1.6, z), V(0, hTop(z) - .3, z), .16);
        dark.beam(V(PX, hTop(z) - 1.6, z), V(0, hTop(z) - .3, z), .16);
      }
    });
    pale.box(10.6, .5, END * 2, 0, ROAD, 0);
    pale.box(10.6, .6, END * 2, 0, RAIL, 0);
    pale.box(.8, .3, END * 2, -4.9, ROAD + .3, 0); pale.box(.8, .3, END * 2, 4.9, ROAD + .3, 0);
    for (let z = -END + 2; z < END; z += 4) dash.box(.16, .04, 1.9, 0, ROAD + .27, z);
    [-1.6, 1.6].forEach(x => dark.beam(V(x, RAIL + .4, -END), V(x, RAIL + .4, END), .16));
    for (let z = -END; z < END; z += 1.2) dark.box(4.4, .1, .35, 0, RAIL + .35, z);
    [-5.15, 5.15].forEach(x => {
      dark.beam(V(x, ROAD + 1.5, -END), V(x, ROAD + 1.5, END), .1);
      dark.beam(V(x, ROAD + .9, -END), V(x, ROAD + .9, END), .08);
      for (let z = -END; z <= END; z += 1.8) dark.box(.09, 1.3, .09, x, ROAD + .95, z);
    });
    for (let z = -END + 8; z < END; z += 16) [-4.9, 4.9].forEach(x => {
      dark.cyl(.07, 4.2, x, ROAD + 2.4, z); dark.box(.5, .18, .5, x, ROAD + 4.5, z);
    });
    const sh = new THREE.Shape();
    sh.moveTo(-7.2, 0); sh.quadraticCurveTo(-4.8, 1.9, -2, 1.9); sh.lineTo(2, 1.9); sh.quadraticCurveTo(4.8, 1.9, 7.2, 0);
    sh.quadraticCurveTo(4.8, -1.9, 2, -1.9); sh.lineTo(-2, -1.9); sh.quadraticCurveTo(-4.8, -1.9, -7.2, 0);
    const pg = new THREE.ExtrudeGeometry(sh, { depth: BOT + 3.6, bevelEnabled: false, curveSegments: 10 });
    pg.rotateX(-Math.PI / 2);
    piersZ.concat([-END, END]).forEach(z => {
      const p = new THREE.Mesh(pg, M.pale); p.position.set(0, -3, z); ink(p, 30); g.add(p);
      pale.box(11.6, .9, 3.6, 0, BOT - .5, z);
    });
    const slope = .11, th = Math.atan(slope), yDeck = az => ROAD - slope * (az - END);
    [-1, 1].forEach(s => {
      const len = 82, mid = END + len / 2;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(10.6, .6, len / Math.cos(th)), M.pale);
      slab.position.set(0, yDeck(mid), s * mid); slab.rotation.x = s * th; ink(slab); g.add(slab);
      for (let k = 1; k <= 6; k++) {
        const az = END + 12 * k, top = yDeck(az) - .3;
        solid.box(2.2, top - .6, 3.2, -3.6, (top + .6) / 2, s * az); solid.box(2.2, top - .6, 3.2, 3.6, (top + .6) / 2, s * az);
        solid.box(9.4, .7, 3.4, 0, top - .35, s * az);
        const amid = az - 6, ytop = yDeck(amid) - .3;
        const arc = new THREE.TorusGeometry(5.0, .42, 6, 16, Math.PI); arc.rotateY(Math.PI / 2); arc.scale(1, .82, 1);
        [-3.6, 3.6].forEach(x => solid.geo(arc, x, ytop - 5.0 * .82 - .1, s * amid));
      }
    });
    [-1, 1].forEach(sz => [-1, 1].forEach(sx => {          // 桥头堡：七层，重檐四坡攒尖
      const cx = sx * 12.2, cz = sz * 84, hh = 13.2, y0 = .6;
      wall.box(6, hh, 6, cx, y0 + hh / 2, cz); pale.box(7.2, .8, 7.2, cx, y0 + .4, cz);
      for (let f = 0; f < 7; f++) {
        const fy = y0 + 1.2 + f * 1.7;
        pale.box(6.5, .22, 6.5, cx, fy + 1.55, cz);
        for (let s = 0; s < 4; s++) {
          const a = s * Math.PI / 2, cs = Math.cos(a), sn = Math.sin(a);
          [-1.7, 0, 1.7].forEach(t => dark.box(.9, .95, .1, cx + t * cs + 3.03 * sn, fy + .75, cz - t * sn + 3.03 * cs, a));
        }
      }
      roofs.geo(roofGeo(5.2, 2.7, 1.5, .7, 14, 5), cx, y0 + hh, cz);
      wall.box(3.6, 1.7, 3.6, cx, y0 + hh + 1.35, cz);
      roofs.geo(roofGeo(3.5, .25, 2.6, .8, 14, 5), cx, y0 + hh + 2.1, cz);
      tips4.forEach(([a, b]) => {
        dark.cone(.22, 1.2, cx + a * 5.25, y0 + hh + .9, cz + b * 5.25, V(a * .8, .9, b * .8));
        dark.cone(.2, 1.0, cx + a * 3.55, y0 + hh + 2.95, cz + b * 3.55, V(a * .8, .9, b * .8));
      });
      dark.cyl(.08, 1.6, cx, y0 + hh + 5.6, cz); dark.cone(.3, .6, cx, y0 + hh + 6.6, cz, UP);
    }));
    g.add(pale.mesh(M.pale, true, 30), solid.mesh(M.std, true, 30), wall.mesh(M.wall, true, 30),
          roofs.mesh(M.roof, true, 24), dark.mesh(brushMat, false), dash.mesh(dashMat, false));
    return g;
  }

  // ── 龟山电视塔：塔座 · 锥筒塔身 · 旋转餐厅塔楼 · 天线桅杆（塔身 221.2 米）
  function buildTV() {
    const g = new THREE.Group(), S = mkS();
    const P = a => a.map(p => new THREE.Vector2(p[0], p[1]));
    S.pale.box(18, 14, 18, 0, -7, 0);                                     // 塔基没入龟山脊：峰顶窄，台座四角外地面陡落
    S.pale.box(20, 3.4, 20, 0, 1.7, 0); S.pale.box(13, 2.4, 13, 0, 4.6, 0);
    S.roofs.geo(roofGeo(12, 5, 2.4, .6, 12, 3), 0, 5.6, 0);
    const shaft = new THREE.Mesh(new THREE.LatheGeometry(P([[7.4, 0], [5.6, 4], [4.0, 10], [3.3, 20], [2.9, 40], [2.7, 60], [2.5, 76]]), 30), M.dbl);
    const pod = new THREE.Mesh(new THREE.LatheGeometry(P([[2.7, 0], [6.4, 1.4], [8.4, 3.0], [8.4, 6.2], [6.6, 8.2], [5.2, 9.0], [5.8, 9.8], [5.8, 11.6], [4.2, 12.3], [2.7, 12.8]]), 30), M.pale);
    pod.position.y = 44;
    const mast = new THREE.Mesh(new THREE.LatheGeometry(P([[1.2, 0], [.8, 8], [.5, 14], [.22, 22]]), 12), M.std); mast.position.y = 76;
    S.dark.cyl(6.2, .5, 0, 55.6, 0);
    for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2; S.dark.box(.14, 1.0, .14, Math.cos(a) * 5.8, 56.3, Math.sin(a) * 5.8); }
    for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; S.dark.box(.5, 1.5, .1, Math.cos(a) * 8.46, 47.6, Math.sin(a) * 8.46, -a + Math.PI / 2); }
    [80, 86, 92].forEach((y, i) => S.dark.cyl(1.7 - i * .3, .22, 0, y, 0));
    [[0, 1], [1, 0], [0, -1], [-1, 0]].forEach(([a, b]) => S.dark.beam(V(a * 3.4, 62, b * 3.4), V(a * 2.6, 76, b * 2.6), .12));
    g.add(S.pale.mesh(M.pale, true, 30), S.roofs.mesh(M.roof, true, 24), S.dark.mesh(brushMat, false), ink(shaft, 40), ink(pod, 35), ink(mast, 40));
    return g;
  }

  // ── 晴川阁：禹功矶上的重檐楼阁 · 左右翼亭 · 铁门关
  function buildQingchuan() {
    const g = new THREE.Group(), S = mkS();
    S.pale.box(28, 6, 17, 0, -3, 0); S.pale.box(26, 1.0, 15, 0, .5, 0); S.pale.box(22, 1.0, 11.5, 0, 1.5, 0);
    for (let i = 0; i < 6; i++) S.pale.box(6, .33 * (i + 1), .55, 0, .165 * (i + 1), 8.6 - i * .5);
    hall(S, 5.6, 2.0, 3.7, { R: 8.4, r: 4.8, H: 1.7, lift: 1.1, cols: 5 });
    S.roofs.geo(roofGeo(9.7, 6.4, 1.1, .8, 16, 4), 0, 3.6, 0);
    hall(S, 4.5, 7.3, 3.4, { R: 7.4, H: 3.2, lift: 1.2, cols: 4 });
    [-1, 1].forEach(s => {
      S.pale.box(9, .6, 3, s * 10.5, 2.3, 0);
      S.dark.beam(V(s * 6.5, 4.6, 1.4), V(s * 15, 4.6, 1.4), .14);
      S.dark.beam(V(s * 6.5, 4.6, -1.4), V(s * 15, 4.6, -1.4), .14);
      hall(S, 2.3, 2.0, 3.0, { R: 4.9, H: 2.4, lift: .9, cols: 2, x: s * 16, z: 0 });
    });
    finish(S, g);
    const gate = new Acc();                                   // 铁门关
    gate.box(2.2, 6, 2.6, 16.8, 3, 9); gate.box(2.2, 6, 2.6, 23.2, 3, 9); gate.box(8.6, 1.2, 2.8, 20, 6.6, 9);
    gate.geo(new THREE.TorusGeometry(2.2, .5, 6, 14, Math.PI), 20, 4.0, 9);
    g.add(gate.mesh(M.std, true, 30));
    return g;
  }

  // ── 江汉关：四层主楼 · 科林斯柱廊 · 五层钟楼与四面大钟（1924 年，通高 45.85 米）
  function buildCustoms() {
    const g = new THREE.Group(), S = mkS(), W = 30, D = 14, FL = 4.2, N = 4, Y0 = 1.2;
    S.pale.box(W + 8, Y0, D + 5, 0, Y0 / 2, 0);
    for (let i = 0; i < 4; i++) S.pale.box(16, .3 * (i + 1), .7, 0, .15 * (i + 1), D / 2 + 3.65 - i * .7);
    S.wall.box(W, N * FL, D, 0, Y0 + N * FL / 2, 0);
    for (let f = 0; f <= N; f++) S.pale.box(W + .6, .32, D + .6, 0, Y0 + f * FL, 0);
    for (let f = 0; f < N; f++) for (let k = 0; k <= 10; k++) {
      const x = -12.5 + k * 2.5; if (f === 0 && Math.abs(x) < 2) continue;
      S.dark.box(1.1, 2.1, .16, x, Y0 + f * FL + 2.2, D / 2 + .06);
      S.dark.box(1.5, .22, .3, x, Y0 + f * FL + 3.4, D / 2 + .1);
    }
    S.dark.box(3.2, 4.6, .2, 0, Y0 + 2.3, D / 2 + .08);
    for (let f = 0; f < N; f++) for (let k = -3; k <= 3; k++) [-1, 1].forEach(s => S.dark.box(.16, 2.1, 1.0, s * (W / 2 + .06), Y0 + f * FL + 2.2, k * 1.9));
    for (let i = 0; i < 6; i++) S.pale.cyl(.78, 3 * FL, -12.5 + i * 5, Y0 + 1.5 * FL, D / 2 + 2.4);
    S.pale.box(W - .6, 1.4, 3.6, 0, Y0 + 3 * FL + .7, D / 2 + 1.9);
    S.pale.box(W + .4, .6, 4.2, 0, Y0 + N * FL + .3, 0);
    const ps = new THREE.Shape(); ps.moveTo(-W / 2 + 1.2, 0); ps.lineTo(W / 2 - 1.2, 0); ps.lineTo(0, 3.3); ps.closePath();
    S.pale.geo(new THREE.ExtrudeGeometry(ps, { depth: 3.2, bevelEnabled: false }), 0, Y0 + 3 * FL + 1.4, D / 2 + .4);
    const TW = [9.2, 8.2, 7.2, 6.2, 5.0], TH = [3.6, 3.4, 3.2, 3.0, 3.0];
    let ty = Y0 + N * FL + .6;
    TW.forEach((w, i) => {
      S.wall.box(w, TH[i], w, 0, ty + TH[i] / 2, 0); S.pale.box(w + .7, .3, w + .7, 0, ty + TH[i] + .15, 0);
      for (let s = 0; s < 4; s++) {
        const a = s * Math.PI / 2, cs = Math.cos(a), sn = Math.sin(a), d = w / 2 + .06;
        if (i === 2) {
          S.pale.disc(1.6, .2, d * sn, ty + TH[i] / 2, d * cs, a); S.dark.disc(.12, .3, d * sn, ty + TH[i] / 2, d * cs, a);
          S.dark.box(.14, 1.1, .28, d * sn, ty + TH[i] / 2 + .45, d * cs, a);
          S.dark.box(.9, .14, .28, d * sn + .35 * cs, ty + TH[i] / 2, d * cs - .35 * sn, a);
        } else [-1.4, 1.4].forEach(t => S.dark.box(.8, TH[i] - 1.3, .1, t * cs + d * sn, ty + TH[i] / 2, -t * sn + d * cs, a));
      }
      ty += TH[i] + .3;
    });
    const dome = new THREE.Mesh(new THREE.LatheGeometry([[3.1, 0], [3.4, .35], [2.7, 1.9], [1.5, 3.1], [.45, 3.9], [0, 4.2]].map(p => new THREE.Vector2(p[0], p[1])), 20), M.roof);
    dome.position.y = ty; ink(dome, 35);
    S.dark.cyl(.07, 3.2, 0, ty + 5.6, 0);
    finish(S, g); g.add(dome);
    return g;
  }

  // ── 楚天台：六层台榭，按「章华台」形制，顶立铜凤；台前编钟
  function buildChutian() {
    const g = new THREE.Group(), S = mkS(), W = [24, 20, 16.5, 13, 10, 7.4], TH = 3.5;
    S.pale.box(27, 6, 27, 0, -3, 0);
    for (let i = 0; i < 16; i++) S.pale.box(6, .5 * (i + 1) * .7, .7, 0, .25 * (i + 1) * .7, 15.6 - i * .7);
    let y = 0;
    W.forEach((w, i) => {
      S.pale.box(w, .5, w, 0, y + .25, 0);
      S.wall.box(w - 1.6, TH - .5, w - 1.6, 0, y + .5 + (TH - .5) / 2, 0);
      perim(w / 2 - .3, (w - .6) / 4).forEach(p => S.dark.cyl(.15, TH - .7, p[0], y + .5 + (TH - .7) / 2, p[1]));
      S.roofs.geo(roofGeo(w / 2 + 1.5, (W[i + 1] || 5.2) / 2 + .2, .9, .5, 14, 3), 0, y + TH - .25, 0);
      y += TH + .35;
    });
    hall(S, 2.5, y - .2, 2.9, { R: 4.7, H: 2.5, lift: .9, win: false });
    const py = y + 5.2;
    S.dark.cone(.55, 1.8, 0, py + .7, 0, UP); S.dark.cone(.28, 1.2, 0, py + 1.9, .2, V(0, 1, .5));
    S.dark.beam(V(0, py + .9, 0), V(1.9, py + 1.8, 0), .12); S.dark.beam(V(0, py + .9, 0), V(-1.9, py + 1.8, 0), .12);
    S.dark.beam(V(0, py + .3, 0), V(0, py - .3, -2.0), .16);
    finish(S, g);
    const b = new Acc();
    b.cyl(.14, 4, -4.4, 2, 18.5); b.cyl(.14, 4, 4.4, 2, 18.5); b.box(9.4, .2, .2, 0, 3.9, 18.5);
    for (let i = 0; i < 8; i++) b.cyl(.2 + (7 - i) * .012, .5 + (7 - i) * .07, -3.4 + i * .97, 3.3 - (7 - i) * .04, 18.5);
    g.add(b.mesh(brushMat, false));
    return g;
  }

  // ── 武大老斋舍：四栋依山斋舍，三座罗马券拱门连为一体，门上歇山亭楼（1931 年）
  function buildWuda() {
    const g = new THREE.Group(), S = mkS(), BW = 9.4, GAP = 3.4;
    S.pale.box(50, 10, 15, 0, -5, 0);
    [-1.5, -.5, .5, 1.5].map(k => k * (BW + GAP)).forEach(x => {
      S.wall.box(BW, 9.6, 8, x, 4.8, 0);
      for (let f = 0; f < 3; f++) for (let k = -3; k <= 3; k++) S.dark.box(.85, 1.5, .1, x + k * 1.2, 2.2 + f * 3.1, 4.05);
      for (let f = 1; f <= 3; f++) S.pale.box(BW + .3, .28, 8.3, x, f * 3.1 - .05, 0);
      S.roofs.geo(roofGeo(6.4, 3.6, .9, .2, 12, 3), x, 9.4, 0);
    });
    [-1, 0, 1].forEach(k => {
      const x = k * (BW + GAP);
      S.wall.box(GAP + .4, 9.6, 8, x, 4.8, 0);
      S.dark.box(2.2, 3.6, .3, x, 1.9, 4.15); S.dark.cyl(1.1, .3, x, 3.7, 4.15);
      S.pale.box(GAP + 1.1, .4, 8.4, x, 9.5, 0);
      hall(S, 1.35, 9.6, 2.8, { R: 3.9, H: 1.8, lift: .8, win: false, cols: 2, rail: false, x, z: 0 });
    });
    for (let i = 0; i < 10; i++) S.pale.box(6.2, .45 * (i + 1), .7, 0, .225 * (i + 1) - .4, 8.6 - i * .55);
    return finish(S, g);
  }

  const oct = (r0, r1, h) => new THREE.CylinderGeometry(r1, r0, h, 8);   // 八角柱：下径 r0，上径 r1

  // ── 洪山宝塔 · 宝通禅寺：八面七级砖石仿木塔（元代），塔前一进殿堂
  function buildPagoda() {
    const g = new THREE.Group(), S = mkS();
    S.pale.box(26, 8, 34, 0, -4, 6);                                        // 依山的台地
    S.pale.geo(oct(6.2, 5.8, 1.6), 0, .8, 0);                               // 须弥座
    let y = 1.6, r = 4.6;
    for (let k = 0; k < 7; k++) {
      const h = 3.6 - k * .18, d = r * .97 * Math.cos(Math.PI / 8) + .05;
      S.wall.geo(oct(r, r * .97, h), 0, y + h / 2, 0);
      for (let f = 0; f < 8; f += 2) {                                      // 四面券门，逐层错开一面
        const a = (f + .5 + (k % 2)) * Math.PI / 4;
        S.dark.box(1.1, h * .5, .12, Math.sin(a) * d, y + h * .45, Math.cos(a) * d, a);
      }
      S.roofs.geo(new THREE.CylinderGeometry(r * .9, r + 1.3, .9, 8), 0, y + h + .1, 0);   // 腰檐
      S.pale.geo(oct(r * .95, r * .9, .35), 0, y + h + .72, 0);            // 平座
      y += h + .9; r *= .92;
    }
    S.roofs.geo(new THREE.ConeGeometry(r + .9, 2.4, 8), 0, y + 1.2, 0);
    const spire = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.7, .1], [.5, .8], [.9, 1.3], [.4, 2.0], [.6, 2.5], [.25, 3.4], [0, 4.2]]
      .map(p => new THREE.Vector2(p[0], p[1])), 10), M.pale);
    spire.position.y = y + 2.2; ink(spire, 25);
    hall(S, 3.8, 0, 3.4, { R: 6.6, H: 2.2, lift: 1.0, cols: 4, z: 14 });   // 塔前殿
    finish(S, g); g.add(spire);
    return g;
  }

  // ── 汉口水塔：八角形砖塔，腰线分层，顶上瞭望亭（1909 年）
  function buildWaterTower() {
    const g = new THREE.Group(), S = mkS(), R = [5.4, 5.2, 5.0, 4.8, 4.6, 4.4], FH = 3.6;
    S.pale.box(16, 6, 16, 0, -3, 0);
    S.pale.geo(oct(6.4, 6.2, 1.2), 0, .6, 0);
    let y = 1.2;
    R.forEach((r, k) => {
      const r1 = R[k + 1] || r * .96, d = (r + r1) / 2 * Math.cos(Math.PI / 8) + .02;   // 窗在半高处，取上下径的平均，贴住收分的墙面
      S.wall.geo(oct(r, r1, FH), 0, y + FH / 2, 0);
      for (let f = 0; f < 8; f++) {
        const a = (f + .5) * Math.PI / 4;
        S.dark.box(1.0, k === 0 ? 2.4 : 1.6, .1, Math.sin(a) * d, y + FH * .5, Math.cos(a) * d, a);
      }
      S.pale.geo(oct(r + .35, r + .35, .3), 0, y + FH, 0);                  // 腰线
      y += FH;
    });
    S.pale.geo(oct(5.0, 5.0, .5), 0, y + .25, 0);                           // 挑台
    for (let f = 0; f < 16; f++) { const a = f / 16 * Math.PI * 2; S.dark.box(.12, 1.0, .12, Math.sin(a) * 4.8, y + 1, Math.cos(a) * 4.8); }
    S.wall.geo(oct(2.6, 2.4, 3.0), 0, y + 2, 0);                            // 瞭望亭
    S.roofs.geo(new THREE.ConeGeometry(3.4, 2.6, 8), 0, y + 4.8, 0);
    S.dark.cyl(.08, 3, 0, y + 7.4, 0);
    return finish(S, g);
  }

  // ── 湖北省博物馆：楚式高台建筑，一主两翼，深檐高脊
  function buildMuseum() {
    const g = new THREE.Group(), S = mkS();
    S.pale.box(64, 5, 34, 0, -2.5, 0);
    let y = 0;
    [[40, 22, 1.4], [34, 18, 1.4], [28, 15, 1.2]].forEach(([w, d, h]) => { S.pale.box(w, h, d, 0, y + h / 2, 0); y += h; });   // 三层高台
    for (let i = 0; i < 10; i++) S.pale.box(8, .4 * (i + 1), .7, 0, .2 * (i + 1), 14 - i * .65);
    hall(S, 7.2, 4.0, 5.2, { R: 10.6, r: 1.2, H: 4.4, lift: 1.5, cols: 6 });           // 主馆
    S.roofs.geo(roofGeo(13.2, 7.9, 1.2, .9, 18, 5), 0, 6.6, 0);                         // 主馆重檐
    [-1, 1].forEach(s => {                                                              // 两翼
      S.pale.box(16, 2.2, 14, s * 22, 1.1, 2);
      hall(S, 5.0, 2.2, 4.2, { R: 8.6, r: .6, H: 3.0, lift: 1.2, cols: 4, x: s * 22, z: 2 });
      S.pale.box(6, 1.2, 4, s * 12.5, 3.2, 0);                                          // 连廊
    });
    return finish(S, g);
  }

  // ── 红楼（湖北谘议局旧址）：两层红砖楼，中部门楼、山花与穹顶钟楼（1910 年）
  function buildHonglou() {
    const g = new THREE.Group(), S = mkS(), W = 40, D = 13, FL = 4.4, Y0 = 1.0;
    S.pale.box(W + 6, 7, D + 9, 0, Y0 - 3.5, 1);
    S.wall.box(W, 2 * FL, D, 0, Y0 + FL, 0);
    [0, 1, 2].forEach(f => S.pale.box(W + .5, .3, D + .5, 0, Y0 + f * FL, 0));        // 腰线、檐口
    for (let f = 0; f < 2; f++) for (let k = -7; k <= 7; k++) {
      if (Math.abs(k) < 2) continue;
      S.dark.box(1.2, 2.3, .12, k * 2.5, Y0 + f * FL + 2.2, D / 2 + .06);
      S.pale.box(1.7, .26, .3, k * 2.5, Y0 + f * FL + 3.55, D / 2 + .12);
    }
    S.wall.box(10, 2 * FL + 1.2, D + 4, 0, Y0 + FL + .6, 2);                            // 中部门楼
    for (let i = 0; i < 4; i++) S.pale.cyl(.5, FL - .3, -3.3 + i * 2.2, Y0 + (FL - .3) / 2, D / 2 + 4.4);
    S.pale.box(10.4, .5, 4.6, 0, Y0 + FL - .05, D / 2 + 2.3);                           // 门廊顶即二层阳台
    for (let i = 0; i < 12; i++) S.dark.box(.1, .9, .1, -4.6 + i * .84, Y0 + FL + .65, D / 2 + 4.5);
    S.dark.box(2.6, 3.2, .2, 0, Y0 + 1.6, D / 2 + 4.05);
    const ps = new THREE.Shape(); ps.moveTo(-5.4, 0); ps.lineTo(5.4, 0); ps.lineTo(0, 2.4); ps.closePath();
    S.pale.geo(new THREE.ExtrudeGeometry(ps, { depth: .8, bevelEnabled: false }), 0, Y0 + 2 * FL + 1.2, D / 2 + 3.4);   // 山花
    [-1, 1].forEach(s => {                                                              // 两坡屋面
      const slab = new THREE.BoxGeometry(W - 1, .5, D / 2 + 1.2); slab.rotateX(s * .42);
      S.roofs.geo(slab, 0, Y0 + 2 * FL + 1.3, s * D / 4);
    });
    S.wall.box(5.4, 3.6, 5.4, 0, Y0 + 2 * FL + 3, 0);                                  // 钟楼
    S.pale.disc(1.4, .2, 0, Y0 + 2 * FL + 3, 2.8, 0); S.dark.disc(.1, .3, 0, Y0 + 2 * FL + 3, 2.8, 0);
    const dome = new THREE.Mesh(new THREE.LatheGeometry([[3.2, 0], [3.4, .3], [2.9, 1.6], [1.8, 2.8], [.6, 3.5], [0, 3.7]]
      .map(p => new THREE.Vector2(p[0], p[1])), 16), M.roof);
    dome.position.y = Y0 + 2 * FL + 4.8; ink(dome, 35);
    S.dark.cyl(.07, 4, 0, Y0 + 2 * FL + 10.5, 0);
    finish(S, g); g.add(dome);
    return g;
  }

  // ── 鹦鹉洲长江大桥：三塔悬索桥，门形塔，主缆垂链，吊索成排（2014 年）。half 为半桥长（场景单位）
  function buildSuspension(half) {
    const g = new THREE.Group(), pale = new Acc(), dark = new Acc(), solid = new Acc();
    const DECK = 7.5, TOP = 36, B = 7.0, TZ = [-half * .56, 0, half * .56];
    pale.box(2 * B + 1.6, .7, 2 * half, 0, DECK, 0);
    [-1, 1].forEach(s => pale.box(.5, .5, 2 * half, s * (B + .5), DECK + .5, 0));
    TZ.forEach(z => {
      [-1, 1].forEach(s => solid.beam(V(s * (B + 1.4), -2, z), V(s * (B - .2), TOP, z), 2.0));   // 塔肢内倾
      solid.box(2 * B + 1.4, 1.6, 2.0, 0, DECK - 1.6, z);
      solid.box(2 * B + .2, 1.8, 2.0, 0, TOP - 2.5, z);
      solid.box(2 * B - 1, 1.2, 2.0, 0, TOP * .72, z);
      pale.box(2 * B + 6, 3, 7, 0, -1.5, z);                                            // 承台
    });
    const spans = [[-half, TZ[0], DECK + 1, TOP - .8, 3], [TZ[0], TZ[1], TOP - .8, TOP - .8, TOP - DECK - 4],
                   [TZ[1], TZ[2], TOP - .8, TOP - .8, TOP - DECK - 4], [TZ[2], half, TOP - .8, DECK + 1, 3]];
    [-1, 1].forEach(s => spans.forEach(([za, zb, ya, yb, sag]) => {
      const x = s * (B - .2), pts = [];
      for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push([za + (zb - za) * t, ya + (yb - ya) * t - sag * 4 * t * (1 - t)]); }
      for (let i = 0; i < 24; i++) dark.beam(V(x, pts[i][1], pts[i][0]), V(x, pts[i + 1][1], pts[i + 1][0]), .45);   // 主缆
      for (let i = 1; i < 24; i++) if (pts[i][1] > DECK + 1.5) dark.beam(V(x, DECK + .6, pts[i][0]), V(x, pts[i][1], pts[i][0]), .1);   // 吊索
    }));
    g.add(pale.mesh(M.pale, true, 30), solid.mesh(M.std, true, 30), dark.mesh(brushMat, false));
    return g;
  }

  // ── 归元禅寺：山门、钟鼓楼、大雄宝殿、藏经阁一线排开，旁有田字形罗汉堂（1658 年）
  function buildGuiyuan() {
    const g = new THREE.Group(), S = mkS();
    S.pale.box(62, 5, 64, 6, -2.5, 0);
    const wallSeg = (x0, z0, x1, z1) => S.wall.box(Math.abs(x1 - x0) + .8, 2.4, Math.abs(z1 - z0) + .8, (x0 + x1) / 2, 1.2, (z0 + z1) / 2);
    wallSeg(-14, -30, 36, -30); wallSeg(-14, 30, 36, 30); wallSeg(-14, -30, -14, 30); wallSeg(36, -30, 36, 30);   // 院墙
    hall(S, 3.4, 0, 3.4, { R: 6.2, H: 2.0, lift: 1.0, cols: 4, z: 26 });                  // 山门
    [-1, 1].forEach(s => {                                                                 // 钟楼、鼓楼
      hall(S, 2.0, 0, 3.0, { R: 4.2, r: 2.2, H: 1.2, lift: .8, cols: 2, x: s * 8, z: 15, win: false });
      hall(S, 1.6, 3.0, 2.4, { R: 3.6, H: 2.0, lift: .8, cols: 2, x: s * 8, z: 15, win: false, rail: false });
    });
    S.pale.box(20, 1.2, 16, 0, .6, 0);
    hall(S, 7.0, 1.2, 5.0, { R: 11.2, r: 1.5, H: 3.6, lift: 1.4, cols: 6 });               // 大雄宝殿
    S.roofs.geo(roofGeo(12.4, 7.3, 1.2, 1.0, 18, 5), 0, 3.8, 0);                          // 重檐
    hall(S, 5.2, 0, 3.6, { R: 8.4, r: 4.6, H: 1.4, lift: 1.0, cols: 5, z: -20 });         // 藏经阁
    hall(S, 4.2, 4.9, 3.2, { R: 7.2, H: 2.6, lift: 1.1, cols: 4, z: -20 });           // 上层落在下层屋面内沿（3.6 − .1 + 1.4）
    S.wall.box(15, 3.2, 15, 24, 1.6, -6);                                                   // 罗汉堂：田字形
    [[-3.75, -3.75], [3.75, -3.75], [-3.75, 3.75], [3.75, 3.75]].forEach(([dx, dz]) =>
      S.roofs.geo(roofGeo(4.6, .3, 1.8, .6, 10, 3), 24 + dx, 3.1, -6 + dz));
    return finish(S, g);
  }

  // ── 古琴台：汉白玉方台与石栏，台后一殿，两侧碑廊，前立牌坊；台面朝西，临月湖
  function buildQintai() {
    const g = new THREE.Group(), S = mkS();
    S.pale.box(30, 5, 38, 0, -2.5, -2);
    S.pale.box(11, 1.4, 11, 0, .7, 4);                                                    // 琴台
    ringAt(S.dark, 5.2, 1.9, .12, 1.3, 0, 4);                                              // 石栏
    perim(5.2, 1.3).forEach(p => S.dark.box(.22, 1.0, .22, p[0], 1.9, 4 + p[1]));
    for (let i = 0; i < 4; i++) S.pale.box(4, .35 * (i + 1), .6, 0, .175 * (i + 1), 11.6 - i * .6);
    hall(S, 4.0, 0, 3.6, { R: 7.0, H: 2.4, lift: 1.1, cols: 4, z: -9 });
    [-1, 1].forEach(s => S.wall.box(1.2, 2.2, 16, s * 13, 1.1, -4));                        // 碑廊
    [-1, 1].forEach(s => S.dark.cyl(.35, 5.2, s * 3.2, 2.6, 16));                          // 牌坊
    S.pale.box(8.6, .8, 1.1, 0, 5.4, 16); S.roofs.box(9.6, .5, 2.2, 0, 6.0, 16);
    return finish(S, g);
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
