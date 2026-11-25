const { test, expect } = require('./fixtures.cjs');

test('footbridges, museum approach and hillside stairs meet their ground surfaces', async ({ page }) => {
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__ready && window.__dbg);
  const result = await page.evaluate(() => {
    const { scene, landmarkGrounds, onLand } = window.__dbg;
    scene.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    const byKey = key => scene.children.find(node => node.userData.modelKey === key);
    function height(mesh, point, headroom) {
      ray.set(point.clone().addScaledVector(down, -headroom), down);
      const hits = ray.intersectObject(mesh, true);
      if (!hits.length) throw new Error('Missing surface on ' + mesh.name + ' at ' + point.toArray());
      return hits[0].point.y;
    }

    const island = byKey('lake');
    const bridges = landmarkGrounds.xingyin.bridges.map(({ name, endFace, land }, i) => {
      const mid = endFace[1], width = endFace[0].distanceTo(endFace[2]);
      const previous = i === 0 ? [-.49, 1.05, 31.45] : [-16.08, 1.01, -21.55];
      const towardDeck = island.localToWorld(new THREE.Vector3(...previous)).sub(mid);
      const towardLand = landmarkGrounds.xingyin.paths[i][1].clone().sub(mid);
      towardDeck.y = towardLand.y = 0;
      towardDeck.normalize(); towardLand.normalize();
      const stone = scene.getObjectByName(name + ' · 贴岸石质登陆台');
      const gaps = endFace.map(p => {
        const base = p.clone().lerp(mid, .25); // stay inside the outside handrail
        const deck = height(island, base.clone().addScaledVector(towardDeck, .018), .105);
        const landing = height(stone, base.clone().addScaledVector(towardLand, .025), .105);
        return Math.abs(deck - landing) / width;
      });
      const bank = ['听涛 · 两桥间落岸草坡', '听涛 · 近水草土缓坡'].map(label => scene.getObjectByName(label));
      // Check the middle of the apron as well as the joint at the bridge deck.
      const centerline = landmarkGrounds.xingyin.paths[i];
      const segments = stone.geometry.getAttribute('position').count / 4 - 1;
      let cover = 0;
      for (let j = 0; j < segments; j++) {
        const a = centerline[j], b = centerline[j + 1];
        const samples = Math.ceil(a.distanceTo(b) / .26);
        for (let k = 0; k < samples; k++) {
          const point = a.clone().lerp(b, (k + .5) / samples);
          ray.set(point.clone().addScaledVector(down, -.4), down);
          const apron = ray.intersectObject(stone)[0];
          if (!apron) throw new Error('Missing landing surface on ' + name);
          const ground = ray.intersectObjects(bank)[0];
          if (ground) cover = Math.max(cover, ground.point.y - apron.point.y);
        }
      }
      return { land: onLand(land.x, land.z), gap: Math.max(...gaps), cover };
    });

    const museum = byKey('museum'), plaza = scene.getObjectByName('省博北馆 · 中轴石铺前庭');
    const gate = museum.worldToLocal(landmarkGrounds.museum.paths[0].at(-1).clone()).z;
    const forecourt = [-3.6, 0, 3.6].map(x => {
      const point = z => museum.localToWorld(new THREE.Vector3(x, 0, z));
      let outer;
      for (let z = gate - .05; z > 12.83; z -= .28) outer = height(plaza, point(z), 1);
      const firstStep = height(museum, point(12.71), .80);
      return Math.abs(outer - firstStep) / museum.scale.y;
    });

    const stair = scene.getObjectByName('黄鹤楼 · 贴坡石阶');
    const slopes = landmarkGrounds.tower.steps.flatMap(({ sections }) => [.1, .5, .9].map(t => {
      const ys = sections.map(([left, right]) => height(stair, left.clone().lerp(right, t), .15));
      return Math.max(...ys.slice(1).map((y, i) => y - ys[i]));
    }));
    return { bridges, forecourt, slopes };
  });
  expect(result.bridges).toHaveLength(2);
  for (const bridge of result.bridges) {
    expect(bridge.land).toBe(true);
    expect(bridge.gap).toBeLessThan(.05);
    expect(bridge.cover).toBeLessThan(.025);
  }
  for (const gap of result.forecourt) expect(gap).toBeLessThan(.5 * 4.02 / 13);
  expect(result.slopes).toHaveLength(6);
  expect(Math.max(...result.slopes)).toBeLessThan(.035);
});

