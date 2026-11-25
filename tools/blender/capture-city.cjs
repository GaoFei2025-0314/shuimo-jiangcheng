// Capture the running map's layout and terrain. The browser closes after this single view.
const fs = require('node:fs');
const path = require('node:path');
const { gzipSync } = require('node:zlib');
const { pathToFileURL } = require('node:url');
const { webkit } = require('@playwright/test');
const { scripts } = require('../../tests/browser/fixtures.cjs');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'output/architecture');

function capture() {
  const { scene, YZ, HAN, LAKES, vessels } = window.__dbg;
  scene.updateMatrixWorld(true);
  const parkAssets = [];
  const lots = {}, landmarks = {}, vegetation = {}, meshes = [], atmosphere = [], greenway = [];
  const water = scene.children.find(o => o.material?.uniforms?.uBoats).material.uniforms;
  const wakes = (water.uBoatWake?.value ?? []).flatMap((wake,i) => {
    const center=water.uBoats.value[i];
    return wake.w>0 && center && Math.hypot(wake.x,wake.y)>.1
      ? [{center:[center.x,-center.y],forward:[wake.x,-wake.y],stern:wake.z,length:wake.w}] : [];
  });
  const pack = array => {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  };
  function geometryOf(node) {
    const geo = node.geometry;
    return {positions:pack(geo.getAttribute('position').array),index:geo.index ? pack(Uint32Array.from(geo.index.array)) : null};
  }
  function copy(node, group, name, material) {
    const item = { group, name, material, ...geometryOf(node), matrix: node.matrixWorld.toArray() };
    for (const key of ['deckPigment', 'vergeCover', 'walkEdge']) {
      const attribute = node.geometry.getAttribute(key);
      if (attribute) item[key] = pack(attribute.array);
    }
    if (material === 'PaperFoliage') {
      item.uv = pack(node.geometry.getAttribute('uv').array);
      item.colors = pack(node.geometry.getAttribute('color').array);
    }
    meshes.push(item);
  }
  function placements(node) {
    const m = new THREE.Matrix4(), transforms = [];
    const authored = node.userData.authoredMatrices;
    for (let i = 0; i < authored.length; i += 16) {
      m.fromArray(authored, i);
      transforms.push(m.premultiply(node.matrixWorld).toArray());
    }
    return transforms;
  }
  for (const node of scene.children) {
    if (node.isInstancedMesh && node.name.startsWith('City / ')) {
      const kind = node.name.slice(7);
      if (lots[kind]) continue; // All materials in a prototype use the same lot transforms.
      lots[kind] = placements(node);
    } else if (node.isInstancedMesh && node.userData.vegetation) {
      const { species, part, material } = node.userData.vegetation;
      const trees = vegetation[species] ||= { matrices: placements(node), parts: {} };
      if (trees.matrices.length * 16 !== node.userData.authoredMatrices.length || trees.parts[part]) throw new Error('Inconsistent planting batch: '+species);
      trees.parts[part] = { ...geometryOf(node), material, colors: pack(node.geometry.getAttribute('color').array) };
      if (species === 'broadleaf' && part === 'foliage' && node.geometry.hasAttribute('crownCenter'))
        trees.parts[part].crownCenter = pack(node.geometry.getAttribute('crownCenter').array);
    } else if (node.name.startsWith('两岸近树纸本枝叶 · ')) {
      copy(node, '两岸近树纸本枝叶', node.name, 'PaperFoliage');
    } else if (node.userData.lakeGreenway) {
      const positions = node.geometry.getAttribute('position'), point = new THREE.Vector3();
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld);
        greenway.push([point.x, -point.z, point.y]);
      }
    } else if (node.userData.mistStrength !== undefined) {
      atmosphere.push({ matrix: node.matrixWorld.toArray(), width: node.geometry.parameters.width,
        depth: node.geometry.parameters.height, strength: node.userData.mistStrength });
    } else if (node.userData.landscapeSurface) {
      const { group, name, material } = node.userData.landscapeSurface;
      copy(node, group, name, material);
    } else if (node.userData.parkAsset) {
      parkAssets.push({ key: node.userData.parkAsset, name: node.userData.name, matrix: node.matrixWorld.toArray() });
    } else if (node.userData.modelKey) {
      landmarks[node.userData.modelKey] = { name: node.userData.name, matrix: node.matrixWorld.toArray() };
    } else if (node.name === 'City streets') {
      copy(node, '武汉街道', 'Street network', 'Streets');
    } else if (node.geometry?.type === 'ExtrudeGeometry') {
      copy(node, '三镇河岸', 'Riverbank', 'Land');
    }
  }
  const vesselModels=vessels ? vessels.map(vessel=>vessel.model) : scene.children.filter(node=>node.userData.vessel);
  const ships=vesselModels.flatMap((model,i)=>{
    if (!model.visible) return [];
    const {type,stern,bow,draft}=model.userData.vessel;
    const group=type==='lakeLaunch' ? '东湖轻舟' : '江上舟船';
    const waterlineMidpoint=[(stern+bow)/2,0,0];
    const worldToPivot=model.matrixWorld.clone()
      .multiply(new THREE.Matrix4().makeTranslation(...waterlineMidpoint)).invert();
    const parts=[];
    model.traverse(child => {
      if (!child.isMesh || !child.visible) return;
      const material=child.userData.vesselMaterial;
      if (!material) return;
      const item={name:child.name,group,material:Array.isArray(material)?material[0]:material,
        ...geometryOf(child),matrix:worldToPivot.clone().multiply(child.matrixWorld).toArray()};
      if (Array.isArray(material)) {
        item.materialSlots=material;
        item.faceGroups=child.geometry.groups.map(({start,count,materialIndex})=>[start/3,count/3,materialIndex]);
      }
      parts.push(item);
    });
    return [{id:'vessel-'+String(i+1).padStart(2,'0'),name:model.name,type,group,draft,
      matrix:model.matrixWorld.toArray(),waterlineMidpoint,parts}];
  });
  const rivers = [YZ, HAN].map(river => river.s
    .map(s => [s.p.x, -s.p.z, s.d.z, s.d.x, s.w]));
  const lakes = LAKES.map(ring=>ring.map(([x,z])=>[x,-z]));
  return { lots, landmarks, parkAssets, vegetation, meshes, vessels:ships, rivers, greenway, eastLake:lakes[0], lakes, atmosphere, wakes };
}

