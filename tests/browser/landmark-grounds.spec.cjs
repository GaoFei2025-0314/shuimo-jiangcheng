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