test('the Yellow Crane Tower view includes the west courts, pond and selectable garden buildings', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__ready && window.__dbg);
  await page.locator('#b-tower').click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const report = await page.evaluate(() => {
    const { towerPark: park, camera, controls, scene } = window.__dbg;
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    const down = new THREE.Vector3(0, -1, 0), ray = new THREE.Raycaster();
    const court = key => key === 'park_stupa' ? park.courts[0].name :
      key === 'park_paifang' ? park.courts[1].name : key === 'park_cranes' ? '归鹤池 · 池水' : park.courts[2].name;
    const top = document.querySelector('#title').getBoundingClientRect().bottom;
    const bottom = document.querySelector('#dock').getBoundingClientRect().top;
    const supports = [], outside = [];
    let stupaPoint;
    for (const asset of park.assets) {
      const key = asset.userData.parkAsset, bounds = new THREE.Box3().setFromObject(asset);
      ray.set(asset.position.clone().addScaledVector(down, -1), down);
      const pavement = ray.intersectObject(scene.getObjectByName(court(key)))[0];
      if (!pavement) throw Error('Missing floor at ' + asset.name);
      supports.push(Math.abs(pavement.point.y - asset.position.y));
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          const v = new THREE.Vector3(x,y,z).project(camera);
          const px = (1 + v.x) * innerWidth / 2, py = (1 - v.y) * innerHeight / 2;
          if (px < 14 || px > innerWidth - 14 || py < top || py > bottom) outside.push(asset.name);
        }
      if (key === 'park_stupa') {
        const body = bounds.getCenter(new THREE.Vector3()).project(camera);
        stupaPoint = [(1 + body.x) * innerWidth / 2, (1 - body.y) * innerHeight / 2];
      }
    }
    // Sample both sides of the shared landing, including the outer walking lines.
    const seams = [];
    function checkMouth(path, atStart, stepName, landingName) {
      const seam = atStart ? path[0] : path.at(-1);
      const along = (atStart ? path[1] : path.at(-2)).clone().sub(seam);
      along.y = 0;
      along.normalize();
      const across = new THREE.Vector3(-along.z, 0, along.x);
      const height = (p, mesh) => {
        ray.set(p.clone().addScaledVector(down, -1), down);
        const hit = ray.intersectObject(scene.getObjectByName(mesh))[0];
        if (!hit) throw Error('Open threshold at ' + mesh);
        return hit.point.y;
      };
      for (const width of [-.20, 0, .20]) {
        const p = seam.clone().addScaledVector(across, width);
        seams.push(Math.abs(height(p.clone().addScaledVector(along, .075), stepName) -
          height(p.clone().addScaledVector(along, -.075), landingName)));
      }
    }
    checkMouth(park.paths[1], true, '西区 · 西门石阶', '西区 · 山脚街口');
    checkMouth(park.paths[4], false, '西区 · 由牌坊至归鹤池', park.courts[2].name);
    return { keys: park.assets.map(a => a.userData.parkAsset).sort(), supports, seams, outside, stupaPoint,
      position: camera.position.toArray(), target: controls.target.toArray() };
  });
  expect(report.keys).toEqual(['park_cranes','park_paifang','park_pavilion','park_pavilion','park_stupa']);
  expect(Math.max(...report.supports)).toBeLessThan(.06);
  expect(Math.max(...report.seams)).toBeLessThan(.23);
  expect(report.outside).toEqual([]);
  // Reach the same spot by manual browsing while the two-rivers view is selected.
  await page.locator('#b-core').click();
  await page.evaluate(({position, target}) => {
    const { camera, controls } = window.__dbg;
    controls.dispatchEvent({type: 'start'});
    camera.position.fromArray(position);
    controls.target.fromArray(target);
    controls.update();
    camera.updateMatrixWorld(true);
  }, report);
  await expect(page.locator('#b-tower')).toHaveAttribute('aria-pressed', 'false');
  await page.mouse.move(...report.stupaPoint);
  await expect(page.locator('#tip')).toHaveText('胜像宝塔');
  await page.mouse.click(...report.stupaPoint);
  await expect(page.locator('#b-tower')).toHaveAttribute('aria-pressed', 'true');
});

