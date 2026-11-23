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
  const { scene, HILLS, YZ, HAN } = window.__dbg;
  scene.updateMatrixWorld(true);
  const within = (x, z) => x > -540 && x < 410 && z > -545 && z < 325;
  const lots = {}, landmarks = {}, meshes = [];
  const boats = scene.children.find(o => o.material?.uniforms?.uBoats).material.uniforms.uBoats.value;
  const pack = array => {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  };
  function copy(node, group, name, material) {
    const geo = node.geometry, position = geo.getAttribute('position');
    const index = geo.index ? pack(Uint32Array.from(geo.index.array)) : null;
    meshes.push({ group, name, material, positions: pack(position.array), index,
      matrix: node.matrixWorld.toArray() });
  }
  for (const node of scene.children) {
    if (node.isInstancedMesh && node.name.startsWith('City / ')) {
      const kind = node.name.slice(7);
      if (lots[kind]) continue; // All materials in a prototype use the same lot transforms.
      lots[kind] = [];
      const m = new THREE.Matrix4();
      for (let i = 0; i < node.count; i++) {
        node.getMatrixAt(i, m);
        m.premultiply(node.matrixWorld);
        if (within(m.elements[12], m.elements[14])) lots[kind].push(m.toArray());
      }
    } else if (node.userData.focus && node.userData.focus !== 'lake' && within(node.position.x, node.position.z)) {
      const key = node.userData.focus;
      landmarks[key] = { name: node.userData.name, matrix: node.matrixWorld.toArray() };
      if (key === 'tower' || key === 'bridge') continue;
      node.traverse(child => {
        if (!child.isMesh || !child.visible || !child.material.visible) return;
        const m = child.material, tint = m.uniforms?.uPaper?.value;
        const material = !m.uniforms ? (m.color?.getHex() === 0xece9e0 ? 'Paper' : 'Ink') :
          (tint?.getHex() === 0x9ba49a ? 'Slate' : 'Masonry');
        copy(child, node.userData.name, key, material);
      });
    } else if (node.isGroup && within(node.position.x, node.position.z) &&
               boats.some(p => p.x === node.position.x && p.y === node.position.z)) {
      node.traverse(child => {
        if (child.isMesh) copy(child, '江上舟船', 'River boat', child.material.isShaderMaterial ? 'Boat' : 'Ink');
      });
    } else if (node.name === 'Tower hillside terrace') {
      copy(node, '蛇山', 'Tower hillside terrace', 'Masonry');
    } else if (node.name === 'City streets') {
      copy(node, '武汉街道', 'Street network', 'Streets');
    } else if (node.geometry?.type === 'ExtrudeGeometry') {
      copy(node, '三镇河岸', 'Riverbank', 'Land');
    } else if (node.isMesh && node.material.uniforms?.uFade?.value.x === 12) {
      copy(node, '山林', 'Pine groves', 'Pines');
    }
  }
  for (const hill of HILLS) {
    if (within(hill.peak.x, hill.peak.z))
      copy(hill.mesh, '山林', hill.name || 'River hills', 'Hills');
  }
  const rivers = [YZ, HAN].map(river => river.s.filter(s => within(s.p.x, s.p.z))
    .map(s => [s.p.x, -s.p.z, s.d.z, s.d.x, s.w]));
  return { lots, landmarks, meshes, rivers };
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
    if (Object.keys(city.lots).length !== 5 || !city.landmarks.bridge || !city.landmarks.tower ||
        city.meshes.filter(m => m.material === 'Land').length !== 3)
      throw new Error('Missing landmarks, districts or banks. Rebuild dist/index.html before capture.');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'city-capture.json.gz'), gzipSync(JSON.stringify(city)));
    console.log(Object.fromEntries(Object.entries(city.lots).map(([kind, lots]) => [kind, lots.length])));
    console.log(Object.keys(city.landmarks), city.meshes.length + ' context meshes');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