(async () => {
  const browser = await webkit.launch();
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 960, height: 650 } });
    await page.route(/https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//, route => {
      const file = scripts[new URL(route.request().url()).pathname.split('/').pop()];
      return file ? route.fulfill({ body: fs.readFileSync(path.join(root, 'node_modules', file)),
        contentType: 'text/javascript' }) : route.abort();
    });
    await page.route(/https:\/\/fonts\./, route => route.fulfill({ body: '', contentType: 'text/css' }));
    await page.goto(pathToFileURL(path.join(root, 'dist/index.html')).href + '?debug');
    await page.waitForFunction(() => window.__ready && window.__dbg);
    const city = await page.evaluate(capture);
    city.walkViews = await page.evaluate(async () => {
      const select = document.getElementById('walk-view');
      const {camera, controls} = window.__dbg;
      const views = {};
      for (const key of ['hy-door', 'hy-court', 'wc-door', 'wc-court', 'hy-above', 'wc-above']) {
        select.value = key;
        select.dispatchEvent(new Event('change'));
        if (location.hash !== '#walk='+key) throw new Error('Missing public walking view: '+key);
        await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
        views[key] = {eye:camera.position.toArray(), target:controls.target.toArray(), fov:camera.fov};
      }
      return views;
    });
    if (Object.keys(city.lots).length !== 7 || Object.keys(city.vegetation).length !== 4 || Object.keys(city.landmarks).length !== 15 || !city.landmarks.lake ||
        city.meshes.filter(m => m.material === 'Land').length !== 3)
      throw new Error('Missing landmarks, districts or banks. Rebuild dist/index.html before capture.');
    const parkKeys = city.parkAssets.map(asset => asset.key).sort();
    if (parkKeys.join(',') !== 'park_cranes,park_paifang,park_pavilion,park_pavilion,park_stupa')
      throw new Error('Missing architectural groups from the Yellow Crane Tower park.');
    if (city.greenway.length < city.eastLake.length / 2 || !city.atmosphere.length || !city.meshes.some(m => m.material === 'DistantRidge'))
      throw new Error('Missing lake greenway, mist or distant ridges in the captured map.');
    console.log(Object.fromEntries(Object.entries(city.lots).map(([kind, lots]) => [kind, lots.length])));
    for (const [kind, trees] of Object.entries(city.vegetation)) {
      if (!trees.parts.wood || !trees.parts.foliage) throw new Error('Incomplete tree prototype: '+kind);
    }
    console.log(Object.fromEntries(Object.entries(city.vegetation).map(([kind, trees]) => [kind, trees.matrices.length])));
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'city-capture.json.gz'), gzipSync(JSON.stringify(city)));
    console.log(Object.keys(city.landmarks), city.meshes.length + ' context meshes');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