test('landmark paths reach their gates, streets and banks on the rendered terrain', async ({ page }) => {
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__ready && window.__dbg);
  const failures = await page.evaluate(() => {
    const { scene, cityGround, landmarkGrounds, plantingSurface, LAKES, GEO } = window.__dbg;
    const byKey = key => scene.children.find(node => node.userData.focus === key);
    const path = name => cityGround.streets.filter(s => s.name === name);
    const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
    const ray = new THREE.Raycaster(), down = new THREE.Vector3(0,-1,0);
    function hit(name,p) {
      ray.set(new THREE.Vector3(p.x,50,p.z),down);
      const hits=[];
      THREE.Mesh.prototype.raycast.call(scene.getObjectByName(name),ray,hits);
      return hits.sort((a,b)=>a.distance-b.distance)[0]?.point.y;
    }
    const failures=[];
    function checkPath(name, segments) {
      if (!segments.length) failures.push(name+' has no path');
      for (const [i,{a,b}] of segments.entries()) {
        if (i && distance(segments[i-1].b,a) > .015) failures.push(name+' is interrupted');
        const p={x:(a.x+b.x)/2,z:(a.z+b.z)/2};
        const base=plantingSurface(p.x,p.z), y=hit(name,p);
        if (base === null || y === undefined || y < base-.025) failures.push({name,index:i,base,paving:y});
      }
    }
    for(const name of ['古琴台山门与月湖步道','归元禅寺山门前庭','晴川阁与铁门关沿台石径','蛇山 · 台地折巷与坡阶'])
      checkPath(name,path(name));

    const qintai=path('古琴台山门与月湖步道');
    const lake=LAKES[GEO.lakes.findIndex(lake=>lake.name==='月湖')];
    const qintaiGate=byKey('qintai').localToWorld(new THREE.Vector3(0,.12,18.30));
    if(distance(qintai[0].a,qintaiGate)>.015 ||
       Math.min(...lake.map(([x,z])=>distance(qintai.at(-1).b,{x,z})))>4)
      failures.push('Guqin Terrace path misses its threshold or the lakeshore');

    const temple=path('归元禅寺山门前庭'), street=path('翠微山门接乡路');
    const gate=byKey('guiyuan').localToWorld(new THREE.Vector3(0,.17,29.91));
    if(distance(gate,temple[0].a)>.015 || distance(temple.at(-1).b,street[0].a)>.05)
      failures.push('Guiyuan apron misses its threshold or Cuiwei Lane');

    const qc=path('晴川阁与铁门关沿台石径'), spit=path('南岸嘴两江会口石径');
    const toe=byKey('qc').localToWorld(new THREE.Vector3(20,0,19.9));
    if(distance(qc[0].a,toe)>.015 || distance(qc.at(-1).b,spit[0].a)>.015)
      failures.push('Qingchuan gate path misses the stairs or confluence trail');

    const alley=path('蛇山 · 台地折巷与坡阶');
    const summit=landmarkGrounds.tower.steps.find(s=>s.side===1).walk.at(-1);
    const foot=alley.at(-1).b, slopeStreet=path('蛇山脚坡街与首义街口');
    if(distance(alley[0].a,summit)>.015 ||
       Math.min(...slopeStreet.map(s=>distance(s.a,foot)))>1.5)
      failures.push('Snake Hill steps miss the terrace or the lower street');
    return failures;
  });
  expect(failures).toEqual([]);
});
